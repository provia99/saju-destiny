'use strict';
// ================================================================
// render_generic.js 》 render_chXX.js 가 없는 챕터용 범용 렌더러
// 사용: node render_generic.js <챕터번호> <json파일> [template파일]
// 예시: node render_generic.js 04 choi_wonsuk_ch04.json
// ================================================================

const { 브랜드블록, 결혼블록, 자녀블록, 고민강조블록, 고민강조블록_짧음, 형제블록, 부모블록, 건강블록 } = require('./ch_personal_db');
const fs   = require('fs');
const path = require('path');

const chNum   = process.argv[2] || '04';
const jsonArg = process.argv[3] || `choi_wonsuk_ch${chNum}.json`;
const chKey   = 'ch' + String(chNum).padStart(2,'0');
const chUPPER = 'CH' + String(chNum).padStart(2,'0');

// DB 동적 로드
let DB;
try {
  DB = require(`./${chKey}_db.js`)[`DB_${chUPPER}`];
  if (!DB) throw new Error('DB 없음');
} catch(e) {
  console.error(`❌ ${chKey}_db.js 로드 실패: ${e.message}`);
  process.exit(1);
}


const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(__dirname, 'queue', jsonArg);
const samplesDir = path.dirname(jsonPath);
const tplFile    = process.argv[4] || path.join(__dirname, `${chKey}_template.txt`);

if (!fs.existsSync(jsonPath)) { console.error(`파일 없음: ${jsonPath}`); process.exit(1); }
if (!fs.existsSync(tplFile))  { console.error(`템플릿 없음: ${tplFile}`); process.exit(1); }

const M   = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
let   tpl = fs.readFileSync(tplFile, 'utf8');

// ── 신살·신강약 슬롯 직접 주입 (run_all 전처리와 무관하게 항상 작동) ──
(function injectSlots() {
  const s = M.선생님이름 || '반야선생';
  if (!M._천을귀인설명)
    M._천을귀인설명 = M.천을귀인유무 === '있음'
      ? `천을귀인(天乙貴人)이 있다는 것은 어려운 상황에서 귀인이 나타나 도움을 주는 기운이 있다는 뜻이에요. ${s}이 봐온 분들 중에 천을귀인이 있는 분들은 위기의 순간마다 의외의 도움이 찾아오는 경우가 많았어요. 이 기운이 가장 잘 발휘되려면 스스로도 남을 도우려는 마음을 갖는 것이 중요해요.` : '';
  if (!M._역마살설명)
    M._역마살설명 = M.역마살유무 === '있음'
      ? `역마살(驛馬殺)이 있다는 것은 변화와 이동의 기운이 강하다는 뜻이에요. 현대에는 오히려 긍정적인 기운으로 작용하여 해외 활동, 이직, 여행, 새로운 환경으로의 전환이 능력이 빛나는 분이에요. ${s}이 드리는 조언은 이렇어요. 역마살의 에너지를 목적 있는 방향으로 활용하는 것이 가장 좋은 대처법이에요.` : '';
  if (!M._백호살설명)
    M._백호살설명 = M.백호살유무 === '있음'
      ? `백호대살(白虎大殺)이 있다는 것은 강렬한 기운이 사주에 담겨 있다는 뜻이에요. 잘 활용하면 강한 추진력과 결단력이 되고, 조심하지 않으면 건강·사고·인간관계에서 갑작스러운 변화가 올 수 있어요. 방어책: 무리한 활동과 급한 결정을 삼가고, 정기 건강 점검을 꾸준히 하십시오.` : '';
  if (!M._도화살설명)
    M._도화살설명 = M.도화살유무 === '있음'
      ? `도화살(桃花殺)이 있다는 것은 이성과 인기의 기운이 강하다는 뜻이에요. 대운(大運)에서도 이 기운이 활성화될 때 인간관계와 인기가 특히 강해집니다. 방어책: 도화(桃花)의 매력을 직업적 능력으로 승화하고, 이성 관계에서는 신중한 선택을 하세요.` : '';
  if (!M._홍염살설명)
    M._홍염살설명 = M.홍염살유무 === '있음'
      ? `홍염살(紅艶殺)이 있다는 것은 강렬한 감성과 예술적 기운이 담겨 있다는 뜻이에요. 대운(大運) 흐름과 결합해 특정 시기에 감성과 창의성이 폭발적으로 발휘돼요. 방어책: 감성 에너지를 창작 활동으로 발산하고, 중요한 결정은 감정이 안정된 상태에서 내리세요.` : '';
  if (!M._괴강살설명)
    M._괴강살설명 = M.괴강살유무 === '있음'
      ? `괴강살(魁罡殺)이 있다는 것은 강한 기질과 독립심이 담겨 있다는 뜻이에요. 대운(大運)과 결합하면 특정 10년에 강력한 추진력이 발휘돼요. 방어책: 강한 의지는 살리되, 기신대운(忌神大運)에서는 충동적 결정을 조심하세요.` : '';
  // 신강약 정규화
  if (M.신강약) {
    const r = M.신강약;
    if (/강신약/.test(r))      M.신강약 = '신약(身弱)';
    else if (/약신강/.test(r)) M.신강약 = '신강(身强)';
    else if (/강신강/.test(r)) M.신강약 = '신강(身强)';
    else if (/약신약/.test(r)) M.신강약 = '신약(身弱)';
    else if (r && !r.includes('(')) M.신강약 = r.includes('강') ? '신강(身强)' : '신약(身弱)';
    M.신강약단 = M.신강약.includes('신강(') ? '신강' : '신약';
  }
})();

