'use strict';
const fs = require('fs');
const path = require('path');
const samplesDir = path.join(__dirname, 'queue');
const { FONT_FACE_CSS } = require('./font_config');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const inputArg = process.argv[2] || 's11';


const ch03Path = path.join(samplesDir, `${inputArg}_ch03.json`);
const ch06Path = path.join(samplesDir, `${inputArg}_ch06.json`);
const ch18Path = path.join(samplesDir, `${inputArg}_ch18.json`);

const d3  = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf8')) : {};
const ch06 = fs.existsSync(ch06Path) ? JSON.parse(fs.readFileSync(ch06Path, 'utf8')) : {};
const ch18 = fs.existsSync(ch18Path) ? JSON.parse(fs.readFileSync(ch18Path, 'utf8')) : {};
try { require('./_saju_data').augmentAll(inputArg, samplesDir, d3, ch06, ch18); } catch(e){}

// 인적사항
const name   = d3['이름']        || ch06['이름'] || inputArg;
const birthS = d3['birth_solar'] || d3['생년월일'] || '';
const gender = d3['user_gender'] || d3['성별'] || '';
const age    = d3['user_age']    || d3['나이'] || '';
const ilju   = d3['일주']        || '';

// 용신·희신·기신 정보
const 용신오행   = ch06['용신오행'] || ch18['용신오행'] || '木(목)';
const 희신오행   = ch06['희신오행'] || ch18['희신오행'] || '';
const 기신오행   = ch06['기신오행'] || ch18['기신오행'] || '';
const 용신색상   = ch18['용신색상'] || '';
const 용신방위   = ch18['용신방위'] || '';
const 용신숫자   = ch18['용신숫자'] || '';
const 용신음식   = ch18['용신음식'] || '';
const 용신계절   = ch18['용신계절'] || '';
const 용신직업군 = ch18['용신직업군'] || ch06['용신직업군'] || '';
const 희신색상   = ch18['희신색상'] || '';
const 희신방위   = ch18['희신방위'] || '';

// 오행 팔레트
const OH = {
  '木': { hex:'#1e6b2a', mid:'#2d9e3e', light:'#e8f7ec', pale:'#f3fcf5', char:'木', kor:'목', icon:'🌿' },
  '火': { hex:'#b92e27', mid:'#d9534f', light:'#fde8e7', pale:'#fff5f5', char:'火', kor:'화', icon:'🔥' },
  '土': { hex:'#9b6f00', mid:'#c99400', light:'#fff8e0', pale:'#fffdf4', char:'土', kor:'토', icon:'🏔' },
  '金': { hex:'#3d4f5c', mid:'#5a7080', light:'#eef1f4', pale:'#f7f9fa', char:'金', kor:'금', icon:'⚙️' },
  '水': { hex:'#1a4e7a', mid:'#2874a6', light:'#e3eef9', pale:'#f0f6ff', char:'水', kor:'수', icon:'💧' },
};

function ohKey(t) {
  const s = String(t||'');
  const m = s.match(/([木火土金水])/);
  if (m) return m[1];
  // fallback: 첫 글자로 매핑
  const first = s.trim().charAt(0);
  const fallbackMap = { '목':'木','화':'火','토':'土','금':'金','수':'水' };
  return fallbackMap[first] || '木';
}
const 용신키 = ohKey(용신오행);
const 희신키 = ohKey(희신오행);
const 기신키 = ohKey(기신오행);
const 용C = OH[용신키] || OH['木'];
const 희C = OH[희신키] || OH['水'];
const 병C = OH[기신키] || OH['金'];

