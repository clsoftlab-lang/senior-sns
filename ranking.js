// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ranking.js — 리더보드 정렬 로직 (pure, testable)
// ==================================================
// 랭킹 항목(entry) 스키마:
//   { userId, name, monthlyClimbs, totalElevation, ... }
// 모든 함수는 입력 배열을 변형하지 않고 정렬된 새 배열을 반환한다.

/**
 * 지정한 숫자 키로 내림차순 정렬. 동점이면 tiebreakKey 내림차순,
 * 그래도 같으면 name 오름차순(로캘)으로 안정 정렬한다.
 * @param {Array<object>} entries
 * @param {string} key           1차 정렬 키 (내림차순)
 * @param {string} [tiebreakKey] 동점 시 2차 키 (내림차순)
 * @returns {Array<object>} 새 배열
 */
export function rankBy(entries, key, tiebreakKey) {
  return [...(entries || [])].sort((a, b) => {
    const av = Number(a[key]) || 0;
    const bv = Number(b[key]) || 0;
    if (bv !== av) return bv - av;
    if (tiebreakKey) {
      const at = Number(a[tiebreakKey]) || 0;
      const bt = Number(b[tiebreakKey]) || 0;
      if (bt !== at) return bt - at;
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
  });
}

/** 월간 등정 횟수 리더보드 (동점 시 누적 고도로 비교). */
export function rankByMonthlyClimbs(entries) {
  return rankBy(entries, 'monthlyClimbs', 'totalElevation');
}

/** 누적 고도 리더보드 (동점 시 월간 등정 횟수로 비교). */
export function rankByElevation(entries) {
  return rankBy(entries, 'totalElevation', 'monthlyClimbs');
}

/**
 * 정렬된 목록에 1부터 순위(rank)를 매겨 반환한다.
 * 동점 처리는 하지 않는 단순 순번(리더보드 표시용).
 */
export function withRank(sortedEntries) {
  return (sortedEntries || []).map((e, i) => ({ ...e, rank: i + 1 }));
}
