#!/usr/bin/env node
// generate_기질판단표.js
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch06.json
// 출력: tables/{slot}/기질판단표.html
// 11장용 YES/NO 기질 판단표
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
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d6); } catch(e){}

  // 인적사항
  const name    = d3['이름']        || slotId;
  const ilju    = d3['일주']        || '';
  const sinGang = d3['신강약']      || d6['신강약'] || '';
  const gyeokNm = d3['격국명']      || d6['격국명'] || '';
  const ilgan   = d3['일주_천간']   || '';

  // 신강약 판단 (극신강/신강/중화/신약/극신약)
  const is신강  = sinGang.includes('신강');
  const is신약  = sinGang.includes('신약');
  const is극신강 = sinGang.includes('극신강');

  // 십성 존재 여부 (격국명 기반)
  const has편관 = gyeokNm.includes('편관');
  const has비견 = gyeokNm.includes('비견') || gyeokNm.includes('건록');
  const has식신 = gyeokNm.includes('식신');
  const has상관 = gyeokNm.includes('상관');
  const has식상 = has식신 || has상관;

  // 질문-답변-근거 데이터 구성
  const rows = [
    {
      질문: '독립적으로 일할 때 더 잘하나?',
      답변: is신강 ? 'YES' : 'NO',
      근거: is신강
        ? `${esc(sinGang)} — 자기 에너지가 강하여 독립적 환경에서 역량을 잘 발휘합니다.`
        : `${esc(sinGang)} — 협력과 지원이 있을 때 더 안정적으로 능력을 발휘합니다.`
    },
    {
      질문: '팀워크에서 빛나나?',
      답변: is신약 ? 'YES' : 'NO',
      근거: is신약
        ? `${esc(sinGang)} — 타인의 도움과 협력 속에서 시너지를 내는 구조입니다.`
        : `${esc(sinGang)} — 혼자 주도하려는 성향이 강해 팀에서 마찰이 생길 수 있습니다.`
    },
    {
      질문: '리더 역할이 맞나?',
      답변: (has편관 || has비견 || is극신강) ? 'YES' : 'NO',
      근거: (has편관 || has비견 || is극신강)
        ? `${esc(gyeokNm)} — 편관/비견의 기운이 있어 추진력과 결단력으로 리더 역할에 적합합니다.`
        : `${esc(gyeokNm)} — 리더보다는 전문가·보좌 역할에서 더 빛나는 구조입니다.`
    },
    {
      질문: '전문가 역할이 맞나?',
      답변: has식상 ? 'YES' : 'NO',
      근거: has식상
        ? `${esc(gyeokNm)} — 식신/상관의 기운이 있어 창의력과 전문성으로 두각을 나타냅니다.`
        : `${esc(gyeokNm)} — 전문 분야보다는 관리·조직 역할이 더 어울리는 구조입니다.`
    },
    {
      질문: '새 도전보다 안정이 맞나?',
      답변: is극신강 ? 'NO' : (is신약 ? 'YES' : (is신강 ? 'NO' : 'YES')),
      근거: is극신강
        ? `${esc(sinGang)} — 에너지가 넘쳐 안정보다 도전에서 성과를 냅니다.`
        : is신약
          ? `${esc(sinGang)} — 에너지 보존이 중요하여 안정적 환경이 유리합니다.`
          : is신강
            ? `${esc(sinGang)} — 자기 기운이 강하여 새로운 도전도 잘 소화합니다.`
            : `${esc(sinGang)} — 균형 잡힌 구조로, 안정 기반 위에서 도전하는 것이 좋습니다.`
    },
  ];

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>기질 판단표 》 ${esc(name)}님</title>
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
th:first-child { text-align:left; }
td { font-size:10px; padding:5px 6px; border-bottom:1px solid #e8e8e8; vertical-align:top; line-height:1.4; }
tr:nth-child(even) td { background:#f8f9fc; }
tr:nth-child(odd) td { background:#ffffff; }
.yes { background:#e8f5e9 !important; color:#2e7d32; font-weight:900; text-align:center; font-size:10px; }
.no  { background:#ffebee !important; color:#c62828; font-weight:900; text-align:center; font-size:10px; }
.q-col { font-weight:700; color:#333; min-width:180px; }
.r-col { color:#555; font-size:10px; }

  </style>
</head>
<body>
  <div class="page">
    <div class="banner-hdr" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
      <div>
        <div class="banner-hdr-title">기질 판단표</div>
        <div class="banner-hdr-sub">YES/NO 기질 판단 · ${esc(sinGang)} · ${esc(gyeokNm)}</div>
      </div>
      <div>
        <div class="banner-hdr-name">${esc(name)} 님</div>
        <div class="banner-hdr-detail">일주 ${esc(ilju)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:35%;">질문</th>
          <th style="width:12%;">답변</th>
          <th style="width:53%;">근거</th>
        </tr>
      </thead>
      <tbody>
${rows.map((r, i) => {
  const cls = r.답변 === 'YES' ? 'yes' : 'no';
  return `        <tr>
          <td class="q-col">${esc(r.질문)}</td>
          <td class="${cls}">${esc(r.답변)}</td>
          <td class="r-col">${r.근거}</td>
        </tr>`;
}).join('\n')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '기질판단표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '기질판단표');
  console.log(`✅ 기질판단표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_기질판단표.js <slot_id>'); process.exit(1); }
generate(slotId);
