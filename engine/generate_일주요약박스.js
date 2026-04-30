#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── 오행 한자 매핑 ──────────────────────────────────────
const OH_HANJA = { metal:'金', wood:'木', fire:'火', earth:'土', water:'水' };
const OH_COLOR = { metal:'#37474f', wood:'#2e7d32', fire:'#c62828', earth:'#bf360c', water:'#0d47a1' };
const OH_KOR   = { metal:'금', wood:'목', fire:'화', earth:'토', water:'수' };

// ── 천간 정적 데이터 ─────────────────────────────────────
const CHEONGAN = {
  '甲':{ eum:'갑', yinyang:'양(陽)', oh:'wood', char:'곧고 강한 나무 》 개척·선도·성장',     keywords:['리더십','개척정신','직진성','독립심','추진력'] },
  '乙':{ eum:'을', yinyang:'음(陰)', oh:'wood', char:'부드러운 덩굴 》 유연·적응·공감',     keywords:['유연성','협력','감수성','예술성','적응력'] },
  '丙':{ eum:'병', yinyang:'양(陽)', oh:'fire', char:'태양·장작불 》 열정·표현·명예',       keywords:['열정','표현력','사교성','명예욕','적극성'] },
  '丁':{ eum:'정', yinyang:'음(陰)', oh:'fire', char:'촛불·등잔 》 섬세·예술·집중',         keywords:['섬세함','집중력','예술성','통찰력','세심함'] },
  '戊':{ eum:'무', yinyang:'양(陽)', oh:'earth',char:'큰 산·대지 》 안정·포용·중재',        keywords:['안정성','포용력','신뢰감','중재력','근면함'] },
  '己':{ eum:'기', yinyang:'음(陰)', oh:'earth',char:'논밭·옥토 》 수용·봉사·실용',         keywords:['현실감','봉사심','수용력','실용적','세심함'] },
  '庚':{ eum:'경', yinyang:'양(陽)', oh:'metal',char:'큰 쇠·도끼 》 결단·강인·의리',       keywords:['결단력','의리','강인함','정의감','솔직함'] },
  '辛':{ eum:'신', yinyang:'음(陰)', oh:'metal',char:'보석·예리한 칼 》 완성·예민·품격',   keywords:['완벽주의','예민함','품격','미적감각','분석력'] },
  '壬':{ eum:'임', yinyang:'양(陽)', oh:'water',char:'강·바다 》 지혜·흐름·포용',           keywords:['지혜','사고력','포용력','융통성','탐구심'] },
  '癸':{ eum:'계', yinyang:'음(陰)', oh:'water',char:'비·이슬 》 직관·감수성·정밀',         keywords:['직관력','감수성','정밀함','내면세계','신중함'] },
};

// ── 지지 정적 데이터 ─────────────────────────────────────
const JIJI = {
  '子':{ eum:'자', oh:'water', char:'지혜·총명·유연. 끊임없이 흐르는 물처럼 머리가 영민하고 적응력이 뛰어남' },
  '丑':{ eum:'축', oh:'earth', char:'인내·축적·신뢰. 묵묵히 쌓아가는 기질로 재물을 지키고 성실히 노력함' },
  '寅':{ eum:'인', oh:'wood',  char:'추진·개척·호방. 호랑이처럼 당당하고 앞으로 나아가는 개척 기질이 강함' },
  '卯':{ eum:'묘', oh:'wood',  char:'온화·협력·문서. 부드럽고 사람을 끄는 매력으로 인간관계와 문서운이 좋음' },
  '辰':{ eum:'진', oh:'earth', char:'포용·능력·저장. 다양한 재주와 인맥을 품어 큰 성취를 이루는 기질' },
  '巳':{ eum:'사', oh:'fire',  char:'직관·변신·심화. 뱀처럼 예리한 통찰력으로 변화를 통해 재생하는 철학적 기질' },
  '午':{ eum:'오', oh:'fire',  char:'열정·인기·명성. 강렬한 에너지와 표현력으로 사람들의 시선을 끄는 매력' },
  '未':{ eum:'미', oh:'earth', char:'예술·감성·온화. 따뜻한 감수성으로 예술과 인간관계에서 빛나는 기질' },
  '申':{ eum:'신', oh:'metal', char:'변혁·이동·기술. 날카로운 지성과 변화에 강해 기술·역마 기질이 뚜렷함' },
  '酉':{ eum:'유', oh:'metal', char:'정밀·완성·미적감각. 예리하고 완벽함을 추구하며 예술·기술에서 두각을 나타냄' },
  '戌':{ eum:'술', oh:'earth', char:'고독·철학·충성. 깊은 사유와 신뢰를 중시하며 영적·정신적 성숙이 빠름' },
  '亥':{ eum:'해', oh:'water', char:'지혜·자유·귀인. 총명하고 자유로운 영혼으로 귀인과의 인연이 많음' },
};

