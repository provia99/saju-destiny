#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function generate(slotId) {
  let masterPath = path.join(slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) { console.log('⚠️ 지지계절방위표: master.json 없음 (스킵)'); return; }

  const M = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
  const name = M.이름 || slotId;

  // 일지 강조용
  let 일지 = '';
  try {
    const { 전체사주계산 } = require('./saju_calc');
    const r = 전체사주계산({
      이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
      년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시, 성별: M.성별 ?? '남' self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});
    일지 = r.원국.일주.지지;
  } catch(e) {}

  const data = [
    {
      season: '봄', seasonEn: 'SPRING', oh: '木', ohKr: '목', color: '#4caf50', lightBg: '#e8f5e9',
      desc: '생장(生長)의 기운\n시작하고 뻗어나갑니다',
      dir: '동쪽', dirIcon: '→',
      jiji: [
        { char: '寅', kr: '인', animal: '🐯', emoji: '호랑이', time: '03:30~05:29', note: '이른 봄' },
        { char: '卯', kr: '묘', animal: '🐰', emoji: '토끼', time: '05:30~07:29', note: '봄 절정' },
        { char: '辰', kr: '진', animal: '🐲', emoji: '용', time: '07:30~09:29', note: '봄 끝', earth: true },
      ]
    },
    {
      season: '여름', seasonEn: 'SUMMER', oh: '火', ohKr: '화', color: '#f44336', lightBg: '#ffebee',
      desc: '성장(盛長)의 기운\n가장 활발하게 활동해요',
      dir: '남쪽', dirIcon: '↓',
      jiji: [
        { char: '巳', kr: '사', animal: '🐍', emoji: '뱀', time: '09:30~11:29', note: '초여름' },
        { char: '午', kr: '오', animal: '🐴', emoji: '말', time: '11:30~13:29', note: '한여름' },
        { char: '未', kr: '미', animal: '🐏', emoji: '양', time: '13:30~15:29', note: '늦여름', earth: true },
      ]
    },
    {
      season: '가을', seasonEn: 'AUTUMN', oh: '金', ohKr: '금', color: '#9e9e9e', lightBg: '#f5f5f5',
      desc: '수렴(收斂)의 기운\n결실을 맺고 정리해요',
      dir: '서쪽', dirIcon: '←',
      jiji: [
        { char: '申', kr: '신', animal: '🐵', emoji: '원숭이', time: '15:30~17:29', note: '초가을' },
        { char: '酉', kr: '유', animal: '🐔', emoji: '닭', time: '17:30~19:29', note: '가을 절정' },
        { char: '戌', kr: '술', animal: '🐶', emoji: '개', time: '19:30~21:29', note: '늦가을', earth: true },
      ]
    },
    {
      season: '겨울', seasonEn: 'WINTER', oh: '水', ohKr: '수', color: '#2196f3', lightBg: '#e3f2fd',
      desc: '저장(貯藏)의 기운\n깊이 쌓고 다음을 준비해요',
      dir: '북쪽', dirIcon: '↑',
      jiji: [
        { char: '亥', kr: '해', animal: '🐷', emoji: '돼지', time: '21:30~23:29', note: '초겨울' },
        { char: '子', kr: '자', animal: '🐭', emoji: '쥐', time: '23:30~01:29', note: '한겨울' },
        { char: '丑', kr: '축', animal: '🐮', emoji: '소', time: '01:30~03:29', note: '늦겨울', earth: true },
      ]
    },
  ];

  const seasonHTML = data.map(s => {
    const jijiCells = s.jiji.map(j => {
      const isMyIlji = j.char === 일지;
      const highlight = isMyIlji ? `border:2.5px solid ${s.color};` : '';
      const myBadge = isMyIlji ? `<div class="my-badge" style="background:${s.color};">내 일지</div>` : '';
      const earthBadge = j.earth ? `<div class="earth-badge">土</div>` : '';
      return `<div class="jj-cell" style="${highlight}">
        ${myBadge}${earthBadge}
        <div class="jj-animal">${j.animal}</div>
        <div class="jj-char" style="color:${j.earth ? '#ff9800' : s.color}">${j.char}</div>
        <div class="jj-kr">${j.kr} · ${j.emoji}</div>
        <div class="jj-time">${j.time}</div>
        <div class="jj-note">${j.note}${j.earth ? ' · 土' : ''}</div>
      </div>`;
    }).join('');

    return `<div class="season-row">
      <div class="season-left" style="background:${s.lightBg};border-left:4px solid ${s.color};">
        <div class="season-name" style="color:${s.color};">${s.season}</div>
        <div class="season-en" style="color:${s.color}88;">${s.seasonEn}</div>
        <div class="season-oh" style="background:${s.color};color:white;">${s.oh}(${s.ohKr})</div>
        <div class="season-desc">${s.desc.replace('\n','<br>')}</div>
        <div class="season-dir"><span class="dir-icon" style="color:${s.color};">${s.dirIcon}</span> ${s.dir}</div>
      </div>
      <div class="season-jiji">${jijiCells}</div>
    </div>`;
  }).join('');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>지지계절방위표 — ${name}</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;}
