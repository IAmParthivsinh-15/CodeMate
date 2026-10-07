import { cn } from '../../utils/cn'
import { whiteShare } from '../../utils/display'
import { formatEval } from '../../utils/format'

interface EvalBarProps {
  cp: number | null | undefined
  mate?: number | null
  orientation?: 'white' | 'black'
  className?: string
}

export function EvalBar({ cp, mate, orientation = 'white', className }: EvalBarProps) {
  const white = whiteShare(cp, mate)
  const label = formatEval(cp, mate)
  const whiteOnBottom = orientation === 'white'
  const whiteAhead = white >= 50
  return (
    <div
      className={cn('relative w-5 shrink-0 overflow-hidden rounded-md border border-line bg-[#2b2b2b] sm:w-6', className)}
      role="meter"
      aria-label="Evaluation, White's point of view"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-valuetext={label}
      title={`Evaluation: ${label}`}
    >
      <div
        className="absolute inset-x-0 bg-[#f4f4f4] transition-[height] duration-300"
        style={{ height: `${white}%`, [whiteOnBottom ? 'bottom' : 'top']: 0 }}
      />
      <span
        className={cn(
          'absolute inset-x-0 text-center text-[9px] leading-none font-bold sm:text-[10px]',
          whiteAhead ? 'text-[#2b2b2b]' : 'text-[#f4f4f4]',
          whiteAhead === whiteOnBottom ? 'bottom-1' : 'top-1',
        )}
      >
        {label.replace('+', '')}
      </span>
    </div>
  )
}
