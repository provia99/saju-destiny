#!/usr/bin/env node
/**
 * generate_all.js
 * 사주집필 전체 표 일괄 생성기
 * ──────────────────────────────────────────────────
 * node generate_all.js <slot_id>
 * 모든 표 generator를 순서대로 실행합니다.
 */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;

// ── generator 목록 (순서 = 책 구성 순서) ─────────────
const GENERATORS = [
  // ── 표지 ───────────────────────────────────────────
  { file: 'generate_cover.js',          desc: '표지(cover)' },

  // ── 사주 기본 ──────────────────────────────────────
  { file: 'generate_사주기본표.js',     desc: '사주기본표' },
  { file: 'generate_사주원국요약.js',   desc: '사주원국요약표1+2' },
  { file: 'generate_일주요약박스.js',   desc: '일주요약박스' },
  { file: 'generate_공망안내박스.js',   desc: '공망안내박스' },

  // ── 오행·용신 ──────────────────────────────────────
  { file: 'generate_오행균형표.js',     desc: '오행균형표' },
  { file: 'generate_오행점수표.js',     desc: '오행점수표' },
  { file: 'generate_오행생극도.js',     desc: '오행생극도' },
  { file: 'generate_4신요약표.js',      desc: '4신요약표1+2' },
  { file: 'generate_용신가이드카드.js', desc: '용신가이드카드' },

  // ── 십성·배치 ──────────────────────────────────────
  { file: 'generate_십성배치표.js',     desc: '십성배치표' },
  { file: 'generate_지장간분석표.js',   desc: '지장간분석표' },

  // ── 합충형파해 ──────────────────────────────────────
  // generate_합충형파해.js는 master.json 직접 계산 방식으로 run_all.js에서 별도 호출

  // ── 대운 ───────────────────────────────────────────
  { file: 'generate_대운타임라인.js',   desc: '대운타임라인' },
  { file: 'generate_대운로드맵.js',     desc: '대운로드맵' },

  // ── 세운·월운 ──────────────────────────────────────
  { file: 'generate_세운월운달력.js',   desc: '세운월운달력' },

  // ── 전환점 ─────────────────────────────────────────
  { file: 'generate_전환점요약표.js',   desc: '전환점요약표' },
  { file: 'generate_전환점타임라인.js', desc: '전환점타임라인' },

  // ── 연간 요약 ──────────────────────────────────────
  { file: 'generate_연간운세요약표.js', desc: '연간운세요약표' },

  // ── 신규 ───────────────────────────────────────────
  { file: 'generate_십성계열분류표.js',  desc: '십성계열분류표' },
  { file: 'generate_세운대운교차표.js',  desc: '세운대운교차표' },
  { file: 'generate_신살현황표.js',      desc: '신살현황표' },
  { file: 'generate_용신체크리스트.js',  desc: '용신체크리스트' },
  // generate_십이운성개인표.js는 master.json 직접 계산 방식으로 run_all.js에서 별도 호출
  { file: 'generate_격국분석표.js',      desc: '격국분석표' },
  { file: 'generate_건강표.js',           desc: '건강표' },
  { file: 'generate_직업표.js',           desc: '직업표' },
  { file: 'generate_인테리어가이드.js',   desc: '인테리어가이드' },
  { file: 'generate_인간관계표.js',       desc: '인간관계표' },
  { file: 'generate_60갑자표.js',         desc: '60갑자표(개인화)' },

  // ── 신규 13종 ──
  { file: 'generate_천간비교표.js',       desc: '천간비교표' },
  { file: 'generate_지지비교표.js',       desc: '지지비교표' },
  { file: 'generate_오행신체연관표.js',   desc: '오행신체연관표' },
  { file: 'generate_오행인테리어비교표.js', desc: '오행인테리어비교표' },
  { file: 'generate_건강주의대운표.js',   desc: '건강주의대운표' },
  { file: 'generate_부재십성보완표.js',   desc: '부재십성보완표' },
  { file: 'generate_영역별종합표.js',     desc: '영역별종합표' },
  { file: 'generate_양생식품표.js',       desc: '양생식품표' },
  { file: 'generate_재물전략표.js',       desc: '재물전략표' },
  { file: 'generate_기질판단표.js',       desc: '기질판단표' },
  { file: 'generate_신강약대운전략표.js', desc: '신강약대운전략표' },
  { file: 'generate_신강약직업표.js',     desc: '신강약직업표' },
  { file: 'generate_교체기변화표.js',     desc: '교체기변화표' },
];

