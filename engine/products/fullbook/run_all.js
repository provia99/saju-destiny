#!/usr/bin/env node
// ================================================================
// run_all.js 》 사주 개인화 책 일괄 생성 스크립트
//
// 사용법:
//   node run_all.js choi_wonsuk_master.json
//   node run_all.js queue/choi_wonsuk_master.json
//   node run_all.js  (기본값: queue/choi_wonsuk_master.json)
//
// 실행 순서:
//   1단계: generate_chXX.js  (master.json → chXX.json)
//   2단계: render_chXX.js    (chXX.json  → chXX_result.txt)
//   3단계: 전체 결과 합본     (all_result.txt)
// ================================================================
'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── 4개 개선 모듈 ───────────────────────────────────────────
const { validateSlots }      = require('../../slot_validator');
// saju_engine 제거 — saju_calc만 사용
const { injectGenderHaeseok }= require('../../ch05_gender');
const { merge월운슬롯 }      = require('../../wolun_calc');
const { generateMockcha }    = require('../../generate_mockcha');

// node 절대 경로 (PATH 미등록 환경 대응)
const NODE_DIR = 'C:\\Program Files\\nodejs';
const NODE_CMD = fs.existsSync(path.join(NODE_DIR, 'node.exe'))
  ? path.join(NODE_DIR, 'node.exe')
  : 'node';

// ── 설정 ──────────────────────────────────────────────────
const inputArg   = process.argv[2] || 'choi_wonsuk_master.json';
const samplesDir = path.join(__dirname, '../../queue');

// ── 지능형 경로 처리 ───────────────────────────────────────
// 지원 형식:
//   node run_all.js queue/saju_홍길동_01012345678/master.json  (풀 경로)
//   node run_all.js queue/saju_홍길동_01012345678/             (폴더 → master.json 자동)
//   node run_all.js saju_홍길동_01012345678                    (queue/ 자동 prefix)
//   node run_all.js sample_406_master.json                     (레거시 flat 방식)
function resolveInputPath(arg) {
  // 절대경로
  if (path.isAbsolute(arg)) {
    const abs = arg;
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      return path.join(abs, 'master.json');
    }
    return abs;
  }
  // queue/ 또는 queue\ 로 시작하는 상대경로
  if (arg.startsWith('queue/') || arg.startsWith('queue\\')) {
    const p = path.join(__dirname, arg);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return path.join(p, 'master.json');
    return p;
  }
  // .json 없이 폴더명만 (예: saju_홍길동_01012345678)
  if (!arg.endsWith('.json')) {
    const folderPath = path.join(samplesDir, arg);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      return path.join(folderPath, 'master.json');
    }
  }
  // 기본: queue/{arg}
  return path.join(samplesDir, arg);
}

const inputPath = resolveInputPath(inputArg);

if (!fs.existsSync(inputPath)) {
  console.error(`\n❌ master.json을 찾을 수 없습니다: ${inputPath}`);
  console.error(`   예) node run_all.js queue/saju_홍길동_01012345678/master.json`);
  console.error(`   또는 node run_all.js saju_홍길동_01012345678\n`);
  process.exit(1);
}

const M      = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const fileId = M.id || M.이름;

// ── 슬롯 폴더 자동 생성 ──────────────────────────────────────────
// flat queue 모드이면 항상 saju_{이름}_{suffix}/ 폴더를 자동 생성
// suffix 우선순위: 전화번호 마지막 8자리 > master_id
(function autoMigrateToSlotFolder() {
  const inputDir = path.resolve(path.dirname(inputPath));
  const isAlreadySlot = inputDir !== path.resolve(samplesDir);
  if (isAlreadySlot) return;  // 이미 슬롯 폴더 안에 있으면 skip

  if (!M.이름) return;  // 이름 없으면 skip (레거시 파일)

  // 폴더명 suffix 결정: 전화번호 있으면 마지막 8자리, 없으면 master_id
  const 전화번호 = (M.전화번호 || '').replace(/[^0-9]/g, '');
  let suffix;
  if (전화번호.length >= 4) {
    suffix = 전화번호.slice(-8);                         // 전화번호 기반
  } else {
    // M.id = "sample_419" → master_id = "sample" (book_id 제외)
    const idParts = (M.id || '').split('_');
    suffix = idParts.length > 1 ? idParts.slice(0, -1).join('_') : (M.id || 'unknown');
  }

  // 브랜드/개인/상품/연도 4단계 폴더 구조
  const brand = M.master_id || 'unknown';
  const personFolder = `${M.이름}_${suffix}`;
  const bookYear = M.발행연도 || new Date().getFullYear();
  const slotFolderPath = path.join(samplesDir, brand, personFolder, 'saju', String(bookYear));

  if (!fs.existsSync(slotFolderPath)) {
    fs.mkdirSync(slotFolderPath, { recursive: true });
    console.log(`  📁 슬롯 폴더 자동 생성: queue/${brand}/${personFolder}/saju/${bookYear}/`);
  }

  // master.json을 슬롯 폴더로 복사 (원본은 유지 》 레거시 호환)
  const slotMasterPath = path.join(slotFolderPath, 'master.json');
  fs.copyFileSync(inputPath, slotMasterPath);

  const slotRelative = path.join('queue', brand, personFolder, 'saju', String(bookYear), 'master.json');
  console.log(`  📋 master.json → ${slotRelative} 복사`);
  console.log(`  ℹ️  다음 실행부터는: node run_all.js ${slotRelative}\n`);

  // 현재 프로세스를 슬롯 경로로 재실행
  const { execFileSync } = require('child_process');
  try {
    execFileSync(process.execPath, [__filename, slotRelative], {
      cwd: __dirname,
      stdio: 'inherit',
      timeout: 600000,
    });
    process.exit(0);
  } catch(e) {
    process.exit(e.status || 1);
  }
})();

// ── 슬롯 폴더 모드 감지 ─────────────────────────────────────────
// master.json이 queue/{폴더}/master.json 형태로 하위 폴더에 있으면
// 해당 폴더(slotDir)를 모든 출력 파일의 기준으로 사용한다.
const inputDir   = path.resolve(path.dirname(inputPath));
const isSlotMode = inputDir !== path.resolve(samplesDir);
const slotDir = isSlotMode ? inputDir : path.join(samplesDir, `slot_${fileId}_${Date.now()}`);

// 슬롯 모드 대응 가상 슬롯 ID (하위 테이블 생성기 및 txt_to_html 연동용)
const targetRelative = path.relative(path.resolve(samplesDir), slotDir);
const virtualSlotId = isSlotMode 
  ? path.join(targetRelative, fileId).replace(/\\/g, '/')
  : fileId;

// ── 슬롯 모드인 경우 작업 디렉토리(targetDir)를 슬롯 폴더로 강제 ──
const targetDir = isSlotMode ? slotDir : samplesDir;

if (isSlotMode) {
  console.log(`  📁 슬롯 폴더 모드: ${path.relative(__dirname, slotDir) || slotDir}`);
}

// ── age-activity 유효성 검사 ─────────────────────────────────
(function validateAgeActivity() {
  const 발행년 = parseInt(M.발행연도||'2026');
  const age = 발행년 - (M.생년||0);
  const 활동 = M.활동상태||'';
  const 경고들 = [];

  // 나이-활동 비현실 조합 경고
  if (활동 === '은퇴' && age < 45) {
    경고들.push(`⚠️  [유효성] ${age}세 은퇴 》 일반적으로 45세 이상에서 사용. 실제 의미: 조기은퇴·무직 등 확인 필요`);
  }
  if (활동 === '학생' && age > 50) {
    경고들.push(`⚠️  [유효성] ${age}세 학생 》 50세 이상 학생. 대학원·평생교육 등인지 확인 필요`);
  }
  if (활동 === '학생' && age < 5) {
    경고들.push(`⚠️  [유효성] ${age}세 학생 》 너무 어림`);
  }
  if (M.결혼상태 === '기혼' && age < 18) {
    경고들.push(`⚠️  [유효성] ${age}세 기혼 》 미성년 기혼 입력 확인 필요`);
  }
  if (M.결혼상태 === '이혼' && age < 20) {
    경고들.push(`⚠️  [유효성] ${age}세 이혼 》 확인 필요`);
  }
  if (M.결혼상태 === '사별' && age < 25) {
    경고들.push(`⚠️  [유효성] ${age}세 사별 》 확인 필요`);
  }
  if (활동 === '주부' && M.성별 === '남' && age < 30) {
    경고들.push(`⚠️  [유효성] ${age}세 남성 주부 》 입력 확인 필요`);
  }

  경고들.forEach(w => console.warn(w));
  if (경고들.length > 0) {
    console.warn(`  → 집필은 계속됩니다. 내용이 부자연스러울 수 있으니 입력값을 확인하세요.\n`);
  }
})();

