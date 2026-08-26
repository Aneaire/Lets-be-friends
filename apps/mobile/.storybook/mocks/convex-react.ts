export function useMutation() {
  return async () => ({})
}

export function useQuery() {
  return null
}

export function usePaginatedQuery() {
  return {
    results: [],
    status: 'Exhausted',
    loadMore: () => undefined,
  }
}

export function useConvexAuth() {
  return {
    isAuthenticated: true,
    isLoading: false,
  }
}
