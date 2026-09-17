// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// app.js — 지천명(知天命) 데모 SPA 진입점
// =========================================
// 데모 모드: 모든 데이터는 허구이며 브라우저 localStorage 에만 저장됩니다.
// 실제 계정/서버/사진 호스팅은 없습니다. (README의 DEMO-MODE 경계 참고)

import { BADGES, evaluateBadges, newlyEarned, getBadge } from './badges.js';
import { rankByMonthlyClimbs, rankByElevation, withRank } from './ranking.js';
import { loadState, saveState, resetState } from './storage.js';
import { askAI } from './ai/ai.js';

// ---------- 전역 상태 ----------
const DATA = { posts: [], mountains: [], users: [], groups: [] };
let STATE = loadState();
const NOW = new Date('2026-09-17T09:00:00Z');
const ME = 'u-me';

// ---------- 유틸 ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function userById(id) {
  return (
    DATA.users.find((u) => u.id === id) || { id, name: '알 수 없음', handle: '@?', hue: 210 }
  );
}
function mountainById(id) {
  return DATA.mountains.find((m) => m.id === id) || null;
}
function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
}
function sameMonth(ts) {
  const d = new Date(ts);
  return d.getFullYear() === NOW.getFullYear() && d.getMonth() === NOW.getMonth();
}

// ---------- SVG 플레이스홀더 ----------
// 사진: 산 능선 실루엣, 색상은 hue 로 결정 (실제 사진 없음 — 데모용).
function photoSVG(hue, label) {
  const h = ((Number(hue) || 200) % 360 + 360) % 360;
  return `<svg viewBox="0 0 400 260" role="img" aria-label="${esc(label)} 사진 플레이스홀더" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="sky${h}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${h} 55% 78%)"/>
      <stop offset="1" stop-color="hsl(${(h + 30) % 360} 45% 55%)"/>
    </linearGradient></defs>
    <rect width="400" height="260" fill="url(#sky${h})"/>
    <circle cx="315" cy="66" r="30" fill="hsl(${h} 90% 92%)" opacity="0.85"/>
    <path d="M0 260 L70 150 L120 195 L185 110 L250 190 L320 130 L400 210 L400 260 Z" fill="hsl(${(h + 200) % 360} 30% 32%)"/>
    <path d="M0 260 L60 200 L140 235 L210 180 L300 230 L400 195 L400 260 Z" fill="hsl(${(h + 200) % 360} 35% 22%)"/>
  </svg>`;
}
// 아바타: 이니셜 원형
function avatarSVG(user, size = 44) {
  const h = ((Number(user.hue) || 200) % 360 + 360) % 360;
  const ch = esc((user.name || '?').trim().charAt(0));
  return `<svg width="${size}" height="${size}" viewBox="0 0 44 44" role="img" aria-label="${esc(user.name)} 프로필">
    <circle cx="22" cy="22" r="22" fill="hsl(${h} 55% 55%)"/>
    <text x="22" y="29" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">${ch}</text>
  </svg>`;
}
// 배지 아이콘: 방패/별
function badgeSVG(hue, earned) {
  const h = ((Number(hue) || 200) % 360 + 360) % 360;
  const fill = earned ? `hsl(${h} 70% 50%)` : 'var(--muted-bg)';
  const star = earned ? '#fff' : 'var(--muted)';
  return `<svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-hidden="true">
    <path d="M28 3 L50 12 V28 C50 42 40 50 28 53 C16 50 6 42 6 28 V12 Z" fill="${fill}" stroke="hsl(${h} 40% 40%)" stroke-width="1.5"/>
    <path d="M28 17 l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1 Z" fill="${star}"/>
  </svg>`;
}

// ---------- 파생 계산 ----------
// 모든 게시물(시드 + 사용자) 합치기
function allPosts() {
  return [...DATA.posts, ...STATE.userPosts];
}

