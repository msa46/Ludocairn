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
  newline: '\n',
  period: '.',
  quot: '"',
  sol: '/',
  tab: '\t',
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
  const assets = []
  const assetTags = html.matchAll(
    /<(script|link)(?=[\t\n\f\r />])(?:(?:"[^"]*"|'[^']*'|[^'"<>])*)>/giu,
  )

  for (const tag of assetTags) {
    const tagName = tag[1].toLowerCase()
    const attributeName = tagName === 'script' ? 'src' : 'href'
    const attributeValue = extractTagAttribute(
      tag[0],
      tag[1].length + 1,
      attributeName,
    )

    if (attributeValue !== undefined) {
      assets.push({
        tagName,
        url: attributeValue,
        rel:
          tagName === 'link'
            ? extractTagAttribute(tag[0], tag[1].length + 1, 'rel')
            : undefined,
      })
    }
  }

  return assets
}

function extractLinks(html) {
  const links = []
  const linkTags = html.matchAll(
    /<link(?=[\t\n\f\r />])(?:(?:"[^"]*"|'[^']*'|[^'"<>])*)>/giu,
  )

  for (const linkTag of linkTags) {
    links.push({
      href: extractTagAttribute(linkTag[0], 'link'.length + 1, 'href'),
      rel: extractTagAttribute(linkTag[0], 'link'.length + 1, 'rel'),
    })
  }

  return links
}

function extractDocumentBaseUrl(html) {
  const baseTags = html.matchAll(/<base\b(?:(?:"[^"]*"|'[^']*'|[^'"<>])*)>/giu)

  for (const baseTag of baseTags) {
    const url = extractTagAttribute(baseTag[0], 'base'.length + 1, 'href')
    if (url !== undefined) return url
  }

  return undefined
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
    /&#(?:(\d+)|x([\da-f]+));?|&(amp|apos|bsol|colon|gt|lt|newline|period|quot|sol|tab);/giu,
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

const localFileContexts = {
  appleTouchIcon: {
    urlLabel: 'Apple touch icon',
    remoteLabel: 'Apple touch icon',
    referenceLabel: 'Apple touch icon',
  },
  entryAsset: {
    urlLabel: 'asset',
    remoteLabel: 'runtime asset',
    referenceLabel: 'asset',
  },
  precacheAsset: {
    urlLabel: 'precache asset',
    remoteLabel: 'precache asset',
    referenceLabel: 'precache asset',
  },
  manifest: {
    urlLabel: 'manifest',
    remoteLabel: 'manifest',
    referenceLabel: 'manifest',
  },
  manifestIcon: {
    urlLabel: 'manifest icon',
    remoteLabel: 'manifest icon',
    referenceLabel: 'manifest icon',
  },
  serviceWorker: {
    urlLabel: 'service worker',
    remoteLabel: 'service worker',
    referenceLabel: 'service worker',
  },
  serviceWorkerDependency: {
    urlLabel: 'service worker dependency',
    remoteLabel: 'service worker dependency',
    referenceLabel: 'service worker dependency',
  },
}

const requiredManifestMembers = {
  name: 'Ludocairn',
  short_name: 'Ludocairn',
  description:
    'Define, run, track, and print tabletop card games with Ludocairn.',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  theme_color: '#25211f',
  background_color: '#f7f1e7',
}

function displayUrl(url) {
  return url || '(empty)'
}

function decodeHtmlUrlAttribute(value, context) {
  const decodedValue = decodeHtmlEntities(value)
  if (/&[a-z][\da-z]+;/iu.test(decodedValue)) {
    throw new Error(
      `Invalid local ${context.urlLabel} URL: ${displayUrl(value)}`,
    )
  }

  return decodedValue
}

function hasRelToken(value, wantedToken) {
  if (value === undefined) return false

  return decodeHtmlEntities(value)
    .toLowerCase()
    .split(/[\t\n\f\r ]+/u)
    .filter(Boolean)
    .includes(wantedToken)
}

