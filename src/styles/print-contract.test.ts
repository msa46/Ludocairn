import { describe, expect, it } from 'vitest'

import css from './global.css?raw'

const printStart = css.indexOf('@media print')
const printCss = printStart < 0 ? '' : css.slice(printStart)

describe('print stylesheet contract', () => {
  it('defines dedicated monochrome rules and tracker print modes', () => {
    expect(printCss).toContain('@media print')
    expect(printCss).toContain('.rules-print')
    expect(printCss).toContain('.tracker-print')
    expect(printCss).toMatch(/color:\s*#000/)
    expect(printCss).toMatch(/background:\s*#fff/)
  })

  it.each([
    '.print-hidden',
    'nav',
    '.editing-controls',
    '.save-status',
    '.destructive-controls',
  ])('hides %s chrome from printed documents', (selector) => {
    const selectorPosition = printCss.indexOf(selector)
    expect(selectorPosition).toBeGreaterThanOrEqual(0)
    const closingBrace = printCss.indexOf('}', selectorPosition)
    expect(printCss.slice(selectorPosition, closingBrace)).toMatch(
      /display:\s*none\s*!important/,
    )
  })

  it('keeps each player record together when practical', () => {
    expect(printCss).toMatch(/\.player-card\s*{[^}]*break-inside:\s*avoid/s)
  })

  it('keeps the role guide visible and avoids splitting its records', () => {
    const hiddenSelectors = printCss.match(
      /(?<selectors>[^{}]+)\{\s*display:\s*none\s*!important/s,
    )?.groups?.selectors

    expect(hiddenSelectors).not.toContain('.role-guide')
    expect(printCss).toMatch(
      /\.role-guide-card,\s*\.role-guide tr\s*{[^}]*break-inside:\s*avoid/s,
    )
  })
})

describe('narrow rules stylesheet contract', () => {
  it('contains wide rules tables without forcing document-level overflow', () => {
    const rulesPageRule = css.match(/\.rules-page\s*{(?<body>[^}]*)}/s)?.groups
      ?.body
    const proseRule = css.match(/\.prose\s*{(?<body>[^}]*)}/s)?.groups?.body

    expect(rulesPageRule).toMatch(/min-width:\s*0/)
    expect(proseRule).toMatch(/min-width:\s*0/)
    expect(proseRule).toMatch(/overflow-x:\s*auto/)
  })
})