// ── 12운성 의미 ──────────────────────────────────────────
const UN12 = {
  '장생':'생명이 시작되는 기운. 활발하고 긍정적이며 새로운 일에 희망과 열정이 넘침',
  '목욕':'감수성 풍부한 성장기. 감정 기복이 있으나 자기표현이 강하고 이성적 매력이 뛰어남',
  '관대':'사회에 첫발을 내딛는 기운. 포부가 크고 발전 욕구가 강하며 확장을 추구함',
  '건록':'실력 발휘의 전성기. 독립적이고 자립하여 사회적 능력을 인정받는 왕성한 시기',
  '제왕':'절정의 권위와 주도권. 강한 자아와 리더십이 있으나 지나치면 독단으로 흐를 수 있음',
  '쇠':'성숙과 여유의 시기. 내실을 다지며 안정감 있는 지혜와 포용력이 빛남',
  '병':'부드러움과 감성. 돌봄·예술적 감수성이 발달하고 정서가 풍부하며 배려심이 깊음',
  '사':'소멸과 전환의 기운. 깊은 내면과 통찰력으로 변화를 통해 재생하는 철학적 기질',
  '묘':'저장과 잠재의 기운. 진중하고 신중하며 기억력이 뛰어나고 과거를 중시함',
  '절':'단절과 재출발. 극단적 선택과 새로운 출발을 반복하는 독립적이고 강인한 기질',
  '태':'잉태된 가능성. 환경 의존적이나 무한한 잠재력을 내포하며 변화에 유연함',
  '양':'양육과 보호의 기운. 의지가 강하고 타인을 돕는 성향이 있으며 안정을 추구함',
};

// ── 십성 배지 색상 ───────────────────────────────────────
const SS_BADGE = {
  '비견':{bg:'#dbeafe',c:'#1e40af'},'겁재':{bg:'#fce7f3',c:'#9d174d'},
  '식신':{bg:'#dcfce7',c:'#166534'},'상관':{bg:'#fef9c3',c:'#854d0e'},
  '편재':{bg:'#f3e8ff',c:'#6b21a8'},'정재':{bg:'#ccfbf1',c:'#065f46'},
  '편관':{bg:'#ffe4e6',c:'#9f1239'},'정관':{bg:'#e0f2fe',c:'#075985'},
  '편인':{bg:'#fef3c7',c:'#92400e'},'정인':{bg:'#ecfdf5',c:'#065f46'},
  '일원(나)':{bg:'#fef08a',c:'#713f12'},
};
function ssBadge(s, fs='7pt', px='3px 9px') {
  if (!s) return '';
  const col = SS_BADGE[s] || {bg:'#f1f5f9', c:'#475569'};
  return `<span style="display:inline-block;padding:${px};border-radius:10px;font-size:${fs};font-weight:700;background:${col.bg};color:${col.c};">${esc(s)}</span>`;
}

