import test from "node:test";
import assert from "node:assert/strict";
import { calculateSalePoints, sumLedger } from "../src/domain/loyalty/points.js";
import { LoyaltyValidationError } from "../src/domain/loyalty/errors.js";

test("calculates integer points and discards incomplete spend steps", () => {
  assert.equal(calculateSalePoints(259_000, { spend_per_point_minor: 10_000, points_per_step: 2 }), 50);
});

test("rejects unsafe and fractional money values", () => {
  assert.throws(() => calculateSalePoints(10.5, { spend_per_point_minor: 10, points_per_step: 1 }), LoyaltyValidationError);
  assert.throws(() => calculateSalePoints(Number.MAX_SAFE_INTEGER + 1, { spend_per_point_minor: 10, points_per_step: 1 }), LoyaltyValidationError);
});

test("derives balance from positive and negative immutable ledger entries", () => {
  assert.equal(sumLedger([{ points_delta: 100 }, { points_delta: -30 }, { points_delta: -10 }]), 60);
});
