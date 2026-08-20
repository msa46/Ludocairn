# Deckwright Foundation Increment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a tested Vite, React, and TypeScript application shell that builds to a static GitHub Pages artifact and establishes the repository's quality, accessibility, print, contribution, and deployment baselines.

**Architecture:** This increment creates only the browser application shell and delivery infrastructure. Vite emits one physical `index.html` with relative asset URLs; React owns the semantic shell; Vitest checks behavior and repository contracts; GitHub Actions runs the same local `npm run ci` gate before deploying `dist/`. Card, game-definition, and session domains belong to separate follow-on plans.

**Tech Stack:** Node.js 22, npm 10, Vite 8.2.2, React 19.2.8, TypeScript 6.0.3, Vitest 4.1.11, Testing Library, ESLint 10, Prettier 3, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-20-deckwright-foundation-design.md`

## Global Constraints

- The production site is fully static and deployable to GitHub Pages.
- No backend, database, account, authentication, or cloud service is required.
- Application and domain logic use TypeScript.
- Accessibility, narrow screens, and printing are first-milestone concerns.
- Use Node.js 22.12 or newer within major version 22; commit `.nvmrc` with `22`.
- Pin direct npm dependencies exactly and commit `package-lock.json`.
- Configure Vite with `base: "./"`; do not add path routing, a hash router, or a copied `404.html` fallback.
- The app must not make network requests or add analytics, fonts, trackers, remote images, or third-party scripts.
- Use semantic HTML and native controls; color must not be the sole carrier of meaning.
- Treat the MIT License as the approved default for this plan. If the owner rejects MIT before execution, change Task 5 and decision documentation before committing that task.
- Do not add card, game-definition, Markdown, YAML, Zod, or session-state code in this increment.

## Planned file map

| Path | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json` | Exact dependency graph and local/CI commands. |
| `.nvmrc` | Node.js major used by contributors and CI. |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | Strict application and tooling type-check boundaries. |
| `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitignore` | Repository-wide static-analysis and formatting policy. |
| `vite.config.ts` | React/Vitest configuration and relative static base. |
| `index.html`, `src/main.tsx` | Single static document and React entry point. |
| `src/app/App.tsx` | Semantic, non-domain application shell. |
| `src/app/App.test.tsx` | Accessible-shell contract. |
| `src/styles/global.css`, `src/styles/global-css.test.ts` | Responsive visual baseline and print contract. |
| `src/test/setup.ts` | Shared Testing Library matchers and cleanup. |
| `scripts/verify-static-build.mjs`, `scripts/verify-static-build.d.mts`, `scripts/verify-static-build.test.ts` | GitHub Pages artifact verification and its typed interface. |
| `scripts/workflows.test.ts` | CI/deployment workflow contract. |
| `.github/workflows/ci.yml` | Pull-request and branch quality gate. |
| `.github/workflows/deploy-pages.yml` | Main-branch Pages build and deployment. |
| `LICENSE`, `CONTRIBUTING.md` | Public-repository legal and contributor baseline. |
| `scripts/repository-docs.test.ts` | Release-document contract. |
| `README.md`, `docs/decisions/0004-mit-license.md` | Current setup/status guidance and license decision. |

---

### Task 1: Establish the TypeScript application and test toolchain

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `.nvmrc`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `eslint.config.js`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/vite-env.d.ts`
- Create: `src/test/setup.ts`
- Create: `src/app/App.test.tsx`
- Create: `src/app/App.tsx`
- Create: `src/main.tsx`

**Interfaces:**
- Consumes: the static-hosting and technology decisions in `docs/architecture.md` and decision `0001`.
- Produces: `App(): JSX.Element`; the commands `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:watch`, `check`, and `ci`; a Vitest `jsdom` environment used by later tasks.

- [ ] **Step 1: Create the pinned package and repository configuration**

Create `package.json`:

```json
{
  "name": "deckwright",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=22.12 <23"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "verify:dist": "node scripts/verify-static-build.mjs",
    "check": "npm run lint && npm run format:check && npm run typecheck && npm run test",
    "ci": "npm run check && npm run build && npm run verify:dist"
  },
  "dependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@testing-library/dom": "10.4.1",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.2",
    "@types/node": "22.20.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "@vitejs/plugin-react": "6.1.0",
    "eslint": "10.8.1",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.4",
    "globals": "17.11.0",
    "jsdom": "30.0.1",
    "prettier": "3.9.6",
    "typescript": "6.0.3",
    "typescript-eslint": "8.67.0",
    "vite": "8.2.2",
    "vitest": "4.1.11"
  }
}
```

Create `.nvmrc`:

```text
22
```

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.DS_Store
*.local
```

