'use strict';

// ── 신살·신강약 슬롯 직접 주입 ──────────────────────────────────
function _injectSinsal(M) {
  const s = M.선생님이름 || '반야선생';
  if (!M._천을귀인설명)
    M._천을귀인설명 = M.천을귀인유무 === '있음'
      ? `천을귀인(天乙貴人)이 있다는 것은 어려운 상황에서 귀인이 나타나 도움을 주는 기운이 있다는 뜻입니다. ${s}이 봐온 분들 중에 천을귀인이 있는 분들은 위기의 순간마다 의외의 도움이 찾아오는 경우가 많았어요. 이 기운이 가장 잘 발휘되려면 스스로도 남을 도우려는 마음을 갖는 것이 중요해요.` : '';
  if (!M._역마살설명)
    M._역마살설명 = M.역마살유무 === '있음'
      ? `역마살(驛馬殺)이 있다는 것은 변화와 이동의 기운이 강하다는 뜻입니다. 현대에는 오히려 긍정적인 기운으로 작용하여 해외 활동, 이직, 여행, 새로운 환경으로의 전환이 능력이 빛나는 분입니다. ${s}이 드리는 조언은 이렇어요. 역마살의 에너지를 목적 있는 방향으로 활용하는 것이 가장 좋은 대처법입니다.` : '';
  if (!M._백호살설명)
    M._백호살설명 = M.백호살유무 === '있음'
      ? `백호대살(白虎大殺)이 있다는 것은 강렬한 기운이 사주에 담겨 있다는 뜻입니다. 잘 활용하면 강한 추진력과 결단력이 되고, 조심하지 않으면 건강·사고·인간관계에서 갑작스러운 변화가 올 수 있어요. 방어책: 무리한 활동과 급한 결정을 삼가고, 정기 건강 점검을 꾸준히 하십시오.` : '';
  if (!M._도화살설명)
    M._도화살설명 = M.도화살유무 === '있음'
      ? `도화살(桃花殺)이 있다는 것은 이성과 인기의 기운이 강하다는 뜻입니다. 대운(大運)에서도 이 기운이 활성화될 때 인간관계와 인기가 특히 강해집니다. 방어책: 도화(桃花)의 매력을 직업적 능력으로 승화하고, 이성 관계에서는 신중한 선택을 하세요.` : '';
  if (!M._홍염살설명)
    M._홍염살설명 = M.홍염살유무 === '있음'
      ? `홍염살(紅艶殺)이 있다는 것은 강렬한 감성과 예술적 기운이 담겨 있다는 뜻입니다. 대운(大運) 흐름과 결합해 특정 시기에 감성과 창의성이 폭발적으로 발휘돼요. 방어책: 감성 에너지를 창작 활동으로 발산하고, 중요한 결정은 감정이 안정된 상태에서 내리세요.` : '';
  if (!M._괴강살설명)
    M._괴강살설명 = M.괴강살유무 === '있음'
      ? `괴강살(魁罡殺)이 있다는 것은 강한 기질과 독립심이 담겨 있다는 뜻입니다. 대운(大運)과 결합하면 특정 10년에 강력한 추진력이 발휘돼요. 방어책: 강한 의지는 살리되, 기신대운(忌神大運)에서는 충동적 결정을 조심하세요.` : '';
  if (!M._신강약설명) {
    M._신강약설명 = (M.신강약||'').includes('신강(')
      ? '신강(身强) 구조입니다. 추진력과 자립심이 강점입니다. 재성(財星)·관성(官星) 대운(大運)에 좋은 흐름이 옵니다.'
      : '신약(身弱) 구조입니다. 유연하고 협력에 강해요. 인성(印星)·비겁(比劫) 대운(大運)에 전환점이 옵니다.';
  }
  // 신강약 정규화
  if (M.신강약) {
    const r = M.신강약;
    if (/강신약/.test(r))      M.신강약 = '신약(身弱)';
    else if (/약신강/.test(r)) M.신강약 = '신강(身强)';
    else if (/강신강/.test(r)) M.신강약 = '신강(身强)';
    else if (/약신약/.test(r)) M.신강약 = '신약(身弱)';
    else if (r.includes('중화형')) { M.신강약 = '중화형 신강(身强)'; M.신강약단 = '중화형신강'; }
    else if (r && !r.includes('(')) M.신강약 = r.includes('강') ? '신강(身强)' : '신약(身弱)';
    if (M.신강약단 !== '중화형신강') M.신강약단 = M.신강약.includes('신강(') ? '신강' : '신약';
  }
}
const { 브랜드블록, 결혼블록, 결혼블록_ch11, 자녀블록, 고민강조블록, 고민강조블록_짧음, 형제블록, 부모블록, 건강블록, injectCh08Fields } = require('./ch_personal_db');

const fs   = require('fs');
const path = require('path');
const { DB_CH11 } = require('./ch11_db');