// ── 신살 의미 ────────────────────────────────────────────
const SSAL_DESC = {
  '도화살':    '이성 매력·사교성 탁월. 예술·연예·서비스 분야 인기',
  '겁살':      '재물 손실·위험 주의. 투기·사기 조심. 운동으로 해소',
  '장성살':    '리더십·통솔력 탁월. 군·경·관직이나 단체장에 적합',
  '역마살':    '이동·변화 잦고 해외·출장 인연이 강함. 활동적 직업 유리',
  '화개살':    '예술적 재능·종교 인연. 혼자 집중하는 기질, 고독 즐김',
  '천을귀인':  '최고의 길신. 위기 시 귀인 도움으로 전화위복됨',
  '문창귀인':  '학문·문서운 강함. 자격증·합격·글쓰기에서 두각',
  '태극귀인':  '삶의 전환점마다 귀인이 나타나 도움을 줌',
  '천복귀인':  '재복과 귀인운이 강해 예상치 못한 행운이 따름',
  '지살':      '이동·변화운. 타향·외지 생활과 인연이 깊음',
  '재살':      '예상치 못한 사고·관재수 주의. 건강 관리 필요',
  '백호살':    '사고·혈액 주의. 강렬한 기운으로 의료·법률 분야 유리',
  '괴강살':    '강한 독립심·고집. 남다른 추진력, 타협이 어려울 수 있음',
  '원진살':    '인연이 맺어지면 서로 원망·갈등. 계약 관계 주의',
  '천살':      '천재지변·자연 재해 관련. 예측 불가 변수 주의',
  '망신살':    '명예 실추·망신 조심. 언행과 처신을 신중히',
  '반안살':    '귀인 도움을 받는 길살. 높은 자리에 오르게 해주는 운',
  '육해살':    '재물·건강 손해. 계약·보증 관계 특히 주의',
};

// ── 지장간 HTML 파싱 ─────────────────────────────────────
// 입력: '戊(무) 정인(여기)<br>庚(경) 겁재(중기)<br>丙(병) 정관(본기)'
// 출력: [{ hanja:'戊', eum:'무', ss:'정인', gunbun:'여기' }, ...]
function parseJjg(raw) {
  if (!raw) return [];
  return raw.split(/<br\s*\/?>/i).map(s => {
    s = s.replace(/<[^>]+>/g, '').trim();
    if (!s) return null;
    // 패턴: 天干(음) 십성(여기/중기/본기)
    const m = s.match(/^([甲乙丙丁戊己庚辛壬癸])\(([가-힣]+)\)\s+([가-힣]+)\(([가-힣]+)\)/);
    if (m) return { hanja:m[1], eum:m[2], ss:m[3], gunbun:m[4] };
    return { hanja:'', eum:'', ss:s, gunbun:'' };
  }).filter(Boolean);
}

// ── 신살 목록 파싱 ────────────────────────────────────────
// 입력: '천을귀인(天乙貴人) 시지에 위치 / 문창귀인(文昌貴人) 년지에 위치'
// 출력: [{ name:'천을귀인', hanja:'天乙貴人', pos:'시지에 위치', type:'귀인' }, ...]
function parseSsal(raw, type) {
  if (!raw) return [];
  return raw.split('/').map(s => {
    s = s.trim();
    if (!s) return null;
    const m = s.match(/^([가-힣]+)\(([^)]+)\)\s*(.*)/);
    if (m) return { name:m[1], hanja:m[2], pos:m[3].trim(), type };
    return { name:s, hanja:'', pos:'', type };
  }).filter(Boolean);
}

