// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/config.js — AI 레이어 설정 (프론트엔드 전용, 키 없음)
// =========================================================
// AI_ENDPOINT 가 빈 문자열("")이면 앱은 브라우저 내부의 결정론적 한국어
// 목업(MockProvider)으로 동작합니다. 실제 Claude 연동을 켜려면 server/ 를
// 실행한 뒤 그 프록시 주소(예: "http://localhost:8787/api/ai")를 넣으세요.
//
// ⚠️ 보안: 절대 이 파일이나 브라우저 코드에 API 키를 넣지 마세요.
//    API 키는 오직 server/ 백엔드의 환경변수(ANTHROPIC_API_KEY)로만 둡니다.
export const AI_ENDPOINT = "";
