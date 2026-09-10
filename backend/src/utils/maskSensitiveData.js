export function maskPhoneNumber(phone) {
  if (!phone || String(phone).length < 6) return "***";
  const str = String(phone);
  return str.slice(0, 2) + "******" + str.slice(-2);
}

export function maskEmail(email) {
  if (!email || !email.includes("@")) return "***";
  const [user, domain] = email.split("@");
  return user.slice(0, 1) + "***@" + domain;
}