// ── 슬롯 맵 구성 ─────────────────────────────────────────────────
const slots = {};
for (const [k, v] of Object.entries(M)) {
  if (typeof v === 'string' || typeof v === 'number') slots[k] = String(v);
}

// ── 1차 슬롯 치환 ────────────────────────────────────────────────
for (const [k, v] of Object.entries(slots)) {
  tpl = tpl.replaceAll(`{{${k}}}`, v ?? '');
}

// ── <<IF/IS/ENDIF>> 처리 ─────────────────────────────────────────
function processConditions(text) {
  let prev;
  do {
    prev = text;
    // <<IS 키 값>> ... <<ENDIF>>
    text = text.replace(/<<IS ([^\s>]+)\s+([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, k, v, block) => {
      return (slots[k] ?? '') === v.trim() ? block : '';
    });
    // <<IF 키=값 ...>> ... <<ENDIF>>
    text = text.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
      const pass = condStr.trim().split(/\s+/).every(cond => {
        const [k, v] = cond.split('=');
        return (slots[k] ?? '') === v;
      });
      return pass ? block : '';
    });
  } while (text !== prev);
  return text.replace(/<<ENDIF>>/g, '');
}

tpl = processConditions(tpl);

// ── 개인화 블록 처리 ─────────────────────────────────────────────
function resolvePersonal(tag) {
  function applyS(text) {
    for (const [k,v] of Object.entries(slots)) text = text.replaceAll(`{{${k}}}`, v ?? '');
    return processConditions(text);
  }
  if (tag === 'PERSONAL.결혼') return applyS(결혼블록[slots.결혼상태||'미혼'] || 결혼블록['미혼']);
  if (tag === 'PERSONAL.자녀') return applyS(자녀블록[slots.자녀||'없음'] || 자녀블록['없음']);
  if (tag === 'PERSONAL.고민') return applyS((고민강조블록_짧음||고민강조블록)[slots.고민분야||'종합'] || (고민강조블록_짧음||고민강조블록)['종합']);
  if (tag === 'PERSONAL.형제') return applyS(형제블록[slots.형제유무||'있음'] || 형제블록['있음']);
  if (tag === 'PERSONAL.부모') return applyS(부모블록[slots.부모상황||'양친'] || 부모블록['양친']);
  if (tag === 'PERSONAL.건강') return applyS(건강블록[slots.건강관심||'기본'] || 건강블록['기본']);
  return null;
}

