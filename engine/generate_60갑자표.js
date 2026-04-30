#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_KR  = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const BR_KR    = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const STEM_OH = {甲:'wood',乙:'wood',丙:'fire',丁:'fire',戊:'earth',己:'earth',庚:'metal',辛:'metal',壬:'water',癸:'water'};
const OH_STYLE = {
  wood:  { border:'#a8dbb5', bg:'#f3fcf5', color:'#2e7d32' },
  fire:  { border:'#f5a9a5', bg:'#fff5f5', color:'#c62828' },
  earth: { border:'#f0d470', bg:'#fffdf4', color:'#e65100' },
  metal: { border:'#b0c4d0', bg:'#f7f9fa', color:'#37474f' },
  water: { border:'#90bfe0', bg:'#f0f6ff', color:'#0d47a1' },
};

const GAPJA_60 = [];
for (let i = 0; i < 60; i++) {
  GAPJA_60.push({ hanja: STEMS[i%10]+BRANCHES[i%12], kor: (STEM_KR[STEMS[i%10]]||'')+(BR_KR[BRANCHES[i%12]]||''), oh: STEM_OH[STEMS[i%10]] });
}

function yearToGanji(year) {
  const idx = (year - 4) % 60;
  return GAPJA_60[idx >= 0 ? idx : idx + 60];
}

function generate(slotId) {
  const d3 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch03.json`)) ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch03.json`),'utf-8')) : {};
  const M  = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_master.json`)) ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_master.json`),'utf-8')) : {};
  const d1 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch01.json`)) ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch01.json`),'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d1); } catch(e){}

  const name = d3['이름'] || M['이름'] || slotId;
  const birthYear = M['생년'] || d3['birth_year'] || 0;
  const ilju = d3['일주'] || d1['일주'] || '';
  const iljuHanja = ilju ? ilju.replace(/\(.*\)/g,'').substring(0,2) : '';
  const currentYear = new Date().getFullYear();

  const birthGanji = birthYear ? yearToGanji(birthYear) : null;
  const currentGanji = yearToGanji(currentYear);

  const highlights = {};
  if (iljuHanja) highlights[iljuHanja] = { label:'일주', color:'#c62828', emoji:'⭐' };
  if (birthGanji) highlights[birthGanji.hanja] = { label:'출생년', color:'#1565c0', emoji:'🎂' };
  if (currentGanji) highlights[currentGanji.hanja] = { label:`${currentYear}년`, color:'#2e7d32', emoji:'📅' };

  const cells = GAPJA_60.map((g, idx) => {
    const oh = OH_STYLE[g.oh] || OH_STYLE.earth;
    const hl = highlights[g.hanja];
    const hlStyle = hl ? `border:2.5px solid ${hl.color};` : '';
    const hlBadge = hl ? `<div style="font-size:4pt;font-weight:700;color:${hl.color};margin-top:1px;">${hl.emoji}${hl.label}</div>` : '';
    return `<div class="gc" style="border-left-color:${oh.border};background:${oh.bg};${hlStyle}">
  <div class="gn">${idx+1}</div>
  <div class="gh" style="color:${oh.color};">${g.hanja}</div>
  <div class="gk">${g.kor}</div>${hlBadge}
</div>`;
  }).join('\n');

  const legendItems = Object.entries(highlights).map(([hanja, hl]) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;font-size:6pt;padding:2px 6px;border-radius:4px;border:1.5px solid ${hl.color};color:${hl.color};font-weight:700;">${hl.emoji} ${hanja} ${hl.label}</span>`
  ).join(' ');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>60갑자표 》 ${esc(name)}님</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;background:transparent;}
.page{ border:1px solid #333;width:604px;max-height:840px;padding:6px 8px;background:transparent;overflow:hidden;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{background:transparent;margin:0;padding:0;}.page{margin:0;}@page{ border:1px solid #333;size:604px 840px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-radius:8px;margin-bottom:5px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
.card{border:1.5px solid #333;border-radius:8px;overflow:hidden;}
.legend{display:flex;align-items:center;gap:6px;padding:4px 10px;background:#fafafa;border-bottom:1px solid #eee;flex-wrap:wrap;}
.legend-label{font-size:6pt;color:#888;font-weight:700;}
.grid{display:grid;grid-template-columns:repeat(10,1fr);gap:1px;background:#ddd;padding:1px;}
.gc{padding:4px 2px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:36px;background:transparent;border-left:3px solid;position:relative;}
.gn{font-size:4pt;color:#ccc;position:absolute;top:1px;right:2px;}
.gh{font-size:9pt;font-weight:bold;}
.gk{font-size:5.5pt;color:#666;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#3e2723,#5d4037);">
  <div>
    <div class="banner-hdr-title">📋 60갑자표 (六十甲子)</div>
    <div class="banner-hdr-sub">60가지 천간·지지 조합 순환표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">${esc(ilju)} 일주 · ${birthYear?birthYear+'년생':''}</div>
  </div>
</div>

<div class="card">
  <div class="legend">
    <span class="legend-label">표시:</span>
    ${legendItems}
  </div>
  <div class="grid">
${cells}
  </div>
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '60갑자표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  console.log(`✅ 60갑자표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_60갑자표.js <slot_id>'); process.exit(1); }
generate(slotId);
