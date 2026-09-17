// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — 지천명 AI 백엔드 프록시 (Claude via Anthropic SDK)
// =====================================================================
// 브라우저는 절대 Anthropic API 키를 갖지 않습니다. 프론트엔드는 이 서버의
// POST /api/ai 로 { task, payload } 만 보내고, 서버가 서버측 환경변수
// ANTHROPIC_API_KEY 로 Claude 를 호출한 뒤 결과를 스트리밍으로 되돌려줍니다.
//
// 실행:  ANTHROPIC_API_KEY 를 설정한 뒤  `npm start`  (server/ 폴더에서)
//        기본 포트 8787. 프론트엔드 ai/config.js 의 AI_ENDPOINT 에
//        "http://localhost:8787/api/ai" 를 넣으면 실제 AI 로 전환됩니다.

import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT) || 8787;
const MODEL = 'claude-opus-5';
const ALLOW_ORIGIN = process.env.AI_ALLOW_ORIGIN || '*';

// 작업별 시스템 프롬프트 — 앱 데이터에 근거(grounded)하도록 지시.
const SYSTEMS = {
  recommend:
    "당신은 40대 이상 사용자를 위한 취미·등산 SNS '지천명(知天命)'의 따뜻한 산행 추천 도우미입니다. " +
    '사용자가 제공한 산 데이터(JSON)만을 근거로, 계절과 난이도에 맞는 산 2~3곳과 간단한 이유를 존댓말로 추천하세요. ' +
    '데이터에 없는 산은 절대 지어내지 마세요. 안전 수칙을 한 줄 덧붙이세요.',
  draft:
    "당신은 '지천명'의 글쓰기 도우미입니다. 사용자가 준 몇 개의 키워드로 따뜻하고 담백한 한국어 게시글 초안(2~3문장)을 작성하세요. " +
    '과장 없이 진솔하게, 중년 세대가 읽기 편한 문장으로 써주세요.',
  congrats:
    "당신은 '지천명'의 축하 도우미입니다. 방금 배지를 획득한 사용자를 위해 짧고 따뜻한 축하 문구(1~2문장)를 한국어로 작성하세요.",
};

function sendCors(res, status = 204) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) reject(new Error('payload too large'));
      else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendCors(res);

  if (req.method === 'POST' && req.url === '/api/ai') {
    try {
      const raw = await readBody(req);
      const { task, payload } = JSON.parse(raw || '{}');
      const system = SYSTEMS[task];
      if (!system) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOW_ORIGIN });
        return res.end(JSON.stringify({ error: `알 수 없는 task: ${task}` }));
      }

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Cache-Control': 'no-cache',
      });

      const userMsg =
        `다음은 요청 데이터(JSON)입니다. 이 데이터만 근거로 답하세요:\n\n` +
        '```json\n' + JSON.stringify(payload ?? {}, null, 2) + '\n```';

      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system,
        messages: [{ role: 'user', content: userMsg }],
      });

      stream.on('text', (delta) => res.write(delta));
      await stream.finalMessage();
      res.end();
    } catch (err) {
      console.error('[ai] 오류:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOW_ORIGIN });
        res.end(JSON.stringify({ error: 'AI 처리 중 오류가 발생했습니다.' }));
      } else {
        res.end();
      }
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': ALLOW_ORIGIN });
  res.end('Not Found');
});

server.listen(PORT, () => {
  const keyed = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`지천명 AI 프록시 실행 중: http://localhost:${PORT}/api/ai (model=${MODEL})`);
  if (!keyed) {
    console.warn('⚠️ ANTHROPIC_API_KEY 가 설정되지 않았습니다. 실제 호출은 실패합니다. (.env 참고)');
  }
});
