#!/usr/bin/env node
// generate_부재십성보완표.js
// 사주에 없는(부재) 십성을 찾아 보완 방향과 실천 방법 제시
// 입력: queue/{slot}_ch03.json
// 출력: tables/{slot}/부재십성보완표.html
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

const 전체십성 = ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'];

const 십성계열맵 = {
  '비견':'비겁(比劫)', '겁재':'비겁(比劫)',
  '식신':'식상(食傷)', '상관':'식상(食傷)',
  '편재':'재성(財星)', '정재':'재성(財星)',
  '편관':'관성(官星)', '정관':'관성(官星)',
  '편인':'인성(印星)', '정인':'인성(印星)',
};

const 십성의미맵 = {
  '비견': '자기 주장, 독립심, 동료·형제와의 경쟁과 협력',
  '겁재': '추진력, 승부욕, 재물 경쟁, 과감한 행동력',
  '식신': '재능 표현, 식복, 안정적 창작, 여유와 즐거움',
  '상관': '창의력, 표현욕, 자유로운 사고, 반항·도전 정신',
  '편재': '유동 재물, 사업 수완, 투자, 사교성',
  '정재': '안정 재물, 성실한 저축, 꾸준한 수입, 절약',
  '편관': '권위, 도전, 변화에 대한 적응력, 추진력',
  '정관': '사회적 지위, 명예, 규율, 책임감',
  '편인': '비정통 학문, 영감, 독창적 사고, 종교·철학',
  '정인': '학문, 자격증, 정통 교육, 어머니의 도움',
};

const 보완방향맵 = {
  '비견': '자기 확신과 독립적 판단력 키우기',
  '겁재': '적극적 추진력과 경쟁 의식 강화',
  '식신': '재능 개발과 여유로운 자기 표현 훈련',
  '상관': '창의적 사고와 자유로운 표현 연습',
  '편재': '사교 활동과 유동적 재물 관리 학습',
  '정재': '꾸준한 저축 습관과 안정적 수입원 확보',
  '편관': '도전 정신과 변화 적응력 훈련',
  '정관': '사회적 책임감과 규율 있는 생활 습관',
  '편인': '비정통 학문·영감 개발, 명상·철학 공부',
  '정인': '정규 학습·자격증 취득, 독서 습관 형성',
};

const 실천방법맵 = {
  '비견': '동호회·동문회 활동, 스포츠 팀 참여, 독립 프로젝트 수행',
  '겁재': '목표 설정 후 기한 내 달성 훈련, 경쟁 환경 참여(시험·대회)',
  '식신': '요리·음악·글쓰기 등 취미 활동, 맛집 탐방, 일기 쓰기',
  '상관': '블로그·유튜브 등 콘텐츠 제작, 토론 참여, 예술 활동',
  '편재': '소규모 투자 시작, 네트워킹 모임, 부업·사이드프로젝트',
  '정재': '가계부 작성, 적금·정기예금, 절약 챌린지',
  '편관': '새로운 분야 도전(자격증·이직), 체력 단련, 리더 역할 맡기',
  '정관': '봉사활동, 조직 내 책임 역할 수행, 규칙적 루틴 만들기',
  '편인': '명상·요가, 철학서 읽기, 대안적 학습(온라인 강좌·독학)',
  '정인': '정규 교육과정 수강, 독서 모임, 멘토 찾기',
};

function generate(slotId) {
  const d3 = loadJSON(`${slotId}_ch03.json`);
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3); } catch(e){}
  if (!d3['이름'] && !d3['user_name']) { console.log('⚠️ 부재십성보완표: ch03.json 없음 (스킵)'); return; }

  const name = d3['이름'] || d3['user_name'] || slotId;
  const ilju = d3['일주한자'] || d3['일주'] || '';

  // ch03에서 십성배치 재구성 (8궁: 년주~시주 천간/지지)
  const 십성배치 = [];
  ['년주','월주','일주','시주'].forEach(주 => {
    const 천간십성 = d3[`${주}_천간십성`] || '';
    const 지지십성 = d3[`${주}_지지십성`] || '';
    if (천간십성 && 천간십성 !== '일원(나)') 십성배치.push({ 위치:`${주}천간`, 십성명:천간십성 });
    if (지지십성) 십성배치.push({ 위치:`${주}지지`, 십성명:지지십성 });
  });

  // 원국에 존재하는 십성 목록
  const 존재십성 = new Set(십성배치.map(s => s.십성명));
  // 부재 십성
  const 부재십성 = 전체십성.filter(s => !존재십성.has(s));

  const rowsHTML = 부재십성.map(s => {
    return `<tr>
      <td style="font-weight:700;color:#1a3a6a;white-space:nowrap;">${esc(s)}</td>
      <td style="white-space:nowrap;">${esc(십성계열맵[s]||'')}</td>
      <td>${esc(십성의미맵[s]||'')}</td>
      <td>${esc(보완방향맵[s]||'')}</td>
      <td style="font-size:9pt;line-height:1.4;">${esc(실천방법맵[s]||'')}</td>
    </tr>`;
  }).join('');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>부재십성 보완표 》 ${esc(name)}님</title>
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
.present-info{font-size:8.5pt;color:#555;margin-bottom:6px;padding:6px 10px;background:#e8f5e9;border-radius:6px;border-left:3px solid #2e7d32;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#e65100,#f57c00);">
  <div>
    <div class="banner-hdr-title">부재십성(不在十星) 보완표</div>
    <div class="banner-hdr-sub">원국에 없는 십성의 보완 방향과 실천 방법</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}</div>
  </div>
</div>

<div class="present-info">
  <strong style="color:#1b5e20;">원국 보유 십성:</strong> ${esc([...존재십성].join(', ') || '없음')}
</div>

${부재십성.length > 0 ? `
<table>
<thead><tr>
  <th>없는 십성</th><th>계열</th><th>의미</th><th>보완 방향</th><th>실천 방법</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>
<div class="note">
  ※ 원국에 없는 십성은 선천적으로 해당 에너지가 약하므로, 후천적 노력으로 보완할 수 있습니다.<br>
  ※ 대운·세운에서 부재 십성이 들어오는 시기에 적극 활용하면 효과가 큽니다.
</div>
` : `<div style="padding:20px;text-align:center;color:#2e7d32;font-size:8pt;font-weight:700;">축하합니다! 원국에 모든 십성이 갖추어져 있습니다.</div>`}

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '부재십성보완표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  console.log(`✅ 부재십성보완표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_부재십성보완표.js <slot_id>'); process.exit(1); }
generate(slotId);
