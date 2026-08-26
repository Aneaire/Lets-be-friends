const apiBranch: Record<string, unknown> = new Proxy({}, {
  get: () => apiBranch,
})

export const mobileApi = apiBranch
