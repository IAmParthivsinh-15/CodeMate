import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { errorMessage, isApiError } from '../../services/apiClient'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './authContext'
import { validateRegister } from './validation'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const input = { ...form, username: form.username.trim(), email: form.email.trim() }
    const errs = validateRegister(input)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      await register(input)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (isApiError(err) && err.code === 'USER_EXISTS') setErrors({ email: 'An account with this email already exists' })
      else if (isApiError(err) && err.details?.length) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.path.replace(/^body\./, ''), d.message])))
      } else setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Play, analyze, learn, practice, improve."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-primary hover:underline">
            Log in
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
        <Input label="Username" autoComplete="username" value={form.username} onChange={set('username')} error={errors.username} autoFocus />
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters."
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          error={errors.confirmPassword}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
