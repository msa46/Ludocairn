import { describe, expect, it } from 'vitest'

import config from '../vite.config'

describe('Vitest configuration', () => {
  it('keeps tests in nested Git worktrees out of repository discovery', () => {
    const testConfig = (config as { test?: { exclude?: readonly string[] } })
      .test

    expect(testConfig?.exclude).toContain('**/.worktrees/**')
  })
})
