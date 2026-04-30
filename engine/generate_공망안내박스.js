#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── 공망 글자별 오행·의미 정적 데이터 ─────────────────────────────────
const GONGMANG_DATA = {
  '子': { oh:'水', ohKor:'수', ohColor:'#1565c0', meaning:'자식·아랫사람 인연, 지혜와 총명함, 감정의 깊이', yinyang:'양(陽)', animal:'쥐🐭' },
  '丑': { oh:'土', ohKor:'토', ohColor:'#5d4037', meaning:'재물 창고, 인내·축적, 변화 전 정체', yinyang:'음(陰)', animal:'소🐂' },
  '寅': { oh:'木', ohKor:'목', ohColor:'#2e7d32', meaning:'발전·추진력, 리더십, 이동·변화', yinyang:'양(陽)', animal:'호랑이🐯' },
  '卯': { oh:'木', ohKor:'목', ohColor:'#2e7d32', meaning:'인간관계·협력, 유연성, 문서·계약', yinyang:'음(陰)', animal:'토끼🐰' },
  '辰': { oh:'土', ohKor:'토', ohColor:'#5d4037', meaning:'능력 축적, 조직·관리, 인맥 창고', yinyang:'양(陽)', animal:'용🐉' },
  '巳': { oh:'火', ohKor:'화', ohColor:'#b71c1c', meaning:'직관·통찰, 변신·혁신, 열정과 지혜', yinyang:'음(陰)', animal:'뱀🐍' },
  '午': { oh:'火', ohKor:'화', ohColor:'#b71c1c', meaning:'인기·명성, 표현력, 열정·화끈함', yinyang:'양(陽)', animal:'말🐎' },
  '未': { oh:'土', ohKor:'토', ohColor:'#5d4037', meaning:'예술·감성, 인내·온화, 재물 창고', yinyang:'음(陰)', animal:'양🐑' },
  '申': { oh:'金', ohKor:'금', ohColor:'#37474f', meaning:'변혁·개혁, 이동·역마, 직업·기술 능력', yinyang:'양(陽)', animal:'원숭이🐒' },
  '酉': { oh:'金', ohKor:'금', ohColor:'#37474f', meaning:'정밀·완성도, 재화 축적, 미적 감각·예술', yinyang:'음(陰)', animal:'닭🐓' },
  '戌': { oh:'土', ohKor:'토', ohColor:'#5d4037', meaning:'고독·철학, 신뢰·충성, 영적 통찰', yinyang:'양(陽)', animal:'개🐕' },
  '亥': { oh:'水', ohKor:'수', ohColor:'#1565c0', meaning:'지혜·총명, 자유분방, 귀인 인연', yinyang:'음(陰)', animal:'돼지🐷' },
};

// ── 기둥 위치별 공망 의미 ─────────────────────────────────────────────
const PILLAR_MEANING = {
  '년지': { kor:'년지(年支)', area:'조상·선조·초년', color:'#5c3317',
    detail:'초년기(0~15세 전후) 환경과 조상·선조의 영역. 어린 시절 환경이 불안정하거나 조상의 덕을 충분히 받기 어려울 수 있음. 대신 어릴 때부터 자립심이 강해지고 스스로 개척하는 힘을 기름.' },
  '월지': { kor:'월지(月支)', area:'직업·부모·청년기', color:'#1a237e',
    detail:'20~40대 사회활동과 직업·부모 영역. 직업 변동이 잦거나 특정 직종에서 결실을 맺기 어려울 수 있음. 부모·형제와의 인연이 얕거나 일찍 독립하는 경향. 변화를 두려워하지 않고 여러 분야에 도전하는 에너지가 됨.' },
  '일지': { kor:'일지(日支)', area:'배우자·내면·중년기', color:'#880e4f',
    detail:'40~50대 내면과 배우자 영역. 배우자와의 인연이 늦거나 결혼 생활에 공백이 생길 수 있음. 배우자를 잘 의식적으로 챙기고 관계에 더 집중해야 함. 내면의 풍요로움과 영적 성숙으로 보완 가능.' },
  '시지': { kor:'시지(時支)', area:'자녀·노년기·결실', color:'#004d40',
    detail:'50대 이후 자녀와 노년 결실 영역. 자녀와의 인연이 늦거나 자녀로부터 의지하기 어려울 수 있음. 노년기 독립적 생활 방식을 미리 준비하는 것이 유리. 만년에 자유롭고 여유로운 삶을 누릴 수 있음.' },
};