// ── 전처리 파이프라인 (4개 모듈 순차 적용) ─────────────────
// 0) saju_calc으로 오행점수·일간·월주 등 기본 슬롯 M에 보강
//    (engine이 정확한 계산을 하려면 이 슬롯들이 필요)
(function() {
  try {
    const { 전체사주계산, 오행점수계산, 오행등급 } = require('../../saju_calc');
    const 결과 = 전체사주계산({
      이름: M.이름, 음력입력: M.음력입력 ?? false, 윤달: M.윤달,
      년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시,
      성별: M.성별 ?? '남',
      활동상태: M.활동상태, 결혼상태: M.결혼상태, 자녀: M.자녀,
      고민분야: M.고민분야, 형제유무: M.형제유무,
      부모상황: M.부모상황, 건강관심: M.건강관심, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
    });
    // 오행점수 주입 (engine 신강약 계산에 필수)
    const 오행점수 = 오행점수계산(결과.원국);
    M.목점수 = 오행점수['木'] ?? 0;
    M.화점수 = 오행점수['火'] ?? 0;
    M.토점수 = 오행점수['土'] ?? 0;
    M.금점수 = 오행점수['金'] ?? 0;
    M.수점수 = 오행점수['水'] ?? 0;
    // 일간·월주 주입
    const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
    const 지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
    const _t = 결과.원국.일주.천간, _j = 결과.원국.일주.지지;
    const _mt = 결과.원국.월주.천간, _mj = 결과.원국.월주.지지;
    const _yt = 결과.원국.년주?.천간, _yj = 결과.원국.년주?.지지;
    const _st = 결과.원국.시주?.천간, _sj = 결과.원국.시주?.지지;
    M.일간 = M.일간 || `${_t}(${천간음[_t]})`;
    M.일주 = M.일주 || `${_t}${_j}(${천간음[_t]||'?'}${지지음[_j]||'?'})`;
    M.월주 = M.월주 || `${_mt}${_mj}(${천간음[_mt]}${지지음[_mj]})`;
    M.년주 = M.년주 || ((_yt && _yj) ? `${_yt}${_yj}(${천간음[_yt]||'?'}${지지음[_yj]||'?'})` : '');
    M.시주 = M.시주 || ((_st && _sj) ? `${_st}${_sj}(${천간음[_st]||'?'}${지지음[_sj]||'?'})` : '');
    // 신강약 주입 (없으면)
    if (!M.신강약단) {
      M.신강약 = 결과.신강약;
      if (결과.신강약.includes('중화형')) M.신강약단 = '중화형신강';
      else if (결과.신강약.includes('신강')) M.신강약단 = '신강';
      else M.신강약단 = '신약';
    }
    // 용신 주입 (없으면)
    if (!M.용신오행) {
      const 오행한글 = {木:'목',火:'화',土:'토',金:'금',水:'수'};
      const _용신 = (결과.용신||'').trim();
      if (_용신) M.용신오행 = `${_용신}(${오행한글[_용신]||_용신})`;
    }
    // ── 신규 슬롯 주입 (종격·삼재·신살·대운반절) ──────────────
    // 종격/전왕격
    M.종격명         = 결과.종격명 || '';
    M.종격_여부      = 결과.종격명 ? 'Y' : 'N';
    M.종격근거       = 결과.종격근거 || '';
    // 화격(化格): 종격명이 '화'로 시작 여부 (화토격·화금격·화수격·화목격·화화격은 모두 '화'로 시작)
    M.화격_여부      = (결과.종격명 && 결과.종격명.startsWith('화')) ? 'Y' : 'N';
    // 삼재
    M.삼재_현재여부  = 결과.삼재_현재여부 ? 'Y' : 'N';
    M.삼재_현재구분  = 결과.삼재_현재구분 || '';   // '들삼재'|'눌삼재'|'날삼재'|''
    // 추가 신살
    const _ns = 결과.신살 || {};
    M.원진살_여부      = (_ns.원진살   && _ns.원진살.length   > 0) ? 'Y' : 'N';
    M.귀문관살_여부    = (_ns.귀문관살 && _ns.귀문관살.length > 0) ? 'Y' : 'N';
    M.고란살_여부      = (_ns.고란살   && _ns.고란살.length   > 0) ? 'Y' : 'N';
    M.음양차착살_여부  = (_ns.음양차착살 && _ns.음양차착살.length > 0) ? 'Y' : 'N';
    // 대운 반절
    const _hd = 결과.현재대운 || {};
    M.현재대운_반절구분 = _hd.반절구분 || '';   // '전반절'|'후반절'
    M.현재대운_반절설명 = _hd.반절설명 || '';
    // ── 교차합충 슬롯 주입 ──────────────────────────────────────
    // 대운 교차: 원국↔대운 충/합 여부
    const _cc = 결과.교차합충 || {};
    const _충목록 = _cc.지지충 || [];
    const _합목록 = [...(_cc.천간합||[]), ...(_cc.지지육합||[]), ...(_cc.지지삼합||[])];
    const _대운충목록 = _충목록.filter(c => (c.위치1||'').includes('대운') || (c.위치2||'').includes('대운'));
    const _대운합목록 = _합목록.filter(c => {
      const 위치들 = [c.위치1||'', c.위치2||'', ...(c.위치||[])];
      return 위치들.some(w => w.includes('대운'));
    });
    const _세운충목록 = _충목록.filter(c => (c.위치1||'').includes('세운') || (c.위치2||'').includes('세운'));
    const _세운합목록 = _합목록.filter(c => {
      const 위치들 = [c.위치1||'', c.위치2||'', ...(c.위치||[])];
      return 위치들.some(w => w.includes('세운'));
    });
    const _지지음맵 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
    const _천간음맵 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
    function _위치한글(w) {
      const 맵 = {년지:'년지(年支)',월지:'월지(月支)',일지:'일지(日支)',시지:'시지(時支)',년간:'년간(年干)',월간:'월간(月干)',일간:'일간(日干)',시간:'시간(時干)',대운지지:'대운지지',대운천간:'대운천간',세운지지:'세운지지',세운천간:'세운천간'};
      return 맵[w]||w;
    }
    function _충설명(c) {
      return `${c.지1}(${_지지음맵[c.지1]||c.지1}) ${_위치한글(c.위치1)} ↔ ${c.지2}(${_지지음맵[c.지2]||c.지2}) ${_위치한글(c.위치2)}`;
    }
    function _합설명(c) {
      if (c.지지) { // 삼합
        return `${c.지지.join('')} 삼합${c.완전합?'(완전)':'(부분)'}→${c.합화||''}`;
      }
      if (c.지1) { // 육합
        return `${c.지1}(${_지지음맵[c.지1]||c.지1}) ${_위치한글(c.위치1)} ↔ ${c.지2}(${_지지음맵[c.지2]||c.지2}) ${_위치한글(c.위치2)} 육합→${c.합화||''}`;
      }
      // 천간합
      return `${c.간1}(${_천간음맵[c.간1]||c.간1}) ${_위치한글(c.위치1)} ↔ ${c.간2}(${_천간음맵[c.간2]||c.간2}) ${_위치한글(c.위치2)} 합→${c.합화||''}`;
    }
    M.교차충_대운_여부   = _대운충목록.length > 0 ? 'Y' : 'N';
    M.교차충_대운_설명   = _대운충목록.map(_충설명).join(' / ') || '';
    M.교차합_대운_여부   = _대운합목록.length > 0 ? 'Y' : 'N';
    M.교차합_대운_설명   = _대운합목록.map(_합설명).join(' / ') || '';
    M.교차충_세운_여부   = _세운충목록.length > 0 ? 'Y' : 'N';
    M.교차충_세운_설명   = _세운충목록.map(_충설명).join(' / ') || '';
    M.교차합_세운_여부   = _세운합목록.length > 0 ? 'Y' : 'N';
    M.교차합_세운_설명   = _세운합목록.map(_합설명).join(' / ') || '';
    console.log(`  [전처리] 교차충(대운)=${M.교차충_대운_여부}/${M.교차충_대운_설명||'-'} 교차합(대운)=${M.교차합_대운_여부}/${M.교차합_대운_설명||'-'}`);
    console.log(`  [전처리] 교차충(세운)=${M.교차충_세운_여부}/${M.교차충_세운_설명||'-'} 교차합(세운)=${M.교차합_세운_여부}/${M.교차합_세운_설명||'-'}`);
    console.log(`  [전처리] 종격=${M.종격명||'없음'} 삼재=${M.삼재_현재여부}/${M.삼재_현재구분||'-'} 반절=${M.현재대운_반절구분||'-'}`);
    console.log(`  [전처리] saju_calc 보강: 오행점수 목${오행점수['木'].toFixed(1)} 화${오행점수['火'].toFixed(1)} 토${오행점수['土'].toFixed(1)} 금${오행점수['金'].toFixed(1)} 수${오행점수['水'].toFixed(1)}`);
    console.log(`  [전처리] 일간=${M.일간}, 월주=${M.월주}, 신강약단=${M.신강약단}`);
  } catch(e) {
    // 음력 날짜 유효성 오류 → 즉시 중단 (chapter 생성 시 일주 누락 방지)
    if (e.message && e.message.includes('음력 변환 오류')) {
      console.error(`\n❌ 음력 날짜 오류로 책 생성을 중단합니다.`);
      console.error(`   오류: ${e.message}`);
      console.error(`   입력값: 음력 ${M.생년}년 ${M.생월}월 ${M.생일}일 (윤달: ${M.윤달 ? '예' : '아니오'})`);
      console.error(`   입력값을 확인하고 다시 시도하세요.`);
      process.exit(1);
    }
    console.warn('  [전처리] saju_calc 보강 실패:', e.message);
  }
})();
// 1) 격국·용신·희신·기신: saju_calc 직접 계산 (saju_engine 제거)
(function() {
  try {
    const { 전체사주계산 } = require('../../saju_calc');
    const _r = 전체사주계산({이름:M.이름, 성별:M.성별??'남', 년:M.생년, 월:M.생월, 일:M.생일, 시간:M.생시||'모름', 음력입력:!!M.음력입력, 윤달:!!M.윤달
});
    const _oh = {木:'목',火:'화',土:'토',金:'금',水:'수'};
    if (_r.용신) { M.용신 = _r.용신; M.용신오행 = `${_r.용신}(${_oh[_r.용신]})`; }
    if (_r.희신) { M.희신 = _r.희신; M.희신오행 = `${_r.희신}(${_oh[_r.희신]})`; M.희신오행키 = _r.희신; }
    if (_r.기신) { M.기신 = _r.기신; M.기신오행 = `${_r.기신}(${_oh[_r.기신]})`; M.기신오행키 = _r.기신; }
    if (_r.억부용신) M.억부용신 = _r.억부용신;
    if (_r.格국명) M.격국명 = _r.格국명;
    if (_r.신강약) M.신강약 = _r.신강약;
    // 용신직업군
    const _직업맵 = {木:'교육·출판·유통·농림·환경',火:'요식업·엔터·마케팅·에너지',土:'부동산·건축·중개·보험',金:'금융·법률·기계·제조·군경',水:'무역·물류·IT·컨설팅'};
    if (!M.용신직업군 && _r.용신) M.용신직업군 = _직업맵[_r.용신] || '';
  } catch(e) { console.warn('  ⚠️ saju_calc 슬롯 주입 실패:', e.message); }
})();
// 2) 월운 자동 연산 (12개월 천간십성·운성·성격)
merge월운슬롯(M, false);
// 3) 성별 관성·재성 해석 텍스트 주입
injectGenderHaeseok(M);
// 4) 슬롯 검증 + 누락 기본값 채우기 (미처리 슬롯 차단)
const { warnings: _sw } = validateSlots(M, { verbose: false });
if (_sw.length > 0) console.log(`  [슬롯] 기본값 보완 ${_sw.length}건`);

