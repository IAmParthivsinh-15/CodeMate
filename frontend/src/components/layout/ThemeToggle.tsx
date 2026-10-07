import { useTheme } from '../../app/themeContext'

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
    >
      <span aria-hidden="true">{resolved === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}
