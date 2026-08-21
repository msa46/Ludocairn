import type { PlayerFieldDefinition } from '../../games/model'
import type { SessionFieldValue } from '../../sessions/model'

interface PlayerFieldControlProps {
  readonly field: PlayerFieldDefinition
  readonly playerName: string
  readonly value: SessionFieldValue
  readonly onChange: (value: SessionFieldValue) => void
}

export function PlayerFieldControl({
  field,
  playerName,
  value,
  onChange,
}: PlayerFieldControlProps) {
  const label = playerName + ' — ' + field.label

  if (field.type === 'boolean') {
    return (
      <label className="checkbox-field">
        <input
          aria-label={label}
          checked={value === true}
          type="checkbox"
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    )
  }

  if (field.type === 'choice') {
    return (
      <label>
        {field.label}
        <select
          aria-label={label}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'number') {
    return (
      <label>
        {field.label}
        <input
          aria-label={label}
          max={field.max}
          min={field.min}
          step={field.step}
          type="number"
          value={Number(value)}
          onChange={(event) => onChange(event.target.valueAsNumber)}
        />
      </label>
    )
  }

  return (
    <label>
      {field.label}
      {field.multiline ? (
        <textarea
          aria-label={label}
          rows={3}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  )
}
