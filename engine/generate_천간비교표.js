#!/usr/bin/env node
/**
 * generate_천간비교표.js  — 10천간 비교표 (사용자 일간 강조)
 * node generate_천간비교표.js <slot_id>
 * 출력: tables/{slot}/천간비교표.html
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
  木: { main:'#1e6b2a', light:'#e8f7ec', pale:'#f3fcf5', border:'#a8dbb5' },
  火: { main:'#b92e27', light:'#fde8e7', pale:'#fff5f5', border:'#f5a9a5' },
  土: { main:'#9b6f00', light:'#fff8e0', pale:'#fffdf4', border:'#f0d470' },
  金: { main:'#3d4f5c', light:'#eef1f4', pale:'#f7f9fa', border:'#b0c4d0' },
  水: { main:'#1a4e7a', light:'#e3eef9', pale:'#f0f6ff', border:'#90bfe0' },
};

const TENKANS = [
  { han:'甲', kor:'갑', oh:'木', yy:'양', nature:'큰 나무 / 거목',   trait:'곧은 리더십, 원칙, 추진력' },
  { han:'乙', kor:'을', oh:'木', yy:'음', nature:'풀 / 넝쿨',       trait:'유연한 적응, 센스, 생존력' },
  { han:'丙', kor:'병', oh:'火', yy:'양', nature:'태양',             trait:'밝은 매력, 사교성, 에너지' },
  { han:'丁', kor:'정', oh:'火', yy:'음', nature:'촛불',             trait:'집중력, 전문성, 깊이' },
  { han:'戊', kor:'무', oh:'土', yy:'양', nature:'큰 산 / 대지',     trait:'안정감, 포용력, 신뢰' },
  { han:'己', kor:'기', oh:'土', yy:'음', nature:'논밭',             trait:'세심함, 배려, 관계력' },
  { han:'庚', kor:'경', oh:'金', yy:'양', nature:'큰 쇠 / 바위',     trait:'결단력, 냉철함, 원칙' },
  { han:'辛', kor:'신', oh:'金', yy:'음', nature:'보석 / 칼',        trait:'정밀함, 심미안, 완벽주의' },
  { han:'壬', kor:'임', oh:'水', yy:'양', nature:'강 / 바다',        trait:'전략적 사고, 큰 그림, 유연' },
  { han:'癸', kor:'계', oh:'水', yy:'음', nature:'이슬 / 샘물',      trait:'직관력, 감수성, 섬세함' },
];

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  if (!fs.existsSync(ch03Path)) { console.error('없음:', ch03Path); process.exit(1); }
  const d  = JSON.parse(fs.readFileSync(ch03Path, 'utf-8'));
  const mp = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`), 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d, mp); } catch(e){}

  const name   = d['이름'] || slotId;
  const ilgan  = d['일주_천간'] || '';      // 한자 (甲,乙,...)
  const ilganE = d['일주_천간_음'] || '';    // 한글 (갑,을,...)
  const ilju   = d['일주'] || '';
  const HIGHLIGHT_BG = '#dbeafe';           // brand highlight
  const HIGHLIGHT_BD = '#93c5fd';

  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>천간비교표 - ${esc(name)}</title>
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
th{background:#1a3a6a;color:white;font-family:'Noto Serif KR',serif;font-size:11px;font-weight:700;padding:5px 5px;border:1px solid #1a3a6a;text-align:center;}
td{font-size:10px;padding:5px 5px;border:1px solid #333;text-align:center;vertical-align:middle;}
tr:nth-child(even) td{background:#fafafa;}
tr:nth-child(odd) td{background:transparent;}
.hl td{background:${HIGHLIGHT_BG} !important;border-color:${HIGHLIGHT_BD};}
.han{font-family:'Noto Serif KR',serif;font-size:16px;font-weight:800;}
.oh-badge{display:inline-block;padding:1px 6px;border-radius:4px;color:white;font-size:10px;font-weight:700;}
.yy-yang{color:#c0392b;font-weight:700;}
.yy-eum{color:#1a5276;font-weight:700;}
.nature{font-size:10px;color:#555;}
.trait{font-size:10px;color:#333;text-align:left;}
.legend{margin-top:6px;font-size:8pt;color:#888;text-align:right;}
@media print{body{background:transparent;padding:0;display:block;}.page{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px auto;margin:0;}}
</style></head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#1a237e,#283593);">
  <div>
    <div class="banner-hdr-title">天干 비교표 (십천간 일람)</div>
    <div class="banner-hdr-sub">10개 천간의 오행 · 음양 · 핵심 기질 비교</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일간 ${esc(ilgan)}(${esc(ilganE)}) · 일주 ${esc(ilju)}</div>
  </div>
</div>

<table>
<thead><tr>
  <th style="width:50px;">천간</th>
  <th style="width:40px;">한글</th>
  <th style="width:42px;">오행</th>
  <th style="width:38px;">음양</th>
  <th style="width:100px;">자연물 비유</th>
  <th>핵심 기질</th>
</tr></thead>
<tbody>
`;

  for (const t of TENKANS) {
    const isMe = (t.han === ilgan);
    const c = COLORS[t.oh];
    const rowClass = isMe ? ' class="hl"' : '';
    const meLabel  = isMe ? ' <span style="font-size:8px;color:#1a3a6a;font-weight:900;">← 나</span>' : '';
    H += `<tr${rowClass}>
  <td><span class="han" style="color:${c.main};">${t.han}</span>${meLabel}</td>
  <td style="font-weight:600;">${t.kor}</td>
  <td><span class="oh-badge" style="background:${c.main};">${t.oh}</span></td>
  <td class="${t.yy==='양'?'yy-yang':'yy-eum'}">${t.yy}</td>
  <td class="nature">${esc(t.nature)}</td>
  <td class="trait">${esc(t.trait)}</td>
</tr>\n`;
  }

  H += `</tbody></table>
<div class="legend">* 강조 행 = 본인 일간 (${esc(ilgan)} ${esc(ilganE)})</div>
</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '천간비교표.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ ${outFile}  (${fs.statSync(outFile).size.toLocaleString()}B)`);
  return outFile;
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_천간비교표.js <slot_id>'); process.exit(1); }
generate(slotId);
