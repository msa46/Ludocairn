# 0002: Define games with Markdown and versioned YAML frontmatter

- Status: accepted
- Date: 2026-08-20

## Context

Game definitions must be readable, manually editable, safe to publish, and
contributable without JavaScript. The application also needs validated data for
session controls.

## Decision

Store each repository game in `games/<game-id>/game.md`. Put versioned,
strictly validated YAML metadata in frontmatter and rules in the Markdown body.
Bundle repository games at build time. Disable raw HTML and executable content.

Version 1 models tracker state through four field types: boolean, choice,
number, and text. It does not introduce separate role, status, counter, or
rules-execution systems.

## Alternatives considered

Pure JSON or YAML would weaken long-form rule authoring. MDX or JavaScript
configuration would allow arbitrary behavior but raise the authoring and
security burden. A custom game language would require tooling and semantics
before real examples justify them.

## Consequences

Game files remain approachable and reviewable. Strict validation makes schema
evolution explicit but rejects unknown fields. Capabilities beyond generic
fields must be added deliberately in later versions.
