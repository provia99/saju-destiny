#!/usr/bin/env node
// generate_오행점수표.js  》  오행 점수표 (완전한 standalone HTML)
// 입력: queue/{slot}_ch04.json + queue/{slot}_ch06.json + queue/{slot}_ch03.json
// 출력: tables/{slot}/오행점수표.html
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch04Path = path.join(QUEUE_DIR, `${slotId}_ch04.json`);
  const ch06Path = path.join(QUEUE_DIR, `${slotId}_ch06.json`);

  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};
  const d4 = fs.existsSync(ch04Path) ? JSON.parse(fs.readFileSync(ch04Path, 'utf-8')) : {};
  const d6 = fs.existsSync(ch06Path) ? JSON.parse(fs.readFileSync(ch06Path, 'utf-8')) : {};

  // ── saju_calc 직접 계산 (정확한 값 보장) ──────────────────────
  let _calcResult = null;
  try {
    const { 전체사주계산 } = require('./saju_calc');
    let _masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
    if (!fs.existsSync(_masterPath)) _masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
    if (!fs.existsSync(_masterPath)) {
      const _sd = path.dirname(ch03Path);
      if (fs.existsSync(_sd)) {
        const _g = fs.readdirSync(_sd).filter(f => f === 'master.json');
        if (_g.length) _masterPath = path.join(_sd, _g[0]);
      }
    }
    if (fs.existsSync(_masterPath)) {
      const _M = JSON.parse(fs.readFileSync(_masterPath, 'utf8'));
      if (_M.생년) {
        _calcResult = 전체사주계산({이름:_M.이름, 성별:_M.성별, 년:_M.생년, 월:_M.생월, 일:_M.생일, 시간:_M.생시||'모름', 음력입력:!!_M.음력입력, 윤달:!!_M.윤달});
      }
    }
  } catch(e) { /* saju_calc 실패 시 기존 ch*.json 값 사용 */ }

  // saju_calc 결과로 핵심 값 보정
  if (_calcResult) {
    const _oh = {木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'};
    if (_calcResult.용신) d6['용신오행'] = _oh[_calcResult.용신] || _calcResult.용신;
    if (_calcResult.희신) d6['희신오행'] = _oh[_calcResult.희신] || _calcResult.희신;
    if (_calcResult.기신) d6['기신오행'] = _oh[_calcResult.기신] || _calcResult.기신;
    if (_calcResult.한신) d6['한신오행'] = _oh[_calcResult.한신] || _calcResult.한신;
    if (_calcResult.신강약) d6['신강약'] = _calcResult.신강약;
    if (_calcResult.오행점수) {
      const _kr = {木:'목',火:'화',土:'토',金:'금',水:'수'};
      for (const [k, v] of Object.entries(_calcResult.오행점수)) {
        if (_kr[k]) { d4[_kr[k]+'점수'] = v; d6[_kr[k]+'점수'] = v; }
      }
      if (_calcResult.오행순위) {
        for (const item of _calcResult.오행순위) {
          if (item.등급) { d4[item.오행+'등급'] = item.등급; d6[item.오행+'등급'] = item.등급; }
        }
      }
    }
  }

  // ── 인적 정보 ──────────────────────────────────────────
  const name   = d3['이름']        || d6['이름']        || slotId;
  const birthS = d3['birth_solar'] || d3['생년월일']    || '';
  const gender = d3['user_gender'] || d3['성별']        || '';
  const age    = d3['user_age']    || d3['나이']        || d6['만나이'] || '';
  const ilju   = d3['일주']        || d6['일주']        || '';
  const curDW  = d6['현재대운간지'] || '';
  const seunGJ = d6['세운간지']    || '';
  const geukguk = d6['격국명']     || '';
  const shingang = d6['신강약']    || d6['신강약단']    || '';

  // ── 오행 점수 데이터 ───────────────────────────────────
  const SCORES = {
    wood:  parseFloat(d4['목점수']  || d6['목점수'] || 0),
    fire:  parseFloat(d4['화점수']  || d6['화점수'] || 0),
    earth: parseFloat(d4['토점수']  || d6['토점수'] || 0),
    metal: parseFloat(d4['금점수']  || d6['금점수'] || 0),
    water: parseFloat(d4['수점수']  || d6['수점수'] || 0),
  };
  const TOTAL = Object.values(SCORES).reduce((a,b)=>a+b, 0) || 1;

  const GRADES = {
    wood:  d4['木등급'] || d6['木등급'] || '',
    fire:  d4['火등급'] || d6['火등급'] || '',
    earth: d4['土등급'] || d6['土등급'] || '',
    metal: d4['金등급'] || d6['金등급'] || '',
    water: d4['水등급'] || d6['水등급'] || '',
  };

  // ── 용신 분류 ──────────────────────────────────────────
  function extractKey(str) {
    if (!str) return null;
    const map = { '木':'wood','火':'fire','土':'earth','金':'metal','水':'water' };
    const m = str.match(/木|火|土|金|水/);
    return m ? (map[m[0]] || null) : null;
  }
  const YONG   = extractKey(d6['용신오행']);
  const HUI    = extractKey(d6['희신오행']);
  const BYEONG = extractKey(d6['기신오행']);
  const HAN    = extractKey(d6['한신오행']);

  // ── 오행 메타 ──────────────────────────────────────────
  const META = {
    wood:  { hanja:'木', kr:'목', color:'#2e7d32', bg:'#e8f5e9', bar:'#4caf50', label:'木(목)', meaning:'성장·창조·교육 에너지',  season:'봄(2~4월)', dir:'東(동)', colorHint:'청색·녹색' },
    fire:  { hanja:'火', kr:'화', color:'#c62828', bg:'#ffebee', bar:'#f44336', label:'火(화)', meaning:'열정·표현·명예 에너지',  season:'여름(5~7월)', dir:'南(남)', colorHint:'적색·주황' },
    earth: { hanja:'土', kr:'토', color:'#e65100', bg:'#fff3e0', bar:'#ff9800', label:'土(토)', meaning:'안정·중재·신뢰 에너지',  season:'환절기', dir:'中央', colorHint:'황색·갈색' },
    metal: { hanja:'金', kr:'금', color:'#37474f', bg:'#eceff1', bar:'#9e9e9e', label:'金(금)', meaning:'결단·집중·완성 에너지',  season:'가을(8~10월)', dir:'西(서)', colorHint:'흰색·금색' },
    water: { hanja:'水', kr:'수', color:'#0d47a1', bg:'#e3f2fd', bar:'#2196f3', label:'水(수)', meaning:'지혜·흐름·적응 에너지',  season:'겨울(11~1월)', dir:'北(북)', colorHint:'검정·청색' },
  };

  function getRole(oh) {
    if (oh === YONG)   return { label:'용신 ★', cls:'role-yong',  short:'용신' };
    if (oh === HUI)    return { label:'희신 ○', cls:'role-hui',   short:'희신' };
    if (oh === BYEONG) return { label:'기신 ✕', cls:'role-byeong',short:'기신' };
    if (oh === HAN)    return { label:'한신',   cls:'role-han',   short:'한신' };
    return { label:'중립', cls:'role-neutral', short:'중립' };
  }

  // 점수 내림차순 정렬
  const ORDER = ['wood','fire','earth','metal','water'].sort((a,b) => SCORES[b]-SCORES[a]);
  const MAX_SCORE = Math.max(...Object.values(SCORES), 0.01);

  function gradeLabel(g) {
    if (!g) return '';
    if (g.includes('매우강')) return '매우강';
    if (g.includes('강'))     return '강';
    if (g.includes('매우약')) return '매우약';
    if (g.includes('약'))     return '약';
    return g;
  }

  // ── 오행 균형 요약 ─────────────────────────────────────
  const taegwa = d4['태과오행'] || d6['태과오행'] || '—';
  const bulgup = d4['불급오행'] || d6['불급오행'] || '—';

  // ── CSS ───────────────────────────────────────────────
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
/* 요약 스트립 */
.sum-strip { display:grid; grid-template-columns:repeat(5,1fr); background:transparent; }
.sum-cell { padding:7px 6px; text-align:center; border-right:1px solid #eee; }
.sum-cell:last-child { border-right:none; }
.sum-lbl { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:2px; }
.sum-val { font-size:8pt; font-weight:800; color:#333; }
/* 테이블 */
table { width:100%; border-collapse:collapse; }
th { background:#f5f5f5; font-size:7pt; font-weight:700; color:#555; padding:6px 8px; border-bottom:2px solid #ddd; text-align:center; white-space:nowrap; }
td { font-size:7.5pt; padding:7px 8px; border-bottom:1px solid #f0f0f0; vertical-align:middle; text-align:center; }
tr:last-child td { border-bottom:none; }
tr.row-yong  { background:#f1f8e9; }
tr.row-hui   { background:#e3f2fd; }
tr.row-byeong{ background:#ffebee; }
.oh-name { font-size:10pt; font-weight:900; }
.oh-score { font-size:9pt; font-weight:700; }
.bar-wrap { width:120px; margin:0 auto; }
.bar-bg { height:10px; background:#eee; border-radius:5px; overflow:hidden; }
.bar-fill { height:100%; border-radius:5px; }
.role-yong   { background:#2e7d32; color:white; padding:2px 8px; border-radius:4px; font-size:6.5pt; font-weight:700; display:inline-block; white-space:nowrap; }
.role-hui    { background:#1565c0; color:white; padding:2px 8px; border-radius:4px; font-size:6.5pt; font-weight:700; display:inline-block; white-space:nowrap; }
.role-byeong { background:#c62828; color:white; padding:2px 8px; border-radius:4px; font-size:6.5pt; font-weight:700; display:inline-block; white-space:nowrap; }
.role-han    { background:#888; color:white; padding:2px 8px; border-radius:4px; font-size:6.5pt; font-weight:700; display:inline-block; white-space:nowrap; }
.role-neutral{ background:#bbb; color:white; padding:2px 8px; border-radius:4px; font-size:6.5pt; font-weight:700; display:inline-block; white-space:nowrap; }
.grade-tag { font-size:6pt; color:#888; }
.meaning-cell { font-size:6.5pt; color:#555; text-align:left; }
.note { font-size:6pt; color:#999; padding:6px 10px; background:#fafafa; border-top:1px solid #eee; }
/* 오행 속성 테이블 */
.attr-table { width:100%; border-collapse:collapse; }
.attr-table th { background:#f5f5f5; font-size:7pt; font-weight:700; color:#555; padding:6px 8px; border-bottom:2px solid #ddd; text-align:center; }
.attr-table td { font-size:7.5pt; padding:6px 8px; border-bottom:1px solid #f0f0f0; text-align:center; vertical-align:middle; }
.attr-table tr:last-child td { border-bottom:none; }
</style>`;

  // ── 테이블 행 생성 ────────────────────────────────────
  const rows = ORDER.map(oh => {
    const m    = META[oh];
    const role = getRole(oh);
    const barW = Math.round((SCORES[oh]/MAX_SCORE)*100);
    const pct  = ((SCORES[oh]/TOTAL)*100).toFixed(1);
    const rowCls = oh===YONG ? 'row-yong' : oh===HUI ? 'row-hui' : oh===BYEONG ? 'row-byeong' : '';
    const gl   = gradeLabel(GRADES[oh]);
    return `<tr class="${rowCls}">
  <td><span class="oh-name" style="color:${m.color};">${m.label}</span></td>
  <td class="oh-score">${SCORES[oh].toFixed(2)}</td>
  <td>${pct}%</td>
  <td><div class="bar-wrap"><div class="bar-bg"><div class="bar-fill" style="width:${barW}%;background:${m.bar};"></div></div></div></td>
  <td><span class="grade-tag">${esc(gl)}</span></td>
  <td><span class="${role.cls}">${role.label}</span></td>
  <td class="meaning-cell">${esc(m.meaning)}</td>
</tr>`;
  }).join('\n');

  // ── 속성 보조표 행 ────────────────────────────────────
  const attrRows = ORDER.map(oh => {
    const m    = META[oh];
    const role = getRole(oh);
    const pct  = ((SCORES[oh]/TOTAL)*100).toFixed(1);
    return `<tr>
  <td><span style="font-size:10pt;font-weight:900;color:${m.color};">${m.label}</span></td>
  <td>${SCORES[oh].toFixed(1)}</td>
  <td>${pct}%</td>
  <td>${m.meaning}</td>
  <td>${m.dir}</td>
  <td>${m.colorHint}</td>
  <td>${m.season}</td>
  <td><span class="${role.cls}">${role.short}</span></td>
</tr>`;
  }).join('\n');

  // ── HTML 조립 ─────────────────────────────────────────
  const yongMeta  = META[YONG || 'wood'];
  const huiMeta   = META[HUI  || 'water'];
  const byeongMeta= META[BYEONG|| 'metal'];

  const H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>오행 점수표 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#e65100,#f57c00);">
  <div>
    <div class="banner-hdr-title">📊 오행(五行) 점수표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${shingang?' · '+esc(shingang):''}</div>
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#ff6f00,#ff9800);">
    <div class="card-hd-title">① 오행 점수 분석표</div>
    <div class="card-hd-sub">점수·비율·강도 바·등급·용신분류·의미</div>
  </div>
  <!-- 요약 스트립 -->
  <div class="sum-strip">
    <div class="sum-cell"><div class="sum-lbl">용신(用神)</div><div class="sum-val" style="color:${yongMeta.color};">${yongMeta.label}</div></div>
    <div class="sum-cell"><div class="sum-lbl">희신(喜神)</div><div class="sum-val" style="color:${huiMeta.color};">${huiMeta.label}</div></div>
    <div class="sum-cell"><div class="sum-lbl">기신(忌神)</div><div class="sum-val" style="color:${byeongMeta.color};">${byeongMeta.label}</div></div>
    <div class="sum-cell"><div class="sum-lbl">태과 오행</div><div class="sum-val">${esc(taegwa)}</div></div>
    <div class="sum-cell"><div class="sum-lbl">불급 오행</div><div class="sum-val">${esc(bulgup)}</div></div>
  </div>
  <table>
    <thead>
      <tr><th>오행</th><th>점수</th><th>비율</th><th>강도</th><th>등급</th><th>용신분류</th><th>의미·에너지</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="note">※ 점수: 위치별 가중치(월지 3.0·일지 2.0·일간 2.0·기타 1.0~1.5) + 지장간 30% + 투출 보정 반영</div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
    <div class="card-hd-title">② 오행 속성 일람</div>
    <div class="card-hd-sub">의미·방위·색상·계절·용신분류 (점수 내림차순)</div>
  </div>
  <table class="attr-table">
    <thead><tr><th>오행</th><th>점수</th><th>비율</th><th>의미·에너지</th><th>방위</th><th>색상</th><th>계절</th><th>분류</th></tr></thead>
    <tbody>${attrRows}</tbody>
  </table>
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive:true });
  const outFile = path.join(outDir, '오행점수표.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ 오행점수표 생성: ${outFile}  (${Buffer.byteLength(H,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_오행점수표.js <slot_id>'); process.exit(1); }
generate(slotId);
