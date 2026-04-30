#!/usr/bin/env node
// generate_영역별종합표.js
// 종장용 대시보드: 7개 영역별 핵심 키워드, 강점, 주의사항, 방어책
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch08.json
// 출력: tables/{slot}/영역별종합표.html
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function loadJSON(file) {
  const fp = path.join(QUEUE_DIR, file);
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : {};
}

// 오행별 기질 키워드
const 오행기질 = {
  '木': { 키워드:'성장·진취', 강점:'추진력, 창의성, 리더십', 주의:'고집, 조급, 분노 폭발', 방어:'인내심 훈련, 명상, 유연한 사고' },
  '火': { 키워드:'열정·표현', 강점:'사교성, 밝은 에너지, 설득력', 주의:'과욕, 감정 기복, 과시', 방어:'절제, 차분한 루틴, 경청 연습' },
  '土': { 키워드:'안정·신뢰', 강점:'포용력, 중재력, 신용', 주의:'우유부단, 집착, 둔감', 방어:'결단력 훈련, 변화 수용, 자기표현' },
  '金': { 키워드:'결단·의리', 강점:'정밀함, 실행력, 정의감', 주의:'완고, 비판적, 외로움', 방어:'유연성, 타인 수용, 감정 표현' },
  '水': { 키워드:'지혜·유연', 강점:'적응력, 통찰, 학습력', 주의:'불안, 우유부단, 비밀주의', 방어:'실행력 강화, 신뢰 구축, 운동' },
};

// 신강약별 재물 키워드
const 재물맵 = {
  '신강': { 키워드:'적극적 재물운', 강점:'투자·사업으로 큰 재물 가능', 주의:'과욕·무리한 확장', 방어:'분산투자, 전문가 상담' },
  '중화형신강': { 키워드:'균형적 재물운', 강점:'안정과 성장 병행 가능', 주의:'안주·기회 놓침', 방어:'적절한 모험, 자기계발 투자' },
  '신약': { 키워드:'보수적 재물운', 강점:'꾸준한 저축, 알뜰한 관리', 주의:'기회 회피, 소극적 투자', 방어:'소액 투자 시작, 전문가 의존' },
  '중화형신약': { 키워드:'안정 추구 재물운', 강점:'절약과 안정적 수입', 주의:'큰 투자 시 손실 위험', 방어:'원금 보장형 선호, 보험 확충' },
};

// 용신오행별 직업 방향
const 직업맵 = {
  '木': { 키워드:'교육·문화·성장산업', 강점:'창작, 기획, 교육 분야 적합', 주의:'지나친 이상주의', 방어:'현실적 목표 설정' },
  '火': { 키워드:'홍보·예술·IT', 강점:'표현력, 마케팅, 엔터테인먼트', 주의:'번아웃, 과로', 방어:'워라밸 관리, 휴식 루틴' },
  '土': { 키워드:'부동산·농업·중개', 강점:'신뢰 기반 사업, 관리직', 주의:'변화 적응 느림', 방어:'트렌드 학습, 유연한 전환' },
  '金': { 키워드:'금융·법률·기술', 강점:'분석력, 정밀 업무, 전문직', 주의:'대인관계 소홀', 방어:'네트워킹, 소통 훈련' },
  '水': { 키워드:'무역·물류·학술', 강점:'해외 활동, 연구, 컨설팅', 주의:'방향성 혼란', 방어:'멘토링, 장기 계획 수립' },
};

// 천간 → 오행 한자 매핑
const 천간오행변환 = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
const 영문오행변환 = { 'wood':'木','fire':'火','earth':'土','metal':'金','water':'水' };

