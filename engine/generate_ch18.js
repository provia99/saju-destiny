'use strict';
const fs   = require('fs');
const path = require('path');
const { 전체사주계산 } = require('./saju_calc');

const inputArg   = process.argv[2] || 'choi_wonsuk_master.json';
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, 'queue', inputArg);
const samplesDir = path.dirname(inputPath);
const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const 결과 = 전체사주계산({
  이름:M.이름, 음력입력:M.음력입력 ?? true, 윤달: M.윤달,
  년:M.생년, 월:M.생월, 일:M.생일, 시간: M.생시, 성별:M.성별 ?? '남',
  활동상태:M.활동상태, 결혼상태:M.결혼상태, 자녀:M.자녀,
  고민분야:M.고민분야, 형제유무:M.형제유무,
  부모상황:M.부모상황, 건강관심:M.건강관심, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

// ── 올해 간지 계산 ──
const 올해 = 2026;
const 천간순 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const 오행음  = {木:'목',火:'화',土:'토',金:'금',水:'수'};
const 지지순 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const 천간음  = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const 지지음  = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};

const 천간idx = ((올해 - 4) % 10 + 10) % 10;
const 지지idx = ((올해 - 4) % 12 + 12) % 12;
const 올해천간 = 천간순[천간idx];
const 올해지지 = 지지순[지지idx];
const 올해간지 = `${올해천간}${올해지지}(${천간음[올해천간]}${지지음[올해지지]})`;

// ── 용신 오행 매핑 ──
const 용신맵 = {
  '木': { 색상:'청색·녹색', 방위:'동쪽', 숫자:'3·8', 음식:'신맛·채소·새싹', 계절:'봄(1~3월)', 직업군:'교육·언론·출판·의료·환경' },
  '火': { 색상:'적색·자주색·주황색', 방위:'남쪽', 숫자:'2·7', 음식:'쓴맛·붉은 식품·홍삼', 계절:'여름(4~6월)', 직업군:'방송·광고·IT·예술·마케팅' },
  '土': { 색상:'황색·갈색·베이지', 방위:'중앙', 숫자:'5·10', 음식:'단맛·뿌리채소·곡물', 계절:'환절기(3·6·9·12월)', 직업군:'부동산·건설·식품·중재·농업' },
  '金': { 색상:'흰색·금색·은색', 방위:'서쪽', 숫자:'4·9', 음식:'매운맛·흰 식품·생강', 계절:'가을(7~9월)', 직업군:'금융·법률·군경·제조·공학' },
  '水': { 색상:'검정·파랑·남색', 방위:'북쪽', 숫자:'1·6', 음식:'짠맛·검은 식품·해산물', 계절:'겨울(10~12월)', 직업군:'무역·운수·연구·철학·심리' },
};

const 용신 = 결과.용신;
const 희신 = 결과.희신;
const 기신 = 결과.기신;
const 용신정보 = 용신맵[용신] || {};
const 희신정보 = 용신맵[희신] || {};

const appendix = {
  이름:        결과.이름,
  올해:        String(올해),
  올해간지,
  용신오행:    `${용신}(${{木:'목',火:'화',土:'토',金:'금',水:'수'}[용신]})`,
  희신오행:    `${희신}(${{木:'목',火:'화',土:'토',金:'금',水:'수'}[희신]})`,
  기신오행:    `${기신}(${{木:'목',火:'화',土:'토',金:'금',水:'수'}[기신]})`,
  용신색상:    용신정보.색상 || '',
  용신방위:    용신정보.방위 || '',
  용신숫자:    용신정보.숫자 || '',
  용신음식:    용신정보.음식 || '',
  용신계절:    용신정보.계절 || '',
  용신직업군:  용신정보.직업군 || '',
  희신색상:    희신정보.색상 || '',
  희신방위:    희신정보.방위 || '',
};

// ── 원국 4기둥 슬롯 ──
const 원국 = 결과.원국;
const f간지 = (천, 지) =>
  `${천}${지}(${천간음[천]||'?'}${지지음[지]||'?'})`;

const 년주표기 = f간지(원국.년주.천간, 원국.년주.지지);
const 월주표기 = f간지(원국.월주.천간, 원국.월주.지지);
const 일주표기 = f간지(원국.일주.천간, 원국.일주.지지);
const 시주표기 = f간지(원국.시주.천간, 원국.시주.지지);

// 십성 위치별 매핑
const 배치맵 = {};
결과.십성배치.forEach(x => { 배치맵[x.위치] = `${x.간지}(${x.십성명})`; });

const 년간표기 = 배치맵['년간'] || `${원국.년주.천간}`;
const 년지표기 = 배치맵['년지'] || `${원국.년주.지지}`;
const 월간표기 = 배치맵['월간'] || `${원국.월주.천간}`;
const 월지표기 = 배치맵['월지'] || `${원국.월주.지지}`;
const 일지표기 = 배치맵['일지'] || `${원국.일주.지지}`;
const 시간표기 = 배치맵['시간'] || `${원국.시주.천간}`;
const 시지표기 = 배치맵['시지'] || `${원국.시주.지지}`;
const 일간표기 = `${결과.일간}${결과.일간오행}(${천간음[결과.일간]||'?'}${오행음[결과.일간오행]||'?'})`;  // 戊土(무토) 형식

// 신강약 한 줄
const 신강약표기 = (function(r){if(!r)return'신약(身弱)';if(/강신약/.test(r))return'신약(身弱)';if(/약신강/.test(r))return'신강(身强)';if(/강신강/.test(r))return'신강(身强)';if(/약신약/.test(r))return'신약(身弱)';if(r.includes('('))return r;return r.includes('강')?'신강(身强)':'신약(身弱)';})(결과.신강약);

// ── 대운 로드맵 슬롯 (현재 포함 향후 4대운) ──
const 현재idx = 결과.대운목록.findIndex(d => d.간지 === 결과.현재대운.간지);
const 향후4 = 결과.대운목록.slice(현재idx, 현재idx + 4);
const 대운로드맵 = 향후4.map((d, i) => {
  const 표기 = `${d.천간}${d.지지}(${천간음[d.천간]}${지지음[d.지지]})`;
  const 태그 = i === 0 ? ' ← 현재' : '';
  return `${표기} 대운  ${d.시작나이}~${d.종료나이}세  (${d.시작년도}~${d.시작년도+9}년)${태그}`;
}).join('\n');

// ── 공망 슬롯 ──
const 공망obj = (결과.공망 && typeof 결과.공망 === 'object') ? 결과.공망 : {};
const 공망1 = 공망obj.공망1 || '';
const 공망2 = 공망obj.공망2 || '';
const 공망목록str = [공망1, 공망2].filter(Boolean).join('·') || '없음';
const 공망위치str = Array.isArray(공망obj.공망목록) ? 공망obj.공망목록.join('·') : '없음';

// ── 일간 슬롯 ──
const 일간 = 원국.일주?.천간 || '';

Object.assign(appendix, {
  // 원국 4기둥
  년주표기, 월주표기, 일주표기, 시주표기,
  년간표기, 년지표기, 월간표기, 월지표기,
  일지표기, 시간표기, 시지표기, 일간표기,
  신강약표기,
  // 일간
  일간,
  // 대운 로드맵
  대운로드맵,
  // 공망
  공망1, 공망2,
  공망목록: 공망목록str,
  공망위치: 공망위치str,
});

// 개인화 슬롯 추가
const 개인화키 = ['배우자','배우자호칭','활동명','활동상태','결혼상태','성별','나이대',
  '배우자와','배우자와의','배우자호칭와','배우자호칭와의'];
for (const k of 개인화키) {
  if (결과[k] !== undefined) appendix[k] = 결과[k];
}
if (M.id) appendix.id = M.id;



// ── 브랜드 슬롯 주입 ─────────────────────────────────────────
(function() {
  const _id = M.id || M.이름;
  const _ch00Path = path.join(samplesDir, _id + '_ch00.json');
  try {
    // 1순위: ch00.json
    const ch00data = JSON.parse(fs.readFileSync(_ch00Path, 'utf8'));
    const brandKeys = ['선생님이름','연구소명','서명문구','마무리인사',
                       '호칭조사','선생님이름이','연락처','홈페이지',
                       '카카오채널','브랜드색상','금색','master_id','발행연도','생시모름'];
    brandKeys.forEach(k => { if (ch00data[k] !== undefined) appendix[k] = ch00data[k]; });
  } catch(e) {
    // 2순위: M(master.json) 및 profile.json
    const masterId = M.master_id || 'banya';
    const brandPath = path.join(__dirname, 'brands', masterId, 'profile.json');
    let brand = {};
    try { brand = JSON.parse(fs.readFileSync(brandPath, 'utf8')); } catch(e2) {}
    const brandKeys = ['선생님이름','연구소명','서명문구','마무리인사','호칭조사','연락처','홈페이지','카카오채널','브랜드색상','금색','발행연도'];
    brandKeys.forEach(k => {
      appendix[k] = M[k] || brand[k] || appendix[k] || '';
    });
    appendix['선생님이름이'] = (appendix['선생님이름']||'반야선생') + (appendix['호칭조사']||'이');
    appendix['master_id'] = masterId;
  }
})();

const fileId  = M.id || 결과.이름;
const outPath = path.join(samplesDir, `${fileId}_ch18.json`);
fs.writeFileSync(outPath, JSON.stringify(appendix, null, 2), 'utf8');
console.log(`✅ appendix: ${Object.keys(appendix).length}필드 → samples/${path.basename(outPath)}`);
console.log(`  원국: ${년주표기}·${월주표기}·${일주표기}·${시주표기}`);
console.log(`  대운로드맵:\n${대운로드맵}`);
