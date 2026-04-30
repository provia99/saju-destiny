#!/usr/bin/env node
/**
 * generate_십성배치표.js
 * 십성(十星) 배치표 범용 generator
 * ──────────────────────────────────────────────────
 * node generate_십성배치표.js <slot_id>
 * 입력: queue/{slot}_ch03.json + queue/{slot}_ch05.json
 * 출력: tables/{slot}/십성배치표.html  (604×840 single page)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── 오행 팔레트 ──────────────────────────────────────
const OH_COLOR = {
  wood:  '#4caf50', fire: '#f44336', earth: '#ff9800',
  metal: '#9e9e9e', water: '#2196f3'
};
function ohColor(ohaeng) {
  const m = { wood:'wood',木:'wood',목:'wood', fire:'fire',火:'fire',화:'fire',
    earth:'earth',土:'earth',토:'earth', metal:'metal',金:'metal',금:'metal',
    water:'water',水:'water',수:'water' };
  if (m[ohaeng]) return OH_COLOR[m[ohaeng]] || '#888';
  const first = String(ohaeng).charAt(0);
  return OH_COLOR[m[first]] || '#888';
}

// ── 십성 → 계열 ──────────────────────────────────────
const SS_TO_GYEYEOL = {
  '비견':'비겁','겁재':'비겁',
  '식신':'식상','상관':'식상',
  '편재':'재성','정재':'재성',
  '편관':'관성','정관':'관성',
  '편인':'인성','정인':'인성',
  '일원(나)':'(일원)','일원(日元)':'(일원)'
};

// ── 계열 색상 ──────────────────────────────────────
const GYEYEOL_COLOR = {
  '비겁': '#4caf50', '식상': '#f44336', '재성': '#ff9800',
  '관성': '#9e9e9e', '인성': '#2196f3'
};

// ── 십성 10개 정의 (순서 고정) ───────────────────────
const TEN_STARS = [
  { gyeyeol:'비겁', ss:'비견', eng:'Shoulder',
    meaning:'주체성·자립심·동등한 경쟁. 나와 같은 기운. 독립적으로 움직이는 힘.',
    domain:'형제·동료·경쟁자 관계. 자립·독립 사업.' },
  { gyeyeol:'비겁', ss:'겁재', eng:'Rob',
    meaning:'경쟁심·추진력·과감한 실행력. 승부근성이 있고 한번에 큰 것을 잡으려 함.',
    domain:'경쟁·투자·사업 기질. 재물 기복 주의.' },
  { gyeyeol:'식상', ss:'식신', eng:'Eating God',
    meaning:'창의력·표현·여유·먹복. 자연스러운 재능 발휘. 없으면 창작보다 실무형.',
    domain:'창작·예술·요식·자유업.' },
  { gyeyeol:'식상', ss:'상관', eng:'Hurting Officer',
    meaning:'표현력·반골기질·예술성. 없으면 규칙 안에서 안정을 추구.',
    domain:'언론·예술·교육(비판).' },
  { gyeyeol:'재성', ss:'편재', eng:'Partial Wealth',
    meaning:'사업적 재물·투기·확장성. 없으면 안정 자산 선호.',
    domain:'사업·투자·무역.' },
  { gyeyeol:'재성', ss:'정재', eng:'Direct Wealth',
    meaning:'안정적 수입·성실·관리형 재물. 꾸준히 모으는 재물 기질. 배우자와 재물 연결.',
    domain:'월급·연금·임대수입. 재물 안정형.' },
  { gyeyeol:'관성', ss:'편관', eng:'Partial Officer',
    meaning:'도전성·권력욕·강한 추진력. 없으면 강압보다 원칙으로 움직임.',
    domain:'군·경·특수직.' },
  { gyeyeol:'관성', ss:'정관', eng:'Direct Officer',
    meaning:'원칙성·책임감·명예욕. 사회적 책임과 규범을 매우 중시함.',
    domain:'공직·조직·명예직. 신뢰·책임 기질.' },
  { gyeyeol:'인성', ss:'편인', eng:'Partial Seal',
    meaning:'직관력·독창성·편중된 학습. 독특하고 창의적인 사고방식.',
    domain:'예술·종교·전문직. 독특한 사고.' },
  { gyeyeol:'인성', ss:'정인', eng:'Direct Seal',
    meaning:'수용성·학문·어머니·보호. 학습·지식으로 운이 열리는 구조.',
    domain:'학문·자격증·보호·모성. 공부로 성취.' }
];

// ── 십성배치목록 파싱 ────────────────────────────────
// "년간 戊(무): 비견, 년지 申(신): 식신, ..." 형식
function parseSipseongBaechi(str) {
  const result = {}; // key: "비견" → [{ pos:"년간 戊(무)", hanja:"戊", um:"무" }, ...]
  if (!str) return result;
  const parts = str.split(',').map(s => s.trim());
  for (const part of parts) {
    const m = part.match(/^(.+?)\s*:\s*(.+)$/);
    if (!m) continue;
    const pos = m[1].trim();         // e.g. "년간 戊(무)"
    const ss  = m[2].trim();         // e.g. "비견"
    // normalize 일원
    const ssNorm = ss.replace('일원(日元)','일원(나)').replace('일원(일원)','일원(나)');
    if (!result[ssNorm]) result[ssNorm] = [];
    // 한자 추출: pos에서 한자 첫글자
    const hm = pos.match(/[年年年년월일시][간지]\s*([^\s(]+)/u);
    const hanja = hm ? hm[1] : pos;
    result[ssNorm].push({ pos, hanja });
  }
  return result;
}

// ── 기둥 데이터 구성 ─────────────────────────────────
function buildPillars(d3, d5, yongsinOhaeng, gongmang1, gongmang2) {
  const pillars = [
    { key:'년주', label:'년주(年柱)', sub:'조상·사회·초년',
      tg: d3['년주_천간'], tgUm: d3['년주_천간_음'], tgOh: d3['년주_천간_오행'],
      jj: d3['년주_지지'], jjUm: d3['년주_지지_음'], jjOh: d3['년주_지지_오행'],
      tgSS: d3['년주_천간십성'], jjSS: d3['년주_지지십성'],
      sinsal: d3['년주_신살_HTML'] || '' },
    { key:'월주', label:'월주(月柱)', sub:'부모·직업·청년',
      tg: d3['월주_천간'], tgUm: d3['월주_천간_음'], tgOh: d3['월주_천간_오행'],
      jj: d3['월주_지지'], jjUm: d3['월주_지지_음'], jjOh: d3['월주_지지_오행'],
      tgSS: d3['월주_천간십성'], jjSS: d3['월주_지지십성'],
      sinsal: d3['월주_신살_HTML'] || '' },
    { key:'일주', label:'일주(日柱)', sub:'배우자·중년', isIlju: true,
      tg: d3['일주_천간'], tgUm: d3['일주_천간_음'], tgOh: d3['일주_천간_오행'],
      jj: d3['일주_지지'], jjUm: d3['일주_지지_음'], jjOh: d3['일주_지지_오행'],
      tgSS: d3['일주_천간십성'], jjSS: d3['일주_지지십성'],
      sinsal: d3['일주_신살_HTML'] || '' },
    { key:'시주', label:'시주(時柱)', sub:'자녀·말년·꿈',
      tg: d3['시주_천간'], tgUm: d3['시주_천간_음'], tgOh: d3['시주_천간_오행'],
      jj: d3['시주_지지'], jjUm: d3['시주_지지_음'], jjOh: d3['시주_지지_오행'],
      tgSS: d3['시주_천간십성'], jjSS: d3['시주_지지십성'],
      sinsal: d3['시주_신살_HTML'] || '' }
  ];

  // 공망 여부 체크
  const gongList = [gongmang1, gongmang2].filter(Boolean);
  pillars.forEach(p => {
    p.tgIsYong = p.tgOh && ohColor(p.tgOh) === ohColor(yongsinOhaeng) && !p.isIlju;
    p.jjIsYong = p.jjOh && ohColor(p.jjOh) === ohColor(yongsinOhaeng) && !p.isIlju;
    p.jjIsGongmang = gongList.includes(p.jj);
    p.tgIsGongmang = gongList.includes(p.tg);
  });
  return pillars;
}

// ── 계열별 카운트 ────────────────────────────────────
function countByGyeyeol(baechiMap) {
  const cnt = { '비겁':0, '식상':0, '재성':0, '관성':0, '인성':0 };
  for (const [ss, positions] of Object.entries(baechiMap)) {
    const gy = SS_TO_GYEYEOL[ss];
    if (gy && cnt[gy] !== undefined) cnt[gy] += positions.length;
  }
  return cnt;
}

// ── HTML 생성 ────────────────────────────────────────
function generate(slotId) {
  const ch03File = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch05File = path.join(QUEUE_DIR, `${slotId}_ch05.json`);

  const d3 = fs.existsSync(ch03File) ? JSON.parse(fs.readFileSync(ch03File, 'utf-8')) : {};
  const d5 = fs.existsSync(ch05File) ? JSON.parse(fs.readFileSync(ch05File, 'utf-8')) : d3;

  // ── saju_calc 보강 — ch03/ch05가 부분 데이터일 때 4기둥 + 십성을 직접 채움 ─
  // (saju_summary 흐름에서 ch03.json이 일주만 가지는 경우 등)
  try {
    const G = require('./_guards');
    const masterPath = G.findMasterJson(slotId, QUEUE_DIR);
    if (masterPath) {
      const m = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
      const { 전체사주계산 } = require('./saju_calc');
      const r = 전체사주계산({ 이름:m.이름, 성별:m.성별, 년:m.생년, 월:m.생월, 일:m.생일,
        시간: m.생시||'모름', 음력입력:!!m.음력입력, 윤달:!!m.윤달, self_q1: m.self_q1, self_q2: m.self_q2, self_q3: m.self_q3, self_q4: m.self_q4, self_q5: m.self_q5, self_q6: m.self_q6, self_q7: m.self_q7,
});
      const _천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
      const _지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
      const _천간오행 = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
      const _지지오행 = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
      const _fillPillar = (key, p) => {
        if (!p?.천간) return;
        if (!d3[`${key}_천간`])      d3[`${key}_천간`] = p.천간;
        if (!d3[`${key}_천간_음`])    d3[`${key}_천간_음`] = _천간음[p.천간] || '';
        if (!d3[`${key}_천간_오행`])  d3[`${key}_천간_오행`] = _천간오행[p.천간] || '';
        if (!d3[`${key}_지지`])      d3[`${key}_지지`] = p.지지;
        if (!d3[`${key}_지지_음`])    d3[`${key}_지지_음`] = _지지음[p.지지] || '';
        if (!d3[`${key}_지지_오행`])  d3[`${key}_지지_오행`] = _지지오행[p.지지] || '';
      };
      _fillPillar('년주', r.원국.년주);
      _fillPillar('월주', r.원국.월주);
      _fillPillar('일주', r.원국.일주);
      _fillPillar('시주', r.원국.시주);
      // 십성 보강 — saju_calc.십성배치 결과 활용
      if (r.십성배치 && Array.isArray(r.십성배치)) {
        const _posMap = {년간:'년주_천간십성', 년지:'년주_지지십성', 월간:'월주_천간십성', 월지:'월주_지지십성',
                          일간:'일주_천간십성', 일지:'일주_지지십성', 시간:'시주_천간십성', 시지:'시주_지지십성'};
        for (const item of r.십성배치) {
          const slot = _posMap[item.위치];
          if (slot && !d3[slot]) d3[slot] = item.십성명 || '';
        }
        // 십성배치목록 (parseSipseongBaechi 입력용)
        if (!d5['십성배치목록'] && !d3['십성배치목록']) {
          const list = r.십성배치.map(x =>
            `${x.위치==='일간'?'일간':x.위치}${x.글자||''}(${x.십성명})`
          ).join(' / ');
          d5['십성배치목록'] = list;
        }
      }
      // 이름·일주 보강
      if (!d3['이름']) d3['이름'] = m.이름;
      if (!d3['일주']) d3['일주'] = `${r.원국.일주.천간}${r.원국.일주.지지}(${_천간음[r.원국.일주.천간]||''}${_지지음[r.원국.일주.지지]||''})`;
      // 용신/신강약 보강
      if (!d5['신강약단'] && r.신강약) d5['신강약단'] = r.신강약.includes('강') ? '신강' : '신약';
      if (!d3['용신오행'] && !d5['용신오행'] && r.용신) d5['용신오행'] = r.용신;
    }
  } catch(e) { /* saju_calc 보강 실패 시 기존 데이터로 진행 */ }

  const name        = d3['이름'] || slotId;
  const 선생님이름 = d3['선생님이름'] || d5['선생님이름'] || '반야선생';
  const birthS      = d3['birth_solar'] || d3['생년월일'] || '';
  const gender      = d3['user_gender'] || d3['성별'] || '';
  const age         = d3['user_age']    || d3['나이'] || d5['만나이'] || '';
  const ilju        = d3['일주'] || '';
  const singang     = d5['신강약단'] || d5['신강약'] || '';
  const curDW       = d5['현재대운간지'] || '';
  const curDWChar   = d5['현재대운성격'] || '';
  const seunGJ      = d5['세운간지'] || '';
  const seunChar    = d5['세운성격'] || '';
  const _c8=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`),'utf-8')):{};
  const _c6=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`),'utf-8')):{};
  const yongOhaeng  = _c8['용신오행']||_c6['용신오행']||d3['용신오행']||d5['용신오행']||'';
  const gongmang1   = d3['공망1'] || '';
  const gongmang2   = d3['공망2'] || '';

  // 4기둥 한자 조합 (헤더용)
  const yearTg = d3['년주_천간'] || '';
  const yearJj = d3['년주_지지'] || '';
  const monTg  = d3['월주_천간'] || '';
  const monJj  = d3['월주_지지'] || '';
  const dayTg  = d3['일주_천간'] || '';
  const dayJj  = d3['일주_지지'] || '';
  const timTg  = d3['시주_천간'] || '';
  const timJj  = d3['시주_지지'] || '';
  const sajuStr = `${yearTg}${yearJj}-${monTg}${monJj}-${dayTg}${dayJj}-${timTg}${timJj}`;

  // 십성배치목록 파싱 (옛 포맷 호환)
  const baechiStr = d5['십성배치목록'] || d3['십성배치목록'] || '';
  let baechiMap = parseSipseongBaechi(baechiStr);

  // ── 4기둥 십성 데이터에서 직접 baechiMap 구성 (단일 소스) ──
  // d3에 채워진 {년주_천간십성, 년주_지지십성, ...} 8개 십성을 누적
  const _pillarSlots = [
    { key:'년간', tg:d3['년주_천간'], ss:d3['년주_천간십성'] },
    { key:'년지', tg:d3['년주_지지'], ss:d3['년주_지지십성'] },
    { key:'월간', tg:d3['월주_천간'], ss:d3['월주_천간십성'] },
    { key:'월지', tg:d3['월주_지지'], ss:d3['월주_지지십성'] },
    { key:'일간', tg:d3['일주_천간'], ss:d3['일주_천간십성'] || '일원(나)' },
    { key:'일지', tg:d3['일주_지지'], ss:d3['일주_지지십성'] },
    { key:'시간', tg:d3['시주_천간'], ss:d3['시주_천간십성'] },
    { key:'시지', tg:d3['시주_지지'], ss:d3['시주_지지십성'] },
  ];
  // 새 baechiMap 구성 (옛 포맷 파싱 실패 시에도 동작)
  if (Object.keys(baechiMap).length === 0) {
    baechiMap = {};
    for (const slot of _pillarSlots) {
      if (!slot.ss) continue;
      const ssNorm = String(slot.ss).replace('일원(日元)','일원(나)');
      if (!baechiMap[ssNorm]) baechiMap[ssNorm] = [];
      baechiMap[ssNorm].push({ pos: slot.key, hanja: slot.tg || '' });
    }
  }

  // 있는/없는 십성 목록 — d5 우선, 없으면 baechiMap에서 도출
  let existList   = (d5['있는십성목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  let missingList = (d5['없는십성목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  if (existList.length === 0) {
    existList = Object.keys(baechiMap).filter(ss => ss !== '일원(나)');
    const _all = TEN_STARS.map(t => t.ss);
    missingList = _all.filter(ss => !existList.includes(ss));
  }
  const existSet    = new Set(existList.map(s => s.replace('일원(日元)','일원(나)')));

  // 계열 정보
  let existGyeyeol  = (d5['있는계열목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  let missingGyeyeol = (d5['없는계열목록'] || '').split('·').map(s=>s.trim()).filter(Boolean);
  const gyeyeolCnt    = countByGyeyeol(baechiMap);
  if (existGyeyeol.length === 0) {
    existGyeyeol = Object.entries(gyeyeolCnt).filter(([,n])=>n>0).map(([g])=>g);
    const _allGy = ['비겁','식상','재성','관성','인성'];
    missingGyeyeol = _allGy.filter(g => !existGyeyeol.includes(g));
  }
  let maxGyeyeol    = d5['최다십성계열'] || '';
  let maxGyeyeolCnt = d5['최다십성계열수'] || '';
  if (!maxGyeyeol) {
    const _entries = Object.entries(gyeyeolCnt).sort((a,b)=>b[1]-a[1]);
    if (_entries.length && _entries[0][1] > 0) {
      maxGyeyeol    = _entries[0][0];
      maxGyeyeolCnt = _entries[0][1];
    }
  }

  // 4기둥 빌드
  const pillars = buildPillars(d3, d5, yongOhaeng, gongmang1, gongmang2);

  // 용신 문자
  const yongHanja = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水',
    木:'木', 火:'火', 土:'土', 金:'金', 水:'水',
    목:'木', 화:'火', 토:'土', 금:'金', 수:'水' };
  const yongH = yongHanja[yongOhaeng] || '';

  // ── pillar HTML ───────────────────────────────────
  function pillarHTML(p) {
    const tgColor = ohColor(p.tgOh);
    const jjColor = ohColor(p.jjOh);
    const tgSSNorm = (p.tgSS || '').replace('일원(日元)','일원(나)');
    const jjSSNorm = (p.jjSS || '').replace('일원(日元)','일원(나)');
    const tgGyeyeol = SS_TO_GYEYEOL[tgSSNorm] || '';
    const jjGyeyeol = SS_TO_GYEYEOL[jjSSNorm] || '';
    const tgBadgeBg = GYEYEOL_COLOR[tgGyeyeol] || (p.isIlju ? '#aaa' : '#888');
    const jjBadgeBg = GYEYEOL_COLOR[jjGyeyeol] || '#888';

    const isIljuBox   = p.isIlju ? 'border:2px solid #f44336;' : '';
    const hdBg        = p.isIlju ? 'background:#fff3e0;' : '';
    const hdLabelClr  = p.isIlju ? 'color:#f44336;' : 'color:#888;';
    const hdNameClr   = p.isIlju ? 'color:#e65100;' : 'color:#555;';
    const stemBg      = p.isIlju ? 'background:#fff8f5;' : 'background:transparent;';
    const branchBg    = p.isIlju ? 'background:#fff8f5;' : 'background:transparent;';

    // 신살 특별 처리 (일주)
    let sinsalStyle = 'font-size:6.5pt;color:#e65100;font-weight:700;text-align:center;padding:2px 3px;background:#fff3e0;border-radius:4px;border-top:1px solid #ffe0b2;min-height:10px;';
    if (p.isIlju && p.sinsal) sinsalStyle = 'font-size:6.5pt;font-weight:700;text-align:center;padding:2px 3px;background:#fce4ec;border-radius:4px;border-top:1px solid #f48fb1;min-height:10px;color:#c62828;';

    const tgYongMark  = p.tgIsYong && yongH ? `<span style="font-size:6pt;color:#f44336;font-weight:700;margin-left:2px;">← 用神!</span>` : '';
    const jjGongMark  = p.jjIsGongmang ? `<span style="font-size:6.5pt;color:#f44336;"> ⚡공망</span>` : '';

    return `
      <div class="pillar-box" style="${isIljuBox}">
        <div class="pb-hd" style="${hdBg}">
          <div class="pb-hd-label" style="${hdLabelClr}">${p.label}${p.isIlju ? ' ★나' : ''}</div>
          <div class="pb-hd-name" style="${hdNameClr}">${p.sub}</div>
        </div>
        <div class="pb-stem" style="${stemBg}">
          ${p.isIlju ? '<div class="ilgan-marker">일간(나)</div>' : ''}
          <div class="pb-hanja" style="color:${tgColor};">${p.tg || '?'}</div>
          <div class="pb-kr">${p.tgUm || ''}(${p.tg || ''}) · ${ohShort(p.tgOh)}${tgYongMark}</div>
          <div class="pb-sipseong" style="background:${tgBadgeBg};">${tgSSNorm || '—'}</div>
        </div>
        <div class="pb-branch" style="${branchBg}">
          <div class="pb-hanja" style="color:${jjColor};">${p.jj || '?'}</div>
          <div class="pb-kr">${p.jjUm || ''}(${p.jj || ''}) · ${ohShort(p.jjOh)}${jjGongMark}</div>
          <div class="pb-sipseong" style="background:${jjBadgeBg};">${jjSSNorm || '—'}</div>
        </div>
        <div style="${sinsalStyle}">${p.sinsal || '—'}</div>
      </div>`;
  }

  function ohShort(v) {
    const m = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' };
    return m[v] || v || '?';
  }

  // ── 십성 목록표 행 HTML ────────────────────────────
  let tableRows = '';
  let prevGyeyeol = '';
  for (let i = 0; i < TEN_STARS.length; i++) {
    const star = TEN_STARS[i];
    const gy   = star.gyeyeol;
    const isGroupStart = gy !== prevGyeyeol;
    const positions = baechiMap[star.ss] || [];
    const exists = existSet.has(star.ss) || positions.length > 0;
    const bg = exists ? '' : 'color:#bbb;';
    const gyColor = GYEYEOL_COLOR[gy] || '#888';
    prevGyeyeol = gy;

    // 존재 여부 칩
    const existChip = exists
      ? `<span style="display:inline-block;padding:1px 7px;border-radius:6px;font-size:7pt;font-weight:700;color:white;background:${gyColor};">✅ 있음</span>`
      : `<span style="display:inline-block;padding:1px 7px;border-radius:6px;font-size:7pt;font-weight:700;color:white;background:#bdbdbd;">❌ 없음</span>`;

    // 위치 칩
    let posCells = '';
    if (positions.length > 0) {
      posCells = positions.map(p =>
        `<span style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:7pt;font-weight:700;color:white;background:${gyColor};margin:1px;">${p.pos}</span>`
      ).join(' ');
    } else {
      posCells = `<span style="font-size:7pt;color:#ccc;">— 원국 없음</span>`;
    }

    // 계열 rowspan (2행 묶음)
    let gyCell = '';
    if (isGroupStart) {
      const gyBgColor = {
        '비겁':'#e8f5e9','식상':'#ffebee','재성':'#fff3e0','관성':'#f5f5f5','인성':'#e3f2fd'
      }[gy] || '#f5f5f5';
      const gyTextColor = {
        '비겁':'#2e7d32','식상':'#b71c1c','재성':'#e65100','관성':'#424242','인성':'#0d47a1'
      }[gy] || '#333';
      const isGyeyeolMissing = missingGyeyeol.includes(gy);
      gyCell = `<td rowspan="2" style="text-align:center;background:${gyBgColor};${isGyeyeolMissing ? 'opacity:0.5;' : ''}">
        <span style="font-size:7pt;font-weight:700;color:${gyTextColor};">${gy}<br>(${gyKR(gy)})</span>
      </td>`;
    }

    const trClass = isGroupStart ? 'class="group-start"' : '';

    tableRows += `
      <tr ${trClass}>
        ${gyCell}
        <td><span style="display:inline-block;padding:1px 7px;border-radius:6px;font-size:7pt;font-weight:700;color:white;background:${gyColor};">${star.ss}</span></td>
        <td style="text-align:center;">${existChip}</td>
        <td>${posCells}</td>
        <td style="${bg}"><strong>${star.meaning.split('.')[0]}.</strong> ${star.meaning.split('.').slice(1).join('.').trim()}</td>
        <td style="font-size:7pt;color:${exists ? '#555' : '#bbb'};">${star.domain}</td>
      </tr>`;
  }

  function gyKR(gy) {
    return { '비겁':'比劫', '식상':'食傷', '재성':'財星', '관성':'官星', '인성':'印星' }[gy] || gy;
  }

  // ── 없는 십성 칩 ──────────────────────────────────
  const missingChipColors = {
    '식신':'#ef5350','상관':'#e53935','편재':'#ffa726','정재':'#fb8c00',
    '편관':'#757575','정관':'#616161','편인':'#42a5f5','정인':'#1e88e5',
    '비견':'#66bb6a','겁재':'#43a047'
  };
  const missingChips = missingList
    .filter(s => !s.includes('일원'))
    .map(ss => `<span style="padding:2px 7px;border-radius:6px;font-size:7pt;font-weight:700;color:white;background:${missingChipColors[ss]||'#888'};border:1px solid rgba(0,0,0,.1);">${ss}</span>`)
    .join('\n');

  // 없는 계열 요약 텍스트
  const missingGyeText = missingGyeyeol.length
    ? missingGyeyeol.map(gy => {
      const desc = { '비겁':'자립심 약', '식상':'표현력 없음', '재성':'재물 기복', '관성':'권위 부재', '인성':'학문 약' };
      return `${gy} 없음 = ${desc[gy]||''}`;
    }).join(' · ')
    : '모든 계열 보유';

  // ── 계열 요약 행 ──────────────────────────────────
  const GYEYEOL_ORDER = ['비겁','식상','재성','관성','인성'];
  const GYEYEOL_MEANING = {
    '비겁': ['자립심·경쟁심', '강한 주체성'],
    '식상': ['창의·표현력', '없으면 실무형'],
    '재성': ['재물 기질', '안정 vs 변동'],
    '관성': ['원칙·명예', '책임 기질'],
    '인성': ['학문·보호', '공부로 성취']
  };
  const gyeyeolSummaryHTML = GYEYEOL_ORDER.map(gy => {
    const cnt = gyeyeolCnt[gy] || 0;
    const isMax = gy === maxGyeyeol;
    const missing = missingGyeyeol.includes(gy);
    const color = GYEYEOL_COLOR[gy];
    const stars = cnt === 0 ? '<span style="color:#ddd;">✕✕</span>' : '✅'.repeat(Math.min(cnt, 3)) + (isMax ? ' 최다' : '');
    const mean = GYEYEOL_MEANING[gy] || ['',''];
    return `<div style="flex:1;padding:3px 5px;text-align:center;border-right:1px solid #e0e0e0;display:flex;flex-direction:column;gap:2px;${missing ? 'background:#fff5f5;' : ''}">
      <div style="font-size:7pt;font-weight:700;color:${color};">${gy}(${gyKR(gy)})</div>
      <div style="font-family:'Noto Serif KR',serif;font-size:11pt;font-weight:700;line-height:1;color:${cnt===0?'#bdbdbd':color};">${cnt}</div>
      <div style="font-size:7pt;">${stars}</div>
      <div style="font-size:7pt;color:#888;line-height:1.3;">${mean[0]}<br>${cnt===0 ? missing ? '없음' : '0개' : mean[1]}</div>
    </div>`;
  }).join('');

  // ── 핵심 메모 ──────────────────────────────────────
  const maxGyeyeolDesc = { '비겁':'독립심·자립 기질이 강한', '식상':'창의·표현력이 풍부한',
    '재성':'재물 감각이 뛰어난', '관성':'원칙·명예를 중시하는', '인성':'학문·지식을 추구하는' };
  const memoText = maxGyeyeol
    ? `${name} 님의 사주에서 가장 주목할 것은 <strong style="color:${GYEYEOL_COLOR[maxGyeyeol]};">${maxGyeyeol}이 ${maxGyeyeolCnt}개</strong>로 최다 》 <strong>${maxGyeyeolDesc[maxGyeyeol]||''}</strong> 기질이 두드러집니다. ${missingGyeyeol.length ? `반면 <strong style="color:#f44336;">${missingGyeyeol.join('·')} 계열이 없어</strong> ${missingGyeText}에 해당합니다.` : '모든 십성 계열이 고루 분포되어 있습니다.'}`
    : `${name} 님의 십성 배치표입니다.`;

  // ── HTML 조립 ──────────────────────────────────────
  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>십성 배치표 》 ${name}님</title>
<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333;
  width:604px;
  max-height:840px;
  overflow:hidden;
  padding:2px 4px;
  background:transparent;
}
.page * { line-height:1.3; }
@media screen {
  body { background:#f5f5f5; }
  .page { border:1px solid #333; margin:20px auto;  background:transparent; border-radius:4px; }
}
@media print {
  body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  background:transparent; width:604px;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 840px; margin:0; }
}
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:1.5px solid #333; border-radius:11px; overflow:hidden; margin-top:3px; }
.card-hd { padding:4px 14px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:8.5pt; font-weight:900; color:white; }
.card-hd-sub   { font-size:7pt; color:rgba(255,255,255,.85); }
.wonkuk-section { padding:5px 12px 4px; background:#fafafa; border-bottom:1px solid #e0e0e0; }
.wk-title { font-size:7pt; font-weight:700; color:#888; margin-bottom:3px; letter-spacing:.5px; }
.pillar-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
.pillar-box { border:1.5px solid #333; border-radius:8px; overflow:hidden; display:flex; flex-direction:column; }
.pb-hd { text-align:center; padding:2px 4px; border-bottom:1px solid #e0e0e0; background:#f5f5f5; }
.pb-hd-label { font-size:7pt; font-weight:700; color:#888; }
.pb-hd-name  { font-size:7pt; font-weight:700; color:#555; }
.pb-stem   { padding:3px 4px; border-bottom:1px solid #e0e0e0; display:flex; flex-direction:column; align-items:center; gap:2px; }
.pb-branch { padding:3px 4px; display:flex; flex-direction:column; align-items:center; gap:2px; }
.pb-hanja  { font-family:'Noto Serif KR',serif; font-size:17pt; font-weight:800; line-height:1; }
.pb-kr     { font-size:7pt; color:#888; }
.pb-sipseong { font-size:7pt; font-weight:700; color:white; padding:1px 6px; border-radius:6px; }
.ilgan-marker { font-size:6.5pt; font-weight:900; color:white; background:#f44336; padding:1px 4px; border-radius:3px; margin-bottom:1px; }
.sipseong-table { width:100%; border-collapse:collapse; table-layout:fixed; }
.sipseong-table th { font-size:7pt; font-weight:700; color:#555; background:#f8f8f8; padding:1px 4px; border:1px solid #333; text-align:center; word-break:keep-all; overflow-wrap:break-word; }
.sipseong-table th:first-child { border-left:none; }
.sipseong-table th:last-child  { border-right:none; }
.sipseong-table thead tr th    { border-top:none; }
.sipseong-table td { border:1px solid #333; padding:2px 4px; vertical-align:middle; font-size:7pt; word-break:keep-all; overflow-wrap:break-word; line-height:1.4; }
.sipseong-table td:first-child { border-left:none; }
.sipseong-table td:last-child  { border-right:none; }
.sipseong-table tbody tr:last-child td { border-bottom:none; }
.sipseong-table tr.group-start td { border-top:1.5px solid #ccc; }
.memo { background:#f8f9fa; border:1.5px solid #333; border-radius:8px; padding:6px 10px; font-size:7pt; color:#555; line-height:1.6; }
</style>
</head>
<body>
<div class="page">
<div class="banner-hdr" style="background:linear-gradient(135deg,#283593,#3949ab);">
  <div>
    <div class="banner-hdr-title">⭐ 십성(十星) 배치표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${curDW?' · 대운 '+esc(curDW):''}</div>
  </div>
</div>
<div class="card">

  <!-- 헤더 -->
  <div class="card-hd" style="background:linear-gradient(135deg,#7b1fa2,#e91e63);">
    <div class="card-hd-title">⭐ 십성(十星) 배치표 》 내 하늘의 별자리</div>
    <div class="card-hd-sub">${name} 님 · ${sajuStr} · 있는 별과 없는 별</div>
  </div>

  <!-- 원국 배치도 -->
  <div class="wonkuk-section">
    <div class="wk-title">▼ 사주 원국 》 기둥별 십성 배치</div>
    <div class="pillar-grid">
      ${pillars.map(p => pillarHTML(p)).join('\n')}
    </div>
  </div>

  <!-- 십성 10개 목록표 -->
  <table class="sipseong-table">
    <thead>
      <tr>
        <th style="width:12mm;">계열</th>
        <th style="width:16mm;">십성</th>
        <th style="width:14mm;">유무</th>
        <th style="width:22mm;">위치</th>
        <th style="width:54mm;">의미·기질</th>
        <th style="width:30mm;">삶의 영역</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <!-- 없는 십성 -->
  <div style="padding:5px 12px;background:#fff8f8;border-top:1px solid #ffcdd2;display:flex;align-items:flex-start;gap:5px;">
    <span style="font-size:7pt;font-weight:700;color:#c62828;flex-shrink:0;padding-top:1px;">❌ 없는 십성</span>
    <div style="display:flex;flex-wrap:wrap;gap:3px;">
      ${missingChips || '<span style="font-size:7pt;color:#888;">모든 십성 보유</span>'}
      ${missingList.filter(s=>!s.includes('일원')).length > 0 ? `<span style="font-size:7pt;color:#e57373;align-self:center;">→ ${missingGyeText}</span>` : ''}
    </div>
  </div>

  <!-- 계열별 요약 -->
  <div style="display:flex;gap:0;border-top:1px solid #e0e0e0;">
    ${gyeyeolSummaryHTML}
    <div style="flex:1;padding:3px 5px;text-align:center;display:flex;flex-direction:column;gap:2px;">
      <div style="font-size:7pt;font-weight:700;color:#888;">최다계열</div>
      <div style="font-size:7pt;font-weight:900;color:${GYEYEOL_COLOR[maxGyeyeol]||'#333'};">${maxGyeyeol||'—'}</div>
      <div style="font-size:7pt;color:#888;">${maxGyeyeolCnt}개 · 최다</div>
      <div style="font-size:7pt;color:#888;line-height:1.3;">${missingGyeyeol.length ? `없는계열<br>${missingGyeyeol.join('·')}` : '없는계열 없음'}</div>
    </div>
  </div>

</div><!-- card -->

<!-- 핵심 메모 -->
<div class="memo">
  <strong style="color:#7b1fa2;font-size:7pt;">📌 ${선생님이름}의 십성 배치 핵심 요약</strong><br>
  ${memoText}
</div>

</div>
</body>
</html>`;

  // ── 단일 파일로 저장 ──────────────────────────────
  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '십성배치표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '십성배치표');
  console.log(`✅ 십성배치표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_십성배치표.js <slot_id>'); process.exit(1); }
generate(slotId);
