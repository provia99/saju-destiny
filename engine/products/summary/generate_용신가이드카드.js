#!/usr/bin/env node
/**
 * 요약본 전용 — 용신 가이드 카드 (604×840px)
 * ch06.json 의존 없이 saju_calc 직접 사용
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('../../font_config');
const ENGINE_ROOT = path.join(__dirname, '..', '..');

const slotId = process.argv[2];
if (!slotId) { console.error('Usage: node generate_용신가이드카드.js <slotId>'); process.exit(1); }

const QUEUE_DIR = path.join(ENGINE_ROOT, 'queue');
let masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
if (!fs.existsSync(masterPath)) {
  const sd = path.dirname(path.join(QUEUE_DIR, `${slotId}_ch03.json`));
  if (fs.existsSync(sd)) { const g = fs.readdirSync(sd).filter(f=>f==='master.json'); if (g.length) masterPath = path.join(sd, g[0]); }
}
if (!fs.existsSync(masterPath)) { console.warn('용신가이드카드: master.json 없음'); process.exit(0); }

const { 전체사주계산 } = require('../../saju_calc');
const M = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const r = 전체사주계산({이름:M.이름, 성별:M.성별??'남', 년:M.생년, 월:M.생월, 일:M.생일, 시간: M.생시||'모름', 음력입력:!!M.음력입력, 윤달:!!M.윤달, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

const OH = {
  木:{name:'木(목)',c:'#4caf50',bg:'#e8f5e9',색상:'초록·연두',방위:'동(東)',계절:'봄(3~5월)',음식:'신맛·녹색채소·시금치·부추',직업:'교육·출판·유통·환경·패션',건강:'간·담·근육·눈'},
  火:{name:'火(화)',c:'#f44336',bg:'#fff3e0',색상:'적색·주황',방위:'남(南)',계절:'여름(6~8월)',음식:'쓴맛·붉은식품·토마토·고추',직업:'엔터·마케팅·요식·에너지·광고',건강:'심장·소장·혈액순환'},
  土:{name:'土(토)',c:'#ff9800',bg:'#fff8e1',색상:'황토·베이지',방위:'중앙',계절:'환절기(3·6·9·12월)',음식:'단맛·곡물·감자·고구마·꿀',직업:'부동산·건축·중개·보험·농업',건강:'위장·비장·소화기'},
  金:{name:'金(금)',c:'#9e9e9e',bg:'#f5f5f5',색상:'흰색·은색·금색',방위:'서(西)',계절:'가을(9~11월)',음식:'짠맛·흰색식품·두부·배·해산물',직업:'금융·법률·기계·제조·군경·회계',건강:'폐·대장·피부·호흡기'},
  水:{name:'水(수)',c:'#2196f3',bg:'#e3f2fd',색상:'검정·남색',방위:'북(北)',계절:'겨울(12~2월)',음식:'짠맛·검은콩·해조류·미역',직업:'무역·물류·IT·컨설팅·미디어',건강:'신장·방광·뼈·귀'},
};

const 용 = OH[r.용신]; const 희 = OH[r.희신]; const 기 = OH[r.기신];
const name = M.이름 || slotId;

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{width:604px;max-height:840px;overflow:hidden;padding:8px 10px;display:flex;flex-direction:column;gap:4px;}
@media print{.page{margin:0;border:none;}@page{size:604px 840px;margin:0;}}
.hdr{background:linear-gradient(135deg,${용.c},${용.c}dd);padding:8px 14px;border-radius:8px;color:white;}
.hdr h2{font-size:11pt;font-weight:900;}
.hdr p{font-size:7pt;opacity:0.85;margin-top:2px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;}
.card{border:1.5px solid #ddd;border-radius:8px;padding:8px 10px;background:white;}
.card h3{font-size:8pt;font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:4px;}
.card .dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
.card p{font-size:7pt;color:#555;line-height:1.5;}
.card .val{font-size:9pt;font-weight:800;margin:3px 0;}
.main{border:2.5px solid ${용.c};background:${용.bg};}
.main h3{color:${용.c};}
.section{margin:4px 0 2px;font-size:8pt;font-weight:800;color:#5a4e3c;border-bottom:1.5px solid #d4af37;padding-bottom:2px;}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin:3px 0;}
.mini{border:1px solid #eee;border-radius:6px;padding:5px 8px;text-align:center;}
.mini .label{font-size:6pt;color:#888;}
.mini .value{font-size:8pt;font-weight:800;margin-top:2px;}
.tip{background:rgba(212,175,55,0.08);border-left:3px solid #d4af37;padding:5px 8px;border-radius:4px;font-size:6.5pt;margin-top:4px;line-height:1.5;}
.tip b{color:#8b6914;}
</style></head><body>
<div class="page">

<div class="hdr">
  <h2>🧭 ${name} 님의 용신(用神) 가이드 카드</h2>
  <p>일간 ${r.일간}(${r.일간오행}) · ${r.신강약} · 용신 ${용.name}</p>
</div>

<div class="grid">
  <div class="card main">
    <h3><span class="dot" style="background:${용.c}"></span> 용신(用神) — 가장 필요한 기운</h3>
    <div class="val" style="color:${용.c}">${용.name}</div>
    <p>🎨 색상: ${용.색상}</p>
    <p>🧭 방위: ${용.방위}</p>
    <p>🍂 계절: ${용.계절}</p>
    <p>🍽️ 음식: ${용.음식}</p>
    <p>💼 직업: ${용.직업}</p>
    <p>🏥 건강: ${용.건강}</p>
  </div>
  <div class="card" style="border-color:${희.c};background:${희.bg}">
    <h3><span class="dot" style="background:${희.c}"></span> 희신(喜神) — 도와주는 기운</h3>
    <div class="val" style="color:${희.c}">${희.name}</div>
    <p>🎨 색상: ${희.색상}</p>
    <p>🧭 방위: ${희.방위}</p>
    <p>🍂 계절: ${희.계절}</p>
    <p>🍽️ 음식: ${희.음식}</p>
    <p>💼 직업: ${희.직업}</p>
    <p>🏥 건강: ${희.건강}</p>
  </div>
</div>

<div class="section">⚠️ 주의할 기운</div>
<div class="card" style="border-color:${기.c};background:rgba(244,67,54,0.03);">
  <h3><span class="dot" style="background:${기.c}"></span> 기신(忌神) — 피해야 할 기운</h3>
  <div class="val" style="color:${기.c}">${기.name}</div>
  <p>이 방향의 큰 투자·동업·계약은 한 번 더 검토하십시오. 기신 대운(大運)·세운(歲運)에는 방어 모드로 전환하십시오.</p>
</div>

<div class="section">📋 오늘 당장 할 수 있는 것</div>
<div class="row3">
  <div class="mini" style="background:${용.bg}"><div class="label">옷·소품 색상</div><div class="value" style="color:${용.c}">${용.색상}</div></div>
  <div class="mini" style="background:${용.bg}"><div class="label">책상 방향</div><div class="value" style="color:${용.c}">${용.방위}</div></div>
  <div class="mini" style="background:${용.bg}"><div class="label">오늘 저녁 메뉴</div><div class="value" style="color:${용.c}">${용.음식.split('·')[1]||용.음식.split('·')[0]}</div></div>
</div>

<div class="section">🗓️ 5신 달력 가이드</div>
<div class="row3">
  <div class="mini"><div class="label">좋은 달</div><div class="value" style="color:#2e7d32;">용신·희신 방향 월</div></div>
  <div class="mini"><div class="label">주의할 달</div><div class="value" style="color:#c62828;">기신 방향 월</div></div>
  <div class="mini"><div class="label">중립 달</div><div class="value" style="color:#757575;">한신 방향 월</div></div>
</div>

<div class="tip">
  <b>TIP</b> ${name} 님의 용신 ${용.name} 방향으로 하루 한 가지만 실천해보십시오. 색상을 바꾸는 것만으로도 무의식이 용신 주파수에 맞춰집니다. "내 충전기는 ${r.용신}이다" — 이것만 기억하면 됩니다!
</div>

</div></body></html>`;

const TABLES_DIR = path.join(ENGINE_ROOT, 'tables');
const outDir = path.join(TABLES_DIR, slotId);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});
fs.writeFileSync(path.join(outDir, '용신가이드카드.html'), html);
// queue tables에도
const qtd = path.dirname(masterPath);
const qtables = path.join(qtd, 'tables');
if (fs.existsSync(qtables)) fs.writeFileSync(path.join(qtables, '용신가이드카드.html'), html);
console.log(`✅ 용신가이드카드 생성: ${path.join(outDir, '용신가이드카드.html')}  (${Buffer.byteLength(html)}B)`);
