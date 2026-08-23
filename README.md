# Ludocairn

Ludocairn is an open-source, static web application for reading, running,
tracking, exporting, and printing tabletop card games. It runs entirely in the
browser: there is no account, backend, database, analytics service, cloud
sync, background sync, or background transfer of session/private data. While
the page is open, it may check for updates by fetching only application-version
metadata and assets. After its offline shell has been installed, it has no
runtime network dependency for bundled games and local sessions.

## Privacy and session files

Sessions are saved in this browser's `localStorage` on this device. Ludocairn
does not upload them. Clearing site data, using another browser or device, or
losing the browser profile can remove access to those saved sessions.

Use **Export session** from a tracker to download a versioned JSON backup. An
export contains player names, every tracked field, facilitator notes, and any
private role assignments, so handle it as private table material. Importing
reads a selected JSON file
locally, validates its game and schema, and shows a session/game/player/date
preview before **Import session** saves anything. A colliding session ID is
replaced with a new local ID rather than overwriting the existing session.
Imported session and player IDs must use URL-safe characters. Malformed,
unsupported, mismatched, and unavailable-game records remain recoverable and
are never silently accepted. Import confirmation also stops without writing if
the browser cannot enumerate existing sessions safely.

## Optional installation and offline use

Ludocairn remains a normal website. When a supported browser offers its native
installation controls, you may install it; Ludocairn does not show a custom
install prompt and installation is never required.

Offline use starts only after one successful online production load has
registered the service worker and cached the current application shell. After
that, the shell and bundled games can open offline, including the catalog and
game/session URLs that use `?game=`, `?session=`, or `?view=`. An offline first
visit cannot work.

The offline cache contains application files, not your session records.
Sessions stay in this browser's `localStorage` and are not copied into the
service-worker cache or sent anywhere. Clearing browser/site data can remove
both the cached app and local sessions, so export a backup before deliberately
clearing site data or moving to another browser/device.

When an updated app version is ready, Ludocairn asks before reloading. Choose
**Update and reload** only after it can save any pending session change; if the
save fails, the current version remains open so you can retry or export first.

## Create, import, and share a custom game

Choose **Create a game** to start a valid version-1 template in Game Studio.
The Guided, Source, and Preview views edit one canonical Markdown/YAML source;
you can also paste a complete source or choose a local `.md` or
`.ludocairn-game.md` file. Ludocairn validates the full schema and shows a
review before saving. Saved custom games can be edited, opened, used to create
sessions, exported as the exact `.ludocairn-game.md` source, shared, or deleted
when no saved session depends on them. Bundled games remain read-only.

Custom games are stored only in this browser profile's `localStorage`, under
versioned `ludocairn.game.v1.*` keys. There is no backend, account, upload,
cloud copy, or automatic sync. Clearing site data, changing browser, device,
profile, or site origin, private-browsing cleanup, storage blocking, storage
exhaustion, or profile loss can make local games unavailable. Export important
games as backups before clearing or moving browser data. Ludocairn does not
claim, approve, moderate, or verify custom content.

Paste, file import, stored records, and decoded share links all reject source
larger than 1,048,576 UTF-8 bytes (1 MiB). Share links compress the exact
source into a `#share-game=v1.…` URL fragment and open the same review screen;
the fragment is not sent in the HTTP request to the static host. Ludocairn
offers a share link only when the complete URL is at most 8,000 characters. If
it is longer, export the game file and share that instead. A fragment can still
appear in browser history, screenshots, copied URLs, extensions, and code
running in the page, so share it only with intended recipients.

A session stores only its game ID and schema version; it does not embed custom
game source. To move a custom-game session to another browser, export and
import the custom game first, then import the session. Deleting or making an
incompatible edit to a custom game is blocked while local sessions depend on
it. After one successful online production load caches the PWA shell, locally
stored custom games and their sessions can reopen offline. The service worker
caches application code, not custom source or session data, so offline access
is not a backup.

## Bundled games

The catalog contains three original Ludocairn games:

- **[Veilquorum](games/veilquorum/game.md)** — a facilitator-led hidden-role
  game for a standard 52-card deck, with digital role dealing, private
  pass-the-device reveals, an optional Game Master overview, and shared phase,
  round, boolean, number, and text tracking.