// ── 전처리된 M을 임시 파일로 저장 (generate가 읽도록) ────
// generate_chXX.js는 별도 프로세스로 실행되므로
// validateSlots가 주입한 슬롯(_천을귀인설명 등)을 전달하려면
// 전처리된 M을 파일로 저장해야 함
const _preprocessedPath = isSlotMode
  ? path.join(slotDir, 'master_preprocessed.json')
  : inputPath.replace(/(\.json)$/, '_preprocessed.json');
fs.writeFileSync(_preprocessedPath, JSON.stringify(M, null, 2), 'utf8');
const _actualInputPath = _preprocessedPath;

// ── 챕터 목록 ────────────────────────────────────────────
// ch00: 표지·머리말 / ch17: 종장(epilogue) / ch18: 부록
// ── 상품별 챕터 구성 ─────────────────────────────────────
const ALL_CHAPTERS = [
  'ch00','ch01','ch02','ch03','ch04','ch05','ch06','ch_interior',
  'ch07','ch08','ch09_jeon','ch09','ch_kijil','ch10','ch11',
  'ch14','ch15','ch16','ch17','ch18','mockcha'
];

const PRODUCT_CHAPTERS = {
  saju_full: ALL_CHAPTERS, // 전체
  yearly_fortune: ['ch00','ch09','ch09_jeon','ch18','mockcha'],
  compatibility: ['ch00','ch02','ch15','ch18','mockcha'],
  wealth_career: ['ch00','ch04','ch06','ch08','ch11','ch18','mockcha'],
  health: ['ch00','ch04','ch10','ch18','mockcha'],
  personality: ['ch00','ch02','ch_kijil','ch05','ch18','mockcha'],
  saju_summary: ['ch_summary','mockcha'], // 요약본 전용 템플릿
  custom: ALL_CHAPTERS, // 커스텀은 전체 (추후 선택 기능)
};

const productType = M.product_type || 'saju_full';
const CHAPTERS = PRODUCT_CHAPTERS[productType] || ALL_CHAPTERS;
if (productType !== 'saju_full') {
  console.log(`  📦 상품: ${productType} (${CHAPTERS.length - 1}개 챕터)`);
}

// render가 없는 챕터 (현재 모든 챕터 render 파일 존재)
const NO_RENDER = new Set(['mockcha']);

// ── 유틸 ─────────────────────────────────────────────────
function run(cmd, label) {
  try {
    const out = execSync(cmd, { cwd: __dirname, encoding: 'utf8' });
    process.stdout.write(out.trim() ? out.trim() + '\n' : '');
  } catch (e) {
    console.error(`\n❌ 실패: ${label}`);
    console.error(e.stderr || e.message);
    process.exit(1);
  }
}

function sep(ch = '═', n = 60) { return ch.repeat(n); }

// ── 1단계: generate ──────────────────────────────────────
console.log(`\n${sep()}`);
console.log(`  사주 개인화 책 생성 시작`);
console.log(`  대상: ${M.이름} | 입력: ${path.basename(inputPath)}`);
console.log(`${sep()}\n`);

console.log(`[1단계] JSON 생성 (master.json → chXX.json)\n`);
for (const ch of CHAPTERS) {
  const gen = path.join(__dirname, `generate_${ch}.js`);
  const autoJsonPath = path.join(targetDir, `${fileId}_${ch}.json`);
  if (!fs.existsSync(gen)) {
    // generate 없는 챕터: 전처리된 M을 chXX.json으로 직접 저장
    if (!fs.existsSync(autoJsonPath)) {
      fs.writeFileSync(autoJsonPath, JSON.stringify(M, null, 2), 'utf8');
      console.log(`  ✅  generate_${ch}.js 없음 》 전처리 M으로 JSON 자동 생성`);
    } else {
      console.log(`  ⏭️  generate_${ch}.js 없음 》 기존 JSON 사용`);
    }
    continue;
  }
  process.stdout.write(`  generate_${ch}.js ... `);
  const fullActualPath = path.resolve(_actualInputPath);
  run(`"${NODE_CMD}" generate_${ch}.js "${fullActualPath}"`, `generate_${ch}`);
}

// ch17은 ch01~ch16 JSON을 통합하므로 가장 마지막에
// (이미 순서상 CHAPTERS 끝에 있으므로 별도 처리 불필요)

// ── 2단계: render ────────────────────────────────────────
console.log(`\n[2단계] 텍스트 렌더링 (chXX.json → chXX_result.txt)\n`);
for (const ch of CHAPTERS) {
  if (NO_RENDER.has(ch)) {
    console.log(`  ⏭️  render_${ch}.js 》 없음 (건너뜀)`);
    continue;
  }
  const ren = path.join(__dirname, `render_${ch}.js`);
  if (!fs.existsSync(ren)) {
    console.log(`  ⚠️  render_${ch}.js 없음 》 건너뜀`);
    continue;
  }
  const jsonFile = path.join(targetDir, `${fileId}_${ch}.json`);
  if (!fs.existsSync(jsonFile)) {
    console.log(`  ⚠️  ${fileId}_${ch}.json 없음 》 render 건너뜀`);
    continue;
  }
  
  // 지능형 템플릿 로직: 마스터 전용 템플릿이 있으면 우선 사용
  let tmplArg = "";
  if (M.master_id) {
    const customTmpl = path.join(__dirname, 'brands', M.master_id, 'templates', `${ch}_template.txt`);
    if (fs.existsSync(customTmpl)) {
      tmplArg = ` "${customTmpl}"`;
    }
  }

  process.stdout.write(`  render_${ch}.js ... `);
  const fullJsonPath = path.resolve(jsonFile);
  run(`"${NODE_CMD}" render_${ch}.js "${fullJsonPath}"${tmplArg}`, `render_${ch}`);
}