// ── 순명(旬名)별 공망 글자 ───────────────────────────────────────────
const SUNMYEONG = {
  '甲子旬': ['戌','亥'], '甲戌旬': ['申','酉'], '甲申旬': ['午','未'],
  '甲午旬': ['辰','巳'], '甲辰旬': ['寅','卯'], '甲寅旬': ['子','丑'],
};

// ── 공망 해소법 (충·합·운) ───────────────────────────────────────────
const HAESO = {
  '子': { chung:'午', hap:['丑'], comment:'午 운에서 충으로 해소, 丑 운에서 합으로 완화' },
  '丑': { chung:'未', hap:['子'], comment:'未 운에서 충으로 해소, 子 운에서 합으로 완화' },
  '寅': { chung:'申', hap:['亥'], comment:'申 운에서 충으로 해소, 亥 운에서 합으로 완화' },
  '卯': { chung:'酉', hap:['戌'], comment:'酉 운에서 충으로 해소, 戌 운에서 합으로 완화' },
  '辰': { chung:'戌', hap:['酉'], comment:'戌 운에서 충으로 해소, 酉 운에서 합으로 완화' },
  '巳': { chung:'亥', hap:['申'], comment:'亥 운에서 충으로 해소, 申 운에서 합으로 완화' },
  '午': { chung:'子', hap:['未'], comment:'子 운에서 충으로 해소, 未 운에서 합으로 완화' },
  '未': { chung:'丑', hap:['午'], comment:'丑 운에서 충으로 해소, 午 운에서 합으로 완화' },
  '申': { chung:'寅', hap:['巳','子'], comment:'寅 운에서 충으로 해소, 巳·子 운에서 합으로 완화' },
  '酉': { chung:'卯', hap:['辰'], comment:'卯 운에서 충으로 해소, 辰 운에서 합으로 완화' },
  '戌': { chung:'辰', hap:['卯'], comment:'辰 운에서 충으로 해소, 卯 운에서 합으로 완화' },
  '亥': { chung:'巳', hap:['寅'], comment:'巳 운에서 충으로 해소, 寅 운에서 합으로 완화' },
};

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch06Path = path.join(QUEUE_DIR, `${slotId}_ch06.json`);
  if (!fs.existsSync(ch03Path)) throw new Error(`ch03 없음: ${ch03Path}`);
  const d3 = JSON.parse(fs.readFileSync(ch03Path, 'utf-8'));
  const d6 = fs.existsSync(ch06Path) ? JSON.parse(fs.readFileSync(ch06Path, 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d6); } catch(e){}

  // ── 인적 정보 ──────────────────────────────────────
  const name   = d3['user_name'] || d3['이름'] || slotId;
  const birthS = d3['birth_solar'] || '';
  const gender = d3['user_gender'] || '';
  const age    = d3['user_age'] || '';
  const ilju   = d3['일주'] || '';

  // ── 공망 데이터 ────────────────────────────────────
  const gm1       = d3['공망1'] || '';
  const gm2       = d3['공망2'] || '';
  const gmList    = d3['공망목록'] || '';
  const gmSunmyeong = d3['공망순명'] || '';
  const gmPos     = d3['공망원국위치'] || '';
  const gmYoung   = d3['공망있음'] === 'Y';
  const iljiGM    = d3['일지공망여부'] === 'Y';
  const sijiGM    = d3['시지공망여부'] === 'Y';
  const gm1Desc   = d3['공망1_위치설명'] || '';
  const gm2Desc   = d3['공망2_위치설명'] || '';

  // ── 4기둥 지지 ─────────────────────────────────────
  const neonji  = d3['년주_지지한자'] || '';
  const wolji   = d3['월주_지지한자'] || '';
  const ilji    = (d3['일주한자'] || '').slice(1) || '';
  const siji    = d3['시주_지지한자'] || '';
  const neongan = d3['년주_천간한자'] || '';
  const wolgan  = d3['월주_천간한자'] || '';
  const ilgan   = (d3['일주한자'] || '').slice(0,1) || '';
  const sigan   = d3['시주_천간한자'] || '';

  // 각 기둥별 공망 여부
  const gmSet = new Set([gm1, gm2].filter(Boolean));
  const neonjiGM = gmSet.has(neonji);
  const woljiGM  = gmSet.has(wolji);
  // ilji, siji already in d3
  const pillars = [
    { pos:'년지', gan:neongan, ji:neonji, isGM: neonjiGM },
    { pos:'월지', gan:wolgan,  ji:wolji,  isGM: woljiGM },
    { pos:'일지', gan:ilgan,   ji:ilji,   isGM: iljiGM },
    { pos:'시지', gan:sigan,   ji:siji,   isGM: sijiGM },
  ];

  // ── 공망 위치 상세 ──────────────────────────────────
  const affectedPillars = pillars.filter(p => p.isGM);
  const affectedPos = affectedPillars.map(p => p.pos);

  // ── 공망 데이터 오브젝트 ────────────────────────────
  const gm1Data = GONGMANG_DATA[gm1] || {};
  const gm2Data = GONGMANG_DATA[gm2] || {};

  // ── 공망 해소 정보 ──────────────────────────────────
  const gm1Haeso = HAESO[gm1] || {};
  const gm2Haeso = HAESO[gm2] || {};

  // ── 원국에서 이미 해소 여부 체크 ───────────────────
  const allJi = [neonji, wolji, ilji, siji].filter(Boolean);
  const gm1ChungInChart  = gm1Haeso.chung  && allJi.includes(gm1Haeso.chung);
  const gm1HapInChart    = (gm1Haeso.hap || []).some(h => allJi.includes(h));
  const gm2ChungInChart  = gm2Haeso.chung  && allJi.includes(gm2Haeso.chung);
  const gm2HapInChart    = (gm2Haeso.hap || []).some(h => allJi.includes(h));

  // ── 순명 내 60갑자 범위 ─────────────────────────────
  const SUNMYEONG_RANGE = {
    '甲子旬': '甲子(갑자)~癸酉(계유)', '甲戌旬': '甲戌(갑술)~癸未(계미)', '甲申旬': '甲申(갑신)~癸巳(계사)',
    '甲午旬': '甲午(갑오)~癸卯(계묘)', '甲辰旬': '甲辰(갑진)~癸丑(계축)', '甲寅旬': '甲寅(갑인)~癸亥(계해)',
  };
  const sunKey = gmSunmyeong.replace(/\(.+\)/, '').trim();
  const sunRange = SUNMYEONG_RANGE[sunKey] || '';

  // ── 용신 정보 ──────────────────────────────────────
  const yongsin = d6['용신오행'] || d6['용신'] || '';

  // ── HTML 생성 ──────────────────────────────────────
  const CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; max-height:820px; overflow:hidden; padding:4px 6px; background:transparent; display:flex; flex-direction:column; gap:3px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print {
  body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; max-height:820px; overflow:hidden; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 820px; margin:0; }
}
/* ── 헤더 ── */
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:4px 12px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
/* ── 카드 공통 ── */
.card { border:1.5px solid #ccc; border-radius:8px; overflow:hidden; }
.card-hd { padding:3px 8px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:7.5pt; font-weight:900; color:white; letter-spacing:-0.3px; }
.card-hd-sub   { font-size:7pt; color:rgba(255,255,255,.82); }
.card-body { padding:4px 8px; background:transparent; display:flex; flex-direction:column; gap:3px; }
/* ── Card ①: 핵심 ── */
.gm-hero { display:flex; align-items:stretch; gap:8px; }
.gm-chars { display:flex; gap:6px; }
.gm-char-box { background:#fafafa; border:1.5px solid #ddd; border-radius:6px; text-align:center; padding:5px 10px; min-width:58px; }
.gm-char-box.active { border-color:#c9a227; background:#fffbf0; }
.gm-char-num  { font-size:7pt; color:#999; font-weight:700; margin-bottom:1px; }
.gm-char-hanja { font-size:22pt; font-weight:900; color:#333; line-height:1; font-family:'Noto Serif KR',serif; }
.gm-char-box.active .gm-char-hanja { color:#c9a227; }
.gm-char-eum  { font-size:6.5pt; color:#666; margin-top:1px; }
.gm-char-oh   { font-size:7pt; font-weight:700; padding:1px 5px; border-radius:3px; display:inline-block; margin-top:3px; color:white; }
.gm-info { flex:1; display:flex; flex-direction:column; gap:5px; justify-content:center; }
.gm-sun-box { background:#f5f5f5; border-radius:5px; padding:4px 7px; }
.gm-sun-lbl { font-size:7pt; color:#888; font-weight:700; margin-bottom:2px; }
.gm-sun-val { font-size:9pt; font-weight:900; color:#333; font-family:'Noto Serif KR',serif; }
.gm-sun-sub { font-size:7pt; color:#888; margin-top:1px; }
.gm-pos-badge { display:inline-flex; align-items:center; gap:4px; background:#1a237e; color:white; border-radius:5px; padding:4px 9px; align-self:flex-start; }
.gm-pos-badge-lbl { font-size:7pt; opacity:.8; }
.gm-pos-badge-val { font-size:7.5pt; font-weight:900; }
.gm-desc-box { background:#e8eaf6; border-left:3px solid #3949ab; border-radius:0 5px 5px 0; padding:5px 8px; font-size:6pt; color:#1a237e; line-height:1.5; }
/* ── Card ②: 4기둥 ── */
.pillar-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
.pillar-cell { border:1.5px solid #e0e0e0; border-radius:6px; overflow:hidden; text-align:center; }
.pillar-cell.has-gm { border-color:#c9a227; }
.pillar-label { font-size:7pt; font-weight:700; color:white; background:#546e7a; padding:2px 0; }
.pillar-cell.has-gm .pillar-label { background:#b8860b; }
.pillar-gan { font-size:13pt; font-weight:900; color:#444; padding:3px 0 0; font-family:'Noto Serif KR',serif; }
.pillar-ji  { font-size:13pt; font-weight:900; color:#333; padding:0 0 3px; font-family:'Noto Serif KR',serif; }
.pillar-cell.has-gm .pillar-ji { color:#c9a227; }
.pillar-ji-eum { font-size:7pt; color:#888; padding-bottom:3px; }
.gm-badge { font-size:7pt; font-weight:900; background:#c9a227; color:white; border-radius:0 0 5px 5px; padding:2px 0 3px; letter-spacing:0.3px; }
.no-gm-badge { font-size:7pt; color:#bbb; background:#f5f5f5; border-radius:0 0 5px 5px; padding:2px 0 3px; }
.pillar-area { font-size:7pt; color:#888; padding:1px 0 0; }
.pillar-cell.has-gm .pillar-area { color:#b8860b; font-weight:700; }
/* ── Card ③: 영향 분석 ── */
.impact-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
.impact-cell { background:#f9f9f9; border-radius:5px; border:1px solid #333; padding:7px 9px; }
.impact-cell-title { font-size:6pt; font-weight:900; color:#333; margin-bottom:3px; display:flex; align-items:center; gap:4px; }
.impact-cell-dot { width:6px; height:6px; border-radius:50%; display:inline-block; flex-shrink:0; }
.impact-cell-text { font-size:7pt; color:#555; line-height:1.5; }
.gm-meaning-row { display:flex; gap:5px; }
.gm-meaning-card { flex:1; border-radius:5px; padding:7px 9px; }
.gm-meaning-title { font-size:7pt; font-weight:900; margin-bottom:3px; }
.gm-meaning-text  { font-size:7pt; line-height:1.45; color:#444; }
.pos-detail-box { background:#f3e5f5; border-left:3px solid #7b1fa2; border-radius:0 5px 5px 0; padding:6px 9px; }
.pos-detail-title { font-size:7pt; font-weight:900; color:#7b1fa2; margin-bottom:3px; }
.pos-detail-text  { font-size:7pt; color:#444; line-height:1.5; }
/* ── Card ④: 해소·활용 ── */
.haeso-row { display:flex; gap:5px; }
.haeso-card { flex:1; border-radius:6px; padding:7px 9px; }
.haeso-title { font-size:7pt; font-weight:900; margin-bottom:5px; display:flex; align-items:center; gap:3px; }
.haeso-title-icon { font-size:7pt; }
.haeso-item { font-size:7pt; color:#444; line-height:1.45; margin-bottom:3px; padding-left:9px; position:relative; }
.haeso-item::before { content:'•'; position:absolute; left:2px; color:#888; }
.chip-row { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
.chip { font-size:7pt; font-weight:700; padding:2px 7px; border-radius:4px; border:1px solid; }
.chip-chung { background:#fff8e1; color:#f57f17; border-color:#ffe082; }
.chip-hap   { background:#e8f5e9; color:#2e7d32; border-color:#a5d6a7; }
.chip-active { background:#c9a227; color:white; border-color:#c9a227; }
.in-chart-note { font-size:7pt; color:#2e7d32; font-weight:700; background:#e8f5e9; border-radius:3px; padding:2px 6px; display:inline-block; margin-top:4px; }
.advice-block { background:#fff8e1; border-radius:5px; border:1px solid #ffe082; padding:7px 9px; }
.advice-title { font-size:6pt; font-weight:900; color:#e65100; margin-bottom:5px; }
.advice-item { font-size:7pt; color:#333; line-height:1.5; margin-bottom:3px; padding-left:11px; position:relative; }
.advice-item::before { content:'→'; position:absolute; left:0; color:#e65100; font-size:7pt; }
/* ── 공망없음 ── */
.no-gm-notice { text-align:center; padding:16px; color:#aaa; font-size:7.5pt; }
</style>`;

  // ── 공망 없음 케이스 ─────────────────────────────────
  if (!gmYoung || !gm1) {
    const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>공망안내박스 》 ${esc(name)}님</title>${CSS}</head>
<body><div class="page">
  <div class="banner-hdr" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
  <div>
    <div class="banner-hdr-title">🔮 공망(空亡) 안내</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}</div>
  </div>
</div>
  <div class="no-gm-notice">✅ 원국에 공망 해당 지지가 없습니다</div>
</div></body></html>`;
    const outDir = path.join(TABLES_DIR, slotId.replace('_ch03','').replace(/_ch\d+$/,''));
    // fallback: use slotId as folder name under tables
    const folder = path.join(TABLES_DIR, slotId);
    const folderBase = fs.existsSync(folder) ? folder : (() => {
      const guess = path.join(TABLES_DIR, slotId.split('_').slice(0,-1).join('_') || slotId);
      return fs.existsSync(guess) ? guess : TABLES_DIR;
    })();
    fs.writeFileSync(path.join(folderBase, '공망안내박스.html'), html, 'utf-8');
    return;
  }

  // ── 기둥별 렌더 ─────────────────────────────────────
  const AREA_MAP = { '년지':'조상·초년', '월지':'직업·부모', '일지':'배우자·내면', '시지':'자녀·노년' };
  function renderPillar(p) {
    const d = GONGMANG_DATA[p.ji] || {};
    const eumMap = {
      '子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사',
      '午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해',
    };
    const ganEumMap = {
      '甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계',
    };
    const jiEum = eumMap[p.ji] || '';
    const ganEum = ganEumMap[p.gan] || '';
    const posKor = { '년지':'년주(年柱)', '월지':'월주(月柱)', '일지':'일주(日柱)', '시지':'시주(時柱)' }[p.pos] || p.pos;
    const area   = AREA_MAP[p.pos] || '';
    return `<div class="pillar-cell${p.isGM?' has-gm':''}">
      <div class="pillar-label">${esc(posKor)}</div>
      <div class="pillar-gan">${esc(p.gan)}</div>
      <div class="pillar-ji">${esc(p.ji)}</div>
      <div class="pillar-ji-eum">${esc(ganEum)}${esc(jiEum)}</div>
      <div class="pillar-area">${esc(area)}</div>
      ${p.isGM
        ? `<div class="gm-badge">⚠ 공망</div>`
        : `<div class="no-gm-badge">정상</div>`}
    </div>`;
  }

  // ── 영향 분석 (공망 위치별) ─────────────────────────
  function renderImpact(gm, gmData, gmDesc, isInChart) {
    if (!gm) return '';
    const color = gmData.ohColor || '#555';
    const impactItems = affectedPos.map(p => {
      const pm = PILLAR_MEANING[p];
      if (!pm) return '';
      return `<div class="pos-detail-box" style="border-color:${pm.color};background:${pm.color}11">
        <div class="pos-detail-title" style="color:${pm.color}">${pm.kor} 》 ${pm.area}</div>
        <div class="pos-detail-text">${esc(pm.detail)}</div>
      </div>`;
    }).join('');

    return impactItems;
  }

  // ── 공망 글자별 의미 블록 ───────────────────────────
  function renderGmMeaningCard(gm, gmData, isPresent) {
    if (!gm || !isPresent) return '';
    const color = gmData.ohColor || '#555';
    return `<div class="gm-meaning-card" style="background:${color}11;border:1.5px solid ${color}44">
      <div class="gm-meaning-title" style="color:${color}">
        <span style="font-size:12pt;font-family:'Noto Serif KR',serif">${esc(gm)}</span>
        (${gmData.ohKor || ''}오행 · ${gmData.yinyang || ''})
      </div>
      <div class="gm-meaning-text">${esc(gmData.meaning || '')}</div>
      ${gm2Desc && gm === gm2 ? `<div style="font-size:6.5pt;color:#888;margin-top:5px">원국 위치 없음 (잠재 공망)</div>` : ''}
    </div>`;
  }

  // ── 해소 카드 ────────────────────────────────────────
  function renderHaeso(gm, gmData, haeso, chungInChart, hapInChart) {
    if (!gm || !haeso) return '';
    const color = gmData.ohColor || '#555';
    const chungHanja = haeso.chung || '';
    const hapHanja   = (haeso.hap || []).join('·');
    return `<div class="haeso-card" style="background:${color}0d;border:1.5px solid ${color}33">
      <div class="haeso-title" style="color:${color}">
        <span class="haeso-title-icon">🔓</span>
        ${esc(gm)} 공망 해소법
      </div>
      <div class="haeso-item"><b>충(沖) 해소</b>: ${esc(chungHanja)} 운(대운·세운)에서 완전 해소
        ${chungInChart ? `<br><span style="color:#2e7d32;font-size:6.5pt">✅ 원국에 ${esc(chungHanja)} 있음 》 일정 부분 이미 완화됨</span>` : ''}
      </div>
      <div class="haeso-item"><b>합(合) 완화</b>: ${esc(hapHanja)} 운에서 부분 완화
        ${hapInChart ? `<br><span style="color:#2e7d32;font-size:6.5pt">✅ 원국에 합 글자 있음 》 자연 완화 작동</span>` : ''}
      </div>
      <div class="chip-row">
        <span class="chip chip-chung">충해소: ${esc(chungHanja)}</span>
        ${(haeso.hap||[]).map(h=>`<span class="chip chip-hap">합완화: ${esc(h)}</span>`).join('')}
      </div>
    </div>`;
  }

  // ── gm2가 원국에 존재하는가 ─────────────────────────
  const gm2InChart = allJi.includes(gm2);

  // ── 공망안내박스 조언 ───────────────────────────────
  const ADVICE = [
    `공망은 해당 영역의 '비어있음'이지, 능력 부재가 아닙니다. 오히려 그 분야를 <b>의식적으로 채워나가는 노력</b>이 남들보다 더 큰 성취로 이어질 수 있습니다.`,
    `공망이 있는 기둥의 영역(${affectedPos.map(p=>AREA_MAP[p]||p).join('·')})에서는 <b>꼼꼼한 계획과 반복적 확인</b>이 중요합니다. 당연히 될 것이라 여기지 말고 의식적으로 점검하세요.`,
    `공망 해소 운(대운·세운)이 오면 해당 영역이 활성화됩니다. <b>${affectedPos.length>0 ? gm1+' 공망은 '+( HAESO[gm1]?.chung||'?' )+' 운에서 해소' : '운에 따라 활성화'}</b>됩니다.`,
    `공망이 있는 글자(${[gm1, gm2InChart?gm2:''].filter(Boolean).join('·')})는 일상에서 <b>충·합이 일어나는 날(일진)에 에너지가 살아납니다</b>. 중요한 일을 그 날에 맞추는 것도 방법입니다.`,
  ];

  // ── 최종 HTML ────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>공망안내박스 》 ${esc(name)}님</title>
  ${CSS}
</head>
<body>
<div class="page">

  <!-- 헤더 -->
  <div class="banner-hdr" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
  <div>
    <div class="banner-hdr-title">🔮 공망(空亡) 안내</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}</div>
  </div>
</div>

  <!-- Card ①: 공망 핵심 정보 -->
  <div class="card">
    <div class="card-hd" style="background:#2d3748">
      <div class="card-hd-title">① 공망 핵심 정보</div>
      <div class="card-hd-sub">空亡 字 · 旬名 · 原局 位置</div>
    </div>
    <div class="card-body">
      <div class="gm-hero">
        <!-- 공망 글자 대형 -->
        <div class="gm-chars">
          <div class="gm-char-box active">
            <div class="gm-char-num">공망①</div>
            <div class="gm-char-hanja">${esc(gm1)}</div>
            <div class="gm-char-eum">${gm1Data.animal||''} ${gm1Data.ohKor||''}오행</div>
            <div class="gm-char-oh" style="background:${gm1Data.ohColor||'#555'}">${gm1Data.oh||''}</div>
          </div>
          <div class="gm-char-box${gm2InChart?' active':''}">
            <div class="gm-char-num">공망②</div>
            <div class="gm-char-hanja">${esc(gm2)}</div>
            <div class="gm-char-eum">${gm2Data.animal||''} ${gm2Data.ohKor||''}오행</div>
            <div class="gm-char-oh" style="background:${gm2Data.ohColor||'#555'}">${gm2Data.oh||''}</div>
          </div>
        </div>
        <!-- 순명 + 위치 -->
        <div class="gm-info">
          <div class="gm-sun-box">
            <div class="gm-sun-lbl">공망 순명(旬名)</div>
            <div class="gm-sun-val">${esc(gmSunmyeong)}</div>
            ${sunRange ? `<div class="gm-sun-sub">순(旬) 범위: ${esc(sunRange)}</div>` : ''}
            <div class="gm-sun-sub" style="margin-top:4px;font-size:6pt;color:#aaa">일간이 속한 10개 천간 집합에서 빠진 2개 지지</div>
          </div>
          <div class="gm-pos-badge">
            <div class="gm-pos-badge-lbl">원국 공망 위치</div>
            <div class="gm-pos-badge-val">${esc(gmPos || (affectedPos.join('·') || '없음'))}</div>
          </div>
        </div>
      </div>
      ${gm1Desc ? `<div class="gm-desc-box">⚠ ${esc(gm1Desc)}</div>` : ''}
      ${gm2Desc ? `<div class="gm-desc-box" style="border-color:#7b1fa2;background:#f3e5f5;color:#7b1fa2">⚠ ${esc(gm2Desc)}</div>` : ''}
      ${!gm2InChart ? `<div style="font-size:6.5pt;color:#bbb;background:#fafafa;border-radius:5px;padding:5px 10px;border:1px solid #eee">
        ${esc(gm2)}은 원국 4기둥에 없음 》 잠재 공망(대운·세운에 ${esc(gm2)} 올 때 주의)
      </div>` : ''}
    </div>
  </div>

  <!-- Card ②: 4기둥 공망 현황 -->
  <div class="card">
    <div class="card-hd" style="background:#1a3a5c">
      <div class="card-hd-title">② 원국 4기둥 공망 현황</div>
      <div class="card-hd-sub">공망 지지가 어느 기둥에 있는지 확인</div>
    </div>
    <div class="card-body">
      <div class="pillar-grid">
        ${pillars.map(renderPillar).join('\n        ')}
      </div>
      ${affectedPillars.length === 0 ? `
      <div style="text-align:center;font-size:7.5pt;color:#888;padding:4px 0">
        원국 4기둥에 공망 지지가 없습니다 》 대운·세운에서 공망 글자가 올 때 주의하세요
      </div>` : ''}
    </div>
  </div>

  <!-- Card ③: 공망 영향 분석 -->
  <div class="card">
    <div class="card-hd" style="background:#4a148c">
      <div class="card-hd-title">③ 공망 영향 분석</div>
      <div class="card-hd-sub">위치별 삶의 영역 · 공망 글자 고유 에너지</div>
    </div>
    <div class="card-body">
      <!-- 위치 상세 설명 -->
      ${renderImpact(gm1, gm1Data, gm1Desc, gm1ChungInChart)}

      <!-- 공망 글자 오행 의미 -->
      <div style="font-size:6.5pt;font-weight:700;color:#888;margin-top:2px">공망 글자 고유 에너지</div>
      <div class="gm-meaning-row">
        ${renderGmMeaningCard(gm1, gm1Data, true)}
        ${renderGmMeaningCard(gm2, gm2Data, true)}
      </div>
    </div>
  </div>

  <!-- Card ④: 공망 극복과 활용 -->
  <div class="card">
    <div class="card-hd" style="background:#00695c">
      <div class="card-hd-title">④ 공망 극복과 활용</div>
      <div class="card-hd-sub">해소 방법 · 실생활 조언</div>
    </div>
    <div class="card-body">
      <!-- 해소 카드 -->
      <div class="haeso-row">
        ${renderHaeso(gm1, gm1Data, gm1Haeso, gm1ChungInChart, gm1HapInChart)}
        ${gm2 !== gm1 ? renderHaeso(gm2, gm2Data, gm2Haeso, gm2ChungInChart, gm2HapInChart) : ''}
      </div>
      <!-- 실생활 조언 -->
      <div class="advice-block">
        <div class="advice-title">실생활 활용 포인트</div>
        ${ADVICE.map(a=>`<div class="advice-item">${a}</div>`).join('')}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;

  // ── 파일 저장 (단일 파일) ────────────────────────────
  const outDir  = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '공망안내박스.html');
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`  ✅ 공망안내박스 → ${outPath}`);
}

// ── 진입점 ─────────────────────────────────────────────
const slotId = process.argv[2];
if (!slotId) { console.error('Usage: node generate_공망안내박스.js <slot_id>'); process.exit(1); }
generate(slotId);
