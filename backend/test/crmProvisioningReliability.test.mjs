import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Test environment configuration
const testEnv = {
  jwtSecret: 'test-secret-at-least-32-chars-long-security',
  jwtExpiresIn: '15m',
  refreshExpiresDays: 7,
  crmPollMinutes: 5,
  catalogTtlMinutes: 10,
  zoho: {
    dc: 'in',
    crm: {
      clientId: 'crm-client-id',
      clientSecret: 'crm-client-secret',
      refreshToken: 'crm-refresh-token',
    },
    commerce: {
      orgId: 'comm-org-123',
      clientId: 'comm-client-id',
      clientSecret: 'comm-client-secret',
      refreshToken: 'comm-refresh-token',
      dealerPricebookId: 'pb-default-dealer-pricebook-999',
    },
  },
};

// In-memory mock database
const db = {
  dealers: [],
  users: [],
  syncState: {},
  auditLogs: [],
};

let nextId = 1;

function resetDb() {
  db.dealers = [];
  db.users = [];
  db.syncState = {};
  db.auditLogs = [];
  nextId = 1;
}

// Mock CRM calls tracker
const crmCalls = {
  createdAccounts: [],
  createdContacts: [],
  linkedContacts: [],
  searchedAccounts: [],
  accountReturnId: null,
  contactReturnId: null,
  failAccountCreate: false,
  failContactCreate: false,
  mockContactsUnderAccount: [],
};

function resetCrm() {
  crmCalls.createdAccounts = [];
  crmCalls.createdContacts = [];
  crmCalls.linkedContacts = [];
  crmCalls.searchedAccounts = [];
  crmCalls.accountReturnId = null;
  crmCalls.contactReturnId = null;
  crmCalls.failAccountCreate = false;
  crmCalls.failContactCreate = false;
  crmCalls.mockContactsUnderAccount = [];
}

