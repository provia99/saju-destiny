#!/usr/bin/env node
// generate_건강주의대운표.js
// 대운 기간 중 건강 주의가 필요한 시기를 오행→장기 매핑으로 표시
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch08.json
// 출력: tables/{slot}/건강주의대운표.html
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function loadJSON(file) {
  const fp = path.join(QUEUE_DIR, file);
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : {};
}

// 오행 → 장기계통 매핑
const 오행장기맵 = {
  '木': '간담(肝膽)',
  '火': '심장혈관(心臟)',
  '土': '비위소화기(脾胃)',
  '金': '폐호흡기(肺)',
  '水': '신장방광(腎臟)',
};

// 오행 → 건강 원인 설명
const 오행원인맵 = {
  '木': '스트레스·분노 누적, 간 기능 저하, 근육·인대 약화',
  '火': '심장 과부하, 혈압·순환 장애, 불면·열성 질환',
  '土': '소화불량, 위장 장애, 과식·비만, 면역 저하',
  '金': '호흡기 감염, 기관지·폐 약화, 피부 질환',
  '水': '신장·방광 기능 저하, 부종, 냉증, 비뇨기 질환',
};

function generate(slotId) {
  const d3 = loadJSON(`${slotId}_ch03.json`);
  const d8 = loadJSON(`${slotId}_ch08.json`);
  // saju_calc 보강 — r.대운목록을 단일 소스로 사용
  let saju = null;
  try { saju = require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d8); } catch(e){}
  if (!d3['이름'] && !d3['user_name']) { console.log('⚠️ 건강주의대운표: ch03/ch08.json 없음 (스킵)'); return; }

  const name = d3['이름'] || d3['user_name'] || slotId;
  const ilju = d3['일주한자'] || d3['일주'] || '';

  // ── saju_calc 대운길흉 기준으로 기신·구신 대운만 필터 ──
  // 5신 한자 추출 (오행장기맵 키와 일치하도록)
  const _ohExt = (raw) => (raw||'').match(/([木火土金水])/)?.[1] || raw || '';
  const 기신오행 = saju?.기신 || _ohExt(d3['기신오행'] || d8['기신오행']);
  const 구신오행 = saju?.구신 || _ohExt(d3['구신오행'] || d8['구신오행']);

  const 대운목록 = saju?.대운목록 || [];
  const 현재대운간지 = saju?.현재대운?.간지 || '';

  // 기신대운/구신대운만 추출 (saju_calc 종합판정 기준)
  const rows = 대운목록.filter(dw => {
    const 길흉 = dw.대운길흉 || '';
    return 길흉 === '기신대운' || 길흉 === '구신대운';
  }).map(dw => {
    const 길흉 = dw.대운길흉 || '';
    const is기신 = 길흉 === '기신대운';
    // 천간/지지 오행 → 장기계통 매핑 (둘 중 기신·구신에 해당하는 것 우선)
    const 천오 = dw.천간오행 || '';
    const 지오 = dw.지지오행 || '';
    const 매칭오행 = (천오 === 기신오행 || 천오 === 구신오행) ? 천오
                     : (지오 === 기신오행 || 지오 === 구신오행) ? 지오
                     : (천오 || 지오);
    const 주의장기 = 오행장기맵[매칭오행] ? `${오행장기맵[매칭오행]} 》 ${오행원인맵[매칭오행]||''}` : '—';
    return {
      간지: dw.간지,
      나이: dw.나이범위 || `${dw.시작나이}-${dw.종료나이}세`,
      길흉라벨: is기신 ? '⚠ 기신대운' : '⚠ 구신대운',
      주의장기,
      isCur: dw.간지 === 현재대운간지,
      is기신,
    };
  });

  const rowsHTML = rows.map(r => {
    const bgStyle = r.is기신
      ? 'background:#fff5f5;'
      : 'background:#fffde7;';
    const borderStyle = r.isCur ? 'border:2px solid #c62828;' : '';
    const 길흉Color = r.is기신 ? 'color:#c62828;font-weight:700;' : 'color:#e65100;font-weight:700;';
    return `<tr style="${bgStyle}${borderStyle}">
      <td style="font-weight:700;white-space:nowrap;">${esc(r.간지)}${r.isCur?' ▶':''}</td>
      <td style="white-space:nowrap;">${esc(r.나이)}</td>
      <td style="${길흉Color}">${esc(r.길흉라벨)}</td>
      <td>${esc(r.주의장기)}</td>
    </tr>`;
  }).join('');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>건강주의 대운표 》 ${esc(name)}님</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;margin:0 auto;padding:14px 20px;background:transparent;display:flex;flex-direction:column;gap:6px;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{body{background:transparent;margin:0;padding:0;}.page{margin:0;width:604px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px 820px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;margin-bottom:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
table{width:100%;border-collapse:collapse;font-size:9px;}
th{background:#1a3a6a;color:white;padding:5px 5px;font-size:10px;font-weight:700;text-align:left;}
td{border-bottom:1px solid #eee;padding:5px 5px;vertical-align:top;line-height:1.5;}
tr:last-child td{border-bottom:none;}
.note{font-size:8.5pt;color:#888;margin-top:4px;padding:4px 8px;background:#f9f9f9;border-radius:4px;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
  <div>
    <div class="banner-hdr-title">건강주의 대운표</div>
    <div class="banner-hdr-sub">기신·구신 대운 기간 건강 주의 시기 (saju_calc 종합판정 기준)</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}</div>
  </div>
</div>

${rows.length > 0 ? `
<table>
<thead><tr>
  <th>대운</th><th>나이</th><th>구분</th><th>주의 장기계통</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>
<div class="note">
  ※ 기신(忌神)·구신(仇神) 오행이 작용하는 대운 기간에 해당 장기계통 건강에 주의가 필요합니다.<br>
  ※ ▶ 표시는 현재 대운, 빨간 테두리는 현재 진행 중인 대운입니다.
</div>
` : `<div style="padding:20px;text-align:center;color:#888;font-size:8pt;">건강 주의 대운이 없습니다.</div>`}

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '건강주의대운표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '건강주의대운표');
  console.log(`✅ 건강주의대운표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_건강주의대운표.js <slot_id>'); process.exit(1); }
generate(slotId);
