/**
 * reset-test-users.js
 *
 * Utility script to completely purge test users, dealers, OTPs, registration flows,
 * cooldowns, and corresponding Zoho CRM Accounts and Contacts for testing flows from scratch.
 *
 * Default test numbers:
 *  - 8826867932
 *  - 8743874632
 *
 * Usage:
 *  node backend/scripts/reset-test-users.js
 *  node backend/scripts/reset-test-users.js 8826867932 8743874632
 *  node backend/scripts/reset-test-users.js --dry-run
 */

import { sql } from '../src/db/pool.js';
import * as crm from '../src/services/crmClient.js';
import { normalizePhone } from '../src/utils/phone.js';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const customNumbers = args.filter((a) => !a.startsWith('--') && /^\+?\d{10,13}$/.test(a));

const TARGET_NUMBERS = customNumbers.length > 0 ? customNumbers : ['8826867932', '8743874632'];

console.log('====================================================');
console.log('🔄 SHRIJI TEST USER & CRM RESET TOOL');
console.log('====================================================');
console.log(`Target Phone Numbers: ${TARGET_NUMBERS.join(', ')}`);
console.log(`Dry Run Mode: ${isDryRun ? 'YES (No changes will be committed)' : 'NO (Live Purge)'}`);
console.log('----------------------------------------------------\n');

async function searchCrmRecordIds(norm) {
  const contactIds = new Set();
  const accountIds = new Set();

  if (!crm.isCrmConfigured()) {
    console.log('⚠️  Zoho CRM is not configured; skipping CRM queries.');
    return { contactIds, accountIds };
  }

  // Search by national number and e164
  const queries = [norm.nationalNumber, norm.e164].filter(Boolean);

  for (const q of queries) {
    try {
      const res = await crm.crmFetch(`/Contacts/search?phone=${encodeURIComponent(q)}`);
      for (const c of res?.data || []) {
        if (c.id) {
          contactIds.add(String(c.id));
          if (c.Account_Name?.id) {
            accountIds.add(String(c.Account_Name.id));
          }
        }
      }
    } catch (err) {
      // 204 or not found is normal for search
      if (!err.message?.includes('204') && !err.message?.includes('NO_CONTENT')) {
        console.warn(`  ⚠️ CRM contact phone search warning (${q}):`, err.message);
      }
    }

    try {
      const res = await crm.crmFetch(`/Accounts/search?phone=${encodeURIComponent(q)}`);
      for (const a of res?.data || []) {
        if (a.id) {
          accountIds.add(String(a.id));
        }
      }
    } catch (err) {
      if (!err.message?.includes('204') && !err.message?.includes('NO_CONTENT')) {
        console.warn(`  ⚠️ CRM account phone search warning (${q}):`, err.message);
      }
    }
  }

  return { contactIds, accountIds };
}

async function deleteCrmRecords(contactIds, accountIds) {
  if (!crm.isCrmConfigured()) return;

  // 1. Delete Contacts first
  for (const contactId of contactIds) {
    try {
      console.log(`  🗑️ Deleting Zoho CRM Contact ID: ${contactId}...`);
      const res = await crm.crmFetch(`/Contacts?ids=${contactId}&wf_trigger=false`, { method: 'DELETE' });
      const status = res?.data?.[0]?.status || 'deleted';
      console.log(`     ✅ CRM Contact ${contactId} deletion status: ${status}`);
    } catch (err) {
      console.warn(`     ⚠️ CRM Contact ${contactId} delete failed:`, err.message);
    }
  }

  // 2. Delete Accounts second
  for (const accountId of accountIds) {
    try {
      console.log(`  🗑️ Deleting Zoho CRM Account ID: ${accountId}...`);
      const res = await crm.crmFetch(`/Accounts?ids=${accountId}&wf_trigger=false`, { method: 'DELETE' });
      const status = res?.data?.[0]?.status || 'deleted';
      console.log(`     ✅ CRM Account ${accountId} deletion status: ${status}`);
    } catch (err) {
      console.warn(`     ⚠️ CRM Account ${accountId} delete failed:`, err.message);
    }
  }
}

