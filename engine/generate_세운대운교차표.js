'use strict';

const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 오행 → 색상 팔레트
const OH_COLOR = {
  木:{ main:'#1e6b2a', pale:'#f3fcf5', border:'#a8dbb5', badge:'#d4f0db', bar:'#36b54a' },
  火:{ main:'#b92e27', pale:'#fff5f5', border:'#f5a9a5', badge:'#fdd9d7', bar:'#e05a55' },
  土:{ main:'#9b6f00', pale:'#fffdf4', border:'#f0d470', badge:'#fcedc2', bar:'#c9a200' },
  金:{ main:'#3d4f5c', pale:'#f7f9fa', border:'#b0c4d0', badge:'#dce6ec', bar:'#607080' },
  水:{ main:'#1a4e7a', pale:'#f0f6ff', border:'#90bfe0', badge:'#c8e0f4', bar:'#2874a6' },
};
function ohMap(v){
  const m={木:'木',木:'木',목:'木',화:'火',火:'火',토:'土',土:'土',금:'金',金:'金',수:'水',水:'水',
           wood:'木',fire:'火',earth:'土',metal:'金',water:'水'};
  const s=String(v||'').trim();
  const t=s.match(/([木火土金水])/);
  if(t) return t[1];
  if(m[s]) return m[s];
  // '金(금)' 같은 복합 형식 → 첫 글자 추출 fallback
  const first=s.charAt(0);
  if(m[first]) return m[first];
  return null;
}
function ohC(v){ return OH_COLOR[ohMap(v)]||OH_COLOR['金']; }

// 십성 → 색상
const SS_COLOR={
  비견:'#5c6bc0',겁재:'#7b1fa2',식신:'#2e7d32',상관:'#1565c0',
  편재:'#c65c00',정재:'#9b6f00',편관:'#b92e27',정관:'#6a1313',
  편인:'#1a4e7a',정인:'#004d40',
};
function ssC(s){ return SS_COLOR[s]||'#555'; }

// 총운 등급 색상
function gradeColor(s){
  if(!s) return '#666';
  if(s.includes('상상')||s==='상') return '#1a7a3c';
  if(s.includes('중상')) return '#2e7d32';
  if(s.includes('중')) return '#c9a200';
  if(s.includes('주의')||s.includes('하')) return '#b92e27';
  return '#555';
}

// 10개년 세운 파싱 (년|나이|천간십성|지지십성|천간|지지|12운성|신살|Y여부)
function parseSeunList(raw){
  if(!raw) return [];
  return raw.trim().split('\n').map(line=>{
    const p=line.split('|').map(x=>x.trim());
    return { yr:p[0]||'', age:p[1]||'', tgSS:p[2]||'', jjSS:p[3]||'',
             tg:p[4]||'', jj:p[5]||'', un:p[6]||'', sal:p[7]||'', cur:(p[8]||'N')==='Y' };
  }).filter(x=>x.yr);
}

// 월운 파싱 (월|간지|천간십성|천간|천간bg|지지|지지bg|지지십성|12운성|신살|용신여부|년도)
function parseMonthList(raw){
  if(!raw) return [];
  return raw.trim().split('\n').map(line=>{
    const p=line.split('|').map(x=>x.trim());
    return { m:p[0]||'', gj:p[1]||'', tgSS:p[2]||'', tg:p[3]||'',
             jj:p[5]||'', jjSS:p[7]||'', un:p[8]||'', sal:p[9]||'',
             yong:(p[10]||'N')==='Y', yr:p[11]||'' };
  }).filter(x=>x.m && x.yr===String(new Date().getFullYear()) || x.yr);
}

// ── 방위 칩
function dirChip(label, val, colorKey){
  const c=ohC(colorKey);
  return `<span style="display:inline-flex;align-items:center;gap:2px;padding:1px 6px;
    border-radius:10px;background:${c.badge};border:1px solid ${c.border};
    font-size:6.5pt;font-weight:bold;color:${c.main};margin:1px;">${label} ${esc(val)}</span>`;
}

