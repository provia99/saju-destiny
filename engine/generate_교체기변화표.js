#!/usr/bin/env node
// generate_교체기변화표.js
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch06.json + queue/{slot}_ch08.json
// 출력: tables/{slot}/교체기변화표.html
// 대운 교체기 변화 영역별 분석표
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function loadJSON(file) {
  const fp = path.join(QUEUE_DIR, file);
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : {};
}

function generate(slotId) {
  const d3 = loadJSON(`${slotId}_ch03.json`);
  const d6 = loadJSON(`${slotId}_ch06.json`);
  const d8 = loadJSON(`${slotId}_ch08.json`);
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d8); } catch(e){}

  // 인적사항
  const name    = d3['이름']        || slotId;
  const ilju    = d3['일주']        || '';
  const sinGang = d3['신강약']      || d6['신강약'] || '';

  // 대운 전환 방향 판별
  const curDWSung  = d8['현재대운성격'] || d8['현대운성격단'] || '';
  const nextDWSung = d8['다음대운성격'] || '';
  const 교체년도   = d8['대운교체년도'] || '';
  const 교체기목록 = d8['대운교체기목록'] || '';
  const 다음대운간지 = d8['다음대운간지'] || '';
  const 현재대운간지 = d8['현재대운간지'] || '';

  // 전환 방향 판별: 용신→기신 / 기신→용신 / 기타
  function is용신계열(s) { return s && (s.includes('용신') || s.includes('희신')); }
  function is기신계열(s) { return s && s.includes('기신'); }

  let transDir = 'neutral'; // 'good_to_bad', 'bad_to_good', 'neutral'
  let transDirLabel = '중립적 전환';
  if (is용신계열(curDWSung) && is기신계열(nextDWSung)) {
    transDir = 'good_to_bad';
    transDirLabel = '용신 → 기신 전환';
  } else if (is기신계열(curDWSung) && is용신계열(nextDWSung)) {
    transDir = 'bad_to_good';
    transDirLabel = '기신 → 용신 전환';
  } else if (is용신계열(curDWSung) && is용신계열(nextDWSung)) {
    transDirLabel = '용신 → 용신 유지';
  } else if (is기신계열(curDWSung) && is기신계열(nextDWSung)) {
    transDirLabel = '기신 → 기신 지속';
  }

  // 행 데이터
  const rows = [
    {
      영역: '직장·커리어',
      용기: '승진 기회 축소 · 직장 내 위상 약화\n이직·퇴사 압박 증가, 보수적 운영 필요',
      기용: '새로운 기회 열림 · 승진·발탁 가능\n이직 시 더 좋은 조건, 적극적 도전 유리',
      방어: '실력 축적에 집중\n인맥 관리 지속\n무리한 이직 자제',
    },
    {
      영역: '재물·투자',
      용기: '수입 감소 · 예상치 못한 지출 증가\n투자 손실 위험, 큰 금액 결정 유보',
      기용: '수입 증가 · 투자 수익 기대\n재물운 상승, 새로운 수입원 확보 가능',
      방어: '비상금 확보 필수\n고위험 투자 금지\n보험·안전장치 점검',
    },
    {
      영역: '건강',
      용기: '만성 피로 · 면역력 저하\n기존 지병 악화 가능, 정기 검진 필수',
      기용: '체력 회복 · 활력 증가\n운동 효과 극대화, 건강 습관 형성 적기',
      방어: '정기 검진 필수\n무리한 야근 지양\n취약 부위 관리 강화',
    },
    {
      영역: '인간관계',
      용기: '갈등 증가 · 배신·이별 가능성\n가까운 사람과의 마찰 주의',
      기용: '좋은 인연 유입 · 관계 회복\n귀인 출현, 협력 관계 강화',
      방어: '감정적 대응 자제\n핵심 인맥 유지 집중\n새 인연은 신중하게',
    },
  ];

  // 강조 컬럼: 전환 방향에 따라
  // good_to_bad → 용기(위축) 컬럼 강조, bad_to_good → 기용(확장) 컬럼 강조
  const hlCol = transDir === 'good_to_bad' ? 1 : transDir === 'bad_to_good' ? 2 : 0;

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>교체기 변화표 》 ${esc(name)}님</title>
  <style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; margin:0 auto; padding:14px 20px; background:transparent; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px auto; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;margin-bottom:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.tbl-trans { font-size:10px; color:#333; margin-bottom:10px; padding:5px 10px; border-radius:6px; font-weight:700; display:inline-block; }
.trans-bad  { background:#ffebee; color:#c62828; border:1px solid #ef9a9a; }
.trans-good { background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7; }
.trans-neutral { background:#f5f5f5; color:#666; border:1px solid #333; }
table { width:100%; border-collapse:collapse; }
th { background:#1a3a6a; color:white; font-size:12px; font-weight:700; padding:6px 6px; text-align:center; }
td { font-size:11px; padding:6px 6px; border-bottom:1px solid #e8e8e8; vertical-align:top; line-height:1.4; white-space:pre-line; }
tr:nth-child(even) td { background:#f8f9fc; }
tr:nth-child(odd) td { background:#ffffff; }
.area-col { font-weight:900; color:#1a3a6a; text-align:center; white-space:nowrap; font-size:11px; }
.risk-col { color:#c62828; }
.opp-col  { color:#2e7d32; }
.def-col  { color:#555; font-size:11px; }
.hl-risk td.risk-col { background:#ffebee !important; border:2px solid #ef9a9a; }
.hl-opp td.opp-col   { background:#e8f5e9 !important; border:2px solid #a5d6a7; }
  </style>
</head>
<body>
  <div class="page">
    <div class="banner-hdr" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
      <div>
        <div class="banner-hdr-title">대운 교체기 변화표</div>
        <div class="banner-hdr-sub">영역별 대운 전환 변화 분석</div>
      </div>
      <div>
        <div class="banner-hdr-name">${esc(name)} 님</div>
        <div class="banner-hdr-detail">일주 ${esc(ilju)} · ${esc(sinGang)} · ${esc(curDWSung)} → ${esc(nextDWSung)||'—'}${교체년도 ? ' · '+esc(교체년도)+'년' : ''}</div>
      </div>
    </div>
    <div class="tbl-trans ${transDir==='good_to_bad'?'trans-bad':transDir==='bad_to_good'?'trans-good':'trans-neutral'}">${esc(transDirLabel)}${현재대운간지?' ('+esc(현재대운간지)+' → '+esc(다음대운간지)+')':''}</div>
    <table>
      <thead>
        <tr>
          <th style="width:14%;">변화 영역</th>
          <th style="width:29%;">용신→기신 전환 시</th>
          <th style="width:29%;">기신→용신 전환 시</th>
          <th style="width:28%;">방어책</th>
        </tr>
      </thead>
      <tbody>
${rows.map(r => {
  const rowCls = hlCol === 1 ? ' class="hl-risk"' : hlCol === 2 ? ' class="hl-opp"' : '';
  return `        <tr${rowCls}>
          <td class="area-col">${esc(r.영역)}</td>
          <td class="risk-col">${esc(r.용기)}</td>
          <td class="opp-col">${esc(r.기용)}</td>
          <td class="def-col">${esc(r.방어)}</td>
        </tr>`;
}).join('\n')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '교체기변화표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '교체기변화표');
  console.log(`✅ 교체기변화표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_교체기변화표.js <slot_id>'); process.exit(1); }
generate(slotId);
