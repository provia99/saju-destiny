#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 성격 → 색상
const CHAR = {
  용신: { bg:'#e8f5e9', border:'#2e7d32', text:'#2e7d32', light:'#f1fbf4' },
  희신: { bg:'#e3f2fd', border:'#1565c0', text:'#1565c0', light:'#f0f7ff' },
  기신: { bg:'#ffebee', border:'#c62828', text:'#c62828', light:'#fff5f5' },
  중립: { bg:'#f5f5f5', border:'#757575', text:'#555',    light:'#fafafa' },
};
function charStyle(s) {
  if (!s) return CHAR.중립;
  if (s.includes('용신')) return CHAR.용신;
  if (s.includes('희신')) return CHAR.희신;
  if (s.includes('기신')) return CHAR.기신;
  return CHAR.중립;
}
function charLabel(s) {
  if (!s) return '중립';
  if (s.includes('용신')) return '용신';
  if (s.includes('희신')) return '희신';
  if (s.includes('기신')) return '기신';
  return '중립';
}

// 대운목록 파싱 (8+ 필드)
function parseDaeunList(text) {
  if (!text) return [];
  return text.split('\n').filter(Boolean).map((line, idx) => {
    const p = line.split('|').map(s => s.trim());
    const raw   = p[0] || '';
    const numM  = raw.match(/^(\d+)기/);
    const num   = numM ? parseInt(numM[1]) : idx + 1;
    const gangi = raw.replace(/^\d+기\s*/, '');
    const age   = p[1] || '';
    const year  = p[2] || '';
    const un12  = p[3] || '';
    const char  = p[4] || '';
    const half  = p[5] || '';
    const tgSS  = p[6] || '';  // "천간:편재"
    const jjSS  = p[7] || '';  // "지지:비견"
    const hap   = p[8] || '';  // 합충 정보

    // 전반/후반 파싱
    const jm = half.match(/전반\([^)]+\):(\S+)/);
    const hm = half.match(/후반\([^)]+\):(\S+)/);
    const jeonChar = jm ? jm[1] : '';
    const hubanChar = hm ? hm[1] : '';

    // 전반/후반 년도
    const jy = half.match(/전반\(([^)]+)\)/);
    const hy = half.match(/후반\(([^)]+)\)/);
    const jeonYr = jy ? jy[1] : '';
    const huYr   = hy ? hy[1] : '';

    const tgSsVal = tgSS.replace(/^천간:/, '');
    const jjSsVal = jjSS.replace(/^지지:/, '');

    return { num, gangi, age, year, un12, char, jeonChar, jeonYr, hubanChar, huYr, tgSsVal, jjSsVal, hap };
  });
}

