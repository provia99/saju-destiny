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

const JJ_COLOR = {子:'#2196f3',丑:'#ff9800',寅:'#4caf50',卯:'#4caf50',辰:'#ff9800',巳:'#f44336',午:'#f44336',未:'#ff9800',申:'#9e9e9e',酉:'#9e9e9e',戌:'#ff9800',亥:'#2196f3'};
const TG_COLOR = {甲:'#4caf50',乙:'#4caf50',丙:'#f44336',丁:'#f44336',戊:'#ff9800',己:'#ff9800',庚:'#9e9e9e',辛:'#9e9e9e',壬:'#2196f3',癸:'#2196f3'};
const KR = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계',子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const OH_KR = {木:'목',火:'화',土:'토',金:'금',水:'수'};
const OH_COLOR = {木:'#4caf50',火:'#f44336',土:'#ff9800',金:'#9e9e9e',水:'#2196f3'};
const POS_KR = {년간:'年干',년지:'年支',월간:'月干',월지:'月支',일간:'日干',일지:'日支',시간:'時干',시지:'時支'};
const POS_AREA = {년지:'조상·사회',월지:'부모·직업',일지:'배우자·내면',시지:'자녀·말년'};

const TYPE_META = {
  천간합: { color:'#4caf50', icon:'🤝', desc:'두 천간이 합하여 새로운 오행으로 변환' },
  천간충: { color:'#ff5722', icon:'⚡', desc:'두 천간이 충돌하여 기운 약화' },
  지지삼합: { color:'#9c27b0', icon:'🔮', desc:'세 지지가 합하여 강력한 오행 변환' },
  지지육합: { color:'#2196f3', icon:'💎', desc:'두 지지가 합하여 오행 변환' },
  지지충: { color:'#f44336', icon:'💥', desc:'두 지지가 정면 충돌 》 변화·이동 유발' },
  지지형: { color:'#e65100', icon:'⚡', desc:'억압·통제·법적 분쟁 에너지' },
  지지파: { color:'#ff9800', icon:'💔', desc:'완성 직전 깨뜨리는 작용 》 마무리 주의' },
  지지해: { color:'#795548', icon:'🔗', desc:'원망·갈등 》 가까운 관계 손상 주의' },
  지장간암합: { color:'#607d8b', icon:'🌀', desc:'지지 속 숨은 천간끼리의 합 》 잠재적 변화' },
};

