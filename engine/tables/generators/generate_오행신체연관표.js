#!/usr/bin/env node
/**
 * generate_오행신체연관표.js  — 오행-신체 연관표 (일간 오행 + 최약 오행 강조)
 * node generate_오행신체연관표.js <slot_id>
 * 출력: tables/{slot}/오행신체연관표.html
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function ohKey(v) {
  if (!v) return null;
  const m = { wood:'wood','木':'wood','목':'wood', fire:'fire','火':'fire','화':'fire',
              earth:'earth','土':'earth','토':'earth', metal:'metal','金':'metal','금':'metal',
              water:'water','水':'water','수':'water' };
  if (m[v]) return m[v];
  return m[String(v).charAt(0)] || null;
}

const COLORS = {
  木: { main:'#1e6b2a', pale:'#f3fcf5' },
  火: { main:'#b92e27', pale:'#fff5f5' },
  土: { main:'#9b6f00', pale:'#fffdf4' },
  金: { main:'#3d4f5c', pale:'#f7f9fa' },
  水: { main:'#1a4e7a', pale:'#f0f6ff' },
};

const BODY_DATA = [
  { oh:'木', hanja:'木(목)', organ:'간(肝)',    bu:'담(膽)',        body:'눈 · 근육 · 힘줄',     symptom:'시력저하 · 근육경직',         emotion:'분노' },
  { oh:'火', hanja:'火(화)', organ:'심장(心)',   bu:'소장(小腸)',    body:'혀 · 혈관',             symptom:'심장질환 · 불면',             emotion:'기쁨 (과다 시 불안)' },
  { oh:'土', hanja:'土(토)', organ:'비(脾)',     bu:'위(胃)',        body:'입 · 살',               symptom:'소화불량 · 부종',             emotion:'걱정' },
  { oh:'金', hanja:'金(금)', organ:'폐(肺)',     bu:'대장(大腸)',    body:'코 · 피부',             symptom:'호흡기질환 · 피부트러블',     emotion:'슬픔' },
  { oh:'水', hanja:'水(수)', organ:'신(腎)',     bu:'방광(膀胱)',    body:'귀 · 뼈',               symptom:'신장질환 · 관절',             emotion:'두려움' },
];

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  if (!fs.existsSync(ch03Path)) { console.error('없음:', ch03Path); process.exit(1); }
  const d  = JSON.parse(fs.readFileSync(ch03Path, 'utf-8'));

  const d4 = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_ch04.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_ch04.json`), 'utf-8')) : {};
  const d1 = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_ch01.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_ch01.json`), 'utf-8')) : {};
  const mp = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`), 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d, d4, d1, mp); } catch(e){}

  const name  = d['이름'] || slotId;
  const ilju  = d['일주'] || '';
  const ilOhK = ohKey(d['일주_천간_오행'] || '');

  // 오행 점수 → 최약 오행 판별
  const SC = {
    '木': +(d4['목점수']||d1['목점수']||mp['목점수']||0),
    '火': +(d4['화점수']||d1['화점수']||mp['화점수']||0),
    '土': +(d4['토점수']||d1['토점수']||mp['토점수']||0),
    '金': +(d4['금점수']||d1['금점수']||mp['금점수']||0),
    '水': +(d4['수점수']||d1['수점수']||mp['수점수']||0),
  };
  const minScore = Math.min(...Object.values(SC));
  const weakestOh = Object.keys(SC).find(k => SC[k] === minScore) || '';
  const weakestK  = ohKey(weakestOh);

  // 일간 오행 한자 (木,火,土,金,水)
  const ilOhHan = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' }[ilOhK] || '';

  const HL_ILGAN  = { bg:'#dbeafe', bd:'#3b82f6' };    // 일간 오행 강조
  const HL_WEAK   = { bg:'#fef3c7', bd:'#f59e0b' };    // 최약 오행 강조

  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>오행신체연관표 - ${esc(name)}</title>
<style>
${FONT_FACE_CSS}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Noto Sans KR',sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:30px 0;}
.page{ border:1px solid #333;width:604px;margin:0 auto;background:transparent;border-radius:8px;padding:12px 16px;}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;margin-bottom:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
table{width:100%;border-collapse:collapse;margin-bottom:6px;}
th{background:#1a3a6a;color:white;font-family:'Noto Serif KR',serif;font-size:12px;font-weight:700;padding:6px 6px;border:1px solid #1a3a6a;text-align:center;}
td{font-size:11px;padding:6px 6px;border:1px solid #333;text-align:center;vertical-align:middle;}
tr:nth-child(even) td{background:#fafafa;}
tr:nth-child(odd) td{background:transparent;}
.oh-cell{font-family:'Noto Serif KR',serif;font-size:15px;font-weight:800;}
.symptom{font-size:10px;color:#b71c1c;}
.emotion{font-size:10px;font-weight:600;}
.legend{display:flex;gap:14px;justify-content:flex-end;font-size:8pt;color:#555;}
.legend-item{display:flex;align-items:center;gap:4px;}
.legend-dot{width:10px;height:10px;border-radius:2px;border:1px solid #333;}
@media print{body{background:transparent;padding:0;display:block;}.page{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px auto;margin:0;}}
</style></head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
  <div>
    <div class="banner-hdr-title">五行 신체 연관표</div>
    <div class="banner-hdr-sub">오행별 장부 · 신체 · 주의 증상 · 감정 연관</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · 일간오행 ${esc(ilOhHan)} · 최약오행 ${esc(weakestOh)}</div>
  </div>
</div>

<table>
<thead><tr>
  <th style="width:52px;">오행</th>
  <th style="width:62px;">장부(臟)</th>
  <th style="width:72px;">부(腑)</th>
  <th>관련 신체</th>
  <th>주의 증상</th>
  <th style="width:72px;">감정</th>
</tr></thead>
<tbody>
`;

  for (const b of BODY_DATA) {
    const c = COLORS[b.oh];
    const k = ohKey(b.oh);
    const isIlgan  = (b.oh === ilOhHan);
    const isWeakest = (b.oh === weakestOh && !isIlgan); // 일간과 최약이 같으면 일간만 표시
    const isBoth    = (b.oh === ilOhHan && b.oh === weakestOh);

    let rowBg = '';
    let rowBd = '';
    let tag = '';
    if (isBoth) {
      rowBg = HL_ILGAN.bg; rowBd = HL_ILGAN.bd;
      tag = '<span style="font-size:8px;color:#3b82f6;font-weight:900;">일간+최약</span>';
    } else if (isIlgan) {
      rowBg = HL_ILGAN.bg; rowBd = HL_ILGAN.bd;
      tag = '<span style="font-size:8px;color:#3b82f6;font-weight:900;">일간 오행</span>';
    } else if (isWeakest) {
      rowBg = HL_WEAK.bg; rowBd = HL_WEAK.bd;
      tag = '<span style="font-size:8px;color:#f59e0b;font-weight:900;">최약 오행</span>';
    }

    const rowStyle = rowBg ? ` style="background:${rowBg};border-left:3px solid ${rowBd};"` : '';

    H += `<tr${rowStyle}>
  <td><span class="oh-cell" style="color:${c.main};">${b.oh}</span><br>${tag}</td>
  <td style="font-weight:600;font-size:11px;">${esc(b.organ)}</td>
  <td style="font-size:11px;">${esc(b.bu)}</td>
  <td style="font-size:11px;">${esc(b.body)}</td>
  <td class="symptom">${esc(b.symptom)}</td>
  <td class="emotion">${esc(b.emotion)}</td>
</tr>\n`;
  }

  H += `</tbody></table>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:${HL_ILGAN.bg};border-color:${HL_ILGAN.bd};"></div>일간 오행 (${esc(ilOhHan)})</div>
  <div class="legend-item"><div class="legend-dot" style="background:${HL_WEAK.bg};border-color:${HL_WEAK.bd};"></div>가장 약한 오행 (${esc(weakestOh)})</div>
</div>
</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '오행신체연관표.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ ${outFile}  (${fs.statSync(outFile).size.toLocaleString()}B)`);
  return outFile;
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_오행신체연관표.js <slot_id>'); process.exit(1); }
generate(slotId);
