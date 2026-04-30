#!/usr/bin/env node
/**
 * render_ch_summary.js — 사주 요약본 렌더링 (v2)
 * ch_summary_template.txt + ch_summary_db.js + slots JSON → result text
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const inputArg  = process.argv[2] || 'master.json';
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, 'queue', inputArg);
const samplesDir = path.dirname(inputPath);

// 슬롯 JSON 로드
const jsonPath = inputPath;
if (!fs.existsSync(jsonPath)) {
  console.error(`  ❌ ${jsonPath} 없음`);
  process.exit(1);
}
const slots = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// DB 로드
const { DB_SUMMARY } = require('./ch_summary_db');

// 템플릿 로드
const templatePath = path.join(__dirname, 'ch_summary_template.txt');
let template = fs.readFileSync(templatePath, 'utf8');

// [[SUMMARY.키]] 치환
template = template.replace(/\[\[SUMMARY\.([^\]]+)\]\]/g, (m, key) => {
  return DB_SUMMARY[key] || `[SUMMARY없음: ${key}]`;
});

// [[TABLE:xxx]] 태그는 그대로 유지 (후처리에서 HTML로 교체)

// {{슬롯}} 치환 (여러 패스 — 중첩 슬롯 대응)
for (let pass = 0; pass < 3; pass++) {
  template = template.replace(/\{\{([^}]+)\}\}/g, (m, key) => {
    return slots[key] !== undefined ? slots[key] : m;
  });
}

// 저장
const outPath = inputPath.replace('.json', '_result.txt');
fs.writeFileSync(outPath, template, 'utf8');
console.log(`  render_ch_summary.js ... ✅ 렌더링 완료: ${path.relative(__dirname, outPath)}`);
