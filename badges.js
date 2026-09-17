// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// badges.js — 규칙 기반 배지 자동 획득 모듈 (Rule-based badge awarding)
// =====================================================================
// 이 모듈은 순수 함수(pure function)로만 구성되어 브라우저와 Node(테스트)
// 양쪽에서 동일하게 동작합니다. DOM/스토리지 의존성이 없습니다.
//
// 사용 흐름:
//   1) 앱이 사용자 활동을 집계해 stats 객체를 만든다 (buildStats)
//   2) evaluateBadges(stats) 가 규칙을 평가해 획득한 배지 id 배열을 돌려준다
//   3) 앱은 새로 획득한 배지를 저장/표시한다
//
// stats 스키마 (모든 필드는 숫자, 없으면 0으로 간주):
//   climbs           총 등정 횟수
//   totalElevation   누적 고도(m)
//   distinctMountains 서로 다른 산 개수
//   distinctFamous100 서로 다른 "100대 명산" 개수
//   photoPosts       사진 취미 게시물 수
//   posts            총 게시물 수
//   likesGiven       내가 누른 좋아요 수
//   groupsJoined     가입한 모임 수

/**
 * 배지 정의 목록. 각 배지는 rule(stats) => boolean 규칙을 가진다.
 * rule 이 true 를 반환하면 해당 배지를 자동 획득한다.
 */
export const BADGES = [
  {
    id: 'first_post',
    name: '첫 기록',
    desc: '첫 게시물을 올렸어요.',
    hue: 205,
    // 규칙: 게시물 1개 이상
    rule: (s) => (s.posts || 0) >= 1,
  },
  {
    id: 'first_summit',
    name: '첫 정상',
    desc: '처음으로 산 정상에 올랐어요.',
    hue: 145,
    // 규칙: 등정 1회 이상
    rule: (s) => (s.climbs || 0) >= 1,
  },
  {
    id: 'climbs_10',
    name: '10회 등반',
    desc: '누적 10회 산에 올랐어요.',
    hue: 130,
    // 규칙: 등정 10회 이상
    rule: (s) => (s.climbs || 0) >= 10,
  },
  {
    id: 'climbs_50',
    name: '산악인',
    desc: '누적 50회 등반 달성.',
    hue: 120,
    // 규칙: 등정 50회 이상
    rule: (s) => (s.climbs || 0) >= 50,
  },
  {
    id: 'famous100_start',
    name: '명산 입문',
    desc: '100대 명산 중 첫 봉우리를 밟았어요.',
    hue: 35,
    // 규칙: 서로 다른 100대 명산 1개 이상
    rule: (s) => (s.distinctFamous100 || 0) >= 1,
  },
  {
    id: 'famous100_10',
    name: '100대 명산 도전',
    desc: '100대 명산 중 10곳을 올랐어요.',
    hue: 25,
    // 규칙: 서로 다른 100대 명산 10개 이상
    rule: (s) => (s.distinctFamous100 || 0) >= 10,
  },
  {
    id: 'famous100_all',
    name: '100대 명산 완등',
    desc: '대한민국 100대 명산을 모두 완등했어요!',
    hue: 15,
    // 규칙: 서로 다른 100대 명산 100개 이상
    rule: (s) => (s.distinctFamous100 || 0) >= 100,
  },
  {
    id: 'elev_10k',
    name: '누적 1만 미터',
    desc: '누적 고도 10,000m를 넘었어요.',
    hue: 265,
    // 규칙: 누적 고도 10,000m 이상
    rule: (s) => (s.totalElevation || 0) >= 10000,
  },
  {
    id: 'elev_50k',
    name: '하늘 사다리',
    desc: '누적 고도 50,000m 돌파 (에베레스트 약 5.6배).',
    hue: 285,
    // 규칙: 누적 고도 50,000m 이상
    rule: (s) => (s.totalElevation || 0) >= 50000,
  },
  {
    id: 'shutterbug',
    name: '사진가',
    desc: '사진 취미 게시물 5개를 올렸어요.',
    hue: 320,
    // 규칙: 사진 카테고리 게시물 5개 이상
    rule: (s) => (s.photoPosts || 0) >= 5,
  },
  {
    id: 'community',
    name: '모임 지기',
    desc: '취미 모임 3개에 가입했어요.',
    hue: 180,
    // 규칙: 가입한 모임 3개 이상
    rule: (s) => (s.groupsJoined || 0) >= 3,
  },
  {
    id: 'cheerful',
    name: '응원 요정',
    desc: '좋아요를 20번 눌러 이웃을 응원했어요.',
    hue: 5,
    // 규칙: 내가 누른 좋아요 20회 이상
    rule: (s) => (s.likesGiven || 0) >= 20,
  },
];

/**
 * stats 를 평가해 획득한 배지 id 배열을 반환한다 (순수 함수).
 * @param {object} stats
 * @returns {string[]} 획득한 배지 id 목록 (BADGES 정의 순서)
 */
export function evaluateBadges(stats) {
  const s = stats || {};
  return BADGES.filter((b) => {
    try {
      return !!b.rule(s);
    } catch {
      return false;
    }
  }).map((b) => b.id);
}

/**
 * 이전 획득 목록과 비교해 "이번에 새로 획득한" 배지 id 배열을 반환한다.
 * @param {object} stats
 * @param {string[]} previouslyEarned
 * @returns {string[]}
 */
export function newlyEarned(stats, previouslyEarned = []) {
  const before = new Set(previouslyEarned);
  return evaluateBadges(stats).filter((id) => !before.has(id));
}

/** id 로 배지 정의를 찾는다. */
export function getBadge(id) {
  return BADGES.find((b) => b.id === id) || null;
}
