export class ContentPlanningValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContentPlanningValidationError";
  }
}

export class ContentPlanningAuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContentPlanningAuthorizationError";
  }
}

export class ContentPlanningConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContentPlanningConflictError";
  }
}
