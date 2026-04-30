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

const JJ_KR = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const JJ_ANIMAL = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
const JJ_EMOJI = {子:'🐭',丑:'🐮',寅:'🐯',卯:'🐰',辰:'🐲',巳:'🐍',午:'🐴',未:'🐏',申:'🐵',酉:'🐔',戌:'🐶',亥:'🐷'};
const JJ_OH = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const OH_KR = {木:'목',火:'화',土:'토',金:'금',水:'수'};
const OH_COLOR = {木:'#4caf50',火:'#f44336',土:'#ff9800',金:'#9e9e9e',水:'#2196f3'};
const JJ_SEASON = {子:'겨울',丑:'겨울',寅:'봄',卯:'봄',辰:'봄',巳:'여름',午:'여름',未:'여름',申:'가을',酉:'가을',戌:'가을',亥:'겨울'};
const JJ_DIR = {子:'북',丑:'북동',寅:'동북',卯:'동',辰:'동남',巳:'남동',午:'남',未:'남서',申:'서남',酉:'서',戌:'서북',亥:'북서'};
const JJ_TIME = {子:'23:30~01:29',丑:'01:30~03:29',寅:'03:30~05:29',卯:'05:30~07:29',辰:'07:30~09:29',巳:'09:30~11:29',午:'11:30~13:29',未:'13:30~15:29',申:'15:30~17:29',酉:'17:30~19:29',戌:'19:30~21:29',亥:'21:30~23:29'};
const JJ_YY = {子:'양',丑:'음',寅:'양',卯:'음',辰:'양',巳:'음',午:'양',未:'음',申:'양',酉:'음',戌:'양',亥:'음'};
const TG_KR = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};

// 지장간 데이터
const JIJANGGAN = {
  子: [{간:'癸',비율:100}],
  丑: [{간:'己',비율:60},{간:'癸',비율:30},{간:'辛',비율:10}],
  寅: [{간:'甲',비율:60},{간:'丙',비율:30},{간:'戊',비율:10}],
  卯: [{간:'乙',비율:100}],
  辰: [{간:'戊',비율:60},{간:'乙',비율:30},{간:'癸',비율:10}],
  巳: [{간:'丙',비율:60},{간:'庚',비율:30},{간:'戊',비율:10}],
  午: [{간:'丁',비율:60},{간:'己',비율:30},{간:'丙',비율:10}],
  未: [{간:'己',비율:60},{간:'丁',비율:30},{간:'乙',비율:10}],
  申: [{간:'庚',비율:60},{간:'壬',비율:30},{간:'戊',비율:10}],
  酉: [{간:'辛',비율:100}],
  戌: [{간:'戊',비율:60},{간:'辛',비율:30},{간:'丁',비율:10}],
  亥: [{간:'壬',비율:60},{간:'甲',비율:30}],
};