function resolveLocalFile(
  artifactDirectory,
  realArtifactDirectory,
  rawUrl,
  context,
  { baseUrl = syntheticEntryUrl, htmlEncoded = false } = {},
) {
  const sourceUrl = rawUrl ?? ''
  const browserUrl = (
    htmlEncoded ? decodeHtmlUrlAttribute(sourceUrl, context) : sourceUrl
  ).trim()

  if (browserUrl === '' || /^[?#]/u.test(browserUrl)) {
    throw new Error(
      `Invalid local ${context.urlLabel} URL: ${displayUrl(sourceUrl)}`,
    )
  }

  if (/^https?:/iu.test(browserUrl) || browserUrl.startsWith('//')) {
    throw new Error(
      `Remote ${context.remoteLabel} URL is not allowed: ${sourceUrl}`,
    )
  }

  if (browserUrl.startsWith('/')) {
    throw new Error(
      `Root-absolute ${context.urlLabel} URL is not GitHub Pages safe: ${sourceUrl}`,
    )
  }

  let resolvedUrl
  try {
    resolvedUrl = new URL(browserUrl, baseUrl)
  } catch {
    throw new Error(
      `Invalid local ${context.urlLabel} URL: ${displayUrl(sourceUrl)}`,
    )
  }

  if (
    resolvedUrl.origin !== syntheticEntryUrl.origin &&
    (resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:')
  ) {
    throw new Error(
      `Remote ${context.remoteLabel} URL is not allowed: ${sourceUrl}`,
    )
  }

  if (
    resolvedUrl.origin !== syntheticEntryUrl.origin ||
    !resolvedUrl.pathname.startsWith(syntheticRepositoryBase.pathname)
  ) {
    throw new Error(
      `Referenced ${context.referenceLabel} resolves outside the static artifact: ${sourceUrl}`,
    )
  }

  let browserPathname
  try {
    browserPathname = decodeURIComponent(resolvedUrl.pathname)
  } catch {
    throw new Error(
      `Invalid local ${context.urlLabel} URL: ${displayUrl(sourceUrl)}`,
    )
  }

  if (!browserPathname.startsWith(syntheticRepositoryBase.pathname)) {
    throw new Error(
      `Referenced ${context.referenceLabel} resolves outside the static artifact: ${sourceUrl}`,
    )
  }

  const repositoryRelativePath = browserPathname.slice(
    syntheticRepositoryBase.pathname.length,
  )
  const filePath = resolve(artifactDirectory, repositoryRelativePath)
  if (!isWithinDirectory(artifactDirectory, filePath)) {
    throw new Error(
      `Referenced ${context.referenceLabel} resolves outside the static artifact: ${sourceUrl}`,
    )
  }

  if (!existsSync(filePath)) {
    throw new Error(
      `Referenced ${context.referenceLabel} is missing: ${sourceUrl}`,
    )
  }

  if (!statSync(filePath).isFile()) {
    throw new Error(
      `Referenced ${context.referenceLabel} is not a file: ${sourceUrl}`,
    )
  }

  if (!isWithinDirectory(realArtifactDirectory, realpathSync(filePath))) {
    throw new Error(
      `Referenced ${context.referenceLabel} resolves outside the static artifact: ${sourceUrl}`,
    )
  }

  return { browserPathname, filePath, resolvedUrl }
}

function parseManifest(manifestUrl, manifestPath) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    throw new Error(`Manifest is not valid JSON: ${manifestUrl}`)
  }

  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest)
  ) {
    throw new Error('Manifest must be a JSON object.')
  }

  return manifest
}

function validateManifestMembers(manifest) {
  for (const [member, expectedValue] of Object.entries(
    requiredManifestMembers,
  )) {
    if (manifest[member] !== expectedValue) {
      throw new Error(
        `Manifest member "${member}" must be ${JSON.stringify(expectedValue)}.`,
      )
    }
  }

  if (!Array.isArray(manifest.icons)) {
    throw new Error('Manifest member "icons" must be an array.')
  }
}

function parseTokenList(value) {
  return value
    .trim()
    .split(/[\t\n\f\r ]+/u)
    .filter(Boolean)
}

function isValidIconSizeToken(size) {
  if (size === 'any') return true

  const dimensions = size.match(/^(\d+)x(\d+)$/u)
  return (
    dimensions !== null &&
    BigInt(dimensions[1]) > 0n &&
    BigInt(dimensions[2]) > 0n
  )
}

