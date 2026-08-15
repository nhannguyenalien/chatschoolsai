import { LoyaltyValidationError } from "./errors.js";

export function requireNonEmpty(value, field, maxLength = 200) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new LoyaltyValidationError(`${field} is required.`);
  if (normalized.length > maxLength) throw new LoyaltyValidationError(`${field} is too long.`);
  return normalized;
}

export function requirePositiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new LoyaltyValidationError(`${field} must be a positive integer.`);
  }
  return number;
}

export function calculateSalePoints(amountMinor, program) {
  const amount = requirePositiveInteger(amountMinor, "amount_minor");
  const spendPerPoint = requirePositiveInteger(program.spend_per_point_minor, "program.spend_per_point_minor");
  const pointsPerStep = requirePositiveInteger(program.points_per_step, "program.points_per_step");
  return Math.floor(amount / spendPerPoint) * pointsPerStep;
}

export function sumLedger(entries) {
  return entries.reduce((total, entry) => {
    const delta = Number(entry.points_delta);
    if (!Number.isSafeInteger(delta)) throw new LoyaltyValidationError("Ledger contains an invalid points_delta.");
    const next = total + delta;
    if (!Number.isSafeInteger(next)) throw new LoyaltyValidationError("Ledger balance exceeds the safe integer range.");
    return next;
  }, 0);
}