// "나"의 통계 (배지 규칙 입력)
function myStats() {
  const mine = STATE.userPosts.filter((p) => p.userId === ME);
  const climbPosts = mine.filter((p) => p.record);
  const famous = new Set(
    climbPosts.filter((p) => p.record.famous100).map((p) => p.record.mountainId)
  );
  const distinctMtn = new Set(climbPosts.map((p) => p.record.mountainId));
  return {
    posts: mine.length,
    climbs: climbPosts.length,
    totalElevation: climbPosts.reduce((a, p) => a + (Number(p.record.elevation) || 0), 0),
    distinctMountains: distinctMtn.size,
    distinctFamous100: famous.size,
    photoPosts: mine.filter((p) => p.category === '사진').length,
    likesGiven: STATE.likedPosts.length,
    groupsJoined: STATE.joinedGroups.length,
  };
}

// 배지 재평가 후 새로 획득분 저장/토스트
function refreshBadges() {
  const stats = myStats();
  const fresh = newlyEarned(stats, STATE.earnedBadges);
  if (fresh.length) {
    STATE.earnedBadges = evaluateBadges(stats);
    saveState(STATE);
    fresh.forEach((id) => {
      const b = getBadge(id);
      if (b) toast(`🏅 새 배지 획득: ${b.name}`);
    });
  }
}

// 랭킹 엔트리 집계 (사용자별 월간 등정/누적 고도)
function buildRankingEntries() {
  const map = new Map();
  for (const u of DATA.users) {
    map.set(u.id, { userId: u.id, name: u.name, hue: u.hue, monthlyClimbs: 0, totalElevation: 0 });
  }
  for (const p of allPosts()) {
    if (!p.record) continue;
    if (!map.has(p.userId)) {
      const u = userById(p.userId);
      map.set(p.userId, { userId: u.id, name: u.name, hue: u.hue, monthlyClimbs: 0, totalElevation: 0 });
    }
    const e = map.get(p.userId);
    e.totalElevation += Number(p.record.elevation) || 0;
    if (sameMonth(p.createdAt)) e.monthlyClimbs += 1;
  }
  return [...map.values()];
}

// ---------- 토스트 ----------
let toastTimer = null;
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- 뷰: 피드 ----------
function viewFeed() {
  const posts = allPosts().slice().sort((a, b) => b.createdAt - a.createdAt);
  const cards = posts.map(renderPostCard).join('');
  return `
    <section aria-labelledby="feed-h">
      <h2 id="feed-h" class="view-title">홈 피드</h2>
      <p class="view-sub">취미와 등산 이야기를 나눠요. 사진을 눌러 좋아요와 댓글을 달 수 있어요.</p>
      <div class="feed">${cards}</div>
    </section>`;
}

function renderPostCard(p) {
  const u = userById(p.userId);
  const liked = STATE.likedPosts.includes(p.id);
  const extra = STATE.extraComments[p.id] || [];
  const comments = [...(p.comments || []), ...extra];
  const recordBadge = p.record
    ? `<span class="chip chip-alt">⛰ ${esc(p.record.mountainName)} ${p.record.elevation}m${
        p.record.famous100 ? ' · 100대 명산' : ''
      }</span>`
    : '';
  return `
  <article class="card" data-post="${esc(p.id)}">
    <header class="card-head">
      ${avatarSVG(u)}
      <div class="card-who">
        <strong>${esc(u.name)}</strong>
        <span class="muted">${esc(u.handle)} · ${fmtDate(p.createdAt)}</span>
      </div>
    </header>
    <div class="card-photo">${photoSVG(p.hue, p.title)}</div>
    <div class="card-body">
      <div class="chips">
        <span class="chip">#${esc(p.category)}</span>
        <span class="chip">📍 ${esc(p.place)}</span>
        ${recordBadge}
      </div>
      <h3 class="card-title">${esc(p.title)}</h3>
      <p class="card-text">${esc(p.text)}</p>
    </div>
    <footer class="card-foot">
      <button class="btn-like ${liked ? 'liked' : ''}" data-like="${esc(p.id)}" aria-pressed="${liked}">
        ${liked ? '❤' : '🤍'} <span class="like-count">${(p.likes || 0) + (liked ? 1 : 0)}</span>
      </button>
      <button class="btn-ghost" data-toggle-comments="${esc(p.id)}">💬 댓글 ${comments.length}</button>
    </footer>
    <div class="comments" id="cm-${esc(p.id)}" hidden>
      <ul class="comment-list">
        ${comments
          .map((c) => `<li><strong>${esc(c.user)}</strong> ${esc(c.text)}</li>`)
          .join('') || '<li class="muted">첫 댓글을 남겨보세요.</li>'}
      </ul>
      <form class="comment-form" data-comment="${esc(p.id)}">
        <input type="text" name="text" maxlength="120" placeholder="따뜻한 댓글을 남겨보세요" aria-label="댓글 입력" required />
        <button class="btn" type="submit">등록</button>
      </form>
    </div>
  </article>`;
}

