import { useCallback } from 'react'
import { moveNumberLabel } from '../../utils/format'
import { aiApi } from './api'
import { ChatView } from './ChatView'
import { useChat } from './useChat'

const GAME_CHAT_SUGGESTIONS = [
  'Where did I lose the advantage?',
  'Why was this move bad?',
  'What should I learn from this game?',
  'Did I repeat the same mistake?',
]

interface GameChatProps {
  gameId: string
  /** The ply selected on the board; sent automatically with every question. */
  selectedPly: number
  selectedSan?: string
  onJumpToPly?: (ply: number) => void
  className?: string
  heightClass?: string
}

/** Game Analysis RAG chat: knows the game, the selected move and the engine analysis. */
export function GameChat({ gameId, selectedPly, selectedSan, onJumpToPly, className, heightClass }: GameChatProps) {
  const chat = useChat({
    key: ['chat', 'game', gameId],
    loadHistory: useCallback(() => aiApi.gameChatHistory(gameId), [gameId]),
    send: useCallback((text: string, ply?: number) => aiApi.gameChat(gameId, text, ply), [gameId]),
    clear: useCallback(() => aiApi.clearGameChat(gameId), [gameId]),
  })

  return (
    <ChatView
      className={className}
      heightClass={heightClass}
      messages={chat.messages}
      loading={chat.history.isPending}
      sending={chat.sending}
      onSend={(text) => chat.send(text, selectedPly > 0 ? selectedPly : undefined)}
      onClear={chat.clear}
      onJumpToPly={onJumpToPly}
      suggestions={GAME_CHAT_SUGGESTIONS}
      placeholder="Ask about this game or the selected move…"
      context={
        selectedPly > 0 ? (
          <>
            Asking about <span className="font-mono font-medium text-fg">{moveNumberLabel(selectedPly)} {selectedSan}</span>
          </>
        ) : (
          'Asking about the whole game (select a move to focus on it)'
        )
      }
      empty={
        <div className="py-6 text-center text-sm text-muted">
          <p className="font-medium text-fg">Ask the coach about this game</p>
          <p className="mt-1">Answers use Stockfish's analysis of this exact game plus the chess knowledge base.</p>
        </div>
      }
    />
  )
}
