'use strict';
const fs   = require('fs');
const path = require('path');
const { DB_KIJIL } = require('./ch_kijil_db');
const { injectCh08Fields } = require('./ch_personal_db');

const inputArg = process.argv[2] || '';


const jsonPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, 'queue', inputArg);
const samplesDir = path.dirname(jsonPath);

const M = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
// ch08 공유 필드 주입 (기신오행, 현재대운성격 등)
injectCh08Fields(M, samplesDir, null);
const fileId = M.id || M.이름;
const outPath = path.join(samplesDir, `${fileId}_ch_kijil_result.txt`);

const TMPL = fs.readFileSync(path.join(__dirname, 'ch_kijil_template.txt'), 'utf8');

// 슬롯 치환 함수
function fillSlots(text, data) {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}

// 블록 치환
function renderBlocks(text, data) {
  // [[KIJIL.key]] 처리
  text = text.replace(/\[\[KIJIL\.([^\]]+)\]\]/g, (_, key) => {
    // 나이대 분기
    const parts = key.split('.');
    if (parts.length === 2) {
      const 블록 = DB_KIJIL[parts[0]];
      if (블록 && typeof 블록 === 'object') {
        const 나이대 = data['나이대'] || '30대';
        return 블록[나이대] || 블록['30대'] || '';
      }
    }
    const 블록 = DB_KIJIL[key];
    if (!블록) return `[KIJIL없음: ${key}]`;
    if (typeof 블록 === 'object') {
      const 나이대 = data['나이대'] || '30대';
      return 블록[나이대] || 블록['30대'] || '';
    }
    return 블록;
  });
  return text;
}

// 중화형신강 조건 분기: 해당 블록을 중화형신강 전용 블록으로 교체
function applyJunghwa(text, data) {
  if ((data.신강약단 || '') !== '중화형신강') return text;
  text = text.replace(/\[\[KIJIL\.신강약기질\]\]/g,    '[[KIJIL.중화형신강_기질]]');
  text = text.replace(/\[\[KIJIL\.기질_강점약점\]\]/g, '[[KIJIL.중화형신강_강점약점]]');
  text = text.replace(/\[\[KIJIL\.기질_직장실전\]\]/g, '[[KIJIL.중화형신강_직장]]');
  return text;
}

let result = TMPL;
result = applyJunghwa(result, M);
result = renderBlocks(result, M);
result = fillSlots(result, M);

fs.writeFileSync(outPath, result, 'utf8');
console.log(`✅ render_ch_kijil: ${outPath} (${result.length}자)`);
