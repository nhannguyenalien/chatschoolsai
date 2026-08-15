export class LoyaltyValidationError extends Error {
  constructor(message) { super(message); this.name = "LoyaltyValidationError"; }
}

export class LoyaltyNotFoundError extends Error {
  constructor(message) { super(message); this.name = "LoyaltyNotFoundError"; }
}

export class LoyaltyConflictError extends Error {
  constructor(message) { super(message); this.name = "LoyaltyConflictError"; }
}
