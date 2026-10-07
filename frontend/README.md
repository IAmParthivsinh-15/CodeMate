# CodeMate frontend

The web app for CodeMate, an AI-assisted chess and coding learning platform: **Play → Analyze → Learn → Practice → Improve**.

It is a React 19 + TypeScript single-page app built with Vite. It talks to the backend in `../backend` over REST (`/api`) and Socket.IO (`/socket.io`). The backend is authoritative for everything: the frontend proposes moves and renders what the server returns.

The contracts it implements are:

- REST: [`../docs/api/api.md`](../docs/api/api.md)
- Real time: [`../docs/websocket/protocol.md`](../docs/websocket/protocol.md)
- Product spec: [`../ENHANCEMENT.md`](../ENHANCEMENT.md) (§8 pages, §14-16 analysis UX, §33 dashboard, §54-55 UX rules)

## Quick start

```bash
# 1. Start the backend (needs MongoDB). From ../backend:
PORT=5050 MONGO_URL=mongodb://127.0.0.1:27017/codemate \
ACCESS_TOKEN_SECRET=dev-access-secret-123456 REFRESH_TOKEN_SECRET=dev-refresh-secret-123456 \
NODE_ENV=development node src/server.js
# Optional: seed coding problems with the same env: npm run seed:problems

# 2. Start the frontend. From this folder:
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` and `/socket.io` (WebSocket included) to `http://localhost:5050`, so the browser sees one origin and the backend's httpOnly cookies just work.

## Scripts

| Script | What it does |
| :-- | :-- |
| `npm run dev` | Vite dev server with hot reload and the API proxy |
| `npm run build` | Type-check (`tsc -b`), then production build into `dist/` |
| `npm run preview` | Serve `dist/` on http://localhost:4173, with the same proxy |
| `npm run lint` | ESLint (TypeScript, React hooks, React Refresh rules) |
| `npm test` | Vitest unit and component tests (jsdom), run once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc -b` only |

## Configuration

Everything works with no configuration in development. These variables are optional:

| Variable | Used by | Default | Purpose |
| :-- | :-- | :-- | :-- |
| `VITE_BACKEND_URL` | `vite.config.ts` (dev and preview proxy) | `http://localhost:5050` | Where `/api` and `/socket.io` are proxied |
| `VITE_API_URL` | the app, at build time | empty (same origin) | Absolute API origin, only if the API is not served from the same origin |
| `VITE_SOCKET_URL` | the app, at build time | empty (same origin) | Absolute Socket.IO origin |

In production, serve `dist/` behind the same reverse proxy as the API (as the dev server does) and leave `VITE_API_URL` and `VITE_SOCKET_URL` empty. The auth cookies are `SameSite=Strict`, so a cross-origin setup would need backend changes.

## How it works

### Authentication

- `POST /api/auth/login` and `/register` set the httpOnly `jwt` and `refreshToken` cookies. The access token from the response is **also** kept in memory (`tokenStore` in `src/services/apiClient.ts`) and sent as `Authorization: Bearer …`. It is never written to storage.
- Every request uses `credentials: "include"`.
- On a `401`, the client calls `POST /api/auth/refresh` **once**, shared by all requests that failed at the same time (single flight), then retries each of them once. If the refresh fails, the session is cleared and protected pages redirect to `/login`, remembering the page (`location.state.from`) so the user returns there after logging in.
- `AuthProvider` loads the current user with `GET /api/auth/me` (TanStack Query key `['auth','me']`). Invalidate that key after anything that changes the user (hint credits, rating, preferences).

### Errors

All failures become an `ApiError { status, code, message, details, requestId }`, built from the backend envelope (`{ success: false, error: { code, message, details } }`, falling back to the legacy top-level `message`). Pages show `error.message` in error states or toasts. Network failures use `code: "NETWORK_ERROR"`.

### Real time (Socket.IO)

- `SocketProvider` opens one connection per signed-in session, passing the in-memory token as `auth.token` (the cookie also works). If the handshake is rejected for an auth reason, it refreshes over REST and reconnects.
- It sends `presence:heartbeat` every 25 s and uses the replies to estimate the server clock offset for rendering clocks.
- The connection status (`Connected` / `Reconnecting…` / `Offline`) is shown in the navigation and on online-game pages.
- `analysis:update` and `submission:update` invalidate the matching queries everywhere. Pages can subscribe to any event with `useSocketEvent(event, handler)`.
- Online games (`useOnlineGame`) send every `game:move` with a `clientMoveId` (a UUID) and `expectedPly`. On `STALE_POSITION`, and after every reconnect, they resync with `room:ready` / `game:state`. Clocks are rendered from the server's `clocks` plus `serverTime` and tick locally; the client never decides flag fall.

