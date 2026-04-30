#!/usr/bin/env node
/**
 * generate_4신요약표.js
 * 용신(用神) 4신 요약표 범용 generator
 * ──────────────────────────────────────────────────
 * node generate_4신요약표.js <slot_id>
 * 입력: queue/{slot}_ch06.json + queue/{slot}_master_preprocessed.json
 * 출력: tables/{slot}/4신요약표.html  (A4 full-page)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

// ── 오행 정적 데이터 ─────────────────────────────────
const OH_DATA = {
  wood:  { c:'#4caf50', hanja:'木', kr:'목', ename:'나무·성장·동방', dir:'東(동)', season:'봄(2~4월)',
    time:'寅(3-5시)·卯(5-7시)·辰(7-9시)', color:'초록색 · 청록색', colorEmoji:'🟢',
    job:'교육·의료·출판·환경·문화', darkC:'#2e7d32', midC:'#388e3c',
    charStyle:'background:rgba(76,175,80,0.06)', badgeBg:'rgba(76,175,80,0.04)' },
  fire:  { c:'#f44336', hanja:'火', kr:'화', ename:'불·열·빛·남방', dir:'南(남)', season:'여름(5~7월)',
    time:'巳(9-11시)·午(11-13시)·未(13-15시)', color:'적색 · 주황색', colorEmoji:'🔴',
    job:'에너지·IT·미디어·마케팅·방송', darkC:'#c62828', midC:'#e65100',
    charStyle:'background:rgba(244,67,54,0.06)', badgeBg:'rgba(244,67,54,0.04)' },
  earth: { c:'#ff9800', hanja:'土', kr:'토', ename:'흙·안정·중앙', dir:'中(중앙)', season:'환절기(봄·여름·가을·겨울 말)',
    time:'辰戌丑未(7-9시·19-21시·1-3시·13-15시)', color:'황색 · 갈색', colorEmoji:'🟡',
    job:'부동산·건설·농업·요식·중개', darkC:'#e65100', midC:'#f57c00',
    charStyle:'background:rgba(255,152,0,0.06)', badgeBg:'rgba(255,152,0,0.04)' },
  metal: { c:'#9e9e9e', hanja:'金', kr:'금', ename:'쇠·결실·서방', dir:'西(서)', season:'가을(8~10월)',
    time:'申(15-17시)·酉(17-19시)', color:'흰색 · 은색', colorEmoji:'⚪',
    job:'금속·기계·재무·회계·법조', darkC:'#424242', midC:'#616161',
    charStyle:'background:rgba(158,158,158,0.06)', badgeBg:'rgba(158,158,158,0.04)' },
  water: { c:'#2196f3', hanja:'水', kr:'수', ename:'물·냉기·북방', dir:'北(북)', season:'겨울(11~1월)',
    time:'亥(21-23시)·子(23-1시)', color:'파란색 · 검정색', colorEmoji:'🔵',
    job:'유통·물류·수산·금융·IT', darkC:'#0d47a1', midC:'#1565c0',
    charStyle:'background:rgba(33,150,243,0.06)', badgeBg:'rgba(33,150,243,0.04)' }
};

const OH_KEY_MAP = {
  wood:'wood', 木:'wood', 목:'wood', '木(목)':'wood', '목(木)':'wood',
  fire:'fire', 火:'fire', 화:'fire', '火(화)':'fire', '화(火)':'fire',
  earth:'earth', 土:'earth', 토:'earth', '土(토)':'earth', '토(土)':'earth',
  metal:'metal', 金:'metal', 금:'metal', '金(금)':'metal', '금(金)':'metal',
  water:'water', 水:'water', 수:'water', '水(수)':'water', '수(水)':'water'
};
function ohKey(v) { if(OH_KEY_MAP[v]) return OH_KEY_MAP[v]; return OH_KEY_MAP[String(v).charAt(0)]||null; }
function oh(v)    { return OH_DATA[ohKey(v)] || OH_DATA.earth; }

// ── 오행 등급 → 바 길이(%) ───────────────────────────
const GRADE_WIDTH = {
  '매우강':92, '강':72, '보통':50, '약':28, '매우약':12, '없음':0
};

// ── 4신 역할 설명 정적 생성 ───────────────────────────
// 상생: wood→fire, fire→earth, earth→metal, metal→water, water→wood
// 상극: wood→earth, earth→water, water→fire, fire→metal, metal→wood
const SANGSEONG = { wood:'fire', fire:'earth', earth:'metal', metal:'water', water:'wood' };
const SANGGEUK  = { wood:'earth', earth:'water', water:'fire', fire:'metal', metal:'wood' };

function buildRoleDesc(type, oKey, yongKey, huiKey) {
  const o = OH_DATA[oKey];
  if (!o) return '—';
  switch (type) {
    case 'yong': {
      // 용신: 구체적 역할
      const geuk = SANGGEUK[oKey]; // 용신이 극하는 것
      const saeng = SANGSEONG[oKey]; // 용신이 생하는 것
      const gO = OH_DATA[geuk];
      const sO = OH_DATA[saeng];
      return `일간의 과한 기운을 억제·균형. ${gO ? `${gO.hanja}(${gO.kr})를 극(剋)하여 조절.` : ''} ${sO ? `${sO.hanja}(${sO.kr})를 생(生)하여 희신 활성.` : ''}`;
    }
    case 'hui': {
      // 희신: 용신을 생하는 보조
      const sO = OH_DATA[yongKey];
      return `용신 ${sO ? sO.hanja+'('+sO.kr+')' : ''}을 생(生)하는 보조 기운. 용신의 힘을 뒤에서 지원.`;
    }
    case 'byeong': {
      // 기신: 용신을 극하는 가장 해로운
      const yO = OH_DATA[yongKey];
      return `용신 ${yO ? yO.hanja+'('+yO.kr+')' : ''}을 극(剋)하여 균형 파괴. 가장 조심해야 할 기운.`;
    }
    case 'han': {
      // 한신: 희신을 극하거나 간접 방해
      const hO = OH_DATA[huiKey];
      return `희신 ${hO ? hO.hanja+'('+hO.kr+')' : ''}을 극(剋)하므로 주의. 직접 해롭지는 않으나 간접 방해.`;
    }
    default: return '—';
  }
}

// ── 실생활 활용법 ────────────────────────────────────
const USAGE_TIPS = {
  yong: (o, oName) => `${o.colorEmoji} ${oName} 색상 의류·소품 착용. ${o.dir} 방향 집·사무실 선호.\n${o.season}에 중요 결정·계약 집중.\n${o.time.split('·')[0]} 시간대 핵심 업무 배치. ${oName} 관련 소품 활용.`,
  hui:  (o, oName) => `${o.colorEmoji} ${oName} 색상을 주변에. ${o.dir} 방향 활용.\n${o.season}에 새 시작·계획 수립.\n${oName} 소재 가구·악세서리 활용.`,
  byeong: (o, oName) => `${o.season} 중요 결정 자제.\n${o.color} 과다 사용 주의.\n${o.dir} 방향 장기 거주 주의. ${oName} 관련 직종 투자 조심.`,
  han: (o, oName) => `${o.season} 희신 기운이 약해지는 시기 주의.\n${oName} 기운 강한 대운·세운 구간 방어 필요.\n원국 기운 변화 시 충격 흡수 준비.`
};

// ── HTML 생성 ────────────────────────────────────────
function generate(slotId) {
  const ch03File   = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const ch06File   = path.join(QUEUE_DIR, `${slotId}_ch06.json`);
  const masterFile = path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`);

  const d3 = fs.existsSync(ch03File) ? JSON.parse(fs.readFileSync(ch03File, 'utf-8')) : {};
  const d6 = JSON.parse(fs.readFileSync(ch06File, 'utf-8'));
  const mp = fs.existsSync(masterFile) ? JSON.parse(fs.readFileSync(masterFile, 'utf-8')) : {};

  // ── saju_calc 직접 계산 (정확한 값 보장) ──────────────────────
  let _calcResult = null;
  try {
    const { 전체사주계산 } = require('./saju_calc');
    let _masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
    if (!fs.existsSync(_masterPath)) _masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
    if (!fs.existsSync(_masterPath)) {
      const _sd = path.dirname(ch03File);
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
    if (_calcResult.한신) d6['한신오행'] = _oh[_calcResult.한신] || _calcResult.한신;
    if (_calcResult.억부용신) d6['억부용신'] = _oh[_calcResult.억부용신] || _calcResult.억부용신;
    if (_calcResult.조후용신) d6['조후용신'] = _oh[_calcResult.조후용신] || _calcResult.조후용신;
    if (_calcResult.신강약) d6['신강약'] = _calcResult.신강약;
    if (_calcResult.오행점수) {
      for (const [k, v] of Object.entries(_calcResult.오행점수)) {
        const kr = {木:'목',火:'화',土:'토',金:'금',水:'수'}[k];
        if (kr) mp[kr+'점수'] = v;
      }
    }
    if (_calcResult.격국명 || _calcResult.格국명) d6['격국명'] = _calcResult.격국명 || _calcResult.格국명;
  }

  const name       = d3['이름']        || d6['이름'] || slotId;
  const 선생님이름 = d3['선생님이름'] || mp['선생님이름'] || '반야선생';
  const birthS     = d3['birth_solar'] || d3['생년월일'] || '';
  const gender     = d3['user_gender'] || d3['성별']   || '';
  const age        = d3['user_age']    || d3['나이']   || d6['만나이'] || '';
  const yongRaw    = d6['용신오행'] || mp['용신오행'] || '';
  const huiRaw     = d6['희신오행'] || mp['희신오행'] || '';
  const byeongRaw  = d6['기신오행'] || mp['기신오행'] || '';
  const hanRaw     = d6['한신오행'] || mp['한신오행'] || '';
  const eobuRaw    = d6['억부용신'] || mp['억부용신'] || '';
  const johuRaw    = d6['조후용신'] || mp['조후용신'] || '';

  const yongK   = ohKey(yongRaw)  || ohKey(mp['용신오행키']) || 'fire';
  const huiK    = ohKey(huiRaw)   || ohKey(mp['희신오행키']) || 'wood';
  const byeongK = ohKey(byeongRaw)|| ohKey(mp['기신오행키']) || 'water';
  const hanK    = ohKey(hanRaw)   || 'metal';
  const eobuK   = ohKey(eobuRaw)  || yongK;
  const johuK   = ohKey(johuRaw)  || yongK;

  const yongO   = OH_DATA[yongK];
  const huiO    = OH_DATA[huiK];
  const byeongO = OH_DATA[byeongK];
  const hanO    = OH_DATA[hanK];

  const shingang  = d6['신강약'] || '';
  const gangdo    = d6['일간강도수치'] || '';
  const geukguk   = d6['격국명'] || '';
  const ilju      = d6['일주'] || '';
  const yongColor = d6['용신색상'] || mp['용신색상'] || yongO.color;
  const yongDir   = d6['용신방위'] || mp['용신방위'] || yongO.dir;
  const yongJob   = d6['용신직업군'] || mp['용신직업군'] || yongO.job;

  // 오행 등급 (ch06 or ch05 호환)
  const ohGrades = {
    '木': d6['木등급'] || mp['木등급'] || '보통',
    '火': d6['火등급'] || mp['火등급'] || '보통',
    '土': d6['土등급'] || mp['土등급'] || '보통',
    '金': d6['金등급'] || mp['金등급'] || '보통',
    '水': d6['水등급'] || mp['水등급'] || '보통'
  };
  const ohScores = {
    '木': +(mp['목점수'] || 0), '火': +(mp['화점수'] || 0),
    '土': +(mp['토점수'] || 0), '金': +(mp['금점수'] || 0),
    '水': +(mp['수점수'] || 0)
  };

  // 역할 설명
  const yongRoleDesc   = buildRoleDesc('yong',   yongK, yongK, huiK);
  const huiRoleDesc    = buildRoleDesc('hui',    huiK,  yongK, huiK);
  const byeongRoleDesc = buildRoleDesc('byeong', byeongK, yongK, huiK);
  const hanRoleDesc    = buildRoleDesc('han',    hanK,  yongK, huiK);

  // 오행 분포 바 데이터
  const ohBarData = [
    { key:'火', label:'火(화)', o:OH_DATA.fire,  note: yongK==='fire'  ? '🔥 用神 》 강화 필요' : huiK==='fire'  ? '🌱 喜神 》 유지 필요' : byeongK==='fire'  ? '⚠️ 忌神 》 주의' : hanK==='fire'  ? '⚪ 閑神 》 중립' : '—' },
    { key:'木', label:'木(목)', o:OH_DATA.wood,  note: yongK==='wood'  ? '🔥 用神 》 강화 필요' : huiK==='wood'  ? '🌱 喜神 》 유지 필요' : byeongK==='wood'  ? '⚠️ 忌神 》 주의' : hanK==='wood'  ? '⚪ 閑神 》 중립' : '—' },
    { key:'土', label:'土(토)', o:OH_DATA.earth, note: yongK==='earth' ? '🔥 用神 》 강화 필요' : huiK==='earth' ? '🌱 喜神 》 유지 필요' : byeongK==='earth' ? '⚠️ 忌神 》 주의' : hanK==='earth' ? '⚪ 閑神 》 중립' : '—' },
    { key:'水', label:'水(수)', o:OH_DATA.water, note: yongK==='water' ? '🔥 用神 》 강화 필요' : huiK==='water' ? '🌱 喜神 》 유지 필요' : byeongK==='water' ? '⚠️ 기신 》 약해도 주의' : hanK==='water' ? '⚪ 閑神 》 중립' : '—' },
    { key:'金', label:'金(금)', o:OH_DATA.metal, note: yongK==='metal' ? '🔥 用神 》 강화 필요' : huiK==='metal' ? '🌱 喜神 》 유지 필요' : byeongK==='metal' ? '⚠️ 忌神 》 주의' : hanK==='metal' ? '⚪ 閑神 》 희신 견제 주의' : '—' }
  ];

  // ── 4신 컬럼 HTML ───────────────────────────────────
  function shinColHTML(num, type, label, hanja, oK, roleDesc) {
    const o = OH_DATA[oK] || OH_DATA.earth;
    const colorClass = `t-${o.kr}`;
    const bgClass    = `c-${o.kr}`;
    const typeNum = { yong:'①', hui:'②', byeong:'③', han:'④' }[type];
    const typeLabel = { yong:'용신(用神)', hui:'희신(喜神)', byeong:'기신(忌神)', han:'한신(閑神)' }[type];
    const typeSub = { yong:'가장 필요한 기운', hui:'두 번째 도움 기운', byeong:'가장 해로운 기운', han:'중립·보조 기운' }[type];

    // 역할 레이블
    const labelText = type === 'byeong' ? '역할' : type === 'han' ? '역할' : '역할';
    const label2 = type === 'byeong' ? '주의색' : type === 'han' ? '중립색' : '색상';
    const label3 = type === 'byeong' ? '주의방위' : '방위';
    const label4 = type === 'byeong' ? '주의시간' : type === 'han' ? '시간' : '시간';
    const label5 = type === 'byeong' ? '주의직업' : type === 'han' ? '직업군' : '직업군';
    const label6 = type === 'byeong' ? '주의계절' : '계절';

    // 색상 섀도 다크
    const lbBg1 = o.c;
    const lbBg2 = o.midC;
    const lbBg3 = o.darkC;

    return `
    <!-- ${typeLabel} ${o.hanja} -->
    <div class="shin-col">
      <div class="shin-hd" style="${o.charStyle}">
        <span class="shin-num" style="background:${o.c};">${typeNum} ${typeLabel}</span>
        <div class="shin-name ${colorClass}">${o.hanja}(${o.kr})</div>
        <div class="shin-hanja">${typeSub}</div>
      </div>
      <div class="ohaeng-badge" style="background:${o.badgeBg};">
        <div class="oh-circle ${bgClass}">${o.hanja}</div>
        <div class="oh-info">
          <div class="oh-hanja ${colorClass}">${o.hanja}(${o.kr})</div>
          <div class="oh-kr">${o.ename}</div>
        </div>
      </div>
      <div class="shin-body">
        <div class="attr-row">
          <span class="attr-lbl" style="background:${lbBg1};">${labelText}</span>
          <div class="attr-val">${roleDesc}</div>
        </div>
        <div class="attr-row">
          <span class="attr-lbl" style="background:${lbBg2};">${label2}</span>
          <div class="attr-val">${o.colorEmoji} ${o.color}</div>
        </div>
        <div class="attr-row">
          <span class="attr-lbl" style="background:${lbBg3};">${label3}</span>
          <div class="attr-val">${o.dir} 방향${type==='byeong'?' 주의':''}</div>
        </div>
        <div class="attr-row">
          <span class="attr-lbl" style="background:${lbBg1};">${label4}</span>
          <div class="attr-val">${o.time}</div>
        </div>
        <div class="attr-row">
          <span class="attr-lbl" style="background:${lbBg2};">${label5}</span>
          <div class="attr-val">${type==='yong' ? yongJob : o.job}</div>
        </div>
        <div class="attr-row">
          <span class="attr-lbl" style="background:${lbBg3};">${label6}</span>
          <div class="attr-val">${o.season} ${type==='byeong'?'주의':type==='han'?'주의':''}</div>
        </div>
      </div>
    </div>`;
  }

  // ── 오행 분포 바 행 ──────────────────────────────────
  function barRow(item) {
    const grade = ohGrades[item.key] || '보통';
    const width = GRADE_WIDTH[grade] || 50;
    const score = ohScores[item.key] || 0;
    return `
      <div class="cmp-row">
        <span class="cmp-label" style="color:${item.o.c};">${item.label}</span>
        <div class="cmp-bar-wrap"><div class="cmp-bar" style="width:${width}%;background:${item.o.c};"></div></div>
        <span class="cmp-grade" style="color:${item.o.c};">${grade}</span>
        <span class="cmp-note">${item.note}</span>
      </div>`;
  }

  // ── 실생활 활용 섹션 ──────────────────────────────────
  function usageHTML(type, oK) {
    const o = OH_DATA[oK];
    if (!o) return '';
    const oName = `${o.hanja}(${o.kr})`;
    const typeEmoji = { yong:'🔥', hui:'🌱', byeong:'💧', han:'⚪' }[type];
    const typeLabelK = { yong:'용신 활용법', hui:'희신 활용법', byeong:'기신 방어법', han:'한신 주의법' }[type];
    const content = USAGE_TIPS[type](o, oName).split('\n');
    return `
    <div class="usage-item">
      <div class="ui-title"><div class="ui-dot" style="background:${o.c};"></div><span style="color:${o.c};">${typeEmoji} ${typeLabelK} 》 ${oName} 기운 ${type==='byeong'||type==='han'?'차단':'강화'}</span></div>
      <div class="ui-content">
        ${content.map(l => l.trim()).filter(Boolean).join('<br>')}
      </div>
    </div>`;
  }

  // 최종 용신 메모
  const eobuO = OH_DATA[eobuK];
  const johuO = OH_DATA[johuK];
  const eobuEq = eobuK === yongK;
  const memoDesc = `${name} 님의 사주는 <strong style="color:${OH_DATA[ohKey(d6['신강약']?.includes('强')?'earth':'water')]?.c||'#ff9800'}">${d6['신강약']||''}${gangdo?` (${gangdo}%)`:''}·${geukguk}</strong> 구조입니다.
  <strong style="color:${yongO.c};">用神 ${yongO.hanja}(${yongO.kr})</strong>은 ${yongRoleDesc}
  <strong style="color:${huiO.c};">喜神 ${huiO.hanja}(${huiO.kr})</strong>은 ${huiRoleDesc}
  반면 <strong style="color:${byeongO.c};">忌神 ${byeongO.hanja}(${byeongO.kr})</strong>는 ${byeongRoleDesc} ${byeongO.season}·${byeongO.color}·${byeongO.dir}을 의식적으로 피하는 것이 방어책입니다.`;

  // ── 공통 CSS 상수 ─────────────────────────────────────
  const COMMON_CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; max-height:840px; overflow:hidden; padding:6px 8px; background:transparent; display:flex; flex-direction:column; gap:5px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  background:transparent; border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; } .page { margin:0;  background:transparent; width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; } @page { border:1px solid #333; size:604px 840px; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:1.5px solid #333; border-radius:10px; overflow:hidden; }
.card-hd { padding:6px 14px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:8.5pt; font-weight:900; color:white; }
.card-hd-sub   { font-size:7pt; color:rgba(255,255,255,.85); }
.banner { background:#fafafa; border-bottom:1px solid #e0e0e0; padding:5px 10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.banner-item { display:flex; flex-direction:column; align-items:center; gap:1px; }
.b-label { font-size:7pt; color:#aaa; font-weight:700; letter-spacing:.4px; }
.b-value { font-size:7.5pt; font-weight:700; color:#333; }
.b-badge { padding:2px 8px; border-radius:8px; color:white; font-size:6.5pt; font-weight:900; }
.banner-divider { width:1px; height:22px; background:#e0e0e0; }
.four-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0; }
.shin-col { border-right:1px solid #e0e0e0; display:flex; flex-direction:column; }
.shin-col:last-child { border-right:none; }
.shin-hd { padding:5px 5px 4px; text-align:center; border-bottom:1px solid #e0e0e0; }
.shin-num  { font-size:7pt; font-weight:700; color:white; padding:1px 5px; border-radius:6px; display:inline-block; margin-bottom:2px; }
.shin-name { font-size:9.5pt; font-weight:900; line-height:1.1; }
.shin-hanja { font-family:'Noto Serif KR',serif; font-size:6pt; color:#888; margin-top:1px; }
.ohaeng-badge { display:flex; align-items:center; justify-content:center; gap:4px; padding:4px; border-bottom:1px solid #e0e0e0; }
.oh-circle { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Noto Serif KR',serif; font-size:13pt; font-weight:800; color:white;  }
.oh-hanja { font-family:'Noto Serif KR',serif; font-size:8.5pt; font-weight:800; }
.oh-kr    { font-size:7pt; color:#888; }
.shin-body { padding:4px 6px; display:flex; flex-direction:column; gap:3px; }
.attr-row  { display:flex; flex-direction:column; gap:1px; }
.attr-lbl  { font-size:6.5pt; font-weight:700; color:white; padding:0px 4px; border-radius:2px; display:inline-block; width:fit-content; }
.attr-val  { font-size:7pt; color:#333; line-height:1.3; padding-left:1px; }
.compare-section { padding:6px 10px; border-top:1px solid #e0e0e0; background:#fafafa; }
.cs-title  { font-size:6pt; font-weight:700; color:#555; margin-bottom:5px; display:flex; align-items:center; gap:4px; }
.compare-grid { display:flex; flex-direction:column; gap:3px; }
.cmp-row   { display:flex; align-items:center; gap:5px; }
.cmp-label { font-size:7pt; font-weight:700; width:30px; text-align:right; flex-shrink:0; }
.cmp-bar-wrap { flex:1; height:5px; background:#eee; border-radius:3px; overflow:hidden; }
.cmp-bar   { height:100%; border-radius:3px; }
.cmp-grade { font-size:7pt; font-weight:700; width:24px; text-align:left; flex-shrink:0; }
.cmp-note  { font-size:7pt; color:#aaa; }
.usage-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; border-top:1px solid #e0e0e0; }
.usage-item { padding:5px 8px; border-right:1px solid #e0e0e0; border-bottom:1px solid #e0e0e0; }
.usage-item:nth-child(2n) { border-right:none; }
.usage-item:nth-last-child(-n+2) { border-bottom:none; }
.ui-title   { font-size:7pt; font-weight:700; margin-bottom:3px; display:flex; align-items:center; gap:3px; }
.ui-dot     { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.ui-content { font-size:7pt; color:#555; line-height:1.5; }
.memo { background:#f8f9fa; border:1px solid #333; border-radius:7px; padding:5px 8px; font-size:7pt; color:#555; line-height:1.6; }
/* 오행 클래스 */
.c-화 { background:#f44336; } .c-목 { background:#4caf50; } .c-수 { background:#2196f3; } .c-금 { background:#9e9e9e; } .c-토 { background:#ff9800; }
.t-화 { color:#f44336; } .t-목 { color:#4caf50; } .t-수 { color:#2196f3; } .t-금 { color:#9e9e9e; } .t-토 { color:#ff9800; }
</style>`;

  // ── 통합 HTML: 헤더 + 배너 + 4신 그리드 + 오행비교 + 실생활활용 + 핵심메모 ──
  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>4신 요약표 》 ${name}님</title>
${COMMON_CSS}
</head>
<body>
<div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
  <div>
    <div class="banner-hdr-title">📋 용신(用神) 4신 요약표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${shingang?' · '+esc(shingang):''}</div>
  </div>
</div>

<div class="card">

  <div class="banner">
    <div class="banner-item">
      <div class="b-label">일주(日柱)</div>
      <div class="b-value" style="font-family:'Noto Serif KR',serif;font-size:10pt;">${ilju}</div>
    </div>
    <div class="banner-divider"></div>
    <div class="banner-item">
      <div class="b-label">일간 강도</div>
      <div class="b-badge" style="background:#ff9800;">${shingang}${gangdo ? ` ${gangdo}%` : ''}</div>
    </div>
    <div class="banner-divider"></div>
    <div class="banner-item">
      <div class="b-label">格局</div>
      <div class="b-value">${geukguk}</div>
    </div>
    <div class="banner-divider"></div>
    <div class="banner-item">
      <div class="b-label">억부용신</div>
      <div class="b-badge" style="background:${eobuO ? eobuO.c : '#888'};">${eobuO ? `${eobuO.hanja}(${eobuO.kr})` : eobuRaw}</div>
    </div>
    <div class="banner-divider"></div>
    <div class="banner-item">
      <div class="b-label">조후용신</div>
      <div class="b-badge" style="background:${johuO ? johuO.c : '#888'};">${johuO ? `${johuO.hanja}(${johuO.kr})` : johuRaw}</div>
    </div>
    <div class="banner-divider"></div>
    <div class="banner-item">
      <div class="b-label">최종 용신</div>
      <div class="b-badge" style="background:${yongO.c};font-size:7.5pt;">${yongO.colorEmoji} ${yongO.hanja}(${yongO.kr})</div>
    </div>
  </div>

  <div class="four-grid">
    ${shinColHTML(1, 'yong',   '용신', yongO.hanja,   yongK,   yongRoleDesc)}
    ${shinColHTML(2, 'hui',    '희신', huiO.hanja,    huiK,    huiRoleDesc)}
    ${shinColHTML(3, 'byeong', '기신', byeongO.hanja, byeongK, byeongRoleDesc)}
    ${shinColHTML(4, 'han',    '한신', hanO.hanja,    hanK,    hanRoleDesc)}
  </div>

  <div class="compare-section">
    <div class="cs-title">
      <span style="display:inline-block;width:2px;height:9px;background:${yongO.c};border-radius:2px;"></span>
      원국 오행 분포 vs 4신 관계
    </div>
    <div class="compare-grid">
      ${ohBarData.map(barRow).join('\n')}
    </div>
  </div>

  <div class="usage-grid">
    ${usageHTML('yong', yongK)}
    ${usageHTML('hui', huiK)}
    ${usageHTML('byeong', byeongK)}
    ${usageHTML('han', hanK)}
  </div>

</div><!-- card -->

<div class="memo">
  <strong style="color:#e65100;">📌 ${선생님이름}의 4신 핵심 요약</strong><br>
  ${memoDesc}
</div>

</div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '4신요약표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  console.log(`✅ 4신요약표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_4신요약표.js <slot_id>'); process.exit(1); }
generate(slotId);