- **[Rillward Gambit](games/rillward-gambit/game.md)** — a standard-card
  comparison game about choosing risk, building streaks, and banking score.
- **[Sereinfolio](games/sereinfolio/game.md)** — a non-divinatory tarot
  reflection and storytelling activity with consent-forward passing.

Their rules, terminology, prompts, examples, and tracker configurations were
independently authored for this repository and released under the MIT License.
No commercial games or their proprietary content are bundled.
Each game has an adjacent `RIGHTS.md` with authorship, license, provenance, and
dated name-screen records. Those searches, like the
[Ludocairn product-name record](docs/name-clearance.md), are preliminary
conflict screens—not legal opinions, registration claims, or guarantees of
freedom to use. Database coverage and unregistered market use can change.

## Use and print

Choose a game to read its safely rendered rules, then create a named session
with any number of initial players. The tracker supports player add/remove,
the configured field types, phase and round controls where defined,
facilitator notes, session rename, confirmed deletion, and automatic local
saving. Refreshing a tracker URL restores the valid saved session.

- Structured role guides show role purposes, teams, physical card markers, and
  table-size quantities. Games may optionally deal those roles digitally with
  per-game player and Game Master visibility. The Game Master remains separate
  from the named player roster and receives no role.

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

The same canonical Markdown rules and validated version-1 YAML frontmatter are
accepted in the browser and in the repository; they do not contain JavaScript
or raw HTML. For a local custom game, use Game Studio or import a
`.ludocairn-game.md` file. For a bundled contribution at
`games/<game-id>/game.md`, start with [the author guide](games/README.md),
follow the exact [game-format reference](docs/game-format.md), add the required
adjacent `RIGHTS.md`, and run `npm run ci`. New bundled content must be
independently authored or have documented compatible rights and attribution.

### AI assistants and coding agents

Start with the [AI game-authoring guide](Bots.md). It separates the browser
path, which produces one complete importable source with no repository or
rights-record requirement, from the bundled-contribution path with rights,
validation, pull-request, preview, and print responsibilities.

## GitHub Pages deployment

Vite produces one static `dist/index.html` with relative, bundled assets. The
Pages workflow runs the complete CI gate, uploads only `dist/`, and deploys on
a push to `main` or a manual workflow dispatch. Repository settings must use
**GitHub Actions** as the Pages source. Pull requests run CI but do not deploy.

The first usable release is published at
[https://msa46.github.io/Deckwright/](https://msa46.github.io/Deckwright/) and
was manually verified on 2026-08-21. The repository-subpath build rendered all
three games, then created `Production verification` in Veilquorum with Ari and
Bea, added Cy, advanced to round 2, unchecked Ari, reported `Saved`, and
restored all of that state after reload. Browser inspection found only
same-origin GitHub Pages JavaScript, CSS, and favicon assets, with no
application-origin console warnings or errors.

The reviewed release head was safely fast-forwarded to `main` after the feature
branch was pushed. Pull-request creation was unavailable because the local
GitHub CLI token had expired and the GitHub integration returned HTTP 403; the
remote `main` branch was still the reviewed head's ancestor. The resulting
[CI run](https://github.com/msa46/Deckwright/actions/runs/32508019269) and
[Pages deployment](https://github.com/msa46/Deckwright/actions/runs/32508019317)
both succeeded.

Local release verification also exercised import preview and confirmation,
the export action, and both print actions. The browser backend did not expose
the export download event, so the downloaded file was not independently
opened in that manual run; automated tests separately verify its UTF-8 JSON
contents, filename, extension, and privacy copy. The native print dialog was
not introspected, so verification stops at the successful browser/system print
action boundary.

The structured Veilquorum role guide and its release-closure fixes were
published from `main` at `433b3c8` on 2026-08-21. The
[CI run](https://github.com/msa46/Deckwright/actions/runs/32527013767) and
[Pages deployment](https://github.com/msa46/Deckwright/actions/runs/32527013761)
succeeded. Production rendered the reviewed role definitions and labeled
Team/Card/Purpose structure from same-origin assets without application console
warnings or errors.

The later mobile PWA implementation is automated-tested and has partial local
Chromium evidence for offline routes, restored session state, and update-prompt
visibility. Update activation, native install signals, a live Pages deployment,
and physical iOS or Android verification remain open. See the roadmap for the
full evidence ledger.

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
