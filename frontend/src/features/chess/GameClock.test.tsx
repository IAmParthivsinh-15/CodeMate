import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Clocks } from '../../types/api'
import { clockUrgency } from '../../utils/display'
import { GameClock } from './GameClock'

const NOW = 1_700_000_000_000

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'setInterval', 'performance'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

const clocks = (over: Partial<Clocks> = {}): Clocks => ({ whiteMs: 180_000, blackMs: 95_000, turn: 'w', running: true, serverTime: NOW, ...over })

describe('GameClock', () => {
  it('shows the server value for the side not to move', () => {
    render(<GameClock clocks={clocks()} color="b" />)
    expect(screen.getByRole('timer', { name: 'Black clock' })).toHaveTextContent('1:35')
  })

  it('ticks down locally for the side to move', () => {
    render(<GameClock clocks={clocks()} color="w" />)
    const timer = screen.getByRole('timer', { name: 'White clock' })
    expect(timer).toHaveTextContent('3:00')
    act(() => {
      vi.advanceTimersByTime(5_200)
    })
    expect(timer).toHaveTextContent('2:54')
  })

  it('accounts for the server clock offset', () => {
    // Server is 3 s ahead of this client: 3 s have already elapsed on the server.
    render(<GameClock clocks={clocks()} color="w" offsetMs={3_000} />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('2:56')
  })

  it('stops at zero instead of going negative (the server decides flag fall)', () => {
    render(<GameClock clocks={clocks({ whiteMs: 1_500 })} color="w" />)
    act(() => {
      vi.advanceTimersByTime(4_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('0:00.0')
  })

  it('freezes when paused or finished', () => {
    render(<GameClock clocks={clocks()} color="w" frozen />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('3:00')
  })

  it('renders nothing without clocks', () => {
    const { container } = render(<GameClock clocks={null} color="w" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('clockUrgency', () => {
  it('flags low and critical time', () => {
    expect(clockUrgency(60_000)).toBe('normal')
    expect(clockUrgency(25_000)).toBe('low')
    expect(clockUrgency(9_000)).toBe('critical')
  })
})
