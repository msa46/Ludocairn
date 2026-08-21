# Deckwright

Deckwright is an open-source, static web application for defining,
running, tracking, sharing, and printing tabletop games that use card decks.
It is designed to run entirely in the browser and to deploy to GitHub Pages
without a backend, database, account system, or cloud service.

The repository contains the tested static application and delivery foundation.
Card, game-definition, and session functionality is delivered in the next
increments.

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

## Technology

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

## Local development

Deckwright requires Node.js 22 and npm 10 or newer.

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

Vite builds Deckwright into the static `dist/` directory with relative asset
paths. The GitHub Pages workflow checks the repository, uploads only `dist/`,
and deploys it from pushes to `main` or a manual workflow run. In repository
settings, configure Pages to use **GitHub Actions** as its source.

## Project status

The static application and delivery foundation is in place. The next increment
implements card decks, structured selectors, game-definition validation, safe
Markdown rendering, and the three example games.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and the pull-request
workflow. Game definitions are intended to be approachable contributions that
do not require JavaScript.

## License

Deckwright is available under the [MIT License](LICENSE).
