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
  const name    = d3['이름']        || d6['이름']        || slotId;
  const birthS  = d3['birth_solar'] || d3['생년월일']    || '';
  const gender  = d3['user_gender'] || d3['성별']        || '';
  const age     = d3['user_age']    || d3['나이']        || d6['만나이'] || '';
  const ilju    = d3['일주']        || d6['일주']        || '';
  const curDW   = d6['현재대운간지'] || '';
  const seunGJ  = d6['세운간지']    || '';
  const shingang = d6['신강약']     || d6['신강약단']    || '';

  // ── 오행 점수 ──────────────────────────────────────────
  const SCORES = {
    wood:  parseFloat(d4['목점수']  || d6['목점수'] || 0),
    fire:  parseFloat(d4['화점수']  || d6['화점수'] || 0),
    earth: parseFloat(d4['토점수']  || d6['토점수'] || 0),
    metal: parseFloat(d4['금점수']  || d6['금점수'] || 0),
    water: parseFloat(d4['수점수']  || d6['수점수'] || 0),
  };
  const TOTAL = Object.values(SCORES).reduce((a,b)=>a+b,0) || 1;

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
    const map = {'木':'wood','火':'fire','土':'earth','金':'metal','水':'water'};
    const m = str.match(/木|火|土|金|水/);
    return m ? (map[m[0]] || null) : null;
  }
  const YONG   = extractKey(d6['용신오행']) || extractKey(d4['용신오행']);
  const HUI    = extractKey(d6['희신오행']) || extractKey(d4['희신오행']);
  const BYEONG = extractKey(d6['기신오행']) || extractKey(d4['기신오행']);

  // ── 오행 메타 ──────────────────────────────────────────
  const META = {
    wood:  { hanja:'木', kr:'목', color:'#2e7d32', bg:'#e8f5e9', bar:'#4caf50',
             sangseang:'火', sanggeuk:'土', pi:'金', suhwa:'水',
             desc:'성장·창조·교육', dir:'東(동)', season:'봄', colorHint:'청색·녹색' },
    fire:  { hanja:'火', kr:'화', color:'#c62828', bg:'#ffebee', bar:'#f44336',
             sangseang:'土', sanggeuk:'金', pi:'水', suhwa:'木',
             desc:'열정·표현·명예', dir:'南(남)', season:'여름', colorHint:'적색·주황' },
    earth: { hanja:'土', kr:'토', color:'#e65100', bg:'#fff3e0', bar:'#ff9800',
             sangseang:'金', sanggeuk:'水', pi:'木', suhwa:'火',
             desc:'안정·중재·신뢰', dir:'中央', season:'환절기', colorHint:'황색·갈색' },
    metal: { hanja:'金', kr:'금', color:'#37474f', bg:'#eceff1', bar:'#9e9e9e',
             sangseang:'水', sanggeuk:'木', pi:'火', suhwa:'土',
             desc:'결단·집중·완성', dir:'西(서)', season:'가을', colorHint:'흰색·금색' },
    water: { hanja:'水', kr:'수', color:'#0d47a1', bg:'#e3f2fd', bar:'#2196f3',
             sangseang:'木', sanggeuk:'火', pi:'土', suhwa:'金',
             desc:'지혜·흐름·적응', dir:'北(북)', season:'겨울', colorHint:'검정·청색' },
  };

  // ── SVG 오행 배치도 (소형 230×230) ─────────────────────
  // 5각형 꼭짓점: 중심(110,105), 반지름 70 》 원(r=22) 경계 내 보장
  const POS = {
    wood:  { x:110, y:35 },   // 상단
    fire:  { x:179, y:83 },   // 우상
    earth: { x:153, y:163 },  // 우하
    metal: { x:67,  y:163 },  // 좌하
    water: { x:41,  y:83 },   // 좌상
  };

  // 상생 화살표 (목→화→토→금→수→목)
  const SANGSEANG_PAIRS = [
    ['wood','fire'],['fire','earth'],['earth','metal'],['metal','water'],['water','wood']
  ];
  // 상극 (목극토, 화극금, 토극수, 금극목, 수극화)
  const SANGGEUK_PAIRS = [
    ['wood','earth'],['fire','metal'],['earth','water'],['metal','wood'],['water','fire']
  ];

  function arrowLine(from, to, color, dash) {
    const f = POS[from], t = POS[to];
    const dx = t.x - f.x, dy = t.y - f.y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const r = 22;
    const sx = f.x + dx/len*r, sy = f.y + dy/len*r;
    const ex = t.x - dx/len*r, ey = t.y - dy/len*r;
    return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
      stroke="${color}" stroke-width="1.5" ${dash?'stroke-dasharray="4,3"':''} opacity="0.7"
      marker-end="url(#arr${color.replace('#','')})"/>`;
  }

  const arrowDefs = ['#2e7d32','#c62828'].map(c =>
    `<marker id="arr${c.replace('#','')}" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
      <polygon points="0 0, 6 2, 0 4" fill="${c}" opacity="0.7"/>
    </marker>`
  ).join('\n');

  const sangseangLines = SANGSEANG_PAIRS.map(([a,b]) => arrowLine(a,b,'#2e7d32',true)).join('\n');
  const sanggeukLines  = SANGGEUK_PAIRS.map(([a,b]) => arrowLine(a,b,'#c62828',false)).join('\n');

  const circles = Object.entries(POS).map(([oh, pos]) => {
    const m = META[oh];
    const role = oh===YONG?'용신':oh===HUI?'희신':oh===BYEONG?'기신':'';
    const ringColor = oh===YONG?'#c9a227':oh===HUI?'#1565c0':oh===BYEONG?'#c62828':'';
    const ringWidth = role ? 2.5 : 0;
    return `<circle cx="${pos.x}" cy="${pos.y}" r="22" fill="${m.bg}" stroke="${m.color}" stroke-width="2"/>
${ringColor?`<circle cx="${pos.x}" cy="${pos.y}" r="25.5" fill="none" stroke="${ringColor}" stroke-width="${ringWidth}" stroke-dasharray="4,2" opacity="0.9"/>`:''}
<text x="${pos.x}" y="${pos.y+7}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="bold" fill="${m.color}" font-family="'Noto Serif KR',serif">${m.hanja}</text>
<text x="${pos.x}" y="${pos.y+30}" text-anchor="middle" font-size="6.5" fill="#777">${SCORES[oh].toFixed(1)}pt</text>
${role?`<rect x="${pos.x-13}" y="${pos.y+37}" width="26" height="11" rx="3" fill="${ringColor}" opacity="0.9"/>
<text x="${pos.x}" y="${pos.y+44}" text-anchor="middle" dominant-baseline="middle" font-size="6.5" fill="white" font-weight="bold">${role}</text>`:''}`;
  }).join('\n');

  const svgHtml = `<svg width="230" height="230" viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg">
  <defs>${arrowDefs}</defs>
  ${sangseangLines}
  ${sanggeukLines}
  ${circles}
</svg>`;

  // ── 생극 관계표 (내 용신/희신/기신 관점) ──────────────────
  const ohOrder = ['wood','fire','earth','metal','water'];

  // 상생·상극 관계 로직
  const SANGSEANG_MAP = { wood:'fire', fire:'earth', earth:'metal', metal:'water', water:'wood' };
  const SANGGEUK_MAP  = { wood:'earth', fire:'metal', earth:'water', metal:'wood', water:'fire' };
  const PIWO_MAP      = { fire:'wood', earth:'fire', metal:'earth', water:'metal', wood:'water' }; // 나를 생해주는
  const GEUKNAE_MAP   = { earth:'wood', metal:'fire', water:'earth', wood:'metal', fire:'water' }; // 내가 극함 → 상극과 같음

  function relLabel(oh) {
    const m = META[oh];
    if (!m) return '—';
    return `${m.hanja}(${m.kr})`;
  }

  const relRows = ohOrder.map(oh => {
    const m = META[oh];
    const role = oh===YONG?'<span class="role-y">용신</span>':oh===HUI?'<span class="role-h">희신</span>':oh===BYEONG?'<span class="role-b">기신</span>':'';
    const sangS  = META[SANGSEANG_MAP[oh]];
    const sangG  = META[SANGGEUK_MAP[oh]];
    const piwo   = META[PIWO_MAP[oh]];
    const geukBy = META[Object.keys(SANGGEUK_MAP).find(k => SANGGEUK_MAP[k]===oh) || ''];
    return `<tr>
  <td style="background:${m.bg};"><span style="color:${m.color};font-size:10pt;font-weight:900;">${m.hanja}</span> ${m.kr} ${role}</td>
  <td>${SCORES[oh].toFixed(2)} <small style="color:#aaa;">${((SCORES[oh]/TOTAL)*100).toFixed(0)}%</small></td>
  <td style="color:#888;">${esc(GRADES[oh])}</td>
  <td style="color:#2e7d32;">→ <strong>${sangS?sangS.hanja:'—'}</strong></td>
  <td style="color:#2e7d32;"><strong>${piwo?piwo.hanja:'—'}</strong> →</td>
  <td style="color:#c62828;">→ <strong>${sangG?sangG.hanja:'—'}</strong></td>
  <td style="color:#c62828;"><strong>${geukBy?geukBy.hanja:'—'}</strong> →</td>
</tr>`;
  }).join('\n');

  // ── CSS ───────────────────────────────────────────────
  const CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; padding:18px 22px; background:transparent; display:flex; flex-direction:column; gap:8px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 820px; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:2px solid #333; border-radius:10px; overflow:hidden; flex-shrink:0; }
.card-hd { padding:7px 14px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:9pt; font-weight:900; color:white; }
.card-hd-sub   { font-size:6.5pt; color:rgba(255,255,255,.85); }
/* 2-col 레이아웃 */
.two-col { display:flex; gap:0; background:transparent; }
.col-svg { flex:0 0 240px; display:flex; align-items:center; justify-content:center; padding:12px; border-right:1px solid #eee; }
.col-legend { flex:1; padding:10px 12px; display:flex; flex-direction:column; gap:8px; }
.legend-row { display:flex; align-items:center; gap:6px; font-size:7pt; color:#555; }
.legend-line { width:22px; height:2px; flex-shrink:0; }
.role-y  { background:#2e7d32; color:white; padding:1px 5px; border-radius:3px; font-size:7pt; }
.role-h  { background:#1565c0; color:white; padding:1px 5px; border-radius:3px; font-size:7pt; }
.role-b  { background:#c62828; color:white; padding:1px 5px; border-radius:3px; font-size:7pt; }
/* 생극 관계표 */
table { width:100%; border-collapse:collapse; }
th { background:#f5f5f5; font-size:6.5pt; font-weight:700; color:#555; padding:5px 6px; border-bottom:2px solid #ddd; text-align:center; }
td { font-size:7pt; padding:5px 6px; border-bottom:1px solid #f0f0f0; vertical-align:middle; text-align:center; }
tr:last-child td { border-bottom:none; }
/* 용신 박스 */
.yong-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0; background:transparent; }
.yong-cell { padding:8px 10px; border-right:1px solid #eee; }
.yong-cell:last-child { border-right:none; }
.yong-lbl  { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:3px; }
.yong-oh   { font-size:12pt; font-weight:900; }
.yong-attr { font-size:6pt; color:#666; line-height:1.6; margin-top:2px; }
</style>`;

  // ── HTML 조립 ─────────────────────────────────────────
  const yongMeta   = META[YONG   || 'wood'];
  const huiMeta    = META[HUI    || 'water'];
  const byeongMeta = META[BYEONG || 'metal'];

  const H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>오행 생극 관계도 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#e65100,#f57c00);">
  <div>
    <div class="banner-hdr-title">🔄 오행(五行) 생극(生剋) 관계도</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${shingang?' · '+esc(shingang):''}</div>
  </div>
</div>

<!-- ① 생극 다이어그램 + 용신 요약 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1565c0,#0d47a1);">
    <div class="card-hd-title">① 오행 생극(生剋) 배치도</div>
    <div class="card-hd-sub">상생(점선 녹색) · 상극(실선 적색) / 금테두리=용신 청테두리=희신</div>
  </div>
  <div class="two-col">
    <div class="col-svg">${svgHtml}</div>
    <div class="col-legend">
      <div style="font-size:7.5pt;font-weight:700;color:#333;margin-bottom:4px;">범례</div>
      <div class="legend-row"><div class="legend-line" style="border-top:2px dashed #2e7d32;"></div><span>상생(生) 》 생해주는 관계</span></div>
      <div class="legend-row"><div class="legend-line" style="border-top:2px solid #c62828;"></div><span>상극(剋) 》 제어·억제 관계</span></div>
      <div class="legend-row"><div class="legend-line" style="border-top:2px dashed #ffd700;"></div><span>금테두리 》 용신 오행</span></div>
      <div class="legend-row"><div class="legend-line" style="border-top:2px dashed #42a5f5;"></div><span>청테두리 》 희신 오행</span></div>
      <div style="margin-top:8px;font-size:7pt;color:#555;font-weight:700;">상생 순서</div>
      <div style="font-size:6.5pt;color:#2e7d32;line-height:1.8;">木→火→土→金→水→木</div>
      <div style="font-size:7pt;color:#555;font-weight:700;margin-top:4px;">상극 순서</div>
      <div style="font-size:6.5pt;color:#c62828;line-height:1.8;">木克土 · 火克金 · 土克水 · 金克木 · 水克火</div>
    </div>
  </div>
  <!-- 용신·희신·기신 박스 -->
  <div class="yong-grid">
    <div class="yong-cell" style="background:${yongMeta.bg};">
      <div class="yong-lbl">用神 (용신)</div>
      <div class="yong-oh" style="color:${yongMeta.color};">${yongMeta.hanja}(${yongMeta.kr})</div>
      <div class="yong-attr">방위: ${yongMeta.dir}<br>색상: ${yongMeta.colorHint}<br>계절: ${yongMeta.season}</div>
    </div>
    <div class="yong-cell" style="background:${huiMeta.bg};">
      <div class="yong-lbl">喜神 (희신)</div>
      <div class="yong-oh" style="color:${huiMeta.color};">${huiMeta.hanja}(${huiMeta.kr})</div>
      <div class="yong-attr">방위: ${huiMeta.dir}<br>색상: ${huiMeta.colorHint}<br>계절: ${huiMeta.season}</div>
    </div>
    <div class="yong-cell" style="background:${byeongMeta.bg};">
      <div class="yong-lbl">忌神 (기신)</div>
      <div class="yong-oh" style="color:${byeongMeta.color};">${byeongMeta.hanja}(${byeongMeta.kr})</div>
      <div class="yong-attr">방위: ${byeongMeta.dir}<br>색상: ${byeongMeta.colorHint}<br>계절: ${byeongMeta.season}</div>
    </div>
  </div>
</div>

<!-- ② 생극 관계 상세표 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
    <div class="card-hd-title">② 오행별 생극 관계 상세표</div>
    <div class="card-hd-sub">각 오행의 점수·등급 및 상생·상극 관계 일람</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>오행</th><th>점수·비율</th><th>등급</th>
        <th>내가 생함(→)</th><th>나를 생함(→)</th>
        <th>내가 극함(→)</th><th>나를 극함(→)</th>
      </tr>
    </thead>
    <tbody>${relRows}</tbody>
  </table>
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive:true });
  const outFile = path.join(outDir, '오행생극도.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ 오행생극도 생성: ${outFile}  (${Buffer.byteLength(H,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_오행생극도.js <slot_id>'); process.exit(1); }
generate(slotId);