function validateManifestIcons(
  manifest,
  artifactDirectory,
  realArtifactDirectory,
  manifestBaseUrl,
) {
  let has192Icon = false
  let has512Icon = false
  let hasMaskableIcon = false

  for (const [index, icon] of manifest.icons.entries()) {
    if (icon === null || typeof icon !== 'object' || Array.isArray(icon)) {
      throw new Error(`Manifest icon ${index + 1} must be a JSON object.`)
    }

    for (const member of ['src', 'sizes', 'type', 'purpose']) {
      if (typeof icon[member] !== 'string' || icon[member].trim() === '') {
        throw new Error(
          `Manifest icon ${index + 1} member "${member}" must be a non-empty string.`,
        )
      }
    }

    if (icon.type.toLowerCase() !== 'image/png') {
      throw new Error(
        `Manifest icon ${index + 1} member "type" must be "image/png".`,
      )
    }

    const sizes = parseTokenList(icon.sizes)
    if (
      sizes.length === 0 ||
      sizes.some((size) => !isValidIconSizeToken(size))
    ) {
      throw new Error(
        `Manifest icon ${index + 1} member "sizes" is not a valid size token list.`,
      )
    }

    const purposes = parseTokenList(icon.purpose).filter(
      (purpose) =>
        purpose === 'any' || purpose === 'maskable' || purpose === 'monochrome',
    )

    resolveLocalFile(
      artifactDirectory,
      realArtifactDirectory,
      icon.src,
      localFileContexts.manifestIcon,
      { baseUrl: manifestBaseUrl },
    )

    const isPng = icon.type.toLowerCase() === 'image/png'
    has192Icon ||=
      isPng && sizes.includes('192x192') && purposes.includes('any')
    has512Icon ||=
      isPng && sizes.includes('512x512') && purposes.includes('any')
    hasMaskableIcon ||=
      isPng && sizes.includes('512x512') && purposes.includes('maskable')
  }

  if (!has192Icon) {
    throw new Error('Manifest must include a 192x192 any-purpose PNG icon.')
  }

  if (!has512Icon) {
    throw new Error('Manifest must include a 512x512 any-purpose PNG icon.')
  }

  if (!hasMaskableIcon) {
    throw new Error('Manifest must include a maskable 512x512 PNG icon.')
  }
}

function decodeJavaScriptString(source, start, quote) {
  let cursor = start + 1
  let value = ''

  while (cursor < source.length) {
    const character = source[cursor]
    if (character === quote) {
      return {
        cursor: cursor + 1,
        raw: source.slice(start + 1, cursor),
        value,
      }
    }

    if (character !== '\\') {
      value += character
      cursor += 1
      continue
    }

    cursor += 1
    if (cursor >= source.length) break
    const escaped = source[cursor]
    const simpleEscapes = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
    }

    if (escaped in simpleEscapes) {
      value += simpleEscapes[escaped]
      cursor += 1
      continue
    }

    if (escaped === '\n' || escaped === '\r') {
      cursor += escaped === '\r' && source[cursor + 1] === '\n' ? 2 : 1
      continue
    }

    if (/^[0-7]$/u.test(escaped)) {
      const maximumLength = /^[0-3]$/u.test(escaped) ? 3 : 2
      const octal = source
        .slice(cursor, cursor + maximumLength)
        .match(/^[0-7]+/u)[0]
      value += String.fromCodePoint(Number.parseInt(octal, 8))
      cursor += octal.length
      continue
    }

    if (
      escaped === 'x' &&
      /^[\da-f]{2}$/iu.test(source.slice(cursor + 1, cursor + 3))
    ) {
      value += String.fromCodePoint(
        Number.parseInt(source.slice(cursor + 1, cursor + 3), 16),
      )
      cursor += 3
      continue
    }

    if (escaped === 'u') {
      const bracedMatch = source.slice(cursor + 1).match(/^\{([\da-f]+)\}/iu)
      const fixedMatch = source.slice(cursor + 1).match(/^[\da-f]{4}/iu)
      const hexadecimal = bracedMatch?.[1] ?? fixedMatch?.[0]

      if (hexadecimal !== undefined) {
        const codePoint = Number.parseInt(hexadecimal, 16)
        if (codePoint <= 0x10ffff) {
          value += String.fromCodePoint(codePoint)
          cursor += bracedMatch
            ? bracedMatch[0].length + 1
            : fixedMatch[0].length + 1
          continue
        }
      }
    }

    value += escaped
    cursor += 1
  }

  return { cursor, raw: source.slice(start + 1, cursor), value }
}