// ---------- 뷰: 올리기 ----------
function viewUpload() {
  const opts = ['등산', '사진', '텃밭', '서예', '걷기']
    .map((c) => `<option value="${c}">${c}</option>`)
    .join('');
  const mtnOpts = DATA.mountains
    .map((m) => `<option value="${m.id}">${esc(m.name)} (${m.elevation}m)</option>`)
    .join('');
  return `
    <section aria-labelledby="up-h">
      <h2 id="up-h" class="view-title">사진 · 기록 올리기</h2>
      <p class="view-sub">사진은 데모용 SVG 플레이스홀더로 생성됩니다. 등산 카테고리는 등정 기록으로 집계돼요.</p>
      <form id="upload-form" class="panel form">
        <label>제목<input type="text" name="title" maxlength="60" required placeholder="예: 설악산 대청봉 정상"/></label>
        <label>취미 카테고리
          <select name="category" required>${opts}</select>
        </label>
        <label>장소<input type="text" name="place" maxlength="60" required placeholder="예: 강원 설악산 / 우리 동네 텃밭"/></label>
        <label class="mtn-only">오른 산 (등산일 때)
          <select name="mountainId"><option value="">— 선택 안 함 —</option>${mtnOpts}</select>
        </label>
        <label>내용<textarea name="text" maxlength="280" rows="3" placeholder="오늘의 이야기를 적어주세요"></textarea></label>
        <button type="button" class="btn btn-outline" id="ai-draft-btn">🤖 AI 초안 작성</button>
        <p class="ai-hint muted">제목·장소·카테고리를 입력한 뒤 누르면, 따뜻한 게시글 초안을 대신 써드려요.</p>
        <button class="btn btn-primary" type="submit">올리기</button>
      </form>
    </section>`;
}

// ---------- 뷰: 등정 기록 ----------
function viewRecords() {
  const s = myStats();
  const climbs = STATE.userPosts
    .filter((p) => p.record)
    .sort((a, b) => b.createdAt - a.createdAt);
  const rows =
    climbs
      .map(
        (p) => `<tr><td>${fmtDate(p.createdAt)}</td><td>${esc(p.record.mountainName)}</td>
        <td>${p.record.elevation}m</td><td>${p.record.famous100 ? '✔' : ''}</td></tr>`
      )
      .join('') ||
    '<tr><td colspan="4" class="muted">아직 등정 기록이 없어요. "올리기"에서 등산 게시물을 남겨보세요.</td></tr>';
  return `
    <section aria-labelledby="rec-h">
      <h2 id="rec-h" class="view-title">내 등정 기록</h2>
      <div class="stat-grid">
        <div class="stat"><span class="stat-num">${s.climbs}</span><span class="stat-lab">총 등정 횟수</span></div>
        <div class="stat"><span class="stat-num">${s.totalElevation.toLocaleString()}m</span><span class="stat-lab">누적 고도</span></div>
        <div class="stat"><span class="stat-num">${s.distinctMountains}</span><span class="stat-lab">오른 산</span></div>
        <div class="stat"><span class="stat-num">${s.distinctFamous100}</span><span class="stat-lab">100대 명산</span></div>
      </div>
      <div class="table-wrap">
        <table class="grid"><thead><tr><th>날짜</th><th>산</th><th>고도</th><th>100대</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </div>
    </section>`;
}

