#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── 성격 → 색상 ──────────────────────────────────────────
function seongColor(s) {
  if (!s) return { bg:'#f5f5f5', fg:'#888', border:'#ddd' };
  if (s.includes('용신')) return { bg:'#e8f5e9', fg:'#2e7d32', border:'#66bb6a' };
  if (s.includes('희신')) return { bg:'#e3f2fd', fg:'#1565c0', border:'#42a5f5' };
  if (s.includes('기신')) return { bg:'#ffebee', fg:'#c62828', border:'#ef5350' };
  if (s.includes('한신')) return { bg:'#fff3e0', fg:'#e65100', border:'#ffa726' };
  return { bg:'#f5f5f5', fg:'#666', border:'#bdbdbd' };
}
function seongBadge(s, fs='6pt') {
  if (!s) return '';
  const c = seongColor(s);
  return `<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:${fs};font-weight:700;background:${c.bg};color:${c.fg};border:1px solid ${c.border};">${esc(s)}</span>`;
}

// ── 월운 성격 → 행 스타일 ────────────────────────────────
function monthRowStyle(seong) {
  if (!seong) return '';
  if (seong.includes('용신')) return 'background:#f1f8f1;';
  if (seong.includes('희신')) return 'background:#f0f6ff;';
  if (seong.includes('기신')) return 'background:#fff8f8;';
  return '';
}

// ── 월 라벨 (기준해/기준년 포함) ─────────────────────────
// 2월~12월 = 기준해, 1월 = 기준년
function monthLabel(num, thisYear, nextYear) {
  if (num === 1) return { label:`1월`, year: nextYear };
  return { label:`${num}월`, year: thisYear };
}

