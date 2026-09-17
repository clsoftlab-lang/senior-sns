<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# 지천명 (知天命) — 중년 이상을 위한 취미·등산 SNS

English: [README.md](./README.md)

**지천명(知天命)** 은 **40대 이상 중년 세대** 를 위한 소셜 네트워크입니다. 취미와 등산 사진을 위치와 함께 나누고, 등정 기록을 쌓고, 규칙에 따라 배지를 자동으로 획득하며, 월간 랭킹에 도전하세요. 깔끔하고 읽기 편한 한국어 UI에 **가독성을 위한 약간 큰 기본 글씨**를 적용했습니다.

## 라이브 데모 (LIVE DEMO)

**https://clsoftlab-lang.github.io/senior-sns/**

## 무엇인가요

빌드 과정이 없는 순수 정적 파일로, 브라우저에서 완전히 동작하는 단일 페이지 앱(SPA)입니다.

- **홈 피드** — 위치·산 이름이 태그된 취미·등산 사진 카드, 좋아요·댓글
- **올리기** — 제목 + 장소 + 취미 카테고리(+ 오른 산) 로 기록 등록. 등산 게시물은 등정 기록으로 집계
- **등정 기록** — 오른 산 목록, 누적 고도, 등정 횟수
- **배지** — 첫 정상, 10회 등반, 100대 명산 도전, 누적 고도 등 **규칙 기반 자동 획득**
- **랭킹** — 월간 등정 횟수 · 누적 고도 리더보드
- **모임** — 등산·사진·텃밭·서예·걷기 등 취미 커뮤니티
- **프로필** — 내 기록·배지, 데모 데이터 초기화
- **부가 기능** — 계절 명산 추천 데이터, 큰 글씨 옵션, 라이트/다크 테마

## 로컬 실행

의존성도, 빌드도 없습니다. 아무 정적 서버로 폴더를 서빙하세요.

```bash
python -m http.server 8991
# 브라우저에서 http://localhost:8991
```

또는

```bash
npx serve .
```

`file://` 로 `index.html` 을 직접 열면 JSON을 `fetch` 로 불러오므로 동작하지 않습니다. 반드시 로컬 서버를 사용하세요.

## 배지 · 랭킹 동작 방식

- **배지** (`badges.js`) — 순수 규칙 함수가 `stats`(등정 횟수, 누적 고도, 서로 다른 100대 명산, 사진 게시물, 가입 모임, 좋아요 수, 게시물 수)를 평가합니다. `evaluateBadges(stats)` 는 획득 배지 id 배열을, `newlyEarned(stats, previous)` 는 새로 획득한 배지만 반환합니다. 규칙은 데이터 기반이며 단위 테스트로 검증됩니다.
- **랭킹** (`ranking.js`) — `rankByMonthlyClimbs`, `rankByElevation` 이 내림차순 정렬(동점 2차 기준, 그다음 한글 이름순)된 **새 배열** 을 반환합니다. 입력을 변형하지 않는 순수 함수이며 단위 테스트로 검증됩니다.

## 🤖 AI 기능 (API 연동)

앱에는 작고 플러그블한 **AI-KIT**(`ai/`)가 들어 있으며, 세 가지 기능이 UI에 모두 연결되어 있습니다.

1. **AI 등산·취미 코스 추천 챗봇** (`🤖 AI 도우미` 메뉴) — 앱의 산 데이터로 **계절·난이도**에 맞춰 추천.
2. **게시글/등정 기록 글쓰기 도우미** (`올리기` 화면의 `🤖 AI 초안 작성`) — 몇 개의 단어로 따뜻한 초안 작성.
3. **배지 달성 축하 문구 생성** (`배지` 화면의 획득 배지) — 축하 문구 자동 생성.

**데모 기본값 = 목업(mock).** `ai/config.js` 의 `AI_ENDPOINT` 가 비어 있으면(기본값), 서버·키·설치 없이 **결정론적 한국어 MockProvider**로 완전히 동작합니다. 목업은 앱의 게시글/산/배지 데이터를 재사용하며, 답변은 토큰 단위로 스트리밍됩니다.

**실제 Claude 연동 켜기:**

1. `cd server && cp .env.example .env` 후 `ANTHROPIC_API_KEY` 설정 (모델: **`claude-opus-5`**).
2. `npm install && npm start` — 프록시 `server/index.mjs` 가 `@anthropic-ai/sdk` 로 호출하고 스트리밍·CORS 처리.
3. `ai/config.js` 에서 `AI_ENDPOINT = "http://localhost:8787/api/ai"` 로 설정.

