import { useState } from 'react'

import type { PlayerFieldDefinition, RoleDefinition } from '../../games/model'

interface FieldEditorProps {
  readonly fields: readonly PlayerFieldDefinition[]
  readonly roles: readonly RoleDefinition[]
  readonly onChange: (fields: readonly PlayerFieldDefinition[]) => void
}

type FieldType = PlayerFieldDefinition['type']

interface FieldDraft {
  readonly uiKey: string
  readonly id: string
  readonly label: string
  readonly type: FieldType
  readonly booleanDefault: boolean
  readonly choices: string
  readonly choiceDefault: string
  readonly numberDefault: string
  readonly minimum: string
  readonly maximum: string
  readonly step: string
  readonly textDefault: string
  readonly multiline: boolean
  readonly roleDefault: string
}

interface FieldDraftState {
  readonly committedRevision: string
  readonly pendingRevision?: string
  readonly values: readonly FieldDraft[]
}

type DraftResult =
  | { readonly ok: true; readonly value: readonly PlayerFieldDefinition[] }
  | { readonly ok: false; readonly messages: readonly string[] }

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function fieldRevision(fields: readonly PlayerFieldDefinition[]): string {
  return JSON.stringify(fields)
}

function fieldDraft(field: PlayerFieldDefinition, index: number): FieldDraft {
  const common = {
    uiKey: `field:${field.id}:${index}`,
    id: field.id,
    label: field.label,
    type: field.type,
    booleanDefault: false,
    choices: '',
    choiceDefault: '',
    numberDefault: '',
    minimum: '',
    maximum: '',
    step: '',
    textDefault: '',
    multiline: false,
    roleDefault: '',
  }
  switch (field.type) {
    case 'boolean':
      return { ...common, booleanDefault: field.default }
    case 'choice':
      return {
        ...common,
        choices: field.choices.join(', '),
        choiceDefault: field.default,
      }
    case 'number':
      return {
        ...common,
        numberDefault: String(field.default),
        minimum: field.min === undefined ? '' : String(field.min),
        maximum: field.max === undefined ? '' : String(field.max),
        step: field.step === undefined ? '' : String(field.step),
      }
    case 'text':
      return {
        ...common,
        textDefault: field.default,
        multiline: field.multiline,
      }
    case 'role':
      return { ...common, roleDefault: field.default }
  }
}

function newFieldDraft(id: string, label: string): FieldDraft {
  return {
    uiKey: `field:new:${id}`,
    id,
    label,
    type: 'boolean',
    booleanDefault: false,
    choices: '',
    choiceDefault: '',
    numberDefault: '',
    minimum: '',
    maximum: '',
    step: '',
    textDefault: '',
    multiline: false,
    roleDefault: '',
  }
}

function choiceValues(value: string): readonly string[] {
  return value.split(',').map((choice) => choice.trim())
}

function finiteNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function optionalFiniteNumber(value: string): number | undefined | null {
  return value.trim() === '' ? undefined : (finiteNumber(value) ?? null)
}