// Tagged template mock for SQL
const mockSql = (strings, ...values) => {
  const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ''), '').trim();
  const qLower = query.toLowerCase();

  // Audit
  if (qLower.includes('insert into audit_logs')) {
    db.auditLogs.push({ values });
    return Promise.resolve([]);
  }

  // Sync state
  if (qLower.includes('insert into sync_state')) {
    db.syncState[values[0]] = values[1];
    return Promise.resolve([]);
  }

  // SELECT ... FROM dealers WHERE owner_user_id = ...
  if (qLower.includes('select id from dealers where owner_user_id =')) {
    const ownerId = values[0];
    const matches = db.dealers.filter((d) => d.owner_user_id === ownerId);
    return Promise.resolve(matches);
  }

  // SELECT id FROM dealers WHERE dealer_code = ... (uniqueness check during generateUniqueDealerCode)
  if (qLower.includes('from dealers where dealer_code =') || qLower.includes('from dealers where lower(dealer_code) =')) {
    const code = values[0];
    const matches = db.dealers.filter((d) => String(d.dealer_code).toLowerCase() === String(code).toLowerCase());
    return Promise.resolve(matches);
  }

  // INSERT INTO dealers
  if (qLower.includes('insert into dealers')) {
    const ownerUserId = values[0];
    const businessName = values[1];
    const gstNumber = values[2];
    const gstTreatment = values[3];
    const address = values[4];
    const status = 'pending';
    const dealerCode = values[5];
    const newDealer = {
      id: `dealer-${nextId++}`,
      owner_user_id: ownerUserId,
      business_name: businessName,
      gst_number: gstNumber,
      gst_treatment: gstTreatment,
      address,
      status,
      dealer_code: dealerCode,
      zoho_account_id: null,
      price_tier: null,
      created_at: new Date(),
    };
    db.dealers.push(newDealer);
    return Promise.resolve([newDealer]);
  }

  // UPDATE dealers SET zoho_account_id = ...
  if (qLower.includes('update dealers set zoho_account_id =')) {
    const accId = values[0];
    const dealerId = values[1];
    const dealer = db.dealers.find((d) => d.id === dealerId);
    if (dealer) dealer.zoho_account_id = accId;
    return Promise.resolve(dealer ? [dealer] : []);
  }

  // UPDATE users SET role = 'dealer' ...
  if (qLower.includes("update users set role = 'dealer'")) {
    const dealerId = values[0];
    const fullName = values[1];
    const phone = values[2];
    const userId = values[3];
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      user.role = 'dealer';
      user.status = 'pending';
      user.dealer_id = dealerId;
      if (fullName) user.full_name = fullName;
      if (phone) user.phone = phone;
    }
    return Promise.resolve(user ? [user] : []);
  }

  // UPDATE users SET zoho_contact_id = ...
  if (qLower.includes('update users set zoho_contact_id =')) {
    const contactId = values[0];
    const userId = values[1];
    const user = db.users.find((u) => u.id === userId);
    if (user) user.zoho_contact_id = contactId;
    return Promise.resolve(user ? [user] : []);
  }

  // SELECT FOR CRMPoll: unlinked accounts (zoho_account_id is null)
  if (qLower.includes('from dealers d join users u on u.id = d.owner_user_id') && qLower.includes('d.zoho_account_id is null')) {
    const results = [];
    for (const d of db.dealers) {
      if (d.status === 'pending' && !d.zoho_account_id) {
        const u = db.users.find((usr) => usr.id === d.owner_user_id) || {};
        results.push({
          id: d.id,
          business_name: d.business_name,
          gst_number: d.gst_number,
          gst_treatment: d.gst_treatment,
          address: d.address,
          dealer_code: d.dealer_code,
          owner_id: u.id,
          email: u.email,
          phone: u.phone,
          full_name: u.full_name,
        });
      }
    }
    return Promise.resolve(results);
  }

  // SELECT FOR CRMPoll: unlinked contacts (zoho_account_id is not null and zoho_contact_id is null)
  if (qLower.includes('from dealers d join users u on u.id = d.owner_user_id') && qLower.includes('d.zoho_account_id is not null and u.zoho_contact_id is null')) {
    const results = [];
    for (const d of db.dealers) {
      if (d.zoho_account_id) {
        const u = db.users.find((usr) => usr.id === d.owner_user_id);
        if (u && !u.zoho_contact_id) {
          results.push({
            id: d.id,
            business_name: d.business_name,
            dealer_code: d.dealer_code,
            zoho_account_id: d.zoho_account_id,
            owner_id: u.id,
            email: u.email,
            phone: u.phone,
            full_name: u.full_name,
          });
        }
      }
    }
    return Promise.resolve(results);
  }

  // SELECT FOR CRMPoll: active/pending dealers for status sync
  if (qLower.includes('from dealers') && qLower.includes('status in') && qLower.includes('zoho_account_id is not null')) {
    const matches = db.dealers.filter((d) => ['pending', 'approved'].includes(d.status) && Boolean(d.zoho_account_id));
    return Promise.resolve(matches);
  }

  // SELECT * FROM dealers WHERE id = ...
  if (qLower.includes('select * from dealers where id =')) {
    const id = values[0];
    const match = db.dealers.find((d) => d.id === id);
    return Promise.resolve(match ? [match] : []);
  }

  return Promise.resolve([]);
};

mockSql.begin = async (cb) => cb(mockSql);

// Mock CRM functions
const mockCrm = {
  isCrmConfigured: () => true,
  createDealerAccount: async (payload) => {
    if (crmCalls.failAccountCreate) {
      throw new Error('CRM Account Create Outage');
    }
    crmCalls.createdAccounts.push(payload);
    return crmCalls.accountReturnId || `crm-acc-${nextId++}`;
  },
  createDealerContact: async (payload) => {
    if (crmCalls.failContactCreate) {
      throw new Error('CRM Contact Create Outage');
    }
    crmCalls.createdContacts.push(payload);
    return crmCalls.contactReturnId || `crm-con-${nextId++}`;
  },
  linkContactToBackendUser: async (contactId, userId) => {
    crmCalls.linkedContacts.push({ contactId, userId });
    return true;
  },
  findOwnerContactInAccount: async (zohoAccountId, { backendUserId, email, phone } = {}) => {
    crmCalls.searchedAccounts.push({ zohoAccountId, backendUserId, email, phone });
    // Search within mock contacts configured for this account
    const matching = crmCalls.mockContactsUnderAccount.filter((c) => c.accountId === zohoAccountId);
    if (!matching.length) return null;

    // By backend user id
    if (backendUserId) {
      const byUser = matching.find((c) => c.backendUserId === String(backendUserId));
      if (byUser) return { zohoContactId: byUser.id, matchedBy: 'backend_user_id', contact: byUser };
    }

    // By identity
    const byIdentity = matching.filter((c) => (c.portalRole === 'Owner' || !c.reportingTo) && (c.email === email || c.phone === phone));
    if (byIdentity.length === 1) {
      return { zohoContactId: byIdentity[0].id, matchedBy: 'owner_identity', contact: byIdentity[0] };
    }
    if (byIdentity.length > 1) {
      return { ambiguous: true };
    }
    return null;
  },
  getPrimaryContactForAccount: async () => null,
  getDealerAccount: async (accId) => ({
    zohoAccountId: accId,
    dealerStatus: 'Pending',
    businessName: 'Mock Store',
  }),
};

