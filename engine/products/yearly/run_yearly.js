#!/usr/bin/env node
/**
 * run_yearly.js — 신수풀이 독립 실행기
 * 구조: 표지 → 올해 총운 → [달력표 → 월운풀이] × 12
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

// ── 입력 처리 ──
const inputArg = process.argv[2];
if (!inputArg) {
  console.error('사용법: node run_yearly.js <master.json 경로>');
  process.exit(1);
}
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(QUEUE_DIR, inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`❌ 파일 없음: ${inputPath}`);
  process.exit(1);
}

const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const slotDir = path.dirname(inputPath);
const fileId = M.id || M.이름;

console.log(`\n${'═'.repeat(50)}`);
console.log(`  📅 신수풀이 집필 시작`);
console.log(`  대상: ${M.이름} | ${M.생년}.${M.생월}.${M.생일} ${M.생시}`);
console.log(`${'═'.repeat(50)}\n`);

// ── 1단계: generate (슬롯 JSON 생성) ──
console.log('[1단계] 신수풀이 슬롯 생성\n');
const genScript = path.join(__dirname, 'generate_yearly.js');
run(`"${NODE_CMD}" "${genScript}" "${inputPath}"`, 'generate_yearly');

// ── 2단계: 표 생성용 ch03.json 임시 생성 ──
console.log('\n[2단계] HTML 표 생성 준비\n');
try {
  const { 전체사주계산 } = require(path.join(ENGINE_ROOT, 'saju_calc'));
  const _r = 전체사주계산({이름:M.이름, 성별:M.성별??'남', 년:M.생년, 월:M.생월, 일:M.생일, 시간: M.생시||'모름', 음력입력:!!M.음력입력, 윤달:!!M.윤달, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});
  const _oh = {木:'목',火:'화',土:'토',金:'금',水:'수'};
  const ch03 = {
    user_name: M.이름, 이름: M.이름, user_gender: M.성별,
    birth_solar: `${M.생년}년 ${M.생월}월 ${M.생일}일`,
    일주한자: `${_r.원국.일주.천간}${_r.원국.일주.지지}`,
    일주_천간: _r.원국.일주.천간, 일주_천간_오행: _r.일간오행,
    년주: `${_r.원국.년주.천간}${_r.원국.년주.지지}`,
    월주: `${_r.원국.월주.천간}${_r.원국.월주.지지}`,
    시주: `${_r.원국.시주.천간}${_r.원국.시주.지지}`,
    용신오행: `${_r.용신}(${_oh[_r.용신]})`, 희신오행: `${_r.희신}(${_oh[_r.희신]})`,
    기신오행: `${_r.기신}(${_oh[_r.기신]})`, 신강약: _r.신강약,
    user_age: _r.만나이, 나이: _r.만나이,
  };
  fs.writeFileSync(path.join(slotDir, `${fileId}_ch03.json`), JSON.stringify(ch03, null, 2));
  console.log('  ✅ ch03.json 생성');
} catch(e) { console.warn('  ⚠️ ch03.json 생성 실패:', e.message); }

// ── ch08·ch09 데이터 생성 (대운·세운 표용) ──
// PRODUCT_SPECS.yearly_fortune.required_data = ["ch03","ch08","ch09"]
for (const ch of ['ch08', 'ch09']) {
  const script = path.join(ENGINE_ROOT, `generate_${ch}.js`);
  if (fs.existsSync(script)) {
    try {
      run(`"${NODE_CMD}" "${script}" "${inputPath}"`, `generate_${ch}`);
    } catch(e) { console.warn(`  ⚠️ ${ch} 생성 실패 (대운·세운 표 데이터 영향 가능)`); }
  }
}

// ── 3단계: 표 생성 (운세달력 + 공통표) ──
console.log('\n[3단계] HTML 표 생성\n');
const targetRelative = path.relative(path.resolve(QUEUE_DIR), slotDir);
const virtualSlotId = path.join(targetRelative, fileId).replace(/\\/g, '/');

// 표 생성은 generate_all.js 호출 (font_config 경로 등 engine/ 루트 기준)
const genAllScript = path.join(ENGINE_ROOT, 'generate_all.js');
if (fs.existsSync(genAllScript)) {
  try {
    run(`"${NODE_CMD}" "${genAllScript}" "${virtualSlotId}" "yearly_fortune"`, 'generate_all', ENGINE_ROOT);
  } catch(e) { console.warn('  ⚠️ 표 생성 일부 실패 (계속 진행)'); }
} else {
  console.log('  ⏭️ generate_all.js 없음 — 표 생성 건너뜀');
}

// 커버 생성
const coverScript = path.join(ENGINE_ROOT, 'generate_cover.js');
if (fs.existsSync(coverScript)) {
  try { run(`"${NODE_CMD}" "${coverScript}" ${fileId}`, 'cover', ENGINE_ROOT); }
  catch(e) { console.warn('  ⚠️ 커버 생성 실패'); }
}

// ── 4단계: result.txt 합본 ──
console.log('\n[4단계] 결과 합본\n');
const yearlyJson = JSON.parse(fs.readFileSync(path.join(slotDir, `${fileId}_yearly.json`), 'utf8'));

const lines = [];
lines.push(`☯ ${yearlyJson.올해}년 ${yearlyJson.이름} 님의 신수풀이`);
lines.push(`  ${yearlyJson.세운간지} 세운, ${yearlyJson.현재대운간지} 대운`);
lines.push('');
lines.push('');
lines.push(yearlyJson.올해총운);
lines.push('');
lines.push('');

// 월별: 달력표 참조 + 월운풀이
const 월순서 = [2,3,4,5,6,7,8,9,10,11,12,1];
for (const 월 of 월순서) {
  const 풀이 = yearlyJson[`월운풀이_${월}월`];
  if (풀이) {
    lines.push(`[[TABLE:운세달력_${String(월).padStart(2,'0')}월]]`);
    lines.push('');
    lines.push(풀이);
    lines.push('');
    lines.push('');
  }
}

let resultText = lines.join('\n');
resultText = resultText.replace(/\r/g, '').replace(/\n{4,}/g, '\n\n\n');

const finalPath = path.join(slotDir, 'result.txt');
fs.writeFileSync(finalPath, resultText, 'utf8');

const chars = resultText.length;
const lineCount = resultText.split('\n').length;
console.log(`  ✅ result.txt 저장 완료`);
console.log(`\n${'═'.repeat(50)}`);
console.log(`  📅 신수풀이 집필 완료!`);
console.log(`  총 ${chars.toLocaleString()}자 / ${lineCount}줄`);
console.log(`${'═'.repeat(50)}\n`);