// ── 3단계: 합본 ──────────────────────────────────────────
console.log(`\n[3단계] 전체 합본 생성\n`);

// 목차 변수 보강: ch00/ch04/ch05/ch08.json에서 계산된 오행·십성·대운 정보를 M에 주입
(function _injectMockchaCh04Ch05() {
  const CH00_KEYS = ['나이대', '만나이', '인생단계'];
  const CH04_KEYS = ['최강오행','최약오행','최강오행한자','최약오행한자'];
  const CH05_KEYS = ['최다십성계열','최강십성명'];
  const CH08_KEYS = ['현재대운간지','다음대운시작년도','다음대운간지','올해','세운간지'];
  const ch00JsonPath = path.join(targetDir, `${fileId}_ch00.json`);
  const ch04JsonPath = path.join(targetDir, `${fileId}_ch04.json`);
  const ch05JsonPath = path.join(targetDir, `${fileId}_ch05.json`);
  const ch08JsonPath = path.join(targetDir, `${fileId}_ch08.json`);
  try {
    if (fs.existsSync(ch00JsonPath)) {
      const ch00 = JSON.parse(fs.readFileSync(ch00JsonPath, 'utf8'));
      CH00_KEYS.forEach(k => { if (ch00[k] !== undefined && M[k] === undefined) M[k] = ch00[k]; });
    }
    if (fs.existsSync(ch04JsonPath)) {
      const ch04 = JSON.parse(fs.readFileSync(ch04JsonPath, 'utf8'));
      CH04_KEYS.forEach(k => { if (ch04[k] !== undefined && M[k] === undefined) M[k] = ch04[k]; });
    }
    if (fs.existsSync(ch05JsonPath)) {
      const ch05 = JSON.parse(fs.readFileSync(ch05JsonPath, 'utf8'));
      CH05_KEYS.forEach(k => { if (ch05[k] !== undefined && M[k] === undefined) M[k] = ch05[k]; });
    }
    if (fs.existsSync(ch08JsonPath)) {
      const ch08 = JSON.parse(fs.readFileSync(ch08JsonPath, 'utf8'));
      CH08_KEYS.forEach(k => { if (ch08[k] !== undefined && M[k] === undefined) M[k] = ch08[k]; });
    }
  } catch(e) { /* 무시 */ }
})();

// 목차 자동 생성 (template 파일 기반)
// 슬롯 모드: 슬롯 폴더 안에 저장 / flat 모드: queue/ 루트에 저장
const autoMockPath = isSlotMode
  ? path.join(slotDir, 'mockcha_result.txt')
  : path.join(targetDir, `${fileId}_mockcha_result.txt`);
try {
  const mockText = generateMockcha(M, __dirname);
  fs.writeFileSync(autoMockPath, mockText, 'utf8');
  console.log(`  ✅  목차 자동 생성: ${isSlotMode ? path.relative(__dirname, autoMockPath) : 'queue/' + path.basename(autoMockPath)}`);
} catch (e) {
  console.warn(`  ⚠️  목차 자동 생성 실패: ${e.message}`);
}

const mockJsonPath = path.join(targetDir, `${fileId}_mockcha.json`);
let meta = { 이름: M.이름, 일주: '', 올해: '2026' };
if (fs.existsSync(mockJsonPath)) {
  const mockData = JSON.parse(fs.readFileSync(mockJsonPath, 'utf8'));
  meta.일주 = mockData.메타.일주 || '';
  meta.올해 = mockData.메타.올해 || '2026';
}
// generate_cover.js 등에서 읽을 수 있도록 master.json에 계산값 저장
// meta.일주가 없으면 saju_calc으로 직접 계산
if (!meta.일주 && M.생년) {
  try {
    const { 전체사주계산 } = require('../../saju_calc');
    const _cr = 전체사주계산({ 이름: M.이름, 성별: M.성별 ?? '남', 년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시 || '모름', 음력입력: !!M.음력입력, 윤달: !!M.윤달
});
    const _천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
    const _지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
    const _t = _cr.원국.일주.천간, _j = _cr.원국.일주.지지;
    meta.일주 = `${_t}${_j}(${_천간음[_t]}${_지지음[_j]})`;
  } catch(e) {}
}
if (meta.일주) {
  M._일주 = meta.일주;
  M._올해 = meta.올해;
  fs.writeFileSync(inputPath, JSON.stringify(M, null, 2), 'utf8');
}

// ── 표지 HTML 미리 생성 (all_result.txt 조립 전에 필요) ──
// 슬롯 모드면 virtualSlotId(슬롯 경로 포함)로 호출해야 generate_cover.js가 master.json을 찾음
try {
  const coverScript = path.join(__dirname, 'generate_cover.js');
  if (fs.existsSync(coverScript)) {
    const _coverArg = isSlotMode ? virtualSlotId : fileId;
    run(`"${NODE_CMD}" generate_cover.js "${_coverArg}"`, 'generate_cover');
  }
} catch(e) {
  console.warn('  ⚠️  표지 생성 실패:', e.message);
}

const parts = [];

// 1. 표지 (Title Page)
// 일주동물 계산 (일간 오행 → 색상, 일지 → 동물)
const 천간색상맵 = { 甲:'청색', 乙:'청색', 丙:'적색', 丁:'적색', 戊:'황색', 己:'황색', 庚:'백색', 辛:'백색', 壬:'흑색', 癸:'흑색' };
const 지지동물맵 = { 子:'쥐', 丑:'소', 寅:'호랑이', 卯:'토끼', 辰:'용', 巳:'뱀', 午:'말', 未:'양', 申:'원숭이', 酉:'닭', 戌:'개', 亥:'돼지' };
const 일주동물 = (() => {
  const 일주str = meta.일주 || '';  // 예: "己未(기미)"
  let 색상 = '';
  let 동물 = '';
  for (const [천간, 색] of Object.entries(천간색상맵)) {
    if (일주str.startsWith(천간)) { 색상 = 색; break; }
  }
  for (const [지지, 짐승] of Object.entries(지지동물맵)) {
    if (일주str.includes(지지)) { 동물 = 짐승; break; }
  }
  return 색상 && 동물 ? `${색상} ${동물}` : 동물;
})();

// 생년월일 표기 (음력 입력 시 양력 환산일도 병기)
const ch00Json = path.join(targetDir, `${fileId}_ch00.json`);
let 양력정보 = '', 음력정보 = '';
if (fs.existsSync(ch00Json)) {
  const ch00 = JSON.parse(fs.readFileSync(ch00Json, 'utf8'));
  양력정보 = ch00.양력정보 || '';
  음력정보 = ch00.음력정보 || '';
}
let 생년월일표기;
if (M.음력입력) {
  생년월일표기 = `음력 ${M.생년}년 ${M.생월}월 ${M.생일}일 ${M.생시 || ''}`;
  if (양력정보) 생년월일표기 += `  (양력 ${양력정보})`;
} else {
  생년월일표기 = `${M.생년}년 ${M.생월}월 ${M.생일}일 ${M.생시 || ''} (양력)`;
}
const 성별표기 = M.성별 === '남' ? '남성' : '여성';

const titlePage = `[[TABLE:cover]]`;
parts.push(titlePage);

// 2. 목차 (mockcha_result.txt) 》 슬롯: 슬롯폴더/mockcha_result.txt / flat: queue/{fileId}_mockcha_result.txt
const mockPath = isSlotMode
  ? path.join(slotDir, 'mockcha_result.txt')
  : path.join(targetDir, `${fileId}_mockcha_result.txt`);
if (fs.existsSync(mockPath)) {
  parts.push(fs.readFileSync(mockPath, 'utf8').trim());
}

// 3. 서장 및 본문
for (const ch of CHAPTERS.filter(c => c !== 'mockcha')) {
  if (ch === 'ch00' || ch === 'ch17' || ch === 'ch18' || CHAPTERS.filter(c => c !== 'ch00' && c !== 'ch17' && c !== 'ch18' && c !== 'mockcha').includes(ch)) {
    const resultPath = path.join(targetDir, `${fileId}_${ch}_result.txt`);
    if (fs.existsSync(resultPath)) {
      parts.push(fs.readFileSync(resultPath, 'utf8').trim());
    }
  }
}

const DIVIDER = '\n\n';
let allText  = parts.join(DIVIDER) + '\n';

