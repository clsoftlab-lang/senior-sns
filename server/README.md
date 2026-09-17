<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# 지천명 AI 백엔드 프록시 (`server/`)

프론트엔드(브라우저)가 **절대 API 키를 갖지 않도록** 하기 위한 얇은 프록시입니다.
브라우저는 이 서버의 `POST /api/ai` 로 `{ task, payload }` 만 보내고, 서버가
서버측 환경변수 `ANTHROPIC_API_KEY` 로 **Claude (`claude-opus-5`)** 를 호출한 뒤
결과를 **스트리밍**으로 되돌려줍니다.

> **키는 오직 서버측에만 존재합니다.** 브라우저 코드·저장소에는 절대 넣지 마세요.

## 실행

```bash
cd server
cp .env.example .env      # 그리고 .env 안의 ANTHROPIC_API_KEY 를 실제 값으로 채우세요
npm install               # @anthropic-ai/sdk 설치
npm start                 # node --env-file=.env index.mjs (기본 포트 8787)
```

키를 셸 환경변수로 직접 넘겨도 됩니다:

```bash
ANTHROPIC_API_KEY=... PORT=8787 npm run start:noenv
```

## 프론트엔드 연결

서버가 뜨면, 프로젝트 루트의 `ai/config.js` 를 열어 엔드포인트를 채우세요:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

`AI_ENDPOINT` 가 **비어 있으면** 앱은 서버 없이도 결정론적 한국어 목업으로 동작합니다(데모 기본값).

## API

`POST /api/ai`

```json
{ "task": "recommend | draft | congrats", "payload": { "...앱 데이터..." } }
```

- 응답: `text/plain; charset=utf-8` 스트리밍(청크 단위 텍스트).
- 모델: `claude-opus-5`, `thinking: { type: "adaptive" }`, `max_tokens: 2048`.
- CORS: 기본 `*` (운영에서는 `AI_ALLOW_ORIGIN` 으로 좁히세요).

## 참고

- `.env` 는 커밋 금지(루트 `.gitignore` 가 제외).
- 이 폴더는 프론트엔드 정적 배포와 분리되어 있습니다 — 별도 프로세스/호스트에서 운영하세요.