function isEscapedCharacter(source, index) {
  let backslashCount = 0
  for (
    let cursor = index - 1;
    cursor >= 0 && source[cursor] === '\\';
    cursor -= 1
  ) {
    backslashCount += 1
  }

  return backslashCount % 2 === 1
}

function tokenizeTemplateExpressions(templateSource) {
  const tokens = []
  let cursor = 0

  while (cursor < templateSource.length) {
    const expressionMarker = templateSource.indexOf('${', cursor)
    if (expressionMarker === -1) break
    if (isEscapedCharacter(templateSource, expressionMarker)) {
      cursor = expressionMarker + 2
      continue
    }

    const expressionStart = expressionMarker + 2
    const expressionEnd = templateSource.indexOf('}', expressionStart)
    if (expressionEnd === -1) break

    tokens.push(
      ...tokenizeJavaScript(
        templateSource.slice(expressionStart, expressionEnd),
      ),
    )
    cursor = expressionEnd + 1
  }

  return tokens
}

function tokenizeJavaScript(source) {
  const tokens = []
  let cursor = 0

  while (cursor < source.length) {
    if (/\s/u.test(source[cursor])) {
      cursor += 1
      continue
    }

    if (source.startsWith('//', cursor)) {
      const lineEnd = source.indexOf('\n', cursor + 2)
      cursor = lineEnd === -1 ? source.length : lineEnd + 1
      continue
    }

    if (source.startsWith('/*', cursor)) {
      const commentEnd = source.indexOf('*/', cursor + 2)
      cursor = commentEnd === -1 ? source.length : commentEnd + 2
      continue
    }

    const character = source[cursor]
    if (character === '"' || character === "'" || character === '`') {
      const stringToken = decodeJavaScriptString(source, cursor, character)
      tokens.push({
        type: 'string',
        value: stringToken.value,
        raw: stringToken.raw,
      })
      if (character === '`') {
        tokens.push(...tokenizeTemplateExpressions(stringToken.raw))
      }
      cursor = stringToken.cursor
      continue
    }

    if (/[$\p{ID_Start}_]/u.test(character)) {
      const identifierStart = cursor
      cursor += 1
      while (
        cursor < source.length &&
        /[$\p{ID_Continue}\u200c\u200d]/u.test(source[cursor])
      ) {
        cursor += 1
      }
      tokens.push({
        type: 'identifier',
        value: source.slice(identifierStart, cursor),
      })
      continue
    }

    tokens.push({ type: 'punctuator', value: character })
    cursor += 1
  }

  return tokens
}

function normalizedRuntimeUrl(value) {
  return value
    .replace(/[\t\n\r]/gu, '')
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/gu, '')
    .trim()
}

function findRemoteWorkerString(tokens) {
  for (const token of tokens) {
    if (token.type !== 'string') continue

    const values = [token.value]
    try {
      values.push(decodeURIComponent(token.value))
    } catch {
      // A malformed percent escape is not a remotely resolved URL.
    }

    if (
      values.some((value) => {
        const normalized = normalizedRuntimeUrl(value)
        return /^https?:/iu.test(normalized) || normalized.startsWith('//')
      })
    ) {
      return token.raw
    }
  }

  return undefined
}

function isIndexPrecacheUrl(value) {
  let resolvedUrl
  try {
    resolvedUrl = new URL(value, syntheticEntryUrl)
  } catch {
    return false
  }

  if (
    resolvedUrl.origin !== syntheticEntryUrl.origin ||
    resolvedUrl.search !== '' ||
    resolvedUrl.hash !== ''
  ) {
    return false
  }

  try {
    return (
      decodeURIComponent(resolvedUrl.pathname) ===
      `${syntheticRepositoryBase.pathname}index.html`
    )
  } catch {
    return false
  }
}

function findClosingToken(tokens, start, openingToken, closingToken) {
  let depth = 0

  for (let cursor = start; cursor < tokens.length; cursor += 1) {
    if (tokens[cursor].value === openingToken) depth += 1
    if (tokens[cursor].value === closingToken) depth -= 1
    if (depth === 0) return cursor
  }

  return undefined
}

