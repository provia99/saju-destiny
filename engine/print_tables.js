#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');

const slotArg = process.argv[2];
if (!slotArg) {
  console.error('사용법: node print_tables.js <슬롯경로>');
  console.error('예: node print_tables.js sample/정종욱_88083038/saju/2026');
  process.exit(1);
}

const QUEUE_DIR = path.join(__dirname, 'queue');
let slotDir = path.join(QUEUE_DIR, slotArg);
// 레거시 fallback: 새 경로에 없으면 기존 saju_ 경로 시도
if (!fs.existsSync(slotDir) && !slotArg.includes('/') && !slotArg.includes('\\')) {
  const legacyDir = path.join(QUEUE_DIR, `saju_${slotArg}`);
  if (fs.existsSync(legacyDir)) slotDir = legacyDir;
}
const tablesDir = path.join(slotDir, 'tables');

if (!fs.existsSync(tablesDir)) {
  console.error(`tables 폴더 없음: ${tablesDir}`);
  process.exit(1);
}

// 집필에 사용되는 표 순서 (COMPONENTS 순서와 동일)
const TABLE_ORDER = [
  'cover',
  '사주기본표',
  '사주원국요약표',
  '일주요약박스',
  '일지분석표',
  '음양비율표',
  '지지계절방위표',
  '오행균형표',
  '오행점수표', '오행생극도',
  '4신요약표1', '4신요약표2',
  '용신가이드카드',
  '십성배치표',
  '십성계열분류표',
  '지장간분석표',
  '합충형파해분석표',
  '격국분석표',
  '십이운성개인표',
  '신살현황표',
  '건강표', '직업표', '인테리어가이드',
  '용신체크리스트1', '용신체크리스트2',
  '대운로드맵',
  '대운타임라인',
  '세운대운교차표',
  '세운월운달력',
  '전환점요약표',
  '전환점타임라인',
  '연간운세요약표',
  '공망안내박스',
  '운세달력',
  // 기초 조견표 (common)
  '천간일람표', '지지일람표', '오행조견표',
  '천간합조견표', '지지육합조견표', '지지충조견표',
  '십성의미조견표', '십이운성조견표', '신살의미조견표', '60갑자표',
];

// 이름 읽기
let memberName = slotArg;
const masterPath = path.join(slotDir, 'master.json');
if (fs.existsSync(masterPath)) {
  try {
    const m = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    memberName = m['이름'] || slotArg;
  } catch(e) {}
}

// 폰트 CSS 》 font_config에서 가져오기 + 특수 폰트 추가
const { FONT_FACE_CSS, FONT_BASE, FONT_WEB, FONT_FACE_WEB_CSS } = require('./font_config');
const fontFaces = `
${FONT_FACE_CSS}
${FONT_FACE_WEB_CSS}
@font-face { font-family:'NanumBrush'; src:url('${FONT_BASE}/NanumBrush.ttf') format('truetype'), url('${FONT_WEB}/NanumBrush.ttf') format('truetype'); }
@font-face { font-family:'HealthsetJoritdae'; src:url('${FONT_BASE}/헬스셋조릿대Std.ttf') format('truetype'), url('${FONT_WEB}/헬스셋조릿대Std.ttf') format('truetype'); }
@font-face { font-family:'LiuJianMaoCao'; src:url('${FONT_BASE}/LiuJianMaoCao-Regular.ttf') format('truetype'), url('${FONT_WEB}/LiuJianMaoCao-Regular.ttf') format('truetype'); }
`;

// 각 표 HTML에서 <body> 내용 + <style> 추출
function extractContent(htmlFile) {
  const raw = fs.readFileSync(htmlFile, 'utf8');

  // style 추출 (font-face 제외)
  const styles = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRegex.exec(raw)) !== null) {
    let css = m[1];
    css = css.replace(/@font-face\s*\{[^}]*\}/g, '');
    css = css.replace(/\*\s*\{[^}]*\}/g, '');
    css = css.replace(/(?<![.\w#])body\s*\{[^}]*\}/g, '');
    css = css.replace(/(?<![.\w#])html\s*\{[^}]*\}/g, '');
    if (css.trim()) styles.push(css);
  }

  // body 내용 추출
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : raw;

  return { styles: styles.join('\n'), body };
}

// HTML 조립
let pages = [];
let allStyles = [];
let count = 0;

const commonDir = path.join(__dirname, 'tables', 'common');
for (const name of TABLE_ORDER) {
  let filePath = path.join(tablesDir, `${name}.html`);
  if (!fs.existsSync(filePath)) filePath = path.join(commonDir, `${name}.html`);
  if (!fs.existsSync(filePath)) continue;

  const { styles, body } = extractContent(filePath);
  if (styles) allStyles.push(`/* === ${name} === */\n${styles}`);

  if (name === '운세달력') {
    // 다중 페이지: calendar-cover + month-page 각각 별도 페이지로
    const pageRegex = /<div class="(?:calendar-cover|month-page)"[\s\S]*?(?=<div class="(?:calendar-cover|month-page)"|$)/g;
    const subPages = body.match(pageRegex) || [body];
    subPages.forEach((sp, i) => {
      const label = i === 0 ? '운세달력 표지' : `운세달력 ${i}월`;
      pages.push(`
    <div class="print-page print-page-calendar">
      <div class="page-label">${label}</div>
      <div class="table-content">
        ${sp}
      </div>
    </div>
      `);
      count++;
    });
  } else {
    pages.push(`
    <div class="print-page">
      <div class="page-label">${name}</div>
      <div class="table-content">
        ${body}
      </div>
    </div>
    `);
    count++;
  }
}

const outputHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${memberName} 님 》 표 모음 인쇄</title>
  <style>
${fontFaces}

@page {
  size: A4;
  margin: 15mm;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Noto Sans KR', sans-serif;
  background: #f0f0f0;
}

.print-page {
  width: 210mm;
  min-height: 297mm;
  background: white;
  margin: 10px auto;
  padding: 20mm;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  page-break-after: always;
  position: relative;
  overflow: hidden;
}

.print-page:last-child {
  page-break-after: auto;
}

.page-label {
  position: absolute;
  top: 5mm;
  right: 5mm;
  font-size: 7pt;
  color: #ccc;
}

.table-content {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.table-content > * {
  max-width: 100%;
}

@media print {
  body { background: white; }
  .print-page {
    box-shadow: none;
    margin: 0;
    padding: 15mm;
  }
  .print-page-calendar {
    padding: 10mm;
  }
  .page-label { display: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}

${allStyles.join('\n\n')}
  </style>
</head>
<body>
  <div class="print-header" style="text-align:center; padding:20px; font-size:14pt; font-weight:700;">
    ${memberName} 님 》 사주 해석서 표 모음 (${count}개)
    <div style="font-size:9pt; color:#999; margin-top:5px;">Ctrl+P로 인쇄하세요</div>
  </div>
${pages.join('\n')}
</body>
</html>`;

const outPath = path.join(slotDir, 'tables_print.html');
fs.writeFileSync(outPath, outputHtml, 'utf8');
console.log(`✅ 표 모음 인쇄용 HTML 생성: ${outPath}`);
console.log(`📄 표 ${count}개, 각 1페이지`);
