'use strict';

// ── 신살·신강약 슬롯 직접 주입 ──────────────────────────────────

// ── [CSS] 반야 표 공통 스타일 ──
// ── [CSS] 대운 그리드 (daeun_table.html 스타일) ──


function _injectSinsal(M) {
  const s = M.선생님이름 || '반야선생';
  if (!M._천을귀인설명)
    M._천을귀인설명 = M.천을귀인유무 === '있음'
      ? `천을귀인(天乙貴人)이 있다는 것은 어려운 상황에서 귀인이 나타나 도움을 주는 기운이 있다는 뜻이에요. ${s}이 봐온 분들 중에 천을귀인이 있는 분들은 위기의 순간마다 의외의 도움이 찾아오는 경우가 많았어요. 이 기운이 가장 잘 발휘되려면 스스로도 남을 도우려는 마음을 갖는 것이 중요해요.` : '';
  if (!M._역마살설명)
    M._역마살설명 = M.역마살유무 === '있음'
      ? `역마살(驛馬殺)이 있다는 것은 변화와 이동의 기운이 강하다는 뜻이에요. 현대에는 오히려 긍정적인 기운으로 작용하여 해외 활동, 이직, 여행, 새로운 환경으로의 전환이 능력이 빛나는 분이에요. ${s}이 드리는 조언은 이렇어요. 역마살의 에너지를 목적 있는 방향으로 활용하는 것이 가장 좋은 대처법이에요.` : '';
  if (!M._백호살설명)
    M._백호살설명 = M.백호살유무 === '있음'
      ? `백호대살(白虎大殺)이 있다는 것은 강렬한 기운이 사주에 담겨 있다는 뜻이에요. 잘 활용하면 강한 추진력과 결단력이 되고, 조심하지 않으면 건강·사고·인간관계에서 갑작스러운 변화가 올 수 있어요. 방어책: 무리한 활동과 급한 결정을 삼가고, 정기 건강 점검을 꾸준히 하세요.` : '';
  if (!M._도화살설명)
    M._도화살설명 = M.도화살유무 === '있음'
      ? `도화살(桃花殺)이 있다는 것은 이성과 인기의 기운이 강하다는 뜻이에요. 대운(大運)에서도 이 기운이 활성화될 때 인간관계와 인기가 특히 강해집니다. 방어책: 도화(桃花)의 매력을 직업적 능력으로 승화하고, 이성 관계에서는 신중한 선택을 하세요.` : '';
  if (!M._홍염살설명)
    M._홍염살설명 = M.홍염살유무 === '있음'
      ? `홍염살(紅艶殺)이 있다는 것은 강렬한 감성과 예술적 기운이 담겨 있다는 뜻이에요. 대운(大運) 흐름과 결합해 특정 시기에 감성과 창의성이 폭발적으로 발휘돼요. 방어책: 감성 에너지를 창작 활동으로 발산하고, 중요한 결정은 감정이 안정된 상태에서 내리세요.` : '';
  if (!M._괴강살설명)
    M._괴강살설명 = M.괴강살유무 === '있음'
      ? `괴강살(魁罡殺)이 있다는 것은 강한 기질과 독립심이 담겨 있다는 뜻이에요. 대운(大運)과 결합하면 특정 10년에 강력한 추진력이 발휘돼요. 방어책: 강한 의지는 살리되, 기신대운(忌神大運)에서는 충동적 결정을 조심하세요.` : '';
  if (!M._신강약설명) {
    const sin = M.신강약 || '';
    M._신강약설명 = sin.includes('신강(')
      ? '신강(身强) 구조이에요. 추진력과 자립심이 강점이에요. 재성(財星)·관성(官星) 대운(大運)에 좋은 흐름이 옵니다.'
      : '신약(身弱) 구조이에요. 유연하고 협력에 강해요. 인성(印星)·비겁(比劫) 대운(大運)에 전환점이 옵니다.';
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

const { 브랜드블록, 결혼블록, 자녀블록, 고민강조블록, 고민강조블록_짧음, 형제블록, 부모블록, 건강블록 } = require('./ch_personal_db');

const fs   = require('fs');
const path = require('path');
const { DB_CH08 } = require('./ch08_db');





function main() {
  // ── 개인화 블록 처리 ──
  function resolvePersonal(tag, slots) {
    function applyS(text) {
      for (const [k,v] of Object.entries(slots)) text = text.replaceAll('{{'+k+'}}', v??'');
      return fixJosa(text);
    }
    if (tag === 'PERSONAL.결혼') {
      const 상태 = slots['결혼상태'] || '미혼';
      return applyS(결혼블록[상태] || 결혼블록['미혼']);
    }
    if (tag === 'PERSONAL.자녀') {
      const 상태 = slots['자녀'] || '없음';
      return applyS(자녀블록[상태] || 자녀블록['없음']);
    }
    if (tag === 'PERSONAL.고민') {
      const 분야 = slots['고민분야'] || '종합';
      return applyS(고민강조블록_짧음[분야] || 고민강조블록_짧음['종합']);
    }
    if (tag === 'PERSONAL.형제') {
      const 상태 = slots['형제유무'] || '있음';
      return applyS(형제블록[상태] || 형제블록['있음']);
    }
    if (tag === 'PERSONAL.부모') {
      const 상태 = slots['부모상황'] || '양친';
      return applyS(부모블록[상태] || 부모블록['양친']);
    }
    if (tag === 'PERSONAL.건강') {
      const 상태 = slots['건강관심'] || '기본';
      return applyS(건강블록[상태] || 건강블록['기본']);
    }
    return null;
  }

  const jsonArg    = process.argv[2] || 'choi_wonsuk_ch08.json';
  const tplFile    = process.argv[3] || path.join(__dirname, 'ch08_template.txt');
  
  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(__dirname, 'queue', jsonArg);
const samplesDir = path.dirname(jsonPath);

  if (!fs.existsSync(jsonPath)) { console.error(`파일 없음: ${jsonPath}`); process.exit(1); }

  const M = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let tpl = fs.readFileSync(tplFile, 'utf8');

  // ── slots: JSON 전체 필드 자동 로드 (활동상태·성별·나이대 슬롯 포함) ──
  const slots = {};
  for (const [k, v] of Object.entries(M)) {
    if (typeof v === 'string' || typeof v === 'number') slots[k] = String(v);
  }

  // 슬롯 치환
  for (const [k, v] of Object.entries(slots)) {
    tpl = tpl.replaceAll(`{{${k}}}`, v ?? '');
  }

  // <<IF>> 처리
  tpl = tpl.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
    const conds = condStr.trim().split(/\s+/);
    const pass  = conds.every(c => { const [k, v] = c.split('='); return (slots[k] ?? '') === v; });
    return pass ? block : '';
  });
  // <<IF>> 처리 후 연속 빈줄 3개 이상 → 2개로 정리
  tpl = tpl.replace(/\n{3,}/g, '\n\n');

  // ── 나이대 맞춤 마무리 슬롯 동적 생성 ──
  (function build나이대마무리슬롯() {
    const 나이대 = slots['나이대'] || '';
    const 나이대키 = 나이대.replace(/\s/g, '');
    const 나이대블록 = DB_CH08['마무리_나이대']?.[나이대키]
                    || DB_CH08['마무리_나이대']?.[나이대]
                    || DB_CH08['마무리_나이대']?.['60대'] || '';
    let 결합 = 나이대블록;
    for (const [k, v] of Object.entries(slots)) {
      결합 = 결합.replaceAll('{{' + k + '}}', v ?? '');
    }
    slots['마무리_나이대'] = 결합;
  })();

  // 한국어 조사 보정 》 받침 있으면 을/이/과, 없으면 를/가/와
  function fixJosa(text) {
    return text
      .replace(/([가-힣])을\b/g, (m, c) => {
        const code = c.charCodeAt(0);
        if(code < 0xAC00 || code > 0xD7A3) return m;
        return (code - 0xAC00) % 28 !== 0 ? c+'을' : c+'를';
      })
      .replace(/([가-힣])를\b/g, (m, c) => {
        const code = c.charCodeAt(0);
        if(code < 0xAC00 || code > 0xD7A3) return m;
        return (code - 0xAC00) % 28 !== 0 ? c+'을' : c+'를';
      });
  }

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

  // 10기 대운 해설 동적 생성
  function build대운해설() {
    if (!M.대운목록_10기) return '';
    const lines = M.대운목록_10기.split('\n');
    return lines.map(line => {
      const 성격match = line.match(/(용신대운|희신대운|기신대운|기신대운|중립대운)/);
      const 기match   = line.match(/^(\d+)기/);
      if (!성격match || !기match) return '';

      // 기신대운 → 기신대운 정규화 (DB 키는 기신대운_xxx 형태)
      const 성격  = 성격match[1] === '기신대운' ? '기신대운' : 성격match[1];
      const 기    = 기match[1];
      // 대운나이대 추출 → applySlots에서 {{대운나이대}} 치환
      const 나이match = line.match(/(\d+)-(\d+)세/);
      const 대운나이대 = 나이match ? 나이match[1]+'대' : (M.나이대||'');
      const _orig_slots = Object.assign({}, M);
      slots['대운나이대'] = 대운나이대;

      // 12운성으로 강약 판별 → DB 세분화 키 매핑
      const 운성match = line.match(/\|\s*(장생|목욕|관대|건록|제왕|쇠|병|사|묘|절|태|양)\s*\|/);
      const 운성 = 운성match ? 운성match[1] : '';
      const 강운성 = ['건록', '제왕', '관대'];
      const 성장운성 = ['장생', '목욕'];
      const 태양운성 = ['태', '양'];
      const 절운성 = ['절'];
      const 사묘운성 = ['사', '묘'];
      const 쇠병운성 = ['쇠', '병'];
      const 강약 = 강운성.includes(운성) ? '_강'
                 : 성장운성.includes(운성) ? '_성장'
                 : 태양운성.includes(운성) ? '_태양'
                 : 절운성.includes(운성) ? '_절'
                 : 사묘운성.includes(운성) ? '_사묘'
                 : 쇠병운성.includes(운성) ? '_쇠병'
                 : '_성장';

      const 해설키 = 성격 + 강약;
      const 해설블록 = DB_CH08.대운기_해석[해설키]
                    || DB_CH08.대운기_해석[성격 + '_약'] || DB_CH08.대운기_해석[성격 + '_성장']
                    || '';
      if (!해설블록) return '';

      // 각 대운별 나이대 동적 계산
      const 나이매치 = line.match(/\|(\s*)(\d+)-(\d+)세/);
      const 대운시작나이 = 나이매치 ? parseInt(나이매치[2]) : null;
      function 나이대계산(나이) {
        if (나이 === null) return slots['나이대'] || '';
        if (나이 < 10) return '10대 이전';
        if (나이 < 20) return '10대';
        if (나이 < 30) return '20대';
        if (나이 < 40) return '30대';
        if (나이 < 50) return '40대';
        if (나이 < 60) return '50대';
        if (나이 < 70) return '60대';
        if (나이 < 80) return '70대';
        if (나이 < 90) return '80대';
        return '90대 이상';
      }
      const 해당나이대 = 나이대계산(대운시작나이);
      const 기슬롯 = { ...slots, 현재대운기: 기, 현재대운기_실제: slots['현재대운기'] || '', 현재대운_진행중: (기 === (slots['현재대운기'] || '')) ? 'Y' : 'N', 나이대: 해당나이대, 대운나이대: 해당나이대, 만나이: 대운시작나이 !== null ? String(대운시작나이) : slots['만나이'] || '' };
      let 텍스트 = `\n• ${line}\n\n${해설블록}`;
      if (텍스트.includes('그 10년에 내린 결정이 지금의 나를 만들었다')) {
        if (!global._대운인용카운트) global._대운인용카운트 = 0;
        global._대운인용카운트++;
        if (global._대운인용카운트 === 2) 텍스트 = 텍스트.replace('"그 10년에 내린 결정이 지금의 나를 만들었다"', '"준비한 사람에게 기회가 왔을 때 그 차이가 났다"');
        if (global._대운인용카운트 >= 3) 텍스트 = 텍스트.replace('"그 10년에 내린 결정이 지금의 나를 만들었다"', '"버텨온 시간이 결국 다 밑거름이 됐다"');
      }
      for (const [k, v] of Object.entries(기슬롯)) {
        텍스트 = 텍스트.replaceAll(`{{${k}}}`, v ?? '');
      }
      // <<IF>> 조건 처리
      let prev;
      do {
        prev = 텍스트;
        텍스트 = 텍스트.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
          const conds = condStr.trim().split(/\s+/);
          const pass = conds.every(cond => {
            const [k, v] = cond.split('=');
            return (기슬롯[k] ?? '') === v;
          });
          return pass ? block : '';
        });
      } while (텍스트 !== prev);
      텍스트 = 텍스트.replace(/<<ENDIF>>/g, '');
      // 연속 빈줄 3개 이상 → 2개로 정리
      텍스트 = 텍스트.replace(/\n{3,}/g, '\n\n');
      return 텍스트;
    }).filter(Boolean).join('');
  }

  function resolveBlock(tag) {
  if (tag === 'BRAND.안내') {
      let btext = 브랜드블록.안내;
      for (const [bk, bv] of Object.entries(M)) {
        if (typeof bv === 'string') btext = btext.replaceAll('{{' + bk + '}}', bv);
      }
      return btext;
    }

    // PERSONAL 블록 처리
    if (tag.startsWith('PERSONAL.')) {
      const result = resolvePersonal(tag, slots);
      if (result !== null) return result;
    }
    const parts = tag.split('.');
    if (parts[0] !== 'CH08') return `[NS없음: ${parts[0]}]`;
    if (tag.includes('대운흐름타임라인')) return '';
    if (tag.includes('대운그리드')) return '';
    if (tag.includes('십이운성곡선')) return '';
    const section = parts[1];
    const key     = parts[2];

    if (section === '대운_10기_해설') return applySlots(build대운해설());

    const node = DB_CH08[section];
    if (!node) return `[CH08없음: ${section}]`;
    if (typeof node === 'string') {
      let text = applySlots(node);
      // <<IS 슬롯 값>> ... <<ENDIF>> 조건 처리
      text = text.replace(/\{\{[^}]+\}\}<<IS[^>]+>>[\s\S]*?<<ENDIF>>/g, '');
      text = text.replace(/<<IS ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, cond, block) => {
        const [k, v] = cond.trim().split(' ');
        return (slots[k] ?? '') === v ? block : '';
      });
      text = text.replace(/\n{3,}/g, '\n\n');
      return text;
    }
    if (key && node[key]) return applySlots(node[key]);
    return `[CH08없음: ${section}.${key}]`;
  }

  tpl = tpl.replace(/\[\[([^\]]+)\]\]/g, (_, tag) => {
    const resolved = tag.replace(/\{\{([^}]+)\}\}/g, (__, k) => slots[k] ?? k);
    return resolveBlock(resolved);
  });

  // ── 블록 치환 후 남은 <<IS>>·<<IF>> 후처리 ──────────────
  let _prev;
  do {
    _prev = tpl;
    tpl = tpl.replace(/<<IS ([^\s>]+)\s+([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, k, v, block) => {
      return (slots[k] ?? '') === v.trim() ? block : '';
    });
    tpl = tpl.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
      const pass = condStr.trim().split(/\s+/).every(c => {
        const [k, v] = c.split('='); return (slots[k] ?? '') === v;
      });
      return pass ? block : '';
    });
  } while (tpl !== _prev);
  tpl = tpl.replace(/<<ENDIF>>/g, '');

  // ── 2차 슬롯 치환 + 미처리 슬롯 빈문자 처리 ─────────────
  for (const [k, v] of Object.entries(slots)) tpl = tpl.replaceAll('{{'+k+'}}', v ?? '');
  tpl = tpl.replace(/\{\{[^}]+\}\}/g, '');

  tpl = tpl.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';

  const fileId  = M.id || M.이름;
  const outPath = path.join(samplesDir, `${fileId}_ch08_result.txt`);
  // {{슬롯}} 잔재 치환 (제목줄 등 [[]] 밖에 있는 것)
  tpl = applySlots(tpl);

  fs.writeFileSync(outPath, tpl, 'utf8');
  console.log(`✅ 렌더링 완료: queue/${path.basename(outPath)}`);
  console.log(`📄 글자수: ${[...tpl].length}자`);
}

main();
