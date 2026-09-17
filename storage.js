// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// storage.js — localStorage 영속화 래퍼 (try/catch 안전 처리 + 초기화)
// =====================================================================
// 브라우저 저장소가 없거나(프라이빗 모드 등) 접근이 막혀도 앱이 죽지 않도록
// 모든 접근을 try/catch 로 감싼다. 실패 시 인메모리 기본값으로 동작한다.

const KEY = 'jicheonmyeong.v1';

/** 데모 시작 시의 기본 상태. */
export function defaultState() {
  return {
    likedPosts: [],      // 좋아요 누른 게시물 id
    extraComments: {},    // { postId: [{user,text,ts}] } — 사용자가 단 댓글
    userPosts: [],        // 사용자가 올린 게시물
    joinedGroups: [],     // 가입한 모임 id
    earnedBadges: [],     // 획득한 배지 id
    largeText: false,      // 큰 글씨 옵션
    theme: 'auto',         // auto | light | dark
  };
}

/** 상태를 불러온다. 실패하면 기본값을 반환한다. */
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    console.warn('[storage] load 실패, 기본값 사용:', e);
    return defaultState();
  }
}

/** 상태를 저장한다. 실패해도 조용히 무시(앱 계속 동작). */
export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('[storage] save 실패(무시):', e);
    return false;
  }
}

/** 저장된 데모 데이터를 초기화한다. */
export function resetState() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch (e) {
    console.warn('[storage] reset 실패:', e);
    return false;
  }
}