// 오행별 실천 체크리스트 템플릿
const OH_CHECK = {
  '木': {
    daily:   ['청록·녹색 계통 옷이나 소품 활용', '목(木) 음식(신맛·채소·새싹) 섭취', '동쪽(東) 방향으로 창·책상 배치', '아침 기지개·스트레칭으로 목 기운 활성화'],
    weekly:  ['숲·공원 산책으로 목 기운 흡수', '새로운 계획·아이디어 노트 작성', '교육·학습 관련 활동 시간 확보', '가족·동료와 소통하며 성장 에너지 충전'],
    monthly: ['봄철(1~3월) 중요 결정·계약 집중', '목 직업군(교육·의료·환경·출판) 네트워크 강화', '3·8 날짜 중요 일정 배치', '식물 키우기·원예 활동으로 기운 안정'],
    avoid:   ['금(金) 기운 과다 환경 주의', '가을철 중요 결정 신중', '백색·은색 과다 착용 자제', '금속 업종 과도한 투자 보류'],
  },
  '火': {
    daily:   ['붉은색·오렌지색 소품·포인트 활용', '화(火) 음식(쓴맛·붉은 식품) 섭취', '남쪽(南) 방향 활동·채광 확보', '오전 햇볕 쬐기 10분 이상'],
    weekly:  ['활동적인 운동·야외 활동 강화', '사교·네트워킹 모임 참여', '열정·창의 에너지 쏟는 프로젝트 진행', '예술·미적 감각 키우는 활동'],
    monthly: ['여름철(4~6월) 중요 행사·계획 집중', '화 직업군(예술·요식·디자인·연예) 강화', '2·7 날짜 중요 결정 배치', '남향·밝은 공간에서 업무 진행'],
    avoid:   ['수(水) 기운 과다 환경 주의', '겨울철 주요 결정 신중', '청색·검정 과다 착용 자제', '수 관련 업종 과투자 경계'],
  },
  '土': {
    daily:   ['황토색·베이지·갈색 계통 착용', '토(土) 음식(단맛·황색 식품·뿌리채소) 섭취', '중앙·안정된 공간에서 업무 진행', '규칙적인 식사 시간 유지'],
    weekly:  ['안정적인 저축·재무 계획 점검', '신뢰·성실 이미지 강화 활동', '부동산·실물 자산 정보 수집', '가족·기반 관계 돌보기'],
    monthly: ['환절기(3·6·9·12월) 건강 관리 강화', '토 직업군(부동산·금융·농업·요식) 기회 탐색', '5·10 날짜 계약·협상 일정', '안정적 루틴·습관 점검 및 정비'],
    avoid:   ['목(木) 기운 과다 환경 주의', '봄철 충동 결정 경계', '청색·녹색 과다 착용 자제', '변동성 투자 보류'],
  },
  '金': {
    daily:   ['흰색·은색·회색 계통 착용', '금(金) 음식(매운맛·흰 식품·견과) 섭취', '서쪽(西) 방향 책상·침실 배치', '정확·꼼꼼한 업무 처리로 금 기운 강화'],
    weekly:  ['논리적 사고·분석 훈련 시간 확보', '금속 공예·정밀 작업 취미 활동', '서쪽 여행·활동 계획', '재무·법·계약 서류 정리 및 검토'],
    monthly: ['가을철(7~9월) 중요 결정·이직 집중', '금 직업군(금융·법조·IT·기계·군) 강화', '4·9 날짜 중요 계약 배치', '불필요한 것 정리·단순화로 금 기운 정화'],
    avoid:   ['화(火) 기운 과다 환경 주의', '여름철 충동적 결정 경계', '붉은색 과다 착용 자제', '화 관련 업종 과투자 경계'],
  },
  '水': {
    daily:   ['검정·파랑·남색 계통 착용', '수(水) 음식(짠맛·해산물·검은 식품) 섭취', '북쪽(北) 방향으로 책상·명상 공간 배치', '물 충분히 마시기·수분 보충'],
    weekly:  ['지식·연구·독서 시간 확보', '물가·바다·수영 등 수 기운 흡수 활동', '직관·통찰력 활용 업무 집중', '명상·내면 성찰 시간 갖기'],
    monthly: ['겨울(10~12월) 중요 계획·결정 집중', '수 직업군(무역·연구·철학·심리·운수) 강화', '1·6 날짜 중요 일정 배치', '북향 여행·활동으로 운기 충전'],
    avoid:   ['토(土) 기운 과다 환경 주의', '장마·습한 환경 건강 주의', '황색·갈색 과다 착용 자제', '부동산·토 관련 업종 과투자 경계'],
  },
};

const 체크항목 = OH_CHECK[용신키] || OH_CHECK['木'];

// 희신 실천 조언
const 희신조언맵 = {
  '木': '봄 활동·녹색 환경·교육 투자로 희신 기운 보완',
  '火': '남쪽 활동·붉은 포인트·사교 활동으로 희신 기운 보완',
  '土': '안정적 루틴·황토색 환경·실물 자산으로 희신 기운 보완',
  '金': '서쪽 활동·흰색 소품·정밀 작업으로 희신 기운 보완',
  '水': '북쪽 방위·검정·파랑 활용·독서·명상으로 희신 기운 보완',
};

const 기신주의맵 = {
  '木': '봄철·동쪽 방위에서 과도한 활동 주의, 녹색 과잉 환경 경계',
  '火': '여름·남향·붉은 환경 과도 노출 주의, 감정적 충동 경계',
  '土': '환절기 건강 관리, 황색·갈색 과잉 착용 자제, 토지 투자 신중',
  '金': '가을·금속성 환경 과노출 주의, 강경 발언·결단 충동 경계',
  '水': '겨울·습한 환경·과도한 고독 주의, 불필요한 비밀·은둔 경계',
};

