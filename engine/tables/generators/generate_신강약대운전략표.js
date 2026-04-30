#!/usr/bin/env node
// generate_신강약대운전략표.js
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch06.json + queue/{slot}_ch08.json
// 출력: tables/{slot}/신강약대운전략표.html
// 신강 vs 신약 대운 유형별 전략 비교표
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

function generate(slotId) {
  const d3 = loadJSON(`${slotId}_ch03.json`);
  const d6 = loadJSON(`${slotId}_ch06.json`);
  const d8 = loadJSON(`${slotId}_ch08.json`);
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d6, d8); } catch(e){}

  // 인적사항
  const name    = d3['이름']        || slotId;
  const ilju    = d3['일주']        || '';
  const sinGang = d3['신강약']      || d6['신강약'] || '';
  const gyeokNm = d3['격국명']      || d6['격국명'] || '';

  // 신강약 판별
  const is신강 = sinGang.includes('신강');
  const userType = is신강 ? '신강' : '신약';

  // 현재 대운 성격 판별
  const curDWSung = d8['현재대운성격'] || d8['현대운성격단'] || '';

  // 대운 유형별 전략 데이터
  const rows = [
    {
      유형: '용신대운',
      신강전략: '적극적 확장 · 사업 확대 · 리더십 발휘\n독립적 프로젝트 추진, 새로운 도전 적기',
      신약전략: '보좌받으며 성장 · 인맥 넓히기 · 협력 강화\n든든한 지원 속에서 자기 역량 최대 발휘',
    },
    {
      유형: '기신대운',
      신강전략: '에너지 분산 주의 · 내실 다지기 · 과욕 자제\n무리한 확장보다 기존 기반 수성에 집중',
      신약전략: '체력 관리 최우선 · 무리한 결정 유보 · 보호막 확보\n혼자 감당하지 말고 전문가 도움 요청',
    },
    {
      유형: '교체기',
      신강전략: '변화의 파도를 주도적으로 타기 · 선제 대응\n이직·이사·사업 전환 등 큰 결정 가능',
      신약전략: '급변에 휘둘리지 않기 · 안정 기반 확보 우선\n큰 결정은 교체기 이후로 미루는 것이 안전',
    },
    {
      유형: '합대운',
      신강전략: '새로운 인연·파트너십 적극 활용 · 협업 확대\n합의 기운으로 사업 동반자 만남 유리',
      신약전략: '좋은 인연에 의지 · 결혼·동업 기회 활용\n합이 오면 든든한 지원군이 되어줌',
    },
    {
      유형: '충대운',
      신강전략: '변동을 기회로 전환 · 과감한 구조조정 가능\n충의 에너지를 활용해 고착된 상황 돌파',
      신약전략: '큰 변동 최소화 · 방어적 자세 · 건강 관리 필수\n충격을 최소화하는 안정 전략 필요',
    },
  ];

  // 현재 대운 매칭 키워드
  function isHighlight(유형) {
    if (유형 === '용신대운' && (curDWSung.includes('용신') || curDWSung.includes('희신'))) return true;
    if (유형 === '기신대운' && curDWSung.includes('기신')) return true;
    if (유형 === '교체기' && curDWSung.includes('교체')) return true;
    if (유형 === '합대운' && curDWSung.includes('합')) return true;
    if (유형 === '충대운' && curDWSung.includes('충')) return true;
    return false;
  }

  const highlightCol = is신강 ? 2 : 3; // 2=신강전략, 3=신약전략

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>신강약 대운 전략표 》 ${esc(name)}님</title>
  <style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; margin:0 auto; padding:14px 20px; background:transparent; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px auto; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;margin-bottom:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
table { width:100%; border-collapse:collapse; }
th { background:#1a3a6a; color:white; font-size:11px; font-weight:700; padding:5px 6px; text-align:center; }
td { font-size:10px; padding:5px 6px; border-bottom:1px solid #e8e8e8; vertical-align:top; line-height:1.4; white-space:pre-line; }
tr:nth-child(even) td { background:#f8f9fc; }
tr:nth-child(odd) td { background:#ffffff; }
.hl-row td { background:#fff8e1 !important; border-left:3px solid #ff9800; }
.hl-col { background:#e3f2fd !important; border:2px solid #1565c0; }
.type-col { font-weight:800; color:#1a3a6a; text-align:center; white-space:nowrap; }
  </style>
</head>
<body>
  <div class="page">
    <div class="banner-hdr" style="background:linear-gradient(135deg,#1565c0,#0288d1);">
      <div>
        <div class="banner-hdr-title">신강약 대운 전략표</div>
        <div class="banner-hdr-sub">대운 유형별 신강/신약 전략 비교</div>
      </div>
      <div>
        <div class="banner-hdr-name">${esc(name)} 님</div>
        <div class="banner-hdr-detail">일주 ${esc(ilju)} · ${esc(sinGang)} · 유형 ${esc(userType)} · 현재 ${esc(curDWSung)||'—'}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:16%;">대운 유형</th>
          <th style="width:42%;">신강 전략</th>
          <th style="width:42%;">신약 전략</th>
        </tr>
      </thead>
      <tbody>
${rows.map((r, i) => {
  const hlRow = isHighlight(r.유형);
  const rowCls = hlRow ? ' class="hl-row"' : '';
  const 신강cls = (highlightCol === 2) ? ' class="hl-col"' : '';
  const 신약cls = (highlightCol === 3) ? ' class="hl-col"' : '';
  return `        <tr${rowCls}>
          <td class="type-col">${esc(r.유형)}</td>
          <td${신강cls}>${esc(r.신강전략)}</td>
          <td${신약cls}>${esc(r.신약전략)}</td>
        </tr>`;
}).join('\n')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '신강약대운전략표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  console.log(`✅ 신강약대운전략표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_신강약대운전략표.js <slot_id>'); process.exit(1); }
generate(slotId);