function generate(slotId) {
  let masterPath = path.join(slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) { console.log('⚠️ 일지분석표: master.json 없음 (스킵)'); return; }

  const M = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
  const r = 전체사주계산({
    이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
    년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시, 성별: M.성별 ?? '남',
  });

  const name = M.이름 || slotId;
  const 일간 = r.원국.일주.천간;
  const 일지 = r.원국.일주.지지;
  const 일지kr = JJ_KR[일지] || '';
  const 일지oh = JJ_OH[일지] || '';
  const ohColor = OH_COLOR[일지oh] || '#888';

  // 12운성
  const 운성 = r.십이운성?.[`일지_${일지}`] || '';
  const 운성표 = {
    '장생':'시작의 기운, 새로운 출발',
    '목욕':'정화와 변화, 불안정',
    '관대':'성장과 자신감',
    '건록':'안정과 실력 발휘',
    '제왕':'최고의 에너지, 정점',
    '쇠':'서서히 줄어드는 기운',
    '병':'쇠약, 내면 성찰',
    '사':'정지, 전환 준비',
    '묘':'잠복, 씨앗 상태',
    '절':'단절과 새로운 시작',
    '태':'잉태, 가능성의 시작',
    '양':'양육, 성장 준비',
  };

  // 일주 12운성 직접 계산
  let 일지운성 = '';
  try {
    const 운성맵 = r.십이운성;
    if (운성맵) {
      for (const [k, v] of Object.entries(운성맵)) {
        if (k.includes('일지') || k.includes('日支')) { 일지운성 = v; break; }
      }
    }
  } catch(e) {}
  if (!일지운성) {
    const _12u = {
      甲:{亥:'장생',子:'목욕',丑:'관대',寅:'건록',卯:'제왕',辰:'쇠',巳:'병',午:'사',未:'묘',申:'절',酉:'태',戌:'양'},
      乙:{午:'장생',巳:'목욕',辰:'관대',卯:'건록',寅:'제왕',丑:'쇠',子:'병',亥:'사',戌:'묘',酉:'절',申:'태',未:'양'},
      丙:{寅:'장생',卯:'목욕',辰:'관대',巳:'건록',午:'제왕',未:'쇠',申:'병',酉:'사',戌:'묘',亥:'절',子:'태',丑:'양'},
      丁:{酉:'장생',申:'목욕',未:'관대',午:'건록',巳:'제왕',辰:'쇠',卯:'병',寅:'사',丑:'묘',子:'절',亥:'태',戌:'양'},
      戊:{寅:'장생',卯:'목욕',辰:'관대',巳:'건록',午:'제왕',未:'쇠',申:'병',酉:'사',戌:'묘',亥:'절',子:'태',丑:'양'},
      己:{酉:'장생',申:'목욕',未:'관대',午:'건록',巳:'제왕',辰:'쇠',卯:'병',寅:'사',丑:'묘',子:'절',亥:'태',戌:'양'},
      庚:{巳:'장생',午:'목욕',未:'관대',申:'건록',酉:'제왕',戌:'쇠',亥:'병',子:'사',丑:'묘',寅:'절',卯:'태',辰:'양'},
      辛:{子:'장생',亥:'목욕',戌:'관대',酉:'건록',申:'제왕',未:'쇠',午:'병',巳:'사',辰:'묘',卯:'절',寅:'태',丑:'양'},
      壬:{申:'장생',酉:'목욕',戌:'관대',亥:'건록',子:'제왕',丑:'쇠',寅:'병',卯:'사',辰:'묘',巳:'절',午:'태',未:'양'},
      癸:{卯:'장생',寅:'목욕',丑:'관대',子:'건록',亥:'제왕',戌:'쇠',酉:'병',申:'사',未:'묘',午:'절',巳:'태',辰:'양'},
    };
    일지운성 = (_12u[일간] || {})[일지] || '';
  }
  const 운성설명 = 운성표[일지운성] || '';

  // 신살 (일지 관련)
  const 신살목록 = [];
  const ns = r.신살 || {};
  for (const [살명, 살목록] of Object.entries(ns)) {
    if (Array.isArray(살목록)) {
      for (const s of 살목록) {
        if (s && (s.위치 === '일지' || s.지지 === 일지 || (typeof s === 'string' && s.includes('일지')))) {
          신살목록.push(살명);
        }
      }
    }
  }
  // 도화살/역마살 직접 체크
  const 도화지 = {寅:'卯',午:'卯',戌:'卯',申:'酉',子:'酉',辰:'酉',巳:'午',酉:'午',丑:'午',亥:'子',卯:'子',未:'子'};
  const 역마지 = {寅:'申',午:'申',戌:'申',申:'寅',子:'寅',辰:'寅',巳:'亥',酉:'亥',丑:'亥',亥:'巳',卯:'巳',未:'巳'};
  const 년지 = r.원국.년주?.지지 || '';
  if (도화지[년지] === 일지) 신살목록.push('도화살');
  if (역마지[년지] === 일지) 신살목록.push('역마살');
  const 신살표시 = [...new Set(신살목록)].join(', ') || '없음';

  // 지장간
  const jjg = JIJANGGAN[일지] || [];
  const jjgHTML = jjg.map(g => {
    const oh = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'}[g.간] || '';
    const c = OH_COLOR[oh] || '#888';
    return `<div class="jjg-item">
      <span class="jjg-gan" style="color:${c}">${g.간}(${TG_KR[g.간]||''})</span>
      <span class="jjg-oh">${oh}(${OH_KR[oh]||''})</span>
      <span class="jjg-ratio">${g.비율}%</span>
    </div>`;
  }).join('');

  // 용신과의 관계
  const 용신 = r.용신 || '';
  let 용신관계 = '';
  if (일지oh === 용신) 용신관계 = '용신과 같은 오행 (길)';
  else {
    const 상생 = {木:'火',火:'土',土:'金',金:'水',水:'木'};
    const 상극 = {木:'土',土:'水',水:'火',火:'金',金:'木'};
    if (상생[일지oh] === 용신) 용신관계 = '용신을 생해줌 (희신 역할)';
    else if (상생[용신] === 일지oh) 용신관계 = '용신이 생해줌 (상생)';
    else if (상극[일지oh] === 용신) 용신관계 = '용신을 극함 (주의)';
    else if (상극[용신] === 일지oh) 용신관계 = '용신이 극함 (기신 방향)';
    else 용신관계 = '간접 관계';
  }

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>일지분석표 — ${esc(name)}</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;}
.page{ border:1px solid #333;width:604px;max-height:600px;padding:10px;margin:10px auto;background:transparent;}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{margin:0;}@page{ border:1px solid #333;size:604px 600px;margin:0;}}

.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;background:linear-gradient(135deg,#1a237e,#283593);margin-bottom:6px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.7);margin-top:1px;}
.banner-hdr-right{text-align:right;}
.banner-hdr-name{font-size:9pt;font-weight:800;background:linear-gradient(90deg,#ffd54f,#fff176);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.banner-hdr-detail{font-size:7pt;color:rgba(255,255,255,.6);}

.ilji-main{display:flex;align-items:center;gap:12px;padding:10px;background:#f8f9fa;border-radius:10px;margin-bottom:6px;border:1.5px solid #ddd;}
.ilji-char{font-size:32pt;font-weight:900;color:${ohColor};line-height:1;}
.ilji-kr{font-size:9pt;color:#555;margin-top:2px;text-align:center;}
.ilji-emoji{font-size:28pt;}
.ilji-info{flex:1;}
.ilji-info-row{display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap;}
.ilji-tag{font-size:7pt;padding:3px 8px;border-radius:10px;font-weight:600;}
.tag-oh{background:${ohColor}22;color:${ohColor};border:1px solid ${ohColor}44;}
.tag-season{background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;}
.tag-dir{background:#e3f2fd;color:#1565c0;border:1px solid #bbdefb;}
.tag-time{background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;}
.tag-yy{background:#f3e5f5;color:#7b1fa2;border:1px solid #e1bee7;}
.tag-animal{background:#fce4ec;color:#c62828;border:1px solid #f8bbd0;}

.section{margin-bottom:6px;}
.section-title{font-size:8.5pt;font-weight:800;color:#1a237e;margin-bottom:4px;padding-left:6px;border-left:3px solid #1a237e;}

.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.card{background:#fafafa;border:1px solid #333;border-radius:6px;padding:6px 10px;}
.card-label{font-size:6.5pt;color:#888;font-weight:600;margin-bottom:2px;}
.card-value{font-size:9pt;font-weight:700;color:#333;}
.card-desc{font-size:6.5pt;color:#666;margin-top:2px;}

.jjg-wrap{display:flex;gap:8px;}
.jjg-item{flex:1;background:#fafafa;border:1px solid #333;border-radius:6px;padding:6px;text-align:center;}
.jjg-gan{font-size:12pt;font-weight:900;display:block;}
.jjg-oh{font-size:6.5pt;color:#666;display:block;margin-top:1px;}
.jjg-ratio{font-size:7pt;font-weight:700;color:#1565c0;display:block;margin-top:1px;}

.sinsal-wrap{display:flex;gap:6px;flex-wrap:wrap;}
.sinsal-chip{font-size:7pt;padding:2px 8px;border-radius:10px;font-weight:600;}
.sinsal-gil{background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;}
.sinsal-hyung{background:#ffebee;color:#c62828;border:1px solid #ffcdd2;}
.sinsal-none{background:#f5f5f5;color:#999;border:1px solid #333;}

.yongshin-box{background:linear-gradient(135deg,#fff8e1,#fff3e0);border:1.5px solid #ffcc02;border-radius:6px;padding:6px 10px;display:flex;align-items:center;gap:10px;}
.yongshin-label{font-size:6.5pt;color:#e65100;font-weight:600;}
.yongshin-value{font-size:9pt;font-weight:800;color:#e65100;}
.yongshin-rel{font-size:7pt;color:#bf360c;margin-top:1px;}
</style>
</head><body>
<div class="page">
  <div class="banner-hdr">
    <div>
      <div class="banner-hdr-title">일지(日支) 분석표</div>
      <div class="banner-hdr-sub">배우자궁 · 내면의 기질 · 숨은 에너지</div>
    </div>
    <div class="banner-hdr-right">
      <div class="banner-hdr-name">${esc(name)} 님</div>
      <div class="banner-hdr-detail">${일간}${일지}(${TG_KR[일간]}${일지kr}) 일주</div>
    </div>
  </div>

  <div class="ilji-main">
    <div style="text-align:center;">
      <div class="ilji-char">${일지}</div>
      <div class="ilji-kr">${일지kr} · ${JJ_ANIMAL[일지]||''}</div>
    </div>
    <div class="ilji-emoji">${JJ_EMOJI[일지]||''}</div>
    <div class="ilji-info">
      <div class="ilji-info-row">
        <span class="ilji-tag tag-oh">${일지oh}(${OH_KR[일지oh]||''})</span>
        <span class="ilji-tag tag-yy">${JJ_YY[일지]||''}</span>
        <span class="ilji-tag tag-season">${JJ_SEASON[일지]||''}</span>
        <span class="ilji-tag tag-dir">${JJ_DIR[일지]||''}쪽</span>
        <span class="ilji-tag tag-time">${JJ_TIME[일지]||''}</span>
        <span class="ilji-tag tag-animal">${JJ_ANIMAL[일지]||''}띠</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">12운성 · 일지 에너지 상태</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-label">일지 12운성</div>
        <div class="card-value" style="color:${ohColor};font-size:13pt;">${일지운성}</div>
        <div class="card-desc">${운성설명}</div>
      </div>
      <div class="card">
        <div class="card-label">일지의 의미</div>
        <div class="card-value">배우자궁 · 내면</div>
        <div class="card-desc">일지는 나의 내면, 배우자궁, 가정환경을 나타냅니다. 밖에서 보이는 나(일간)와 안에서의 나(일지)가 다를 수 있어요.</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">지장간(地藏干) · 일지 속 숨은 천간</div>
    <div class="jjg-wrap">${jjgHTML}</div>
  </div>

  <div class="section">
    <div class="section-title">신살(神殺) · 일지에 깃든 특수 기운</div>
    <div class="sinsal-wrap">
      ${신살표시 === '없음'
        ? '<span class="sinsal-chip sinsal-none">특별한 신살 없음</span>'
        : [...new Set(신살목록)].map(s => {
            const isGil = ['천을귀인','문창귀인','천덕귀인','월덕귀인','천복귀인','금여록'].includes(s);
            return `<span class="sinsal-chip ${isGil ? 'sinsal-gil' : 'sinsal-hyung'}">${s}</span>`;
          }).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">용신과의 관계</div>
    <div class="yongshin-box">
      <div>
        <div class="yongshin-label">용신 ${용신}(${OH_KR[용신]||''})</div>
        <div class="yongshin-value">일지 ${일지oh}(${OH_KR[일지oh]||''}) ↔ 용신 ${용신}(${OH_KR[용신]||''})</div>
        <div class="yongshin-rel">${용신관계}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">일지 활용 가이드</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-label">유리한 방위</div>
        <div class="card-value">${JJ_DIR[일지]||''}쪽</div>
        <div class="card-desc">이 방향에서 활동하거나 이 방향의 에너지를 활용하면 자연스럽습니다.</div>
      </div>
      <div class="card">
        <div class="card-label">유리한 계절</div>
        <div class="card-value">${JJ_SEASON[일지]||''}</div>
        <div class="card-desc">이 계절에 중요한 결정이나 시작을 하면 에너지가 잘 맞습니다.</div>
      </div>
      <div class="card">
        <div class="card-label">유리한 시간대</div>
        <div class="card-value">${JJ_TIME[일지]||''}</div>
        <div class="card-desc">하루 중 이 시간대에 집중력과 에너지가 높아지는 경향이 있어요.</div>
      </div>
      <div class="card">
        <div class="card-label">배우자궁 성향</div>
        <div class="card-value">${일지oh}(${OH_KR[일지oh]||''}) 기운</div>
        <div class="card-desc">${일지oh === '木' ? '성장지향적, 활동적인 배우자 인연' : 일지oh === '火' ? '밝고 열정적인 배우자 인연' : 일지oh === '土' ? '안정적이고 신뢰감 있는 배우자 인연' : 일지oh === '金' ? '원칙적이고 깔끔한 배우자 인연' : '지적이고 유연한 배우자 인연'}</div>
      </div>
    </div>
  </div>
</div>
</body></html>`;

  // 저장
  const samplesDir = path.dirname(masterPath);
  const slotTablesDir = path.join(samplesDir, 'tables');
  if (!fs.existsSync(slotTablesDir)) fs.mkdirSync(slotTablesDir, { recursive: true });
  const outFile = path.join(slotTablesDir, '일지분석표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');

  const outDir2 = path.join(TABLES_DIR, path.basename(path.dirname(masterPath)));
  if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });
  fs.writeFileSync(path.join(outDir2, '일지분석표.html'), HTML, 'utf-8');

  console.log(`✅ 일지분석표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_일지분석표.js <slot_id>'); process.exit(1); }
generate(slotId);
