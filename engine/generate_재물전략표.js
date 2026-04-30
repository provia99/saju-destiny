#!/usr/bin/env node
// generate_재물전략표.js
// 용신/기신/신강약/재성 유무 기반 재물 전략 가이드 (5행)
// 입력: queue/{slot}_ch03.json + queue/{slot}_ch08.json
// 출력: tables/{slot}/재물전략표.html
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
  const d3 = loadJSON(`${slotId}_ch03.json`);
  const d8 = loadJSON(`${slotId}_ch08.json`);
  // saju_calc 단일 소스 보강 — d3/d8 빈 필드 자동 채움
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d3, d8); } catch(e){}
  if (!d3['이름'] && !d3['user_name']) { console.log('⚠️ 재물전략표: ch03.json 없음 (스킵)'); return; }

  const name = d3['이름'] || d3['user_name'] || slotId;
  const ilju = d3['일주한자'] || d3['일주'] || '';
  const 용신오행 = d3['용신한자'] || d8['용신한자'] || '';
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

  const 존재십성 = new Set(십성배치.map(s => s.십성명));
  const has편재 = 존재십성.has('편재');
  const has정재 = 존재십성.has('정재');
  const has재성 = has편재 || has정재;
  const is신강 = 신강약.includes('신강');

  // 대운목록 파싱 (ch08 텍스트에서 용신/기신 대운 추출)
  const 대운텍스트 = d8['대운목록_10기'] || '';
  const 용신대운들 = [];
  const 기신대운들 = [];
  대운텍스트.split('\n').forEach(line => {
    // 형식: "7기 丁未(정미) | 68-77세 | 2036년~ | 쇠 | 용신대운 | ..."
    const m = line.match(/^\d+기\s+(.+?)\s*\|\s*(\d+-\d+세)\s*\|.*?\|\s*\S+\s*\|\s*(\S+대운)/);
    if (!m) return;
    const 간지 = m[1].trim();
    const 나이범위 = m[2].trim();
    const 성격 = m[3].trim();
    if (성격 === '용신대운' || 성격 === '희신대운') 용신대운들.push(`${간지}(${나이범위})`);
    if (성격 === '기신대운') 기신대운들.push(`${간지}(${나이범위})`);
  });
  const 용신시기 = 용신대운들.join(', ') || '없음';
  const 기신시기 = 기신대운들.join(', ') || '없음';

  // --- 5개 전략 항목 ---

  // 1. 저축
  const 저축 = {
    추천: is신강
      ? (has재성 ? '공격적 저축 + 투자 병행' : '소득의 30% 이상 강제 저축')
      : (has재성 ? '안정적 적금·정기예금 중심' : '소액이라도 꾸준한 자동이체 저축'),
    행동: is신강
      ? '월급날 자동이체 설정, 비상금 6개월분 확보 후 나머지 투자 전환'
      : '적금·CMA 활용, 원금 보장형 위주, 비상금 12개월분 확보',
    주의: is신강
      ? '과신으로 저축 없이 전액 투자하는 것은 위험'
      : '저축만 하고 투자를 전혀 안 하면 물가 상승에 뒤처짐',
  };

  // 2. 투자
  const 투자 = {
    추천: is신강
      ? (has편재 ? '적극적 투자(주식·부동산·사업)' : '분산 투자(ETF·펀드 중심)')
      : (has정재 ? '안정형 투자(채권·배당주)' : '소액 분산, 원금 보장형 우선'),
    행동: is신강
      ? '용신 대운 시기에 비중 확대, 전문가 자문 활용, 해외 분산'
      : '적립식 펀드, 배당 ETF, 부동산 간접투자(리츠) 소액 시작',
    주의: is신강
      ? `기신대운(${기신시기}) 시 레버리지·고위험 투자 절대 자제`
      : '남의 말에 휘둘려 목돈 투자하지 말 것, 빚 투자 금지',
  };

  // 3. 소비관리
  const 소비 = {
    추천: is신강
      ? (has재성 ? '계획적 소비, 큰 지출은 용신시기에' : '가계부 필수, 충동구매 방지 시스템')
      : (has재성 ? '꼼꼼한 비교 소비, 할인·적립 활용' : '최소한의 고정비 유지, 불필요 구독 정리'),
    행동: '월 예산 책정 후 카테고리별 한도 설정, 큰 지출은 48시간 대기 규칙 적용',
    주의: is신강
      ? '과시 소비·접대비 과다 주의, 사업 확장에 따른 무분별 지출'
      : '스트레스성 소비·감정적 쇼핑 주의, 소액 누적 지출 관리',
  };

  // 4. 보험
  const 보험 = {
    추천: is신강
      ? '실손보험 + 중대질병 + 사업자 배상책임보험'
      : '실손보험 + 암보험 + 연금보험(노후 대비)',
    행동: '보장성 보험 우선 가입, 저축성 보험은 후순위, 보험료는 소득의 5~7%',
    주의: is신강
      ? '사업 리스크 대비 배상책임·화재보험 필수, 과잉 보험은 낭비'
      : '보험에 지나치게 의존하지 말 것, 건강 관리가 최고의 보험',
  };

  // 5. 재물 타이밍
  const 타이밍 = {
    추천: `용신/희신 대운: ${용신시기}`,
    행동: '용신 대운 시작 2년 전부터 준비, 종자돈 확보, 인맥 구축. 대운 교체기(전후 2년)에는 관망',
    주의: `기신 대운(${기신시기}) 시 보수적 운영, 신규 사업·큰 투자 자제, 기존 자산 보전 우선`,
  };

  const rows = [
    { 항목:'💰 저축', icon:'', ...저축 },
    { 항목:'📈 투자', icon:'', ...투자 },
    { 항목:'🛒 소비관리', icon:'', ...소비 },
    { 항목:'🛡️ 보험', icon:'', ...보험 },
    { 항목:'⏰ 재물 타이밍', icon:'', ...타이밍 },
  ];

  const rowsHTML = rows.map((r, i) => {
    const bg = i % 2 === 0 ? '#fafafa' : '#ffffff';
    return `<tr style="background:${bg};">
      <td style="font-weight:800;color:#1a3a6a;white-space:nowrap;">${esc(r.항목)}</td>
      <td style="font-weight:700;">${esc(r.추천)}</td>
      <td>${esc(r.행동)}</td>
      <td style="color:#c62828;font-size:10pt;">${esc(r.주의)}</td>
    </tr>`;
  }).join('');

  const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>재물전략표 》 ${esc(name)}님</title>
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
table{width:100%;border-collapse:collapse;font-size:10px;}
th{background:#1a3a6a;color:white;padding:5px 6px;font-size:11px;font-weight:700;text-align:left;}
td{border-bottom:1px solid #eee;padding:5px 6px;vertical-align:top;line-height:1.5;}
tr:last-child td{border-bottom:none;}
.note{font-size:8.5pt;color:#888;margin-top:4px;padding:4px 8px;background:#f9f9f9;border-radius:4px;}
</style>
</head><body><div class="page">

<div class="banner-hdr" style="background:linear-gradient(135deg,#e65100,#f57c00);">
  <div>
    <div class="banner-hdr-title">재물전략표</div>
    <div class="banner-hdr-sub">용신·기신·신강약·재성 기반 재물 전략 가이드</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">일주 ${esc(ilju)} · ${esc(신강약)} · 용신 ${esc(용신오행)} · 재성 ${has재성 ? (has편재&&has정재?'편재+정재':has편재?'편재':'정재') : '부재'}</div>
  </div>
</div>

<table>
<thead><tr>
  <th>전략 항목</th><th>추천 방향</th><th>구체적 행동</th><th>주의사항</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>

<div class="note">
  ※ 용신 대운 시기에 재물 활동을 집중하고, 기신 대운 시기에는 보수적으로 관리하세요.<br>
  ※ 재성 부재 시 재물 기반이 약하므로 안정적 수입원 확보가 최우선입니다.
</div>

</div></body></html>`;

  const outDir = path.join(TABLES_DIR, slotId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, '재물전략표.html');
  require('./_guards').safeWriteHtml(outFile, HTML, { 이름: name }, '재물전략표');
  console.log(`✅ 재물전략표 생성: ${outFile}  (${Buffer.byteLength(HTML,'utf-8').toLocaleString()}B)`);
}

const slotId = process.argv[2];
if (!slotId) { console.error('사용법: node generate_재물전략표.js <slot_id>'); process.exit(1); }
generate(slotId);
