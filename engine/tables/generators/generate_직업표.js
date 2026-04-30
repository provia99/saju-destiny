#!/usr/bin/env node
// generate_직업표.js
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch11.json
// 출력: tables/{slot}/직업표.html
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

function chips(str, color, bg) {
  if (!str) return '<span style="color:#bbb;font-size:6.5pt;">—</span>';
  return str.split(/[·,·]/).map(s => s.trim()).filter(Boolean)
    .map(s => `<span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:6.5pt;font-weight:700;background:${bg};color:${color};border:1.5px solid ${color}44;margin:1px;">${esc(s)}</span>`)
    .join('');
}

function generate(slotId) {
  const d3  = loadJSON(`${slotId}_ch03.json`);
  const d11 = loadJSON(`${slotId}_ch11.json`);
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d11); } catch(e){}

  // 인적사항
  const name    = d3['이름']        || slotId;
  const birthS  = d3['birth_solar'] || d3['생년월일'] || '';
  const gender  = d3['user_gender'] || d3['성별']    || '';
  const age     = d3['user_age']    || d3['나이']    || '';
  const ilju    = d3['일주']        || '';
  const sinGang = d3['신강약']       || '';
  const gyeokNm = d3['격국명']       || '';

  // ── 직업 데이터 (ch11) ──────────────────────────────
  const chunjikType   = d11['천직유형목록']  || '';
  const fitJikjong    = d11['적합직종목록']  || '';
  const yongJobGroup  = d11['용신직업군']   || d3['용신직업군'] || '';
  const jaemulHuiGet  = d11['재물획득유형'] || '';
  const jaemulJuyui   = d11['재물주의유형'] || '';
  const jaemulChulche = d11['재물출처']    || '';
  const saeopYN       = d11['사업가능여부'] || '';
  const saeopTime     = d11['사업가능시기'] || '';
  const saeopDesc     = d11['사업시기설명'] || '';
  const jaemulJuyui2  = d11['재물주의']    || '';

  // 추가 직업 상세 데이터
  const jikupHwan    = d11['직업변화시기']  || '';
  const jikupTip     = d11['직업활용팁']   || '';
  const jaemulChukJuk = d11['재물축적방법'] || '';
  const jaemulPeak   = d11['재물절정시기'] || '';

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>직업·재물(職業·財物) 분석표 》 ${esc(name)}님</title>
  <style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; padding:14px 20px; background:transparent; display:flex; flex-direction:column; gap:6px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 820px; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:2px solid #ccc;border-radius:10px;overflow:hidden; }
