/**
 * engine/_guards.js
 * ─────────────────────────────────────────────────────────────
 * 표 생성기 공통 가드 모듈
 *
 * 1) findMasterJson(slotId, queueDir)        — 다양한 호출 인자 대응 master.json 탐색
 * 2) assertSajuComplete(r, options)           — saju_calc 결과 사전 검증 (부분 데이터 진행 차단)
 * 3) verifyHtmlOutput(filePath, checks)       — 작성된 HTML 사후 검증 (silent fail 차단)
 * 4) safeWriteHtml(outPath, html, checks)     — write + verify를 묶은 안전 쓰기
 *
 * 사용 예:
 *   const G = require('./_guards');
 *   const masterPath = G.findMasterJson(slotId, QUEUE_DIR);
 *   if (!masterPath) { console.error('master.json 못 찾음'); process.exit(1); }
 *   const r = 전체사주계산({... self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});
 *   G.assertSajuComplete(r);
 *   G.safeWriteHtml(outPath, html, { 이름, 일주 });
 * ─────────────────────────────────────────────────────────────
 */
'use strict';
const fs   = require('fs');
const path = require('path');

// ── master.json 탐색 — 호출자 인자 형식 5종 모두 대응 ─────
function findMasterJson(slotId, queueDir) {
  const candidates = [
    path.join(queueDir, `${slotId}_master.json`),                // queue/<id>_master.json
    path.join(queueDir, slotId, 'master.json'),                  // queue/<id>/master.json
    path.join(slotId, 'master.json'),                            // <abs slot>/master.json
    path.join(queueDir, path.dirname(slotId), 'master.json'),    // virtualSlotId 부모
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch(e) {}
  }
  // 추가 fallback: 짧은 fileId(예: sample_731)가 들어오면
  // queue/ 하위에서 <slotId>_ch*.json 파일이 있는 슬롯 폴더 검색
  // (run_all.js 등이 짧은 fileId로 호출하는 경우 대응)
  try {
    const _findInDir = (dir, depth) => {
      if (depth > 5) return null;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isFile() && ent.name.startsWith(`${slotId}_`) && ent.name.endsWith('.json')) {
          // 같은 폴더의 master.json 확인
          const mp = path.join(dir, 'master.json');
          if (fs.existsSync(mp)) return mp;
        }
        if (ent.isDirectory()) {
          const found = _findInDir(full, depth + 1);
          if (found) return found;
        }
      }
      return null;
    };
    const found = _findInDir(queueDir, 0);
    if (found) return found;
  } catch(e) {}
  return null;
}

// ── 사전 검증: saju_calc 결과 필수 필드 존재 확인 ─────────
// fields가 없으면 기본 필수 필드(원국 4기둥 8필드 + 용신/희신/신강약) 검사
const DEFAULT_REQUIRED = [
  '원국.일주.천간', '원국.일주.지지',
  '원국.년주.천간', '원국.년주.지지',
  '원국.월주.천간', '원국.월주.지지',
  '원국.시주.천간', '원국.시주.지지',
  '용신', '희신', '신강약',
];

function assertSajuComplete(r, options = {}) {
  const required = options.fields || DEFAULT_REQUIRED;
  const missing = [];
  for (const fp of required) {
    const parts = fp.split('.');
    let val = r;
    for (const p of parts) {
      if (val == null) { val = undefined; break; }
      val = val[p];
    }
    if (!val) missing.push(fp);
  }
  if (missing.length > 0) {
    const ctx = options.context ? ` (${options.context})` : '';
    throw new Error(`saju_calc 결과 불완전 — 누락 필드: ${missing.join(', ')}${ctx}`);
  }
  return true;
}

// ── 사후 검증: 작성된 HTML이 기대하는 값 모두 포함하는지 확인 ─
// checks 형식:
//   { 이름: '정래호', 일주: '辛巳' }            — 단순 문자열 포함 검사
//   { 4기둥: (html) => '...빈칸 N개' }            — 함수: 문제 메시지 반환(없으면 null/빈문자열)
function verifyHtmlOutput(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    return [`파일 미생성: ${filePath}`];
  }
  const html = fs.readFileSync(filePath, 'utf8');
  const problems = [];
  for (const [name, check] of Object.entries(checks || {})) {
    if (check == null || check === '') continue;
    if (typeof check === 'string') {
      if (!html.includes(check)) problems.push(`${name}(${check}) 누락`);
    } else if (typeof check === 'function') {
      const result = check(html);
      if (result) problems.push(result);
    }
  }
  return problems;
}

// ── 안전 쓰기: write + verify
// 정책: 검증 실패해도 파일 유지 (부분 있는 게 없는 것보다 낫다는 원칙).
//      대신 stderr에 경고 로그 — 검증 endpoint에서 별도로 잡힘.
//      strict 옵션 (4번째 인자에 {strict:true}) 시에만 삭제+throw.
function safeWriteHtml(outPath, html, checks, labelOrOpts) {
  const label = typeof labelOrOpts === 'string' ? labelOrOpts : (labelOrOpts?.label || '');
  const strict = !!(labelOrOpts && typeof labelOrOpts === 'object' && labelOrOpts.strict);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf-8');
  const problems = verifyHtmlOutput(outPath, checks);
  if (problems.length === 0) return;

  const lbl = label ? `[${label}] ` : '';
  // 자명한 false-positive 필터 — name/이름이 비어있거나 slotId 패턴이면 검증 스킵
  // (ch03에 이름 없을 때 fallback이 slotId → HTML엔 master.json 진짜 이름이라 매칭 실패)
  const _meaningful = problems.filter(p => {
    if (/이름\(\s*\)/.test(p)) return false;                 // 이름() — 빈값
    if (/이름\(sample_\d+\)/.test(p)) return false;          // 이름(sample_724) — slotId
    if (/이름\(s\d+\)/.test(p)) return false;                // 이름(s11)
    return true;
  });

  if (_meaningful.length === 0) return;  // 모두 false-positive면 조용히 진행

  if (strict) {
    try { fs.unlinkSync(outPath); } catch(e) {}
    throw new Error(`${lbl}HTML 자가검증 실패 — 파일 삭제됨: ${_meaningful.join(' / ')}`);
  }
  // 일반 모드: 파일 유지 + 경고만
  console.warn(`⚠️  ${lbl}HTML 검증 경고 (파일은 유지): ${_meaningful.join(' / ')}`);
}

// ── 흔한 검사기 빌더들 (각 generator에서 재사용) ──────────
// 4기둥 td 빈칸 검사 (cover/명식표 등)
function check4Pillars() {
  return (html) => {
    const tblMatch = html.match(/<table[^>]*saju-table[^>]*>([\s\S]*?)<\/table>/);
    if (!tblMatch) return 'saju-table 영역 누락';
    const tdValues = (tblMatch[1].match(/<td[^>]*>([^<]*)</g) || [])
      .map(s => s.replace(/<td[^>]*>/, '').replace(/</, '').trim());
    const empty = tdValues.filter(v => !v || v === '-' || v === '—').length;
    if (empty > 0) return `4기둥 빈칸 ${empty}개`;
    return null;
  };
}

// 특정 한자 패턴(예: 갑/을/병...) 등장 검사
function checkContains(needle, label) {
  return (html) => {
    if (!html.includes(needle)) return `${label||needle} 누락`;
    return null;
  };
}

module.exports = {
  findMasterJson,
  assertSajuComplete,
  verifyHtmlOutput,
  safeWriteHtml,
  check4Pillars,
  checkContains,
  DEFAULT_REQUIRED,
};