function generate(slotId){
  const ch09Path = path.join(QUEUE_DIR, `${slotId}_ch09.json`);
  if(!fs.existsSync(ch09Path)){ console.error('❌ 없음:',ch09Path); process.exit(1); }
  const d  = JSON.parse(fs.readFileSync(ch09Path,'utf8'));
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const d3 = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path,'utf8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d, d3); } catch(e){}

  const 이름          = d['이름']||d3['이름']||slotId;
  const 일주          = d['일주']||d3['일주']||'';
  const birthS        = d3['birth_solar']||d3['생년월일']||'';
  const gender        = d3['user_gender']||'';
  const age           = d3['user_age']||'';
  const 올해          = d['올해']||new Date().getFullYear();
  const 용신오행       = d['용신오행']||'';
  const 기신오행       = d['기신오행']||'';
  const 희신오행       = d['희신오행']||'';

  // 세운
  const 세운간지       = d['세운간지']||'';
  const 세운오행       = d['세운오행']||'';
  const 세운십성       = d['세운십성']||'';
  const 세운12운성     = d['세운12운성']||'';
  const 세운성격       = d['세운성격']||'';

  // 대운
  const 현재대운간지   = d['현재대운간지']||'';
  const 현재대운나이   = d['현재대운나이범위']||'';
  const 다음대운간지   = d['다음대운간지']||'';
  const 다음전환점년도 = d['다음전환점년도']||'';
  const 다음전환점나이 = d['다음전환점나이']||'';

  // 교차
  const 합여부 = (d['교차합_세운_여부']||'N')==='Y';
  const 합설명 = d['교차합_세운_설명']||'';
  const 충여부 = (d['교차충_세운_여부']||'N')==='Y';
  const 충설명 = d['교차충_세운_설명']||'';

  // 운세 등급
  const 총운  = d['올해총운등급']||'';
  const 재물운 = d['올해재물운']||'';
  const 건강운 = d['올해건강운']||'';

  // 방위
  const 용신방위 = d['용신방위']||'';
  const 기신방위 = d['기신방위']||'';
  const 희신방위 = d['희신방위']||'';

  // 활동
  const 활동명  = d['활동명']||'';
  const 총평단어 = d['총평단어']||'';
  const 인생단계 = d['인생단계']||'';
  const 주요이슈 = d['주요이슈']||'';

  // 10년 세운 목록
  const seunList = parseSeunList(d['세운목록_10개년']);

  // 월운
  const monthList = parseMonthList(d['월운상세데이터']||'');
  // 올해 것만 필터 (yr===올해 or 전체)
  const 내년 = String(parseInt(올해)+1);
  const months = monthList.filter(x => !x.yr || x.yr === String(올해) || x.yr === 내년).slice(0,12);
  // 월 순서 정렬 (2~12, 1)
  const monthOrder = [2,3,4,5,6,7,8,9,10,11,12,1];
  const monthSorted = monthOrder.map(n=>months.find(x=>String(x.m)===String(n))).filter(Boolean);

  // 세운오행 색
  const seC = ohC(세운오행);
  const yC  = ohC(용신오행);

  // ── CSS
  const CSS=`<style>
${FONT_FACE_CSS}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Noto Sans KR',sans-serif;
     background:#f5f5f5;padding:40px 0;display:flex;justify-content:center;
     align-items:flex-start;min-height:100vh;}
.page{ border:1px solid #333;width:604px;max-height:840px;overflow:hidden;padding:6px 8px;background:transparent;display:flex;flex-direction:column;
      gap:7px;border-radius:8px;}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:604px 840px;margin:0;}}

/* banner-hdr */
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }

/* card */
.card{border:1.5px solid #333;border-radius:8px;overflow:hidden;}
.card-hd{padding:4px 12px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:7.5pt;font-weight:900;color:white;}
.card-hd-sub{font-size:7pt;color:rgba(255,255,255,.85);}

/* 세운·대운 그리드 */
.sw-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;}
.sw-box{padding:7px 10px;border-right:1px solid #e8e2d8;}
.sw-box:last-child{border-right:none;}
.sw-tag{font-size:6pt;font-weight:bold;color:#888;letter-spacing:.3px;margin-bottom:3px;}
.sw-gj{font-size:12pt;font-weight:900;line-height:1.1;margin-bottom:3px;}
.sw-row{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:2px;}
.chip{display:inline-block;padding:1px 5px;border-radius:8px;font-size:6pt;font-weight:bold;}

/* 교차 섹션 */
.cross-tbl{width:100%;border-collapse:collapse;}
.cross-tbl td{border:1px solid #333;padding:4px 7px;font-size:7pt;vertical-align:top;}
.ct-lbl{background:#f0ebe0;font-weight:bold;font-size:6.5pt;color:#475569;width:56px;text-align:center;}
.ct-yn{font-weight:900;font-size:7.5pt;}
.ct-desc{font-size:6.5pt;color:#555;margin-top:1px;}

/* 운세 등급 그리드 */
.grade-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:7px 8px;}
.grade-item{text-align:center;padding:5px 3px;background:#fafaf8;border:1px solid #333;border-radius:6px;}
.grade-label{font-size:6pt;color:#777;margin-bottom:3px;font-weight:bold;}
.grade-value{font-size:9.5pt;font-weight:900;}

/* 방위 섹션 */
.dir-row{display:flex;gap:4px;align-items:center;padding:5px 8px;flex-wrap:wrap;}
.dir-title{font-size:6.5pt;font-weight:bold;color:#555;margin-right:3px;}

/* 10년 세운 표 */
.sy-tbl{width:100%;border-collapse:collapse;font-size:6.5pt;}
.sy-tbl th{background:#475569;color:white;padding:3px 3px;text-align:center;font-size:6pt;font-weight:bold;}
.sy-tbl td{border:1px solid #333;padding:2px 3px;text-align:center;vertical-align:middle;}
.sy-tbl tr.cur-row td{background:#fff9e6;font-weight:bold;}
.sy-yr{font-weight:bold;font-size:6.5pt;}
.sy-gj{font-size:7.5pt;font-weight:900;}
.sy-ss{font-size:7pt;}
.sy-un{font-size:7pt;color:#666;}
.sy-sal{font-size:7pt;color:#888;}
.sy-mark{font-size:7pt;font-weight:bold;color:#b92e27;}

/* 월운 미니 격자 */
.mw-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;padding:6px 8px;}
.mw-cell{border-radius:5px;padding:3px 3px;text-align:center;border:1px solid #e0d8cc;}
.mw-m{font-size:7pt;color:#888;margin-bottom:1px;font-weight:bold;}
.mw-gj{font-size:7pt;font-weight:900;line-height:1.1;}
.mw-ss{font-size:7pt;margin-top:1px;}
.mw-un{font-size:7pt;color:#999;margin-top:1px;}
</style>`;

  // ── 세운 칩 (성격)
  let 성격칩 = '';
  if(세운성격){
    const gc = 세운성격.includes('용신')?'#1a7a3c': 세운성격.includes('희신')?'#1565c0':
               세운성격.includes('기신')||세운성격.includes('기신')?'#b92e27':'#555';
    성격칩 = `<span class="chip" style="background:${gc}20;color:${gc};border:1px solid ${gc}60;">${esc(세운성격)}</span>`;
  }

  // ── 10년 세운 표 행 생성
  let syRows = '';
  for(const s of seunList){
    const isCur = s.cur;
    const tgColor = ssC(s.tgSS);
    const jjColor = ssC(s.jjSS);
    syRows += `<tr${isCur?' class="cur-row"':''}>
      <td class="sy-yr">${esc(s.yr)}${isCur?'<br><span class="sy-mark">▶올해</span>':''}</td>
      <td style="font-size:6pt;">${esc(s.age)}세</td>
      <td><span class="sy-gj" style="color:${tgColor};">${esc(s.tg)}</span></td>
      <td><span class="sy-gj" style="color:${jjColor};">${esc(s.jj)}</span></td>
      <td><span class="sy-ss" style="color:${tgColor};">${esc(s.tgSS)}</span></td>
      <td class="sy-un">${esc(s.un)}</td>
      <td class="sy-sal">${esc(s.sal)}</td>
    </tr>`;
  }

  // ── 월운 격자 셀 생성
  let mwCells = '';
  const monthNames = {2:'2월',3:'3월',4:'4월',5:'5월',6:'6월',7:'7월',
                      8:'8월',9:'9월',10:'10월',11:'11월',12:'12월',1:'익년1월'};
  for(const m of monthSorted){
    const c = ohC(m.tg.match(/[木火土金水]/) ? m.tg.match(/[木火土金水]/)[0] : '金');
    const isYong = m.yong;
    const bg = isYong ? c.pale : '#fafaf8';
    const border = isYong ? c.border : '#e0d8cc';
    mwCells += `<div class="mw-cell" style="background:${bg};border-color:${border};">
      <div class="mw-m">${esc(monthNames[+m.m]||m.m+'월')}</div>
      <div class="mw-gj" style="color:${c.main};">${esc(m.gj)}</div>
      <div class="mw-ss" style="color:${ssC(m.tgSS)};">${esc(m.tgSS)}</div>
      <div class="mw-un">${esc(m.un)}</div>
      ${isYong?`<div style="font-size:7pt;color:${yC.main};font-weight:bold;">★용신월</div>`:''}
    </div>`;
  }

  // ── HTML 조립
  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>세운대운교차표 》 ${esc(이름)}</title>
${CSS}
</head><body><div class="page">`;

  // compact-hdr
  H += `<div class="banner-hdr" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
  <div>
    <div class="banner-hdr-title">🔀 세운·대운 교차표 (歲運·大運)</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(이름)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(일주)} · ${esc(올해)}년</div>
  </div>
