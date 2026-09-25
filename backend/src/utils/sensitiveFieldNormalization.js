export function normalizeIdentityNumber(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizePhone(value) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) return `+${compact.slice(1).replace(/\D/g, "")}`;
  const digits = compact.replace(/\D/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+60${digits.slice(1)}`;
  if (digits.startsWith("60")) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeAddress(value) {
  return value.trim().replace(/\s+/g, " ");
}
