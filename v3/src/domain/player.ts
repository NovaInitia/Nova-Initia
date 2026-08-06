import type { PlayerId, SessionId } from './ids.js';
import type { PlayerClass, ToolType } from './enums.js';

export interface Player {
  readonly id: PlayerId;
  name: string;
  credentialHash: string;
  email: string | null;
  readonly activeClass: PlayerClass;
  karma: number;
  sg: number;
  isModerator: boolean;
  isOperator: boolean;
  isActive: boolean;
  avatarUrl: string | null;
  comment: string | null;
  registeredAt: Date;
  lastActiveAt: Date | null;
  lastStipendAt: Date | null;
}

export interface Inventory {
  readonly playerId: PlayerId;
  readonly counts: ReadonlyMap<ToolType, number>;
}

export interface Armor {
  readonly playerId: PlayerId;
  isActive: boolean;
  chargesRemaining: number;
}

export interface ClassProgress {
  readonly playerId: PlayerId;
  readonly playerClass: PlayerClass;
  level: number;
  experience: number;
}

export interface Session {
  readonly id: SessionId;
  readonly playerId: PlayerId;
  readonly tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface PublicProfile {
  readonly id: PlayerId;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly activeClass: PlayerClass;
  readonly levels: ReadonlyMap<PlayerClass, number>;
  readonly registeredAt: Date;
  readonly comment: string | null;
}
