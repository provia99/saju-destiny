#!/usr/bin/env node
/**
 * generate_지장간분석표.js
 * 지장간(地藏干) 분석표 범용 generator
 * ──────────────────────────────────────────────────
 * node generate_지장간분석표.js <slot_id>
 * 입력: queue/{slot}_ch07.json + queue/{slot}_ch03.json
 * 출력: tables/{slot}/지장간분석표.html  (A4 full-page)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── 천간 오행 색상 ────────────────────────────────────
const TG_OH = {
  甲:'#4caf50',乙:'#4caf50',丙:'#f44336',丁:'#f44336',戊:'#ff9800',
  己:'#ff9800',庚:'#9e9e9e',辛:'#9e9e9e',壬:'#2196f3',癸:'#2196f3'
};
const JJ_OH = {
  子:'#2196f3',丑:'#ff9800',寅:'#4caf50',卯:'#4caf50',辰:'#ff9800',巳:'#f44336',
  午:'#f44336',未:'#ff9800',申:'#9e9e9e',酉:'#9e9e9e',戌:'#ff9800',亥:'#2196f3'
};
function tgColor(h) { return TG_OH[h] || '#888'; }
function jjColor(h) { return JJ_OH[h] || '#888'; }

// ── 지지 오행 이름 ────────────────────────────────────
const JJ_OH_NAME = {
  子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',
  午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'
};
const JJ_KR = {
  子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',
  午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'
};

// ── 십성 계열 색상 ────────────────────────────────────
const SS_COLOR = {
  '비견':'#4caf50','겁재':'#66bb6a',
  '식신':'#f44336','상관':'#ef5350',
  '편재':'#ff9800','정재':'#ffa726',
  '편관':'#9e9e9e','정관':'#757575',
  '편인':'#2196f3','정인':'#42a5f5',
  '일원(나)':'#aaa'
};
function ssColor(ss) {
  for (const [k,v] of Object.entries(SS_COLOR)) {
    if (ss.includes(k)) return v;
  }
  return '#888';
}

// ── 오행 색상 ──────────────────────────────────────
const OH_COLOR = { '木':'#4caf50','火':'#f44336','土':'#ff9800','金':'#9e9e9e','水':'#2196f3' };
function ohColor(oh) { return OH_COLOR[oh] || '#888'; }
function ohDotClass(oh) {
  const m = {'木':'목','火':'화','土':'토','金':'금','水':'수'};
  return 'oh-' + (m[oh] || oh);
}

// ── 지장간 문자열 파싱 ────────────────────────────────
// "戊(무) 비견(여기), 壬(임) 편재(중기), 庚(경) 식신(본기)"
function parseJijanggan(str) {
  if (!str) return [];
  const items = str.split(',').map(s => s.trim()).filter(Boolean);
  return items.map(item => {
    // 한자 + 음
    const stemM = item.match(/^([甲乙丙丁戊己庚辛壬癸])\(([가-힣]+)\)/u);
    const hanja = stemM ? stemM[1] : item[0];
    const um    = stemM ? stemM[2] : '';
    // 십성 + 기 추출
    const rest = item.replace(/^[甲乙丙丁戊己庚辛壬癸]\([가-힣]+\)\s*/u, '');
    const ssM  = rest.match(/^([가-힣]+)\(([가-힣]+)\)/u);
    const ss   = ssM ? ssM[1] : rest;
    const qi   = ssM ? ssM[2] : '본기';
    // 오행 추정
    const oh   = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' }[hanja] || '';
    return { hanja, um, ss, qi, oh };
  });
}

// ── 기 배경 스타일 ────────────────────────────────────
function qiRowClass(qi) {
  if (qi === '여기') return 'yeoqi';
  if (qi === '중기') return 'jungqi';
  return 'bonqi';
}