function generate(slotId) {
  // master.json 탐색: 슬롯 폴더 경로 또는 slotId
  let masterPath = path.join(slotId, 'master.json'); // 절대경로/슬롯폴더 모드
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
  if (!fs.existsSync(masterPath)) masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) { console.log('⚠️ 합충형파해: master.json 없음 (스킵)'); return; }
  const M = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));

  const r = 전체사주계산({
    이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
    년: M.생년, 월: M.생월, 일: M.생일, 시간: M.생시, 성별: M.성별 ?? '남',
    활동상태: M.활동상태, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

  const w = r.원국;
  const h = r.합충형파해 || {};
  const name = M.이름 || slotId;
  const ilju = `${w.일주.천간}${w.일주.지지}(${KR[w.일주.천간]}${KR[w.일주.지지]})`;
  const sajuStr = `${w.년주.천간}${w.년주.지지}·${w.월주.천간}${w.월주.지지}·${w.일주.천간}${w.일주.지지}·${w.시주.천간}${w.시주.지지}`;

  // 사주 4기둥 시각화
  const pillars = [
    { label:'년주', pos:'年柱', tg:w.년주.천간, jj:w.년주.지지 },
    { label:'월주', pos:'月柱', tg:w.월주.천간, jj:w.월주.지지 },
    { label:'일주', pos:'日柱', tg:w.일주.천간, jj:w.일주.지지, isIlju:true },
    { label:'시주', pos:'時柱', tg:w.시주.천간, jj:w.시주.지지 },
  ];

  const pillarHTML = pillars.map(p => {
    const tgC = TG_COLOR[p.tg]||'#333';
    const jjC = JJ_COLOR[p.jj]||'#333';
    const border = p.isIlju ? 'border:2px solid #c62828;background:#fff5f5;' : '';
    return `<div class="p-col" style="${border}">
  <div class="p-label">${p.label}(${p.pos})</div>
  <div class="p-tg" style="color:${tgC};">${p.tg}<span class="p-kr">${KR[p.tg]}</span></div>
  <div class="p-jj" style="color:${jjC};">${p.jj}<span class="p-kr">${KR[p.jj]}</span></div>
</div>`;
  }).join('<div class="p-arrow">→</div>');

  // 합충형파해 항목 수집
  const items = [];
  const typeOrder = ['천간합','천간충','지지삼합','지지육합','지지충','지지형','지지파','지지해','지장간암합'];

  for (const type of typeOrder) {
    const arr = h[type];
    const meta = TYPE_META[type];
    if (!arr || !arr.length) continue;

    for (const item of arr) {
      if (type === '지장간암합') {
        items.push({
          type, meta,
          char1: `${item.지1}(${KR[item.지1]})속 ${item.간1}(${KR[item.간1]})`,
          char2: `${item.지2}(${KR[item.지2]})속 ${item.간2}(${KR[item.간2]})`,
          pos: (item.위치1 && item.위치2) ? `${POS_KR[item.위치1]||item.위치1}↔${POS_KR[item.위치2]||item.위치2}` : '—',
          area: (item.위치1 && item.위치2) ? `${POS_AREA[item.위치1]||''}↔${POS_AREA[item.위치2]||''}` : '',
          extra: item.합화 ? `→ 化${item.합화}(${OH_KR[item.합화]}) [${item.강도}]` : '',
          extraColor: OH_COLOR[item.합화] || '#888',
        });
      } else {
        const c1 = item.지1 || item.간1 || '';
        const c2 = item.지2 || item.간2 || '';
        items.push({
          type, meta,
          char1: `${c1}(${KR[c1]||''})`,
          char2: `${c2}(${KR[c2]||''})`,
          pos: (item.위치1 && item.위치2) ? `${POS_KR[item.위치1]||item.위치1}↔${POS_KR[item.위치2]||item.위치2}` : '—',
          area: (item.위치1 && item.위치2) ? `${POS_AREA[item.위치1]||''}↔${POS_AREA[item.위치2]||''}` : '',
          extra: item.합화 ? `→ 化${item.합화}(${OH_KR[item.합화]})` : '',
          extraColor: OH_COLOR[item.합화] || '#888',
        });
      }
    }
  }

  // 없는 항목
  const noneTypes = typeOrder.filter(t => t !== '지장간암합' && (!h[t] || !h[t].length));

  // 행 HTML
  const rowsHTML = items.map(it => {
    const c1Color = JJ_COLOR[it.char1.charAt(0)] || TG_COLOR[it.char1.charAt(0)] || '#333';
    const c2Color = JJ_COLOR[it.char2.charAt(0)] || TG_COLOR[it.char2.charAt(0)] || '#333';
    const sep = it.type.includes('합') ? '+' : '↯';
    return `<tr>
  <td><span class="type-badge" style="background:${it.meta.color};">${it.meta.icon} ${it.type.replace('지지','').replace('천간','天')}</span></td>
  <td><span style="font-size:10pt;font-weight:800;color:${c1Color};">${it.char1.charAt(0)}</span><span style="font-size:6pt;color:#888;">${it.char1.slice(1)}</span> <span style="color:#aaa;">${sep}</span> <span style="font-size:10pt;font-weight:800;color:${c2Color};">${it.char2.charAt(0)}</span><span style="font-size:6pt;color:#888;">${it.char2.slice(1)}</span></td>
  <td style="font-size:6pt;">${it.pos}</td>
  <td style="font-size:6pt;color:#888;">${it.area}</td>
  <td>${it.extra ? `<span style="font-size:6.5pt;font-weight:700;color:${it.extraColor};">${it.extra}</span>` : '<span style="color:#ccc;">—</span>'}</td>
</tr>`;
  }).join('\n');

  // 없는 항목 요약
  const noneHTML = noneTypes.length ? `<div class="none-row">✅ 없음: ${noneTypes.map(t => TYPE_META[t].icon+' '+t.replace('지지','').replace('천간','天')).join(' · ')}</div>` : '';

  // 요약 메모
  const totalCount = items.filter(i => i.type !== '지장간암합').length;
  const amhapCount = items.filter(i => i.type === '지장간암합').length;
  let memo = '';
  if (totalCount === 0 && amhapCount === 0) {
    memo = `${name} 님의 원국에는 합충형파해가 없어 기본 안정 구조입니다. 대운·세운에서 합충이 발생할 때 주의를 기울이세요.`;
  } else if (totalCount === 0 && amhapCount > 0) {
    memo = `표면적 합충형파해는 없으나, 지장간암합 ${amhapCount}건이 있어 내면적 변화 에너지가 잠재합니다.`;
  } else {
    memo = `원국 내 ${totalCount}건의 합충형파해 + 지장간암합 ${amhapCount}건. 대운·세운과 교차할 때 해당 영역의 변화에 주의하세요.`;
  }

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>합충형파해 분석표 》 ${esc(name)}님</title>
<style>
${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{ border:1px solid #333;width:604px;padding:6px 10px;background:transparent;display:flex;flex-direction:column;gap:4px;overflow:hidden;}
@media screen{body{background:#f5f5f5;}.page{ border:1px solid #333;margin:20px auto;border-radius:4px;}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{background:transparent;margin:0;padding:0;}.page{margin:0;}@page{ border:1px solid #333;size:604px 840px;margin:0;}}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
.card{border:1.5px solid #333;border-radius:8px;overflow:hidden;}
.card-hd{padding:4px 12px;display:flex;align-items:center;justify-content:space-between;}
.card-hd-title{font-size:8pt;font-weight:900;color:white;}
.card-hd-sub{font-size:6pt;color:rgba(255,255,255,.85);}
/* 사주 기둥 */
.pillar-row{display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 10px;background:#fafafa;}
.p-col{text-align:center;padding:4px 8px;border-radius:6px;background:transparent;border:1px solid #333;min-width:60px;}
.p-label{font-size:7pt;color:#aaa;font-weight:700;}
.p-tg{font-family:'Noto Serif KR',serif;font-size:14pt;font-weight:800;line-height:1.1;}
.p-jj{font-family:'Noto Serif KR',serif;font-size:14pt;font-weight:800;line-height:1.1;}
.p-kr{font-size:6pt;color:#888;margin-left:1px;}
.p-arrow{font-size:8pt;color:#ccc;}
/* 테이블 */
table{width:100%;border-collapse:collapse;}
th{font-size:6pt;font-weight:700;color:#555;padding:4px 5px;background:#f5f5f5;border-bottom:1.5px solid #ddd;text-align:center;}
td{font-size:7pt;padding:4px 5px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;}
tr:last-child td{border-bottom:none;}
.type-badge{font-size:6pt;font-weight:700;color:white;padding:2px 6px;border-radius:4px;white-space:nowrap;display:inline-block;}
/* 없음/메모 */
.none-row{font-size:6.5pt;color:#888;padding:4px 10px;background:#f9f9f9;border-top:1px solid #eee;}
.memo{font-size:6.5pt;color:#555;padding:5px 10px;background:#f8f9fa;border-top:1px solid #eee;line-height:1.6;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
  <div>
    <div class="banner-hdr-title">⚡ 합충형파해(合沖刑破害) 분석표</div>
    <div class="banner-hdr-sub">네 기둥의 대화 · 합·충·형·파·해·암합</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">${esc(sajuStr)} · ${esc(ilju)}</div>
  </div>
</div>

<!-- 사주 4기둥 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#37474f,#546e7a);">
    <div class="card-hd-title">원국 사주 네 기둥</div>
    <div class="card-hd-sub">년주·월주·일주(★)·시주</div>
  </div>
  <div class="pillar-row">${pillarHTML}</div>
</div>

<!-- 합충형파해 테이블 -->
<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
    <div class="card-hd-title">합충형파해 분석 (${items.length}건)</div>
    <div class="card-hd-sub">합·충·형·파·해·지장간암합</div>
  </div>
  ${items.length ? `<table>
    <thead><tr><th>종류</th><th>관계 글자</th><th>위치</th><th>영역</th><th>변환/효과</th></tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>` : '<div style="padding:15px;text-align:center;color:#2e7d32;font-size:9pt;font-weight:700;">✅ 합충형파해 없음 》 기본 안정 구조</div>'}
  ${noneHTML}
  <div class="memo">📝 ${esc(memo)}</div>
</div>

</div></body></html>`;

  // 슬롯 폴더의 tables/ 에 직접 출력
  const slotTablesDir = path.join(path.dirname(masterPath), 'tables');
  if (!fs.existsSync(slotTablesDir)) fs.mkdirSync(slotTablesDir, { recursive: true });
  const outFile = path.join(slotTablesDir, '합충형파해분석표.html');
  fs.writeFileSync(outFile, HTML, 'utf-8');
  // tables/{slotId}/ 에도 출력 (generate_all 호환)
  const outDir2 = path.join(TABLES_DIR, path.basename(path.dirname(masterPath)));
  if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });
  fs.writeFileSync(path.join(outDir2, '합충형파해분석표.html'), HTML, 'utf-8');
  console.log(`✅ 합충형파해분석표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_합충형파해_v2.js <slot_id>'); process.exit(1); }
generate(slotId);