// ── 메인 ─────────────────────────────────────────────────
function generate(slotId) {
  const d3 = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch03.json`),'utf-8'));
  const d6 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`),'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d6); } catch(e){}

  // ── 기본 정보 ──────────────────────────────────────────
  const name    = d3['user_name']  || d3['이름']     || slotId;
  const birthS  = d3['birth_solar'] || '';
  const gender  = d3['user_gender'] || '';
  const age     = d3['user_age']    || '';
  const ilju    = d3['일주']        || '';
  const shingang = d3['신강약'] || d6['신강약'] || d6['신강약단'] || '';

  // ── 일간 ──────────────────────────────────────────────
  const ilGan   = d3['일주_천간']      || '';
  const ilGanOh = d3['일주_천간_오행'] || '';  // 'metal','wood' 등
  const cg = CHEONGAN[ilGan] || {};
  const cgOhKey = cg.oh || ilGanOh;
  const cgColor  = OH_COLOR[cgOhKey] || '#333';
  const cgHanja  = OH_HANJA[cgOhKey] || '';
  const cgKor    = OH_KOR[cgOhKey]   || '';

  // ── 일지 ──────────────────────────────────────────────
  const ilJi    = d3['일주_지지']      || '';
  const ilJiOh  = d3['일주_지지_오행'] || '';  // 'fire' 등
  const ilJiSs  = d3['일주_지지십성'] || d3['일지_십성'] || '';
  const il12    = d3['일주_12운성']    || '';
  const jjgRaw  = d3['일주_지장간_HTML'] || '';
  const jiData  = JIJI[ilJi] || {};
  const jiColor = OH_COLOR[ilJiOh] || '#555';
  const jiHanja = OH_HANJA[ilJiOh] || '';
  const jiKor   = OH_KOR[ilJiOh]   || '';
  const un12Meaning = UN12[il12] || '';

  // 지장간 파싱
  const jjgList = parseJjg(jjgRaw);
  const GUNBUN_KOR = { '여기':'餘氣', '중기':'中氣', '본기':'本氣' };

  // ── 신살 ──────────────────────────────────────────────
  const guiRaw  = d3['귀인신살요약'] || d3['길신요약'] || '';
  const salRaw  = d3['살신살목록']   || d3['흉살요약'] || '';
  const guiList = parseSsal(guiRaw, '귀인');
  const salList = parseSsal(salRaw, '살신');
  const allSsal = [...guiList, ...salList];

  // ── 공망 ──────────────────────────────────────────────
  const gm1      = d3['공망1']    || '';
  const gm2      = d3['공망2']    || '';
  const gmSun    = d3['공망순명'] || '';
  const gmPyo    = d3['공망표기'] || '';
  const gm1Desc  = d3['공망1_위치설명'] || '';
  const gmPos    = d3['공망원국위치']   || d3['공망목록'] || '';
  const hasGM    = d3['공망있음'] === 'Y' && gm1;

  // ── 렌더 헬퍼 ────────────────────────────────────────
  function ohChip(ohKey, hanja) {
    const c = OH_COLOR[ohKey] || '#555';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:7pt;font-weight:700;background:${c}1a;color:${c};border:1px solid ${c}44;">${esc(hanja)}(${esc(OH_KOR[ohKey]||'')})</span>`;
  }

  const CSS = `<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;max-height:840px;padding:6px 12px;background:transparent;display:flex;flex-direction:column;gap:4px;overflow:hidden;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{background:transparent;margin:0;padding:0;}.page{margin:0;width:604px;}@page{ border:1px solid #333;size:604px 840px;margin:0;}}
/* 헤더 */
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
/* 카드 */
.card{border:2px solid #ccc;border-radius:10px;overflow:hidden;}
.card-hd{padding:4px 14px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:9pt;font-weight:900;color:white;}
.card-hd-sub{font-size:6.5pt;color:rgba(255,255,255,.82);}
/* ① 일간·일지 컴팩트 2분할 */
.ilju-grid{display:grid;grid-template-columns:1fr 1px 1fr;background:transparent;}
.ilju-divider{background:#e8e8e8;}
.ilju-col{padding:5px 10px;display:flex;flex-direction:column;gap:3px;}
.col-label{font-size:7pt;color:#aaa;font-weight:700;letter-spacing:.5px;}
.hanja-lg{font-family:'Noto Serif KR',serif;font-size:22pt;font-weight:800;line-height:1;}
.hanja-eum{font-size:7pt;color:#777;margin-top:1px;}
.badge-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
.char-desc{font-size:6.5pt;color:#555;line-height:1.4;padding:3px 7px;background:#f8f9fa;border-radius:5px;border-left:3px solid #ddd;}
.kw-row{display:flex;flex-wrap:wrap;gap:2px;}
.kw-chip{font-size:7pt;font-weight:700;padding:1px 6px;border-radius:6px;background:#f0f4ff;color:#3730a3;}
/* 12운성 인라인 */
.un12-inline{font-size:6.5pt;color:#1565c0;font-weight:700;padding:2px 7px;background:#f0f4ff;border-radius:5px;display:inline-block;}
/* ② 지장간 가로 테이블 */
.jjg-tbl{width:100%;border-collapse:collapse;}
.jjg-tbl th{font-size:7pt;color:#aaa;font-weight:700;padding:3px 5px;background:#f8f8f8;border-bottom:1px solid #ddd;text-align:center;}
.jjg-tbl td{font-size:7pt;padding:3px 5px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;}
.jjg-tbl tr:last-child td{border-bottom:none;}
.jjg-hanja{font-family:'Noto Serif KR',serif;font-size:10pt;font-weight:700;}
/* ③ 신살 뱃지 그리드 */
.ss-section{padding:5px 8px;display:flex;gap:10px;}
.ss-group{flex:1;}
.ss-group-title{font-size:6pt;font-weight:700;margin-bottom:3px;}
.ss-chips{display:flex;flex-wrap:wrap;gap:2px;}
.ss-chip{font-size:6pt;font-weight:700;padding:2px 6px;border-radius:5px;color:white;}
/* ④ 공망 인라인 */
.gm-row{padding:4px 8px;display:flex;align-items:center;gap:8px;background:#fff8f0;border-top:1px solid #ffe0b2;}
.gm-label{font-size:6pt;font-weight:700;color:#e65100;}
.gm-hanja{font-family:'Noto Serif KR',serif;font-size:12pt;font-weight:900;color:#c62828;}
.gm-info{font-size:6pt;color:#888;}
</style>`;

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>일주 핵심 정보 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<!-- 배너 헤더 -->
<div class="banner-hdr" style="background:linear-gradient(135deg,#1a237e,#4a148c);">
  <div>
    <div class="banner-hdr-title">📋 일주(日柱) 핵심 정보</div>
    <div class="banner-hdr-sub">일간·일지·12운성·지장간·신살·공망</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">${esc(ilju)} · ${esc(shingang)}</div>
  </div>
