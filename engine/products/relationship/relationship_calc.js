/**
 * engine/products/relationship/relationship_calc.js
 * ─────────────────────────────────────────────────────────────
 * 인간관계도 계산 엔진
 *
 *   - saju_calc만 의존 (compatibility_calc 호출 안 함)
 *   - 관계 유형별 가중치 16종 분기
 *   - 패턴 진단 16가지 (운명적 갈등·인연 자동 감지)
 *   - N명 일괄 분석: 본인 ↔ 각 person
 *
 * 사용:
 *   const { 관계분석 } = require('./relationship_calc');
 *   const r = 관계분석(meInput, otherInput, '부모자녀');
 * ─────────────────────────────────────────────────────────────
 */
'use strict';
const { 전체사주계산 } = require('../../saju_calc');

// ── 매핑 테이블 ───────────────────────────────────────────
const 천간오행 = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const 지지오행 = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const 천간음양 = {甲:'양',乙:'음',丙:'양',丁:'음',戊:'양',己:'음',庚:'양',辛:'음',壬:'양',癸:'음'};
const 천간한 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const 지지한 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};

// 천간합쌍 (음양 정합 상생)
const 천간합 = {甲:'己',己:'甲', 乙:'庚',庚:'乙', 丙:'辛',辛:'丙', 丁:'壬',壬:'丁', 戊:'癸',癸:'戊'};
// 천간충 (정극)
const 천간충 = {甲:'庚',庚:'甲', 乙:'辛',辛:'乙', 丙:'壬',壬:'丙', 丁:'癸',癸:'丁'};
// 지지육합
const 지지육합 = {子:'丑',丑:'子', 寅:'亥',亥:'寅', 卯:'戌',戌:'卯', 辰:'酉',酉:'辰', 巳:'申',申:'巳', 午:'未',未:'午'};
// 지지충
const 지지충 = {子:'午',午:'子', 丑:'未',未:'丑', 寅:'申',申:'寅', 卯:'酉',酉:'卯', 辰:'戌',戌:'辰', 巳:'亥',亥:'巳'};
// 지지삼합
const 삼합국 = [['寅','午','戌'],['亥','卯','未'],['巳','酉','丑'],['申','子','辰']];
// 지지원진살 — 정서적 미움
const 원진 = {子:'未',未:'子', 丑:'午',午:'丑', 寅:'酉',酉:'寅', 卯:'申',申:'卯', 辰:'亥',亥:'辰', 巳:'戌',戌:'巳'};
// 지지귀문관살 — 정신적 압박
const 귀문 = {子:'酉',酉:'子', 丑:'午',午:'丑', 寅:'未',未:'寅', 卯:'申',申:'卯', 辰:'亥',亥:'辰', 巳:'戌',戌:'巳'};

// 상생/상극
const 상생 = {木:'火',火:'土',土:'金',金:'水',水:'木'};
const 상극 = {木:'土',火:'金',土:'水',金:'木',水:'火'};

// 십성: 일간 기준 상대 천간/지지오행 → 십성명
function 십성판정(일간, 대상오행, 대상음양) {
  const 일간오행 = 천간오행[일간];
  const 일간음양 = 천간음양[일간];
  if (!일간오행 || !대상오행) return '';
  const 동음양 = 일간음양 === 대상음양;
  if (대상오행 === 일간오행)        return 동음양 ? '비견' : '겁재';
  if (상생[일간오행] === 대상오행)  return 동음양 ? '식신' : '상관';
  if (상극[일간오행] === 대상오행)  return 동음양 ? '편재' : '정재';
  if (상극[대상오행] === 일간오행)  return 동음양 ? '편관' : '정관';
  if (상생[대상오행] === 일간오행)  return 동음양 ? '편인' : '정인';
  return '';
}

// 십성 → 카테고리 (역할 분류용)
function 십성카테고리(십성) {
  if (['비견','겁재'].includes(십성)) return '비겁';
  if (['식신','상관'].includes(십성)) return '식상';
  if (['편재','정재'].includes(십성)) return '재성';
  if (['편관','정관'].includes(십성)) return '관성';
  if (['편인','정인'].includes(십성)) return '인성';
  return '';
}

