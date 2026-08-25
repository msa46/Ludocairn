import { describe, expect, it } from 'vitest'

import css from './global.css?raw'

describe('rules document layout contracts', () => {
  it('keeps the role sheet and rules in one centered editorial column', () => {
    const rulesPageRule = css.match(/\.rules-page\s*{(?<body>[^}]*)}/s)?.groups
      ?.body
    const directDocumentsRule = css.match(
      /\.rules-page\s*>\s*\.role-guide,\s*\.rules-page\s*>\s*\.rules-print\s*{(?<body>[^}]*)}/s,
    )?.groups?.body

    expect(rulesPageRule).toMatch(/width:\s*min\(100%,\s*68rem\)/)
    expect(rulesPageRule).toMatch(/margin-inline:\s*auto/)
    expect(directDocumentsRule).toMatch(/width:\s*100%/)
    expect(directDocumentsRule).toMatch(/max-width:\s*none/)
  })

  it('gives rule sections a consistent editorial rhythm', () => {
    expect(css).toMatch(/\.rules-print\s*{[^}]*counter-reset:\s*rule-section/s)
    expect(css).toMatch(
      /\.rules-print\s*>\s*h2\s*{[^}]*counter-increment:\s*rule-section/s,
    )
    expect(css).toMatch(/\.rules-print\s*>\s*h2::before\s*{/)
  })

  it('contains wide tables without making the whole rulebook pan sideways', () => {
    const tableRule = css.match(/\.prose table\s*{(?<body>[^}]*)}/s)?.groups
      ?.body

    expect(tableRule).toMatch(/display:\s*block/)
    expect(tableRule).toMatch(/max-width:\s*100%/)
    expect(tableRule).toMatch(/overflow-x:\s*auto/)
  })

  it('protects headings and structured blocks from awkward print breaks', () => {
    const printCss = css.slice(css.indexOf('@media print'))

    expect(printCss).toMatch(
      /\.rules-print\s+h1,\s*\.rules-print\s+h2,\s*\.rules-print\s+h3\s*{[^}]*break-after:\s*avoid/s,
    )
    expect(printCss).toMatch(
      /\.rules-print\s+table,\s*\.rules-print\s+ul,\s*\.rules-print\s+ol\s*{[^}]*break-inside:\s*avoid/s,
    )
  })

  it('keeps table headings legible when printers omit backgrounds', () => {
    const printCss = css.slice(css.indexOf('@media print'))
    const tableHeadingRule = printCss.match(
      /\.role-guide caption,\s*\.rules-print thead th\s*{(?<body>[^}]*)}/s,
    )?.groups?.body

    expect(tableHeadingRule).toMatch(/background:\s*#fff/)
    expect(tableHeadingRule).toMatch(/color:\s*#000/)
  })
})