</div>

<!-- ① 일간·일지 -->
<div class="card">
  <div class="card-hd" style="background:#1565c0;">
    <div class="card-hd-title">① 일간(日干) · 일지(日支)</div>
    <div class="card-hd-sub">기질 · 12운성</div>
  </div>
  <div class="ilju-grid">
    <div class="ilju-col">
      <div class="col-label">일간(天干)</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="hanja-lg" style="color:${cgColor};">${esc(ilGan)}</div>
        <div>
          <div class="hanja-eum">${esc(cg.eum||'')} · ${esc(cg.yinyang||'')} · ${cgHanja}(${cgKor})</div>
          ${cg.char ? `<div style="font-size:6pt;color:#666;margin-top:1px;">${esc(cg.char)}</div>` : ''}
        </div>
      </div>
      <div class="kw-row">${(cg.keywords||[]).map(k=>`<span class="kw-chip">${esc(k)}</span>`).join('')}</div>
    </div>
    <div class="ilju-divider"></div>
    <div class="ilju-col">
      <div class="col-label">일지(地支)</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="hanja-lg" style="color:${jiColor};">${esc(ilJi)}</div>
        <div>
          <div class="hanja-eum">${esc(jiData.eum||'')} · ${jiHanja}(${jiKor}) · ${ssBadge(ilJiSs,'6pt','1px 6px')}</div>
          ${jiData.char ? `<div style="font-size:6pt;color:#666;margin-top:1px;">${esc(jiData.char)}</div>` : ''}
        </div>
      </div>
      ${il12 ? `<div class="un12-inline">12운성: ${esc(il12)} 》 ${esc(un12Meaning).substring(0,30)}${un12Meaning.length>30?'…':''}</div>` : ''}
    </div>
  </div>
