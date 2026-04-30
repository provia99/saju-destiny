#!/usr/bin/env node
/**
 * _check_discrepancy.js — 표 vs 본문 vs saju_calc 정답 3자 비교
 *
 * 사용법:
 *   node _check_discrepancy.js                        # 모든 sample 슬롯 검사
 *   node _check_discrepancy.js sample/김복한_86150005  # 특정 슬롯만
 *
 * 검사 항목:
 *   1. 대운 길흉 (10기 모두)  - 명식표 vs 본문 vs saju_calc
 *   2. 용신/희신/기신 오행
 *   3. 신강약
 *   4. 격국
 *   5. 현재 대운 간지·길흉
 *   6. 세운(2026) 길흉
 *   7. 만나이
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const QUEUE = path.join(ROOT, 'queue');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}
function readText(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

// ── saju_calc 정답 ──────────────────────────────────────────
function getTruth(slotDir) {
  const masterPath = path.join(slotDir, 'master.json');
  const m = readJSON(masterPath);
  if (!m) return null;
  try {
    const { 전체사주계산 } = require('./saju_calc');
    return 전체사주계산({
      이름: m.이름, 성별: m.성별 ?? '남',
      년: m.생년, 월: m.생월, 일: m.생일,
      시간: m.생시 || '모름',
      음력입력: !!m.음력입력, 윤달: !!m.윤달, self_q1: m.self_q1, self_q2: m.self_q2, self_q3: m.self_q3, self_q4: m.self_q4, self_q5: m.self_q5, self_q6: m.self_q6, self_q7: m.self_q7,
});
  } catch (e) {
    return null;
  }
}

// ── 명식표 파싱 ─────────────────────────────────────────────
function parse명식표(html) {
  if (!html) return null;
  const o = { 대운: [], 현재대운: '', 현재대운길흉: '', 신강약: '', 격국: '', 용신: '', 희신: '', 기신: '' };
  // 대운: <div class="dg">己巳</div><div class="da">기사 8~17세</div><div class="dt dgi">기신</div>
  const dwRe = /<div class="dg">([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])<\/div><div class="da">[^<]*<\/div><div class="dt d(\w+)">([^<★]+)/g;
  let mm;
  while ((mm = dwRe.exec(html))) {
    o.대운.push({ 간지: mm[1], 길흉: mm[3].trim() });
  }
  // 현재 대운 (".di now" 다음의 dg/da/dt)
  const curMatch = /class="di now"><div class="dg">([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]).*?<div class="dt[^"]*">([^<★]+)/s.exec(html);
  if (curMatch) { o.현재대운 = curMatch[1]; o.현재대운길흉 = curMatch[2].trim(); }
  // 신강약/격국 추출
  const sgM = /신강약<\/div>\s*<div[^>]*>([^<]+)/.exec(html); if (sgM) o.신강약 = sgM[1].trim();
  const ggM = /격국<\/div>\s*<div[^>]*>([^<]+)/.exec(html);  if (ggM) o.격국 = ggM[1].trim();
  return o;
}

// ── 사주기본표 파싱 ─────────────────────────────────────────
function parse사주기본표(html) {
  if (!html) return null;
  const o = { 신강약: '', 격국: '' };
  // 일간·신강약 row 안의 신강약 텍스트
  const sgM = /신약|신강|중화/.exec(html); if (sgM) o.신강약 = sgM[0];
  const ggM = /([一-龥]+격\([一-龥]+格\))/.exec(html); if (ggM) o.격국 = ggM[1];
  return o;
}

// ── 본문(result.txt) 파싱 ──────────────────────────────────
function parseResult(txt) {
  if (!txt) return null;
  const o = { 대운: [], 현재대운: '', 현재대운길흉: '', 신강약: '', 격국: '', 용신: '', 만나이: 0 };
  // 대운 로드맵 라인:
  //   "  己巳(기사) 8~17세 🔴 기신대운"   (요약본)
  //   "1기 甲子(갑자) | 8-17세 | 1977년~ | 목욕 | 용신대운 | ..." (총본)
  const dwRe1 = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\([^)]+\)\s*\d+~\d+세\s*[🔴🟢⚪🔵]\s*([용희기중])(?:신|립)대운/g;
  const dwRe2 = /\d+기\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\([^)]+\)[^|]*\|\s*\d+-\d+세[^|]*\|[^|]*\|[^|]*\|\s*([용희기중])(?:신|립)대운/g;
  let mm;
  const _add = (gan, lab) => o.대운.push({ 간지: gan, 길흉: lab + (lab === '중' ? '립' : '신') });
  while ((mm = dwRe1.exec(txt))) _add(mm[1], mm[2]);
  while ((mm = dwRe2.exec(txt))) _add(mm[1], mm[2]);
  // 현재 대운: "현재 대운: 甲戌(갑술) (58~67세)" or "현재 대운(大運...): 庚申(경신) (48-57세) 》 기신대운"
  const curM1 = /현재 대운[^:]*:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\([^)]+\)\s*\(?\d+[~-]\d+세\)?(?:\s*》?\s*([용희기중])(?:신|립)대운)?/.exec(txt);
  if (curM1) {
    o.현재대운 = curM1[1];
    if (curM1[2]) o.현재대운길흉 = curM1[2] + (curM1[2] === '중' ? '립' : '신');
  }
  // 신강약 — "신약(身弱)" / "신강(身强)" / "중화" 의 명확한 단어 매칭
  // "신강약" 합성어는 제외 (뒤에 "약"이 따라오면 매칭 안됨)
  const sgM = /(신약|신강|중화)(?!약)(?:\(身|\s|$|·|[)])/.exec(txt);
  if (sgM) o.신강약 = sgM[1];
  // 만나이: "만 67세" or "만67세"
  const ageM = /만\s*(\d+)\s*세/.exec(txt); if (ageM) o.만나이 = +ageM[1];
  return o;
}

// ── 비교 ──────────────────────────────────────────────────
function compareSlot(slotDir) {
  const r = getTruth(slotDir);
  if (!r) return null;

  const tablesDir = path.join(slotDir, 'tables');
  const myeongHtml = readText(path.join(tablesDir, '명식표.html'));
  const giboHtml   = readText(path.join(tablesDir, '사주기본표.html'));
  // result.txt만 읽기 (최신 본문 — 옛 sample_NNN_ch_summary_result.txt는 stale)
  let resultText = '';
  const mainResult = path.join(slotDir, 'result.txt');
  if (fs.existsSync(mainResult)) {
    resultText = readText(mainResult);
  }

  const ms = parse명식표(myeongHtml) || {};
  const gb = parse사주기본표(giboHtml) || {};
  const tx = parseResult(resultText) || {};

  const issues = [];
  const passed = [];

  // 1. 대운 길흉 (10기)
  if (Array.isArray(r.대운목록) && ms.대운?.length) {
    const truthMap = {};
    for (const dw of r.대운목록) truthMap[dw.간지] = (dw.대운길흉 || '').replace('대운','');
    const txMap = {};
    for (const t of (tx.대운 || [])) {
      txMap[t.간지] = t.길흉;  // already labeled
    }
    let mismatch = 0;
    for (const ms_dw of ms.대운) {
      const truth = truthMap[ms_dw.간지];
      const txLab = txMap[ms_dw.간지];
      if (truth && ms_dw.길흉 && truth !== ms_dw.길흉) {
        issues.push(`  [표 vs 정답] 대운 ${ms_dw.간지}: 명식표=${ms_dw.길흉} ↔ saju_calc=${truth}`);
        mismatch++;
      }
      if (truth && txLab && truth !== txLab) {
        issues.push(`  [본문 vs 정답] 대운 ${ms_dw.간지}: 본문=${txLab} ↔ saju_calc=${truth}`);
        mismatch++;
      }
    }
    if (mismatch === 0) passed.push('대운 10기 길흉 일치');
  }

  // 2. 신강약
  const truthSg = r.신강약 || '';
  if (truthSg) {
    const matches = [
      { label: '명식표', val: ms.신강약 },
      { label: '본문', val: tx.신강약 }
    ].filter(x => x.val);
    for (const x of matches) {
      if (!truthSg.includes(x.val) && !x.val.includes(truthSg)) {
        issues.push(`  [${x.label} vs 정답] 신강약: ${x.val} ↔ ${truthSg}`);
      }
    }
    if (issues.length === 0) passed.push(`신강약 일치 (${truthSg})`);
  }

  // 3. 격국
  const truthGg = r['格국명'] || r['격국명'] || '';
  if (truthGg && ms.격국 && !ms.격국.includes(truthGg.replace(/\(.*\)/,'').trim())) {
    issues.push(`  [명식표 vs 정답] 격국: ${ms.격국} ↔ ${truthGg}`);
  }

  // 4. 만나이
  if (r.만나이 && tx.만나이 && r.만나이 !== tx.만나이) {
    issues.push(`  [본문 vs 정답] 만나이: ${tx.만나이} ↔ ${r.만나이}`);
  }

  // 5. 현재 대운 + 길흉
  const truthCurDw = r.현재대운?.간지 || '';
  if (truthCurDw && ms.현재대운 && truthCurDw !== ms.현재대운) {
    issues.push(`  [명식표 vs 정답] 현재대운: ${ms.현재대운} ↔ ${truthCurDw}`);
  }
  if (truthCurDw && tx.현재대운 && truthCurDw !== tx.현재대운) {
    issues.push(`  [본문 vs 정답] 현재대운: ${tx.현재대운} ↔ ${truthCurDw}`);
  }

  // 6. 용신·희신·기신 — 본문에서 추출
  const _ohRe = (lab) => new RegExp(`${lab}\\([用喜忌]神\\):\\s*([木火土金水])`);
  for (const [label, key, regexLab] of [
    ['용신', '용신', '용신'], ['희신', '희신', '희신'], ['기신', '기신', '기신']
  ]) {
    const truth = r[key];
    const m = _ohRe(regexLab).exec(resultText);
    const txVal = m ? m[1] : null;
    if (truth && txVal && truth !== txVal) {
      issues.push(`  [본문 vs 정답] ${label}: ${txVal} ↔ ${truth}`);
    }
  }

  // 7. 일주 (간지)
  const truthIlju = r.원국?.일주 ? `${r.원국.일주.천간}${r.원국.일주.지지}` : '';
  const txIlju = /일주\(?日柱\)?:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/.exec(resultText);
  if (truthIlju && txIlju && truthIlju !== txIlju[1]) {
    issues.push(`  [본문 vs 정답] 일주: ${txIlju[1]} ↔ ${truthIlju}`);
  }

  // 8. 일간오행
  const truthIlganOh = r.일간오행 || '';
  const txIlganOh = /일간오행:?\s*([木火土金水])/.exec(resultText) || /일간\([日]干\):\s*[甲乙丙丁戊己庚辛壬癸]\([가-힣]\)\s*\(([木火土金水])/.exec(resultText);
  if (truthIlganOh && txIlganOh && truthIlganOh !== txIlganOh[1]) {
    issues.push(`  [본문 vs 정답] 일간오행: ${txIlganOh[1]} ↔ ${truthIlganOh}`);
  }

  // 9. 오행점수 — 표/본문 % 일치 (오행균형표 또는 사주기본표)
  if (r.오행점수) {
    const _giboHtml = readText(path.join(tablesDir, '사주기본표.html'));
    const _ohRatio = {};
    const _total = Object.values(r.오행점수).reduce((a,b)=>a+b, 0);
    if (_total > 0) {
      for (const [k,v] of Object.entries(r.오행점수)) {
        _ohRatio[{木:'목',火:'화',土:'토',金:'금',水:'수'}[k]] = Math.round(v/_total*100);
      }
      const _giboPct = {};
      // oh-pc 클래스의 % (실제 비율) — width% (막대 너비)는 제외
      const _re = /([목화토금수])\([木火土金水]\)[\s\S]*?<span class="oh-pc">[^<]*<br>(\d+)%/g;
      let mm;
      while ((mm = _re.exec(_giboHtml))) {
        _giboPct[mm[1]] = +mm[2];
      }
      for (const [k, vt] of Object.entries(_ohRatio)) {
        const vg = _giboPct[k];
        if (vg !== undefined && Math.abs(vt - vg) > 2) {
          issues.push(`  [사주기본표 vs 정답] 오행 ${k}: ${vg}% ↔ ${vt}%`);
        }
      }
    }
  }

  return { issues, passed, name: r.이름 || path.basename(slotDir) };
}

// ── 슬롯 수집 ───────────────────────────────────────────────
function findSlots(target) {
  const slots = [];
  const samplesDir = path.join(QUEUE, 'sample');
  if (!fs.existsSync(samplesDir)) return slots;
  for (const name of fs.readdirSync(samplesDir)) {
    const sajuDir = path.join(samplesDir, name, 'saju', '2026');
    if (fs.existsSync(path.join(sajuDir, 'master.json'))) {
      if (!target || sajuDir.includes(target)) slots.push(sajuDir);
    }
  }
  return slots;
}

// ── 메인 ────────────────────────────────────────────────────
const target = process.argv[2] || '';
const slots = findSlots(target);
if (slots.length === 0) { console.error('슬롯 없음'); process.exit(1); }

let totalIssues = 0;
let totalSlots = 0;
for (const slotDir of slots) {
  const result = compareSlot(slotDir);
  if (!result) continue;
  totalSlots++;
  const rel = path.relative(ROOT, slotDir);
  if (result.issues.length === 0) {
    console.log(`✅ ${result.name}  (${rel})`);
  } else {
    console.log(`\n⚠️  ${result.name}  (${rel})  -- ${result.issues.length}건`);
    for (const i of result.issues) console.log(i);
    totalIssues += result.issues.length;
  }
}
console.log(`\n${'─'.repeat(60)}`);
console.log(`검사 슬롯: ${totalSlots}개  /  총 불일치: ${totalIssues}건`);
