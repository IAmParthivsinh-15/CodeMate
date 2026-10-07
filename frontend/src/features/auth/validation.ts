const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/

export function validateRegister(v: { username: string; email: string; password: string; confirmPassword: string }) {
  const errs: Record<string, string> = {}
  if (!USERNAME_RE.test(v.username)) errs.username = '3-30 characters: letters, numbers, _ . -'
  if (!/^\S+@\S+\.\S+$/.test(v.email)) errs.email = 'Enter a valid email address'
  if (v.password.length < 8) errs.password = 'At least 8 characters'
  if (v.confirmPassword !== v.password) errs.confirmPassword = "Passwords don't match"
  return errs
}
