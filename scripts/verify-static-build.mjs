import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function isWithinDirectory(directory, targetPath) {
  const pathFromDirectory = relative(directory, targetPath)

  return (
    pathFromDirectory === '' ||
    (!pathFromDirectory.startsWith(`..${sep}`) &&
      pathFromDirectory !== '..' &&
      !isAbsolute(pathFromDirectory))
  )
}

export function verifyStaticBuild(distDirectory) {
  const artifactDirectory = resolve(distDirectory)
  const indexPath = resolve(artifactDirectory, 'index.html')

  if (!existsSync(indexPath)) {
    throw new Error(`Static entry document is missing: ${indexPath}`)
  }

  const realArtifactDirectory = realpathSync(artifactDirectory)
  const html = readFileSync(indexPath, 'utf8')
  const localUrls = [
    ...html.matchAll(
      /(?<![\w:-])(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/giu,
    ),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((url) => !/^(?:https?:|data:|#)/u.test(url))

  for (const url of localUrls) {
    if (url.startsWith('/')) {
      throw new Error(
        `Root-absolute asset URL is not GitHub Pages safe: ${url}`,
      )
    }

    const assetPath = resolve(artifactDirectory, url.split(/[?#]/u, 1)[0])
    if (!isWithinDirectory(artifactDirectory, assetPath)) {
      throw new Error(
        `Referenced asset resolves outside the static artifact: ${url}`,
      )
    }

    if (!existsSync(assetPath)) {
      throw new Error(`Referenced asset is missing: ${url}`)
    }

    if (!isWithinDirectory(realArtifactDirectory, realpathSync(assetPath))) {
      throw new Error(
        `Referenced asset resolves outside the static artifact: ${url}`,
      )
    }
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