function parseDrafts(
  drafts: readonly FieldDraft[],
  roles: readonly RoleDefinition[],
): DraftResult {
  const messages: string[] = []
  const candidates: PlayerFieldDefinition[] = []
  const ids = new Set<string>()

  for (const draft of drafts) {
    if (!ID_PATTERN.test(draft.id)) {
      messages.push('Field IDs must be lowercase stable identifiers.')
    } else if (ids.has(draft.id)) {
      messages.push('Field IDs must be unique.')
    }
    ids.add(draft.id)
    if (draft.label.trim() === '') {
      messages.push('Field labels must be non-empty.')
    }

    const base = { id: draft.id, label: draft.label.trim() }
    switch (draft.type) {
      case 'boolean':
        candidates.push({
          ...base,
          type: 'boolean',
          default: draft.booleanDefault,
        })
        break
      case 'choice': {
        const choices = choiceValues(draft.choices)
        if (choices.some((choice) => choice === '')) {
          messages.push(
            'Complete each comma-separated choice before adding another.',
          )
        } else if (
          choices.some((choice) => !ID_PATTERN.test(choice)) ||
          new Set(choices).size !== choices.length
        ) {
          messages.push('Choices must be unique stable identifiers.')
        }
        if (!choices.includes(draft.choiceDefault)) {
          messages.push('Default must be one of the choices.')
        }
        candidates.push({
          ...base,
          type: 'choice',
          choices,
          default: draft.choiceDefault,
        })
        break
      }
      case 'number': {
        const defaultValue = finiteNumber(draft.numberDefault)
        const minimum = optionalFiniteNumber(draft.minimum)
        const maximum = optionalFiniteNumber(draft.maximum)
        const step = optionalFiniteNumber(draft.step)
        if (
          defaultValue === undefined ||
          minimum === null ||
          maximum === null ||
          step === null
        ) {
          messages.push('Number defaults and constraints must be finite.')
        }
        if (
          minimum !== undefined &&
          minimum !== null &&
          maximum !== undefined &&
          maximum !== null &&
          minimum > maximum
        ) {
          messages.push('Minimum cannot exceed maximum.')
        }
        if (step !== undefined && step !== null && step <= 0) {
          messages.push('Step must be greater than zero.')
        }
        if (
          defaultValue !== undefined &&
          ((minimum !== undefined &&
            minimum !== null &&
            defaultValue < minimum) ||
            (maximum !== undefined &&
              maximum !== null &&
              defaultValue > maximum))
        ) {
          messages.push('Default must be within the numeric bounds.')
        }
        candidates.push({
          ...base,
          type: 'number',
          default: defaultValue ?? 0,
          ...(minimum === undefined || minimum === null
            ? {}
            : { min: minimum }),
          ...(maximum === undefined || maximum === null
            ? {}
            : { max: maximum }),
          ...(step === undefined || step === null ? {} : { step }),
        })
        break
      }
      case 'text':
        candidates.push({
          ...base,
          type: 'text',
          default: draft.textDefault,
          multiline: draft.multiline,
        })
        break
      case 'role':
        if (roles.length === 0) {
          messages.push('Add a role before using a role field.')
        } else if (!roles.some((role) => role.id === draft.roleDefault)) {
          messages.push('Default must be one of the declared roles.')
        }
        candidates.push({ ...base, type: 'role', default: draft.roleDefault })
        break
    }
  }

  return messages.length === 0
    ? { ok: true, value: candidates }
    : { ok: false, messages: [...new Set(messages)] }
}

function nextFieldId(drafts: readonly FieldDraft[]): string {
  let number = drafts.length + 1
  while (drafts.some((draft) => draft.id === `field-${number}`)) number += 1
  return `field-${number}`
}

function draftForType(
  draft: FieldDraft,
  type: FieldType,
  roles: readonly RoleDefinition[],
): FieldDraft {
  const common = {
    uiKey: draft.uiKey,
    id: draft.id,
    label: draft.label,
    type,
    booleanDefault: false,
    choices: '',
    choiceDefault: '',
    numberDefault: '',
    minimum: '',
    maximum: '',
    step: '',
    textDefault: '',
    multiline: false,
    roleDefault: '',
  }
  switch (type) {
    case 'boolean':
      return common
    case 'choice':
      return { ...common, choices: 'option', choiceDefault: 'option' }
    case 'number':
      return { ...common, numberDefault: '0' }
    case 'text':
      return common
    case 'role':
      return { ...common, roleDefault: roles[0]?.id ?? '' }
  }
}

