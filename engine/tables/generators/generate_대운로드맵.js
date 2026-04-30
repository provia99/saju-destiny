#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 성격 → 색상
function charColor(s) {
  if (!s) return '#888';
  if (s.includes('용신')) return '#2e7d32';
  if (s.includes('희신')) return '#1565c0';
  if (s.includes('기신')) return '#c62828';
  if (s.includes('중립')) return '#666';
  return '#888';
}
function charBg(s) {
  if (!s) return '#eee';
  if (s.includes('용신')) return '#e8f5e9';
  if (s.includes('희신')) return '#e3f2fd';
  if (s.includes('기신')) return '#ffebee';
  if (s.includes('중립')) return '#f5f5f5';
  return '#fafafa';
}
function charChip(label) {
  if (!label) return '';
  const c = charColor(label);
  const bg = charBg(label);
  return `<span style="font-size:7pt;font-weight:700;color:${c};background:${bg};border:1px solid ${c}44;padding:1px 3px;border-radius:3px;">${esc(label)}</span>`;
}
function charBorder(s) {
  if (!s) return '#ccc';
  if (s.includes('용신')) return '#43a047';
  if (s.includes('희신')) return '#1976d2';
  if (s.includes('기신')) return '#e53935';
  return '#bbb';
}

// 大運 목록 파싱
function parseUnseList(text) {
  if (!text) return [];
  return text.split('\n').filter(Boolean).map((line, idx) => {
    const p = line.split('|').map(s => s.trim());
    // p[0]: "1기 癸丑(계축)", p[1]: "8-17세", p[2]: "1976년~", p[3]: "양(12운성)"
    // p[4]: "희신대운", p[5]: "전반(1976~1980):희신 후반(1981~1985):중립"
    // p[6]: "천간:정재", p[7]: "지지:겁재", p[8+]: 합충 등
    const giNum = idx + 1;
    const gangi = p[0] || '';
    const age   = p[1] || '';
    const yr    = p[2] || '';
    const un12  = p[3] || '';
    const char  = p[4] || '';
    const halfTxt = p[5] || '';  // 전반/후반 성격
    const tgSS  = (p[6] || '').replace('천간:','');
    const jjSS  = (p[7] || '').replace('지지:','');
    const hachung = p.slice(8).join(', ');

    // 전반/후반 파싱: "전반(1976~1980):희신"
    const h1m = halfTxt.match(/전반\([^)]+\):(\S+)/);
    const h2m = halfTxt.match(/후반\([^)]+\):(\S+)/);
    const h1char = h1m ? h1m[1] : '';
    const h2char = h2m ? h2m[1] : '';

    return { giNum, gangi, age, yr, un12, char, h1char, h2char, tgSS, jjSS, hachung };
  });
}

// 건강 위험 파싱: "1기 癸丑(8-17세, ...): 설명"
function parseHealthList(raw) {
  if (!raw || raw === '없음') return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const m = line.match(/^(\d+기[^:]+):(.+)$/);
    if (!m) return { label: line.trim(), desc: '' };
    return { label: m[1].trim(), desc: m[2].trim() };
  });
}