// ── 기둥 컬럼 HTML ────────────────────────────────────
function pillarColHTML(label, jjHanja, isIlju, jijangList, isGongmang, gongmangBadge, sinsal, yongKey) {
  const jjOhName = JJ_OH_NAME[jjHanja] || '';
  const jjKr     = JJ_KR[jjHanja] || '';
  const jjC      = jjColor(jjHanja);
  const OH_KEY = { '木':'wood','火':'fire','土':'earth','金':'metal','水':'water' };
  const yongH  = { wood:'木',fire:'火',earth:'土',metal:'金',water:'水' }[yongKey] || '';

  const rows = jijangList.map(jj => {
    const qc = qiRowClass(jj.qi);
    const isYong = jj.oh === yongH;
    const yongMark = isYong ? ' ← 用神' : '';
    return `
          <div class="jj-row ${qc}">
            <span class="qi-label ${qc}">${jj.qi}(${{여기:'餘氣',중기:'中氣',본기:'本氣'}[jj.qi]||jj.qi})</span>
            <div>
              <span class="jj-stem" style="color:${tgColor(jj.hanja)};">${jj.hanja}</span>
              <span class="jj-stem-kr">${jj.um}</span>
            </div>
            <span class="jj-sipseong" style="background:${ssColor(jj.ss)};">${jj.ss}</span>
            <div class="jj-ohaeng"><div class="oh-dot ${ohDotClass(jj.oh)}"></div><span class="oh-txt">${jj.oh}(${jj.oh==='木'?'목':jj.oh==='火'?'화':jj.oh==='土'?'토':jj.oh==='金'?'금':'수'})${yongMark}</span></div>
          </div>`;
  }).join('\n');

  const noRows = jijangList.length === 0
    ? `<div style="font-size:6pt;color:#ccc;text-align:center;padding:4px 0;">지장간 없음</div>` : '';

  // 본기/중기/여기 없는 경우 안내
  const hasYeoqi  = jijangList.some(j => j.qi === '여기');
  const hasJungqi = jijangList.some(j => j.qi === '중기');
  const missingLabel = (!hasYeoqi && !hasJungqi) ? `<div style="font-size:6pt;color:#ccc;text-align:center;padding:2px 0;">여기·중기 없음</div>` : '';

  return `
      <div class="pillar-col">
        <div class="pillar-name">
          <div class="pn-label">${label}${isIlju ? ' ★' : ''}</div>
          <div class="pn-ji" style="color:${jjC};">${jjHanja}</div>
          <div class="pn-ji-kr">${jjKr}(${jjHanja}) · ${jjOhName}</div>
          ${isGongmang ? `<span class="gongmang-badge">⚡ 공망(空亡)</span>` : ''}
          ${sinsal ? `<span class="gongmang-badge" style="background:#2196f3;font-size:7pt;">${sinsal}</span>` : ''}
        </div>
        <div class="jj-rows">
          ${rows}
          ${noRows}
          ${missingLabel}
        </div>
      </div>`;
}

// ── 십성 분포 바 ──────────────────────────────────────
function buildSsBars(allJJ, yongKey) {
  // 전체 지장간 십성 카운트
  const cnt = {};
  allJJ.forEach(jjList => {
    jjList.forEach(jj => {
      const ss = jj.ss;
      if (!cnt[ss]) cnt[ss] = { count: 0, positions: [] };
      cnt[ss].count++;
    });
  });

  // 십성 순서
  const order = ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'];
  const maxCnt = Math.max(...Object.values(cnt).map(v => v.count), 1);

  return order
    .filter(ss => cnt[ss])
    .map(ss => {
      const c = cnt[ss];
      const color = ssColor(ss);
      const width = Math.round(c.count / maxCnt * 80 + 10); // 10~90%
      return `
        <div class="ss-row">
          <span class="ss-name" style="color:${color};">${ss}</span>
          <div class="ss-bar-wrap"><div class="ss-bar" style="width:${width}%;background:${color};"></div></div>
          <span class="ss-cnt">${c.count}개</span>
        </div>`;
    }).join('\n');
}

