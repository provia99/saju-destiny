#!/usr/bin/env node
/**
 * run_summary.js — 사주 요약본 독립 실행기
 * products/summary/ 폴더에서 독립 실행
 *
 * 사용법: node run_summary.js <master.json 경로>
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENGINE_ROOT = path.join(__dirname, '..', '..');
const QUEUE_DIR   = path.join(ENGINE_ROOT, 'queue');

// node 경로
const NODE_DIR = 'C:\\Program Files\\nodejs';
const NODE_CMD = fs.existsSync(path.join(NODE_DIR, 'node.exe'))
  ? path.join(NODE_DIR, 'node.exe') : 'node';

function run(cmd, label) {
  try {
    const out = execSync(cmd, { cwd: __dirname, encoding: 'utf8', timeout: 60000 });
    if (out.trim()) process.stdout.write(out.trim() + '\n');
  } catch(e) {
    console.error(`❌ ${label}: ${(e.stderr||e.message||'').split('\n')[0]}`);
    throw e;
  }
}

// ── 입력 처리 ──
const inputArg = process.argv[2];
if (!inputArg) {
  console.error('사용법: node run_summary.js <master.json 경로>');
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
console.log(`  📋 사주 요약본 집필 시작`);
console.log(`  대상: ${M.이름} | ${M.생년}.${M.생월}.${M.생일} ${M.생시}`);
console.log(`${'═'.repeat(50)}\n`);

// ── 1단계: generate (슬롯 JSON 생성) ──
console.log('[1단계] 슬롯 데이터 생성\n');
const genScript = path.join(__dirname, 'generate_ch_summary.js');
run(`"${NODE_CMD}" "${genScript}" "${inputPath}"`, 'generate_ch_summary');

// ── 2단계: render (템플릿 → 텍스트) ──
console.log('\n[2단계] 텍스트 렌더링\n');
const jsonPath = path.join(slotDir, `${fileId}_ch_summary.json`);
const renScript = path.join(__dirname, 'render_ch_summary.js');
run(`"${NODE_CMD}" "${renScript}" "${jsonPath}"`, 'render_ch_summary');

// ── 3단계: 결과 합본 ──
console.log('\n[3단계] 결과 합본\n');
const resultPath = path.join(slotDir, `${fileId}_ch_summary_result.txt`);
if (!fs.existsSync(resultPath)) {
  console.error('❌ 렌더링 결과 없음');
  process.exit(1);
}

let resultText = fs.readFileSync(resultPath, 'utf8');

// CR 제거 + 빈줄 정규화
resultText = resultText.replace(/\r/g, '').replace(/\n{4,}/g, '\n\n\n');

// result.txt로 저장
const finalPath = path.join(slotDir, 'result.txt');
fs.writeFileSync(finalPath, resultText, 'utf8');

const chars = resultText.length;
const lines = resultText.split('\n').length;

// ── 4단계: 표 생성 ──
console.log('[4단계] HTML 표 생성\n');

// 표 생성용 ch03.json 임시 생성 (saju_calc으로)
try {
  const { 전체사주계산, 오행점수계산, 오행등급 } = require(path.join(ENGINE_ROOT, 'saju_calc'));
  const _r = 전체사주계산({이름:M.이름, 성별:M.성별??'남', 년:M.생년, 월:M.생월, 일:M.생일, 시간: M.생시||'모름', 음력입력:!!M.음력입력, 윤달:!!M.윤달, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});
  const _천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
  const _지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
  const _oh = {木:'목',火:'화',土:'토',金:'금',水:'수'};
  const ch03 = {
    user_name: M.이름, 이름: M.이름, user_gender: M.성별,
    birth_solar: `${M.생년}년 ${M.생월}월 ${M.생일}일`,
    일주: `${_r.원국.일주.천간}${_r.원국.일주.지지}(${_천간음[_r.원국.일주.천간]}${_지지음[_r.원국.일주.지지]})`,
    일주한자: `${_r.원국.일주.천간}${_r.원국.일주.지지}`,
    일주_천간: _r.원국.일주.천간, 일주_천간_오행: _r.일간오행,
    년주: `${_r.원국.년주.천간}${_r.원국.년주.지지}`,
    월주: `${_r.원국.월주.천간}${_r.원국.월주.지지}`,
    시주: `${_r.원국.시주.천간}${_r.원국.시주.지지}`,
    용신오행: `${_r.용신}(${_oh[_r.용신]})`, 희신오행: `${_r.희신}(${_oh[_r.희신]})`,
    기신오행: `${_r.기신}(${_oh[_r.기신]})`, 신강약: _r.신강약,
    user_age: _r.만나이, 나이: _r.만나이,
  };
  const ch03Path = path.join(slotDir, `${fileId}_ch03.json`);
  fs.writeFileSync(ch03Path, JSON.stringify(ch03, null, 2));
  console.log('  ✅ ch03.json 임시 생성 (표 생성용)');
} catch(e) { console.warn('  ⚠️ ch03.json 생성 실패:', e.message); }

// ── ch10·ch11 데이터 생성 (건강표·직업표용) ──
// 요약본은 ch10/ch11 본문이 없지만, 건강표·직업표 데이터 슬롯이 필요해서 JSON만 생성
// generate_ch10/11은 master.json 경로를 인자로 받음 (다른 표 generator와 다름)
for (const ch of ['ch10', 'ch11']) {
  const script = path.join(ENGINE_ROOT, `generate_${ch}.js`);
  if (fs.existsSync(script)) {
    try {
      run(`"${NODE_CMD}" "${script}" "${inputPath}"`, `generate_${ch}`);
    } catch(e) { console.warn(`  ⚠️ ${ch} 생성 실패 (건강·직업표 데이터 영향 가능)`); }
  }
}

// 커버 생성 — virtualSlotId 전달 (짧은 fileId로는 master.json 추적 불가)
const coverScript = path.join(ENGINE_ROOT, 'generate_cover.js');
if (fs.existsSync(coverScript)) {
  try {
    const targetRelative = path.relative(path.resolve(QUEUE_DIR), slotDir);
    const virtualSlotId = path.join(targetRelative, fileId).replace(/\\/g, '/');
    run(`"${NODE_CMD}" "${coverScript}" "${virtualSlotId}"`, 'cover');
  } catch(e) { console.warn('  ⚠️ 커버 생성 실패'); }
}

// 표 생성기 실행 (요약본에 필요한 것만)
const 표목록 = [
  '인적사항표', '명식표', '오행점수표', '인간관계표',
  '사주기본표', '십성배치표', '기질판단표', '건강표', '직업표',
  '오행생극도', '일지분석표',
];

// 요약본 전용 표 (products/summary/ 폴더)
const 전용표 = ['용신가이드카드', '지장간요약표'];
for (const 표 of 전용표) {
  const script = path.join(__dirname, `generate_${표}.js`);
  if (!fs.existsSync(script)) continue;
  try {
    const targetRelative = path.relative(path.resolve(QUEUE_DIR), slotDir);
    const virtualSlotId = path.join(targetRelative, fileId).replace(/\\/g, '/');
    run(`"${NODE_CMD}" "${script}" "${virtualSlotId}"`, `generate_${표}`);
  } catch(e) { console.warn(`  ⚠️ ${표} 생성 실패`); }
}

const tablesDir = path.join(slotDir, 'tables');
if (!fs.existsSync(tablesDir)) fs.mkdirSync(tablesDir, { recursive: true });

for (const 표 of 표목록) {
  const script = path.join(ENGINE_ROOT, `generate_${표}.js`);
  if (!fs.existsSync(script)) continue;
  try {
    const targetRelative = path.relative(path.resolve(QUEUE_DIR), slotDir);
    const virtualSlotId = path.join(targetRelative, fileId).replace(/\\/g, '/');
    run(`"${NODE_CMD}" "${script}" "${virtualSlotId}"`, `generate_${표}`);
  } catch(e) { console.warn(`  ⚠️ ${표} 생성 실패`); }
}

// 운세달력 표 생성 (generate_all.js 경유)
const genAllScript = path.join(ENGINE_ROOT, 'generate_all.js');
if (fs.existsSync(genAllScript)) {
  try {
    const targetRelative = path.relative(path.resolve(QUEUE_DIR), slotDir);
    const virtualSlotId = path.join(targetRelative, fileId).replace(/\\/g, '/');
    run(`"${NODE_CMD}" "${genAllScript}" "${virtualSlotId}" "saju_summary"`, 'generate_all(달력)', ENGINE_ROOT);
  } catch(e) { console.warn('  ⚠️ 운세달력 생성 실패 (계속 진행)'); }
}

// ── engine/tables/<virtualSlotId>/ 에 떨어진 표를 슬롯 폴더로 이동 ─
// (대부분의 generator가 engine/tables/ 에만 쓰므로 슬롯에 모이지 않음)
// 정책: engine/tables/ 새 파일을 슬롯에 항상 덮어쓰기.
//      슬롯에 직접 쓴 generator(인적사항표/cover)도 같은 saju_calc 결과라 덮어써도 동일.
//      이 정책이 없으면 옛 stale HTML(예: 4신요약표 옛 용신값)이 갱신 안 됨.
try {
  const targetRelative = path.relative(path.resolve(QUEUE_DIR), slotDir);
  const virtualSlotId = path.join(targetRelative, fileId).replace(/\\/g, '/');
  const srcDir = path.join(ENGINE_ROOT, 'tables', virtualSlotId);
  if (fs.existsSync(srcDir)) {
    let moved = 0;
    for (const f of fs.readdirSync(srcDir)) {
      if (!f.endsWith('.html')) continue;
      const dst = path.join(tablesDir, f);
      fs.copyFileSync(path.join(srcDir, f), dst);  // 항상 덮어쓰기 — stale 갱신
      moved++;
    }
    if (moved > 0) console.log(`  📁 ${moved}개 표 → 슬롯 폴더 동기화`);
  }
} catch(e) { console.warn('  ⚠️ 표 이동 실패:', e.message); }

// 필러 복사 (static/filler에서)
const fillerSrc = path.join(ENGINE_ROOT, '..', 'static', 'filler');
if (fs.existsSync(fillerSrc)) {
  const fillerFiles = fs.readdirSync(fillerSrc).filter(f => f.endsWith('.html') && f.startsWith('filler_'));
  // 텍스트 필러만 (500KB 이하)
  let cnt = 0;
  for (const f of fillerFiles) {
    const src = path.join(fillerSrc, f);
    if (fs.statSync(src).size > 500000) continue;
    const dst = path.join(tablesDir, f);
    if (!fs.existsSync(dst)) {
      let content = fs.readFileSync(src, 'utf8');
      content = content.replace(/\{\{선생님이름\}\}/g, M.선생님이름 || '반야선생');
      fs.writeFileSync(dst, content);
      cnt++;
    }
  }
  if (cnt > 0) console.log(`  📝 필러 ${cnt}개 배포`);
}

// ── 완료 ──
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ✅ 요약본 집필 완료`);
console.log(`  이름: ${M.이름}`);
console.log(`  글자수: ${chars.toLocaleString()}자`);
console.log(`  줄수: ${lines.toLocaleString()}줄`);
console.log(`  출력: ${path.relative(ENGINE_ROOT, finalPath)}`);
console.log(`${'═'.repeat(50)}\n`);
