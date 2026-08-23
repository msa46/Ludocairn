import { useCallback, useMemo, useState } from 'react'

import { mergeGameCatalog } from '../games/manage'
import type { GameDefinition } from '../games/model'
import type { GameRepository } from '../storage/game-repository'

export function useGameStore(
  repository: GameRepository,
  bundledGames: readonly GameDefinition[],
) {
  const [revision, setRevision] = useState(0)
  const records = useMemo(() => {
    void revision
    return repository.list()
  }, [repository, revision])
  const catalog = useMemo(
    () => mergeGameCatalog(bundledGames, records),
    [bundledGames, records],
  )
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  return { ...catalog, records, refresh }
}
