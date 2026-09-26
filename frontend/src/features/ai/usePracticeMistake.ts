import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import { aiApi } from './api'

/** POST /mistakes/:ply/practice, then open the puzzle. */
export function usePracticeMistake(gameId: string) {
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [loadingPly, setLoadingPly] = useState<number | null>(null)

  const practice = async (ply: number) => {
    setLoadingPly(ply)
    try {
      const { puzzle } = await aiApi.practiceMistake(gameId, ply)
      void qc.invalidateQueries({ queryKey: ['puzzles'] })
      navigate(`/puzzles?puzzle=${puzzle._id}`)
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't create the puzzle")
    } finally {
      setLoadingPly(null)
    }
  }
  return { practice, loadingPly }
}