Create `.prettierrc.json`:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all"
}
```

Create `.prettierignore` so executing the plan does not mechanically rewrite
the already reviewed architecture, specification, plan, or game-author docs:

```gitignore
node_modules/
dist/
coverage/
README.md
CONTRIBUTING.md
LICENSE
docs/
games/
```

Create `eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
    },
  },
)
```

- [ ] **Step 2: Create strict TypeScript, Vite, and document configuration**

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "scripts/**/*.test.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "eslint.config.js"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Define, run, track, and print tabletop card games with Deckwright."
    />
    <title>Deckwright</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Install the exact dependency graph**

Run:

```bash
npm install
```

Expected: npm exits 0, creates `package-lock.json`, and reports no peer-dependency resolution error. Confirm `git diff -- package.json` shows no version-range changes.

- [ ] **Step 4: Write the initial failing application test**

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

Create `src/app/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('identifies Deckwright as the application heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Deckwright' }),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the focused test and confirm the missing implementation failure**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 6: Add the minimal React implementation**

Create `src/app/App.tsx`:

```tsx
export function App() {
  return <h1>Deckwright</h1>
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'

const root = document.querySelector<HTMLDivElement>('#root')

if (!root) {
  throw new Error('Deckwright root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Verify the toolchain and minimal application**

Run:

```bash
npm run format
npm run check
npm run build
```

Expected: all commands exit 0; Vitest reports one passing test; Vite creates `dist/index.html`. `npm run ci` is not expected to pass yet because the static-output verifier is added in Task 3.

- [ ] **Step 8: Commit the toolchain**

```bash
git add .editorconfig .gitignore .nvmrc .prettierignore .prettierrc.json eslint.config.js index.html package.json package-lock.json src tsconfig.app.json tsconfig.json tsconfig.node.json vite.config.ts
git commit -m "build: initialize Vite React application"
```

---

### Task 2: Add the accessible, responsive, and printable shell

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/main.tsx`
- Create: `src/styles/global-css.test.ts`
- Create: `src/styles/global.css`

**Interfaces:**
- Consumes: `App(): JSX.Element` and the Vitest setup from Task 1.
- Produces: stable `banner`, `main`, `contentinfo`, `foundation-title`, and `foundation-status` landmarks; shared CSS tokens and `.print-hidden` behavior for later feature views.

- [ ] **Step 1: Expand the shell contract and add the failing stylesheet contract**

Replace `src/app/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('renders a semantic foundation shell', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tabletop games, clearly tracked.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The foundation is ready for the card and game engines.'),
    ).toBeInTheDocument()
  })
})
```

Create `src/styles/global-css.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(
  new URL('./global.css', import.meta.url),
  'utf8',
)

describe('global stylesheet', () => {
  it('defines keyboard focus and print behavior', () => {
    expect(stylesheet).toContain(':focus-visible')
    expect(stylesheet).toContain('@media print')
    expect(stylesheet).toContain('.print-hidden')
  })

  it('contains a wider-screen enhancement without making it the baseline', () => {
    expect(stylesheet).toContain('@media (min-width: 48rem)')
  })
})
```

- [ ] **Step 2: Run both focused tests and confirm the contract failures**

Run:

```bash
npm test -- src/app/App.test.tsx src/styles/global-css.test.ts
```

Expected: FAIL because the semantic shell is absent and `src/styles/global.css` does not exist.

- [ ] **Step 3: Implement the semantic shell**