// ─────────────────────────────────────────────────────────
// 관계 유형별 가중치 (10개 축 합계 1.0)
// 각 축: 일간상성, 오행보완, 용신교차, 합충교차, 십성관계, 친밀도, 대운시기, 인연깊이, 년주관계, 시주관계
// ─────────────────────────────────────────────────────────
const RELATION_WEIGHTS = {
  // 부부·연인 — 기존 궁합 그대로
  '연인':       { 일간상성:0.15, 오행보완:0.15, 용신교차:0.15, 합충교차:0.10, 십성관계:0.10, 친밀도:0.15, 대운시기:0.10, 인연깊이:0.10 },
  '부부':       { 일간상성:0.15, 오행보완:0.15, 용신교차:0.15, 합충교차:0.10, 십성관계:0.10, 친밀도:0.15, 대운시기:0.10, 인연깊이:0.10 },

  // 가족 6종
  '부모자녀':   { 일간상성:0.20, 오행보완:0.20, 용신교차:0.10, 십성관계:0.30, 일지관계:0.10, 인연깊이:0.10 },
  '형제자매':   { 일간상성:0.30, 오행보완:0.20, 일지관계:0.20, 십성관계:0.15, 인연깊이:0.15 },
  '시댁처가':   { 일간상성:0.25, 십성관계:0.25, 신살교차:0.20, 오행보완:0.15, 일지관계:0.15 },
  '조부모손주': { 년주관계:0.30, 시주관계:0.30, 인연깊이:0.20, 오행보완:0.20 },
  '친척':       { 인연깊이:0.30, 일지관계:0.25, 오행보완:0.20, 일간상성:0.15, 신살교차:0.10 },

  // 직장 4종
  '직장상사':   { 십성관계:0.35, 용신교차:0.25, 일간상성:0.15, 일지관계:0.10, 신살교차:0.15 },
  '직장동료':   { 십성관계:0.30, 용신교차:0.25, 일간상성:0.20, 일지관계:0.15, 신살교차:0.10 },
  '직장부하':   { 십성관계:0.35, 용신교차:0.25, 일간상성:0.15, 일지관계:0.10, 신살교차:0.15 },
  '비즈니스':   { 용신교차:0.25, 십성관계:0.25, 오행보완:0.20, 일간상성:0.15, 인연깊이:0.15 },

  // 친구·기타
  '친구':       { 일간상성:0.25, 오행보완:0.25, 인연깊이:0.20, 일지관계:0.15, 용신교차:0.15 },
  '스승':       { 십성관계:0.35, 인연깊이:0.20, 용신교차:0.20, 오행보완:0.15, 일간상성:0.10 },
  '제자':       { 십성관계:0.35, 인연깊이:0.20, 용신교차:0.20, 오행보완:0.15, 일간상성:0.10 },
  '경쟁자':     { 일간상성:0.30, 합충교차:0.30, 신살교차:0.20, 십성관계:0.20 },
  '기타':       { 일간상성:0.20, 오행보완:0.20, 용신교차:0.20, 십성관계:0.15, 일지관계:0.15, 인연깊이:0.10 },
};

const ALL_RELATION_TYPES = Object.keys(RELATION_WEIGHTS);

// ─────────────────────────────────────────────────────────
// 점수 계산 함수 — 각 축당 0~100
// ─────────────────────────────────────────────────────────
function calc일간상성(A, B) {
  const a = A.일간, b = B.일간;
  const aOh = 천간오행[a], bOh = 천간오행[b];
  if (a === b) return 70;                                // 같은 일간
  if (천간합[a] === b) return 90;                        // 천간합
  if (천간충[a] === b) return 30;                        // 천간충
  if (aOh === bOh) return 65;                            // 비화
  if (상생[aOh] === bOh || 상생[bOh] === aOh) return 75; // 상생
  if (상극[aOh] === bOh || 상극[bOh] === aOh) return 45; // 상극
  return 55;
}

function calc오행보완(A, B) {
  const aS = A.오행점수 || {}, bS = B.오행점수 || {};
  const 키 = ['木','火','土','金','水'];
  const aSum = 키.reduce((s,k)=>s+(aS[k]||0),0) || 1;
  const bSum = 키.reduce((s,k)=>s+(bS[k]||0),0) || 1;
  // 본인이 부족한 오행을 상대가 가지고 있으면 가산
  let score = 50;
  for (const k of 키) {
    const aPct = (aS[k]||0)/aSum;
    const bPct = (bS[k]||0)/bSum;
    if (aPct < 0.10 && bPct > 0.20) score += 8;          // 본인 부족 → 상대가 채움
    if (bPct < 0.10 && aPct > 0.20) score += 8;          // 반대도
    if (aPct > 0.40 && bPct > 0.40 && k === A.용신) score -= 5; // 용신 과다 중복은 부담
  }
  return Math.max(20, Math.min(95, score));
}

