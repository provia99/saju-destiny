#!/usr/bin/env node
// generate_격국분석표.js
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch06.json
// 출력: tables/{slot}/격국분석표.html (단일 파일)
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 오행 키 → 첫 글자 추출 fallback
function ohKey(s) {
  if (!s) return '';
  const map = { '목':'木','화':'火','토':'土','금':'金','수':'水',
                'wood':'木','fire':'火','earth':'土','metal':'金','water':'水' };
  for (const [k,v] of Object.entries(map)) {
    if (s.toLowerCase().includes(k)) return v;
  }
  // fallback: 첫 글자 추출
  return s.charAt(0);
}

// ── 격국별 정보 ────────────────────────────────────────────────
const GYEOKGUK_INFO = {
  '정관격': {
    color:'#1565c0', bg:'#e3f2fd',
    trait:'규칙·질서·명예·공직',
    strength:'책임감, 도덕성, 신뢰, 안정적 직장운',
    weakness:'융통성 부족, 규칙에 얽매임, 보수적',
    career:'공무원·법조·교육·금융·대기업',
    yongsin:'용신이 재성이면 관성 강화, 인성이면 명예 유지',
  },
  '편관격': {
    color:'#b71c1c', bg:'#ffebee',
    trait:'강한 의지·투쟁·리더십·권위',
    strength:'추진력, 결단력, 리더십, 위기 대처 능력',
    weakness:'독선·과도한 경쟁심·충동적 결정',
    career:'군인·경찰·스포츠·외과의·정치·사업가',
    yongsin:'인성으로 살인상생하면 길, 식상 제살이면 재능 발휘',
  },
  '정재격': {
    color:'#2e7d32', bg:'#e8f5e9',
    trait:'안정적 재물·근면·성실·현실적',
    strength:'성실함, 근면, 재물 관리 능력, 책임감',
    weakness:'소심함, 과도한 절약, 모험 회피',
    career:'금융·회계·부동산·농업·자영업',
    yongsin:'비겁으로 신강하면 관성으로 제어, 인성 보완',
  },
  '편재격': {
    color:'#e65100', bg:'#fff3e0',
    trait:'활동적 재물·사업·투자·사교적',
    strength:'사교력, 사업 감각, 재물 획득, 활동적',
    weakness:'재물 유동성 큼, 낭비, 이성 문제',
    career:'사업가·무역·투자·유통·영업·연예',
    yongsin:'식상 생재 흐름이면 사업 성공, 비겁 탈재 주의',
  },
  '식신격': {
    color:'#00695c', bg:'#e0f2f1',
    trait:'창의·복록·음식·예술·자유',
    strength:'창의력, 복록, 낙천성, 예술적 감각, 식복',
    weakness:'지나친 낙관, 게으름, 관성 약화',
    career:'요리·예술·디자인·연구·강사·복지',
    yongsin:'재성으로 흘러가면 재물복, 인성과 균형이 중요',
  },
  '상관격': {
    color:'#880e4f', bg:'#fce4ec',
    trait:'표현·혁신·예술·자유·반항',
    strength:'표현력, 창의성, 독창적 아이디어, 언변',
    weakness:'관성 극하여 직장 불안, 구설수, 반항심',
    career:'언론·예술·음악·작가·IT·프리랜서',
    yongsin:'재성이 통관하면 길, 인성 제상 주의',
  },
  '편인격': {
    color:'#4a148c', bg:'#f3e5f5',
    trait:'직관·연구·예술·독립·영적',
    strength:'직관력, 연구심, 독창성, 예술성',
    weakness:'인내심 부족, 고독, 식신 극(도식)',
    career:'연구·종교·철학·예술·의료·상담',
    yongsin:'재성으로 인성 제어하면 길, 식신 보호 중요',
  },
  '정인격': {
    color:'#1a237e', bg:'#e8eaf6',
    trait:'학문·모성·배움·명예·안정',
    strength:'학습 능력, 명예, 도덕성, 안정적 환경',
    weakness:'의존성, 지나친 보수주의, 실행력 부족',
    career:'교육·학문·종교·출판·복지·행정',
    yongsin:'관성이 인성 생하면 명예 상승, 재성 제인 주의',
  },
  '비견격': {
    color:'#455a64', bg:'#eceff1',
    trait:'자립·독립·경쟁·협력',
    strength:'독립심, 자존감, 끈기, 자립심',
    weakness:'고집, 동업 손실, 재물 분산',
    career:'자영업·스포츠·컨설팅·전문직',
    yongsin:'관성으로 비겁 제어, 재성이 재물 확보',
  },
  '겁재격': {
    color:'#bf360c', bg:'#fbe9e7',
    trait:'투쟁·경쟁·강한 추진력',
    strength:'추진력, 결단력, 도전 정신',
    weakness:'재물 손실, 동업 분쟁, 충동적',
    career:'스포츠·사업·영업·경쟁 직종',
    yongsin:'관성으로 겁재 제어, 식상으로 설기 필요',
  },
};

