#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function charColor(s) {
  if (!s) return '#555';
  if (s.includes('용신')) return '#2e7d32';
  if (s.includes('희신')) return '#1565c0';
  if (s.includes('기신')) return '#c62828';
  return '#555';
}
function charBg(s) {
  if (!s) return '#f5f5f5';
  if (s.includes('용신')) return '#e8f5e9';
  if (s.includes('희신')) return '#e3f2fd';
  if (s.includes('기신')) return '#ffebee';
  return '#f5f5f5';
}
function charBorder(s) {
  if (!s) return '#bbb';
  if (s.includes('용신')) return '#43a047';
  if (s.includes('희신')) return '#1e88e5';
  if (s.includes('기신')) return '#e53935';
  return '#bbb';
}

function generate(slotId) {
  const ch03Path     = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch09jeonPath = path.join(QUEUE_DIR, `${slotId}_ch09_jeon.json`);
  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};
  const d  = JSON.parse(fs.readFileSync(ch09jeonPath, 'utf-8'));
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d); } catch(e){}

  // ── 인적사항 ──────────────────────────────────────────
  const name   = d3['이름']        || d['이름']   || slotId;
  const birthS = d3['birth_solar'] || d3['생년월일'] || '';
  const gender = d3['user_gender'] || d['성별']   || '';
  const age    = d3['user_age']    || d['나이대'] || '';
  const ilju   = d3['일주']        || '';

  // ── 대운 전환 ─────────────────────────────────────────
  const curGangi   = d['현재대운간지']     || '';
  const curSeong   = d['현재대운성격']     || '';
  const curRange   = d['현재대운나이범위'] || '';
  const curHalfDiv = d['현재대운_반절구분']    || '';
  const curHalfExp = d['현재대운_반절설명']    || '';
  const curFrontSt  = d['현재대운전반시작']    || '';
  const curBackSt   = d['현재대운후반시작']    || '';
  const curFrontCh  = d['현재대운전반성격']    || '';
  const curBackCh   = d['현재대운후반성격']    || '';

  const nextGangi  = d['다음대운간지']         || '';
  const nextSeong  = d['다음대운성격']          || '';
  const nextYear   = d['다음대운시작년도']      || d['대운교체년도'] || '';
  const nextAge    = d['다음대운시작나이']      || '';

  // ── 교차 현상 ─────────────────────────────────────────
  const crossItems = [];
  if (d['교차충_대운_여부'] === 'Y') crossItems.push({ type:'충(沖)', src:'대운', desc: d['교차충_대운_설명']||'', isHap:false });
  if (d['교차합_대운_여부'] === 'Y') crossItems.push({ type:'합(合)', src:'대운', desc: d['교차합_대운_설명']||'', isHap:true });
  if (d['교차충_세운_여부'] === 'Y') crossItems.push({ type:'충(沖)', src:'세운', desc: d['교차충_세운_설명']||'', isHap:false });
  if (d['교차합_세운_여부'] === 'Y') crossItems.push({ type:'합(合)', src:'세운', desc: d['교차합_세운_설명']||'', isHap:true });

  const crossGrade  = d['대운세운교차등급'] || '';
  const crossDesc   = d['대운세운교차설명'] || '';
  const totalGrade  = d['올해총운등급']     || crossGrade || '';

  // ── 월운 ──────────────────────────────────────────────
  const goodMonths = d['월운_좋은달목록']  || '';
  const careMonths = d['월운_조심달목록'] || '';
  const thisYear   = d['기준해'] || d['올해'] || '';

  // ── 주의 사항 ─────────────────────────────────────────
  const juyuiHae    = d['현대운_주의의해']    || '';
  const worstHae    = d['현대운_최흉해']      || '';
  const saveHae     = d['현대운_구원의해']    || '';
  const bestSeun    = d['현대운내_최적세운']  || '';
  const healthList  = (d['건강주의대운목록'] || '').split('\n').filter(Boolean);
  const youngHard   = d['초년힘든대운목록']   || '';

  const curColor    = charColor(curSeong);
  const curBg       = charBg(curSeong);
  const curBorder   = charBorder(curSeong);
  const nextColor   = charColor(nextSeong);
  const nextBg      = charBg(nextSeong);
  const nextBorder  = charBorder(nextSeong);

  // 전반/후반 성격 배지
  function halfBadge(seong) {
    if(!seong) return '';
    const c = charColor(seong); const bg = charBg(seong);
    return `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:6pt;font-weight:700;background:${bg};color:${c};border:1px solid ${c}33;">${esc(seong)}</span>`;
  }

  const CSS = `  <style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; max-height:840px; overflow:hidden; padding:6px 8px; background:transparent; display:flex; flex-direction:column; gap:7px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 840px; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:1.5px solid #333; border-radius:10px; overflow:hidden; flex-shrink:0; }
.card-hd { padding:5px 13px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:7.5pt; font-weight:900; color:white; }
.card-hd-sub { font-size:7pt; color:rgba(255,255,255,.85); }
/* 대운 전환 */
.dw-transfer { display:flex; align-items:stretch; gap:8px; padding:8px 13px; background:transparent; }
.dw-box { flex:1; border-radius:8px; padding:8px 11px; border:2px solid; }
.dw-label { font-size:7pt; font-weight:700; color:#888; margin-bottom:4px; }
.dw-gangi { font-family:'Noto Serif KR',serif; font-size:19pt; font-weight:800; line-height:1; letter-spacing:-1px; }
.dw-seong-badge { display:inline-block; padding:2px 8px; border-radius:8px; font-size:6.5pt; font-weight:700; margin-top:4px; }
.dw-range { font-size:6pt; color:#777; margin-top:4px; }
.dw-arrow-col { display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.dw-arrow { font-size:21pt; color:#bbb; }
/* 전반/후반 */
.half-section { background:#f8f9fa; border-top:1px solid #eee; padding:6px 13px; display:flex; gap:5px; }
.half-box { flex:1; padding:5px 8px; border-radius:6px; border:1.5px solid #e0e0e0; background:transparent; }
.half-period { font-size:7pt; color:#aaa; margin-bottom:2px; }
.half-label { font-size:6pt; font-weight:700; color:#333; margin-bottom:2px; }
/* 교차 현상 */
.cross-list { padding:6px 11px; background:transparent; display:flex; flex-direction:column; gap:4px; }
.cross-row { display:flex; align-items:flex-start; gap:8px; padding:5px 10px; border-radius:6px; }
.cross-src-chung { background:#fff8e1; border-left:3px solid #f9a825; }
.cross-src-hap   { background:#e8f5e9; border-left:3px solid #43a047; }
.cross-badge { display:flex; flex-direction:column; align-items:center; gap:1px; flex-shrink:0; }
.cross-src  { font-size:7pt; font-weight:700; color:#888; }
.cross-type { font-size:7pt; font-weight:900; }
.cross-desc { font-size:6.5pt; color:#444; line-height:1.5; padding-top:1px; }
/* 교차 평가 */
.grade-box { margin:0 11px 8px; padding:6px 10px; background:#f3e5f5; border-radius:6px; border-left:3px solid #9c27b0; }
.grade-row { display:flex; align-items:center; gap:6px; margin-bottom:3px; }
.grade-chip { padding:2px 8px; border-radius:5px; font-size:7pt; font-weight:900; background:#7b1fa2; color:white; }
.grade-desc { font-size:6.5pt; color:#444; line-height:1.5; }
/* 월운 */
.month-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; background:transparent; }
.month-col { padding:8px 13px; }
.month-title { font-size:6.5pt; font-weight:700; margin-bottom:4px; }
.month-pills { display:flex; flex-wrap:wrap; gap:4px; }
.pill-good { display:inline-block; padding:3px 8px; border-radius:10px; font-size:6.5pt; font-weight:700; background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7; }
.pill-care { display:inline-block; padding:3px 8px; border-radius:10px; font-size:6.5pt; font-weight:700; background:#fff3e0; color:#e65100; border:1px solid #ffcc80; }
/* 주의사항 */
.note-body { padding:8px 13px; background:transparent; display:flex; flex-direction:column; gap:5px; }
.note-row { display:flex; align-items:flex-start; gap:8px; padding:6px 10px; border-radius:6px; border:1.5px solid #e0e0e0; }
.note-icon { font-size:10pt; flex-shrink:0; margin-top:1px; }
.note-inner {}
.note-lbl { font-size:7pt; font-weight:700; color:#888; margin-bottom:2px; }
.note-val { font-size:7pt; font-weight:700; color:#333; line-height:1.5; }
.health-box { padding:6px 10px; background:#fff3e0; border-radius:6px; border-left:3px solid #ff9800; }
.health-title { font-size:7pt; font-weight:700; color:#e65100; margin-bottom:4px; }
.health-item { font-size:6.5pt; color:#555; line-height:1.5; padding-left:11px; position:relative; }
.health-item::before { content:'•'; position:absolute; left:2px; color:#e53935; }
.young-box { padding:6px 10px; background:#e8eaf6; border-radius:6px; border-left:3px solid #5c6bc0; }
  </style>`;

  // ── HTML (cards ① ② ③ ④ 통합) ───────────────────────────
  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>전환점 타임라인 》 ${esc(name)}님</title>
  ${CSS}
