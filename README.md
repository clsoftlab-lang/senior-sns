<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# 지천명 (知天命) — Hobby & Hiking SNS for Midlife+ Adults

한국어 문서: [README.ko.md](./README.ko.md)

**지천명 (Jicheonmyeong, "knowing the will of heaven at fifty")** is a social network built for **adults aged 40+ / midlife and beyond**. Share hobby and hiking photos with locations, keep summit records, earn rule-based badges automatically, and climb the monthly leaderboard — all in a clean, readable Korean UI with a slightly larger base font for comfortable reading.

## LIVE DEMO

**https://clsoftlab-lang.github.io/senior-sns/**

## What it is

A single-page web app (no build step, pure static files) that runs entirely in your browser:

- **홈 피드 (Home feed)** — hobby & hiking photo cards tagged with location and mountain name; like and comment.
- **올리기 (Post)** — add a photo record (title + place + hobby category, optional mountain); a hiking post becomes a summit record.
- **등정 기록 (Summit records)** — the mountains you climbed, cumulative elevation, and count.
- **배지 (Badges)** — earned **automatically by documented rules** (first summit, 10 climbs, 100 명산 challenge, cumulative elevation, etc.).
- **랭킹 (Ranking)** — monthly climb-count and cumulative-elevation leaderboards.
- **모임 (Groups)** — hobby communities (hiking, photography, gardening, calligraphy, walking).
- **프로필 (Profile)** — your records, badges, and a demo-data reset.
- **Extras** — recommended seasonal mountains in seed data, large-text toggle for readability, light/dark theme.

## Run locally

No dependencies, no build. Serve the folder with any static server:

```bash
python -m http.server 8991
# then open http://localhost:8991
```

or

```bash
npx serve .
```

Opening `index.html` directly via `file://` will not work because it loads JSON with `fetch` — use a local server.

## How badges & ranking work

- **Badges** (`badges.js`) — pure, documented rule functions evaluate a `stats` object (climbs, cumulative elevation, distinct 100대 명산, photo posts, groups joined, likes given, posts). `evaluateBadges(stats)` returns earned badge ids; `newlyEarned(stats, previous)` returns only freshly earned ones so the app can show a toast. Rules are data-driven and unit-tested.
- **Ranking** (`ranking.js`) — `rankByMonthlyClimbs` and `rankByElevation` return a new sorted array (descending, with a secondary tiebreak, then Korean name order). Pure functions, do not mutate input, and are unit-tested.

## 🤖 AI 기능 (API 연동)

The app ships a small, pluggable **AI-KIT** (`ai/`) with three features, all wired into the UI:

1. **AI 등산·취미 코스 추천 챗봇** (`🤖 AI 도우미` 메뉴) — recommends mountains/hobbies from the app's own data by **season & difficulty**.
2. **게시글/등정 기록 글쓰기 도우미** (`올리기` 화면의 `🤖 AI 초안 작성`) — drafts a warm post from a few words.
3. **배지 달성 축하 문구 생성** (`배지` 화면의 획득 배지) — generates a congratulation line.
4. **이번 주 추천 다이제스트 (무인·자동)** — on load, the **home feed** auto-generates a short "이번 주 추천 산/취미 모임 다이제스트" (by season/difficulty) from the mountains + groups data. Runs via `askAI`, so it works offline on the mock too.

**Demo default = mock.** With `ai/config.js` `AI_ENDPOINT` empty (the default), everything works offline via a **deterministic Korean MockProvider** that reuses the app's posts/mountains/badges data — no server, no key, nothing to install. Answers stream token-by-token for a live feel.

**Enable real Claude:**

1. `cd server && cp .env.example .env` and set `ANTHROPIC_API_KEY` (cost-first default model: **`claude-haiku-4-5`**, raise via `AI_MODEL`).
2. `npm install && npm start` (the proxy `server/index.mjs` uses `@anthropic-ai/sdk`, streams responses, and sets CORS).
3. In `ai/config.js`, set `AI_ENDPOINT = "http://localhost:8787/api/ai"`.

**⚠️ API keys live server-side ONLY.** The browser never sees a key — it only POSTs `{task, payload}` to your proxy, which calls Claude with the server's `ANTHROPIC_API_KEY`. Never put a key in `ai/config.js`, any browser code, or the repository. `.gitignore` excludes `.env`. See [`server/README.md`](./server/README.md).

## ⚙️ 고도화 — 무인·저비용 실 AI 연동