// ── applySlots 헬퍼 ──────────────────────────────────────────────
function applySlots(text) {
  for (const [k, v] of Object.entries(slots)) text = text.replaceAll(`{{${k}}}`, v ?? '');
  return processConditions(text);
}

// ── [[블록]] 치환 ────────────────────────────────────────────────
function resolveBlock(tag) {
  // 슬롯 내 변수 먼저 치환
  tag = tag.replace(/\{\{([^}]+)\}\}/g, (_, k) => slots[k] || k);

  if (tag === 'BRAND.안내') {
    let btext = 브랜드블록.안내;
    for (const [k,v] of Object.entries(slots)) btext = btext.replaceAll(`{{${k}}}`, v ?? '');
    return btext;
  }
  if (tag.startsWith('PERSONAL.')) {
    const r = resolvePersonal(tag);
    if (r !== null) return r;
  }

  const parts = tag.split('.');
  const ns    = parts[0]; // e.g. CH04
  const k     = parts[1];
  const sub   = parts[2];

  if (ns !== chUPPER) return `[NS없음: ${ns}]`;
  if (!DB[k]) return `[${chUPPER}없음: ${k}]`;

  const node = DB[k];
  if (typeof node === 'string') return applySlots(node);
  // 함수형 블록 (IIFE가 function을 반환하는 경우) 》 slots를 인자로 호출
  if (typeof node === 'function') {
    try {
      const rendered = node(slots);
      return typeof rendered === 'string' ? applySlots(rendered) : `[${chUPPER}함수오류: ${k}]`;
    } catch(e) {
      return `[${chUPPER}함수오류: ${k} 》 ${e.message}]`;
    }
  }
  if (sub !== undefined) {
    // sub가 슬롯 값으로 동적 결정되는 경우 처리
    const resolvedSub = slots[sub] || sub;
    if (node[resolvedSub]) return applySlots(node[resolvedSub]);
    if (node[sub]) return applySlots(node[sub]);
    return `[${chUPPER}없음: ${k}.${sub}]`;
  }
  return `[${chUPPER}없음: ${k}(서브키필요)]`;
}

tpl = tpl.replace(/\[\[([^\]]+)\]\]/g, (_, tag) => resolveBlock(tag));

// 2차 슬롯 치환 (블록 치환 후 남은 슬롯)
for (const [k, v] of Object.entries(slots)) tpl = tpl.replaceAll(`{{${k}}}`, v ?? '');
tpl = processConditions(tpl);

// ── 최종 <<IS>>·<<IF>> 후처리 (블록 밖 잔재 제거) ──────────
let _prevG;
do {
  _prevG = tpl;
  tpl = tpl.replace(/<<IS ([^\s>]+)\s+([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, k, v, block) => {
    return (slots[k] ?? '') === v.trim() ? block : '';
  });
  tpl = tpl.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
    const pass = condStr.trim().split(/\s+/).every(c => {
      const [k, v] = c.split('='); return (slots[k] ?? '') === v;
    });
    return pass ? block : '';
  });
} while (tpl !== _prevG);
tpl = tpl.replace(/<<ENDIF>>/g, '');

// 2차 슬롯 치환
for (const [k, v] of Object.entries(slots)) tpl = tpl.replaceAll('{{'+k+'}}', v ?? '');
// 미처리 슬롯 빈문자 처리
const missing = [];
tpl = tpl.replace(/\{\{([^}]+)\}\}/g, (_, k) => { missing.push(k); return ''; });
if (missing.length) process.stderr.write(`[미처리슬롯] ${missing.slice(0,10).join(', ')}\n`);

// 빈줄 정리
tpl = tpl.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';

const fileId  = M.id || M.이름;
const outPath = path.join(samplesDir, `${fileId}_${chKey}_result.txt`);
fs.writeFileSync(outPath, tpl, 'utf8');
console.log(`✅ 렌더링 완료: queue/${path.basename(outPath)}`);
console.log(`📄 글자수: ${[...tpl].length}자`);
