export class NotImplemented extends Error {
  constructor(what: string) {
    super(`Not implemented: ${what}`);
    this.name = 'NotImplemented';
  }
}

export class UnknownClassProgress extends Error {
  constructor(playerId: string, playerClass: number) {
    super(`No progress for player ${playerId} in class ${playerClass}`);
    this.name = 'UnknownClassProgress';
  }
}

export class InvalidXpAmount extends Error {
  constructor(amount: number) {
    super(`Xp amount must be a positive integer, got ${amount}`);
    this.name = 'InvalidXpAmount';
  }
}

export class InvalidSgDelta extends Error {
  constructor(delta: number) {
    super(`Sg delta must be an integer, got ${delta}`);
    this.name = 'InvalidSgDelta';
  }
}

export class ConcurrentUnitOfWork extends Error {
  constructor() {
    super('The in-memory unit of work does not support concurrent transactions');
    this.name = 'ConcurrentUnitOfWork';
  }
}

export class NegativeInventory extends Error {
  constructor(tool: number) {
    super(`Inventory count cannot go negative for tool ${tool}`);
    this.name = 'NegativeInventory';
  }
}

export class InventoryCapExceeded extends Error {
  constructor(tool: number) {
    super(`Inventory cap exceeded for tool ${tool}`);
    this.name = 'InventoryCapExceeded';
  }
}

export class InvalidRegistration extends Error {
  constructor(field: string) {
    super(`Invalid registration: ${field}`);
    this.name = 'InvalidRegistration';
  }
}

export class NameTaken extends Error {
  constructor() {
    super('Name is already taken');
    this.name = 'NameTaken';
  }
}

export class AuthenticationFailed extends Error {
  constructor() {
    super('Authentication failed');
    this.name = 'AuthenticationFailed';
  }
}

export class SessionNotOwned extends Error {
  constructor() {
    super('Session not owned by this player');
    this.name = 'SessionNotOwned';
  }
}

export class MigrationChecksumMismatch extends Error {
  constructor(version: string) {
    super(`Migration ${version} checksum mismatch: file was tampered`);
    this.name = 'MigrationChecksumMismatch';
  }
}

export class MissingAppliedMigration extends Error {
  constructor(version: string) {
    super(`Applied migration ${version} has no corresponding file on disk`);
    this.name = 'MissingAppliedMigration';
  }
}

export class UnsafeTestDatabase extends Error {
  constructor(dbName: string) {
    super(`Cowardly refusing to run destructive tests against ${dbName} (not a _test database)`);
    this.name = 'UnsafeTestDatabase';
  }
}

export class UnknownNormalisationVersion extends Error {
  constructor(version: number) {
    super(`Unknown or retired normalisation version: ${version}`);
    this.name = 'UnknownNormalisationVersion';
  }
}

export class AbilityLocked extends Error {
  constructor(ability: string) {
    super(`Ability not yet unlocked: ${ability}`);
    this.name = 'AbilityLocked';
  }
}

export class PagePlacementCapReached extends Error {
  constructor(toolType: number, pageId: string) {
    super(`Page placement cap reached for tool ${toolType} on page ${pageId}`);
    this.name = 'PagePlacementCapReached';
  }
}

export class BarrelCapacityExceeded extends Error {
  constructor(slotsUsed: number, capacity: number) {
    super(`Barrel capacity exceeded: ${slotsUsed} slots used, capacity is ${capacity}`);
    this.name = 'BarrelCapacityExceeded';
  }
}

export class MessageTooLong extends Error {
  constructor(field: string, max: number) {
    super(`Message field '${field}' exceeds maximum length of ${max}`);
    this.name = 'MessageTooLong';
  }
}

export class HtmlNotPermitted extends Error {
  constructor(field: string) {
    super(`HTML not permitted in message field '${field}'`);
    this.name = 'HtmlNotPermitted';
  }
}

export class DoorwayPageOwnLimitReached extends Error {
  constructor(playerId: string, pageId: string) {
    super(`Doorway own limit reached for player ${playerId} on page ${pageId}`);
    this.name = 'DoorwayPageOwnLimitReached';
  }
}

export class DoorwayPageTotalLimitReached extends Error {
  constructor(pageId: string) {
    super(`Doorway total limit reached on page ${pageId}`);
    this.name = 'DoorwayPageTotalLimitReached';
  }
}
