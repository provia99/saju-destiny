#!/usr/bin/env node
/**
 * run_compatibility.js — 궁합분석 독립 실행기
 *
 * 사용법: node run_compatibility.js <master.json 경로>
 *
 * master.json 구조:
 * {
 *   "이름": "정종욱", "성별": "남",
 *   "생년": 1966, "생월": 7, "생일": 7, "생시": "묘시",
 *   "음력입력": true, "윤달": false,
 *   "product_type": "compatibility",
 *   "partner": {
 *     "이름": "임효원", "성별": "여",
 *     "생년": 1968, "생월": 2, "생일": 1, "생시": "묘시",
 *     "음력입력": true, "윤달": false
 *   }
 * }
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENGINE_ROOT = path.join(__dirname, '..', '..');
const QUEUE_DIR   = path.join(ENGINE_ROOT, 'queue');

const NODE_DIR = 'C:\\Program Files\\nodejs';
const NODE_CMD = fs.existsSync(path.join(NODE_DIR, 'node.exe'))
  ? path.join(NODE_DIR, 'node.exe') : 'node';

function run(cmd, label, cwd) {
  try {
    const out = execSync(cmd, { cwd: cwd || __dirname, encoding: 'utf8', timeout: 60000 });
    if (out.trim()) process.stdout.write(out.trim() + '\n');
  } catch(e) {
    console.error(`❌ ${label}: ${(e.stderr||e.message||'').split('\n')[0]}`);
    throw e;
  }
}

// 생년/생월/생일 → 년/월/일 매핑 (saju_calc 입력 형식)
function toSajuInput(p) {
  return {
    이름: p.이름,
    성별: p.성별 || '남',
    년:   p.생년 ?? p.년,
    월:   p.생월 ?? p.월,
    일:   p.생일 ?? p.일,
    시간: p.생시 ?? p.시간 ?? '모름',
    음력입력: !!p.음력입력,
    윤달: !!p.윤달,
  };
}

// ── 입력 처리 ──
const inputArg = process.argv[2];
if (!inputArg) {
  console.error('사용법: node run_compatibility.js <master.json 경로>');
  process.exit(1);
}
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(QUEUE_DIR, inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`❌ 파일 없음: ${inputPath}`);
  process.exit(1);
}

const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!M.partner) {
  console.error('❌ master.json에 partner 필드가 없습니다. 궁합분석은 상대방 정보가 필요합니다.');
  process.exit(1);
}

const slotDir = path.dirname(inputPath);
const fileId = M.id || M.이름;

console.log(`\n${'═'.repeat(50)}`);
console.log(`  💑 궁합분석 집필 시작`);
console.log(`  ${M.이름} (${M.생년}.${M.생월}.${M.생일} ${M.생시})`);
console.log(`  ♡ ${M.partner.이름} (${M.partner.생년}.${M.partner.생월}.${M.partner.생일} ${M.partner.생시})`);
console.log(`${'═'.repeat(50)}\n`);

// ── 1단계: 궁합 계산 + 표 생성 ──
console.log('[1단계] 궁합 분석 계산 + HTML 표 생성\n');

const { generate }    = require('./generate_궁합표');
const { 궁합풀이생성 } = require('./compatibility_fortune');

const tablesDir = path.join(slotDir, 'tables');
if (!fs.existsSync(tablesDir)) fs.mkdirSync(tablesDir, { recursive: true });

const inputA = toSajuInput(M);
const inputB = toSajuInput(M.partner);

// 관계정보 (8단계): 썸/연인/예비부부/부부/재혼준비/재혼/별거/이혼고민
const 관계정보 = {
  관계단계:     M.관계단계 || '연인',
  관계기간개월: M.관계기간개월 || null,
  자녀수:       M.자녀수 ?? null,
  결혼예정일:   M.결혼예정일 || null,
};
console.log(`   💞 관계 단계: ${관계정보.관계단계}`);
if (M.성별 && M.partner?.성별 && M.성별 === M.partner.성별) {
  console.log(`   🌈 동성 커플 모드 (${M.성별}-${M.partner.성별})`);
}

const { result } = generate(inputA, inputB, tablesDir, 관계정보);

// ── 2단계: 텍스트 풀이 생성 ──
console.log('\n[2단계] 궁합 풀이 텍스트 생성\n');
const 풀이 = 궁합풀이생성(result);
console.log(`  ✅ 풀이 섹션 ${Object.keys(풀이).length}개 생성`);

// ── 3단계: result.txt 합본 ──
console.log('\n[3단계] 결과 합본\n');

const lines = [];

// 커버 페이지 태그 (편집기가 cover.html을 첫 페이지로 렌더)
lines.push('[[TABLE:cover]]');
lines.push('');

// 커버 지시자 (saju_writer가 처리)
lines.push(`☯ ${M.이름} 님 ♡ ${M.partner.이름} 님 궁합분석`);
lines.push('');
// 장 제목 바로 아래 궁합한눈표 (한 페이지 요약 대시보드)
lines.push('[[TABLE:궁합한눈표]]');
lines.push('');
lines.push('');

// 도입 — ✦ 제목 바로 아래에 인적사항표 삽입, 이후 본문
{
  const _도입 = 풀이.도입 || '';
  const _firstBreakIdx = _도입.indexOf('\n');
  const _도입제목 = _firstBreakIdx >= 0 ? _도입.slice(0, _firstBreakIdx) : _도입;
  const _도입본문 = _firstBreakIdx >= 0 ? _도입.slice(_firstBreakIdx + 1).replace(/^\n+/, '') : '';
  lines.push(_도입제목);
  lines.push('');
  // 인적사항표 (아이보리·골드 스타일)
  lines.push('[[TABLE:궁합인적사항표]]');
  lines.push('');
  if (_도입본문) {
    lines.push(_도입본문);
    lines.push('');
  }
}
lines.push('');

// ═══════════════════════════════════════════
// ✺ 제1절. 기본 궁합 구조  (✦ 1개 = 표 1개)
// ═══════════════════════════════════════════
lines.push('  ✺ 제1절. 기본 궁합 구조');
lines.push('');
// ✦ 일간 상성 → 궁합사주비교표
lines.push(풀이.일간상성);
lines.push('');
lines.push('[[TABLE:궁합사주비교표]]');
lines.push('');
lines.push('');
// ✦ 오행 보완 → 궁합오행비교표
lines.push(풀이.오행보완);
lines.push('');
lines.push('[[TABLE:궁합오행비교표]]');
lines.push('');
lines.push('');
// ✦ 용신 교차 → 궁합용신교차표
lines.push(풀이.용신교차);
lines.push('');
lines.push('[[TABLE:궁합용신교차표]]');
lines.push('');
lines.push('');

// ═══════════════════════════════════════════
// ✺ 제2절. 관계의 성격  (✦ 1개 = 표 1개)
// ═══════════════════════════════════════════
lines.push('  ✺ 제2절. 관계의 성격');
lines.push('');
// ✦ 서로에게 어떤 존재 (십성) → 궁합십성관계표
lines.push(풀이.십성관계);
lines.push('');
lines.push('[[TABLE:궁합십성관계표]]');
lines.push('');
lines.push('');
// ✦ 친밀도 → 궁합친밀도표
lines.push(풀이.친밀도);
lines.push('');
lines.push('[[TABLE:궁합친밀도표]]');
lines.push('');
lines.push('');
// ✦ 합충 교차 → 궁합합충교차표
lines.push(풀이.합충교차);
lines.push('');
lines.push('[[TABLE:궁합합충교차표]]');
lines.push('');
lines.push('');
// ✦ 인연 깊이 → 궁합인연깊이표
lines.push(풀이.인연깊이);
lines.push('');
lines.push('[[TABLE:궁합인연깊이표]]');
lines.push('');
lines.push('');

// ═══════════════════════════════════════════
// ✺ 제3절. 갈등·소통  (3개 ✦를 하나로 묶어 표 1개)
// ═══════════════════════════════════════════
lines.push('  ✺ 제3절. 갈등·소통');
lines.push('');
// ✦ 갈등 포인트 & 사용법 → 궁합갈등사용설명서 (통합 표 1개)
lines.push(풀이.갈등포인트);
lines.push('');
lines.push('');
lines.push(풀이.사용설명서);
lines.push('');
lines.push('');
lines.push(풀이.대화스타일);
lines.push('');
lines.push('[[TABLE:궁합갈등사용설명서]]');
lines.push('');
lines.push('');

// ═══════════════════════════════════════════
// ✺ 제4절. 심화 분석 (신살·공망·암합·12운성·격국)
// ═══════════════════════════════════════════
lines.push('  ✺ 제4절. 심화 분석');
lines.push('');
lines.push(풀이.신살교차);
lines.push('');
lines.push('[[TABLE:궁합신살교차표]]');
lines.push('');
lines.push('');
lines.push(풀이.공망교차);
lines.push('');
lines.push('[[TABLE:궁합공망교차표]]');
lines.push('');
lines.push('');
lines.push(풀이.지장간암합);
lines.push('');
lines.push('[[TABLE:궁합지장간암합표]]');
lines.push('');
lines.push('');
lines.push(풀이['12운성교차']);
lines.push('');
lines.push('[[TABLE:궁합12운성교차표]]');
lines.push('');
lines.push('');
lines.push(풀이.격국매트릭스);
lines.push('');
lines.push('[[TABLE:궁합격국조합표]]');
lines.push('');
lines.push('');

// ═══════════════════════════════════════════
// ✺ 제5절. 시기·대운
// ═══════════════════════════════════════════
lines.push('  ✺ 제5절. 시기·대운');
lines.push('');
lines.push(풀이.세운동적);
lines.push('');
lines.push('[[TABLE:궁합세운동적표]]');
lines.push('');
lines.push('');
lines.push(풀이.월운동적);
lines.push('');
lines.push('[[TABLE:궁합월운동적표]]');
lines.push('');
lines.push('');
lines.push(풀이.귀인대운);
lines.push('');
lines.push('[[TABLE:궁합천을귀인대운표]]');
lines.push('');
lines.push('');
lines.push(풀이['12신살교차']);
lines.push('');
lines.push('[[TABLE:궁합12신살교차표]]');
lines.push('');
lines.push('');
lines.push(풀이.일주궁합);
lines.push('');
lines.push('[[TABLE:궁합일주궁합표]]');
lines.push('');
lines.push('');
lines.push(풀이.잠자리궁합);
lines.push('');
lines.push('[[TABLE:잠자리궁합표]]');
lines.push('');
lines.push('');

// ═══════════════════════════════════════════
// ✺ 제6절. 관계단계 전용 + 건강·재물
// ═══════════════════════════════════════════
lines.push('  ✺ 제6절. 관계단계·건강·재물');
lines.push('');
// 단계 전용 섹션 (관계단계에 따라 조건부)
if (풀이.분리판단)   { lines.push(풀이.분리판단); lines.push(''); lines.push(''); }
if (풀이.재결합가능성) { lines.push(풀이.재결합가능성); lines.push(''); lines.push(''); }
if (풀이.블렌디드)   { lines.push(풀이.블렌디드); lines.push(''); lines.push(''); }
if (풀이.첫만남)    { lines.push(풀이.첫만남); lines.push(''); lines.push(''); }
if (풀이.주년리듬)   { lines.push(풀이.주년리듬); lines.push(''); lines.push('[[TABLE:궁합주년리듬표]]'); lines.push(''); lines.push(''); }
if (풀이.건강궁합)   { lines.push(풀이.건강궁합); lines.push(''); lines.push('[[TABLE:궁합건강교차표]]'); lines.push(''); lines.push(''); }

// ✦ 재물·자녀·대운 시기 (3개 내용을 묶어 표 1개)
lines.push(풀이.재물궁합);
lines.push('');
lines.push('');
lines.push(풀이.자녀운);
lines.push('');
lines.push('');
lines.push(풀이.대운시기);
lines.push('');
lines.push('');
lines.push(풀이.결혼적기);
lines.push('');
lines.push('');
lines.push(풀이.위기시기);
lines.push('');
lines.push('[[TABLE:궁합재물시기표]]');
lines.push('');
lines.push('');

// ═══════════════════════════════════════════
// ✺ 제7절. 종합 조언  (✦ 에너지흐름 + ✦ 종합조언)
// ═══════════════════════════════════════════
lines.push('  ✺ 제7절. 종합 조언');
lines.push('');
// ✦ 관계 에너지 흐름 → 궁합에너지흐름표
if (풀이.에너지흐름) {
  lines.push(풀이.에너지흐름);
  lines.push('');
  lines.push('[[TABLE:궁합에너지흐름표]]');
  lines.push('');
  lines.push('');
}
lines.push(풀이.종합조언);
lines.push('');
lines.push('[[TABLE:궁합종합점수표]]');
lines.push('');

let resultText = lines.join('\n');
resultText = resultText.replace(/\r/g, '').replace(/\n{4,}/g, '\n\n\n');

const finalPath = path.join(slotDir, 'result.txt');
fs.writeFileSync(finalPath, resultText, 'utf8');

const chars = resultText.length;
const lineCount = resultText.split('\n').length;

// ── 4단계: 궁합 전용 표지 생성 ──
// 신규 상품마다 전용 표지 스크립트 사용 (총본 generate_cover.js와 구분)
const coverScript = path.join(__dirname, 'generate_cover_compat.js');
if (fs.existsSync(coverScript)) {
  try {
    run(`"${NODE_CMD}" "${coverScript}" "${inputPath}"`, 'cover_compat');
  } catch(e) { console.warn('  ⚠️ 궁합 표지 생성 실패 (계속 진행)'); }
}

// ── 완료 ──
console.log(`\n${'═'.repeat(50)}`);
console.log(`  💑 궁합분석 집필 완료`);
console.log(`  종합 점수: ${result.점수['종합']}점 (${result.등급 || '-'})`);
console.log(`  글자수: ${chars.toLocaleString()}자 / ${lineCount}줄`);
console.log(`  출력: ${path.relative(ENGINE_ROOT, finalPath)}`);
console.log(`${'═'.repeat(50)}\n`);
