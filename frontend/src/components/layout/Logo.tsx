import { Link } from 'react-router'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight" aria-label="CodeMate home">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg" aria-hidden="true">
        ♞
      </span>
      <span className="text-lg">
        Code<span className="text-primary">Mate</span>
      </span>
    </Link>
  )
}
