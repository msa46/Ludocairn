import type { GameDefinition } from '../../games/model'
import type { Session } from '../../sessions/model'

interface AssignmentTableProps {
  readonly game: GameDefinition
  readonly session: Session
}

export function AssignmentTable({ game, session }: AssignmentTableProps) {
  const roleById = new Map(game.roles.map((role) => [role.id, role]))
  const assignmentByPlayer = new Map(
    session.assignments?.map((assignment) => [
      assignment.playerId,
      assignment.roleId,
    ]),
  )

  return (
    <div className="assignment-table-region" tabIndex={0}>
      <table aria-label="Player assignments">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Assignment</th>
          </tr>
        </thead>
        <tbody>
          {session.players.map((player) => {
            const role = roleById.get(assignmentByPlayer.get(player.id) ?? '')
            return (
              <tr key={player.id}>
                <th scope="row">{player.name}</th>
                <td>{role?.label ?? 'Unknown role'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