// ── 활성화 카드 ────────────────────────────────────────
function buildActivationCards(d7, yongKey, d3) {
  const yongH  = { wood:'木',fire:'火',earth:'土',metal:'金',water:'水' }[yongKey] || '';
  const yongC  = { wood:'#4caf50',fire:'#f44336',earth:'#ff9800',metal:'#9e9e9e',water:'#2196f3' }[yongKey] || '#888';
  const bestTime = d7['지장간_최적활성화시기'] || '';
  const nowActive = d7['지장간_현대운활성화'] || '';
  const gongmang1 = d3['공망1'] || '';
  const gongmang2 = d3['공망2'] || '';
  const hasGongmang = gongmang1 || gongmang2;

  const card1 = `<div class="act-card" style="background:#fff8e1;border:1.5px solid #ffd54f;">
      <div class="act-label" style="color:#e65100;">🔥 용신 방향 지장간 최적 활성화</div>
      <div class="act-ohaeng" style="color:${yongC};">${yongH}(${yongH==='木'?'목':yongH==='火'?'화':yongH==='土'?'토':yongH==='金'?'금':'수'}) 기운</div>
      <div class="act-daewoon" style="color:${yongC};">${bestTime}</div>
      <div class="act-detail" style="color:#e65100;">${d7['지장간_오행별활성화대운'] ? d7['지장간_오행별활성화대운'].split('|').find(s => s.includes(yongH))?.trim().substring(0,30) || '' : ''}</div>
    </div>`;

  const card2 = `<div class="act-card" style="background:#e8f5e9;border:1.5px solid #a5d6a7;">
      <div class="act-label" style="color:#2e7d32;">🌱 현재 대운 활성화 기운</div>
      <div class="act-ohaeng" style="color:#4caf50;">${nowActive.substring(0,10)}</div>
      <div class="act-daewoon" style="color:#4caf50;">${d7['현재대운_천간']||''}${d7['현재대운_지지']||''} 대운</div>
      <div class="act-detail" style="color:#388e3c;">${nowActive}</div>
    </div>`;

  const card3 = hasGongmang
    ? `<div class="act-card" style="background:#ffebee;border:1.5px solid #ef9a9a;">
      <div class="act-label" style="color:#c62828;">⚠️ 공망 지장간 주의</div>
      <div class="act-ohaeng" style="color:#9e9e9e;">공망 ${gongmang1}·${gongmang2}</div>
      <div class="act-daewoon" style="color:#9e9e9e;">공망 기운</div>
      <div class="act-detail" style="color:#999;">공망 지지 안의 지장간<br>의도적 강화 필요</div>
    </div>`
    : `<div class="act-card" style="background:#f5f5f5;border:1.5px solid #e0e0e0;">
      <div class="act-label" style="color:#888;">✅ 공망 없음</div>
      <div class="act-ohaeng" style="color:#888;">원국 공망 없음</div>
      <div class="act-daewoon" style="color:#888;">—</div>
      <div class="act-detail" style="color:#aaa;">지장간 모두<br>자연 발현 가능</div>
    </div>`;

  return card1 + card2 + card3;
}