// ---------- 뷰: 배지 ----------
function viewBadges() {
  const s = myStats();
  const earned = new Set(evaluateBadges(s));
  const cards = BADGES.map((b) => {
    const has = earned.has(b.id);
    return `<div class="badge-card ${has ? 'earned' : 'locked'}">
      ${badgeSVG(b.hue, has)}
      <strong>${esc(b.name)}</strong>
      <span class="muted">${esc(b.desc)}</span>
      <span class="badge-state">${has ? '획득함' : '미획득'}</span>
      ${has ? `<button type="button" class="btn btn-outline btn-sm" data-congrats="${esc(b.id)}">🤖 축하 문구</button>
      <p class="ai-answer" id="ai-congrats-${esc(b.id)}" aria-live="polite" hidden></p>` : ''}
    </div>`;
  }).join('');
  return `
    <section aria-labelledby="bd-h">
      <h2 id="bd-h" class="view-title">배지</h2>
      <p class="view-sub">활동에 따라 규칙 기반으로 자동 획득됩니다. (획득: ${earned.size} / ${BADGES.length})</p>
      <div class="badge-grid">${cards}</div>
    </section>`;
}

// ---------- 뷰: 랭킹 ----------
function viewRanking() {
  const entries = buildRankingEntries();
  const byClimb = withRank(rankByMonthlyClimbs(entries)).slice(0, 10);
  const byElev = withRank(rankByElevation(entries)).slice(0, 10);
  const row = (e, val) => `<tr class="${e.userId === ME ? 'me-row' : ''}">
    <td class="rank r${e.rank}">${e.rank}</td><td>${esc(e.name)}</td><td>${val}</td></tr>`;
  return `
    <section aria-labelledby="rk-h">
      <h2 id="rk-h" class="view-title">랭킹</h2>
      <p class="view-sub">${NOW.getMonth() + 1}월 등정 리더보드입니다. 산에 오를수록 순위가 올라가요.</p>
      <div class="rank-cols">
        <div class="panel">
          <h3>월간 등정 횟수</h3>
          <div class="table-wrap"><table class="grid"><thead><tr><th>순위</th><th>이름</th><th>횟수</th></tr></thead>
          <tbody>${byClimb.map((e) => row(e, e.monthlyClimbs + '회')).join('')}</tbody></table></div>
        </div>
        <div class="panel">
          <h3>누적 고도</h3>
          <div class="table-wrap"><table class="grid"><thead><tr><th>순위</th><th>이름</th><th>고도</th></tr></thead>
          <tbody>${byElev.map((e) => row(e, e.totalElevation.toLocaleString() + 'm')).join('')}</tbody></table></div>
        </div>
      </div>
    </section>`;
}

// ---------- 뷰: 모임 ----------
function viewGroups() {
  const cards = DATA.groups
    .map((g) => {
      const joined = STATE.joinedGroups.includes(g.id);
      return `<article class="group-card">
        <div class="group-ico" style="--h:${g.hue}">${esc(g.category.charAt(0))}</div>
        <div class="group-body">
          <strong>${esc(g.name)}</strong>
          <span class="chip">#${esc(g.category)}</span>
          <p class="muted">${esc(g.desc)}</p>
          <span class="muted">멤버 ${(g.members + (joined ? 1 : 0)).toLocaleString()}명</span>
        </div>
        <button class="btn ${joined ? 'btn-outline' : 'btn-primary'}" data-join="${esc(g.id)}">
          ${joined ? '가입됨 · 나가기' : '가입하기'}
        </button>
      </article>`;
    })
    .join('');
  return `
    <section aria-labelledby="gr-h">
      <h2 id="gr-h" class="view-title">취미 모임</h2>
      <p class="view-sub">등산 · 사진 · 텃밭 · 서예 등 관심사로 이웃을 만나요.</p>
      <div class="group-grid">${cards}</div>
    </section>`;
}