### Chess

- `chess.js` is used only to highlight legal moves, detect promotions, and preview a move while the server confirms it. The server's returned game or state always wins.
- `Board` wraps `react-chessboard` v5 (`<Chessboard options={…} />`). It supports click-to-move and drag, legal-move dots, last-move and check highlights, a promotion picker, arrows (hints and best moves) and the user's board theme.
- `useReplay` provides move-by-move navigation (it follows new moves while you are on the latest ply). `useReplayKeyboard` binds ← → Home End.

## Folder conventions

```
src/
  app/          App shell: App.tsx, router.tsx (lazy routes), providers.tsx, Theme/Socket providers, landing and 404 pages
  components/
    layout/     AppShell (sidebar and mobile drawer), ProtectedRoute, ErrorBoundary, OfflineBanner, PageHeader, …
    ui/         Design-system primitives: Button, Card, Input, Select, Badge, Modal/ConfirmModal, Tabs, Toast, Markdown, StatTile, …
  features/     One folder per domain. Each has an api.ts (typed endpoint calls) plus its pages and components.
    auth/       AuthProvider, LoginPage, RegisterPage
    chess/      Board, MoveList, GameClock, EvalBar, GameStatusBanner, PlayerBar, useReplay
    games/      Play hub, AI, local and online play, games list, replay, analysis (analysis/ holds its sub-components)
    ai/         Game chat, chess-knowledge chat and browser, AI coach, Explain-this-move modal, sources and Stockfish-facts UI
    learning/   Puzzles page and solver
    coding/     Problem list, problem page (CodeMirror editor), submissions
    profile/    Profile and settings
    dashboard/  Dashboard and the rating chart
  hooks/        Cross-feature hooks (useMeta, useOnlineStatus, useDocumentTitle)
  services/     apiClient.ts (fetch, envelope, refresh) and socket.ts (Socket.IO client, emitAck)
  types/api.ts  TypeScript mirror of docs/api/api.md and the socket payloads
  utils/        Pure helpers (format.ts, chess.ts, display.ts, cn.ts)
  test/         Test setup and helpers (mockFetch, renderWithProviders)
```

Conventions:

- **Server state lives in TanStack Query.** App-wide client state is React context (auth, socket, theme, toasts). There is no global store.
- **Keys:** `['games', …]`, `['analysis', id]`, `['puzzles', …]`, `['coding', …]`, `['submission', id]`, `['dashboard']`, `['auth','me']`.
- Component files export only components (a React Refresh lint rule enforces this). Put shared helpers in `.ts` files.
- Route pages are lazy-loaded, so the board, charts, Markdown and the editor load in separate chunks. CodeMirror is bundled locally; nothing loads from a CDN.
- Styling uses Tailwind CSS v4. Design tokens (colours, including move-classification colours) are CSS variables in `src/index.css`, with light and dark values. Use the token utilities (`bg-surface`, `text-muted`, `border-line`, `text-primary`, …) rather than raw colours.
- Never use `window.alert`, `confirm` or `prompt`. Use `ConfirmModal` and `useToast()` instead.

## Testing

`npm test` runs the Vitest suite in jsdom. It covers:

- the API client (envelope normalisation, single-flight refresh and retry)
- `ProtectedRoute` redirects
- the login flow (with `fetch` mocked)
- `useReplay` navigation
- formatting helpers (`formatEval`, clocks)
- `GameClock` display logic

`src/test/utils.tsx` has `mockFetch` (a route-based fetch stub) and `renderWithProviders`.

## Graceful degradation

- **No LLM configured** on the backend: AI answers come from the engine-facts fallback and are labelled "Engine-facts mode (no LLM configured)".
- **No Judge0:** `GET /api/coding/languages` returns `executionAvailable: false`. A banner explains this, Run and Submit are disabled, and the editor still works (drafts are saved per problem and language in `localStorage`). A `503 EXECUTION_UNAVAILABLE` shows an inline message instead of an error page.
- **Offline:** a banner appears, and the socket status switches to Offline and then Reconnecting.
