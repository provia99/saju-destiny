#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');
const { 전체사주계산 } = require('./saju_calc');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── 천간/지지 기본 데이터 ──────────────────────────────
const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JJ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const TG_KR = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const JJ_KR = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const TG_OH = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const JJ_OH = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const JJ_ANIMAL = {子:'🐭',丑:'🐮',寅:'🐯',卯:'🐰',辰:'🐲',巳:'🐍',午:'🐴',未:'🐏',申:'🐵',酉:'🐔',戌:'🐶',亥:'🐷'};
const OH_COLOR = {木:'#4caf50',火:'#f44336',土:'#ff9800',金:'#9e9e9e',水:'#2196f3'};
const OH_KR = {木:'목',火:'화',土:'토',金:'금',水:'수'};

// 용신 분류
const OH_ROLE_MAP = {}; // 런타임에 설정

// ── 일진 계산 (1900-01-01 = 甲戌) ────────────────────
function getIljin(year, month, day) {
  const base = new Date(1900, 0, 1);
  const target = new Date(year, month - 1, day);
  const diff = Math.floor((target - base) / 86400000);
  const tgIdx = ((diff % 10) + 10) % 10;
  const jjIdx = (((diff + 10) % 12) + 12) % 12;
  return { tg: TG[tgIdx], jj: JJ[jjIdx] };
}

// ── 음력 변환 (간이) ─────────────────────────────────
function getLunarDate(year, month, day) {
  try {
    const { _양력to음력 } = require('./saju_calc');
    if (_양력to음력) {
      const r = _양력to음력({ 양력년: year, 양력월: month, 양력일: day });
      if (r && !r.오류) return `${r.윤달?'윤':''}${r.음력월}.${r.음력일}`;
    }
  } catch(e) {}
  return '';
}

// ── 절기 데이터 (연도별) ─────────────────────────────
function get절기(year, month, day) {
  const 절기표 = {
    2025: [
      [1,5,'소한'],[1,20,'대한'],[2,3,'입춘'],[2,18,'우수'],[3,5,'경칩'],[3,20,'춘분'],
      [4,4,'청명'],[4,20,'곡우'],[5,5,'입하'],[5,21,'소만'],[6,5,'망종'],[6,21,'하지'],
      [7,7,'소서'],[7,22,'대서'],[8,7,'입추'],[8,23,'처서'],[9,7,'백로'],[9,23,'추분'],
      [10,8,'한로'],[10,23,'상강'],[11,7,'입동'],[11,22,'소설'],[12,7,'대설'],[12,22,'동지'],
    ],
    2026: [
      [1,5,'소한'],[1,20,'대한'],[2,4,'입춘'],[2,19,'우수'],[3,6,'경칩'],[3,21,'춘분'],
      [4,5,'청명'],[4,20,'곡우'],[5,6,'입하'],[5,21,'소만'],[6,6,'망종'],[6,21,'하지'],
      [7,7,'소서'],[7,23,'대서'],[8,7,'입추'],[8,23,'처서'],[9,8,'백로'],[9,23,'추분'],
      [10,8,'한로'],[10,23,'상강'],[11,7,'입동'],[11,22,'소설'],[12,7,'대설'],[12,22,'동지'],
    ],
    2027: [
      [1,5,'소한'],[1,20,'대한'],[2,4,'입춘'],[2,19,'우수'],[3,6,'경칩'],[3,21,'춘분'],
      [4,5,'청명'],[4,20,'곡우'],[5,6,'입하'],[5,21,'소만'],[6,6,'망종'],[6,21,'하지'],
      [7,7,'소서'],[7,23,'대서'],[8,8,'입추'],[8,23,'처서'],[9,8,'백로'],[9,23,'추분'],
      [10,9,'한로'],[10,24,'상강'],[11,7,'입동'],[11,22,'소설'],[12,7,'대설'],[12,22,'동지'],
    ],
  };
  const data = 절기표[year];
  if (!data) return '';
  const match = data.find(([m, d]) => m === month && d === day);
  return match ? match[2] : '';
}

// ── 기념일·명절 데이터 ───────────────────────────────
function get기념일(year, month, day) {
  // 양력 고정 기념일
  const 양력기념일 = {
    '1-1':'신정','3-1':'삼일절','5-5':'어린이날','5-8':'어버이날',
    '5-15':'스승의날','6-6':'현충일','8-15':'광복절',
    '10-3':'개천절','10-9':'한글날','12-25':'성탄절',
    '11-11':'빼빼로데이',
    // 14일 데이
    '1-14':'다이어리데이','2-14':'발렌타인데이','3-14':'화이트데이',
    '4-14':'블랙데이','5-14':'로즈데이','6-14':'키스데이',
    '7-14':'실버데이','8-14':'그린데이','9-14':'포토데이',
    '10-14':'와인데이','11-14':'무비데이','12-14':'허그데이',
  };
  const key = `${month}-${day}`;
  if (양력기념일[key]) return 양력기념일[key];
  return '';
}

function get명절(year) {
  // 음력 명절 → 양력 변환
  const 음력명절 = [
    { 음월:1, 음일:1, 이름:'설날', 전후:[[-1,'설연휴'],[1,'설연휴']] },
    { 음월:1, 음일:15, 이름:'정월대보름' },
    { 음월:4, 음일:8, 이름:'석가탄신일' },
    { 음월:5, 음일:5, 이름:'단오' },
    { 음월:7, 음일:7, 이름:'칠석' },
    { 음월:8, 음일:15, 이름:'추석', 전후:[[-1,'추석연휴'],[1,'추석연휴']] },
    { 음월:9, 음일:9, 이름:'중양절' },
  ];
  const result = {};
  try {
    const { _음력to양력 } = require('./saju_calc');
    if (!_음력to양력) return result;
    for (const h of 음력명절) {
      const sol = _음력to양력({ 음력년: year, 음력월: h.음월, 음력일: h.음일, 윤달: false });
      if (sol && !sol.오류) {
        result[`${sol.양력월}-${sol.양력일}`] = h.이름;
        if (h.전후) {
          for (const [offset, name] of h.전후) {
            const d = new Date(year, sol.양력월 - 1, sol.양력일 + offset);
            result[`${d.getMonth()+1}-${d.getDate()}`] = name;
          }
        }
      }
    }
  } catch(e) {}
  return result;
}

// ── 손없는날 계산 ────────────────────────────────────
function isSonEomneunNal(day) {
  const d = day % 10;
  // 음력 기준이지만 간이로 양력 적용
  // 1,2일: 동, 3,4일: 남, 5,6일: 서, 7,8일: 북, 9,0일: 없음(손없는날)
  return d === 9 || d === 0;
}

