# Dealer Onboarding & Approval Lifecycle

## Lifecycle States
1. **Lead / Unregistered**: User explores catalog as retail customer.
2. **Application Submitted**: Dealer submits GSTIN, store details, and contact info. Status = `pending`.
3. **CRM Verification**: Zoho CRM Account created; approval team verifies GSTIN and territory.
4. **Approved**: Webhook sets status = `approved`, assigns Zoho Pricebook ID, and sends invite link.
5. **Staff Access**: Approved dealer owner can invite staff members to their workspace.
