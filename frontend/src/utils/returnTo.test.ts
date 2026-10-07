import { describe, expect, it } from 'vitest'
import { safeReturnTo } from './returnTo'

describe('safeReturnTo', () => {
  it('accepts in-app paths', () => {
    expect(safeReturnTo('/play/ai?game=abc')).toBe('/play/ai?game=abc')
  })
  it('rejects external and protocol-relative URLs', () => {
    expect(safeReturnTo('https://evil.example')).toBeNull()
    expect(safeReturnTo('//evil.example')).toBeNull()
    expect(safeReturnTo('/\\evil.example')).toBeNull()
    expect(safeReturnTo(null)).toBeNull()
  })
})
