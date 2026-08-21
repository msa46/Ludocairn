# Ludocairn

Ludocairn is an open-source, static web application for reading, running,
tracking, exporting, and printing tabletop card games. The first usable
release runs entirely in the browser: there is no account, backend, database,
analytics service, cloud sync, or runtime network dependency.

## Privacy and session files

Sessions are saved in this browser's `localStorage` on this device. Ludocairn
does not upload them. Clearing site data, using another browser or device, or
losing the browser profile can remove access to those saved sessions.

Use **Export session** from a tracker to download a versioned JSON backup. An
export contains player names, every tracked field, and facilitator notes, so
handle it as private table material. Importing reads a selected JSON file
locally, validates its game and schema, and shows a session/game/player/date
preview before **Import session** saves anything. A colliding session ID is
replaced with a new local ID rather than overwriting the existing session.
Malformed, unsupported, and unavailable-game records remain recoverable and
are never silently accepted.

## Bundled games

The catalog contains three original Ludocairn games:

- **[Veilquorum](games/veilquorum/game.md)** — a facilitator-led hidden-role
  game for a standard 52-card deck, with phase, round, boolean, choice,
  number, and text tracking.
- **[Rillward Gambit](games/rillward-gambit/game.md)** — a standard-card
  comparison game about choosing risk, building streaks, and banking score.
- **[Sereinfolio](games/sereinfolio/game.md)** — a non-divinatory tarot
  reflection and storytelling activity with consent-forward passing.

Their rules, terminology, prompts, examples, and tracker configurations were
independently authored for this repository and released under the MIT License.
Each game has an adjacent `RIGHTS.md` with authorship, license, provenance, and
dated name-screen records. Those searches, like the
[Ludocairn product-name record](docs/name-clearance.md), are preliminary
conflict screens—not legal opinions, registration claims, or guarantees of
freedom to use. Database coverage and unregistered market use can change.

## Use and print

Choose a game to read its safely rendered rules, then create a named session
with any number of initial players. The tracker supports player add/remove,
the four configured field types, phase and round controls where defined,
facilitator notes, session rename, confirmed deletion, and automatic local
saving. Refreshing a tracker URL restores the valid saved session.

**Print rules** and **Print tracker** open the browser's print dialog. Dedicated
print styles hide navigation and editing controls, expose current tracker
values, avoid splitting player cards where practical, and keep output legible
in grayscale. Browser print preview and printer settings remain outside the
application's control.

## Local development

Ludocairn requires Node.js 22.22.2 or newer within Node.js 22 and npm 10 or
newer.

```bash
nvm use
npm install
npm run dev
```

Open the local URL printed by Vite (normally
[http://127.0.0.1:5173/](http://127.0.0.1:5173/)). Do not open the source
`index.html` as a `file://` URL. Contributors and CI may use `npm ci` for an
exact clean install from `package-lock.json`.

Run the complete local and continuous-integration gate with:

```bash
npm run ci
```

It checks formatting, linting, strict TypeScript, all tests, the production
build, the Ludocairn entry identity, relative JavaScript/CSS asset references,
absence of HTTP(S) runtime asset references, and that every local entry asset
exists beneath `dist/`.

To inspect the production artifact rather than the development server:

```bash
npm run build
npm run preview
```

## Author a game

Game definitions are Markdown rules with validated version-1 YAML frontmatter
at `games/<game-id>/game.md`; they do not contain JavaScript or raw HTML. Start
with [the author guide](games/README.md), follow the exact
[game-format reference](docs/game-format.md), add the required adjacent
`RIGHTS.md`, and run `npm run ci`. New content must be independently authored
or have documented compatible rights and attribution.

## GitHub Pages deployment

Vite produces one static `dist/index.html` with relative, bundled assets. The
Pages workflow runs the complete CI gate, uploads only `dist/`, and deploys on
a push to `main` or a manual workflow dispatch. Repository settings must use
**GitHub Actions** as the Pages source. Pull requests run CI but do not deploy.

No production URL is recorded here yet; it will be added only after the
`main` deployment succeeds and the published repository-subpath build is
manually verified.

## Documentation

- [Architecture and privacy boundaries](docs/architecture.md)
- [Game definition format](docs/game-format.md)
- [Game content rights policy](docs/content-rights.md)
- [Roadmap and release status](docs/roadmap.md)
- [Contributing](CONTRIBUTING.md)
- [Decision records](docs/decisions/)
- [Approved first usable release design](docs/superpowers/specs/2026-08-21-ludocairn-first-usable-release-design.md)

## Name and license

**Ludocairn** is pronounced *LOO-doh-kairn*. The coined name combines
`ludo-`, associated with play, and `cairn`, a durable guide marker. The project
previously used **Deckwright** as a working name; historical planning paths and
the repository path may retain it until the repository itself is renamed.

Ludocairn application code and original repository content are available
under the [MIT License](LICENSE).