</div>`;

  // ── Card 1: 세운·대운 기본 정보
  H += `<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#475569,#64748b);">
    <div class="card-hd-title">① 세운·대운 기본 정보</div>
    <div class="card-hd-sub">올해 세운 &amp; 현재 대운</div>
  </div>
  <div class="sw-grid">
    <div class="sw-box">
      <div class="sw-tag">올해 세운 (歲運)</div>
      <div class="sw-gj" style="color:${seC.main};">${esc(세운간지)}</div>
      <div class="sw-row">
        <span class="chip" style="background:${seC.badge};color:${seC.main};border:1px solid ${seC.border};">${esc(세운오행)}</span>
        <span class="chip" style="background:${ssC(세운십성)}20;color:${ssC(세운십성)};border:1px solid ${ssC(세운십성)}60;">${esc(세운십성)}</span>
        <span class="chip" style="background:#f3f4f6;color:#444;border:1px solid #d1d5db;">${esc(세운12운성)}</span>
        ${성격칩}
      </div>
    </div>
    <div class="sw-box">
      <div class="sw-tag">현재 대운 (大運)</div>
      <div class="sw-gj" style="color:#475569;">${esc(현재대운간지)}</div>
      <div class="sw-row">
        <span class="chip" style="background:#f0ebe0;color:#475569;border:1px solid #3335b5;">${esc(현재대운나이)}</span>
      </div>
      <div style="margin-top:5px;padding-top:5px;border-top:1px dashed #ddd;">
        <div style="font-size:7pt;color:#888;margin-bottom:2px;">다음 대운 (${esc(다음전환점년도)}, ${esc(다음전환점나이)}세~)</div>
        <div style="font-size:8pt;font-weight:800;color:#64748b;">${esc(다음대운간지)}</div>
      </div>
    </div>
  </div>