// 주요 챕터(1~16장, 서장, 부록, 목차)가 시작될 때만 강제 페이지 시작
allText = allText.replace(/\r?\n+([☯■✦✺]\s*(?:(?:제?\d+|서|종|부록)장|부록[\s\d.]|목\s*차))/g, '\n\f$1');
allText = allText.replace(/\r?\n+(\[\s*.+안내\s*\])/g, '\n\f$1');
allText = allText.replace(/\r?\n+([✦☯■✺]?\s*안녕하십니까[.．]\s*\S+입니다)/g, '\n\f$1');
// cover 직후 \f 제거 (cover TABLE 자체가 한 페이지이므로 \f가 빈 페이지를 만듦)
allText = allText.replace(/\[\[TABLE:cover\]\]\n\f/, '[[TABLE:cover]]\n');

// ☯ 및 ■ 제목 정렬 (TXT 파일용)
// 목차 구간(☯    목        차    ☯ ~ ※ 본 해석서)은 정렬 처리 제외
let inToc = false;
allText = allText.split('\n').map(line => {
  const trimmed = line.trim();

  // 목차 시작
  if (trimmed.includes('목        차')) { inToc = true; return line; }
  // 목차 끝
  if (inToc && trimmed.startsWith('※ 본 해석서')) { inToc = false; return line; }
  // 목차 구간은 그대로
  if (inToc) return line;

  // ■ 가 포함된 줄은 ✦ 로 교체
  if (trimmed.includes('■')) {
    return trimmed.replace(/■/g, '✦').replace(/☯/g, '').trim();
  } else if (trimmed.startsWith('☯')) {
    const title = trimmed.replace(/☯/g, '').trim();
    return ' '.repeat(20) + `☯ ${title} ☯`;
  }
  return line;
}).join('\n');

// ── ✺ 절제목 직후 중복 ✦ 소제목 제거 ──────────────────────
// ✺ 제N절. XXX 다음 5줄 이내에 같은 핵심 텍스트를 가진 ✦ 줄이 있으면 제거
{
  const _lines = allText.split('\n');
  const _remove = new Set();
  for (let i = 0; i < _lines.length; i++) {
    if (!_lines[i].includes('✺')) continue;
    const m = _lines[i].match(/제\d+[-\d]*절[.．]\s*(.+)/);
    if (!m) continue;
    const key = m[1].replace(/님의\s*/g, '').trim().slice(0, 8);
    if (key.length < 4) continue;
    for (let j = i + 1; j < Math.min(i + 6, _lines.length); j++) {
      if (_lines[j].includes('✦') && _lines[j].replace(/님의\s*/g, '').includes(key)) {
        _remove.add(j);
        if (j + 1 < _lines.length && _lines[j + 1].trim() === '') _remove.add(j + 1);
        break;
      }
    }
  }
  if (_remove.size > 0) {
    allText = _lines.filter((_, idx) => !_remove.has(idx)).join('\n');
    process.stdout.write(`  ✺/✦ 중복 제목 ${_remove.size}줄 제거\n`);
  }
}

// 연속 빈줄 정규화
// - 표지 구간(처음~집필자 라인): 최대 4줄 공백 허용 (표지 디자인)
// - 본문 전체: 4줄 이상 → 3줄로 통일
// ── 무의미 결과 문장 제거 ──────────────────────────────────
// "→ XX 님의 경우:" 뒤에 실질 내용 없이 "뒤 절에서/다음 절에서/이 장에서 확인" 만 있는 경우 삭제
{
  const 무의미_re = [
    /\n\n(→ [^\n]+의 경우:)\n[^\n]*(뒤 절에서 구체적으로|다음 절에서 자세히|다음 절에서 살펴볼게요|다음 절에서 확인)[^\n]*[.!]?(?=\n)/g,
    /\n(→ [^\n]+의 경우:)\n[^\n]*(뒤 절에서 구체적으로|다음 절에서 자세히|다음 절에서 살펴볼게요|다음 절에서 확인)[^\n]*[.!]?(?=\n)/g,
  ];
  let cnt = 0;
  for (const re of 무의미_re) {
    allText = allText.replace(re, (m) => { cnt++; return ''; });
  }
  if (cnt > 0) process.stdout.write(`  무의미 결과 문장 ${cnt}개 제거\n`);
}

// \r 제거 + 빈줄 정규화 (근본 해결)
allText = allText
  .replace(/\r/g, '')                      // CR 전부 제거 (LF 통일)
  .replace(/\n{4,}/g, '\n\n\n')            // 빈줄 3개 이상 → 2개로 통일 (빈줄2개 = \n\n\n)
  .replace(/\n{3,}(?=\s*[✺✦◎★☯])/g, '\n\n')  // 기호 제목 앞 빈줄 → 1개로 축소
  .replace(/(반야 백년 사주 연구소[^\n]*\n)\n{3,}/g, '$1\n\n'); // 표지 뒤 과잉 개행 제거

const allPath  = isSlotMode
  ? path.join(slotDir, 'result.txt')
  : path.join(targetDir, `${fileId}_all_${M.이름}_result.txt`);
// result.txt 저장 시 <style> 블록 제거 (PDF 변환용)
const allTextClean = allText.replace(/<style>[\s\S]*?<\/style>/g, '');
fs.writeFileSync(allPath, allTextClean, 'utf8');

