import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('nested worktree isolation', () => {
  it('keeps nested Git worktrees out of recursive repository tools', async () => {
    const { default: eslintConfig } = (await import(
      pathToFileURL(resolve('eslint.config.js')).href
    )) as { default: readonly { ignores?: readonly string[] }[] }
    const { default: viteConfig } = (await import(
      pathToFileURL(resolve('vite.config.ts')).href
    )) as { default: { test?: { exclude?: readonly string[] } } }
    const testConfig = viteConfig.test
    const lintExcludes = eslintConfig.flatMap((config) => config.ignores ?? [])
    const formatExcludes = readFileSync('.prettierignore', 'utf8').split(
      /\r?\n/u,
    )

    expect(testConfig?.exclude).toContain('**/.worktrees/**')
    expect(lintExcludes).toContain('**/.worktrees/**')
    expect(formatExcludes).toContain('.worktrees/')
  })
})
