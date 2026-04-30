#!/usr/bin/env node
/**
 * 요약본 전용 — 지장간 요약표 (604×840px)
 * ch07.json 의존 없이 saju_calc 직접 사용
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('../../font_config');
const ENGINE_ROOT = path.join(__dirname, '..', '..');

const slotId = process.argv[2];
if (!slotId) { console.error('Usage: node generate_지장간요약표.js <slotId>'); process.exit(1); }

const QUEUE_DIR = path.join(ENGINE_ROOT, 'queue');
let masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
if (!fs.existsSync(masterPath)) {
  const sd = path.dirname(path.join(QUEUE_DIR, `${slotId}_ch03.json`));
  if (fs.existsSync(sd)) { const g = fs.readdirSync(sd).filter(f=>f==='master.json'); if (g.length) masterPath = path.join(sd, g[0]); }
}
if (!fs.existsSync(masterPath)) { console.warn('지장간요약표: master.json 없음'); process.exit(0); }

const { 전체사주계산, 지장간표, 천간오행: _천간오행 } = require('../../saju_calc');
const M = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const r = 전체사주계산({이름:M.이름, 성별:M.성별??'남', 년:M.생년, 월:M.생월, 일:M.생일, 시간: M.생시||'모름', 음력입력:!!M.음력입력, 윤달:!!M.윤달, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

const OH_C = {木:'#4caf50',火:'#f44336',土:'#ff9800',金:'#9e9e9e',水:'#2196f3'};
const 천간오행 = _천간오행; // saju_calc에서 import
const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const 지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const oh = {木:'목',火:'화',土:'토',金:'금',水:'수'};
const name = M.이름 || slotId;
const 원국 = r.원국;
const 위치 = ['년지','월지','일지','시지'];
const 지지들 = [원국.년주.지지, 원국.월주.지지, 원국.일주.지지, 원국.시주.지지];
const 위치한글 = ['년지(年支)','월지(月支)','일지(日支)','시지(時支)'];

// 지장간 데이터 추출
function getJijanggan(지지) {
  const jj = 지장간표?.[지지];
  if (!jj) return [];
  return jj.filter(item => item !== null && item !== undefined).map(item => ({
    천간: item.간 || item.천간 || '',
    오행: 천간오행[item.간||item.천간||''] || '',
    비율: item.일 ? Math.round(item.일/30*100)/100 : (item.비율 || 0),
    유형: item.십성키 || item.유형 || '',
  }));
}

const rows = 지지들.map((지지, i) => {
  const jj = getJijanggan(지지);
  return { 위치: 위치한글[i], 지지, 지지한글: 지지음[지지], 지장간: jj };
});

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{width:604px;max-height:840px;overflow:hidden;padding:8px 10px;display:flex;flex-direction:column;gap:4px;}
@media print{.page{margin:0;border:none;}@page{size:604px 840px;margin:0;}}
.hdr{background:linear-gradient(135deg,#5c6bc0,#3949ab);padding:8px 14px;border-radius:8px;color:white;}
.hdr h2{font-size:11pt;font-weight:900;}
.hdr p{font-size:7pt;opacity:0.85;margin-top:2px;}
.desc{font-size:7pt;color:#666;margin:4px 0;line-height:1.5;padding:4px 8px;background:#f5f5f5;border-radius:6px;}
.tbl{width:100%;border-collapse:collapse;margin:4px 0;}
.tbl th{background:#f0eee6;padding:6px 8px;font-weight:800;border:1px solid #ddd;font-size:7.5pt;color:#5a4e3c;}
.tbl td{padding:6px 8px;border:1px solid #eee;vertical-align:top;font-size:7.5pt;line-height:1.5;}
.tbl tr:nth-child(even){background:#fafafa;}
.oh-badge{display:inline-block;padding:1px 6px;border-radius:10px;font-weight:800;font-size:7.5pt;color:white;min-width:35px;text-align:center;}
.bar{display:inline-block;height:8px;border-radius:4px;margin-left:4px;vertical-align:middle;}
.jj-item{display:flex;align-items:center;gap:4px;margin:2px 0;}
.tip{background:rgba(212,175,55,0.08);border-left:3px solid #d4af37;padding:5px 8px;border-radius:4px;font-size:6.5pt;margin-top:4px;line-height:1.5;}
.tip b{color:#8b6914;}
</style></head><body>
<div class="page">

<div class="hdr">
  <h2>🔍 ${name} 님의 지장간(支藏干) 요약표</h2>
  <p>겉으로 보이지 않는 숨겨진 에너지 지도</p>
</div>

<div class="desc">
  지장간이란? 🤔 지지(땅 글자) 안에 숨어 있는 천간(하늘 글자)이에요.<br>
  겉으로 보이는 여덟 글자 외에 속에 숨겨진 보물창고! 나이가 들면서 조금씩 드러나는 잠재 에너지입니다.
</div>

<table class="tbl">
<tr>
  <th style="width:75px;">위치</th>
  <th style="width:55px;">지지</th>
  <th>숨어 있는 천간 (지장간)</th>
  <th style="width:120px;">에너지 비율</th>
</tr>
${rows.map(r => `<tr>
  <td style="font-weight:700;">${r.위치}</td>
  <td style="text-align:center;font-size:12pt;font-weight:900;">${r.지지}<br><span style="font-size:7pt;color:#888;">${r.지지한글}</span></td>
  <td>${r.지장간.length ? r.지장간.map(j => {
    const c = OH_C[j.오행] || '#888';
    return `<div class="jj-item"><span class="oh-badge" style="background:${c}">${j.천간}</span> <span style="font-size:7pt;">${천간음[j.천간]||''}(${j.오행?oh[j.오행]:''})</span> <span style="font-size:6pt;color:#888;">${j.유형}</span></div>`;
  }).join('') : '<span style="color:#aaa;">데이터 없음</span>'}</td>
  <td>${r.지장간.length ? r.지장간.map(j => {
    const c = OH_C[j.오행] || '#888';
    const w = Math.round(j.비율 * 100);
    return `<div class="jj-item"><span class="bar" style="background:${c};width:${w}px;"></span> <span style="font-size:6.5pt;">${w}%</span></div>`;
  }).join('') : ''}</td>
</tr>`).join('\n')}
</table>

<div class="tip">
  <b>💡 이게 왜 중요하냐고요?</b><br>
  겉으로 보이는 사주 여덟 글자만으로는 설명이 안 되는 능력이나 성향이 있어요.<br>
  "어? 저 분 이런 능력도 있었어?" — 그게 바로 지장간 에너지가 드러나는 순간이에요!<br>
  특히 <b>나이가 들면서</b> 지장간의 숨겨진 기운이 점점 더 표면으로 올라옵니다. 🌟
</div>

</div></body></html>`;

const TABLES_DIR = path.join(ENGINE_ROOT, 'tables');
const outDir = path.join(TABLES_DIR, slotId);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});
fs.writeFileSync(path.join(outDir, '지장간요약표.html'), html);
const qtd = path.dirname(masterPath);
const qtables = path.join(qtd, 'tables');
if (fs.existsSync(qtables)) fs.writeFileSync(path.join(qtables, '지장간요약표.html'), html);
console.log(`✅ 지장간요약표 생성: ${path.join(outDir, '지장간요약표.html')}  (${Buffer.byteLength(html)}B)`);
