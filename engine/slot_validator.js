'use strict';
// ================================================================
// slot_validator.js  v3
// 버그수정: 기본값 주입 후 성별별 슬롯 순서 보장
//           deriveGenderSlots 가 SLOT_DEFAULTS 보다 나중에 실행되어야 함
// ================================================================

// 사양별 오행 관계 (성별별 생성을 위함)
const 십성오행맵 = { '비겁':'목', '식상':'화', '재성':'토', '관성':'금', '인성':'수' }; 
const 관성오행맵 = { '목':'금', '화':'수', '토':'목', '금':'화', '수':'토' }; 
const 인성오행맵 = { '목':'수', '화':'목', '토':'화', '금':'토', '수':'금' }; 
const 천간오행맵 = { '갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수' };
const 천간오행맵2 = { '갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수' };

// 성별별 슬롯 생성 로직
function deriveGenderSlots(M, overwrite = false) {
  const 성별 = (M.성별 || '남성').trim();
  const 일간 = (M.일간 || '').replace(/\([^)]*\)/g,'').trim();
  const 일간오행 = 천간오행맵2[일간] || M.일간오행 || '목';

  function set(k, v) { if (overwrite || !M[k] || M[k] === '') M[k] = v; }
  
  if (성별 === '남성') {
    set('배우자운', '재성');
  } else {
    set('배우자운', '관성');
  }
}

const SLOT_DEFAULTS = {
  기준해: String(new Date().getFullYear()),
  기준년: String(new Date().getFullYear() + 1),
  성별: '남성',
  공망유무: 'N',
  조후같음: 'N',
};

const SLOT_PATTERNS = {
  기준해: /^\d{4}$/,
  기준년: /^\d{4}$/,
  공망유무: /^[YN]$/,
  조후같음: /^[YN]$/,
};

// 슬롯 검증 메인 함수
function validateSlots(M, options = {}) {
  const { strict = false, verbose = false } = options;
  const warnings = [], errors = [];

  // 1. 기본값 채우기
  for (const [key, def] of Object.entries(SLOT_DEFAULTS)) {
    if (M[key] === undefined || M[key] === null || M[key] === '') {
      if (strict) errors.push(`[필수누락] {{${key}}}`);
      else { M[key] = def; warnings.push(`[기본값설정] {{${key}}}`); }
    }
  }

  // 2. 패턴 검증
  for (const [key, pat] of Object.entries(SLOT_PATTERNS)) {
    if (M[key] && !pat.test(String(M[key]))) {
      warnings.push(`[패턴불일치] {{${key}}}="${M[key]}"`);
      if (SLOT_DEFAULTS[key]) M[key] = SLOT_DEFAULTS[key];
    }
  }

  // 3. 성별별 슬롯 파생 (반드시 기본값 채우기 이후 실행)
  deriveGenderSlots(M, true);

  // 4. 연도 자동 보정
  if (M.기준해 && !M.기준년) M.기준년 = String(Number(M.기준해) + 1);

  // 신강약 판정 정규화 (강신강·강신약 등)
  if (M.신강약) {
    const _raw = M.신강약;
    if (/신강/.test(_raw) && !/신약/.test(_raw)) {
      if (!_raw.includes('(')) M.신강약 = '신강(身强)';
    } else if (/신약/.test(_raw) && !/신강/.test(_raw)) {
      if (!_raw.includes('(')) M.신강약 = '신약(身弱)';
    }
  }

  if (M.신강약) M.신강약판단 = M.신강약.includes('신강(') ? '신강' : '신약';
  
  if (!M.용신오기 && M.용신오행) M.용신오기 = M.용신오행;
  if (!M.희신오기 && M.희신오행) M.희신오기 = M.희신오행;
  if (!M.기신오기 && M.기신오행) M.기신오기 = M.기신오행;
  
  if (!M.격국패턴 && M.일간오행 && M.신강약판단)
    M.격국패턴 = `${M.일간오행}_${M.신강약판단}`;

  // 신살 설명 주입
  const _s = M.수행이름 || '반야수행';
  M._천을귀인설명 = M.천을귀인유무 === '있음'
    ? `천을귀인(天乙貴인)이 있다는 것은 어려움 속에서도 귀인의 도움을 받는 기운입니다. ${_s}이 봐온 사례들에서도 큰 힘이 되었습니다.`
    : '';
  M._역마살설명 = M.역마살유무 === '있음'
    ? `역마살(驛馬殺)은 변화와 이동의 기운이 강함을 의미합니다. ${_s}은 이를 긍정적인 활동력으로 보길 권합니다.`
    : '';

  if (verbose) {
    if (warnings.length) console.warn('[SlotValidator] 경고 ' + warnings.length);
    if (errors.length)   console.error('[SlotValidator] 오류:\n' + errors.join('\n'));
  }
  return { slots: M, warnings, errors, valid: errors.length === 0 };
}

function safeApplySlots(text, M) {
  const missing = [];
  text = text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const val = M[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      missing.push(key);
      return '';
    }
    return String(val);
  });
  if (missing.length > 0)
    process.stderr.write(`[safeApplySlots] 미처리 {{${missing.length}}} : ${missing.slice(0,10).join(', ')}\n`);
  return text;
}

module.exports = { validateSlots, safeApplySlots, deriveGenderSlots, SLOT_DEFAULTS };
