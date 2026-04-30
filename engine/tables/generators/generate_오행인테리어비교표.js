#!/usr/bin/env node
/**
 * generate_오행인테리어비교표.js  — 오행 인테리어 매트릭스 (용신 green, 기신 red)
 * node generate_오행인테리어비교표.js <slot_id>
 * 출력: tables/{slot}/오행인테리어비교표.html
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function ohKey(v) {
  if (!v) return null;
  const m = { wood:'wood','木':'wood','목':'wood', fire:'fire','火':'fire','화':'fire',
              earth:'earth','土':'earth','토':'earth', metal:'metal','金':'metal','금':'metal',
              water:'water','水':'water','수':'water' };
  if (m[v]) return m[v];
  return m[String(v).charAt(0)] || null;
}

const OH_KEYS_MAP = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' };

const INTERIOR_DATA = [
  { key:'wood',  oh:'木(목)', color:'그린 · 에메랄드 · 연두',     material:'원목 · 대나무 · 리넨 · 면',   furniture:'원목 테이블 · 나무 책장',       plant:'몬스테라 · 고무나무 · 아이비',  scent:'시더우드 · 유칼립투스 · 편백',  dir:'동(東)' },
  { key:'fire',  oh:'火(화)', color:'레드 · 코랄 · 오렌지 · 핑크', material:'가죽 · 울 · 실크 · 캔들',     furniture:'레드 소파 · 벽난로 · 조명',     plant:'안시리움 · 장미 · 포인세티아',  scent:'시나몬 · 바닐라 · 로즈마리',    dir:'남(南)' },
  { key:'earth', oh:'土(토)', color:'베이지 · 황토 · 테라코타',    material:'도자기 · 석재 · 타일 · 점토',  furniture:'도자기 화병 · 석재 테이블',      plant:'다육이 · 선인장 · 허브',        scent:'산달우드 · 파출리 · 베티버',    dir:'중앙' },
  { key:'metal', oh:'金(금)', color:'화이트 · 실버 · 골드',       material:'스테인리스 · 황동 · 크리스탈', furniture:'메탈 선반 · 거울 프레임',        plant:'백합 · 치자 · 국화',            scent:'페퍼민트 · 티트리 · 유향',      dir:'서(西)' },
  { key:'water', oh:'水(수)', color:'네이비 · 차콜 · 딥블루',     material:'유리 · 거울 · 아크릴 · 수반',  furniture:'유리 테이블 · 수반 · 어항',      plant:'수경재배 · 수련 · 이끼',        scent:'라벤더 · 캐모마일 · 자스민',    dir:'북(北)' },
];

function generate(slotId) {
  const ch03Path = path.join(QUEUE_DIR, `${slotId}_ch03.json`);
  const d  = fs.existsSync(ch03Path) ? JSON.parse(fs.readFileSync(ch03Path, 'utf-8')) : {};

  const ch08 = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_ch08.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_ch08.json`), 'utf-8')) : {};
  const ch06 = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_ch06.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_ch06.json`), 'utf-8')) : {};
  const mp = fs.existsSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`))
    ? JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${slotId}_master_preprocessed.json`), 'utf-8')) : {};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d, ch06, ch08); } catch(e){}

  const name  = d['이름'] || slotId;
  const ilju  = d['일주'] || '';

  const yongK  = ohKey(ch08['용신오행']||ch06['용신오행']||d['용신오행']||mp['용신오행']||'');
  const gisinK = ohKey(ch08['기신오행']||ch06['기신오행']||d['기신오행']||mp['기신오행']||'');

  const yongHan = yongK ? OH_KEYS_MAP[yongK] : '';
  const gisinHan = gisinK ? OH_KEYS_MAP[gisinK] : '';

  const HL_YONG  = { bg:'#dcfce7', bd:'#22c55e' };  // green
  const HL_GISIN = { bg:'#fee2e2', bd:'#ef4444' };   // red-light

  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>오행인테리어비교표 - ${esc(name)}</title>
<style>
${FONT_FACE_CSS}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Noto Sans KR',sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:30px 0;}
.page{ border:1px solid #333;width:604px;margin:0 auto;background:transparent;border-radius:8px;padding:12px 16px;}
.banner-hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px;margin-bottom:8px;}
.banner-hdr-title{font-size:10pt;font-weight:900;color:white;}
.banner-hdr-sub{font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px;}
.banner-hdr-name{font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.banner-hdr-detail{font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px;}
table{width:100%;border-collapse:collapse;margin-bottom:6px;}
th{background:#1a3a6a;color:white;font-family:'Noto Serif KR',serif;font-size:11px;font-weight:700;padding:5px 5px;border:1px solid #1a3a6a;text-align:center;}
td{font-size:10px;padding:5px 5px;border:1px solid #333;vertical-align:middle;line-height:1.4;}
tr:nth-child(even) td{background:#fafafa;}
tr:nth-child(odd) td{background:transparent;}
.oh-cell{font-family:'Noto Serif KR',serif;font-size:14px;font-weight:800;text-align:center;}
.role-tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:700;color:white;margin-top:2px;}
.legend{display:flex;gap:14px;justify-content:flex-end;font-size:8pt;color:#555;}
.legend-item{display:flex;align-items:center;gap:4px;}
.legend-dot{width:10px;height:10px;border-radius:2px;border:1px solid #333;}
@media print{body{background:transparent;padding:0;display:block;}.page{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{ border:1px solid #333;size:604px auto;margin:0;}}
</style></head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#4a148c,#7b1fa2);">
  <div>
    <div class="banner-hdr-title">五行 인테리어 비교표</div>
    <div class="banner-hdr-sub">오행별 색상 · 소재 · 가구 · 식물 · 향 · 방위</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · 용신 ${esc(yongHan)} · 기신 ${esc(gisinHan)}</div>
  </div>
</div>

<table>
<thead><tr>
  <th style="width:48px;">오행</th>
  <th>색상</th>
  <th>소재</th>
  <th>가구</th>
  <th>식물</th>
  <th>향</th>
  <th style="width:42px;">방위</th>
</tr></thead>
<tbody>
`;

  const OH_COLORS = {
    wood:'#1e6b2a', fire:'#b92e27', earth:'#9b6f00', metal:'#3d4f5c', water:'#1a4e7a'
  };

  for (const item of INTERIOR_DATA) {
    const isYong  = (item.key === yongK);
    const isGisin = (item.key === gisinK);

    let rowBg = '';
    let rowBd = '';
    let roleTag = '';
    if (isYong) {
      rowBg = HL_YONG.bg; rowBd = HL_YONG.bd;
      roleTag = `<br><span class="role-tag" style="background:#22c55e;">용신 - 적극 활용</span>`;
    } else if (isGisin) {
      rowBg = HL_GISIN.bg; rowBd = HL_GISIN.bd;
      roleTag = `<br><span class="role-tag" style="background:#ef4444;">기신 - 자제</span>`;
    }

    const rowStyle = rowBg ? ` style="background:${rowBg};border-left:3px solid ${rowBd};"` : '';
    const c = OH_COLORS[item.key] || '#333';

    H += `<tr${rowStyle}>
  <td class="oh-cell" style="color:${c};">${esc(item.oh)}${roleTag}</td>
  <td>${esc(item.color)}</td>
  <td>${esc(item.material)}</td>
  <td>${esc(item.furniture)}</td>
  <td>${esc(item.plant)}</td>
  <td>${esc(item.scent)}</td>
  <td style="text-align:center;font-weight:600;">${esc(item.dir)}</td>
</tr>\n`;
  }

  H += `</tbody></table>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:${HL_YONG.bg};border-color:${HL_YONG.bd};"></div>용신 오행 (${esc(yongHan)}) - 적극 활용 추천</div>
  <div class="legend-item"><div class="legend-dot" style="background:${HL_GISIN.bg};border-color:${HL_GISIN.bd};"></div>기신 오행 (${esc(gisinHan)}) - 과다 사용 자제</div>
</div>
</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '오행인테리어비교표.html');
  require('./_guards').safeWriteHtml(outFile, H, { 이름: name }, '오행인테리어비교표');
  console.log(`✅ ${outFile}  (${fs.statSync(outFile).size.toLocaleString()}B)`);
  return outFile;
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_오행인테리어비교표.js <slot_id>'); process.exit(1); }
generate(slotId);
