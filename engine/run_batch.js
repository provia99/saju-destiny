'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const batchDir = path.join(__dirname, 'queue/batch_100');
const outDir  = path.join(__dirname, 'queue/batch_output');
fs.mkdirSync(outDir, { recursive: true });

const masters = fs.readdirSync(batchDir)
  .filter(f => f.endsWith('_master.json'))
  .sort();

console.log(`\n🚀 배치 집필 시작 》 ${masters.length}명\n`);

let ok = 0, fail = 0, totalChars = 0;
const errors = [];
const startTime = Date.now();

for (let i = 0; i < masters.length; i++) {
  const masterFile = path.join(batchDir, masters[i]);
  const M = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
  const id = M.id;

  try {
    execSync(`node run_all.js "${masterFile}"`, {
      cwd: __dirname,
      timeout: 60000,
      stdio: 'pipe'
    });

    // 결과 파일 이동
    const resultSrc = path.join(__dirname, 'queue', `${id}_all_result.txt`);
    const resultDst = path.join(outDir, `${id}_result.txt`);
    if (fs.existsSync(resultSrc)) {
      const content = fs.readFileSync(resultSrc, 'utf8');
      fs.writeFileSync(resultDst, content, 'utf8');

      // 슬롯 오류 체크
      const 미치환 = (content.match(/\{\{[^}]+\}\}/g) || []).length;
      const chars = [...content].length;
      totalChars += chars;

      const status = 미치환 === 0 ? '✅' : '⚠️';
      process.stdout.write(`${status} [${i+1}/100] ${M.이름}(${M.생년}) ${chars.toLocaleString()}자${미치환>0?` 슬롯${미치환}개`:''}\n`);
      ok++;
    } else {
      throw new Error('결과 파일 없음');
    }
  } catch(e) {
    fail++;
    errors.push(`${id}: ${e.message?.slice(0,60)}`);
    console.log(`❌ [${i+1}/100] ${M.이름}(${M.생년}) 실패`);
  }

  // 임시 파일 정리
  try {
    const tmpFiles = fs.readdirSync(path.join(__dirname, 'queue'))
      .filter(f => f.startsWith(id + '_ch') || f.startsWith(id + '_all'))
      .filter(f => !f.endsWith('_result.txt'));
    tmpFiles.forEach(f => fs.unlinkSync(path.join(__dirname, 'queue', f)));
  } catch(e) {}
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const avgChars = ok > 0 ? Math.round(totalChars / ok) : 0;

console.log(`\n${'='.repeat(50)}`);
console.log(`✅ 성공: ${ok}명 | ❌ 실패: ${fail}명`);
console.log(`평균 글자수: ${avgChars.toLocaleString()}자`);
console.log(`총 소요 시간: ${elapsed}초 (인당 ${(elapsed/100).toFixed(1)}초)`);
console.log(`출력 위치: queue/batch_output/`);
if (errors.length) {
  console.log('\n실패 목록:');
  errors.forEach(e => console.log(`  ${e}`));
}