// ── HTML 생성 ────────────────────────────────────────
function generate(slotId) {
  const ch07File = path.join(QUEUE_DIR, `${slotId}_ch07.json`);
  const ch03File = path.join(QUEUE_DIR, `${slotId}_ch03.json`);

  const d7 = fs.existsSync(ch07File) ? JSON.parse(fs.readFileSync(ch07File, 'utf-8')) : {};
  const d3 = fs.existsSync(ch03File) ? JSON.parse(fs.readFileSync(ch03File, 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d7); } catch(e){}

  const name     = d7['이름'] || d3['이름'] || slotId;
  const 선생님이름 = d7['선생님이름'] || d3['선생님이름'] || '반야선생';
  const birthS   = d3['birth_solar'] || d3['생년월일'] || '';
  const gender   = d3['user_gender'] || '';
  const age      = d3['user_age'] || '';
  const _c8=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`),'utf-8')):{};
  const _c6=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`),'utf-8')):{};
  const yongOh   = _c8['용신오행']||_c6['용신오행']||d7['용신오행']||d3['용신오행']||'';
  const yongKey  = { '木(목)':'wood','목':'wood','木':'wood', '火(화)':'fire','화':'fire','火':'fire',
    '土(토)':'earth','토':'earth','土':'earth', '金(금)':'metal','금':'metal','金':'metal',
    '水(수)':'water','수':'water','水':'water' }[yongOh] || 'fire';
  const yongH    = { wood:'木',fire:'火',earth:'土',metal:'金',water:'水' }[yongKey] || '';
  const yongC    = { wood:'#4caf50',fire:'#f44336',earth:'#ff9800',metal:'#9e9e9e',water:'#2196f3' }[yongKey] || '#888';

  const ilju = d7['일주'] || d3['일주'] || '';

  // 지지 한자
  const yearJj = d7['년지'] || d3['년주_지지'] || '';
  const monJj  = d7['월지'] || d3['월주_지지'] || '';
  const dayJj  = d7['일지'] || d3['일주_지지'] || '';
  const timJj  = d7['시지'] || d3['시주_지지'] || '';

  // 공망
  const gongmang1 = d3['공망1'] || '';
  const gongmang2 = d3['공망2'] || '';
  const gongList  = [gongmang1, gongmang2].filter(Boolean);

  // 지장간 파싱
  const yearJJList = parseJijanggan(d7['년지지장간'] || d3['년주_지장간_HTML']?.replace(/<br>/g,', ')?.replace(/<[^>]+>/g,'') || '');
  const monJJList  = parseJijanggan(d7['월지지장간'] || d3['월주_지장간_HTML']?.replace(/<br>/g,', ')?.replace(/<[^>]+>/g,'') || '');
  const dayJJList  = parseJijanggan(d7['일지지장간'] || d3['일주_지장간_HTML']?.replace(/<br>/g,', ')?.replace(/<[^>]+>/g,'') || '');
  const timJJList  = parseJijanggan(d7['시지지장간'] || d3['시주_지장간_HTML']?.replace(/<br>/g,', ')?.replace(/<[^>]+>/g,'') || '');

  // 신살 배지 (월지 귀인 등)
  const sinsal = {
    year: d3['년주_신살_HTML'] || '',
    mon:  d3['월주_신살_HTML'] || '',
    day:  d3['일주_신살_HTML'] || '',
    tim:  d3['시주_신살_HTML'] || ''
  };

  // 십성 분포 요약 텍스트
  const ssListStr = d7['지장간심성목록'] || '';
  const coreJJ    = d7['핵심지장간표기'] || '';
  const bestTime  = d7['지장간_최적활성화시기'] || '';

  // 메모 텍스트
  const memoText = `${name} 님의 지장간에서 핵심은 <strong style="color:${yongC};">${yongH} 오행 기운</strong>의 활성화입니다.
  용신 ${yongH} 기운이 있는 지장간이 활성화되는 대운·세운 구간에 가장 큰 기회가 옵니다.
  ${bestTime ? `<strong style="color:${yongC};">${bestTime}</strong>이 용신 지장간 최적 활성화 시기입니다.` : ''}
  ${gongList.length ? `공망(${gongList.join('·')})에 걸린 지지의 지장간은 자연 발현이 어려우니 의식적인 강화가 필요합니다.` : '원국에 공망이 없어 지장간이 자연스럽게 발현됩니다.'}`;

  // 4기둥 천간 (원국 표시용)
  const yearTg = d3['년주_천간'] || '';
  const monTg  = d3['월주_천간'] || '';
  const dayTg  = d3['일주_천간'] || '';
  const timTg  = d3['시주_천간'] || '';

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>지장간 분석표 》 ${name}님</title>
<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; padding:6px 20px; background:transparent; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  background:transparent; border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; } .page { margin:0;  background:transparent; width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; } @page { border:1px solid #333; size:604px 820px; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:2px solid #e0e0e0; border-radius:14px; overflow:hidden; margin-top:4px; }
.card-hd { padding:5px 14px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:10pt; font-weight:900; color:white; }
.card-hd-sub   { font-size:7pt; color:rgba(255,255,255,.85); }
.pillar-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0; background:transparent; }
.pillar-col  { border-right:1px solid #f0f0f0; display:flex; flex-direction:column; }
.pillar-col:last-child { border-right:none; }
.pillar-name { text-align:center; padding:4px 5px 3px; border-bottom:1px solid #f0f0f0; background:#fafafa; }
.pn-label { font-size:6.5pt; color:#aaa; font-weight:700; letter-spacing:.5px; }
.pn-ji    { font-family:'Noto Serif KR',serif; font-size:14pt; font-weight:800; line-height:1.1; margin:1px 0; }
.pn-ji-kr { font-size:7pt; color:#888; }
.gongmang-badge { display:inline-block; background:#ff5722; color:white; font-size:7pt; font-weight:700; padding:1px 6px; border-radius:8px; margin-top:2px; }
.jj-rows { padding:4px 4px; display:flex; flex-direction:column; gap:3px; }
.jj-row  { border-radius:7px; padding:4px 6px; display:flex; flex-direction:column; gap:1px; }
.jj-row.yeoqi  { background:#fff3e0; border:1px solid #ffcc80; }
.jj-row.jungqi { background:#fce4ec; border:1px solid #f48fb1; }
.jj-row.bonqi  { background:#e8f5e9; border:1px solid #a5d6a7; }
.qi-label { font-size:7pt; font-weight:700; padding:1px 5px; border-radius:4px; color:white; display:inline-block; width:fit-content; margin-bottom:1px; }
.qi-label.yeoqi  { background:#ff9800; }
.qi-label.jungqi { background:#e91e63; }
.qi-label.bonqi  { background:#4caf50; }
.jj-stem    { font-family:'Noto Serif KR',serif; font-size:12pt; font-weight:800; line-height:1; }
.jj-stem-kr { font-size:6.5pt; color:#666; margin-left:2px; }
.jj-sipseong { font-size:7pt; font-weight:700; padding:1px 7px; border-radius:8px; color:white; display:inline-block; width:fit-content; margin-top:1px; }
.jj-ohaeng  { display:flex; align-items:center; gap:4px; margin-top:1px; }
.oh-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.oh-txt { font-size:6pt; color:#888; }
.oh-목  { background:#4caf50; } .oh-화 { background:#f44336; } .oh-토 { background:#ff9800; } .oh-금 { background:#9e9e9e; } .oh-수 { background:#2196f3; }
.sipseong-bar-section { background:transparent; padding:6px 12px; border-top:1px solid #f0f0f0; }
.sec-mini-title { font-size:7.5pt; font-weight:700; color:#555; margin-bottom:5px; display:flex; align-items:center; gap:6px; }
.ss-bars { display:flex; flex-direction:column; gap:3px; }
.ss-row  { display:flex; align-items:center; gap:6px; }
.ss-name { font-size:7pt; font-weight:700; width:42px; flex-shrink:0; text-align:right; }
.ss-bar-wrap { flex:1; height:7px; background:#f0f0f0; border-radius:4px; overflow:hidden; }
.ss-bar  { height:100%; border-radius:4px; }
.ss-cnt  { font-size:6.5pt; font-weight:700; width:16px; flex-shrink:0; }
.activation-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; padding:6px 12px; background:transparent; border-top:1px solid #f0f0f0; }
.act-card  { border-radius:8px; padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
.act-label { font-size:6pt; font-weight:700; opacity:.9; }
.act-ohaeng { font-size:8pt; font-weight:700; }
.act-daewoon { font-family:'Noto Serif KR',serif; font-size:8.5pt; font-weight:800; line-height:1.2; }
.act-detail { font-size:6pt; opacity:.8; margin-top:1px; }
</style>
</head>
<body>
<div class="page">

  <div class="banner-hdr" style="background:linear-gradient(135deg,#1a237e,#4a148c);">
  <div>
    <div class="banner-hdr-title">🔑 지장간(地藏干) 분석표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · 用神 ${yongH}</div>
  </div>
</div>

  <!-- ═══ 메인 카드: 네 기둥 지장간 ═══ -->
  <div class="card">
    <div class="card-hd" style="background:linear-gradient(135deg,#1565c0,#42a5f5);">
      <div class="card-hd-title">🔑 지장간(地藏干) 분석표 》 숨겨진 기운의 지도</div>
      <div class="card-hd-sub">${name} 님 · ${ilju} 일주 · 用神 ${yongH}(${yongKey==='wood'?'목':yongKey==='fire'?'화':yongKey==='earth'?'토':yongKey==='metal'?'금':'수'})</div>
    </div>

    <!-- 네 기둥 그리드 -->
    <div class="pillar-grid">
      ${pillarColHTML('년지(年支)', yearJj, false, yearJJList, gongList.includes(yearJj), sinsal.year, null, yongKey)}
      ${pillarColHTML('월지(月支)', monJj,  false, monJJList,  gongList.includes(monJj),  sinsal.mon,  null, yongKey)}
      ${pillarColHTML('일지(日支)', dayJj,  true,  dayJJList,  gongList.includes(dayJj),  sinsal.day,  null, yongKey)}
      ${pillarColHTML('시지(時支)', timJj,  false, timJJList,  gongList.includes(timJj),  sinsal.tim,  null, yongKey)}
    </div>

    <!-- 지장간 십성 분포 -->
    <div class="sipseong-bar-section">
      <div class="sec-mini-title">
        <span style="display:inline-block;width:3px;height:12px;background:#2196f3;border-radius:2px;"></span>
        지장간 십성(十星) 분포 》 숨겨진 기운의 강약
      </div>
      <div class="ss-bars">
        ${buildSsBars([yearJJList, monJJList, dayJJList, timJJList], yongKey)}
      </div>
    </div>

    <!-- 활성화 시기 -->
    <div class="activation-grid">
      ${buildActivationCards(d7, yongKey, d3)}
    </div>

  </div><!-- card -->

  <!-- ═══ 핵심 요약 메모 ═══ -->
  <div style="background:#f8f9fa;border:1.5px solid #e0e0e0;border-radius:10px;padding:8px 14px;font-size:7pt;color:#555;line-height:1.8;">
    <strong style="color:#1565c0;">📌 ${선생님이름}의 지장간 핵심 요약</strong><br>
    ${memoText}
  </div>

</div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '지장간분석표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '지장간분석표');
  console.log(`✅ 지장간분석표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_지장간분석표.js <slot_id>'); process.exit(1); }
generate(slotId);
