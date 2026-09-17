// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/worker.js — Cloudflare Workers variant of the 지천명(知天命) AI proxy.
//
// 무인(autonomous): deploy once to the Cloudflare Workers FREE tier and there is
// no server to babysit. It calls the Anthropic REST API directly and relays the
// assistant text back to the browser (SSE stream). Same task routing + model +
// prompt-caching + output-cap rules as server/index.mjs.
//
// SECURITY: the key lives ONLY as the Worker secret ANTHROPIC_API_KEY
//   wrangler secret put ANTHROPIC_API_KEY
// It is NEVER sent to, embedded in, or readable by the browser or the repo.
//
// Deploy:
//   cd server
//   npx wrangler deploy                 # uses wrangler.toml
//   npx wrangler secret put ANTHROPIC_API_KEY
// Then set AI_ENDPOINT in ai/config.js to the Worker URL + "/api/ai".

// Cost-first default. Override with the AI_MODEL var (wrangler.toml [vars]).
const DEFAULT_MODEL = "claude-haiku-4-5";

const SYSTEM = {
  recommend:
    "당신은 40대 이상 사용자를 위한 취미·등산 SNS '지천명(知天命)'의 따뜻한 산행 추천 도우미입니다. " +
    "사용자가 제공한 산 데이터(payload.mountains)만을 근거로, 계절과 난이도에 맞는 산 2~3곳과 간단한 이유를 존댓말로 추천하세요. " +
    "데이터에 없는 산은 절대 지어내지 마세요. 안전 수칙을 한 줄 덧붙이세요.",
  draft:
    "당신은 '지천명'의 글쓰기 도우미입니다. 사용자가 준 몇 개의 키워드로 따뜻하고 담백한 한국어 게시글 초안(2~3문장)을 작성하세요. " +
    "과장 없이 진솔하게, 중년 세대가 읽기 편한 문장으로 써주세요.",
  congrats:
    "당신은 '지천명'의 축하 도우미입니다. 방금 배지를 획득한 사용자를 위해 짧고 따뜻한 축하 문구(1~2문장)를 한국어로 작성하세요.",
  digest:
    "당신은 '지천명'의 주간 다이제스트 도우미입니다. 제공된 산 데이터(payload.mountains)와 모임 데이터(payload.groups)만을 근거로, " +
    "이번 주 계절·난이도에 맞는 추천 산 2곳과 어울리는 취미 모임 1~2곳을 3~5줄로 짧고 따뜻하게 소개하세요. " +
    "데이터에 없는 산·모임은 절대 지어내지 말고, 안전하고 편안한 산행을 응원하는 한 줄로 마무리하세요.",
};
const MAX_TOKENS = { recommend: 700, draft: 500, congrats: 200, digest: 500 };
const TASKS = ["recommend", "draft", "congrats", "digest"];

function userMessage(task, payload) {
  const p = payload || {};
  const intro =
    task === "draft" ? "다음 입력으로 따뜻한 게시글 초안을 작성해주세요." :
    task === "congrats" ? "다음 배지 획득을 축하하는 문구를 작성해주세요." :
    task === "digest" ? "다음 데이터로 이번 주 추천 산·취미 모임 다이제스트를 만들어주세요." :
    "다음 데이터로 계절·난이도에 맞는 산행을 추천해주세요.";
  return [
    intro, "",
    "요청 데이터(JSON, 이 데이터만 근거로 답하세요):",
    "```json",
    JSON.stringify(p, null, 2),
    "```",
  ].join("\n");
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.CORS_ORIGIN || "*";
    const model = env.AI_MODEL || DEFAULT_MODEL;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, model, hasKey: Boolean(env.ANTHROPIC_API_KEY) }, { headers: cors(origin) });
    }

    if (request.method !== "POST" || url.pathname !== "/api/ai") {
      return Response.json({ error: "Not found" }, { status: 404, headers: cors(origin) });
    }
    if (!env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY is not set on the Worker." }, { status: 500, headers: cors(origin) });
    }

    let task = "recommend", payload = {};
    try {
      const parsed = await request.json();
      task = TASKS.includes(parsed.task) ? parsed.task : "recommend";
      payload = parsed.payload || {};
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: cors(origin) });
    }

    // Build the Anthropic request. Model-specific thinking/effort rules:
    // Haiku 4.5 accepts NEITHER adaptive thinking NOR effort (would 400).
    const body = {
      model,
      max_tokens: MAX_TOKENS[task] || 700,
      stream: true,
      system: [{ type: "text", text: SYSTEM[task] || SYSTEM.recommend, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage(task, payload) }],
    };
    if (!model.startsWith("claude-haiku")) {
      body.thinking = { type: "adaptive" };
      body.output_config = { effort: env.AI_EFFORT || "low" };
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return new Response("\n[AI 오류] upstream " + upstream.status + " " + detail, {
        status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...cors(origin) },
      });
    }

    // Relay the Anthropic SSE stream, emitting only the text deltas as plain text
    // (matches server/index.mjs and what ai/ai.js expects).
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buf = "";
    const out = new ReadableStream({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) { controller.close(); return; }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const json = s.slice(5).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const ev = JSON.parse(json);
            if (ev.type === "content_block_delta" && ev.delta && typeof ev.delta.text === "string") {
              controller.enqueue(encoder.encode(ev.delta.text));
            }
          } catch { /* ignore keep-alive / non-JSON lines */ }
        }
      },
      cancel() { reader.cancel(); },
    });

    return new Response(out, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache", ...cors(origin) },
    });
  },
};
