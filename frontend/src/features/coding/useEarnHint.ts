import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import { codingApi } from './api'

/**
 * "Earn a hint": fetch an unsolved problem matched to the player's rating and
 * open it, remembering the current page (usually the game) as `returnTo` so the
 * problem page can send the player back after the first accepted solve.
 */
export function useEarnHint() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const earnHint = async () => {
    setLoading(true)
    try {
      const rec = await codingApi.recommended()
      if (!rec.problem) {
        toast.info('You have solved every available problem. New ones will appear here when they are added.', 'Nothing left to solve')
        return
      }
      const returnTo = `${location.pathname}${location.search}`
      navigate(`/coding/${rec.problem.slug}?returnTo=${encodeURIComponent(returnTo)}`)
    } catch (err) {
      toast.error(errorMessage(err), 'Could not find a problem')
    } finally {
      setLoading(false)
    }
  }

  return { earnHint, loading }
}