function extractPrecacheUrls(tokens) {
  const urls = []
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (
      tokens[index].type !== 'identifier' ||
      tokens[index].value !== 'precacheAndRoute' ||
      tokens[index + 1].value !== '('
    ) {
      continue
    }

    const callEnd = findClosingToken(tokens, index + 1, '(', ')')
    const precacheArrayStart = index + 2
    if (callEnd === undefined || tokens[precacheArrayStart]?.value !== '[') {
      continue
    }

    const precacheArrayEnd = findClosingToken(
      tokens,
      precacheArrayStart,
      '[',
      ']',
    )
    if (precacheArrayEnd === undefined || precacheArrayEnd > callEnd) {
      continue
    }

    let nestedArrayDepth = 0
    let objectDepth = 0
    for (
      let cursor = precacheArrayStart + 1;
      cursor < precacheArrayEnd;
      cursor += 1
    ) {
      const property = tokens[cursor]
      if (property.value === '[') {
        nestedArrayDepth += 1
        continue
      }
      if (property.value === ']') {
        nestedArrayDepth -= 1
        continue
      }
      if (property.value === '{') {
        objectDepth += 1
        continue
      }
      if (property.value === '}') {
        objectDepth -= 1
        continue
      }

      if (
        nestedArrayDepth === 0 &&
        objectDepth === 1 &&
        (property.type === 'identifier' || property.type === 'string') &&
        property.value === 'url' &&
        tokens[cursor + 1]?.value === ':' &&
        tokens[cursor + 2]?.type === 'string'
      ) {
        urls.push(tokens[cursor + 2].value)
      }
    }
  }

  return urls
}

function extractWorkerDependencies(tokens) {
  const dependencies = []

  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (
      tokens[index]?.type === 'identifier' &&
      tokens[index].value === 'importScripts' &&
      tokens[index + 1]?.value === '('
    ) {
      const callEnd = findClosingToken(tokens, index + 1, '(', ')')
      if (callEnd === undefined) continue
      for (let cursor = index + 2; cursor < callEnd; cursor += 1) {
        if (tokens[cursor]?.type === 'string') {
          dependencies.push({ url: tokens[cursor].value, appendJs: false })
        }
      }
    }

    if (
      tokens[index]?.type === 'identifier' &&
      tokens[index].value === 'define' &&
      tokens[index + 1]?.value === '(' &&
      tokens[index + 2]?.value === '['
    ) {
      const arrayEnd = findClosingToken(tokens, index + 2, '[', ']')
      if (arrayEnd === undefined) continue
      for (let cursor = index + 3; cursor < arrayEnd; cursor += 1) {
        if (tokens[cursor]?.type === 'string') {
          dependencies.push({ url: tokens[cursor].value, appendJs: true })
        }
      }
    }
  }

  return dependencies
}

