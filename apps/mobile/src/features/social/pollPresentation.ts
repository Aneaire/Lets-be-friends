export function pollTotalLabel(totalVotes: number, closed: boolean) {
  if (closed) return 'Closed'
  return `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`
}

export function pollOptionResultLabel(percentage: number, voteCount: number) {
  return `${percentage}% (${voteCount})`
}

export function pollVotable(votedOptionId: string | undefined, closed: boolean, disabled: boolean) {
  return !votedOptionId && !closed && !disabled
}
