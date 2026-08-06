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