export function verifyStaticBuild(distDirectory) {
  const artifactDirectory = resolve(distDirectory)
  const indexPath = resolve(artifactDirectory, 'index.html')

  if (!existsSync(indexPath)) {
    throw new Error(`Static entry document is missing: ${indexPath}`)
  }

  const realArtifactDirectory = realpathSync(artifactDirectory)
  if (!statSync(indexPath).isFile()) {
    throw new Error('Static entry document is not a file.')
  }
  if (!isWithinDirectory(realArtifactDirectory, realpathSync(indexPath))) {
    throw new Error(
      'Static entry document resolves outside the static artifact.',
    )
  }
  const html = readFileSync(indexPath, 'utf8')
  if (!html.includes('Ludocairn')) {
    throw new Error(
      'Static entry document does not contain the Ludocairn identity.',
    )
  }

  const documentBaseUrl = extractDocumentBaseUrl(html)
  if (documentBaseUrl !== undefined) {
    throw new Error(
      `Document base URL is not allowed: ${documentBaseUrl || '(empty)'}`,
    )
  }

  const assets = extractAssetUrls(html)
  const entryAssets = []
  let hasRelativeJavaScriptAsset = false
  let hasRelativeCssAsset = false

  for (const { tagName, url, rel } of assets) {
    if (
      tagName === 'link' &&
      (hasRelToken(rel, 'manifest') || hasRelToken(rel, 'apple-touch-icon'))
    ) {
      continue
    }

    const { browserPathname } = resolveLocalFile(
      artifactDirectory,
      realArtifactDirectory,
      url,
      localFileContexts.entryAsset,
      { htmlEncoded: true },
    )

    hasRelativeJavaScriptAsset ||=
      tagName === 'script' && /\.m?js$/iu.test(browserPathname)
    hasRelativeCssAsset ||=
      tagName === 'link' && /\.css$/iu.test(browserPathname)
    entryAssets.push(url)
  }

  if (!hasRelativeJavaScriptAsset) {
    throw new Error(
      'Static entry document does not reference a relative JavaScript asset.',
    )
  }

  if (!hasRelativeCssAsset) {
    throw new Error(
      'Static entry document does not reference a relative CSS asset.',
    )
  }

  const links = extractLinks(html)
  const manifestLinks = links.filter(({ rel }) => hasRelToken(rel, 'manifest'))
  if (manifestLinks.length !== 1) {
    throw new Error(
      'Static entry document must contain exactly one manifest link.',
    )
  }

  const manifestUrl = manifestLinks[0].href ?? ''
  const manifestFile = resolveLocalFile(
    artifactDirectory,
    realArtifactDirectory,
    manifestUrl,
    localFileContexts.manifest,
    { htmlEncoded: true },
  )
  const manifest = parseManifest(manifestUrl, manifestFile.filePath)
  validateManifestMembers(manifest)
  validateManifestIcons(
    manifest,
    artifactDirectory,
    realArtifactDirectory,
    manifestFile.resolvedUrl,
  )

  const appleTouchIconLinks = links.filter(({ rel }) =>
    hasRelToken(rel, 'apple-touch-icon'),
  )
  if (appleTouchIconLinks.length !== 1) {
    throw new Error(
      'Static entry document must contain exactly one Apple touch icon link.',
    )
  }

  resolveLocalFile(
    artifactDirectory,
    realArtifactDirectory,
    appleTouchIconLinks[0].href ?? '',
    localFileContexts.appleTouchIcon,
    { htmlEncoded: true },
  )

  const serviceWorker = 'sw.js'
  const serviceWorkerFile = resolveLocalFile(
    artifactDirectory,
    realArtifactDirectory,
    serviceWorker,
    localFileContexts.serviceWorker,
  )
  const workerSource = readFileSync(serviceWorkerFile.filePath, 'utf8')
  const workerTokens = tokenizeJavaScript(workerSource)
  const remoteWorkerUrl = findRemoteWorkerString(workerTokens)
  if (remoteWorkerUrl !== undefined) {
    throw new Error(
      `Remote runtime asset URL is not allowed in service worker: ${remoteWorkerUrl}`,
    )
  }

  for (const dependency of extractWorkerDependencies(workerTokens)) {
    const dependencyUrl =
      dependency.appendJs && !/\.[^/]+$/u.test(dependency.url)
        ? `${dependency.url}.js`
        : dependency.url
    try {
      resolveLocalFile(
        artifactDirectory,
        realArtifactDirectory,
        dependencyUrl,
        localFileContexts.serviceWorkerDependency,
        { baseUrl: serviceWorkerFile.resolvedUrl },
      )
    } catch (error) {
      if (
        dependencyUrl !== dependency.url &&
        error instanceof Error &&
        error.message.includes(`: ${dependencyUrl}`)
      ) {
        throw new Error(error.message.replace(dependencyUrl, dependency.url))
      }
      throw error
    }
  }

  const precacheUrls = extractPrecacheUrls(workerTokens)
  for (const precacheUrl of precacheUrls) {
    const normalizedPrecacheUrl = precacheUrl.replaceAll('\\', '/')
    if (normalizedPrecacheUrl.startsWith('//')) {
      throw new Error(
        `Remote precache asset URL is not allowed: ${precacheUrl}`,
      )
    }
    resolveLocalFile(
      artifactDirectory,
      realArtifactDirectory,
      normalizedPrecacheUrl,
      localFileContexts.precacheAsset,
    )
  }

  const precachedShell = precacheUrls.some(isIndexPrecacheUrl)
  if (!precachedShell) {
    throw new Error('Service worker does not precache index.html.')
  }

  return {
    entryAssets,
    manifest: manifestUrl,
    serviceWorker,
    precachedShell,
  }
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
    const verification = verifyStaticBuild(distDirectory)
    console.log(
      `Verified PWA entry, manifest, service worker, and ${verification.entryAssets.length} local entry assets.`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
