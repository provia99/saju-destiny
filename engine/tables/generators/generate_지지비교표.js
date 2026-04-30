#!/usr/bin/env node
/**
 * generate_지지비교표.js  — 12지지 비교표 (사용자 4지지 강조)
 * node generate_지지비교표.js <slot_id>
 * 출력: tables/{slot}/지지비교표.html
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const COLORS = {
  木: { main:'#1e6b2a', pale:'#f3fcf5', border:'#a8dbb5' },
  火: { main:'#b92e27', pale:'#fff5f5', border:'#f5a9a5' },
  土: { main:'#9b6f00', pale:'#fffdf4', border:'#f0d470' },
  金: { main:'#3d4f5c', pale:'#f7f9fa', border:'#b0c4d0' },
  水: { main:'#1a4e7a', pale:'#f0f6ff', border:'#90bfe0' },
};

// 시간대는 한국 표준시 보정 적용 — 동경 135도 기준 +30분 (서울 동경 127도)
const JIJIS = [
  { han:'子', kor:'자', oh:'水', animal:'쥐(鼠)',     season:'겨울',      time:'23:30~01:29', trait:'지혜, 재치, 민첩함' },
  { han:'丑', kor:'축', oh:'土', animal:'소(牛)',     season:'겨울→봄',   time:'01:30~03:29', trait:'성실, 인내, 묵직함' },
  { han:'寅', kor:'인', oh:'木', animal:'호랑이(虎)', season:'봄',        time:'03:30~05:29', trait:'용맹, 진취, 리더십' },
  { han:'卯', kor:'묘', oh:'木', animal:'토끼(兎)',   season:'봄',        time:'05:30~07:29', trait:'온화, 예술성, 감수성' },
  { han:'辰', kor:'진', oh:'土', animal:'용(龍)',     season:'봄→여름',   time:'07:30~09:29', trait:'권위, 변화, 신비' },
  { han:'巳', kor:'사', oh:'火', animal:'뱀(蛇)',     season:'여름',      time:'09:30~11:29', trait:'지혜, 통찰, 전략' },
  { han:'午', kor:'오', oh:'火', animal:'말(馬)',     season:'여름',      time:'11:30~13:29', trait:'열정, 활동, 자유' },
  { han:'未', kor:'미', oh:'土', animal:'양(羊)',     season:'여름→가을', time:'13:30~15:29', trait:'온순, 예술, 감성' },
  { han:'申', kor:'신', oh:'金', animal:'원숭이(猴)', season:'가을',      time:'15:30~17:29', trait:'재치, 다재, 변통' },
  { han:'酉', kor:'유', oh:'金', animal:'닭(鷄)',     season:'가을',      time:'17:30~19:29', trait:'정밀, 심미, 완벽' },
  { han:'戌', kor:'술', oh:'土', animal:'개(犬)',     season:'가을→겨울', time:'19:30~21:29', trait:'충직, 의리, 수호' },
  { han:'亥', kor:'해', oh:'水', animal:'돼지(豬)',   season:'겨울',      time:'21:30~23:29', trait:'복덕, 낙천, 포용' },
];

// 4주 지지별 강조색
const HL = {
  년지: { bg:'#fef3c7', bd:'#fbbf24', label:'년지' },
  월지: { bg:'#dbeafe', bd:'#60a5fa', label:'월지' },
  일지: { bg:'#dcfce7', bd:'#4ade80', label:'일지' },
  시지: { bg:'#fce7f3', bd:'#f472b6', label:'시지' },
};

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  if (!fs.existsSync(ch03Path)) { console.error('없음:', ch03Path); process.exit(1); }
  const d  = JSON.parse(fs.readFileSync(ch03Path, 'utf-8'));
  const mp = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`), 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d, mp); } catch(e){}

  const name = d['이름'] || slotId;
  const ilju = d['일주'] || '';

  // 사용자 4 지지 한자
  const userJiji = {};
  const PILLARS = ['년주','월주','일주','시주'];
  const LABELS  = ['년지','월지','일지','시지'];
  for (let i = 0; i < 4; i++) {
    const jj = d[`${PILLARS[i]}_지지`] || '';
    if (jj) userJiji[jj] = (userJiji[jj] || []).concat(LABELS[i]);
  }

  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>지지비교표 - ${esc(name)}</title>
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
table{width:100%;border-collapse:collapse;}
th{background:#1a3a6a;color:white;font-family:'Noto Serif KR',serif;font-size:10px;font-weight:700;padding:4px 4px;border:1px solid #1a3a6a;text-align:center;}
td{font-size:9px;padding:4px 4px;border:1px solid #333;text-align:center;vertical-align:middle;}
tr:nth-child(even) td{background:#fafafa;}
tr:nth-child(odd) td{background:transparent;}
.han{font-family:'Noto Serif KR',serif;font-size:13px;font-weight:800;}
.oh-badge{display:inline-block;padding:1px 4px;border-radius:3px;color:white;font-size:9px;font-weight:700;}
.pos-tag{display:inline-block;padding:0 3px;border-radius:3px;font-size:8px;font-weight:700;margin:1px;}
.trait{font-size:9px;color:#333;text-align:left;}
.legend{margin-top:8px;display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap;}
.legend-item{display:flex;align-items:center;gap:4px;font-size:8pt;color:#555;}
.legend-dot{width:10px;height:10px;border-radius:2px;}
@media print{body{background:transparent;padding:0;display:block;}.page{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px auto;margin:0;}}
</style></head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
  <div>
    <div class="banner-hdr-title">地支 비교표 (십이지지 일람)</div>
    <div class="banner-hdr-sub">12개 지지의 오행 · 계절 · 시간대 · 핵심 기질 비교</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}</div>
  </div>
</div>

<table>
<thead><tr>
  <th style="width:44px;">지지</th>
  <th style="width:72px;">띠</th>
  <th style="width:38px;">오행</th>
  <th style="width:62px;">계절</th>
  <th style="width:72px;">시간대</th>
  <th>핵심 기질</th>
</tr></thead>
<tbody>
`;

  for (const j of JIJIS) {
    const matches = userJiji[j.han] || [];
    const c = COLORS[j.oh];
    // pick the first matching position's color for the row highlight
    let rowStyle = '';
    let tags = '';
    if (matches.length > 0) {
      const first = HL[matches[0]];
      rowStyle = ` style="background:${first.bg};border-left:3px solid ${first.bd};"`;
      tags = matches.map(m => {
        const h = HL[m];
        return `<span class="pos-tag" style="background:${h.bd};color:white;">${h.label}</span>`;
      }).join('');
    }

    H += `<tr${rowStyle}>
  <td><span class="han" style="color:${c.main};">${j.han}</span>${tags?' <br>'+tags:''}</td>
  <td style="font-size:10px;">${esc(j.animal)}</td>
  <td><span class="oh-badge" style="background:${c.main};">${j.oh}</span></td>
  <td style="font-size:10px;">${esc(j.season)}</td>
  <td style="font-size:10px;">${esc(j.time)}</td>
  <td class="trait">${esc(j.trait)}</td>
</tr>\n`;
  }

  H += `</tbody></table>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:${HL.년지.bd};"></div>년지</div>
  <div class="legend-item"><div class="legend-dot" style="background:${HL.월지.bd};"></div>월지</div>
  <div class="legend-item"><div class="legend-dot" style="background:${HL.일지.bd};"></div>일지</div>
  <div class="legend-item"><div class="legend-dot" style="background:${HL.시지.bd};"></div>시지</div>
</div>
</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '지지비교표.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ ${outFile}  (${fs.statSync(outFile).size.toLocaleString()}B)`);
  return outFile;
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_지지비교표.js <slot_id>'); process.exit(1); }
generate(slotId);
