# 0003: Keep sessions local and reserve URL fragments

- Status: accepted
- Date: 2026-08-20

## Context

GitHub Pages provides no application database or request handler. Session data
may contain private notes. GitHub Pages also does not provide an automatic SPA
fallback for arbitrary routes.

## Decision

Store first-milestone sessions in versioned local-storage documents behind a
storage interface. Keep public navigation on the physical root document and
use query parameters only for non-private identifiers such as a selected game.
Reserve URL fragments for a later, explicit small-state sharing format.

## Alternatives considered

IndexedDB offers more capacity and transactions but exceeds the initial data
needs. Hash routing works on static hosts but consumes the same fragment
namespace intended for private state. A copied `404.html` SPA fallback is a
host-specific workaround and complicates direct navigation.

## Consequences

Sessions work offline after the application loads and do not leave the device
without explicit future export or sharing. Local storage has practical size
limits and no transactional model, so the adapter boundary permits a later
replacement. The first milestone does not expose distinct path URLs for views.
