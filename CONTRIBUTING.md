# Contributing to Deckwright

Deckwright welcomes focused bug fixes, accessible interface improvements,
documentation, tests, and repository-hosted games.

## Development setup

Use Node.js 22.22.2 or newer within Node.js 22 and npm 10 or newer:

```bash
nvm use
npm ci
npm run dev
```

Before opening a pull request, run the same gate as continuous integration:

```bash
npm run ci
```

This command checks formatting, linting, types, tests, the production build,
and GitHub Pages-safe asset paths.

## Changes

- Keep domain behavior outside React components and cover it with focused tests.
- Preserve semantic HTML, keyboard access, narrow-screen usability, and print.
- Do not add backend, account, analytics, or remote-runtime dependencies.
- Keep changes scoped; explain architecture changes with a decision record.
- Use conventional commit subjects such as `feat:`, `fix:`, `test:`, and `docs:`.

## Games

Repository games live at `games/<game-id>/game.md`. Read
[`games/README.md`](games/README.md) and
[`docs/game-format.md`](docs/game-format.md) before proposing a game. Game
definitions must not contain JavaScript or raw HTML.

Game contributors must also follow the
[`game content rights policy`](docs/content-rights.md). Rules and presentation
must be independently authored, and each game must include an adjacent
`RIGHTS.md` documenting authorship, license, provenance, and name-clearance
work. Do not submit copied or closely paraphrased rulebook text, third-party
artwork, logos, branded characters, or other material without documented
compatible permission.

## Pull requests

Describe the user-visible outcome, list the verification commands you ran, and
include print or narrow-screen evidence when the change affects layout. Do not
mix unrelated refactors into a feature or game contribution.
