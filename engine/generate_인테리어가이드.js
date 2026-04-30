#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const OH = {
  wood:  { hanja:'木', kr:'목', c:'#4caf50', color:'그린·에메랄드', dir:'동(東)', season:'봄(2~4월)', material:'원목·대나무·리넨·면', plant:'고무나무·몬스테라·아이비', scent:'시더우드·유칼립투스', health:'간·담·근육·눈', emoji:'🌿' },
  fire:  { hanja:'火', kr:'화', c:'#f44336', color:'레드·코랄·오렌지', dir:'남(南)', season:'여름(5~7월)', material:'가죽·울·실크·캔들', plant:'장미·안시리움·포인세티아', scent:'시나몬·바닐라·로즈마리', health:'심장·혈관·혈압', emoji:'🔥' },
  earth: { hanja:'土', kr:'토', c:'#ff9800', color:'베이지·황토·테라코타', dir:'중앙', season:'환절기', material:'도자기·석재·타일·점토', plant:'다육이·선인장·허브가든', scent:'산달우드·파출리·베티버', health:'위장·비장·소화기', emoji:'🏔️' },
  metal: { hanja:'金', kr:'금', c:'#757575', color:'화이트·실버·골드', dir:'서(西)', season:'가을(8~10월)', material:'스테인리스·황동·크리스탈', plant:'백합·치자·국화', scent:'페퍼민트·티트리', health:'폐·대장·피부', emoji:'⚪' },
  water: { hanja:'水', kr:'수', c:'#2196f3', color:'네이비·차콜·딥블루', dir:'북(北)', season:'겨울(11~1월)', material:'유리·거울·아크릴·수반', plant:'수경재배·수련·이끼', scent:'라벤더·캐모마일', health:'신장·방광·뼈·귀', emoji:'💧' },
};

function ohKey(v) {
  if (!v) return null;
  const m = { wood:'wood',木:'wood',목:'wood', fire:'fire',火:'fire',화:'fire', earth:'earth',土:'earth',토:'earth', metal:'metal',金:'metal',금:'metal', water:'water',水:'water',수:'water' };
  if (m[v]) return m[v];
  return m[String(v).charAt(0)] || null;
}

