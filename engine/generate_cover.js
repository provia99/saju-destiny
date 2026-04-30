#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const G    = require('./_guards');
const { FONT_FACE_CSS, FONT_BASE, FONT_WEB, FONT_FACE_WEB_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');
const IMAGES_DIR = path.join(SCRIPT_DIR, 'images', 'common');

// ── 천간 → 이미지 색상 키 ──────────────────────────────────
const 천간색상파일 = {
  '甲':'blue',  '乙':'blue',
  '丙':'red',   '丁':'red',
  '戊':'gold',  '己':'gold',
  '庚':'white', '辛':'white',
  '壬':'black', '癸':'black',
};

// ── 지지 → 동물 파일명 ─────────────────────────────────────
const 지지동물파일 = {
  '子':'ret',     '丑':'cow',    '寅':'tiger',   '卯':'rabbit',
  '辰':'dragon',  '巳':'snake',  '午':'horse',   '未':'goat',
  '申':'monkey',  '酉':'rooster','戌':'dog',      '亥':'pig',
};

// ── 오행 배경 색상 (일간 기준) ────────────────────────────
const 천간배경색 = {
  '甲':'#e8f5e9', '乙':'#e8f5e9',   // 木 》 연녹
  '丙':'#fff3e0', '丁':'#fff3e0',   // 火 》 연주황
  '戊':'#fdf6e3', '己':'#fdf6e3',   // 土 》 연황
  '庚':'#f5f5f5', '辛':'#f5f5f5',   // 金 》 연회
  '壬':'#e3f2fd', '癸':'#e3f2fd',   // 水 》 연청
};
const 천간포인트색 = {
  '甲':'#2e7d32', '乙':'#2e7d32',
  '丙':'#e65100', '丁':'#e65100',
  '戊':'#c9a227', '己':'#c9a227',
  '庚':'#546e7a', '辛':'#546e7a',
  '壬':'#1565c0', '癸':'#1565c0',
};

function generate(slotId) {
  // ─────────────────────────────────────────────────────
  //   단일 소스 원칙: saju_calc 한 번 호출 → 모든 필드를 r에서 직접 채움
  //   ch01/ch08/master.json 캐시는 일절 사용 안 함 (부분 데이터 트랩 제거)
  //   ch00.json은 브랜드(선생님이름·연구소)만
  // ─────────────────────────────────────────────────────

  // ── 1. master.json 찾기 (헬퍼 사용) ───────────────────
  const masterPath = G.findMasterJson(slotId, QUEUE_DIR);
  if (!masterPath) {
    console.error(`❌ cover 생성 실패: master.json 못 찾음 (slotId=${slotId})`);
    process.exit(1);
  }

  // ── 2. saju_calc 한 번 호출 (단일 진실 소스) ──────────
  const m = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  let r;
  try {
    const { 전체사주계산 } = require('./saju_calc');
    r = 전체사주계산({
      이름: m.이름, 성별: m.성별 ?? '남',
      년: m.생년, 월: m.생월, 일: m.생일, 시간: m.생시,
      음력입력: m.음력입력 ?? true, 윤달: m.윤달 ?? false, self_q1: m.self_q1, self_q2: m.self_q2, self_q3: m.self_q3, self_q4: m.self_q4, self_q5: m.self_q5, self_q6: m.self_q6, self_q7: m.self_q7,
});
  } catch(e) {
    console.error(`❌ cover 생성 실패: saju_calc 오류 — ${e.message}`);
    process.exit(1);
  }

  // ── 사전 검증 (헬퍼 사용) — 부분 데이터로 진행 차단 ─
  try {
    G.assertSajuComplete(r, { context: `slotId=${slotId}, 이름=${m.이름}` });
  } catch(e) {
    console.error(`❌ cover 생성 실패: ${e.message}`);
    process.exit(1);
  }

  // ── 3. 모든 필드를 r에서 직접 채움 ────────────────────
  const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
  const 지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
  const 오행한글 = {木:'목',火:'화',土:'토',金:'금',水:'수'};
  const _지지띠 = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
  const _주포맷 = (j) => {
    if (!j || !j.천간 || !j.지지) return '';
    const t = j.천간, z = j.지지;
    return `${t}${z}(${천간음[t]||''}${지지음[z]||''})`;
  };

  const 이름   = r.이름 || m.이름 || '';
  const 일간   = r.원국.일주.천간;
  const 일지   = r.원국.일주.지지;
  const 일주   = _주포맷(r.원국.일주);
  const 년주   = _주포맷(r.원국.년주);
  const 월주   = _주포맷(r.원국.월주);
  const 시주   = _주포맷(r.원국.시주);
  const 용신   = r.용신 ? `${r.용신}(${오행한글[r.용신]||''})` : '';
  const 희신   = r.희신 ? `${r.희신}(${오행한글[r.희신]||''})` : '';
  const 신강약 = r.신강약 || '';
  const 띠     = _지지띠[r.원국.년주?.지지] || '';
  const 성별   = m.성별 === '남' ? '남성' : (m.성별 === '여' ? '여성' : '');
  const 생년월일 = `${m.생년 || ''}년 ${m.생월 || ''}월 ${m.생일 || ''}일`;
  const 올해   = m.발행연도 || m._올해 || new Date().getFullYear();

  // ── 4. 브랜드 정보: ch00.json만 사용 (없으면 master.json fallback) ─
  let 선생님 = m.선생님이름 || '반야선생';
  let 연구소 = m.연구소명 || '반야선생 사주명리연구소';
  // ch00.json 위치: 슬롯 폴더 또는 queue/ 평면
  const _slotFolder = path.dirname(masterPath);
  let ch00Path = path.join(QUEUE_DIR, `${slotId}_ch00.json`);
  if (!fs.existsSync(ch00Path)) {
    const _g = fs.existsSync(_slotFolder) ? fs.readdirSync(_slotFolder).filter(f => f.endsWith('_ch00.json')) : [];
    if (_g.length > 0) ch00Path = path.join(_slotFolder, _g[0]);
  }
  if (fs.existsSync(ch00Path)) {
    try {
      const c0 = JSON.parse(fs.readFileSync(ch00Path, 'utf8'));
      if (c0['선생님이름']) 선생님 = c0['선생님이름'];
      if (c0['연구소명']) 연구소 = c0['연구소명'];
    } catch(e) {}
  }

  // ── 이미지 파일명 결정 ─────────────────────────────────
  const colorKey  = 천간색상파일[일간] || 'black';
  const animalKey = 지지동물파일[일지] || '';
  const imgFile   = animalKey ? `${animalKey}_${colorKey}.png` : '';
  const imgPath   = imgFile ? path.join(IMAGES_DIR, imgFile) : '';
  const imgExists = imgPath && fs.existsSync(imgPath);

  // ── 일주동물명 ─────────────────────────────────────────
  const 천간색상한글 = {甲:'비취',乙:'비취',丙:'루비',丁:'루비',戊:'황금',己:'황금',庚:'백옥',辛:'백옥',壬:'흑진주',癸:'흑진주'};
  const 지지동물한글 = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
  const 일주동물명 = (천간색상한글[일간]||'') + ' ' + (지지동물한글[일지]||'');

  // ── 색상 테마 ──────────────────────────────────────────
  const pointColor = 천간포인트색[일간] || '#c9a227';

  // ── base64 이미지 임베딩 (외부 경로 의존 없이) ──────────
  let imgBase64 = '';
  if (imgExists) {
    imgBase64 = fs.readFileSync(imgPath).toString('base64');
  }
  const imgTag = imgBase64
    ? `<img src="data:image/png;base64,${imgBase64}" alt="${animalKey}" class="animal-img">`
    : `<div class="animal-placeholder">🐾</div>`;

  // ── HTML 생성 ──────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>표지 》 ${이름}님</title>
  <style>
${FONT_FACE_CSS}
${FONT_FACE_WEB_CSS}
@font-face { font-family:'NanumBrush'; src:url('${FONT_BASE}/NanumBrush.ttf') format('truetype'), url('${FONT_WEB}/NanumBrush.ttf') format('truetype'); }
@font-face { font-family:'HealthsetJoritdae'; src:url('${FONT_BASE}/헬스셋조릿대Std.ttf') format('truetype'), url('${FONT_WEB}/헬스셋조릿대Std.ttf') format('truetype'); }
@font-face { font-family:'LiuJianMaoCao'; src:url('${FONT_BASE}/LiuJianMaoCao-Regular.ttf') format('truetype'), url('${FONT_WEB}/LiuJianMaoCao-Regular.ttf') format('truetype'); }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans KR',sans-serif; background:transparent; }
.cover {
  width: 643px;
  height: 971px;
  max-height: 971px;
  overflow: hidden;
  background: #fff;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-frame {
  width: 547px;   /* 643 - 12mm×2 (48px×2) — 좌우 빡빡하게 */
  height: 875px;  /* 971 - 12mm×2 (48px×2) */
  border: none;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  background: linear-gradient(180deg, #ffffff 0%, #fefdfb 100%);
}
.corner-ornament {
  position: absolute;
  width: 28px; height: 28px;
  border-color: ${pointColor}60;
  border-style: solid;
}
.corner-tl { top:12px; left:12px; border-width: 2px 0 0 2px; border-radius: 8px 0 0 0; }
.corner-tr { top:12px; right:12px; border-width: 2px 2px 0 0; border-radius: 0 8px 0 0; }
.corner-bl { bottom:12px; left:12px; border-width: 0 0 2px 2px; border-radius: 0 0 0 8px; }
.corner-br { bottom:12px; right:12px; border-width: 0 2px 2px 0; border-radius: 0 0 8px 0; }
.cover-badge {
  font-family: 'Noto Serif KR', serif;
  font-size: 7pt;
  color: ${pointColor};
  letter-spacing: 6px;
  text-transform: uppercase;
  border: 1px solid ${pointColor}50;
  border-radius: 20px;
  padding: 4px 18px;
  margin-bottom: 18px;
}
.cover-title {
  font-family: 'HealthsetJoritdae', 'Noto Serif KR', serif;
  font-size: 38pt;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 10px;
  line-height: 1.3;
  margin-top: 40px;
  margin-bottom: 2px;
}
.cover-title-sub {
  font-family: 'HealthsetJoritdae', 'Noto Serif KR', serif;
  font-size: 34pt;
  font-weight: 700;
  color: ${pointColor};
  letter-spacing: 8px;
  margin-bottom: 6px;
}
.cover-divider {
  width: 60px;
  height: 1px;
  background: ${pointColor}60;
  margin: 10px 0 14px;
}
.cover-subtitle {
  font-size: 8.5pt;
  color: #999;
  letter-spacing: 1px;
  font-weight: 300;
}
.animal-wrap {
  margin: -10px 0 auto;
  padding: 10px;
  background: transparent;
}
.animal-img {
  width: 500px;
  height: 500px;
  object-fit: contain;
}
.animal-placeholder { font-size: 100pt; text-align: center; }
.cover-saju {
  width: 100%;
  max-width: 460px;
  margin-bottom: 14px;
}
.saju-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 6px 0;
  text-align: center;
  margin-bottom: 10px;
}
.saju-table th {
  font-size: 8pt;
  color: #bbb;
  font-weight: 700;
  padding: 3px 0;
  letter-spacing: 2px;
}
.saju-table td {
  font-family: 'LiuJianMaoCao', 'Noto Serif KR', serif;
  font-size: 15pt;
  font-weight: 700;
  color: #444;
  padding: 10px 0;
  background: #fafaf8;
  border-radius: 10px;
  border: 1px solid #eee;
}
.saju-highlight {
  color: ${pointColor} !important;
  background: ${pointColor}08 !important;
  border-color: ${pointColor}30 !important;
}
.saju-detail {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
}
.saju-tag {
  font-family: 'Noto Serif KR', serif;
  font-size: 8.5pt;
  color: #888;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 14px;
  padding: 4px 10px;
  letter-spacing: 0;
  font-weight: 600;
  white-space: nowrap;
}
.cover-info {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid ${pointColor}25;
  text-align: center;
  width: 320px;
}
.cover-info-line {
  font-size: 8.5pt;
  color: #777;
  line-height: 2;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.cover-footer {
  margin-top: 10px;
  margin-bottom: 60px;
  text-align: center;
  font-size: 8.5pt;
  color: #333;
  letter-spacing: 1px;
  font-weight: 600;
}
@media print {
  @page { margin: 0; size: A4; }
  html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; background: transparent; }
  body { display: flex; align-items: center; justify-content: center; }
  .cover { margin: 0 auto; }
  .cover, .cover-frame { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
  </style>
</head>
<body>
<div class="cover">
  <div class="cover-frame">
    <div class="cover-title">${이름} 님의 천명</div>
    <div class="cover-title-sub">백년의 약속</div>
    <div class="cover-divider"></div>

    <div class="animal-wrap">
      ${imgTag}
    </div>

    <div class="cover-saju">
      <table class="saju-table">
        <tr><th>시주</th><th>일주</th><th>월주</th><th>년주</th></tr>
        <tr><td>${시주 || '—'}</td><td class="saju-highlight">${일주 || '—'}</td><td>${월주 || '—'}</td><td>${년주 || '—'}</td></tr>
      </table>
      <div class="saju-detail">
        ${신강약 ? `<span class="saju-tag">${신강약}</span>` : ''}
        ${용신 ? `<span class="saju-tag">용신 ${용신}</span>` : ''}
        ${희신 ? `<span class="saju-tag">희신 ${희신}</span>` : ''}
        ${띠 ? `<span class="saju-tag">${띠}띠</span>` : ''}${일주동물명.trim() ? `<span class="saju-tag">${일주동물명.trim()}</span>` : ''}
      </div>
    </div>

    <div class="cover-info">
      ${생년월일 ? `<div class="cover-info-line">${생년월일} · ${성별 || ''}</div>` : ''}
    </div>

    <div class="cover-footer">
      ${이름} 님의 사주 해석서 · ${연구소}
    </div>
  </div>
</div>
</body>
</html>`;

  // ── 저장 ──────────────────────────────────────────────
  // 슬롯 모드 우선: master.json이 있는 폴더의 tables/ 에 직접 쓰기
  // (다른 회원 데이터가 새어들지 않도록 슬롯 격리)
  const outDir = (() => {
    if (masterPath && fs.existsSync(masterPath)) {
      const slotFolder = path.dirname(masterPath);
      const slotTables = path.join(slotFolder, 'tables');
      if (!fs.existsSync(slotTables)) fs.mkdirSync(slotTables, { recursive: true });
      return slotTables;
    }
    const bySlot = path.join(TABLES_DIR, slotId);
    if (fs.existsSync(bySlot)) return bySlot;
    const stripped = slotId.split('_').slice(0, -1).join('_');
    const byStrip  = stripped ? path.join(TABLES_DIR, stripped) : null;
    if (byStrip && fs.existsSync(byStrip)) return byStrip;
    fs.mkdirSync(bySlot, { recursive: true });
    return bySlot;
  })();

  const outPath = path.join(outDir, 'cover.html');
  // ── 안전 쓰기 (헬퍼 사용): write + verify 묶음 ─────────
  try {
    G.safeWriteHtml(outPath, html, {
      이름: 이름,
      신강약: 신강약,
      용신: 용신,
      희신: 희신,
      띠: 띠 ? `${띠}띠` : '',
      '4기둥': G.check4Pillars(),
    }, 'cover');
  } catch(e) {
    console.error(`❌ ${e.message}`);
    console.error(`   slotId=${slotId}, 이름=${이름}`);
    process.exit(1);
  }

  console.log(`✅ cover.html 생성 완료 》 ${이름} 님 (${일주})`);
}

// ── CLI 진입점 ────────────────────────────────────────────
const slotArg = process.argv[2];
if (!slotArg) {
  console.error('사용법: node generate_cover.js <슬롯ID>');
  process.exit(1);
}
generate(slotArg);
