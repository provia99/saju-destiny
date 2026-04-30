#!/usr/bin/env node
/**
 * generate_사주원국요약.js
 * 사주 원국 요약표 (summary_appendix) 범용 generator
 * ──────────────────────────────────────────────────
 * node generate_사주원국요약.js <slot_id>
 * 출력: tables/{slot}/사주원국요약표.html  (A4 full-page)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

// ══ 오행 팔레트 (Material Design 계열, 원본 파일 동일) ══════
const OH_CSS = {
  wood:  { c:'#4caf50', t:'t-목', bg:'c-목', name:'木(목)', dir:'동(東)', season:'봄', time:'寅卯辰', color:'청색·녹색', short:'木' },
  fire:  { c:'#f44336', t:'t-화', bg:'c-화', name:'火(화)', dir:'남(南)', season:'여름', time:'巳午未', color:'적색·주황', short:'火' },
  earth: { c:'#ff9800', t:'t-토', bg:'c-토', name:'土(토)', dir:'중앙', season:'환절기', time:'辰戌丑未', color:'황색·갈색', short:'土' },
  metal: { c:'#9e9e9e', t:'t-금', bg:'c-금', name:'金(금)', dir:'서(西)', season:'가을', time:'申酉戌', color:'흰색·은색', short:'金' },
  water: { c:'#2196f3', t:'t-수', bg:'c-수', name:'水(수)', dir:'북(北)', season:'겨울', time:'亥子丑', color:'파란색·검정', short:'水' },
};
function ohKey(v) {
  if (!v) return null;
  const m = {
    wood:'wood', 木:'wood', 목:'wood',
    fire:'fire', 火:'fire', 화:'fire',
    earth:'earth', 土:'earth', 토:'earth',
    metal:'metal', 金:'metal', 금:'metal',
    water:'water', 水:'water', 수:'water',
  };
  if (m[v]) return m[v];
  // '金(금)' 등 복합 형식에서 첫 글자 추출
  const first = String(v).charAt(0);
  return m[first] || null;
}
function oh(v) { return OH_CSS[ohKey(v)] || OH_CSS.earth; }

// 십성 → 오행 그룹 색상
const SS_GROUP = {
  '비견':'#4caf50','겁재':'#4caf50',
  '식신':'#9c27b0','상관':'#9c27b0',
  '편재':'#ff9800','정재':'#ff9800',
  '편관':'#9e9e9e','정관':'#9e9e9e',
  '편인':'#2196f3','정인':'#2196f3',
  '일원(나)':'#aaa',
};
function ssColor(s) { return SS_GROUP[s] || '#888'; }

// 오행 등급 → 바 너비 %
const GRADE_WIDTH = {
  '매우강':95, '강':70, '중강':58, '보통':45,
  '약':28, '매우약':10, '중':45
};
function gradeWidth(g) {
  for (const [k,v] of Object.entries(GRADE_WIDTH)) {
    if (g && g.includes(k)) return v;
  }
  return 30;
}

// 합충형파해 타입 색상
const HCF_COLOR = {
  '천간합':'#4caf50', '지지합':'#9c27b0', '삼합':'#7b1fa2', '반합':'#ab47bc',
  '지지충':'#bdbdbd', '충':'#bdbdbd',
  '형':'#ff7043', '지지형':'#ff7043',
  '파':'#ff5722', '해':'#e91e63', '지지파해':'#e91e63',
};

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ══ 공망 위치 파악 ══════════════════════════════════════
function gongmangInPillar(d) {
  const g1 = d['공망1'] || '';
  const g2 = d['공망2'] || '';
  const result = {};
  ['년주','월주','일주','시주'].forEach(pk => {
    const jj = d[`${pk}_지지`] || '';
    if (jj === g1 || jj === g2) result[pk] = true;
  });
  return result;
}

// ══ 오행 방향/의미 설명 ══════════════════════════════════
const OH_TIP = {
  wood:  '🌳 강화', fire: '🔥 강화', earth: '🟡 안정', metal: '⚪ 관리', water: '💧 주의',
};
const YS_TIP = {
  yongsin: '강화', huisin: '보강', byeongsin: '주의', hansin: '관리',
};
const YS_LABEL = {
  yongsin: '用神(용신)', huisin: '喜神(희신)',
  byeongsin: '忌神(기신)', hansin: '閑神(한신)',
};

// ══ 합충형파해 파싱 ══════════════════════════════════════
function parseHCF(d) {
  const rows = [];
  // 천간합
  if (d['천간합목록'] && d['천간합목록'] !== '없음') {
    const chem = d['천간합화오행'] ? ` → 化${d['천간합화오행']}` : '';
    rows.push({ type:'천간합', color:'#4caf50',
      text:`<strong>${esc(d['천간합목록'])}${chem}</strong>` });
  } else {
    rows.push({ type:'천간합', color:'#bdbdbd', text:'없음 ✅' });
  }
  // 지지합
  if (d['지지합목록'] && d['지지합목록'] !== '없음') {
    rows.push({ type:'지지합', color:'#9c27b0', text:`<strong>${esc(d['지지합목록'])}</strong>` });
  } else {
    rows.push({ type:'지지합', color:'#bdbdbd', text:'없음 ✅' });
  }
  // 충
  if (d['지지충목록'] && d['지지충목록'] !== '없음') {
    rows.push({ type:'지지충', color:'#9e9e9e', text:`<strong>${esc(d['지지충목록'])}</strong>` });
  } else {
    rows.push({ type:'충', color:'#bdbdbd', text:'없음 ✅' });
  }
  // 형
  if (d['지지형목록'] && d['지지형목록'] !== '없음') {
    rows.push({ type:'지지형', color:'#ff7043', text:`<strong>${esc(d['지지형목록'])}</strong>` });
  } else {
    rows.push({ type:'형', color:'#bdbdbd', text:'없음 ✅' });
  }
  // 파·해
  if (d['지지파해목록'] && d['지지파해목록'] !== '없음') {
    rows.push({ type:'파·해', color:'#e91e63', text:`<strong>${esc(d['지지파해목록'])}</strong>` });
  } else {
    rows.push({ type:'파·해', color:'#bdbdbd', text:'없음 ✅' });
  }
  return rows;
}

// ══ 신살 분류 ════════════════════════════════════════════
function parseSinsal(raw) {
  if (!raw || raw === '없음') return [];
  return raw.split('/').map(s => s.replace(/<[^>]+>/g,'').trim()).filter(Boolean);
}

// ══ 메인 생성 ═════════════════════════════════════════════
// ── 대운목록 파싱 ────────────────────────────────────
function parseUnseList(text) {
  if (!text) return [];
  return text.split('\n').filter(Boolean).map(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 2) return null;
    return {
      gangi:    parts[0].replace(/^\d+기\s*/, '').trim(),  // "1기 癸丑(계축)" → "癸丑(계축)"
      ageRange: parts[1],
      unseChar: parts[4] || '',
    };
  }).filter(Boolean);
}
function dwChipColor(s) {
  if (s.includes('용신')) return '#2e7d32';
  if (s.includes('희신')) return '#1565c0';
  if (s.includes('기신')) return '#c62828';
  return '#666';
}