function generate(slotId) {
  const ch08Path = path.join(QUEUE_DIR, `${slotId}_ch08.json`);
  if (!fs.existsSync(ch08Path)) {
    console.error(`  ⚠️  ${slotId}_ch08.json 없음 》 대운로드맵 건너뜀`);
    return '';
  }
  const d = JSON.parse(fs.readFileSync(ch08Path, 'utf-8'));

  // ── saju_calc 직접 계산 (정확한 값 보장) ──────────────────────
  let _calcResult = null;
  try {
    const { 전체사주계산 } = require('./saju_calc');
    let _masterPath = path.join(QUEUE_DIR, `${slotId}_master.json`);
    if (!fs.existsSync(_masterPath)) _masterPath = path.join(QUEUE_DIR, slotId, 'master.json');
    if (!fs.existsSync(_masterPath)) {
      const _sd = path.dirname(ch08Path);
      if (fs.existsSync(_sd)) {
        const _g = fs.readdirSync(_sd).filter(f => f === 'master.json');
        if (_g.length) _masterPath = path.join(_sd, _g[0]);
      }
    }
    if (fs.existsSync(_masterPath)) {
      const _M = JSON.parse(fs.readFileSync(_masterPath, 'utf8'));
      if (_M.생년) {
        _calcResult = 전체사주계산({이름:_M.이름, 성별:_M.성별, 년:_M.생년, 월:_M.생월, 일:_M.생일, 시간:_M.생시||'모름', 음력입력:!!_M.음력입력, 윤달:!!_M.윤달});
      }
    }
  } catch(e) { /* saju_calc 실패 시 기존 ch*.json 값 사용 */ }

  // saju_calc 결과로 용신오행 보정
  if (_calcResult) {
    const _oh = {木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'};
    if (_calcResult.용신) d['용신오행'] = _oh[_calcResult.용신] || _calcResult.용신;
  }

  const unseList = parseUnseList(d['대운목록_10기'] || '').filter(dw => {
    const age = parseInt((dw.ageRange||'').match(/(\d+)/)?.[1]||'0');
    return age < 98;
  });
  const curGi    = parseInt(d['현재대운기']) || 0;
  const name     = d['이름'] || slotId;

  // 현재 대운 정보
  const curGanji  = d['현재대운간지'] || '';
  const curChar   = d['현재대운성격'] || '';
  const curAge    = d['현재대운나이범위'] || '';
  const curStart  = d['현재대운시작년도'] || '';
  const curEnd    = d['현재대운종료년도'] || '';
  const curH1char = d['현재대운전반성격'] || '';
  const curH2char = d['현재대운후반성격'] || '';
  const curH1yr   = d['현재대운전반시작'] || '';
  const curH2yr   = d['현재대운후반시작'] || '';
  const curUnse   = d['현재대운십이운성'] || '';
  const curTgSS   = d['현재대운천간십성'] || '';
  const curJjSS   = d['현재대운지지십성'] || '';
  const curHaChung= d['현재대운원국합충'] || '';
  const curHealth = d['현재대운건강위험'] || '';

  // 다음 대운
  const nextExists = (d['다음대운있음'] || 'N') === 'Y';
  const nextGanji  = d['다음대운간지'] || '';
  const nextChar   = d['다음대운성격'] || '';
  const nextAge    = d['다음대운나이범위'] || '';
  const nextStart  = d['다음대운시작년도'] || '';

  // 현재 대운 내 세운 목록
  const yongSeun   = d['현대운내_용신세운목록'] || '없음';
  const huiSeun    = d['현대운내_희신세운목록'] || '없음';
  const byeongSeun = d['현대운내_기신세운목록'] || '없음';
  const bestSeun   = d['현대운내_최적세운'] || '';
  const worstSeun  = d['현대운_최흉해'] || '';
  const saveSeun   = d['현대운_구원의해'] || '';

  // 대운 교체기
  const gyocheSangse = d['대운교체기_상세'] || d['대운교체기목록'] || '';
  const gyocheYr     = d['대운교체년도'] || '';

  // 건강 위험 대운
  const healthDW = parseHealthList(d['건강위험대운목록'] || '');

  // 핵심 색상 (용신오행 → 색)
  const yongOh = d['용신오행'] || '';
  const curColor = charColor(curChar);

  // ── CSS ──────────────────────────────────────────
  const CSS = `<style>
${FONT_FACE_CSS}
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Noto Sans KR',sans-serif; color:#222; }
.page { border:1px solid #333; width:604px; overflow:visible; padding:4px 6px; background:transparent; }
@media screen { body { background:#f5f5f5; } .page { border:1px solid #333; margin:20px auto;  border-radius:4px; } }
@media print {
  body { background:transparent; margin:0; padding:0; }
  .page { border:1px solid #333; margin:0;  width:604px; overflow:visible; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 840px; margin:0; }
}
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:1.5px solid #333; border-radius:8px; overflow:hidden; margin-top:3px; }
.card-hd { padding:3px 8px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:7.5pt; font-weight:900; color:white; }
.card-hd-sub   { font-size:7pt; color:rgba(255,255,255,.85); }
/* 대운 10기 표 */
.dw-table { width:100%; border-collapse:collapse; background:transparent; }
.dw-table th { font-size:7pt; font-weight:700; color:white; background:#475569; padding:2px 4px; text-align:center; border-right:1px solid #566778; }
.dw-table th:last-child { border-right:none; }
.dw-row td { font-size:7pt; color:#333; padding:2px 3px; border-bottom:1px solid #f0f0f0; border-right:1px solid #f0f0f0; vertical-align:middle; }
.dw-row td:last-child { border-right:none; }
.dw-row.cur-row td { background:#fff9f0 !important; }
.dw-row.past-row td { color:#bbb; }
.dw-ganji { font-weight:800; font-size:6.5pt; }
.dw-age   { font-size:7pt; color:#888; }
.dw-yr    { font-size:7pt; color:#aaa; }
.un12-chip { font-size:7pt; padding:1px 3px; border-radius:3px; background:#eee; color:#555; font-weight:700; }
.ss-chip  { font-size:7pt; padding:1px 3px; border-radius:3px; background:#e3f2fd; color:#1565c0; font-weight:700; display:inline-block; }
.hachung  { font-size:6.5pt; color:#e65100; line-height:1.4; }
/* 현재 대운 카드 */
.cur-section { padding:4px 8px; background:transparent; }
.sec-title { font-size:7pt; font-weight:700; color:#555; margin-bottom:3px; display:flex; align-items:center; gap:4px; }
.sec-title::before { content:''; display:inline-block; width:2px; height:9px; border-radius:2px; background:currentColor; }
.cur-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
.cur-box { border:1.5px solid #e0e0e0; border-radius:5px; padding:4px 6px; }
.cur-lbl { font-size:7pt; color:#aaa; font-weight:700; margin-bottom:2px; }
.cur-val { font-size:6.5pt; color:#333; font-weight:700; }
.half-row { display:flex; gap:4px; margin-top:3px; }
.half-item { flex:1; border-radius:3px; padding:2px 4px; text-align:center; }
.half-lbl { font-size:6.5pt; color:#888; }
.half-char { font-size:7pt; font-weight:700; }
.seun-row { display:flex; gap:3px; flex-wrap:wrap; margin-top:2px; }
.seun-chip { font-size:7pt; padding:1px 4px; border-radius:3px; color:white; font-weight:700; display:inline-block; }
/* 건강·교체기 */
.info-section { padding:4px 8px; background:transparent; }
.health-item { font-size:7pt; color:#333; padding:2px 0; border-bottom:1px solid #f5f5f5; display:flex; gap:4px; align-items:flex-start; }
.health-item:last-child { border-bottom:none; }
.health-lbl { font-size:7pt; font-weight:700; color:#c62828; min-width:64px; flex-shrink:0; }
.health-desc { font-size:7pt; color:#555; line-height:1.4; }
.gyoche-item { font-size:7pt; padding:2px 0; border-bottom:1px solid #f5f5f5; }
.gyoche-item:last-child { border-bottom:none; }
</style>`;

  // ── 10기 대운 표 생성 ─────────────────────────────
  const tableRows = unseList.map(u => {
    const isPast = u.giNum < curGi;
    const isCur  = u.giNum === curGi;
    const c = charColor(u.char);
    const rowCls = isPast ? 'dw-row past-row' : isCur ? 'dw-row cur-row' : 'dw-row';
    const opac   = isPast ? 'opacity:.5;' : '';
    const marker = isCur ? '▶ ' : '';
    const ganji  = u.gangi.replace(/^\d+기\s*/, '');

    // 전후반 칩
    const h1 = u.h1char ? `<span style="font-size:6.5pt;font-weight:700;color:${charColor(u.h1char)};background:${charBg(u.h1char)};padding:1px 3px;border-radius:3px;">${esc(u.h1char)}</span>` : '';
    const h2 = u.h2char ? `<span style="font-size:6.5pt;font-weight:700;color:${charColor(u.h2char)};background:${charBg(u.h2char)};padding:1px 3px;border-radius:3px;">${esc(u.h2char)}</span>` : '';

    const ha = u.hachung ? `<div class="hachung">${esc(u.hachung)}</div>` : '';

    return `<tr class="${rowCls}" style="${opac}">
      <td style="text-align:center;width:18px;font-size:7pt;font-weight:700;color:${isPast?'#bbb':'#555'};">${u.giNum}기</td>
      <td style="border-left:3px solid ${isPast?'#ddd':c};">
        <div class="dw-ganji" style="color:${isPast?'#bbb':c};">${marker}${esc(ganji)}</div>
        <div class="dw-age">${esc(u.age)}</div>
        <div class="dw-yr">${esc(u.yr)}</div>
      </td>
      <td style="text-align:center;"><span class="un12-chip">${esc(u.un12)}</span></td>
      <td style="text-align:center;">${charChip(u.char)}</td>
      <td style="text-align:center;">${h1}<br>${h2}</td>
      <td style="text-align:center;">
        <div><span class="ss-chip" style="background:#7b1fa2;color:white;">${esc(u.tgSS)}</span></div>
        <div style="margin-top:2px;"><span class="ss-chip" style="background:#e65100;color:white;">${esc(u.jjSS)}</span></div>
      </td>
      <td>${ha}</td>
    </tr>`;
  }).join('');

  // ── 현재 대운 세운 요약 ─────────────────────────────
  const yongSeunChips = (yongSeun !== '없음' && yongSeun)
    ? yongSeun.split(',').map(s=>`<span class="seun-chip" style="background:#2e7d32;">${esc(s.trim())}</span>`).join('')
    : '<span style="font-size:7pt;color:#aaa;">없음</span>';
  const huiSeunChips = (huiSeun !== '없음' && huiSeun)
    ? huiSeun.split(',').map(s=>`<span class="seun-chip" style="background:#1565c0;">${esc(s.trim())}</span>`).join('')
    : '<span style="font-size:7pt;color:#aaa;">없음</span>';
  const byeongSeunChips = (byeongSeun !== '없음' && byeongSeun)
    ? byeongSeun.split(',').map(s=>`<span class="seun-chip" style="background:#c62828;">${esc(s.trim())}</span>`).join('')
    : '<span style="font-size:7pt;color:#aaa;">없음</span>';

  // ── 대운 교체기 상세 ───────────────────────────────
  const gyocheRows = gyocheSangse
    ? gyocheSangse.split('\n').filter(Boolean).map(line => {
        const isCurLine = line.includes('← 대운 교체년');
        const isNext    = line.includes('← 교체 직전') || isCurLine;
        const c = isCurLine ? '#c62828' : isNext ? '#e65100' : '#555';
        return `<div class="gyoche-item" style="color:${c};">${esc(line)}</div>`;
      }).join('')
    : '<div style="font-size:7pt;color:#aaa;">정보 없음</div>';

  // ── 건강 위험 ─────────────────────────────────────
  const healthRows = healthDW.length
    ? healthDW.map(h => `<div class="health-item">
        <span class="health-lbl">${esc(h.label.split('(')[0])})</span>
        <span class="health-desc">${esc(h.desc)}</span>
      </div>`).join('')
    : '<div style="font-size:7pt;color:#aaa;">특이사항 없음</div>';

  // ── HTML 조립 ──────────────────────────────────────
  let H = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>대운 로드맵 》 ${esc(name)}님</title>
${CSS}
</head><body><div class="page">`;

  // compact-hdr
  H += `<div class="banner-hdr" style="background:linear-gradient(135deg,#1b5e20,#2e7d32);">
  <div>
    <div class="banner-hdr-title">🗺️ 대운 로드맵 》 평생의 길</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">현재 ${esc(curGanji)} · ${esc(curChar)}</div>
  </div>
</div>`;

  // ── Card ①: 10기 대운 전체표 ──────────────────────
  H += `<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#475569,#64748b);">
    <div class="card-hd-title">① 10기 대운 전체 흐름</div>
    <div class="card-hd-sub">기수 · 간지 · 12운성 · 운세성격 · 전후반 · 십성 · 합충</div>
  </div>
  <table class="dw-table">
    <thead><tr>
      <th>기</th><th>간지 / 나이 / 년도</th><th>12운성</th><th>성격</th><th>전반 / 후반</th><th>천간 / 지지 십성</th><th>원국 합충</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`;

  // ── Card ②: 현재 대운 집중 분석 ───────────────────
  H += `<div class="card">
  <div class="card-hd" style="background:${`linear-gradient(135deg,${charColor(curChar)},${charBorder(curChar)})`};">
    <div class="card-hd-title">② 현재 대운 집중 분석</div>
    <div class="card-hd-sub">${esc(curGanji)} ${esc(curAge)} (${esc(curStart)}~${esc(curEnd)}) · ${esc(curChar)}</div>
  </div>
  <div class="cur-section">
    <div class="cur-grid">
      <div class="cur-box">
        <div class="cur-lbl">기본 정보</div>
        <div class="cur-val" style="color:${curColor};">${esc(curGanji)}</div>
        <div style="font-size:7pt;color:#555;margin-top:2px;">12운성: <strong>${esc(curUnse)}</strong> · 천간: <strong>${esc(curTgSS)}</strong> · 지지: <strong>${esc(curJjSS)}</strong></div>
        ${curHaChung ? `<div style="font-size:7pt;color:#e65100;margin-top:2px;">합충: ${esc(curHaChung)}</div>` : ''}
        <div class="half-row">
          <div class="half-item" style="background:${charBg(curH1char)};border:1px solid ${charColor(curH1char)}33;">
            <div class="half-lbl">전반 (${esc(curH1yr)}~)</div>
            <div class="half-char" style="color:${charColor(curH1char)};">${esc(curH1char)}</div>
          </div>
          <div class="half-item" style="background:${charBg(curH2char)};border:1px solid ${charColor(curH2char)}33;">
            <div class="half-lbl">후반 (${esc(curH2yr)}~)</div>
            <div class="half-char" style="color:${charColor(curH2char)};">${esc(curH2char)}</div>
          </div>
        </div>
      </div>
      <div class="cur-box">
        <div class="cur-lbl">현재 대운 내 세운 분류</div>
        <div style="margin-bottom:3px;">
          <div style="font-size:7pt;font-weight:700;color:#2e7d32;margin-bottom:1px;">用神 세운</div>
          <div class="seun-row">${yongSeunChips}</div>
        </div>
        <div style="margin-bottom:3px;">
          <div style="font-size:7pt;font-weight:700;color:#1565c0;margin-bottom:1px;">喜神 세운</div>
          <div class="seun-row">${huiSeunChips}</div>
        </div>
        <div>
          <div style="font-size:7pt;font-weight:700;color:#c62828;margin-bottom:1px;">忌神 세운</div>
          <div class="seun-row">${byeongSeunChips}</div>
        </div>
      </div>
    </div>
    ${(bestSeun || saveSeun || worstSeun) ? `<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">
      ${bestSeun ? `<div style="flex:1;min-width:96px;padding:2px 5px;border-radius:4px;background:#e8f5e9;border:1px solid #a5d6a7;">
        <div style="font-size:7pt;color:#2e7d32;font-weight:700;margin-bottom:1px;">✨ 최적의 해</div>
        <div style="font-size:7pt;font-weight:700;color:#1b5e20;">${esc(bestSeun)}</div>
      </div>` : ''}
      ${saveSeun && saveSeun !== '없음' ? `<div style="flex:1;min-width:96px;padding:2px 5px;border-radius:4px;background:#e3f2fd;border:1px solid #90caf9;">
        <div style="font-size:7pt;color:#1565c0;font-weight:700;margin-bottom:1px;">🌊 구원의 해</div>
        <div style="font-size:7pt;font-weight:700;color:#0d47a1;">${esc(saveSeun)}</div>
      </div>` : ''}
      ${worstSeun && worstSeun !== '없음' ? `<div style="flex:1;min-width:96px;padding:2px 5px;border-radius:4px;background:#ffebee;border:1px solid #ef9a9a;">
        <div style="font-size:7pt;color:#c62828;font-weight:700;margin-bottom:1px;">⚠️ 주의의 해</div>
        <div style="font-size:7pt;font-weight:700;color:#b71c1c;">${esc(worstSeun)}</div>
      </div>` : ''}
    </div>` : ''}
    ${curHealth ? `<div style="margin-top:3px;padding:2px 5px;background:#fff3e0;border-radius:3px;border-left:2px solid #ff6f00;">
      <div style="font-size:7pt;font-weight:700;color:#e65100;margin-bottom:1px;">🩺 현재 대운 건강 주의</div>
      <div style="font-size:7pt;color:#555;">${esc(curHealth)}</div>
    </div>` : ''}
  </div>
</div>`;

  // ── Card ③ 제거 (사용자 요청: 대운교체기 건강주의 부분 삭제) ──
  // 건강주의대운표가 별도로 있어 중복되며, 대운로드맵 높이 단축 위해 제거

  H += `</div></body></html>`;

  // ── 단일 파일 저장 ──────────────────────────────────────
  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, '대운로드맵.html');
  fs.writeFileSync(outFile, H, 'utf-8');
  console.log(`✅ 대운로드맵 생성: ${outFile}  (${Buffer.byteLength(H,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_대운로드맵.js <slot_id>'); process.exit(1); }
generate(slotId);