</head>
<body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#37474f,#546e7a);">
  <div>
    <div class="banner-hdr-title">⏱️ 전환점(轉換點) 타임라인</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${curGangi?' · 대운 '+esc(curGangi):''}</div>
  </div>
</div>

<!-- ① 대운 전환 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
    <div class="card-hd-title">① 대운(大運) 전환</div>
    <div class="card-hd-sub">현재 대운 → 다음 대운 교체 정보</div>
  </div>
  <div class="dw-transfer">
    <!-- 현재 대운 -->
    <div class="dw-box" style="border-color:${curBorder};background:${curBg};">
      <div class="dw-label">현재 대운</div>
      <div class="dw-gangi" style="color:${curColor};">${esc(curGangi)}</div>
      <div><span class="dw-seong-badge" style="background:${curColor}15;color:${curColor};border:1px solid ${curColor}55;">${esc(curSeong)}</span></div>
      ${curRange ? `<div class="dw-range">${esc(curRange)}</div>` : ''}
    </div>
    <div class="dw-arrow-col"><div class="dw-arrow">→</div></div>
    <!-- 다음 대운 -->
    <div class="dw-box" style="border-color:${nextBorder};background:${nextBg};">
      <div class="dw-label">다음 대운</div>
      <div class="dw-gangi" style="color:${nextColor};">${esc(nextGangi)}</div>
      <div><span class="dw-seong-badge" style="background:${nextColor}15;color:${nextColor};border:1px solid ${nextColor}55;">${esc(nextSeong)}</span></div>
      <div class="dw-range">${nextYear?esc(nextYear)+'년':''} ${nextAge?'(만 '+esc(nextAge)+'세)':''}</div>
    </div>
  </div>
  <!-- 전반·후반 분절 -->
  ${(curFrontCh || curBackCh || curHalfExp) ? `
  <div class="half-section">
    ${curFrontCh ? `<div class="half-box">
      <div class="half-period">전반 ${curFrontSt?esc(curFrontSt)+'~':''}</div>
      <div class="half-label">전반 운세</div>
      ${halfBadge(curFrontCh+'대운')}
    </div>` : ''}
    ${curBackCh ? `<div class="half-box">
      <div class="half-period">후반 ${curBackSt?esc(curBackSt)+'~':''}</div>
      <div class="half-label">후반 운세</div>
      ${halfBadge(curBackCh+'대운')}
    </div>` : ''}
    ${curHalfExp ? `<div style="flex:2;padding:4px 8px;background:transparent;border-radius:6px;border:1.5px solid #e0e0e0;font-size:6.5pt;color:#555;line-height:1.4;display:flex;align-items:center;">${esc(curHalfExp)}</div>` : ''}
  </div>` : ''}