.page{ border:1px solid #333;width:604px;padding:6px;margin:10px auto;background:transparent;}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{margin:0;}@page{ border:1px solid #333;size:604px 600px;margin:0;}}

.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:3px 10px;border-radius:6px;background:linear-gradient(135deg,#1a237e,#283593);margin-bottom:4px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.7);margin-top:1px;}
.banner-hdr-right{text-align:right;}
.banner-hdr-name{font-size:9pt;font-weight:800;background:linear-gradient(90deg,#ffd54f,#fff176);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}

.season-row{display:flex;gap:3px;margin-bottom:2px;}
.season-left{flex:0 0 100px;padding:3px 5px;border-radius:6px;display:flex;flex-direction:column;gap:0;align-items:center;text-align:center;}
.season-name{font-size:14pt;font-weight:900;}
.season-en{font-size:6pt;font-weight:700;letter-spacing:2px;}
.season-oh{font-size:9pt;font-weight:800;padding:2px 10px;border-radius:10px;margin:2px 0;}
.season-desc{font-size:7pt;color:#555;line-height:1.3;}
.season-dir{font-size:8pt;font-weight:700;color:#555;}
.dir-icon{font-size:10pt;font-weight:900;}

.season-jiji{flex:1;display:flex;gap:4px;}
.jj-cell{flex:1;background:#fafafa;border:1.5px solid #e0e0e0;border-radius:6px;padding:4px 3px;text-align:center;position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;}
.jj-animal{font-size:20pt;line-height:1;}
.jj-char{font-size:22pt;font-weight:900;font-family:'Noto Serif KR',serif;line-height:1;}
.jj-kr{font-size:8pt;color:#555;font-weight:600;}
.jj-time{font-size:7.5pt;color:#888;font-weight:600;}
.jj-note{font-size:7pt;color:#999;font-weight:500;}
.my-badge{position:absolute;top:-8px;right:-6px;font-size:7pt;color:white;font-weight:800;padding:2px 7px;border-radius:8px;}
.earth-badge{position:absolute;top:-7px;left:-5px;font-size:7.5pt;color:white;font-weight:800;background:#ff9800;padding:1px 6px;border-radius:6px;}
</style>
</head><body>
<div class="page">
  <div class="banner-hdr">
    <div>
      <div class="banner-hdr-title">지지(地支) 계절·방위표</div>
      <div class="banner-hdr-sub">12지지 》 사계절 · 방위 · 시간대</div>
    </div>
    <div class="banner-hdr-right">
      <div class="banner-hdr-name">${name} 님</div>
    </div>
  </div>
  ${seasonHTML}
</div>
</body></html>`;

  const samplesDir = path.dirname(masterPath);
  const slotTablesDir = path.join(samplesDir, 'tables');
  if (!fs.existsSync(slotTablesDir)) fs.mkdirSync(slotTablesDir, { recursive: true });
  const outFile = path.join(slotTablesDir, '지지계절방위표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');

  const outDir2 = path.join(TABLES_DIR, path.basename(path.dirname(masterPath)));
  if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });
  fs.writeFileSync(path.join(outDir2, '지지계절방위표.html'), HTML, 'utf-8');

  console.log(`✅ 지지계절방위표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_지지계절방위표.js <slot_id>'); process.exit(1); }
generate(slotId);
