import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTheme, type ThemeMode } from '../../app/themeContext'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Segmented } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { useToast } from '../../components/ui/toastContext'
import { useMeta } from '../../hooks/useMeta'
import { errorMessage, isApiError } from '../../services/apiClient'
import type { BoardTheme, CodeLanguage, Difficulty, Preferences, User } from '../../types/api'
import { BOARD_THEMES } from '../../utils/chess'
import { cn } from '../../utils/cn'
import { titleCase } from '../../utils/format'
import { ME_QUERY_KEY, useUser } from '../auth/authContext'
import { Board } from '../chess/Board'
import { LANGUAGE_LABEL } from '../coding/api'
import { usersApi, type UpdateMeBody } from './api'

const PREVIEW_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'

export function SettingsPage() {
  const user = useUser()
  const qc = useQueryClient()
  const toast = useToast()
  const meta = useMeta()
  const theme = useTheme()
  const [username, setUsername] = useState(user.username)
  const [usernameError, setUsernameError] = useState<string | undefined>()
  const [saving, setSaving] = useState<string | null>(null)

  const save = async (field: string, body: UpdateMeBody, success = 'Saved') => {
    setSaving(field)
    // Optimistic: reflect the change right away, roll back on failure.
    const previous = qc.getQueryData<User | null>(ME_QUERY_KEY)
    if (previous && body.preferences) {
      const next: User = { ...previous, preferences: { ...previous.preferences, ...body.preferences } as Preferences }
      qc.setQueryData<User | null>(ME_QUERY_KEY, next)
    }
    try {
      const updated = await usersApi.updateMe(body)
      qc.setQueryData(ME_QUERY_KEY, updated)
      toast.success(success)
      return true
    } catch (err) {
      if (previous) qc.setQueryData(ME_QUERY_KEY, previous)
      if (field === 'username' && isApiError(err)) setUsernameError(err.details?.[0]?.message ?? err.message)
      else toast.error(errorMessage(err), "Couldn't save")
      return false
    } finally {
      setSaving(null)
    }
  }

  const prefs = user.preferences

  return (
    <>
      <PageHeader title="Settings" description="Preferences are saved to your account and apply on every device." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Board" />
          <CardBody className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Board theme</legend>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((k) => {
                  const t = BOARD_THEMES[k]
                  const active = prefs.boardTheme === k
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={active}
                      onClick={() => save('boardTheme', { preferences: { boardTheme: k } }, 'Board theme updated')}
                      className={cn('rounded-lg border p-1.5 text-xs transition-colors', active ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:border-line-strong')}
                    >
                      <span className="grid aspect-square grid-cols-2 overflow-hidden rounded" aria-hidden="true">
                        <span style={{ background: t.light }} />
                        <span style={{ background: t.dark }} />
                        <span style={{ background: t.dark }} />
                        <span style={{ background: t.light }} />
                      </span>
                      <span className="mt-1 block font-medium">{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="mx-auto max-w-56">
              <Board fen={PREVIEW_FEN} theme={prefs.boardTheme} id="settings-preview" />
            </div>
            <Switch
              checked={prefs.showEvaluation}
              onChange={(v) => save('showEvaluation', { preferences: { showEvaluation: v } })}
              label="Show evaluation bar"
              description="Show Stockfish's evaluation next to the board in replays and analysis."
              disabled={saving === 'showEvaluation'}
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Play" />
            <CardBody className="space-y-4">
              <Select
                label="Default AI difficulty"
                value={prefs.defaultDifficulty}
                disabled={saving === 'defaultDifficulty'}
                onChange={(e) => save('defaultDifficulty', { preferences: { defaultDifficulty: e.target.value as Difficulty } })}
                options={(meta.data?.difficulties ?? [{ key: prefs.defaultDifficulty, elo: 0 }]).map((d) => ({
                  value: d.key,
                  label: `${titleCase(d.key)}${d.elo ? ` (~${d.elo})` : ''}`,
                }))}
              />
              <Select
                label="Preferred coding language"
                value={user.codingStats.preferredLanguage}
                disabled={saving === 'preferredLanguage'}
                onChange={(e) => save('preferredLanguage', { preferredLanguage: e.target.value as CodeLanguage })}
                options={Object.entries(LANGUAGE_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Appearance" />
            <CardBody>
              <Segmented<ThemeMode>
                label="Theme"
                value={theme.mode}
                onChange={theme.setMode}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ]}
              />
              <p className="mt-2 text-xs text-muted">Stored on this device.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <form
                className="flex items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setUsernameError(undefined)
                  const v = username.trim()
                  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(v)) {
                    setUsernameError('3-30 characters: letters, numbers, _ . -')
                    return
                  }
                  if (v !== user.username) await save('username', { username: v }, 'Username updated')
                }}
              >
                <div className="flex-1">
                  <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} error={usernameError} autoComplete="username" />
                </div>
                <Button type="submit" variant="secondary" loading={saving === 'username'} disabled={username.trim() === user.username}>
                  Save
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted">Email: {user.email}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
