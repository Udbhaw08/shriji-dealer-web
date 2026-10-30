import test from 'node:test';
import assert from 'node:assert/strict';

const crmCalls = {
  accountPuts: [],
  contactPosts: [],
  contactPuts: [],
};

const mockContactsUnderAccount = [
  {
    id: 'con-owner-1',
    Full_Name: 'Owner Person',
    Portal_Role: 'Owner',
    Account_Name: { id: '928463000001954003' },
    User_Source: null, // missing initially
  },
  {
    id: 'con-staff-2',
    Full_Name: 'Staff Member',
    Portal_Role: 'Staff',
    Account_Name: { id: '928463000001954003' },
    User_Source: null, // missing initially
  },
  {
    id: 'con-brand-3',
    Full_Name: 'Brand Representative',
    Portal_Role: 'Brand',
    Account_Name: { id: '928463000001954003' },
    User_Source: null, // missing initially
  },
];

// Mock fetch for Zoho OAuth & CRM API endpoints
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  const method = options.method || 'GET';
  let body = null;
  if (options.body && typeof options.body === 'string' && options.body.trim().startsWith('{')) {
    try {
      body = JSON.parse(options.body);
    } catch {}
  }

  // OAuth token refresh
  if (urlStr.includes('/oauth/v2/token')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'mock-access-token', expires_in: 3600 }),
    };
  }

  // CRM Contacts Search
  if (urlStr.includes('/crm/v2/Contacts/search')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: mockContactsUnderAccount }),
    };
  }

  // CRM Contacts POST
  if (urlStr.endsWith('/crm/v2/Contacts') && method === 'POST') {
    if (body?.data?.[0]) crmCalls.contactPosts.push(body.data[0]);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ status: 'success', details: { id: 'con-new-123' } }] }),
    };
  }

  // CRM Contacts PUT (batch)
  if (urlStr.endsWith('/crm/v2/Contacts') && method === 'PUT') {
    if (body?.data) crmCalls.contactPuts.push(...body.data);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: body.data.map(d => ({ status: 'success', details: { id: d.id } })) }),
    };
  }

  // CRM Contacts PUT (single ID)
  if (urlStr.includes('/crm/v2/Contacts/') && method === 'PUT') {
    if (body?.data) crmCalls.contactPuts.push(...body.data);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ status: 'success', details: { id: body.data[0].id } }] }),
    };
  }

  // CRM Accounts GET
  if (urlStr.includes('/crm/v2/Accounts/928463000001954003')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: [{
          id: '928463000001954003',
          Account_Name: 'Sunshine Store',
          User_Source: 'ReStor Dealer',
          Dealer_Status: 'Approved',
        }],
      }),
    };
  }

  // CRM Contacts GET
  if (urlStr.includes('/crm/v2/Contacts/con-owner-1')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: [{
          id: 'con-owner-1',
          Full_Name: 'Owner Person',
          Portal_Role: 'Owner',
          User_Source: 'ReStor Dealer',
        }],
      }),
    };
  }

  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: [] }),
  };
};

test('CRM User Source: Strict picklist normalization guards against arbitrary channel strings', async () => {
  const { ALLOWED_USER_SOURCES, normalizeUserSource } = await import('../src/services/crmClient.js');

  assert.deepEqual(ALLOWED_USER_SOURCES, [
    'ReStor Dealer',
    'ReStor Staff',
    'ReStor Brand',
    'ReStor Customer',
  ]);

  // Exact matches
  assert.equal(normalizeUserSource('ReStor Dealer'), 'ReStor Dealer');
  assert.equal(normalizeUserSource('ReStor Staff'), 'ReStor Staff');
  assert.equal(normalizeUserSource('ReStor Brand'), 'ReStor Brand');
  assert.equal(normalizeUserSource('ReStor Customer'), 'ReStor Customer');

  // Role keyword matching
  assert.equal(normalizeUserSource('dealer'), 'ReStor Dealer');
  assert.equal(normalizeUserSource('staff'), 'ReStor Staff');
  assert.equal(normalizeUserSource('brand'), 'ReStor Brand');
  assert.equal(normalizeUserSource('customer'), 'ReStor Customer');

  // Guard against arbitrary/synthetic channels like WhatsApp, Meta, SMS, MC
  assert.equal(normalizeUserSource('whatsapp', 'dealer'), 'ReStor Dealer');
  assert.equal(normalizeUserSource('meta', 'staff'), 'ReStor Staff');
  assert.equal(normalizeUserSource('mc', 'customer'), 'ReStor Customer');
  assert.equal(normalizeUserSource('sms', 'brand'), 'ReStor Brand');
  assert.equal(normalizeUserSource(null, 'dealer'), 'ReStor Dealer');
});

