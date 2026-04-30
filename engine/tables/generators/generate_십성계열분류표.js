#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 계열 메타
const GYEYEOL = [
  { key:'비겁', han:'比劫', ss:['비견','겁재'], c:'#1e6b2a', light:'#e8f7ec', desc:'자립·경쟁·자존심' },
  { key:'식상', han:'食傷', ss:['식신','상관'], c:'#b92e27', light:'#fde8e7', desc:'창의·표현·재능 발휘' },
  { key:'재성', han:'財星', ss:['편재','정재'], c:'#9b6f00', light:'#fff8e0', desc:'재물·사업·현실 감각' },
  { key:'관성', han:'官星', ss:['편관','정관'], c:'#3d4f5c', light:'#eef1f4', desc:'명예·직업·조직력' },
  { key:'인성', han:'印星', ss:['편인','정인'], c:'#1a4e7a', light:'#e3eef9', desc:'학문·지혜·모성' },
];

// 십성 의미
const SS_DESC = {
  '비견':'주체성·자립·동등한 경쟁. 독립적으로 움직이는 힘.',
  '겁재':'경쟁심·추진력·과감한 실행. 승부근성.',
  '식신':'창의·표현·여유·먹복. 자연스러운 재능 발휘.',
  '상관':'표현력·반골기질·예술성. 규칙 밖의 사고.',
  '편재':'사업적 재물·투기·확장성. 유동적 재물.',
  '정재':'안정적 재물·근면·절약. 고정 수입 선호.',
  '편관':'추진력·명예욕·투쟁심. 강한 카리스마.',
  '정관':'원칙·도덕·명예·조직 순응. 안정 추구.',
  '편인':'직관·독창·편법적 지식. 독특한 발상.',
  '정인':'학문·지식·모성·보수적 사고. 공부 능력.',
};

// 십성 → 삶의 영역
const SS_DOMAIN = {
  '비견':'형제·동료·경쟁자. 자립·독립 사업.',
  '겁재':'경쟁·투자·사업 기질. 재물 기복.',
  '식신':'창작·예술·요식·자유업.',
  '상관':'언론·예술·교육(비판).',
  '편재':'사업·투자·무역.',
  '정재':'재무·직장·안정 자산.',
  '편관':'군경·스포츠·리더십.',
  '정관':'공무·법조·조직 직장.',
  '편인':'종교·철학·특수 기술.',
  '정인':'교육·학문·복지·연구.',
};

// 십성배치목록 파싱 → {비견:['년간'], 편관:['월간','월지'], ...}
function parseBaechi(raw) {
  const map = {};
  if (!raw) return map;
  raw.split(',').forEach(item => {
    const m = item.trim().match(/^(\S+)\s+\S+:\s*(\S+)/);
    if (!m) return;
    const loc = m[1]; const ss = m[2];
    if (!map[ss]) map[ss] = [];
    map[ss].push(loc);
  });
  return map;
}

