# Multi-Tenant Dealer Schema

## Workspace Isolation
- Each dealer business is isolated with unique `dealer_id` credentials.
- Staff members inherit permissions from their parent dealer organization.
- Cross-dealer data leakage is prevented via PostgreSQL Row-Level Security (RLS).