.card-hd { padding:6px 14px;display:flex;align-items:center;justify-content:space-between; }
.card-hd-title { font-size:9pt;font-weight:900;color:white; }
.card-hd-sub { font-size:6.5pt;color:rgba(255,255,255,.85); }
.card-body { padding:9px 14px;background:transparent; }
.attr-grid { display:grid;grid-template-columns:1fr 1fr;gap:5px; }
.attr-item { border-radius:6px;padding:6px 9px;border:1.5px solid #e0e0e0;background:#fafafa; }
.attr-lbl  { font-size:6pt;font-weight:700;color:#888;margin-bottom:2px; }
.attr-val  { font-size:7pt;font-weight:700;color:#333;line-height:1.5; }
.chip-section { margin-bottom:7px; }
.cs-lbl { font-size:6pt;font-weight:700;color:#888;margin-bottom:4px; }
.cs-chips { display:flex;flex-wrap:wrap;gap:3px; }
.biz-badge { display:inline-block;padding:3px 10px;border-radius:6px;font-size:8pt;font-weight:900;margin-right:6px; }
.divider { border:none;border-top:1px solid #f0f0f0;margin:8px 0; }
  </style>
</head>
<body>
  <div class="page">

    <div class="banner-hdr" style="background:linear-gradient(135deg,#00695c,#00897b);">
  <div>
    <div class="banner-hdr-title">💼 직업·재물(職業·財物) 분석표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${sinGang?' · '+esc(sinGang):''}</div>
  </div>
</div>

    <!-- ① 천직·직종 분석 -->
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
        <div class="card-hd-title">① 천직(天職) · 적합 직종</div>
        <div class="card-hd-sub">타고난 직업 적성 및 용신 직업군</div>
      </div>
      <div class="card-body">
        ${chunjikType?`<div class="chip-section"><div class="cs-lbl">천직(天職) 유형</div><div class="cs-chips">${chips(chunjikType,'#1b5e20','#e8f5e9')}</div></div>`:''}
        ${fitJikjong?`<div class="chip-section"><div class="cs-lbl">적합 직종</div><div class="cs-chips">${chips(fitJikjong,'#1565c0','#e3f2fd')}</div></div>`:''}
        ${yongJobGroup?`<div class="chip-section"><div class="cs-lbl">용신 직업군</div><div class="cs-chips">${chips(yongJobGroup,'#e65100','#fff3e0')}</div></div>`:''}
        ${jikupHwan?`<div style="padding:6px 10px;background:#f3e5f5;border-radius:6px;border-left:3px solid #9c27b0;font-size:7pt;color:#555;line-height:1.6;margin-top:2px;">
          <strong style="color:#6a1b9a;">직업 변화 시기:</strong> ${esc(jikupHwan)}
        </div>`:''}
        ${jikupTip?`<div style="padding:6px 10px;background:#e8f5e9;border-radius:6px;border-left:3px solid #2e7d32;font-size:7pt;color:#555;line-height:1.6;margin-top:5px;">
          <strong style="color:#1b5e20;">직업 활용 팁:</strong> ${esc(jikupTip)}
        </div>`:''}
      </div>
    </div>

    <!-- ② 재물 구조 분석 -->
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,#e65100,#f57c00);">
        <div class="card-hd-title">② 재물(財物) 구조 분석</div>
        <div class="card-hd-sub">재물 획득 패턴 · 주의 유형 · 사업 여부</div>
      </div>
      <div class="card-body">
        <div class="attr-grid" style="margin-bottom:6px;">
          ${jaemulHuiGet?`<div class="attr-item" style="border-color:#4caf5044;"><div class="attr-lbl">재물 획득 유형</div><div class="attr-val">${esc(jaemulHuiGet)}</div></div>`:''}
          ${jaemulChulche?`<div class="attr-item" style="border-color:#ff980044;"><div class="attr-lbl">재물 출처</div><div class="attr-val">${esc(jaemulChulche)}</div></div>`:''}
          ${jaemulPeak?`<div class="attr-item" style="border-color:#ffc10744;"><div class="attr-lbl">재물 절정 시기</div><div class="attr-val">${esc(jaemulPeak)}</div></div>`:''}
          ${jaemulChukJuk?`<div class="attr-item" style="border-color:#4caf5044;"><div class="attr-lbl">재물 축적 방법</div><div class="attr-val">${esc(jaemulChukJuk)}</div></div>`:''}
          ${(jaemulJuyui||jaemulJuyui2)?`<div class="attr-item" style="grid-column:span 2;border-color:#f4433644;"><div class="attr-lbl">⚠️ 재물 주의</div><div class="attr-val" style="color:#c62828;">${esc(jaemulJuyui||jaemulJuyui2)}</div></div>`:''}
        </div>
        ${saeopYN?`<div style="padding:8px 10px;background:#f3e5f5;border-radius:6px;border-left:3px solid #9c27b0;font-size:7pt;line-height:1.6;">
          <span class="biz-badge" style="background:${saeopYN.includes('가능')?'#9c27b0':'#9e9e9e'};color:white;">${esc(saeopYN)}</span>
          ${saeopTime?`<strong style="color:#6a1b9a;">시기:</strong> ${esc(saeopTime)} `:''}
          ${saeopDesc?esc(saeopDesc):''}
        </div>`:''}
      </div>
    </div>

  </div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '직업표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '직업표');
  console.log(`✅ 직업표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_직업표.js <slot_id>'); process.exit(1); }
generate(slotId);
