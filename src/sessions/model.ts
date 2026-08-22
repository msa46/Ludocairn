export type SessionFieldValue = boolean | number | string

export interface Player {
  readonly id: string
  readonly name: string
  readonly fields: Readonly<Record<string, SessionFieldValue>>
}

export interface PlayerAssignment {
  readonly playerId: string
  readonly roleId: string
}

export interface Session {
  readonly storageVersion: 1
  readonly id: string
  readonly name: string
  readonly gameId: string
  readonly gameSchemaVersion: 1
  readonly players: readonly Player[]
  readonly assignments?: readonly PlayerAssignment[]
  readonly currentPhase?: string
  readonly round?: number
  readonly notes: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SessionDiagnostic {
  readonly code:
    | 'session.duplicate-player-id'
    | 'session.assignment-locked'
    | 'session.game-mismatch'
    | 'session.incompatible-game-version'
    | 'session.invalid-date'
    | 'session.invalid-field-value'
    | 'session.invalid-assignments'
    | 'session.invalid-name'
    | 'session.invalid-phase'
    | 'session.invalid-record'
    | 'session.invalid-round'
    | 'session.roster-locked'
    | 'session.unknown-field'
    | 'session.unknown-player'
    | 'session.unsupported-storage-version'
    | 'session.unsupported-player-count'
  readonly message: string
  readonly path?: string
}

export type SessionResult =
  | { readonly ok: true; readonly session: Session }
  | { readonly ok: false; readonly diagnostic: SessionDiagnostic }

export interface IdProvider {
  next(kind: 'session' | 'player'): string
}

export type Clock = () => string
