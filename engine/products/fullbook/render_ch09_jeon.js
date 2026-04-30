'use strict';
const fs = require('fs'), path = require('path');
const { DB_JEON } = require('./ch09_jeon_db');
const inputArg = process.argv[2] || '';

const jsonPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, 'queue', inputArg);
const samplesDir = path.dirname(jsonPath);
const M = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const fileId = M.id || M.이름;
const outPath = path.join(samplesDir, fileId + '_ch09_jeon_result.txt');
const TMPL = fs.readFileSync(path.join(__dirname,'ch09_jeon_template.txt'),'utf8');

function fillSlots(text, data) {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) =>
    data[key] !== undefined ? String(data[key]) : '{{'+key+'}}');
}
function renderBlocks(text, data) {
  return text.replace(/\[\[JEON\.([^\]]+)\]\]/g, (_, key) => {
    const 블록 = DB_JEON[key];
    if (!블록) return '[JEON없음: '+key+']';
    return typeof 블록 === 'object' ? (블록[data['나이대']] || 블록['30대'] || '') : 블록;
  });
}
function processConditions(text, data) {
  // <<IS 키 값>> ... <<ENDIF>> 처리
  // <<IF 키=값>> ... <<ENDIF>> 처리 (반복 처리로 중첩 지원)
  let prev;
  do {
    prev = text;
    text = text.replace(/<<IS ([^\s>]+)\s+([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, key, val, block) => {
      return (data[key] ?? '') === val.trim() ? block : '';
    });
    text = text.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
      const pass = condStr.trim().split(/\s+/).every(c => {
        const [k, v] = c.split('='); return (data[k] ?? '') === (v || '');
      });
      return pass ? block : '';
    });
  } while (text !== prev);
  text = text.replace(/<<ENDIF>>/g, '');
  return text;
}
let result = renderBlocks(TMPL, M);
result = processConditions(result, M);
result = fillSlots(result, M);
// 미채움 슬롯 제거 (다음대운 없는 경우 등 잔여 {{슬롯}} 정리)
result = result.replace(/\{\{[^}]+\}\}/g, '');
// 과도한 빈 줄 정리
result = result.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';
fs.writeFileSync(outPath, result, 'utf8');
console.log('✅ render_ch09_jeon: ' + outPath + ' (' + result.length + '자)');
