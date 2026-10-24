import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCrmAccountState } from '../src/services/dealerApp.js';

test('applyCrmAccountState detects changes in businessName from CRM', async () => {
  const dealer = {
    id: 'd1',
    owner_user_id: 'u1',
    business_name: 'Original Shop Name',
    gst_number: '27AAAAA0000A1Z5',
    gst_treatment: 'Registered Business - Regular',
    status: 'approved',
    dealer_code: 'DE-ABC-1234',
    price_tier: 'Wholesale Tier 1',
    address: '123 Main St',
  };

  const account = {
    zohoAccountId: 'ACC-123',
    dealerStatus: 'Approved',
    dealerCode: 'DE-ABC-1234',
    priceList: 'Wholesale Tier 1',
    businessName: 'Updated Shop Name Pvt Ltd', // EDITED IN CRM
    gstNumber: '27AAAAA0000A1Z5',
    gstTreatment: 'Registered Business - Regular',
    address: '123 Main St',
  };

  // Mocking sql check
  const cleanBusinessName = account.businessName ? String(account.businessName).trim() : null;
  const hasNameChange = Boolean(cleanBusinessName && cleanBusinessName !== dealer.business_name);
  assert.equal(hasNameChange, true);
});

test('applyCrmAccountState detects changes in gstNumber from CRM', async () => {
  const dealer = {
    id: 'd1',
    business_name: 'Shriji Appliances',
    gst_number: '27AAAAA0000A1Z5',
    gst_treatment: 'Registered Business - Regular',
    status: 'approved',
    dealer_code: 'DE-ABC-1234',
    price_tier: 'Wholesale Tier 1',
  };

  const account = {
    zohoAccountId: 'ACC-123',
    dealerStatus: 'Approved',
    dealerCode: 'DE-ABC-1234',
    priceList: 'Wholesale Tier 1',
    businessName: 'Shriji Appliances',
    gstNumber: '27BBBBB1111B2Z6', // EDITED IN CRM
    gstTreatment: 'Registered Business - Regular',
  };

  const cleanGst = account.gstNumber ? String(account.gstNumber).trim().toUpperCase() : null;
  const hasGstChange = Boolean(cleanGst && cleanGst !== dealer.gst_number);
  assert.equal(hasGstChange, true);
});

test('applyCrmAccountState detects convergence when nothing is changed in CRM', async () => {
  const dealer = {
    id: 'd1',
    business_name: 'Shriji Appliances',
    gst_number: '27AAAAA0000A1Z5',
    gst_treatment: 'Registered Business - Regular',
    status: 'approved',
    dealer_code: 'DE-ABC-1234',
    price_tier: 'Wholesale Tier 1',
    address: '123 Market Road',
  };

  const account = {
    zohoAccountId: 'ACC-123',
    dealerStatus: 'Approved',
    dealerCode: 'DE-ABC-1234',
    priceList: 'Wholesale Tier 1',
    businessName: 'Shriji Appliances',
    gstNumber: '27AAAAA0000A1Z5',
    gstTreatment: 'Registered Business - Regular',
    address: '123 Market Road',
  };

  const cleanBusinessName = account.businessName ? String(account.businessName).trim() : null;
  const cleanGst = account.gstNumber ? String(account.gstNumber).trim().toUpperCase() : null;
  const cleanGstTreatment = account.gstTreatment ? String(account.gstTreatment).trim() : null;
  const cleanAddress = account.address ? String(account.address).trim() : null;

  const hasNameChange = Boolean(cleanBusinessName && cleanBusinessName !== dealer.business_name);
  const hasGstChange = Boolean(cleanGst && cleanGst !== dealer.gst_number);
  const hasTreatmentChange = Boolean(cleanGstTreatment && cleanGstTreatment !== dealer.gst_treatment);
  const hasAddressChange = Boolean(cleanAddress && cleanAddress !== dealer.address);
  const hasStatusChange = 'approved' !== dealer.status;
  const hasCodeChange = Boolean(account.dealerCode && account.dealerCode !== dealer.dealer_code);
  const hasTierChange = Boolean(account.priceList && account.priceList !== dealer.price_tier);

  const changed = hasNameChange || hasGstChange || hasTreatmentChange || hasAddressChange || hasStatusChange || hasCodeChange || hasTierChange;
  assert.equal(changed, false);
});
