# Deckwright

Deckwright is a planned open-source, static web application for defining,
running, tracking, sharing, and printing tabletop games that use card decks.
It is designed to run entirely in the browser and to deploy to GitHub Pages
without a backend, database, account system, or cloud service.

The repository is currently in its design-foundation phase. Application code
has deliberately not been scaffolded yet.

## Product direction

The first usable release will provide:

- standard 52-card and 78-card tarot deck models;
- versioned game definitions written as Markdown with YAML frontmatter;
- rendered game rules;
- local game sessions with players, configurable fields, phases, and rounds;
- browser-local persistence;
- responsive, accessible, and printable views; and
- three example games that exercise different parts of the format.

Deckwright will not initially provide accounts, networking, cloud sync,
real-time collaboration, arbitrary game scripts, or a comprehensive rules
engine.

## Proposed technology

- Vite
- React
- TypeScript
- Zod for runtime schema validation
- a YAML parser and a safe Markdown renderer
- Vitest and React Testing Library
- GitHub Actions and GitHub Pages

The production build will contain static HTML, CSS, JavaScript, and bundled
game content only. See [Architecture](docs/architecture.md) for the deployment
and runtime boundaries.

## Documentation

- [Architecture](docs/architecture.md)
- [Game definition format](docs/game-format.md)
- [Roadmap and milestone acceptance criteria](docs/roadmap.md)
- [How to create a game](games/README.md)
- [Decision records](docs/decisions/)
- [Approved foundation design](docs/superpowers/specs/2026-08-20-deckwright-foundation-design.md)

## Project status

The next step is to review and approve the written foundation design. A
detailed implementation plan should be written only after that review.

## Contributing

The contribution workflow will use ordinary GitHub issues and pull requests.
Game definitions are intended to be approachable contributions that do not
require JavaScript. Contribution policy, code style, and release procedures
will be added during the foundation milestone.

The repository needs an explicit open-source license before its first public
release or outside contributions are accepted.
