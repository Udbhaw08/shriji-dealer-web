# Automated Testing & Quality Assurance Strategy

## Testing Layers
1. **Backend Integration Tests**: Runs node test runner on `backend/test/*.test.mjs` (140+ assertions).
2. **Pricing Regression Tests**: Automated matrix testing of dealer pricing, tier discounts, and MRP leakage prevention.
3. **Session & Auth Tests**: Verification of token rotation, expiration, and validation rules.
4. **Linting**: Oxlint automated static analysis for zero-error assurance.
