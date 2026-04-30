#!/usr/bin/env node
// generate_건강표.js
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch10.json
// 출력: tables/{slot}/건강표.html
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

function generate(slotId) {
  const d3  = loadJSON(`${slotId}_ch03.json`);
  const d10 = loadJSON(`${slotId}_ch10.json`);
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d10); } catch(e){}

  // 인적사항
  const name    = d3['이름']        || slotId;
  const birthS  = d3['birth_solar'] || d3['생년월일'] || '';
  const gender  = d3['user_gender'] || d3['성별']    || '';
  const age     = d3['user_age']    || d3['나이']    || '';
  const ilju    = d3['일주']        || '';
  const sinGang = d3['신강약']       || d10['신강약'] || '';
  const gyeokNm = d3['격국명']       || '';

  // ── 건강 데이터 (ch10) ──────────────────────────────
  const cheJil         = d10['체질유형']        || '';
  const ilganJanggi    = d10['일간장기목록']     || '';
  const ilganShinche   = d10['일간신체목록']     || '';
  const ilganGamsong   = d10['일간감정']         || '';
  const chwiYakJanggi  = d10['취약장기목록']     || '';
  const chwiYakShinche = d10['취약신체목록']     || '';
  const chwiYakGamsong = d10['취약감정']         || '';
  const chwiYakGye     = d10['취약계절']         || '';
  const yangsaeng      = d10['양생식품목록']     || '';
  const juyuiFood      = d10['주의식품목록']     || '';
  const unDong         = d10['운동유형']         || '';
  const naidaeHealth   = d10['나이대건강주의']   || '';
  const pyeongSaeng    = d10['평생건강주의계통'] || '';
  const healthDWList   = d10['건강위험대운목록'] || '';
  const curDWHealth    = d10['현재대운건강위험'] || '';
  const curDWInfluence = d10['현재대운건강영향'] || '';

  // 대운별 건강 위험 파싱
  const healthRows = (healthDWList||'').split('\n').filter(Boolean).map(l => {
    const m = l.match(/^(.+?):\s*(.+)$/);
    return m ? { label: m[1].trim(), desc: m[2].trim() } : { label: l.trim(), desc: '' };
  });

  const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>건강(健康) 분석표 》 ${esc(name)}님</title>
  <style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; padding:14px 20px; background:transparent; display:flex; flex-direction:column; gap:6px; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print { body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 820px; margin:0; } }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:2px solid #ccc;border-radius:10px;overflow:hidden; }
