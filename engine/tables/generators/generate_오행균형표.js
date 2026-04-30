#!/usr/bin/env node
/**
 * generate_오행균형표.js  》 오행 균형 요약표 범용 generator
 * node generate_오행균형표.js <slot_id>
 * 출력: tables/{slot}/오행균형표.html  (A4 full-page + Chart.js)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');
const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

// ── 오행 팔레트 ──────────────────────────────────────────
const OH = {
  wood:  { c:'#4caf50', name:'木(목)', short:'木', kor:'목', dir:'동(東)', season:'봄·寅卯辰', colors:'초록·연두', items:'나무 소재·식물', className:'oh-목 t-목' },
  fire:  { c:'#f44336', name:'火(화)', short:'火', kor:'화', dir:'남(南)', season:'여름·巳午未', colors:'적색·주황', items:'조명·촛불', className:'oh-화 t-화' },
  earth: { c:'#ff9800', name:'土(토)', short:'土', kor:'토', dir:'중앙', season:'환절기·辰戌丑未', colors:'황토·베이지', items:'도자기·황토', className:'oh-토 t-토' },
  metal: { c:'#9e9e9e', name:'金(금)', short:'金', kor:'금', dir:'서(西)', season:'가을·申酉戌', colors:'흰색·은색', items:'금속 소재', className:'oh-금 t-금' },
  water: { c:'#2196f3', name:'水(수)', short:'水', kor:'수', dir:'북(北)', season:'겨울·亥子丑', colors:'파랑·검정', items:'수조·파란 소재', className:'oh-수 t-수' },
};

// 상생 관계: A생B
const SANGSEONG = { wood:'fire', fire:'earth', earth:'metal', metal:'water', water:'wood' };
// 상극 관계: A극B
const SANGGEUK  = { wood:'earth', earth:'water', water:'fire', fire:'metal', metal:'wood' };

function ohKey(v){
  if(!v) return null;
  const m={wood:'wood',木:'wood',목:'wood',fire:'fire',火:'fire',화:'fire',earth:'earth',土:'earth',토:'earth',metal:'metal',金:'metal',금:'metal',water:'water',水:'water',수:'water'};
  if(m[v]) return m[v];
  const first = String(v).charAt(0);
  return m[first]||null;
}
const GRADE_W={매우강:95,강:70,중강:58,보통:45,약:28,매우약:10};
function gradeW(g){ for(const[k,v] of Object.entries(GRADE_W)) if(g&&g.includes(k)) return v; return 30; }
function esc(s){ if(s==null)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── 메인 ─────────────────────────────────────────────────
function generate(slotId){
  const d  = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch03.json`),'utf-8'));
  const c0 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch00.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch00.json`),'utf-8')) : {};
  const mp = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_master_preprocessed.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_master_preprocessed.json`),'utf-8')) : {};
  const d6 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`),'utf-8')) : {};
  const d4 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch04.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch04.json`),'utf-8')) : {};
  const d1 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch01.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch01.json`),'utf-8')) : {};

  const name   = d['이름']||slotId;
  const birthS = d['birth_solar'] || d['생년월일'] || '';
  const gender = d['user_gender'] || d['성별'] || '';
  const age    = d['user_age']    || d['나이'] || '';
  const ilju   = d['일주'] || '';
  const ilgan  = d['일주_천간']||'';
  const ilganE = d['일주_천간_음']||'';
  const ilOhK  = ohKey(d['일주_천간_오행']||'');
  const ilOh   = OH[ilOhK]||OH.earth;

  const ch08 = fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`),'utf-8')) : {};

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
        _calcResult = 전체사주계산({이름:_M.이름, 성별:_M.성별, 년:_M.생년, 월:_M.생월, 일:_M.생일, 시간:_M.생시||'모름', 음력입력:!!_M.음력입력, 윤달:!!_M.윤달});
      }
    }
  } catch(e) { /* saju_calc 실패 시 기존 ch*.json 값 사용 */ }

  // saju_calc 결과로 핵심 값 보정 (ch08, d6, d4, d, mp에 주입)
  if (_calcResult) {
    const _oh = {木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'};
    const _targets = [ch08, d6, d, mp];
    for (const _t of _targets) {
      if (_calcResult.용신) _t['용신오행'] = _oh[_calcResult.용신] || _calcResult.용신;
      if (_calcResult.희신) _t['희신오행'] = _oh[_calcResult.희신] || _calcResult.희신;
      if (_calcResult.기신) _t['기신오행'] = _oh[_calcResult.기신] || _calcResult.기신;
      if (_calcResult.한신) _t['한신오행'] = _oh[_calcResult.한신] || _calcResult.한신;
    }
    if (_calcResult.오행점수) {
      const _kr = {木:'목',火:'화',土:'토',金:'금',水:'수'};
      for (const [k, v] of Object.entries(_calcResult.오행점수)) {
        if (_kr[k]) { d4[_kr[k]+'점수'] = v; d1[_kr[k]+'점수'] = v; mp[_kr[k]+'점수'] = v; }
      }
      if (_calcResult.오행순위) {
        for (const item of _calcResult.오행순위) {
          if (item.등급) { d4[item.오행+'등급'] = item.등급; d1[item.오행+'등급'] = item.등급; d[item.오행+'등급'] = item.등급; c0[item.오행+'등급'] = item.등급; }
        }
      }
    }
  }

  const yongK  = ohKey(ch08['용신오행']||d6['용신오행']||d['용신오행']||mp['용신오행']||'');
  const huiK   = ohKey(ch08['희신오행']||d6['희신오행']||d['희신오행']||mp['희신오행']||'');
  let byeongK  = ohKey(ch08['기신오행']||d6['기신오행']||d['기신오행']||mp['기신오행']||'');
  let hanK     = ohKey(ch08['한신오행']||d6['한신오행']||mp['한신오행']||d['한신오행']||'');

  // 기신 자동 계산: 용신을 극하는 오행 (火克金, 水克火 등)
  if (!byeongK && yongK) {
    const GEUK = {wood:'fire',fire:'water',earth:'wood',metal:'fire',water:'earth'};
    byeongK = GEUK[yongK] || null;
  }
  // 한신 자동 계산: 나머지 오행
  if (!hanK && yongK) {
    const all = ['wood','fire','earth','metal','water'];
    hanK = all.find(o => o !== yongK && o !== huiK && o !== byeongK) || null;
  }

  const SC = {
    wood:  +(d4['목점수']||d1['목점수']||mp['목점수']||0),
    fire:  +(d4['화점수']||d1['화점수']||mp['화점수']||0),
    earth: +(d4['토점수']||d1['토점수']||mp['토점수']||0),
    metal: +(d4['금점수']||d1['금점수']||mp['금점수']||0),
    water: +(d4['수점수']||d1['수점수']||mp['수점수']||0),
  };
  const scT = Object.values(SC).reduce((a,b)=>a+b,0)||1;
  const GR = {
    wood:  d4['木등급']||d1['木등급']||d['木등급']||c0['木등급']||'—',
    fire:  d4['火등급']||d1['火등급']||d['火등급']||c0['火등급']||'—',
    earth: d4['土등급']||d1['土등급']||d['土등급']||c0['土등급']||'—',
    metal: d4['金등급']||d1['金등급']||d['金등급']||c0['金등급']||'—',
    water: d4['水등급']||d1['水등급']||d['水등급']||c0['水등급']||'—',
  };

  // 4신 역할 매핑
  const ROLES = { [yongK]:'① 용신(用神)', [huiK]:'② 희신(喜神)', [byeongK]:'③ 기신(忌神)', [hanK]:'④ 한신(閑神)' };
  const ROLE_BG = { [yongK]:OH[yongK]?.c||'#f44336', [huiK]:OH[huiK]?.c||'#4caf50',
                    [byeongK]:OH[byeongK]?.c||'#9e9e9e', [hanK]:'#9e9e9e' };
  const ROLE_NOTE = {
    [yongK]:'강화 필수 》 현재 부족', [huiK]:'유지 필요', [byeongK]:'태과(太過) 주의',
    [hanK]:'중립·방치',
  };
  const ROLE_NOTE_COLOR = {
    [yongK]:'#c62828', [huiK]:'#388e3c', [byeongK]:'#e65100', [hanK]:'#757575',
  };

  // 도넛 차트 데이터
  const OH_ORDER = ['wood','fire','earth','metal','water'];
  const chartData  = OH_ORDER.map(k => Math.round(SC[k]/scT*100));
  const chartColors= OH_ORDER.map(k => OH[k].c);
  const chartLabels= OH_ORDER.map(k => OH[k].name);

  // 상생 분석 》 중요한 관계만 추출
  const sangseongRows = [];
  // 희신→용신 상생
  if(huiK && yongK && SANGSEONG[huiK]===yongK)
    sangseongRows.push({ from:huiK, to:yongK, note:`✅ 희신 ${OH[huiK]?.short}이 용신 ${OH[yongK]?.short}을 생(生) 》 길한 흐름` });
  // 기타 상생 관계
  for(const k of OH_ORDER){
    const target = SANGSEONG[k];
    if(k===huiK && target===yongK) continue; // 이미 추가됨
    const note = target===yongK ? `✅ 용신 강화 흐름` : target===byeongK ? `⚠️ 기신 강화 》 주의` : `일반 상생`;
    if(sangseongRows.length < 4) sangseongRows.push({ from:k, to:target, note });
  }

  // 상극 분석
  const sanggeukRows = [];
  // 기신→용신 상극
  for(const k of OH_ORDER){
    const target = SANGGEUK[k];
    const isWorst = (k===byeongK && target===yongK);
    const isGood  = (k===byeongK && target===byeongK) || (k===yongK && target===byeongK);
    const fromOh = OH[k]||OH.earth; const toOh = OH[target]||OH.earth;
    const note = isWorst ? `⚠️ 가장 위험 》 기신이 용신을 극`
              : (k===yongK && target===hanK) ? `⚠️ 용신 기운 분산 》 주의`
              : (target===byeongK) ? `✅ 기신 억제 》 길`
              : `일반 상극`;
    if(sanggeukRows.length < 5) sanggeukRows.push({ from:k, to:target, note });
  }

  // 균형 평가표 행 생성
  function evalRow(k, idx) {
    const o = OH[k]; if(!o) return '';
    const sc = SC[k]||0; const gr = GR[k]||'—'; const w = gradeW(gr);
    const pct = Math.round(sc/scT*100);
    const role = ROLES[k] || '—';
    const roleBg = ROLE_BG[k] || '#888';
    const stateNote = ROLE_NOTE[k] || '—';
    const stateColor = ROLE_NOTE_COLOR[k] || '#555';
    const isYong = k===yongK; const isHui = k===huiK; const isByeong = k===byeongK;
    const bgStyle = isYong ? 'background:rgba(244,67,54,0.04);' : isHui ? 'background:rgba(76,175,80,0.04);' : '';

    // 강화 방법 (오행 기반 정적 데이터)
    const actions = {
      wood:  ['초록색 착용','동쪽 방향','봄 집중 행동','나무 소재 인테리어'],
      fire:  ['빨강·주황 착용','남쪽 방향','여름 집중','밝은 조명·촛불'],
      earth: ['황토색 착용','중앙 배치','도자기·흙 소재'],
      metal: ['흰색·은색 착용','서쪽 방향','금속 소재 아이템'],
      water: ['파랑·검정 착용','북쪽 방향','수조·물 인테리어'],
    };
    const actionList = (actions[k]||[]).slice(0, isYong ? 4 : isByeong ? 1 : 2)
      .map(a => `<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7pt;font-weight:700;background:${o.c};color:white;margin:1px;">${esc(a)}</span>`).join('');
    const caution = isByeong ? `${o.name} 기운 더하는 것 자제. ${o.colors} 과다 주의` :
                    isYong   ? `${OH[byeongK]?.name||''}이 극하므로 ${OH[byeongK]?.season||''} 방어` :
                    isHui    ? `${OH[byeongK]?.name||''} 대운·세운 시 ${o.name} 약화 주의` : `균형 유지`;

    return `<tr style="${bgStyle}">
  <td><span style="font-family:'Noto Serif KR',serif;font-size:10pt;font-weight:800;" class="${o.className.split(' ')[1]}">${o.short}</span><br><span style="font-size:7pt;color:#888;">${o.kor}(${o.short})</span></td>
  <td><span style="display:inline-block;padding:1px 5px;border-radius:5px;font-size:7pt;font-weight:700;background:${o.c};color:white;">${esc(gr)}</span><br><span style="font-size:7pt;color:#888;">${sc.toFixed(2)}pt · ${pct}%</span></td>
  <td><span style="display:inline-block;padding:1px 5px;border-radius:5px;font-size:7pt;font-weight:700;background:${roleBg};color:white;">${esc(role)}</span></td>
  <td style="font-size:7pt;color:${stateColor};">${esc(stateNote)}</td>
  <td style="text-align:left;padding:3px 5px;">${actionList||'<span style="font-size:7pt;color:#bbb;">—</span>'}</td>
  <td style="font-size:7pt;color:#555;">${esc(caution)}</td>
</tr>`;
  }

  // 4기둥 8글자 배치
  const PILLARS = ['년주','월주','일주','시주'];
  const P_LABELS = ['년주','월주','일주','시주'];
  const gongPos = {};
  const g1=d['공망1']||'', g2=d['공망2']||'';
  ['년주','월주','일주','시주'].forEach(pk => { if(d[`${pk}_지지`]===g1||d[`${pk}_지지`]===g2) gongPos[pk]=true; });

  function poCol(han, eum, ohK2, label, pillarLabel, isIlgan, isGong) {
    const o = OH[ohKey(ohK2)] || OH.earth;
    const iStyle = isIlgan ? 'background:rgba(255,152,0,0.08);border:1px solid #ff9800;border-radius:0;' : '';
    const lStyle = isIlgan ? 'color:#ff9800;' : '';
    const note   = isGong ? '⚡' : '';
    const yongMark = isIlgan ? '' : (ohKey(ohK2)===yongK) ? '←用' : '';
    return `<div class="po-col" style="${iStyle}">
  <div class="po-label" style="${lStyle}">${esc(label)}${isIlgan?'★':''}</div>
  <div class="po-hanja ${o.className.split(' ')[1]}">${esc(han)}</div>
  <div class="po-kr">${esc(eum)}${isIlgan?'(나)':''}${yongMark}${note}</div>
  <div class="po-oh" style="background:${o.c};color:white;padding:1px 5px;border-radius:4px;font-size:7pt;font-weight:700;">${o.short}</div>
  <div class="po-pillar-label">${pillarLabel?esc(pillarLabel)+'('+esc(P_LABELS[PILLARS.indexOf(pillarLabel)])+')'||'&nbsp;':''}</div>
</div>`;
  }

  const pillarCols = PILLARS.map((pk, i) => {
    const tgH = d[`${pk}_천간`]||''; const tgE = d[`${pk}_천간_음`]||''; const tgO = d[`${pk}_천간_오행`]||'';
    const jjH = d[`${pk}_지지`]||''; const jjE = d[`${pk}_지지_음`]||''; const jjO = d[`${pk}_지지_오행`]||'';
    const isIlgan = pk==='일주'; const isGong = gongPos[pk];
    return poCol(tgH,tgE,tgO, pk==='년주'?'년간':pk==='월주'?'월간':pk==='일주'?'일간':'시간', pk, isIlgan, false)
         + poCol(jjH,jjE,jjO, pk==='년주'?'년지':pk==='월주'?'월지':pk==='일주'?'일지':'시지', '', false, isGong);
  }).join('\n');

  // ── HTML ────────────────────────────────────────────────
  const pillarSubtitle = PILLARS.map(pk => d[pk]||'').join('-');
  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>오행 균형 요약표 》 ${esc(name)}님</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;overflow:visible;padding:6px 8px;background:transparent;display:flex;flex-direction:column;gap:7px;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;background:transparent;border-radius:4px;}}
