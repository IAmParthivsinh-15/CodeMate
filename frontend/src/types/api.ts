// Mirrors docs/api/api.md and docs/websocket/protocol.md. Keep in sync with the backend contract.

export type Color = 'w' | 'b'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'master' | 'grandmaster' | 'legendary'
export type Promotion = 'q' | 'r' | 'b' | 'n'
export type MoveInput = { from: string; to: string; promotion?: Promotion } | { san: string } | { uci: string }
export type BoardTheme = 'classic' | 'green' | 'blue' | 'wood'
export type CodeLanguage = 'javascript' | 'python' | 'java' | 'cpp'

export interface ApiErrorDetail {
  path: string
  message: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}

// ------------------------------------------------------------------ users --

export interface ChessStats {
  gamesPlayed: number
  rating: number
  peakRating: number
  wins: number
  losses: number
  draws: number
}

export interface CodingStatsSummary {
  problemsSolved: number
  submissions: number
  accepted: number
  preferredLanguage: string
}

export interface Preferences {
  boardTheme: BoardTheme
  pieceSet: string
  defaultDifficulty: Difficulty
  showEvaluation: boolean
}

export interface User {
  _id: string
  username: string
  email: string
  chessStats: ChessStats
  codingStats: CodingStatsSummary
  hintCredits: number
  preferences: Preferences
  createdAt: string
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface RefreshResponse {
  accessToken: string
  token: string
  refreshToken: string
}

export interface RatingHistoryEntry {
  _id?: string
  before: number
  after: number
  delta: number
  opponentRating: number
  score: number
  game: string
  createdAt: string
}

export interface RatingHistoryResponse {
  current: number
  history: RatingHistoryEntry[]
}

// ------------------------------------------------------------------- meta --

export interface MetaResponse {
  difficulties: { key: Difficulty; elo: number }[]
  timeControls: { key: string; initialMs: number; incrementMs: number; label: string }[]
}

export interface AiStatus {
  provider: 'none' | 'groq' | 'nvidia' | 'gemini'
  enabled: boolean
}

// ------------------------------------------------------------------ games --

export interface Side {
  type: 'human' | 'engine' | 'open'
  _id?: string
  username?: string
  rating?: number
}

export interface Clocks {
  whiteMs: number
  blackMs: number
  turn: Color
  running: boolean
  serverTime: number
}

export type GameStatus = 'waiting' | 'in_progress' | 'completed' | 'abandoned'
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*'
export type EndReason =
  | null
  | 'checkmate'
  | 'stalemate'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  | 'resignation'
  | 'timeout'
  | 'agreement'
  | 'abandonment'
  | 'aborted'
export type AnalysisStatus = 'none' | 'pending' | 'running' | 'completed' | 'failed'
export type GameMode = 'ai' | 'local' | 'online'

export interface GameMove {
  ply: number
  san: string
  uci: string
  color: Color
  fen: string
  clockMs?: number
}

export interface Game {
  _id: string
  mode: GameMode
  status: GameStatus
  result: GameResult
  endReason: EndReason
  difficulty: Difficulty | null
  yourColor: Color | null
  white: Side
  black: Side
  initialFen: string
  fen: string
  turn: Color
  ply: number
  moves: GameMove[]
  pgn: string | null
  opening: { eco: string; name: string } | null
  rated: boolean
  ratingChange: { white?: number; black?: number } | null
  timeControl: { initialMs: number; incrementMs: number } | null
  clocks: Clocks | null
  paused: boolean
  drawOfferBy: Color | null
  roomCode?: string
  analysisStatus: AnalysisStatus
  hintsUsed: number
  createdAt: string
  completedAt: string | null
}

export type Outcome = 'win' | 'loss' | 'draw' | null

export interface GameSummary {
  _id: string
  mode: GameMode
  status: GameStatus
  result: GameResult
  endReason: EndReason
  difficulty: Difficulty | null
  yourColor: Color | null
  outcome: Outcome
  opponent: string
  plies: number
  opening: string | null
  rated: boolean
  ratingChange: { white?: number; black?: number } | null
  analysisStatus: AnalysisStatus
  createdAt: string
  completedAt: string | null
}

export interface CreateGameBody {
  mode: 'ai' | 'local'
  color?: 'white' | 'black' | 'random'
  difficulty?: Difficulty
  rated?: boolean
  timeControl?: { initialMs: number; incrementMs: number }
}

export interface MoveResponse {
  move: GameMove | null
  reply: GameMove | null
  outcome: { result: GameResult; reason: EndReason } | null
  game: Game
}

export interface HintResponse {
  bestMove: { san: string; uci: string; from: string; to: string }
  score: unknown
  hintCredits: number
}

// --------------------------------------------------------------- analysis --

export type Classification = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
export type Phase = 'opening' | 'middlegame' | 'endgame'

export interface MoveAnalysis {
  ply: number
  moveNumber: number
  color: Color
  fenBefore: string
  fenAfter: string
  playedMove: string
  playedMoveUci: string
  bestMove: string | null
  bestMoveUci: string | null
  evaluationBefore: number
  evaluationAfter: number
  mateBefore: number | null
  mateAfter: number | null
  centipawnLoss: number
  accuracy: number
  classification: Classification
  principalVariation: string[]
  themes: string[]
  phase: Phase
}

export interface SideStats {
  accuracy: number | null
  averageCentipawnLoss: number | null
  counts: Partial<Record<Classification, number>>
}

export interface KeyMoment {
  ply: number
  moveNumber: number
  playedMove: string
  bestMove: string
  explanation: string
}

export interface AiReport {
  summary: string
  strengths: string[]
  weaknesses: string[]
  keyMoments: KeyMoment[]
  trainingRecommendations: string[]
  provider: string
  model: string | null
  generatedAt: string
}

export type AiStatusValue = 'none' | 'pending' | 'completed' | 'failed' | 'skipped'

export interface GameAnalysis {
  _id: string
  gameSession: string
  status: 'completed'
  engineVersion: string
  depth: number
  white: SideStats
  black: SideStats
  themes: string[]
  moveAnalysis: MoveAnalysis[]
  durationMs: number
  aiStatus: AiStatusValue
  aiReport?: AiReport
}

export interface AnalysisResponse {
  status: AnalysisStatus
  aiStatus: AiStatusValue
  analysis: GameAnalysis | null
}

export interface EngineFact {
  ply: number
  moveNumber: number
  color: 'White' | 'Black'
  played: string
  classification: string
  evalBefore: string
  evalAfter: string
  centipawnLoss: number
  bestMove: string | null
  line: string
  themes: string[]
  fenBefore: string
  why: string
}

export interface Source {
  title: string
  section: string
  source: string
}

export interface AiAnswer {
  answer: string
  keyConcepts: string[]
  recommendations: string[]
  sources: Source[]
  route: 'game' | 'chess' | 'mixed'
  provider: string
  model: string | null
  degraded: boolean
  facts?: EngineFact[]
  groundingWarnings?: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ply?: number
  route?: string
  sources?: Source[]
  facts?: EngineFact[]
  keyConcepts?: string[]
  degraded?: boolean
  createdAt?: string
}

export interface ExplainResponse {
  move: EngineFact
  explanation: {
    whatHappened: string
    whyItMatters: string
    betterMove: string
    concept: string
    lookFor: string
    keyConcepts: string[]
  }
  sources: Source[]
  canPractice: boolean
  provider: string
  degraded: boolean
}

// ---------------------------------------------------------------- puzzles --

export interface Puzzle {
  _id: string
  fen: string
  sideToMove: Color
  theme: string
  themes: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  sourceGame: string | null
  sourceMoveNumber: number | null
  playedMove: string | null
  attempts: number
  solved: boolean
  expectedSan?: string
  expectedMove?: string
}

export interface PuzzleAttemptResponse {
  correct: boolean
  played: { san: string; uci: string }
  expected: { san: string; uci: string } | null
  evaluation: number | null
  attempts: number
  puzzle: Puzzle
}

// -------------------------------------------------------------- knowledge --

export interface KnowledgeResult {
  title: string
  section: string
  source: string
  topic: string
  subcategory?: string
  difficulty?: string
  text: string
  score: number
}

export interface KnowledgeSearchResponse {
  results: KnowledgeResult[]
  appliedTopic?: string | null
}

// ------------------------------------------------------------------ coach --

export type Trend = 'improving' | 'stable' | 'needs_attention' | 'not_enough_data'

export interface CoachReportNotEnough {
  enoughData: false
  gamesAnalyzed: number
  minimumGames: number
  message: string
}

export interface CoachReportFull {
  enoughData?: true
  gamesAnalyzed: number
  movesAnalyzed: number
  accuracy: number | null
  averageCentipawnLoss: number | null
  classifications: Partial<Record<Classification, number>>
  phases: { phase: Phase; moves: number; averageCentipawnLoss: number | null; mistakesPer100: number | null }[]
  categories: { key: string; label: string; mistakes: number; per100Moves: number; trend: Trend }[]
  recurringMistakes: {
    theme: string
    label: string
    games: number
    share: number
    example?: { gameId: string; ply: number; moveNumber: number; playedMove: string; bestMove: string } | null
  }[]
  openings: { name: string; games: number; wins: number; draws: number; losses: number; score: number; accuracy: number | null }[]
  timeManagement?: { timedGames: number; lowClockMistakes: number; timeoutLosses: number }
  puzzles: { theme: string; label: string; total: number; solved: number }[]
  ratingHistory: { at: string; rating: number; delta: number }[]
  strengths: { category: string; text: string }[]
  weaknesses: { category: string; text: string }[]
  recommendedConcepts: { source: string; title: string }[]
  recommendedPuzzles: { _id: string; theme: string; difficulty: string }[]
  trainingPlan: { step: number; type: string; text: string; source?: string }[]
}

export type CoachReport = CoachReportNotEnough | CoachReportFull

export interface CoachNarrative {
  answer: string
  keyConcepts: string[]
  recommendations: string[]
  provider: string
  degraded: boolean
}

// ----------------------------------------------------------------- coding --

export interface LanguagesResponse {
  languages: { key: CodeLanguage; name: string }[]
  executionAvailable: boolean
}

export interface ProblemSummary {
  _id: string
  title: string
  slug: string
  difficulty: string
  tags: string[]
  mode: 'stdio' | 'function'
  solved: boolean
}

export interface Problem extends ProblemSummary {
  statement: string
  inputFormat?: string
  outputFormat?: string
  constraints?: string
  starterCode: Partial<Record<CodeLanguage, string>>
  samples: { input: string; output: string }[]
  timeLimitSec?: number
  memoryLimitKb?: number
}

export type SubmissionStatus =
  | 'queued'
  | 'running'
  | 'accepted'
  | 'wrong_answer'
  | 'compilation_error'
  | 'runtime_error'
  | 'time_limit_exceeded'
  | 'memory_limit_exceeded'
  | 'internal_error'
  | 'unavailable'

export interface TestResult {
  index: number
  hidden: boolean
  input?: string
  expected?: string
  output?: string
  status: string
  passed: boolean
  time?: number
  memory?: number
  error?: string
}

export interface Submission {
  _id: string
  problem: { _id?: string; title: string; slug: string; difficulty: string } | string | null
  language: CodeLanguage
  kind: 'run' | 'submit'
  status: SubmissionStatus
  passedCount: number
  totalCount: number
  score: number
  executionTime?: number
  memory?: number
  compileOutput: string | null
  testResults: TestResult[]
  firstAccept?: boolean
  code?: string
  createdAt: string
  completedAt?: string | null
}

// -------------------------------------------------------------- dashboard --

export interface DashboardChess {
  rating: number
  peakRating: number
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  gamesAnalyzed: number
  accuracy: number | null
  averageCentipawnLoss: number | null
  mistakeDistribution: Partial<Record<Classification, number>>
  phaseCpl: Partial<Record<Phase, number>>
  themes: { theme: string; label: string; count: number }[]
  openings: { name: string; eco?: string; games: number; wins: number; draws: number; losses: number }[]
  ratingHistory: { at: string; rating: number; delta: number }[]
}

export interface DashboardCoding {
  problemsSolved: number
  submissions: number
  accepted: number
  acceptanceRate: number | null
  languages: { language: string; submissions: number; accepted: number }[]
  difficulty: Record<string, number>
  statuses: Record<string, number>
  recentSubmissions: {
    _id: string
    problem: { _id: string; title: string; slug: string; difficulty: string } | null
    language: string
    status: SubmissionStatus
    score?: number
    kind: 'run' | 'submit'
    createdAt: string
  }[]
  hintCredits: number
}

export interface Dashboard {
  chess: DashboardChess
  coding: DashboardCoding
  ai: {
    gamesAnalyzed: number
    analysisPending: number
    questions: number
    topConcepts: { concept: string; count: number }[]
    recommendations: { theme: string; text: string }[]
  }
  learning: { puzzles: number; puzzlesSolved: number }
  recentGames: {
    _id: string
    mode: GameMode
    status: GameStatus
    result: GameResult
    outcome: Outcome
    difficulty: string | null
    opening: string | null
    createdAt: string
    analysisStatus: AnalysisStatus
    plies: number
    endReason: EndReason
  }[]
  generatedAt: string
}

export interface UserStatistics {
  chess: Omit<DashboardChess, 'ratingHistory'>
  coding: DashboardCoding
}

// ----------------------------------------------------------------- socket --

export interface LiveState {
  gameId: string
  mode: 'online'
  status: GameStatus
  result: string
  endReason: string | null
  fen: string
  turn: Color
  ply: number
  inCheck: boolean
  lastMove: { san: string; uci: string } | null
  whitePlayerId: string | null
  blackPlayerId: string | null
  clocks: Clocks | null
  paused: boolean
  drawOfferBy: Color | null
  move?: { ply: number; san: string; uci: string; color: Color; fen: string; clockMs?: number }
}

export type SocketAck<T> = ({ ok: true } & T) | { ok: false; error: { code: string; message: string } }