// 건강위험 기수 목록 파싱
function parseHealthGi(text) {
  const set = new Set();
  if (!text) return set;
  text.split('\n').forEach(line => {
    const m = line.match(/^(\d+)기/);
    if (m) set.add(parseInt(m[1]));
  });
  return set;
}

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch08Path = path.join(QUEUE_DIR, `${slotId}_ch08.json`);
  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};
  if (!fs.existsSync(ch08Path)) {
    console.error(`  ⚠️  ${slotId}_ch08.json 없음 》 대운타임라인 건너뜀`);
    return '';
  }
  const d  = JSON.parse(fs.readFileSync(ch08Path, 'utf-8'));
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d); } catch(e){}

  const name   = d3['이름']        || d['이름']    || slotId;
  const birthS = d3['birth_solar'] || d3['생년월일']|| '';
  const gender = d3['user_gender'] || d['성별']    || '';
  const age    = d3['user_age']    || d['만나이']  || '';
  const ilju   = d3['일주']        || d['일주한자']|| '';
  const curDW  = d['현재대운간지'] || '';
  const seunGJ = d['세운간지']     || '';
  const curGi  = parseInt(d['현재대운기']) || 0;

  const healthDanger = parseHealthGi(d['건강위험대운목록'] || '');
  const 초년힘든 = d['초년힘든대운목록'] || '';

  const list = parseDaeunList(d['대운목록_10기'] || '');

  // 운기 분포 집계
  const dist = { 용신:0, 희신:0, 기신:0, 중립:0 };
  list.forEach(u => { const k = charLabel(u.char); if (dist[k] !== undefined) dist[k]++; });

  // 컴팩트 카드 HTML (2행 5열 그리드용)
  function renderCard(u) {
    const isCur = u.num === curGi;
    const cs = charStyle(u.char);
    const jcs = charStyle(u.jeonChar);
    const hcs = charStyle(u.hubanChar);
    const isHealth = healthDanger.has(u.num);

    return `<div class="dw-card${isCur?' cur':''}${isHealth?' health-warn':''}" style="border-color:${isCur?cs.border:'#ddd'};background:${cs.light};">
  <div class="dw-top" style="background:${cs.bg};border-bottom:1px solid ${cs.border}22;">
    <span class="dw-num" style="color:${cs.text};">${u.num}기</span>
    <span class="dw-gangi">${esc(u.gangi)}</span>
    ${isCur?`<span class="cur-badge">▶현재</span>`:''}
  </div>
  <div class="dw-body">
    <div class="dw-age">${esc(u.age)}</div>
    <div class="dw-year">${esc(u.year)}</div>
    <div class="dw-badges">
      <span class="dw-char-badge" style="color:${cs.text};background:${cs.bg};border:1px solid ${cs.border};">${esc(u.char)}</span>
      ${isHealth?`<span class="health-badge">🏥</span>`:''}
    </div>
    ${u.un12?`<div class="dw-un12">12운 <b>${esc(u.un12)}</b></div>`:''}
    <div class="dw-halves">
      ${u.jeonChar?`<span class="half-badge" style="color:${jcs.text};background:${jcs.bg};border:1px solid ${jcs.border}33;">전${esc(u.jeonChar)}</span>`:''}
      ${u.hubanChar?`<span class="half-badge" style="color:${hcs.text};background:${hcs.bg};border:1px solid ${hcs.border}33;">후${esc(u.hubanChar)}</span>`:''}
    </div>
    <div class="dw-ss">
      ${u.tgSsVal?`<span class="ss-badge">天${esc(u.tgSsVal)}</span>`:''}
      ${u.jjSsVal?`<span class="ss-badge">地${esc(u.jjSsVal)}</span>`:''}
    </div>
    ${u.hap?`<div class="dw-hap">⚡${esc(u.hap)}</div>`:''}
  </div>
</div>`;
  }

  const cardsHTML = list.map(renderCard).join('\n');

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>대운타임라인 》 ${esc(name)}님</title>
  <style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; max-height:840px; overflow:hidden; padding:5px 6px; background:transparent; display:flex; flex-direction:column; gap:3px; }