function calc용신교차(A, B) {
  let score = 50;
  if (B.일간오행 === A.용신) score += 25;                // 상대가 본인 용신
  if (A.일간오행 === B.용신) score += 25;
  if (B.일간오행 === A.기신) score -= 15;                // 상대가 본인 기신
  if (A.일간오행 === B.기신) score -= 15;
  if (B.일간오행 === A.희신) score += 12;
  if (A.일간오행 === B.희신) score += 12;
  return Math.max(20, Math.min(95, score));
}

function calc합충교차(A, B) {
  const a간 = [A.원국.년주.천간, A.원국.월주.천간, A.원국.일주.천간, A.원국.시주.천간];
  const b간 = [B.원국.년주.천간, B.원국.월주.천간, B.원국.일주.천간, B.원국.시주.천간];
  const a지 = [A.원국.년주.지지, A.원국.월주.지지, A.원국.일주.지지, A.원국.시주.지지];
  const b지 = [B.원국.년주.지지, B.원국.월주.지지, B.원국.일주.지지, B.원국.시주.지지];
  let score = 50;
  for (const x of a간) for (const y of b간) {
    if (천간합[x] === y) score += 5;
    if (천간충[x] === y) score -= 4;
  }
  for (const x of a지) for (const y of b지) {
    if (x === y) score += 4;                             // 동일 지지
    if (지지육합[x] === y) score += 6;
    if (지지충[x] === y) score -= 5;
  }
  return Math.max(20, Math.min(95, score));
}

function calc십성관계(A, B) {
  // B가 A의 일간 기준으로 어떤 십성인지
  const 십성 = 십성판정(A.일간, B.일간오행, 천간음양[B.일간]);
  const cat = 십성카테고리(십성);
  // 역할 호환성:
  //   인성(나에게 도움)·식상(내가 베품)·재성(내가 다스림)·관성(나를 다스림) — 명확 역할
  //   비겁 — 동등·경쟁 양면
  if (cat === '인성') return 80;                         // 멘토·후원자
  if (cat === '식상') return 75;                         // 후배·자식 또는 표현 대상
  if (cat === '재성') return 70;                         // 다스리는 대상
  if (cat === '관성') return 70;                         // 따르는 대상
  if (cat === '비겁') return 십성 === '비견' ? 65 : 55;  // 비견은 협력, 겁재는 경쟁
  return 50;
}

function calc친밀도(A, B) {
  // 일지(배우자궁) 관계 + 시지(자녀궁) 관계
  const aIlji = A.원국.일주.지지, bIlji = B.원국.일주.지지;
  const aShiji = A.원국.시주.지지, bShiji = B.원국.시주.지지;
  let score = 50;
  if (aIlji === bIlji) score += 15;                      // 일지 동일
  if (지지육합[aIlji] === bIlji) score += 18;            // 일지 육합
  if (지지충[aIlji] === bIlji) score -= 15;              // 일지 충
  if (삼합국.some(s => s.includes(aIlji) && s.includes(bIlji) && aIlji!==bIlji)) score += 12;
  if (지지육합[aShiji] === bShiji) score += 6;
  return Math.max(20, Math.min(95, score));
}

function calc대운시기(A, B) {
  // 두 사람 좋은 대운(용신·희신)이 겹치는 시기
  const aDae = A.대운목록 || [];
  const bDae = B.대운목록 || [];
  let overlap = 0, total = 0;
  for (const ad of aDae.slice(0, 8)) {
    for (const bd of bDae.slice(0, 8)) {
      if (Math.abs((ad.시작나이 || 0) - (bd.시작나이 || 0)) <= 5) {
        total++;
        if ((ad.길흉 || '').match(/용신|희신/) && (bd.길흉 || '').match(/용신|희신/)) overlap++;
      }
    }
  }
  if (total === 0) return 50;
  return Math.max(30, Math.min(90, 40 + (overlap/total) * 50));
}

