# 0005: Use Original Content for Built-in Games

- Status: accepted
- Date: 2026-08-21

## Context

Deckwright needs three built-in games to validate its game-definition and
session abstractions. General game mechanics do not require public-domain
status, but particular rule text, artwork, branding, and other expression can
be protected. Game names also require a separate trademark assessment.

The roadmap currently uses `Card Mafia`, `Higher or Lower`, and
`Tarot Journey` as working titles. Treating a familiar mechanic or title as a
license to reuse published content would expose the public repository and its
downstream users to avoidable uncertainty.

## Decision

Build all first-release examples as original Deckwright works under the
repository's MIT License. Reuse only general mechanics and common deck facts.
Write all rules, role descriptions, examples, and presentation independently,
and include no third-party artwork.

Treat every example name as provisional until a documented USPTO, BOIP, EUIPO,
and market search is complete. Prefer original names and avoid any suggestion
that an example is an official version of another game.

Require an adjacent `RIGHTS.md` for every repository-hosted game. The detailed
requirements and supporting sources live in
[`docs/content-rights.md`](../content-rights.md).

## Alternatives considered

Requiring every mechanic to come from a public-domain game is unnecessarily
restrictive because copyright does not protect methods of play. Copying a
modern rulebook with attribution alone is unsafe because attribution is not a
license. Accepting arbitrary third-party licenses in the first release would
also complicate repository licensing and redistribution before there is a real
need.

## Consequences

The first examples require original writing and a modest name-clearance step.
They can demonstrate familiar game patterns without copying a publisher's
expression. Contributions with public-domain or separately licensed material
remain possible later, but require explicit provenance, notices, and maintainer
review rather than being assumed to fall under the repository license.
