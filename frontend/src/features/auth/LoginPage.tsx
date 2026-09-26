import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import type { FromState } from '../../components/layout/ProtectedRoute'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { errorMessage, isApiError } from '../../services/apiClient'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './authContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as FromState | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const errs: Record<string, string> = {}
    if (!email.trim()) errs.email = 'Enter your email'
    if (!password) errs.password = 'Enter your password'
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/dashboard', { replace: true })
    } catch (err) {
      if (isApiError(err) && err.code === 'INVALID_CREDENTIALS') setError('Email or password is incorrect.')
      else if (isApiError(err) && err.details?.length) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path.replace(/^body\./, ''), d.message])))
      } else setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to keep playing, analyzing and coding."
      footer={
        <>
          New to CodeMate?{' '}
          <Link to="/register" state={location.state} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  )
}