function calc인연깊이(A, B) {
  // 삼합 / 천간합쌍 / 동일 일주 등 깊은 인연 지표
  let score = 50;
  const aIlji = A.원국.일주.지지, bIlji = B.원국.일주.지지;
  // 삼합 (일지 기준)
  if (삼합국.some(s => s.includes(aIlji) && s.includes(bIlji) && aIlji !== bIlji)) score += 18;
  // 천간합 (일간)
  if (천간합[A.일간] === B.일간) score += 15;
  // 동일 일주
  if (A.일간 === B.일간 && aIlji === bIlji) score += 10;
  // 원진 (정서적 미움)
  if (원진[aIlji] === bIlji) score -= 12;
  // 귀문관살
  if (귀문[aIlji] === bIlji) score -= 10;
  return Math.max(20, Math.min(95, score));
}

function calc년주관계(A, B) {
  // 조부모-손주: 본인 일주 ↔ 상대 년주 비교 우선
  const aIlji = A.원국.일주.지지, bYearJi = B.원국.년주.지지;
  let score = 50;
  if (aIlji === bYearJi) score += 12;
  if (지지육합[aIlji] === bYearJi) score += 18;
  if (삼합국.some(s => s.includes(aIlji) && s.includes(bYearJi) && aIlji!==bYearJi)) score += 15;
  if (지지충[aIlji] === bYearJi) score -= 15;
  return Math.max(20, Math.min(95, score));
}

function calc시주관계(A, B) {
  const aIlji = A.원국.일주.지지, bShiji = B.원국.시주.지지;
  let score = 50;
  if (지지육합[aIlji] === bShiji) score += 18;
  if (삼합국.some(s => s.includes(aIlji) && s.includes(bShiji) && aIlji!==bShiji)) score += 14;
  if (지지충[aIlji] === bShiji) score -= 12;
  return Math.max(20, Math.min(95, score));
}

function calc일지관계(A, B) {
  return calc친밀도(A, B); // alias
}

function calc신살교차(A, B) {
  // 원진·귀문·삼형 위주
  const aIlji = A.원국.일주.지지, bIlji = B.원국.일주.지지;
  let score = 50;
  if (원진[aIlji] === bIlji) score -= 18;
  if (귀문[aIlji] === bIlji) score -= 15;
  if (지지충[aIlji] === bIlji) score -= 12;
  if (지지육합[aIlji] === bIlji) score += 10;
  return Math.max(20, Math.min(95, score));
}

const SCORE_FNS = {
  일간상성: calc일간상성,
  오행보완: calc오행보완,
  용신교차: calc용신교차,
  합충교차: calc합충교차,
  십성관계: calc십성관계,
  친밀도: calc친밀도,
  대운시기: calc대운시기,
  인연깊이: calc인연깊이,
  년주관계: calc년주관계,
  시주관계: calc시주관계,
  일지관계: calc일지관계,
  신살교차: calc신살교차,
};

