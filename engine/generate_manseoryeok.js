#!/usr/bin/env node
/**
 * generate_manseoryeok.js 》 만세력표 생성
 * ──────────────────────────────────────────────────
 * node generate_manseoryeok.js <slot_id>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

// ── 간단한 템플릿 렌더러 ────────────────────────
function renderTemplate(html, data) {
  let result = html;

  // {{var}} 형식 치환 (중첩 객체 지원)
  for (const [key, value] of Object.entries(data)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, value || '—');
  }

  // 조건부: {% if %}...{% endif %}
  result = result.replace(/\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}/gs, (match, cond, inner) => {
    return data[cond] && data[cond] !== '—' ? inner : '';
  });

  return result;
}

// ── HTML 생성 ────────────────────────────────────
function generate(slotId) {
  // 두 가지 형식 지원:
  // 1. flat: {slotId}_master.json (예: s01)
  // 2. slot folder: {slotId}/master.json (예: saju_이름_suffix)

  let actualMasterFile = null;
  let tablesDirForSlot = slotId;

  // 포맷 1: flat (s01_master.json)
  const masterPreFile = path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`);
  const masterFileFlat = path.join(QUEUE_DIR, `${slotId}_master.json`);

  // 포맷 2: slot folder (queue/{slotId}/master.json)
  const slotFolderPath = path.join(QUEUE_DIR, slotId);
  const masterFileSlot = path.join(slotFolderPath, 'master.json');

  // 파일 우선순위: preprocessed > flat > slot folder
  if (fs.existsSync(masterPreFile)) {
    actualMasterFile = masterPreFile;
  } else if (fs.existsSync(masterFileFlat)) {
    actualMasterFile = masterFileFlat;
  } else if (fs.existsSync(masterFileSlot)) {
    actualMasterFile = masterFileSlot;
  }
  // master.json이 없어도 계속 진행 (기본값 사용)

  const ch00FileFlat = path.join(QUEUE_DIR, `${slotId}_ch00.json`);
  const ch00FileSlot = path.join(slotFolderPath, 'ch00.json');

  let master = {};
  let ch00 = {};

  // master.json 읽기 (있으면)
  if (actualMasterFile && fs.existsSync(actualMasterFile)) {
    try {
      master = JSON.parse(fs.readFileSync(actualMasterFile, 'utf-8'));
    } catch (e) {
      console.warn(`⚠️  master.json 파싱 실패 (기본값 사용):`, e.message);
    }
  }

  // ch00.json 찾기 (flat 또는 slot folder)
  let ch00File = null;
  if (fs.existsSync(ch00FileFlat)) {
    ch00File = ch00FileFlat;
  } else if (fs.existsSync(ch00FileSlot)) {
    ch00File = ch00FileSlot;
  }

  if (ch00File && fs.existsSync(ch00File)) {
    try {
      ch00 = JSON.parse(fs.readFileSync(ch00File, 'utf-8'));
    } catch (e) {
      console.warn(`⚠️  ch00.json 파싱 실패 (기본값 사용)`);
    }
  }

  // ── 기본 정보 (master.json 또는 ch00.json에서) ──────────────────────────────────
  const name = master.이름 || ch00.이름 || slotId || '—';
  const gender_kr = (master.성별 === 'M' || master.성별 === '남') ? '남성' : '여성';
  const age = master.현재나이 || master.만나이 || '—';
  const birth_solar = master.양력 || '—';
  const birth_lunar = master.음력 || '—';

  // ── 오행 매핑 (天干, 地支) ────────────────────
  const heavenlyOhaeng = {
    '甲': '목', '乙': '목',
    '丙': '화', '丁': '화',
    '戊': '토', '己': '토',
    '庚': '금', '辛': '금',
    '壬': '수', '癸': '수',
  };
  const earthlyOhaeng = {
    '寅': '목', '卯': '목',
    '巳': '화', '午': '화',
    '辰': '토', '戌': '토', '丑': '토', '未': '토',
    '申': '금', '酉': '금',
    '亥': '수', '子': '수',
  };

  // ── 오행 색상 매핑 ────────────────────────────
  const ohColorMap = {
    '목': 'wood',
    '화': 'fire',
    '토': 'earth',
    '금': 'metal',
    '수': 'water',
  };

  // ── 주(柱) 데이터 구성 ────────────────────────
  // ch00.json 포맷: "乙卯(을묘)" → 한자(한글) 형태
  // 추출: stem=乙, stem_kr=을, branch=卯, branch_kr=묘
  function parseGanji(ganjiStr) {
    // "乙卯(을묘)" → { stem: '乙', stem_kr: '을', branch: '卯', branch_kr: '묘' }
    if (!ganjiStr || typeof ganjiStr !== 'string') {
      return { stem: '—', stem_kr: '—', branch: '—', branch_kr: '—' };
    }
    const match = ganjiStr.match(/^(.)(.)[\((（]([^)）]*)[\)(）]$/);
    if (!match) return { stem: '—', stem_kr: '—', branch: '—', branch_kr: '—' };

    const [, stem, branch, korean] = match;
    const [stem_kr, branch_kr] = korean.split('');
    return { stem, stem_kr, branch, branch_kr };
  }

  const pillarsData = {
    time: (() => {
      const p = parseGanji(ch00['시주']);
      const stemOh = heavenlyOhaeng[p.stem] || '금';
      const branchOh = earthlyOhaeng[p.branch] || '금';
      return {
        stem: p.stem,
        stem_kr: p.stem_kr,
        stem_class: ohColorMap[stemOh] || 'metal',
        branch: p.branch,
        branch_kr: p.branch_kr,
        branch_class: ohColorMap[branchOh] || 'metal',
        sipseong_stem: ch00['시주_천간십성'] || '—',
      };
    })(),
    day: (() => {
      const p = parseGanji(ch00['일주']);
      const stemOh = heavenlyOhaeng[p.stem] || '금';
      const branchOh = earthlyOhaeng[p.branch] || '금';
      return {
        stem: p.stem,
        stem_kr: p.stem_kr,
        stem_class: ohColorMap[stemOh] || 'metal',
        branch: p.branch,
        branch_kr: p.branch_kr,
        branch_class: ohColorMap[branchOh] || 'metal',
        sipseong_stem: ch00['일주_천간십성'] || '—',
      };
    })(),
    month: (() => {
      const p = parseGanji(ch00['월주']);
      const stemOh = heavenlyOhaeng[p.stem] || '금';
      const branchOh = earthlyOhaeng[p.branch] || '금';
      return {
        stem: p.stem,
        stem_kr: p.stem_kr,
        stem_class: ohColorMap[stemOh] || 'metal',
        branch: p.branch,
        branch_kr: p.branch_kr,
        branch_class: ohColorMap[branchOh] || 'metal',
        sipseong_stem: ch00['월주_천간십성'] || '—',
      };
    })(),
    year: (() => {
      const p = parseGanji(ch00['년주']);
      const stemOh = heavenlyOhaeng[p.stem] || '금';
      const branchOh = earthlyOhaeng[p.branch] || '금';
      return {
        stem: p.stem,
        stem_kr: p.stem_kr,
        stem_class: ohColorMap[stemOh] || 'metal',
        branch: p.branch,
        branch_kr: p.branch_kr,
        branch_class: ohColorMap[branchOh] || 'metal',
        sipseong_stem: ch00['년주_천간십성'] || '—',
      };
    })(),
  };

  // ── 스타일 CSS ────────────────────────────────
  const css = `
<style>
:root {
  --wood: #4caf50;
  --fire: #f44336;
  --earth: #ffc107;
  --metal: #9e9e9e;
  --water: #2196f3;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Noto Sans KR', sans-serif; background: transparent; }

.manseoryeok-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 30px;
  background: transparent;
}

.header-unified-box {
  border: 2px solid #333;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  background: #fafaf8;
}

.info-section { display: flex; gap: 20px; align-items: flex-start; }
.character-circle { width: 80px; height: 80px; border-radius: 50%; background: #f5f5f5; border: 2px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 40px; }

.info-table-container { flex: 1; width: 100%; border-collapse: collapse; }
.info-table-container tr:not(:last-child) { border-bottom: 1px solid #ddd; }
.info-cell { padding: 10px 12px; font-size: 13px; }
.info-cell.label { background: #f0f0f0; font-weight: bold; width: 80px; }
.info-cell.value { color: #555; }
.info-cell.title-cell { background: #333; color: white; font-weight: bold; font-size: 14px; }

.manseoryeok-table-wrapper { border: 2px solid #333; border-radius: 8px; }
.manseoryeok-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.manseoryeok-table thead { background: #333; color: white; }
.manseoryeok-table th { padding: 12px; text-align: center; font-weight: bold; border-right: 1px solid #666; }
.manseoryeok-table th:last-child { border-right: none; }
.manseoryeok-table td { padding: 10px; border: 1px solid #ddd; text-align: center; }

.label-cell { background: #f5f5f5; font-weight: bold; width: 120px; }
.label-hanja { display: block; font-size: 10px; color: #888; margin-top: 2px; }

.sipseong { font-weight: bold; color: #333; padding: 8px 4px; border-radius: 4px; }
.sipseong.primary { background: #fff9e6; color: #d97706; }

.ganji-box { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 70px; height: 70px; border-radius: 8px; color: white; font-weight: bold; gap: 2px; }
.ganji-box.wood { background: var(--wood); }
.ganji-box.fire { background: var(--fire); }
.ganji-box.earth { background: var(--earth); color: #333; }
.ganji-box.metal { background: var(--metal); }
.ganji-box.water { background: var(--water); }

.ganji-box .hanja { font-size: 20px; font-family: 'Noto Serif KR', serif; font-weight: 700; }
.ganji-box .hangul { font-size: 10px; opacity: 0.9; }
</style>
  `;

  // ── 테이블 행 생성 ────────────────────────────
  const pillarsOrder = ['time', 'day', 'month', 'year'];
  const pillarsLabel = { time: '時柱(시주)', day: '日柱(일주)', month: '月柱(월주)', year: '年柱(년주)' };

  let tableHtml = `
    <table class="manseoryeok-table">
      <colgroup>
        <col style="width: 120px;">
        <col style="width: 195px;">
        <col style="width: 195px;">
        <col style="width: 195px;">
        <col style="width: 195px;">
      </colgroup>
      <thead>
        <tr>
          <th>구분(區分)</th>
          <th>시주(時柱)</th>
          <th>일주(日柱)</th>
          <th>월주(月柱)</th>
          <th>년주(年柱)</th>
        </tr>
      </thead>
      <tbody>
        <!-- 천간십성 -->
        <tr>
          <td class="label-cell">천간십성<span class="label-hanja">(天干十星)</span></td>`;

  for (const pil of pillarsOrder) {
    tableHtml += `<td><div class="sipseong ${pil === 'day' ? 'primary' : 'normal'}">${pillarsData[pil].sipseong_stem}</div></td>`;
  }
  tableHtml += `</tr>`;

  // 천간
  tableHtml += `<tr><td class="label-cell">천간<span class="label-hanja">(天干)</span></td>`;
  for (const pil of pillarsOrder) {
    const d = pillarsData[pil];
    tableHtml += `<td><div class="ganji-box ${d.stem_class}"><div class="hanja">${d.stem}</div><div class="hangul">(${d.stem_kr})</div></div></td>`;
  }
  tableHtml += `</tr>`;

  // 지지
  tableHtml += `<tr><td class="label-cell">지지<span class="label-hanja">(地支)</span></td>`;
  for (const pil of pillarsOrder) {
    const d = pillarsData[pil];
    tableHtml += `<td><div class="ganji-box ${d.branch_class}"><div class="hanja">${d.branch}</div><div class="hangul">(${d.branch_kr})</div></div></td>`;
  }
  tableHtml += `</tr></tbody></table>`;

  // ── 최종 HTML ──────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}님의 만세력</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
  ${css}
</head>
<body>
  <div class="manseoryeok-container">
    <div class="header-unified-box">
      <div class="info-section">
        <div class="character-circle">🐉</div>
        <table class="info-table-container">
          <tr>
            <td class="info-cell title-cell" colspan="4">${name}님의 천명 설계도 (天命 設計圖)</td>
          </tr>
          <tr>
            <td class="info-cell label">기본정보</td>
            <td class="info-cell value" colspan="3">${name}, ${gender_kr}, ${age}세</td>
          </tr>
          <tr>
            <td class="info-cell label">양력</td>
            <td class="info-cell value" colspan="3">${birth_solar}</td>
          </tr>
          <tr>
            <td class="info-cell label">음력</td>
            <td class="info-cell value" colspan="3">${birth_lunar}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="manseoryeok-table-wrapper">
      ${tableHtml}
    </div>
  </div>
</body>
</html>`;

  // ── 파일 저장 ──────────────────────────────────
  const slotTableDir = path.join(TABLES_DIR, tablesDirForSlot);
  if (!fs.existsSync(slotTableDir)) {
    fs.mkdirSync(slotTableDir, { recursive: true });
  }

  const outputPath = path.join(slotTableDir, '만세력.html');
  fs.writeFileSync(outputPath, html, 'utf-8');

  console.log(`✅ 만세력: ${path.relative(SCRIPT_DIR, outputPath)}`);
}

// ── 메인 ──────────────────────────────────────────
const slotId = process.argv[2];
if (!slotId) {
  console.error('❌ 사용법: node generate_manseoryeok.js <slot_id>');
  process.exit(1);
}

try {
  generate(slotId);
} catch (e) {
  console.error(`❌ 오류:`, e.message);
  process.exit(1);
}
