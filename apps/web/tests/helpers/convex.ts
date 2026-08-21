/**
 * Convex-test expects module identifiers relative to the Convex directory.
 * Vite returns paths relative to this helper, so normalize only that prefix.
 */
const discoveredModules = import.meta.glob('../../convex/**/*.ts')

export const convexModules = Object.fromEntries(
  Object.entries(discoveredModules).map(([path, loader]) => [path.replace('../../convex/', './'), loader]),
)
