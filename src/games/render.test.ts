import { describe, expect, it } from 'vitest'

import { renderRules } from './render'

describe('renderRules', () => {
  it('renders the supported rules structures', () => {
    const html = renderRules(`# Safe rules

Use **clear** notes and *short* turns.

- First
- Second

| Phase | Action |
| --- | --- |
| Day | Discuss |
`)

    expect(html).toContain('<h1>Safe rules</h1>')
    expect(html).toContain('<strong>clear</strong>')
    expect(html).toContain('<em>short</em>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<table>')
  })

  it('removes raw HTML, images, and unsafe link protocols', () => {
    const html = renderRules(`# Safe

<script>alert('unsafe')</script>

<aside>raw block</aside>

![remote image](https://example.com/card.png)

[unsafe](javascript:alert('unsafe'))
`)

    expect(html).toContain('<h1>Safe</h1>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<aside')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
  })

  it('marks external links as non-opener and non-referrer', () => {
    const html = renderRules(
      '[Reference](https://example.com/rules "Reference rules")',
    )

    expect(html).toContain('href="https://example.com/rules"')
    expect(html).toContain('title="Reference rules"')
    expect(html).toContain('rel="noreferrer noopener"')
  })
})