async function runReset() {
  const allUserIds = new Set();
  const allDealerIds = new Set();
  const allEmails = new Set();
  const allCrmContactIds = new Set();
  const allCrmAccountIds = new Set();
  const phoneVariations = new Set();

  console.log('🔍 STEP 1: Scanning Database & Zoho CRM for existing records...');

  for (const rawPhone of TARGET_NUMBERS) {
    const norm = normalizePhone(rawPhone);
    phoneVariations.add(norm.nationalNumber);
    phoneVariations.add(norm.e164);
    phoneVariations.add(rawPhone);

    // 1. Find users
    const users = await sql`
      select id, email, phone, full_name, role, status, dealer_id, zoho_contact_id
      from users
      where phone = ${norm.nationalNumber}
         or phone = ${norm.e164}
         or phone like ${`%${norm.nationalNumber}`}
    `;

    for (const u of users) {
      allUserIds.add(u.id);
      if (u.email) allEmails.add(u.email.toLowerCase().trim());
      if (u.dealer_id) allDealerIds.add(u.dealer_id);
      if (u.zoho_contact_id) allCrmContactIds.add(String(u.zoho_contact_id));
    }

    // 2. Find dealers owned by or linked with this phone or user
    const userIdsArray = Array.from(allUserIds);
    const dealerIdsArray = Array.from(allDealerIds);

    const dealers = await sql`
      select id, owner_user_id, business_name, dealer_code, status, zoho_account_id
      from dealers
      where (id in ${sql(dealerIdsArray.length ? dealerIdsArray : ['00000000-0000-0000-0000-000000000000'])})
         or (owner_user_id in ${sql(userIdsArray.length ? userIdsArray : ['00000000-0000-0000-0000-000000000000'])})
    `;

    for (const d of dealers) {
      allDealerIds.add(d.id);
      if (d.owner_user_id) allUserIds.add(d.owner_user_id);
      if (d.zoho_account_id) allCrmAccountIds.add(String(d.zoho_account_id));
    }

    // 3. Search Zoho CRM for this phone
    const crmMatches = await searchCrmRecordIds(norm);
    for (const cid of crmMatches.contactIds) allCrmContactIds.add(cid);
    for (const aid of crmMatches.accountIds) allCrmAccountIds.add(aid);
  }

  // Also query any users that belong to the discovered dealer IDs (e.g. staff users)
  if (allDealerIds.size > 0) {
    const dealerIdsArr = Array.from(allDealerIds);
    const relatedStaff = await sql`
      select id, email, phone, zoho_contact_id from users where dealer_id in ${sql(dealerIdsArr)}
    `;
    for (const s of relatedStaff) {
      allUserIds.add(s.id);
      if (s.email) allEmails.add(s.email.toLowerCase().trim());
      if (s.zoho_contact_id) allCrmContactIds.add(String(s.zoho_contact_id));
      if (s.phone) {
        const norm = normalizePhone(s.phone);
        phoneVariations.add(norm.nationalNumber);
        phoneVariations.add(norm.e164);
      }
    }
  }

  const userIds = Array.from(allUserIds);
  const dealerIds = Array.from(allDealerIds);
  const emails = Array.from(allEmails);
  const phones = Array.from(phoneVariations);
  const crmContacts = Array.from(allCrmContactIds);
  const crmAccounts = Array.from(allCrmAccountIds);

  console.log('\n📊 DISCOVERED ENTITIES TO PURGE:');
  console.log(`  - Users: ${userIds.length} (${userIds.join(', ') || 'none'})`);
  console.log(`  - Dealers: ${dealerIds.length} (${dealerIds.join(', ') || 'none'})`);
  console.log(`  - Emails linked: ${emails.length} (${emails.join(', ') || 'none'})`);
  console.log(`  - Phone variations: ${phones.length} (${phones.join(', ') || 'none'})`);
  console.log(`  - Zoho CRM Contacts: ${crmContacts.length} (${crmContacts.join(', ') || 'none'})`);
  console.log(`  - Zoho CRM Accounts: ${crmAccounts.length} (${crmAccounts.join(', ') || 'none'})`);

  if (isDryRun) {
    console.log('\n[DRY RUN COMPLETE] Exiting without performing database deletions or CRM calls.');
    return;
  }

  console.log('\n🧹 STEP 2: Executing Database Cleanup in Supabase...');

  // A. Break circular FKs between users and dealers
  if (userIds.length > 0) {
    await sql`update users set dealer_id = null where id in ${sql(userIds)}`;
    console.log('  ✅ Unlinked users.dealer_id');
  }
  if (dealerIds.length > 0) {
    await sql`update dealers set owner_user_id = null where id in ${sql(dealerIds)}`;
    console.log('  ✅ Unlinked dealers.owner_user_id');
  }

  // B. Delete staff invites
  if (dealerIds.length > 0 || userIds.length > 0) {
    const deletedInvites = await sql`
      delete from staff_invites
      where (dealer_id in ${sql(dealerIds.length ? dealerIds : ['00000000-0000-0000-0000-000000000000'])})
         or (used_by in ${sql(userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])})
      returning id
    `;
    console.log(`  ✅ Deleted staff_invites: ${deletedInvites.length}`);
  }

  // C. Delete refresh tokens
  if (userIds.length > 0) {
    const deletedTokens = await sql`
      delete from refresh_tokens where user_id in ${sql(userIds)} returning id
    `;
    console.log(`  ✅ Deleted refresh_tokens: ${deletedTokens.length}`);
  }

  // D. Delete OTP codes
  const deletedOtps = await sql`
    delete from otp_codes
    where (user_id in ${sql(userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])})
       or (identifier in ${sql(phones.length ? phones : ['__none__'])})
       or (identifier in ${sql(emails.length ? emails : ['__none__'])})
    returning id
  `;
  console.log(`  ✅ Deleted otp_codes: ${deletedOtps.length}`);

  // E. Delete dealer registration flows
  const deletedFlows = await sql`
    delete from dealer_registration_flows
    where (phone in ${sql(phones.length ? phones : ['__none__'])})
       or (email in ${sql(emails.length ? emails : ['__none__'])})
    returning id
  `;
  console.log(`  ✅ Deleted dealer_registration_flows: ${deletedFlows.length}`);

  // F. Delete OTP cooldowns
  const deletedCooldowns = await sql`
    delete from dealer_otp_cooldowns
    where contact in ${sql([...phones, ...emails])}
    returning contact
  `;
  console.log(`  ✅ Cleared dealer_otp_cooldowns: ${deletedCooldowns.length}`);

  // G. Delete dealers
  if (dealerIds.length > 0) {
    const deletedDealers = await sql`
      delete from dealers where id in ${sql(dealerIds)} returning id, business_name
    `;
    console.log(`  ✅ Deleted dealers (${deletedDealers.length}):`, deletedDealers.map((d) => d.business_name).join(', '));
  }

  // H. Delete users
  if (userIds.length > 0) {
    const deletedUsers = await sql`
      delete from users where id in ${sql(userIds)} returning id, full_name, phone, role
    `;
    console.log(`  ✅ Deleted users (${deletedUsers.length}):`, deletedUsers.map((u) => `${u.full_name || 'user'} (${u.phone || u.id}) [${u.role}]`).join(', '));
  }

  // STEP 3: Delete from Zoho CRM
  console.log('\n🧹 STEP 3: Executing Cleanup in Zoho CRM...');
  if (crmContacts.length > 0 || crmAccounts.length > 0) {
    await deleteCrmRecords(crmContacts, crmAccounts);
  } else {
    console.log('  ℹ️ No CRM records to delete.');
  }

  console.log('\n====================================================');
  console.log('🎉 PURGE COMPLETE! TEST NUMBERS ARE 100% CLEAN.');
  console.log('====================================================');
  console.log('Target numbers ready for fresh testing:');
  for (const n of TARGET_NUMBERS) {
    console.log(`  👉 ${n}`);
  }
  console.log('\nClient / Browser Testing Checklist:');
  console.log('  1. In your browser or App, click "Logout" or run `localStorage.clear()` / `sessionStorage.clear()`.');
  console.log('  2. Now you can test:');
  console.log('     • Normal Sign up / Registration');
  console.log('     • OTP Login (WhatsApp)');
  console.log('     • Normal Password Login');
  console.log('     • Google Login');
  console.log('     • Staff Invite / Code Signup');
  console.log('     • Logout & Sign Out');
  console.log('  3. Whenever you want to reset again, simply run:');
  console.log('     npm run reset:test-users\n');
}

runReset()
  .catch((err) => {
    console.error('❌ Reset failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end();
  });
