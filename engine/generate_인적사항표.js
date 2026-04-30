#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS, FONT_FACE_WEB_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function generate(slotId) {
  // 절대경로(슬롯 폴더) vs 상대경로(슬롯ID) 모두 지원
  const isAbsSlot = path.isAbsolute(slotId) || fs.existsSync(path.join(slotId, 'master.json'));
  const slotDir = isAbsSlot ? slotId : path.join(QUEUE_DIR, path.dirname(slotId));
  let masterPath = isAbsSlot ? path.join(slotId, 'master.json') : path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) masterPath = path.join(slotDir, 'master.json');

  const findJson = (suffix) => {
    // 1순위: slotId_suffix.json
    const direct = path.join(QUEUE_DIR, `${slotId}_${suffix}.json`);
    if (fs.existsSync(direct)) return JSON.parse(fs.readFileSync(direct, 'utf8'));
    // 2순위: 슬롯 폴더에서 *_suffix.json 검색
    if (fs.existsSync(slotDir)) {
      const g = fs.readdirSync(slotDir).filter(f => f.endsWith(`_${suffix}.json`));
      if (g.length > 0) return JSON.parse(fs.readFileSync(path.join(slotDir, g[0]), 'utf8'));
    }
    return {};
  };

  const c0 = findJson('ch00');
  const c1 = findJson('ch01');
  const c3 = findJson('ch03');
  const M = fs.existsSync(masterPath) ? JSON.parse(fs.readFileSync(masterPath, 'utf8')) : {};

  // saju_calc 단일 소스 계산 (모든 파생 필드의 최종 fallback)
  let _r = null;
  if (fs.existsSync(masterPath)) {
    try {
      const { 전체사주계산 } = require('./saju_calc');
      const _m = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      _r = 전체사주계산({이름:_m.이름,성별:_m.성별,년:_m.생년,월:_m.생월,일:_m.생일,시간: _m.생시||'모름',음력입력:!!_m.음력입력,윤달:!!_m.윤달, self_q1: _m.self_q1, self_q2: _m.self_q2, self_q3: _m.self_q3, self_q4: _m.self_q4, self_q5: _m.self_q5, self_q6: _m.self_q6, self_q7: _m.self_q7,
});
    } catch(e) {}
  }
  const _지지띠 = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
  const _천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
  const _지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
  const _천간오행 = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
  const _오행한글 = {木:'목',火:'화',土:'토',金:'금',水:'수'};
  const _iljuFromR = (r) => {
    if (!r) return '';
    const t = r.원국?.일주?.천간, j = r.원국?.일주?.지지;
    return (t && j) ? `${t}${j}(${_천간음[t]||''}${_지지음[j]||''})` : '';
  };

  const 이름 = c0['이름'] || c3['이름'] || M['이름'] || (_r && _r.이름) || slotId;
  const 음력 = c0['음력정보'] || M['음력정보'] || (_r && _r.음력정보) || '';
  const 양력 = c0['양력정보'] || M['양력정보'] || (_r && _r.양력정보) || '';
  const 성별 = (M['성별'] === '남' ? '남성' : '여성');
  const 생시 = M['생시'] || '';
  const 띠 = c1['년지띠'] || M['_띠'] || (_r && _지지띠[_r.원국?.년주?.지지]) || '';
  const 일주 = c0['일주'] || c3['일주'] || _iljuFromR(_r) || '';
  const 신강약 = c0['신강약'] || (_r && _r.신강약) || '';
  // saju_calc 직접 계산으로 정확한 5신 확보
  let 용신 = '', 희신 = '', 기신 = '';
  let 오행점수 = null;
  if (_r) {
    try {
      const _oh = {木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'};
      용신 = _oh[_r.용신] || _r.용신 || '';
      희신 = _oh[_r.희신] || _r.희신 || '';
      기신 = _oh[_r.기신] || _r.기신 || '';
      오행점수 = _r.오행점수 || null;
    } catch(e) {}
  }
  if (!오행점수) {
    오행점수 = c0['오행점수'] || c1['오행점수'] || null;
  }
  const _ohColor = {木:'#2e7d32', 火:'#c62828', 土:'#a67c00', 金:'#5d4037', 水:'#1565c0'};
  const 오행요약 = (점수) => {
    const 키 = ['木','火','土','金','水'];
    const 합 = 키.reduce((s,k)=>s+(Number(점수?.[k])||0),0);
    if (합 <= 0) return '';
    return 키.map(k => {
      const pct = Math.round(((Number(점수[k])||0)/합)*100);
      return `<span style="color:${_ohColor[k]};font-weight:700;">${k}</span> ${pct}%`;
    }).join(' · ');
  };
  const 오행행 = 오행요약(오행점수);
  if (!용신) 용신 = c0['용신오행'] || c1['용신오행'] || '';
  if (!희신) 희신 = c0['희신오행'] || c1['희신오행'] || '';
  if (!기신) 기신 = c0['기신오행'] || c1['기신오행'] || '';
  const 격국 = c0['격국명'] || (_r && (_r['格국명'] || _r['격국명'])) || '';
  const 만나이 = c0['만나이'] || (_r && _r.만나이) || '';
  // 일간(천간) + 일간오행 — 궁합 카드와 통일된 형식 (별도 행)
  const _일간한자 = (_r && _r.원국?.일주?.천간) || (일주 && 일주[0]) || '';
  const _일간오행한자 = (_r && _r.일간오행) || _천간오행[_일간한자] || '';
  const 일간 = _일간한자 ? `${_일간한자}(${_천간음[_일간한자]||''})` : '';
  const 일간오행 = _일간오행한자 ? `${_일간오행한자}(${_오행한글[_일간오행한자]||''})` : '';
  const 선생님 = c0['선생님이름'] || M['선생님이름'] || '반야선생';
  const 연구소 = c0['연구소명'] || M['연구소명'] || '';
  const 발행연도 = c0['발행연도'] || M['발행연도'] || new Date().getFullYear();

  const rows = [
    ['성 명', 이름],
    ['생년월일', `양력 ${양력}${음력 ? ` (음력 ${음력})` : ''}`],
    ['성 별', 성별],
    ['띠', `${띠}띠`],
    ['나 이', `만 ${만나이}세`],
    ['일 주', 일주],
    ['신강약', 신강약],
    ['격 국', 격국],
    ['용 신', 용신],
    ['희 신', 희신],
    ['기 신', 기신],
  ].filter(r => r[1] && r[1] !== 'undefined');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>인적사항 — ${이름}</title>
<style>
${FONT_FACE_CSS}
${FONT_FACE_WEB_CSS}
* { margin:0; padding:0; box-sizing:border-box; }
body { background:transparent; font-family:'Noto Sans KR',sans-serif; }
.card {
  width: 604px;
  margin: 0 auto;
  background: linear-gradient(135deg, #fdfcf8 0%, #f8f4e8 100%);
  border: 1.5px solid #d4af37;
  border-radius: 14px;
  padding: 14px 22px;
  display: flex;
  gap: 16px;
  align-items: center;
  max-height: 230px;
  overflow: hidden;
}
.left {
  flex-shrink: 0;
  text-align: center;
  width: 150px;
}
.left .name {
  font-family: 'Noto Serif KR', serif;
  font-size: 15pt;
  font-weight: 700;
  color: #3d3225;
  letter-spacing: 1.5px;
  margin-bottom: 3px;
}
.left .ilju {
  font-family: 'Noto Serif KR', serif;
  font-size: 9pt;
  color: #8a7e5a;
  letter-spacing: 0.5px;
  margin-bottom: 5px;
}
.left .badge {
  display: inline-block;
  font-size: 6.5pt;
  color: #8a7e5a;
  border: 1px solid #d4af3780;
  border-radius: 10px;
  padding: 2px 8px;
  letter-spacing: 0.3px;
  background: #fff;
  white-space: nowrap;
}
.divider {
  width: 1px;
  height: 110px;
  background: linear-gradient(180deg, transparent, #d4af3780, transparent);
  flex-shrink: 0;
}
.right {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 12px;
}
.item {
  display: flex;
  gap: 6px;
  align-items: baseline;
  min-width: 0;
}
.item .label {
  font-size: 7pt;
  color: #a09070;
  white-space: nowrap;
  min-width: 32px;
  flex-shrink: 0;
}
.item .value {
  font-family: 'Noto Serif KR', serif;
  font-size: 8pt;
  color: #3d3225;
  font-weight: 500;
  white-space: nowrap;
}
</style>
</head>
<body>
<div class="card">
  <div class="left">
    <div class="name">${이름}</div>
    <div class="ilju">${일주}</div>
    <div class="badge">${성별} · ${띠}띠 · 만${만나이}세${생시 ? ` · ${생시}` : ''}</div>
  </div>
  <div class="divider"></div>
  <div class="right">
    <div class="item" style="grid-column:1/-1;"><span class="label">양력</span><span class="value">${양력}${음력 ? ` <span style="color:#a09070;font-size:7pt;margin-left:8px;">음력 ${음력}</span>` : ''}</span></div>
    <div class="item"><span class="label">신강약</span><span class="value">${신강약}</span></div>
    <div class="item" style="grid-column:1/-1;"><span class="label">격국</span><span class="value" style="white-space:normal;">${격국}</span></div>
    <div class="item"><span class="label">용신</span><span class="value" style="color:#2e7d32;font-weight:700;">${용신}</span></div>
    <div class="item"><span class="label">희신</span><span class="value" style="color:#1565c0;">${희신}</span></div>
    <div class="item"><span class="label">기신</span><span class="value" style="color:#c62828;">${기신}</span></div>
    <div class="item"><span class="label">일간</span><span class="value">${일간}</span></div>
    ${일간오행 ? `<div class="item" style="grid-column:1/-1;"><span class="label">일간오행</span><span class="value" style="color:${_ohColor[_일간오행한자]||'#3d3225'};font-weight:700;">${일간오행}</span></div>` : ''}
    ${오행행 ? `<div class="item" style="grid-column:1/-1;margin-top:3px;padding-top:4px;border-top:1px dashed #d4af3740;"><span class="label">오행</span><span class="value" style="font-size:8pt;letter-spacing:0.3px;">${오행행}</span></div>` : ''}
  </div>
</div>
</body>
</html>`;

  const outDir = (() => {
    // 슬롯 폴더 모드: tables/ 하위에 저장
    if (isAbsSlot) {
      const tablesInSlot = path.join(slotId, 'tables');
      if (fs.existsSync(tablesInSlot)) return tablesInSlot;
    }
    const bySlot = path.join(TABLES_DIR, slotId);
    if (fs.existsSync(bySlot)) return bySlot;
    fs.mkdirSync(bySlot, { recursive: true });
    return bySlot;
  })();
  fs.writeFileSync(path.join(outDir, '인적사항표.html'), html, 'utf-8');
  console.log(`  ✅ 인적사항표 생성: ${path.join(outDir, '인적사항표.html')}  (${Buffer.byteLength(html)}B)`);
}

const slotArg = process.argv[2];
if (!slotArg) { console.error('사용법: node generate_인적사항표.js <슬롯ID>'); process.exit(1); }
generate(slotArg);