</div>`;

  // ── Card 2: 교차 관계 분석
  H += `<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#7b3f00,#a0522d);">
    <div class="card-hd-title">② 세운·대운 교차 관계 분석</div>
    <div class="card-hd-sub">합·충 여부 및 해석</div>
  </div>
  <table class="cross-tbl">
    <tr>
      <td class="ct-lbl">합(合)</td>
      <td>
        <span class="ct-yn" style="color:${합여부?'#1a7a3c':'#666'};">${합여부?'✓ 있음':'✕ 없음'}</span>
        ${합여부?`<div class="ct-desc">${esc(합설명)}</div>`:''}
      </td>
      <td class="ct-lbl">충(冲)</td>
      <td>
        <span class="ct-yn" style="color:${충여부?'#b92e27':'#666'};">${충여부?'⚡ 있음':'✕ 없음'}</span>
        ${충여부?`<div class="ct-desc">${esc(충설명)}</div>`:''}
      </td>
    </tr>
  </table>
  <div style="padding:5px 8px;background:#faf8f3;border-top:1px solid #e8e2d8;font-size:6.5pt;color:#555;line-height:1.5;">
    합이 있으면 안정적이며 협력이 활발해집니다. 충이 있으면 변화·이동·갈등의 기운이 강해집니다.
    ${인생단계?`<strong>${esc(인생단계)}</strong>로서 ${esc(주요이슈)}가 주요 화두입니다.`:''}
  </div>
