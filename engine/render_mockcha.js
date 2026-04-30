'use strict';
// ================================================================
// render_mockcha.js 》 목차(Table of Contents) 렌더링
// 입력: queue/{fileId}_mockcha.json
// 출력: queue/{fileId}_mockcha_result.txt
// ================================================================
const fs   = require('fs');
const path = require('path');

function main() {
  const jsonArg    = process.argv[2] || 'choi_sukwon_mockcha.json';
  
  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(__dirname, 'queue', jsonArg);
const samplesDir = path.dirname(jsonPath);

  if (!fs.existsSync(jsonPath)) {
    console.error(`파일 없음: ${jsonPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const id   = data.메타.id || data.메타.이름;
  
  let text = '☯    목        차    ☯\n\n'; 

  data.목차.forEach(item => {
    // 0장은 표지용이므로 목차 리스트에서는 제외
    if (item.장구분 === 'front') return;
    
    // 장 제목 (원래의 ☯ 기호 유지)
    text += `✦ ${item.장제목.replace(/☯/g, '').trim()}\n`;
    if (item.부제목) {
        text += `• ${item.부제목}\n`;
    }
    
    // 절 목록
    if (item.절목록 && item.절목록.length > 0) {
        item.절목록.forEach(section => {
            text += `    - ${section}\n`;
        });
    }
    text += '\n';
  });

  text += '\n';

  const outPath = path.join(samplesDir, `${id}_mockcha_result.txt`);
  fs.writeFileSync(outPath, text, 'utf8');
  console.log(`✅ 목차 렌더링 완료: queue/${path.basename(outPath)}`);
}

main();
