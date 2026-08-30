import { describe, expect, it } from 'vitest'
import { activeMentionQuery, collectMentionUsernames, splitBodyIntoSegments, withoutLeadingReplyMention } from '@lets-be-friends/shared'

describe('mention helpers', () => {
  it('collects unique lowercase usernames without treating email addresses as tags', () => {
    expect(collectMentionUsernames('Hello @Maya_Friend and @maya_friend plus @Jay')).toEqual(['maya_friend', 'jay'])
    expect(collectMentionUsernames('No tags here')).toEqual([])
    expect(collectMentionUsernames('Email someone@example.com stays text')).toEqual([])
  })

  it('detects an active token before the caret', () => {
    expect(activeMentionQuery('Talk to @ma', 11)).toBe('ma')
    expect(activeMentionQuery('Talk to @ma', 7)).toBeNull()
    expect(activeMentionQuery('Email someone@ex', 16)).toBeNull()
    expect(activeMentionQuery('a @', 3)).toBe('')
  })

  it('splits bodies into text and resolved mention segments', () => {
    const mentions = [{ username: 'maya_friend', userId: 'u1' }, { username: 'jay', userId: 'u2' }]
    expect(splitBodyIntoSegments('Hi @Maya_Friend, meet @nobody and @Jay!', mentions)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'mention', username: 'maya_friend', userId: 'u1' },
      { type: 'text', text: ', meet ' },
      { type: 'text', text: '@nobody' },
      { type: 'text', text: ' and ' },
      { type: 'mention', username: 'jay', userId: 'u2' },
      { type: 'text', text: '!' },
    ])
  })

  it('removes only a matching legacy reply mention from the start of a body', () => {
    expect(withoutLeadingReplyMention('@Maya_Friend Thanks for this', 'maya_friend')).toBe('Thanks for this')
    expect(withoutLeadingReplyMention('@maya_friendship Thanks', 'maya_friend')).toBe('@maya_friendship Thanks')
    expect(withoutLeadingReplyMention('Hello @maya_friend', 'maya_friend')).toBe('Hello @maya_friend')
  })
})
