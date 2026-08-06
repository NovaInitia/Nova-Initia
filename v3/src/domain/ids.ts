declare const brand: unique symbol;

type Branded<T, B> = T & { readonly [brand]: B };

export type PlayerId = Branded<string, 'PlayerId'>;
export type SessionId = Branded<string, 'SessionId'>;
export type PageId = Branded<string, 'PageId'>;
export type DomainId = Branded<string, 'DomainId'>;
export type PlacementId = Branded<string, 'PlacementId'>;
export type JobRunId = Branded<number, 'JobRunId'>;
export type LedgerEntryId = Branded<number, 'LedgerEntryId'>;
