#!/usr/bin/env node
/**
 * generate_궁합표.js — 궁합 HTML 표 생성기 (시각 강화판 Full)
 *
 * 16종 표: 10종 기본 + 6종 관계단계 전용
 *   기본: 종합점수표·사주비교표·오행비교표·용신교차표·십성관계표·친밀도표
 *         합충교차표·인연깊이표·갈등사용설명서·재물시기표
 *   전용: 분리판단표·재결합가능성표·블렌디드패밀리표·첫만남가이드표·주년리듬표·잠자리궁합표
 *
 * 시각 요소: SVG 방사형차트·도넛차트·게이지바·히트맵·타임라인·네트워크 다이어그램
 * 각 표는 604×840px 이내
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('../../font_config');
const { 궁합분석 } = require('./compatibility_calc');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const oh = {木:'목',火:'화',土:'토',金:'금',水:'수'};
const ohC = {木:'#4caf50',火:'#f44336',土:'#ff9800',金:'#9e9e9e',水:'#2196f3'};
const ohGrad = {
  木:'linear-gradient(135deg,#81c784,#4caf50)',
  火:'linear-gradient(135deg,#ff7b7b,#e53935)',
  土:'linear-gradient(135deg,#ffd180,#ff9800)',
  金:'linear-gradient(135deg,#cfd8dc,#607d8b)',
  水:'linear-gradient(135deg,#64b5f6,#1976d2)',
};
const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const 지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};

// 참조 디자인 스타일 (604×840px / 남색 헤더 / 카드 레이아웃) — 글씨 크기 업
const CSS_BASE = `${FONT_FACE_CSS}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;color:#222;}
.page{width:604px;max-height:840px;overflow:hidden;padding:8px 14px;background:#fff;}
.hdr{background:linear-gradient(135deg,#7986cb,#9fa8da);color:#fff;padding:7px 12px;border-radius:8px;margin-bottom:7px;border-left:4px solid #5c6bc0;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.hdr-left{flex:1;min-width:0;}
.hdr-right{flex-shrink:0;text-align:right;padding-left:8px;border-left:1px solid rgba(255,255,255,0.35);}
.hdr-t{font-size:15pt;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.15);line-height:1.15;}
.hdr-meta{font-size:9pt;margin-top:3px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;}
.hdr-meta .chip-h{padding:1px 8px;background:rgba(255,255,255,0.22);color:#fff;border-radius:9px;font-size:8.5pt;font-weight:600;letter-spacing:0.2px;}
.hdr-names{font-size:10pt;font-weight:700;color:#fff;line-height:1.35;white-space:nowrap;}
.hdr-names .heart-h{color:#ffccd5;margin:0 2px;font-size:10.5pt;}
.hdr-names .ilgan{font-size:8.5pt;font-weight:500;opacity:0.9;}
.hdr-s{font-size:10pt;opacity:0.95;margin-top:2px;color:#f3f4ff;}
.card{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:8px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06);}
.card-t{font-size:11.5pt;font-weight:700;color:#3949ab;margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid #e8eaf6;display:flex;align-items:center;gap:5px;}
.card-t .ico{font-size:12pt;}
.row{display:flex;gap:8px;}
.col{flex:1;min-width:0;}
.item{font-size:10pt;color:#333;padding:3px 0;line-height:1.5;}
.gauge{height:20px;background:#f5f5f5;border-radius:10px;overflow:hidden;margin:5px 0;position:relative;}
.gauge-fill{height:100%;border-radius:10px;}
.gauge-label{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10pt;color:#fff;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.3);}
.score-big{font-size:34pt;font-weight:900;text-align:center;margin:8px 0;}
.label{font-size:10pt;color:#777;}
.saju-box{display:flex;justify-content:space-around;padding:6px 0;}
.saju-cell{text-align:center;min-width:55px;}
.saju-hz{font-size:18pt;font-weight:900;}
.saju-kr{font-size:9.5pt;color:#777;}
.donut-wrap{display:flex;align-items:center;gap:10px;}
.tag{display:inline-block;font-size:8.5pt;padding:3px 9px;border-radius:10px;background:#e8eaf6;color:#3949ab;margin:2px 2px;font-weight:700;}
.tag.pos{background:#c8e6c9;color:#2e7d32;}
.tag.neg{background:#ffcdd2;color:#c62828;}
.tag.neu{background:#e0e0e0;color:#616161;}
.timeline{position:relative;padding:8px 0 8px 12px;}
.timeline::before{content:'';position:absolute;left:4px;top:10px;bottom:10px;width:2px;background:#e0e0e0;}
.tl-item{position:relative;margin-bottom:8px;padding-left:12px;}
.tl-item::before{content:'';position:absolute;left:-9px;top:6px;width:8px;height:8px;border-radius:50%;background:#3949ab;border:2px solid #fff;box-shadow:0 0 0 1px #3949ab;}
.grid{display:grid;gap:6px;}
.grid-2{grid-template-columns:1fr 1fr;}
.grid-3{grid-template-columns:1fr 1fr 1fr;}
.grid-5{grid-template-columns:repeat(5,1fr);}
.chip{padding:6px 6px;border-radius:6px;text-align:center;font-size:9pt;font-weight:700;background:#f5f5f5;}
.heat{padding:6px;border-radius:4px;text-align:center;font-size:8.5pt;color:#fff;font-weight:700;}
`;

// 모듈 스코프 공통 메타 (generate() 시작 시 세팅)
let _HEADER_META_DEFAULT = '';
function wrap(title, sub, body, opts = {}) {
  const meta = opts.meta !== undefined ? opts.meta : _HEADER_META_DEFAULT;
  // sub은 이미 esc된 이름 문자열 혹은 HTML 문자열이 전달됨 (generate에서 조립)
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>${CSS_BASE}${opts.css || ''}</style><title>${esc(title)}</title></head><body>
<div class="page">
<div class="hdr">
  <div class="hdr-left">
    <div class="hdr-t">${esc(title)}</div>
    ${meta ? `<div class="hdr-meta">${meta}</div>` : ''}
  </div>
  <div class="hdr-right">
    <div class="hdr-names">${sub}</div>
  </div>
</div>
${body}
</div></body></html>`;
}

// 점수 → 등급 색상 / 등급 이름
function scoreColor(s) {
  if (s >= 85) return '#2e7d32';
  if (s >= 70) return '#1565c0';
  if (s >= 55) return '#1976d2';
  if (s >= 40) return '#ef6c00';
  return '#c62828';
}
function scoreGrade(s) {
  if (s >= 85) return '최고의 인연';
  if (s >= 70) return '좋은 인연';
  if (s >= 55) return '무난한 인연';
  if (s >= 40) return '노력이 필요한 인연';
  return '힘든 인연';
}

function 주(t,j){ return `<div class="saju-cell"><div class="saju-hz" style="color:${ohC[요행(t)]||'#333'}">${t}${j}</div><div class="saju-kr">${천간음[t]||''}${지지음[j]||''}</div></div>`; }
function 요행(t) { const m = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'}; return m[t]; }
function gaugeHTML(score, color) {
  const c = color || (score>=80?'#2e7d32':score>=65?'#1565c0':score>=50?'#f9a825':score>=35?'#ef6c00':'#c62828');
  const v = Math.max(3, Math.min(100, score));
  return `<div class="gauge"><div class="gauge-fill" style="width:${v}%;background:linear-gradient(90deg,${c}dd,${c});"></div><div class="gauge-label">${score}</div></div>`;
}

// ════════════════════════════════════════════════════
// 방사형 차트 (레이더) — 10개 항목
// ════════════════════════════════════════════════════
function radarChart(labels, values, opts = {}) {
  const n = labels.length, cx = opts.cx || 180, cy = opts.cy || 180, maxR = opts.maxR || 130;
  function p(i, v) { const a = (Math.PI * 2 * i / n) - Math.PI / 2, rd = (v / 100) * maxR; return { x: cx + rd * Math.cos(a), y: cy + rd * Math.sin(a) }; }
  let svg = '';
  for (const r of [20,40,60,80,100]) {
    svg += `<polygon points="${Array.from({length:n},(_,i)=>{const q=p(i,r);return `${q.x},${q.y}`;}).join(' ')}" fill="none" stroke="${r===100?'#90a4ae':'#e0e0e0'}" stroke-width="${r===100?1:0.5}"/>`;
  }
  for (let i = 0; i < n; i++) {
    const q = p(i, 100);
    svg += `<line x1="${cx}" y1="${cy}" x2="${q.x}" y2="${q.y}" stroke="#e0e0e0" stroke-width="0.5"/>`;
  }
  const points = values.map((v,i) => p(i,v));
  svg += `<polygon points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="rgba(63,81,181,0.25)" stroke="#3949ab" stroke-width="2"/>`;
  for (const pt of points) svg += `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#fff" stroke="#3949ab" stroke-width="2"/>`;
  for (let i = 0; i < n; i++) {
    const q = p(i, 115);
    svg += `<text x="${q.x}" y="${q.y}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="700" fill="#424242">${esc(labels[i])}</text>`;
    const sq = p(i, 100);
    svg += `<text x="${sq.x*0.85+cx*0.15}" y="${sq.y*0.85+cy*0.15}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#757575">${values[i]}</text>`;
  }
  return `<svg viewBox="0 0 ${cx*2} ${cy*2}" width="100%" style="max-width:360px;">${svg}</svg>`;
}

// ════════════════════════════════════════════════════
// 도넛 차트 — 단일 점수 표시
// ════════════════════════════════════════════════════
function donutChart(value, label, color, opts = {}) {
  const size = opts.size || 110;
  const r = size/2 - 10, cx = size/2, cy = size/2;
  const c = 2 * Math.PI * r;
  const off = c - (value/100)*c;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eceff1" stroke-width="8"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="18" font-weight="900" fill="#212121">${value}</text>
    <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="#757575">${esc(label||'')}</text>
  </svg>`;
}

// ════════════════════════════════════════════════════
// 바 차트 — 수평 바
// ════════════════════════════════════════════════════
function barChart(items, opts = {}) {
  const maxV = opts.max || 100;
  return items.map(x => {
    const pct = Math.min(100, (x.value/maxV)*100);
    return `<div style="margin-bottom:5px;">
      <div style="display:flex;justify-content:space-between;font-size:8pt;margin-bottom:2px;">
        <span>${esc(x.label)}</span><span style="color:${x.color||'#3949ab'};font-weight:700;">${x.value}${opts.unit||''}</span>
      </div>
      <div class="gauge" style="height:12px;"><div class="gauge-fill" style="width:${pct}%;background:${x.color||'#3949ab'};"></div></div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════
// 오행 5각형 시각화
// ════════════════════════════════════════════════════
function wuxingPentagon(scores, size = 160) {
  const keys = ['木','火','土','金','水'];
  const cx = size/2, cy = size/2, maxR = size/2 - 22;
  function p(i, v) { const a = (Math.PI*2*i/5) - Math.PI/2, r = (v/6)*maxR; return {x:cx+r*Math.cos(a), y:cy+r*Math.sin(a)};}
  let svg = '';
  for (const r of [1,2,3,4,5]) {
    const pts = Array.from({length:5},(_,i)=>{const q=p(i,r);return `${q.x},${q.y}`;}).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>`;
  }
  const vals = keys.map(k => scores[k] || 0);
  const points = vals.map((v,i) => p(i,Math.min(6,v)));
  svg += `<polygon points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="rgba(63,81,181,0.2)" stroke="#3949ab" stroke-width="1.5"/>`;
  for (let i = 0; i < 5; i++) {
    const pt = points[i];
    svg += `<circle cx="${pt.x}" cy="${pt.y}" r="3" fill="${ohC[keys[i]]}" stroke="#fff" stroke-width="1.5"/>`;
    const lp = p(i, 7);
    svg += `<text x="${lp.x}" y="${lp.y+3}" text-anchor="middle" font-size="10" font-weight="900" fill="${ohC[keys[i]]}">${keys[i]}</text>`;
    svg += `<text x="${lp.x}" y="${lp.y+14}" text-anchor="middle" font-size="9" fill="#888">${(vals[i]||0).toFixed(1)}</text>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${svg}</svg>`;
}

// ════════════════════════════════════════════════════
// 메인 — generate
// ════════════════════════════════════════════════════
function generate(inputA, inputB, outDir, 관계정보 = {}) {
  const r = 궁합분석(inputA, inputB, 관계정보);
  const A = r.A, B = r.B;
  // 오른쪽 이름 블록 (HTML)
  const sub = `${esc(A.이름)}<span class="ilgan">(${A.일간})</span> <span class="heart-h">♡</span> ${esc(B.이름)}<span class="ilgan">(${B.일간})</span>`;
  // 공통 헤더 메타 (왼쪽 하단 칩)
  const _종합 = r.점수['종합'] || 0;
  const _등급 = r.등급 || scoreGrade(_종합);
  const _관계 = 관계정보.관계단계 || r.관계단계 || '';
  const metaCommon =
    `<span class="chip-h">종합 ${_종합}점 · ${_등급}</span>` +
    (_관계 ? `<span class="chip-h">${esc(_관계)} 관계</span>` : '');
  _HEADER_META_DEFAULT = metaCommon;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const tables = {};

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. 종합 점수표 (방사형 + 등급 + 핵심 요약)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const labels = ['일간상성','오행보완','용신교차','합충교차','십성관계','친밀도','대운시기','인연깊이','자녀운','재물궁합'];
  const vals = labels.map(k => r.점수상세[k] || 50);
  const 종합색 = r.점수['종합']>=85?'#2e7d32':r.점수['종합']>=70?'#1565c0':r.점수['종합']>=55?'#1976d2':r.점수['종합']>=40?'#ef6c00':'#c62828';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 0. 두 사람 인적사항 (첫 페이지 · 아이보리·골드 스타일)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _지지띠 = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
  const 일주한자 = (who) => {
    const t = who.원국?.일주?.천간 || '';
    const j = who.원국?.일주?.지지 || '';
    const th = 천간음[t] || '';
    const jh = 지지음[j] || '';
    return `${t}${j}${th && jh ? ` (${th}${jh})` : ''}`;
  };
  const _oh = {木:'木(목)',火:'火(화)',土:'土(토)',金:'金(금)',水:'水(수)'};
  const 오행출력 = (x) => _oh[x] || x || '';
  const _ohColor = {木:'#2e7d32', 火:'#c62828', 土:'#a67c00', 金:'#5d4037', 水:'#1565c0'};
  const 오행요약 = (점수) => {
    const 키 = ['木','火','土','金','水'];
    const 합 = 키.reduce((s,k)=>s+(Number(점수?.[k])||0),0);
    if (합 <= 0) return '';
    return 키.map(k => {
      const pct = Math.round(((Number(점수[k])||0)/합)*100);
      return `<span style="color:${_ohColor[k]};font-weight:700;">${k}</span> ${pct}%`;
    }).join(' · ');
  };
  const personCard = (who, colorAccent) => {
    const 이름 = who.이름 || '';
    const 성별 = who.성별 === '남' ? '남성' : '여성';
    const 년지 = who.원국?.년주?.지지 || '';
    const 띠 = (_지지띠[년지] ? `${_지지띠[년지]}띠` : '');
    const 나이 = who.만나이 != null ? `만${who.만나이}세` : '';
    // 한글 원본 우선, 없으면 숫자→시진 한글 매핑 (한자/숫자 그대로 노출 방지)
    const _시간한글맵 = {0:'자시',1:'자시',2:'축시',3:'축시',4:'인시',5:'인시',6:'묘시',7:'묘시',8:'진시',9:'진시',10:'사시',11:'사시',12:'오시',13:'오시',14:'미시',15:'미시',16:'신시',17:'신시',18:'유시',19:'유시',20:'술시',21:'술시',22:'해시',23:'자시'};
    const 생시 = who.생시원본 || (typeof who.생시간 === 'number' ? (_시간한글맵[who.생시간] || '') : (who.생시간 || ''));
    const 양력 = who.양력정보 || '';
    const 음력 = who.음력정보 || '';
    return `<div class="info-card" style="border-color:${colorAccent}60;">
      <div class="info-left">
        <div class="info-name" style="color:${colorAccent};">${esc(이름)}</div>
        <div class="info-ilju">${esc(일주한자(who))}</div>
        <div class="info-badge">${[성별, 띠, 나이, 생시].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="info-div"></div>
      <div class="info-right">
        <div class="info-item"><span class="info-label">양력</span><span class="info-value">${esc(양력)}</span></div>
        <div class="info-item"><span class="info-label">음력</span><span class="info-value">${esc(음력||'—')}</span></div>
        <div class="info-item"><span class="info-label">신강약</span><span class="info-value">${esc(who.신강약||'')}</span></div>
        <div class="info-item"><span class="info-label">격국</span><span class="info-value">${esc(who.격국명||'')}</span></div>
        <div class="info-item"><span class="info-label">용신</span><span class="info-value" style="color:#2e7d32;font-weight:700;">${오행출력(who.용신)}</span></div>
        <div class="info-item"><span class="info-label">희신</span><span class="info-value" style="color:#1565c0;">${오행출력(who.희신)}</span></div>
        <div class="info-item"><span class="info-label">기신</span><span class="info-value" style="color:#c62828;">${오행출력(who.기신)}</span></div>
        <div class="info-item"><span class="info-label">일간</span><span class="info-value">${esc(who.일간||'')}(${esc(천간음[who.일간]||'')})</span></div>
        ${who.일간오행 ? `<div class="info-item" style="grid-column:1/-1;"><span class="info-label">일간오행</span><span class="info-value" style="color:${_ohColor[who.일간오행]||'#3d3225'};font-weight:700;">${who.일간오행}(${{木:'목',火:'화',土:'토',金:'금',水:'수'}[who.일간오행]||''})</span></div>` : ''}
        ${오행요약(who.오행점수) ? `<div class="info-item" style="grid-column:1/-1;margin-top:3px;padding-top:5px;border-top:1px dashed ${colorAccent}30;"><span class="info-label">오행</span><span class="info-value" style="font-size:9pt;letter-spacing:0.3px;">${오행요약(who.오행점수)}</span></div>` : ''}
      </div>
    </div>`;
  };
  tables['궁합인적사항표'] = wrap('두 사람 인적사항', sub, `
<style>
.info-card { background: linear-gradient(135deg,#fdfcf8 0%,#f8f4e8 100%); border: 1.5px solid #d4af37; border-radius: 14px; padding: 14px 20px; display:flex; gap:16px; align-items:center; margin-bottom:14px; }
.info-left { flex-shrink:0; text-align:center; width:150px; }
.info-left .info-name { font-family:'Noto Serif KR',serif; font-size:15pt; font-weight:800; letter-spacing:1.5px; margin-bottom:3px; }
.info-left .info-ilju { font-family:'Noto Serif KR',serif; font-size:9pt; color:#8a7e5a; letter-spacing:0.5px; margin-bottom:5px; }
.info-left .info-badge { display:inline-block; font-size:6.5pt; color:#8a7e5a; border:1px solid #d4af3780; border-radius:10px; padding:2px 8px; letter-spacing:0.3px; background:#fff; white-space:nowrap; }
.info-div { width:1px; height:110px; background:linear-gradient(180deg,transparent,#d4af3780,transparent); flex-shrink:0; }
.info-right { flex:1; min-width:0; display:grid; grid-template-columns:1fr 1fr; gap:3px 10px; }
.info-item { display:flex; gap:5px; align-items:baseline; white-space:nowrap; min-width:0; }
.info-item .info-label { font-size:7pt; color:#a09070; white-space:nowrap; min-width:32px; flex-shrink:0; }
.info-item .info-value { font-family:'Noto Serif KR',serif; font-size:8pt; color:#3d3225; font-weight:500; white-space:nowrap; }
.info-heart { text-align:center; font-size:22pt; color:#d4af37; font-weight:700; margin:-4px 0 6px; letter-spacing:2px; line-height:1; }
</style>
${personCard(A, '#1565c0')}
<div class="info-heart">♡</div>
${personCard(B, '#c2185b')}
`);

  tables['궁합종합점수표'] = wrap('♡ 궁합 종합 점수', sub, `
<div style="text-align:center;">
  <div class="score-big" style="color:${종합색};">${r.점수['종합']}<span style="font-size:12pt;">점</span></div>
  <div style="display:inline-block;padding:4px 20px;border-radius:20px;background:${종합색}15;color:${종합색};font-weight:700;font-size:11pt;">${esc(r.등급 || scoreGrade(r.점수['종합']))}</div>
</div>
<div style="display:flex;justify-content:center;margin:10px 0;">
  ${radarChart(labels, vals)}
</div>
<div class="row">${labels.map((l,i) => `<div style="flex:1;text-align:center;font-size:9pt;"><div style="font-weight:700;color:${scoreColor(vals[i])};">${vals[i]}</div><div style="color:#888;">${esc(l)}</div></div>`).join('')}</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1-B. 궁합한눈표 (대시보드 — 점수·오행·불균형·강점·주의를 한 페이지에)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    const aS = A.오행점수 || {}, bS = B.오행점수 || {};
    const _oh5 = ['木','火','土','金','水'];
    // 두 사람 합친 커플 오행 분포
    const couple = {};
    _oh5.forEach(k => couple[k] = (aS[k]||0) + (bS[k]||0));
    const maxCouple = Math.max(1, ...Object.values(couple));
    // 커플 5단계 분류: 부족 <2.0, 약함 2.0~3.5, 적정 3.5~9.0, 풍부 9.0~11.0, 과다 >11.0
    const 오행단계 = (v) => {
      if (v < 2.0)  return { label:'부족', icon:'🔻', color:'#c62828', tier:'shortage' };
      if (v < 3.5)  return { label:'약함', icon:'▽',  color:'#ef6c00', tier:'weak' };
      if (v <= 9.0) return { label:'적정', icon:'✓',  color:'#2e7d32', tier:'balanced' };
      if (v <= 11.0)return { label:'풍부', icon:'△',  color:'#1565c0', tier:'rich' };
      return          { label:'과다', icon:'🔺', color:'#c62828', tier:'excess' };
    };
    const shortage = _oh5.filter(k => 오행단계(couple[k]).tier === 'shortage');
    const excess   = _oh5.filter(k => 오행단계(couple[k]).tier === 'excess');
    const weak     = _oh5.filter(k => 오행단계(couple[k]).tier === 'weak');
    const rich     = _oh5.filter(k => 오행단계(couple[k]).tier === 'rich');
    // 항목별 TOP/BOTTOM 3
    const ranked = labels.map((l,i)=>({l,v:vals[i]})).sort((a,b)=>b.v-a.v);
    const top3 = ranked.slice(0,3);
    const bottom3 = ranked.slice(-3);

    tables['궁합한눈표'] = wrap('궁합 한눈 요약', sub, `
<div style="text-align:center;margin-bottom:8px;">
  <span style="font-size:22pt;font-weight:900;color:${종합색};">${r.점수['종합']}점</span>
  <span style="margin-left:10px;padding:4px 14px;border-radius:14px;background:${종합색}15;color:${종합색};font-weight:700;font-size:10pt;">${esc(r.등급 || scoreGrade(r.점수['종합']))}</span>
  <span style="margin-left:8px;font-size:8pt;color:#888;">상위 ${r.상위퍼센트 || 50}% / 하위 ${r.하위퍼센트 || 50}%</span>
</div>

<div class="card">
  <div class="card-t">📜 두 사람 사주 요약</div>
  <div style="font-size:9pt;padding:3px 0;line-height:1.75;">
    🔵 <b>${esc(A.이름)}</b>
    <span style="font-family:'Noto Serif KR';font-weight:700;">${A.원국.년주.천간}${A.원국.년주.지지} ${A.원국.월주.천간}${A.원국.월주.지지} ${A.원국.일주.천간}${A.원국.일주.지지} ${A.원국.시주.천간}${A.원국.시주.지지}</span>
    | <span class="tag pos">도움오행(용신) ${oh[A.용신]||'-'}(${A.용신||'-'})</span><span class="tag neg">피해야할오행(기신) ${oh[A.기신]||'-'}(${A.기신||'-'})</span>
    <span class="tag">${esc(A.신강약||'')}</span>
  </div>
  <div style="font-size:9pt;padding:3px 0;line-height:1.75;">
    🔴 <b>${esc(B.이름)}</b>
    <span style="font-family:'Noto Serif KR';font-weight:700;">${B.원국.년주.천간}${B.원국.년주.지지} ${B.원국.월주.천간}${B.원국.월주.지지} ${B.원국.일주.천간}${B.원국.일주.지지} ${B.원국.시주.천간}${B.원국.시주.지지}</span>
    | <span class="tag pos">도움오행(용신) ${oh[B.용신]||'-'}(${B.용신||'-'})</span><span class="tag neg">피해야할오행(기신) ${oh[B.기신]||'-'}(${B.기신||'-'})</span>
    <span class="tag">${esc(B.신강약||'')}</span>
  </div>
</div>

<div class="card">
  <div class="card-t">⚖ 커플 오행 분포 (A + B 합산)</div>
  ${_oh5.map(k => {
    const a = aS[k]||0, b = bS[k]||0, total = couple[k];
    const pct = Math.min(100, (total/maxCouple)*100);
    const 단 = 오행단계(total);
    const statTxt = `<span style="color:${단.color};font-weight:${단.tier==='balanced'?400:700};">${단.label} ${단.icon}</span>`;
    return `<div style="display:flex;align-items:center;margin:3px 0;font-size:9pt;">
      <div style="width:26px;color:${ohC[k]};font-weight:900;font-size:11pt;">${k}</div>
      <div style="flex:1;height:14px;background:#f5f5f5;border-radius:7px;margin:0 6px;position:relative;">
        <div style="width:${pct}%;height:100%;background:${ohC[k]};border-radius:7px;"></div>
      </div>
      <div style="width:100px;font-size:9pt;color:#666;">${a.toFixed(1)} + ${b.toFixed(1)} = ${total.toFixed(1)}</div>
      <div style="width:54px;text-align:right;">${statTxt}</div>
    </div>`;
  }).join('')}
</div>

${(() => {
  const _ef = r.항목.기여방향;
  if (!_ef) return '';
  const colA = _ef.AtoB.비율 >= _ef.BtoA.비율 ? '#1565c0' : '#90caf9';
  const colB = _ef.BtoA.비율 >= _ef.AtoB.비율 ? '#e91e63' : '#f8bbd0';
  return `<div class="card" style="padding:8px 10px;">
    <div class="card-t">🔀 관계 에너지 흐름 <span style="font-size:9pt;font-weight:400;color:#666;">· ${esc(_ef.라벨)}</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
      <div style="min-width:60px;color:#1565c0;font-weight:700;font-size:9.5pt;text-align:right;">🔵${esc(A.이름)}</div>
      <div style="flex:1;height:16px;background:#f5f5f5;border-radius:8px;overflow:hidden;display:flex;">
        <div style="width:${_ef.AtoB.비율}%;height:100%;background:${colA};display:flex;align-items:center;justify-content:center;font-size:9pt;color:#fff;font-weight:700;">${_ef.AtoB.비율}%</div>
        <div style="width:${_ef.BtoA.비율}%;height:100%;background:${colB};display:flex;align-items:center;justify-content:center;font-size:9pt;color:#fff;font-weight:700;">${_ef.BtoA.비율}%</div>
      </div>
      <div style="min-width:60px;color:#e91e63;font-weight:700;font-size:9.5pt;">${esc(B.이름)}🔴</div>
    </div>
    <div class="item" style="text-align:center;font-size:9pt;color:#777;padding-top:2px;">→ 주는 쪽 · 받는 쪽 비율 (세부는 〈관계 에너지 흐름표〉)</div>
  </div>`;
})()}

<div class="card" style="background:#fff8e1;border-color:#ffe082;">
  <div class="card-t" style="color:#e65100;">💡 한눈 요약</div>
  <div class="item">⭐ 강점 TOP 3: ${top3.map(x=>`${esc(x.l)}(${x.v})`).join(' · ')}</div>
  <div class="item">⚠️ 주의 BOTTOM 3: ${bottom3.map(x=>`${esc(x.l)}(${x.v})`).join(' · ')}</div>
  ${shortage.length ? `<div class="item">🔻 공동 부족 오행: ${shortage.map(k=>`${k}(${oh[k]})`).join(', ')} — 일상에서 해당 기운을 의식적으로 보충하세요.</div>` : ''}
  ${weak.length ? `<div class="item">▽ 다소 약한 오행: ${weak.map(k=>`${k}(${oh[k]})`).join(', ')} — 부족은 아니지만 평균 이하로 보강을 권합니다.</div>` : ''}
  ${rich.length ? `<div class="item">△ 풍부한 오행: ${rich.map(k=>`${k}(${oh[k]})`).join(', ')} — 활용 가능한 자원. 단, 한쪽으로 기울지 않게 관리.</div>` : ''}
  ${excess.length ? `<div class="item">🔺 공동 과다 오행: ${excess.map(k=>`${k}(${oh[k]})`).join(', ')} — 절제와 조절이 관계 유지의 핵심입니다.</div>` : ''}
  ${!shortage.length && !excess.length && !weak.length && !rich.length ? '<div class="item">⚖ 오행 분포는 대체로 균형 상태입니다.</div>' : ''}
</div>`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 사주 비교표 (양쪽 사주 대비)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _ilganSc = r.점수상세['일간상성'] || 50;
  const _ilganLine = (r.항목 && r.항목.일간상성 && r.항목.일간상성.관계) || '';
  tables['궁합사주비교표'] = wrap('사주 비교', sub, `
<div class="card" style="padding:6px 8px;">
  <div class="card-t" style="margin-bottom:2px;padding-bottom:2px;font-size:10.5pt;">🔵 ${esc(A.이름)} · ${A.일간}(${천간음[A.일간]||''}) ${oh[A.일간오행]||''} · ${esc(A.신강약||'')} · 용신 ${oh[A.용신]||''}</div>
  <div class="saju-box" style="padding:2px 0;">
    ${주(A.원국.년주.천간, A.원국.년주.지지)}
    ${주(A.원국.월주.천간, A.원국.월주.지지)}
    ${주(A.원국.일주.천간, A.원국.일주.지지)}
    ${주(A.원국.시주.천간, A.원국.시주.지지)}
  </div>
  <div style="display:flex;justify-content:space-around;font-size:8.5pt;color:#999;">년주<span></span>월주<span></span>일주<span></span>시주</div>
</div>
<div class="card" style="padding:6px 8px;">
  <div class="card-t" style="margin-bottom:2px;padding-bottom:2px;font-size:10.5pt;">🔴 ${esc(B.이름)} · ${B.일간}(${천간음[B.일간]||''}) ${oh[B.일간오행]||''} · ${esc(B.신강약||'')} · 용신 ${oh[B.용신]||''}</div>
  <div class="saju-box" style="padding:2px 0;">
    ${주(B.원국.년주.천간, B.원국.년주.지지)}
    ${주(B.원국.월주.천간, B.원국.월주.지지)}
    ${주(B.원국.일주.천간, B.원국.일주.지지)}
    ${주(B.원국.시주.천간, B.원국.시주.지지)}
  </div>
  <div style="display:flex;justify-content:space-around;font-size:8.5pt;color:#999;">년주<span></span>월주<span></span>일주<span></span>시주</div>
</div>
<div class="card" style="padding:6px 8px;">
  <div style="display:flex;align-items:center;gap:8px;">
    <div style="font-size:10pt;font-weight:700;color:#3949ab;white-space:nowrap;">일간 상성</div>
    <div style="flex:1;font-size:9.5pt;color:${scoreColor(_ilganSc)};font-weight:600;">${esc(_ilganLine || scoreGrade(_ilganSc))}</div>
    <div style="font-size:11pt;font-weight:900;color:${scoreColor(_ilganSc)};">${_ilganSc}점</div>
  </div>
  <div class="gauge" style="height:8px;margin:3px 0 0;"><div class="gauge-fill" style="width:${_ilganSc}%;background:${scoreColor(_ilganSc)};"></div></div>
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 오행 비교표 (펜타곤 시각화)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const aScore = A.오행점수 || {}, bScore = B.오행점수 || {};
  // 두 사람 오행 중 최대값으로 정규화
  const _ohMax = Math.max(1, ...['木','火','土','金','水'].flatMap(k => [aScore[k]||0, bScore[k]||0]));
  const _ohScore = r.점수상세['오행보완'] || 50;
  // 두 사람 펜타곤 겹쳐진 SVG (A=파랑, B=빨강)
  const _pentaSvg = (() => {
    const keys = ['木','火','土','金','水'];
    const cx = 150, cy = 150, maxR = 100;
    const maxV = Math.max(1, _ohMax);
    const pt = (i, v) => {
      const a = (Math.PI * 2 * i / 5) - Math.PI / 2;
      const r = (v/maxV) * maxR;
      return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
    };
    let s = `<svg viewBox="0 0 300 300" width="100%" style="max-width:280px;" xmlns="http://www.w3.org/2000/svg">`;
    // 배경 그리드 (20·40·60·80·100%)
    for (const r of [20,40,60,80,100]) {
      const pts = keys.map((_,i) => {
        const a = (Math.PI*2*i/5) - Math.PI/2;
        return `${cx + maxR*r/100*Math.cos(a)},${cy + maxR*r/100*Math.sin(a)}`;
      }).join(' ');
      s += `<polygon points="${pts}" fill="none" stroke="${r===100?'#90a4ae':'#e0e0e0'}" stroke-width="${r===100?1:0.5}"/>`;
    }
    // 중심 → 꼭짓점 선
    for (let i=0;i<5;i++) { const p=pt(i,maxV); s += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="#e0e0e0" stroke-width="0.5"/>`; }
    // A 펜타곤 (파란색)
    const aPts = keys.map((k,i) => pt(i, aScore[k]||0));
    s += `<polygon points="${aPts.map(p=>`${p.x},${p.y}`).join(' ')}" fill="rgba(21,101,192,0.3)" stroke="#1565c0" stroke-width="2"/>`;
    aPts.forEach(p => s += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#1565c0"/>`);
    // B 펜타곤 (빨간색)
    const bPts = keys.map((k,i) => pt(i, bScore[k]||0));
    s += `<polygon points="${bPts.map(p=>`${p.x},${p.y}`).join(' ')}" fill="rgba(233,30,99,0.3)" stroke="#e91e63" stroke-width="2"/>`;
    bPts.forEach(p => s += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#e91e63"/>`);
    // 꼭짓점 라벨 (오행 한자 + 값)
    keys.forEach((k, i) => {
      const lp = pt(i, maxV * 1.22);
      s += `<circle cx="${lp.x}" cy="${lp.y}" r="14" fill="${ohC[k]}" stroke="#fff" stroke-width="2"/>`;
      s += `<text x="${lp.x}" y="${lp.y+5}" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">${k}</text>`;
    });
    return s + '</svg>';
  })();

  tables['궁합오행비교표'] = wrap('오행 균형 비교', sub, `
<div style="display:flex;justify-content:center;gap:20px;margin-bottom:6px;font-size:9pt;">
  <span style="color:#1565c0;">🔵 <strong>${esc(A.이름)}</strong></span>
  <span style="color:#e91e63;">🔴 <strong>${esc(B.이름)}</strong></span>
</div>
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">🌈 오행 펜타곤 겹치기</div>
  ${_pentaSvg}
</div>
<div class="card">
  ${['木','火','土','金','水'].map(k => {
    const a = aScore[k] || 0, b = bScore[k] || 0;
    const aPct = Math.round((a/_ohMax)*100), bPct = Math.round((b/_ohMax)*100);
    return `<div style="display:flex;align-items:center;margin:4px 0;">
      <div style="width:44px;text-align:right;font-weight:700;color:${ohC[k]};font-size:9pt;">${oh[k]}(${k})</div>
      <div style="flex:1;display:flex;margin:0 8px;gap:2px;">
        <div style="flex:1;text-align:right;"><div style="display:inline-block;width:${aPct}%;height:14px;background:#1565c0;border-radius:3px;min-width:2px;"></div></div>
        <div style="width:1px;background:#ddd;"></div>
        <div style="flex:1;"><div style="display:inline-block;width:${bPct}%;height:14px;background:#e91e63;border-radius:3px;min-width:2px;"></div></div>
      </div>
      <div style="width:76px;font-size:9pt;color:#666;text-align:center;">${a.toFixed(1)} : ${b.toFixed(1)}</div>
    </div>`;
  }).join('')}
</div>
<div class="card" style="background:#fff8e1;border-color:#ffe082;">
  <div class="card-t" style="color:#e65100;">💡 오행 보완 (${_ohScore}점)</div>
  <div class="gauge"><div class="gauge-fill" style="width:${_ohScore}%;background:${scoreColor(_ohScore)};"></div></div>
  ${(r.항목.오행보완 && r.항목.오행보완.분석 || []).slice(0,3).map(s=>`<div class="item">• ${esc(s)}</div>`).join('') || '<div class="item">뚜렷한 보완 작용 없음 — 균형 상태</div>'}
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 용신 교차표
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const BisA용 = B.일간오행 === A.용신, AisB용 = A.일간오행 === B.용신;
  const BisA희 = B.일간오행 === A.희신, AisB희 = A.일간오행 === B.희신;
  const BisA기 = B.일간오행 === A.기신, AisB기 = A.일간오행 === B.기신;
  function 교차상태(용, 희, 기) {
    if (용) return {라벨:'용신', 색:'#2e7d32', 아이콘:'⭐'};
    if (희) return {라벨:'희신', 색:'#1565c0', 아이콘:'✨'};
    if (기) return {라벨:'기신', 색:'#c62828', 아이콘:'⚠'};
    return {라벨:'중립', 색:'#757575', 아이콘:'○'};
  }
  const AtoB상 = 교차상태(AisB용, AisB희, AisB기);
  const BtoA상 = 교차상태(BisA용, BisA희, BisA기);

  const _yongSc = r.점수상세['용신교차'] || r.점수.용신교차 || 50;
  const _yongColor = scoreColor(_yongSc);

  // ── 오행 오각형 SVG 도식 ──
  // 5각형 위치 (木 위·火 우상·土 우하·金 좌하·水 좌상)
  const _ohPos = {
    木: {x:   0, y: -78, label_dy: -38},
    火: {x:  74, y: -24, label_dx: 34, label_dy: 0},
    土: {x:  46, y:  63, label_dx: 30, label_dy: 8},
    金: {x: -46, y:  63, label_dx:-30, label_dy: 8},
    水: {x: -74, y: -24, label_dx:-34, label_dy: 0},
  };
  const _상생순 = ['木','火','土','金','水'];
  const _상극쌍 = [['木','土'],['土','水'],['水','火'],['火','金'],['金','木']];
  // 역할: aOh, bOh에 대해 A의 용·희·기·B의 용·희·기 매칭
  const _roleOf = (k, p) => {
    if (k === p.용신) return {color:'#2e7d32', icon:'-', text:'용신'};
    if (k === p.희신) return {color:'#1565c0', icon:'✨', text:'희신'};
    if (k === p.기신) return {color:'#c62828', icon:'⚠', text:'기신'};
    return {color:'#757575', icon:'○', text:'중립'};
  };
  const _BtoA = _roleOf(B.일간오행, A);
  const _AtoB = _roleOf(A.일간오행, B);

  const _svg = (() => {
    let s = `<svg viewBox="-110 -110 220 220" width="220" height="220" xmlns="http://www.w3.org/2000/svg">`;
    // 상생 선 (녹색, 부드러운)
    for (let i = 0; i < 5; i++) {
      const f = _ohPos[_상생순[i]], t = _ohPos[_상생순[(i+1)%5]];
      s += `<line x1="${f.x}" y1="${f.y}" x2="${t.x}" y2="${t.y}" stroke="#4caf50" stroke-width="1.5" opacity="0.4"/>`;
    }
    // 상극 선 (빨강, 점선)
    _상극쌍.forEach(([f,t]) => {
      const p1 = _ohPos[f], p2 = _ohPos[t];
      s += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#f44336" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.35"/>`;
    });
    // 오행 원
    ['木','火','土','金','水'].forEach(k => {
      const p = _ohPos[k];
      const isA = k === A.일간오행, isB = k === B.일간오행;
      const r = (isA || isB) ? 24 : 19;
      s += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${ohC[k]}" stroke="#fff" stroke-width="2"/>`;
      // A 링 (파랑)
      if (isA) s += `<circle cx="${p.x}" cy="${p.y}" r="${r+3}" fill="none" stroke="#1565c0" stroke-width="2.5"/>`;
      // B 링 (빨강), 위치 겹치면 두 번째 링
      if (isB) s += `<circle cx="${p.x}" cy="${p.y}" r="${r+(isA?7:3)}" fill="none" stroke="#e91e63" stroke-width="2.5"/>`;
      // 오행 한자 (흰색)
      s += `<text x="${p.x}" y="${p.y+6}" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${k}</text>`;
      // 한글 레이블 (원 바깥)
      s += `<text x="${p.x + (p.label_dx||0)}" y="${p.y + (p.label_dy||0)}" text-anchor="middle" font-size="10" font-weight="700" fill="${ohC[k]}">${oh[k]}</text>`;
    });
    // 중앙 ♡ + 점수
    s += `<circle cx="0" cy="0" r="18" fill="#fff" stroke="${_yongColor}" stroke-width="2"/>`;
    s += `<text x="0" y="-2" text-anchor="middle" font-size="12" font-weight="900" fill="${_yongColor}">${_yongSc}</text>`;
    s += `<text x="0" y="10" text-anchor="middle" font-size="10" fill="#888">점</text>`;
    // 범례
    s += `<text x="-105" y="-95" font-size="9" fill="#1565c0" font-weight="700">🔵 ${esc(A.이름)}(${A.일간오행})</text>`;
    s += `<text x="105"  y="-95" text-anchor="end" font-size="9" fill="#e91e63" font-weight="700">🔴 ${esc(B.이름)}(${B.일간오행})</text>`;
    s += `</svg>`;
    return s;
  })();

  tables['궁합용신교차표'] = wrap('용신 교차 분석', sub, `
<div class="card" style="text-align:center;padding:12px;">
  <div class="card-t" style="justify-content:center;">🎯 오행 순환 도식 — 상생(초록) · 상극(빨강)</div>
  ${_svg}
  <div style="font-size:9pt;color:#888;margin-top:4px;">외곽선: 🔵 ${esc(A.이름)} 일간  ·  🔴 ${esc(B.이름)} 일간</div>
</div>

<div class="row">
  <div class="col card" style="background:linear-gradient(135deg,#e3f2fd,#bbdefb);border-color:#90caf9;padding:10px;">
    <div style="font-size:9pt;color:#0d47a1;text-align:center;">🔴 ${esc(B.이름)} → 🔵 ${esc(A.이름)}</div>
    <div style="text-align:center;margin:4px 0;">
      <span style="font-size:20pt;font-weight:900;color:${ohC[B.일간오행]};">${B.일간}</span>
      <span style="font-size:8pt;color:#666;">(${oh[B.일간오행]})</span>
    </div>
    <div style="text-align:center;">
      <span style="display:inline-block;background:${_BtoA.color};color:#fff;padding:5px 14px;border-radius:14px;font-size:11pt;font-weight:900;">${_BtoA.icon} ${_BtoA.text}</span>
    </div>
  </div>
  <div class="col card" style="background:linear-gradient(135deg,#fce4ec,#f8bbd0);border-color:#f48fb1;padding:10px;">
    <div style="font-size:9pt;color:#880e4f;text-align:center;">🔵 ${esc(A.이름)} → 🔴 ${esc(B.이름)}</div>
    <div style="text-align:center;margin:4px 0;">
      <span style="font-size:20pt;font-weight:900;color:${ohC[A.일간오행]};">${A.일간}</span>
      <span style="font-size:8pt;color:#666;">(${oh[A.일간오행]})</span>
    </div>
    <div style="text-align:center;">
      <span style="display:inline-block;background:${_AtoB.color};color:#fff;padding:5px 14px;border-radius:14px;font-size:11pt;font-weight:900;">${_AtoB.icon} ${_AtoB.text}</span>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-t">📊 각자의 도움오행 · 피해야할오행</div>
  <div class="item" style="font-size:8.5pt;color:#888;padding:2px 0 6px;">용신(用神)=나에게 가장 좋은 오행 · 희신(喜神)=용신을 돕는 오행 · 기신(忌神)=나에게 해로운 오행</div>
  <table style="width:100%;border-collapse:collapse;font-size:9pt;">
    <tr style="color:#888;font-size:9pt;text-align:center;">
      <td style="padding:3px;"></td>
      <td style="padding:3px;">용신(도움)</td><td style="padding:3px;">희신(보조)</td><td style="padding:3px;">기신(회피)</td>
    </tr>
    ${[
      {name:A.이름, c:'#1565c0', 용:A.용신, 희:A.희신, 기:A.기신},
      {name:B.이름, c:'#e91e63', 용:B.용신, 희:B.희신, 기:B.기신},
    ].map((p, idx) => `<tr>
      <td style="padding:4px;font-weight:700;color:${p.c};">${idx===0?'🔵':'🔴'} ${esc(p.name)}</td>
      ${['용','희','기'].map(k => {
        const v = p[k];
        return `<td style="text-align:center;padding:3px;">
          <span style="display:inline-block;min-width:26px;height:26px;line-height:26px;border-radius:50%;background:${ohC[v]||'#ccc'}33;color:${ohC[v]||'#666'};font-weight:900;">${v||'-'}</span>
          <div style="font-size:9pt;color:#888;">${oh[v]||'-'}</div>
        </td>`;
      }).join('')}
    </tr>`).join('')}
  </table>
</div>

<div class="card" style="background:#fff8e1;border-color:#ffe082;">
  <div class="card-t" style="color:#e65100;">💡 핵심</div>
  ${(r.항목.용신교차 && r.항목.용신교차.분석 || []).slice(0,3).map(s=>`<div class="item">💎 ${esc(s)}</div>`).join('') || '<div class="item">직접 교차는 없지만 오행 보완·상생 관계로 조화 가능합니다.</div>'}
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 십성 관계표 — 양방향 십성 + 조합 해설
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const sA = r.항목.십성관계.AtoB, sB = r.항목.십성관계.BtoA;
  const _sipSc = r.점수상세['십성관계'] || r.점수.십성관계 || 50;
  // 양방향 원형 + 화살표 SVG
  const _sipDiagram = `<svg viewBox="0 0 400 180" width="100%" style="max-width:380px;" xmlns="http://www.w3.org/2000/svg">
    <!-- A 큰 원 (좌측) -->
    <circle cx="80" cy="90" r="56" fill="url(#gradA)" stroke="#1565c0" stroke-width="3"/>
    <defs><linearGradient id="gradA" x1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3f2fd"/><stop offset="1" stop-color="#64b5f6"/></linearGradient><linearGradient id="gradB" x1="0" x2="1" y2="1"><stop offset="0" stop-color="#fce4ec"/><stop offset="1" stop-color="#f48fb1"/></linearGradient><marker id="arA" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><polygon points="0,0 10,5 0,10" fill="#1565c0"/></marker><marker id="arB" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><polygon points="0,0 10,5 0,10" fill="#e91e63"/></marker></defs>
    <text x="80" y="78" text-anchor="middle" font-size="10" font-weight="700" fill="#0d47a1">🔵 ${esc(A.이름)}</text>
    <text x="80" y="98" text-anchor="middle" font-size="18" font-weight="900" fill="#0d47a1">${A.일간}</text>
    <text x="80" y="116" text-anchor="middle" font-size="10" fill="#1565c0">(${oh[A.일간오행]})</text>
    <!-- B 큰 원 (우측) -->
    <circle cx="320" cy="90" r="56" fill="url(#gradB)" stroke="#e91e63" stroke-width="3"/>
    <text x="320" y="78" text-anchor="middle" font-size="10" font-weight="700" fill="#880e4f">🔴 ${esc(B.이름)}</text>
    <text x="320" y="98" text-anchor="middle" font-size="18" font-weight="900" fill="#880e4f">${B.일간}</text>
    <text x="320" y="116" text-anchor="middle" font-size="10" fill="#e91e63">(${oh[B.일간오행]})</text>
    <!-- A → B 화살표 (위쪽) -->
    <path d="M 136,70 Q 200,30 264,70" stroke="#1565c0" stroke-width="2.5" fill="none" marker-end="url(#arA)"/>
    <rect x="160" y="12" width="80" height="26" rx="13" fill="#1565c0"/>
    <text x="200" y="30" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">${esc(sA.십성 || '-')}</text>
    <!-- B → A 화살표 (아래쪽) -->
    <path d="M 264,110 Q 200,150 136,110" stroke="#e91e63" stroke-width="2.5" fill="none" marker-end="url(#arB)"/>
    <rect x="160" y="142" width="80" height="26" rx="13" fill="#e91e63"/>
    <text x="200" y="160" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">${esc(sB.십성 || '-')}</text>
  </svg>`;

  // 십성 관계 카테고리 분류 (긍정·중립·주의)
  const _십성분류 = (s) => {
    if (!s) return { 종류:'중립', 색:'#90a4ae' };
    if (['정관','정재','정인','식신','비견'].includes(s)) return { 종류:'긍정', 색:'#2e7d32' };
    if (['편관','편재','편인','상관','겁재'].includes(s)) return { 종류:'주의', 색:'#ef6c00' };
    return { 종류:'중립', 색:'#90a4ae' };
  };
  const _sipA분 = _십성분류(sA.십성);
  const _sipB분 = _십성분류(sB.십성);

  tables['궁합십성관계표'] = wrap('서로에게 어떤 존재?', sub, `
<div class="card" style="padding:10px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <div style="text-align:center;padding:10px 14px;border:2px solid ${scoreColor(_sipSc)}40;border-radius:12px;background:${scoreColor(_sipSc)}08;min-width:90px;">
      <div style="font-size:24pt;font-weight:900;color:${scoreColor(_sipSc)};line-height:1;">${_sipSc}</div>
      <div style="font-size:9pt;color:#999;margin-top:2px;">십성 관계</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:10pt;color:#555;padding:2px 0;">십성(十星)은 나를 기준으로 본 상대의 <b>사회적·심리적 역할</b>이에요. 같은 사람이라도 누가 보느냐에 따라 다르게 작용합니다.</div>
      <div class="gauge" style="margin-top:4px;"><div class="gauge-fill" style="width:${_sipSc}%;background:${scoreColor(_sipSc)};"></div></div>
    </div>
  </div>
</div>

<div class="card" style="padding:8px 10px;border-left:4px solid #1565c0;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
    <div style="font-size:9.5pt;color:#666;">🔵 <b>${esc(A.이름)}</b>에게 🔴 <b>${esc(B.이름)}</b>은</div>
    <div style="flex:1;"></div>
    <span class="tag" style="background:${_sipA분.색}20;color:${_sipA분.색};font-weight:700;">${_sipA분.종류}</span>
  </div>
  <div style="font-size:15pt;font-weight:800;color:#0d47a1;margin:2px 0 6px;">${esc(sA.십성 || '-')} <span style="font-size:9pt;color:#888;font-weight:400;">— 상대가 내게 주는 역할</span></div>
  <div class="item" style="font-size:9.5pt;color:#333;line-height:1.55;">${esc(sA.해석||'')}</div>
</div>

<div class="card" style="padding:8px 10px;border-left:4px solid #e91e63;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
    <div style="font-size:9.5pt;color:#666;">🔴 <b>${esc(B.이름)}</b>에게 🔵 <b>${esc(A.이름)}</b>은</div>
    <div style="flex:1;"></div>
    <span class="tag" style="background:${_sipB분.색}20;color:${_sipB분.색};font-weight:700;">${_sipB분.종류}</span>
  </div>
  <div style="font-size:15pt;font-weight:800;color:#880e4f;margin:2px 0 6px;">${esc(sB.십성 || '-')} <span style="font-size:9pt;color:#888;font-weight:400;">— 내가 상대에게 주는 역할</span></div>
  <div class="item" style="font-size:9.5pt;color:#333;line-height:1.55;">${esc(sB.해석||'')}</div>
</div>

${r.항목.십성관계.조합해석 ? `<div class="card" style="background:#f3e5f5;border-color:#ce93d8;">
  <div class="card-t" style="color:#6a1b9a;">🔁 조합 해석 (${esc(sA.십성||'')} ⇄ ${esc(sB.십성||'')})</div>
  <div class="item" style="font-size:9.5pt;">- ${esc(r.항목.십성관계.조합해석)}</div>
</div>` : ''}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 친밀도 표 — 등급 + 요소 (모던 리뉴얼)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const 친밀점 = r.점수.친밀도;
  const 친등급 = 친밀점>=85?'최상':친밀점>=65?'상':친밀점>=45?'중':'하';
  const 친등급풀 = {최상:'매우 강렬한 끌림', 상:'자연스러운 끌림', 중:'담담하고 편안', 하:'노력이 필요한 단계'}[친등급];
  const 친색 = 친밀점>=85?'#c2185b':친밀점>=65?'#e91e63':친밀점>=45?'#ec407a':'#f48fb1';

  // 친밀도 요소 감지 (분석 텍스트 기반)
  const _친분석 = r.항목.친밀도.분석 || [];
  const _친요소 = [
    { key:'도화살',  label:'도화살(매력 발산)',         설명:'이성적·사회적 끌림 자연 발산',       아이콘:'✦' },
    { key:'홍염살',  label:'홍염살(관능·매력)',         설명:'몸과 분위기의 매력',             아이콘:'✦' },
    { key:'천희',    label:'천희(기쁨·화합)',          설명:'함께하면 웃음과 여유',            아이콘:'✦' },
    { key:'일간합',  label:'일간 천간합(운명적 끌림)', 설명:'말로 설명 못 할 끌림',            아이콘:'✦' },
    { key:'음양차',  label:'음양차(보완적 매력)',       설명:'서로 다른 성질이 서로를 끌어당김', 아이콘:'✦' },
    { key:'교류',    label:'교차 도화(상호 자극)',     설명:'오래 지나도 새롭게 보이는 구조',  아이콘:'✦' },
  ];
  _친요소.forEach(e => {
    e.감지 = _친분석.some(s => s.includes(e.key));
  });
  const _감지수 = _친요소.filter(e=>e.감지).length;

  tables['궁합친밀도표'] = wrap('친밀도 분석', sub, `
<div class="card" style="padding:10px;">
  <div style="display:flex;align-items:center;gap:14px;">
    <!-- 왼쪽: 점수 카드 -->
    <div style="text-align:center;padding:10px 14px;border:2px solid ${친색}40;border-radius:12px;background:${친색}08;min-width:96px;">
      <div style="font-size:26pt;font-weight:900;color:${친색};line-height:1;">${친밀점}</div>
      <div style="font-size:9pt;color:#999;margin-top:2px;">친밀도 점수</div>
      <div style="margin-top:5px;padding:2px 10px;background:${친색};color:#fff;font-size:9pt;font-weight:700;border-radius:10px;display:inline-block;">${친등급}</div>
    </div>
    <!-- 오른쪽: 해설 -->
    <div style="flex:1;">
      <div style="font-size:11pt;font-weight:700;color:${친색};margin-bottom:4px;">${esc(친등급풀)}</div>
      <div class="item" style="font-size:9.5pt;color:#555;padding:2px 0;">감지된 매력 요소 <b>${_감지수}건</b> · 전체 ${_친요소.length}종 중</div>
      <div class="gauge" style="margin-top:4px;"><div class="gauge-fill" style="width:${친밀점}%;background:linear-gradient(90deg,${친색}dd,${친색});"></div></div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-t">✦ 친밀도 요소 체크리스트</div>
  <div class="item" style="font-size:8.5pt;color:#888;padding:2px 0 6px;">명리학에서 이성 매력·끌림을 만드는 6가지 요소예요. 해당될수록 관계에 자연 끌림이 강합니다.</div>
  <div class="grid grid-2" style="gap:5px;">
  ${_친요소.map(e => `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:${e.감지?친색+'12':'#fafafa'};border:1px solid ${e.감지?친색+'50':'#eee'};border-radius:8px;">
    <div style="width:22px;height:22px;border-radius:50%;background:${e.감지?친색:'#ddd'};color:#fff;font-size:12pt;font-weight:900;text-align:center;line-height:22px;flex-shrink:0;">${e.감지?'●':'○'}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:9.5pt;font-weight:700;color:${e.감지?친색:'#aaa'};">${esc(e.label)}</div>
      <div style="font-size:8.5pt;color:${e.감지?'#666':'#bbb'};">${esc(e.설명)}</div>
    </div>
  </div>`).join('')}
  </div>
</div>

${_친분석.length ? `<div class="card" style="background:#fff5f7;border-color:#f8bbd0;">
  <div class="card-t" style="color:${친색};">💬 세부 분석</div>
  ${_친분석.slice(0,5).map(s=>`<div class="item" style="font-size:9.5pt;padding:3px 0;">- ${esc(s)}</div>`).join('')}
</div>` : `<div class="card"><div class="item" style="text-align:center;color:#888;">특별한 매력 신살은 없지만, 꾸준한 스킨십·대화로 깊고 안정적인 친밀감을 만들 수 있어요. 화려한 불꽃보다 오래 타는 숯불 같은 인연입니다.</div></div>`}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. 합충 교차표 — 8×8 지지 히트맵
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const hc = r.항목.합충교차;
  const _hapSc = r.점수상세['합충교차'] || r.점수.합충교차 || 50;
  // 4주 원반 SVG: 위 A(년·월·일·시), 아래 B + 감지된 합충 연결선
  const _hapDiagram = (() => {
    const aJj = [A.원국.년주.지지, A.원국.월주.지지, A.원국.일주.지지, A.원국.시주.지지];
    const bJj = [B.원국.년주.지지, B.원국.월주.지지, B.원국.일주.지지, B.원국.시주.지지];
    const aCh = [A.원국.년주.천간, A.원국.월주.천간, A.원국.일주.천간, A.원국.시주.천간];
    const bCh = [B.원국.년주.천간, B.원국.월주.천간, B.원국.일주.천간, B.원국.시주.천간];
    const xs = [85, 175, 265, 355];
    const 위치라벨 = ['년주','월주','일주','시주'];
    let s = `<svg viewBox="0 0 460 260" width="100%" style="max-width:460px;" xmlns="http://www.w3.org/2000/svg">`;
    // 이름 라벨
    s += `<text x="6" y="56" font-size="10" fill="#1565c0" font-weight="700">🔵 ${esc(A.이름)}</text>`;
    s += `<text x="6" y="206" font-size="10" fill="#e91e63" font-weight="700">🔴 ${esc(B.이름)}</text>`;
    // A 행 (천간 위, 지지 아래)
    aCh.forEach((g, i) => { s += `<circle cx="${xs[i]}" cy="32" r="20" fill="${ohC[요행(g)]||'#999'}" stroke="#1565c0" stroke-width="2"/>`; s += `<text x="${xs[i]}" y="39" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${g}</text>`; });
    aJj.forEach((z, i) => { const k = ({子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'})[z]; s += `<circle cx="${xs[i]}" cy="80" r="20" fill="${ohC[k]||'#999'}" stroke="#1565c0" stroke-width="2"/>`; s += `<text x="${xs[i]}" y="87" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${z}</text>`; s += `<text x="${xs[i]}" y="116" text-anchor="middle" font-size="9" fill="#666" font-weight="600">${위치라벨[i]}</text>`; });
    // B 행 레이블은 지지 원 위쪽에 충분히 떨어져 배치
    bJj.forEach((z, i) => { const k = ({子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'})[z]; s += `<text x="${xs[i]}" y="144" text-anchor="middle" font-size="9" fill="#666" font-weight="600">${위치라벨[i]}</text>`; s += `<circle cx="${xs[i]}" cy="180" r="20" fill="${ohC[k]||'#999'}" stroke="#e91e63" stroke-width="2"/>`; s += `<text x="${xs[i]}" y="187" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${z}</text>`; });
    bCh.forEach((g, i) => { s += `<circle cx="${xs[i]}" cy="228" r="20" fill="${ohC[요행(g)]||'#999'}" stroke="#e91e63" stroke-width="2"/>`; s += `<text x="${xs[i]}" y="235" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${g}</text>`; });
    // 연결선 파싱 (A○지|천 ↔ B○지|천 패턴)
    const parse = (str) => {
      const aM = str.match(/A([년월일시])(지|간)/); const bM = str.match(/B([년월일시])(지|간)/);
      if (!aM || !bM) return null;
      const idx = {'년':0,'월':1,'일':2,'시':3};
      const ax = xs[idx[aM[1]]], bx = xs[idx[bM[1]]];
      const ay = aM[2]==='지' ? 100 : 52;
      const by = bM[2]==='지' ? 160 : 208;
      return {ax,ay,bx,by};
    };
    // 합 (초록 곡선)
    (hc.합||[]).forEach(str => { const p = parse(str); if (p) s += `<path d="M${p.ax},${p.ay} Q${(p.ax+p.bx)/2},${(p.ay+p.by)/2} ${p.bx},${p.by}" stroke="#2e7d32" stroke-width="2" fill="none" opacity="0.75"/>`; });
    (hc.천간합||[]).forEach(str => { const p = parse(str); if (p) s += `<path d="M${p.ax},${p.ay} Q${(p.ax+p.bx)/2},${(p.ay+p.by)/2} ${p.bx},${p.by}" stroke="#2e7d32" stroke-width="2" fill="none" opacity="0.75" stroke-dasharray="1"/>`; });
    // 충 (빨강 직선)
    (hc.충||[]).forEach(str => { const p = parse(str); if (p) s += `<line x1="${p.ax}" y1="${p.ay}" x2="${p.bx}" y2="${p.by}" stroke="#c62828" stroke-width="2" stroke-dasharray="5,3" opacity="0.75"/>`; });
    // 형 (주황)
    (hc.형||[]).forEach(str => { const p = parse(str); if (p) s += `<line x1="${p.ax}" y1="${p.ay}" x2="${p.bx}" y2="${p.by}" stroke="#ef6c00" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.65"/>`; });
    return s + '</svg>';
  })();

  tables['궁합합충교차표'] = wrap(`합충 교차 분석 (${_hapSc}점)`, sub, `
<div class="card" style="text-align:center;padding:6px;">
  <div class="gauge" style="margin:4px 40px;"><div class="gauge-fill" style="width:${_hapSc}%;background:${scoreColor(_hapSc)};"></div></div>
  ${_hapDiagram}
  <div style="font-size:8pt;color:#666;margin-top:2px;">
    <span style="color:#2e7d32;">━ 합</span> &nbsp;
    <span style="color:#c62828;">⋯ 충</span> &nbsp;
    <span style="color:#ef6c00;">⋯ 형</span>
  </div>
</div>
<div class="row">
  ${(hc.천간합||[]).length ? `<div class="col card" style="margin-bottom:6px;"><div class="card-t" style="color:#2e7d32;font-size:10pt;">💎 천간합</div>${hc.천간합.slice(0,3).map(s=>`<div class="item" style="font-size:9pt;padding:2px 0;">💎 ${esc(s)}</div>`).join('')}</div>` : ''}
  ${(hc.합||[]).length ? `<div class="col card" style="margin-bottom:6px;"><div class="card-t" style="color:#2e7d32;font-size:10pt;">🟢 지지 합</div>${hc.합.slice(0,3).map(s=>`<div class="item" style="font-size:9pt;padding:2px 0;">🟢 ${esc(s)}</div>`).join('')}</div>` : ''}
</div>
<div class="row">
  ${(hc.충||[]).length ? `<div class="col card" style="margin-bottom:6px;"><div class="card-t" style="color:#c62828;font-size:10pt;">⚡ 지지 충</div>${hc.충.slice(0,3).map(s=>`<div class="item" style="font-size:9pt;padding:2px 0;">⚡ ${esc(s)}</div>`).join('')}</div>` : ''}
  ${(hc.형||[]).length ? `<div class="col card" style="margin-bottom:6px;"><div class="card-t" style="color:#ef6c00;font-size:10pt;">🔥 지지 형</div>${hc.형.slice(0,3).map(s=>`<div class="item" style="font-size:9pt;padding:2px 0;">🔥 ${esc(s)}</div>`).join('')}</div>` : ''}
</div>
${!(hc.합||[]).length && !(hc.충||[]).length && !(hc.천간합||[]).length && !(hc.형||[]).length ? '<div class="card"><div class="item">감지된 합충 반응 없음 — 독립적 흐름</div></div>' : ''}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. 인연 깊이 표 — 귀인 + 대운 타임라인 (모던 리뉴얼)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _inSc = r.점수상세['인연깊이'] || r.점수.인연깊이 || 50;
  const _in = r.항목.인연깊이 || {};
  const _in분석 = _in.분석 || [];
  const _인등급 = _inSc>=85?'최상':_inSc>=70?'상':_inSc>=55?'중상':_inSc>=40?'중':'하';
  const _인색 = _inSc>=85?'#6a1b9a':_inSc>=70?'#8e24aa':_inSc>=55?'#ab47bc':'#ba68c8';
  const _인풀 = {최상:'운명적 귀인 인연', 상:'깊이 있는 유대', 중상:'자연스러운 끌림', 중:'평범한 인연', 하:'현생에서 맺어가는 인연'}[_인등급];
  // 인연 요소 감지
  const _인요소 = [
    { key:'천을귀인',  label:'천을귀인 교차',     설명:'결정적 순간의 귀인 역할' },
    { key:'양방향',    label:'쌍방 귀인',         설명:'서로가 서로의 귀인인 드문 구조' },
    { key:'일지',      label:'일지 귀인',         설명:'배우자 자리의 귀인 작용' },
    { key:'대운',      label:'귀인 대운 교차',   설명:'대운에서 귀인 활성 시기' },
  ];
  _인요소.forEach(e => { e.감지 = _in분석.some(s => s.includes(e.key)); });
  const _인감지수 = _인요소.filter(e=>e.감지).length;

  tables['궁합인연깊이표'] = wrap('인연의 깊이', sub, `
<div class="card" style="padding:10px;">
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="text-align:center;padding:10px 14px;border:2px solid ${_인색}40;border-radius:12px;background:${_인색}08;min-width:96px;">
      <div style="font-size:26pt;font-weight:900;color:${_인색};line-height:1;">${_inSc}</div>
      <div style="font-size:9pt;color:#999;margin-top:2px;">인연 깊이</div>
      <div style="margin-top:5px;padding:2px 10px;background:${_인색};color:#fff;font-size:9pt;font-weight:700;border-radius:10px;display:inline-block;">${_인등급}</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:11pt;font-weight:700;color:${_인색};margin-bottom:4px;">${esc(_인풀)}</div>
      <div class="item" style="font-size:9pt;color:#555;padding:2px 0;">천을귀인(天乙貴人)은 사주에서 가장 귀한 인연을 뜻해요. 상대가 내 귀인 자리에 해당하면 결정적 도움이 옵니다.</div>
      <div class="gauge" style="margin-top:4px;"><div class="gauge-fill" style="width:${_inSc}%;background:linear-gradient(90deg,${_인색}dd,${_인색});"></div></div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-t" style="color:${_인색};">✦ 인연 요소 체크</div>
  <div class="grid grid-2" style="gap:5px;">
  ${_인요소.map(e => `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:${e.감지?_인색+'12':'#fafafa'};border:1px solid ${e.감지?_인색+'50':'#eee'};border-radius:8px;">
    <div style="width:22px;height:22px;border-radius:50%;background:${e.감지?_인색:'#ddd'};color:#fff;font-size:12pt;font-weight:900;text-align:center;line-height:22px;flex-shrink:0;">${e.감지?'●':'○'}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:9.5pt;font-weight:700;color:${e.감지?_인색:'#aaa'};">${esc(e.label)}</div>
      <div style="font-size:8.5pt;color:${e.감지?'#666':'#bbb'};">${esc(e.설명)}</div>
    </div>
  </div>`).join('')}
  </div>
</div>

${_in분석.length ? `<div class="card" style="background:#f3e5f5;border-color:#ce93d8;">
  <div class="card-t" style="color:${_인색};">🔮 세부 분석</div>
  ${_in분석.slice(0,5).map(s=>`<div class="item" style="font-size:9.5pt;padding:3px 0;">- ${esc(s)}</div>`).join('')}
</div>` : `<div class="card"><div class="item" style="text-align:center;color:#888;">직접 귀인 교차는 없지만, 전생의 인연보다 <b>이생에서 함께 쌓는 시간</b>이 진짜 인연을 만들어요.</div></div>`}

${((r.항목.귀인대운?.자기_A||[]).concat(r.항목.귀인대운?.상대_A가B||[]).concat(r.항목.귀인대운?.상대_B가A||[])).length ? `<div class="card"><div class="card-t">📅 귀인 대운 활성 구간</div>${[...(r.항목.귀인대운?.자기_A||[]).map(s=>({s,t:'자기'}), ),...(r.항목.귀인대운?.상대_A가B||[]).map(s=>({s,t:'A→B'})),...(r.항목.귀인대운?.상대_B가A||[]).map(s=>({s,t:'B→A'}))].slice(0,4).map(({s,t})=>`<div class="item" style="font-size:9.5pt;"><span class="tag" style="background:${_인색}20;color:${_인색};">${t}</span> ${esc(s)}</div>`).join('')}</div>` : ''}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. 갈등·사용설명서
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _convTip = (r.항목.대화스타일 && r.항목.대화스타일.조언) || '';
  tables['궁합갈등사용설명서'] = wrap('갈등 포인트 & 사용설명서', sub, `
<div class="card">
  <div class="card-t">⚡ 갈등 포인트</div>
  ${(r.항목.갈등포인트 && r.항목.갈등포인트.분석 || []).slice(0,4).map(s=>`<div class="item" style="padding:6px 0;">⚠️ ${esc(s)}</div>`).join('') || '<div class="item">특별한 구조적 갈등 없음 — 조화로운 관계</div>'}
</div>
<div class="card">
  <div class="card-t">📖 ${esc(A.이름)} 사용설명서 <span style="font-weight:400;color:#666;font-size:9pt;">· ${A.일간} · ${esc(A.신강약||'')}</span></div>
  ${(r.항목.사용설명서?.A?.일간특성 || r.항목.사용설명서?.A?.성격) ? `<div class="item" style="padding:4px 0;">- ${esc(r.항목.사용설명서.A.일간특성 || r.항목.사용설명서.A.성격)}</div>` : ''}
  ${r.항목.사용설명서?.A?.배우자궁특성 ? `<div class="item" style="padding:4px 0;">- ${esc(r.항목.사용설명서.A.배우자궁특성)}</div>` : ''}
  ${r.항목.사용설명서?.A?.격국용신 ? `<div class="item" style="padding:4px 0;color:#555;">- ${esc(r.항목.사용설명서.A.격국용신)}</div>` : ''}
</div>
<div class="card">
  <div class="card-t">📖 ${esc(B.이름)} 사용설명서 <span style="font-weight:400;color:#666;font-size:9pt;">· ${B.일간} · ${esc(B.신강약||'')}</span></div>
  ${(r.항목.사용설명서?.B?.일간특성 || r.항목.사용설명서?.B?.성격) ? `<div class="item" style="padding:4px 0;">- ${esc(r.항목.사용설명서.B.일간특성 || r.항목.사용설명서.B.성격)}</div>` : ''}
  ${r.항목.사용설명서?.B?.배우자궁특성 ? `<div class="item" style="padding:4px 0;">- ${esc(r.항목.사용설명서.B.배우자궁특성)}</div>` : ''}
  ${r.항목.사용설명서?.B?.격국용신 ? `<div class="item" style="padding:4px 0;color:#555;">- ${esc(r.항목.사용설명서.B.격국용신)}</div>` : ''}
</div>
${_convTip ? `<div class="card"><div class="card-t">💬 대화 스타일</div><div class="item">💬 ${esc(_convTip)}</div></div>` : ''}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10. 재물·자녀·시기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _jaeSc = r.점수상세['재물궁합'] || r.점수.재물궁합 || 50;
  const _janSc = r.점수상세['자녀운'] || r.점수.자녀운 || 50;
  const _daeSc = r.점수상세['대운시기'] || r.점수.대운시기 || 50;
  const _wedTip = (r.항목.결혼적기 && r.항목.결혼적기.분석 || []).slice(0,2);
  const _crisis = (r.항목.위기시기 && r.항목.위기시기.분석 || []).slice(0,2);
  // 두 사람 대운 타임라인 스트립 SVG (A 위, B 아래)
  const _tlSvg = (() => {
    const aDae = (A.대운목록 || []).slice(0, 8);
    const bDae = (B.대운목록 || []).slice(0, 8);
    const startYr = Math.min(...[...aDae, ...bDae].map(d => d.시작년도 || 9999));
    const endYr = Math.max(...[...aDae, ...bDae].map(d => (d.시작년도 || 0) + 10));
    const span = Math.max(1, endYr - startYr);
    const W = 440, H = 180;
    const yr2x = (yr) => 20 + (yr - startYr)/span * (W - 40);
    const 길흉색 = (g) => /용신|희신/.test(g||'')?'#2e7d32':/기신/.test(g||'')?'#c62828':'#90a4ae';
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;" xmlns="http://www.w3.org/2000/svg">`;
    // 현재년 세로선
    const nowX = yr2x(new Date().getFullYear());
    s += `<line x1="${nowX}" y1="10" x2="${nowX}" y2="${H-10}" stroke="#ffb300" stroke-width="2" stroke-dasharray="3,2"/>`;
    s += `<text x="${nowX}" y="8" text-anchor="middle" font-size="9" fill="#ff8f00" font-weight="700">NOW</text>`;
    // A 행
    s += `<text x="10" y="42" font-size="9" fill="#1565c0" font-weight="700">🔵 ${esc(A.이름)}</text>`;
    aDae.forEach((d, i) => {
      const x1 = yr2x(d.시작년도), x2 = yr2x(d.시작년도+10);
      const col = 길흉색(d.대운길흉);
      s += `<rect x="${x1+1}" y="50" width="${Math.max(1,x2-x1-2)}" height="30" fill="${col}" opacity="0.65" rx="3"/>`;
      s += `<text x="${(x1+x2)/2}" y="68" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">${d.간지||''}</text>`;
      s += `<text x="${(x1+x2)/2}" y="44" text-anchor="middle" font-size="10" fill="#666">${d.시작나이||''}</text>`;
    });
    // B 행
    s += `<text x="10" y="110" font-size="9" fill="#e91e63" font-weight="700">🔴 ${esc(B.이름)}</text>`;
    bDae.forEach((d, i) => {
      const x1 = yr2x(d.시작년도), x2 = yr2x(d.시작년도+10);
      const col = 길흉색(d.대운길흉);
      s += `<rect x="${x1+1}" y="118" width="${Math.max(1,x2-x1-2)}" height="30" fill="${col}" opacity="0.65" rx="3"/>`;
      s += `<text x="${(x1+x2)/2}" y="136" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">${d.간지||''}</text>`;
      s += `<text x="${(x1+x2)/2}" y="112" text-anchor="middle" font-size="10" fill="#666">${d.시작나이||''}</text>`;
    });
    // 하단 년도 눈금
    for (let y = Math.ceil(startYr/10)*10; y <= endYr; y += 10) {
      const x = yr2x(y);
      s += `<line x1="${x}" y1="156" x2="${x}" y2="160" stroke="#999" stroke-width="0.5"/>`;
      s += `<text x="${x}" y="172" text-anchor="middle" font-size="9" fill="#999">${y}</text>`;
    }
    // 범례
    s += `<rect x="270" y="4" width="10" height="6" fill="#2e7d32"/><text x="284" y="10" font-size="9" fill="#666">용·희신</text>`;
    s += `<rect x="320" y="4" width="10" height="6" fill="#c62828"/><text x="334" y="10" font-size="9" fill="#666">기신</text>`;
    s += `<rect x="360" y="4" width="10" height="6" fill="#90a4ae"/><text x="374" y="10" font-size="9" fill="#666">중립</text>`;
    return s + '</svg>';
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10-B. 신살 교차표 — 6개 신살 매트릭스 + 감지 상세
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _sinSc = r.점수상세['신살교차'] || r.점수.신살교차 || 50;
  const _sinsal = r.항목.신살교차 || {};
  const _sinList = [
    { key:'원진', icon:'💢', label:'원진살',   desc:'마음의 엇갈림·집착', color:'#c62828', type:'흉' },
    { key:'귀문', icon:'🔮', label:'귀문관살', desc:'예민·신경·육감',      color:'#6a1b9a', type:'주의' },
    { key:'역마', icon:'🚶', label:'역마살',   desc:'이동·변화·활동',      color:'#1565c0', type:'활동' },
    { key:'화개', icon:'🎭', label:'화개살',   desc:'예술·고독·종교',      color:'#7b1fa2', type:'중립' },
    { key:'양인', icon:'🗡', label:'양인살',   desc:'주도권·투쟁·강단',    color:'#c62828', type:'흉' },
    { key:'장성', icon:'👑', label:'장성살',   desc:'권위·리더십·지원',    color:'#2e7d32', type:'길' },
  ];
  // 6개 신살 카운트 집계
  const _sinCount = _sinList.map(s => ({...s, count: (_sinsal[s.key]||[]).length}));
  const _totalSin = _sinCount.reduce((a,b)=>a+b.count,0);

  // SVG 매트릭스 — 중앙 점수, 6개 신살 원형 배치 (겹침 방지 조정)
  const _sinSvg = (() => {
    const cx = 200, cy = 200, R = 115;
    const W = 400, H = 400;
    const iconR = 24;           // 아이콘 원 반지름 축소
    const labelR = R + 58;      // 라벨 거리 확대 (원 바깥 34 여유)
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:380px;" xmlns="http://www.w3.org/2000/svg">`;
    // 중앙 원 (점수)
    s += `<circle cx="${cx}" cy="${cy}" r="42" fill="#fff" stroke="${scoreColor(_sinSc)}" stroke-width="3"/>`;
    s += `<text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="24" font-weight="900" fill="${scoreColor(_sinSc)}">${_sinSc}</text>`;
    s += `<text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="9" fill="#888">점</text>`;
    s += `<text x="${cx}" y="${cy+28}" text-anchor="middle" font-size="10" fill="#666">감지 ${_totalSin}건</text>`;
    // 6개 신살을 원형 배치
    _sinCount.forEach((sn, i) => {
      const angle = -Math.PI/2 + 2*Math.PI*i/6;
      const px = cx + R*Math.cos(angle), py = cy + R*Math.sin(angle);
      const isOn = sn.count > 0;
      // 라벨 (원 바깥쪽) — 먼저 그려 아이콘 뒤로
      const lx = cx + labelR*Math.cos(angle), ly = cy + labelR*Math.sin(angle);
      s += `<text x="${lx}" y="${ly-6}" text-anchor="middle" font-size="11" font-weight="700" fill="${isOn?sn.color:'#999'}">${sn.label}</text>`;
      s += `<text x="${lx}" y="${ly+8}" text-anchor="middle" font-size="10" fill="#888">${sn.desc}</text>`;
      // 아이콘 원
      s += `<circle cx="${px}" cy="${py}" r="${iconR}" fill="${isOn?sn.color:'#f5f5f5'}" stroke="${isOn?sn.color:'#ddd'}" stroke-width="${isOn?2.5:1}" opacity="${isOn?1:0.7}"/>`;
      s += `<text x="${px}" y="${py+6}" text-anchor="middle" font-size="18">${sn.icon}</text>`;
      if (isOn) {
        // 카운트 뱃지 — 원 바깥 오른쪽 위로 배치 (겹침 방지)
        const bx = px + iconR*0.75, by = py - iconR*0.75;
        s += `<circle cx="${bx}" cy="${by}" r="10" fill="#fff" stroke="${sn.color}" stroke-width="2"/>`;
        s += `<text x="${bx}" y="${by+4}" text-anchor="middle" font-size="11" font-weight="900" fill="${sn.color}">${sn.count}</text>`;
      }
    });
    return s + '</svg>';
  })();

  tables['궁합신살교차표'] = wrap(`신살 교차 분석 (${_sinSc}점)`, sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">🎭 6대 신살 교차 매트릭스</div>
  ${_sinSvg}
  <div style="font-size:8pt;color:#666;margin-top:4px;">
    <span style="color:#2e7d32;font-weight:700;">길(긍정)</span> ·
    <span style="color:#c62828;font-weight:700;">흉(주의)</span> ·
    <span style="color:#6a1b9a;font-weight:700;">예민</span> ·
    <span style="color:#1565c0;font-weight:700;">활동</span> ·
    <span style="color:#7b1fa2;font-weight:700;">중립</span>
  </div>
</div>
${_sinCount.filter(s=>s.count>0).length ? `<div class="card"><div class="card-t">📌 감지된 신살 상세</div>${_sinCount.filter(s=>s.count>0).map(s=>`<div style="margin:5px 0;"><div style="font-size:10pt;font-weight:700;color:${s.color};">${s.icon} ${s.label} · ${s.count}건</div>${(_sinsal[s.key]||[]).slice(0,3).map(t=>`<div class="item" style="padding:2px 0 2px 18px;font-size:9pt;">· ${esc(t)}</div>`).join('')}</div>`).join('')}</div>` : `<div class="card"><div class="item" style="text-align:center;color:#2e7d32;">감지된 신살 교차 없음 — 독립적·평범한 흐름</div></div>`}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10-C. 공망 교차표
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _gmSc = r.점수상세['공망교차'] || r.점수.공망교차 || 50;
  const _gm = r.항목.공망교차 || { A메움:[], B메움:[], 공망공유:[] };
  const _aGm = [A.공망?.공망1, A.공망?.공망2].filter(Boolean);
  const _bGm = [B.공망?.공망1, B.공망?.공망2].filter(Boolean);
  tables['궁합공망교차표'] = wrap(`공망 교차 분석 (${_gmSc}점)`, sub, `
<div class="card" style="text-align:center;padding:10px;">
  <div class="card-t" style="justify-content:center;">🕳 두 사람의 공망(空亡)</div>
  <svg viewBox="0 0 360 180" width="100%" style="max-width:360px;" xmlns="http://www.w3.org/2000/svg">
    <text x="50" y="30" font-size="10" fill="#1565c0" font-weight="700">🔵 ${esc(A.이름)}</text>
    <text x="310" y="30" text-anchor="end" font-size="10" fill="#e91e63" font-weight="700">🔴 ${esc(B.이름)}</text>
    ${_aGm.map((z, i) => `<circle cx="${80+i*60}" cy="70" r="26" fill="#fce4ec" stroke="#c62828" stroke-width="2" stroke-dasharray="4,2"/><text x="${80+i*60}" y="77" text-anchor="middle" font-size="16" font-weight="900" fill="#c62828">${z}</text><text x="${80+i*60}" y="105" text-anchor="middle" font-size="9" fill="#888">공망</text>`).join('')}
    ${_bGm.map((z, i) => `<circle cx="${220+i*60}" cy="70" r="26" fill="#fce4ec" stroke="#c62828" stroke-width="2" stroke-dasharray="4,2"/><text x="${220+i*60}" y="77" text-anchor="middle" font-size="16" font-weight="900" fill="#c62828">${z}</text><text x="${220+i*60}" y="105" text-anchor="middle" font-size="9" fill="#888">공망</text>`).join('')}
    <text x="180" y="140" text-anchor="middle" font-size="10" fill="#333">${_gm.공망공유.length ? `⚠ 공망 공유 ${_gm.공망공유.length}건` : ''}</text>
    <text x="180" y="156" text-anchor="middle" font-size="10" fill="${_gm.A메움.length||_gm.B메움.length?'#2e7d32':'#999'}">${(_gm.A메움.length||_gm.B메움.length) ? `- 상호 메움: A←B ${_gm.B메움.length}건 / B←A ${_gm.A메움.length}건` : '상호 메움 없음'}</text>
  </svg>
</div>
<div class="card">
  <div class="gauge"><div class="gauge-fill" style="width:${_gmSc}%;background:${scoreColor(_gmSc)};"></div></div>
  ${_gm.A메움.length ? `<div class="card-t" style="color:#2e7d32;">🔵 ${esc(A.이름)}의 공망을 ${esc(B.이름)}이 메움</div>${_gm.A메움.slice(0,3).map(s=>`<div class="item">- ${esc(s)}</div>`).join('')}` : ''}
  ${_gm.B메움.length ? `<div class="card-t" style="color:#2e7d32;margin-top:6px;">🔴 ${esc(B.이름)}의 공망을 ${esc(A.이름)}이 메움</div>${_gm.B메움.slice(0,3).map(s=>`<div class="item">- ${esc(s)}</div>`).join('')}` : ''}
  ${_gm.공망공유.length ? `<div class="card-t" style="color:#ef6c00;margin-top:6px;">⚠ 공망 공유 (공허함 공유)</div>${_gm.공망공유.slice(0,3).map(s=>`<div class="item">⚠ ${esc(s)}</div>`).join('')}` : ''}
  ${!_gm.A메움.length && !_gm.B메움.length && !_gm.공망공유.length ? '<div class="item" style="text-align:center;">감지된 공망 교차 없음 — 각자 독립적인 결핍 구조</div>' : ''}
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10-D. 12운성 교차표 — 12운성 원형 + A·B 4위치 표시
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _unSc = r.점수상세['12운성교차'] || r.점수['12운성교차'] || 50;
  const _un = r.항목['12운성교차'] || { A본B운성:[], B본A운성:[] };
  const _un12 = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
  const _un색 = { 장생:'#4caf50', 목욕:'#fc9bdd', 관대:'#42a5f5', 건록:'#1565c0', 제왕:'#d32f2f', 쇠:'#ef6c00', 병:'#ff7043', 사:'#616161', 묘:'#757575', 절:'#9e9e9e', 태:'#ab47bc', 양:'#7b1fa2' };
  // 각 운성의 위치 원형 (12시 방향부터 시계방향)
  const _unPos = _un12.map((_, i) => {
    const angle = -Math.PI/2 + 2*Math.PI*i/12;
    return { angle, x: 180 + 100*Math.cos(angle), y: 160 + 100*Math.sin(angle) };
  });
  const _unSvg = (() => {
    let s = `<svg viewBox="0 0 360 320" width="100%" style="max-width:360px;" xmlns="http://www.w3.org/2000/svg">`;
    // 배경 큰 원
    s += `<circle cx="180" cy="160" r="100" fill="none" stroke="#e0e0e0" stroke-width="1" stroke-dasharray="2,2"/>`;
    // 12운성 원
    _un12.forEach((name, i) => {
      const p = _unPos[i];
      s += `<circle cx="${p.x}" cy="${p.y}" r="18" fill="${_un색[name]}22" stroke="${_un색[name]}" stroke-width="1.5"/>`;
      s += `<text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="9" font-weight="700" fill="${_un색[name]}">${name}</text>`;
    });
    // 중앙
    s += `<text x="180" y="156" text-anchor="middle" font-size="18" font-weight="900" fill="${scoreColor(_unSc)}">${_unSc}</text>`;
    s += `<text x="180" y="172" text-anchor="middle" font-size="10" fill="#666">점</text>`;
    // A가 본 B 4위치 파란 링
    (_un.A본B운성||[]).forEach(e => {
      const idx = _un12.indexOf(e.운성);
      if (idx < 0) return;
      const p = _unPos[idx];
      s += `<circle cx="${p.x}" cy="${p.y}" r="23" fill="none" stroke="#1565c0" stroke-width="2" opacity="0.7"/>`;
    });
    // B가 본 A 4위치 빨간 링
    (_un.B본A운성||[]).forEach(e => {
      const idx = _un12.indexOf(e.운성);
      if (idx < 0) return;
      const p = _unPos[idx];
      s += `<circle cx="${p.x}" cy="${p.y}" r="27" fill="none" stroke="#e91e63" stroke-width="2" opacity="0.7" stroke-dasharray="3,2"/>`;
    });
    // 범례
    s += `<circle cx="30" cy="300" r="8" fill="none" stroke="#1565c0" stroke-width="2"/><text x="46" y="304" font-size="10" fill="#666">🔵 ${esc(A.이름)}이 본 ${esc(B.이름)}</text>`;
    s += `<circle cx="190" cy="300" r="8" fill="none" stroke="#e91e63" stroke-width="2" stroke-dasharray="2,1"/><text x="206" y="304" font-size="10" fill="#666">🔴 ${esc(B.이름)}이 본 ${esc(A.이름)}</text>`;
    return s + '</svg>';
  })();
  tables['궁합12운성교차표'] = wrap(`12운성 교차 분석 (${_unSc}점)`, sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">🔄 12운성 순환 — 상대 일간으로 본 4위치</div>
  ${_unSvg}
</div>
<div class="row">
  <div class="col card">
    <div class="card-t" style="color:#1565c0;">🔵 ${esc(A.이름)} 일간 기준 — ${esc(B.이름)}의 4위치</div>
    ${(_un.A본B운성||[]).map(e => `<div class="item">· ${esc(e.위치||'')}: <b style="color:${_un색[e.운성]||'#333'};">${esc(e.운성||'-')}</b></div>`).join('') || '<div class="item">데이터 없음</div>'}
  </div>
  <div class="col card">
    <div class="card-t" style="color:#e91e63;">🔴 ${esc(B.이름)} 일간 기준 — ${esc(A.이름)}의 4위치</div>
    ${(_un.B본A운성||[]).map(e => `<div class="item">· ${esc(e.위치||'')}: <b style="color:${_un색[e.운성]||'#333'};">${esc(e.운성||'-')}</b></div>`).join('') || '<div class="item">데이터 없음</div>'}
  </div>
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10-D2. 지장간 암합표 — 4주 지지 + 지장간 + 암합 연결선
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _amSc = r.점수상세['지장간암합'] || r.점수.지장간암합 || 50;
  const _am = r.항목.지장간암합 || { 목록: [] };
  // 지장간 본기/중기/여기 매핑 (자평진전 기준)
  const _ji = {
    子: ['壬','','癸'], 丑: ['癸','辛','己'], 寅: ['戊','丙','甲'], 卯: ['甲','','乙'],
    辰: ['乙','癸','戊'], 巳: ['戊','庚','丙'], 午: ['丙','己','丁'], 未: ['丁','乙','己'],
    申: ['戊','壬','庚'], 酉: ['庚','','辛'], 戌: ['辛','丁','戊'], 亥: ['戊','','壬'],
  };
  const _amDiagram = (() => {
    const aJj = [A.원국.년주.지지, A.원국.월주.지지, A.원국.일주.지지, A.원국.시주.지지];
    const bJj = [B.원국.년주.지지, B.원국.월주.지지, B.원국.일주.지지, B.원국.시주.지지];
    const xs = [80, 170, 260, 350];
    const 위치라벨 = ['년주','월주','일주','시주'];
    let s = `<svg viewBox="0 0 440 280" width="100%" style="max-width:440px;" xmlns="http://www.w3.org/2000/svg">`;
    // 이름
    s += `<text x="6" y="60" font-size="10" fill="#1565c0" font-weight="700">🔵 ${esc(A.이름)}</text>`;
    s += `<text x="6" y="220" font-size="10" fill="#e91e63" font-weight="700">🔴 ${esc(B.이름)}</text>`;
    // A 4주 박스
    aJj.forEach((z, i) => {
      const x = xs[i];
      const 지오 = ({子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'})[z];
      s += `<text x="${x}" y="24" text-anchor="middle" font-size="10" fill="#666">${위치라벨[i]}</text>`;
      s += `<rect x="${x-30}" y="30" width="60" height="80" rx="6" fill="${ohC[지오]}22" stroke="${ohC[지오]}" stroke-width="2"/>`;
      s += `<text x="${x}" y="50" text-anchor="middle" font-size="18" font-weight="900" fill="${ohC[지오]}">${z}</text>`;
      // 지장간 3개
      const jg = _ji[z] || ['','',''];
      s += `<text x="${x}" y="68" text-anchor="middle" font-size="9" fill="#999">여 중 본</text>`;
      jg.forEach((g, k) => {
        if (!g) return;
        const cx_ = x - 18 + k*18;
        s += `<circle cx="${cx_}" cy="90" r="9" fill="${ohC[요행(g)]||'#ccc'}" stroke="#fff" stroke-width="1.5"/>`;
        s += `<text x="${cx_}" y="94" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">${g}</text>`;
      });
    });
    // B 4주 박스 (반전)
    bJj.forEach((z, i) => {
      const x = xs[i];
      const 지오 = ({子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'})[z];
      s += `<rect x="${x-30}" y="168" width="60" height="80" rx="6" fill="${ohC[지오]}22" stroke="${ohC[지오]}" stroke-width="2"/>`;
      const jg = _ji[z] || ['','',''];
      jg.forEach((g, k) => {
        if (!g) return;
        const cx_ = x - 18 + k*18;
        s += `<circle cx="${cx_}" cy="188" r="9" fill="${ohC[요행(g)]||'#ccc'}" stroke="#fff" stroke-width="1.5"/>`;
        s += `<text x="${cx_}" y="192" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">${g}</text>`;
      });
      s += `<text x="${x}" y="208" text-anchor="middle" font-size="9" fill="#999">여 중 본</text>`;
      s += `<text x="${x}" y="232" text-anchor="middle" font-size="18" font-weight="900" fill="${ohC[지오]}">${z}</text>`;
      s += `<text x="${x}" y="258" text-anchor="middle" font-size="10" fill="#666">${위치라벨[i]}</text>`;
    });
    // 암합 연결선 파싱
    const parseAm = (str) => {
      const aM = str.match(new RegExp(esc(A.이름)+'\\s*([년월일시])지'));
      const bM = str.match(new RegExp(esc(B.이름)+'\\s*([년월일시])지'));
      if (!aM || !bM) return null;
      const idx = {'년':0,'월':1,'일':2,'시':3};
      const 강도M = str.match(/암합\[(\S+?)\]/);
      const 강도 = 강도M ? 강도M[1] : '중';
      return { ax: xs[idx[aM[1]]], bx: xs[idx[bM[1]]], 강도 };
    };
    (_am.목록||[]).forEach(str => {
      const p = parseAm(str);
      if (!p) return;
      const w = p.강도==='강'?2.5:p.강도==='중'?1.8:1;
      const color = p.강도==='강'?'#7b1fa2':p.강도==='중'?'#9c27b0':'#ce93d8';
      s += `<path d="M${p.ax},105 Q${(p.ax+p.bx)/2},140 ${p.bx},173" stroke="${color}" stroke-width="${w}" fill="none" opacity="0.75" stroke-dasharray="${p.강도==='미약'?'3,2':''}"/>`;
    });
    return s + '</svg>';
  })();
  tables['궁합지장간암합표'] = wrap(`지장간 암합 분석 (${_amSc}점)`, sub, `
<div class="card" style="text-align:center;padding:10px;">
  <div class="card-t" style="justify-content:center;">🕊 4주 지지 속 숨은 천간의 만남</div>
  ${_amDiagram}
  <div style="font-size:8pt;color:#666;margin-top:4px;">
    <span style="color:#7b1fa2;font-weight:700;">━ 강한 연결 (핵심 기운끼리)</span> &nbsp;
    <span style="color:#9c27b0;font-weight:700;">━ 중간 연결</span> &nbsp;
    <span style="color:#ce93d8;font-weight:700;">⋯ 약한 연결</span>
  </div>
</div>
<div class="card">
  <div class="card-t">💡 감지된 암합 (총 ${(_am.목록||[]).length}건)</div>
  ${(_am.목록||[]).slice(0,6).map(s=>`<div class="item">🕊 ${esc(s)}</div>`).join('') || '<div class="item">감지된 암합 없음 — 무의식적 끌림 약함</div>'}
  ${(_am.목록||[]).length > 6 ? `<div class="item" style="font-size:8pt;color:#888;">... 외 ${(_am.목록||[]).length-6}건</div>` : ''}
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10-E. 격국 조합표 — 두 격국 큰 원 + 조합 해석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _gkSc = r.점수상세['격국매트릭스'] || r.점수.격국매트릭스 || 60;
  const _gk = r.항목.격국매트릭스 || {};
  tables['궁합격국조합표'] = wrap(`격국 조합 분석 (${_gkSc}점)`, sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">🏛 두 사람의 격국(格局)</div>
  <svg viewBox="0 0 440 200" width="100%" style="max-width:440px;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gkA" x1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3f2fd"/><stop offset="1" stop-color="#64b5f6"/></linearGradient>
      <linearGradient id="gkB" x1="0" x2="1" y2="1"><stop offset="0" stop-color="#fce4ec"/><stop offset="1" stop-color="#f48fb1"/></linearGradient>
    </defs>
    <circle cx="100" cy="100" r="70" fill="url(#gkA)" stroke="#1565c0" stroke-width="3"/>
    <text x="100" y="84" text-anchor="middle" font-size="10" fill="#0d47a1" font-weight="700">🔵 ${esc(A.이름)}</text>
    <text x="100" y="106" text-anchor="middle" font-size="13" font-weight="900" fill="#0d47a1">${esc(_gk.A격국||'—')}</text>
    <circle cx="340" cy="100" r="70" fill="url(#gkB)" stroke="#e91e63" stroke-width="3"/>
    <text x="340" y="84" text-anchor="middle" font-size="10" fill="#880e4f" font-weight="700">🔴 ${esc(B.이름)}</text>
    <text x="340" y="106" text-anchor="middle" font-size="13" font-weight="900" fill="#880e4f">${esc(_gk.B격국||'—')}</text>
    <circle cx="220" cy="100" r="30" fill="#fff" stroke="${scoreColor(_gkSc)}" stroke-width="3"/>
    <text x="220" y="96" text-anchor="middle" font-size="20" font-weight="900" fill="${scoreColor(_gkSc)}">${_gkSc}</text>
    <text x="220" y="112" text-anchor="middle" font-size="10" fill="#666">점</text>
    <path d="M 170,100 Q 195,100 190,100" stroke="#ce93d8" stroke-width="2" fill="none"/>
    <path d="M 250,100 Q 275,100 270,100" stroke="#ce93d8" stroke-width="2" fill="none"/>
    <text x="220" y="150" text-anchor="middle" font-size="12" fill="#6a1b9a" font-weight="700">${esc(_gk.조합키||'')}</text>
    <text x="220" y="176" text-anchor="middle" font-size="9" fill="#888">두 격국의 조합 에너지</text>
  </svg>
</div>
<div class="card">
  <div class="card-t">💡 격국 해석</div>
  <div class="item">🔵 <b>${esc(A.이름)}의 ${esc(_gk.A격국||'—')}</b> — 타고난 사회적 역할과 에너지 흐름의 틀입니다.</div>
  <div class="item">🔴 <b>${esc(B.이름)}의 ${esc(_gk.B격국||'—')}</b> — 타고난 사회적 역할과 에너지 흐름의 틀입니다.</div>
  <div class="item">- 두 격국이 만나 <b>${esc(_gk.조합키||'')}</b> 구조를 이룹니다. 격국 조합 점수 ${_gkSc}점은 ${_gkSc>=80?'매우 조화로운':_gkSc>=65?'조화 가능한':_gkSc>=50?'노력으로 맞춰가는':'격차가 큰'} 관계를 뜻합니다.</div>
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11-A. 세운 동적 궁합표 — 향후 3~5년 세운 흐름 타임라인
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _seSc = r.점수상세['세운동적'] || r.점수.세운동적 || 50;
  const _seFlow = (r.항목.세운동적 && r.항목.세운동적.흐름) || [];
  const _seColor = g => /용신|희신/.test(g||'')?'#2e7d32':/기신/.test(g||'')?'#c62828':'#90a4ae';
  tables['궁합세운동적표'] = wrap(`세운 동적 궁합 (${_seSc}점)`, sub, `
<div class="card" style="text-align:center;padding:10px;">
  <div class="card-t" style="justify-content:center;">🌀 향후 세운 흐름 (${_seFlow.length}년)</div>
  <svg viewBox="0 0 440 180" width="100%" style="max-width:440px;" xmlns="http://www.w3.org/2000/svg">
    <text x="8" y="44" font-size="10" fill="#1565c0" font-weight="700">🔵 ${esc(A.이름)}</text>
    <text x="8" y="118" font-size="10" fill="#e91e63" font-weight="700">🔴 ${esc(B.이름)}</text>
    ${_seFlow.map((f, i) => {
      const x = 70 + i*62;
      return `<text x="${x}" y="22" text-anchor="middle" font-size="9" fill="#333" font-weight="700">${f.년도}</text>
        <text x="${x}" y="38" text-anchor="middle" font-size="11" font-weight="900" fill="#1a237e">${f.간지}</text>
        <rect x="${x-24}" y="48" width="48" height="24" rx="4" fill="${_seColor(f.A길흉)}" opacity="0.75"/>
        <text x="${x}" y="64" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${(f.A길흉||'-').replace('세운','').replace('대운','')}</text>
        <rect x="${x-24}" y="122" width="48" height="24" rx="4" fill="${_seColor(f.B길흉)}" opacity="0.75"/>
        <text x="${x}" y="138" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${(f.B길흉||'-').replace('세운','').replace('대운','')}</text>`;
    }).join('')}
    <line x1="46" y1="90" x2="434" y2="90" stroke="#ccc" stroke-dasharray="3,3"/>
  </svg>
</div>
<div class="card">
  <div class="card-t">💡 세운 흐름 해석</div>
  ${_seFlow.map(f => {
    const both = _seColor(f.A길흉)==='#2e7d32' && _seColor(f.B길흉)==='#2e7d32';
    const both_bad = _seColor(f.A길흉)==='#c62828' && _seColor(f.B길흉)==='#c62828';
    const emoji = both?'🌟':both_bad?'⚠️':'▫️';
    return `<div class="item">${emoji} <b>${f.년도}년 ${f.간지}</b>: A=${esc(f.A길흉||'-')} · B=${esc(f.B길흉||'-')}</div>`;
  }).join('') || '<div class="item">세운 흐름 데이터 없음</div>'}
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11-B. 월운 동적 궁합표 — 올해 12개월 달력 히트맵
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _wuSc = r.점수상세['월운동적'] || r.점수.월운동적 || 50;
  const _wu = r.항목.월운동적 || { 함께좋은달:[], 함께조심달:[], 올해:[], 세운:'', 월별상세:[] };
  const _wuDet = _wu.월별상세 || [];
  // 12개월 순서: 2,3,4...12,1 (사주 새해 기준)
  const _monthOrder = [2,3,4,5,6,7,8,9,10,11,12,1];
  const _wuByMonth = new Map(_wuDet.map(d => [d.월, d]));
  const A_good = [], A_bad = [], B_good = [], B_bad = [];
  _wuDet.forEach(d => {
    if (d.A길) A_good.push(`${d.월}월`);
    if (d.A흉) A_bad.push(`${d.월}월`);
    if (d.B길) B_good.push(`${d.월}월`);
    if (d.B흉) B_bad.push(`${d.월}월`);
  });
  tables['궁합월운동적표'] = wrap(`월운 동적 궁합 — ${esc(_wu.세운||'')} 세운 (${_wuSc}점)`, sub, `
<div class="card" style="text-align:center;padding:10px;">
  <div class="card-t" style="justify-content:center;">📅 올해 12개월 — 두 사람 각자 길흉</div>
  <svg viewBox="0 0 440 220" width="100%" style="max-width:440px;" xmlns="http://www.w3.org/2000/svg">
    ${_monthOrder.map((m, i) => {
      const r_ = i % 6, c = Math.floor(i / 6);
      const x = 40 + r_*66, y = 30 + c*92;
      const d = _wuByMonth.get(m) || {};
      // 공통 배경 색 결정
      const both_good = d.A길 && d.B길;
      const both_bad = d.A흉 && d.B흉;
      const bgFill = both_good?'#2e7d32':both_bad?'#c62828':'#f5f5f5';
      const bgOpacity = both_good||both_bad ? 0.15 : 0.5;
      // A bar
      const aFill = d.A길?'#1565c0':d.A흉?'#c62828':'#bdbdbd';
      const aLabel = d.A길?'좋음':d.A흉?'조심':'보통';
      // B bar
      const bFill = d.B길?'#1565c0':d.B흉?'#c62828':'#bdbdbd';
      const bLabel = d.B길?'좋음':d.B흉?'조심':'보통';
      // 월 제목 색 강조
      const titleColor = both_good?'#2e7d32':both_bad?'#c62828':'#333';
      return `<rect x="${x}" y="${y}" width="58" height="76" rx="6" fill="${bgFill}" opacity="${bgOpacity}" stroke="${bgFill}" stroke-width="${both_good||both_bad?2:0.5}"/>
        <text x="${x+29}" y="${y+17}" text-anchor="middle" font-size="13" font-weight="900" fill="${titleColor}">${m}월</text>
        <text x="${x+29}" y="${y+29}" text-anchor="middle" font-size="9" fill="#666">${esc(d.간지||'')}</text>
        <rect x="${x+4}" y="${y+36}" width="50" height="16" rx="3" fill="${aFill}"/>
        <text x="${x+29}" y="${y+48}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">A ${aLabel}</text>
        <rect x="${x+4}" y="${y+54}" width="50" height="16" rx="3" fill="${bFill}"/>
        <text x="${x+29}" y="${y+66}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">B ${bLabel}</text>`;
    }).join('')}
    <text x="220" y="214" text-anchor="middle" font-size="10" fill="#666">
      🌟 함께 좋음 ${(_wu.함께좋은달||[]).length}개 &nbsp; ⚠ 함께 조심 ${(_wu.함께조심달||[]).length}개
    </text>
  </svg>
</div>
<div class="row">
  <div class="col card" style="background:#e3f2fd;">
    <div class="card-t" style="color:#1565c0;">🔵 ${esc(A.이름)} 좋은달 / 조심달</div>
    <div class="item" style="color:#2e7d32;">- 좋음: ${A_good.length ? A_good.join(', ') : '없음'}</div>
    <div class="item" style="color:#c62828;">⚠ 조심: ${A_bad.length ? A_bad.join(', ') : '없음'}</div>
  </div>
  <div class="col card" style="background:#fce4ec;">
    <div class="card-t" style="color:#e91e63;">🔴 ${esc(B.이름)} 좋은달 / 조심달</div>
    <div class="item" style="color:#2e7d32;">- 좋음: ${B_good.length ? B_good.join(', ') : '없음'}</div>
    <div class="item" style="color:#c62828;">⚠ 조심: ${B_bad.length ? B_bad.join(', ') : '없음'}</div>
  </div>
</div>
${(_wu.함께좋은달||[]).length || (_wu.함께조심달||[]).length ? `<div class="card"><div class="card-t">🎯 두 사람 동시 길흉</div>
  <div class="row" style="gap:10px;">
    <div class="col" style="padding:4px 2px;border-right:1px solid #eee;">
      <div style="font-size:9pt;font-weight:700;color:#2e7d32;padding:2px 0 4px;">🌟 함께 좋은달</div>
      ${(_wu.함께좋은달||[]).length ? (_wu.함께좋은달||[]).map(s=>`<div class="item" style="color:#2e7d32;font-size:9.5pt;padding:2px 0;">· ${esc(s)}</div>`).join('') : '<div class="item" style="color:#aaa;font-size:9pt;">해당 달 없음</div>'}
    </div>
    <div class="col" style="padding:4px 2px;">
      <div style="font-size:9pt;font-weight:700;color:#c62828;padding:2px 0 4px;">⚠ 함께 조심달</div>
      ${(_wu.함께조심달||[]).length ? (_wu.함께조심달||[]).map(s=>`<div class="item" style="color:#c62828;font-size:9.5pt;padding:2px 0;">· ${esc(s)}</div>`).join('') : '<div class="item" style="color:#aaa;font-size:9pt;">해당 달 없음</div>'}
    </div>
  </div>
</div>` : ''}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11-C. 천을귀인 대운 이동표
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _gwSc = r.점수상세['귀인대운'] || r.점수.귀인대운 || 50;
  const _gw = r.항목.귀인대운 || { 자기_A:[], 자기_B:[], 상대_A가B:[], 상대_B가A:[] };
  tables['궁합천을귀인대운표'] = wrap(`천을귀인 대운 이동 (${_gwSc}점)`, sub, `
<div class="card" style="text-align:center;padding:10px;">
  <div class="card-t" style="justify-content:center;">⭐ 향후 귀인 대운 카운트</div>
  <svg viewBox="0 0 360 180" width="100%" style="max-width:360px;" xmlns="http://www.w3.org/2000/svg">
    <circle cx="90" cy="90" r="50" fill="#e3f2fd" stroke="#1565c0" stroke-width="2.5"/>
    <text x="90" y="78" text-anchor="middle" font-size="9" font-weight="700" fill="#0d47a1">🔵 ${esc(A.이름)}</text>
    <text x="90" y="100" text-anchor="middle" font-size="24" font-weight="900" fill="#0d47a1">${_gw.자기_A.length + _gw.상대_B가A.length}</text>
    <text x="90" y="116" text-anchor="middle" font-size="9" fill="#1565c0">귀인 대운 건수</text>
    <circle cx="270" cy="90" r="50" fill="#fce4ec" stroke="#e91e63" stroke-width="2.5"/>
    <text x="270" y="78" text-anchor="middle" font-size="9" font-weight="700" fill="#880e4f">🔴 ${esc(B.이름)}</text>
    <text x="270" y="100" text-anchor="middle" font-size="24" font-weight="900" fill="#880e4f">${_gw.자기_B.length + _gw.상대_A가B.length}</text>
    <text x="270" y="116" text-anchor="middle" font-size="9" fill="#e91e63">귀인 대운 건수</text>
    <path d="M 140,90 Q 180,50 220,90" stroke="#ce93d8" stroke-width="2" fill="none" stroke-dasharray="3,2"/>
    <path d="M 220,90 Q 180,130 140,90" stroke="#ce93d8" stroke-width="2" fill="none" stroke-dasharray="3,2"/>
    <text x="180" y="165" text-anchor="middle" font-size="9" fill="#6a1b9a">서로가 서로의 귀인 구간을 만들어갑니다</text>
  </svg>
</div>
${_gw.상대_A가B.length ? `<div class="card"><div class="card-t" style="color:#1565c0;">🔵 ${esc(A.이름)}이 ${esc(B.이름)}의 귀인이 되는 대운</div>${_gw.상대_A가B.slice(0,4).map(s=>`<div class="item">- ${esc(s)}</div>`).join('')}</div>` : ''}
${_gw.상대_B가A.length ? `<div class="card"><div class="card-t" style="color:#e91e63;">🔴 ${esc(B.이름)}이 ${esc(A.이름)}의 귀인이 되는 대운</div>${_gw.상대_B가A.slice(0,4).map(s=>`<div class="item">- ${esc(s)}</div>`).join('')}</div>` : ''}
${_gw.자기_A.length+_gw.자기_B.length ? `<div class="card"><div class="card-t">👤 각자의 귀인 대운</div>${_gw.자기_A.slice(0,2).map(s=>`<div class="item">🔵 ${esc(s)}</div>`).join('')}${_gw.자기_B.slice(0,2).map(s=>`<div class="item">🔴 ${esc(s)}</div>`).join('')}</div>` : ''}
${!_gw.자기_A.length && !_gw.자기_B.length && !_gw.상대_A가B.length && !_gw.상대_B가A.length ? '<div class="card"><div class="item" style="text-align:center;">귀인 대운 없음 — 현생에서 인연의 힘으로 이어감</div></div>' : ''}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11-D. 12신살 교차표 — 12개 신살 원형
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _s12Sc = r.점수상세['12신살교차'] || r.점수['12신살교차'] || 50;
  const _s12 = r.항목['12신살교차'] || {};
  const _s12List = [
    { key:'겁살', icon:'⚔', color:'#c62828' },
    { key:'재살', icon:'💀', color:'#c62828' },
    { key:'천살', icon:'⚡', color:'#ef6c00' },
    { key:'지살', icon:'🌱', color:'#2e7d32' },
    { key:'년살', icon:'🌸', color:'#ec407a' },
    { key:'월살', icon:'🌙', color:'#7b1fa2' },
    { key:'망신', icon:'😶', color:'#c62828' },
    { key:'장성', icon:'👑', color:'#2e7d32' },
    { key:'반안', icon:'🎖', color:'#1565c0' },
    { key:'역마', icon:'🏃', color:'#1565c0' },
    { key:'육해', icon:'💔', color:'#c62828' },
    { key:'화개', icon:'🎨', color:'#7b1fa2' },
  ];
  tables['궁합12신살교차표'] = wrap(`12신살 교차 분석 (${_s12Sc}점)`, sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">🎭 12신살 원형 매트릭스</div>
  <svg viewBox="0 0 360 340" width="100%" style="max-width:360px;" xmlns="http://www.w3.org/2000/svg">
    <circle cx="180" cy="170" r="42" fill="#fff" stroke="${scoreColor(_s12Sc)}" stroke-width="3"/>
    <text x="180" y="168" text-anchor="middle" font-size="24" font-weight="900" fill="${scoreColor(_s12Sc)}">${_s12Sc}</text>
    <text x="180" y="184" text-anchor="middle" font-size="10" fill="#888">점</text>
    ${_s12List.map((s, i) => {
      const angle = -Math.PI/2 + 2*Math.PI*i/12;
      const R = 125;
      const x = 180 + R*Math.cos(angle), y = 170 + R*Math.sin(angle);
      const count = (_s12[s.key]||[]).length;
      const isOn = count > 0;
      return `<circle cx="${x}" cy="${y}" r="22" fill="${isOn?s.color:'#f5f5f5'}" stroke="${isOn?s.color:'#ddd'}" stroke-width="${isOn?2:1}" opacity="${isOn?1:0.6}"/>
        <text x="${x}" y="${y-1}" text-anchor="middle" font-size="14">${s.icon}</text>
        <text x="${x}" y="${y+14}" text-anchor="middle" font-size="9" font-weight="700" fill="${isOn?'#fff':'#999'}">${s.key}</text>
        ${isOn?`<circle cx="${x+18}" cy="${y-16}" r="9" fill="#fff" stroke="${s.color}" stroke-width="2"/><text x="${x+18}" y="${y-12}" text-anchor="middle" font-size="9" font-weight="900" fill="${s.color}">${count}</text>`:''}`;
    }).join('')}
  </svg>
</div>
${_s12List.filter(s=>(_s12[s.key]||[]).length).length ? `<div class="card"><div class="card-t">📌 감지된 12신살</div>${_s12List.filter(s=>(_s12[s.key]||[]).length).map(s=>`<div style="margin:3px 0;"><div style="font-size:10pt;font-weight:700;color:${s.color};">${s.icon} ${s.key} · ${(_s12[s.key]||[]).length}건</div>${(_s12[s.key]||[]).slice(0,2).map(t=>`<div class="item" style="padding:2px 0 2px 16px;font-size:9pt;">· ${esc(t)}</div>`).join('')}</div>`).join('')}</div>` : '<div class="card"><div class="item" style="text-align:center;">감지된 12신살 교차 없음</div></div>'}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11-E. 일주 궁합표
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _ijSc = r.점수상세['일주궁합'] || r.점수.일주궁합 || 50;
  const _ij = r.항목.일주궁합 || {};
  // 일주 관계 평가 뱃지
  const _ij음양뱃지 = (_ij.음양관계 === '상반') ? { 라벨:'음양 조화', 색:'#2e7d32' } : { 라벨:'같은 음양', 색:'#ef6c00' };
  const _ij오행뱃지 = _ij.오행관계 === '상생' ? { 라벨:'상생(서로 생)', 색:'#2e7d32' }
                   : _ij.오행관계 === '상극' ? { 라벨:'상극(긴장)', 색:'#c62828' }
                   : { 라벨:'비화(같은 오행)', 색:'#ef6c00' };
  const _ij일지뱃지 = ({
    '삼합':{ 라벨:'삼합(三合)', 색:'#2e7d32' },
    '반합':{ 라벨:'반합', 색:'#43a047' },
    '육합':{ 라벨:'육합', 색:'#2e7d32' },
    '충':{ 라벨:'충(沖)', 색:'#c62828' },
    '원진':{ 라벨:'원진', 색:'#ef6c00' },
    '귀문':{ 라벨:'귀문', 색:'#6a1b9a' },
    '동일':{ 라벨:'동일 지지', 색:'#90a4ae' },
    '보통':{ 라벨:'특별관계 없음', 색:'#9e9e9e' },
  })[_ij.일지관계] || { 라벨:'-', 색:'#9e9e9e' };

  tables['궁합일주궁합표'] = wrap(`일주 궁합 분석 (${_ijSc}점)`, sub, `
<div class="card" style="padding:10px;">
  <div style="display:flex;align-items:center;gap:14px;">
    <!-- 점수 카드 -->
    <div style="text-align:center;padding:10px 14px;border:2px solid ${scoreColor(_ijSc)}40;border-radius:12px;background:${scoreColor(_ijSc)}08;min-width:96px;">
      <div style="font-size:26pt;font-weight:900;color:${scoreColor(_ijSc)};line-height:1;">${_ijSc}</div>
      <div style="font-size:9pt;color:#999;margin-top:2px;">일주 궁합</div>
    </div>
    <!-- 일주 대조 -->
    <div style="flex:1;">
      <div style="display:flex;align-items:center;gap:10px;font-size:11pt;">
        <span style="color:#1565c0;font-weight:700;">🔵 ${esc(A.이름)}</span>
        <span style="font-family:'Noto Serif KR',serif;font-size:14pt;font-weight:900;color:#0d47a1;background:#e3f2fd;padding:3px 10px;border-radius:8px;">${esc(_ij.A일주||'')}</span>
        <span style="color:#999;font-size:12pt;">♡</span>
        <span style="font-family:'Noto Serif KR',serif;font-size:14pt;font-weight:900;color:#880e4f;background:#fce4ec;padding:3px 10px;border-radius:8px;">${esc(_ij.B일주||'')}</span>
        <span style="color:#e91e63;font-weight:700;">🔴 ${esc(B.이름)}</span>
      </div>
      <div class="gauge" style="margin-top:8px;"><div class="gauge-fill" style="width:${_ijSc}%;background:${scoreColor(_ijSc)};"></div></div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-t">✦ 세 가지 관계 지표</div>
  <div class="grid grid-3" style="gap:6px;">
    <div style="padding:8px;border:1px solid ${_ij음양뱃지.색}40;border-radius:8px;background:${_ij음양뱃지.색}08;">
      <div style="font-size:8.5pt;color:#888;">음양 관계</div>
      <div style="font-size:10.5pt;font-weight:700;color:${_ij음양뱃지.색};margin-top:2px;">${esc(_ij음양뱃지.라벨)}</div>
      <div style="font-size:8.5pt;color:#666;margin-top:3px;">${_ij.음양관계 === '상반' ? '양·음이 만나 자연스럽게 보완' : '같은 양 또는 같은 음 — 자극 부족'}</div>
    </div>
    <div style="padding:8px;border:1px solid ${_ij오행뱃지.색}40;border-radius:8px;background:${_ij오행뱃지.색}08;">
      <div style="font-size:8.5pt;color:#888;">오행 관계</div>
      <div style="font-size:10.5pt;font-weight:700;color:${_ij오행뱃지.색};margin-top:2px;">${esc(_ij오행뱃지.라벨)}</div>
      <div style="font-size:8.5pt;color:#666;margin-top:3px;">${_ij.오행관계 === '상생' ? '한 사람이 다른 사람을 키워주는 구조' : _ij.오행관계 === '상극' ? '견제·자극 관계 — 잘 쓰면 성장 동력' : '같은 오행 — 이해 깊으나 자극 부족'}</div>
    </div>
    <div style="padding:8px;border:1px solid ${_ij일지뱃지.색}40;border-radius:8px;background:${_ij일지뱃지.색}08;">
      <div style="font-size:8.5pt;color:#888;">일지(배우자궁)</div>
      <div style="font-size:10.5pt;font-weight:700;color:${_ij일지뱃지.색};margin-top:2px;">${esc(_ij일지뱃지.라벨)}</div>
      <div style="font-size:8.5pt;color:#666;margin-top:3px;">${_ij.일지관계 === '삼합' || _ij.일지관계 === '반합' || _ij.일지관계 === '육합' ? '결합 구조 — 함께하는 게 자연' : _ij.일지관계 === '충' ? '충돌 구조 — 각자 공간 존중 필요' : _ij.일지관계 === '원진' || _ij.일지관계 === '귀문' ? '예민한 마찰 — 감정 관리 필수' : '특별한 합충 없음'}</div>
    </div>
  </div>
</div>

${_ij.풀이 ? `<div class="card" style="background:#e8eaf6;border-color:#9fa8da;">
  <div class="card-t" style="color:#3949ab;">💡 종합 해석</div>
  <div class="item" style="font-size:9.5pt;line-height:1.55;">- ${esc(_ij.풀이)}</div>
</div>` : ''}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11-F. 결혼 주년 리듬표 (부부 전용)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _jr = r.항목.결혼주년리듬 || { 경과년: null, 주년대운: [], 주년대운_A:[], 주년대운_B:[], 주년이벤트:[] };
  if (_jr.경과년 != null || (_jr.주년대운||[]).length || (_jr.주년이벤트||[]).length) {
    const _jr_A = _jr.주년대운_A || _jr.주년대운 || [];
    const _jr_B = _jr.주년대운_B || [];
    const _jrEv = _jr.주년이벤트 || [];
    const _올해 = _jr.올해 || new Date().getFullYear();
    const _start = Math.min(_올해 - 1, ...(_jr_A.map(d=>d.년도)), ...(_jr_B.map(d=>d.년도)), ...(_jrEv.map(d=>d.년도)));
    const _end   = Math.max(_올해 + 25, ...(_jr_A.map(d=>d.년도)), ...(_jr_B.map(d=>d.년도)), ...(_jrEv.map(d=>d.년도)));
    const _span  = Math.max(20, _end - _start);
    const _x = (y) => 30 + ((y - _start) / _span) * 400;   // viewBox x: 30~430
    const _col = (g) => /용신|희신/.test(g||'') ? '#2e7d32' : /기신/.test(g||'') ? '#c62828' : '#90a4ae';
    const _isPast = (y) => y < _올해;

    tables['궁합주년리듬표'] = wrap(`결혼 주년 리듬 · ${_jr.경과년 != null ? `경과 ${_jr.경과년}년차` : ''}`, sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">💍 결혼 주년 × 두 사람 대운 흐름</div>
  <svg viewBox="0 0 460 240" width="100%" style="max-width:460px;" xmlns="http://www.w3.org/2000/svg">
    <!-- 배경 연도 눈금 -->
    ${Array.from({length: Math.ceil(_span/5)+1}, (_,i) => {
      const y = _start + i*5;
      if (y > _end) return '';
      return `<line x1="${_x(y)}" y1="40" x2="${_x(y)}" y2="200" stroke="#f0f0f0" stroke-width="1"/>
              <text x="${_x(y)}" y="214" text-anchor="middle" font-size="8" fill="#aaa">${y}</text>`;
    }).join('')}
    <!-- 오늘(올해) 마커 -->
    <line x1="${_x(_올해)}" y1="30" x2="${_x(_올해)}" y2="205" stroke="#ff9800" stroke-width="2" stroke-dasharray="3,2"/>
    <text x="${_x(_올해)}" y="24" text-anchor="middle" font-size="9" fill="#ff9800" font-weight="700">올해 ${_올해}</text>
    <!-- A 대운 트랙 (위쪽 y=60) -->
    <text x="10" y="64" font-size="9" fill="#1565c0" font-weight="700">🔵${esc(A.이름.slice(0,3))}</text>
    <line x1="30" y1="60" x2="430" y2="60" stroke="#bbdefb" stroke-width="2"/>
    ${_jr_A.map(d => {
      const x = _x(d.년도);
      const c = _col(d.길흉);
      const past = _isPast(d.년도);
      return `<circle cx="${x}" cy="60" r="${past?9:13}" fill="${c}" opacity="${past?0.4:1}" stroke="#fff" stroke-width="2"/>
              <text x="${x}" y="64" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">${esc(d.대운||'')}</text>
              <text x="${x}" y="42" text-anchor="middle" font-size="8" fill="#666">${d.년도}</text>`;
    }).join('')}
    <!-- 주년 이벤트 트랙 (가운데 y=120) -->
    <text x="10" y="124" font-size="9" fill="#e91e63" font-weight="700">💍 주년</text>
    <line x1="30" y1="120" x2="430" y2="120" stroke="#f8bbd0" stroke-width="2"/>
    ${_jrEv.map(e => {
      const x = _x(e.년도);
      const past = _isPast(e.년도);
      const hot = [10,20,25,30,50].includes(e.주년);
      const r = hot ? 15 : 11;
      return `<circle cx="${x}" cy="120" r="${r}" fill="${hot?'#e91e63':'#f06292'}" opacity="${past?0.45:1}" stroke="#fff" stroke-width="2"/>
              <text x="${x}" y="124" text-anchor="middle" font-size="${hot?10:9}" fill="#fff" font-weight="900">${e.주년}</text>
              <text x="${x}" y="102" text-anchor="middle" font-size="8" fill="#880e4f" font-weight="700">${e.주년}주년</text>`;
    }).join('')}
    <!-- B 대운 트랙 (아래쪽 y=180) -->
    <text x="10" y="184" font-size="9" fill="#e91e63" font-weight="700">🔴${esc(B.이름.slice(0,3))}</text>
    <line x1="30" y1="180" x2="430" y2="180" stroke="#fce4ec" stroke-width="2"/>
    ${_jr_B.map(d => {
      const x = _x(d.년도);
      const c = _col(d.길흉);
      const past = _isPast(d.년도);
      return `<circle cx="${x}" cy="180" r="${past?9:13}" fill="${c}" opacity="${past?0.4:1}" stroke="#fff" stroke-width="2"/>
              <text x="${x}" y="184" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">${esc(d.대운||'')}</text>
              <text x="${x}" y="202" text-anchor="middle" font-size="8" fill="#666">${d.년도}</text>`;
    }).join('')}
    <!-- 범례 -->
    <rect x="310" y="226" width="10" height="8" fill="#2e7d32"/><text x="324" y="233" font-size="8" fill="#666">용·희신</text>
    <rect x="362" y="226" width="10" height="8" fill="#c62828"/><text x="376" y="233" font-size="8" fill="#666">기신</text>
    <rect x="404" y="226" width="10" height="8" fill="#90a4ae"/><text x="418" y="233" font-size="8" fill="#666">중립</text>
  </svg>
</div>
${_jrEv.length ? `<div class="card"><div class="card-t">📆 향후 주요 주년 · 대운 조합</div>${_jrEv.filter(e=>!_isPast(e.년도)).slice(0,4).map(e=>{
  const aCol = _col(e.A길흉), bCol = _col(e.B길흉);
  const 양호 = /용신|희신/.test(e.A길흉||'') && /용신|희신/.test(e.B길흉||'');
  const 경계 = /기신/.test(e.A길흉||'') || /기신/.test(e.B길흉||'');
  const 뱃지 = 양호 ? '<span class="tag pos">함께 상승</span>' : 경계 ? '<span class="tag neg">함께 주의</span>' : '<span class="tag neu">보통</span>';
  return `<div class="item" style="display:flex;align-items:center;gap:6px;padding:4px 0;">
    <span style="font-weight:900;color:#e91e63;min-width:42px;">${e.주년}주년</span>
    <span style="color:#666;min-width:48px;">${e.년도}년</span>
    ${뱃지}
    <span style="font-size:9pt;color:${aCol};"><b>🔵</b>${esc(e.A대운||'-')} ${esc(e.A길흉||'')}</span>
    <span style="font-size:9pt;color:${bCol};"><b>🔴</b>${esc(e.B대운||'-')} ${esc(e.B길흉||'')}</span>
  </div>`;
}).join('') || '<div class="item" style="text-align:center;color:#888;">향후 기념 주년이 대운표 범위에 없습니다.</div>'}</div>` : ''}
<div class="card" style="background:#fff8e1;border-color:#ffe082;">
  <div class="card-t" style="color:#e65100;">💡 이번 단계에 어울리는 의식</div>
  ${(() => {
    const n = _jr.경과년 != null ? _jr.경과년 : -1;
    const items = [];
    if (n < 0) items.push('🎁 결혼 기간 입력 시 단계별 맞춤 의식이 제시됩니다');
    if (n >= 0 && n <= 2)  items.push('🎁 신혼 0~2년차 · 공동 통장·공동 루틴(주 1회 데이트)을 만들어 관계의 뼈대를 세우세요');
    if (n >= 3 && n <= 5)  items.push('🎁 3~5년차 · 신혼 종료 지점. 처음 함께 간 여행지를 다시 찾아 변화한 서로를 확인해보세요');
    if (n >= 5 && n <= 9)  items.push('🎁 5~9년차 · 공동 목표 재설정 시점. 5년 후 삶의 그림을 함께 그려보세요');
    if (n >= 10 && n <= 14) items.push('🎁 10주년 · 편지 교환과 공식적 재서약. 결혼식 영상 다시 보기 권장');
    if (n >= 15 && n <= 19) items.push('🎁 15~19년차 · 자녀기 중반. 부부만의 시간을 의도적으로 확보하세요');
    if (n >= 20 && n <= 24) items.push('🎁 20주년 · 중년 전환점. 향후 20년 공동 로드맵(건강·노후·재정) 수립');
    if (n >= 25 && n <= 29) items.push('🎁 은혼식(25주년) · 두 사람만의 새 취미 시작 · 가까운 친구들과 축하 자리');
    if (n >= 30 && n <= 39) items.push('🎁 30주년+ · 자녀 독립 후 부부 정체성 재정립. 함께 늙어감의 아름다움을 의식으로 남기세요');
    if (n >= 40) items.push('🎁 금혼식·다이아몬드혼 · 가족 전체가 함께하는 기념일로 승화');
    // 공통 조언 (항상 1개)
    if (n >= 0) items.push('🗝 주년마다 "우리가 맞이한 위기 1가지와 극복법"을 함께 적어 "부부 기록장"에 추가하세요');
    return items.slice(0,4).map(t=>`<div class="item">${t}</div>`).join('');
  })()}
</div>`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11-G. 건강 궁합 교차표 — 오행별 5장부 매트릭스
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _hl = r.항목.건강궁합교차 || {};
  const _jangbu = [
    { oh:'木', 장:'간·담', detail:'스트레스·간 기능·시력' },
    { oh:'火', 장:'심·소장', detail:'혈액순환·심장·흥분' },
    { oh:'土', 장:'비·위', detail:'소화·당대사·식욕' },
    { oh:'金', 장:'폐·대장', detail:'호흡·피부·면역' },
    { oh:'水', 장:'신·방광', detail:'신장·생식·수분' },
  ];
  const _aGi = A.기신, _bGi = B.기신;
  tables['궁합건강교차표'] = wrap('건강 궁합 교차 (상호 건강 영향)', sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">🏥 오행 5장부 매트릭스</div>
  <svg viewBox="0 0 440 220" width="100%" style="max-width:440px;" xmlns="http://www.w3.org/2000/svg">
    ${_jangbu.map((j, i) => {
      const x = 20 + i*84;
      const isAGi = j.oh === _aGi, isBGi = j.oh === _bGi;
      return `<rect x="${x}" y="30" width="76" height="170" rx="6" fill="${ohC[j.oh]}11" stroke="${ohC[j.oh]}" stroke-width="1.5"/>
        <text x="${x+38}" y="52" text-anchor="middle" font-size="20" font-weight="900" fill="${ohC[j.oh]}">${j.oh}</text>
        <text x="${x+38}" y="72" text-anchor="middle" font-size="9" fill="${ohC[j.oh]}">${oh[j.oh]}</text>
        <line x1="${x+6}" y1="82" x2="${x+70}" y2="82" stroke="${ohC[j.oh]}44"/>
        <text x="${x+38}" y="100" text-anchor="middle" font-size="10" font-weight="700" fill="#333">${j.장}</text>
        <text x="${x+38}" y="116" text-anchor="middle" font-size="9" fill="#666">${j.detail}</text>
        ${isAGi?`<circle cx="${x+20}" cy="150" r="10" fill="#1565c0"/><text x="${x+20}" y="154" text-anchor="middle" font-size="10" font-weight="900" fill="#fff">A</text><text x="${x+20}" y="176" text-anchor="middle" font-size="9" fill="#c62828">기신</text>`:''}
        ${isBGi?`<circle cx="${x+56}" cy="150" r="10" fill="#e91e63"/><text x="${x+56}" y="154" text-anchor="middle" font-size="10" font-weight="900" fill="#fff">B</text><text x="${x+56}" y="176" text-anchor="middle" font-size="9" fill="#c62828">기신</text>`:''}`;
    }).join('')}
  </svg>
</div>
<div class="card">
  <div class="card-t">💡 건강 궁합 분석</div>
  ${(_hl.분석||[]).slice(0,5).map(s=>`<div class="item">- ${esc(s)}</div>`).join('') || '<div class="item">건강 분석 데이터 없음</div>'}
</div>
${_hl.공통기신 ? `<div class="card" style="background:#ffebee;border-color:#ffcdd2;"><div class="card-t" style="color:#c62828;">⚠ 공통 기신 ${_hl.공통기신}(${oh[_hl.공통기신]})</div><div class="item">두 사람 모두 ${esc(_hl.A기신장기?.장||'')} 계통 주의 — 정기 검진을 함께 관리하십시오.</div></div>` : ''}`);

  tables['궁합재물시기표'] = wrap('재물·자녀·시기 분석', sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">📅 두 사람 대운 타임라인</div>
  ${_tlSvg}
</div>
<div class="row">
  <div class="col card">
    <div class="card-t">💰 재물 궁합 (${_jaeSc}점)</div>
    <div class="gauge"><div class="gauge-fill" style="width:${_jaeSc}%;background:${scoreColor(_jaeSc)};"></div></div>
    ${(r.항목.재물궁합 && r.항목.재물궁합.분석 || []).slice(0,2).map(s=>`<div class="item">💰 ${esc(s)}</div>`).join('') || '<div class="item">특별한 재물 교차 없음</div>'}
  </div>
  <div class="col card">
    <div class="card-t">👶 자녀운 (${_janSc}점)</div>
    <div class="gauge"><div class="gauge-fill" style="width:${_janSc}%;background:${scoreColor(_janSc)};"></div></div>
    ${(r.항목.자녀운 && r.항목.자녀운.분석 || []).slice(0,2).map(s=>`<div class="item">👶 ${esc(s)}</div>`).join('') || '<div class="item">분석 데이터 부족</div>'}
  </div>
</div>
<div class="card">
  <div class="card-t">📅 대운 시기 궁합 (${_daeSc}점)</div>
  <div class="gauge"><div class="gauge-fill" style="width:${_daeSc}%;background:${scoreColor(_daeSc)};"></div></div>
  ${(r.항목.대운시기 && r.항목.대운시기.분석 || []).slice(0,2).map(s=>`<div class="item">📅 ${esc(s)}</div>`).join('') || '<div class="item">평이한 흐름</div>'}
</div>
<div class="row">
  <div class="col card">
    <div class="card-t">💍 결혼생활 최적기</div>
    ${_wedTip.length ? _wedTip.map(s=>`<div class="item">${esc(s)}</div>`).join('') : '<div class="item">대운 교차 시 확인</div>'}
  </div>
  <div class="col card">
    <div class="card-t">⚠️ 위기 시기</div>
    ${_crisis.length ? _crisis.map(s=>`<div class="item">⚠️ ${esc(s)}</div>`).join('') : '<div class="item">큰 위기 구간 없음</div>'}
  </div>
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10-X. 관계 에너지 흐름 (기여 방향) — 제7절 직전 배치
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _ef = r.항목.기여방향 || { AtoB:{점수:0,비율:50,요인:[]}, BtoA:{점수:0,비율:50,요인:[]}, 라벨:'상호 균형', 차이:0, 미래반전:[] };
  const _efBarA = Math.max(5, _ef.AtoB.비율);
  const _efBarB = Math.max(5, _ef.BtoA.비율);
  const _efColA = _efBarA >= 60 ? '#1565c0' : _efBarA >= 50 ? '#42a5f5' : '#90caf9';
  const _efColB = _efBarB >= 60 ? '#e91e63' : _efBarB >= 50 ? '#f06292' : '#f8bbd0';
  tables['궁합에너지흐름표'] = wrap('관계 에너지 흐름', sub, `
<div class="card" style="text-align:center;padding:8px;">
  <div class="card-t" style="justify-content:center;">🔀 두 사람 사이 기여 방향</div>
  <svg viewBox="0 0 460 200" width="100%" style="max-width:460px;" xmlns="http://www.w3.org/2000/svg">
    <!-- A (왼쪽) -->
    <circle cx="70" cy="100" r="45" fill="#e3f2fd" stroke="#1565c0" stroke-width="3"/>
    <text x="70" y="94" text-anchor="middle" font-size="10" fill="#0d47a1" font-weight="700">🔵 ${esc(A.이름.slice(0,4))}</text>
    <text x="70" y="112" text-anchor="middle" font-size="10" fill="#0d47a1">${A.일간}(${oh[A.일간오행]||''})</text>
    <!-- B (오른쪽) -->
    <circle cx="390" cy="100" r="45" fill="#fce4ec" stroke="#e91e63" stroke-width="3"/>
    <text x="390" y="94" text-anchor="middle" font-size="10" fill="#880e4f" font-weight="700">🔴 ${esc(B.이름.slice(0,4))}</text>
    <text x="390" y="112" text-anchor="middle" font-size="10" fill="#880e4f">${B.일간}(${oh[B.일간오행]||''})</text>
    <!-- A→B 화살표 (위쪽) -->
    <defs>
      <marker id="arA" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><polygon points="0 0, 10 5, 0 10" fill="${_efColA}"/></marker>
      <marker id="arB" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><polygon points="0 0, 10 5, 0 10" fill="${_efColB}"/></marker>
    </defs>
    <line x1="120" y1="76" x2="340" y2="76" stroke="${_efColA}" stroke-width="${Math.max(2, _efBarA/10)}" marker-end="url(#arA)" opacity="0.85"/>
    <text x="230" y="68" text-anchor="middle" font-size="10" fill="${_efColA}" font-weight="700">A→B  ${_ef.AtoB.비율}%</text>
    <!-- B→A 화살표 (아래쪽) -->
    <line x1="340" y1="124" x2="120" y2="124" stroke="${_efColB}" stroke-width="${Math.max(2, _efBarB/10)}" marker-end="url(#arB)" opacity="0.85"/>
    <text x="230" y="142" text-anchor="middle" font-size="10" fill="${_efColB}" font-weight="700">B→A  ${_ef.BtoA.비율}%</text>
    <!-- 중앙 라벨 -->
    <rect x="180" y="88" width="100" height="24" rx="12" fill="#fff8e1" stroke="#ffb300" stroke-width="1.5"/>
    <text x="230" y="104" text-anchor="middle" font-size="10" fill="#e65100" font-weight="700">${esc(_ef.라벨)}</text>
    <!-- 비율 바 -->
    <rect x="30" y="165" width="400" height="14" rx="7" fill="#f5f5f5"/>
    <rect x="30" y="165" width="${Math.round(4*_ef.AtoB.비율)}" height="14" rx="7" fill="${_efColA}" opacity="0.85"/>
    <rect x="${30 + Math.round(4*_ef.AtoB.비율)}" y="165" width="${Math.round(4*_ef.BtoA.비율)}" height="14" rx="7" fill="${_efColB}" opacity="0.85"/>
    <text x="30" y="192" font-size="9" fill="#1565c0" font-weight="700">${esc(A.이름)}</text>
    <text x="430" y="192" text-anchor="end" font-size="9" fill="#e91e63" font-weight="700">${esc(B.이름)}</text>
  </svg>
</div>
<div class="row">
  <div class="col card">
    <div class="card-t" style="color:#1565c0;">🔵 ${esc(A.이름)} → ${esc(B.이름)} 요인</div>
    ${(_ef.AtoB.요인||[]).slice(0,4).map(f=>`<div class="item" style="font-size:9.5pt;"><span style="color:${f.무게>0?'#2e7d32':'#c62828'};font-weight:700;">${f.무게>0?'+':''}${f.무게}</span> <span style="color:#555;">${esc(f.항목)}</span> — ${esc(f.설명)}</div>`).join('') || '<div class="item" style="color:#888;">이 방향 기여 요인 미약</div>'}
  </div>
  <div class="col card">
    <div class="card-t" style="color:#e91e63;">🔴 ${esc(B.이름)} → ${esc(A.이름)} 요인</div>
    ${(_ef.BtoA.요인||[]).slice(0,4).map(f=>`<div class="item" style="font-size:9.5pt;"><span style="color:${f.무게>0?'#2e7d32':'#c62828'};font-weight:700;">${f.무게>0?'+':''}${f.무게}</span> <span style="color:#555;">${esc(f.항목)}</span> — ${esc(f.설명)}</div>`).join('') || '<div class="item" style="color:#888;">이 방향 기여 요인 미약</div>'}
  </div>
</div>
${_ef.미래반전.length ? `<div class="card" style="background:#fff3e0;border-color:#ffcc80;"><div class="card-t" style="color:#e65100;">🔄 미래 역할 교대 시점</div>${_ef.미래반전.map(m=>`<div class="item">· <b>${m.년도}년~</b> — ${esc(m.메모)}</div>`).join('')}</div>` : ''}
<div class="card" style="background:#f3e5f5;border-color:#ce93d8;">
  <div class="card-t" style="color:#6a1b9a;">💡 관계 유지의 열쇠</div>
  ${_ef.차이 >= 20 ? `<div class="item">- ${esc(_ef.AtoB.비율 > _ef.BtoA.비율 ? A.이름 : B.이름)}가 구조적으로 더 많이 주는 편입니다. <b>주는 쪽은 감사받을 자리를, 받는 쪽은 작은 환원 습관</b>을 만드세요.</div>` :
    _ef.차이 >= 10 ? `<div class="item">- 약간의 비대칭이 있습니다. 상대의 기여를 당연시하지 않는 <b>의식적 감사 표현</b>이 관계 온도를 결정합니다.</div>` :
    `<div class="item">- 기여 방향이 <b>상호 균형</b>입니다. 한 사람이 일방적으로 지치지 않는 구조이니 지금의 리듬을 유지하세요.</div>`}
  ${_ef.미래반전.length ? `<div class="item">- 향후 대운 전환에 따라 <b>주는 쪽과 받는 쪽이 교대</b>될 수 있습니다. 현재의 방향을 영구적인 것으로 여기지 마세요.</div>` : ''}
</div>`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11. 분리 판단표 (이혼고민 전용)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (관계정보.관계단계 === '이혼고민' && r.항목.분리판단) {
    const 분 = r.항목.분리판단;
    const 결론색 = {'분리_강한권고':'#c62828','분리_고려':'#ef6c00','유지_권고':'#2e7d32','판단_보류':'#757575','평가_어려움':'#9e9e9e'}[분.결론] || '#757575';
    tables['분리판단표'] = wrap('분리 판단표', sub, `
<div class="card" style="text-align:center;background:linear-gradient(135deg,#fafafa,#f5f5f5);border-color:${결론색}40;">
  <div style="font-size:9pt;color:#888;letter-spacing:1px;">판정</div>
  <div style="font-size:18pt;font-weight:900;color:${결론색};margin:4px 0;">${esc((분.결론||'').replace(/_/g,' · '))}</div>
  <div class="row" style="justify-content:center;gap:20px;margin-top:6px;">
    <div><div style="font-size:20pt;font-weight:900;color:#c62828;">${분.분리신호.length}</div><div class="label">분리 신호</div></div>
    <div style="font-size:16pt;color:#bdbdbd;">vs</div>
    <div><div style="font-size:20pt;font-weight:900;color:#2e7d32;">${분.유지신호.length}</div><div class="label">유지 신호</div></div>
  </div>
</div>
<div class="card" style="background:#ffebee;">
  <div class="card-t" style="color:#c62828;"><span class="ico">🚨</span>분리 신호</div>
  ${분.분리신호.slice(0,4).map(s=>`<div class="item">- ${esc(s)}</div>`).join('') || '<div class="item">없음 — 구조적 분리 요인 없음</div>'}
</div>
<div class="card" style="background:#e8f5e9;">
  <div class="card-t" style="color:#2e7d32;"><span class="ico">🕊</span>유지 신호</div>
  ${분.유지신호.slice(0,4).map(s=>`<div class="item">- ${esc(s)}</div>`).join('') || '<div class="item">없음 — 복원 장치 미약</div>'}
</div>
${분.미래회복 ? `<div class="card" style="background:#fff3e0;"><div class="card-t" style="color:#ef6c00;"><span class="ico">🌅</span>복원 시점</div><div class="item">${분.미래회복.년도}년경 동반 용신 대운 도래</div></div>` : ''}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 12. 재결합 가능성표 (별거 전용)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (관계정보.관계단계 === '별거' && r.항목.재결합가능성) {
    const 재 = r.항목.재결합가능성;
    const 재색 = 재.점수>=75?'#2e7d32':재.점수>=55?'#1565c0':재.점수>=40?'#ef6c00':'#c62828';
    tables['재결합가능성표'] = wrap('재결합 가능성 · 복원 지수', sub, `
<div class="card" style="text-align:center;">
  ${donutChart(재.점수, `복원 지수 · ${재.등급}`, 재색)}
</div>
<div class="card" style="background:#e8f5e9;">
  <div class="card-t" style="color:#2e7d32;"><span class="ico">➕</span>복원 긍정 요소</div>
  ${재.긍정.slice(0,4).map(s=>`<div class="item">- ${esc(s)}</div>`).join('') || '<div class="item">뚜렷한 긍정 요소 없음</div>'}
</div>
<div class="card" style="background:#ffebee;">
  <div class="card-t" style="color:#c62828;"><span class="ico">➖</span>복원 저해 요소</div>
  ${재.부정.slice(0,4).map(s=>`<div class="item">- ${esc(s)}</div>`).join('') || '<div class="item">뚜렷한 저해 요소 없음</div>'}
</div>
${재.복원시점 ? `<div class="card" style="background:#e3f2fd;"><div class="card-t" style="color:#0d47a1;"><span class="ico">🎯</span>복원 타이밍</div><div class="item">${재.복원시점.년도}년경 두 사람 동반 용신 대운 도래</div></div>` : ''}`, { score: 재.점수 });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 13. 블렌디드 패밀리표 (재혼준비·재혼 전용)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if ((관계정보.관계단계 === '재혼준비' || 관계정보.관계단계 === '재혼') && r.항목.블렌디드패밀리) {
    const bp = r.항목.블렌디드패밀리;
    tables['블렌디드패밀리표'] = wrap('블렌디드 패밀리 가이드', sub, `
<div class="card" style="background:linear-gradient(135deg,#e1bee7,#ce93d8);color:#4a148c;">
  <div style="text-align:center;font-size:11pt;font-weight:900;">재혼 가정 · Blended Family</div>
  <div style="text-align:center;font-size:8pt;margin-top:2px;opacity:0.9;">전혼 경험을 자산으로</div>
</div>
<div class="card">
  <div class="card-t"><span class="ico">👨‍👩‍👧</span>자녀궁(시주) 교차</div>
  <div class="row" style="justify-content:center;">
    <div class="chip" style="background:${ohC[Object.keys(oh).find(k=>oh[k]===bp.시주오행_A)]||'#f5f5f5'}20;">
      <div style="font-size:8pt;">${esc(A.이름)}</div>
      <div style="font-size:12pt;font-weight:900;">${esc(bp.시주오행_A)}</div>
    </div>
    <div class="chip" style="background:${ohC[Object.keys(oh).find(k=>oh[k]===bp.시주오행_B)]||'#f5f5f5'}20;">
      <div style="font-size:8pt;">${esc(B.이름)}</div>
      <div style="font-size:12pt;font-weight:900;">${esc(bp.시주오행_B)}</div>
    </div>
  </div>
  ${bp.분석.map(s=>`<div class="item">- ${esc(s)}</div>`).join('')}
</div>
<div class="card">
  <div class="card-t"><span class="ico">🔑</span>5대 통합 원칙</div>
  <div class="item">① 전혼 자녀에게 새 부모 강요 금지</div>
  <div class="item">② 자녀 간 공평성 엄수 (작은 편애도 위험)</div>
  <div class="item">③ 훈육은 친부모, 새 부모는 애정</div>
  <div class="item">④ 과거 배우자 비난 금지</div>
  <div class="item">⑤ 통합에 2~3년 예상 (서두름 금물)</div>
</div>`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 14. 첫 만남 가이드표 (썸 전용)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (관계정보.관계단계 === '썸' && r.항목.첫만남가이드) {
    const 첫 = r.항목.첫만남가이드;
    const 방위맵 = {木:'동',火:'남',土:'중앙',金:'서',水:'북'};
    const 시간맵 = {木:'새벽~오전',火:'정오 전후',土:'사이 시간',金:'늦은 오후',水:'저녁~밤'};
    tables['첫만남가이드표'] = wrap('첫 만남 가이드', sub, `
<div class="card" style="background:linear-gradient(135deg,#b3e5fc,#81d4fa);color:#01579b;text-align:center;">
  <div style="font-size:11pt;font-weight:900;">💫 썸에서 연인으로</div>
  <div style="font-size:8pt;margin-top:2px;opacity:0.9;">사주로 설계하는 첫 만남</div>
</div>
<div class="card">
  <div class="card-t"><span class="ico">🧭</span>용신 방위 추천</div>
  <div class="row">
    <div class="col chip" style="background:${ohC[첫.공통용신||첫.A용신||'木']}15;">
      <div class="label">${esc(A.이름)}</div>
      <div style="font-size:10pt;font-weight:900;">${esc(첫.A용신||'—')}</div>
      <div style="font-size:9pt;">${방위맵[Object.keys(oh).find(k=>oh[k]===첫.A용신)]||'—'} 방위</div>
    </div>
    <div class="col chip" style="background:${ohC[첫.B용신||'水']}15;">
      <div class="label">${esc(B.이름)}</div>
      <div style="font-size:10pt;font-weight:900;">${esc(첫.B용신||'—')}</div>
      <div style="font-size:9pt;">${방위맵[Object.keys(oh).find(k=>oh[k]===첫.B용신)]||'—'} 방위</div>
    </div>
  </div>
  ${첫.공통용신 ? `<div class="item" style="margin-top:6px;color:#2e7d32;font-weight:700;">⭐ 공통 용신! ${oh[첫.공통용신]} 방위 적극 활용</div>` : ''}
</div>
<div class="card">
  <div class="card-t"><span class="ico">⏰</span>유리한 시간대</div>
  <div class="item">- ${esc(A.이름)}: ${시간맵[첫.A용신]||'—'}</div>
  <div class="item">- ${esc(B.이름)}: ${시간맵[첫.B용신]||'—'}</div>
</div>
<div class="card" style="background:#fff3e0;">
  <div class="card-t" style="color:#e65100;"><span class="ico">⚠</span>피해야 할 것</div>
  ${첫.주의방위 ? `<div class="item">- 공통 기신: ${esc(첫.주의방위)} (${oh[첫.주의방위]} 방위·음식 회피)</div>` : '<div class="item">공통 기신 없음 — 장소 선택 자유</div>'}
</div>`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 15. 결혼 주년 리듬표 (부부 전용)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (관계정보.관계단계 === '부부' && r.항목.결혼주년리듬) {
    const 주 = r.항목.결혼주년리듬;
    tables['주년리듬표'] = wrap('결혼 주년 · 대운 리듬', sub, `
<div class="card" style="background:linear-gradient(135deg,#fff3e0,#ffe0b2);text-align:center;">
  <div style="font-size:10pt;color:#bf360c;font-weight:700;">결혼 ${주.경과년 ?? '?'}년차</div>
  <div style="font-size:8pt;color:#6d4c41;margin-top:2px;">10년 단위 대운과 주년의 교차 흐름</div>
</div>
<div class="card">
  <div class="card-t"><span class="ico">📆</span>향후 대운 전환 포인트</div>
  <div class="timeline">
    ${(주.주년대운||[]).slice(0,5).map(d => {
      const 태그색 = /용신|희신/.test(d.길흉) ? '#2e7d32' : /기신/.test(d.길흉) ? '#c62828' : '#757575';
      const 태그 = /용신|희신/.test(d.길흉) ? '용신 ✓' : /기신/.test(d.길흉) ? '기신 ⚠' : '중립';
      return `<div class="tl-item">
        <div style="font-size:9pt;font-weight:700;">${d.년도}년 · 결혼 ${d.결혼주년>=0?d.결혼주년:'?'}년차</div>
        <div style="font-size:8pt;color:#666;">대운 ${esc(d.대운)} <span class="tag" style="background:${태그색}20;color:${태그색};">${태그}</span></div>
      </div>`;
    }).join('') || '<div class="item">관계기간개월 정보 필요</div>'}
  </div>
</div>
<div class="card">
  <div class="card-t"><span class="ico">🎉</span>주년별 기념 권장</div>
  <div class="item">5년: 여행 기념</div>
  <div class="item">10년: 공동 목표 리셋</div>
  <div class="item">15년: 부부 시간 확보</div>
  <div class="item">20년: 건강·재정 재설계</div>
  <div class="item">25년: 은혼식 · 장기 계획</div>
</div>`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 16. 잠자리 궁합표 (방사)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (r.항목.잠자리궁합 && 관계정보.관계단계 !== '별거') {
    const 잠 = r.항목.잠자리궁합;
    const 잠점 = r.점수.잠자리궁합;
    const 잠색 = 잠점>=75?'#c2185b':잠점>=55?'#e91e63':'#ec407a';
    const 호응등급 = 잠.성호응도>=85?'최상':잠.성호응도>=70?'상':잠.성호응도>=55?'중':'하';

    const 잠등급풀 = {최상:'말 없어도 통하는 호흡', 상:'자연스러운 끌림', 중:'분위기·대화로 조율', 하:'신중한 배려 필요'}[호응등급];
    const 에너지해설 = (v, 음양) => {
      const 강도 = v>=70 ? '강함' : v>=50 ? '보통' : v>=30 ? '약함' : '매우 약함';
      const 음양설명 = 음양==='양' ? '적극·주도' : '수용·섬세';
      return `${강도} / ${음양설명}(${음양})`;
    };
    const 스타일해설 = {
      '적극': '먼저 다가서는 표현형',
      '절제': '분위기·타이밍 중시',
      '욕구강': '빈도·강도 높게 필요',
      '신중': '꾸준하고 안정적인 리듬',
      '균형': '상황에 따라 유연하게 변주',
    };
    const 용신시간 = { '木':'새벽 3~7시', '火':'오전 9~13시', '土':'환절기 시간대', '金':'오후 3~7시', '水':'밤 9시~새벽 1시' };
    tables['잠자리궁합표'] = wrap('잠자리 궁합 · 房事', sub, `
<div class="card" style="padding:10px;">
  <div style="display:flex;align-items:center;gap:14px;">
    <!-- 점수 카드 -->
    <div style="text-align:center;padding:10px 14px;border:2px solid ${잠색}40;border-radius:12px;background:${잠색}08;min-width:96px;">
      <div style="font-size:26pt;font-weight:900;color:${잠색};line-height:1;">${잠점}</div>
      <div style="font-size:9pt;color:#999;margin-top:2px;">방사 궁합</div>
      <div style="margin-top:5px;padding:2px 10px;background:${잠색};color:#fff;font-size:9pt;font-weight:700;border-radius:10px;display:inline-block;">${호응등급}</div>
    </div>
    <!-- 해설 -->
    <div style="flex:1;">
      <div style="font-size:11pt;font-weight:700;color:${잠색};margin-bottom:4px;">${esc(잠등급풀)}</div>
      <div class="item" style="font-size:9pt;color:#555;padding:2px 0;">- 성 에너지 평균: ${Math.round((잠.A성에너지+잠.B성에너지)/2)} · 호응도: ${잠.성호응도}</div>
      <div class="gauge" style="margin-top:4px;"><div class="gauge-fill" style="width:${잠점}%;background:linear-gradient(90deg,${잠색}dd,${잠색});"></div></div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-t"><span class="ico">⚡</span>두 사람의 성 에너지</div>
  <div class="item" style="font-size:8.5pt;color:#888;padding:2px 0 6px;">명리학에서 일간의 음양·일지의 결합으로 본 성적 에너지 강도예요. 양(陽)=적극·주도, 음(陰)=수용·섬세.</div>
  <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
    <div style="min-width:78px;color:#1565c0;font-weight:700;font-size:9.5pt;">🔵 ${esc(A.이름)}</div>
    <div class="gauge" style="flex:1;margin:0;"><div class="gauge-fill" style="width:${잠.A성에너지}%;background:${잠색};"></div></div>
    <div style="min-width:32px;text-align:right;font-weight:900;color:${잠색};font-size:10.5pt;">${잠.A성에너지}</div>
  </div>
  <div class="item" style="font-size:9pt;color:#666;padding:0 0 4px 84px;">${에너지해설(잠.A성에너지, 잠.A일간음양)}</div>
  <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
    <div style="min-width:78px;color:#e91e63;font-weight:700;font-size:9.5pt;">🔴 ${esc(B.이름)}</div>
    <div class="gauge" style="flex:1;margin:0;"><div class="gauge-fill" style="width:${잠.B성에너지}%;background:${잠색};"></div></div>
    <div style="min-width:32px;text-align:right;font-weight:900;color:${잠색};font-size:10.5pt;">${잠.B성에너지}</div>
  </div>
  <div class="item" style="font-size:9pt;color:#666;padding:0 0 4px 84px;">${에너지해설(잠.B성에너지, 잠.B일간음양)}</div>
</div>

<div class="row">
  <div class="col card">
    <div class="card-t"><span class="ico">💞</span>상호 호응도</div>
    <div style="text-align:center;padding:4px 0;">
      <div style="font-size:22pt;font-weight:900;color:${잠색};line-height:1;">${잠.성호응도}</div>
      <div style="font-size:9pt;color:#888;margin:2px 0;">일지 합·충·천간합 종합</div>
    </div>
    <div class="gauge" style="height:10px;margin:4px 0 0;"><div class="gauge-fill" style="width:${잠.성호응도}%;background:${잠색};"></div></div>
  </div>
  <div class="col card">
    <div class="card-t"><span class="ico">🎭</span>표현 스타일</div>
    <div class="item" style="padding:3px 0;font-size:9.5pt;"><b style="color:#1565c0;">🔵 ${esc(A.이름)}</b> · <span style="color:${잠색};font-weight:700;">${esc(잠.A스타일)}</span></div>
    <div class="item" style="padding:0 0 4px 0;font-size:8.5pt;color:#777;">- ${esc(스타일해설[잠.A스타일]||'')}</div>
    <div class="item" style="padding:3px 0;font-size:9.5pt;"><b style="color:#e91e63;">🔴 ${esc(B.이름)}</b> · <span style="color:${잠색};font-weight:700;">${esc(잠.B스타일)}</span></div>
    <div class="item" style="padding:0 0 4px 0;font-size:8.5pt;color:#777;">- ${esc(스타일해설[잠.B스타일]||'')}</div>
  </div>
</div>

<div class="card" style="background:#fff5f7;border-color:#f8bbd0;">
  <div class="card-t" style="color:${잠색};"><span class="ico">🌙</span>용신 시간대 · 침실 비방</div>
  <div class="item" style="font-size:9.5pt;"><b>🔵 ${esc(A.이름)} 용신 시간:</b> ${oh[A.용신]||'-'}(${A.용신||'-'}) · ${용신시간[A.용신]||'-'}</div>
  <div class="item" style="font-size:9.5pt;"><b>🔴 ${esc(B.이름)} 용신 시간:</b> ${oh[B.용신]||'-'}(${B.용신||'-'}) · ${용신시간[B.용신]||'-'}</div>
  <div class="item" style="font-size:9pt;color:#666;padding-top:4px;">침실 방위는 공동 용신 방위에 침대 머리맡을 두면 기운이 조화롭게 흐릅니다.</div>
</div>`, { score: 잠점 });
  }

  // ── 저장 ──
  for (const [name, html] of Object.entries(tables)) {
    const outFile = path.join(outDir, `${name}.html`);
    fs.writeFileSync(outFile, html, 'utf-8');
    console.log(`  ✅ ${name}.html  (${Buffer.byteLength(html,'utf-8').toLocaleString()}B)`);
  }

  console.log(`\n✅ 궁합표 ${Object.keys(tables).length}개 생성 완료 → ${outDir}`);
  return { tables, result: r };
}

// CLI
if (require.main === module) {
  const outDir = path.join(__dirname, 'queue', 'test_compatibility');
  generate(
    {이름:'정종욱',성별:'남',음력입력:true,음력년:1966,음력월:7,음력일:7,시간:'묘시',윤달:false},
    {이름:'임효원',성별:'여',음력입력:true,음력년:1968,음력월:2,음력일:1,시간:'묘시',윤달:false},
    outDir
  );
}

module.exports = { generate };
