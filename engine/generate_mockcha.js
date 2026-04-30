'use strict';
// ================================================================
// generate_mockcha.js 》 템플릿 파일 자동 목차 생성
// ================================================================
// 사용법 (CLI):
//   node generate_mockcha.js s12
//
// 사용법 (모듈):
//   const { generateMockcha } = require('./generate_mockcha');
//   const text = generateMockcha(M, __dirname);
//
// 출력: queue/{fileId}_mockcha_result.txt
// ================================================================

const fs   = require('fs');
const path = require('path');

// run_all.js 와 동일한 순서 (mockcha 제외)
const CHAPTERS = [
  'ch00',
  'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07',
  'ch08', 'ch09_jeon', 'ch09',
  'ch_kijil', 'ch10', 'ch11', 'ch14', 'ch15', 'ch16',
  'ch18', 'ch17',
];

// {{key}} 치환 + <<IF>>...<<ENDIF>> 조건 처리
function substitute(text, M) {
  // <<IF K=V>>...<<ENDIF>> 처리
  text = text.replace(/<<IF ([^>]+)>>(.*?)<<ENDIF>>/g, (_, condStr, content) => {
    const conds = condStr.trim().split(/\s+/);
    const pass = conds.every(cond => {
      const [k, v] = cond.split('=');
      return (M[k] !== undefined ? String(M[k]) : '') === v;
    });
    return pass ? content : '';
  });
  // {{key}} 치환
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const v = M[key];
    return (v !== undefined && v !== null) ? String(v) : '';
  });
}

/**
 * M        : run_all.js 에서 사용하는 전체 변수 객체 (master + 사주계산 결과 포함)
 * engineDir: engine 디렉토리 절대 경로
 */
function generateMockcha(M, engineDir) {
  engineDir = engineDir || __dirname;

  const lines = [];
  lines.push('☯    목        차    ☯');
  lines.push('');

  // ── 표지 항목 ──────────────────────────────────────────────
  const 이름 = M.이름   || '';
  const 일주 = M.일주   || '';
  const 올해 = M.올해   || M.발행연도 || '2026';

  // ── 장별 목차 ──────────────────────────────────────────────
  for (const ch of CHAPTERS) {
    // brands 커스텀 템플릿 우선 탐색
    const brandDir = M.master_id
      ? path.join(engineDir, 'brands', M.master_id, 'templates')
      : null;
    const tmplPath =
      (brandDir && fs.existsSync(path.join(brandDir, `${ch}_template.txt`)))
        ? path.join(brandDir, `${ch}_template.txt`)
        : fs.existsSync(path.join(engineDir, `${ch}_template.txt`))
          ? path.join(engineDir, `${ch}_template.txt`)
          : null;

    if (!tmplPath) continue;  // ch18 등 template 없는 경우 스킵

    const rawLines = fs.readFileSync(tmplPath, 'utf8').split('\n');

    // ☯ 장 제목
    const chLine = rawLines.find(l => l.trimStart().startsWith('☯'));
    if (!chLine) continue;

    const chTitle = substitute(
      chLine.trim()
        .replace(/^☯\s*/, '')
        .replace(/\s*☯\s*$/, '')
        .trim(),
      M
    );

    lines.push(`✦ ${chTitle}`);

    // ✺ 절 제목 》 N-M절 소절 제외
    const secLines = rawLines.filter(l => {
      const t = l.trim();
      return t.startsWith('✺') && !/제\d+-\d+절/.test(t);
    });

    for (const sl of secLines) {
      const sec = substitute(
        sl.trim()
          .replace(/^✺\s*/, '')           // ✺ 제거
          .replace(/^제(\d+절\.)/, '$1')  // "제N절." → "N절."
          .trim(),
        M
      );
      if (sec) lines.push(`- ${sec}`);
    }

    lines.push('');
  }

  lines.push('');

  return lines.join('\n');
}

module.exports = { generateMockcha };

// ── CLI 직접 실행 ───────────────────────────────────────────────
// run_all.js 1단계에서 호출 시: node generate_mockcha.js <json전체경로>
// 직접 실행 시:                  node generate_mockcha.js s12
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('사용법: node generate_mockcha.js <json경로 또는 fileId>');
    console.error('예시:  node generate_mockcha.js s12');
    console.error('예시:  node generate_mockcha.js queue/s12_master_preprocessed.json');
    process.exit(1);
  }

  const engineDir  = __dirname;
  const samplesDir = path.join(engineDir, 'queue');

  // JSON 전체 경로로 전달된 경우 (run_all.js 1단계 호출)
  // fileId로 전달된 경우 (직접 실행)
  let jsonPath;
  if (arg.endsWith('.json') && fs.existsSync(arg)) {
    jsonPath = arg;
  } else if (arg.endsWith('.json') && fs.existsSync(path.join(samplesDir, arg))) {
    jsonPath = path.join(samplesDir, arg);
  } else {
    // fileId로 처리
    const prepPath   = path.join(samplesDir, `${arg}_master_preprocessed.json`);
    const masterPath = path.join(samplesDir, `${arg}_master.json`);
    jsonPath = fs.existsSync(prepPath) ? prepPath : masterPath;
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON 없음: ${jsonPath}`);
    process.exit(1);
  }

  const M      = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const fileId = M.id || M.이름 || path.basename(jsonPath).replace(/_master.*\.json$/, '');
  const text   = generateMockcha(M, engineDir);

  const outPath = path.join(samplesDir, `${fileId}_mockcha_result.txt`);
  fs.writeFileSync(outPath, text, 'utf8');
  console.log(`✅ 목차 생성: queue/${path.basename(outPath)}`);
}
