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
      throw new Error(
        `Root-absolute asset URL is not GitHub Pages safe: ${url}`,
      )
    }

    const assetPath = resolve(dirname(indexPath), url.split(/[?#]/u, 1)[0])
    if (!existsSync(assetPath)) {
      throw new Error(`Referenced asset is missing: ${url}`)
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