export function FieldEditor({ fields, roles, onChange }: FieldEditorProps) {
  const committedRevision = fieldRevision(fields)
  const [draftState, setDraftState] = useState<FieldDraftState>(() => ({
    committedRevision,
    values: fields.map(fieldDraft),
  }))
  let currentDraftState = draftState
  if (committedRevision === draftState.pendingRevision) {
    currentDraftState = {
      committedRevision,
      values: draftState.values,
    }
    setDraftState(currentDraftState)
  } else if (committedRevision !== draftState.committedRevision) {
    currentDraftState = {
      committedRevision,
      values: fields.map(fieldDraft),
    }
    setDraftState(currentDraftState)
  }
  const drafts = currentDraftState.values
  const result = parseDrafts(drafts, roles)

  function setDrafts(values: readonly FieldDraft[], pendingRevision?: string) {
    setDraftState({
      committedRevision,
      ...(pendingRevision ? { pendingRevision } : {}),
      values: [...values],
    })
  }

  function updateDrafts(nextDrafts: readonly FieldDraft[]) {
    const next = parseDrafts(nextDrafts, roles)
    if (!next.ok) {
      setDrafts(nextDrafts)
      return
    }
    setDrafts(nextDrafts, fieldRevision(next.value))
    onChange(next.value)
  }

  function changeDraft(index: number, patch: Partial<FieldDraft>) {
    updateDrafts(
      drafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    )
  }

  function changeType(index: number, type: FieldType) {
    updateDrafts(
      drafts.map((draft, draftIndex) =>
        draftIndex === index ? draftForType(draft, type, roles) : draft,
      ),
    )
  }

  function addField() {
    const id = nextFieldId(drafts)
    updateDrafts([...drafts, newFieldDraft(id, `Field ${drafts.length + 1}`)])
  }

  function moveField(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= drafts.length) return
    const nextDrafts = [...drafts]
    const [draft] = nextDrafts.splice(index, 1)
    if (!draft) return
    nextDrafts.splice(destination, 0, draft)
    updateDrafts(nextDrafts)
  }

  function removeField(index: number) {
    updateDrafts(drafts.filter((_, draftIndex) => draftIndex !== index))
  }

  return (
    <fieldset>
      <legend>Tracker fields</legend>
      <div className="form-actions">
        <button type="button" onClick={addField}>
          Add tracker field
        </button>
      </div>
      {drafts.map((draft, index) => {
        const displayLabel = draft.label.trim() || `Field ${index + 1}`
        return (
          <div key={draft.uiKey}>
            <label>
              Field {index + 1} ID
              <input
                type="text"
                value={draft.id}
                onChange={(event) =>
                  changeDraft(index, { id: event.target.value })
                }
              />
            </label>
            <label>
              Field {index + 1} label
              <input
                type="text"
                value={draft.label}
                onChange={(event) =>
                  changeDraft(index, { label: event.target.value })
                }
              />
            </label>
            <label>
              Field {index + 1} type
              <select
                value={draft.type}
                onChange={(event) =>
                  changeType(index, event.target.value as FieldType)
                }
              >
                <option value="boolean">Boolean</option>
                <option value="choice">Choice</option>
                <option value="number">Number</option>
                <option value="text">Text</option>
                <option value="role">Role</option>
              </select>
            </label>
            {draft.type === 'boolean' && (
              <label className="checkbox-field">
                <input
                  aria-label={`Field ${index + 1} boolean default`}
                  checked={draft.booleanDefault}
                  type="checkbox"
                  onChange={(event) =>
                    changeDraft(index, { booleanDefault: event.target.checked })
                  }
                />
                <span>Default to checked</span>
              </label>
            )}
            {draft.type === 'choice' && (
              <>
                <label>
                  Field {index + 1} choices
                  <input
                    type="text"
                    value={draft.choices}
                    onChange={(event) =>
                      changeDraft(index, { choices: event.target.value })
                    }
                  />
                </label>
                <label>
                  Field {index + 1} default
                  <input
                    type="text"
                    value={draft.choiceDefault}
                    onChange={(event) =>
                      changeDraft(index, { choiceDefault: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            {draft.type === 'number' && (
              <>
                <label>
                  Field {index + 1} number default
                  <input
                    inputMode="decimal"
                    type="text"
                    value={draft.numberDefault}
                    onChange={(event) =>
                      changeDraft(index, { numberDefault: event.target.value })
                    }
                  />
                </label>
                <label>
                  Field {index + 1} minimum
                  <input
                    inputMode="decimal"
                    type="text"
                    value={draft.minimum}
                    onChange={(event) =>
                      changeDraft(index, { minimum: event.target.value })
                    }
                  />
                </label>
                <label>
                  Field {index + 1} maximum
                  <input
                    inputMode="decimal"
                    type="text"
                    value={draft.maximum}
                    onChange={(event) =>
                      changeDraft(index, { maximum: event.target.value })
                    }
                  />
                </label>
                <label>
                  Field {index + 1} step
                  <input
                    inputMode="decimal"
                    type="text"
                    value={draft.step}
                    onChange={(event) =>
                      changeDraft(index, { step: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            {draft.type === 'text' && (
              <>
                <label>
                  Field {index + 1} text default
                  <input
                    type="text"
                    value={draft.textDefault}
                    onChange={(event) =>
                      changeDraft(index, { textDefault: event.target.value })
                    }
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    aria-label={`Field ${index + 1} multiline`}
                    checked={draft.multiline}
                    type="checkbox"
                    onChange={(event) =>
                      changeDraft(index, { multiline: event.target.checked })
                    }
                  />
                  <span>Allow multiple lines</span>
                </label>
              </>
            )}
            {draft.type === 'role' && (
              <label>
                Field {index + 1} default
                <select
                  disabled={roles.length === 0}
                  value={draft.roleDefault}
                  onChange={(event) =>
                    changeDraft(index, { roleDefault: event.target.value })
                  }
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="form-actions">
              <button
                aria-label={`Move ${displayLabel} up`}
                disabled={index === 0}
                type="button"
                onClick={() => moveField(index, -1)}
              >
                Move up
              </button>
              <button
                aria-label={`Move ${displayLabel} down`}
                disabled={index === drafts.length - 1}
                type="button"
                onClick={() => moveField(index, 1)}
              >
                Move down
              </button>
              <button
                aria-label={`Remove ${displayLabel}`}
                type="button"
                onClick={() => removeField(index)}
              >
                Remove field
              </button>
            </div>
          </div>
        )
      })}
      {!result.ok &&
        result.messages.map((message) => (
          <p key={message} role="alert">
            {message}
          </p>
        ))}
    </fieldset>
  )
}