// ---------- 뷰: 프로필 ----------
function viewProfile() {
  const me = userById(ME);
  const s = myStats();
  const earned = evaluateBadges(s);
  const mine = STATE.userPosts.filter((p) => p.userId === ME).length;
  const badgeStrip =
    earned
      .map((id) => {
        const b = getBadge(id);
        return b ? `<div class="mini-badge" title="${esc(b.desc)}">${badgeSVG(b.hue, true)}<span>${esc(b.name)}</span></div>` : '';
      })
      .join('') || '<p class="muted">아직 배지가 없어요. 첫 게시물을 올려보세요!</p>';
  return `
    <section aria-labelledby="pf-h">
      <h2 id="pf-h" class="view-title">내 프로필</h2>
      <div class="panel profile-head">
        ${avatarSVG(me, 72)}
        <div>
          <strong class="big">${esc(me.name)}</strong>
          <p class="muted">${esc(me.handle)} · ${esc(me.ageBand)} · ${esc(me.region)}</p>
          <p>${esc(me.bio)}</p>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><span class="stat-num">${mine}</span><span class="stat-lab">내 게시물</span></div>
        <div class="stat"><span class="stat-num">${s.climbs}</span><span class="stat-lab">등정</span></div>
        <div class="stat"><span class="stat-num">${s.totalElevation.toLocaleString()}m</span><span class="stat-lab">누적 고도</span></div>
        <div class="stat"><span class="stat-num">${earned.length}</span><span class="stat-lab">배지</span></div>
      </div>
      <h3 class="view-title">내 배지</h3>
      <div class="mini-badge-strip">${badgeStrip}</div>
      <div class="panel danger-zone">
        <h3>데모 초기화</h3>
        <p class="muted">저장된 좋아요·게시물·기록·배지를 모두 지우고 처음 상태로 되돌립니다.</p>
        <button class="btn btn-outline" id="reset-btn">데모 데이터 초기화</button>
      </div>
    </section>`;
}

// ---------- 뷰: AI 도우미 ----------
function viewAI() {
  const seasons = ['봄', '여름', '가을', '겨울'];
  const seasonOpts = seasons.map((s) => `<option value="${s}">${s}</option>`).join('');
  const levelOpts = ['', '초급', '중급', '고급']
    .map((l) => `<option value="${l}">${l || '전체'}</option>`)
    .join('');
  return `
    <section aria-labelledby="ai-h">
      <h2 id="ai-h" class="view-title">🤖 AI 등산·취미 도우미</h2>
      <p class="view-sub">계절과 난이도를 고르면 우리 앱의 산 데이터로 코스를 추천해드려요.
        <span class="muted">(데모: 실제 AI 연동 전에는 규칙 기반 목업으로 동작합니다. 연결 방법은 README 참고)</span>
      </p>
      <form id="ai-reco-form" class="panel form">
        <label>계절
          <select name="season">${seasonOpts}</select>
        </label>
        <label>난이도
          <select name="level">${levelOpts}</select>
        </label>
        <label>하고 싶은 말 (선택)
          <input type="text" name="q" maxlength="80" placeholder="예: 단풍 보러 완만한 길로 가고 싶어요" />
        </label>
        <button class="btn btn-primary" type="submit">🤖 추천받기</button>
      </form>
      <div class="ai-answer" id="ai-reco-out" aria-live="polite" hidden></div>
    </section>`;
}

// AI 요청을 실행하고 결과를 대상 요소에 스트리밍으로 채운다.
async function runAI(task, payload, outEl, btn) {
  if (!outEl) return;
  outEl.hidden = false;
  outEl.textContent = '';
  outEl.classList.add('ai-loading');
  if (btn) btn.disabled = true;
  try {
    await askAI(task, payload, { onToken: (t) => { outEl.textContent += t; } });
  } catch (e) {
    console.error(e);
    outEl.textContent = 'AI 응답을 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
  } finally {
    outEl.classList.remove('ai-loading');
    if (btn) btn.disabled = false;
  }
}

// ---------- 라우터 ----------
const ROUTES = {
  feed: viewFeed,
  ai: viewAI,
  upload: viewUpload,
  records: viewRecords,
  badges: viewBadges,
  ranking: viewRanking,
  groups: viewGroups,
  profile: viewProfile,
};

