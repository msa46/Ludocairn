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
  const printValue =
    field.type === 'boolean' ? (value === true ? 'Yes' : 'No') : String(value)
  const printed = (
    <p className="print-only" aria-hidden="true">
      {field.label}: {printValue}
    </p>
  )

  if (field.type === 'boolean') {
    return (
      <>
        <label className="checkbox-field editing-controls">
          <input
            aria-label={label}
            checked={value === true}
            type="checkbox"
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        {printed}
      </>
    )
  }

  if (field.type === 'choice') {
    return (
      <>
        <label className="editing-controls">
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
        {printed}
      </>
    )
  }

  if (field.type === 'number') {
    const numericValue = Number(value)
    const step = field.step ?? 1
    const previousValue = numericValue - step
    const nextValue = numericValue + step
    return (
      <>
        <div className="number-field-control editing-controls">
          <span>{field.label}</span>
          <button
            aria-label={'Decrease ' + label}
            disabled={field.min !== undefined && previousValue < field.min}
            type="button"
            onClick={() => onChange(previousValue)}
          >
            −
          </button>
          <input
            aria-label={label}
            max={field.max}
            min={field.min}
            step={field.step}
            type="number"
            value={numericValue}
            onChange={(event) => onChange(event.target.valueAsNumber)}
          />
          <button
            aria-label={'Increase ' + label}
            disabled={field.max !== undefined && nextValue > field.max}
            type="button"
            onClick={() => onChange(nextValue)}
          >
            +
          </button>
        </div>
        {printed}
      </>
    )
  }

  return (
    <>
      <label className="editing-controls">
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
      {printed}
    </>
  )
}
