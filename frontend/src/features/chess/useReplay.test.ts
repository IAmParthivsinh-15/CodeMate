import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { START_FEN } from '../../utils/chess'
import { useReplay, type ReplayMove } from './useReplay'

const MOVES: ReplayMove[] = [
  { fen: 'fen-1', uci: 'e2e4', san: 'e4' },
  { fen: 'fen-2', uci: 'e7e5', san: 'e5' },
  { fen: 'fen-3', uci: 'g1f3', san: 'Nf3' },
]

describe('useReplay', () => {
  it('starts at the latest position by default', () => {
    const { result } = renderHook(() => useReplay(START_FEN, MOVES))
    expect(result.current.ply).toBe(3)
    expect(result.current.fen).toBe('fen-3')
    expect(result.current.isLatest).toBe(true)
    expect(result.current.lastMove).toEqual({ from: 'g1', to: 'f3' })
  })

  it('navigates prev / next / first / last and clamps at the ends', () => {
    const { result } = renderHook(() => useReplay(START_FEN, MOVES))
    act(() => result.current.prev())
    expect(result.current.ply).toBe(2)
    expect(result.current.fen).toBe('fen-2')
    expect(result.current.isLatest).toBe(false)

    act(() => result.current.first())
    expect(result.current.ply).toBe(0)
    expect(result.current.fen).toBe(START_FEN)
    expect(result.current.lastMove).toBeNull()

    act(() => result.current.prev())
    expect(result.current.ply).toBe(0)

    act(() => result.current.next())
    expect(result.current.ply).toBe(1)

    act(() => result.current.last())
    expect(result.current.ply).toBe(3)
    act(() => result.current.next())
    expect(result.current.ply).toBe(3)
  })

  it('jumps to a ply and honours an initial ply', () => {
    const { result } = renderHook(() => useReplay(START_FEN, MOVES, 1))
    expect(result.current.ply).toBe(1)
    act(() => result.current.goTo(2))
    expect(result.current.fen).toBe('fen-2')
    act(() => result.current.goTo(99))
    expect(result.current.ply).toBe(3)
  })

  it('follows new moves while on the latest ply, but not after stepping back', () => {
    const { result, rerender } = renderHook(({ moves }) => useReplay(START_FEN, moves), { initialProps: { moves: MOVES.slice(0, 2) } })
    expect(result.current.ply).toBe(2)
    rerender({ moves: MOVES })
    expect(result.current.ply).toBe(3)

    act(() => result.current.goTo(1))
    rerender({ moves: [...MOVES, { fen: 'fen-4', uci: 'b8c6', san: 'Nc6' }] })
    expect(result.current.ply).toBe(1)
    expect(result.current.total).toBe(4)
  })
})