function generate(slotId) {
  const ch03Path     = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch09jeonPath = path.join(QUEUE_DIR, `${slotId}_ch09_jeon.json`);
  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path,'utf-8')) : {};
  const d  = JSON.parse(fs.readFileSync(ch09jeonPath,'utf-8'));
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d); } catch(e){}

  // ── 인적 정보 ──────────────────────────────────────────
  const name   = d3['user_name']  || d3['이름']   || d['이름'] || slotId;
  const birthS = d3['birth_solar']|| '';
  const gender = d3['user_gender']|| d['성별']    || '';
  const age    = d3['user_age']   || '';
  const ilju   = d3['일주']       || '';

  // ── 대운 전환 ─────────────────────────────────────────
  const curGangi    = d['현재대운간지']      || '';
  const curSeong    = d['현재대운성격']      || '';
  const curRange    = d['현재대운나이범위']  || '';
  const curFrontSt  = d['현재대운전반시작'] || '';
  const curBackSt   = d['현재대운후반시작'] || '';
  const curFrontCh  = d['현재대운전반성격'] || '';
  const curBackCh   = d['현재대운후반성격'] || '';
  const nextGangi   = d['다음대운간지']      || '';
  const nextSeong   = d['다음대운성격']      || '';
  const nextYear    = d['다음대운시작년도']  || d['대운교체년도'] || '';
  const nextAge     = d['다음대운시작나이'] || '';

  // ── 교차 현상 ─────────────────────────────────────────
  const crossItems = [];
  if (d['교차충_대운_여부']==='Y') crossItems.push({ kind:'충', src:'대운', desc:d['교차충_대운_설명']||'' });
  if (d['교차합_대운_여부']==='Y') crossItems.push({ kind:'합', src:'대운', desc:d['교차합_대운_설명']||'' });
  if (d['교차충_세운_여부']==='Y') crossItems.push({ kind:'충', src:'세운', desc:d['교차충_세운_설명']||'' });
  if (d['교차합_세운_여부']==='Y') crossItems.push({ kind:'합', src:'세운', desc:d['교차합_세운_설명']||'' });

  const crossGrade = d['대운세운교차등급'] || '';
  const crossDesc  = d['대운세운교차설명'] || '';

  // ── 월운 12개월 ─────────────────────────────────────
  const thisYear = d['기준해'] || d['올해'] || '';
  const nextYr   = d['기준년'] || d['내년'] || '';
  // 월 순서: 2,3,4,5,6,7,8,9,10,11,12,1 (입춘 기준)
  const MONTH_ORDER = [2,3,4,5,6,7,8,9,10,11,12,1];
  const months = MONTH_ORDER.map(n => {
    const gj   = d[`세운_${n}월간지`]  || '';
    const seong= d[`월운_${n}월성격`]  || '';
    const ss   = d[`월운_${n}월십성`]  || '';
    const un12 = d[`월운_${n}월운성`]  || '';
    const ganOh= d[`월운_${n}월천간오행`] || '';
    const jiOh = d[`월운_${n}월지지오행`] || '';
    const { label, year } = monthLabel(n, thisYear, nextYr);
    return { n, gj, seong, ss, un12, ganOh, jiOh, label, year };
  });

  const goodSet = new Set((d['월운_좋은달목록']||'').split(/[·,、]/).map(s=>s.trim()).filter(Boolean));
  const careSet = new Set((d['월운_조심달목록']||'').split(/[·,、]/).map(s=>s.trim()).filter(Boolean));

  // ── 주의 사항 ─────────────────────────────────────────
  const juyuiHae   = d['현대운_주의의해']  || '';
  const healthList = (d['건강주의대운목록']||'').split('\n').filter(Boolean);
  const youngHard  = d['초년힘든대운목록'] || '';

  // ── 현재 대운 색상 ─────────────────────────────────────
  const curC  = seongColor(curSeong);
  const nextC = seongColor(nextSeong);

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>전환점요약표 》 ${esc(name)}님</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;max-height:840px;overflow:hidden;padding:4px 6px;background:transparent;display:flex;flex-direction:column;gap:3px;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{body{background:transparent;margin:0;padding:0;}.page{margin:0;width:604px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px 840px;margin:0;}}
/* 헤더 */
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-radius:6px;}
.banner-hdr-title{font-size:8.5pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:7pt;color:rgba(255,255,255,.75);margin-top:1px;}
.banner-hdr-name{font-size:8.5pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:7pt;color:rgba(255,255,255,.75);text-align:right;margin-top:1px;}
/* 카드 */
.card{border:1px solid #333;border-radius:6px;overflow:hidden;}
.card-hd{padding:2px 8px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:6.5pt;font-weight:900;color:white;}
.card-hd-sub{font-size:7pt;color:rgba(255,255,255,.82);}
/* ① 대운 비교 테이블 */
.dw-cmp-tbl{width:100%;border-collapse:collapse;}
.dw-cmp-tbl th{font-size:7pt;font-weight:700;padding:2px 6px;text-align:left;border-bottom:1px solid #e0e0e0;background:#f9f9f9;color:#555;}
.dw-cmp-tbl th.cur{color:${curC.fg};background:${curC.bg};}
.dw-cmp-tbl th.nxt{color:${nextC.fg};background:${nextC.bg};}
.dw-cmp-tbl td{font-size:7pt;padding:1px 6px;border-bottom:1px solid #f0f0f0;vertical-align:middle;}
.dw-cmp-tbl td:first-child{font-size:7pt;font-weight:700;color:#888;background:#fafafa;width:50px;}
.dw-cmp-tbl tr:last-child td{border-bottom:none;}
.dw-gangi{font-family:'Noto Serif KR',serif;font-size:9pt;font-weight:800;line-height:1;}
/* ② 교차 현상 그리드 */
.cross-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px 6px;background:transparent;}
.cross-cell{border-radius:4px;padding:3px 6px;border:1px solid;}
.cross-cell.chung{background:#fff8e1;border-color:#f9a825;}
.cross-cell.hap{background:#e8f5e9;border-color:#66bb6a;}
.cross-cell-hd{display:flex;align-items:center;gap:3px;margin-bottom:1px;}
.cross-kind{font-size:6pt;font-weight:900;}
.cross-src{font-size:7pt;font-weight:700;padding:0px 4px;border-radius:3px;color:white;}
.cross-desc{font-size:7pt;color:#444;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.cross-grade{margin:0 6px 3px;padding:3px 6px;background:#f3e5f5;border-radius:4px;border-left:2px solid #9c27b0;display:flex;align-items:center;gap:4px;}
.cross-grade-chip{font-size:6pt;font-weight:900;padding:1px 5px;background:#7b1fa2;color:white;border-radius:4px;white-space:nowrap;}
.cross-grade-txt{font-size:7pt;color:#444;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;}
/* ③ 월운 테이블 */
.wolun-tbl{width:100%;border-collapse:collapse;}
.wolun-tbl thead tr{background:#37474f;}
.wolun-tbl th{font-size:7pt;font-weight:700;color:white;padding:2px 4px;text-align:center;border-right:1px solid #455a64;}
.wolun-tbl th:last-child{border-right:none;}
.wolun-tbl td{font-size:7pt;padding:1px 3px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;line-height:1.2;}
.wolun-tbl td:nth-child(1){font-size:7pt;font-weight:700;color:#444;width:32px;}
.wolun-tbl td:nth-child(2){font-family:'Noto Serif KR',serif;font-size:6.5pt;font-weight:700;width:38px;}
.wolun-tbl td:nth-child(3){width:48px;}
.wolun-tbl td:nth-child(4){font-size:7pt;color:#666;width:38px;}
.wolun-tbl td:nth-child(5){font-size:7pt;color:#666;width:34px;}
.wolun-tbl tr:last-child td{border-bottom:none;}
.wolun-tbl tr.good td{background:#f1f8f1!important;}
.wolun-tbl tr.care td{background:#fff8f8!important;}
.wolun-dot{display:inline-block;width:4px;height:4px;border-radius:50%;margin-right:1px;vertical-align:middle;}
/* ④ 주의사항 */
.note-grid{display:flex;gap:3px;padding:3px 6px;background:transparent;flex-wrap:wrap;}
.note-cell{border-radius:4px;padding:2px 6px;border:1px solid #333;flex:1;min-width:0;}
.note-lbl{font-size:6.5pt;font-weight:700;color:#aaa;letter-spacing:.3px;}
.note-val{font-size:7pt;font-weight:700;color:#333;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;}
.health-box{padding:2px 6px;background:#fff8f0;border-top:1px solid #ffe0b2;}
.health-title{font-size:7pt;font-weight:700;color:#e65100;margin-bottom:1px;}
.health-item{font-size:7pt;color:#555;line-height:1.3;padding-left:8px;position:relative;display:inline;margin-right:6px;}
.health-item::before{content:'•';position:absolute;left:1px;color:#ef5350;}
</style>
</head>
<body>
<div class="page">

<!-- 헤더 -->
<div class="banner-hdr" style="background:linear-gradient(135deg,#37474f,#546e7a);">
  <div>
    <div class="banner-hdr-title">🔄 전환점(轉換點) 요약표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${curGangi?' · 대운 '+esc(curGangi):''}</div>
  </div>
</div>

<!-- ① 대운 전환 비교 -->
<div class="card">
  <div class="card-hd" style="background:#4a148c;">
    <div class="card-hd-title">① 대운(大運) 전환 비교</div>
    <div class="card-hd-sub">현재 대운 → 다음 대운 핵심 정보</div>
  </div>
  <table class="dw-cmp-tbl">
    <thead>
      <tr>
        <th></th>
        <th class="cur">현재 대운</th>
        <th class="nxt">다음 대운</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>간지</td>
        <td><span class="dw-gangi" style="color:${curC.fg};">${esc(curGangi)}</span></td>
        <td><span class="dw-gangi" style="color:${nextC.fg};">${esc(nextGangi)}</span></td>
      </tr>
      <tr>
        <td>성격</td>
        <td>${seongBadge(curSeong,'5pt')}</td>
        <td>${seongBadge(nextSeong,'5pt')}</td>
      </tr>
      <tr>
        <td>시기</td>
        <td style="color:#555;">${esc(curRange)}</td>
        <td style="color:#555;">${nextYear?esc(nextYear)+'년~'+(nextAge?' (만 '+esc(nextAge)+'세)':''):''}</td>
      </tr>
      <tr>
        <td>전반</td>
        <td>${curFrontSt?`<span style="font-size:7pt;color:#888;">${esc(curFrontSt)}년~ </span>`:''}${seongBadge((curFrontCh?curFrontCh+'대운':''),'5.5pt')}</td>
        <td><span style="font-size:7pt;color:#aaa;">교체 후 확인</span></td>
      </tr>
      <tr>
        <td>후반</td>
        <td>${curBackSt?`<span style="font-size:7pt;color:#888;">${esc(curBackSt)}년~ </span>`:''}${seongBadge((curBackCh?curBackCh+'대운':''),'5.5pt')}</td>
        <td><span style="font-size:7pt;color:#aaa;">교체 후 확인</span></td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ② 교차 현상 -->
${crossItems.length ? `
<div class="card">
  <div class="card-hd" style="background:#e65100;">
    <div class="card-hd-title">② 교차(交叉) 현상 》 합·충 작용</div>
    <div class="card-hd-sub">대운·세운과 원국의 합충 교차</div>
  </div>
  <div class="cross-grid">
    ${crossItems.map(ci => {
      const isHap = ci.kind === '합';
      const kindColor = isHap ? '#2e7d32' : '#e65100';
      const srcBg     = isHap ? '#2e7d32' : '#f57c00';
      return `<div class="cross-cell ${isHap?'hap':'chung'}">
      <div class="cross-cell-hd">
        <span class="cross-kind" style="color:${kindColor};">${esc(ci.kind)}(${ci.kind==='충'?'沖':'合'})</span>
        <span class="cross-src" style="background:${srcBg};">${esc(ci.src)}</span>
      </div>
      <div class="cross-desc">${esc(ci.desc)}</div>
    </div>`;
    }).join('')}
  </div>
  ${crossGrade ? `<div class="cross-grade">
    <span class="cross-grade-chip">${esc(crossGrade)}</span>
    <span class="cross-grade-txt">${esc(crossDesc)}</span>
  </div>` : ''}
</div>` : ''}

<!-- ③ 월운 12개월 테이블 -->
<div class="card">
  <div class="card-hd" style="background:#1a3a5c;">
    <div class="card-hd-title">③ ${thisYear?esc(thisYear)+'년 ':''}월운(月運) 12개월 요약</div>
    <div class="card-hd-sub">
      <span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4caf50;"></span>용신/희신월</span>
      <span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef5350;"></span>기신월</span>
    </div>
  </div>
  <table class="wolun-tbl">
    <thead>
      <tr>
        <th>월</th>
        <th>간지</th>
        <th>성격</th>
        <th>십성</th>
        <th>12운성</th>
      </tr>
    </thead>
    <tbody>
      ${months.filter(m => m.gj).map(m => {
        const isGood = goodSet.has(m.label);
        const isCare = careSet.has(m.label);
        const rowCls = isGood ? 'good' : (isCare ? 'care' : '');
        const dotColor = isGood ? '#4caf50' : (isCare ? '#ef5350' : '#bbb');
        const seong = m.seong;
        const sc = seongColor(seong);
        const yearNote = m.year && m.year !== thisYear ? `<span style="font-size:6.5pt;color:#aaa;margin-left:1px;">'${String(m.year).slice(-2)}</span>` : '';
        return `<tr class="${rowCls}">
          <td><span class="wolun-dot" style="background:${dotColor};"></span>${esc(m.label)}${yearNote}</td>
          <td>${esc(m.gj)}</td>
          <td><span style="font-size:7pt;font-weight:700;color:${sc.fg};">${esc(seong)}</span></td>
          <td>${esc(m.ss)}</td>
          <td>${esc(m.un12)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>

<!-- ④ 핵심 주의사항 -->
${(juyuiHae || youngHard || healthList.length) ? `
<div class="card">
  <div class="card-hd" style="background:#b71c1c;">
    <div class="card-hd-title">④ 핵심 주의사항</div>
    <div class="card-hd-sub">주의할 해 · 건강 위험 대운 · 초년 어려운 대운</div>
  </div>
  <div class="note-grid">
    ${juyuiHae ? `<div class="note-cell" style="border-color:#f9a825;background:#fffde7;grid-column:1/-1;">
      <div class="note-lbl">⚠ 주의할 해 (이 대운 내)</div>
      <div class="note-val">${esc(juyuiHae)}</div>
    </div>` : ''}
    ${youngHard ? `<div class="note-cell" style="border-color:#7986cb;background:#e8eaf6;grid-column:1/-1;">
      <div class="note-lbl">📌 초년 어려운 대운</div>
      <div class="note-val">${esc(youngHard)}</div>
    </div>` : ''}
  </div>
  ${healthList.length ? `<div class="health-box">
    <div class="health-title">🏥 건강 주의 대운 목록</div>
    ${healthList.map(l=>`<div class="health-item">${esc(l)}</div>`).join('')}
  </div>` : ''}
</div>` : ''}

</div>
</body>
</html>`;

  const outDir  = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '전환점요약표.html');
  fs.writeFileSync(outPath, HTML, 'utf-8');
  console.log(`✅ 전환점요약표 생성: ${outPath}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_전환점요약표.js <slot_id>'); process.exit(1); }
generate(slotId);