function generate(slotId) {
  const d3 = loadJSON(`${slotId}_ch03.json`);
  const d8 = loadJSON(`${slotId}_ch08.json`);
  // saju_calc 단일 소스 보강
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d8); } catch(e){}
  if (!d3['이름'] && !d3['user_name']) { console.log('⚠️ 영역별종합표: ch03.json 없음 (스킵)'); return; }

  const name = d3['이름'] || d3['user_name'] || slotId;
  const ilju = d3['일주한자'] || d3['일주'] || '';
  const 일간 = d3['일주_천간'] || d8['일간'] || '';
  const 일간오행 = 천간오행변환[일간] || 영문오행변환[d3['일주_천간_오행']] || '土';
  const 용신오행 = d3['용신한자'] || d8['용신한자'] || '木';
  const 기신오행 = d8['기신오행'] || '';
  const 신강약 = d3['신강약'] || d8['신강약'] || '신강';

  // ch03에서 십성배치 재구성
  const 십성배치 = [];
  ['년주','월주','일주','시주'].forEach(주 => {
    const 천간십성 = d3[`${주}_천간십성`] || '';
    const 지지십성 = d3[`${주}_지지십성`] || '';
    if (천간십성 && 천간십성 !== '일원(나)') 십성배치.push({ 십성명:천간십성 });
    if (지지십성) 십성배치.push({ 십성명:지지십성 });
  });

  // 십성 존재 여부 체크
  const 존재십성 = new Set(십성배치.map(s => s.십성명));
  const has재성 = 존재십성.has('편재') || 존재십성.has('정재');
  const has관성 = 존재십성.has('편관') || 존재십성.has('정관');
  const has인성 = 존재십성.has('편인') || 존재십성.has('정인');
  const has식상 = 존재십성.has('식신') || 존재십성.has('상관');

  // 오행 기질
  const 기질 = 오행기질[일간오행] || 오행기질['土'];

  // 건강
  const 오행장기 = { '木':'간담·근육', '火':'심장·혈관', '土':'비위·소화기', '金':'폐·호흡기', '水':'신장·방광' };
  const 건강 = {
    키워드: `${오행장기[일간오행]||'소화기'} 중심 체질`,
    강점: `${일간오행} 기운이 본래 강해 ${오행장기[일간오행]||'해당'} 기초 튼튼`,
    주의: `기신 ${기신오행}(${오행장기[기신오행]||'해당'}) 계통 취약`,
    방어: `${용신오행} 오행 양생 식품 섭취, 정기 검진`,
  };

  // 재물
  const 재물기본 = 재물맵[신강약] || 재물맵['신강'];
  const 재물 = {
    키워드: 재물기본.키워드 + (has재성 ? '' : ' (재성 부재)'),
    강점: 재물기본.강점,
    주의: has재성 ? 재물기본.주의 : '재성 부재로 재물 기반 약함, ' + 재물기본.주의,
    방어: 재물기본.방어,
  };

  // 직업
  const 직업기본 = 직업맵[용신오행] || 직업맵['木'];
  const 직업 = {
    키워드: 직업기본.키워드,
    강점: 직업기본.강점,
    주의: 직업기본.주의,
    방어: 직업기본.방어,
  };

  // 사랑·가족
  const 사랑 = {
    키워드: has관성 ? '안정적 인연' : '자유로운 인연',
    강점: has관성 ? '사회적 책임감, 가정 중시' : '독립적 관계, 자유로운 사랑관',
    주의: has관성 ? '상대에 대한 과도한 통제' : '관성 부재로 파트너 인연 늦을 수 있음',
    방어: '소통·경청 훈련, 감사 표현 습관화',
  };

  // 귀인
  const 귀인 = {
    키워드: has인성 ? '어른·스승 도움' : '자수성가형',
    강점: has인성 ? '윗사람의 후원, 학습 기회 풍부' : '스스로 개척하는 강인함',
    주의: has인성 ? '의존심 과다, 독립성 약화' : '인성 부재로 도움 받기 어려울 수 있음',
    방어: has인성 ? '스스로 결정하는 연습' : '멘토·스승 적극 찾기, 학습 투자',
  };

  // 시련
  const 시련 = {
    키워드: `기신 ${기신오행} 대운 시 시련`,
    강점: '시련을 통한 성장, 내면 강화',
    주의: `${기신오행} 대운·세운 시 건강·재물·인간관계 복합 위기`,
    방어: `용신 ${용신오행} 활동 강화, 보수적 재무, 건강 관리 선제 대응`,
  };

  const rows = [
    { 영역:'기질', icon:'🧬', ...기질 },
    { 영역:'건강', icon:'🏥', ...건강 },
    { 영역:'재물', icon:'💰', ...재물 },
    { 영역:'직업', icon:'💼', ...직업 },
    { 영역:'사랑·가족', icon:'❤️', ...사랑 },
    { 영역:'귀인', icon:'🤝', ...귀인 },
    { 영역:'시련', icon:'⚡', ...시련 },
  ];

  const rowColors = ['#e3f2fd','#fff5f5','#fffde7','#e8f5e9','#fce4ec','#f3e5f5','#fff3e0'];

  const rowsHTML = rows.map((r, i) => {
    return `<tr style="background:${rowColors[i]};">
      <td style="font-weight:800;color:#1a3a6a;white-space:nowrap;">${r.icon} ${esc(r.영역)}</td>
      <td style="font-weight:700;">${esc(r.키워드)}</td>
      <td>${esc(r.강점)}</td>
      <td style="color:#c62828;">${esc(r.주의)}</td>
      <td style="color:#1565c0;">${esc(r.방어)}</td>
    </tr>`;
  }).join('');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>영역별 종합표 》 ${esc(name)}님</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;margin:0 auto;padding:14px 20px;background:transparent;display:flex;flex-direction:column;gap:6px;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{body{background:transparent;margin:0;padding:0;}.page{margin:0;width:604px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px 820px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;margin-bottom:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
table{width:100%;border-collapse:collapse;font-size:9px;}
th{background:#1a3a6a;color:white;padding:4px 5px;font-size:10px;font-weight:700;text-align:left;}
td{border-bottom:1px solid #e0e0e0;padding:4px 5px;vertical-align:top;line-height:1.5;}
tr:last-child td{border-bottom:none;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#1a237e,#4a148c);">
  <div>
    <div class="banner-hdr-title">영역별 종합표</div>
    <div class="banner-hdr-sub">7개 영역별 핵심 키워드 · 강점 · 주의사항 · 방어책</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · ${esc(신강약)} · 용신 ${esc(용신오행)} · 기신 ${esc(기신오행)}</div>
  </div>
</div>

<table>
<thead><tr>
  <th>영역</th><th>핵심 키워드</th><th>강점</th><th>주의사항</th><th>방어책</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '영역별종합표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '영역별종합표');
  console.log(`✅ 영역별종합표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_영역별종합표.js <slot_id>'); process.exit(1); }
generate(slotId);
