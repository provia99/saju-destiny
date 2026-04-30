/**
 * test_relationship.js — 인간관계도 calc 검증
 *
 * 사용: node test_relationship.js
 *
 * 정종욱(주인공)을 중심으로 7명의 다양한 관계 시뮬레이션
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 관계도분석, RELATION_WEIGHTS } = require('./relationship_calc');

const QUEUE_DIR = path.join(__dirname, '..', '..', 'queue', 'sample');

function loadMaster(memberFolder) {
  const p = path.join(QUEUE_DIR, memberFolder, 'saju', '2026', 'master.json');
  if (!fs.existsSync(p)) {
    console.error(`❌ master.json 없음: ${p}`);
    return null;
  }
  const m = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return {
    이름: m.이름, 성별: m.성별,
    년: m.생년, 월: m.생월, 일: m.생일,
    시간: m.생시 || '모름',
    음력입력: !!m.음력입력, 윤달: !!m.윤달,
  };
}

// ── 시나리오: 정종욱(주인공) + 6명 ────────────────────────
const me = loadMaster('정종욱_88083038');
if (!me) process.exit(1);

const persons = [
  { ...loadMaster('최규철_20003251'), relationType: '직장동료',  displayName: '최규철 (직장동료)' },
  { ...loadMaster('임효원_86155836'), relationType: '부부',     displayName: '임효원 (배우자)' },
  { ...loadMaster('김나은_86150007'), relationType: '친구',     displayName: '김나은 (친구)' },
  { ...loadMaster('정래호_86150006'), relationType: '형제자매', displayName: '정래호 (형제)' },
  { ...loadMaster('윤님_86150008'),    relationType: '직장상사', displayName: '윤님 (상사)' },
  { ...loadMaster('아라_20000001'),    relationType: '제자',     displayName: '아라 (제자)' },
];

const valid = persons.filter(p => p.이름);
console.log(`\n${'═'.repeat(70)}`);
console.log(`  💑 인간관계도 분석 — ${me.이름}님 중심 (${valid.length}명)`);
console.log(`${'═'.repeat(70)}\n`);

const results = 관계도분석(me, valid);

// 결과 출력
results.forEach((r, i) => {
  console.log(`\n[${i+1}/${results.length}] ${r.displayName}`);
  console.log('  ' + '─'.repeat(60));
  console.log(`  본인  : ${r.me.이름} ${r.me.일주} · ${r.me.신강약} · 용신 ${r.me.용신}`);
  console.log(`  상대  : ${r.other.이름} ${r.other.일주} · ${r.other.신강약} · 용신 ${r.other.용신}`);
  console.log(`  관계  : ${r.relationType} | 본인 기준 상대 = ${r.상대역할 || '—'}`);
  console.log(`  점수  : ${r.totalScore} → ${r.label}`);

  // 축별 점수
  const axisStr = Object.entries(r.scores)
    .map(([k, v]) => `${k}:${Math.round(v)}`)
    .join(' · ');
  console.log(`  축    : ${axisStr}`);

  // 패턴
  if (r.patterns.length > 0) {
    console.log(`  패턴 (${r.patterns.length}건):`);
    for (const p of r.patterns) {
      console.log(`    ${p.label}`);
      console.log(`       └ ${p.message}`);
    }
  }
});

// 요약 표
console.log(`\n\n${'═'.repeat(70)}`);
console.log(`  📊 종합 요약 (점수 내림차순)`);
console.log(`${'═'.repeat(70)}`);
console.log(`  ${'관계'.padEnd(20)} ${'점수'.padStart(5)}  ${'라벨'.padEnd(10)}  주요 패턴`);
console.log(`  ${'─'.repeat(68)}`);
for (const r of results) {
  const patternsStr = r.patterns.length > 0
    ? r.patterns.map(p => p.label.replace(/^\S+\s/, '')).slice(0, 2).join(', ')
    : '-';
  console.log(`  ${r.displayName.padEnd(20)} ${String(r.totalScore).padStart(4)}점  ${r.label.padEnd(10)}  ${patternsStr}`);
}
console.log();
