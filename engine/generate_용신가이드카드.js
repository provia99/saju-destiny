#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const OH_COLORS = {
  '木': { color:'#2e7d32', bg:'#e8f5e9', light:'#c8e6c9', kr:'목' },
  '火': { color:'#c62828', bg:'#ffebee', light:'#ffcdd2', kr:'화' },
  '土': { color:'#e65100', bg:'#fff3e0', light:'#ffe0b2', kr:'토' },
  '金': { color:'#37474f', bg:'#eceff1', light:'#cfd8dc', kr:'금' },
  '水': { color:'#0d47a1', bg:'#e3f2fd', light:'#bbdefb', kr:'수' },
};

// 오행 → 영문 키
function ohKey(str) {
  if (!str) return null;
  const map = {'木':'木','木(목)':'木','火':'火','火(화)':'火','土':'土','土(토)':'土','金':'金','金(금)':'金','水':'水','水(수)':'水'};
  const m = str.match(/木|火|土|金|水/);
  return m ? m[0] : null;
}

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch06Path = path.join(QUEUE_DIR, `${slotId}_ch06.json`);

  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};
  const d6 = fs.existsSync(ch06Path) ? JSON.parse(fs.readFileSync(ch06Path, 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d6); } catch(e){}

  // ── 인적 정보 ──────────────────────────────────────────
  const name    = d3['이름']        || d6['이름']        || slotId;
  const birthS  = d3['birth_solar'] || d3['생년월일']    || '';
  const gender  = d3['user_gender'] || d3['성별']        || '';
  const age     = d3['user_age']    || d3['나이']        || d6['만나이'] || '';
  const ilju    = d3['일주']        || d6['일주']        || '';
  const curDW   = d6['현재대운간지'] || '';
  const curDWChar = d6['현재대운성격'] || '';
  const seunGJ  = d6['세운간지']    || '';
  const seunChar= d6['세운성격']    || '';
  const shingang = d6['신강약']     || '';
  const geukguk = d6['격국명']      || '';

  // ── 용신 정보 ──────────────────────────────────────────
  const yongHanja = ohKey(d6['용신오행']) || ohKey(d6['용신한자']) || '木';
  const huiHanja  = ohKey(d6['희신오행']) || '水';
  const byeongHanja = ohKey(d6['기신오행']) || '金';
  const hanHanja  = ohKey(d6['한신오행']) || '';

  const yongO   = OH_COLORS[yongHanja]   || OH_COLORS['木'];
  const huiO    = OH_COLORS[huiHanja]    || OH_COLORS['水'];
  const byeongO = OH_COLORS[byeongHanja] || OH_COLORS['金'];
  const hanO    = hanHanja ? (OH_COLORS[hanHanja] || {}) : {};

  const yongColor   = d6['용신색상']   || '';
  const yongDir     = d6['용신방위']   || '';
  const yongJob     = d6['용신직업군'] || '';
  const eobuYong    = d6['억부용신']   || '';
  const johuYong    = d6['조후용신']   || '';
  const sameYN      = d6['억부조후같음'] || '';
  const yongPrinciple = d6['용신도출원리'] || '';

  // ── 오행 속성 정의 ──────────────────────────────────────
  const OH_ATTR = {
    '木': { season:'봄(2~4월)', dir:'東(동)', colorHint:'청색·녹색', job:'교육·의료·환경·임업·목공예·원예·출판', do_:'성장 활동·공부·창조적 작업', dont:'金(금) 오행 과다 의존' },
    '火': { season:'여름(5~7월)', dir:'南(남)', colorHint:'적색·주황', job:'방송·예술·홍보·의료·전기·요식업·연기', do_:'사교·자기표현·발표 활동', dont:'水(수) 오행 과다 의존' },
    '土': { season:'환절기', dir:'中央', colorHint:'황색·갈색', job:'부동산·농업·금융·중재·교육·요식업·건축', do_:'안정 추구·신뢰 구축·중재', dont:'木(목) 오행 과다 의존' },
    '金': { season:'가을(8~10월)', dir:'西(서)', colorHint:'흰색·금색', job:'금융·법조·의료·기계·IT·제조업·군경', do_:'규율·집중·완성 지향 활동', dont:'火(화) 오행 과다 의존' },
    '水': { season:'겨울(11~1월)', dir:'北(북)', colorHint:'검정·청색', job:'무역·IT·연구·여행업·수산업·물류·출판', do_:'학습·지혜 쌓기·유연한 적응', dont:'土(토) 오행 과다 의존' },
  };

  const ya = OH_ATTR[yongHanja] || {};
  const ba = OH_ATTR[byeongHanja] || {};

  // 직업군 파싱 (·로 구분)
  const jobList = (yongJob || ya.job || '').split(/[·,，]/).map(j=>j.trim()).filter(Boolean);
  const jobChips = jobList.map(j => `<span class="chip" style="background:${yongO.light};color:${yongO.color};">${esc(j)}</span>`).join('');

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
/* 용신 요약 스트립 */
.yong-strip { display:grid; grid-template-columns:auto 1fr 1fr 1fr 1fr; gap:0; background:transparent; align-items:center; }
.ys-main { padding:10px 16px; text-align:center; border-right:2px solid #eee; }
.ys-hanja { font-size:28pt; font-weight:900; line-height:1; }
.ys-sub { font-size:7pt; color:#aaa; margin-top:2px; }
.ys-cell { padding:7px 8px; text-align:center; border-right:1px solid #eee; }
.ys-cell:last-child { border-right:none; }
.ys-lbl { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:3px; }
.ys-val { font-size:8.5pt; font-weight:800; }
/* 상세 그리드 */
.detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; background:transparent; }
.dg-cell { padding:9px 12px; border-right:1px solid #eee; border-bottom:1px solid #eee; }
.dg-cell:nth-child(2n) { border-right:none; }
.dg-cell:nth-last-child(-n+2) { border-bottom:none; }
.dg-lbl { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:4px; }
.dg-val { font-size:7.5pt; color:#333; line-height:1.6; }
/* 직업 칩 */
.chip-wrap { display:flex; flex-wrap:wrap; gap:4px; padding:8px 10px; }
.chip { font-size:6.5pt; padding:2px 8px; border-radius:4px; font-weight:700; }
/* Do / Don't */
.do-dont-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; background:transparent; }
.do-box { padding:9px 12px; border-right:1px solid #eee; }
.dont-box { padding:9px 12px; }
.dd-title { font-size:7pt; font-weight:700; margin-bottom:6px; display:flex; align-items:center; gap:5px; }
.dd-item { font-size:6.5pt; color:#444; padding:3px 0 3px 14px; position:relative; line-height:1.4; }
.dd-item:before { position:absolute; left:0; }
.do-item:before  { content:"✦"; color:#2e7d32; }
.dont-item:before{ content:"✕"; color:#c62828; }
/* 3신 비교 */
.three-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; background:transparent; }
.tg-col { padding:8px 10px; border-right:1px solid #eee; }
.tg-col:last-child { border-right:none; }
.tg-lbl { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:4px; }
.tg-oh { font-size:14pt; font-weight:900; line-height:1; margin-bottom:3px; }
.tg-attr { font-size:6pt; color:#666; line-height:1.6; }
</style>`;

  // ── HTML 조립 ─────────────────────────────────────────
  const H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>용신 가이드 카드 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
  <div>
    <div class="banner-hdr-title">📋 용신(用神) 가이드 카드</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · 용신 ${esc(yongHanja)}(${yongO.kr})</div>
  </div>
</div>

<!-- ① 용신 핵심 정보 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,${yongO.color},${yongO.color}cc);">
    <div class="card-hd-title">① 나의 용신(用神) 핵심 정보</div>
    <div class="card-hd-sub">${geukguk?esc(geukguk)+' · ':''}${shingang?esc(shingang):''}${eobuYong?' · 억부용신 '+esc(eobuYong):''}</div>
  </div>
  <div class="yong-strip">
    <div class="ys-main" style="background:${yongO.bg};">
      <div class="ys-hanja" style="color:${yongO.color};">${esc(yongHanja)}</div>
      <div class="ys-sub">用神 · ${yongHanja}(${yongO.kr})</div>
    </div>
    <div class="ys-cell"><div class="ys-lbl">용신 색상</div><div class="ys-val" style="color:${yongO.color};">${esc(yongColor||ya.colorHint||'—')}</div></div>
    <div class="ys-cell"><div class="ys-lbl">용신 방위</div><div class="ys-val" style="color:${yongO.color};">${esc(yongDir||ya.dir||'—')}</div></div>
    <div class="ys-cell"><div class="ys-lbl">좋은 계절</div><div class="ys-val">${ya.season||'—'}</div></div>
    <div class="ys-cell"><div class="ys-lbl">희신</div><div class="ys-val" style="color:${huiO.color};">${esc(huiHanja)}(${huiO.kr})</div></div>
  </div>
  ${yongPrinciple?`<div style="background:#fafafa;border-top:1px solid #eee;padding:6px 12px;font-size:6.5pt;color:#666;">${esc(yongPrinciple)}</div>`:''}
</div>

<!-- ② 직업 권장 분야 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#e65100,#ff6d00);">
    <div class="card-hd-title">② 용신 직업 권장 분야</div>
    <div class="card-hd-sub">用神 오행 에너지가 활성화되는 직업군</div>
  </div>
  <div class="chip-wrap">${jobChips || `<span style="font-size:7pt;color:#aaa;">데이터 없음</span>`}</div>
</div>

<!-- ③ Do / Don't -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
    <div class="card-hd-title">③ 실천 가이드 (Do / Don't)</div>
    <div class="card-hd-sub">용신 강화 실천과 기신 회피 지침</div>
  </div>
  <div class="do-dont-grid">
    <div class="do-box">
      <div class="dd-title" style="color:#2e7d32;">✦ 해야 할 것 (Do)</div>
      <div class="dd-item do-item">용신 오행(${esc(yongHanja)}) 관련 활동·공부 집중</div>
      <div class="dd-item do-item">용신 색상(${esc(yongColor||ya.colorHint||'')}) 의복·소품 활용</div>
      <div class="dd-item do-item">용신 방위(${esc(yongDir||ya.dir||'')}) 방향 거주·근무 선호</div>
      <div class="dd-item do-item">희신 오행(${esc(huiHanja)}) 계절에 주요 결정</div>
      <div class="dd-item do-item">${esc(ya.do_||'용신 관련 직업군 선택·유지')}</div>
    </div>
    <div class="dont-box">
      <div class="dd-title" style="color:#c62828;">✕ 피해야 할 것 (Don't)</div>
      <div class="dd-item dont-item">기신 오행(${esc(byeongHanja)}) 관련 분야 과도 의존</div>
      <div class="dd-item dont-item">기신 색상(${esc(byeongO.kr?ba.colorHint||'':ba.colorHint||'')}) 남용</div>
      <div class="dd-item dont-item">중요 결정을 기신 계절(${ba.season||''})에 하기</div>
      <div class="dd-item dont-item">기신 방위(${ba.dir||''}) 장기 거주·이사</div>
      <div class="dd-item dont-item">${esc(ba.dont||'기신 오행 강화 활동 피하기')}</div>
    </div>
  </div>
</div>

<!-- ④ 용신·희신·기신 비교 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
    <div class="card-hd-title">④ 용신·희신·기신 비교</div>
    <div class="card-hd-sub">각 오행의 역할과 속성 비교</div>
  </div>
  <div class="three-grid">
    <div class="tg-col" style="background:${yongO.bg};">
      <div class="tg-lbl" style="color:${yongO.color};">用神 (용신)</div>
      <div class="tg-oh" style="color:${yongO.color};">${esc(yongHanja)}</div>
      <div class="tg-attr">방위: ${ya.dir||'—'}<br>색상: ${ya.colorHint||'—'}<br>계절: ${ya.season||'—'}<br>${eobuYong?'억부: '+esc(eobuYong):''}${johuYong?' · 조후: '+esc(johuYong):''}</div>
    </div>
    <div class="tg-col" style="background:${huiO.bg};">
      <div class="tg-lbl" style="color:${huiO.color};">喜神 (희신)</div>
      <div class="tg-oh" style="color:${huiO.color};">${esc(huiHanja)}</div>
      <div class="tg-attr">방위: ${(OH_ATTR[huiHanja]||{}).dir||'—'}<br>색상: ${(OH_ATTR[huiHanja]||{}).colorHint||'—'}<br>계절: ${(OH_ATTR[huiHanja]||{}).season||'—'}<br>용신을 생(生)해주는 오행</div>
    </div>
    <div class="tg-col" style="background:${byeongO.bg};">
      <div class="tg-lbl" style="color:${byeongO.color};">忌神 (기신)</div>
      <div class="tg-oh" style="color:${byeongO.color};">${esc(byeongHanja)}</div>
      <div class="tg-attr">방위: ${(OH_ATTR[byeongHanja]||{}).dir||'—'}<br>색상: ${(OH_ATTR[byeongHanja]||{}).colorHint||'—'}<br>계절: ${(OH_ATTR[byeongHanja]||{}).season||'—'}<br>용신을 극(剋)하는 오행</div>
    </div>
  </div>
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive:true });
  const outFile = path.join(outDir, '용신가이드카드.html');
  require('./_guards').safeWriteHtml(outFile, H, { 이름: name }, '용신가이드카드');
  console.log(`✅ 용신가이드카드 생성: ${outFile}  (${Buffer.byteLength(H,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_용신가이드카드.js <slot_id>'); process.exit(1); }
generate(slotId);