@media print{body{background:transparent;margin:0;padding:0;}.page{margin:0;background:transparent;width:604px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px 840px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;flex-shrink:0;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card{border:1.5px solid #333;border-radius:10px;overflow:hidden;flex-shrink:0;}
.card-hd{padding:4px 12px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:8pt;font-weight:900;color:white;}
.card-hd-sub{font-size:7pt;color:rgba(255,255,255,.85);}
.pillar-ohaeng{display:grid;grid-template-columns:repeat(8,1fr);gap:0;background:transparent;border-bottom:1px solid #e0e0e0;}
.po-col{display:flex;flex-direction:column;align-items:center;padding:5px 3px;border-right:1px solid #e0e0e0;gap:2px;}
.po-col:last-child{border-right:none;}
.po-label{font-size:6.5pt;color:#aaa;font-weight:700;}
.po-hanja{font-family:'Noto Serif KR',serif;font-size:14pt;font-weight:800;line-height:1;}
.po-kr{font-size:7pt;color:#888;}
.po-pillar-label{font-size:6.5pt;font-weight:700;color:#aaa;text-align:center;padding:3px 0 1px;border-top:1px solid #f0f0f0;width:100%;margin-top:1px;}
.balance-section{padding:8px 10px;background:transparent;border-bottom:1px solid #e0e0e0;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.oh-bars{display:flex;flex-direction:column;gap:4px;}
.oh-row{display:flex;align-items:center;gap:6px;}
.oh-icon{font-family:'Noto Serif KR',serif;font-size:9pt;font-weight:800;width:18px;text-align:center;flex-shrink:0;}
.oh-label{font-size:6pt;font-weight:700;width:22px;flex-shrink:0;}
.oh-bar-wrap{flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden;position:relative;}
.oh-bar{height:100%;border-radius:4px;}
.oh-ideal-marker{position:absolute;top:0;height:100%;width:2px;background:rgba(0,0,0,.2);}
.oh-grade{font-size:7pt;font-weight:700;width:28px;flex-shrink:0;}
.oh-role{font-size:7pt;color:#888;}
.cycle-section{padding:6px 10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;background:transparent;}
.cycle-title{font-size:6pt;font-weight:700;color:#555;margin-bottom:4px;display:flex;align-items:center;gap:4px;}
.cycle-flow{display:flex;align-items:center;gap:3px;flex-wrap:wrap;margin-bottom:5px;}
.cf-item{display:flex;flex-direction:column;align-items:center;gap:1px;}
.cf-circle{width:21px;height:21px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Noto Serif KR',serif;font-size:8pt;font-weight:800;color:white;}
.cf-kr{font-size:6.5pt;color:#888;}
.cf-arrow{font-size:8pt;color:#bbb;padding:0 1px;}
.clash-list{display:flex;flex-direction:column;gap:3px;}
.cl-row{display:flex;align-items:center;gap:5px;font-size:7pt;}
.cl-from,.cl-to{font-family:'Noto Serif KR',serif;font-size:9pt;font-weight:800;}
.cl-arrow{font-size:6pt;color:#aaa;}
.cl-note{font-size:7pt;color:#555;}
.eval-table{width:100%;border-collapse:collapse;font-size:6pt;}
.eval-table th{background:#424242;color:white;padding:3px 5px;font-size:6pt;font-weight:700;}
.eval-table td{border:1px solid #333;padding:3px 5px;vertical-align:middle;}
.eval-table td.left{text-align:left;}
.t-목{color:#4caf50;} .t-화{color:#f44336;} .t-토{color:#ff9800;} .t-금{color:#9e9e9e;} .t-수{color:#2196f3;}
.oh-목{background:#4caf50;} .oh-화{background:#f44336;} .oh-토{background:#ff9800;} .oh-금{background:#9e9e9e;} .oh-수{background:#2196f3;}
</style></head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#e65100,#f57c00);">
  <div>
    <div class="banner-hdr-title">⚖️ 오행(五行) 균형 요약표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · 일간 ${esc(ilgan)}(${ilOh.kor})</div>
  </div>
</div>

<!-- ① 원국 8글자 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#475569,#64748b);">
    <div class="card-hd-title">① 사주 원국 》 8글자 오행 배치</div>
    <div class="card-hd-sub">${esc(pillarSubtitle)} · 각 글자의 오행</div>
  </div>
  <div class="pillar-ohaeng">${pillarCols}</div>
</div>

<!-- ② 오행 강약 분포 + 도넛 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1565c0,#0288d1);">
    <div class="card-hd-title">② 오행 강약 분포 》 이상적 균형 대비</div>
    <div class="card-hd-sub">이상 균형(각 20%) 대비 실제 분포</div>
  </div>
  <div class="balance-section">
    <div>
      <div style="font-size:6pt;font-weight:700;color:#555;margin-bottom:5px;">오행별 강약 (점선=이상 20%)</div>
      <div class="oh-bars">
        ${OH_ORDER.map(k => {
          const o=OH[k]; const gr=GR[k]||'—'; const w=gradeW(gr); const sc=SC[k]||0;
          const pct=Math.round(sc/scT*100);
          const roleStr = ROLES[k] ? `<span style="color:${ROLE_BG[k]||'#888'};font-weight:700;">${ROLES[k]}</span>` : ``;
          return `<div class="oh-row">
  <div class="oh-icon t-${o.kor}">${o.short}</div>
  <div class="oh-label t-${o.kor}">${o.kor}(${o.short})</div>
  <div class="oh-bar-wrap">
    <div class="oh-bar oh-${o.kor}" style="width:${w}%;"></div>
    <div class="oh-ideal-marker" style="left:20%;"></div>
  </div>
  <div class="oh-grade t-${o.kor}">${esc(gr)}</div>
  <div class="oh-role">${roleStr||`${sc.toFixed(1)}pt`}</div>
</div>`;}).join('\n')}
        <div style="margin-top:4px;font-size:7pt;color:#aaa;">점선 = 이상 균형점 (각 20%)</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="font-size:6pt;font-weight:700;color:#555;">오행 분포 비율</div>
      <div style="position:relative;width:90px;height:90px;">
        <canvas id="donutChart" width="90" height="90"></canvas>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
          <div style="font-size:7pt;color:#888;">일간</div>
          <div style="font-family:'Noto Serif KR',serif;font-size:11pt;font-weight:800;color:${ilOh.c};line-height:1;">${esc(ilgan)}</div>
          <div style="font-size:6.5pt;color:#888;">${ilOh.name}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${OH_ORDER.map(k => {
          const o=OH[k]; const pct=Math.round(SC[k]/scT*100);
          const r=ROLES[k]||(SC[k]?SC[k].toFixed(1)+'pt':'—');
          const isBold=!!ROLES[k];
          return `<div style="display:flex;align-items:center;gap:3px;font-size:7pt;">
  <span style="width:6px;height:6px;border-radius:2px;background:${o.c};flex-shrink:0;"></span>
  <span style="font-weight:${isBold?'700':'400'};color:${isBold?ROLE_BG[k]||'#333':'#555'};">${o.name} ${pct}%</span><span style="color:#888;"> · ${r}</span>
</div>`;}).join('')}
      </div>
    </div>
  </div>
</div>

<!-- ③ 상생·상극 섹션 제거 (사용자 요청) — 별도 표(오행생극도)에서 다룸 -->

<!-- ④ → ③ 균형 평가표 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
    <div class="card-hd-title">③ 오행 균형 평가표 》 강화·주의 방법</div>
    <div class="card-hd-sub">각 오행의 역할과 실생활 활용법</div>
  </div>
  <table class="eval-table">
    <thead><tr>
      <th style="width:14mm;">오행</th><th style="width:18mm;">강약·점수</th>
      <th style="width:20mm;">4신 역할</th><th style="width:20mm;">현재 상태</th>
      <th>강화 방법</th><th>주의 사항</th>
    </tr></thead>
    <tbody>
      ${OH_ORDER.map((k,i) => evalRow(k,i)).join('\n')}
    </tbody>
  </table>
</div>

</div><!-- /page -->

<script>
(function(){
  const ctx = document.getElementById('donutChart');
  if(!ctx) return;
  new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:${JSON.stringify(chartLabels)},
      datasets:[{
        data:${JSON.stringify(chartData)},
        backgroundColor:${JSON.stringify(chartColors)},
        borderWidth:1,
        borderColor:'#fff'
      }]
    },
    options:{
      responsive:false, animation:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
      cutout:'62%'
    }
  });
})();
</script>
</body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});

  const outFile = path.join(outDir, '오행균형표.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ 오행균형표 생성: ${outFile}  (${Buffer.byteLength(H,'utf-8').toLocaleString()}B)`);
  return [outFile];
}

const slotId = process.argv[2];
if(!slotId){console.error('사용법: node generate_오행균형표.js <slot_id>');process.exit(1);}
generate(slotId);