function generate(slotId) {
  const ch05Path = path.join(QUEUE_DIR, `${slotId}_ch05.json`);
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const d5 = fs.existsSync(ch05Path) ? JSON.parse(fs.readFileSync(ch05Path, 'utf-8')) : {};
  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d5); } catch(e){}

  // ── 인적 정보 ────────────────────────────────────────
  const name    = d5['이름']            || d3['이름']        || slotId;
  const birthS  = d3['birth_solar']     || d3['생년월일']    || '';
  const gender  = d5['성별']            || d3['user_gender'] || '';
  const age     = d5['만나이']          || d3['user_age']    || '';
  const ilju    = d3['일주']            || d5['일주']        || '';
  const singang = d5['신강약단계']      || d5['신강약']      || '';
  const gyeok   = d5['格국명']          || d5['격국명']      || '';
  const curDW   = d5['현재대운간지']    || '';
  const curChar = d5['현재대운성격']    || '';
  const seunGJ  = d5['세운간지']        || '';
  const seunChar= d5['세운성격']        || '';
  const _c8=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`),'utf-8')):{};
  const _c6=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`),'utf-8')):{};
  const yongOH  = _c8['용신오행']||_c6['용신오행']||d5['용신오행']||'';
  const huiOH   = _c8['희신오행']||_c6['희신오행']||d5['희신오행']||'';
  const byeongOH= _c8['기신오행']||_c6['기신오행']||d5['기신오행']||'';

  // ── 십성 데이터 ──────────────────────────────────────
  const 있는십성  = (d5['있는십성목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  const 없는십성  = (d5['없는십성목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  const 있는계열  = (d5['있는계열목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  const 없는계열  = (d5['없는계열목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  const 최다계열  = d5['최다십성계열']   || '';
  const 최다계열수= d5['최다십성계열수'] || '';
  const 주요십성1 = d5['주요십성']       || d5['최강십성명'] || '';
  const 주요십성2 = d5['주요십성2']      || '';
  const 주요십성3 = d5['주요십성3']      || '';
  const baechiMap = parseBaechi(d5['십성배치목록'] || '');

  // 관살혼잡·부재 여부
  const 관살혼잡  = (d5['관살혼잡_여부'] || 'N') === 'Y';
  const 십성부재  = (d5['십성부재여부']  || 'N') === 'Y';
  const existSet  = new Set(있는십성.map(s=>s.replace('일원(日元)','').replace('(日元)','')));

  // ── CSS ──────────────────────────────────────────────
  const CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; padding:12px 20px; background:transparent; display:flex; flex-direction:column; gap:5px; }
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
.card { border:2px solid #ccc;border-radius:10px;overflow:hidden;flex-shrink:0; }
.card-hd { padding:5px 14px;display:flex;align-items:center;justify-content:space-between; }
.card-hd-title { font-size:9pt;font-weight:900;color:white; }
.card-hd-sub   { font-size:6.5pt;color:rgba(255,255,255,.9); }
/* 기본 정보 스트립 */
.info-strip { display:grid;grid-template-columns:repeat(5,1fr);background:transparent; }
.is-cell { padding:5px 7px;text-align:center;border-right:1px solid #e8e8e8; }
.is-cell:last-child { border-right:none; }
.is-lbl  { font-size:7pt;color:#999;font-weight:700;margin-bottom:2px;letter-spacing:.3px; }
.is-val  { font-size:7.5pt;font-weight:800;color:#333;line-height:1.3; }
/* 계열 표 */
.gy-table { width:100%;border-collapse:collapse;background:transparent; }
.gy-table thead tr { background:#475569; }
.gy-table th { font-size:6.5pt;font-weight:700;color:white;padding:4px 7px;text-align:center;
               border-right:1px solid #566778;letter-spacing:.3px; }
.gy-table th:last-child { border-right:none; }
/* 행 구분: 명확한 1px solid 회색 */
.gy-row td { font-size:7pt;color:#333;padding:5px 7px;
             border-bottom:1px solid #dde1e6;border-right:1px solid #e8ecf0;
             vertical-align:top; }
.gy-row td:last-child { border-right:none; }
.gy-row:last-child td { border-bottom:none; }
/* 없는 계열 행은 배경 약하게 */
.gy-row.absent td { background:#fafafa; }
/* 계열 이름 컬럼 */
.gy-name { font-weight:900;font-size:8.5pt;line-height:1; }
.gy-han  { font-size:6pt;color:#999;margin-top:2px; }
.cnt-chip { display:inline-block;font-size:7.5pt;font-weight:900;padding:2px 9px;border-radius:5px;
            color:white;margin-top:3px; }
.cnt-chip.absent { background:#c0c7cf;color:#fff; }
/* 십성 위치 박스 */
.ss-box  { display:flex;flex-direction:column;gap:3px; }
/* 있는 십성 */
.ss-item-yes { border-radius:6px;padding:4px 7px;border-width:1.5px;border-style:solid; }
.ss-name-yes { font-size:7.5pt;font-weight:800; }
.ss-locs { margin-top:2px;display:flex;flex-wrap:wrap;gap:3px; }
.ss-loc-chip { font-size:7pt;font-weight:700;padding:1px 5px;border-radius:3px;
               color:white;display:inline-block; }
/* 없는 십성 */
.ss-item-no  { border-radius:5px;padding:3px 6px;background:#f2f4f6;border:1px solid #dde1e6; }
.ss-name-no  { font-size:7pt;font-weight:700;color:#bbb; }
.ss-none-lbl { font-size:7pt;color:#ccc;margin-top:1px; }
/* 의미 컬럼 */
.mean-desc  { font-size:7pt;font-weight:800;margin-bottom:3px; }
.mean-item  { font-size:6.5pt;color:#444;margin-bottom:3px;line-height:1.5; padding-left:8px; position:relative; }
.mean-item:before { content:"•";position:absolute;left:0;color:#999; }
.mean-absent { font-size:6.5pt;color:#aaa;font-style:italic;line-height:1.4; }
/* 삶의 영역 컬럼 */
.domain-item { font-size:6.5pt;color:#555;margin-bottom:3px;line-height:1.4; }
.domain-absent { font-size:6pt;color:#ccc; }
/* 요약 행 */
.sum-row { display:flex;gap:5px;flex-wrap:wrap;padding:6px 14px;background:#f8f9fa;border-top:1.5px solid #e8ecf0; }
.sum-tag { font-size:7pt;font-weight:700;padding:3px 9px;border-radius:5px;white-space:nowrap; }
</style>`;

  // ── 기본 정보 스트립 ─────────────────────────────────
  const singangC = singang.includes('신강') ? '#8b0000' : '#1a5276';
  const infoStrip = `<div class="info-strip">
  <div class="is-cell"><div class="is-lbl">신강약</div><div class="is-val" style="color:${singangC};">${esc(singang.replace('(身强)','').replace('(身弱)',''))}</div></div>
  <div class="is-cell"><div class="is-lbl">格局</div><div class="is-val" style="font-size:7pt;">${esc(gyeok.replace('(관살혼잡)','').substring(0,8))}</div></div>
  <div class="is-cell"><div class="is-lbl">最多계열</div><div class="is-val" style="color:${GYEYEOL.find(g=>g.key===최다계열)?.c||'#333'};">${esc(최다계열)} (${최다계열수}개)</div></div>
  <div class="is-cell"><div class="is-lbl">用神</div><div class="is-val" style="color:#2e7d32;font-size:7.5pt;">${esc(yongOH)}</div></div>
  <div class="is-cell"><div class="is-lbl">없는 계열</div><div class="is-val" style="color:${없는계열.length?'#c62828':'#888'};font-size:7pt;">${없는계열.length ? 없는계열.join('·') : '없음'}</div></div>
</div>`;

  // ── 5계열 표 ─────────────────────────────────────────
  const gyRows = GYEYEOL.map(g => {
    const cnt    = g.ss.filter(s => existSet.has(s)).length;
    const absent = cnt === 0;
    const cntStr = !absent
      ? `<span class="cnt-chip" style="background:${g.c};">${cnt}개</span>`
      : `<span class="cnt-chip absent">없음</span>`;

    // 십성 위치 박스
    const ssItems = g.ss.map(s => {
      const locs = baechiMap[s] || [];
      const has  = existSet.has(s);
      if (has) {
        const chips = locs.map(l =>
          `<span class="ss-loc-chip" style="background:${g.c};">${esc(l)}</span>`
        ).join('');
        return `<div class="ss-item-yes" style="background:${g.light};border-color:${g.c}66;">
  <span class="ss-name-yes" style="color:${g.c};">${esc(s)}</span>
  ${locs.length ? `<div class="ss-locs">${chips}</div>` : ''}
</div>`;
      } else {
        return `<div class="ss-item-no">
  <span class="ss-name-no">${esc(s)}</span>
  <div class="ss-none-lbl">원국 없음</div>
</div>`;
      }
    }).join('');

    // 의미·기질 컬럼
    const meanParts = g.ss.filter(s => existSet.has(s)).map(s =>
      `<div class="mean-item"><strong style="color:${g.c};">${s}</strong> 》 ${esc(SS_DESC[s]||'')}</div>`
    ).join('');
    const meanAbsent = absent
      ? `<div class="mean-absent">원국에 ${g.key} 계열 없음<br>${g.ss.map(s=>`${s}: ${(SS_DESC[s]||'').substring(0,22)}`).join('<br>')}</div>`
      : '';

    // 삶의 영역 컬럼
    const domainParts = g.ss.filter(s => existSet.has(s)).map(s =>
      `<div class="domain-item">${esc(SS_DOMAIN[s]||'')}</div>`
    ).join('');
    const domainAbsent = absent ? `<div class="domain-absent">—</div>` : '';

    return `<tr class="gy-row${absent?' absent':''}">
  <td style="border-left:4px solid ${g.c};text-align:center;width:62px;background:${absent?'#f8f9fa':'white'};">
    <div class="gy-name" style="color:${g.c};">${g.key}</div>
    <div class="gy-han">${g.han}</div>
    ${cntStr}
  </td>
  <td style="width:130px;background:${absent?'#f8f9fa':'white'};"><div class="ss-box">${ssItems}</div></td>
  <td style="background:${absent?'#f8f9fa':'white'};">
    <div class="mean-desc" style="color:${absent?'#bbb':g.c};">${g.desc}</div>
    ${meanParts}${meanAbsent}
  </td>
  <td style="width:82px;background:${absent?'#f8f9fa':'white'};">
    ${domainParts}${domainAbsent}
  </td>
</tr>`;
  }).join('');

  // ── 요약 태그 ─────────────────────────────────────────
  const summaryTags = [
    주요십성1 && `<span class="sum-tag" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;">주요 ${esc(주요십성1)}</span>`,
    주요십성2 && `<span class="sum-tag" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;">${esc(주요십성2)}</span>`,
    주요십성3 && `<span class="sum-tag" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;">${esc(주요십성3)}</span>`,
    관살혼잡  && `<span class="sum-tag" style="background:#ffebee;color:#c62828;border:1px solid #ef9a9a;">관살혼잡</span>`,
    십성부재  && `<span class="sum-tag" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;">십성 부재</span>`,
    없는십성.length && `<span class="sum-tag" style="background:#f3e5f5;color:#7b1fa2;border:1px solid #ce93d8;">없는 십성: ${없는십성.filter(s=>!s.includes('일원')).join('·')}</span>`,
  ].filter(Boolean).join('');

  // ── HTML 조립 ─────────────────────────────────────────
  const H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>십성계열분류표 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#283593,#3949ab);">
  <div>
    <div class="banner-hdr-title">⭐ 십성 계열 분류표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${curDW?' · 대운 '+esc(curDW):''}</div>
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
    <div class="card-hd-title">기본 명리 정보</div>
    <div class="card-hd-sub">신강약 · 격국 · 최다계열 · 용신 · 없는계열</div>
  </div>
  ${infoStrip}
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#7b1fa2,#e91e63);">
    <div class="card-hd-title">⭐ 5계열 10성 배치 분석</div>
    <div class="card-hd-sub">比劫·食傷·財星·官星·印星 》 있는 별과 없는 별</div>
  </div>
  <table class="gy-table">
    <thead><tr>
      <th>계열</th><th>십성 (위치)</th><th>의미 · 기질</th><th>삶의 영역</th>
    </tr></thead>
    <tbody>${gyRows}</tbody>
  </table>
  <div class="sum-row">${summaryTags}</div>
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '십성계열분류표.html');
  require('./_guards').safeWriteHtml(outFile, H, { 이름: name }, '십성계열분류표');
  console.log(`✓ Generated: ${outFile} (${H.length} bytes)`);
}

const slotId = process.argv[2] || 's11';
generate(slotId);
