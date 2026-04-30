#!/usr/bin/env node
// generate_양생식품표.js
// 용신/희신 오행 추천 식품 + 기신 오행 주의 식품 테이블
// 입력: queue/{slot}_ch03.json
// 출력: tables/{slot}/양생식품표.html
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

// 오행별 식품 매핑
const 오행식품맵 = {
  '木': { 맛:'신맛(酸)', 식품:'매실, 귤, 식초, 푸른채소, 시금치, 브로콜리, 키위', 색:'녹색 식품' },
  '火': { 맛:'쓴맛(苦)', 식품:'커피, 쑥, 고들빼기, 다크초콜릿, 셀러리, 녹차, 케일', 색:'붉은 식품' },
  '土': { 맛:'단맛(甘)', 식품:'꿀, 고구마, 대추, 찹쌀, 호박, 감자, 잣', 색:'노란 식품' },
  '金': { 맛:'매운맛(辛)', 식품:'마늘, 생강, 고추, 양파, 무, 배, 도라지', 색:'흰색 식품' },
  '水': { 맛:'짠맛(鹹)', 식품:'미역, 다시마, 해산물, 검은콩, 흑임자, 굴, 전복', 색:'검은 식품' },
};

// 오행별 효과 설명 (추천/주의 공용)
const 오행효과맵 = {
  '木': { 추천:'간·담 기능 강화, 근육·눈 건강 증진, 해독 효과', 주의:'간 기능 과항진, 소화기(土) 약화, 위산 과다' },
  '火': { 추천:'심장·혈액순환 촉진, 정신 안정, 면역력 강화', 주의:'심장 과부하, 불면 유발, 혈압 상승 위험' },
  '土': { 추천:'비위 강화, 소화흡수 개선, 기력 보충', 주의:'비만·당뇨 유발, 습(濕) 과다, 소화기 부담' },
  '金': { 추천:'폐·호흡기 강화, 면역 증진, 기순환 촉진', 주의:'위장 자극, 폐열 유발, 피부 트러블' },
  '水': { 추천:'신장·방광 강화, 수분대사 개선, 뼈·관절 건강', 주의:'냉증 악화, 부종 유발, 혈압 불안정' },
};

function generate(slotId) {
  const d3 = loadJSON(`${slotId}_ch03.json`);
  const d8 = loadJSON(`${slotId}_ch08.json`);
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d8); } catch(e){}
  if (!d3['이름'] && !d3['user_name']) { console.log('⚠️ 양생식품표: ch03.json 없음 (스킵)'); return; }

  const name = d3['이름'] || d3['user_name'] || slotId;
  const ilju = d3['일주한자'] || d3['일주'] || '';
  // 모든 5신: ch03/d8 양쪽 fallback + "木(목)" 형식에서 한자만 추출
  const _ohExt = (raw) => (raw||'').match(/([木火土金水])/)?.[1] || raw || '';
  const 용신오행 = _ohExt(d3['용신한자'] || d3['용신오행'] || d8['용신한자'] || d8['용신오행']);
  const 희신오행 = _ohExt(d3['희신오행'] || d8['희신오행']);
  const 기신오행 = _ohExt(d3['기신오행'] || d8['기신오행']);
  const 구신오행 = _ohExt(d3['구신오행'] || d8['구신오행']);

  // 추천 식품 (용신 + 희신)
  const 추천오행 = [...new Set([용신오행, 희신오행].filter(Boolean))];
  // 주의 식품 (기신 + 구신)
  const 주의오행 = [...new Set([기신오행, 구신오행].filter(Boolean))];

  const 추천rows = 추천오행.map(oh => {
    const info = 오행식품맵[oh] || {};
    const 효과 = 오행효과맵[oh] || {};
    const 구분 = oh === 용신오행 ? '용신(用神)' : '희신(喜神)';
    return `<tr style="background:#e8f5e9;">
      <td style="font-weight:700;color:#2e7d32;">✅ ${esc(구분)}</td>
      <td style="font-weight:700;color:#1a3a6a;">${esc(oh)} ${esc(info.맛||'')}</td>
      <td>${esc(info.식품||'')}</td>
      <td style="color:#2e7d32;">${esc(효과.추천||'')}</td>
    </tr>`;
  }).join('');

  const 주의rows = 주의오행.map(oh => {
    const info = 오행식품맵[oh] || {};
    const 효과 = 오행효과맵[oh] || {};
    const 구분 = oh === 기신오행 ? '기신(忌神)' : '구신(仇神)';
    return `<tr style="background:#fff5f5;">
      <td style="font-weight:700;color:#c62828;">⚠ ${esc(구분)}</td>
      <td style="font-weight:700;color:#1a3a6a;">${esc(oh)} ${esc(info.맛||'')}</td>
      <td>${esc(info.식품||'')}</td>
      <td style="color:#c62828;">${esc(효과.주의||'')}</td>
    </tr>`;
  }).join('');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>양생식품표 》 ${esc(name)}님</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;margin:0 auto;padding:14px 20px;background:transparent;display:flex;flex-direction:column;gap:6px;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{body{background:transparent;margin:0;padding:0;}.page{margin:0;width:604px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px 820px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;margin-bottom:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
.section-label{font-size:8pt;font-weight:800;padding:5px 10px;border-radius:4px;margin:4px 0 2px;}
table{width:100%;border-collapse:collapse;font-size:9px;}
th{background:#1a3a6a;color:white;padding:5px 5px;font-size:10px;font-weight:700;text-align:left;}
td{border-bottom:1px solid #eee;padding:5px 5px;vertical-align:top;line-height:1.5;}
tr:last-child td{border-bottom:none;}
.note{font-size:8.5pt;color:#888;margin-top:4px;padding:4px 8px;background:#f9f9f9;border-radius:4px;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#2e7d32,#388e3c);">
  <div>
    <div class="banner-hdr-title">양생식품(養生食品)표</div>
    <div class="banner-hdr-sub">용신·희신 추천 식품 + 기신·구신 주의 식품</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · 용신 ${esc(용신오행)} · 기신 ${esc(기신오행)}</div>
  </div>
</div>

<div class="section-label" style="background:#e8f5e9;color:#1b5e20;">✅ 추천 식품 — 용신·희신 오행</div>
<table>
<thead><tr>
  <th>구분</th><th>오행</th><th>대표 식품</th><th>효과 / 이유</th>
</tr></thead>
<tbody>${추천rows || '<tr><td colspan="4" style="text-align:center;color:#888;">—</td></tr>'}</tbody>
</table>

<div class="section-label" style="background:#ffebee;color:#c62828;margin-top:8px;">⚠ 주의 식품 — 기신·구신 오행</div>
<table>
<thead><tr>
  <th>구분</th><th>오행</th><th>대표 식품</th><th>효과 / 이유</th>
</tr></thead>
<tbody>${주의rows || '<tr><td colspan="4" style="text-align:center;color:#888;">—</td></tr>'}</tbody>
</table>

<div class="note">
  ※ 용신(用神) 오행의 식품을 자주 섭취하면 체질 균형에 도움이 됩니다.<br>
  ※ 기신(忌神) 오행의 식품은 과다 섭취를 피하되, 완전 배제는 불필요합니다.<br>
  ※ 오행 식품은 보조적 양생법이며, 의학적 처방을 대체하지 않습니다.
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '양생식품표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '양생식품표');
  console.log(`✅ 양생식품표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_양생식품표.js <slot_id>'); process.exit(1); }
generate(slotId);
