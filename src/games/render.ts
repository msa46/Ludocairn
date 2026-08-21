import DOMPurify from 'dompurify'
import { marked, Renderer } from 'marked'

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]

const renderer = new Renderer()
renderer.html = () => ''
renderer.image = () => ''

export function renderRules(markdown: string): string {
  const rendered = marked.parse(markdown, {
    async: false,
    gfm: true,
    renderer,
  })
  const sanitized = DOMPurify.sanitize(rendered, {
    ALLOWED_ATTR: ['href', 'rel', 'title'],
    ALLOWED_TAGS,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  })

  const template = document.createElement('template')
  template.innerHTML = sanitized
  for (const link of template.content.querySelectorAll('a[href]')) {
    link.setAttribute('rel', 'noreferrer noopener')
  }
  return template.innerHTML
}

