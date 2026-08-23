import { describe, expect, it } from 'vitest'

import css from './global.css?raw'

describe('Game Studio layout contracts', () => {
  it('keeps the Studio single-column by default and splits editor/preview only on wide screens', () => {
    expect(css).toMatch(
      /\.game-studio-workbench\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    )
    expect(css).toMatch(
      /@media\s*\(min-width:\s*64rem\)[\s\S]*\.game-studio-workbench\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/s,
    )
  })

  it('hides authoring controls from printed rules', () => {
    const printCss = css.slice(css.indexOf('@media print'))
    expect(printCss).toMatch(/\.game-studio[^}]*display:\s*none\s*!important/s)
  })
})
