import type { PlayerFieldDefinition, RoleDefinition } from '../../games/model'
import type { SessionFieldValue } from '../../sessions/model'

interface PlayerFieldControlProps {
  readonly field: PlayerFieldDefinition
  readonly playerName: string
  readonly roles?: readonly RoleDefinition[]
  readonly value: SessionFieldValue
  readonly onChange: (value: SessionFieldValue) => void
}

function decimalPlaces(value: number): number {
  const [coefficient, exponentText] = value.toString().toLowerCase().split('e')
  const fractionLength = coefficient?.split('.')[1]?.length ?? 0
  const exponent = Number(exponentText ?? 0)
  return Math.max(0, fractionLength - exponent)
}

function stepBy(value: number, step: number, direction: -1 | 1): number {
  const precision = Math.min(
    15,
    Math.max(decimalPlaces(value), decimalPlaces(step)),
  )
  const scale = 10 ** precision
  return (
    (Math.round(value * scale) + direction * Math.round(step * scale)) / scale
  )
}

export function PlayerFieldControl({
  field,
  playerName,
  roles = [],
  value,
  onChange,
}: PlayerFieldControlProps) {
  const label = playerName + ' — ' + field.label
  const printValue =
    field.type === 'boolean'
      ? value === true
        ? 'Yes'
        : 'No'
      : field.type === 'role'
        ? (roles.find((role) => role.id === value)?.label ?? String(value))
        : String(value)
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
    const previousValue = stepBy(numericValue, step, -1)
    const nextValue = stepBy(numericValue, step, 1)
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

  if (field.type === 'role') {
    return (
      <>
        <label className="editing-controls">
          {field.label}
          <select
            aria-label={label}
            value={String(value)}
            onChange={(event) => onChange(event.target.value)}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
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
