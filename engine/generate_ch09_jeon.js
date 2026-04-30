'use strict';
const fs = require('fs'), path = require('path');
const inputArg = process.argv[2] || '';
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, 'queue', inputArg);
const samplesDir = path.dirname(inputPath);
const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const fileId = M.id || M.이름;
const outPath = path.join(samplesDir, fileId + '_ch09_jeon.json');

// ch08 데이터 가져오기 (슬롯 폴더 우선 탐색)
try {
  const _paths = [
    path.join(samplesDir, fileId+'_ch08.json'),           // 슬롯 폴더 우선
    path.join(__dirname,'queue',fileId+'_ch08.json'),
    path.join(__dirname,'samples',fileId+'_ch08.json'),
  ];
  const _p = _paths.find(p => fs.existsSync(p));
  if (_p) {
    const _d = JSON.parse(fs.readFileSync(_p,'utf8'));
    ['대운목록_10기','대운교체년도','현재대운간지','현재대운성격',
     '다음대운간지','다음대운시작년도','다음대운시작나이','다음대운성격',
     '초년힘든대운목록','건강주의대운목록'].forEach(k => {
       if (_d[k]) M[k] = _d[k];
     });
    const _초년 = _d['초년힘든대운목록'] || '';
    M['초년대운구조설명'] = (!_초년 || _초년 === '없음')
      ? '초년 대운은 비교적 안정적인 구조였어요'
      : `초년대운이 힘든 구조였다면: ${_초년}`;
  }
} catch(e) {}


// 추가 슬롯 (슬롯 폴더 우선 탐색)
try {
  const _fileId2 = M.id || M.이름;
  const _paths2 = [
    path.join(samplesDir, _fileId2+'_ch08.json'),          // 슬롯 폴더 우선
    require('path').join(__dirname,'queue',_fileId2+'_ch08.json'),
    require('path').join(__dirname,'samples',_fileId2+'_ch08.json'),
  ];
  const _p2 = _paths2.find(p => require('fs').existsSync(p));
  if (_p2) {
    const _d2 = JSON.parse(require('fs').readFileSync(_p2,'utf8'));
    const _추가슬롯 = ['대운방향','대운시작나이','현재대운나이범위','현대운_주의의해',
      '현재대운전반성격','현재대운후반성격','현재대운전반시작','현재대운후반시작',
      '기신대운목록','용신직업군','건강주의대운목록'];
    _추가슬롯.forEach(k => { if (_d2[k]) M[k] = _d2[k]; });
  }
} catch(e2) {}


// 대운 관련 추가 슬롯
const _발행년 = parseInt(M.발행연도 || '2026');
M['나이대'] = M['나이대'] || (() => {
  const _age = _발행년 - (M.생년 || 1990);
  if(_age<20) return '10대'; if(_age<30) return '20대';
  if(_age<40) return '30대'; if(_age<50) return '40대';
  if(_age<60) return '50대'; if(_age<70) return '60대'; return '70대';
})();

// 올해/내년 슬롯 보완
if (!M['올해']) M['올해'] = M['기준해'] || String(_발행년);
if (!M['내년']) M['내년'] = M['기준년'] || String(_발행년 + 1);

fs.writeFileSync(outPath, JSON.stringify(M, null, 2), 'utf8');
console.log('✅ ch09_jeon: ' + Object.keys(M).length + '필드 → ' + outPath);
