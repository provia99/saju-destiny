#!/usr/bin/env node
/**
 * generate_yearly.js — 신수풀이 독립 상품 생성기
 * 구조: 표지 → 올해 총운 → [달력 → 월운풀이] × 12 → 마무리
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 전체사주계산, 월운목록계산, 십이운성계산, 천간오행, 지지오행 } = require('../../saju_calc');
const { 총운생성, 월운풀이생성 } = require('../../month_fortune');

const inputArg = process.argv[2] || 'master.json';
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, 'queue', inputArg);
const samplesDir = path.dirname(inputPath);
const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const 결과 = 전체사주계산({
  이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
  년: M.생년, 월: M.생월, 일: M.생일,
  시간: M.생시, 성별: M.성별 ?? '남',
  활동상태: M.활동상태, 결혼상태: M.결혼상태, 자녀: M.자녀,
  고민분야: M.고민분야, 형제유무: M.형제유무, 부모상황: M.부모상황, 건강관심: M.건강관심, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

const 기준년도 = parseInt(M.발행연도) || new Date().getFullYear();
const 세운 = 결과.현재세운 || {};
const 월운원본 = 월운목록계산(기준년도, 세운.천간);
const 월운데이터 = 월운원본.map(m => ({ ...m, 운성명: 십이운성계산(결과.일간, m.지지) || '' }));

// 월운 간이 (총운 분기별 전망용)
const 월운간이 = 월운데이터.map(m => {
  const to = 천간오행[m.천간], jo = 지지오행[m.지지];
  let 성격 = '중립월';
  if (to===결과.용신||jo===결과.용신) 성격='용신월';
  else if (to===결과.희신||jo===결과.희신) 성격='희신월';
  else if (to===결과.기신||jo===결과.기신) 성격='기신월';
  return { 월:m.월, 성격 };
});

// 총운 생성
const 총운텍스트 = 총운생성(결과, 기준년도, 월운간이);

// 월운 풀이 생성
const 풀이결과 = 월운풀이생성(결과, 월운데이터, 기준년도);

const oh = {木:'목',火:'화',土:'토',金:'금',水:'수'};
const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const 지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};

// 슬롯 생성
const slots = {
  이름: 결과.이름,
  올해: String(기준년도),
  내년: String(기준년도 + 1),

  // 기본 정보
  일간: 결과.일간,
  일간한글: 결과.일간한글,
  용신: 결과.용신,
  희신: 결과.희신,
  기신: 결과.기신,
  용신한글: oh[결과.용신] || '',
  기신한글: oh[결과.기신] || '',
  신강약: 결과.신강약 || '',

  // 세운
  세운간지: `${세운.천간||''}${세운.지지||''}(${천간음[세운.천간]||''}${지지음[세운.지지]||''})`,
  현재대운간지: `${결과.현재대운?.천간||''}${결과.현재대운?.지지||''}`,
  현재대운나이범위: 결과.현재대운?.나이범위 || '',

  // 총운 + 월운풀이
  올해총운: 총운텍스트,
  월별운세풀이: 풀이결과.map(p => p.풀이).join('\n\n\n'),

  // 개별 월 슬롯
  ...Object.fromEntries(풀이결과.map(p => [`월운풀이_${p.월}월`, p.풀이])),

  // 좋은달/조심달
  올해좋은달: 풀이결과.filter(p => p.성격==='용신월').map(p => p.월+'월').join(', ') || '없음',
  올해조심달: 풀이결과.filter(p => p.성격==='기신월').map(p => p.월+'월').join(', ') || '없음',

  // 브랜드 슬롯
  선생님이름: M.선생님이름 || '반야선생',
  연구소명: M.연구소명 || '',
  서명문구: M.서명문구 || '',
  마무리인사: M.마무리인사 || '',
  호칭조사: M.호칭조사 || '이',
  발행연도: String(기준년도),
  product_type: 'yearly_fortune',
};

const _fileId = M.id || M.이름;
const outPath = path.join(samplesDir, `${_fileId}_yearly.json`);
fs.writeFileSync(outPath, JSON.stringify(slots, null, 2), 'utf8');
console.log(`✅ 신수풀이: ${Object.keys(slots).length}필드 → ${path.basename(outPath)}`);
console.log(`  총운 ${총운텍스트.length}자 + 월운 ${slots.월별운세풀이.length}자`);