// ── 3-1단계: [[TABLE:]] 태그 자동 삽입 ───────────────────
// table_template.json이 있으면 그 배치를 따르고, 없으면 기본 규칙 사용
{
  let _tc = fs.readFileSync(allPath, 'utf8');
  const _inserted = new Set(); // 전역 중복 방지

  // ── table_template.json 탐색 ──
  const _templatePaths = [
    isSlotMode && slotDir ? path.join(slotDir, '..', '..', '..', 'table_template.json') : null,
    path.join(__dirname, '..', 'output', M.master_id || '', 'table_template.json'),
  ].filter(Boolean);
  let _template = null;
  for (const tp of _templatePaths) {
    if (fs.existsSync(tp)) {
      try { _template = JSON.parse(fs.readFileSync(tp, 'utf8')); } catch(e) {}
      if (_template) { console.log(`  📋 table_template.json 로드: ${tp}`); break; }
    }
  }

  let _cnt = 0;

  if (_template && Array.isArray(_template)) {
    // ── 템플릿 기반 삽입 ──
    // 앵커(☯ N장, ✺ 제N절, ✦) 위치를 찾아서 TABLE 삽입
    const _lines = _tc.split('\n');
    // 앵커 인덱스 구축
    const _anchors = new Map(); // anchorKey → [lineIdx, ...]
    let _curCh = '', _curSec = '', _tCnt = 0;
    _lines.forEach((line, li) => {
      const chM = line.match(/[☯■]\s*((?:제?\d+|서|종|부록)장|목\s*차)/);
      const secM = line.match(/✺\s*(제[\d\-]+절)/);
      const tilM = /^✦/.test(line.trim());
      if (chM) {
        _curCh = chM[1].replace(/^제/, ''); _curSec = ''; _tCnt = 0;
        const key = _curCh;
        if (!_anchors.has(key)) _anchors.set(key, []);
        _anchors.get(key).push(li);
      } else if (secM && _curCh) {
        _curSec = secM[1]; _tCnt = 0;
        const key = _curCh + '/' + _curSec;
        if (!_anchors.has(key)) _anchors.set(key, []);
        _anchors.get(key).push(li);
      } else if (tilM && _curCh) {
        const secKey = _curSec ? _curCh + '/' + _curSec : _curCh;
        const key = secKey + '/✦' + _tCnt;
        if (!_anchors.has(key)) _anchors.set(key, []);
        _anchors.get(key).push(li);
        _tCnt++;
      }
    });

    // 템플릿 항목을 역순으로 처리 (뒤에서부터 삽입해야 인덱스 안 밀림)
    const _insertions = []; // [{lineIdx, tags}]
    for (const entry of _template) {
      const tables = (entry.tables || []).filter(t => !_inserted.has(t));
      if (!tables.length) continue;
      const anchorLines = _anchors.get(entry.anchor);
      if (!anchorLines || !anchorLines.length) continue;
      const anchorLine = anchorLines[0];

      let insertLine;
      if (entry.pos === 'before') {
        insertLine = anchorLine;
      } else {
        // offset: 앵커 뒤 N번째 텍스트 줄 다음
        let textCount = 0;
        insertLine = anchorLine + 1;
        for (let k = anchorLine + 1; k < _lines.length; k++) {
          if (textCount >= (entry.offset || 0)) { insertLine = k; break; }
          if (!/^\[\[TABLE:/.test(_lines[k].trim())) textCount++;
          insertLine = k + 1;
        }
      }

      const tagLines = tables.map(t => `[[TABLE:${t}]]`);
      if (entry.has_marker) tagLines.unshift('★');
      tables.forEach(t => _inserted.add(t));
      _insertions.push({ lineIdx: insertLine, tags: tagLines });
      _cnt += tables.length;
    }

    // 역순 삽입
    _insertions.sort((a, b) => b.lineIdx - a.lineIdx);
    for (const ins of _insertions) {
      _lines.splice(ins.lineIdx, 0, ...ins.tags);
    }
    _tc = _lines.join('\n');
  }

  {
    // ── 기본 규칙 기반 보충 삽입 (템플릿에 없는 표를 추가) ──
    const _ins = [
      [/☯\s*서장\..*이 책을 펼치기 전에/, ['인적사항표']],
      [/✺\s*부록\..*사주명리/, ['명식표']],
      [/✺ 제2절\..*사주.*첫눈에 보기/, ['사주기본표']],
      [/다음 전환점:.*년.*세/, ['사주원국요약표']],
      [/✺ 제3절\..*음양.*방향의 언어/, ['음양비율표']],
      [/✺ 제5절\..*60갑자/, ['60갑자표']],
      [/지지에는 계절의 흐름이 담겨/, ['지지계절방위표']],
      [/☯ 2장\./, ['일주요약박스']],
      [/✺ 제2절\..*일지.*또 다른 힘/, ['일지분석표']],
      [/✦ .*합충형파해/, ['합충형파해분석표']],
      [/✺ 제1절\..*오행 균형 점수/, ['오행균형표']],
      [/가장 강한 오행/, ['오행점수표']],
      [/✺ 제4절\..*생극 읽기/, ['오행생극도']],
      [/✺ 제1절\..*열 개의 별/, ['십성계열분류표']],
      [/✺ 제2절\..*사주에 있는 별/, ['십성배치표']],
      [/✦.*格局.*用神|✦.*격국.*용신/, ['4신요약표']],
      [/주의 사항: 편관格|주의 사항:.*격국/, ['격국분석표']],
      [/✺ 제9절\..*십이운성/, ['십이운성개인표']],
      [/✺ 제9-1절\..*신살/, ['신살현황표']],
      [/✺ 제9-3절\..*공망/, ['공망안내박스']],
      [/✺ 제2절\..*내 삶을 살리는 기운/, ['용신가이드카드']],
      [/✺ 제4절\..*용신 실용 가이드/, ['용신체크리스트']],
      [/☯.*인테리어.*기운을 집 안으로/, ['인테리어가이드']],
      [/✺ 제2절\..*지장간 분석/, ['지장간분석표']],
      [/✺ 제2절\..*대운 방향/, ['대운로드맵']],
      [/10기 대운.*전체 흐름/, ['대운타임라인']],
      [/✺ 제6절\..*다섯 번의 전환점/, ['전환점요약표']],
      [/건너온 전환점/, ['전환점타임라인']],
      [/✺ 제1절\..*세운.*총평/, ['연간운세요약표']],
      [/✺ 제1-2절\..*교차합/, ['세운대운교차표']],
      [/✺ 제2절\..*월별 운세/, ['세운월운달력']],
      // 운세달력 표지+월별은 아래 별도 로직으로 11장 앞에 연달아 삽입
      [/☯ 12장\..*건강/, ['건강표']],
      [/☯ 13장\..*재물|☯ 13장\..*직업/, ['직업표']],
      [/✺ 제3절\..*운명과 자유의지/, ['돛단배_삽화']],
      // ── 신규 13종 ──
      [/✦ 천간 열 개, 하나씩 만나보기/, ['천간비교표']],
      [/✦ 지지 열두 개, 하나씩 만나보기/, ['지지비교표']],
      [/✺ 제1절\..*타고난 체질/, ['오행신체연관표']],
      [/✺ 제9절\..*예산별 실천/, ['오행인테리어비교표']],
      [/✺ 제6절\..*대운별 건강 주의/, ['건강주의대운표']],
      [/✺ 제4절\..*없는 별의 의미/, ['부재십성보완표']],
      [/✺ 제2절\..*영역별 종합|☯ 종장/, ['영역별종합표']],
      [/✺ 제3절\..*맞춤 양생법/, ['양생식품표']],
      [/✺ 제3절\..*재물 전략/, ['재물전략표']],
      [/✦ 반야선생이 답해요.*기질/, ['기질판단표']],
      [/✺ 제3절\..*대운.*전략|✦.*대운 전략/, ['신강약대운전략표']],
      [/✺ 제6절\..*천직|✺ 제2절\..*직업 구조/, ['신강약직업표']],
      [/✺ 제4절\..*가장 가까운 전환점|교체기.*변화/, ['교체기변화표']],
    ];
    // 목차 영역 끝 위치 (첫 번째 ☯ 장 제목)
    const _tocEnd = _tc.search(/\n\s*☯\s*(?:서|1)장/);
    const _bodyStart = _tocEnd > 0 ? _tocEnd : 0;

    for (const [pat, tables] of _ins) {
      // 목차 영역 이후에서만 매칭
      const _searchArea = _tc.slice(_bodyStart);
      const m = pat.exec(_searchArea);
      if (!m) continue;
      m.index += _bodyStart; // 원래 위치로 보정
      const nl = _tc.indexOf('\n', m.index + m[0].length);
      if (nl < 0) continue;
      const ip = nl + 1;
      const newTables = tables.filter(t => !_inserted.has(t));
      if (!newTables.length) continue;
      const tags = '\n' + newTables.map(t => `[[TABLE:${t}]]`).join('\n') + '\n\n';
      _tc = _tc.slice(0, ip) + tags + _tc.slice(ip);
      newTables.forEach(t => _inserted.add(t));
      _cnt += newTables.length;
    }
  }

  // 운세달력은 종장 뒤, 부록 앞에 별도 삽입 (아래 후처리)

  // 연속 동일 TABLE 제거 (2줄 연속 동일 태그 dedup)
  {
    const _dedupLines = _tc.split('\n');
    const _removeIdx = new Set();
    for (let i = 1; i < _dedupLines.length; i++) {
      const cur = _dedupLines[i].trim();
      const prev = _dedupLines[i - 1].trim();
      if (cur && prev && cur === prev && /^\[\[TABLE:.+\]\]$/.test(cur)) {
        _removeIdx.add(i);
      }
    }
    if (_removeIdx.size > 0) {
      _tc = _dedupLines.filter((_, idx) => !_removeIdx.has(idx)).join('\n');
      console.log(`  🔧 연속 중복 TABLE ${_removeIdx.size}건 제거`);
    }
  }

  // 연속 TABLE 사이에 빈줄 삽입
  _tc = _tc.replace(/(\[\[TABLE:[^\]]+\]\])\n(\[\[TABLE:)/g, '$1\n\n$2');


  // ── 운세달력 표지: 세운월운달력 직후(없으면 제2절 직후)에 삽입 ──
  if (!_inserted.has('운세달력_표지')) {
    const _seMatch = _tc.match(/\[\[TABLE:세운월운달력\]\]\n/);
    if (_seMatch) {
      const _idx = _seMatch.index + _seMatch[0].length;
      _tc = _tc.slice(0, _idx) + '[[TABLE:운세달력_표지]]\n' + _tc.slice(_idx);
      _inserted.add('운세달력_표지');
      _cnt++;
    } else {
      const _secMatch = _tc.match(/(✺\s*제\s*2\s*절\.?\s*월별\s*운세[^\n]*\n)/);
      if (_secMatch) {
        const _idx = _secMatch.index + _secMatch[0].length;
        _tc = _tc.slice(0, _idx) + '\n[[TABLE:운세달력_표지]]\n' + _tc.slice(_idx);
        _inserted.add('운세달력_표지');
        _cnt++;
      }
    }
  }

  // ── 월별 달력(01~12)을 11장 직전에 삽입 ──
  {
    // 사주 새해는 입춘(2월)부터 — 1월은 전년 말이므로 12월 뒤에 배치
    const _calTables = ['운세달력_02월','운세달력_03월','운세달력_04월','운세달력_05월','운세달력_06월','운세달력_07월','운세달력_08월','운세달력_09월','운세달력_10월','운세달력_11월','운세달력_12월','운세달력_01월'];
    const _newCals = _calTables.filter(t => !_inserted.has(t));
    if (_newCals.length > 0) {
      const _ch11Match = _tc.match(/\n(\s*☯\s*11장)/);
      if (_ch11Match) {
        const _calTags = _newCals.map(t => `[[TABLE:${t}]]`).join('\n');
        _tc = _tc.slice(0, _ch11Match.index) + '\n' + _calTags + '\n' + _tc.slice(_ch11Match.index);
        _newCals.forEach(t => _inserted.add(t));
        _cnt += _newCals.length;
      }
    }
  }

  // 최종 저장 전 CR 제거 + 빈줄 정규화 (어디서든 \r이 유입될 수 있으므로)
  _tc = _tc.replace(/\r/g, '').replace(/\n{4,}/g, '\n\n\n');
  fs.writeFileSync(allPath, _tc, 'utf8');
  if (_cnt > 0) console.log(`  📊 [[TABLE:]] 태그 ${_cnt}개 자동 삽입`);
}

// ── 4단계: HTML 표 생성 (generate_all.js) ─────────────────
// ch*.json 파일이 있는 동안 표 생성 (cleanup 전에 실행)
console.log(`\n[4단계] HTML 표 생성\n`);

// generate_manseoryeok.js가 master.json을 찾을 수 있도록 복사
// 슬롯 모드: 슬롯 폴더 안의 master.json만 보장 (flat 복사 불필요)
// flat 모드: queue/{fileId}_master.json 복사
try {
  if (isSlotMode) {
    // 슬롯 폴더에 master.json 보장 (generate_manseoryeok.js가 슬롯 폴더 우선 탐색)
    const slotMasterPath = path.join(slotDir, 'master.json');
    if (!fs.existsSync(slotMasterPath) && fs.existsSync(inputPath)) {
      fs.copyFileSync(inputPath, slotMasterPath);
      console.log(`  📋 master.json → queue/${path.basename(slotDir)}/master.json`);
    }
  } else {
    // Flat mode: queue/sample_454_master.json
    const flatMasterPath = path.join(targetDir, `${fileId}_master.json`);
    if (fs.existsSync(inputPath) && inputPath !== flatMasterPath) {
      fs.copyFileSync(inputPath, flatMasterPath);
      console.log(`  📋 master.json → queue/${path.basename(flatMasterPath)}`);
    }
  }
} catch (e) {
  console.warn(`  ⚠️  master.json 복사 실패:`, e.message);
}

try {
  const genAll = path.join(__dirname, 'generate_all.js');
  if (fs.existsSync(genAll)) {
    if (isSlotMode) {
      process.stdout.write(`  generate_all.js (Slot Mode) ... `);
      run(`"${NODE_CMD}" generate_all.js "${virtualSlotId}" "${productType}"`, `generate_all`);
    } else {
      run(`"${NODE_CMD}" generate_all.js ${fileId} "${productType}"`, 'generate_all');
    }
  } else {
    console.log(`  ⚠️  generate_all.js 없음 》 표 생성 건너뜀`);
  }
} catch (e) {
  console.warn(`  ⚠️  표 생성 중 오류 (집필 결과에는 영향 없음):`, e.message);
}

// ── slot 모드: 표 HTML을 tables/{fileId}/ → slotDir/tables/ 로 이동 ─
// 매 실행마다 tables/ 폴더를 완전히 교체 → 파일 수 항상 일정하게 유지
if (isSlotMode) {
  try {
    const srcDir = path.join(__dirname, 'tables', virtualSlotId);
    const dstDir = path.join(slotDir, 'tables');
    if (fs.existsSync(srcDir)) {
      // 기존 dstDir의 HTML 파일 전부 삭제 (이전 실행 잔여물 제거)
      if (fs.existsSync(dstDir)) {
        for (const f of fs.readdirSync(dstDir)) {
          if (f.endsWith('.html')) fs.unlinkSync(path.join(dstDir, f));
        }
      } else {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      // 새 파일 복사
      let movedCount = 0;
      for (const f of fs.readdirSync(srcDir)) {
        if (f.endsWith('.html')) {
          fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
          movedCount++;
        }
      }
      // 원본 폴더 정리
      for (const f of fs.readdirSync(srcDir)) fs.unlinkSync(path.join(srcDir, f));
      fs.rmdirSync(srcDir);
      console.log(`  📁 표 HTML → ${path.relative(__dirname, dstDir) || dstDir}/  (${movedCount}개)`);
    }
  } catch(e) {
    console.warn('  ⚠️  tables 이동 실패:', e.message);
  }
}

// ── master.json 직접 계산 표들 (합충형파해, 십이운성, 운세달력) ─
// 이동 로직 뒤에 실행해야 slotDir/tables/ 삭제에 영향 안 받음
try {
  const masterJsonPath = path.join(slotDir, 'master.json');
  const slotArg = isSlotMode ? slotDir.replace(/\\/g,'/') : fileId;
  // 직접 생성 표 목록 (상품에 따라 필터링)
  const _directTables = [
    { file:'generate_합충형파해.js', products:['saju_full','compatibility'] },
    { file:'generate_십이운성개인표.js', products:['saju_full','personality'] },
    { file:'generate_운세달력.js', products:['saju_full','yearly_fortune'] },
    { file:'generate_일지분석표.js', products:['saju_full','personality','compatibility'] },
    { file:'generate_음양비율표.js', products:['saju_full'] },
    { file:'generate_지지계절방위표.js', products:['saju_full'] },
    { file:'generate_인적사항표.js', products:['saju_full','saju_summary','yearly_fortune','wealth_career','health','personality','compatibility'] },
    { file:'generate_명식표.js', products:['saju_full','saju_summary','yearly_fortune','wealth_career','health','personality','compatibility'] },
  ];
  if (fs.existsSync(masterJsonPath)) {
    for (const t of _directTables) {
      if (t.products.includes(productType) || productType === 'custom') {
        const sp = path.join(__dirname, t.file);
        if (fs.existsSync(sp)) run(`"${NODE_CMD}" ${t.file} "${slotArg}"`, t.file);
      }
    }
  }
} catch (e) {
  console.warn(`  ⚠️  직접계산 표 오류:`, e.message);
}

// ── 공통 삽화 복사 (개인 데이터 불필요, images/common/ → tables/) ──
try {
  const commonDir = path.join(__dirname, 'images', 'common');
  if (fs.existsSync(commonDir)) {
    const dstTablesDir = isSlotMode ? path.join(slotDir, 'tables') : path.join(__dirname, 'tables', fileId);
    if (!fs.existsSync(dstTablesDir)) fs.mkdirSync(dstTablesDir, { recursive: true });
    let _copied = 0;
    for (const f of fs.readdirSync(commonDir)) {
      if (f.endsWith('.html')) {
        fs.copyFileSync(path.join(commonDir, f), path.join(dstTablesDir, f));
        _copied++;
      }
    }
    // tables/current에도 복사
    const currentDir = path.join(__dirname, 'tables', 'current');
    if (fs.existsSync(currentDir)) {
      for (const f of fs.readdirSync(commonDir)) {
        if (f.endsWith('.html')) fs.copyFileSync(path.join(commonDir, f), path.join(currentDir, f));
      }
    }
    if (_copied > 0) console.log(`  🖼️  공통 삽화 ${_copied}개 복사`);
  }
} catch(e) {
  console.warn('  ⚠️  공통 삽화 복사 실패:', e.message);
}

// ── 필러(명언/팁/이미지) 복사 + 브랜드명 치환 ──
try {
  const fillerSrcDir = path.join(__dirname, 'images', 'filler');
  const fillerDstDir = path.join(__dirname, '..', 'static', 'filler');
  const 선생님이름 = M.선생님이름 || '반야선생';
  // 필러는 static/filler/에서 직접 서빙 — 복사 불필요
  // 선생님이름 치환만 static/filler에 1회 적용
  if (fs.existsSync(fillerSrcDir) && fs.existsSync(fillerDstDir)) {
    let _cnt = 0;
    for (const f of fs.readdirSync(fillerSrcDir)) {
      if (!f.endsWith('.html')) continue;
      const srcPath = path.join(fillerSrcDir, f);
      const dstPath = path.join(fillerDstDir, f);
      // 이미 존재하고 선생님이름이 같으면 스킵
      if (fs.existsSync(dstPath)) continue;
      const fSize = fs.statSync(srcPath).size;
      if (fSize > 500000) {
        // 이미지 필러: 그대로 복사 (선생님이름 없음)
        fs.copyFileSync(srcPath, dstPath);
      } else {
        let content = fs.readFileSync(srcPath, 'utf8');
        content = content.replace(/\{\{선생님이름\}\}/g, 선생님이름);
        fs.writeFileSync(dstPath, content, 'utf8');
      }
      _cnt++;
    }
    if (_cnt > 0) console.log(`  📝 필러 ${_cnt}개 신규 배포 (선생님: ${선생님이름})`);
  }
} catch(e) {
  console.warn('  ⚠️  필러 복사 실패:', e.message);
}

// ── tables/current/ 고정 폴더 동기화 ─────────────────────────
// 에디터에서 항상 같은 경로로 표를 불러올 수 있도록
try {
  // slot 모드: slotDir/tables/ 기준  /  legacy: tables/{fileId}/
  const slotTablesDir = isSlotMode
    ? path.join(slotDir, 'tables')
    : path.join(__dirname, 'tables', fileId);
  const currentDir    = path.join(__dirname, 'tables', 'current');
  if (fs.existsSync(slotTablesDir)) {
    if (!fs.existsSync(currentDir)) fs.mkdirSync(currentDir, { recursive: true });
    // current 폴더 기존 html 파일 삭제 후 최신 파일로 교체
    for (const f of fs.readdirSync(currentDir)) {
      if (f.endsWith('.html')) fs.unlinkSync(path.join(currentDir, f));
    }
    for (const f of fs.readdirSync(slotTablesDir)) {
      if (f.endsWith('.html')) {
        fs.copyFileSync(path.join(slotTablesDir, f), path.join(currentDir, f));
      }
    }
    console.log(`  📁 tables/current/ 업데이트 완료 (${M.이름} 님)`);
  }
} catch(e) {
  console.warn('  ⚠️  tables/current/ 동기화 실패:', e.message);
}

// ── 전체 표 인쇄용 HTML 생성 ─────────────────────────────
try {
  const _printTablesDir = isSlotMode ? path.join(slotDir, 'tables') : path.join(__dirname, 'tables', fileId);
  if (fs.existsSync(_printTablesDir)) {
    const _tFiles = fs.readdirSync(_printTablesDir).filter(f => f.endsWith('.html') && f !== 'cover.html').sort();
    const _sections = [];
    for (const f of _tFiles) {
      const name = f.replace('.html', '');
      const raw = fs.readFileSync(path.join(_printTablesDir, f), 'utf8');
      const styleMatches = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || [];
      const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/);
      const body = bodyMatch ? bodyMatch[1].trim() : '';
      _sections.push({ name, styles: styleMatches.join('\n'), body });
    }
    const _printHtml = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>${M.이름} 님 전체 표 인쇄</title>
<style>
@media print { .table-section { page-break-after: always; } .table-section:last-child { page-break-after: avoid; } .no-print { display: none !important; } body { margin:0; padding:0; } }
@media screen { body { background:#e5e5e5; margin:0; padding:20px; font-family:'Noto Sans KR',sans-serif; } .table-section { background:#fff; max-width:800px; margin:0 auto 30px; padding:30px; border-radius:8px; box-shadow:0 2px 12px rgba(0,0,0,0.1); } }
.section-header { font-size:13px; color:#8a7e6c; border-bottom:1px solid #e0d8c8; padding-bottom:8px; margin-bottom:20px; }
.section-header span { font-weight:600; color:#5a4e3c; font-size:15px; }
.toolbar { position:fixed; top:0; left:0; right:0; background:#1a1a2e; color:#fff; padding:12px 24px; display:flex; align-items:center; justify-content:space-between; z-index:9999; box-shadow:0 2px 8px rgba(0,0,0,0.3); }
.toolbar h1 { font-size:16px; font-weight:500; margin:0; }
.toolbar button { background:#d4af37; color:#1a1a2e; border:none; padding:8px 24px; border-radius:6px; font-weight:700; font-size:14px; cursor:pointer; }
.spacer { height:60px; }
</style></head><body>
<div class="toolbar no-print"><h1>${M.이름} 님 》 전체 표 인쇄 (${_sections.length}개)</h1><button onclick="window.print()">인쇄하기</button></div>
<div class="spacer no-print"></div>
${_sections.map((s, i) => `<div class="table-section"><div class="section-header"><span>${i+1}.</span> ${s.name}</div>${s.styles}${s.body}</div>`).join('\n')}
</body></html>`;
    const _printPath = isSlotMode ? path.join(slotDir, 'print_all_tables.html') : path.join(targetDir, `${fileId}_print_all_tables.html`);
    fs.writeFileSync(_printPath, _printHtml, 'utf8');
    console.log(`  🖨️  전체 표 인쇄용 HTML 생성 (${_sections.length}개 표)`);
  }
} catch(e) {
  console.warn('  ⚠️  인쇄용 HTML 생성 실패:', e.message);
}

// ── 중간 파일 정리 (ch JSON + ch result.txt) ──────────────
// master.json과 all_result.txt만 남기고 나머지 삭제
{
  let cleanedCount = 0;
  const queueFiles = fs.readdirSync(targetDir);
  for (const f of queueFiles) {
    // 삭제 대상: {fileId}_ch*.json, {fileId}_ch*_result.txt, {fileId}_mockcha*.*, {fileId}_master_preprocessed.json
    if (!f.startsWith(fileId + '_')) continue;
    const keep =
      f === `${fileId}_master.json` ||
      f === `${fileId}_master_preprocessed.json` ||  // run_all 직전 정리됨 》 혹시 남으면 삭제
      f.endsWith('_result.txt') && f.includes('_all_');  // all_result.txt만 유지
    const isIntermediate =
      (/_(ch)/.test(f) && (f.endsWith('.json') || f.endsWith('_result.txt'))) ||
      (/_(mockcha)/.test(f) && (f.endsWith('.json') || f.endsWith('_result.txt')));  // .txt(수동 목차)는 유지
    const isPreprocessed = f === `${fileId}_master_preprocessed.json`;
    if (isIntermediate || isPreprocessed) {
      fs.unlinkSync(path.join(targetDir, f));
      cleanedCount++;
    }
  }
  // slot 모드: slotDir/master_preprocessed.json 도 정리
  if (isSlotMode) {
    const slotPreproc = path.join(slotDir, 'master_preprocessed.json');
    if (fs.existsSync(slotPreproc)) { fs.unlinkSync(slotPreproc); cleanedCount++; }

    // slot 모드: generate_mockcha.js 등이 queue 루트에 쓴 {fileId}_* 잔여 파일 정리
    try {
      for (const f of fs.readdirSync(samplesDir)) {
        if (!f.startsWith(fileId + '_')) continue;
        const fp = path.join(samplesDir, f);
        if (fs.statSync(fp).isFile()) { fs.unlinkSync(fp); cleanedCount++; }
      }
    } catch(e) { /* 무시 */ }
  }
  if (cleanedCount > 0)
    console.log(`  🧹 중간 파일 ${cleanedCount}개 정리됨 (master.json + result.txt만 유지)`);
}

// ── HTML 최종본 자동 생성 (txt_to_html.py) ───────────────────
try {
  const txtToHtml = path.join(__dirname, 'txt_to_html.py');
  const outDir    = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // slot 모드: slotDir/final.html  /  legacy: output/{fileId}_{이름}_final.html
  const htmlOut = isSlotMode
    ? path.join(slotDir, 'final.html')
    : path.join(outDir, `${fileId}_${M.이름}_final.html`);
  // slot 모드: tables 경로를 slotDir/tables 로 지정
  const tablesArg = isSlotMode
    ? `--tables-dir "${path.join(slotDir, 'tables')}"`
    : '';
  if (fs.existsSync(txtToHtml)) {
    const { execSync } = require('child_process');
    execSync(
      `${process.platform === 'win32' ? 'python' : 'python3'} "${txtToHtml}" "${allPath}" "${htmlOut}" --slot "${virtualSlotId}" ${tablesArg}`,
      { cwd: __dirname, encoding: 'utf-8', timeout: 60000 }
    );
    // 고정 경로로도 복사 (에디터에서 항상 같은 경로로 열 수 있도록)
    const latestOut = path.join(outDir, 'latest_final.html');
    fs.copyFileSync(htmlOut, latestOut);
    if (isSlotMode) {
      console.log(`  📄 HTML 최종본: ${path.relative(__dirname, htmlOut)}`);
    } else {
      console.log(`  📄 HTML 최종본: output/${fileId}_${M.이름}_final.html`);
    }
    console.log(`  📄 고정 경로:   output/latest_final.html`);
  }
} catch(e) {
  console.warn('  ⚠️  HTML 최종본 생성 실패:', e.message.split('\n')[0]);
}

// ── 완료 보고 ────────────────────────────────────────────
const charCount = [...allText].length;
const lineCount = allText.split('\n').length;

console.log(`\n════════════════════════════════════════════════════════════`);
console.log(`  ✅ 집필 완료`);
console.log(`  이름: ${M.이름}`);
console.log(`  파트: ${parts.length}개 챕터 합본 (페이지 번호 제거됨)`);
console.log(`  글자수: ${charCount.toLocaleString()}자`);
console.log(`  줄수: ${lineCount.toLocaleString()}줄`);
if (isSlotMode) {
  const rel = path.relative(__dirname, slotDir);
  console.log(`  출력 폴더: queue/${path.basename(slotDir)}/`);
  console.log(`    ├─ master.json, result.txt, final.html`);
  console.log(`    └─ tables/  (표 HTML 파일)`);
} else {
  console.log(`  합본 파일: queue/${fileId}_all_${M.이름}_result.txt`);
}
console.log(`════════════════════════════════════════════════════════════\n`);
