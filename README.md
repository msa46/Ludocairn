# Ludocairn

Ludocairn is an open-source, static web application for defining,
running, tracking, sharing, and printing tabletop games that use card decks.
It is designed to run entirely in the browser and to deploy to GitHub Pages
without a backend, database, account system, or cloud service.

The repository contains the tested static application and delivery foundation.
Card, game-definition, and session functionality is delivered in the next
increments.

## What the names mean

**Ludocairn** is pronounced *LOO-doh-kairn*. It is a coined name combining
`ludo-`, associated with play and games, with `cairn`, a durable marker that
helps people find their way. Together, the name describes a guidepost for
choosing, understanding, and tracking tabletop games.

The project previously used **Deckwright** as a working name. That name was
retired after unrelated card-game and software products were found using it.
Historical planning file names and the current GitHub repository path may
still contain `Deckwright` until the repository itself is renamed.

The first bundled game, **Veilquorum**, is also a coined name: `veil` refers to
its hidden allegiances, while `quorum` refers to the group of active voices the
players are trying to protect or control. Name searches and their limitations
are recorded in [the project screening record](docs/name-clearance.md) and the
game's [rights record](games/veilquorum/RIGHTS.md).

## Product direction

The first usable release will provide:

- standard 52-card and 78-card tarot deck models;
- versioned game definitions written as Markdown with YAML frontmatter;
- rendered game rules;
- local game sessions with players, configurable fields, phases, and rounds;
- browser-local persistence;
- responsive, accessible, and printable views; and
- three example games that exercise different parts of the format.

Ludocairn will not initially provide accounts, networking, cloud sync,
real-time collaboration, arbitrary game scripts, or a comprehensive rules
engine.

## Technology

- Vite
- React
- TypeScript
- a YAML parser and a safe Markdown renderer
- Vitest and React Testing Library
- GitHub Actions and GitHub Pages

The production build will contain static HTML, CSS, JavaScript, and bundled
game content only. See [Architecture](docs/architecture.md) for the deployment
and runtime boundaries.

## Documentation

- [Architecture](docs/architecture.md)
- [Game definition format](docs/game-format.md)
- [Game content rights policy](docs/content-rights.md)
- [Roadmap and milestone acceptance criteria](docs/roadmap.md)
- [How to create a game](games/README.md)
- [Decision records](docs/decisions/)
- [Approved foundation design](docs/superpowers/specs/2026-08-20-deckwright-foundation-design.md)
- [Approved first usable release design](docs/superpowers/specs/2026-08-21-ludocairn-first-usable-release-design.md)
- [Preliminary product-name screening](docs/name-clearance.md)

## Local development

Ludocairn requires Node.js 22.22.2 or newer within Node.js 22 and npm 10 or
newer.

```bash
nvm use
npm ci
npm run dev
```

Run the complete local quality and production-artifact gate with:

```bash
npm run ci
```

## Deployment

Vite builds Ludocairn into the static `dist/` directory with relative asset
paths. The GitHub Pages workflow checks the repository, uploads only `dist/`,
and deploys it from pushes to `main` or a manual workflow run. In repository
settings, configure Pages to use **GitHub Actions** as its source.

## Project status

The static application and delivery foundation is in place. The next increment
implements the local session tracker and user-facing game catalog. Canonical
card decks, selectors, game-definition validation, safe Markdown rendering,
and the first original game are already implemented on the release branch.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and the pull-request
workflow. Game definitions are intended to be approachable contributions that
do not require JavaScript.

## License

Ludocairn is available under the [MIT License](LICENSE).
