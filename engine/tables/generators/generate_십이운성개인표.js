#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');
const { 전체사주계산 } = require('./saju_calc');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const KR = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계',子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const TG_COLOR = {甲:'#4caf50',乙:'#4caf50',丙:'#f44336',丁:'#f44336',戊:'#ff9800',己:'#ff9800',庚:'#9e9e9e',辛:'#9e9e9e',壬:'#2196f3',癸:'#2196f3'};
const JJ_COLOR = {子:'#2196f3',丑:'#ff9800',寅:'#4caf50',卯:'#4caf50',辰:'#ff9800',巳:'#f44336',午:'#f44336',未:'#ff9800',申:'#9e9e9e',酉:'#9e9e9e',戌:'#ff9800',亥:'#2196f3'};

const UN12_META = {
  장생: { grade:'길', color:'#2e7d32', bg:'#e8f5e9', desc:'생명 시작 》 희망·열정·새 시작' },
  목욕: { grade:'변화', color:'#e65100', bg:'#fff3e0', desc:'감수성·매력 》 감정 기복·이성운' },
  관대: { grade:'길', color:'#1565c0', bg:'#e3f2fd', desc:'사회 진출 》 포부·발전·확장' },
  건록: { grade:'길', color:'#2e7d32', bg:'#e8f5e9', desc:'실력 전성기 》 독립·능력 인정' },
  제왕: { grade:'길', color:'#4a148c', bg:'#f3e5f5', desc:'절정 권위 》 강한 자아·리더십' },
  쇠:   { grade:'중', color:'#37474f', bg:'#eceff1', desc:'성숙 여유 》 내실·안정·지혜' },
  병:   { grade:'주의', color:'#c62828', bg:'#ffebee', desc:'감성 풍부 》 돌봄·예술·배려' },
  사:   { grade:'변화', color:'#e65100', bg:'#fff3e0', desc:'전환 기운 》 통찰·변화·재생' },
  묘:   { grade:'중', color:'#37474f', bg:'#eceff1', desc:'저장 잠재 》 신중·기억력·보수' },
  절:   { grade:'주의', color:'#c62828', bg:'#ffebee', desc:'단절 재출발 》 독립·강인·급변' },
  태:   { grade:'중', color:'#37474f', bg:'#eceff1', desc:'잠재 가능성 》 유연·적응·발전' },
  양:   { grade:'길', color:'#2e7d32', bg:'#e8f5e9', desc:'양육 보호 》 의지·안정·타인 도움' },
};

