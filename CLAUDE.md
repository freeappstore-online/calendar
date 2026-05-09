# VibeCode (create.freeappstore.online)

## What this is
The VibeCode React app — AI-powered app builder for FreeAppStore.
Users describe an app, the agent builds it, deploys it to freeappstore.online.

Deployed at: `create.freeappstore.online`
Separate from the store site (freeappstore.online) which is static HTML.

## Tech Stack
- TypeScript, React 19, Vite 6, Tailwind CSS 4.1, pnpm
- React Router for /profile route
- No backend — calls api.freeappstore.online and agent.freeappstore.online

## Structure
```
create/
├── web/
│   ├── src/
│   │   ├── App.tsx                 ← Router (/ = Create, /profile = Profile)
│   │   ├── main.tsx
│   │   ├── index.css               ← Tailwind + brand CSS variables
│   │   ├── components/
│   │   │   └── Nav.tsx             ← Header nav + mobile hamburger
│   │   ├── pages/
│   │   │   ├── Create.tsx          ← VibeCode chat + preview + deploy
│   │   │   └── Profile.tsx         ← User profile + account management
│   │   ├── hooks/
│   │   │   ├── useAuth.ts          ← Auth context (GitHub OAuth)
│   │   │   └── useAgent.ts         ← SSE streaming, projects, chat state
│   │   └── lib/
│   │       └── api.ts              ← API client (auth, agent URLs)
│   ├── public/
│   │   ├── manifest.json
│   │   └── _redirects              ← SPA routing for CF Pages
│   └── package.json
├── package.json
└── CLAUDE.md
```

## Development
```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # builds to web/dist
```

## Deployment
Hosted on Cloudflare Pages.
- Domain: create.freeappstore.online
- Build command: `npx pnpm@10 install && npx pnpm@10 build`
- Build output: `web/dist`
- Push to main = auto-deploy

## Auth
Uses the same `.freeappstore.online` cookie as the store site.
GitHub OAuth via api.freeappstore.online/auth/*.
useAuth hook checks /auth/me on load and provides user context.

## Agent
Calls agent.freeappstore.online/session/:id/* for chat.
useAgent hook handles: SSE streaming, tool call rendering,
project management (localStorage), deploy status tracking.