function getGyeokInfo(name) {
  // 격국명에서 핵심 키워드 매칭
  for (const [key, val] of Object.entries(GYEOKGUK_INFO)) {
    if (name && name.includes(key)) return { key, ...val };
  }
  return { key:'기타', color:'#607d8b', bg:'#eceff1',
    trait:'개인 특성', strength:'사주 구조 분석 필요',
    weakness:'—', career:'—', yongsin:'—' };
}

function generate(slotId) {
  const d3 = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_ch03.json`), 'utf-8'));
  const d6 = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_ch06.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_ch06.json`), 'utf-8')) : {};

  // ── saju_calc 직접 계산 (정확한 값 보장) ──────────────────────
  let _calcResult = null;
  try {
    const { 전체사주계산 } = require('./saju_calc');
    let _masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
    if (!fs.existsSync(_masterPath)) _masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
    if (!fs.existsSync(_masterPath)) {
      const _sd = path.dirname(path.join(QUEUE_DIR, `${slotId}_ch03.json`));
      if (fs.existsSync(_sd)) {
        const _g = fs.readdirSync(_sd).filter(f => f === 'master.json');
        if (_g.length) _masterPath = path.join(_sd, _g[0]);
      }
    }
    if (fs.existsSync(_masterPath)) {
      const _M = JSON.parse(fs.readFileSync(_masterPath, 'utf8'));
      if (_M.생년) {
        _calcResult = 전체사주계산({이름:_M.이름, 성별:_M.성별, 년:_M.생년, 월:_M.생월, 일:_M.생일, 시간: _M.생시||'모름', 음력입력:!!_M.음력입력, 윤달:!!_M.윤달, self_q1: _M.self_q1, self_q2: _M.self_q2, self_q3: _M.self_q3, self_q4: _M.self_q4, self_q5: _M.self_q5, self_q6: _M.self_q6, self_q7: _M.self_q7,
});
      }
    }
  } catch(e) { /* saju_calc 실패 시 기존 ch*.json 값 사용 */ }

  // saju_calc 결과로 핵심 값 보정
  if (_calcResult) {
    const _oh = {木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'};
    if (_calcResult.용신) { d6['용신오행'] = _oh[_calcResult.용신] || _calcResult.용신; d3['용신오행'] = d6['용신오행']; }
    if (_calcResult.희신) { d6['희신오행'] = _oh[_calcResult.희신] || _calcResult.희신; d3['희신오행'] = d6['희신오행']; }
    if (_calcResult.기신) { d6['기신오행'] = _oh[_calcResult.기신] || _calcResult.기신; d3['기신오행'] = d6['기신오행']; }
    if (_calcResult.억부용신) { d6['억부용신'] = _oh[_calcResult.억부용신] || _calcResult.억부용신; d3['억부용신'] = d6['억부용신']; }
    if (_calcResult.조후용신) { d6['조후용신'] = _oh[_calcResult.조후용신] || _calcResult.조후용신; d3['조후용신'] = d6['조후용신']; }
    if (_calcResult.신강약) { d6['신강약'] = _calcResult.신강약; d3['신강약'] = _calcResult.신강약; }
    if (_calcResult.격국명 || _calcResult.格국명) { const _gk = _calcResult.격국명 || _calcResult.格국명; d6['격국명'] = _gk; d3['격국명'] = _gk; }
  }

  // 인적사항
  const name   = d3['이름']        || slotId;
  const birthS = d3['birth_solar'] || d3['생년월일'] || '';
  const gender = d3['user_gender'] || d3['성별']    || '';
  const age    = d3['user_age']    || d3['나이']    || '';
  const ilju   = d3['일주']        || '';

  // 격국·신강약
  const gyeokNm     = d3['격국명'] || d6['격국명'] || '';
  const sinGangYak  = d3['신강약'] || d6['신강약'] || '';
  const sinGangDan  = d3['신강약단'] || '';
  const byeonGyeok  = d6['변격판정'] || '';
  const byeonYiyu   = d6['변격이유'] || '';
  const jongGyeok   = d6['종격명']  || '';
  const jongYN      = d6['종격_여부'] || 'N';
  const hwaGyeok    = d6['화격_여부'] || 'N';

  // 용신
  const yongOh   = d6['용신오행']      || d3['용신오행']      || '';
  const huiOh    = d6['희신오행']      || d3['희신오행']      || '';
  const byeongOh = d6['기신오행']      || d3['기신오행']      || '';
  const yongPrin = d6['용신도출원리']  || '';
  const eokBu    = d6['억부용신']      || '';
  const joHu     = d6['조후용신']      || '';
  const yongDirect = d6['용신방위']    || '';
  const yongColor  = d6['용신색상']    || '';
  const yongJobGun = d6['용신직업군']  || '';

  // 신강약 세부
  const gangDo   = d6['일간강도수치']  || '';
  const gangGrade= d6['일간강도등급']  || '';
  const gangIyu  = d6['신강약도출이유']|| '';
  const wolRyeong= d6['월령득실']      || '';
  const ohDistrib= d6['오행분포요약']  || '';
  const taeGwa   = d6['태과오행']      || '';
  const bulGup   = d6['불급오행']      || '';

  // 격국 정보
  const gInfo = getGyeokInfo(gyeokNm);

  // 신강약 색상
  function sinColor(s) {
    if (!s) return '#888';
    if (s.includes('신강')) return '#1565c0';
    if (s.includes('신약')) return '#c62828';
    return '#2e7d32';
  }

  // 오행 색상
  const OH_COLOR = { wood:'#4caf50', fire:'#f44336', earth:'#ff9800', metal:'#9e9e9e', water:'#2196f3',
    木:'#4caf50', 火:'#f44336', 土:'#ff9800', 金:'#9e9e9e', 水:'#2196f3' };
  function ohColor(str) {
    for (const [k,v] of Object.entries(OH_COLOR)) if (str && str.includes(k)) return v;
    return '#888';
  }

  // ── CSS (약 20% 축소된 padding/margin/font-size/gap) ───────
  const CSS = `
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; max-height:840px; overflow:hidden; padding:6px 8px; background:transparent; display:flex; flex-direction:column; gap:5px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 840px; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:1.5px solid #ccc;border-radius:8px;overflow:hidden; }
.card-hd { padding:5px 11px;display:flex;align-items:center;justify-content:space-between; }
.card-hd-title { font-size:7.5pt;font-weight:900;color:white; }
.card-hd-sub { font-size:7pt;color:rgba(255,255,255,.85); }
.card-body { padding:7px 11px;background:transparent; }
.gk-banner { display:flex;align-items:center;gap:10px;padding:8px 11px;border-radius:6px;background:${gInfo.bg};border:1.5px solid ${gInfo.color}; }
.gk-char   { font-size:26pt;font-weight:900;color:${gInfo.color};line-height:1;flex-shrink:0; }
.gk-info   { flex:1; }
.gk-name   { font-size:10pt;font-weight:900;color:${gInfo.color};margin-bottom:1px; }
.gk-trait  { font-size:6.5pt;color:#555;font-weight:700;margin-bottom:3px; }
.gk-badges { display:flex;flex-wrap:wrap;gap:3px; }
.gk-badge  { font-size:7pt;font-weight:700;padding:1px 6px;border-radius:4px;border:1.5px solid ${gInfo.color};color:${gInfo.color}; }
.attr-grid { display:grid;grid-template-columns:1fr 1fr;gap:5px; }
.attr-item { border-radius:5px;padding:6px 8px;border:1.5px solid #e0e0e0; }
.attr-lbl  { font-size:7pt;font-weight:700;color:#888;margin-bottom:2px; }
.attr-val  { font-size:6pt;font-weight:700;color:#333;line-height:1.4; }
.yong-row { display:flex;gap:5px; }
.yong-item { flex:1;border-radius:5px;padding:5px 8px;border:1.5px solid; }
.yong-lbl  { font-size:7pt;font-weight:700;color:#888;margin-bottom:2px; }
.yong-val  { font-size:8pt;font-weight:900;line-height:1; }
.yong-sub  { font-size:7pt;color:#888;margin-top:1px; }
.class-row { display:flex;gap:5px;flex-wrap:wrap; }
.class-chip { font-size:7pt;font-weight:700;padding:2px 8px;border-radius:5px;border:1.5px solid; }
.oh-dist { font-size:7pt;color:#555;padding:5px 8px;background:#f8f8f8;border-radius:5px;line-height:1.7; }
.oh-dist b { color:#222; }
.gauge-wrap { display:flex;align-items:center;gap:6px;margin-top:4px; }
.gauge-bar { flex:1;height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden; }
.gauge-fill { height:6px;border-radius:3px; }
.gauge-label { font-size:7pt;color:#888;min-width:26px;text-align:right; }
.job-chips { display:flex;flex-wrap:wrap;gap:3px;margin-top:4px; }
.job-chip { font-size:7pt;font-weight:700;padding:1px 6px;border-radius:4px;border:1.5px solid; }
.advice-box { padding:6px 10px;border-radius:6px;border:1.5px solid;margin-top:4px; }
.advice-lbl { font-size:7pt;font-weight:700;margin-bottom:2px; }
.advice-txt { font-size:7pt;color:#333;line-height:1.6; }`;

  // ── 공통 헤더 정보 ────────────────────────────────────
  const hdrInfoLine = `${esc(birthS)}${gender?' · '+esc(gender):''}${age?' · '+esc(age)+'세':''}${ilju?' · 일주 '+esc(ilju):''}`;
  const hdrSubLine  = `${gyeokNm?esc(gyeokNm):''}${sinGangYak?' · '+esc(sinGangYak):''}`;

  // 격국명 첫 글자 (fallback 포함)
  const gyeokChar = gyeokNm ? gyeokNm.charAt(0) : '格';

  // ── 단일 HTML: ①격국 + ②신강약 + ③용신도출 + ④활용전략 ──
  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>격국 분석표 》 ${esc(name)}님</title>
  <style>
${FONT_FACE_CSS}${CSS}
  </style>
</head>
<body>
  <div class="page">

    <div class="banner-hdr" style="background:linear-gradient(135deg,#1a237e,#4a148c);">
  <div>
    <div class="banner-hdr-title">📋 격국(格局) 분석표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${sinGangYak?' · '+esc(sinGangYak):''}</div>
  </div>
</div>

    <!-- ① 격국 핵심 -->
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,${gInfo.color},${gInfo.color}cc);">
        <div class="card-hd-title">① 격국(格局) 》 ${esc(gyeokNm)}</div>
        <div class="card-hd-sub">${esc(byeonGyeok)||'내격(內格)'} · ${esc(sinGangYak)}</div>
      </div>
      <div class="card-body">
        <div class="gk-banner" style="margin-bottom:7px;">
          <div class="gk-char">${esc(gyeokChar)}</div>
          <div class="gk-info">
            <div class="gk-name">${esc(gyeokNm)}</div>
            <div class="gk-trait">${esc(gInfo.trait)}</div>
            <div class="gk-badges">
              ${gInfo.career.split('·').map(c => `<span class="gk-badge">${esc(c.trim())}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="attr-grid">
          <div class="attr-item" style="border-color:${gInfo.color}33;">
            <div class="attr-lbl">✅ 강점</div>
            <div class="attr-val">${esc(gInfo.strength)}</div>
          </div>
          <div class="attr-item" style="border-color:#f4433633;">
            <div class="attr-lbl">⚠️ 주의</div>
            <div class="attr-val">${esc(gInfo.weakness)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ② 신강약 + 격국 분류 -->
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
        <div class="card-hd-title">② 신강약(身强弱) 판단</div>
        <div class="card-hd-sub">일간의 힘·세력 분석 결과</div>
      </div>
      <div class="card-body">
        <div class="attr-grid" style="margin-bottom:5px;">
          <div class="attr-item" style="border-color:${sinColor(sinGangYak)}44;background:${sinColor(sinGangYak)}0d;">
            <div class="attr-lbl">신강약 판정</div>
            <div class="attr-val" style="font-size:9pt;color:${sinColor(sinGangYak)};">${esc(sinGangYak)}</div>
            ${gangDo?`<div class="gauge-wrap">
              <div class="gauge-bar"><div class="gauge-fill" style="width:${Math.min(parseInt(gangDo)||50,100)}%;background:${sinColor(sinGangYak)};"></div></div>
              <span class="gauge-label">${esc(gangDo)}%</span>
            </div>`:''}
          </div>
          <div class="attr-item">
            <div class="attr-lbl">격국 분류 · 월령</div>
            <div class="class-row" style="margin-top:2px;margin-bottom:3px;">
              <span class="class-chip" style="border-color:#1565c0;color:#1565c0;background:#e3f2fd;">${esc(byeonGyeok)||'내격(內格)'}</span>
              ${jongYN==='Y'&&jongGyeok?`<span class="class-chip" style="border-color:#880e4f;color:#880e4f;background:#fce4ec;">${esc(jongGyeok)}</span>`:''}
              ${hwaGyeok==='Y'?`<span class="class-chip" style="border-color:#e65100;color:#e65100;background:#fff3e0;">화격(化格)</span>`:''}
            </div>
            ${wolRyeong?`<div style="font-size:7pt;color:#777;">월령 : <b style="color:#333;">${esc(wolRyeong)}</b></div>`:''}
          </div>
        </div>
        ${ohDistrib?`<div class="oh-dist" style="margin-bottom:5px;">
          <b>오행 분포</b> · ${esc(ohDistrib)}
          ${taeGwa?`<span style="margin-left:6px;color:#c62828;">태과(太過): <b>${esc(taeGwa)}</b></span>`:''}
          ${bulGup?`<span style="margin-left:6px;color:#1565c0;">불급(不及): <b>${esc(bulGup)}</b></span>`:''}
        </div>`:''}
        ${gangIyu?`<div style="padding:5px 8px;background:#f5f5f5;border-radius:5px;font-size:7pt;color:#555;line-height:1.5;">💡 ${esc(gangIyu)}</div>`
        :byeonYiyu?`<div style="padding:5px 8px;background:#f5f5f5;border-radius:5px;font-size:7pt;color:#555;line-height:1.5;">${esc(byeonYiyu)}</div>`:''}
      </div>
    </div>

    <!-- ③ 용신 도출 원리 -->
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,#e65100,#f57c00);">
        <div class="card-hd-title">③ 용신(用神) 도출 원리</div>
        <div class="card-hd-sub">억부·조후 분석 기반 용신 설정</div>
      </div>
      <div class="card-body">
        <div class="yong-row" style="margin-bottom:5px;">
          <div class="yong-item" style="border-color:${ohColor(yongOh)};background:${ohColor(yongOh)}18;">
            <div class="yong-lbl">用神 (용신)</div>
            <div class="yong-val" style="color:${ohColor(yongOh)};">${esc(yongOh)}</div>
            <div class="yong-sub">${yongDirect?'방위 '+esc(yongDirect):''} ${yongColor?'· 색상 '+esc(yongColor):''}</div>
          </div>
          <div class="yong-item" style="border-color:${ohColor(huiOh)};background:${ohColor(huiOh)}18;">
            <div class="yong-lbl">喜神 (희신)</div>
            <div class="yong-val" style="color:${ohColor(huiOh)};">${esc(huiOh)}</div>
          </div>
          <div class="yong-item" style="border-color:${ohColor(byeongOh)};background:${ohColor(byeongOh)}18;">
            <div class="yong-lbl">忌神 (기신)</div>
            <div class="yong-val" style="color:${ohColor(byeongOh)};">${esc(byeongOh)}</div>
          </div>
        </div>
        <div class="attr-grid">
          ${eokBu?`<div class="attr-item"><div class="attr-lbl">억부(抑扶) 용신</div><div class="attr-val">${esc(eokBu)}</div></div>`:''}
          ${joHu?`<div class="attr-item"><div class="attr-lbl">조후(調候) 용신</div><div class="attr-val">${esc(joHu)}</div></div>`:''}
          ${yongPrin?`<div class="attr-item" style="grid-column:span 2;"><div class="attr-lbl">도출 원리</div><div class="attr-val">${esc(yongPrin)}</div></div>`:''}
        </div>
      </div>
    </div>

    <!-- ④ 격국별 활용 전략 -->
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
        <div class="card-hd-title">④ 격국 활용 전략</div>
        <div class="card-hd-sub">${esc(gyeokNm)} 특성을 살린 실생활 전략</div>
      </div>
      <div class="card-body">
        <div style="margin-bottom:5px;">
          <div class="attr-lbl" style="margin-bottom:3px;">✦ 적합 직업군</div>
          <div class="job-chips">
            ${(yongJobGun || gInfo.career).split(/[·,]/).map(j=>j.trim()).filter(Boolean)
              .map(j=>`<span class="job-chip" style="border-color:${gInfo.color}55;color:${gInfo.color};background:${gInfo.bg};">${esc(j)}</span>`).join('')}
          </div>
        </div>
        <div class="attr-grid" style="margin-bottom:5px;">
          <div class="attr-item" style="border-color:#4caf5033;">
            <div class="attr-lbl">격국 특성 직업군</div>
            <div class="attr-val" style="font-size:7pt;">${esc(gInfo.career)}</div>
          </div>
          <div class="attr-item" style="border-color:#ff980033;">
            <div class="attr-lbl">격국 × 신강약 전략</div>
            <div class="attr-val" style="font-size:7pt;">${esc(gInfo.yongsin)}</div>
          </div>
        </div>
        <div class="advice-box" style="border-color:${gInfo.color}44;background:${gInfo.bg};">
          <div class="advice-lbl" style="color:${gInfo.color};">💡 格局 활용 핵심 포인트</div>
          <div class="advice-txt">
            <b style="color:${gInfo.color};">${esc(gyeokNm)}</b> 은(는) <b>${esc(gInfo.trait)}</b> 의 기운이 강합니다.<br>
            강점인 <b>${esc(gInfo.strength)}</b> 을(를) 살리고,<br>
            <b style="color:#c62828;">${esc(gInfo.weakness)}</b> 에 주의하세요.<br>
            ${yongJobGun?`용신(${esc(yongOh)}) 기운이 담긴 직업 》 <b style="color:${ohColor(yongOh)};">${esc(yongJobGun)}</b> 분야가 길합니다.`:''}
          </div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '격국분석표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  console.log(`✅ 격국분석표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_격국분석표.js <slot_id>'); process.exit(1); }
generate(slotId);
