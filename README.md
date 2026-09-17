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
