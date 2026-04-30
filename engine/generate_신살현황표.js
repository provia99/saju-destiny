#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function generate(slotId) {
  const ch15Path = path.join(QUEUE_DIR, `${slotId}_ch15.json`);
  const ch16Path = path.join(QUEUE_DIR, `${slotId}_ch16.json`);
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const c15 = fs.existsSync(ch15Path) ? JSON.parse(fs.readFileSync(ch15Path, 'utf-8')) : {};
  const c16 = fs.existsSync(ch16Path) ? JSON.parse(fs.readFileSync(ch16Path, 'utf-8')) : {};
  const c03 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, c03, c15, c16); } catch(e){}

  // ── 인적 기본 정보 ──────────────────────────────────
  const name    = c15['이름']            || slotId;
  const birthS  = c03['birth_solar']     || c03['생년월일'] || '';
  const gender  = c15['성별']            || c03['user_gender'] || '';
  const age     = c15['만나이']          || c03['user_age'] || '';
  const ilju    = c15['일주']            || c03['일주'] || '';
  const singang = c15['신강약단']        || '';
  const curDW   = c15['현재대운간지']    || '';
  const curChar = c15['현재대운성격']    || '';
  const curAge  = c15['현재대운나이범위']|| '';
  const seunGJ  = c15['세운간지']        || '';
  const seunChar= c15['세운성격']        || '';
  const _c8=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`),'utf-8')):{};
  const _c6=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`),'utf-8')):{};
  const yongExp = _c8['용신오행']||_c6['용신오행']||c15['용신표기']||'';
  const byeongExp=_c8['기신오행']||_c6['기신오행']||c15['기신오행']||c16['기신오행']||'';
  const huiExp  = _c8['희신오행']||_c6['희신오행']||c15['희신오행']||c16['희신오행']||'';

  // ── 길신 정보 ───────────────────────────────────────
  const 천을귀인 = c15['천을귀인위치']  || '없음';
  const 문창귀인 = c15['문창귀인위치']  || '없음';
  const 천복귀인 = c15['천복귀인위치']  || '없음';
  const 태극귀인 = c15['태극귀인위치']  || '없음';
  const 천덕귀인 = (c15['천덕귀인여부'] || 'N') === 'Y';
  const 월덕귀인 = (c15['월덕귀인여부'] || 'N') === 'Y';
  const 귀인요약 = c15['귀인신살요약']  || '';

  // ── 흉살 정보 ───────────────────────────────────────
  const 원진살    = (c15['원진살_여부']     || 'N') === 'Y';
  const 귀문관살  = (c15['귀문관살_여부']   || 'N') === 'Y';
  const 고란살    = (c15['고란살_여부']     || 'N') === 'Y';
  const 음양차착살= (c15['음양차착살_여부'] || 'N') === 'Y';
  const 탕화살    = (c15['탕화살_여부']     || 'N') === 'Y';
  const 탕화살위치= c15['탕화살_위치']      || '';

  const 살신살목록   = (c16['살신살목록'] || '').split(',').map(s=>s.trim()).filter(Boolean);
  const 백호대살     = (c16['백호대살여부'] || 'N') === 'Y';
  const 괴강살       = (c16['괴강살여부']   || 'N') === 'Y';
  const 형충파해목록 = c16['형충파해목록']  || '';
  const 형충파해여부 = (c16['형충파해여부'] || 'N') === 'Y';

  const 극복대운  = c16['극복대운간지'] || '';
  const 극복시기  = c16['극복시기']     || '';

  // ── CSS ──────────────────────────────────────────────
  const CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; padding:18px 22px; background:transparent; display:flex; flex-direction:column; gap:8px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print {
  body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 820px; margin:0; }
}
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:2px solid #333; border-radius:10px; overflow:hidden; flex-shrink:0; }
.card-hd { padding:7px 14px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:9pt; font-weight:900; color:white; }
.card-hd-sub   { font-size:6.5pt; color:rgba(255,255,255,.85); }
/* 귀인 그리드 */
.guiin-grid { display:grid; grid-template-columns:repeat(3,1fr); background:transparent; }
.guiin-cell { padding:8px 12px; border-right:1px solid #eee; border-bottom:1px solid #eee; }
.guiin-cell:nth-child(3n) { border-right:none; }
.guiin-cell:nth-last-child(-n+3) { border-bottom:none; }
.g-lbl  { font-size:6.5pt; font-weight:700; color:#555; margin-bottom:4px; }
.g-chip { display:inline-block; font-size:7pt; font-weight:700; padding:2px 8px; border-radius:5px; }
.g-chip.yes  { background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7; }
.g-chip.none { background:#f5f5f5; color:#bbb; border:1px solid #333; }
/* 흉살 섹션 */
.hsal-section { padding:9px 14px; background:transparent; }
.hsal-title { font-size:7pt; font-weight:700; color:#555; margin-bottom:6px; display:flex; align-items:center; gap:5px; }
.hsal-title::before { content:''; display:inline-block; width:3px; height:11px; border-radius:2px; }
.chips { display:flex; flex-wrap:wrap; gap:5px; }
.chip-bad  { font-size:7pt; font-weight:700; padding:3px 9px; border-radius:6px; background:#ffebee; color:#c62828; border:1px solid #ef9a9a; }
.chip-none { font-size:7pt; color:#bbb; background:#f5f5f5; border:1px solid #333; padding:2px 8px; border-radius:5px; }
.chip-warn { font-size:7pt; font-weight:700; padding:3px 9px; border-radius:6px; background:#fff3e0; color:#e65100; border:1px solid #ffcc80; }
.divider { border:none; border-top:1px solid #f0f0f0; margin:7px 0; }
/* 형충파해 */
.hcf-row { font-size:7.5pt; color:#555; padding:4px 0; border-bottom:1px solid #f5f5f5; }
.hcf-row:last-child { border-bottom:none; }
/* 극복 박스 */
.remedy-box { padding:8px 14px; background:#e3f2fd; border-left:4px solid #1565c0; }
.remedy-lbl { font-size:6.5pt; font-weight:700; color:#1565c0; margin-bottom:4px; }
.remedy-val { font-size:8pt; font-weight:700; color:#0d47a1; }
.remedy-sub { font-size:6.5pt; color:#555; margin-top:2px; }
/* 요약 스트립 */
.sum-strip { display:grid; grid-template-columns:repeat(5,1fr); background:transparent; }
.sum-cell  { padding:6px 8px; text-align:center; border-right:1px solid #eee; }
.sum-cell:last-child { border-right:none; }
.sum-lbl   { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:2px; }
.sum-val   { font-size:7.5pt; font-weight:800; color:#333; }
</style>`;

  // ── 귀인 셀 ──────────────────────────────────────────
  function guiinCell(label, pos) {
    const hasIt = (pos && pos !== '없음');
    return `<div class="guiin-cell">
  <div class="g-lbl">${esc(label)}</div>
  <span class="g-chip ${hasIt?'yes':'none'}">${hasIt ? esc(pos) : '없음'}</span>
</div>`;
  }

  // ── 흉살 칩 목록 ─────────────────────────────────────
  function badChips(list) {
    if (!list.length) return '<span class="chip-none">없음 ✅</span>';
    return list.map(s=>`<span class="chip-bad">${esc(s)}</span>`).join('');
  }

  // ── 기본 정보 스트립 ─────────────────────────────────
  const singangC = singang.includes('신강') ? '#8b0000' : '#1a5276';
  const sumStrip = `<div class="sum-strip">
  <div class="sum-cell"><div class="sum-lbl">신강약</div><div class="sum-val" style="color:${singangC};">${esc(singang)}</div></div>
  <div class="sum-cell"><div class="sum-lbl">用神</div><div class="sum-val" style="color:#2e7d32;">${esc(yongExp)}</div></div>
  <div class="sum-cell"><div class="sum-lbl">喜神</div><div class="sum-val" style="color:#1565c0;">${esc(huiExp)}</div></div>
  <div class="sum-cell"><div class="sum-lbl">忌神</div><div class="sum-val" style="color:#c62828;">${esc(byeongExp)}</div></div>
  <div class="sum-cell"><div class="sum-lbl">공망</div><div class="sum-val" style="color:#e65100;">${esc(c15['공망1']||'—')}·${esc(c15['공망2']||'—')}</div></div>
</div>`;

  // 주요 흉살 배열
  const mainHsal = [
    원진살 && '원진살', 귀문관살 && '귀문관살', 고란살 && '고란살',
    음양차착살 && '음양차착살', 탕화살 && `탕화살${탕화살위치?'('+탕화살위치+')':''}`
  ].filter(Boolean);

  const extremeHsal = [
    백호대살 && '백호대살(白虎大殺)', 괴강살 && '괴강살(魁罡殺)'
  ].filter(Boolean);

  // 형충파해 파싱
  const hcfRows = 형충파해목록
    ? 형충파해목록.split(',').map(s=>s.trim()).filter(Boolean)
    : [];

  // ── HTML 조립 ─────────────────────────────────────────
  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>신살현황표 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
  <div>
    <div class="banner-hdr-title">🛡️ 신살(神殺) 현황표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${curDW?' · 대운 '+esc(curDW):''}</div>
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
    <div class="card-hd-title">기본 명리 정보</div>
    <div class="card-hd-sub">신강약 · 용신 · 희신 · 기신 · 공망</div>
  </div>
  ${sumStrip}
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#2e7d32,#388e3c);">
    <div class="card-hd-title">✓ 길신 (護衛의 기운)</div>
    <div class="card-hd-sub">天乙·文昌·天福·太極·天德·月德 귀인</div>
  </div>
  <div class="guiin-grid">
    ${guiinCell('천을귀인 (天乙貴人)', 천을귀인)}
    ${guiinCell('문창귀인 (文昌貴人)', 문창귀인)}
    ${guiinCell('천복귀인 (天福貴人)', 천복귀인)}
    ${guiinCell('태극귀인 (太極貴人)', 태극귀인)}
    <div class="guiin-cell"><div class="g-lbl">천덕귀인 (天德貴人)</div><span class="g-chip ${천덕귀인?'yes':'none'}">${천덕귀인?'있음':'없음'}</span></div>
    <div class="guiin-cell"><div class="g-lbl">월덕귀인 (月德貴人)</div><span class="g-chip ${월덕귀인?'yes':'none'}">${월덕귀인?'있음':'없음'}</span></div>
  </div>
  ${귀인요약 ? `<div style="padding:6px 14px;background:#f1f8f1;border-top:1px solid #c8e6c9;font-size:6.5pt;color:#2e7d32;font-weight:700;">📌 ${esc(귀인요약)}</div>` : ''}
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
    <div class="card-hd-title">✗ 흉살 · 형충파해</div>
    <div class="card-hd-sub">주요 흉살 · 살신살 · 극단 흉살 · 형충파해</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;background:transparent;">
    <div class="hsal-section" style="border-right:1px solid #f0f0f0;">
      <div class="hsal-title" style="color:#c62828;"><span style="display:inline-block;width:3px;height:11px;border-radius:2px;background:#c62828;"></span>주요 흉살</div>
      <div class="chips">${badChips(mainHsal)}</div>
      <hr class="divider">
      <div class="hsal-title" style="color:#c62828;margin-top:4px;"><span style="display:inline-block;width:3px;height:11px;border-radius:2px;background:#c62828;"></span>극단 흉살 (大殺)</div>
      <div class="chips">${badChips(extremeHsal)}</div>
      <hr class="divider">
      <div class="hsal-title" style="color:#e65100;margin-top:4px;"><span style="display:inline-block;width:3px;height:11px;border-radius:2px;background:#e65100;"></span>살신살 (살·겁·망신)</div>
      <div class="chips">${살신살목록.length ? 살신살목록.map(s=>`<span class="chip-warn">${esc(s)}</span>`).join('') : '<span class="chip-none">없음 ✅</span>'}</div>
    </div>
    <div class="hsal-section">
      <div class="hsal-title" style="color:#7b1fa2;"><span style="display:inline-block;width:3px;height:11px;border-radius:2px;background:#7b1fa2;"></span>형충파해 현황</div>
      ${hcfRows.length ? hcfRows.map(r=>`<div class="hcf-row">• ${esc(r)}</div>`).join('') : '<div class="hcf-row" style="color:#aaa;">없음 ✅</div>'}
    </div>
  </div>
  ${(극복대운 || 극복시기) ? `<div class="remedy-box">
    <div class="remedy-lbl">🔮 극복·해소 시기 (극복 대운)</div>
    <div class="remedy-val">${esc(극복대운)} 대운</div>
    <div class="remedy-sub">${esc(극복시기)} 》 흉살 영향 완화 예상 시기</div>
  </div>` : ''}
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '신살현황표.html');
  require('./_guards').safeWriteHtml(outFile, H, { 이름: name }, '신살현황표');
  console.log(`✓ Generated: ${outFile} (${H.length} bytes)`);
}

const slotId = process.argv[2] || 's11';
generate(slotId);
