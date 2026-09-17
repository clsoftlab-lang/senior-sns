// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/ai.js — 플러그블 AI 클라이언트 (AI-KIT)
// ============================================
// 단일 진입점: askAI(task, payload, { onToken }) => Promise<string>
//
//  - AI_ENDPOINT 가 비어 있으면(데모 기본값) → 결정론적 한국어 MockProvider.
//    앱의 시드 데이터(산/배지 등)를 재사용해 규칙 기반으로 답을 만듭니다.
//    실제 서버·키 없이도 UI가 "동작하는 것처럼" 보이게 합니다.
//  - AI_ENDPOINT 가 설정되면 → 백엔드 프록시(server/)로 { task, payload } 를
//    POST 하고, 스트리밍 응답을 onToken 콜백으로 흘려보냅니다.
//
// 무인(autonomous) 회복력: 실 모드에서 엔드포인트 호출이 실패하거나(네트워크 오류),
//    비용 상한으로 429 {fallback:true} 를 받으면 → 자동으로 목업으로 폴백합니다.
//    덕분에 앱은 어떤 경우에도 멈추지 않습니다(무인). 스트리밍은 onToken 으로 유지.
//
// ⚠️ 이 파일은 브라우저에서 실행됩니다. API 키를 절대 두지 마세요.
//    실제 Claude 호출은 server/ 백엔드에서만 일어납니다.

import { AI_ENDPOINT } from './config.js';
import { BADGES, getBadge } from '../badges.js';

/** 지원하는 AI 작업(task) 목록. */
export const AI_TASKS = ['recommend', 'draft', 'congrats', 'digest'];

/**
 * AI 에게 요청한다.
 * @param {'recommend'|'draft'|'congrats'} task 작업 종류
 * @param {object} payload 작업 입력(앱 데이터 포함)
 * @param {{ onToken?: (chunk: string) => void }} [opts] 스트리밍 콜백
 * @returns {Promise<string>} 완성된 답변 텍스트
 */
export async function askAI(task, payload = {}, { onToken } = {}) {
  if (!AI_ENDPOINT) {
    return mockAI(task, payload, onToken);
  }
  return remoteAI(task, payload, onToken);
}