function generate(slotId) {
  const ch08Path = path.join(QUEUE_DIR, `${slotId}_ch08.json`);
  const ch06Path = path.join(QUEUE_DIR, `${slotId}_ch06.json`);
  const ch01Path = path.join(QUEUE_DIR, `${slotId}_ch01.json`);
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);

  const c8 = fs.existsSync(ch08Path) ? JSON.parse(fs.readFileSync(ch08Path,'utf-8')) : {};
  const c6 = fs.existsSync(ch06Path) ? JSON.parse(fs.readFileSync(ch06Path,'utf-8')) : {};
  const c1 = fs.existsSync(ch01Path) ? JSON.parse(fs.readFileSync(ch01Path,'utf-8')) : {};
  const c3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path,'utf-8')) : {};
  const M  = fs.existsSync(masterPath) ? JSON.parse(fs.readFileSync(masterPath,'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, c3, c6, c8, c1); } catch(e){}

  const name = c3['이름'] || c8['이름'] || M['이름'] || slotId;
  const ilju = c3['일주'] || c1['일주'] || '';

  const yongK = ohKey(c8['용신오행']||c6['용신오행']||c1['용신오행']||'') || 'fire';
  const huiK  = ohKey(c8['희신오행']||c6['희신오행']||c1['희신오행']||'') || 'wood';
  const gisinK = ohKey(c8['기신오행']||c6['기신오행']||'') || 'water';

  const y = OH[yongK];
  const h = OH[huiK];
  const g = OH[gisinK];

  // 방별 배치 데이터
  const rooms = [
    { name:'거실', icon:'🛋️', tip:`메인 컬러 ${y.color}`, sub:`소파 방향 ${y.dir}`, material:y.material.split('·')[0] },
    { name:'침실', icon:'🛏️', tip:`침구 ${h.color}`, sub:`머리 방향 ${y.dir}`, material:h.material.split('·')[0] },
    { name:'서재', icon:'📚', tip:`책상 위치 ${y.dir}`, sub:`조명 용신 톤`, material:y.material.split('·')[0] },
    { name:'현관', icon:'🚪', tip:`매트 ${y.color}`, sub:`디퓨저 용신 향`, material:`${y.scent.split('·')[0]}` },
    { name:'주방', icon:'🍳', tip:`식기 ${y.color}`, sub:`도마·수저 용신`, material:y.material.split('·')[1]||y.material.split('·')[0] },
  ];

  const CSS = `<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;max-height:840px;padding:10px 14px;background:transparent;display:flex;flex-direction:column;gap:8px;overflow:hidden;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{background:transparent;margin:0;padding:0;}.page{margin:0;width:604px;}@page{ border:1px solid #333;size:604px 840px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:9px 16px;border-radius:10px;}
.banner-hdr-title{font-size:12pt;font-weight:900;color:white;}
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card{border:2px solid #333;border-radius:10px;overflow:hidden;}
.card-hd{padding:7px 14px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:9pt;font-weight:900;color:white;}
.card-hd-sub{font-size:7pt;color:rgba(255,255,255,.85);}
/* 오행 가이드 테이블 */
.oh-tbl{width:100%;border-collapse:collapse;}
.oh-tbl th{font-size:7pt;font-weight:700;color:#555;padding:6px 6px;background:#f8f8f8;border-bottom:2px solid #ddd;text-align:center;white-space:nowrap;}
.oh-tbl td{font-size:7pt;padding:6px 6px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;}
.oh-tbl tr:last-child td{border-bottom:none;}
.oh-badge{display:inline-block;padding:2px 8px;border-radius:5px;color:white;font-size:6.5pt;font-weight:700;}
.oh-name{font-size:10pt;font-weight:900;}
/* 방별 배치 */
.room-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0;}
.room-cell{padding:8px 6px;border-right:1px solid #eee;text-align:center;display:flex;flex-direction:column;gap:3px;}
.room-cell:last-child{border-right:none;}
.room-icon{font-size:16pt;}
.room-name{font-size:8pt;font-weight:700;color:#333;}
.room-tip{font-size:7pt;color:#555;line-height:1.5;}
.room-mat{font-size:6.5pt;color:#999;font-style:italic;}
/* 체크리스트 */
.check-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;}
.check-col{padding:8px 10px;border-right:1px solid #eee;}
.check-col:last-child{border-right:none;}
.check-title{font-size:8pt;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:4px;}
.check-item{font-size:7pt;color:#555;line-height:1.8;padding-left:10px;text-indent:-10px;}
.check-item::before{content:'□ ';color:#aaa;}
/* 예산 */
.budget-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid #eee;}
.budget-cell{padding:6px 8px;border-right:1px solid #eee;text-align:center;}
.budget-cell:last-child{border-right:none;}
.budget-label{font-size:7pt;font-weight:700;color:#c9a227;}
.budget-items{font-size:6.5pt;color:#555;line-height:1.6;}
</style>`;

  // 오행 가이드 행 (용신/희신/기신 3행)
  function ohRow(label, role, oh, k, roleBg) {
    return `<tr>
  <td><span class="oh-badge" style="background:${roleBg};">${role}</span></td>
  <td><span class="oh-name" style="color:${oh.c};">${oh.emoji} ${oh.hanja}(${oh.kr})</span></td>
  <td style="font-weight:700;">${oh.color}</td>
  <td>${oh.dir}</td>
  <td>${oh.season}</td>
  <td style="text-align:left;">${oh.material}</td>
  <td style="text-align:left;">${oh.plant}</td>
  <td style="text-align:left;">${oh.scent}</td>
  <td>${oh.health}</td>
</tr>`;
  }

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>사주 인테리어 가이드 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#5d4037,#795548);">
  <div>
    <div class="banner-hdr-title">🏠 사주 인테리어 가이드</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">${esc(ilju)} · 용신 ${y.hanja}(${y.kr})</div>
  </div>
</div>

<!-- ① 오행별 인테리어 가이드 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#4e342e,#6d4c41);">
    <div class="card-hd-title">① 오행별 인테리어 가이드</div>
    <div class="card-hd-sub">용신·희신·기신별 색상·소재·방위·식물·향·건강</div>
  </div>
  <table class="oh-tbl">
    <thead><tr>
      <th>분류</th><th>오행</th><th>추천 색상</th><th>방위</th><th>계절</th><th>소재·가구</th><th>식물</th><th>향</th><th>건강 연관</th>
    </tr></thead>
    <tbody>
      ${ohRow('용신','★ 용신',y,yongK,y.c)}
      ${ohRow('희신','○ 희신',h,huiK,'#1565c0')}
      ${ohRow('기신','✕ 기신',g,gisinK,'#c62828')}
    </tbody>
  </table>
</div>

<!-- ② 방별 배치 요약 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1565c0,#1976d2);">
    <div class="card-hd-title">② 방별 배치 요약</div>
    <div class="card-hd-sub">거실·침실·서재·현관·주방 핵심 포인트</div>
  </div>
  <div class="room-grid">
    ${rooms.map(r => `<div class="room-cell">
      <div class="room-icon">${r.icon}</div>
      <div class="room-name">${r.name}</div>
      <div class="room-tip">${r.tip}</div>
      <div class="room-tip">${r.sub}</div>
      <div class="room-mat">${r.material}</div>
    </div>`).join('')}
  </div>
</div>

<!-- ③ 종합 처방전 체크리스트 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#2e7d32,#388e3c);">
    <div class="card-hd-title">③ 종합 처방전 체크리스트</div>
    <div class="card-hd-sub">용신 강화 · 희신 보조 · 기신 줄이기</div>
  </div>
  <div class="check-grid">
    <div class="check-col">
      <div class="check-title" style="color:${y.c};">★ 용신 ${y.hanja}(${y.kr}) 강화</div>
      <div class="check-item">거실 메인 컬러 ${y.color}</div>
      <div class="check-item">서재·작업실 ${y.dir} 배치</div>
      <div class="check-item">용신 소재 소품 3개 이상</div>
      <div class="check-item">매일 쓰는 물건 용신 소재</div>
      <div class="check-item">${y.plant.split('·')[0]} 배치</div>
    </div>
    <div class="check-col">
      <div class="check-title" style="color:#1565c0;">○ 희신 ${h.hanja}(${h.kr}) 보조</div>
      <div class="check-item">침실 침구 ${h.color}</div>
      <div class="check-item">용신 공간 근처 희신 소품</div>
      <div class="check-item">휴식 공간 ${h.material.split('·')[0]}</div>
      <div class="check-item">${h.scent.split('·')[0]} 디퓨저</div>
    </div>
    <div class="check-col">
      <div class="check-title" style="color:#c62828;">✕ 기신 ${g.hanja}(${g.kr}) 줄이기</div>
      <div class="check-item">${g.color} 메인 컬러 아닌지</div>
      <div class="check-item">${g.dir} 중요 공간 집중 피하기</div>
      <div class="check-item">${g.material.split('·')[0]} 소품 과다 아닌지</div>
      <div class="check-item">${g.season} 인테리어 보강</div>
    </div>
  </div>
  <div class="budget-grid">
    <div class="budget-cell">
      <div class="budget-label">5만원 이하</div>
      <div class="budget-items">쿠션 2개<br>현관 매트<br>디퓨저 1개</div>
    </div>
    <div class="budget-cell">
      <div class="budget-label">10~30만원</div>
      <div class="budget-items">커튼 교체<br>러그 교체<br>식물 1~2개</div>
    </div>
    <div class="budget-cell">
      <div class="budget-label">50~100만원</div>
      <div class="budget-items">포인트 벽면<br>가구 1개 교체<br>조명 시스템</div>
    </div>
    <div class="budget-cell">
      <div class="budget-label">100만원+</div>
      <div class="budget-items">전체 리뉴얼<br>가구 소재 교체<br>바닥재 변경</div>
    </div>
  </div>
</div>

<div style="font-size:7pt;color:#999;text-align:center;margin-top:6px;">
  용신 ${y.hanja}(${y.kr}) 강화 · 희신 ${h.hanja}(${h.kr}) 보조 · 기신 ${g.hanja}(${g.kr}) 줄이기 》 이 세 원칙이 사주 인테리어의 전부입니다.
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '인테리어가이드.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '인테리어가이드');
  console.log(`✅ 인테리어가이드 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_인테리어가이드.js <slot_id>'); process.exit(1); }
generate(slotId);