// ─────────────────────────────────────────────────────────
// 패턴 진단 — 운명적 갈등·인연 자동 감지 16종
// ─────────────────────────────────────────────────────────
const PATTERN_RULES = [
  // ── 가족 패턴 ───────────────────────────────────────────
  {
    id: '부모권위반항',
    types: ['부모자녀'],
    detect: (me, other) => 천간충[me.일간] === other.일간,
    label: '🔥 부모 권위 반항',
    message: (me, other) => `본인 일간(${me.일간})과 부모 일간(${other.일간})이 천간충 관계. 어릴 때 권위와 자주 부딪히는 운명. 30대 중반 이후 자연스러운 화해 시기 도래.`,
  },
  {
    id: '자녀부담',
    types: ['부모자녀'],
    detect: (me, other) => other.일간오행 === me.기신,
    label: '⚠️ 자녀가 부모의 시련',
    message: (me, other) => `자녀 일간오행(${other.일간오행})이 본인 기신과 일치. 양육 과정에 운명적 시련 동반 — 인내가 키워드.`,
  },
  {
    id: '형제재물다툼',
    types: ['형제자매'],
    detect: (me, other) => {
      const meBigeop = (me.오행점수||{})[me.일간오행] || 0;
      const meSum = ['木','火','土','金','水'].reduce((s,k)=>s+((me.오행점수||{})[k]||0),0) || 1;
      return (meBigeop/meSum) > 0.40 && me.일간오행 === other.일간오행;
    },
    label: '💰 형제 재물 다툼',
    message: () => `본인 사주에 비겁(같은 오행) 과다 + 형제와 같은 오행 → 동업·유산 분쟁 운명적 패턴. 명확한 계약·분배 합의 필수.`,
  },
  {
    id: '고부갈등',
    types: ['시댁처가'],
    detect: (me, other) => other.일간오행 === me.기신 || (지지충[me.원국.일주.지지] === other.원국.일주.지지),
    label: '😤 고부 갈등',
    message: () => `시부모 일간오행이 본인 기신과 일치 또는 일지 충 → 직접 충돌 회피 + 거리 두기가 정답.`,
  },
  {
    id: '천생가족',
    types: ['부모자녀','형제자매','시댁처가','조부모손주','친척'],
    detect: (me, other) => other.일간오행 === me.용신,
    label: '✨ 천생 가족',
    message: (me, other) => `상대 일간(${other.일간오행})이 본인 용신 — 가족 중에서도 가장 운명적으로 도움이 되는 인연.`,
  },
  {
    id: '격대사랑',
    types: ['조부모손주'],
    detect: (me, other) => 지지육합[me.원국.일주.지지] === other.원국.년주.지지 ||
                          삼합국.some(s => s.includes(me.원국.일주.지지) && s.includes(other.원국.년주.지지)),
    label: '👴 격대 사랑',
    message: () => `본인 일지와 조부모 년지가 합 또는 삼합 — 정신적 유대 깊고, 어려서부터 받은 사랑이 평생 자산.`,
  },

  // ── 직장 패턴 ───────────────────────────────────────────
  {
    id: '천생연분동료',
    types: ['직장동료','직장상사','직장부하'],
    detect: (me, other) => (other.일간오행 === me.용신 && me.일간오행 === other.용신),
    label: '⭐ 천생연분 동료',
    message: () => `상호 용신 교차 — 함께 일하면 시너지 폭발. 큰 프로젝트·창업 후보.`,
  },
  {
    id: '에너지뺏김',
    types: ['직장동료','직장상사','직장부하','비즈니스'],
    detect: (me, other) => other.일간오행 === me.기신,
    label: '😩 에너지 뺏김',
    message: () => `상대 일간이 본인 기신 — 함께 있으면 묘하게 피곤. 업무는 하되 사적 친분은 거리 두기.`,
  },
  {
    id: '멘토인연',
    types: ['직장상사','스승'],
    detect: (me, other) => {
      const sip = 십성판정(me.일간, other.일간오행, 천간음양[other.일간]);
      return ['편인','정인'].includes(sip);
    },
    label: '🎓 멘토 인연',
    message: () => `상대가 본인의 인성 위치 — 가르침·후원 받기 좋은 운명적 관계. 적극적으로 의견 구하라.`,
  },
  {
    id: '제자인연',
    types: ['직장부하','제자'],
    detect: (me, other) => {
      const sip = 십성판정(me.일간, other.일간오행, 천간음양[other.일간]);
      return ['식신','상관'].includes(sip);
    },
    label: '🌱 제자 인연',
    message: () => `상대가 본인의 식상 위치 — 가르치고 키우기 좋은 인재. 베푸는 만큼 본인도 성장.`,
  },
  {
    id: '권위충돌',
    types: ['직장상사','직장부하'],
    detect: (me, other) => 천간충[me.일간] === other.일간,
    label: '⚡ 권위 충돌',
    message: () => `일간 천간충 — 상하 관계에서 자주 부딪히는 운명. 서로 영역 명확히 구분 필요.`,
  },

  // ── 친구·기타 패턴 ──────────────────────────────────────
  {
    id: '평생친구',
    types: ['친구'],
    detect: (me, other) => 천간합[me.일간] === other.일간 ||
                          삼합국.some(s => s.includes(me.원국.일주.지지) && s.includes(other.원국.일주.지지)),
    label: '🤝 평생 친구',
    message: () => `천간합 또는 일지 삼합 — 길게 가는 진짜 친구. 연락 뜸해도 만나면 그대로.`,
  },
  {
    id: '경쟁자',
    types: ['경쟁자','직장동료','형제자매'],
    detect: (me, other) => me.일간 === other.일간 && me.원국.일주.지지 !== other.원국.일주.지지,
    label: '⚔️ 라이벌',
    message: () => `같은 일간 다른 일지 — 비슷한 능력, 다른 방향. 경쟁이 서로를 키움.`,
  },
  {
    id: '원진관계',
    types: ALL_RELATION_TYPES,
    detect: (me, other) => 원진[me.원국.일주.지지] === other.원국.일주.지지,
    label: '😖 원진살',
    message: () => `일지 원진 — 묘하게 미운 감정이 운명적으로 끼어드는 관계. 의식적으로 좋은 면 찾는 노력 필요.`,
  },
  {
    id: '귀문관살',
    types: ALL_RELATION_TYPES,
    detect: (me, other) => 귀문[me.원국.일주.지지] === other.원국.일주.지지,
    label: '👻 귀문관살',
    message: () => `일지 귀문 — 직관적·정신적 부담 운명. 만나면 묘하게 답답함이 있을 수 있음.`,
  },
  {
    id: '운명적인연',
    types: ALL_RELATION_TYPES,
    detect: (me, other) => 천간합[me.일간] === other.일간 &&
                          삼합국.some(s => s.includes(me.원국.일주.지지) && s.includes(other.원국.일주.지지)),
    label: '🌟 운명적 인연',
    message: () => `천간합 + 일지 삼합 — 어떤 관계든 깊이 묶인 인연. 평생 어떻게든 연결됨.`,
  },
];