// ---------------------------------------------------------------------------
// 원격(실 Claude) 경로 — server/ 프록시로 POST 후 스트리밍 수신
// 무인 회복력: 429 {fallback:true} · 응답 실패 · 네트워크 오류 → 목업으로 폴백.
// ---------------------------------------------------------------------------
async function remoteAI(task, payload, onToken) {
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload }),
    });
    // 비용 상한/속도 제한 → {fallback:true} → 목업 사용.
    if (res.status === 429) return mockAI(task, payload, onToken);
    if (!res.ok || !res.body) {
      throw new Error(`AI 요청 실패 (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        if (typeof onToken === 'function') onToken(chunk);
      }
    }
    return full;
  } catch (err) {
    // 앱을 절대 멈추지 않는다: 오프라인 목업으로 폴백.
    console.warn('[askAI] 엔드포인트 실패 — 목업으로 폴백:', err && err.message ? err.message : err);
    return mockAI(task, payload, onToken);
  }
}

// ---------------------------------------------------------------------------
// 목업(데모) 경로 — 결정론적 한국어 생성 + 자연스러운 타이핑 스트리밍 흉내
// ---------------------------------------------------------------------------
async function mockAI(task, payload, onToken) {
  let text;
  switch (task) {
    case 'recommend':
      text = mockRecommend(payload);
      break;
    case 'draft':
      text = mockDraft(payload);
      break;
    case 'congrats':
      text = mockCongrats(payload);
      break;
    case 'digest':
      text = mockDigest(payload);
      break;
    default:
      text = '지원하지 않는 요청이에요. (recommend · draft · congrats · digest 중 하나를 사용하세요.)';
  }
  return streamOut(text, onToken);
}

/** 완성 텍스트를 작은 조각으로 나눠 onToken 으로 흘려보낸다(타이핑 느낌). */
async function streamOut(text, onToken) {
  if (typeof onToken !== 'function') return text;
  const chunks = String(text).match(/[\s\S]{1,3}/g) || [String(text)];
  for (const c of chunks) {
    onToken(c);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 16));
  }
  return text;
}

// ---------------------------------------------------------------------------
// 목업 생성기 (순수 함수 · 앱 데이터 재사용)
// ---------------------------------------------------------------------------

/** 고도로 난이도 추정: 초급 <800m, 중급 800~1400m, 고급 >1400m. */
function levelOf(elev) {
  const e = Number(elev) || 0;
  return e >= 1400 ? '고급' : e >= 800 ? '중급' : '초급';
}

/** (1) 등산/취미 코스 추천 — 앱의 산 데이터를 계절·난이도로 필터링. */
function mockRecommend(p) {
  const mountains = Array.isArray(p.mountains) ? p.mountains : [];
  const season = (p.season || '').trim();
  const level = (p.level || '').trim();

  if (!mountains.length) {
    return '추천할 산 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
  }

  let pool = mountains.slice();
  if (season) pool = pool.filter((m) => (m.season || []).includes(season));
  let levelRelaxed = false;
  if (level) {
    const byLevel = pool.filter((m) => levelOf(m.elevation) === level);
    if (byLevel.length) pool = byLevel;
    else levelRelaxed = true; // 해당 난이도 산이 없으면 계절 기준으로 완화
  }
  if (!pool.length) {
    pool = season ? mountains.filter((m) => (m.season || []).includes(season)) : mountains.slice();
  }
  if (!pool.length) pool = mountains.slice();

  // 결정론적 정렬: 초급이면 낮은 산부터, 그 외에는 이름순
  pool = pool.slice().sort((a, b) => {
    if (level === '초급') return (a.elevation || 0) - (b.elevation || 0) || a.name.localeCompare(b.name, 'ko');
    return a.name.localeCompare(b.name, 'ko');
  });
  const picks = pool.slice(0, 3);

  const cond = [season && `${season}`, level && `${level} 난이도`].filter(Boolean).join(' · ') || '요즘';
  const relaxNote = levelRelaxed
    ? `\n(딱 맞는 ${level} 산이 데이터에 없어, ${season || '요즘'} 기준으로 가까운 곳을 골랐어요.)`
    : '';
  const lines = picks.map((m, i) => {
    const tag = m.famous100 ? '100대 명산' : '근교 추천';
    return `${i + 1}. ${m.name} (${m.region}, ${m.elevation}m · ${levelOf(m.elevation)} · ${tag})\n   · 코스: ${m.course}\n   · ${m.desc}`;
  });

  const hobby = season === '겨울'
    ? '\n\n추운 날에는 서예나 텃밭 갈무리 같은 실내 취미도 곁들이면 좋아요.'
    : '\n\n산행 뒤에는 사진회에서 오늘의 풍경을 나눠보시는 건 어떨까요?';

  return `${cond}에 걸어볼 만한 산을 골라봤어요.${relaxNote}\n\n${lines.join('\n\n')}${hobby}\n\n무리하지 마시고 물과 간식 챙겨서 즐거운 산행 되세요! 🏔`;
}

/** (2) 글쓰기 도우미 — 몇 개의 단어로 따뜻한 게시글 초안 작성. */
function mockDraft(p) {
  const title = (p.title || '').trim() || '오늘의 기록';
  const category = (p.category || '등산').trim();
  const place = (p.place || '').trim();
  const mtn = (p.mountainName || '').trim();
  const kw = (p.keywords || p.text || '').trim();

  const where = mtn ? `${mtn}` : place || '오늘 다녀온 곳';
  const lead = category === '등산'
    ? `${where}에 다녀왔습니다.`
    : `${where}에서 ${category} 시간을 보냈어요.`;
  const middle = kw
    ? `${kw.replace(/\s+/g, ' ')} — 짧게 적어둔 마음이 오래 남네요.`
    : '천천히 걷다 보니 마음이 한결 가벼워졌습니다.';
  const tail = category === '등산'
    ? '다음엔 또 어떤 능선을 만날지 벌써 설렙니다. 함께 걸어요! 🥾'
    : '소소하지만 확실한 즐거움이었어요. 여러분의 오늘은 어떠셨나요? 🙂';

  return `[${title}]\n\n${lead} ${middle} ${tail}`;
}

/** (3) 배지 축하 문구 — 획득한 배지 데이터를 재사용해 축하 메시지 생성. */
function mockCongrats(p) {
  const badge = p.badgeId ? getBadge(p.badgeId) : null;
  const name = (p.badgeName || badge?.name || '새 배지').trim();
  const desc = (p.badgeDesc || badge?.desc || '').trim();
  const total = BADGES.length;

  const flavor = desc ? ` ${desc}` : '';
  return `🎉 축하드려요! "${name}" 배지를 획득하셨어요.${flavor}\n한 걸음 한 걸음이 모여 멋진 기록이 되고 있네요. 전체 ${total}개 배지 중 또 하나를 채우셨습니다 — 다음 봉우리에서 또 만나요!`;
}

/**
 * (4) 이번 주 다이제스트 — 앱의 산·모임 데이터를 계절·난이도로 골라 요약.
 * 무인(autonomous) 기능: 앱 로드 시 자동으로 생성되어 홈 피드 상단에 보입니다.
 * 목업(오프라인)에서도 그대로 동작하도록 순수 함수로 작성했습니다.
 */
function mockDigest(p) {
  const mountains = Array.isArray(p.mountains) ? p.mountains : [];
  const groups = Array.isArray(p.groups) ? p.groups : [];
  const season = (p.season || '').trim();
  const level = (p.level || '').trim();

  if (!mountains.length) {
    return '이번 주 추천을 준비하지 못했어요. 잠시 후 다시 시도해주세요.';
  }

  // 계절에 맞는 산 우선, 없으면 전체에서 선택.
  let pool = season ? mountains.filter((m) => (m.season || []).includes(season)) : mountains.slice();
  if (level) {
    const byLevel = pool.filter((m) => levelOf(m.elevation) === level);
    if (byLevel.length) pool = byLevel;
  }
  if (!pool.length) pool = mountains.slice();
  // 결정론적 정렬: 낮은 산부터(부담 적은 순), 동률이면 이름순.
  pool = pool.slice().sort((a, b) => (a.elevation || 0) - (b.elevation || 0) || a.name.localeCompare(b.name, 'ko'));
  const picks = pool.slice(0, 2);

  const mLines = picks.map((m) => {
    const tag = m.famous100 ? '100대 명산' : '근교 추천';
    return `⛰ ${m.name} (${m.region}, ${m.elevation}m · ${levelOf(m.elevation)} · ${tag}) — ${m.course}`;
  });

  // 산행과 어울리는 모임 1~2곳: 등산/걷기 모임을 우선, 없으면 앞에서부터.
  let gPool = groups.filter((g) => g.category === '등산' || g.category === '걷기');
  if (!gPool.length) gPool = groups.slice();
  gPool = gPool.slice().sort((a, b) => (b.members || 0) - (a.members || 0));
  const gPicks = gPool.slice(0, 2);
  const gLines = gPicks.map((g) => `👥 ${g.name} (#${g.category}, ${(g.members || 0).toLocaleString()}명) — ${g.desc}`);

  const cond = [season || '이번 주', level && `${level} 난이도`].filter(Boolean).join(' · ');
  const head = `📬 ${cond} 추천 산·취미 모임 다이제스트`;
  const body = [mLines.join('\n'), gLines.length ? '\n' + gLines.join('\n') : ''].join('').trim();
  return `${head}\n\n${body}\n\n오늘도 무리 없이, 물과 간식 챙겨 안전한 산행 되세요! 🍃`;
}