</div>

<!-- ② 지장간 -->
${jjgList.length ? `<div class="card">
  <div class="card-hd" style="background:#283593;">
    <div class="card-hd-title">② 지장간(支藏干) 》 일지 ${esc(ilJi)}(${esc(jiData.eum||'')}) 속 숨은 천간</div>
  </div>
  <table class="jjg-tbl">
    <thead><tr><th>구분</th><th>천간</th><th>음</th><th>오행</th><th>십성</th></tr></thead>
    <tbody>${jjgList.map(g => {
      const gOh = CHEONGAN[g.hanja]?.oh || '';
      const gColor = OH_COLOR[gOh] || '#555';
      return `<tr>
        <td style="font-size:6pt;color:#888;">${esc(g.gunbun)}(${esc(GUNBUN_KOR[g.gunbun]||g.gunbun)})</td>
        <td><span class="jjg-hanja" style="color:${gColor};">${esc(g.hanja)}</span></td>
        <td style="font-size:6.5pt;">${esc(g.eum)}</td>
        <td style="font-size:6.5pt;">${esc(OH_HANJA[gOh]||'')}(${esc(OH_KOR[gOh]||'')})</td>
        <td>${ssBadge(g.ss,'6pt','1px 6px')}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>
</div>` : ''}

<!-- ③ 신살 -->
<div class="card">
  <div class="card-hd" style="background:#4a148c;">
    <div class="card-hd-title">③ 신살(神殺)</div>
    <div class="card-hd-sub">귀인·길신 / 흉살·주의</div>
  </div>
  <div class="ss-section">
    <div class="ss-group">
      <div class="ss-group-title" style="color:#1565c0;">귀인·길신</div>
      <div class="ss-chips">
        ${guiList.length ? guiList.map(s=>`<span class="ss-chip" style="background:#1565c0;" title="${esc(SSAL_DESC[s.name]||'')}">${esc(s.name)}</span>`).join('') : '<span style="font-size:6pt;color:#ccc;">없음</span>'}
      </div>
    </div>
    <div class="ss-group">
      <div class="ss-group-title" style="color:#c62828;">흉살·주의</div>
      <div class="ss-chips">
        ${salList.length ? salList.map(s=>`<span class="ss-chip" style="background:#c62828;" title="${esc(SSAL_DESC[s.name]||'')}">${esc(s.name)}</span>`).join('') : '<span style="font-size:6pt;color:#ccc;">없음</span>'}
      </div>
    </div>
  </div>
</div>

<!-- ④ 공망 -->
<div class="card">
  <div class="gm-row">
    <div class="gm-label">④ 공망(空亡)</div>
    ${hasGM ? `
      <span class="gm-hanja">${esc(gm1)}</span>${gm2?`<span style="color:#ccc;font-size:10pt;">·</span><span class="gm-hanja">${esc(gm2)}</span>`:''}
      <span class="gm-info">${esc(gmPos)} · ${esc(gmSun)}</span>
    ` : '<span class="gm-info">원국 내 공망 해당 없음</span>'}
  </div>
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '일주요약박스.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  console.log(`✅ 일주요약박스 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_일주요약박스.js <slot_id>'); process.exit(1); }
generate(slotId);