// 직업군 → 칩 배열
function jobChips(str, color, bg) {
  if (!str) return '';
  return str.split(/[·,]/).map(j => j.trim()).filter(Boolean)
    .map(j => `<span class="job-chip" style="border-color:${color}55;color:${color};background:${bg};">${esc(j)}</span>`).join('');
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>용신체크리스트 》 ${esc(name)}님</title>
  <style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; max-height:840px; overflow:hidden; padding:4px 6px; background:transparent; display:flex; flex-direction:column; gap:1px; font-size:95%; }
@media screen { body{background:#f5f5f5;} .page{ border:1px solid #333;margin:20px auto;border-radius:4px;} }
@media print { body{background:transparent;margin:0;padding:0;}
  .page{ border:1px solid #333;margin:0;width:604px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @page{size:604px 840px;margin:0;} }

/* 헤더 */
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }

/* 카드 */
.card{border:1.5px solid #ddd;border-radius:8px;overflow:hidden;}
.card+.card{margin-top:0;}
.card-hd{padding:4px 10px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:7.5pt;font-weight:900;color:white;}
.card-hd-sub{font-size:7pt;color:rgba(255,255,255,.85);}
.card-body{padding:3px 8px;background:transparent;}

/* 용신 배너 */
.yong-banner{display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;background:${용C.pale};border:1.5px solid ${용C.hex};}
.yong-char{font-size:20pt;font-weight:900;color:${용C.hex};line-height:1;flex-shrink:0;width:30px;text-align:center;}
.yong-detail{flex:1;}
.yong-name{font-size:10pt;font-weight:900;color:${용C.hex};margin-bottom:1px;}
.yong-desc{font-size:6pt;color:#555;line-height:1.5;}

/* 속성 6칸 그리드 */
.attr6{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:4px;}
.a6-item{border-radius:5px;padding:4px 6px;border:1.2px solid ${용C.hex}33;background:transparent;}
.a6-lbl{font-size:6.5pt;font-weight:700;color:#999;margin-bottom:1px;}
.a6-val{font-size:6.5pt;font-weight:800;color:#222;}
.a6-icon{font-size:7pt;margin-right:2px;}

/* 희신·기신 2열 */
.hb-row{display:grid;grid-template-columns:1fr 1fr;gap:4px;}
.hb-item{border-radius:6px;padding:5px 8px;border:1.2px solid;}
.hb-lbl{font-size:7pt;font-weight:700;margin-bottom:2px;}
.hb-oh{font-size:10pt;font-weight:900;line-height:1;margin-bottom:2px;}
.hb-sub{font-size:7pt;line-height:1.4;}

/* 직업군 칩 */
.job-chips{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;}
.job-chip{font-size:7pt;font-weight:700;padding:1px 6px;border-radius:4px;border:1.2px solid;}

/* 체크리스트 */
.cl-section{margin-bottom:3px;}
.cl-hd{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;margin-bottom:2px;}
.cl-hd-icon{font-size:7pt;}
.cl-hd-txt{font-size:6pt;font-weight:900;color:white;}
.cl-list{display:flex;flex-direction:column;gap:2px;}
.cl-item{display:flex;align-items:flex-start;gap:4px;padding:3px 6px;border-radius:4px;border:1px solid #e8e8e8;background:#fafafa;}
.cl-box{width:10px;height:10px;border:1.2px solid #ccc;border-radius:2px;flex-shrink:0;margin-top:1px;}
.cl-txt{font-size:7pt;color:#333;line-height:1.4;flex:1;}

/* 기신 회피 */
.avoid-list{display:flex;flex-direction:column;gap:2px;}
.avoid-item{display:flex;align-items:flex-start;gap:4px;padding:3px 6px;border-radius:4px;border:1px solid ${병C.hex}22;background:${병C.pale};}
.avoid-icon{font-size:7pt;flex-shrink:0;}
.avoid-txt{font-size:7pt;color:#555;line-height:1.4;flex:1;}

/* 팁 박스 */
.tip{padding:5px 8px;border-radius:6px;border-left:3px solid ${용C.hex};background:${용C.light};font-size:7pt;color:#444;line-height:1.5;}
.tip-title{font-weight:900;color:${용C.hex};margin-bottom:2px;font-size:6.5pt;}
  </style>
</head>
<body>
<div class="page">

  <!-- 헤더 -->
  <div class="banner-hdr" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
  <div>
    <div class="banner-hdr-title">📋 용신(用神) 실천 체크리스트</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · 용신 ${esc(용신오행)}</div>
  </div>
</div>

  <!-- ① 용신 핵심 정보 -->
  <div class="card">
    <div class="card-hd" style="background:linear-gradient(135deg,${용C.hex},${용C.mid});">
      <div class="card-hd-title">① 내 용신(用神) 》 ${esc(용신오행)}</div>
      <div class="card-hd-sub">강화해야 할 오행 에너지</div>
    </div>
    <div class="card-body">
      <div class="yong-banner">
        <div class="yong-char">${용C.char}</div>
        <div class="yong-detail">
          <div class="yong-name">${esc(용신오행)} 용신 (${용C.kor})</div>
          <div class="yong-desc">
            이 오행을 일상에서 강화할수록 운기가 안정됩니다.<br>
            ${용신직업군?`적합 직업군 · <b style="color:${용C.hex};">${esc(용신직업군)}</b>` : ''}
          </div>
        </div>
      </div>
      <div class="attr6">
        ${용신색상?`<div class="a6-item"><div class="a6-lbl">🎨 색상</div><div class="a6-val">${esc(용신색상)}</div></div>`:''}
        ${용신방위?`<div class="a6-item"><div class="a6-lbl">🧭 방위</div><div class="a6-val">${esc(용신방위)}</div></div>`:''}
        ${용신숫자?`<div class="a6-item"><div class="a6-lbl">🔢 숫자</div><div class="a6-val">${esc(용신숫자)}</div></div>`:''}
        ${용신계절?`<div class="a6-item"><div class="a6-lbl">🍃 계절</div><div class="a6-val">${esc(용신계절)}</div></div>`:''}
        ${용신음식?`<div class="a6-item"><div class="a6-lbl">🍽 음식</div><div class="a6-val">${esc(용신음식)}</div></div>`:''}
        ${용신직업군?`<div class="a6-item" style="grid-column:span 1;"><div class="a6-lbl">💼 직업군</div><div class="a6-val" style="font-size:7pt;">${esc(용신직업군.split(/[·,]/)[0]||용신직업군)}&hellip;</div></div>`:''}
      </div>
      ${용신직업군?`<div class="job-chips">${jobChips(용신직업군, 용C.hex, 용C.light)}</div>`:''}
    </div>
  </div>

  <!-- ② 희신·기신 섹션 제거 (사용자 요청) — 용신가이드카드에서 별도 다룸 -->

  <!-- ② 강화 실천 체크리스트 (이전 ③) -->
  <div class="card">
    <div class="card-hd" style="background:linear-gradient(135deg,${용C.hex},${용C.mid});">
      <div class="card-hd-title">② 용신 강화 실천 체크리스트</div>
      <div class="card-hd-sub">매일·매주·매월 실천으로 운기 상승</div>
    </div>
    <div class="card-body">
      <!-- 매일 -->
      <div class="cl-section">
        <div class="cl-hd" style="background:${용C.hex};">
          <span class="cl-hd-icon">📅</span>
          <span class="cl-hd-txt">매일 실천 (Daily)</span>
        </div>
        <div class="cl-list">
          ${체크항목.daily.map(t=>`<div class="cl-item"><div class="cl-box"></div><div class="cl-txt">${esc(t)}</div></div>`).join('')}
        </div>
      </div>
      <!-- 매주 -->
      <div class="cl-section">
        <div class="cl-hd" style="background:${용C.mid};">
          <span class="cl-hd-icon">📆</span>
          <span class="cl-hd-txt">매주 실천 (Weekly)</span>
        </div>
        <div class="cl-list">
          ${체크항목.weekly.map(t=>`<div class="cl-item"><div class="cl-box"></div><div class="cl-txt">${esc(t)}</div></div>`).join('')}
        </div>
      </div>
      <!-- 매월 -->
      <div class="cl-section">
        <div class="cl-hd" style="background:#546e7a;">
          <span class="cl-hd-icon">📊</span>
          <span class="cl-hd-txt">매월 실천 (Monthly)</span>
        </div>
        <div class="cl-list">
          ${체크항목.monthly.map(t=>`<div class="cl-item"><div class="cl-box"></div><div class="cl-txt">${esc(t)}</div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- ④ 기신 회피 항목 -->
  <div class="card">
    <div class="card-hd" style="background:linear-gradient(135deg,${병C.hex},${병C.mid});">
      <div class="card-hd-title">③ 기신(忌神) 회피 체크리스트</div>
      <div class="card-hd-sub">${esc(기신오행)} 과잉 환경 차단 》 운기 손실 방지</div>
    </div>
    <div class="card-body">
      <div class="avoid-list">
        ${체크항목.avoid.map(t=>`<div class="avoid-item"><div class="avoid-icon">🚫</div><div class="avoid-txt">${esc(t)}</div></div>`).join('')}
      </div>
      <div class="tip" style="margin-top:4px;">
        <div class="tip-title">💡 기신 회피 핵심</div>
        ${esc(기신주의맵[기신키]||'기신 오행이 강해지는 환경·시기·사람을 주의하세요.')}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;

const outputDir = path.join(__dirname, 'tables', inputArg);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, '용신체크리스트.html');
require('./_guards').safeWriteHtml(outputPath, html, { 이름: name }, '용신체크리스트');
console.log(`✓ Generated: ${outputPath} (${html.length} bytes)`);
