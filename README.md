<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 天命 · Tianming

> AI-powered career navigator combining LLM-driven job analysis with multi-persona user profiling.

React 18 + TypeScript + Vite + Tailwind. Powered by Gemini 3 Flash (batch screen) and Gemini 3 Pro (deep audit).

## Quick start

```bash
npm install
echo "VITE_GEMINI_API_KEY=your-key-here" > .env.local
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite once (CI mode) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint on the whole tree |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier write across the tree |
| `npm run format:check` | Prettier check without writing |

A Husky `pre-commit` hook runs `lint-staged` (ESLint + Prettier) on staged files automatically.

## Docs

- [`doc/HANDOFF.md`](./doc/HANDOFF.md) — project bible: roadmap, architecture decisions, conventions
- [`doc/phase-1-notes.md`](./doc/phase-1-notes.md) — Phase 1 implementation notes
- [`CLAUDE.md`](./CLAUDE.md) — short-form context for AI assistants

## V7.0 baseline

This repo started from a Google AI Studio export: <https://ai.studio/apps/drive/1vgM5s7kVRDvQzFsOW_ongu2OrQnvpuns>. The current branch is an in-progress V8 refactor.
