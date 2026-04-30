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

const TG_KR = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const JJ_KR = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const TG_OH = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const JJ_OH = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const OH_COLOR = {木:'#4caf50',火:'#f44336',土:'#ff9800',金:'#9e9e9e',水:'#2196f3'};
const YANG_TG = new Set(['甲','丙','戊','庚','壬']);
const YANG_JJ = new Set(['子','寅','辰','午','申','戌']);

function generate(slotId) {
  let masterPath = path.join(slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) { console.log('⚠️ 음양비율표: master.json 없음 (스킵)'); return; }

  const M = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
  const r = 전체사주계산({
    이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
    년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시, 성별: M.성별 ?? '남' self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

  const name = M.이름 || slotId;
  const 원국 = r.원국;
  const pillars = [
    { label:'시주', pos:'時', tg: 원국.시주?.천간||'', jj: 원국.시주?.지지||'' },
    { label:'일주', pos:'日', tg: 원국.일주.천간, jj: 원국.일주.지지 },
    { label:'월주', pos:'月', tg: 원국.월주.천간, jj: 원국.월주.지지 },
    { label:'년주', pos:'年', tg: 원국.년주.천간, jj: 원국.년주.지지 },
  ];

  // 음양 분석
  let yangCount = 0, yinCount = 0;
  const cells = [];
  for (const p of pillars) {
    if (!p.tg) continue;
    const tgYang = YANG_TG.has(p.tg);
    const jjYang = YANG_JJ.has(p.jj);
    if (tgYang) yangCount++; else yinCount++;
    if (jjYang) yangCount++; else yinCount++;
    cells.push({
      label: p.label, pos: p.pos,
      tg: p.tg, tgKr: TG_KR[p.tg]||'', tgOh: TG_OH[p.tg]||'', tgYang,
      jj: p.jj, jjKr: JJ_KR[p.jj]||'', jjOh: JJ_OH[p.jj]||'', jjYang,
    });
  }
  const total = yangCount + yinCount;
  const yangPct = Math.round(yangCount / total * 100);
  const yinPct = 100 - yangPct;

  // 균형 판정
  let balance = '';
  let balanceColor = '';
  let balanceDesc = '';
  if (yangPct >= 75) { balance = '양 우세'; balanceColor = '#e65100'; balanceDesc = '활동적이고 외향적인 에너지가 강합니다. 추진력은 뛰어나지만, 때로 쉬어가는 지혜가 필요해요.'; }
  else if (yangPct >= 63) { balance = '양 강세'; balanceColor = '#ff9800'; balanceDesc = '양의 기운이 강하지만 음의 균형도 있습니다. 적극적이면서도 신중한 면이 있어요.'; }
  else if (yangPct >= 38) { balance = '균형'; balanceColor = '#2e7d32'; balanceDesc = '음양이 비교적 고르게 분포되어 있습니다. 상황에 따라 유연하게 대응하는 힘이 있어요.'; }
  else if (yangPct >= 25) { balance = '음 강세'; balanceColor = '#1565c0'; balanceDesc = '음의 기운이 강하지만 양의 활력도 있습니다. 깊이 생각하면서도 행동력이 있어요.'; }
  else { balance = '음 우세'; balanceColor = '#283593'; balanceDesc = '내면의 에너지가 풍부합니다. 직관과 감수성이 뛰어나지만, 때로 적극적 표현이 필요해요.'; }

  // 일간 음양
  const ilganYang = YANG_TG.has(원국.일주.천간);
  const ilganYY = ilganYang ? '양(陽)' : '음(陰)';
  const ilganDesc = ilganYang
    ? '밖으로 드러내고 적극적으로 행동하는 것이 자연스러운 에너지'
    : '안에서 깊이 생각하고 신중하게 움직이는 것이 자연스러운 에너지';

  // 4주 셀 HTML
  const pillarHTML = cells.map(c => {
    const tgC = OH_COLOR[c.tgOh] || '#888';
    const jjC = OH_COLOR[c.jjOh] || '#888';
    const tgBg = c.tgYang ? '#fff3e0' : '#e3f2fd';
    const jjBg = c.jjYang ? '#fff3e0' : '#e3f2fd';
    const tgYYlabel = c.tgYang ? '陽' : '陰';
    const jjYYlabel = c.jjYang ? '陽' : '陰';
    const tgYYcolor = c.tgYang ? '#e65100' : '#1565c0';
    const jjYYcolor = c.jjYang ? '#e65100' : '#1565c0';
    return `<div class="pillar">
      <div class="pillar-label">${c.label}</div>
      <div class="pillar-cell" style="background:${tgBg}">
        <span class="p-char" style="color:${tgC}">${c.tg}</span>
        <span class="p-kr">${c.tgKr}</span>
        <span class="p-yy" style="color:${tgYYcolor}">${tgYYlabel}</span>
      </div>
      <div class="pillar-cell" style="background:${jjBg}">
        <span class="p-char" style="color:${jjC}">${c.jj}</span>
        <span class="p-kr">${c.jjKr}</span>
        <span class="p-yy" style="color:${jjYYcolor}">${jjYYlabel}</span>
      </div>
    </div>`;
  }).join('');

  // SVG 원형 게이지
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const yangArc = circumference * yangPct / 100;
  const yinArc = circumference - yangArc;

  const svgGauge = `<svg viewBox="0 0 200 200" width="160" height="160">
    <defs>
      <linearGradient id="yangGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ff6d00"/>
        <stop offset="100%" style="stop-color:#ffab40"/>
      </linearGradient>
      <linearGradient id="yinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0d47a1"/>
        <stop offset="100%" style="stop-color:#42a5f5"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="100" cy="100" r="${radius}" fill="none" stroke="#eee" stroke-width="18"/>
    <circle cx="100" cy="100" r="${radius}" fill="none" stroke="url(#yangGrad)" stroke-width="18"
      stroke-dasharray="${yangArc} ${yinArc}" stroke-dashoffset="${circumference/4}" stroke-linecap="round" filter="url(#glow)"/>
    <circle cx="100" cy="100" r="${radius}" fill="none" stroke="url(#yinGrad)" stroke-width="18"
      stroke-dasharray="${yinArc} ${yangArc}" stroke-dashoffset="${circumference/4 - yangArc}" stroke-linecap="round"/>
    <text x="100" y="90" text-anchor="middle" font-size="28" font-weight="900" fill="#333">${yangPct}%</text>
    <text x="100" y="112" text-anchor="middle" font-size="10" fill="#888">양(陽)</text>
  </svg>`;

  // 가로 막대
  const barHTML = `<div class="bar-track">
    <div class="bar-yang" style="width:${yangPct}%;">
      <span>陽 ${yangCount}개</span>
    </div>
    <div class="bar-yin" style="width:${yinPct}%;">
      <span>陰 ${yinCount}개</span>
    </div>
  </div>`;

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>음양비율표 — ${esc(name)}</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;}
.page{ border:1px solid #333;width:604px;max-height:600px;padding:10px;margin:10px auto;background:transparent;}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{margin:0;}@page{ border:1px solid #333;size:604px 600px;margin:0;}}

.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;background:linear-gradient(135deg,#1a237e,#283593);margin-bottom:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.7);margin-top:1px;}
.banner-hdr-right{text-align:right;}
.banner-hdr-name{font-size:9pt;font-weight:800;background:linear-gradient(90deg,#ffd54f,#fff176);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.banner-hdr-detail{font-size:7pt;color:rgba(255,255,255,.6);}

.pillars-wrap{display:flex;gap:8px;justify-content:center;margin-bottom:10px;}
.pillar{text-align:center;flex:1;max-width:130px;}
.pillar-label{font-size:7pt;color:#888;font-weight:600;margin-bottom:3px;}
.pillar-cell{border:1.5px solid #ddd;border-radius:8px;padding:8px 4px;margin-bottom:4px;position:relative;}
.p-char{font-size:22pt;font-weight:900;display:block;line-height:1.1;}
.p-kr{font-size:7pt;color:#666;display:block;}
.p-yy{font-size:8pt;font-weight:800;display:block;margin-top:2px;}

.gauge-section{margin-bottom:10px;}
.gauge-title{font-size:8.5pt;font-weight:800;color:#1a237e;margin-bottom:6px;padding-left:6px;border-left:3px solid #1a237e;}
.gauge-row{display:flex;align-items:center;gap:16px;}
.gauge-circle{flex-shrink:0;}
.gauge-right{flex:1;}
.gauge-labels{display:flex;justify-content:space-between;margin-bottom:6px;}
.gauge-label{font-size:8pt;font-weight:700;}
.gauge-pct{font-size:13pt;font-weight:900;}
.bar-track{display:flex;height:28px;border-radius:14px;overflow:hidden;}
.bar-yang{background:linear-gradient(90deg,#ff6d00,#ffab40);display:flex;align-items:center;justify-content:center;color:white;font-size:8pt;font-weight:800;min-width:40px;}
.bar-yin{background:linear-gradient(90deg,#1565c0,#42a5f5);display:flex;align-items:center;justify-content:center;color:white;font-size:8pt;font-weight:800;min-width:40px;}
.dot-row{display:flex;gap:4px;margin-top:6px;justify-content:center;}
.dot{width:12px;height:12px;border-radius:50%;}

.balance-box{display:flex;align-items:center;gap:14px;padding:10px 14px;border-radius:10px;margin-bottom:10px;}
.balance-badge{font-size:14pt;font-weight:900;min-width:80px;text-align:center;}
.balance-desc{font-size:8pt;color:#555;line-height:1.5;}

.ilgan-box{background:#f8f9fa;border:1.5px solid #ddd;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:14px;margin-bottom:10px;}
.ilgan-char{font-size:28pt;font-weight:900;line-height:1;}
.ilgan-info{flex:1;}
.ilgan-yy{font-size:10pt;font-weight:800;margin-bottom:2px;}
.ilgan-desc{font-size:7.5pt;color:#666;line-height:1.4;}

.legend{display:flex;gap:16px;justify-content:center;margin-top:6px;}
.leg-item{display:flex;align-items:center;gap:4px;font-size:7pt;color:#666;}
.leg-dot{width:10px;height:10px;border-radius:3px;}
</style>
</head><body>
<div class="page">
  <div class="banner-hdr">
    <div>
      <div class="banner-hdr-title">음양(陰陽) 비율표</div>
      <div class="banner-hdr-sub">사주 8글자의 음양 에너지 분석</div>
    </div>
    <div class="banner-hdr-right">
      <div class="banner-hdr-name">${esc(name)} 님</div>
      <div class="banner-hdr-detail">${원국.일주.천간}${원국.일주.지지}(${TG_KR[원국.일주.천간]}${JJ_KR[원국.일주.지지]}) 일주</div>
    </div>
  </div>

  <div class="pillars-wrap">${pillarHTML}</div>

  <div class="gauge-section">
    <div class="gauge-title">음양 비율</div>
    <div class="gauge-row">
      <div class="gauge-circle">${svgGauge}</div>
      <div class="gauge-right">
        <div class="gauge-labels">
          <div>
            <div class="gauge-label" style="color:#e65100;">양(陽)</div>
            <div class="gauge-pct" style="color:#e65100;">${yangCount}개</div>
          </div>
          <div style="text-align:right;">
            <div class="gauge-label" style="color:#1565c0;">음(陰)</div>
            <div class="gauge-pct" style="color:#1565c0;">${yinCount}개</div>
          </div>
        </div>
        ${barHTML}
        <div class="dot-row">
          ${Array.from({length:8}, (_, i) => `<div class="dot" style="background:${i < yangCount ? 'linear-gradient(135deg,#ff6d00,#ffab40)' : 'linear-gradient(135deg,#1565c0,#42a5f5)'};"></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="balance-box" style="background:${balanceColor}11;border:1.5px solid ${balanceColor}44;">
    <div class="balance-badge" style="color:${balanceColor};">${balance}</div>
    <div class="balance-desc">${balanceDesc}</div>
  </div>

  <div class="ilgan-box">
    <div>
      <div class="ilgan-char" style="color:${OH_COLOR[TG_OH[원국.일주.천간]]||'#333'}">${원국.일주.천간}</div>
      <div style="text-align:center;font-size:7pt;color:#888;">${TG_KR[원국.일주.천간]}</div>
    </div>
    <div class="ilgan-info">
      <div class="ilgan-yy" style="color:${ilganYang ? '#e65100' : '#1565c0'};">일간(日干) ${ilganYY}</div>
      <div class="ilgan-desc">${ilganDesc}</div>
    </div>
  </div>

  <div class="legend">
    <div class="leg-item"><div class="leg-dot" style="background:linear-gradient(135deg,#ff9800,#ffb74d);"></div> 양(陽) 》 활동적·외향적·적극적</div>
    <div class="leg-item"><div class="leg-dot" style="background:linear-gradient(135deg,#1565c0,#42a5f5);"></div> 음(陰) 》 정적·내향적·신중</div>
  </div>
</div>
</body></html>`;

  const samplesDir = path.dirname(masterPath);
  const slotTablesDir = path.join(samplesDir, 'tables');
  if (!fs.existsSync(slotTablesDir)) fs.mkdirSync(slotTablesDir, { recursive: true });
  const outFile = path.join(slotTablesDir, '음양비율표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');

  const outDir2 = path.join(TABLES_DIR, path.basename(path.dirname(masterPath)));
  if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });
  fs.writeFileSync(path.join(outDir2, '음양비율표.html'), HTML, 'utf-8');

  console.log(`✅ 음양비율표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_음양비율표.js <slot_id>'); process.exit(1); }
generate(slotId);
