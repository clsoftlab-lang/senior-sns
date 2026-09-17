<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# 지천명 AI 백엔드 프록시 (`server/`)

프론트엔드(브라우저)가 **절대 API 키를 갖지 않도록** 하기 위한 얇은 프록시입니다.
브라우저는 이 서버의 `POST /api/ai` 로 `{ task, payload }` 만 보내고, 서버가
서버측 환경변수 `ANTHROPIC_API_KEY` 로 **Claude** 를 호출한 뒤 결과를
**스트리밍**으로 되돌려줍니다.

> **키는 오직 서버측에만 존재합니다.** 브라우저 코드·저장소에는 절대 넣지 마세요.

## 무인·저비용 설계

- **비용 우선 기본 모델** `claude-haiku-4-5` (약 $1/$5 per MTok). `AI_MODEL` 로
  `claude-sonnet-5` · `claude-opus-5` 로 올려 품질을 높일 수 있습니다(비용 증가).
- **프롬프트 캐싱**: 작업별 고정 시스템 프롬프트를 `cache_control:{type:'ephemeral'}`
  블록으로 보내, 반복 호출 시 캐시를 읽어 비용을 낮춥니다.
- **Thinking/effort**: Haiku 4.5 는 adaptive thinking / effort 를 받지 않으므로
  (400 방지) Haiku 모델일 때는 **보내지 않습니다.** sonnet/opus 일 때만
  `thinking:{type:'adaptive'}` + `output_config:{effort}` 를 전송합니다.
- **출력 상한**: 작업별 `max_tokens` 를 작게(기본 ~700) 둡니다.
- **비용 가드레일**: IP당 분당 요청 제한(`AI_RATE_LIMIT`, 기본 20) + 월 토큰 예산
  (`AI_MONTHLY_TOKEN_CAP`, 기본 2,000,000). 초과 시 HTTP **429** `{fallback:true}`
  를 반환하고, 프론트엔드는 자동으로 목업으로 폴백합니다(무인).

## 실행 (Node 프록시)

```bash
cd server
cp .env.example .env      # 그리고 .env 안의 ANTHROPIC_API_KEY 를 실제 값으로 채우세요
npm install               # @anthropic-ai/sdk 설치
npm start                 # node index.mjs (기본 포트 8787, .env 자동 로드)
```

`GET /health` 로 모델·키 여부·토큰 사용량을 확인할 수 있습니다.

## 무인 배포 — Cloudflare Workers (무료 티어)

서버를 직접 운영하지 않고, 무료 티어에 한 번 배포하면 됩니다(`server/worker.js`).

```bash
cd server
npx wrangler deploy                     # wrangler.toml 사용
npx wrangler secret put ANTHROPIC_API_KEY   # 키는 서버측 시크릿으로만
```

배포된 Worker URL 뒤에 `/api/ai` 를 붙여 `ai/config.js` 의 `AI_ENDPOINT` 에 넣으세요.
Worker 는 Anthropic REST(`POST https://api.anthropic.com/v1/messages`)를 직접 호출하고
동일한 작업 라우팅·모델·캐싱 규칙으로 텍스트를 스트리밍합니다.

## 프론트엔드 연결

서버(또는 Worker)가 뜨면, 프로젝트 루트의 `ai/config.js` 를 열어 엔드포인트를 채우세요:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

`AI_ENDPOINT` 가 **비어 있으면** 앱은 서버 없이도 결정론적 한국어 목업으로 동작합니다(데모 기본값).
실 모드에서 네트워크 오류·429 `{fallback:true}` 가 나면 프론트엔드가 **자동으로 목업으로 폴백**하므로 앱은 절대 멈추지 않습니다.

## API

`POST /api/ai`

```json
{ "task": "recommend | draft | congrats | digest", "payload": { "...앱 데이터..." } }
```

- 응답: `text/plain; charset=utf-8` 스트리밍(청크 단위 텍스트).
- 모델: 기본 `claude-haiku-4-5` (`AI_MODEL` 로 변경), 캐싱 시스템 블록, 작업별 `max_tokens`.
- CORS: 기본 `*` (운영에서는 `CORS_ORIGIN` 으로 좁히세요).

## 참고

- `.env` 는 커밋 금지(루트 `.gitignore` 가 제외).
- 이 폴더는 프론트엔드 정적 배포와 분리되어 있습니다 — 별도 프로세스/호스트에서 운영하세요.