</div>

<!-- ② 교차 현상 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#e65100,#f57c00);">
    <div class="card-hd-title">② 교차(交叉) 현상</div>
    <div class="card-hd-sub">대운·세운과 원국의 합충 작용</div>
  </div>
  <div class="cross-list">
    ${crossItems.length ? crossItems.map(ci => {
      const cls = ci.isHap ? 'cross-src-hap' : 'cross-src-chung';
      const typeColor = ci.isHap ? '#2e7d32' : '#e65100';
      return `<div class="cross-row ${cls}">
  <div class="cross-badge">
    <span class="cross-src" style="color:${typeColor};">${esc(ci.src)}</span>
    <span class="cross-type" style="color:${typeColor};">${esc(ci.type)}</span>
  </div>
  <div class="cross-desc">${esc(ci.desc)}</div>
</div>`;
    }).join('') : `<div style="font-size:6.5pt;color:#bbb;padding:4px 2px;">현재 대운·세운 교차 현상 없음</div>`}
  </div>
  ${(crossGrade || crossDesc) ? `
  <div class="grade-box">
    <div class="grade-row">
      ${crossGrade ? `<span class="grade-chip">${esc(crossGrade)}</span>` : ''}
      <span style="font-size:6.5pt;color:#555;font-weight:700;">대운·세운 교차 평가</span>
    </div>
    ${crossDesc ? `<div class="grade-desc">${esc(crossDesc)}</div>` : ''}
  </div>` : ''}