This build upgrades the AI layer for **무인(autonomous) · 실제 AI 연결(real Claude) · 비용 합리적(cost-efficient)** operation, while keeping every prior feature working.

- **Cost-first model.** Default **`claude-haiku-4-5`** (~**$1 / $5 per MTok** in/out), configurable via `AI_MODEL` (raise to `claude-sonnet-5` / `claude-opus-5` for higher quality).
- **Prompt caching.** Each task's stable system prompt is sent as a `cache_control:{type:'ephemeral'}` block, so repeated calls read cache and cost less.
- **Output caps + guardrails.** Modest per-task `max_tokens` (~700), a per-IP rate limit (20/min), and a monthly token budget (`AI_MONTHLY_TOKEN_CAP`, default 2,000,000). Over budget → HTTP `429 {fallback:true}`.
- **Rough cost estimate.** At Haiku 4.5 pricing, a short grounded call (~1.5k in + ~0.4k out) is on the order of **~$0.004 each → ~$4 per 1,000 requests**, and prompt caching lowers the input cost further on repeat calls.
- **무인 free hosting.** A **Cloudflare Workers** variant (`server/worker.js` + `wrangler.toml`) deploys to the free tier — no server to babysit. Set the key with `wrangler secret put ANTHROPIC_API_KEY` (server-side only).
- **Never breaks.** If the endpoint errors, returns `429 {fallback:true}`, or the network fails, `ai/ai.js` **auto-falls back to the offline mock** (still streaming via `onToken`). The on-load "이번 주 추천 다이제스트" therefore always renders, even with no server.

**API keys are server-side only — never in the browser or repo.**

## DEMO-MODE boundaries

**This is a front-end demo only. Please read these limits:**

- **All posts, users, mountains, and groups are fictional seed data** loaded from `data/*.json`.
- **All photos and badge icons are inline SVG placeholders — there are no real images.**
- **Data persists only in your browser's `localStorage` — it is NOT a real database, is not shared between devices or people, and can be wiped by clearing site data or via the in-app reset.**
- **There are no real accounts, no login, no server, and no personal data (PII) is collected or transmitted.**
- **A real production build would add:** a backend + real database, real photo hosting/upload, authentication and accounts, moderation, and privacy/PII safeguards.

## Tech

- Modern HTML + CSS + ES-module JavaScript, **no build tool, relative paths only**.
- Responsive mobile-first layout; light + dark themes; larger base font for readability.
- `localStorage` persistence wrapped in try/catch with a reset control.
- CI runs `node check.mjs` (JSON parses, `node --check` on all JS, required `index.html` containers, and unit tests for badge rules + ranking sort).

## Project structure

```
index.html          app shell (nav, chrome, view mount)
styles.css          mobile-first responsive, light/dark, large-text
app.js              SPA entry: data load, routing, rendering, interactions
badges.js           rule-based badge awarding (pure, documented, tested)
ranking.js          leaderboard sorting (pure, tested)
storage.js          localStorage wrapper (try/catch + reset)
ai/config.js        AI endpoint config (empty = mock; no key ever here)
ai/ai.js            AI-KIT: askAI() — mock OR streaming proxy, auto mock-fallback
server/index.mjs    Node proxy → Claude (default claude-haiku-4-5), key server-side only
server/worker.js    Cloudflare Workers variant (free tier, 무인)
server/wrangler.toml Workers deploy config
server/.env.example ANTHROPIC_API_KEY + model/cost knobs (.env is gitignored)
data/               seed JSON: posts (32), mountains (20), users (8), groups (6)
check.mjs           CI checks + unit tests (no external deps)
.github/workflows/  ci.yml
```

## Contributors

- **Dr. Lee Il-guk (이일국)** — CLSOFTLAB
- **LWJ**
- **LMJ**
- **Claude** (Anthropic) — pair engineering

## License

- Code: **Apache-2.0** (see [LICENSE](./LICENSE)).
- Documentation: **CC BY 4.0**.
- SPDX headers: `Apache-2.0`, `Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)`.

---

*Not an official Anthropic product.*

## 🎓 Idea origin

The seed idea for this project came from the **entrepreneurship class taught by Dr. Lee Il-guk (이일국) at Yongin University (용인대학교)**. The students in that class produced startup ideas of remarkable, standout creativity — this project is one of those exceptional ideas, finally brought to life as a working service. Built with deep admiration and gratitude for those students' imagination. *(No student personal information is included; only the idea itself was used, implemented clean-room.)*