Replace `src/app/App.tsx` with:

```tsx
export function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <p className="wordmark">Deckwright</p>
        <p className="tagline">A local-first tabletop card-game toolkit</p>
      </header>

      <main id="main-content" className="site-main">
        <section className="foundation-card" aria-labelledby="foundation-title">
          <p className="eyebrow">Foundation increment</p>
          <h1 id="foundation-title">Tabletop games, clearly tracked.</h1>
          <p className="lede">
            Define readable games, keep session state on your device, and print
            what the table needs.
          </p>
          <p id="foundation-status" className="status-note" role="status">
            The foundation is ready for the card and game engines.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p>Static by design. No account or backend required.</p>
      </footer>
    </div>
  )
}
```

- [ ] **Step 4: Implement the mobile-first and print stylesheet**

Create `src/styles/global.css`:

```css
:root {
  color: #1d211c;
  background: #eee9dc;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --ink: #1d211c;
  --muted: #5e655b;
  --paper: #fffdf7;
  --canvas: #eee9dc;
  --accent: #9b3d2f;
  --line: #cfc7b6;
}

* {
  box-sizing: border-box;
}

html {
  min-width: 20rem;
  background: var(--canvas);
}

body {
  min-width: 20rem;
  min-height: 100vh;
  margin: 0;
  color: var(--ink);
  background: var(--canvas);
}

button,
input,
select,
textarea {
  font: inherit;
}

:focus-visible {
  outline: 0.2rem solid var(--accent);
  outline-offset: 0.2rem;
}

.app-shell {
  display: grid;
  min-height: 100vh;
  grid-template-rows: auto 1fr auto;
}

.site-header,
.site-main,
.site-footer {
  width: min(100% - 2rem, 72rem);
  margin-inline: auto;
}

.site-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-block: 1.25rem;
  border-bottom: 1px solid var(--line);
}

.wordmark,
.tagline,
.site-footer p {
  margin: 0;
}

.wordmark {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.tagline,
.site-footer {
  color: var(--muted);
}

.site-main {
  display: grid;
  align-items: center;
  padding-block: 3rem;
}

.foundation-card {
  padding: clamp(1.5rem, 5vw, 4rem);
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--paper);
  box-shadow: 0 1rem 3rem rgb(48 42 31 / 8%);
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  max-width: 15ch;
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(2.25rem, 10vw, 5rem);
  line-height: 0.98;
  letter-spacing: -0.045em;
}

.lede {
  max-width: 40rem;
  margin: 1.5rem 0 0;
  color: var(--muted);
  font-size: clamp(1rem, 3vw, 1.25rem);
  line-height: 1.6;
}

.status-note {
  width: fit-content;
  margin: 2rem 0 0;
  padding: 0.65rem 0.8rem;
  border-left: 0.25rem solid var(--accent);
  background: #f5e9df;
  font-weight: 650;
}

.site-footer {
  padding-block: 1.25rem;
  border-top: 1px solid var(--line);
  font-size: 0.875rem;
}

@media (min-width: 48rem) {
  .site-header {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }

  .site-main {
    padding-block: 5rem;
  }
}

@media print {
  :root,
  html,
  body {
    color: #000;
    background: #fff;
  }

  .print-hidden,
  .site-header,
  .site-footer,
  .status-note {
    display: none !important;
  }

  .site-main {
    width: 100%;
    padding: 0;
  }

  .foundation-card {
    padding: 0;
    border: 0;
    box-shadow: none;
  }
}
```

Add the stylesheet import as the first local import in `src/main.tsx`:

```tsx
import './styles/global.css'
```

- [ ] **Step 5: Verify the shell and production build**

Run:

```bash
npm run format
npm run check
npm run build
```

Expected: all commands exit 0; Vitest reports three passing tests; the build produces `dist/index.html` and hashed assets.

- [ ] **Step 6: Commit the shell**

```bash
git add src/app src/main.tsx src/styles
git commit -m "feat: add accessible application shell"
```

---

### Task 3: Verify the static GitHub Pages artifact

