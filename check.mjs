// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// check.mjs — CI 검증 스크립트 (외부 의존성 없음, Node 내장만 사용)
// ================================================================
//   1) data/*.json 파싱 검증
//   2) 모든 JS 파일 `node --check` 문법 검증
//   3) index.html 필수 컨테이너 존재 검증
//   4) badges.js 규칙 로직 단위 테스트
//   5) ranking.js 정렬 로직 단위 테스트
// 하나라도 실패하면 종료 코드 1.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BADGES, evaluateBadges, newlyEarned, getBadge } from './badges.js';
import { rankBy, rankByMonthlyClimbs, rankByElevation, withRank } from './ranking.js';
import { AI_ENDPOINT } from './ai/config.js';
import { AI_TASKS, askAI } from './ai/ai.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
function ok(name) { pass++; console.log('  ✓ ' + name); }
function bad(name, detail) { fail++; console.error('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
function assert(cond, name, detail) { cond ? ok(name) : bad(name, detail); }
function eq(a, b, name) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  A === B ? ok(name) : bad(name, `expected ${B}, got ${A}`);
}

// ---------- 1) JSON 파싱 ----------
console.log('\n[1] JSON 데이터 파싱');
const dataDir = join(ROOT, 'data');
const jsonFiles = readdirSync(dataDir).filter((f) => f.endsWith('.json'));
assert(jsonFiles.length >= 4, 'data/*.json 4개 이상 존재', `found ${jsonFiles.length}`);
let posts, mountains, groups, users;
for (const f of jsonFiles) {
  try {
    const obj = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
    ok(`파싱: data/${f}`);
    if (f === 'posts.json') posts = obj.posts;
    if (f === 'mountains.json') mountains = obj.mountains;
    if (f === 'groups.json') groups = obj.groups;
    if (f === 'users.json') users = obj.users;
  } catch (e) {
    bad(`파싱: data/${f}`, e.message);
  }
}
assert(Array.isArray(posts) && posts.length >= 30, '게시물 30개 이상', `got ${posts?.length}`);
assert(Array.isArray(mountains) && mountains.length >= 10, '산 10개 이상', `got ${mountains?.length}`);
assert(Array.isArray(groups) && groups.length >= 4, '모임 4개 이상', `got ${groups?.length}`);
assert(Array.isArray(users) && users.length >= 4, '사용자 4개 이상', `got ${users?.length}`);
// 게시물이 유효한 사용자/산을 참조하는지
if (posts && users && mountains) {
  const uids = new Set(users.map((u) => u.id));
  const mids = new Set(mountains.map((m) => m.id));
  const badRef = posts.filter((p) => !uids.has(p.userId) || (p.record && !mids.has(p.record.mountainId)));
  assert(badRef.length === 0, '게시물의 사용자/산 참조 무결성', `${badRef.length} broken refs`);
}

// ---------- 2) node --check 모든 JS ----------
console.log('\n[2] JS 문법 검사 (node --check)');
function collectJs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.github'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collectJs(full));
    else if (/\.(m?js)$/.test(name)) out.push(full);
  }
  return out;
}
for (const file of collectJs(ROOT)) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    ok('문법 OK: ' + file.replace(ROOT, '.').replace(/\\/g, '/'));
  } catch (e) {
    bad('문법 오류: ' + file, (e.stderr || e).toString().split('\n')[0]);
  }
}