// ─────────────────────────────────────────────────────────
// 메인 함수: 관계분석
// ─────────────────────────────────────────────────────────
function 관계분석(meInput, otherInput, relationType = '기타') {
  const me    = 전체사주계산(meInput);
  const other = 전체사주계산(otherInput);

  // 가중치 (없으면 기타)
  const weights = RELATION_WEIGHTS[relationType] || RELATION_WEIGHTS['기타'];

  // 점수 계산
  const scores = {};
  for (const axis of Object.keys(weights)) {
    const fn = SCORE_FNS[axis];
    scores[axis] = fn ? fn(me, other) : 50;
  }

  // 가중 평균 종합 점수
  const total = Object.entries(weights).reduce((sum, [k, w]) => sum + (scores[k] || 50) * w, 0);
  const totalScore = Math.round(total);

  // 4단계 라벨
  const label =
    totalScore >= 85 ? '천생연분' :
    totalScore >= 70 ? '잘 맞음' :
    totalScore >= 55 ? '무난' :
                       '주의 필요';
  const labelColor =
    totalScore >= 85 ? '#2e7d32' :
    totalScore >= 70 ? '#1565c0' :
    totalScore >= 55 ? '#f57c00' :
                       '#c62828';

  // 패턴 진단 — 해당 관계 유형에 적용 가능한 룰만
  const patterns = [];
  for (const rule of PATTERN_RULES) {
    if (rule.types !== ALL_RELATION_TYPES && !rule.types.includes(relationType)) continue;
    try {
      if (rule.detect(me, other)) {
        patterns.push({
          id: rule.id,
          label: rule.label,
          message: rule.message(me, other),
        });
      }
    } catch(e) { /* 룰 실행 오류는 무시 */ }
  }

  // 본인이 상대를 본 십성 (역할 위치)
  const 본인기준십성 = 십성판정(me.일간, other.일간오행, 천간음양[other.일간]);

  return {
    relationType,
    me: {
      이름: me.이름,
      일주: `${me.원국.일주.천간}${me.원국.일주.지지}(${천간한[me.원국.일주.천간]}${지지한[me.원국.일주.지지]})`,
      일간: me.일간,
      일간오행: me.일간오행,
      신강약: me.신강약,
      용신: me.용신,
      희신: me.희신,
      기신: me.기신,
    },
    other: {
      이름: other.이름,
      일주: `${other.원국.일주.천간}${other.원국.일주.지지}(${천간한[other.원국.일주.천간]}${지지한[other.원국.일주.지지]})`,
      일간: other.일간,
      일간오행: other.일간오행,
      신강약: other.신강약,
      용신: other.용신,
      희신: other.희신,
      기신: other.기신,
    },
    상대역할: 본인기준십성,        // 본인 입장에서 상대가 무엇 (인성/식상/재성/관성/비겁)
    scores,
    weights,
    totalScore,
    label,
    labelColor,
    patterns,
  };
}

// ─────────────────────────────────────────────────────────
// N명 일괄 분석
// ─────────────────────────────────────────────────────────
function 관계도분석(meInput, persons) {
  // persons: [{ ...inputData, relationType, displayName? }, ...]
  const results = persons.map(p => {
    const r = 관계분석(meInput, p, p.relationType || '기타');
    return { ...r, displayName: p.displayName || r.other.이름 };
  });
  // 점수 내림차순 정렬
  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

module.exports = {
  관계분석,
  관계도분석,
  RELATION_WEIGHTS,
  PATTERN_RULES,
  ALL_RELATION_TYPES,
};