// Module mocks
mock.module('../src/config/env.js', { namedExports: { env: testEnv } });
mock.module('../src/db/pool.js', { namedExports: { sql: mockSql } });
mock.module('../src/services/crmClient.js', { namedExports: mockCrm });
mock.module('../src/services/commerceClient.js', {
  namedExports: {
    ensureContactPricebookForCrmAccount: async () => true,
    resolvePricebookId: async (tier) => (tier ? `pb-${tier}` : testEnv.zoho.commerce.dealerPricebookId),
    isCommerceConfigured: () => true,
  },
});

const { applyDealer } = await import('../src/services/dealerApp.js');
const { crmPoll } = await import('../src/jobs/crmPoll.js');
const { resolvePricebookId } = await import('../src/services/commerceClient.js');

beforeEach(() => {
  resetDb();
  resetCrm();
});

test('F-1: CRM outage followed by crmPoll retry preserves original Dealer Code in Account payload', async () => {
  const user = {
    id: 'user-owner-1',
    email: 'owner@shriji.test',
    phone: '9820011111',
    full_name: 'Ramesh Patel',
  };
  db.users.push(user);

  // 1. Simulate CRM outage during applyDealer
  crmCalls.failAccountCreate = true;

  const dealerId = await applyDealer({
    user,
    businessName: 'Shriji Electronics',
    gstNumber: '27AABCR1234D1Z5',
    gstTreatment: 'Registered Business - Regular',
    address: 'Andheri West, Mumbai',
    personName: 'Ramesh Patel',
    phone: '9820011111',
  });

  assert.ok(dealerId, 'Dealer application created in PostgreSQL');
  const [dealerRow] = db.dealers.filter((d) => d.id === dealerId);
  assert.ok(dealerRow, 'Dealer row exists in db');
  assert.equal(dealerRow.zoho_account_id, null, 'zoho_account_id is null due to CRM outage');
  const originalCode = dealerRow.dealer_code;
  assert.match(originalCode, /^DE-[A-Z]{3}-\d{4}$/, 'Format is DE-XXX-0000');
  assert.equal(crmCalls.createdAccounts.length, 0, 'No CRM account created yet due to failure');

  // 2. CRM recovers; crmPoll runs
  crmCalls.failAccountCreate = false;
  await crmPoll();

  // Verify F-1: Original Dealer Code was preserved and transmitted
  assert.equal(crmCalls.createdAccounts.length, 1, 'Account creation succeeded during retry');
  const accountPayload = crmCalls.createdAccounts[0];
  assert.equal(accountPayload.dealerCode, originalCode, 'Account creation payload carried the EXACT original dealerCode');
  assert.equal(accountPayload.businessName, 'Shriji Electronics');
  assert.equal(accountPayload.userSource, 'ReStor Dealer');

  // Verify Contact creation also received the same Dealer Code and backendUserId
  assert.equal(crmCalls.createdContacts.length, 1, 'Contact creation was executed');
  const contactPayload = crmCalls.createdContacts[0];
  assert.equal(contactPayload.dealerCode, originalCode, 'Contact payload carried the original dealerCode');
  assert.equal(contactPayload.backendUserId, user.id, 'Contact payload carried backendUserId');

  // Verify PostgreSQL state is now converged
  assert.ok(dealerRow.zoho_account_id, 'dealers.zoho_account_id was populated');
  assert.ok(user.zoho_contact_id, 'users.zoho_contact_id was populated');
  assert.equal(dealerRow.dealer_code, originalCode, 'dealer_code remained unchanged');
});