**Files:**
- Create: `scripts/verify-static-build.test.ts`
- Create: `scripts/verify-static-build.mjs`
- Create: `scripts/verify-static-build.d.mts`

**Interfaces:**
- Consumes: Vite's `dist/` output and the `verify:dist` package script from Task 1.
- Produces: `verifyStaticBuild(distDirectory: string): string[]`, returning verified local asset paths and throwing descriptive errors for a missing entry document, root-absolute asset URL, or missing built asset.

- [ ] **Step 1: Write failing verifier tests**

Create `scripts/verify-static-build.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { verifyStaticBuild } from './verify-static-build.mjs'

const temporaryDirectories: string[] = []

function createDist(indexHtml: string, assets: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'deckwright-static-'))
  temporaryDirectories.push(directory)
  writeFileSync(join(directory, 'index.html'), indexHtml)

  for (const [relativePath, contents] of Object.entries(assets)) {
    const outputPath = join(directory, relativePath)
    mkdirSync(join(outputPath, '..'), { recursive: true })
    writeFileSync(outputPath, contents)
  }

  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('verifyStaticBuild', () => {
  it('accepts an index with existing relative assets', () => {
    const directory = createDist(
      '<script type="module" src="./assets/app.js"></script>',
      { 'assets/app.js': 'console.log("Deckwright")' },
    )

    expect(verifyStaticBuild(directory)).toEqual(['./assets/app.js'])
  })

  it('rejects root-absolute asset paths that break repository subpaths', () => {
    const directory = createDist(
      '<script type="module" src="/assets/app.js"></script>',
      { 'assets/app.js': 'console.log("Deckwright")' },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Root-absolute asset URL is not GitHub Pages safe: /assets/app.js',
    )
  })

  it('rejects referenced assets missing from the artifact', () => {
    const directory = createDist(
      '<link rel="stylesheet" href="./assets/app.css" />',
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Referenced asset is missing: ./assets/app.css',
    )
  })
})
```

- [ ] **Step 2: Run the verifier test and confirm the missing module failure**

Run:

```bash
npm test -- scripts/verify-static-build.test.ts
```

Expected: FAIL because `scripts/verify-static-build.mjs` does not exist.

- [ ] **Step 3: Implement the artifact verifier**

Create `scripts/verify-static-build.mjs`:

```js
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function verifyStaticBuild(distDirectory) {
  const indexPath = resolve(distDirectory, 'index.html')

  if (!existsSync(indexPath)) {
    throw new Error(`Static entry document is missing: ${indexPath}`)
  }

  const html = readFileSync(indexPath, 'utf8')
  const localUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => !/^(?:https?:|data:|#)/u.test(url))

  for (const url of localUrls) {
    if (url.startsWith('/')) {
      throw new Error(`Root-absolute asset URL is not GitHub Pages safe: ${url}`)
    }

    const assetPath = resolve(dirname(indexPath), url.split(/[?#]/u, 1)[0])
    if (!existsSync(assetPath)) {
      throw new Error(`Referenced asset is missing: ${url}`)
    }
  }

  return localUrls
}

const invokedPath = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href

if (invokedPath === import.meta.url) {
  try {
    const distDirectory = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'dist',
    )
    const assets = verifyStaticBuild(distDirectory)
    console.log(`Verified static entry and ${assets.length} local asset URLs.`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
```

Create `scripts/verify-static-build.d.mts`:

```ts
export function verifyStaticBuild(distDirectory: string): string[]
```

- [ ] **Step 4: Verify tests and the real Vite artifact**

Run:

```bash
npm run format
npm test -- scripts/verify-static-build.test.ts
npm run build
npm run verify:dist
```

Expected: three verifier tests pass; the build exits 0; `verify:dist` prints `Verified static entry and 2 local asset URLs.` when Vite emits one script and one stylesheet. If Vite emits a different valid count, confirm every printed URL starts with `./` and update only the expected prose in this plan checkpoint, not the verifier behavior.

- [ ] **Step 5: Run the complete local CI command**

Run:

```bash
npm run ci
```