@media screen { body{background:#f5f5f5;} .page{ border:1px solid #333;margin:20px auto;border-radius:4px;} }
@media print { body{background:transparent;margin:0;padding:0;}
  .page{ border:1px solid #333;margin:0;width:604px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @page{size:604px 840px;margin:0;} }

/* 헤더 */
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-radius:6px;}
.banner-hdr-title{font-size:9pt;font-weight:900;color:white;}
.banner-hdr-name{font-size:9pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:7pt;color:rgba(255,255,255,.75);text-align:right;margin-top:1px;}

/* 운기 분포 + 범례 인라인 */
.dist-legend{display:flex;align-items:center;gap:3px;padding:2px 0;flex-wrap:wrap;}
.dist-item{border-radius:4px;padding:2px 5px;text-align:center;border:1px solid;flex:1;}
.dist-num{font-size:7pt;font-weight:900;line-height:1;}
.dist-lbl{font-size:6.5pt;font-weight:700;margin-top:0px;}
.legend-inline{display:flex;gap:6px;margin-left:4px;font-size:6.5pt;color:#777;align-items:center;}
.legend-inline span{display:flex;align-items:center;gap:1px;}

/* 2행 5열 그리드 */
.dw-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;flex:1;}

/* 대운 카드 (컴팩트) */
.dw-card{border:1px solid #333;border-radius:4px;overflow:hidden;display:flex;flex-direction:column;}
.dw-card.cur{border-width:2px;}
.dw-top{display:flex;align-items:center;gap:2px;padding:2px 4px;}
.dw-num{font-size:6pt;font-weight:900;line-height:1;}
.dw-gangi{font-size:6pt;font-weight:900;color:#222;white-space:nowrap;}
.cur-badge{font-size:6pt;font-weight:700;color:#e65100;background:#fff3e0;border:1px solid #ffcc80;padding:0px 2px;border-radius:2px;margin-left:auto;}
.dw-body{padding:2px 4px 3px;display:flex;flex-direction:column;gap:1px;background:transparent;flex:1;}
.dw-age{font-size:7pt;color:#555;}
.dw-year{font-size:6.5pt;color:#999;}
.dw-badges{display:flex;align-items:center;gap:2px;flex-wrap:wrap;}
.dw-char-badge{font-size:6.5pt;font-weight:700;padding:0px 3px;border-radius:2px;}
.health-badge{font-size:7pt;line-height:1;}
.dw-un12{font-size:6.5pt;color:#777;}
.dw-un12 b{color:#333;font-weight:800;}
.dw-halves{display:flex;gap:2px;flex-wrap:wrap;}
.half-badge{font-size:6pt;font-weight:700;padding:0px 3px;border-radius:2px;}
.dw-ss{display:flex;gap:2px;flex-wrap:wrap;}
.ss-badge{font-size:6pt;color:#555;background:#f5f5f5;border:1px solid #333;padding:0px 2px;border-radius:2px;}
.dw-hap{font-size:6pt;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  </style>
</head>
<body>
<div class="page">

  <!-- 헤더 -->
  <div class="banner-hdr" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
  <div>
    <div class="banner-hdr-title">📅 대운(大運) 흐름 타임라인</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${curDW?' · 대운 '+esc(curDW):''}</div>
  </div>
</div>

  <!-- 운기 분포 + 범례 인라인 -->
  <div class="dist-legend">
    <div class="dist-item" style="border-color:#2e7d32;background:#f1fbf4;">
      <div class="dist-num" style="color:#2e7d32;">${dist.용신}</div>
      <div class="dist-lbl" style="color:#2e7d32;">용신</div>
    </div>
    <div class="dist-item" style="border-color:#1565c0;background:#f0f7ff;">
      <div class="dist-num" style="color:#1565c0;">${dist.희신}</div>
      <div class="dist-lbl" style="color:#1565c0;">희신</div>
    </div>
    <div class="dist-item" style="border-color:#c62828;background:#fff5f5;">
      <div class="dist-num" style="color:#c62828;">${dist.기신}</div>
      <div class="dist-lbl" style="color:#c62828;">기신</div>
    </div>
    <div class="dist-item" style="border-color:#757575;background:#fafafa;">
      <div class="dist-num" style="color:#555;">${dist.중립}</div>
      <div class="dist-lbl" style="color:#777;">중립</div>
    </div>
    <div class="dist-item" style="border-color:#b71c1c44;background:#fff9f9;">
      <div class="dist-num" style="color:#b71c1c;font-size:8pt;">🏥${healthDanger.size}</div>
      <div class="dist-lbl" style="color:#b71c1c;">건강주의</div>
    </div>
    <div class="legend-inline">
      <span>天 천간십성</span>
      <span>地 지지십성</span>
      <span>⚡ 합충</span>
    </div>
  </div>

  <!-- 대운 카드 2행 5열 그리드 -->
  <div class="dw-grid">
    ${cardsHTML}
  </div>

</div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '대운타임라인.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '대운타임라인');
  console.log(`✅ 대운타임라인 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_대운타임라인.js <slot_id>'); process.exit(1); }
generate(slotId);
