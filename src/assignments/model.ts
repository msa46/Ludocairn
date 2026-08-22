import type { PlayerAssignment } from '../sessions/model'

export type RandomSource = () => number

export interface AssignmentDiagnostic {
  readonly code:
    | 'assignment.invalid-random'
    | 'assignment.invalid-record'
    | 'assignment.unknown-player'
    | 'assignment.unknown-role'
    | 'assignment.duplicate-player'
    | 'assignment.incorrect-distribution'
    | 'assignment.unsupported-player-count'
  readonly message: string
  readonly path?: string
}

export type AssignmentResult =
  | { readonly ok: true; readonly assignments: readonly PlayerAssignment[] }
  | { readonly ok: false; readonly diagnostic: AssignmentDiagnostic }
