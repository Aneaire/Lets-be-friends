const testGlobal = globalThis as typeof globalThis & { Convex?: unknown }
testGlobal.Convex ??= {}

export {}
