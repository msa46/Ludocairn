export interface StaticBuildVerification {
  readonly entryAssets: readonly string[]
  readonly manifest: string
  readonly serviceWorker: string
  readonly precachedShell: boolean
}

export function verifyStaticBuild(
  distDirectory: string,
): StaticBuildVerification