Expected: lint, formatting, type-checking, all tests, production build, and static artifact verification exit 0.

- [ ] **Step 6: Commit artifact verification**

```bash
git add scripts/verify-static-build.d.mts scripts/verify-static-build.mjs scripts/verify-static-build.test.ts
git commit -m "test: verify static Pages artifact"
```

---

### Task 4: Add continuous integration and GitHub Pages deployment

**Files:**
- Create: `scripts/workflows.test.ts`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: Node.js 22, `npm ci`, and `npm run ci` from Tasks 1–3.
- Produces: a read-only pull-request CI workflow and a main-branch Pages workflow that uploads only `dist/`; `scripts/workflows.test.ts` guards their critical commands and permissions.

- [ ] **Step 1: Write the failing workflow contract test**

Create `scripts/workflows.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readWorkflow(name: string) {
  return readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')
}

describe('GitHub workflows', () => {
  it('runs the local CI contract for pushes and pull requests', () => {
    const workflow = readWorkflow('ci.yml')

    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('push:')
    expect(workflow).toContain('npm ci')
    expect(workflow).toContain('npm run ci')
  })

  it('builds and deploys only the static dist artifact', () => {
    const workflow = readWorkflow('deploy-pages.yml')

    expect(workflow).toContain('pages: write')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('npm run ci')
    expect(workflow).toContain("path: './dist'")
    expect(workflow).toContain('actions/deploy-pages@')
  })
})
```

- [ ] **Step 2: Run the workflow test and confirm missing-file failures**

Run:

```bash
npm test -- scripts/workflows.test.ts
```

Expected: FAIL with `ENOENT` because `.github/workflows/ci.yml` does not exist.

- [ ] **Step 3: Add the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - name: Set up Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Check, test, build, and verify
        run: npm run ci
```

- [ ] **Step 4: Add the Pages deployment workflow**

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - name: Set up Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Check, test, build, and verify
        run: npm run ci
      - name: Configure Pages
        uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy Pages artifact
        id: deployment
        uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5
```

- [ ] **Step 5: Verify workflow contracts and the complete local gate**

Run:

```bash
npm run format
npm test -- scripts/workflows.test.ts
npm run ci
```

Expected: both workflow tests pass and `npm run ci` exits 0. Review the workflow diff and confirm the upload path is exactly `./dist`, the deploy job depends on `build`, and only the deploy workflow receives `pages: write` and `id-token: write`.

- [ ] **Step 6: Commit the workflows**

```bash
git add .github/workflows scripts/workflows.test.ts
git commit -m "ci: add checks and Pages deployment"
```

---

### Task 5: Establish the public-repository release baseline