function currentRoute() {
  const h = (location.hash || '#/feed').replace(/^#\//, '');
  return ROUTES[h] ? h : 'feed';
}

function render() {
  const route = currentRoute();
  const view = $('#view');
  view.innerHTML = ROUTES[route]();
  // 네비 활성화 표시
  document.querySelectorAll('[data-route]').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-route') === route);
    if (a.getAttribute('data-route') === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  view.focus();
  window.scrollTo(0, 0);
  bindViewEvents(route);
  // 사이드바(모바일 드로어) 닫기
  document.body.classList.remove('nav-open');
}

// ---------- 뷰별 이벤트 바인딩 ----------
function bindViewEvents(route) {
  if (route === 'upload') {
    $('#upload-form').addEventListener('submit', onUploadSubmit);
    const draftBtn = $('#ai-draft-btn');
    if (draftBtn) draftBtn.addEventListener('click', onAiDraft);
  }
  if (route === 'profile') {
    $('#reset-btn').addEventListener('click', onReset);
  }
  if (route === 'ai') {
    $('#ai-reco-form').addEventListener('submit', onAiRecommend);
  }
  if (route === 'badges') {
    document.querySelectorAll('[data-congrats]').forEach((btn) => {
      btn.addEventListener('click', () => onAiCongrats(btn.getAttribute('data-congrats'), btn));
    });
  }
}

// AI: 코스 추천
async function onAiRecommend(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    season: fd.get('season') || '',
    level: fd.get('level') || '',
    query: (fd.get('q') || '').trim(),
    mountains: DATA.mountains,
  };
  await runAI('recommend', payload, $('#ai-reco-out'), e.target.querySelector('button[type="submit"]'));
}

// AI: 글쓰기 초안 → 내용(textarea)에 스트리밍
async function onAiDraft(e) {
  const form = $('#upload-form');
  const btn = e.currentTarget;
  const area = form.querySelector('textarea[name="text"]');
  const mId = form.querySelector('select[name="mountainId"]').value;
  const payload = {
    title: form.querySelector('input[name="title"]').value.trim(),
    category: form.querySelector('select[name="category"]').value,
    place: form.querySelector('input[name="place"]').value.trim(),
    mountainName: mId ? mountainById(mId)?.name || '' : '',
    keywords: area.value.trim(),
  };
  btn.disabled = true;
  area.value = '';
  try {
    await askAI('draft', payload, { onToken: (t) => { area.value += t; } });
  } catch (err) {
    console.error(err);
    toast('초안 작성에 실패했어요.');
  } finally {
    btn.disabled = false;
  }
}

// AI: 배지 축하 문구
async function onAiCongrats(badgeId, btn) {
  const b = getBadge(badgeId);
  if (!b) return;
  await runAI('congrats', { badgeId, badgeName: b.name, badgeDesc: b.desc }, $('#ai-congrats-' + CSS.escape(badgeId)), btn);
}

// 피드 상호작용은 위임(delegation)으로 처리
function bindGlobalDelegation() {
  const view = $('#view');
  view.addEventListener('click', (e) => {
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn) return onLike(likeBtn.getAttribute('data-like'), likeBtn);
    const cmtBtn = e.target.closest('[data-toggle-comments]');
    if (cmtBtn) {
      const box = $('#cm-' + CSS.escape(cmtBtn.getAttribute('data-toggle-comments')));
      if (box) box.hidden = !box.hidden;
      return;
    }
    const joinBtn = e.target.closest('[data-join]');
    if (joinBtn) return onJoin(joinBtn.getAttribute('data-join'));
  });
  view.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-comment]');
    if (form) {
      e.preventDefault();
      onComment(form.getAttribute('data-comment'), form);
    }
  });
}

// ---------- 액션 핸들러 ----------
function onLike(postId, btn) {
  const i = STATE.likedPosts.indexOf(postId);
  if (i >= 0) STATE.likedPosts.splice(i, 1);
  else STATE.likedPosts.push(postId);
  saveState(STATE);
  refreshBadges();
  // 해당 카드만 갱신
  const liked = STATE.likedPosts.includes(postId);
  const p = allPosts().find((x) => x.id === postId);
  btn.classList.toggle('liked', liked);
  btn.setAttribute('aria-pressed', String(liked));
  btn.innerHTML = `${liked ? '❤' : '🤍'} <span class="like-count">${(p?.likes || 0) + (liked ? 1 : 0)}</span>`;
}