function generate(slotId) {
  let masterPath = path.join(slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) { console.log('⚠️ 십이운성: master.json 없음 (스킵)'); return; }
  const M = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));

  const r = 전체사주계산({
    이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
    년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시, 성별: M.성별 ?? '남',
    활동상태: M.활동상태,
  });

  const w = r.원국;
  const un = r.십이운성 || {};
  const name = M.이름 || slotId;
  const ilju = `${w.일주.천간}${w.일주.지지}(${KR[w.일주.천간]}${KR[w.일주.지지]})`;

  // ① 4기둥 12운성 (가로 4열)
  const pillars = [
    { label:'년주', tg:w.년주.천간, jj:w.년주.지지, un12:un.년지 },
    { label:'월주', tg:w.월주.천간, jj:w.월주.지지, un12:un.월지 },
    { label:'일주', tg:w.일주.천간, jj:w.일주.지지, un12:un.일지, isIlju:true },
    { label:'시주', tg:w.시주.천간, jj:w.시주.지지, un12:un.시지 },
  ];

  const pillarHTML = pillars.map(p => {
    const m = UN12_META[p.un12] || { grade:'—', color:'#888', bg:'#f5f5f5', desc:'' };
    const border = p.isIlju ? 'border:2px solid #c62828;' : 'border:1px solid #333;';
    return `<div class="un-col" style="${border}background:${m.bg};">
  <div class="un-label">${p.label}${p.isIlju?' ★':''}</div>
  <div class="un-ganji">
    <span style="color:${TG_COLOR[p.tg]||'#333'};">${p.tg}</span><span style="color:${JJ_COLOR[p.jj]||'#333'};">${p.jj}</span>
    <span class="un-kr">${KR[p.tg]}${KR[p.jj]}</span>
  </div>
  <div class="un-badge" style="background:${m.color};">${esc(p.un12||'—')}</div>
  <div class="un-grade">${m.grade}</div>
  <div class="un-desc">${m.desc}</div>
</div>`;
  }).join('');

  // ② 대운별 12운성
  const dwList = (r.대운목록 || []).slice(0, 10);
  const curGi = r.현재대운?.기 ?? -1;
  const dwHTML = dwList.map((d, i) => {
    const m = UN12_META[d.십이운성] || { grade:'—', color:'#888', bg:'#f5f5f5' };
    const isCur = i === curGi;
    const opacity = i < curGi ? 'opacity:0.5;' : '';
    const curBorder = isCur ? 'border:1.5px solid #c62828;background:#fff5f5;' : `border:1px solid #eee;${opacity}`;
    return `<div class="dw-cell" style="${curBorder}">
  <div class="dw-ganji" style="color:${TG_COLOR[d.천간]||'#333'};">${d.천간}${d.지지}</div>
  <div class="dw-age">${d.나이범위}${isCur?' ▶':''}</div>
  <div class="dw-un" style="background:${m.color};">${esc(d.십이운성||'—')}</div>
</div>`;
  }).join('');

  // ③ 12운성 조견표 (6열×2행)
  const allUn = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
  const refHTML = allUn.map(u => {
    const m = UN12_META[u];
    const isMyUn = Object.values(un).includes(u);
    const highlight = isMyUn ? `border:1.5px solid ${m.color};font-weight:700;` : '';
    return `<div class="ref-cell" style="${highlight}">
  <div class="ref-name" style="color:${m.color};">${u}</div>
  <div class="ref-grade" style="background:${m.color};">${m.grade}</div>
  <div class="ref-desc">${m.desc.split('—')[1]?.trim()||m.desc}</div>
</div>`;
  }).join('');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>십이운성 개인표 》 ${esc(name)}님</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;max-height:840px;padding:6px 10px;background:transparent;display:flex;flex-direction:column;gap:4px;overflow:hidden;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{background:transparent;margin:0;padding:0;}.page{margin:0;}@page{ border:1px solid #333;size:604px 840px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
.card{border:1.5px solid #333;border-radius:8px;overflow:hidden;}
.card-hd{padding:4px 12px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:8pt;font-weight:900;color:white;}
.card-hd-sub{font-size:6pt;color:rgba(255,255,255,.85);}
/* ① 4기둥 */
.un-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:6px 8px;}
.un-col{border-radius:6px;padding:6px 5px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;}
.un-label{font-size:7pt;color:#888;font-weight:700;}
.un-ganji{font-family:'Noto Serif KR',serif;font-size:16pt;font-weight:800;line-height:1;}
.un-kr{font-size:6pt;color:#888;margin-left:2px;}
.un-badge{font-size:8pt;font-weight:700;color:white;padding:2px 10px;border-radius:10px;margin-top:2px;}
.un-grade{font-size:6pt;font-weight:700;margin-top:1px;}
.un-desc{font-size:7pt;color:#666;line-height:1.3;}
/* ② 대운 */
.dw-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;padding:4px 6px;}
.dw-cell{border-radius:4px;padding:3px 2px;text-align:center;}
.dw-ganji{font-family:'Noto Serif KR',serif;font-size:8pt;font-weight:800;line-height:1;}
.dw-age{font-size:6.5pt;color:#888;}
.dw-un{font-size:7pt;font-weight:700;color:white;padding:1px 4px;border-radius:3px;margin-top:1px;display:inline-block;}
/* ③ 조견표 */
.ref-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;padding:4px 6px;}
.ref-cell{border:1px solid #eee;border-radius:4px;padding:3px 3px;text-align:center;}
.ref-name{font-size:8pt;font-weight:800;}
.ref-grade{font-size:7pt;font-weight:700;color:white;padding:1px 4px;border-radius:3px;display:inline-block;margin:1px 0;}
.ref-desc{font-size:6.5pt;color:#666;line-height:1.3;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#283593,#3949ab);">
  <div>
    <div class="banner-hdr-title">🔮 십이운성(十二運星) 개인표</div>
    <div class="banner-hdr-sub">일간 기준 4기둥·대운별 에너지 단계</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">${esc(ilju)} · 일간 ${w.일주.천간}(${KR[w.일주.천간]}) 기준</div>
  </div>
</div>

<!-- ① 원국 4기둥 십이운성 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1a237e,#283593);">
    <div class="card-hd-title">① 원국 4기둥 십이운성</div>
    <div class="card-hd-sub">년주·월주·일주(★)·시주 각 천간 기준</div>
  </div>
  <div class="un-grid">${pillarHTML}</div>
</div>

<!-- ② 대운별 십이운성 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
    <div class="card-hd-title">② 대운(大運) 10기 십이운성 흐름</div>
    <div class="card-hd-sub">현재 대운 ▶ 표시</div>
  </div>
  <div class="dw-grid">${dwHTML}</div>
</div>

<!-- ③ 12운성 조견표 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
    <div class="card-hd-title">③ 십이운성 의미 조견표</div>
    <div class="card-hd-sub">내 원국에 해당하는 운성은 테두리 강조</div>
  </div>
  <div class="ref-grid">${refHTML}</div>
</div>

</div></body></html>`;

  const slotTablesDir = path.join(path.dirname(masterPath), 'tables');
  if (!fs.existsSync(slotTablesDir)) fs.mkdirSync(slotTablesDir, { recursive: true });
  const outFile = path.join(slotTablesDir, '십이운성개인표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  const outDir2 = path.join(TABLES_DIR, path.basename(path.dirname(masterPath)));
  if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });
  fs.writeFileSync(path.join(outDir2, '십이운성개인표.html'), HTML, 'utf-8');
  console.log(`✅ 십이운성개인표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_십이운성개인표_v2.js <slot_id>'); process.exit(1); }
generate(slotId);
