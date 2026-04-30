#!/usr/bin/env node
/**
 * product_config.js — 상품 카테고리 설정
 * 각 상품별로 어떤 챕터/표를 포함할지 정의
 */
'use strict';

const PRODUCTS = {
  // ── 총본 (기존 전체) ──
  saju_full: {
    id: 'saju_full',
    name: '사주 총본',
    description: '사주명리 전체 해석서 (18장 완전판)',
    icon: '📖',
    chapters: ['ch00','ch01','ch02','ch03','ch04','ch05','ch06','ch_interior','ch07','ch08','ch09','ch09_jeon','ch10','ch11','ch14','ch15','ch16','ch17','ch18'],
    tables: 'all',
    pages_estimate: '350~400p',
    price_tier: 'premium',
  },

  // ── 사주 요약본 ──
  saju_summary: {
    id: 'saju_summary',
    name: '사주 요약본',
    description: '총본의 핵심만 추린 축약판 (8절 구성)',
    icon: '📋',
    chapters: ['ch_summary'], // 전용 템플릿 사용
    tables: ['cover','명식표','인적사항표','오행점수표','4신요약표','대운로드맵','연간운세요약표','인간관계표'],
    pages_estimate: '30~50p',
    price_tier: 'standard',
  },

  // ── 신수풀이 ──
  yearly_fortune: {
    id: 'yearly_fortune',
    name: '신수풀이',
    description: '올해 총운 + 월운풀이 + 운세달력',
    icon: '📅',
    chapters: ['ch00','ch10','ch09_jeon'],
    tables: ['cover','명식표','인적사항표','사주기본표','연간운세요약표','세운대운교차표','운세달력_*'],
    pages_estimate: '40~60p',
    price_tier: 'basic',
  },

  // ── 궁합분석 ──
  compatibility: {
    id: 'compatibility',
    name: '궁합분석',
    description: '두 사람 사주 비교 + 인간관계 궁합표',
    icon: '💑',
    chapters: ['ch00','ch02','ch15'],
    tables: ['cover','명식표','인적사항표','사주기본표','인간관계표','오행점수표'],
    pages_estimate: '30~50p',
    price_tier: 'standard',
    requires_partner: true, // 상대방 생년월일 필요
  },

  // ── 재물·직업운 ──
  wealth_career: {
    id: 'wealth_career',
    name: '재물·직업운',
    description: '재물운 + 직업 적합도 + 대운 흐름',
    icon: '💰',
    chapters: ['ch00','ch04','ch06','ch08','ch11'],
    tables: ['cover','명식표','인적사항표','사주기본표','오행점수표','4신요약표','격국분석표','대운로드맵','재물전략표','직업표','신강약직업표'],
    pages_estimate: '80~120p',
    price_tier: 'standard',
  },

  // ── 건강운 ──
  health: {
    id: 'health',
    name: '건강운',
    description: '오행 체질 + 건강 관리 + 양생법',
    icon: '🏥',
    chapters: ['ch00','ch04','ch12'],
    tables: ['cover','명식표','인적사항표','사주기본표','오행점수표','오행균형표','건강표','건강주의대운표','양생식품표','오행신체연관표'],
    pages_estimate: '40~60p',
    price_tier: 'basic',
  },

  // ── 기질분석 ──
  personality: {
    id: 'personality',
    name: '기질분석',
    description: '일주 분석 + 기질 + 강점·약점·방어책',
    icon: '🧠',
    chapters: ['ch00','ch02','ch_kijil','ch05'],
    tables: ['cover','명식표','인적사항표','사주기본표','오행점수표','기질판단표','십성배치표','십성계열분류표'],
    pages_estimate: '50~80p',
    price_tier: 'basic',
  },

  // ── 커스텀 (선택형) ──
  custom: {
    id: 'custom',
    name: '커스텀',
    description: '원하는 장을 선택하여 집필',
    icon: '✏️',
    chapters: [], // 사용자 선택
    tables: [], // 챕터에 따라 자동
    pages_estimate: '선택에 따라',
    price_tier: 'custom',
  },
};

// 챕터 메타 정보 (커스텀 상품에서 선택 시 표시)
const CHAPTER_META = {
  ch00:  { name: '서장', desc: '사주 소개 + 이 책의 안내', required: true },
  ch01:  { name: '1장 사주기초', desc: '천간·지지·음양·오행·60갑자' },
  ch02:  { name: '2장 일주분석', desc: '일간·일지·기질·생애패턴' },
  ch03:  { name: '3장 사주네기둥', desc: '년주·월주·시주 + 합충형파해' },
  ch04:  { name: '4장 오행분석', desc: '오행 점수·균형·태과불급' },
  ch05:  { name: '5장 십성', desc: '십성 배치·해석·인간관계' },
  ch06:  { name: '6장 용신', desc: '용신 실용가이드 + 인테리어' },
  ch_interior: { name: '6장 보충', desc: '인테리어·색상·방위 가이드' },
  ch07:  { name: '7장 지장간', desc: '지장간 분석·숨겨진 보물' },
  ch08:  { name: '8장 대운', desc: '대운 흐름·전환점·10년 주기' },
  ch09:  { name: '9장 전환점', desc: '5대 전환점 분석' },
  ch09_jeon: { name: '9장 보충', desc: '전환점 상세' },
  ch10:  { name: '10장 올해운세', desc: '세운·월운·운세달력' },
  ch11:  { name: '11장 기질', desc: '타고난 기질 + 재물·직업' },
  ch12:  { name: '12장 건강', desc: '건강·양생·체질' },
  ch14:  { name: '14장 가족', desc: '가족관계·배우자·자녀' },
  ch15:  { name: '15장 인맥', desc: '귀인·인간관계 궁합' },
  ch16:  { name: '16장 시련', desc: '시련·극복 전략' },
  ch17:  { name: '종장', desc: '마무리 + 100년 편지' },
  ch18:  { name: '부록', desc: '용어해설·연구소안내' },
  ch_kijil: { name: '기질심화', desc: '기질 방어책·나이대별 변화' },
};

module.exports = { PRODUCTS, CHAPTER_META };