// ---------- 3) index.html 필수 컨테이너 ----------
console.log('\n[3] index.html 필수 컨테이너');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const required = [
  ['id="app"', /id="app"/],
  ['id="view"', /id="view"/],
  ['id="nav"', /id="nav"/],
  ['id="hamburger"', /id="hamburger"/],
  ['module script app.js', /<script[^>]+type="module"[^>]+src="\.\/app\.js"/],
  ['data-route 링크', /data-route="/],
  ['lang="ko"', /lang="ko"/],
  ['viewport meta', /name="viewport"/],
];
for (const [name, re] of required) assert(re.test(html), '포함: ' + name);
// 7개 라우트 모두 존재
for (const r of ['feed', 'ai', 'upload', 'records', 'badges', 'ranking', 'groups', 'profile']) {
  assert(new RegExp(`data-route="${r}"`).test(html), `라우트 링크: ${r}`);
}

// ---------- 4) badges.js 규칙 단위 테스트 ----------
console.log('\n[4] badges.js 규칙 로직');
eq(evaluateBadges({}), [], '빈 통계 → 배지 없음');
assert(evaluateBadges({ posts: 1 }).includes('first_post'), 'posts>=1 → first_post');
assert(evaluateBadges({ climbs: 1 }).includes('first_summit'), 'climbs>=1 → first_summit');
{
  const b = evaluateBadges({ climbs: 10 });
  assert(b.includes('first_summit') && b.includes('climbs_10'), 'climbs=10 → first_summit+climbs_10');
  assert(!b.includes('climbs_50'), 'climbs=10 → climbs_50 아님');
}
assert(evaluateBadges({ climbs: 50 }).includes('climbs_50'), 'climbs>=50 → climbs_50');
assert(evaluateBadges({ distinctFamous100: 1 }).includes('famous100_start'), 'famous100=1 → start');
assert(evaluateBadges({ distinctFamous100: 10 }).includes('famous100_10'), 'famous100=10 → 도전');
assert(evaluateBadges({ distinctFamous100: 100 }).includes('famous100_all'), 'famous100=100 → 완등');
assert(!evaluateBadges({ distinctFamous100: 99 }).includes('famous100_all'), 'famous100=99 → 완등 아님');
assert(evaluateBadges({ totalElevation: 10000 }).includes('elev_10k'), 'elev>=10000 → elev_10k');
assert(evaluateBadges({ totalElevation: 50000 }).includes('elev_50k'), 'elev>=50000 → elev_50k');
assert(!evaluateBadges({ totalElevation: 9999 }).includes('elev_10k'), 'elev=9999 → 미획득');
assert(evaluateBadges({ photoPosts: 5 }).includes('shutterbug'), 'photoPosts>=5 → shutterbug');
assert(evaluateBadges({ groupsJoined: 3 }).includes('community'), 'groupsJoined>=3 → community');
assert(evaluateBadges({ likesGiven: 20 }).includes('cheerful'), 'likesGiven>=20 → cheerful');
// newlyEarned: 이미 가진 것은 제외
eq(newlyEarned({ posts: 1, climbs: 1 }, ['first_post']), ['first_summit'], 'newlyEarned 신규만 반환');
eq(newlyEarned({ posts: 1 }, ['first_post']), [], 'newlyEarned 새 배지 없음');
// 규칙 결과 순서 = 정의 순서
{
  const all = evaluateBadges({ posts: 1, climbs: 50, distinctFamous100: 100, totalElevation: 50000, photoPosts: 5, groupsJoined: 3, likesGiven: 20 });
  eq(all, BADGES.map((b) => b.id), '모든 조건 충족 → 전체 배지(정의 순서)');
}
assert(getBadge('first_summit')?.name === '첫 정상', 'getBadge 조회');
assert(getBadge('nope') === null, 'getBadge 없는 id → null');
// 잘못된 rule 이 던져도 안전
assert(Array.isArray(evaluateBadges(null)), 'evaluateBadges(null) 안전');

// ---------- 5) ranking.js 정렬 단위 테스트 ----------
console.log('\n[5] ranking.js 정렬 로직');
const sample = [
  { userId: 'a', name: '가', monthlyClimbs: 2, totalElevation: 3000 },
  { userId: 'b', name: '나', monthlyClimbs: 5, totalElevation: 1000 },
  { userId: 'c', name: '다', monthlyClimbs: 2, totalElevation: 8000 },
  { userId: 'd', name: '라', monthlyClimbs: 5, totalElevation: 1000 },
];
{
  const r = rankByMonthlyClimbs(sample);
  eq(r.map((e) => e.userId), ['b', 'd', 'c', 'a'], '월간등정 내림차순 + 동점 고도/이름');
  // b,d 동점(5회,1000m) → 이름순 나<라 이므로 b 먼저
  eq(r[0].userId, 'b', '동점 시 이름 오름차순 안정');
}
{
  const r = rankByElevation(sample);
  eq(r.map((e) => e.userId), ['c', 'a', 'b', 'd'], '누적고도 내림차순 + 동점 월간등정/이름');
}
{
  const ranked = withRank(rankByMonthlyClimbs(sample));
  eq(ranked.map((e) => e.rank), [1, 2, 3, 4], 'withRank 1..n 부여');
}
{
  const before = JSON.stringify(sample);
  rankByMonthlyClimbs(sample);
  rankByElevation(sample);
  assert(JSON.stringify(sample) === before, '원본 배열 불변(순수 함수)');
}
eq(rankBy([], 'monthlyClimbs'), [], '빈 배열 정렬 안전');
{
  // 문자/누락 값도 0으로 처리
  const r = rankBy([{ name: 'x' }, { name: 'y', v: 3 }], 'v');
  eq(r[0].name, 'y', '누락 필드 0 처리');
}

// ---------- 6) AI 레이어 검증 ----------
console.log('\n[6] AI 레이어 (문법 · 설정 · 목업 · 키 스캔)');
const rel = (f) => f.replace(ROOT, '.').replace(/\\/g, '/');

// 6a) ai/ + server/ 폴더의 JS 를 명시적으로 node --check
for (const dir of ['ai', 'server']) {
  const full = join(ROOT, dir);
  let files = [];
  try { files = collectJs(full); } catch { /* 폴더 없음 */ }
  assert(files.length >= 1, `${dir}/ JS 파일 존재`, `found ${files.length}`);
  for (const file of files) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      ok('문법 OK: ' + rel(file));
    } catch (e) {
      bad('문법 오류: ' + rel(file), (e.stderr || e).toString().split('\n')[0]);
    }
  }
}

