# 0001: Use Vite, React, and TypeScript

- Status: accepted
- Date: 2026-08-20

## Context

Ludocairn needs an interactive browser application that emits static files for
GitHub Pages. The repository has no existing stack. Contributor familiarity,
strong TypeScript support, and low deployment complexity are priorities.

## Decision

Use Vite as the build tool, React for the interface, and TypeScript for
application and domain logic. Deploy Vite's `dist/` directory with GitHub
Actions. Use a relative Vite base and one physical application entry point.

## Alternatives considered

Astro with React islands would produce more pre-rendered HTML but introduces
two component models before the product benefits from them. A custom Vite
multi-page generator would provide physical public routes but adds routing and
content-generation machinery that the first milestone does not need.

## Consequences

The application has a familiar contributor stack and a simple static artifact.
Rules render in the client rather than arriving as independently generated HTML
pages. Public navigation uses root-document state and query parameters instead
of server-resolved paths.