test('F-2: Account creation succeeded but Contact failed retains Account ID and resumes without creating duplicate Account', async () => {
  const user = {
    id: 'user-owner-2',
    email: 'owner2@shriji.test',
    phone: '9820022222',
    full_name: 'Suresh Shah',
  };
  db.users.push(user);

  // 1. Simulate Contact creation failure during applyDealer (Account creation succeeds)
  crmCalls.failContactCreate = true;
  crmCalls.accountReturnId = 'crm-acc-preserved-100';

  const dealerId = await applyDealer({
    user,
    businessName: 'Shah Appliances',
    gstNumber: '27XYZ1234D1Z9',
    gstTreatment: 'Registered Business - Regular',
    address: 'Borivali West, Mumbai',
    personName: 'Suresh Shah',
    phone: '9820022222',
  });

  const [dealerRow] = db.dealers.filter((d) => d.id === dealerId);
  // Verify F-2 immediate persistence: zoho_account_id is saved despite contact failure!
  assert.equal(dealerRow.zoho_account_id, 'crm-acc-preserved-100', 'Account ID was immediately persisted in PostgreSQL');
  assert.equal(user.zoho_contact_id, undefined, 'Contact ID is not yet linked');
  assert.equal(crmCalls.createdAccounts.length, 1, 'One account created');
  assert.equal(crmCalls.createdContacts.length, 0, 'Contact creation threw before recording');

  // 2. CRM recovers; crmPoll runs
  crmCalls.failContactCreate = false;
  crmCalls.contactReturnId = 'crm-con-resumed-200';

  await crmPoll();

  // Verify: Did NOT create a second account!
  assert.equal(crmCalls.createdAccounts.length, 1, 'Zero duplicate accounts created during retry');
  assert.equal(dealerRow.zoho_account_id, 'crm-acc-preserved-100', 'Preserved the existing Account ID');

  // Verify: Resumed Contact creation under the existing Account ID
  assert.equal(crmCalls.createdContacts.length, 1, 'Contact creation was completed');
  const contactPayload = crmCalls.createdContacts[0];
  assert.equal(contactPayload.accountId, 'crm-acc-preserved-100', 'Contact linked to the existing Account ID');
  assert.equal(user.zoho_contact_id, 'crm-con-resumed-200', 'users.zoho_contact_id is now populated');
});

test('F-2: Idempotent recovery when Contact was created in CRM but local DB write failed', async () => {
  const user = {
    id: 'user-owner-3',
    email: 'owner3@shriji.test',
    phone: '9820033333',
    full_name: 'Pooja Mehta',
  };
  db.users.push(user);

  // Partial provisioning state: Account exists in CRM, Contact already created in CRM with Backend_User_ID
  const dealerRow = {
    id: 'dealer-3',
    owner_user_id: user.id,
    business_name: 'Mehta Kitchens',
    dealer_code: 'DE-MHT-3001',
    zoho_account_id: 'crm-acc-existing-300',
    status: 'pending',
  };
  db.dealers.push(dealerRow);

  // Mock CRM already has contact under this account with backendUserId
  crmCalls.mockContactsUnderAccount.push({
    id: 'crm-con-already-exists-300',
    accountId: 'crm-acc-existing-300',
    backendUserId: user.id,
    portalRole: 'Owner',
    email: user.email,
    phone: user.phone,
  });

  // Run crmPoll to resolve partial state
  await crmPoll();

  // Verify: No duplicate Account or Contact was created!
  assert.equal(crmCalls.createdAccounts.length, 0, 'No account created');
  assert.equal(crmCalls.createdContacts.length, 0, 'No duplicate contact created');

  // Verify: Contact was recovered and linked in PostgreSQL
  assert.equal(user.zoho_contact_id, 'crm-con-already-exists-300', 'Recovered existing CRM Contact ID into PostgreSQL');
  assert.equal(crmCalls.linkedContacts.length, 1, 'linkContactToBackendUser was called to ensure bidirectional sync');
});

