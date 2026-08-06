import type { DomainId, PageId, PlayerId } from './ids.js';

export interface WebDomain {
  readonly id: DomainId;
  readonly domainHash: string;
  readonly normalisationVersion: number;
  uri: string | null;
  hitCount: number;
  firstSeenAt: Date;
}

export interface Page {
  readonly id: PageId;
  readonly urlHash: string;
  readonly domainId: DomainId;
  readonly normalisationVersion: number;
  firstSeenAt: Date;
}

export interface Presence {
  readonly playerId: PlayerId;
  readonly pageId: PageId;
  arrivedAt: Date;
  lastSeenAt: Date;
}

export interface PageCoordinates {
  readonly urlHash: string;
  readonly domainHash: string;
  readonly normalisationVersion: number;
}