// 6b) 데모는 반드시 목업(빈 엔드포인트)로 동작 — 브라우저에 엔드포인트/키 노출 금지
assert(AI_ENDPOINT === '', 'AI_ENDPOINT 는 데모에서 빈 문자열', `got ${JSON.stringify(AI_ENDPOINT)}`);
assert(Array.isArray(AI_TASKS) && AI_TASKS.length === 3, 'AI_TASKS 3종 정의');

// 6c) 목업이 앱 데이터를 재사용해 결정론적으로 동작하는지
{
  const sampleMtn = (mountains || []).filter((m) => (m.season || []).includes('가을'));
  const reco = await askAI('recommend', { season: '가을', level: '', mountains: sampleMtn });
  assert(typeof reco === 'string' && reco.length > 0, 'mock recommend 문자열 반환');
  if (sampleMtn[0]) assert(reco.includes(sampleMtn[0].name) || reco.includes('산'), 'mock recommend 앱 산 데이터 반영');

  const badge = BADGES[0];
  const congrats = await askAI('congrats', { badgeId: badge.id });
  assert(congrats.includes(badge.name), 'mock congrats 배지 데이터 반영');

  const draft = await askAI('draft', { title: '가을 산행', category: '등산', place: '북한산' });
  assert(draft.includes('가을 산행') && draft.includes('북한산'), 'mock draft 입력 반영');
}

// 6d) 저장소 어디에도 실제 API 키 형식이 없어야 함 (.env 는 스캔 제외 — 실제 키가 정상적으로 존재)
{
  const KEY_RE = new RegExp("sk-" + "ant-[A-Za-z0-9_-]{20,}");
  function collectAll(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.git', '.github'].includes(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) out.push(...collectAll(full));
      else out.push(full);
    }
    return out;
  }
  const leaks = [];
  for (const file of collectAll(ROOT)) {
    const base = file.split(/[\\/]/).pop();
    if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    if (KEY_RE.test(content)) leaks.push(rel(file));
  }
  assert(leaks.length === 0, '실제 API 키 형식 미포함(저장소 전체 스캔)', leaks.join(', '));
}

// ---------- 결과 ----------
console.log(`\n결과: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log('모든 검사 통과 ✅');