</div>

<!-- ③ 올해 월운 흐름 -->
${(goodMonths || careMonths) ? `
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1565c0,#0288d1);">
    <div class="card-hd-title">③ ${thisYear ? esc(thisYear)+'년 ' : ''}월운(月運) 흐름</div>
    <div class="card-hd-sub">올해 용신·희신 강한 달 / 주의 달 구분</div>
  </div>
  <div class="month-grid">
    <div class="month-col" style="border-right:1px solid #f0f0f0;">
      <div class="month-title" style="color:#2e7d32;">좋은 달</div>
      <div class="month-pills">
        ${goodMonths.split(/[·,、]/).map(m=>m.trim()).filter(Boolean).map(m=>`<span class="pill-good">${esc(m)}</span>`).join('')}
      </div>
    </div>
    <div class="month-col">
      <div class="month-title" style="color:#e65100;">조심 달</div>
      <div class="month-pills">
        ${careMonths.split(/[·,、]/).map(m=>m.trim()).filter(Boolean).map(m=>`<span class="pill-care">${esc(m)}</span>`).join('')}
      </div>
    </div>
  </div>
</div>` : ''}

<!-- ④ 주의 사항 -->
${(juyuiHae || worstHae || saveHae || bestSeun || healthList.length || youngHard) ? `
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#b71c1c,#e53935);">
    <div class="card-hd-title">④ 이 대운의 핵심 주의 사항</div>
    <div class="card-hd-sub">주의할 해·최흉해·건강 위험 대운·초년 어려운 대운</div>
  </div>
  <div class="note-body">
    ${juyuiHae ? `<div class="note-row" style="border-color:#f9a825;background:#fffde7;">
      <div class="note-icon">⚠️</div>
      <div class="note-inner"><div class="note-lbl">주의할 해</div><div class="note-val">${esc(juyuiHae)}</div></div>
    </div>` : ''}
    <div style="display:flex;gap:5px;">
      ${worstHae ? `<div class="note-row" style="flex:1;border-color:#e53935;background:#ffebee;">
        <div class="note-icon">❌</div>
        <div class="note-inner"><div class="note-lbl">최흉해(最凶年)</div><div class="note-val" style="color:#c62828;">${esc(worstHae)}</div></div>
      </div>` : ''}
      ${saveHae ? `<div class="note-row" style="flex:1;border-color:#1e88e5;background:#e3f2fd;">
        <div class="note-icon">🛡</div>
        <div class="note-inner"><div class="note-lbl">구원의 해</div><div class="note-val" style="color:#1565c0;">${esc(saveHae)}</div></div>
      </div>` : ''}
      ${bestSeun ? `<div class="note-row" style="flex:1;border-color:#43a047;background:#e8f5e9;">
        <div class="note-icon">⭐</div>
        <div class="note-inner"><div class="note-lbl">최적 세운</div><div class="note-val" style="color:#2e7d32;">${esc(bestSeun)}</div></div>
      </div>` : ''}
    </div>
    ${healthList.length ? `<div class="health-box">
      <div class="health-title">건강 주의 대운 목록</div>
      ${healthList.map(l=>`<div class="health-item">${esc(l)}</div>`).join('')}
    </div>` : ''}
    ${youngHard ? `<div class="young-box">
      <div style="font-size:7pt;font-weight:700;color:#3949ab;margin-bottom:3px;">초년 어려운 대운</div>
      <div style="font-size:6.5pt;color:#444;line-height:1.5;">${esc(youngHard)}</div>
    </div>` : ''}
  </div>
</div>` : ''}

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive:true });
  const outFile = path.join(outDir, '전환점타임라인.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  console.log(`✅ 전환점타임라인 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_전환점타임라인.js <slot_id>'); process.exit(1); }
generate(slotId);