</div>`;

  // ── Card 3: 올해 운세 등급 + 방위
  H += `<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#c65c00,#e87020);">
    <div class="card-hd-title">③ 올해 운세 등급 &amp; 길방</div>
    <div class="card-hd-sub">총운·재물·건강 / 용신 방위</div>
  </div>
  <div class="grade-grid">
    <div class="grade-item">
      <div class="grade-label">올해 총운</div>
      <div class="grade-value" style="color:${gradeColor(총운)};">${esc(총운)||'—'}</div>
    </div>
    <div class="grade-item">
      <div class="grade-label">재물운</div>
      <div class="grade-value" style="color:${gradeColor(재물운)};">${esc(재물운)||'—'}</div>
    </div>
    <div class="grade-item">
      <div class="grade-label">건강운</div>
      <div class="grade-value" style="color:${gradeColor(건강운)};">${esc(건강운)||'—'}</div>
    </div>
  </div>
  <div class="dir-row" style="border-top:1px solid #eee;">
    <span class="dir-title">길방 ·</span>
    ${용신방위 ? dirChip('用神', 용신방위, 용신오행) : ''}
    ${희신방위 ? dirChip('喜神', 희신방위, 희신오행) : ''}
    ${기신방위 ? `<span style="display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:10px;background:#fde8e7;border:1px solid #f5a9a5;font-size:6.5pt;font-weight:bold;color:#b92e27;margin:1px;">忌神 ${esc(기신방위)}</span>` : ''}
    <span style="font-size:6pt;color:#888;margin-left:3px;">방향 참고</span>
  </div>
</div>`;

  // ── Card 4: 향후 10년 세운 흐름
  if(syRows){
    H += `<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#1a3a60,#2c5282);">
    <div class="card-hd-title">④ 향후 10년 세운 흐름</div>
    <div class="card-hd-sub">연간 세운 천간·지지·십성·12운성</div>
  </div>
  <table class="sy-tbl">
    <thead><tr>
      <th>년도</th><th>나이</th><th>천간</th><th>지지</th><th>십성</th><th>12운성</th><th>신살</th>
    </tr></thead>
    <tbody>${syRows}</tbody>
  </table>
</div>`;
  }

  // ── Card 5: 월운 요약
  if(mwCells){
    H += `<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#2e7d32,#43a047);">
    <div class="card-hd-title">⑤ ${esc(올해)}년 월운 요약</div>
    <div class="card-hd-sub">월별 간지·십성·12운성 (★ = 용신월)</div>
  </div>
  <div class="mw-grid">${mwCells}</div>
</div>`;
  }

  H += `</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  const outPath = path.join(outDir, '세운대운교차표.html');
  fs.writeFileSync(outPath, H, 'utf8');
  console.log(`✅ 세운대운교차표 생성: ${outPath}  (${H.length}B)`);
}

const slotId = process.argv[2] || 's11';
generate(slotId);
