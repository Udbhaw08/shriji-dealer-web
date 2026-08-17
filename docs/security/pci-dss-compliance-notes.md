# Payment Data Isolation & Compliance Notes

## Architecture
- ReSTOR does not collect, process, or store credit card numbers or banking secrets.
- All transactions are redirected to certified payment gateways (Razorpay / Zoho Payments).
- Invoices are generated directly within Zoho Books upon confirmed payment callbacks.
