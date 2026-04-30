#!/usr/bin/env node
/**
 * generate_cover_compat.js — 궁합분석 상품 전용 표지 생성기
 *
 * 사용: node generate_cover_compat.js <master.json 경로>
 * 출력: master.json과 같은 폴더에 cover.html 저장
 *
 * 총본 표지(engine/generate_cover.js)와는 다르게:
 *  - 2인(A ♡ B) 동시 표시
 *  - 제목: "{A} ♡ {B} 궁합 분석"
 *  - 사주표 2행 (A/B 나란히)
 *  - 종합 점수·등급 하이라이트
 *
 * 향후 신규 상품은 이 구조를 참고해 각자 전용 cover 생성기를 만들 것.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS, FONT_BASE, FONT_WEB, FONT_FACE_WEB_CSS } = require('../../font_config');
const { 전체사주계산 } = require('../../saju_calc');
const { 궁합분석 } = require('./compatibility_calc');
const { 관계단계설정 } = require('./compatibility_db');

const ENGINE_ROOT = path.join(__dirname, '..', '..');
const IMAGES_DIR  = path.join(ENGINE_ROOT, 'images', 'common');

// ── 공용 룩업 (총본 cover와 동일 규약) ──
const 천간색상파일 = {
  '甲':'blue','乙':'blue','丙':'red','丁':'red','戊':'gold','己':'gold',
  '庚':'white','辛':'white','壬':'black','癸':'black',
};
const 지지동물파일 = {
  '子':'ret','丑':'cow','寅':'tiger','卯':'rabbit','辰':'dragon','巳':'snake',
  '午':'horse','未':'goat','申':'monkey','酉':'rooster','戌':'dog','亥':'pig',
};
const 천간포인트색 = {
  '甲':'#2e7d32','乙':'#2e7d32','丙':'#e65100','丁':'#e65100',
  '戊':'#c9a227','己':'#c9a227','庚':'#546e7a','辛':'#546e7a','壬':'#1565c0','癸':'#1565c0',
};
const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const 지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const 오행한글 = {木:'목',火:'화',土:'토',金:'금',水:'수'};

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 이미지 base64 임베딩 (일간 천간·일지 기준)
function 동물이미지태그(일간, 일지) {
  const colorKey  = 천간색상파일[일간] || 'black';
  const animalKey = 지지동물파일[일지] || '';
  if (!animalKey) return `<div class="animal-placeholder">🐾</div>`;
  const imgPath = path.join(IMAGES_DIR, `${animalKey}_${colorKey}.png`);
  if (!fs.existsSync(imgPath)) return `<div class="animal-placeholder">🐾</div>`;
  const b64 = fs.readFileSync(imgPath).toString('base64');
  return `<img src="data:image/png;base64,${b64}" alt="${animalKey}" class="animal-img">`;
}

// master.json 필드를 saju_calc 입력 형태로 변환
function toSajuInput(p) {
  return {
    이름: p.이름,
    성별: p.성별 || '남',
    년:   p.생년 ?? p.년,
    월:   p.생월 ?? p.월,
    일:   p.생일 ?? p.일,
    시간: p.생시 ?? p.시간 ?? '모름',
    음력입력: !!p.음력입력,
    윤달: !!p.윤달,
  };
}

function 사주요약(계산결과) {
  const r = 계산결과;
  const t = r.원국.일주.천간, j = r.원국.일주.지지;
  const 일주 = `${t}${j}(${천간음[t]}${지지음[j]})`;
  const nj = r.원국.년주.지지, nt = r.원국.년주.천간;
  const 년주 = `${nt}${nj}(${천간음[nt]}${지지음[nj]})`;
  const mt = r.원국.월주.천간, mj = r.원국.월주.지지;
  const 월주 = `${mt}${mj}(${천간음[mt]}${지지음[mj]})`;
  const st = r.원국.시주?.천간, sj = r.원국.시주?.지지;
  const 시주 = (st && sj) ? `${st}${sj}(${천간음[st]}${지지음[sj]})` : '—';
  return {
    일주, 일간: t, 일지: j,
    년주, 월주, 시주,
    용신: `${r.용신}(${오행한글[r.용신]})`,
    신강약: r.신강약 || '',
  };
}

function generate(masterPath) {
  if (!fs.existsSync(masterPath)) {
    console.error(`❌ master.json 없음: ${masterPath}`);
    process.exit(1);
  }
  const M = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  if (!M.partner) {
    console.error('❌ master.json에 partner 필드가 없습니다.');
    process.exit(1);
  }

  // 2인 계산 + 궁합 분석 (관계단계 반영)
  const inputA = toSajuInput(M);
  const inputB = toSajuInput(M.partner);
  const 관계정보 = {
    관계단계: M.관계단계 || '연인',
    관계기간개월: M.관계기간개월 || null,
    자녀수: M.자녀수 ?? null,
    결혼예정일: M.결혼예정일 || null,
  };
  const rA = 전체사주계산(inputA);
  const rB = 전체사주계산(inputB);
  const 궁합 = 궁합분석(inputA, inputB, 관계정보);
  const 단계설정 = 관계단계설정[관계정보.관계단계] || 관계단계설정.연인;

  const A요약 = 사주요약(rA);
  const B요약 = 사주요약(rB);

  const 종합점수 = 궁합.점수['종합'];
  const 등급 = 궁합.등급;

  const 선생님 = M.선생님이름 || '반야선생';
  const 연구소 = M.연구소명 || '반야 백년 사주 연구소';
  const 발행연도 = M.발행연도 || '';

  const A이미지 = 동물이미지태그(A요약.일간, A요약.일지);
  const B이미지 = 동물이미지태그(B요약.일간, B요약.일지);

  // 색상 테마: A 일간 기준 포인트 + B 일간 기준 보조
  const pointColor = 천간포인트색[A요약.일간] || '#c9a227';
  const accentColor = 천간포인트색[B요약.일간] || '#c9a227';

  // 점수 등급 색
  const 점수색 = 종합점수 >= 85 ? '#c62828'
              : 종합점수 >= 70 ? '#2e7d32'
              : 종합점수 >= 55 ? '#1565c0'
              : 종합점수 >= 40 ? '#e65100'
              : '#757575';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>궁합 표지 》 ${esc(M.이름)} ♡ ${esc(M.partner.이름)}</title>
<style>
${FONT_FACE_CSS}
${FONT_FACE_WEB_CSS}
@font-face { font-family:'NanumBrush'; src:url('${FONT_BASE}/NanumBrush.ttf') format('truetype'), url('${FONT_WEB}/NanumBrush.ttf') format('truetype'); }
@font-face { font-family:'HealthsetJoritdae'; src:url('${FONT_BASE}/헬스셋조릿대Std.ttf') format('truetype'), url('${FONT_WEB}/헬스셋조릿대Std.ttf') format('truetype'); }
@font-face { font-family:'LiuJianMaoCao'; src:url('${FONT_BASE}/LiuJianMaoCao-Regular.ttf') format('truetype'), url('${FONT_WEB}/LiuJianMaoCao-Regular.ttf') format('truetype'); }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans KR',sans-serif; background:transparent; }
.cover {
  width: 643px; height: 971px; max-height: 971px; overflow: hidden;
  background: transparent; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.cover-frame {
  width: 547px; height: 875px;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  padding: 32px 20px 16px;
  position: relative;
  background: transparent;
}
.corner-ornament { display:none; }
.corner-tl, .corner-tr, .corner-bl, .corner-br { display:none; }
.cover-badge {
  font-family:'Noto Serif KR',serif;
  font-size: 7pt; color: ${pointColor};
  letter-spacing: 6px;
  border: 1px solid ${pointColor}50;
  border-radius: 20px; padding: 4px 18px; margin-bottom: 14px;
}
.cover-title {
  font-family:'HealthsetJoritdae','Noto Serif KR',serif;
  font-size: 30pt; font-weight: 700;
  color: #1a1a1a; letter-spacing: 6px;
  line-height: 1.3; margin-top: 6px;
  text-align: center;
}
.cover-title .names {
  display: inline-block;
}
.cover-title .ampersand {
  color: ${pointColor};
  margin: 0 12px;
  font-family:'Noto Serif KR',serif;
  font-weight: 400;
}
.cover-title-sub {
  font-family:'HealthsetJoritdae','Noto Serif KR',serif;
  font-size: 24pt; font-weight: 700;
  color: ${pointColor};
  letter-spacing: 10px; margin: 4px 0 2px;
}
.cover-divider { width: 60px; height: 1px; background: ${pointColor}60; margin: 10px 0 10px; }
.cover-subtitle {
  font-family:'Noto Serif KR',serif;
  font-size: 9pt; color: #999; letter-spacing: 2px; font-weight: 300;
  margin-bottom: 8px;
}
.duo-wrap {
  display: flex; justify-content: center; align-items: center;
  width: 100%; margin: 10px 0 8px;
}
.duo-person {
  flex: 1; display: flex; flex-direction: column; align-items: center;
}
.duo-person .name {
  font-family:'Noto Serif KR',serif;
  font-size: 13pt; font-weight: 700; color: #333;
  margin-top: 6px;
  letter-spacing: 3px;
}
.duo-person .sub {
  font-size: 8pt; color: #888; margin-top: 2px;
  letter-spacing: 1px;
}
.animal-img {
  width: 200px; height: 200px; object-fit: contain;
}
.animal-placeholder { font-size: 72pt; width:200px; height:200px; text-align:center; line-height:200px; }
.heart-center {
  flex: 0 0 auto; width: 50px; text-align: center;
  font-size: 26pt; color: ${accentColor};
  font-family:'Noto Serif KR',serif;
}
.score-box {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin: 10px 0;
  padding: 10px 24px;
  background: ${점수색}08;
  border: 1px solid ${점수색}40;
  border-radius: 14px;
}
.score-num {
  font-family:'HealthsetJoritdae','Noto Serif KR',serif;
  font-size: 36pt; font-weight: 700; color: ${점수색};
  line-height: 1;
}
.score-label {
  display: flex; flex-direction: column;
}
.score-label .big {
  font-family:'Noto Serif KR',serif;
  font-size: 13pt; font-weight: 700; color: #333;
  letter-spacing: 2px;
}
.score-label .small {
  font-size: 7.5pt; color: #888; letter-spacing: 2px; margin-top:2px;
}
.stage-verdict {
  display: flex; justify-content: center; align-items: center; gap: 10px;
  margin: 4px 0 8px;
  padding: 5px 16px;
  background: ${accentColor}10;
  border-left: 3px solid ${accentColor};
  border-radius: 4px;
  font-size: 8.5pt;
}
.stage-verdict .verdict-label {
  color: #888; letter-spacing: 1px;
}
.stage-verdict .verdict-value {
  color: ${accentColor}; font-weight: 700; letter-spacing: 1px;
}
.duo-saju {
  width: 100%; max-width: 480px; margin: 6px 0 10px;
}
.saju-table {
  width: 100%; border-collapse: separate;
  border-spacing: 4px; text-align: center;
  margin-bottom: 6px;
}
.saju-table th {
  font-size: 7.5pt; color: #bbb; font-weight: 700;
  padding: 2px 0; letter-spacing: 2px;
}
.saju-table td {
  font-family:'LiuJianMaoCao','Noto Serif KR',serif;
  font-size: 11pt; font-weight: 700; color: #444;
  padding: 6px 0;
  background: #fafaf8; border-radius: 8px; border: 1px solid #eee;
}
.saju-table td.name-cell {
  font-family:'Noto Serif KR',serif;
  font-size: 9pt; color: ${pointColor};
  background: ${pointColor}08;
  border-color: ${pointColor}30;
  letter-spacing: 2px;
}
.saju-table td.name-cell-b {
  color: ${accentColor};
  background: ${accentColor}08;
  border-color: ${accentColor}30;
}
.saju-highlight { color:${pointColor} !important; background:${pointColor}08 !important; border-color:${pointColor}30 !important; }
.cover-info {
  margin-top: 6px; padding-top: 10px;
  border-top: 1px solid ${pointColor}25;
  text-align: center; width: 320px;
}
.cover-info-line {
  font-size: 8pt; color: #777; line-height: 1.8;
  font-weight: 600; letter-spacing: 0.5px;
}
.cover-footer {
  margin-top: 8px; margin-bottom: 20px;
  text-align: center;
  font-size: 8.5pt; color: #333;
  letter-spacing: 1px; font-weight: 600;
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
    <div class="corner-ornament corner-tl"></div>
    <div class="corner-ornament corner-tr"></div>
    <div class="corner-ornament corner-bl"></div>
    <div class="corner-ornament corner-br"></div>

    <div class="cover-badge">${esc(단계설정.배지텍스트 || 'COMPATIBILITY')}</div>

    <div class="cover-title">
      <span class="names">${esc(M.이름)}</span>
      <span class="ampersand">♡</span>
      <span class="names">${esc(M.partner.이름)}</span>
    </div>
    <div class="cover-title-sub">${esc(단계설정.표지타이틀 || '궁합 분석')}</div>
    <div class="cover-divider"></div>
    <div class="cover-subtitle">${esc(단계설정.표지부제 || '두 사주를 교차 분석한 백년의 인연 지도')}</div>

    <div class="duo-wrap">
      <div class="duo-person">
        ${A이미지}
        <div class="name">${esc(M.이름)}</div>
        <div class="sub">${A요약.일주}</div>
      </div>
      <div class="heart-center">❤</div>
      <div class="duo-person">
        ${B이미지}
        <div class="name">${esc(M.partner.이름)}</div>
        <div class="sub">${B요약.일주}</div>
      </div>
    </div>

    <div class="score-box">
      <div class="score-num">${종합점수}</div>
      <div class="score-label">
        <div class="big">${esc(등급)}</div>
        <div class="small">종합 궁합 점수</div>
      </div>
    </div>

    ${관계정보.관계단계 === '이혼고민' && 궁합.항목.분리판단 ? `
    <div class="stage-verdict">
      <span class="verdict-label">분리 판단</span>
      <span class="verdict-value">${esc((궁합.항목.분리판단.결론 || '').replace(/_/g,' · '))}</span>
    </div>` : ''}
    ${관계정보.관계단계 === '별거' && 궁합.항목.재결합가능성 ? `
    <div class="stage-verdict">
      <span class="verdict-label">재결합 복원 지수</span>
      <span class="verdict-value">${궁합.항목.재결합가능성.점수}점 · ${esc(궁합.항목.재결합가능성.등급)}</span>
    </div>` : ''}
    ${관계정보.관계단계 === '재혼준비' || 관계정보.관계단계 === '재혼' ? `
    <div class="stage-verdict">
      <span class="verdict-label">블렌디드 패밀리</span>
      <span class="verdict-value">전혼 경험 통합 가이드 포함</span>
    </div>` : ''}
    ${관계정보.관계단계 === '썸' ? `
    <div class="stage-verdict">
      <span class="verdict-label">첫 만남 설계</span>
      <span class="verdict-value">용신 기반 장소·시간 제시</span>
    </div>` : ''}

    <div class="duo-saju">
      <table class="saju-table">
        <tr><th></th><th>시주</th><th>일주</th><th>월주</th><th>년주</th></tr>
        <tr>
          <td class="name-cell">${esc(M.이름)}</td>
          <td>${A요약.시주}</td>
          <td class="saju-highlight">${A요약.일주}</td>
          <td>${A요약.월주}</td>
          <td>${A요약.년주}</td>
        </tr>
        <tr>
          <td class="name-cell name-cell-b">${esc(M.partner.이름)}</td>
          <td>${B요약.시주}</td>
          <td class="saju-highlight">${B요약.일주}</td>
          <td>${B요약.월주}</td>
          <td>${B요약.년주}</td>
        </tr>
      </table>
    </div>

    <div class="cover-info">
      <div class="cover-info-line">${esc(M.이름)}: ${M.생년}년 ${M.생월}월 ${M.생일}일 · ${A요약.신강약}</div>
      <div class="cover-info-line">${esc(M.partner.이름)}: ${M.partner.생년}년 ${M.partner.생월}월 ${M.partner.생일}일 · ${B요약.신강약}</div>
    </div>

    <div class="cover-footer">
      ${esc(M.이름)} ♡ ${esc(M.partner.이름)} 궁합 분석 · ${esc(연구소)}
    </div>
  </div>
</div>
</body>
</html>`;

  // master.json 과 같은 폴더에 cover.html 저장
  const outDir = path.dirname(masterPath);
  const outFile = path.join(outDir, 'cover.html');
  fs.writeFileSync(outFile, html, 'utf-8');
  console.log(`✅ 궁합 표지 생성 완료 》 ${M.이름} ♡ ${M.partner.이름} (${종합점수}점 / ${등급})`);
  console.log(`   → ${path.relative(ENGINE_ROOT, outFile)}`);
}

// ── CLI 진입점 ──
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('사용법: node generate_cover_compat.js <master.json 경로>');
    process.exit(1);
  }
  const abs = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  generate(abs);
}

module.exports = { generate };