.card-hd { padding:6px 14px;display:flex;align-items:center;justify-content:space-between; }
.card-hd-title { font-size:9pt;font-weight:900;color:white; }
.card-hd-sub { font-size:6.5pt;color:rgba(255,255,255,.85); }
.card-body { padding:9px 14px;background:transparent; }
.attr-grid { display:grid;grid-template-columns:1fr 1fr;gap:5px; }
.attr-grid-3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px; }
.attr-item { border-radius:6px;padding:6px 9px;border:1.5px solid #e0e0e0;background:#fafafa; }
.attr-lbl  { font-size:6pt;font-weight:700;color:#888;margin-bottom:2px; }
.attr-val  { font-size:7pt;font-weight:700;color:#333;line-height:1.5; }
.risk-tbl { width:100%;border-collapse:collapse;font-size:6.5pt; }
.risk-tbl th { background:#c62828;color:white;padding:4px 8px;font-size:6.5pt;font-weight:700; }
.risk-tbl td { border-bottom:1px solid #f0f0f0;padding:4px 8px;vertical-align:top;line-height:1.5; }
.risk-tbl tr:last-child td { border-bottom:none; }
  </style>
</head>
<body>
  <div class="page">

    <div class="banner-hdr" style="background:linear-gradient(135deg,#00695c,#00897b);">
  <div>
    <div class="banner-hdr-title">🏥 건강(健康) 분석표</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)}${sinGang?' · '+esc(sinGang):''}</div>
  </div>
</div>

    <!-- ① 건강 체질 분석 -->
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,#1a237e,#283593);">
        <div class="card-hd-title">① 건강 체질 분석</div>
        <div class="card-hd-sub">${esc(cheJil)||'일간 기준 체질'} · 선천적 강약 부위</div>
      </div>
      <div class="card-body">
        <div class="attr-grid" style="margin-bottom:5px;">
          <div class="attr-item" style="border-color:#1565c044;">
            <div class="attr-lbl">체질 유형</div>
            <div class="attr-val" style="font-size:9pt;color:#1565c0;">${esc(cheJil)||'—'}</div>
          </div>
          <div class="attr-item" style="border-color:#f4433644;">
            <div class="attr-lbl">⚠️ 취약 계절</div>
            <div class="attr-val">${esc(chwiYakGye)||'—'}</div>
          </div>
        </div>
        <div class="attr-grid-3" style="margin-bottom:5px;">
          <div class="attr-item" style="border-color:#1565c022;">
            <div class="attr-lbl">일간 관련 장기</div>
            <div class="attr-val">${esc(ilganJanggi)||'—'}</div>
          </div>
          <div class="attr-item" style="border-color:#1565c022;">
            <div class="attr-lbl">일간 관련 신체</div>
            <div class="attr-val">${esc(ilganShinche)||'—'}</div>
          </div>
          <div class="attr-item" style="border-color:#1565c022;">
            <div class="attr-lbl">일간 감정</div>
            <div class="attr-val">${esc(ilganGamsong)||'—'}</div>
          </div>
          <div class="attr-item" style="border-color:#f4433622;">
            <div class="attr-lbl">취약 장기</div>
            <div class="attr-val" style="color:#c62828;">${esc(chwiYakJanggi)||'—'}</div>
          </div>
          <div class="attr-item" style="border-color:#f4433622;">
            <div class="attr-lbl">취약 신체</div>
            <div class="attr-val" style="color:#c62828;">${esc(chwiYakShinche)||'—'}</div>
          </div>
          <div class="attr-item" style="border-color:#f4433622;">
            <div class="attr-lbl">취약 감정</div>
            <div class="attr-val" style="color:#c62828;">${esc(chwiYakGamsong)||'—'}</div>
          </div>
        </div>
        <div class="attr-grid" style="margin-bottom:5px;">
          <div class="attr-item" style="border-color:#4caf5044;">
            <div class="attr-lbl">✅ 양생 식품</div>
            <div class="attr-val">${esc(yangsaeng)||'—'}</div>
          </div>
          <div class="attr-item" style="border-color:#ff980044;">
            <div class="attr-lbl">⚠️ 주의 식품</div>
            <div class="attr-val">${esc(juyuiFood)||'—'}</div>
          </div>
        </div>
        <div class="attr-item" style="margin-bottom:${naidaeHealth?'5px':'0'};">
          <div class="attr-lbl">🏃 운동 유형</div>
          <div class="attr-val">${esc(unDong)||'—'}</div>
        </div>
        ${naidaeHealth?`<div style="padding:6px 10px;background:#fff3e0;border-radius:6px;border-left:3px solid #ff9800;font-size:7pt;color:#555;line-height:1.6;">
          <strong style="color:#e65100;">나이대 주의사항:</strong> ${esc(naidaeHealth)}
        </div>`:''}
      </div>
    </div>

    <!-- ② 건강 위험 대운 -->
    ${(healthRows.length||curDWHealth||pyeongSaeng) ? `
    <div class="card">
      <div class="card-hd" style="background:linear-gradient(135deg,#b71c1c,#c62828);">
        <div class="card-hd-title">② 건강 위험 대운 목록</div>
        <div class="card-hd-sub">평생 건강 주의 계통 및 대운별 취약 부위</div>
      </div>
      <div class="card-body">
        ${pyeongSaeng?`<div style="padding:6px 10px;background:#ffebee;border-radius:6px;border-left:3px solid #c62828;font-size:7pt;color:#555;margin-bottom:7px;">
          <strong style="color:#c62828;">평생 건강 주의:</strong> ${esc(pyeongSaeng)}
        </div>`:''}
        ${curDWHealth?`<div style="padding:6px 10px;background:#fff3e0;border-radius:6px;border-left:3px solid #ff9800;font-size:7pt;color:#555;margin-bottom:7px;">
          <strong style="color:#e65100;">현재 대운 건강 영향 [${esc(curDWInfluence)}]:</strong> ${esc(curDWHealth)}
        </div>`:''}
        ${healthRows.length ? `
        <table class="risk-tbl">
          <thead><tr><th>대운</th><th>건강 위험 부위</th></tr></thead>
          <tbody>
            ${healthRows.map(r=>`<tr><td style="font-weight:700;color:#c62828;white-space:nowrap;">${esc(r.label)}</td><td>${esc(r.desc)}</td></tr>`).join('')}
          </tbody>
        </table>` : ''}
      </div>
    </div>` : ''}

  </div>
</body>
</html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '건강표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '건강표');
  console.log(`✅ 건강표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_건강표.js <slot_id>'); process.exit(1); }
generate(slotId);
