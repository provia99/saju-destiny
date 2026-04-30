'use strict';

function _injectSinsal(M) {
  if (M.신강약) {
    const r = M.신강약;
    if (r.includes('중화형')) { M.신강약 = '중화형 신강(身强)'; M.신강약단 = '중화형신강'; }
    else {
      if (/강신약/.test(r))      M.신강약 = '신약(身弱)';
      else if (/약신강/.test(r)) M.신강약 = '신강(身强)';
      else if (/강신강/.test(r)) M.신강약 = '신강(身强)';
      else if (/약신약/.test(r)) M.신강약 = '신약(身弱)';
      else if (r && !r.includes('(')) M.신강약 = r.includes('강') ? '신강(身强)' : '신약(身弱)';
      M.신강약단 = M.신강약.includes('신강(') ? '신강' : '신약';
    }
  }
}

const fs   = require('fs');
const path = require('path');
const { DB_INTERIOR } = require('./ch_interior_db');
const { 브랜드블록, 결혼블록, 자녀블록, 고민강조블록, 형제블록, 부모블록, 건강블록, injectCh08Fields } = require('./ch_personal_db');

function main() {
  const jsonArg  = process.argv[2] || 'choi_wonsuk_ch_interior.json';
  const tmplFile = process.argv[3] || path.join(__dirname, 'ch_interior_template.txt');
  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(__dirname, 'queue', jsonArg);
  const samplesDir = path.dirname(jsonPath);

  if (!fs.existsSync(jsonPath)) { console.error(`파일 없음: ${jsonPath}`); process.exit(1); }

  const M = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  _injectSinsal(M);
  injectCh08Fields(M, samplesDir, null);

  const slots = Object.assign({}, M);
  let tpl = fs.readFileSync(tmplFile, 'utf8');

  // {{슬롯}} 치환
  for (const [k, v] of Object.entries(slots)) {
    if (typeof v === 'string') tpl = tpl.replaceAll(`{{${k}}}`, v);
  }

  // <<IF>> 조건 처리 (중첩 지원)
  let _prev;
  do {
    _prev = tpl;
    tpl = tpl.replace(/<<IF ([^>]+)>>((?:(?!<<IF )[\s\S])*?)<<ENDIF>>/g, (_, condStr, block) => {
      const conds = condStr.trim().split(/\s+/);
      const pass  = conds.every(c => { const [k,v] = c.split('='); return (slots[k] ?? '') === v; });
      return pass ? block : '';
    });
  } while (tpl !== _prev);
  tpl = tpl.replace(/<<ENDIF>>/g, '');

  function applySlots(text) {
    if (typeof text !== 'string') return String(text ?? '');
    for (const [k, v] of Object.entries(slots)) {
      if (typeof v === 'string') text = text.replaceAll(`{{${k}}}`, v);
    }
    let prev;
    do {
      prev = text;
      text = text.replace(/<<IF ([^>]+)>>((?:(?!<<IF )[\s\S])*?)<<ENDIF>>/g, (_, condStr, block) => {
        const conds = condStr.trim().split(/\s+/);
        const pass = conds.every(cond => { const [k, v] = cond.split('='); return (slots[k] ?? '') === v; });
        return pass ? block : '';
      });
    } while (text !== prev);
    text = text.replace(/<<ENDIF>>/g, '');
    return text;
  }

  function resolveBlock(tag) {
    const parts = tag.split('.');
    if (parts[0] !== 'INTERIOR') return `[NS없음: ${parts[0]}]`;
    const section = parts[1];
    const key     = parts[2];
    const node    = DB_INTERIOR[section];
    if (!node) return `[INTERIOR없음: ${section}]`;
    if (typeof node === 'string') return applySlots(node);
    if (key !== undefined) {
      const val = node[key];
      if (val === undefined) return `[INTERIOR없음: ${section}.${key}]`;
      if (typeof val === 'string') return applySlots(val);
      return `[INTERIOR없음: ${section}.${key}(타입오류)]`;
    }
    return `[INTERIOR없음: ${section}(키없음)]`;
  }

  tpl = tpl.replace(/\[\[([^\]]+)\]\]/g, (_, tag) => {
    const resolved = tag.replace(/\{\{([^}]+)\}\}/g, (__, k) => slots[k] ?? k);
    return resolveBlock(resolved);
  });

  tpl = applySlots(tpl);
  tpl = tpl.replace(/\{\{[^}]+\}\}/g, '');
  tpl = tpl.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';

  const fileId  = M.id || M.이름;
  const outPath = path.join(samplesDir, `${fileId}_ch_interior_result.txt`);
  fs.writeFileSync(outPath, tpl, 'utf8');
  console.log(`✅ 렌더링 완료: queue/${path.basename(outPath)}`);
  console.log(`📄 글자수: ${[...tpl].length}자`);
}

main();
