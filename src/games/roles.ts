import type { GameDefinition, RoleDefinition } from './model'

export interface ResolvedRoleCount {
  readonly role: RoleDefinition
  readonly count: number
}

export function resolveRoleCounts(
  game: GameDefinition,
  playerCount: number,
): readonly ResolvedRoleCount[] | undefined {
  const distribution = game.roleDistributions.find(
    ({ players }) =>
      playerCount >= players.min && playerCount <= players.max,
  )
  if (!distribution) return undefined

  const fixed = Object.values(distribution.counts).reduce<number>(
    (total, value) => total + (value === 'remaining' ? 0 : value),
    0,
  )
  return game.roles.map((role) => ({
    role,
    count:
      distribution.counts[role.id] === 'remaining'
        ? playerCount - fixed
        : (distribution.counts[role.id] as number),
  }))
}