// ── 실행 ─────────────────────────────────────────────
function run(slotId) {
  const start = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  사주집필 전체 표 생성 》 ${slotId}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = [];
  let ok = 0, fail = 0;

  for (const { file, desc } of GENERATORS) {
    const scriptPath = path.join(SCRIPT_DIR, file);

    // 파일 존재 여부 체크
    if (!fs.existsSync(scriptPath)) {
      console.log(`  ⚠️  스킵: ${file} (파일 없음)`);
      results.push({ desc, status: 'skip', msg: '파일 없음' });
      continue;
    }

    try {
      const output = execSync(
        `node "${scriptPath}" "${slotId}"`,
        { cwd: SCRIPT_DIR, encoding: 'utf-8', timeout: 30000 }
      ).trim();
      console.log(`  ${output}`);
      results.push({ desc, status: 'ok' });
      ok++;
    } catch (err) {
      const msg = (err.stderr || err.message || '').split('\n')[0];
      console.log(`  ❌ ${desc}: ${msg}`);
      results.push({ desc, status: 'error', msg });
      fail++;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  완료: ✅ ${ok}개  ❌ ${fail}개  ⚠️  ${GENERATORS.length - ok - fail}개 스킵`);
  console.log(`  소요: ${elapsed}초`);
  console.log(`${'─'.repeat(60)}\n`);

  // 실패 항목 표시
  const failures = results.filter(r => r.status === 'error');
  if (failures.length) {
    console.log('❌ 실패 목록:');
    failures.forEach(f => console.log(`  - ${f.desc}: ${f.msg}`));
    console.log();
  }

  return fail === 0;
}

// ── 상품별 표 필터링 ──────────────────────────────────
const PRODUCT_TABLES = {
  yearly_fortune: ['cover','명식표','인적사항표','연간운세요약표'],
  compatibility: ['cover','명식표','인적사항표','사주기본표','인간관계표','오행점수표'],
  wealth_career: ['cover','명식표','인적사항표','사주기본표','오행점수표','4신요약표','격국분석표','대운로드맵','재물전략표','직업표','신강약직업표'],
  health: ['cover','명식표','인적사항표','사주기본표','오행점수표','오행균형표','건강표','건강주의대운표','양생식품표','오행신체연관표'],
  personality: ['cover','명식표','인적사항표','사주기본표','오행점수표','기질판단표','십성배치표','십성계열분류표'],
  saju_summary: ['cover','명식표','인적사항표','오행점수표','4신요약표','인간관계표'],
};

// ── 진입점 ───────────────────────────────────────────
const slotId = process.argv[2];
const productType = process.argv[3] || 'saju_full';
if (!slotId) {
  console.error('사용법: node generate_all.js <slot_id> [product_type]');
  process.exit(1);
}

// 상품별 표 필터: 총본은 전체, 나머지는 필요한 것만
let filteredGenerators = GENERATORS;
if (productType !== 'saju_full' && productType !== 'custom' && PRODUCT_TABLES[productType]) {
  const allowed = new Set(PRODUCT_TABLES[productType]);
  filteredGenerators = GENERATORS.filter(g => {
    const tableName = g.desc.replace(/\d+$/, '').trim();
    return allowed.has(tableName) || allowed.has(g.desc);
  });
  console.log(`  📦 상품(${productType}): ${filteredGenerators.length}개 표만 생성`);
}

// run 함수에 필터된 생성기 전달
function runFiltered(slotId, generators) {
  const start = Date.now();
  const results = [];
  let ok = 0, fail = 0;

  for (const { file, desc } of generators) {
    const scriptPath = path.join(SCRIPT_DIR, file);
    if (!fs.existsSync(scriptPath)) { continue; }
    try {
      const output = execSync(
        `node "${scriptPath}" "${slotId}"`,
        { cwd: SCRIPT_DIR, encoding: 'utf-8', timeout: 30000 }
      ).trim();
      if (output) console.log(`  ${output}`);
      results.push({ desc, status: 'ok' });
      ok++;
    } catch (e) {
      const msg = (e.stderr || e.message || '').split('\n')[0].substring(0, 100);
      results.push({ desc, status: 'fail', msg });
      fail++;
    }
  }

  console.log(`\n  완료: ✅ ${ok}개  ❌ ${fail}개  ⚠️  ${generators.length - ok - fail}개 스킵`);
  return fail === 0;
}

const success = runFiltered(slotId, filteredGenerators);
process.exit(success ? 0 : 1);
