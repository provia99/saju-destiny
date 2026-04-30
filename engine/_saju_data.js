/**
 * engine/_saju_data.js
 * ─────────────────────────────────────────────────────────────
 * 표 generator들이 saju_calc 단일 소스로 작동하도록 ch*.json 데이터 보강
 *
 * 사용법 — 모든 generator 시작 부분에 한 줄:
 *   const r = require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d5, d6, d8);
 *
 * 효과:
 *   - master.json 찾고 saju_calc 한 번 호출
 *   - d3/d5/d6/d8 dict에 빈 필드를 saju_calc 결과로 자동 채움
 *   - 기존 ch*.json 의존 코드 그대로 작동 (backward compat)
 *   - r 반환 값은 saju_calc 결과 — 추가 로직 작성 시 사용 가능
 * ─────────────────────────────────────────────────────────────
 */
'use strict';
const fs = require('fs');
const path = require('path');
const G  = require('./_guards');

const _천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const _지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const _천간오행 = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const _지지오행 = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const _지지띠 = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
const _ohFmt = (oh) => ({木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'}[oh] || oh || '');

// 빈값 판정 — undefined/null/빈문자/'없음'/'미상'/'-'
function _isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' || s === '없음' || s === '미상' || s === '-' || s === '—';
  }
  return false;
}

// saju_calc 결과를 항상 덮어씀 (single source) — 단, saju_calc 값이 비어있으면 기존 값 유지
function _setIfEmpty(dict, key, value) {
  if (!dict) return;
  if (_isEmpty(value)) return;  // saju_calc가 빈 값이면 기존 ch03 값 보존
  dict[key] = value;            // saju_calc 결과로 항상 덮어씀
}

/**
 * saju_calc 결과로 dict들 보강
 * @param {string} slotId  - 호출자 인자 (다양한 형식 대응)
 * @param {string} queueDir - QUEUE_DIR 경로
 * @param  {...object} dicts - 보강할 dict들 (d3, d5, d6, d8 등)
 * @returns {object|null} saju_calc 결과 r (실패 시 null)
 */
function augmentAll(slotId, queueDir, ...dicts) {
  const masterPath = G.findMasterJson(slotId, queueDir);
  if (!masterPath) return null;

  let r, m;
  try {
    m = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
    const { 전체사주계산 } = require('./saju_calc');
    r = 전체사주계산({
      이름: m.이름, 성별: m.성별 ?? '남',
      년: m.생년, 월: m.생월, 일: m.생일,
      시간: m.생시 || '모름',
      음력입력: !!m.음력입력, 윤달: !!m.윤달, self_q1: m.self_q1, self_q2: m.self_q2, self_q3: m.self_q3, self_q4: m.self_q4, self_q5: m.self_q5, self_q6: m.self_q6, self_q7: m.self_q7,
});
  } catch (e) {
    console.warn(`⚠️ saju_calc 보강 실패 (slotId=${slotId}): ${e.message}`);
    return null;
  }

  // 각 dict에 동일한 보강 적용
  for (const dict of dicts) {
    if (!dict || typeof dict !== 'object') continue;
    _augmentOne(dict, r, m);
  }

  return r;
}