test('Provisioning completed accounts are not repeated on subsequent crmPoll runs', async () => {
  const user = {
    id: 'user-owner-4',
    email: 'owner4@shriji.test',
    phone: '9820044444',
    full_name: 'Karan Johar',
    zoho_contact_id: 'crm-con-completed-400',
  };
  db.users.push(user);

  const dealerRow = {
    id: 'dealer-4',
    owner_user_id: user.id,
    business_name: 'Johar Electronics',
    dealer_code: 'DE-JOH-4001',
    zoho_account_id: 'crm-acc-completed-400',
    status: 'approved',
  };
  db.dealers.push(dealerRow);

  // Run crmPoll
  await crmPoll();

  // Verify: Zero provisioning calls made
  assert.equal(crmCalls.createdAccounts.length, 0, 'No account create called');
  assert.equal(crmCalls.createdContacts.length, 0, 'No contact create called');
  assert.equal(crmCalls.searchedAccounts.length, 0, 'No contact search called for already-provisioned dealer');
});

test('Default price book configuration and fallback behavior is preserved', async () => {
  // When no price tier is specified, fallback to default dealer pricebook
  const defaultPb = await resolvePricebookId(null);
  assert.equal(defaultPb, testEnv.zoho.commerce.dealerPricebookId, 'Resolves to default dealer pricebook ID');

  const emptyPb = await resolvePricebookId('');
  assert.equal(emptyPb, testEnv.zoho.commerce.dealerPricebookId, 'Empty string resolves to default pricebook ID');

  const customPb = await resolvePricebookId('Wholesale Tier 1');
  assert.equal(customPb, 'pb-Wholesale Tier 1', 'Named tier resolves dynamically');
});

test('Ambiguous contacts under Account are skipped without attaching an arbitrary contact', async () => {
  const user = {
    id: 'user-owner-5',
    email: 'owner5@shriji.test',
    phone: '9820055555',
    full_name: 'Vikram Seth',
  };
  db.users.push(user);

  const dealerRow = {
    id: 'dealer-5',
    owner_user_id: user.id,
    business_name: 'Seth Enterprises',
    dealer_code: 'DE-STH-5001',
    zoho_account_id: 'crm-acc-ambiguous-500',
    status: 'pending',
  };
  db.dealers.push(dealerRow);

  // Configure ambiguous multiple owner contacts without backendUserId matching
  crmCalls.mockContactsUnderAccount.push(
    { id: 'con-1', accountId: 'crm-acc-ambiguous-500', portalRole: 'Owner', email: user.email, phone: user.phone },
    { id: 'con-2', accountId: 'crm-acc-ambiguous-500', portalRole: 'Owner', email: user.email, phone: user.phone }
  );

  await crmPoll();

  // Verify: Did not attach an arbitrary contact
  assert.equal(user.zoho_contact_id, undefined, 'Did not attach arbitrary contact');
  assert.equal(crmCalls.createdContacts.length, 0, 'Did not create duplicate contact when ambiguous');
});

test('Duplicate retry attempts across multiple poll runs do not create duplicate Accounts or Contacts', async () => {
  const user = {
    id: 'user-owner-6',
    email: 'owner6@shriji.test',
    phone: '9820066666',
    full_name: 'Anil Kapoor',
  };
  db.users.push(user);

  // Application created with dealer_code but unlinked
  const dealerRow = {
    id: 'dealer-6',
    owner_user_id: user.id,
    business_name: 'Kapoor Lights',
    dealer_code: 'DE-KPR-6001',
    zoho_account_id: null,
    status: 'pending',
  };
  db.dealers.push(dealerRow);

  // 1st crmPoll run: Provisions Account and Contact
  await crmPoll();
  assert.equal(crmCalls.createdAccounts.length, 1, '1st run: created 1 account');
  assert.equal(crmCalls.createdContacts.length, 1, '1st run: created 1 contact');
  assert.ok(dealerRow.zoho_account_id, 'dealer.zoho_account_id populated');
  assert.ok(user.zoho_contact_id, 'user.zoho_contact_id populated');

  // 2nd crmPoll run: Should be a complete no-op for provisioning
  await crmPoll();
  assert.equal(crmCalls.createdAccounts.length, 1, '2nd run: still exactly 1 account created');
  assert.equal(crmCalls.createdContacts.length, 1, '2nd run: still exactly 1 contact created');

  // 3rd crmPoll run: Still no-op
  await crmPoll();
  assert.equal(crmCalls.createdAccounts.length, 1, '3rd run: still exactly 1 account created');
  assert.equal(crmCalls.createdContacts.length, 1, '3rd run: still exactly 1 contact created');
});

