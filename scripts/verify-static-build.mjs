import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const syntheticRepositoryBase = new URL(
  'https://deckwright.invalid/repository/',
)
const syntheticEntryUrl = new URL('index.html', syntheticRepositoryBase)

const namedHtmlEntities = {
  amp: '&',
  apos: "'",
  bsol: '\\',
  colon: ':',
  gt: '>',
  lt: '<',
  period: '.',
  quot: '"',
  sol: '/',
}

function isWithinDirectory(directory, targetPath) {
  const pathFromDirectory = relative(directory, targetPath)

  return (
    pathFromDirectory === '' ||
    (!pathFromDirectory.startsWith(`..${sep}`) &&
      pathFromDirectory !== '..' &&
      !isAbsolute(pathFromDirectory))
  )
}

function extractAssetUrls(html) {
  const urls = []
  const assetTags = html.matchAll(
    /<(script|link)\b(?:(?:"[^"]*"|'[^']*'|[^'"<>])*)>/giu,
  )

  for (const tag of assetTags) {
    const attributeName = tag[1].toLowerCase() === 'script' ? 'src' : 'href'
    const attributeValue = extractTagAttribute(
      tag[0],
      tag[1].length + 1,
      attributeName,
    )

    if (attributeValue !== undefined) {
      urls.push(attributeValue)
    }
  }

  return urls
}

function extractTagAttribute(tag, start, wantedName) {
  let cursor = start

  while (cursor < tag.length - 1) {
    while (/\s|\//u.test(tag[cursor])) {
      cursor += 1
    }

    const nameStart = cursor
    while (!/[\s=/>]/u.test(tag[cursor])) {
      cursor += 1
    }

    const name = tag.slice(nameStart, cursor).toLowerCase()
    while (/\s/u.test(tag[cursor])) {
      cursor += 1
    }

    if (tag[cursor] !== '=') {
      if (name === wantedName) {
        return ''
      }
      continue
    }

    cursor += 1
    while (/\s/u.test(tag[cursor])) {
      cursor += 1
    }

    const quote = tag[cursor]
    let value
    if (quote === '"' || quote === "'") {
      cursor += 1
      const valueStart = cursor
      while (cursor < tag.length - 1 && tag[cursor] !== quote) {
        cursor += 1
      }
      value = tag.slice(valueStart, cursor)
      cursor += 1
    } else {
      const valueStart = cursor
      while (!/[\s>]/u.test(tag[cursor])) {
        cursor += 1
      }
      value = tag.slice(valueStart, cursor)
    }

    if (name === wantedName) {
      return value
    }
  }

  return undefined
}

function decodeHtmlEntities(value) {
  return value.replace(
    /&#(?:(\d+)|x([\da-f]+));?|&(amp|apos|bsol|colon|gt|lt|period|quot|sol);/giu,
    (entity, decimal, hexadecimal, named) => {
      if (named) {
        return namedHtmlEntities[named.toLowerCase()]
      }

      const codePoint = Number.parseInt(
        decimal ?? hexadecimal,
        decimal ? 10 : 16,
      )
      if (
        codePoint === 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return '\uFFFD'
      }

      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    },
  )
}

function invalidAssetUrl(url) {
  return new Error(`Invalid local asset URL: ${url || '(empty)'}`)
}

export function verifyStaticBuild(distDirectory) {
  const artifactDirectory = resolve(distDirectory)
  const indexPath = resolve(artifactDirectory, 'index.html')

  if (!existsSync(indexPath)) {
    throw new Error(`Static entry document is missing: ${indexPath}`)
  }

  const realArtifactDirectory = realpathSync(artifactDirectory)
  const html = readFileSync(indexPath, 'utf8')
  const assetUrls = extractAssetUrls(html)
  const localUrls = []

  for (const url of assetUrls) {
    const browserUrl = decodeHtmlEntities(url).trim()
    if (browserUrl === '' || /^[?#]/u.test(browserUrl)) {
      throw invalidAssetUrl(url)
    }

    if (browserUrl.startsWith('/')) {
      throw new Error(
        `Root-absolute asset URL is not GitHub Pages safe: ${url}`,
      )
    }

    let resolvedUrl
    try {
      resolvedUrl = new URL(browserUrl, syntheticEntryUrl)
    } catch {
      throw invalidAssetUrl(url)
    }

    if (resolvedUrl.origin !== syntheticEntryUrl.origin) {
      continue
    }

    if (!resolvedUrl.pathname.startsWith(syntheticRepositoryBase.pathname)) {
      throw new Error(
        `Referenced asset resolves outside the static artifact: ${url}`,
      )
    }

    let browserPathname
    try {
      browserPathname = decodeURIComponent(resolvedUrl.pathname)
    } catch {
      throw invalidAssetUrl(url)
    }

    if (!browserPathname.startsWith(syntheticRepositoryBase.pathname)) {
      throw new Error(
        `Referenced asset resolves outside the static artifact: ${url}`,
      )
    }

    const repositoryRelativePath = browserPathname.slice(
      syntheticRepositoryBase.pathname.length,
    )
    const assetPath = resolve(artifactDirectory, repositoryRelativePath)
    if (!isWithinDirectory(artifactDirectory, assetPath)) {
      throw new Error(
        `Referenced asset resolves outside the static artifact: ${url}`,
      )
    }

    if (!existsSync(assetPath)) {
      throw new Error(`Referenced asset is missing: ${url}`)
    }

    if (!statSync(assetPath).isFile()) {
      throw new Error(`Referenced asset is not a file: ${url}`)
    }

    if (!isWithinDirectory(realArtifactDirectory, realpathSync(assetPath))) {
      throw new Error(
        `Referenced asset resolves outside the static artifact: ${url}`,
      )
    }

    localUrls.push(url)
  }

  return localUrls
}

const invokedPath =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href

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
