'use strict';
const fs   = require('fs');
const path = require('path');
const { 전체사주계산 } = require('../../saju_calc');

const inputArg   = process.argv[2] || 'choi_wonsuk_master.json';
const _queueDir  = path.join(__dirname, '../../queue');
const inputPath  = path.isAbsolute(inputArg) ? inputArg : path.join(_queueDir, inputArg);
const samplesDir = path.dirname(inputPath);
const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const 결과 = 전체사주계산({
  이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
  년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시, 성별: M.성별 ?? '남',
  활동상태: M.활동상태, 결혼상태: M.결혼상태, 자녀: M.자녀,
  고민분야: M.고민분야, 형제유무: M.형제유무,
  부모상황: M.부모상황, 건강관심: M.건강관심, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

const 오행음   = { 木:'목', 火:'화', 土:'토', 金:'금', 水:'수' };
const 오행색상 = { 木:'그린·에메랄드·올리브', 火:'레드·코랄·오렌지', 土:'베이지·황토·테라코타', 金:'화이트·실버·골드', 水:'네이비·차콜·딥블루' };
const 오행방위 = { 木:'동쪽(東)', 火:'남쪽(南)', 土:'중앙', 金:'서쪽(西)', 水:'북쪽(北)' };

const 용신 = 결과.용신 || '';
const 희신 = 결과.희신 || '';

const 기신 = (결과.기신 || '').trim();
const 구신 = (결과.구신 || '').trim();
const 한신 = (결과.한신 || '').trim();

const ch = {
  이름:       결과.이름,
  용신오행:   용신 ? `${용신}(${오행음[용신]})` : '',
  용신오행키: 용신,
  희신오행:   희신 ? `${희신}(${오행음[희신]})` : '',
  희신오행키: 희신,
  기신오행:   기신 ? `${기신}(${오행음[기신]})` : '',
  기신오행키: 기신,
  구신오행:   구신 ? `${구신}(${오행음[구신]})` : '',
  구신오행키: 구신,
  한신오행:   한신 ? `${한신}(${오행음[한신]})` : '',
  한신오행키: 한신,
  용신색상:   오행색상[용신] || '',
  희신색상:   오행색상[희신] || '',
  기신색상:   오행색상[기신] || '',
  용신방위:   오행방위[용신] || '',
  희신방위:   오행방위[희신] || '',
  기신방위:   오행방위[기신] || '',
  일간한자:   결과.원국?.일주?.천간 || '',
  일간:       결과.원국 ? `${결과.원국.일주.천간}(${({甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'})[결과.원국.일주.천간]||''})` : '',
};

// 개인화 슬롯
for (const k of ['활동상태','활동명','성별','선생님이름','연구소명','호칭조사','나이대','신강약']) {
  if (결과[k] !== undefined) ch[k] = 결과[k];
}

// 브랜드 슬롯
const _id = M.id || M.이름;
const _ch00Path = path.join(samplesDir, _id + '_ch00.json');
try {
  const ch00data = JSON.parse(fs.readFileSync(_ch00Path, 'utf8'));
  ['선생님이름','연구소명','서명문구','마무리인사','호칭조사','선생님이름이'].forEach(k => { if (ch00data[k]) ch[k] = ch00data[k]; });
} catch(e) {
  const masterId = M.master_id || 'banya';
  const brandPath = path.join(__dirname, 'brands', masterId, 'profile.json');
  let brand = {};
  try { brand = JSON.parse(fs.readFileSync(brandPath, 'utf8')); } catch(e2) {}
  ['선생님이름','연구소명','호칭조사'].forEach(k => { ch[k] = M[k] || brand[k] || ch[k] || ''; });
  ch['선생님이름이'] = (ch['선생님이름']||'반야선생') + (ch['호칭조사']||'이');
}

if (M.id) ch.id = M.id;

const fileId  = M.id || 결과.이름;
const outPath = path.join(samplesDir, `${fileId}_ch_interior.json`);
fs.writeFileSync(outPath, JSON.stringify(ch, null, 2), 'utf8');
console.log(`✅ ch_interior: ${Object.keys(ch).length}필드 → queue/${path.basename(outPath)}`);