// ── 일별 점수 계산 (100%판: 5신 + 원국4주 + 세운/대운 교차 + 12운성 + 신살완전) ──
// 파라미터: iljin={tg,jj}, 5신, 일간, 원국4주, 신살정보, 세운={천간,지지}, 대운={천간,지지}
function calcDayScore(iljin, 용신, 희신, 기신, 일간, 일지, 구신, 한신, 원국4주, 신살정보, 세운간지, 대운간지) {
  const tgOh = TG_OH[iljin.tg];
  const jjOh = JJ_OH[iljin.jj];
  const ilganOh = TG_OH[일간];
  let score = 50;

  // ── 1. 천간 오행 vs 5신 (천간 60%, 가중) ──
  if (tgOh === 용신) score += 20;
  else if (tgOh === 희신) score += 12;
  else if (tgOh === 기신) score -= 15;
  else if (tgOh === 구신) score -= 8;
  else if (tgOh === 한신) score += 2;

  // ── 2. 지지 오행 vs 5신 (지지 40%) ──
  if (jjOh === 용신) score += 18;
  else if (jjOh === 희신) score += 10;
  else if (jjOh === 기신) score -= 12;
  else if (jjOh === 구신) score -= 6;
  else if (jjOh === 한신) score += 2;

  // ── 3. 일간↔일진 천간 상생/상극 ──
  const 상생맵 = {木:'火',火:'土',土:'金',金:'水',水:'木'};
  const 상극맵 = {木:'土',土:'水',水:'火',火:'金',金:'木'};
  if (상생맵[ilganOh] === tgOh) score += 4;   // 일간이 생해주는 오행
  if (상생맵[tgOh] === ilganOh) score += 6;   // 일간을 생해주면 더 좋음
  if (상극맵[tgOh] === ilganOh) score -= 5;   // 일간을 극하면 흉
  if (상극맵[ilganOh] === tgOh) score -= 3;   // 일간이 극하는 오행

  // ── 4. 음양 조화 ──
  const 양간 = ['甲','丙','戊','庚','壬'];
  const ilganYang = 양간.includes(일간);
  const tgYang = 양간.includes(iljin.tg);
  if (ilganYang === tgYang) score += 3; else score -= 2;

  // ── 5. 천간합/충 (일간↔일진천간) ──
  const 합쌍 = {甲:'己',己:'甲',乙:'庚',庚:'乙',丙:'辛',辛:'丙',丁:'壬',壬:'丁',戊:'癸',癸:'戊'};
  if (합쌍[일간] === iljin.tg) score += 8;
  const 천간충쌍 = {甲:'庚',庚:'甲',乙:'辛',辛:'乙',丙:'壬',壬:'丙',丁:'癸',癸:'丁'};
  if (천간충쌍[일간] === iljin.tg) score -= 7;

  // ── 6. 원국 4주 전체 × 일진 교차 관계 ──
  const 육합맵 = {子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
  const 충맵 = {子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
  const 형맵 = {寅:'巳',巳:'申',丑:'戌',戌:'未',未:'丑',子:'卯',卯:'子'};

  if (원국4주) {
    // 원국 천간 4개와 일진 천간 교차
    const 원천간 = [원국4주.년간, 원국4주.월간, 원국4주.일간, 원국4주.시간].filter(Boolean);
    for (const tg of 원천간) {
      if (tg === 일간) continue; // 일간은 위에서 이미 처리
      if (합쌍[tg] === iljin.tg) score += 3;      // 원국 천간과 합
      if (천간충쌍[tg] === iljin.tg) score -= 3;  // 원국 천간과 충
    }

    // 원국 지지 4개와 일진 지지 교차 (가중치: 일지>월지>년지>시지)
    const 원지지 = [
      { 지:원국4주.년지, 가중:0.6 },
      { 지:원국4주.월지, 가중:0.8 },
      { 지:원국4주.일지, 가중:1.0 },
      { 지:원국4주.시지, 가중:0.5 },
    ].filter(x => x.지);

    for (const {지, 가중} of 원지지) {
      if (육합맵[지] === iljin.jj) score += Math.round(6 * 가중);
      if (충맵[지] === iljin.jj) score -= Math.round(8 * 가중);
      if (형맵[지] === iljin.jj) score -= Math.round(4 * 가중);
    }
  } else if (일지) {
    // 원국4주 없으면 기존 일지만 처리 (하위호환)
    if (육합맵[일지] === iljin.jj) score += 6;
    if (충맵[일지] === iljin.jj) score -= 8;
    if (형맵[일지] === iljin.jj) score -= 4;
  }

  // ── 7. 실제 12운성 반영 ──
  try {
    const { 십이운성계산 } = require('./saju_calc');
    if (십이운성계산) {
      const 운성 = 십이운성계산(일간, iljin.jj);
      const 운성점수 = {장생:5,관대:4,건록:6,제왕:3,목욕:-2,쇠:-3,병:-5,사:-4,묘:1,절:-3,태:2,양:3};
      score += 운성점수[운성] || 0;
    }
  } catch(e) {}

  // ── 8. 신살 보정 ──
  if (신살정보) {
    // 천을귀인 지지와 일진 지지가 같으면 귀인일 (+5)
    const 천을 = 신살정보.천을귀인 || [];
    if (천을.some && 천을.some(위치 => {
      // 위치가 '년지','월지' 등이면 해당 지지 확인
      const 지지맵 = {년지:원국4주?.년지, 월지:원국4주?.월지, 일지:원국4주?.일지, 시지:원국4주?.시지};
      return 지지맵[위치] && 육합맵[지지맵[위치]] === iljin.jj;
    })) score += 3;

    // 도화살 지지와 일진 지지 일치 → 이성운 (+2, 기신이면 -2)
    const 도화지지 = ['子','午','卯','酉'];
    if (도화지지.includes(iljin.jj)) {
      const jjRole = jjOh === 용신 ? '길' : jjOh === 기신 ? '흉' : '중';
      if (jjRole === '길') score += 2;
      else if (jjRole === '흉') score -= 2;
    }

    // 역마 지지(寅申巳亥)와 일진 → 변동 에너지
    const 역마지지 = ['寅','申','巳','亥'];
    if (역마지지.includes(iljin.jj)) {
      if (jjOh === 용신) score += 3;
      else if (jjOh === 기신) score -= 3;
    }

    // 천을귀인 완전 판정: 일간 기준 천을귀인 지지와 일진 지지 직접 비교
    const 천을귀인맵 = {
      甲:['丑','未'],乙:['子','申'],丙:['亥','酉'],丁:['亥','酉'],
      戊:['丑','未'],己:['子','申'],庚:['丑','未'],辛:['寅','午'],
      壬:['卯','巳'],癸:['卯','巳'],
    };
    const 귀인지지 = 천을귀인맵[일간] || [];
    if (귀인지지.includes(iljin.jj)) score += 5; // 천을귀인일 = 귀인을 만나는 날

    // 문창귀인: 일간 기준
    const 문창맵 = {甲:'巳',乙:'午',丙:'申',丁:'酉',戊:'申',己:'酉',庚:'亥',辛:'子',壬:'寅',癸:'卯'};
    if (문창맵[일간] === iljin.jj) score += 3; // 문창귀인일 = 학업/시험 좋은 날

    // 백호대살: 일지 기준 특정 지지 조합이면 감점
    const 백호맵 = {子:'午',丑:'未',寅:'申',卯:'酉',辰:'戌',巳:'亥',午:'子',未:'丑',申:'寅',酉:'卯',戌:'辰',亥:'巳'};
    if (원국4주 && 백호맵[원국4주.일지] === iljin.jj) score -= 3; // 백호 충일 주의
  }

  // ── 9. 세운 × 일진 교차 ──
  if (세운간지) {
    const 세운tg = 세운간지.천간, 세운jj = 세운간지.지지;
    // 세운 천간과 일진 천간 합/충
    if (세운tg && 합쌍[세운tg] === iljin.tg) score += 4;  // 세운천간합 = 올해 흐름과 조화
    if (세운tg && 천간충쌍[세운tg] === iljin.tg) score -= 4; // 세운천간충 = 올해 흐름과 충돌
    // 세운 지지와 일진 지지 합/충
    if (세운jj) {
      if (육합맵[세운jj] === iljin.jj) score += 3;   // 세운지지합
      if (충맵[세운jj] === iljin.jj) score -= 5;      // 세운지지충 (세운 뿌리 흔들림)
    }
  }

  // ── 10. 대운 × 일진 교차 ──
  if (대운간지) {
    const 대운tg = 대운간지.천간, 대운jj = 대운간지.지지;
    // 대운은 10년 주기라 일별 영향은 약하지만 방향성 보정
    if (대운tg && 합쌍[대운tg] === iljin.tg) score += 2;  // 대운천간합
    if (대운tg && 천간충쌍[대운tg] === iljin.tg) score -= 2; // 대운천간충
    if (대운jj) {
      if (육합맵[대운jj] === iljin.jj) score += 2;   // 대운지지합
      if (충맵[대운jj] === iljin.jj) score -= 3;      // 대운지지충
    }
  }

  return Math.max(10, Math.min(100, score));
}

// ── 십성 계산 ───────────────────────────────────────
function getSipseong(ilganOh, targetOh) {
  const 오행순 = ['木','火','土','金','水'];
  const iIdx = 오행순.indexOf(ilganOh);
  const tIdx = 오행순.indexOf(targetOh);
  if (iIdx < 0 || tIdx < 0) return '비겁';
  const diff = ((tIdx - iIdx) + 5) % 5;
  // 0=비겁, 1=식상, 2=재성, 3=관성, 4=인성
  return ['비겁','식상','재성','관성','인성'][diff];
}

// ── 일별 테마 결정 (십성 기반) ──────────────────────
function getDayTheme(score, iljin, 일간) {
  const ilganOh = TG_OH[일간];
  // 천간 십성을 우선, 지지 십성 보조
  const tgSS = getSipseong(ilganOh, TG_OH[iljin.tg]);
  const jjSS = getSipseong(ilganOh, JJ_OH[iljin.jj]);
  // 천간·지지 십성이 다르면 지지 우선 (매일 변화), 같으면 천간
  const ss = (tgSS !== jjSS) ? jjSS : tgSS;
  switch(ss) {
    case '비겁': return { icon:'💪', label:'건강/체력', color:'#4caf50' };
    case '식상': return { icon:'🏆', label:'성취/표현', color:'#9c27b0' };
    case '재성': return { icon:'💰', label:'재물/실익', color:'#ff9800' };
    case '관성': return { icon:'📋', label:'직업/명예', color:'#1565c0' };
    case '인성': return { icon:'💘', label:'애정/학업', color:'#e91e63' };
    default:     return { icon:'🏆', label:'성취/명예', color:'#1565c0' };
  }
}

// ── 행운 시간 계산 ──────────────────────────────────
function getLuckyTimes(iljin, 용신, 희신) {
  const times = [];
  const 시간대 = [
    {시:'子',range:'23~01시'},{시:'丑',range:'01~03시'},{시:'寅',range:'03~05시'},
    {시:'卯',range:'05~07시'},{시:'辰',range:'07~09시'},{시:'巳',range:'09~11시'},
    {시:'午',range:'11~13시'},{시:'未',range:'13~15시'},{시:'申',range:'15~17시'},
    {시:'酉',range:'17~19시'},{시:'戌',range:'19~21시'},{시:'亥',range:'21~23시'},
  ];

  const good = [];
  const bad = [];

  시간대.forEach(t => {
    const oh = JJ_OH[t.시];
    if (oh === 용신) good.push({ time: t.range, reason: `${oh}(${OH_KR[oh]}) 용신 시간` });
    else if (oh === 희신) good.push({ time: t.range, reason: `${oh}(${OH_KR[oh]}) 희신 시간` });
    else if (oh === TG_OH[iljin.tg] && JJ_OH[iljin.jj] !== 용신) {
      // 기신 오행과 같은 시간
    }
  });

  // 기신 시간 = 용신을 극하는 오행의 시간
  const 극맵 = {木:'火',火:'水',土:'木',金:'火',水:'土'};
  const 기신oh = 극맵[용신] || '';
  시간대.forEach(t => {
    const oh = JJ_OH[t.시];
    if (oh === 기신oh) bad.push({ time: t.range, reason: `${oh}(${OH_KR[oh]}) 주의 시간` });
  });

  return { best: good.slice(0, 2), caution: bad.slice(0, 2) };
}

// ── 행운 아이템 ─────────────────────────────────────
function getLuckyItems(용신) {
  const items = {
    木: { colors:['초록','연두'], items:['원목 소품','녹색 머플러'] },
    火: { colors:['빨강','주황'], items:['붉은 넥타이','캔들'] },
    土: { colors:['노랑','베이지'], items:['베이지 톤','도자기'] },
    金: { colors:['흰색','은색'], items:['은 액세서리','흰 셔츠'] },
    水: { colors:['파랑','검정'], items:['네이비 스카프','유리컵'] },
  };
  return items[용신] || items['火'];
}

// ── 메인 생성 ───────────────────────────────────────
function generate(slotId) {
  let masterPath = path.join(slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) { console.log('⚠️ 운세달력: master.json 없음 (스킵)'); return; }

  const M = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
  const r = 전체사주계산({
    이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
    년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시, 성별: M.성별 ?? '남',
    활동상태: M.활동상태,
  });

  const name = M.이름 || slotId;
  const 일간 = r.원국.일주.천간;
  const 용신 = r.용신 || '火';
  const 희신 = r.희신 || '木';
  const 극맵 = {木:'火',火:'水',土:'木',金:'火',水:'土'};
  let 기신 = r.기신 || r.기신 || '';
  if (!기신) 기신 = 극맵[용신] || '';
  const 생맵 = {木:'水',火:'木',土:'火',金:'土',水:'金'};
  const 구신 = r.구신 || 생맵[기신] || '';
  const 한신 = r.한신 || '';
  const 일지 = r.원국.일주.지지;
  // 원국 4주 전체 (교차 관계 계산용)
  const 원국4주 = {
    년간: r.원국.년주.천간, 년지: r.원국.년주.지지,
    월간: r.원국.월주.천간, 월지: r.원국.월주.지지,
    일간: r.원국.일주.천간, 일지: r.원국.일주.지지,
    시간: r.원국.시주.천간, 시지: r.원국.시주.지지,
  };
  const 신살정보 = r.신살 || {};
  // 세운/대운 (교차 계산용)
  const 세운간지 = r.현재세운 ? { 천간: r.현재세운.천간, 지지: r.현재세운.지지 } : null;
  const 대운간지 = r.현재대운 ? { 천간: r.현재대운.천간, 지지: r.현재대운.지지 } : null;
  const luckyItems = getLuckyItems(용신);

  const targetYear = parseInt(M.발행연도) || 2026;

  // ── 생일 계산 (음력이면 해당 연도 양력 변환) ────
  let birthdayMonth = 0, birthdayDay = 0;
  try {
    if (M.음력입력) {
      const { _음력to양력 } = require('./saju_calc');
      if (_음력to양력) {
        const sol = _음력to양력({ 음력년: targetYear, 음력월: M.생월, 음력일: M.생일, 윤달: false });
        if (sol && !sol.오류) { birthdayMonth = sol.양력월 || sol.월; birthdayDay = sol.양력일 || sol.일; }
      }
    } else {
      birthdayMonth = M.생월;
      birthdayDay = M.생일;
    }
  } catch(e) {
    birthdayMonth = M.생월 || 0;
    birthdayDay = M.생일 || 0;
  }

  const 명절맵 = get명절(targetYear);

  // ── 12개월 달력 데이터 생성 (입춘 기준: 2월~다음해 1월) ─────────────────────
  const months = [];
  const monthOrder = [2,3,4,5,6,7,8,9,10,11,12,1]; // 입춘 기준
  for (const m of monthOrder) {
    const calYear = (m === 1) ? targetYear + 1 : targetYear;
    const daysInMonth = new Date(calYear, m, 0).getDate();
    const firstDow = new Date(calYear, m - 1, 1).getDay(); // 0=일

    const days = [];
    // 앞쪽 빈칸
    for (let i = 0; i < firstDow; i++) days.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const ij = getIljin(calYear, m, d);
      const score = calcDayScore(ij, 용신, 희신, 기신, 일간, 일지, 구신, 한신, 원국4주, 신살정보, 세운간지, 대운간지);
      const theme = getDayTheme(score, ij, 일간);
      const times = getLuckyTimes(ij, 용신, 희신);
      const dow = new Date(calYear, m - 1, d).getDay();
      const lunar = getLunarDate(calYear, m, d);
      const 절기 = get절기(calYear, m, d);
      const 기념일 = get기념일(calYear, m, d) || 명절맵[`${m}-${d}`] || '';
      const 공휴일목록 = new Set(['신정','삼일절','어린이날','현충일','광복절','개천절','한글날','성탄절','설날','설연휴','추석','추석연휴','석가탄신일']);
      const isHoliday = 공휴일목록.has(기념일);
      const isBirthday = (m === birthdayMonth && d === birthdayDay);
      const sonDay = isSonEomneunNal(d);

      // 길흉 판정 + 사유
      const tgOh = TG_OH[ij.tg];
      const jjOh = JJ_OH[ij.jj];
      // 길일·주의일 판정 — 종합 점수 우선 (용신 매칭만으로는 합·충·형으로 점수 깎인 날도 길일이 됨)
      // score 65 이상 + 용신 매칭 → 길일 (녹색) / score 40 이하 또는 기신 천+지 → 주의일
      const _ohLucky = tgOh === 용신 || jjOh === 용신;
      const _ohCaution = tgOh === 기신 && jjOh === 기신;
      const isLucky = score >= 65 && _ohLucky;
      const isCaution = score <= 40 || _ohCaution;

      // 사유 생성 》 천간 십성 + 지지별 구체 사유
      const 십성좋음 = {비겁:'체력↑',식상:'성과↑',재성:'재물↑',관성:'명예↑',인성:'인연↑'};
      const ilganOh = TG_OH[일간];
      const tgSS = getSipseong(ilganOh, tgOh);
      const jjSS = getSipseong(ilganOh, jjOh);

      // 기신 구체 주의사항 (지지별로 다르게)
      const 기신주의상세 = {
        子:'감정주의',丑:'체력주의',寅:'과로주의',卯:'구설주의',
        辰:'소화주의',巳:'혈압주의',午:'화주의',未:'판단주의',
        申:'부상주의',酉:'호흡주의',戌:'갈등주의',亥:'냉기주의'
      };
      const 기신천간주의 = {
        甲:'경쟁주의',乙:'우유부단',丙:'판단주의',丁:'감정주의',戊:'고집주의',
        己:'걱정주의',庚:'충돌주의',辛:'예민주의',壬:'방향주의',癸:'우울주의'
      };

      let reason = '';
      if (isCaution) {
        reason = `${기신주의상세[ij.jj]||'주의'}`;
      } else if (isLucky) {
        reason = `${십성좋음[tgSS]||''} ${십성좋음[jjSS]||''}`.trim();
      } else if (tgOh === 기신) {
        reason = `${십성좋음[jjSS]||''} ${기신천간주의[ij.tg]||''}`;
      } else if (jjOh === 기신) {
        reason = `${십성좋음[tgSS]||''} ${기신주의상세[ij.jj]||''}`;
      } else {
        reason = `${십성좋음[tgSS]||''} ${십성좋음[jjSS]||''}`.trim();
      }

      // 태그 결정 》 지지 관계 + 십성 + 복합 판정
      const 합쌍태그 = {甲:'己',己:'甲',乙:'庚',庚:'乙',丙:'辛',辛:'丙',丁:'壬',壬:'丁',戊:'癸',癸:'戊'};
      const is천간합 = 합쌍태그[일간] === ij.tg;

      // 일지와 일진 지지 관계 (일지는 상위 스코프에서 선언됨)
      const 육합맵 = {子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
      const 충맵 = {子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
      const is육합 = 육합맵[일지] === ij.jj;
      const is충 = 충맵[일지] === ij.jj;
      const is역마 = ['寅','申','巳','亥'].includes(ij.jj);
      const is도화 = ['子','午','卯','酉'].includes(ij.jj);
      const is대길 = (tgOh === 용신 && jjOh === 희신) || (tgOh === 희신 && jjOh === 용신);
      const is대주의 = isCaution && is충;

      // 재성 세분화: 편재(투자) vs 정재(저축)
      const tgSS상세 = getSipseong(ilganOh, tgOh);
      // 음양 같으면 편, 다르면 정
      const 양간목록 = ['甲','丙','戊','庚','壬'];
      const tg양 = 양간목록.includes(ij.tg);
      const il양 = 양간목록.includes(일간);
      const is편 = tg양 === il양;

      // 기신 판정 확장: 천간 또는 지지 중 하나만 기신이어도 주의
      const is기신일 = tgOh === 기신 || jjOh === 기신;
      const is구신일 = tgOh === 구신 || jjOh === 구신;

      // 해당하는 태그 모두 수집 (우선순위 순)
      const _tags = [];
      if (is대주의) _tags.push('⚠️대주의');
      if (is대길) _tags.push('🌟대길일');
      if (isCaution && !is대주의) _tags.push('⚠️흉일');
      if (sonDay) _tags.push('손없는날');
      if (is천간합 && is육합) _tags.push('최고의만남날');
      else if (is천간합) _tags.push('고백·계약좋은날');
      if (is충 && is기신일) _tags.push('큰변화주의');
      else if (is충) _tags.push('변화주의날');
      if (is육합 && !is천간합) _tags.push('만남좋은날');
      if (is역마) _tags.push('여행좋은날');
      if (isLucky && !is역마) _tags.push('이사하기좋은날');
      if (is도화) _tags.push('미용좋은날');
      if (is기신일 && !isCaution && !is대주의 && !is충) _tags.push('주의필요');
      if (!_tags.length) {
        if (tgSS === '재성' && is편) _tags.push('투자좋은날');
        else if (tgSS === '재성' && !is편) _tags.push('저축·구매좋은날');
        else if (tgSS === '식상' && is편) _tags.push('창작좋은날');
        else if (tgSS === '식상' && !is편) _tags.push('버리기·정리좋은날');
        else if (tgSS === '관성') _tags.push('면접·시험좋은날');
        else if (tgSS === '인성') _tags.push('공부좋은날');
        else if (tgSS === '비겁') _tags.push('건강챙기는날');
      }
      // 최대 2개까지 표시
      const tagText = _tags.slice(0, 2).join(' · ');

      // 인간관계 팁 》 지지관계 우선, 십성 보조
      const 형맵 = {寅:'巳',巳:'申',丑:'戌',戌:'未',未:'丑',子:'卯',卯:'子',辰:'辰',午:'午',酉:'酉',亥:'亥'};
      const is형 = 형맵[일지] === ij.jj;
      let relationTip = '';
      if (is충 && is형) relationTip = '갈등·구설주의';
      else if (is충) relationTip = '다툼주의';
      else if (is형) relationTip = '구설주의';
      else if (is천간합 && is육합) relationTip = '최고화합';
      else if (is육합) relationTip = '화합·좋은만남';
      else if (is천간합) relationTip = '협력좋음';
      else if (is도화) relationTip = '이성운';
      else if (tgSS === '식상') relationTip = '말조심';
      else if (tgSS === '비겁') relationTip = '경쟁조심';
      else if (tgSS === '관성') relationTip = '예의필요';
      else if (tgSS === '인성') relationTip = '귀인만남';
      else if (tgSS === '재성') relationTip = '사교좋음';

      // 행운색·행운방위 (일진 천간 오행 기준 》 매일 다름)
      const 천간색 = {甲:'진초록',乙:'연두',丙:'빨강',丁:'주황',戊:'노랑',己:'베이지',庚:'흰색',辛:'은색',壬:'파랑',癸:'검정'};
      const 오행방위활용 = {木:'동쪽',火:'남쪽',土:'중앙',金:'서쪽',水:'북쪽'};
      const luckyColor = 천간색[ij.tg] || '';
      const luckyDir = 오행방위활용[jjOh] || '';

      days.push({
        day: d, dow, score, theme, tagText, _tags, relationTip,
        iljin: `${ij.tg}${ij.jj}`,
        iljinKr: `${TG_KR[ij.tg]}${JJ_KR[ij.jj]}`,
        animal: JJ_ANIMAL[ij.jj] || '', lunar, 절기, 기념일, isHoliday, isBirthday,
        tgOh, jjOh, luckyColor, luckyDir,
        isLucky, isCaution, sonDay, reason,
        bestTimes: times.best,
        cautionTimes: times.caution,
      });
    }

    // 5행(35칸) 초과 시 넘치는 날짜를 overflow로 분리
    const overflow = days.length > 35 ? days.splice(35) : [];
    months.push({ month: m, year: calYear, days, overflow });
  }

  // 넘치는 날짜를 다음 달 앞쪽 빈칸에 삽입
  for (let i = 0; i < months.length; i++) {
    const prev = i > 0 ? months[i - 1] : null;
    if (prev && prev.overflow.length > 0) {
      // 다음 달 앞쪽 null 칸에 이전 달 overflow 날짜 삽입
      let oi = 0;
      for (let j = 0; j < months[i].days.length && oi < prev.overflow.length; j++) {
        if (months[i].days[j] === null) {
          const od = prev.overflow[oi];
          od.overflowLabel = `${prev.month}월${od.day}일`;
          months[i].days[j] = od;
          oi++;
        }
      }
    }
  }

  // ── HTML 생성 ─────────────────────────────────────
  function dayCell(d) {
    if (!d) return '<div class="day-cell empty"></div>';

    // 이전 달에서 넘어온 날짜
    if (d.overflowLabel) {
      const dowColor = d.isHoliday ? 'color:#c62828;' : d.dow === 0 ? 'color:#c62828;' : d.dow === 6 ? 'color:#1565c0;' : '';
      const scoreColor = d.score >= 80 ? '#2e7d32' : d.score >= 60 ? '#1565c0' : d.score >= 40 ? '#ff9800' : '#c62828';
      const scoreBg = d.score >= 80 ? '#e8f5e9' : d.score >= 60 ? '#e3f2fd' : d.score >= 40 ? '#fff3e0' : '#ffebee';
      const ov대특 = d._tags?.includes('⚠️대주의') || d._tags?.includes('🌟대길일');
      const ov이모지 = d._tags?.includes('⚠️대주의') ? '⚠️' : d._tags?.includes('🌟대길일') ? '🌟' : '';
      const ov나머지 = (d._tags || []).filter(t => t !== '⚠️대주의' && t !== '🌟대길일').slice(0, 2).join(' · ');
      return `<div class="day-cell overflow-cell">
  <div class="dc-top">
    <span class="dc-day dc-overflow" style="${dowColor}">${d.overflowLabel}</span>
    <span class="dc-score" style="color:${scoreColor};background:${scoreBg};">${d.score}</span>
  </div>
  <div class="dc-theme${ov대특?' dc-theme-bday':''}">${ov대특 ? ov이모지 : d.theme.icon}${d.절기 ? ` <span class="dc-jeolgi">${d.절기}</span>` : ''}</div>
  ${d.relationTip ? `<div class="dc-relation">${d.relationTip}</div>` : ''}
  <div class="dc-lucky">${d.luckyColor} ${d.luckyDir}</div>
  <div class="dc-tag" data-type="${ov대특 ? (ov나머지.split(' · ')[0]||'') : (d._tags?.[0]||d.tagText)}">${ov대특 ? ov나머지 : d.tagText}</div>
  <div class="dc-iljin">${d.iljin} ${d.iljinKr} ${d.animal}</div>
</div>`;
    }

    const scoreColor = d.score >= 80 ? '#2e7d32' : d.score >= 60 ? '#1565c0' : d.score >= 40 ? '#ff9800' : '#c62828';
    const scoreBg = d.score >= 80 ? '#e8f5e9' : d.score >= 60 ? '#e3f2fd' : d.score >= 40 ? '#fff3e0' : '#ffebee';
    const border = d.isBirthday ? 'border:2.5px solid #e91e63;background:#fce4ec;' : d.isCaution ? 'border:2px solid #c62828;background:#fff5f5;' : d.isLucky ? 'border:1.5px solid #2e7d32;background:#f1f8e9;' : '';
    const dowColor = d.isHoliday ? 'color:#c62828;' : d.dow === 0 ? 'color:#c62828;' : d.dow === 6 ? 'color:#1565c0;' : '';

    // 대주의/대길일은 생일처럼 중앙 큰 이모지로, 나머지 태그는 아래에
    const is대특 = d._tags?.includes('⚠️대주의') || d._tags?.includes('🌟대길일');
    const 대특이모지 = d._tags?.includes('⚠️대주의') ? '⚠️' : d._tags?.includes('🌟대길일') ? '🌟' : '';
    const 대특라벨 = d._tags?.includes('⚠️대주의') ? '대주의' : d._tags?.includes('🌟대길일') ? '대길일' : '';
    const 나머지태그 = (d._tags || []).filter(t => t !== '⚠️대주의' && t !== '🌟대길일').slice(0, 2).join(' · ');
    const themeIcon = d.isBirthday ? '🎂' : is대특 ? 대특이모지 : d.theme.icon;
    const themeClass = (d.isBirthday || is대특) ? ' dc-theme-bday' : '';
    const luckyArea = d.isBirthday ? '<span class="dc-bday-label">생일축하</span>' : is대특 ? `<span class="dc-bday-label" style="color:${d._tags?.includes('⚠️대주의')?'#c62828':'#2e7d32'};">${대특라벨}</span>` : `${d.luckyColor} ${d.luckyDir}`;
    const tagArea = d.isBirthday ? '' : is대특 ? 나머지태그 : d.tagText;
    const tagType = is대특 ? (나머지태그.split(' · ')[0] || '') : (d._tags?.[0] || d.tagText);

    return `<div class="day-cell" style="${border}">
  <div class="dc-top">
    <span class="dc-day" style="${dowColor}">${d.day}</span>${d.lunar ? `<span class="dc-lunar">${d.lunar}</span>` : ''}
    <span class="dc-score" style="color:${scoreColor};background:${scoreBg};">${d.score}</span>
  </div>
  <div class="dc-theme${themeClass}">${themeIcon}${d.절기 ? ` <span class="dc-jeolgi">${d.절기}</span>` : ''}${d.기념일 ? ` <span class="dc-event${d.isHoliday ? ' dc-holiday' : ''}">${d.기념일}</span>` : ''}</div>
  ${d.relationTip ? `<div class="dc-relation">${d.relationTip}</div>` : ''}
  <div class="dc-lucky">${luckyArea}</div>
  <div class="dc-tag" data-type="${tagType}">${tagArea}</div>
  <div class="dc-iljin">${d.iljin} ${d.iljinKr} ${d.animal}</div>
</div>`;
  }

  function monthHTML(mData) {
    const monthNames = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const rows = [];
    for (let i = 0; i < mData.days.length; i += 7) {
      const week = mData.days.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      rows.push(`<div class="week-row">${week.map(dayCell).join('')}</div>`);
    }

    // 월성격 + 12운성 계산
    const { 월운목록계산, 십이운성계산 } = require('./saju_calc');
    const _월운 = 월운목록계산(targetYear, (r.현재세운||{}).천간 || '甲');
    const _이달월운 = _월운.find(w => w.월 === mData.month);
    let _월성격 = '', _월성격아이콘 = '', _월성격색 = '';
    if (_이달월운) {
      const _to = TG_OH[_이달월운.천간], _jo = JJ_OH[_이달월운.지지];
      if (_to===용신||_jo===용신) { _월성격='용신월'; _월성격아이콘='🟢'; _월성격색='#2e7d32'; }
      else if (_to===희신||_jo===희신) { _월성격='희신월'; _월성격아이콘='🔵'; _월성격색='#1565c0'; }
      else if (_to===기신||_jo===기신) { _월성격='기신월'; _월성격아이콘='🔴'; _월성격색='#c62828'; }
      else { _월성격='중립월'; _월성격아이콘='⚪'; _월성격색='#757575'; }
    }
    const _12운성 = 십이운성계산 ? (십이운성계산(일간, _이달월운?.지지 || '子') || '') : '';

    return `<div class="month-page">
  <div class="cal-wrap">
  <div class="month-hdr">
    <div class="month-hdr-left">
      <div class="month-name">${monthNames[mData.month]}</div>
      <div class="month-year">${mData.year}</div>
    </div>
    <div class="month-hdr-right">
      <div class="month-hdr-name">${esc(name)} 님</div>
      <div>용신 ${용신}(${OH_KR[용신]}) · ${r.원국.일주.천간}${r.원국.일주.지지} 일주</div>
      <div style="margin-top:2px;font-weight:700;color:${_월성격색};">${_월성격아이콘} ${_월성격} · ${_12운성 ? _12운성+'('+({장생:'상승',목욕:'불안정',관대:'성장',건록:'최강',제왕:'정점',쇠:'하강',병:'약화',사:'종결',묘:'축적',절:'단절',태:'잉태',양:'준비'}[_12운성]||'')+')' : ''}</div>
    </div>
  </div>
  <div class="dow-row">
    <div class="dow sun">일</div><div class="dow">월</div><div class="dow">화</div>
    <div class="dow">수</div><div class="dow">목</div><div class="dow">금</div>
    <div class="dow sat">토</div>
  </div>
  <div class="weeks">${rows.join('\n')}</div>
  <div class="month-footer">
    <span class="mf-item"><span style="display:inline-block;width:10px;height:10px;border:2px solid #2e7d32;background:#f1f8e9;border-radius:2px;"></span> 길일</span>
    <span class="mf-item"><span style="display:inline-block;width:10px;height:10px;border:2px solid #c62828;background:#fff5f5;border-radius:2px;"></span> 주의일</span>
    <span class="mf-item">💪체력충전 🏆성과발휘 💰재물기회 📋직업명예 💘인연소통</span>
    <span class="mf-item">행운색: ${luckyItems.colors.join(' · ')}</span>
    <span class="mf-item">코디: ${luckyItems.items.join(' · ')}</span>
  </div>
  </div>
</div>`;
  }

  const CSS = `<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;background:#f5f5f5;}

/* 표지 */
.calendar-cover{ border:1px solid #333;width:604px;height:840px;margin:10px auto;background:linear-gradient(160deg,#0d1b3e 0%,#1a237e 30%,#283593 60%,#3949ab 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:white;page-break-after:always;position:relative;overflow:hidden;}
.calendar-cover::before{content:'';position:absolute;top:-80px;right:-80px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(255,213,79,.15),transparent 70%);}
.calendar-cover::after{content:'';position:absolute;bottom:-60px;left:-60px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(66,165,245,.1),transparent 70%);}
.cc-top{position:relative;z-index:1;margin-bottom:20px;}
.cc-year{font-size:72pt;font-weight:900;letter-spacing:10px;line-height:1;background:linear-gradient(180deg,#ffffff,#e0e0e0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:none;}
.cc-title{font-size:14pt;font-weight:600;letter-spacing:6px;margin-top:6px;color:rgba(255,255,255,.6);text-transform:uppercase;}
.cc-divider{width:120px;height:2px;background:linear-gradient(90deg,transparent,#ffd54f,transparent);margin:20px auto;position:relative;z-index:1;}
.cc-middle{position:relative;z-index:1;margin-bottom:24px;}
.cc-sub{font-size:10pt;color:rgba(255,255,255,.5);margin-bottom:16px;letter-spacing:2px;}
.cc-name{font-size:26pt;font-weight:900;background:linear-gradient(90deg,#ffd54f,#ffecb3,#ffd54f);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:3px;}
.cc-saju-box{margin-top:18px;display:inline-flex;gap:0;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.2);}
.cc-pillar{display:flex;flex-direction:column;align-items:center;width:70px;}
.cc-pillar-label{font-size:7pt;color:rgba(255,255,255,.4);padding:4px 0 2px;background:rgba(255,255,255,.05);width:100%;}
.cc-pillar-tg{font-size:16pt;font-weight:800;padding:4px 0 0;line-height:1.2;}
.cc-pillar-jj{font-size:16pt;font-weight:800;padding:0 0 4px;line-height:1.2;}
.cc-pillar-kr{font-size:7pt;color:rgba(255,255,255,.5);padding-bottom:4px;}
.cc-tags{margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;position:relative;z-index:1;}
.cc-tag{font-size:8.5pt;padding:5px 14px;border-radius:20px;font-weight:700;}
.cc-tag.yong{background:rgba(255,213,79,.2);color:#ffd54f;border:1px solid rgba(255,213,79,.3);}
.cc-tag.hui{background:rgba(129,212,250,.15);color:#81d4fa;border:1px solid rgba(129,212,250,.25);}
.cc-tag.gangyak{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.15);}
.cc-bottom{position:relative;z-index:1;margin-top:24px;}
.cc-legend{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}
.cc-leg-item{font-size:7.5pt;padding:4px 10px;border-radius:12px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.6);}
.cc-footer-note{font-size:7pt;color:rgba(255,255,255,.3);margin-top:12px;}

/* A4 월 페이지 */
.month-page{ border:1px solid #333;width:604px;height:840px;padding:10px;margin:10px auto;background:transparent;overflow:hidden;display:flex;flex-direction:column;page-break-after:always;}
.cal-wrap{border:1.5px solid #888;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;flex:1;}
.month-hdr{background:linear-gradient(135deg,#1a237e,#283593);padding:12px 25px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.month-hdr-left{display:flex;align-items:baseline;gap:10px;}
.month-name{font-size:24pt;font-weight:900;color:white;}
.month-year{font-size:10pt;color:rgba(255,255,255,.7);}
.month-hdr-right{font-size:8pt;color:rgba(255,255,255,.7);text-align:right;}
.month-hdr-name{font-size:10pt;font-weight:800;background:linear-gradient(90deg,#ffd54f,#fff176);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}

/* 요일 헤더 */
.dow-row{display:grid;grid-template-columns:repeat(7,1fr);background:#f5f5f5;border-bottom:2px solid #bbb;flex-shrink:0;}
.dow{text-align:center;font-size:11pt;font-weight:700;color:#555;padding:6px 0;}
.dow.sun{color:#c62828;} .dow.sat{color:#1565c0;}

/* 주 그리드 */
.weeks{flex:1;display:flex;flex-direction:column;}
.week-row{display:grid;grid-template-columns:repeat(7,1fr);flex:1;border-bottom:1px solid #bbb;}
.week-row:last-child{border-bottom:none;}

/* 일별 셀 》 A4 여유 공간 활용 */
.day-cell{padding:3px 5px;border-right:1px solid #bbb;position:relative;display:flex;flex-direction:column;gap:1px;overflow:hidden;}
.day-cell:last-child{border-right:none;}
.day-cell.empty{background:#fafafa;}
.overflow-cell{background:#f7f7f7;}
.overflow-cell .dc-day,.overflow-cell .dc-theme,.overflow-cell .dc-lucky,.overflow-cell .dc-reason,.overflow-cell .dc-tag,.overflow-cell .dc-iljin{opacity:.5;}
.dc-day.dc-overflow{font-size:8.5pt;font-weight:700;white-space:nowrap;}

.dc-top{display:flex;align-items:center;justify-content:space-between;width:100%;}
.dc-day{font-size:12pt;font-weight:800;}
.dc-score{font-size:7pt;font-weight:700;padding:2px 5px;border-radius:4px;}
.dc-theme{font-size:10pt;line-height:1;}
.dc-jeolgi{font-size:7pt;color:#d32f2f;font-weight:700;vertical-align:middle;}
.dc-event{font-size:6.5pt;color:#1565c0;font-weight:700;vertical-align:middle;}
.dc-event.dc-holiday{color:#c62828;}
.dc-relation{font-size:6pt;color:#6a1b9a;text-align:center;font-weight:600;margin-top:auto;line-height:1.2;word-break:keep-all;padding:0 1px;}
.dc-iljin{font-size:7pt;font-weight:700;color:#888;width:100%;text-align:center;line-height:1.2;word-break:keep-all;}
.dc-lunar{font-size:6pt;color:#aaa;}
.dc-birthday{font-size:8pt;margin-left:1px;}
.dc-theme-bday{font-size:20pt;text-align:center;line-height:1;}
.dc-bday-label{font-size:7pt;color:#e91e63;font-weight:800;text-align:center;}
.dc-badge{position:absolute;bottom:3px;right:4px;font-size:8pt;}
.dc-lucky{font-size:5.5pt;color:#555;text-align:center;font-weight:600;line-height:1.2;word-break:keep-all;max-width:100%;padding:0 1px;}
.dc-reason{font-size:6pt;color:#555;line-height:1.2;padding:1px 2px;border-radius:2px;width:100%;text-align:center;font-weight:600;word-break:keep-all;}
.dc-reason.good{color:#2e7d32;}
.dc-reason.bad{color:#c62828;}
.dc-tag{font-size:6pt;font-weight:700;min-height:9px;text-align:center;line-height:1.2;word-break:keep-all;margin:0;padding:0;}
.dc-tag:empty{visibility:hidden;}
.dc-tag[data-type="손없는날"]{color:#2e7d32;}
.dc-tag[data-type="고백·계약좋은날"]{color:#e91e63;}
.dc-tag[data-type="최고의만남날"]{color:#e91e63;font-weight:900;}
.dc-tag[data-type="이사하기좋은날"]{color:#2e7d32;}
.dc-tag[data-type="투자좋은날"]{color:#e65100;}
.dc-tag[data-type="저축·구매좋은날"]{color:#ff8f00;}
.dc-tag[data-type="버리기·정리좋은날"]{color:#00838f;}
.dc-tag[data-type="창작좋은날"]{color:#00838f;}
.dc-tag[data-type="면접·시험좋은날"]{color:#1565c0;}
.dc-tag[data-type="공부좋은날"]{color:#6a1b9a;}
.dc-tag[data-type="건강챙기는날"]{color:#388e3c;}
.dc-tag[data-type="만남좋은날"]{color:#e91e63;}
.dc-tag[data-type="여행좋은날"]{color:#0097a7;}
.dc-tag[data-type="미용좋은날"]{color:#ad1457;}
.dc-tag[data-type="변화주의날"]{color:#e65100;}
.dc-tag[data-type="큰변화주의"]{color:#c62828;}
.dc-tag[data-type="🌟대길일"]{color:#2e7d32;font-weight:900;}
.dc-tag[data-type="⚠️대주의"]{color:#c62828;font-weight:900;}
.dc-tag[data-type="⚠️흉일"]{color:#c62828;font-weight:700;}
.dc-tag[data-type="주의필요"]{color:#e65100;}
.dc-times{font-size:6pt;color:#555;margin-top:auto;}
.dc-time-good{color:#2e7d32;}
.dc-time-bad{color:#c62828;}

/* 하단 범례 */
.month-footer{padding:6px 15px;background:#f9f9f9;border-top:1px solid #bbb;display:flex;align-items:center;gap:10px;font-size:7pt;color:#888;flex-shrink:0;}
.mf-item{display:flex;align-items:center;gap:3px;}

@media screen{.calendar-cover,.month-page{ border:1px solid #333;border-radius:4px;}}
@media print{
  body{background:transparent;}
  .calendar-cover,.month-page{ border:1px solid #333;margin:0 auto;border-radius:0;}
  .calendar-cover{ border:1px solid #333;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}
  .calendar-cover::before,.calendar-cover::after{display:none;}
  .cc-year{-webkit-text-fill-color:white;background:none;color:white;}
  .cc-name{-webkit-text-fill-color:#ffd54f;background:none;color:#ffd54f;}
  .month-hdr-name{-webkit-text-fill-color:#ffd54f;background:none;color:#ffd54f;}
  .cc-pillar-tg,.cc-pillar-jj{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .cc-saju-box{border-color:rgba(255,255,255,.4);}
  .cc-tag{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .cal-wrap,.month-hdr,.dow-row,.weeks,.month-footer,.week-row{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .day-cell,.dc-score,.dc-reason,.dc-tag,.dc-lucky,.dc-iljin,.dc-theme,.overflow-cell,.day-cell.empty{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .month-page{ border:1px solid #333;overflow:visible;page-break-inside:avoid;}
  body{display:flex;flex-direction:column;align-items:center;}
  @page{size:A4;margin:15mm;}
}
</style>`;

  // 표지
  const 원국 = r.원국;
  const pillars = [
    { label:'시주', tg: 원국.시주?.천간||'', jj: 원국.시주?.지지||'' },
    { label:'일주', tg: 원국.일주.천간, jj: 원국.일주.지지 },
    { label:'월주', tg: 원국.월주.천간, jj: 원국.월주.지지 },
    { label:'년주', tg: 원국.년주.천간, jj: 원국.년주.지지 },
  ];
  const pillarHTML = pillars.map(p => {
    if (!p.tg) return '';
    const tgC = OH_COLOR[TG_OH[p.tg]] || '#fff';
    const jjC = OH_COLOR[JJ_OH[p.jj]] || '#fff';
    return `<div class="cc-pillar">
      <div class="cc-pillar-label">${p.label}</div>
      <div class="cc-pillar-tg" style="color:${tgC}">${p.tg}</div>
      <div class="cc-pillar-jj" style="color:${jjC}">${p.jj}</div>
      <div class="cc-pillar-kr">${TG_KR[p.tg]||''}${JJ_KR[p.jj]||''}</div>
    </div>`;
  }).join('');

  const 강약 = r.신강여부 || '';
  const coverHTML = `<div class="calendar-cover">
  <div class="cc-top">
    <div class="cc-year">${targetYear}</div>
    <div class="cc-title">FORTUNE CALENDAR</div>
  </div>
  <div class="cc-divider"></div>
  <div class="cc-middle">
    <div class="cc-sub">당신만을 위한 맞춤 운세 달력</div>
    <div class="cc-name">${esc(name)}</div>
    <div class="cc-saju-box">${pillarHTML}</div>
  </div>
  <div class="cc-tags">
    <span class="cc-tag yong">용신 ${용신}(${OH_KR[용신]})</span>
    <span class="cc-tag hui">희신 ${희신}(${OH_KR[희신]})</span>
    ${강약 ? `<span class="cc-tag gangyak">${강약}</span>` : ''}
  </div>
  <div class="cc-bottom">
    <div class="cc-legend">
      <span class="cc-leg-item" style="border:1px solid rgba(76,175,80,.5);">■ 길일</span>
      <span class="cc-leg-item" style="border:1px solid rgba(198,40,40,.5);">■ 주의일</span>
      <span class="cc-leg-item">💪체력 🏆성과 💰재물 📋명예 💘인연</span>
    </div>
    <div class="cc-footer-note">점수가 높을수록 좋은 날 · 사주명리학 기반 개인 맞춤 분석</div>
  </div>
</div>`;

  // 저장 디렉토리 준비
  const slotTablesDir = path.join(path.dirname(masterPath), 'tables');
  if (!fs.existsSync(slotTablesDir)) fs.mkdirSync(slotTablesDir, { recursive: true });
  const outDir2 = path.join(TABLES_DIR, path.basename(path.dirname(masterPath)));
  if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });

  // 커버 페이지 저장
  const coverFullHTML = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${targetYear} 운세 달력 커버 》 ${esc(name)}님</title>${CSS}</head><body>${coverHTML}</body></html>`;
  fs.writeFileSync(path.join(slotTablesDir, '운세달력_표지.html'), coverFullHTML, 'utf-8');
  fs.writeFileSync(path.join(outDir2, '운세달력_표지.html'), coverFullHTML, 'utf-8');

  // 월별 개별 파일 저장
  let totalBytes = Buffer.byteLength(coverFullHTML, 'utf-8');
  for (let i = 0; i < months.length; i++) {
    const mData = months[i];
    const mHTML = monthHTML(mData);
    const monthNum = mData.month;
    const fullHTML = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${targetYear} ${monthNum}월 운세 》 ${esc(name)}님</title>${CSS}</head><body>${mHTML}</body></html>`;
    const fname = `운세달력_${String(monthNum).padStart(2,'0')}월.html`;
    fs.writeFileSync(path.join(slotTablesDir, fname), fullHTML, 'utf-8');
    fs.writeFileSync(path.join(outDir2, fname), fullHTML, 'utf-8');
    totalBytes += Buffer.byteLength(fullHTML, 'utf-8');
  }

  // 전체 통합본도 유지 (인쇄용)
  const allMonths = months.map(monthHTML).join('\n');
  const fullAllHTML = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${targetYear} 운세 달력 》 ${esc(name)}님</title>${CSS}</head><body>${coverHTML}${allMonths}</body></html>`;
  fs.writeFileSync(path.join(slotTablesDir, '운세달력_전체.html'), fullAllHTML, 'utf-8');
  fs.writeFileSync(path.join(outDir2, '운세달력_전체.html'), fullAllHTML, 'utf-8');

  console.log(`✅ 운세달력 생성: ${path.join(slotTablesDir, '운세달력*.html')}  (${totalBytes.toLocaleString()}B)`);
  console.log(`📅 ${targetYear}년 12개월 · ${esc(name)} 님 맞춤`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_운세달력.js <slot_id 또는 슬롯폴더경로>'); process.exit(1); }
generate(slotId);