function generate(slotId) {
  const ch03File   = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch00File   = path.join(QUEUE_DIR, `${slotId}_ch00.json`);
  const ch08File   = path.join(QUEUE_DIR, `${slotId}_ch08.json`);
  const masterFile = path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`);

  const d  = JSON.parse(fs.readFileSync(ch03File, 'utf-8'));
  const c0 = fs.existsSync(ch00File) ? JSON.parse(fs.readFileSync(ch00File, 'utf-8')) : {};
  const c8 = fs.existsSync(ch08File) ? JSON.parse(fs.readFileSync(ch08File, 'utf-8')) : {};
  const mp = fs.existsSync(masterFile) ? JSON.parse(fs.readFileSync(masterFile, 'utf-8')) : {};

  // ── 기본 정보 ───────────────────────────────────────
  const name    = d['이름'] || slotId;
  const ilju    = d['일주'] || '';
  const iljuAni = d['ilju_animal'] || ilju;
  let birthS  = d['birth_solar'] || '';
  let birthL  = d['birth_lunar'] || '';
  const gender  = d['user_gender'] || c0['성별'] || '';
  const age     = d['user_age'] || c0['나이'] || '';
  const gyeok   = d['격국명'] || '';
  const sngYak  = d['신강약'] || mp['신강약'] || '';
  const g1      = d['공망1'] || '';
  const g2      = d['공망2'] || '';
  const gongPos = gongmangInPillar(d);

  // ── 용신 체계 (saju_calc 직접 계산으로 정확한 값 보장) ──
  const { 전체사주계산 } = require('./saju_calc');
  const _masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`) ;
  const _slotMaster = fs.existsSync(_masterPath) ? JSON.parse(fs.readFileSync(_masterPath,'utf8')) : null;
  const _masterDir = path.join(path.dirname(QUEUE_DIR), 'queue', slotId.split('/').slice(0,-1).join('/'));
  const _masterPath2 = path.join(_masterDir || '', 'master.json');
  const _M = _slotMaster || (fs.existsSync(_masterPath2) ? JSON.parse(fs.readFileSync(_masterPath2,'utf8')) : mp);
  let _calcResult = null;
  if (_M && _M.생년) {
    try {
      _calcResult = 전체사주계산({이름:_M.이름,성별:_M.성별,년:_M.생년,월:_M.생월,일:_M.생일,시간: _M.생시||'모름',음력입력:!!_M.음력입력,윤달:!!_M.윤달, self_q1: _M.self_q1, self_q2: _M.self_q2, self_q3: _M.self_q3, self_q4: _M.self_q4, self_q5: _M.self_q5, self_q6: _M.self_q6, self_q7: _M.self_q7,
});
    } catch(e) {}
  }
  const _cr = _calcResult || {};
  const yongK  = ohKey(_cr.용신 || d['용신오행'] || mp['용신오행'] || '');
  const huiK   = ohKey(_cr.희신 || d['희신오행'] || mp['희신오행'] || '');
  const byeongK= ohKey(_cr.기신 || d['기신오행'] || mp['기신오행'] || '');
  const hanK   = ohKey(_cr.한신 || d['한신오행'] || mp['한신오행'] || '');
  const yongC  = OH_CSS[yongK]   || OH_CSS.wood;
  const huiC   = OH_CSS[huiK]    || OH_CSS.water;
  const byeongC= OH_CSS[byeongK] || OH_CSS.metal;
  const hanC   = OH_CSS[hanK]    || OH_CSS.fire;

  // ── 생년월일 보정 (saju_calc 기준) ──
  if (_M && _M.생년) {
    if (_M.음력입력) birthL = `음력 ${_M.생년}년 ${_M.생월}월 ${_M.생일}일`;
    if (_calcResult?.양력정보) birthS = _calcResult.양력정보;
    if (_calcResult?.음력정보) birthL = `음력 ${_calcResult.음력정보}`;
  }

  // ── 오행 점수/등급 ─────────────────────────────────
  const SC = {
    '木': +(mp['목점수']||0), '火': +(mp['화점수']||0), '土': +(mp['토점수']||0),
    '金': +(mp['금점수']||0), '水': +(mp['수점수']||0),
  };
  const GR = {
    '木': d['木등급']||c0['木등급']||'—', '火': d['火등급']||c0['火등급']||'—',
    '土': d['土등급']||c0['土등급']||'—', '金': d['金등급']||c0['金등급']||'—',
    '水': d['水등급']||c0['水등급']||'—',
  };
  const scTotal = Object.values(SC).reduce((a,b)=>a+b,0) || 1;
  const scMax   = Math.max(...Object.values(SC)) || 1;

  // ── 합충형파해 ─────────────────────────────────────
  const hcfRows = parseHCF(d);

  // ── 대운 ──────────────────────────────────────────
  const curDW  = c8['현재대운간지'] || d['현재대운간지'] || c0['현재대운간지'] || '—';
  const curDWR = c8['현재대운나이범위'] || d['현재대운나이범위'] || c0['현재대운나이범위'] || '';
  const curDWS = c8['현재대운성격'] || c0['현재대운성격'] || '—';
  const curGi  = parseInt(c8['현재대운기']) || 0;
  const allDW  = parseUnseList(c8['대운목록_10기'] || '');

  // ── 신살 ──────────────────────────────────────────
  const guisinList = parseSinsal(d['귀인신살요약'] || c0['길신요약'] || '');
  const ssalList   = parseSinsal(d['흉살요약']     || c0['흉살요약'] || '');
  const gongList   = [g1, g2].filter(Boolean);

  // ── CSS (604×820px 정밀 맞춤) ────────────────────────
  const CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333;
  width:604px;
  max-height:840px;
  padding:6px 8px;
  background:transparent;
  display:flex; flex-direction:column; gap:4px;
  overflow:hidden;
}
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
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;flex-shrink:0; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white;display:flex;align-items:center;gap:5px; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:1.5px solid #333;border-radius:8px;overflow:hidden;flex-shrink:0; }
.card-hd { padding:4px 12px;display:flex;align-items:center;justify-content:space-between; }
.card-hd-title { font-size:8pt;font-weight:900;color:white; }
.card-hd-sub   { font-size:6pt;color:rgba(255,255,255,.85); }
.info-grid { display:grid;grid-template-columns:1fr 1fr;gap:0;background:transparent; }
.info-left { padding:6px 10px;border-right:1px solid #e0e0e0;display:flex;flex-direction:column;gap:3px; }
.info-right { padding:6px 10px; }
.info-row { display:flex;align-items:baseline;gap:5px; }
.ir-label { font-size:6pt;font-weight:700;color:#aaa;width:30px;flex-shrink:0; }
.ir-val   { font-size:7pt;color:#333;font-weight:500; }
.ir-val strong { color:#222; }
.pillar-mini { display:grid;grid-template-columns:repeat(4,1fr);gap:3px; }
.pm-col { border:1px solid #333;border-radius:6px;overflow:hidden;display:flex;flex-direction:column; }
.pm-hd  { background:#f5f5f5;text-align:center;padding:2px 3px;border-bottom:1px solid #e0e0e0; }
.pm-hd-lbl  { font-size:7pt;color:#aaa;font-weight:700; }
.pm-hd-name { font-size:7pt;font-weight:700;color:#555; }
.pm-stem,.pm-branch { text-align:center;padding:3px 2px;display:flex;flex-direction:column;align-items:center;gap:0; }
.pm-stem { border-bottom:1px solid #f0f0f0; }
.pm-hanja { font-family:'Noto Serif KR',serif;font-size:11pt;font-weight:800;line-height:1; }
.pm-kr    { font-size:6.5pt;color:#888; }
.pm-ss    { font-size:7pt;font-weight:700;color:white;padding:1px 4px;border-radius:5px; }
.pm-sinsal { font-size:6pt;color:#e65100;text-align:center;padding:1px 2px;background:#fff8f5;border-top:1px solid #ffe0b2;min-height:10px; }
.ilgan-dot { font-size:6.5pt;font-weight:900;color:#f44336; }
.gongmang-dot { font-size:6.5pt;color:#f44336;font-weight:700; }
.shin-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:transparent; }
.shin-item { padding:4px 5px;border-right:1px solid #e0e0e0;text-align:center;display:flex;flex-direction:column;gap:1px; }
.shin-item:last-child { border-right:none; }
.sh-num    { font-size:7pt;font-weight:700;letter-spacing:0.5px; }
.sh-circle { width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Noto Serif KR',serif;font-size:12pt;font-weight:800;color:white;margin:2px auto; }
.sh-ohaeng-kr { font-size:7pt;font-weight:700;margin-top:0; }
.sh-role   { font-size:7pt;font-weight:700;padding:1px 6px;border-radius:8px;color:white;display:inline-block;margin:2px auto 0; }
.sh-detail { font-size:7pt;color:#666;line-height:1.4;text-align:left;margin-top:1px;padding:2px 3px;background:#fafafa;border-radius:3px; }
.sh-detail-row { display:flex;justify-content:space-between;padding:0; }
.sh-detail-key { color:#aaa;font-weight:600; }
.sh-detail-val { color:#333;font-weight:700; }
.ohaeng-section { padding:5px 10px;background:transparent; }
.oh-title { font-size:6pt;font-weight:700;color:#555;margin-bottom:3px;display:flex;align-items:center;gap:4px; }
.oh-title::before { content:'';display:inline-block;width:2px;height:8px;background:#ff9800;border-radius:1px; }
.oh-bars { display:flex;flex-direction:column;gap:2px; }
.oh-row  { display:flex;align-items:center;gap:4px; }
.oh-label { font-size:7pt;font-weight:700;width:28px;text-align:right;flex-shrink:0; }
.oh-wrap  { flex:1;height:5px;background:#eee;border-radius:3px;overflow:hidden; }
.oh-bar   { height:100%;border-radius:3px; }
.oh-grade { font-size:7pt;font-weight:700;width:28px;flex-shrink:0; }
.oh-note  { font-size:7pt;color:#aaa; }
.hcf-section { padding:5px 10px;background:transparent; }
.hcf-title { font-size:6pt;font-weight:700;color:#555;margin-bottom:3px;display:flex;align-items:center;gap:4px; }
.hcf-title::before { content:'';display:inline-block;width:2px;height:8px;background:#9c27b0;border-radius:1px; }
.hcf-list  { display:flex;flex-direction:column;gap:2px; }
.hcf-row   { display:flex;align-items:flex-start;gap:5px; }
.hcf-type  { font-size:7pt;font-weight:700;color:white;padding:1px 5px;border-radius:4px;flex-shrink:0;width:36px;text-align:center; }
.hcf-content { font-size:6pt;color:#333;line-height:1.4; }
.daewoon-section { padding:5px 10px;background:transparent; }
.dw-title { font-size:6pt;font-weight:700;color:#555;margin-bottom:3px;display:flex;align-items:center;gap:4px; }
.dw-title::before { content:'';display:inline-block;width:2px;height:8px;background:#f44336;border-radius:1px; }
.dw-list { display:flex;gap:2px;flex-wrap:nowrap;overflow:hidden; }
.dw-chip { border:1px solid #333;border-radius:4px;padding:1px 3px;display:flex;flex-direction:column;align-items:center;gap:0;min-width:0;flex:1; }
.dw-ganji { font-family:'Noto Serif KR',serif;font-size:7pt;font-weight:800;line-height:1; }
.dw-age   { font-size:6pt;color:#888; }
.dw-grade { font-size:6.5pt;font-weight:700;color:white;padding:1px 3px;border-radius:3px; }
.dw-now   { border:1.5px solid #f44336 !important;background:#fff5f5; }
.sinsal-section { padding:3px 10px;background:transparent;display:flex;gap:6px; }
.ss-group { flex:1; }
.ss-group-title { font-size:7pt;font-weight:700;margin-bottom:2px; }
.ss-chips { display:flex;flex-wrap:wrap;gap:3px; }
.ss-chip  { font-size:7pt;font-weight:700;padding:2px 7px;border-radius:5px;color:white; }
.footer { margin-top:auto;padding-top:6px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0; }
.ft-note  { font-size:7pt;color:#bbb;line-height:1.6; }
.ft-brand { font-size:6.5pt;color:#999;font-weight:700;text-align:right; }
.c-화{background:#f44336;} .t-화{color:#f44336;}
.c-목{background:#4caf50;} .t-목{color:#4caf50;}
.c-수{background:#2196f3;} .t-수{color:#2196f3;}
.c-금{background:#9e9e9e;} .t-금{color:#9e9e9e;}
.c-토{background:#ff9800;} .t-토{color:#ff9800;}
.ss-비겁{background:#4caf50;} .ss-식상{background:#9c27b0;}
.ss-재성{background:#ff9800;} .ss-관성{background:#9e9e9e;} .ss-인성{background:#2196f3;}
</style>`;

  // ── 4기둥 미니 카드 생성 ───────────────────────────
  const PILLARS = ['년주','월주','일주','시주'];
  const P_LABELS = [['년주(年柱)','조상·초년'],['월주(月柱)','부모·직업'],['일주(日柱)★','나·배우자'],['시주(時柱)','자녀·말년']];

  function pillarCard(pk, isIlju) {
    const tgHan = d[`${pk}_천간`] || '';
    const tgEum = d[`${pk}_천간_음`] || '';
    const tgOh  = d[`${pk}_천간_오행`] || '';
    const tgSS  = d[`${pk}_천간십성`] || '';
    const jjHan = d[`${pk}_지지`] || '';
    const jjEum = d[`${pk}_지지_음`] || '';
    const jjOh  = d[`${pk}_지지_오행`] || '';
    const jjSS  = d[`${pk}_지지십성`] || '';
    const sinsal= d[`${pk}_신살_HTML`] || '';
    const tgC   = oh(tgOh);
    const jjC   = oh(jjOh);
    const isGong= gongPos[pk] ? true : false;
    const hdStyle = isIlju ? 'background:#fff3e0;' : '';
    const lblStyle= isIlju ? 'color:#f44336;' : '';
    const nmStyle = isIlju ? 'color:#e65100;' : '';
    const colStyle = isIlju ? 'border:2px solid #f44336;' : '';
    const stemStyle= isIlju ? 'background:#fff8f5;' : '';

    // 신살 파싱
    const ssText = sinsal.split(/<br\s*\/?>|\n/).map(s=>s.replace(/<[^>]+>/g,'').trim()).filter(Boolean).join('·') || '';

    return `<div class="pm-col" style="${colStyle}">
  <div class="pm-hd" style="${hdStyle}">
    <div class="pm-hd-lbl" style="${lblStyle}">${esc(P_LABELS[PILLARS.indexOf(pk)][0])}</div>
    <div class="pm-hd-name" style="${nmStyle}">${esc(P_LABELS[PILLARS.indexOf(pk)][1])}</div>
  </div>
  <div class="pm-stem" style="${stemStyle}">
    ${isIlju ? '<div class="ilgan-dot">일간(나)</div>' : ''}
    <div class="pm-hanja ${tgC.t}">${esc(tgHan)}</div>
    <div class="pm-kr">${esc(tgEum)} · ${tgC.short}</div>
    <div class="pm-ss" style="background:${ssColor(tgSS)};">${esc(tgSS)}</div>
  </div>
  <div class="pm-branch" style="${stemStyle}">
    <div class="pm-hanja ${jjC.t}">${esc(jjHan)}</div>
    <div class="pm-kr">${esc(jjEum)} · ${jjC.short}${isGong ? '<span class="gongmang-dot">⚡공망</span>' : ''}</div>
    <div class="pm-ss" style="background:${ssColor(jjSS)};">${esc(jjSS)}</div>
  </div>
  <div class="pm-sinsal" style="${isIlju ? 'background:#fce4ec;border-color:#f48fb1;color:#c62828;' : ''}">${esc(ssText) || '&nbsp;'}</div>
</div>`;
  }

  // ── 4신 카드 ──────────────────────────────────────
  function shinItem(num, label, role, ohK, tip) {
    if (!ohK) return '';
    const c = OH_CSS[ohK];
    const 건강맵 = {wood:'간·담·근육·눈',fire:'심장·혈관·혈압',earth:'위장·비장·소화기',metal:'폐·대장·피부',water:'신장·방광·뼈·귀'};
    return `<div class="shin-item">
  <div class="sh-num" style="color:${c.c};">${num} ${esc(label)}</div>
  <div class="sh-circle" style="background:${c.c};">${c.short}</div>
  <div class="sh-ohaeng-kr" style="color:${c.c};">${c.name}</div>
  <span class="sh-role" style="background:${c.c};">${esc(role)} · ${tip}</span>
  <div class="sh-detail">
    <div class="sh-detail-row"><span class="sh-detail-key">색상</span><span class="sh-detail-val">${c.color}</span></div>
    <div class="sh-detail-row"><span class="sh-detail-key">방위</span><span class="sh-detail-val">${c.dir}</span></div>
    <div class="sh-detail-row"><span class="sh-detail-key">계절</span><span class="sh-detail-val">${c.season}</span></div>
    <div class="sh-detail-row"><span class="sh-detail-key">시간</span><span class="sh-detail-val">${c.time}</span></div>
    <div class="sh-detail-row"><span class="sh-detail-key">건강</span><span class="sh-detail-val">${건강맵[ohK]||''}</span></div>
  </div>
</div>`;
  }

  // ── 오행 바 ───────────────────────────────────────
  const OH_ORDER = [
    {k:'木', t:'목', cls:'목', en:'wood'},
    {k:'火', t:'화', cls:'화', en:'fire'},
    {k:'土', t:'토', cls:'토', en:'earth'},
    {k:'金', t:'금', cls:'금', en:'metal'},
    {k:'水', t:'수', cls:'수', en:'water'},
  ];

  function ohBarRow(o) {
    const sc = SC[o.k] || 0;
    const gr = GR[o.k] || '—';
    const w  = gradeWidth(gr);
    const isYong  = (ohKey(o.k) === yongK);
    const isHui   = (ohKey(o.k) === huiK);
    const isByeong= (ohKey(o.k) === byeongK);
    const note = isYong ? '← 用神 강화 필요' : isHui ? '← 喜神 유지' : isByeong ? '← 忌神 주의' : '';
    const ohC = OH_CSS[o.en];
    return `<div class="oh-row">
  <span class="oh-label t-${o.cls}">${o.k}(${o.t})</span>
  <div class="oh-wrap"><div class="oh-bar c-${o.cls}" style="width:${w}%;"></div></div>
  <span class="oh-grade t-${o.cls}">${esc(gr)}</span>
  <span class="oh-note">${sc > 0 ? sc.toFixed(2)+'점' : ''} ${note}</span>
</div>`;
  }

  // ── 대운 칩 ───────────────────────────────────────
  function dwGradeStyle(s) {
    if (!s) return { bg:'#bdbdbd', label:'—' };
    if (s.includes('용신')) return { bg:'#f44336', label:'🌟용신' };
    if (s.includes('희신')) return { bg:'#4caf50', label:'희신' };
    if (s.includes('기신')) return { bg:'#2196f3', label:'기신' };
    return { bg:'#9e9e9e', label:'중립' };
  }
  const curSty = dwGradeStyle(curDWS);

  // ── 공통 헤더 정보 ────────────────────────────────────
  const hdrInfoLine = `${esc(birthS)}${gender?' · '+esc(gender):''}${age?' · '+esc(age)+'세':''}${ilju?' · 일주 '+esc(ilju):''}`;

  // ── 표1: ①기본정보 + ②용신체계 ─────────────────────
  const H1 = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>사주 원국 요약표 1 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#1a237e,#4a148c);">
  <div>
    <div class="banner-hdr-title">📋 사주 원국 요약표</div>
    <div class="banner-hdr-sub">기본정보 · 용신체계 · 오행 · 대운 · 신살</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">${esc(birthS)}${gender?' · '+esc(gender):''}${age?' · '+esc(age)+'세':''} · ${esc(ilju)} · ${esc(sngYak)}</div>
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#475569,#64748b);">
    <div class="card-hd-title">① 기본 정보 · 사주 원국</div>
    <div class="card-hd-sub">출생정보 · 일주 · 격국 · 신강약 · 네 기둥 팔자</div>
  </div>
  <div class="info-grid">
    <div class="info-left">
      <div class="info-row"><span class="ir-label">생년월일</span><span class="ir-val">${esc(birthS)}</span></div>
      <div class="info-row"><span class="ir-label">음력</span><span class="ir-val">${esc(birthL)}</span></div>
      <div class="info-row"><span class="ir-label">성별·나이</span><span class="ir-val">${esc(gender)} · ${esc(age)}세</span></div>
      <div class="info-row"><span class="ir-label">일주</span><span class="ir-val"><strong>${esc(ilju)}</strong> ${esc(iljuAni)}</span></div>
      <div class="info-row"><span class="ir-label">격국</span><span class="ir-val">${esc(gyeok)}</span></div>
      <div class="info-row"><span class="ir-label">신강약</span><span class="ir-val"><strong style="color:${sngYak.includes('신강')?'#8b0000':'#1a5276'};">${esc(sngYak)}</strong></span></div>
      <div class="info-row"><span class="ir-label">공망</span><span class="ir-val"><strong style="color:#c62828;">${esc(g1)} · ${esc(g2)}</strong></span></div>
      <div class="info-row"><span class="ir-label">현재대운</span><span class="ir-val"><strong>${esc(curDW)}</strong> ${esc(curDWR)} <span style="background:${curSty.bg};color:white;padding:1px 5px;border-radius:4px;font-size:6pt;">${curSty.label}</span></span></div>
    </div>
    <div class="info-right">
      <div class="pillar-mini">
        ${PILLARS.map((pk,i) => pillarCard(pk, i===2)).join('')}
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#e65100,#f44336);">
    <div class="card-hd-title">② 용신 체계 (用神 體系)</div>
    <div class="card-hd-sub">用神 · 喜神 · 忌神 · 閑神 》 오행 방위·색상·계절</div>
  </div>
  <div class="shin-grid">
    ${shinItem('①','用神(용신)','강화 핵심',yongK,YS_TIP.yongsin)}
    ${shinItem('②','喜神(희신)','도움 유지',huiK,YS_TIP.huisin)}
    ${shinItem('③','忌神(기신)','제어 주의',byeongK,YS_TIP.byeongsin)}
    ${shinItem('④','閑神(한신)','중립 관리',hanK,YS_TIP.hansin)}
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1565c0,#7b1fa2);">
    <div class="card-hd-title">③ 오행 분포 · 합충형파해</div>
    <div class="card-hd-sub">木火土金水 강약 분포 / 천간합·지지합·충·형·파해</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
    <div class="ohaeng-section">
      <div class="oh-title">오행 강약 분포</div>
      <div class="oh-bars">
        ${OH_ORDER.map(o=>ohBarRow(o)).join('')}
      </div>
    </div>
    <div class="hcf-section">
      <div class="hcf-title">합충형파해</div>
      <div class="hcf-list">
        ${hcfRows.map(r=>`<div class="hcf-row">
          <span class="hcf-type" style="background:${r.color};">${esc(r.type)}</span>
          <span class="hcf-content">${r.text}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#2e7d32,#388e3c);">
    <div class="card-hd-title">④ 대운 흐름 · 신살</div>
    <div class="card-hd-sub">大運 10기 전체 흐름 / 吉神 · 凶殺 · 空亡</div>
  </div>
  <div class="daewoon-section">
    <div class="dw-title">대운 (大運) 전체 흐름</div>
    <div class="dw-list">
      ${allDW.filter(dw => {
        const age = parseInt((dw.ageRange||'').match(/(\d+)/)?.[1]||'0');
        return age < 98;
      }).map((dw,idx) => {
        const isPast = (idx+1) < curGi;
        const isCur  = (idx+1) === curGi;
        const st = dwGradeStyle(dw.unseChar);
        return `<div class="dw-chip${isCur?' dw-now':''}" style="${isPast?'opacity:.5;border-color:#bbb;':isCur?'':'border-color:'+st.bg+';'}">
          <span class="dw-ganji" style="color:${isPast?'#aaa':st.bg};">${esc(dw.gangi)}</span>
          <span class="dw-age">${esc(dw.ageRange)}${isCur?' ▶':''}</span>
          <span class="dw-grade" style="background:${isPast?'#bbb':st.bg};">${st.label}</span>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div class="sinsal-section">
    <div class="ss-group">
      <div class="ss-group-title" style="color:#1565c0;">귀인·길신</div>
      <div class="ss-chips">
        ${guisinList.length
          ? guisinList.map(s=>`<span class="ss-chip" style="background:#ffd54f;color:#333;">${esc(s.match(/(.+?)\(/)?.[1]?.trim()||s.substring(0,8))}</span>`).join('')
          : '<span style="font-size:7pt;color:#aaa;">없음</span>'}
      </div>
    </div>
    <div class="ss-group">
      <div class="ss-group-title" style="color:#c62828;">흉살·주의</div>
      <div class="ss-chips">
        ${ssalList.length
          ? ssalList.map(s=>`<span class="ss-chip" style="background:#ffcdd2;color:#b71c1c;">${esc(s.match(/(.+?)\(/)?.[1]?.trim()||s.substring(0,8))}</span>`).join('')
          : '<span style="font-size:7pt;color:#aaa;">없음</span>'}
      </div>
    </div>
    ${gongList.length ? `<div class="ss-group">
      <div class="ss-group-title" style="color:#f44336;">공망 (空亡)</div>
      <div class="ss-chips">
        ${gongList.map(s=>`<span class="ss-chip" style="background:#ffcdd2;color:#c62828;">${esc(s)}</span>`).join('')}
      </div>
    </div>` : ''}
  </div>
</div>

</div></body></html>`;

  // ── 저장 (통합 1장) ─────────────────────────────────
  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile1 = path.join(outDir, '사주원국요약표.html');
  fs.writeFileSync(outFile1, H1, 'utf-8');
  console.log(`✅ 사주원국요약표 생성: ${outFile1}  (${fs.statSync(outFile1).size.toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_사주원국요약.js <slot_id>'); process.exit(1); }
generate(slotId);
