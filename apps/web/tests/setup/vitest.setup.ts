const testGlobal = globalThis as typeof globalThis & { Convex?: unknown; localStorage?: Storage }
testGlobal.Convex ??= {}

// Node 26 exposes a global localStorage getter that is undefined unless
// --localstorage-file is set. Vitest's jsdom environment then skips installing
// jsdom's implementation, so browser-facing tests lose localStorage. Provide a
// small in-memory implementation when the runtime does not have one.
if (typeof testGlobal.localStorage === 'undefined') {
  const store = new Map<string, string>()
  Object.defineProperty(testGlobal, 'localStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, String(value)) },
      removeItem: (key: string) => { store.delete(key) },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size },
    } satisfies Storage,
  })
}

export {}
