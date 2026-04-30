#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function charMeta(seong) {
  if (seong.includes('용신')) return { c:'#2e7d32', bg:'#e8f5e9', border:'#43a047', label:'용신월', txtCls:'#1b5e20' };
  if (seong.includes('희신')) return { c:'#1565c0', bg:'#e3f2fd', border:'#1976d2', label:'희신월', txtCls:'#0d47a1' };
  if (seong.includes('기신')) return { c:'#c62828', bg:'#ffebee', border:'#e53935', label:'기신월', txtCls:'#b71c1c' };
  return { c:'#666',    bg:'#f5f5f5', border:'#bbb',    label:'중립월', txtCls:'#444' };
}

// 날짜 목록 → "4·5·8·9…" 형식 (최대 6개)
function dayList(arr) {
  if (!arr || !arr.length) return '—';
  return arr.slice(0, 6).map(x => x.d).join('·') + (arr.length > 6 ? '…' : '');
}

function generate(slotId) {
  const ch09Path = path.join(QUEUE_DIR, `${slotId}_ch09.json`);
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch08Path = path.join(QUEUE_DIR, `${slotId}_ch08.json`);
  const d  = JSON.parse(fs.readFileSync(ch09Path, 'utf-8'));
  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};
  const d8 = fs.existsSync(ch08Path) ? JSON.parse(fs.readFileSync(ch08Path, 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d, d3, d8); } catch(e){}

  // ── 기본 정보 ────────────────────────────────────────
  const olhae    = String(d['올해'] || '2026');
  const name     = d3['이름']        || d8['이름']        || slotId;
  const birthS   = d3['birth_solar'] || d3['생년월일']    || '';
  const gender   = d3['user_gender'] || d3['성별']        || '';
  const age      = d3['user_age']    || d3['나이']        || '';
  const ilju     = d3['일주']        || '';
  const curDW    = d8['현재대운간지']   || '';
  const curChar  = d8['현재대운성격']   || '';

  const seunGJ   = d['세운간지']     || '';
  const seunChar = d['세운성격']     || '';
  const seunOH   = d['세운오행']     || '';
  const totalUn  = d['올해총운등급'] || '—';
  const yongDir  = d['용신방위']     || '';
  const huiDir   = d['희신방위']     || '';
  const byeongDir= d['기신방위']     || '';

  // ── 12개월 데이터 수집 ────────────────────────────
  // 월운 정렬: 2~12월 + 1월(내년) 순
  const MONTH_ORDER = [2,3,4,5,6,7,8,9,10,11,12,1];
  const monthList = MONTH_ORDER.map(m => {
    const key = `월운_${m}월`;
    const md = d[key];
    if (!md) return null;
    return { m, ...md };
  }).filter(Boolean);

  // ── CSS ──────────────────────────────────────────────
  const CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; font-size:7pt; }
