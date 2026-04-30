'use strict';
const { 브랜드블록, 결혼블록, 결혼블록_ch02, 자녀블록, 고민강조블록, 고민강조블록_짧음, 형제블록, 부모블록, 건강블록, injectCh08Fields } = require('./ch_personal_db');

const fs   = require('fs');
const path = require('path');
const { DB_CH02 } = require('./ch02_db');

function main() {
  const jsonArg    = process.argv[2] || 'choi_wonsuk_ch02.json';
  const tplFile    = process.argv[3] || path.join(__dirname, 'ch02_template.txt');
  
  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(__dirname, 'queue', jsonArg);
const samplesDir = path.dirname(jsonPath);

  if (!fs.existsSync(jsonPath)) {
    console.error(`파일 없음: ${jsonPath}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const M = JSON.parse(rawJson);

  // slots: JSON 전체 필드 자동 로드 (단순 템플릿 치환용)
  const slots = {};
  for (const [k, v] of Object.entries(M)) {
    if (typeof v === 'string' || typeof v === 'number') slots[k] = String(v);
  }


  // ch08 공유 필드 주입 (기신오행, 현재대운성격 등)
  injectCh08Fields(M, samplesDir, slots);
  function applySlots(text) {
    if (!text) return '';
    let result = text;
    for (const [k, v] of Object.entries(slots)) {
      result = result.replaceAll(`{{${k}}}`, v ?? '');
    }
    return result;
  }

  function resolvePersonal(tag) {
    if (tag === 'PERSONAL.결혼') {
      const 상태 = M.결혼상태 || '미혼';
      const blk = 결혼블록_ch02[상태] || 결혼블록_ch02['미혼'] || 결혼블록[상태] || 결혼블록['미혼'];
      return applySlots(blk);
    }
    if (tag === 'PERSONAL.자녀') {
      const 상태 = M.자녀 || '없음';
      return applySlots(자녀블록[상태] || 자녀블록['없음']);
    }
    if (tag === 'PERSONAL.고민') {
      const 분야 = M.고민분야 || '종합';
      return applySlots(고민강조블록_짧음[분야] || 고민강조블록_짧음['종합']);
    }
    if (tag === 'PERSONAL.형제') {
      const 상태 = M.형제유무 || '있음';
      return applySlots(형제블록[상태] || 형제블록['있음']);
    }
    if (tag === 'PERSONAL.부모') {
      const 상태 = M.부모상황 || '양친';
      return applySlots(부모블록[상태] || 부모블록['양친']);
    }
    if (tag === 'PERSONAL.건강') {
      const 상태 = M.건강관심 || '기본';
      return applySlots(건강블록[상태] || 건강블록['기본']);
    }
    return null;
  }

  function resolveBlock(tag) {
    if (tag === 'BRAND.안내') {
      return applySlots(브랜드블록.안내);
    }
    if (tag.startsWith('PERSONAL.')) {
      const res = resolvePersonal(tag);
      if (res !== null) return res;
    }
    const parts = tag.split('.');
    if (parts[0] !== 'CH02') return `[NS없음: ${parts[0]}]`;
    const k = parts[1];
    if (!DB_CH02[k]) return `[CH02없음: ${k}]`;
    
    const node = DB_CH02[k];
    if (typeof node === 'string') return applySlots(node);
    
    // 일지신살_해석: parts[2] 없거나 정확 키 미일치면 신살목록 분리 후 반복 조회
    if (k === '일지신살_해석') {
      // parts[2]가 정확히 일치하는 키이면 바로 반환
      if (parts[2] && node[parts[2]]) return applySlots(node[parts[2]]);
      // 그 외: parts[2]가 '·' 구분 복합 키이거나 없을 때 신살별 반복
      const 원본목록 = parts[2] || slots['일지신살목록'] || '';
      const 신살목록 = 원본목록.split(/[,·\s]+/).map(s => s.trim()).filter(Boolean);
      if (신살목록.length === 0) return '';
      return 신살목록.map(신살 => {
        const found = Object.keys(node).find(key => 신살 === key || 신살.includes(key) || key.includes(신살));
        return found ? applySlots(node[found]) : '';
      }).filter(Boolean).join('\n\n');
    }

    if (parts[2] && node[parts[2]]) return applySlots(node[parts[2]]);
    return `[CH02없음: ${k}.${parts[2]}]`;
  }

  let tpl = fs.readFileSync(tplFile, 'utf8');

  // 1. 블록 치환 [[TAG]]
  tpl = tpl.replace(/\[\[([^\]]+)\]\]/g, (_, tag) => {
    const resolvedTag = tag.replace(/\{\{([^}]+)\}\}/g, (__, k) => slots[k] ?? k);
    return resolveBlock(resolvedTag);
  });

  // 2. 슬롯 치환 {{KEY}}
  tpl = applySlots(tpl);

  // 3. 조건부 렌더링 <<IF K=V>> ... <<ENDIF>>
  let prev;
  do {
    prev = tpl;
    tpl = tpl.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
      const conds = condStr.trim().split(/\s+/);
      const pass = conds.every(cond => {
        const [k, v] = cond.split('=');
        return (slots[k] ?? '') === v;
      });
      return pass ? block : '';
    });
    // <<IS 키 값>> 지원 (ch00 스타일)
    tpl = tpl.replace(/<<IS ([^\s>]+)\s+([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, k, v, block) => {
      return (slots[k] ?? '') === v.trim() ? block : '';
    });
  } while (tpl !== prev);

  tpl = tpl.replace(/<<ENDIF>>/g, '');
  tpl = tpl.replace(/\{\{[^}]+\}\}/g, '');
  const finalOutput = tpl.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';

  const fileId  = M.id || M.이름;
  const outPath = path.join(samplesDir, `${fileId}_ch02_result.txt`);
  fs.writeFileSync(outPath, finalOutput, 'utf8');
  console.log(`✅ 렌더링 완료: queue/${path.basename(outPath)}`);
}

main();