**⚠️ API 키는 오직 서버측에만 둡니다.** 브라우저는 키를 절대 보지 못하며, `{task, payload}` 만 프록시로 POST 하고 실제 호출은 서버가 `ANTHROPIC_API_KEY` 로 수행합니다. `ai/config.js`·브라우저 코드·저장소 어디에도 키를 넣지 마세요. `.gitignore` 가 `.env` 를 제외합니다. [`server/README.md`](./server/README.md) 참고.

## 데모 모드 경계 (DEMO-MODE)

**이 프로젝트는 프론트엔드 데모입니다. 다음 한계를 반드시 확인하세요.**

- **모든 게시물·사용자·산·모임은 허구의 시드 데이터** 로 `data/*.json` 에서 불러옵니다.
- **모든 사진과 배지 아이콘은 인라인 SVG 플레이스홀더이며 실제 이미지가 아닙니다.**
- **데이터는 브라우저 `localStorage` 에만 저장됩니다 — 실제 DB가 아니며, 기기·사람 간 공유되지 않고, 사이트 데이터 삭제나 앱 내 초기화로 지워집니다.**
- **실제 계정·로그인·서버가 없으며, 개인정보(PII)를 수집·전송하지 않습니다.**
- **실제 서비스 빌드에서는:** 백엔드 + 실제 데이터베이스, 실제 사진 업로드/호스팅, 인증·계정, 신고·검수, 개인정보 보호 장치가 추가됩니다.

## 기술 스택

- 모던 HTML + CSS + ES 모듈 JavaScript, **빌드 도구 없음, 상대 경로만 사용**
- 모바일 우선 반응형, 라이트/다크 테마, 가독성용 큰 기본 폰트
- try/catch 로 감싼 `localStorage` 영속화 + 초기화 버튼
- CI 는 `node check.mjs` 실행(JSON 파싱, 전체 JS `node --check`, `index.html` 필수 컨테이너, 배지 규칙 + 랭킹 정렬 단위 테스트)

## 프로젝트 구조

```
index.html          앱 셸(네비, 상단바, 뷰 마운트)
styles.css          모바일 우선 반응형, 라이트/다크, 큰 글씨
app.js              SPA 진입점: 데이터 로드·라우팅·렌더링·상호작용
badges.js           규칙 기반 배지 획득(순수·문서화·테스트)
ranking.js          리더보드 정렬(순수·테스트)
storage.js          localStorage 래퍼(try/catch + 초기화)
ai/config.js        AI 엔드포인트 설정(빈 값=목업; 키는 절대 두지 않음)
ai/ai.js            AI-KIT: askAI() — 결정론적 목업 또는 스트리밍 프록시
server/index.mjs    백엔드 프록시 → Claude(claude-opus-5), 키는 서버측만
server/.env.example ANTHROPIC_API_KEY 템플릿(.env 는 gitignore)
data/               시드 JSON: 게시물(32)·산(20)·사용자(8)·모임(6)
check.mjs           CI 검증 + 단위 테스트(외부 의존성 없음)
.github/workflows/  ci.yml
```

## 기여자

- **이일국 (Dr. Lee Il-guk)** — CLSOFTLAB
- **LWJ**
- **LMJ**
- **Claude** (Anthropic) — 페어 엔지니어링

## 라이선스

- 코드: **Apache-2.0** ([LICENSE](./LICENSE) 참고)
- 문서: **CC BY 4.0**
- SPDX 헤더: `Apache-2.0`, `Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)`

---

*Not an official Anthropic product.*

## 🎓 아이디어 출처

이 프로젝트의 씨앗이 된 아이디어는 **용인대학교 이일국 교수님의 창업 수업**에서 나왔습니다. 그 수업의 학생들이 내놓은 창업 아이디어들은 하나같이 특출나게 빛났고, 이 프로젝트는 그중에서도 유난히 반짝였던 아이디어를 마침내 실제로 작동하는 서비스로 구현한 것입니다. 번뜩이는 상상력을 보여준 제자들에게 깊은 존경과 고마움을 전합니다. *(학생 개인정보는 전혀 담지 않았으며, 아이디어만을 클린룸으로 새로 구현했습니다.)*
