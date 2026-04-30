#!/usr/bin/env node
// generate_연간운세요약표.js  》  연간 운세 요약표 (A4 full page)
// 입력: queue/{slot}_ch09.json
// 출력: tables/{slot}/연간운세요약표.html

'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const slot = process.argv[2];
if (!slot) { console.error('Usage: node generate_연간운세요약표.js <slot>'); process.exit(1); }

const BASE = path.join(__dirname, 'queue');

function loadJSON(name) {
  const fp = path.join(BASE, `${slot}_${name}.json`);
  if (!fs.existsSync(fp)) { console.error(`❌ 없음: ${fp}`); process.exit(1); }
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

const d9 = loadJSON('ch09');

// ch03 로딩 (인적사항)
const CH03_PATH = path.join(BASE, `${slot}_ch03.json`);
const d3 = fs.existsSync(CH03_PATH) ? JSON.parse(fs.readFileSync(CH03_PATH,'utf8')) : {};

// ── saju_calc 직접 계산 (정확한 값 보장) ──────────────────────
let _calcResult = null;
try {
  const { 전체사주계산 } = require('./saju_calc');
  let _masterPath = path.join(BASE, `${slot}_master.json`);
  if (!fs.existsSync(_masterPath)) _masterPath = path.join(BASE, slot, 'master.json');
  if (!fs.existsSync(_masterPath)) {
    const _sd = path.dirname(path.join(BASE, `${slot}_ch03.json`));
    if (fs.existsSync(_sd)) {
      const _g = fs.readdirSync(_sd).filter(f => f === 'master.json');
      if (_g.length) _masterPath = path.join(_sd, _g[0]);
    }
  }
  if (fs.existsSync(_masterPath)) {
    const _M = JSON.parse(fs.readFileSync(_masterPath, 'utf8'));
    if (_M.생년) {
      _calcResult = 전체사주계산({이름:_M.이름, 성별:_M.성별, 년:_M.생년, 월:_M.생월, 일:_M.생일, 시간: _M.생시||'모름', 음력입력:!!_M.음력입력, 윤달:!!_M.윤달, self_q1: _M.self_q1, self_q2: _M.self_q2, self_q3: _M.self_q3, self_q4: _M.self_q4, self_q5: _M.self_q5, self_q6: _M.self_q6, self_q7: _M.self_q7,
});
    }
  }
} catch(e) { /* saju_calc 실패 시 기존 ch*.json 값 사용 */ }

// saju_calc 결과로 핵심 값 보정
if (_calcResult) {
  const _oh = {木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'};
  if (_calcResult.용신) d9['용신오행'] = _oh[_calcResult.용신] || _calcResult.용신;
  if (_calcResult.희신) d9['희신오행'] = _oh[_calcResult.희신] || _calcResult.희신;
  if (_calcResult.기신) d9['기신오행'] = _oh[_calcResult.기신] || _calcResult.기신;
}

// ── 기본 정보 ────────────────────────────────────────────────────
const NAME     = d3['이름']        || d9['이름']    || '';
const BIRTH_S  = d3['birth_solar'] || d3['생년월일'] || '';
const GENDER   = d3['user_gender'] || d3['성별']    || '';
const AGE      = d3['user_age']    || d3['나이']    || '';
const ILJU     = d3['일주']        || d9['일주']    || '';
const YONG_OH  = d9['용신오행'] || '';          // "木(목)"
const SEUN_GJ  = d9['세운간지']|| '';           // "丙午(병오)"
const YEAR     = d9['올해']    || new Date().getFullYear();
const BYEONG_OH= d9['기신오행']|| '';
const HUI_OH   = d9['희신오행']|| '';

// 오행 한글 추출: "木(목)" → "목"
function ohHangul(str) {
  const m = str.match(/\(([^)]+)\)/);
  return m ? m[1] : str;
}
// 오행 한자 추출: "木(목)" → "木"
function ohHanja(str) {
  const m = str.match(/^([木火土金水])/);
  return m ? m[1] : '';
}
// 오행 → key
function ohKey(str) {
  const c = ohHanja(str);
  const map={'木':'wood','火':'fire','土':'earth','金':'metal','水':'water'};
  if (map[c]) return map[c];
  // fallback: 첫 글자 한글로 매핑
  const first = (str || '').charAt(0);
  const krMap={'목':'wood','화':'fire','토':'earth','금':'metal','수':'water'};
  return krMap[first] || '';
}

const YONG_KEY = ohKey(YONG_OH);
const HUI_KEY  = ohKey(HUI_OH);
const BYEONG_KEY = ohKey(BYEONG_OH);

const OH_COLOR = { wood:'#4caf50', fire:'#f44336', earth:'#ff9800', metal:'#9e9e9e', water:'#2196f3' };
const SCORE_COLOR_MAP = {
  yongsin:  '#f44336',
  huisin:   '#ff9800',
  chungnip: '#4caf50',
  joojui:   '#9e9e9e',
};

// 세운간지 성격 (세운에서 용신 여부)
const SEUN_SEONGGYEOK = d9['세운성격'] || '';

// ── 월 데이터 수집 ────────────────────────────────────────────────
const MONTHS = [];
const ENAMES = ['','JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const EMOJIS = ['','🌨️','🌱','🌸','🌿','🔥','☀️','🌻','🍂','🌾','🍁','❄️','🎄'];
const THEMES = ['','준비의 달','시작의 달','도약의 달','성장의 달','열정의 달',
                '전성기의 달','결실의 달','내실의 달','성찰의 달','변화의 달','준비의 달','감사의 달'];

for (let i = 1; i <= 12; i++) {
  const m = d9[`월운_${i}월`];
  if (!m) continue;
  MONTHS.push({
    num:    i,
    ename:  ENAMES[i],
    emoji:  EMOJIS[i],
    theme:  THEMES[i],
    gj:     m['간지']       || '',
    score:  m['운세강도']   || 0,
    seong:  m['성격']       || '',
    julggi: m['절기']       || '',
    strat:  (m['활동전략']  || '').replace(/<[^>]+>/g, '').trim(),
    top:    (m['최고날목록'] || []),
    warn:   (m['조심날목록'] || []),
  });
}

// ── 연간 통계 ─────────────────────────────────────────────────────
const scores = MONTHS.map(m=>m.score);
const avgScore = (scores.reduce((a,b)=>a+b,0) / scores.length).toFixed(1);
const maxScore = Math.max(...scores);
const minScore = Math.min(...scores);
const topMonths  = MONTHS.filter(m=>m.score === maxScore).map(m=>m.num+'월').join('·');
const warnMonths = MONTHS.filter(m=>m.score === minScore).map(m=>m.num+'월').join('·');
// 핵심전략 (상위 구간)
const highMonths = MONTHS.filter(m=>m.score >= 80).map(m=>m.num);
const stratPeriod = highMonths.length > 0
  ? `${Math.min(...highMonths)}~${Math.max(...highMonths)}월 적극 행동`
  : '용신 활성기 집중';

// ── 총평/전략/3번째 행 텍스트 생성 ──────────────────────────────────
const OH_NAME = { wood:'木(목)', fire:'火(화)', earth:'土(토)', metal:'金(금)', water:'水(수)' };
const HEALTH_BY_OH = {
  wood:  '간·담 계통 주의. 스트레스 관리.',
  fire:  '심장·소장 계통 주의. 과로 금물.',
  earth: '위·비장 계통 주의. 소화 관리.',
  metal: '폐·대장 주의. 호흡기 관리.',
  water: '신장·방광 주의. 보온 필수.',
};
const THIRD_LABELS = ['건강','재물','인연','가족','재물','건강','인연','건강','재물','건강','재물','인연'];
const THIRD_COLORS = ['#4caf50','#2196f3','#4caf50','#4caf50','#2196f3','#4caf50','#4caf50','#4caf50','#2196f3','#4caf50','#2196f3','#4caf50'];

const THIRD_TEXT_YONG = {
  건강: `에너지 충만. 과로만 주의. ${HEALTH_BY_OH[YONG_KEY] || '건강 관리 우선.'}`,
  재물: `수입 극대화 구간. 재물 활동 집중. 과욕 금물.`,
  인연: `귀인 만남 가능성 높음. 새 인연에 열린 자세.`,
  가족: `가정 화합 좋음. 소중한 관계 챙기기.`,
};
const THIRD_TEXT_HUI = {
  건강: `안정적 컨디션. 꾸준한 관리 유지.`,
  재물: `새 수입원 발굴 가능. 씨앗 심는 달.`,
  인연: `기존 인연 강화·회복. 관계 화해 좋은 시기.`,
  가족: `가족 소통 원활. 따뜻한 교류.`,
};
const THIRD_TEXT_BYEONG = {
  건강: HEALTH_BY_OH[BYEONG_KEY] || '건강 검진 권장.',
  재물: `지출 통제. 안정 자산 위주 관리.`,
  인연: `갈등 회피. 기존 관계 유지에 집중.`,
  가족: `가정 내 충돌 주의. 감정 조절 필요.`,
};
const THIRD_TEXT_NEUTRAL = {
  건강: `보통 컨디션. 규칙적 생활 권장.`,
  재물: `연말·연초 계획 수립. 무리한 소비 자제.`,
  인연: `소중한 인연 점검·정리.`,
  가족: `가족 소통 유지. 감사 표현하기.`,
};

function getThirdText(seong, idx) {
  const lbl = THIRD_LABELS[idx];
  if (seong.includes('용신')) return THIRD_TEXT_YONG[lbl]   || '';
  if (seong.includes('희신')) return THIRD_TEXT_HUI[lbl]    || '';
  if (seong.includes('기신')) return THIRD_TEXT_BYEONG[lbl] || '';
  return THIRD_TEXT_NEUTRAL[lbl] || '';
}

// 총평 텍스트
const OPT_OH = {
  용신월: () => `${OH_NAME[YONG_KEY]} 기운 활성화. 용신 발휘 최적 구간. 적극적 행동 권장.`,
  희신월: () => `${OH_NAME[HUI_KEY]} 기운 상승. 용신 지원 활성화. 안정적 성장세.`,
  기신월: () => `⚠️ ${OH_NAME[BYEONG_KEY]} 기운 강화. 기신(忌神) 활성화. 무리한 행동 자제.`,
  중립월: () => '중립 기운. 내실 다지기·학습·준비에 집중.',
};

function getTotalPyeong(seong) {
  for (const [k, fn] of Object.entries(OPT_OH)) {
    if (seong.includes(k.replace('월',''))) return fn();
  }
  return '복합 기운. 상황 점검 후 신중히 행동.';
}

// 점수 등급 라벨·색상
function gradeLabel(score) {
  if (score >= 90) return { text:'★ 최고',   color:'#f44336' };
  if (score >= 80) return { text:'▲ 양호',   color:'#ff9800' };
  if (score >= 65) return { text:'▶ 안정',   color:'#4caf50' };
  if (score >= 50) return { text:'● 보통',   color:'#9e9e9e' };
  return               { text:'▼ 주의',   color:'#9e9e9e' };
}

function scoreBarColor(score) {
  if (score >= 90) return '#f44336';
  if (score >= 80) return '#ff9800';
  if (score >= 65) return '#4caf50';
  return '#9e9e9e';
}

// 월 숫자색 (천간 오행)
const GJ_COLOR_MAP = {
  甲:'#4caf50',乙:'#4caf50',
  丙:'#f44336',丁:'#f44336',
  戊:'#ff9800',己:'#ff9800',
  庚:'#9e9e9e',辛:'#9e9e9e',
  壬:'#2196f3',癸:'#2196f3',
};
function monthNumColor(gj) {
  const hanja = gj.charAt(0);
  return GJ_COLOR_MAP[hanja] || '#212121';
}

// ── 길일/주의일 chips HTML ────────────────────────────────────────
function dayChips(days, color, max) {
  const limited = days.slice(0, max);
  if (!limited.length) return `<span class="no-day">— 없음</span>`;
  return limited.map(x=>`<span class="day-chip" style="background:${color};">${x.d}일</span>`).join('');
}

// ── 월 행 HTML ────────────────────────────────────────────────────
function buildMonthRow(m, idx) {
  const grade   = gradeLabel(m.score);
  const barColor= scoreBarColor(m.score);
  const barW    = m.score;
  const numCol  = monthNumColor(m.gj);
  const thirdLbl= THIRD_LABELS[idx];
  const thirdCol= THIRD_COLORS[idx];
  const totalTxt= getTotalPyeong(m.seong);
  const thirdTxt= getThirdText(m.seong, idx);
  const stratTxt= m.strat.replace(/^[^\。.]+[。.]\s*/, ''); // 운성 앞부분 제거
  const seongLbl= m.seong.includes('용신') ? '용신월 전략' :
                  m.seong.includes('희신') ? '희신월 전략' :
                  m.seong.includes('기신') ? '기신월 전략' : '중립월 전략';

  // rowBg
  let rowStyle = '';
  if (m.seong.includes('용신') && m.score >= 90) rowStyle = ' style="background:rgba(244,67,54,0.04);"';
  else if (m.seong.includes('기신')) rowStyle = ' style="background:rgba(158,158,158,0.06);"';

  // 연중 1위 표시
  const isTop = m.score === maxScore;
  const gradeText = isTop ? '★ 연중1위' : grade.text;

  // 길일 상위 4개만, 조심날 상위 3개만
  const topChips  = m.top.length ? dayChips(m.top, '#f44336', 4)  : `<span class="no-day">— 없음</span>`;
  const warnChips = m.warn.length? dayChips(m.warn,'#9e9e9e', 3) : `<span class="no-day">— 없음</span>`;

  // 전략 텍스트 (활동전략에서 정제)
  const cleanStrat = m.strat
    .replace(/^.*?月\s*[^\s]*\.\s*/, '')   // "용신月 장생. " 등 앞부분 제거
    .trim();
  const stratDisplay = cleanStrat || m.strat;

  return `
    <tr${rowStyle}>
      <td><div class="m-col"><div class="m-num" style="color:${numCol};">${m.num}</div><div><div class="m-ename">${m.ename}</div><div class="m-emoji">${m.emoji}</div><div class="m-theme">${m.theme}</div></div></div></td>
      <td><div class="s-col"><div class="s-num" style="color:${barColor};">${m.score.toFixed(1)}</div><div class="s-wrap"><div class="s-bar" style="width:${barW}%;background:${barColor};"></div></div><div class="s-grade" style="color:${barColor};">${gradeText}</div></div></td>
      <td>
        <div class="sum-row"><span class="sum-lbl" style="background:#9e9e9e;">총평</span><span class="sum-txt">${totalTxt}</span></div>
        <div class="sum-row"><span class="sum-lbl" style="background:#ff9800;">전략</span><span class="sum-txt">${stratDisplay}</span></div>
        <div class="sum-row"><span class="sum-lbl" style="background:${thirdCol};">${thirdLbl}</span><span class="sum-txt">${thirdTxt}</span></div>
      </td>
      <td>
        <div class="days-sec"><div class="days-lbl" style="color:#f44336;">🌟 길일</div><div class="days-chips">${topChips}</div></div>
        <div class="days-sec"><div class="days-lbl" style="color:#9e9e9e;">⚠️ 주의</div><div class="days-chips">${warnChips}</div></div>
      </td>
    </tr>`;
}

// ── 바 차트 HTML ──────────────────────────────────────────────────
function buildBarChart() {
  const cols = MONTHS.map(m => {
    const color = scoreBarColor(m.score);
    const h = m.score;
    const isTop = m.score === maxScore;
    const topMark = isTop
      ? `<span style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:7pt;color:#f44336;font-weight:900;white-space:nowrap;">🌟</span>`
      : '';
    return `    <div class="chart-col"><div class="chart-bwrap"><div class="chart-bar" style="height:${h}%;background:${color};position:relative;">${topMark}</div></div><div class="c-s" style="color:${color};">${Math.round(m.score)}</div><div class="c-m">${m.num}월</div></div>`;
  });
  return cols.join('\n');
}

// ── 칩 섹션 ────────────────────────────────────────────────────────
const seunSeong = SEUN_SEONGGYEOK || (d9['세운성격'] ? d9['세운성격'] : '');
const chipSubSeun = seunSeong ? `${seunSeong}` : `세운 ${ohHangul(YONG_OH)}`;

// 총평 칩 색상
const chip1Color = OH_COLOR[YONG_KEY] || '#f44336';
const chip2Color = '#ff9800';
const chip3Color = OH_COLOR[BYEONG_KEY] || '#9e9e9e';
const chip4Color = OH_COLOR[HUI_KEY]   || '#4caf50';

// ── 전체 HTML ─────────────────────────────────────────────────────
const barCols   = buildBarChart();


// ── 공통 CSS ─────────────────────────────────────────────────────
const COMMON_CSS = `<style>
${FONT_FACE_CSS}

/NotoSansKR-Regular.ttf') format('truetype'); font-weight: 400; }
/NotoSansKR-Bold.ttf') format('truetype'); font-weight: 700; }
/NotoSansKR-ExtraBold.ttf') format('truetype'); font-weight: 800; }
/NotoSansKR-Black.ttf') format('truetype'); font-weight: 900; }
/NotoSerifKR-Regular.otf') format('opentype'); font-weight: 400; }
/NotoSerifKR-Bold.otf') format('opentype'); font-weight: 700; }
/NotoSerifKR-Black.otf') format('opentype'); font-weight: 900; }
/NotoSansTC-Regular.ttf') format('truetype'); font-weight: 400; }
/NotoSansTC-Bold.ttf') format('truetype'); font-weight: 700; }

:root {
  --red:    #f44336;
  --orange: #ff9800;
  --green:  #4caf50;
  --grey:   #9e9e9e;
  --blue:   #2196f3;
  --gold:   #ffc107;
  --dark:   #212121;
  --border: #e0e0e0;
  --bg:     #fafafa;
}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:var(--dark); }

/* ── 604×840px 페이지 ── */
.page { border:1px solid #333;
  width:  604px;
  max-height: 840px;
  overflow: hidden;
  padding: 3px 6px;
  background: transparent;
  display: flex;
  flex-direction: column;
}
.inner {
  width:  588px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

@media screen {
  body { background: #bbb; }
  .page { border:1px solid #333; margin: 20px auto;  background: transparent; }
}
@media print {
  body { background: transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  background: transparent !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: 604px 840px; margin: 0; }
}

/* ── 헤더 ── */
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;flex-shrink:0; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }

/* ── 총평 칩 (9mm) ── */
.chips { height: 7mm; display: flex; gap: 1.2mm; flex-shrink: 0; }
.chip { flex:1; border-radius:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0px; }
.chip-lbl { font-size:6.5pt; font-weight:700; opacity:.9; }
.chip-val { font-size: 7pt; font-weight:900; line-height:1; }
.chip-sub { font-size: 4pt; opacity:.8; }

/* ── 테이블 ── */
.mtbl { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
.mtbl thead th {
  height: 5mm; font-size: 5.5pt; font-weight:700; color:#555;
  background: var(--bg); border: 1px solid var(--border);
  text-align: center; padding: 0 2px;
}
.mtbl thead th:first-child { text-align:left; padding-left:3px; }
.col-month { width: 15mm; }
.col-score { width: 16mm; }
.col-sum   { width: 90mm; }
.col-days  { width: 31mm; }

.mtbl tbody td {
  height: 7.5mm; border: 1px solid var(--border);
  vertical-align: middle; padding: 0.5mm 1.2mm;
  font-size: 5.5pt; line-height: 1.2; overflow: hidden;
}
.mtbl tbody tr:nth-child(even) td { background: rgba(0,0,0,.015); }

/* 월 컬럼 */
.m-col { display:flex; align-items:center; gap:1.6mm; height:100%; }
.m-num { font-family: 'Noto Serif KR', serif; font-size: 12pt; line-height:1; flex-shrink:0; }
.m-ename  { font-size:3.5pt; color:#ccc; letter-spacing:.4px; text-transform:uppercase; }
.m-emoji  { font-size: 7pt; line-height:1; }
.m-theme  { font-size: 4pt; color:#bbb; }

/* 점수 컬럼 */
.s-col { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; height:100%; }
.s-num { font-family:'Noto Serif KR',serif; font-size:8pt; font-weight:700; line-height:1; }
.s-wrap { width:90%; height:3px; background:#eee; border-radius:2px; overflow:hidden; }
.s-bar  { height:100%; border-radius:2px; }
.s-grade { font-size:6.5pt; font-weight:700; }

/* 요약 컬럼 */
.sum-row { display:flex; align-items:baseline; gap:1.5px; margin-bottom:1px; }
.sum-row:last-child { margin-bottom:0; }
.sum-lbl { font-size:6.5pt; font-weight:700; color:white; padding:0.3px 2.5px; border-radius:2px; flex-shrink:0; line-height:1.3; }
.sum-txt { font-size:7pt; color:#333; line-height:1.25; }

/* 길일/주의 컬럼 */
.days-sec { margin-bottom:1.5px; }
.days-sec:last-child { margin-bottom:0; }
.days-lbl { font-size:6.5pt; font-weight:700; margin-bottom:0.5px; }
.days-chips { display:flex; flex-wrap:wrap; gap:1.5px; }
.day-chip { font-size:6.5pt; font-weight:700; color:white; padding:0.3px 3px; border-radius:2px; }
.no-day { font-size:6.5pt; color:#ccc; }

/* ── 바 차트 (14mm) ── */
.chart-box {
  height: 14mm; border: 1px solid var(--border); border-radius: 4px;
  padding: 1.5mm 2.5mm; background: var(--bg); flex-shrink: 0;
  display: flex; flex-direction: column;
}
.chart-ttl { font-size:7pt; font-weight:700; color:#555; margin-bottom:1.5mm; flex-shrink:0; }
.chart-body { display:flex; align-items:flex-end; gap:1.5px; flex:1; min-height:0; }
.chart-col  { flex:1; display:flex; flex-direction:column; align-items:center; gap:0.5px; height:100%; }
.chart-bwrap { flex:1; width:100%; display:flex; align-items:flex-end; min-height:0; }
.chart-bar  { width:100%; border-radius:2px 2px 0 0; min-height:1px; }
.c-s { font-size:3.5pt; font-weight:700; }
.c-m { font-size:6pt; color:#aaa; }

/* ── 하단 (6mm) ── */
.foot {
  height: 6mm; border-top: 1px solid var(--border); padding-top: 1mm;
  display: flex; justify-content:space-between; align-items:flex-start; flex-shrink: 0;
}
.foot-note { font-size:6pt; color:#bbb; line-height:1.5; }
.foot-leg  { display:flex; gap:4px; flex-shrink:0; }
.fl-i  { display:flex; align-items:center; gap:1.5px; font-size:6.5pt; color:#777; white-space:nowrap; }
.fl-dot { width:5px; height:5px; border-radius:2px; flex-shrink:0; }
</style>`;

// ── 전체 월 행 (1~12월) ──────────────────────────────────────────
const monthRowsAll = MONTHS.map((m, i) => buildMonthRow(m, i)).join('');

// ── 합쳐진 단일 HTML ────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${YEAR} 연간 운세 요약 》 ${NAME}님</title>
${COMMON_CSS}
</head>
<body>
<div class="page">
<div class="inner">

<!-- 헤더 -->
<div class="banner-hdr" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
  <div>
    <div class="banner-hdr-title">📈 연간 운세 요약표 (${YEAR}년)</div>
  </div>
  <div>
    <div class="banner-hdr-name">${NAME} 님</div>
    <div class="banner-hdr-detail">일주 ${ILJU} · 用神 ${YONG_OH}</div>
  </div>
</div>

<!-- 총평 칩 -->
<div class="chips">
  <div class="chip" style="background:${chip1Color};color:white;">
    <div class="chip-lbl">연간 최고 운</div>
    <div class="chip-val">${topMonths}</div>
    <div class="chip-sub">용신 ${ohHangul(YONG_OH).toUpperCase()} 절정기</div>
  </div>
  <div class="chip" style="background:${chip2Color};color:white;">
    <div class="chip-lbl">연간 평균 점수</div>
    <div class="chip-val">${avgScore}점</div>
    <div class="chip-sub">전체 ${parseFloat(avgScore)>=70?'양호':'보통'} · ${chipSubSeun}</div>
  </div>
  <div class="chip" style="background:${chip3Color};color:white;">
    <div class="chip-lbl">주의 구간</div>
    <div class="chip-val">${warnMonths}</div>
    <div class="chip-sub">${OH_NAME[BYEONG_KEY] || ''} 기운 강화</div>
  </div>
  <div class="chip" style="background:${chip4Color};color:white;">
    <div class="chip-lbl">핵심 전략</div>
    <div class="chip-val">${highMonths.length > 0 ? '상반기' : '길일'} 집중</div>
    <div class="chip-sub">${stratPeriod}</div>
  </div>
</div>

<!-- 테이블 (1~12월) -->
<table class="mtbl">
  <thead>
    <tr>
      <th class="col-month">월</th>
      <th class="col-score">평균 점수</th>
      <th class="col-sum">핵심 운세 요약</th>
      <th class="col-days">길일 / 주의일</th>
    </tr>
  </thead>
  <tbody>${monthRowsAll}
  </tbody>
</table>

<!-- 하단 -->
<div class="foot">
  <div class="foot-note">
    ※ ${NAME} 님(${ILJU} 일주, 用神 ${YONG_OH}) 사주 명식과 ${YEAR}년 ${SEUN_GJ} 세운 기반 맞춤형 분석
  </div>
</div>

</div><!-- .inner -->
</div><!-- .page -->
</body>
</html>
`;

// ── 출력 ────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'tables', slot);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, '연간운세요약표.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✅ 연간운세요약표 생성: ${outPath}  (${Buffer.byteLength(html,'utf8')}B)`);
