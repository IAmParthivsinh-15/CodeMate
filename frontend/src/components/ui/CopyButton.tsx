import { useState } from 'react'
import { Button, type ButtonSize, type ButtonVariant } from './Button'

export function CopyButton({ text, label = 'Copy', size = 'sm', variant = 'secondary' }: { text: string; label?: string; size?: ButtonSize; variant?: ButtonVariant }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
    window.setTimeout(() => setState('idle'), 1800)
  }
  return (
    <Button size={size} variant={variant} onClick={copy} aria-live="polite">
      {state === 'copied' ? '✓ Copied' : state === 'failed' ? 'Copy failed' : label}
    </Button>
  )
}
