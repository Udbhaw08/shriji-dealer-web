export const ROLES = {
  CUSTOMER: "customer",
  STAFF: "staff",
  DEALER: "dealer",
  ADMIN: "admin",
};

export const DEALER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
};

export const TOKEN_TTL = {
  ACCESS_SECONDS: 15 * 60, // 15 mins
  REFRESH_DAYS: 30, // 30 days
};
