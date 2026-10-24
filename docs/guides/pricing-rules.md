# Pricing Calculation & Zero-Leakage Rules Specification

## Overview
Shriji Domestic Appliances operates under strict role-gated pricing policies:
1. **MRP & Retail Rates**: Publicly viewable by retail customers and unregistered visitors.
2. **Dealer Wholesale Rates**: Strictly restricted to verified, authenticated dealers with an active pricebook ID.
3. **Zero-Price Items**: Products without a configured price MUST display "Price on Request" instead of 0 or free.

## Role Gating Rules
- **Customer / Unauthenticated**: Only sees MRP (`label_rate` or standard retail price).
- **Customer Share Link (`?from=`)**: Overrides dealer session and forces pure retail view to prevent wholesale price leaks when dealers share products with end customers.
- **Verified Dealer**: Shows wholesale rates and volume tier pricing based on assigned Zoho Commerce Pricebook.
