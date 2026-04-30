#!/usr/bin/env node
// generate_신강약직업표.js
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch06.json
// 출력: tables/{slot}/신강약직업표.html
// 신강약 단계별 직업 추천표
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
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d6); } catch(e){}

  // 인적사항
  const name    = d3['이름']        || slotId;
  const ilju    = d3['일주']        || '';
  const sinGang = d3['신강약']      || d6['신강약'] || '';
  const gyeokNm = d3['격국명']      || d6['격국명'] || '';

  // 사용자 신강약 단계 매칭
  function getUserLevel(sg) {
    if (!sg) return '중화';
    if (sg.includes('극신강')) return '극신강';
    if (sg.includes('극신약')) return '극신약';
    if (sg.includes('신강'))  return '신강';
    if (sg.includes('신약'))  return '신약';
    if (sg.includes('중화'))  return '중화';
    return '중화';
  }
  const userLevel = getUserLevel(sinGang);

  const rows = [
    {
      구분: '극신강',
      환경: '독립적·자율적 환경',
      직업: '사업가·리더·전문직·독립 컨설턴트·프리랜서',
      주의: '에너지 분산 주의, 팀과의 소통 필수',
    },
    {
      구분: '신강',
      환경: '자율적·재량권 있는 환경',
      직업: '관리직·기획·영업·마케팅·스타트업',
      주의: '고집으로 인한 마찰 주의, 경청 필요',
    },
    {
      구분: '중화',
      환경: '유연한·균형 잡힌 환경',
      직업: '전천후 가능 — 상황에 맞는 역할 수행',
      주의: '방향 설정이 가장 중요, 우유부단 주의',
    },
    {
      구분: '신약',
      환경: '협력적·팀 기반 환경',
      직업: '보좌역·전문기술직·상담·교육·연구',
      주의: '과로 주의, 체력 관리와 스트레스 조절 필수',
    },
    {
      구분: '극신약',
      환경: '보호적·안정적 환경',
      직업: '예술·연구·교육·심리상담·문화 콘텐츠',
      주의: '체력 관리 필수, 무리한 경쟁 환경 피할 것',
    },
  ];

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>신강약 직업 추천표 》 ${esc(name)}님</title>
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
table { width:100%; border-collapse:collapse; }
th { background:#1a3a6a; color:white; font-size:11px; font-weight:700; padding:5px 6px; text-align:center; }
th:first-child { text-align:center; }
td { font-size:10px; padding:5px 6px; border-bottom:1px solid #e8e8e8; vertical-align:top; line-height:1.4; }
tr:nth-child(even) td { background:#f8f9fc; }
tr:nth-child(odd) td { background:#ffffff; }
.hl-row td { background:#e3f2fd !important; border-top:2px solid #1565c0; border-bottom:2px solid #1565c0; }
.hl-row td:first-child { border-left:3px solid #1565c0; }
.hl-row td:last-child { border-right:3px solid #1565c0; }
.level-col { font-weight:900; color:#1a3a6a; text-align:center; white-space:nowrap; font-size:10px; }
.warn-col { color:#c62828; font-size:10px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="banner-hdr" style="background:linear-gradient(135deg,#e65100,#f57c00);">
      <div>
        <div class="banner-hdr-title">신강약별 직업 추천표</div>
        <div class="banner-hdr-sub">신강약 단계별 적합 환경 · 직업군 · 주의사항</div>
      </div>
      <div>
        <div class="banner-hdr-name">${esc(name)} 님</div>
        <div class="banner-hdr-detail">일주 ${esc(ilju)} · ${esc(sinGang)} · ${esc(gyeokNm)} · 단계 ${esc(userLevel)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:13%;">구분</th>
          <th style="width:22%;">적합 환경</th>
          <th style="width:38%;">추천 직업군</th>
          <th style="width:27%;">주의사항</th>
        </tr>
      </thead>
      <tbody>
${rows.map(r => {
  const isHL = r.구분 === userLevel;
  const rowCls = isHL ? ' class="hl-row"' : '';
  return `        <tr${rowCls}>
          <td class="level-col">${esc(r.구분)}${isHL ? ' ★' : ''}</td>
          <td>${esc(r.환경)}</td>
          <td>${esc(r.직업)}</td>
          <td class="warn-col">${esc(r.주의)}</td>
        </tr>`;
}).join('\n')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '신강약직업표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '신강약직업표');
  console.log(`✅ 신강약직업표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_신강약직업표.js <slot_id>'); process.exit(1); }
generate(slotId);
