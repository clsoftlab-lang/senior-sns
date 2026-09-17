// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — OPTIONAL backend proxy that connects the 지천명(知天命) AI
// layer to the real Claude API. The public static demo does NOT need this: it
// runs on the offline MockProvider (ai/config.js AI_ENDPOINT === "").
//
// SECURITY MODEL:
//   • The ANTHROPIC_API_KEY lives ONLY here, as an environment variable.
//   • It is NEVER sent to, or readable by, the browser.
//   • The browser only ever POSTs { task, payload } to /api/ai and receives
//     streamed plain text back.
//
// COST MODEL (무인·저비용):
//   • Cost-first default model claude-haiku-4-5 (configurable via AI_MODEL).
//   • Stable per-task system prompt sent as a cache_control:ephemeral block so
//     repeated calls read cache and cost less.
//   • Modest per-task max_tokens output caps.
//   • Per-IP rate limit + a monthly token budget; over budget → HTTP 429
//     {fallback:true} so the browser transparently falls back to the mock.
//
// Enable real AI:
//   1) cd server && npm install
//   2) copy .env.example → .env and set ANTHROPIC_API_KEY (starts with sk-ant-)
//   3) npm start                       (defaults to http://localhost:8787)
//   4) set AI_ENDPOINT in ai/config.js → "http://localhost:8787/api/ai"
//
// This file is intentionally not exercised in CI (no install / no network).

import http from "node:http";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// ---- minimal .env loader (no dependency) ----
try {
  const env = readFileSync(new URL("./.env", import.meta.url), "utf8");
  for (const raw of env.split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* no .env file — rely on the ambient environment */ }

const PORT = Number(process.env.PORT || 8787);
// Cost-first default. AI_MODEL may be raised to `claude-sonnet-5` or
// `claude-opus-5` for higher quality (and higher cost).
const MODEL = process.env.AI_MODEL || "claude-haiku-4-5";
const ORIGIN = process.env.CORS_ORIGIN || process.env.AI_ALLOW_ORIGIN || "*";

// Cost guardrails.
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT || 20);            // requests / minute / IP
const MONTHLY_TOKEN_CAP = Number(process.env.AI_MONTHLY_TOKEN_CAP || 2_000_000);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompts per task — Claude stays grounded in the payload data the app
// sends. These are STABLE strings → good prompt-cache keys.
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

// Modest per-task output caps (raise only where a task truly needs it).
const MAX_TOKENS = { recommend: 700, draft: 500, congrats: 200, digest: 500 };

const TASKS = ["recommend", "draft", "congrats", "digest"];

function userMessage(task, payload) {
  const intro =
    task === "draft" ? "다음 입력으로 따뜻한 게시글 초안을 작성해주세요." :
    task === "congrats" ? "다음 배지 획득을 축하하는 문구를 작성해주세요." :
    task === "digest" ? "다음 데이터로 이번 주 추천 산·취미 모임 다이제스트를 만들어주세요." :
    "다음 데이터로 계절·난이도에 맞는 산행을 추천해주세요.";
  return [
    intro,
    "",
    "요청 데이터(JSON, 이 데이터만 근거로 답하세요):",
    "```json",
    JSON.stringify(payload ?? {}, null, 2),
    "```",
  ].join("\n");
}

// Build request params, applying the model-specific thinking/effort rules.
// Haiku 4.5 does NOT accept adaptive thinking / effort (would 400) → send neither.
function buildParams(task, payload) {
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS[task] || 700,
    // Prompt caching: stable system prompt as a cache_control:ephemeral block.
    system: [{ type: "text", text: SYSTEM[task] || SYSTEM.recommend, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage(task, payload) }],
  };
  if (!MODEL.startsWith("claude-haiku")) {
    params.thinking = { type: "adaptive" };
    params.output_config = { effort: process.env.AI_EFFORT || "low" };
  }
  return params;
}

// ---- cost guardrails (in-memory) ----
const hits = new Map();                 // ip -> number[] (recent request timestamps, ms)
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

let budget = { month: new Date().getUTCMonth(), tokens: 0 };
function budgetExceeded() {
  const m = new Date().getUTCMonth();
  if (m !== budget.month) budget = { month: m, tokens: 0 };   // reset each month
  return budget.tokens >= MONTHLY_TOKEN_CAP;
}
function addUsage(usage) {
  if (!usage) return;
  const used =
    (usage.input_tokens || 0) + (usage.output_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  budget.tokens += used;
}

function clientIp(req) {
  const fwd = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "unknown";
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true, model: MODEL, hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
      monthlyTokenCap: MONTHLY_TOKEN_CAP, tokensUsed: budget.tokens,
    }));
    return;
  }

  if (req.method !== "POST" || (req.url || "").split("?")[0] !== "/api/ai") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server." }));
    return;
  }

  // Cost guardrails → 429 {fallback:true} so the browser falls back to the mock.
  if (rateLimited(clientIp(req)) || budgetExceeded()) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ fallback: true }));
    return;
  }

  let task = "recommend";
  let payload = {};
  try {
    const parsed = JSON.parse((await readBody(req)) || "{}");
    task = TASKS.includes(parsed.task) ? parsed.task : "recommend";
    payload = parsed.payload || {};
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
  try {
    const stream = client.messages.stream(buildParams(task, payload));
    stream.on("text", (delta) => res.write(delta));
    const final = await stream.finalMessage();
    addUsage(final && final.usage);   // accumulate monthly token usage
    res.end();
  } catch (err) {
    console.error("[/api/ai] error:", err);
    if (!res.writableEnded) res.end("\n[AI 오류] " + (err && err.message ? err.message : "unknown"));
  }
});

server.listen(PORT, () => {
  console.log(`지천명 AI proxy listening on http://localhost:${PORT}/api/ai  (model: ${MODEL})`);
  console.log(`  cost guard: ${RATE_LIMIT}/min per IP, monthly cap ${MONTHLY_TOKEN_CAP.toLocaleString()} tokens`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠ ANTHROPIC_API_KEY is not set — POST /api/ai will return 500 until you set it.");
  }
});
