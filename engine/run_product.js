#!/usr/bin/env node
/**
 * run_product.js — 상품별 집필 라우터
 *
 * 사용법:
 *   node run_product.js <master.json 경로> [product_type]
 *   product_type은 master.json의 product_type 필드에서 자동 읽음
 *
 * 상품별 폴더 구조:
 *   engine/products/fullbook/  — 사주 총본
 *   engine/products/summary/   — 사주 요약본
 *   engine/products/yearly/    — 연간운세
 *   ...
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('사용법: node run_product.js <master.json 경로>');
  process.exit(1);
}

const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`❌ 파일 없음: ${inputPath}`);
  process.exit(1);
}

const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const productType = M.product_type || 'saju_full';

console.log(`\n📦 상품: ${productType} | 이름: ${M.이름}`);
console.log(`${'═'.repeat(50)}\n`);

// 상품별 실행 경로 매핑
const PRODUCT_RUNNERS = {
  saju_full:      { dir: '.', script: 'run_all.js' },       // 기존 engine/ 루트
  saju_summary:   { dir: 'products/summary', script: 'run_summary.js' },  // 독립 실행
  yearly_fortune: { dir: 'products/yearly', script: 'run_yearly.js' },
  wealth_career:  { dir: '.', script: 'run_all.js' },
  health:         { dir: '.', script: 'run_all.js' },
  personality:    { dir: '.', script: 'run_all.js' },
  compatibility:  { dir: 'products/compatibility', script: 'run_compatibility.js' },
  custom:         { dir: '.', script: 'run_all.js' },
};

const runner = PRODUCT_RUNNERS[productType];
if (!runner) {
  console.error(`❌ 알 수 없는 상품: ${productType}`);
  process.exit(1);
}

const runnerDir = path.join(__dirname, runner.dir);
const runnerScript = path.join(runnerDir, runner.script);

if (!fs.existsSync(runnerScript)) {
  console.error(`❌ 실행 스크립트 없음: ${runnerScript}`);
  process.exit(1);
}

// node 경로
const NODE_DIR = 'C:\\Program Files\\nodejs';
const NODE_CMD = fs.existsSync(path.join(NODE_DIR, 'node.exe'))
  ? path.join(NODE_DIR, 'node.exe')
  : 'node';

try {
  execSync(`"${NODE_CMD}" "${runnerScript}" "${inputPath}"`, {
    cwd: runnerDir,
    stdio: 'inherit',
    timeout: 600000,
  });
} catch(e) {
  process.exit(e.status || 1);
}
