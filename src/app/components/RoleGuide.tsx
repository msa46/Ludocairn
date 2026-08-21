import type { ReactElement } from 'react'

import type { GameDefinition, RoleDefinition } from '../../games/model'
import { resolveRoleCounts } from '../../games/roles'

interface RoleGuideProps {
  readonly game: GameDefinition
  readonly playerCount?: number
  readonly headingLevel?: 2 | 3
}

function pluralize(label: string): string {
  if (/[^aeiou]y$/i.test(label)) return label.slice(0, -1) + 'ies'
  if (/(?:ch|sh|s|x|z|o)$/i.test(label)) return label + 'es'
  return label + 's'
}

function quantityLabel(count: number, role: RoleDefinition): string {
  return `${count} ${count === 1 ? role.label : pluralize(role.label)}`
}

function quantityRange(
  minimum: number,
  maximum: number,
  role: RoleDefinition,
): string {
  if (minimum === maximum) return quantityLabel(minimum, role)
  return `${minimum}–${maximum} ${pluralize(role.label)}`
}

export function RoleGuide({
  game,
  playerCount,
  headingLevel = 2,
}: RoleGuideProps): ReactElement | null {
  if (game.roles.length === 0) return null

  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const DetailHeading = headingLevel === 2 ? 'h3' : 'h4'
  const resolved =
    playerCount === undefined ? undefined : resolveRoleCounts(game, playerCount)

  return (
    <section aria-label="Role guide" className="role-guide">
      <Heading>Role guide</Heading>

      <div className="role-guide-grid">
        {game.roles.map((role) => (
          <article className="role-guide-card" key={role.id}>
            <header>
              <DetailHeading>{role.label}</DetailHeading>
              {role.team && <p className="role-guide-team">{role.team}</p>}
            </header>
            <p className="role-guide-card-marker">
              {role.card?.label ?? 'No fixed card'}
            </p>
            <p className="role-guide-summary">{role.summary}</p>
          </article>
        ))}
      </div>

      {playerCount === undefined ? (
        game.roleDistributions.length > 0 ? (
          <div
            aria-label="Role quantities by player count"
            className="role-guide-table-wrap"
            role="region"
            tabIndex={0}
          >
            <table>
              <caption>Role quantities by player count</caption>
              <thead>
                <tr>
                  <th scope="col">Players</th>
                  {game.roles.map((role) => (
                    <th key={role.id} scope="col">
                      {role.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {game.roleDistributions.map((distribution) => {
                  const minimum = resolveRoleCounts(
                    game,
                    distribution.players.min,
                  )
                  const maximum = resolveRoleCounts(
                    game,
                    distribution.players.max,
                  )
                  return (
                    <tr
                      key={`${distribution.players.min}-${distribution.players.max}`}
                    >
                      <th scope="row">
                        {distribution.players.min}–{distribution.players.max}
                      </th>
                      {game.roles.map((role) => {
                        const minimumCount =
                          minimum?.find(({ role: item }) => item.id === role.id)
                            ?.count ?? 0
                        const maximumCount =
                          maximum?.find(({ role: item }) => item.id === role.id)
                            ?.count ?? 0
                        return (
                          <td key={role.id}>
                            {quantityRange(minimumCount, maximumCount, role)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="role-guide-guidance">
            No published role quantities are available.
          </p>
        )
      ) : resolved ? (
        <div className="role-guide-quantities">
          <DetailHeading>Quantities for {playerCount} players</DetailHeading>
          <ul>
            {resolved.map(({ role, count }) => (
              <li key={role.id}>{quantityLabel(count, role)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="role-guide-guidance">
          No published distribution applies to {playerCount} players.
        </p>
      )}
    </section>
  )
}