test('CRM User Source: createDealerContact populates User_Source field', async () => {
  const { createDealerContact, FIELDS } = await import('../src/services/crmClient.js');

  // Test create contact for Dealer Owner
  await createDealerContact({
    accountId: '928463000001954003',
    personName: 'Shriji Owner',
    phone: '9876543210',
    email: 'owner@shriji.com',
    portalRole: 'Owner',
    userSource: 'ReStor Dealer',
  });

  const ownerPost = crmCalls.contactPosts[crmCalls.contactPosts.length - 1];
  assert.equal(ownerPost[FIELDS.contact.userSource()], 'ReStor Dealer');

  // Test create contact for Staff
  await createDealerContact({
    accountId: '928463000001954003',
    personName: 'Shriji Staff',
    phone: '9876543211',
    email: 'staff@shriji.com',
    portalRole: 'Staff',
    userSource: 'ReStor Staff',
  });

  const staffPost = crmCalls.contactPosts[crmCalls.contactPosts.length - 1];
  assert.equal(staffPost[FIELDS.contact.userSource()], 'ReStor Staff');
});

test('CRM User Source: linkContactToBackendUser stamps User_Source onto Contact', async () => {
  const { linkContactToBackendUser, FIELDS } = await import('../src/services/crmClient.js');

  await linkContactToBackendUser('con-owner-1', 'usr-123', { userSource: 'ReStor Dealer' });
  const lastPut = crmCalls.contactPuts[crmCalls.contactPuts.length - 1];
  assert.equal(lastPut.id, 'con-owner-1');
  assert.equal(lastPut[FIELDS.contact.backendUserId()], 'usr-123');
  assert.equal(lastPut[FIELDS.contact.userSource()], 'ReStor Dealer');
});

test('CRM User Source: getDealerAccount and getDealerContact return userSource', async () => {
  const { getDealerAccount, getDealerContact } = await import('../src/services/crmClient.js');

  const account = await getDealerAccount('928463000001954003');
  assert.equal(account.userSource, 'ReStor Dealer');

  const contact = await getDealerContact('con-owner-1');
  assert.equal(contact.userSource, 'ReStor Dealer');
});

test('CRM User Source: syncAccountUserSourceToContacts updates contacts missing User_Source with exact picklists', async () => {
  const { syncAccountUserSourceToContacts, FIELDS } = await import('../src/services/crmClient.js');

  crmCalls.contactPuts = [];
  const updated = await syncAccountUserSourceToContacts('928463000001954003', 'ReStor Dealer');
  assert.equal(updated, true);

  // Missing contacts (owner, staff, brand) should receive their respective User_Source
  const ownerUpdate = crmCalls.contactPuts.find(c => c.id === 'con-owner-1');
  const staffUpdate = crmCalls.contactPuts.find(c => c.id === 'con-staff-2');
  const brandUpdate = crmCalls.contactPuts.find(c => c.id === 'con-brand-3');

  assert.ok(ownerUpdate, 'Owner contact update missing');
  assert.equal(ownerUpdate[FIELDS.contact.userSource()], 'ReStor Dealer');

  assert.ok(staffUpdate, 'Staff contact update missing');
  assert.equal(staffUpdate[FIELDS.contact.userSource()], 'ReStor Staff');

  assert.ok(brandUpdate, 'Brand contact update missing');
  assert.equal(brandUpdate[FIELDS.contact.userSource()], 'ReStor Brand');
});
