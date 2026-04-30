#!/usr/bin/env node
/**
 * generate_인간관계표.js — 오행 기반 인간관계 궁합표
 * 용신/희신/기신/구신/한신 + 상생/상극 기반 관계 분석
 * 출력: tables/{slot}/인간관계표.html (604×860px)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

const OH = {
  木: { name:'木(목)', color:'#4caf50', bg:'#e8f5e9', icon:'🌿', dir:'동(東)', career:'교육·출판·환경·패션', personality:'추진력·개척·성장', health:'간·담·근육·눈' },
  火: { name:'火(화)', color:'#f44336', bg:'#fff3e0', icon:'🔥', dir:'남(南)', career:'엔터·마케팅·요식·에너지', personality:'열정·표현·사교', health:'심장·소장·혈액' },
  土: { name:'土(토)', color:'#ff9800', bg:'#fff8e1', icon:'🏔️', dir:'중앙',   career:'부동산·건축·중개·보험', personality:'안정·신뢰·포용', health:'위장·비장·소화기' },
  金: { name:'金(금)', color:'#9e9e9e', bg:'#f5f5f5', icon:'⚔️', dir:'서(西)', career:'금융·법률·기계·제조', personality:'결단·원칙·냉철', health:'폐·대장·피부' },
  水: { name:'水(수)', color:'#2196f3', bg:'#e3f2fd', icon:'💧', dir:'북(北)', career:'무역·IT·컨설팅·미디어', personality:'전략·유연·지혜', health:'신장·방광·뼈' },
};

const 상생 = {木:'火',火:'土',土:'金',金:'水',水:'木'};
const 상극 = {木:'土',土:'水',水:'火',火:'金',金:'木'};
const 역상생 = {火:'木',土:'火',金:'土',水:'金',木:'水'};
const 역상극 = {土:'木',水:'土',火:'水',金:'火',木:'金'};

function generate(slotId) {
  // 데이터 로드
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  let masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
  if (!fs.existsSync(masterPath)) {
    const _sd = path.dirname(path.join(QUEUE_DIR, `${slotId}_ch03.json`));
    if (fs.existsSync(_sd)) {
      const _g = fs.readdirSync(_sd).filter(f => f === 'master.json');
      if (_g.length) masterPath = path.join(_sd, _g[0]);
    }
  }

  let name = slotId, 용신 = '', 희신 = '', 기신 = '', 구신 = '', 한신 = '', 일간 = '', 일간오행 = '', 신강약 = '';

  // saju_calc 직접 계산
  try {
    const { 전체사주계산 } = require('./saju_calc');
    if (fs.existsSync(masterPath)) {
      const M = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      name = M.이름 || slotId;
      const r = 전체사주계산({이름:M.이름, 성별:M.성별, 년:M.생년, 월:M.생월, 일:M.생일, 시간: M.생시||'모름', 음력입력:!!M.음력입력, 윤달:!!M.윤달, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});
      용신 = r.용신; 희신 = r.희신; 기신 = r.기신; 구신 = r.구신; 한신 = r.한신;
      일간 = r.일간; 일간오행 = r.일간오행; 신강약 = r.신강약;
    }
  } catch(e) {}

  if (!용신) { console.warn('인간관계표: 용신 데이터 없음'); return; }

  // 5신 역할 매핑
  const 역할맵 = {};
  역할맵[용신] = { role:'용신(用神)', label:'✅ 내게 가장 필요한 기운', grade:'최고', cls:'yong' };
  역할맵[희신] = { role:'희신(喜神)', label:'✅ 용신을 도와주는 기운', grade:'좋음', cls:'hui' };
  역할맵[기신] = { role:'기신(忌神)', label:'⚠️ 내게 해로운 기운', grade:'주의', cls:'gi' };
  역할맵[구신] = { role:'구신(仇神)', label:'⚠️ 기신을 돕는 기운', grade:'경계', cls:'gu' };
  역할맵[한신] = { role:'한신(閑神)', label:'— 큰 영향 없는 기운', grade:'중립', cls:'han' };

  // 상생/상극 관계
  function 관계분석(상대오행) {
    const r = 역할맵[상대오행] || { role:'?', label:'?', grade:'중립', cls:'han' };
    const 내가생 = 상생[일간오행] === 상대오행; // 내가 상대를 생
    const 상대가생 = 역상생[일간오행] === 상대오행; // 상대가 나를 생
    const 내가극 = 상극[일간오행] === 상대오행; // 내가 상대를 극
    const 상대가극 = 역상극[일간오행] === 상대오행; // 상대가 나를 극
    const 동오행 = 일간오행 === 상대오행;

    let 상생극 = '';
    if (동오행) 상생극 = '동류(同類) — 같은 기운';
    else if (상대가생) 상생극 = `${상대오행}→${일간오행} 상생 (상대가 나를 생)`;
    else if (내가생) 상생극 = `${일간오행}→${상대오행} 상생 (내가 상대를 생)`;
    else if (상대가극) 상생극 = `${상대오행}→${일간오행} 상극 (상대가 나를 극)`;
    else if (내가극) 상생극 = `${일간오행}→${상대오행} 상극 (내가 상대를 극)`;

    // 실질 판단
    let 판단 = '', 판단아이콘 = '', 판단색 = '';
    if (r.cls === 'yong') { 판단 = '내가 크게 덕봅니다'; 판단아이콘 = '🟢'; 판단색 = '#2e7d32'; }
    else if (r.cls === 'hui') { 판단 = '내게 도움이 됩니다'; 판단아이콘 = '🔵'; 판단색 = '#1565c0'; }
    else if (r.cls === 'gi') { 판단 = '내가 손해봅니다'; 판단아이콘 = '🔴'; 판단색 = '#c62828'; }
    else if (r.cls === 'gu') { 판단 = '간접적으로 해롭습니다'; 판단아이콘 = '🟠'; 판단색 = '#e65100'; }
    else { 판단 = '큰 영향 없습니다'; 판단아이콘 = '⚪'; 판단색 = '#757575'; }

    // 실전 조언
    let 조언 = '';
    if (r.cls === 'yong') 조언 = `이 오행이 강한 사람을 가까이 하십시오. ${name} 님의 에너지가 살아납니다. 동업·파트너·멘토로 최적입니다.`;
    else if (r.cls === 'hui') 조언 = `좋은 인연입니다. 자연스럽게 시너지가 납니다. 팀원·친구·조력자로 좋습니다.`;
    else if (r.cls === 'gi') 조언 = `이 오행이 강한 사람과의 관계에서 에너지 소모가 큽니다. 깊은 동업이나 금전 거래는 신중하십시오.`;
    else if (r.cls === 'gu') 조언 = `겉으로는 무해해 보이지만, 기신을 강화하는 간접 방해자입니다. 큰 결정에서 이 유형의 조언은 한 번 더 검토하십시오.`;
    else 조언 = `특별한 득실은 없습니다. 편안하지만 큰 변화를 주지 않는 관계입니다.`;

    return { ...r, 상생극, 판단, 판단아이콘, 판단색, 조언, oh: OH[상대오행] };
  }

  // 5가지 오행 분석
  const 오행목록 = ['木','火','土','金','水'];
  const 분석 = 오행목록.map(oh => ({ 오행: oh, ...관계분석(oh) }));

  // 천간별 상세 매핑
  const 천간표 = {
    '甲': {oh:'木',음양:'양',유형:'큰 나무형 리더'}, '乙': {oh:'木',음양:'음',유형:'유연한 덩굴형'},
    '丙': {oh:'火',음양:'양',유형:'태양형 열정가'}, '丁': {oh:'火',음양:'음',유형:'촛불형 전문가'},
    '戊': {oh:'土',음양:'양',유형:'큰 산형 중심축'}, '己': {oh:'土',음양:'음',유형:'논밭형 포용자'},
    '庚': {oh:'金',음양:'양',유형:'강철형 실행가'}, '辛': {oh:'金',음양:'음',유형:'보석형 감각파'},
    '壬': {oh:'水',음양:'양',유형:'바다형 전략가'}, '癸': {oh:'水',음양:'음',유형:'이슬형 직관파'},
  };

  const 용C = OH[용신] || OH['木'];
  const 기C = OH[기신] || OH['金'];

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{width:604px;max-height:860px;overflow:hidden;padding:4px 6px;display:flex;flex-direction:column;gap:1px;font-size:84%;}
@media print{body{background:transparent;margin:0;padding:0;}.page{margin:0;border:none;}@page{size:604px 860px;margin:0;}}

.hdr{background:linear-gradient(135deg,${용C.color},${용C.color}dd);padding:4px 10px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;}
.hdr-title{font-size:9pt;font-weight:900;color:white;}
.hdr-sub{font-size:6pt;color:rgba(255,255,255,0.85);}

.summary{display:flex;gap:3px;margin:2px 0;}
.sum-card{flex:1;border-radius:4px;padding:2px 4px;text-align:center;border:1px solid #ddd;}
.sum-label{font-size:5pt;color:#888;margin-bottom:0;}
.sum-value{font-size:7pt;font-weight:800;}
.sum-sub{font-size:5pt;color:#666;margin-top:0;}

.tbl{width:100%;border-collapse:collapse;font-size:6pt;margin:1px 0;}
.tbl th{background:#f5f0e6;padding:2px;font-weight:800;border:1px solid #ddd;font-size:5.5pt;color:#5a4e3c;}
.tbl td{padding:2px;border:1px solid #eee;vertical-align:top;line-height:1.25;}
.tbl tr:nth-child(even){background:#fafafa;}

.oh-badge{display:inline-block;padding:1px 6px;border-radius:10px;font-weight:800;font-size:8pt;color:white;min-width:42px;text-align:center;}
.role-badge{display:inline-block;padding:1px 5px;border-radius:4px;font-size:6.5pt;font-weight:700;}
.role-yong{background:rgba(46,125,50,0.15);color:#2e7d32;}
.role-hui{background:rgba(21,101,192,0.15);color:#1565c0;}
.role-gi{background:rgba(198,40,40,0.15);color:#c62828;}
.role-gu{background:rgba(230,81,0,0.15);color:#e65100;}
.role-han{background:rgba(117,117,117,0.1);color:#757575;}

.grade{font-weight:800;font-size:8pt;}
.grade-best{color:#2e7d32;}
.grade-good{color:#1565c0;}
.grade-warn{color:#c62828;}
.grade-caution{color:#e65100;}
.grade-neutral{color:#757575;}

.sect{margin:2px 0 1px;font-size:7pt;font-weight:800;color:#5a4e3c;border-bottom:1px solid #d4af37;padding-bottom:1px;}

.chun-tbl{width:100%;border-collapse:collapse;font-size:6pt;}
.chun-tbl th{background:#f5f0e6;padding:2px;font-weight:700;border:1px solid #ddd;font-size:5.5pt;}
.chun-tbl td{padding:1.5px 2px;border:1px solid #eee;text-align:center;line-height:1.2;}

.tip{background:rgba(212,175,55,0.08);border-left:2px solid #d4af37;padding:3px 5px;border-radius:3px;font-size:5.5pt;margin-top:2px;line-height:1.3;}
.tip b{color:#8b6914;}
</style></head><body>
<div class="page">

<!-- 헤더 -->
<div class="hdr">
  <div>
    <div class="hdr-title">인간관계 궁합표 · ${name} 님</div>
    <div class="hdr-sub">일간 ${일간}(${일간오행}) · ${신강약} · 용신 ${OH[용신].name}</div>
  </div>
  <div style="font-size:6pt;color:rgba(255,255,255,0.8);text-align:right;">나의 기준: 용신(5신)<br>상대 기준: 일간 오행</div>
</div>

<!-- 대조 기준 안내 -->
<div style="display:flex;align-items:stretch;gap:0;margin:2px 0;border:2px solid #d4af37;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(212,175,55,0.15);">
  <div style="flex:1;text-align:center;padding:4px 8px;background:linear-gradient(135deg,${용C.bg},${용C.bg}ee);">
    <div style="font-size:6.5pt;color:#666;font-weight:700;">나 · ${name}</div>
    <div style="font-size:11pt;font-weight:900;color:${용C.color};margin:1px 0;">용신 <span style="font-size:14pt;">${용신}</span><span style="font-size:8pt;color:#888;">(${OH[용신].name.match(/\((.+)\)/)?.[1]||''})</span></div>
    <div style="display:flex;justify-content:center;gap:3px;margin-top:1px;">
      <span style="background:${용C.color};color:white;padding:1px 6px;border-radius:8px;font-size:5.5pt;font-weight:700;">내가 필요한 기운</span>
    </div>
  </div>
  <div style="background:linear-gradient(180deg,#d4af37,#c9a227);color:white;padding:4px 4px;font-size:9pt;font-weight:900;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">
    <span style="font-size:6pt;">대조</span>
    <span style="font-size:11pt;">⟷</span>
  </div>
  <div style="flex:1;text-align:center;padding:4px 8px;background:linear-gradient(135deg,#f8f8f8,#f0f0f0);">
    <div style="font-size:6.5pt;color:#666;font-weight:700;">상대방</div>
    <div style="font-size:11pt;font-weight:900;color:#333;margin:1px 0;">일간 <span style="font-size:9pt;color:#555;">오행</span></div>
    <div style="display:flex;justify-content:center;gap:2px;margin-top:1px;">
      ${오행목록.map(oh => `<span style="background:${OH[oh].color};color:white;padding:0 3px;border-radius:6px;font-size:6pt;font-weight:800;">${oh}</span>`).join('')}
    </div>
    <div style="font-size:5.5pt;color:#999;margin-top:1px;">그 사람의 본질 오행</div>
  </div>
</div>

<!-- 요약 카드 -->
<div class="summary">
  <div class="sum-card" style="border-color:${용C.color};background:${용C.bg}">
    <div class="sum-label">가장 좋은 인연</div>
    <div class="sum-value" style="color:${용C.color}">${OH[용신].name}</div>
    <div class="sum-sub">${OH[용신].personality}</div>
  </div>
  <div class="sum-card" style="border-color:${OH[희신].color};background:${OH[희신].bg}">
    <div class="sum-label">도움 되는 인연</div>
    <div class="sum-value" style="color:${OH[희신].color}">${OH[희신].name}</div>
    <div class="sum-sub">${OH[희신].personality}</div>
  </div>
  <div class="sum-card" style="border-color:${기C.color};background:rgba(198,40,40,0.05)">
    <div class="sum-label">주의할 인연</div>
    <div class="sum-value" style="color:${기C.color}">${OH[기신].name}</div>
    <div class="sum-sub">${OH[기신].personality}</div>
  </div>
  <div class="sum-card" style="border-color:${OH[구신].color};background:${OH[구신].bg}">
    <div class="sum-label">간접 방해</div>
    <div class="sum-value" style="color:${OH[구신].color}">${OH[구신].name}</div>
    <div class="sum-sub">${OH[구신].personality}</div>
  </div>
  <div class="sum-card" style="border-color:#bbb">
    <div class="sum-label">중립</div>
    <div class="sum-value" style="color:${OH[한신].color}">${OH[한신].name}</div>
    <div class="sum-sub">${OH[한신].personality}</div>
  </div>
</div>

<!-- 오행별 관계 상세표 -->
<div class="sect">상대방의 일간(日干) 오행별 나와의 관계</div>
<table class="tbl" style="table-layout:fixed;width:100%;">
<tr>
  <th style="width:50px;">상대<br>일간</th>
  <th style="width:60px;">5신 역할</th>
  <th style="width:28px;">판정</th>
  <th style="width:120px;">관계·판단</th>
  <th>실전 조언</th>
</tr>
${분석.map(a => `<tr>
  <td style="text-align:center;"><span class="oh-badge" style="background:${a.oh.color}">${a.오행}</span><br><span style="font-size:6pt;color:#888;">${a.oh.personality}</span></td>
  <td><span class="role-badge role-${a.cls}">${a.role}</span></td>
  <td style="text-align:center;"><span style="font-size:10pt;">${a.판단아이콘}</span></td>
  <td style="font-size:6.5pt;word-break:keep-all;"><span class="grade grade-${a.cls==='yong'?'best':a.cls==='hui'?'good':a.cls==='gi'?'warn':a.cls==='gu'?'caution':'neutral'}" style="font-size:7pt;">${a.판단}</span><br><span style="color:#888;">${a.상생극}</span></td>
  <td style="font-size:7pt;line-height:1.55;word-break:keep-all;padding:4px 6px;">${a.조언}</td>
</tr>`).join('\n')}
</table>

<!-- 천간별(10종) 상세 궁합 -->
<div class="sect">천간(天干) 10종 상세 궁합</div>
<table class="chun-tbl">
<tr>
  <th>천간</th><th>오행</th><th>유형</th><th>5신</th><th>판정</th><th>동업</th><th>친구</th><th>배우자</th>
</tr>
${Object.entries(천간표).map(([간,info]) => {
  const r = 역할맵[info.oh] || { role:'한신', cls:'han' };
  const 동업 = r.cls==='yong'?'◎ 최적':r.cls==='hui'?'○ 좋음':r.cls==='gi'?'✕ 위험':r.cls==='gu'?'△ 주의':'- 무난';
  const 친구 = r.cls==='yong'?'◎ 에너지↑':r.cls==='hui'?'○ 편안':r.cls==='gi'?'△ 소모':r.cls==='gu'?'△ 경계':'- 보통';
  const 배우자 = r.cls==='yong'?'◎ 천생연분':r.cls==='hui'?'○ 안정적':r.cls==='gi'?'✕ 갈등多':r.cls==='gu'?'△ 긴장':'- 무난';
  const 같은일간 = 간 === 일간;
  const bg = 같은일간 ? 'background:#fff8e1;' : '';
  return `<tr style="${bg}">
    <td style="font-weight:800;font-size:7pt;">${간}${같은일간?' ←나':''}</td>
    <td><span class="oh-badge" style="background:${OH[info.oh].color};font-size:6pt;min-width:26px;">${info.oh}</span></td>
    <td style="font-size:6pt;">${info.유형}</td>
    <td><span class="role-badge role-${r.cls}" style="font-size:5pt;">${r.role.replace(/[()]/g,'')}</span></td>
    <td style="font-weight:700;color:${r.cls==='yong'?'#2e7d32':r.cls==='hui'?'#1565c0':r.cls==='gi'?'#c62828':r.cls==='gu'?'#e65100':'#757575'};font-size:7pt;">${r.cls==='yong'?'🟢':r.cls==='hui'?'🔵':r.cls==='gi'?'🔴':r.cls==='gu'?'🟠':'⚪'}</td>
    <td style="font-size:6pt;">${동업}</td>
    <td style="font-size:6pt;">${친구}</td>
    <td style="font-size:6pt;">${배우자}</td>
  </tr>`;
}).join('\n')}
</table>

<!-- TIP -->
<div class="tip">
  <b>TIP</b> 이 표는 <b>상대방의 일간(日干) 오행</b>을 기준으로 합니다. 일간은 그 사람 자체의 본질 오행이며, 용신과는 다릅니다. 상대의 생년월일을 알면 일간을 구할 수 있고, 모르면 아래 성격 유형으로 짐작할 수 있습니다.
  <div style="margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:6pt;line-height:1.4;">
    <div><span style="color:#4caf50;font-weight:800;">木 추진형</span> — 아이디어가 넘치고 "해보자!"가 먼저 나오는 사람</div>
    <div><span style="color:#f44336;font-weight:800;">火 열정형</span> — 분위기 메이커, 사람 모이는 곳에 항상 있는 사람</div>
    <div><span style="color:#ff9800;font-weight:800;">土 안정형</span> — 묵직하고 믿음직한 "저 사람이면 괜찮아" 타입</div>
    <div><span style="color:#9e9e9e;font-weight:800;">金 원칙형</span> — 칼같이 정확하고 원칙을 지키는 사람</div>
    <div><span style="color:#2196f3;font-weight:800;">水 전략형</span> — 조용하지만 깊이 있고 큰 그림을 보는 사람</div>
    <div style="font-weight:700;color:#8b6914;">→ <b>${name} 님에게 최고의 인연: ${OH[용신].name}</b></div>
  </div>
</div>

</div>
</body></html>`;

  // 저장
  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '인간관계표.html');
  fs.writeFileSync(outPath, html, 'utf8');

  // queue tables에도 복사
  const queueTablesDir = path.dirname(path.join(QUEUE_DIR, `${slotId}_ch03.json`));
  const qtd = path.join(queueTablesDir, 'tables');
  if (fs.existsSync(qtd)) {
    fs.writeFileSync(path.join(qtd, '인간관계표.html'), html, 'utf8');
  }

  console.log(`✅ 인간관계표 생성: ${outPath}  (${Buffer.byteLength(html)}B)`);
}

// CLI
const slotId = process.argv[2];
if (!slotId) { console.error('Usage: node generate_인간관계표.js <slotId>'); process.exit(1); }
generate(slotId);
if (typeof module !== 'undefined') module.exports = { generate };
