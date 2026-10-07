import { describe, expect, it } from 'vitest'
import { whiteShare } from './display'
import { clampPawns, endReasonLabel, formatClock, formatEval, moveNumberLabel, outcomeFor, remainingMs } from './format'

describe('formatEval (matches the backend EngineFact format)', () => {
  it.each([
    [135, null, '+1.35'],
    [-40, null, '-0.40'],
    [0, null, '0.00'],
    [5, null, '+0.05'],
    [-1, null, '-0.01'],
    [10_000, null, '#'],
    [-10_000, null, '#'],
    [300, 3, 'M3'],
    [-300, -2, '-M2'],
  ])('cp=%s mate=%s → %s', (cp, mate, expected) => {
    expect(formatEval(cp, mate)).toBe(expected)
  })

  it('handles missing values', () => {
    expect(formatEval(null)).toBe('?')
    expect(formatEval(undefined)).toBe('?')
  })
})

describe('clampPawns', () => {
  it('converts to pawns and clamps to ±10', () => {
    expect(clampPawns(250, null)).toBe(2.5)
    expect(clampPawns(4000, null)).toBe(10)
    expect(clampPawns(-4000, null)).toBe(-10)
    expect(clampPawns(0, 2)).toBe(10)
    expect(clampPawns(0, -1)).toBe(-10)
  })
})

describe('whiteShare', () => {
  it('is 50/50 at equality and saturates for mates', () => {
    expect(whiteShare(0)).toBeCloseTo(50)
    expect(whiteShare(200)).toBeGreaterThan(50)
    expect(whiteShare(-200)).toBeLessThan(50)
    expect(whiteShare(0, 3)).toBe(100)
    expect(whiteShare(0, -3)).toBe(0)
  })
})

describe('formatClock', () => {
  it.each([
    [300_000, '5:00'],
    [65_000, '1:05'],
    [10_000, '0:10'],
    [9_450, '0:09.4'],
    [0, '0:00.0'],
    [-500, '0:00.0'],
    [3_900_000, '1:05:00'],
  ])('%s ms → %s', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected)
  })
})

describe('remainingMs', () => {
  const clocks = { whiteMs: 60_000, blackMs: 30_000, turn: 'w' as const, running: true, serverTime: 1_000_000 }

  it('deducts elapsed time only for the side to move', () => {
    expect(remainingMs(clocks, 'w', 1_005_000)).toBe(55_000)
    expect(remainingMs(clocks, 'b', 1_005_000)).toBe(30_000)
  })

  it('applies the server clock offset and never goes below zero', () => {
    expect(remainingMs(clocks, 'w', 1_000_000, 2_000)).toBe(58_000)
    expect(remainingMs(clocks, 'w', 2_000_000)).toBe(0)
  })

  it('does not tick when the clock is stopped', () => {
    expect(remainingMs({ ...clocks, running: false }, 'w', 1_050_000)).toBe(60_000)
  })
})

describe('misc labels', () => {
  it('formats move numbers and outcomes', () => {
    expect(moveNumberLabel(1)).toBe('1.')
    expect(moveNumberLabel(2)).toBe('1…')
    expect(moveNumberLabel(27)).toBe('14.')
    expect(outcomeFor('1-0', 'w')).toBe('win')
    expect(outcomeFor('1-0', 'b')).toBe('loss')
    expect(outcomeFor('1/2-1/2', 'b')).toBe('draw')
    expect(outcomeFor('*', 'w')).toBeNull()
    expect(endReasonLabel('threefold_repetition')).toBe('Threefold repetition')
  })
})