**Files:**
- Create: `scripts/repository-docs.test.ts`
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `docs/decisions/0004-mit-license.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all local commands and workflows produced by Tasks 1–4.
- Produces: a standard MIT grant, contributor setup using `npm run ci`, current project-status and deployment documentation, and a test that prevents those entry points from disappearing.

- [ ] **Step 1: Write the failing public-repository contract test**

Create `scripts/repository-docs.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readRepositoryFile(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

describe('public repository documentation', () => {
  it('contains the approved MIT grant', () => {
    const license = readRepositoryFile('LICENSE')

    expect(license).toMatch(/^MIT License/u)
    expect(license).toContain('Copyright (c) 2026 Deckwright contributors')
    expect(license).toContain('Permission is hereby granted, free of charge')
  })

  it('documents the reproducible contributor gate', () => {
    const contributing = readRepositoryFile('CONTRIBUTING.md')

    expect(contributing).toContain('npm ci')
    expect(contributing).toContain('npm run ci')
    expect(contributing).toContain('games/<game-id>/game.md')
  })

  it('documents local setup and GitHub Pages deployment', () => {
    const readme = readRepositoryFile('README.md')

    expect(readme).toContain('npm run dev')
    expect(readme).toContain('npm run ci')
    expect(readme).toContain('GitHub Pages')
  })
})
```

- [ ] **Step 2: Run the repository-document test and confirm the missing-license failure**

Run:

```bash
npm test -- scripts/repository-docs.test.ts
```

Expected: FAIL with `ENOENT` because `LICENSE` does not exist.

- [ ] **Step 3: Add the MIT License**

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 Deckwright contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Add contributor guidance**

Create `CONTRIBUTING.md`:

````markdown
# Contributing to Deckwright

Deckwright welcomes focused bug fixes, accessible interface improvements,
documentation, tests, and repository-hosted games.

## Development setup

Use Node.js 22 and npm 10 or newer:

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

## Pull requests

Describe the user-visible outcome, list the verification commands you ran, and
include print or narrow-screen evidence when the change affects layout. Do not
mix unrelated refactors into a feature or game contribution.
````

- [ ] **Step 5: Record the license decision**

Create `docs/decisions/0004-mit-license.md`:

```markdown
# 0004: Publish Deckwright under the MIT License

- Status: accepted
- Date: 2026-08-20

## Context

Deckwright is intended to be a public open-source application and to accept
community code and game contributions. The repository needs an explicit grant
before public release.

## Decision

Publish the code and repository-authored documentation under the MIT License,
with the copyright line `Deckwright contributors`. Contributions are accepted
under the same repository license.

## Alternatives considered

Apache-2.0 adds an explicit patent grant and more notice requirements. GPL and
AGPL licenses require downstream source-sharing under defined conditions. MIT
is selected for its short terms and low reuse friction for a browser tool.

## Consequences

People may use, modify, distribute, sublicense, and sell copies while retaining
the copyright and permission notice. Derivatives are not required to publish
their source. Third-party game text and artwork still require independently
compatible rights and attribution.
```

- [ ] **Step 6: Replace README status with executable setup and deployment guidance**

In `README.md`, keep the existing product direction and documentation links.
Replace the sentence saying application code has not been scaffolded with:

```markdown
The repository contains the tested static application and delivery foundation.
Card, game-definition, and session functionality is delivered in the next
increments.
```

Replace the `Project status` section, and add these sections verbatim:

````markdown
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
````

Replace the final README license warning with:

```markdown
## License

Deckwright is available under the [MIT License](LICENSE).
```

- [ ] **Step 7: Verify the public-repository baseline**

Run:

```bash
npm run format
npm test -- scripts/repository-docs.test.ts
npm run ci
git diff --check
```

Expected: three repository-document tests pass; the complete local CI command exits 0; `git diff --check` reports no errors.

- [ ] **Step 8: Commit the release baseline**

```bash
git add CONTRIBUTING.md LICENSE README.md docs/decisions/0004-mit-license.md scripts/repository-docs.test.ts
git commit -m "docs: establish contribution and license baseline"
```

---

## Final verification checkpoint

- [ ] Run the full clean-install verification from the repository root:

```bash
npm ci
npm run ci
git status --short
```

Expected: npm exits 0; linting, formatting, type-checking, all tests, the Vite production build, and static artifact verification pass; `git status --short` prints nothing.

- [ ] Inspect `dist/index.html` and confirm every local `src` and `href` URL is relative, there is one physical entry document, and no runtime network endpoint or third-party script is present.

- [ ] In GitHub repository settings, select **Settings → Pages → Build and deployment → Source: GitHub Actions**. This is the only manual hosting configuration step.

- [ ] After the branch is pushed, confirm the `CI` and `Deploy GitHub Pages` workflows pass and open the deployment URL reported by the `github-pages` environment. Verify the page loads at the repository subpath, reloads with `?game=card-mafia` without a 404, remains usable at 320 CSS pixels wide, shows visible keyboard focus, and prints without the header, footer, or status note.

## Follow-on planning boundaries

Write separate implementation plans, in order, for:

1. Content engine: standard and tarot decks, selectors, version 1 game parsing and validation, safe Markdown, catalog, and three example games.
2. Local tracker: sessions, configurable player fields, phase/round tracking, notes, and versioned local persistence.
3. Release hardening: session import/export, dedicated print states, responsive/accessibility verification, and release documentation.

Do not fold these domains into the foundation execution merely because the shell is ready for them.