function _augmentOne(d, r, m) {
  // ── 4기둥 분리 필드 (사주기본표·십성배치표·재물전략표 등) ──
  for (const key of ['년주', '월주', '일주', '시주']) {
    const p = r.원국[key];
    if (!p?.천간) continue;
    _setIfEmpty(d, `${key}_천간`,    p.천간);
    _setIfEmpty(d, `${key}_천간_음`,  _천간음[p.천간] || '');
    _setIfEmpty(d, `${key}_천간_오행`, _천간오행[p.천간] || '');
    _setIfEmpty(d, `${key}_지지`,    p.지지);
    _setIfEmpty(d, `${key}_지지_음`,  _지지음[p.지지] || '');
    _setIfEmpty(d, `${key}_지지_오행`, _지지오행[p.지지] || '');
    _setIfEmpty(d, `${key}_한자`,    p.천간 + p.지지);
  }

  // ── 십성 (8개) ──
  if (Array.isArray(r.십성배치)) {
    const _posMap = {
      년간:'년주_천간십성', 년지:'년주_지지십성',
      월간:'월주_천간십성', 월지:'월주_지지십성',
      일간:'일주_천간십성', 일지:'일주_지지십성',
      시간:'시주_천간십성', 시지:'시주_지지십성'
    };
    for (const item of r.십성배치) {
      const slot = _posMap[item.위치];
      if (slot) _setIfEmpty(d, slot, item.십성명 || '');
    }
    // 십성배치목록 (parseSipseongBaechi 입력용)
    if (_isEmpty(d['십성배치목록'])) {
      d['십성배치목록'] = r.십성배치.map(x =>
        `${x.위치}${x.글자||''}(${x.십성명})`
      ).join(' / ');
    }
  }

  // ── 5신 (용신/희신/기신/구신/한신) ──
  _setIfEmpty(d, '용신오행', _ohFmt(r.용신));
  _setIfEmpty(d, '희신오행', _ohFmt(r.희신));
  _setIfEmpty(d, '기신오행', _ohFmt(r.기신));
  _setIfEmpty(d, '구신오행', _ohFmt(r.구신));
  _setIfEmpty(d, '한신오행', _ohFmt(r.한신));
  _setIfEmpty(d, '억부용신', _ohFmt(r.억부용신));
  _setIfEmpty(d, '조후용신', _ohFmt(r.조후용신));
  // 한자 키 (오행한자만)
  _setIfEmpty(d, '용신한자', r.용신 || '');
  _setIfEmpty(d, '희신한자', r.희신 || '');
  _setIfEmpty(d, '기신한자', r.기신 || '');

  // ── 신강약/격국 ──
  _setIfEmpty(d, '신강약',   r.신강약 || '');
  _setIfEmpty(d, '신강약단', (r.신강약||'').includes('강') ? '신강' : '신약');
  _setIfEmpty(d, '격국명',   r['格국명'] || r['격국명'] || '');

  // ── 이름·일주 ──
  _setIfEmpty(d, '이름', m.이름 || r.이름 || '');
  if (_isEmpty(d['일주'])) {
    const t = r.원국.일주.천간, j = r.원국.일주.지지;
    d['일주'] = `${t}${j}(${_천간음[t]||''}${_지지음[j]||''})`;
  }
  _setIfEmpty(d, '일주한자', r.원국.일주.천간 + r.원국.일주.지지);
  _setIfEmpty(d, '일간',     r.원국.일주.천간 || '');
  _setIfEmpty(d, '일지',     r.원국.일주.지지 || '');
  _setIfEmpty(d, '일간오행', r.일간오행 || _천간오행[r.원국.일주.천간] || '');

  // ── 띠/만나이/생년월일 ──
  const _ttl = _지지띠[r.원국.년주?.지지] || '';
  _setIfEmpty(d, '년지띠', _ttl);
  _setIfEmpty(d, '띠',     _ttl);
  if (_isEmpty(d['만나이']) && r.만나이 != null) d['만나이'] = r.만나이;

  // ── 오행점수 ──
  if (r.오행점수) {
    for (const [k, v] of Object.entries(r.오행점수)) {
      const kr = {木:'목',火:'화',土:'토',金:'금',水:'수'}[k];
      if (kr) _setIfEmpty(d, `${kr}점수`, v);
    }
  }

  // ── 양/음력·발행연도 ──
  _setIfEmpty(d, '양력정보', r.양력정보 || '');
  _setIfEmpty(d, '음력정보', r.음력정보 || '');
  _setIfEmpty(d, '발행연도', m.발행연도 || new Date().getFullYear());

  // ── 지장간 (사주기본표용 _HTML 필드) ──
  if (r.지장간) {
    const _zMap = { 년지:'년주', 월지:'월주', 일지:'일주', 시지:'시주' };
    for (const [zKey, pKey] of Object.entries(_zMap)) {
      const z = r.지장간[zKey];
      if (!z?.항목) continue;
      const html = z.항목.map(it =>
        `${it.간}(${_천간음[it.간]||''}) ${it.십성명||''}`
      ).join('<br>');
      _setIfEmpty(d, `${pKey}_지장간_HTML`, html);
    }
  }

  // ── 공망 ──
  if (r.공망) {
    _setIfEmpty(d, '공망1', r.공망.공망1 || '');
    _setIfEmpty(d, '공망2', r.공망.공망2 || '');
    _setIfEmpty(d, '공망표기', r.공망.공망표기 || '');
    _setIfEmpty(d, '년공1', r.공망.년공1 || '');
    _setIfEmpty(d, '년공2', r.공망.년공2 || '');
  }

  // ── 합·충·형·파·해 (지지) ──
  if (r.합충형파해) {
    const hcp = r.합충형파해;
    const _ja = (arr, fmtFn) => Array.isArray(arr) && arr.length ? arr.map(fmtFn).join(', ') : '';
    if (_isEmpty(d['지지합목록'])) {
      const lst = [];
      (hcp.지지삼합||[]).forEach(x => lst.push(`${x.지지.join('')}(${x.합화||''})${x.완전합?'':' 반합'}`));
      (hcp.지지육합||[]).forEach(x => lst.push(`${x.지지?.join('')||''}(${x.합화||''}) 육합`));
      d['지지합목록'] = lst.join(', ');
    }
    if (_isEmpty(d['지지충목록'])) {
      d['지지충목록'] = _ja(hcp.지지충, x => `${x.지지?.join('')||x.지1+''+x.지2||''}`);
    }
    if (_isEmpty(d['지지형목록'])) {
      d['지지형목록'] = _ja(hcp.지지형, x => `${x.지1||''}${x.지2||''}${x.종류?' '+x.종류:''}`);
    }
    if (_isEmpty(d['지지파해목록'])) {
      const pa = (hcp.지지파||[]).map(x => `${x.지1||''}${x.지2||''} 파`);
      const ha = (hcp.지지해||[]).map(x => `${x.지1||''}${x.지2||''} 해`);
      d['지지파해목록'] = [...pa, ...ha].join(', ');
    }
  }

  // ── 신살 (4기둥별 _HTML 및 요약) ──
  if (r.신살) {
    const _posToPillar = {
      년간:'년주', 년지:'년주',
      월간:'월주', 월지:'월주',
      일간:'일주', 일지:'일주',
      시간:'시주', 시지:'시주'
    };
    const _byPillar = { 년주:[], 월주:[], 일주:[], 시주:[] };
    const _good = []; // 귀인 신살
    const _bad  = []; // 흉살
    const GOOD_KEYS = ['천을귀인','천복귀인','태극귀인','문창귀인','천덕귀인','월덕귀인','암록','복성귀인'];
    const BAD_KEYS  = ['백호대살','괴강살','현침살','도화살','홍염살','원진살','귀문관살','고란살','과숙살','상문살','조객살','병부살','겁살','망신살'];
    for (const [name, val] of Object.entries(r.신살)) {
      if (name === '신살_12') {
        // 12신살 (지살, 반안살, 년살 등) — 위치별 추가
        for (const [s12, positions] of Object.entries(val||{})) {
          if (!Array.isArray(positions)) continue;
          for (const pos of positions) {
            const pillar = _posToPillar[pos];
            if (pillar) _byPillar[pillar].push(s12);
          }
        }
        continue;
      }
      // 단순 위치 배열
      if (Array.isArray(val) && val.length) {
        for (const pos of val) {
          if (typeof pos === 'string') {
            const pillar = _posToPillar[pos];
            if (pillar) _byPillar[pillar].push(name);
          } else if (pos?.위치) {
            // {쌍, 위치:[...]} 형식 (원진살, 귀문관살 등)
            for (const p of (Array.isArray(pos.위치)?pos.위치:[pos.위치])) {
              const pillar = _posToPillar[p];
              if (pillar && !_byPillar[pillar].includes(name)) _byPillar[pillar].push(name);
            }
          }
        }
        if (GOOD_KEYS.includes(name) && val.length) _good.push(name);
        if (BAD_KEYS.includes(name) && val.length) _bad.push(name);
      }
    }
    for (const [pKey, names] of Object.entries(_byPillar)) {
      if (names.length) _setIfEmpty(d, `${pKey}_신살_HTML`, [...new Set(names)].join('<br>'));
    }
    if (_good.length) _setIfEmpty(d, '귀인신살요약', [...new Set(_good)].join('<br>'));
    if (_bad.length)  _setIfEmpty(d, '흉살요약',     [...new Set(_bad)].join('<br>'));
  }
}

module.exports = { augmentAll };
