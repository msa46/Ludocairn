# Contributing to Ludocairn

Ludocairn welcomes focused bug fixes, accessible interface improvements,
documentation, tests, and independently authored repository games.

## Development setup

Use Node.js 22.22.2 or newer within Node.js 22 and npm 10 or newer:

```bash
nvm use
npm install
npm run dev
```

`npm install` prepares an ordinary local checkout; `npm ci` recreates the
exact lockfile installation used by automation. Before opening a pull request,
run the complete gate:

```bash
npm run ci
```

This checks formatting, linting, strict TypeScript, all tests, the production
build, and the static Pages artifact contract. Do not commit `dist/`.

## Engineering changes

- Keep domain behavior outside React components and cover behavior changes
  with focused tests written before implementation.
- Preserve semantic landmarks, programmatic labels, keyboard operation,
  visible focus, status/alert announcements, 20rem-wide usability, and
  grayscale print output.
- Treat stored and imported JSON as untrusted. Preserve recoverability and do
  not silently overwrite a valid session or unreadable record.
- Do not add a backend, account, analytics, cloud, or remote-runtime
  dependency to the first-release boundary.
- Keep changes scoped and record material architecture decisions.
- Use conventional commit subjects such as `feat:`, `fix:`, `test:`, and
  `docs:`.

When a change affects interaction or layout, exercise the production artifact
at narrow and wide widths. Include keyboard-only and print-preview evidence
where relevant; component tests do not replace that browser check.

## Game contributions

Repository games live at `games/<game-id>/game.md`. Read the
[author guide](games/README.md), [version-1 format](docs/game-format.md), and
[game content rights policy](docs/content-rights.md) before writing one.

A game contribution must:

1. use a stable lowercase directory/frontmatter ID;
2. provide validated YAML metadata and self-contained Markdown rules without
   raw HTML, JavaScript, remote widgets, images, or executable content;
3. use only the generic boolean, choice, number, and text tracker fields the
   game actually needs;
4. include `games/<game-id>/RIGHTS.md` documenting authorship, MIT-compatible
   license, provenance, and a dated exact/confusing-similarity name screen;
5. contain independently written rules and presentation, with reliable
   permission and attribution for any non-original material; and
6. pass `npm run ci`, which validates every bundled game and adjacent rights
   record.

Do not copy or closely paraphrase rulebooks, and do not submit third-party art,
logos, characters, branded settings, guidebook interpretations, or product
files without documented compatible permission. Name screening is a
preliminary contribution check, not legal clearance or a guarantee that no
conflicting registered or unregistered use exists.

## Privacy and session compatibility

Sessions remain in browser `localStorage` unless a user explicitly exports a
JSON file. Exports contain player names, tracker fields, and facilitator notes;
never add automatic uploads, telemetry, or a misleading claim that exported
files remain private after download. Imports must be parsed and validated
before preview and save. Storage and session format changes need an explicit
version and compatibility tests.

## Pull requests and deployment

Describe the user-visible outcome, list verification commands, and include
narrow-screen, keyboard, accessibility, or print evidence when applicable. Do
not mix unrelated refactors into a feature or game contribution.

Pull requests run `.github/workflows/ci.yml`. GitHub Pages deployment is
deliberately limited to pushes to `main` or a manual dispatch of
`.github/workflows/deploy-pages.yml`; feature branches and pull requests must
not publish. The deploy workflow reruns `npm run ci` and uploads only `dist/`.