function onComment(postId, form) {
  const input = form.querySelector('input[name="text"]');
  const text = (input.value || '').trim();
  if (!text) return;
  if (!STATE.extraComments[postId]) STATE.extraComments[postId] = [];
  STATE.extraComments[postId].push({ user: userById(ME).name, text, ts: Date.now() });
  saveState(STATE);
  // 목록 다시 그리기 (댓글창 열린 상태 유지)
  const card = form.closest('.card');
  const p = allPosts().find((x) => x.id === postId);
  card.outerHTML = renderPostCard(p);
  const box = $('#cm-' + CSS.escape(postId));
  if (box) box.hidden = false;
  toast('댓글을 남겼어요.');
}

function onUploadSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const category = fd.get('category');
  const title = (fd.get('title') || '').trim();
  const place = (fd.get('place') || '').trim();
  const text = (fd.get('text') || '').trim();
  const mtnId = fd.get('mountainId');
  if (!title || !place) return;
  const post = {
    id: 'up' + Date.now(),
    userId: ME,
    category,
    title,
    place,
    text: text || `${category} 기록을 남겼습니다.`,
    hue: userById(ME).hue,
    likes: 0,
    comments: [],
    createdAt: Date.now(),
  };
  if (category === '등산' && mtnId) {
    const m = mountainById(mtnId);
    if (m) {
      post.record = {
        mountainId: m.id,
        mountainName: m.name,
        elevation: m.elevation,
        famous100: !!m.famous100,
      };
      if (!post.place) post.place = `${m.region} ${m.name}`;
    }
  }
  STATE.userPosts.push(post);
  saveState(STATE);
  refreshBadges();
  toast('게시물을 올렸어요!');
  location.hash = '#/feed';
}

function onJoin(groupId) {
  const i = STATE.joinedGroups.indexOf(groupId);
  if (i >= 0) STATE.joinedGroups.splice(i, 1);
  else STATE.joinedGroups.push(groupId);
  saveState(STATE);
  refreshBadges();
  render();
}

function onReset() {
  if (!confirm('저장된 데모 데이터를 모두 초기화할까요?')) return;
  resetState();
  STATE = loadState();
  applyPrefs();
  toast('초기화되었습니다.');
  location.hash = '#/feed';
  render();
}

// ---------- 환경설정(큰 글씨/테마) ----------
function applyPrefs() {
  document.documentElement.classList.toggle('large-text', !!STATE.largeText);
  if (STATE.theme === 'light' || STATE.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', STATE.theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const lt = $('#toggle-large');
  if (lt) lt.setAttribute('aria-pressed', String(!!STATE.largeText));
}

function bindChrome() {
  // 햄버거(모바일 드로어)
  $('#hamburger').addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
  });
  // 스크림(어두운 배경) 클릭 시 드로어 닫기
  const scrim = $('.scrim');
  if (scrim) scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));
  // 큰 글씨
  $('#toggle-large').addEventListener('click', () => {
    STATE.largeText = !STATE.largeText;
    saveState(STATE);
    applyPrefs();
  });
  // 테마
  $('#toggle-theme').addEventListener('click', () => {
    const order = { auto: 'light', light: 'dark', dark: 'auto' };
    STATE.theme = order[STATE.theme] || 'auto';
    saveState(STATE);
    applyPrefs();
    toast('테마: ' + STATE.theme);
  });
}

// ---------- 데이터 로드 & 부트 ----------
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} 로드 실패 (${res.status})`);
  return res.json();
}

async function boot() {
  try {
    const [posts, mountains, users, groups] = await Promise.all([
      loadJSON('./data/posts.json'),
      loadJSON('./data/mountains.json'),
      loadJSON('./data/users.json'),
      loadJSON('./data/groups.json'),
    ]);
    DATA.posts = posts.posts;
    DATA.mountains = mountains.mountains;
    DATA.users = users.users;
    DATA.groups = groups.groups;
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="panel"><h2>데이터를 불러오지 못했어요</h2>
      <p class="muted">로컬 서버로 실행 중인지 확인해주세요. (예: <code>python -m http.server</code>)</p></div>`;
    return;
  }
  applyPrefs();
  bindChrome();
  bindGlobalDelegation();
  window.addEventListener('hashchange', render);
  render();
}

boot();