function main() {
  const jsonArg    = process.argv[2] || 'choi_wonsuk_ch11.json';
  const tplFile    = process.argv[3] || path.join(__dirname, 'ch11_template.txt');
  
  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(__dirname, 'queue', jsonArg);
const samplesDir = path.dirname(jsonPath);
  if (!fs.existsSync(jsonPath)) { console.error(`파일 없음: ${jsonPath}`); process.exit(1); }

  const M   = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  _injectSinsal(M);
  let   tpl = fs.readFileSync(tplFile, 'utf8');

  const slots = {};
  for (const [k, v] of Object.entries(M)) {
    if (typeof v === 'string') slots[k] = v;
  }


  // ch08 공유 필드 주입 (기신오행, 현재대운성격 등)
  injectCh08Fields(M, samplesDir, slots);
  for (const [k, v] of Object.entries(slots)) tpl = tpl.replaceAll(`{{${k}}}`, v);

  // <<IF>> 처리
  tpl = tpl.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
    const [k, v] = condStr.trim().split('=');
    return (slots[k] ?? '') === v ? block : '';
  });

  function applySlots(text) {
    if (typeof text !== 'string') return String(text ?? '');
    for (const [k, v] of Object.entries(slots)) text = text.replaceAll(`{{${k}}}`, v ?? '');
    // DB 블록 내부 <<IF>> 중첩 처리
    let prev;
    do {
      prev = text;
      text = text.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
        const conds = condStr.trim().split(/\s+/);
        const pass = conds.every(cond => {
          const [k, v] = cond.split('=');
          return (slots[k] ?? '') === v;
        });
        return pass ? block : '';
      });
    } while (text !== prev);
    // 처리 후 남은 <<ENDIF>> 잔재 제거
    text = text.replace(/<<ENDIF>>/g, '');
    return text;
  }

  function resolvePersonal(tag) {
    if (tag === 'PERSONAL.결혼') { const 상태 = slots.결혼상태 || '미혼'; return applySlots(결혼블록_ch11[상태] || 결혼블록_ch11['미혼'] || 결혼블록[상태] || 결혼블록['미혼']); }
    if (tag === 'PERSONAL.자녀') return applySlots(자녀블록[slots.자녀||'없음'] || 자녀블록['없음']);
    if (tag === 'PERSONAL.고민') return applySlots((고민강조블록_짧음[slots.고민분야||'종합'] || 고민강조블록_짧음['종합']));
    if (tag === 'PERSONAL.형제') return applySlots(형제블록[slots.형제유무||'있음'] || 형제블록['있음']);
    if (tag === 'PERSONAL.부모') return applySlots(부모블록[slots.부모상황||'양친'] || 부모블록['양친']);
    return null;
  }

  function resolveBlock(tag) {
  if (tag === 'BRAND.안내') {
      let btext = 브랜드블록.안내;
      for (const [bk, bv] of Object.entries(M)) {
        if (typeof bv === 'string') btext = btext.replaceAll('{{' + bk + '}}', bv);
      }
      return btext;
    }
    if (tag.startsWith('PERSONAL.')) {
      const r = resolvePersonal(tag);
      if (r !== null) return r;
    }
    const parts = tag.split('.');
    if (parts[0] !== 'CH11') return `[NS없음: ${parts[0]}]`;
    const section = parts[1];
    const key     = parts[2];
    const node    = DB_CH11[section];
    if (!node) return `[CH11없음: ${section}]`;
    if (typeof node === 'string') return applySlots(node);
    if (key !== undefined) {
      const val = node[key];
      if (val === undefined) return `[CH11없음: ${section}.${key}]`;
      if (typeof val === 'string') return applySlots(val);
      return `[CH11없음: ${section}.${key}(타입오류)]`;
    }
    return `[CH11없음: ${section}(키없음)]`;
  }

  tpl = tpl.replace(/\[\[([^\]]+)\]\]/g, (_, tag) => {
    const resolved = tag.replace(/\{\{([^}]+)\}\}/g, (__, k) => slots[k] ?? k);
    return resolveBlock(resolved);
  });

  tpl = tpl.replace(/없음입니다/g, '없는 구조입니다');
  tpl = tpl.replace(/없음 \(없음\)/g, '없음 (원국 부재)');
  tpl = tpl.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';

  const fileId  = M.id || M.이름;
  const outPath = path.join(samplesDir, `${fileId}_ch11_result.txt`);
  // {{슬롯}} 잔재 치환 (제목줄 등 [[]] 밖에 있는 것)
  tpl = applySlots(tpl);

  fs.writeFileSync(outPath, tpl, 'utf8');
  console.log(`✅ 렌더링 완료: queue/${path.basename(outPath)}`);
  console.log(`📄 글자수: ${[...tpl].length}자`);
}

main();