.page { border:1px solid #333; width:604px; max-height:840px; overflow:hidden; padding:10px 14px; background:transparent; display:flex; flex-direction:column; gap:5px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print {
  body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; max-height:840px; overflow:hidden; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 840px; margin:0; }
}
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-radius:6px; }
.banner-hdr-title { font-size:9pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6pt;color:rgba(255,255,255,.75);margin-top:1px; }
.banner-hdr-name { font-size:9pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6pt;color:rgba(255,255,255,.75);text-align:right;margin-top:1px; }
.card { border:1.5px solid #333; border-radius:8px; overflow:hidden; flex-shrink:0; }
.card-hd { padding:4px 10px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:8pt; font-weight:900; color:white; }
.card-hd-sub   { font-size:7pt; color:rgba(255,255,255,.85); }
/* 세운 요약 스트립 》 1줄 */
.seun-strip { display:grid; grid-template-columns:repeat(7,1fr); background:transparent; }
.seun-cell  { padding:3px 3px; text-align:center; border-right:1px solid #eee; }
.seun-cell:last-child { border-right:none; }
.seun-lbl   { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:1px; }
.seun-val   { font-size:7pt; font-weight:800; color:#333; }
/* 월운 그리드 4행×3열 */
.month-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0; background:transparent; }
.mc { border-right:1px solid #e8e8e8; border-bottom:1px solid #e8e8e8; padding:4px 6px; display:flex; flex-direction:column; gap:1px; }
.mc:nth-child(3n) { border-right:none; }
.mc:nth-last-child(-n+3) { border-bottom:none; }
.mc-month { font-size:9pt; font-weight:900; line-height:1; }
.mc-ganji { font-size:6.5pt; font-weight:700; }
.mc-chip  { font-size:7pt; font-weight:700; padding:1px 5px; border-radius:3px; color:white; display:inline-block; }
.mc-meta  { font-size:7pt; color:#888; }
.mc-bar-wrap { height:4px; background:#e8e8e8; border-radius:2px; overflow:hidden; margin-top:1px; }
.mc-bar { height:100%; border-radius:2px; }
.mc-days { font-size:7pt; color:#888; line-height:1.4; margin-top:1px; }
.mc-days span { font-weight:700; }
</style>`;

  // ── 세운 요약 스트립 ─────────────────────────────────
  const seunCharColor = seunChar.includes('용신') ? '#2e7d32' : seunChar.includes('희신') ? '#1565c0' : seunChar.includes('기신') ? '#c62828' : '#555';
  const totalColor    = totalUn.includes('상') ? '#2e7d32' : totalUn.includes('하') ? '#c62828' : '#555';

  const seunStrip = `<div class="seun-strip">
  <div class="seun-cell"><div class="seun-lbl">세운 간지</div><div class="seun-val">${esc(seunGJ)}</div></div>
  <div class="seun-cell"><div class="seun-lbl">세운 성격</div><div class="seun-val" style="color:${seunCharColor};">${esc(seunChar)}</div></div>
  <div class="seun-cell"><div class="seun-lbl">올해 총운</div><div class="seun-val" style="color:${totalColor};">${esc(totalUn)}</div></div>
  <div class="seun-cell"><div class="seun-lbl">세운 오행</div><div class="seun-val">${esc(seunOH)}</div></div>
  <div class="seun-cell"><div class="seun-lbl">용신 방위</div><div class="seun-val" style="color:#2e7d32;">${esc(yongDir)}</div></div>
  <div class="seun-cell"><div class="seun-lbl">희신 방위</div><div class="seun-val" style="color:#1565c0;">${esc(huiDir)}</div></div>
  <div class="seun-cell"><div class="seun-lbl">기신 방위</div><div class="seun-val" style="color:#c62828;">${esc(byeongDir)}</div></div>
</div>`;

  // ── 12개월 카드 ──────────────────────────────────────
  const monthCards = monthList.map(md => {
    const cm = charMeta(md.성격 || '');
    const strength = md.운세강도 || 50;
    const goodDays = dayList(md.최고날목록 || md.용신일);
    const badDays  = dayList(md.조심날목록 || md.기신일);
    const jeolgi   = md.절기 || '';
    const un12     = md.운성명 || '';

    return `<div class="mc" style="background:${cm.bg};">
  <div class="mc-month" style="color:${cm.c};">${md.m}월</div>
  <div class="mc-ganji" style="color:${cm.txtCls};">${esc(md.간지 || '')}</div>
  <div>
    <span class="mc-chip" style="background:${cm.c};">${cm.label}</span>
  </div>
  <div class="mc-meta">${esc(jeolgi)}${un12 ? ' · ' + esc(un12) : ''}</div>
  <div class="mc-bar-wrap"><div class="mc-bar" style="width:${strength}%;background:${cm.c};"></div></div>
  <div class="mc-days">
    ${goodDays !== '—' ? `<span style="color:#2e7d32;">✦</span> ${goodDays}일<br>` : ''}${badDays !== '—' ? `<span style="color:#c62828;">✕</span> ${badDays}일` : ''}
  </div>
</div>`;
  }).join('');

  // ── HTML 조립 ─────────────────────────────────────────
  const H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${olhae}년 세운·월운 달력 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
  <div>
    <div class="banner-hdr-title">📆 ${olhae}년 세운·월운 달력</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${curDW ? ' · 대운 ' + esc(curDW) : ''}</div>
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#00796b,#009688);">
    <div class="card-hd-title">① ${olhae}년 세운 기본 정보</div>
    <div class="card-hd-sub">세운 간지 · 성격 · 총운 · 오행 · 방위</div>
  </div>
  ${seunStrip}
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
    <div class="card-hd-title">② 월별 운세 달력</div>
    <div class="card-hd-sub">월 간지 · 성격 · 절기 · 12운성 · 운세강도 · ✦좋은날 / ✕조심날</div>
  </div>
  <div class="month-grid">
    ${monthCards}
  </div>
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '세운월운달력.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ 세운월운달력 생성: ${outFile}  (${Buffer.byteLength(H,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_세운월운달력.js <slot_id>'); process.exit(1); }
generate(slotId);
