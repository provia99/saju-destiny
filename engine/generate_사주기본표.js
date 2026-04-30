#!/usr/bin/env node
/**
 * generate_사주기본표.js  v3  》 A4 604×820px 정밀 맞춤
 * ──────────────────────────────────────────────────────
 * node generate_사주기본표.js <slot_id>
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS } = require('./font_config');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

// ══ 오행 팔레트 ═══════════════════════════════════════
const OH = {
  wood:  { main:'#1e6b2a', mid:'#2d9e3e', light:'#e8f7ec', pale:'#f3fcf5',
            border:'#a8dbb5', text:'#145020',
            grad:'linear-gradient(135deg,#1e6b2a,#3ab54a)',
            badge:'#d4f0db', badgeText:'#145020', bar:'#36b54a' },
  fire:  { main:'#b92e27', mid:'#d9534f', light:'#fde8e7', pale:'#fff5f5',
            border:'#f5a9a5', text:'#8b0000',
            grad:'linear-gradient(135deg,#b92e27,#e05a55)',
            badge:'#fdd9d7', badgeText:'#8b0000', bar:'#e05a55' },
  earth: { main:'#9b6f00', mid:'#c99400', light:'#fff8e0', pale:'#fffdf4',
            border:'#f0d470', text:'#7a5200',
            grad:'linear-gradient(135deg,#9b6f00,#c9a200)',
            badge:'#fcedc2', badgeText:'#7a5200', bar:'#c9a200' },
  metal: { main:'#3d4f5c', mid:'#5a7080', light:'#eef1f4', pale:'#f7f9fa',
            border:'#b0c4d0', text:'#2c3e50',
            grad:'linear-gradient(135deg,#3d4f5c,#607080)',
            badge:'#dce6ec', badgeText:'#2c3e50', bar:'#607080' },
  water: { main:'#1a4e7a', mid:'#2874a6', light:'#e3eef9', pale:'#f0f6ff',
            border:'#90bfe0', text:'#0d3558',
            grad:'linear-gradient(135deg,#1a4e7a,#2e86c1)',
            badge:'#c8e0f4', badgeText:'#0d3558', bar:'#2874a6' },
};
function ohKey(v) {
  if (!v) return null;
  const m={wood:'wood',木:'wood',목:'wood',fire:'fire',火:'fire',화:'fire',
           earth:'earth',土:'earth',토:'earth',metal:'metal',金:'metal',금:'metal',
           water:'water',水:'water',수:'water'};
  if(m[v]) return m[v]; return m[String(v).charAt(0)]||null;
}
function oh(v){ return OH[ohKey(v)]||OH.metal; }
const OH_HAN={wood:'木(목)',fire:'火(화)',earth:'土(토)',metal:'金(금)',water:'水(수)'};
function ohHan(v){ const k=ohKey(v); return k?OH_HAN[k]:(v||'—'); }

// ══ 십성 뱃지 ════════════════════════════════════════
const SS={
  '비견':{bg:'#dbeafe',c:'#1e40af'},'겁재':{bg:'#fce7f3',c:'#9d174d'},
  '식신':{bg:'#dcfce7',c:'#166534'},'상관':{bg:'#fef9c3',c:'#854d0e'},
  '편재':{bg:'#f3e8ff',c:'#6b21a8'},'정재':{bg:'#ccfbf1',c:'#065f46'},
  '편관':{bg:'#ffe4e6',c:'#9f1239'},'정관':{bg:'#e0f2fe',c:'#075985'},
  '편인':{bg:'#fef3c7',c:'#92400e'},'정인':{bg:'#ecfdf5',c:'#065f46'},
  '일원(나)':{bg:'#fef08a',c:'#713f12'},
};
function ssBadge(s,small){
  if(!s) return '';
  const col=SS[s]||{bg:'#f1f5f9',c:'#475569'};
  const sz=small?'7pt':'7.5pt';
  const px=small?'2px 6px':'2px 7px';
  return `<span style="display:inline-block;padding:${px};border-radius:20px;font-size:${sz};font-weight:bold;background:${col.bg};color:${col.c};">${s}</span>`;
}

function esc(s){ if(s==null)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function yinYang(eum){
  const Y=['갑','병','무','경','임','자','인','진','오','신','술','甲','丙','戊','庚','壬','子','寅','辰','午','申','戌'];
  return Y.includes(eum)?{l:'陽',s:'양',c:'#c0392b',bg:'#fff1f0'}:{l:'陰',s:'음',c:'#1a5276',bg:'#f0f4ff'};
}

// 신살 태그
function ssalTags(html){
  if(!html) return '<span style="color:#ccc;font-size:7.5pt;">—</span>';
  const items=html.split(/<br\s*\/?>|\n/).map(s=>s.replace(/<[^>]+>/g,'').trim()).filter(Boolean);
  return items.map(item=>{
    const isBad=/백호|망신|겁살|원진|고란|과숙|홍염|병부/.test(item);
    const isGood=/귀인|문창|복성|태극|암록/.test(item);
    const bg=isBad?'#fde8e8':isGood?'#e8f5e9':'#fff3e0';
    const c=isBad?'#b71c1c':isGood?'#1b5e20':'#e65100';
    const bd=isBad?'#ef9a9a':isGood?'#a5d6a7':'#ffcc80';
    return `<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:7pt;border:1px solid ${bd};background:${bg};color:${c};margin:1px;">${esc(item)}</span>`;
  }).join('');
}

// 지장간 포맷
function jjgFmt(html){
  if(!html) return '<span style="color:#ccc;">—</span>';
  const lines=html.split(/<br\s*\/?>|\n/).map(s=>s.replace(/<[^>]+>/g,'').trim()).filter(Boolean);
  return lines.map(l=>{
    const m=l.match(/^(.+?)\((.+?)\)\s*(.+?)(?:\((.+?)\))?$/);
    if(m) return `<div style="font-size:7.5pt;line-height:1.55;color:#333;"><b style="color:#222;">${esc(m[1])}(${esc(m[2])})</b> <span style="color:#888;font-size:7pt;">${esc(m[3])}${m[4]?'('+esc(m[4])+')':''}</span></div>`;
    return `<div style="font-size:7.5pt;line-height:1.55;">${esc(l)}</div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
function generate(slotId){
  const ch03File  =path.join(QUEUE_DIR,`${slotId}_ch03.json`);
  const masterFile=path.join(QUEUE_DIR,`${slotId}_master_preprocessed.json`);
  // ch03.json 없어도 master.json + saju_calc로 진행
  const d =fs.existsSync(ch03File)?JSON.parse(fs.readFileSync(ch03File,'utf-8')):{};
  try { require('./_saju_data').augmentAll(slotId, QUEUE_DIR, d); } catch(e){}
  if (!d['일주_천간']) {
    console.error('❌ master.json에서 사주 계산 실패:', slotId);
    process.exit(1);
  }
  const mp=fs.existsSync(masterFile)?JSON.parse(fs.readFileSync(masterFile,'utf-8')):{};
  const ch04File=path.join(QUEUE_DIR,`${slotId}_ch04.json`);
  const ch01File=path.join(QUEUE_DIR,`${slotId}_ch01.json`);
  const d4=fs.existsSync(ch04File)?JSON.parse(fs.readFileSync(ch04File,'utf-8')):{};
  const d1=fs.existsSync(ch01File)?JSON.parse(fs.readFileSync(ch01File,'utf-8')):{};

  const PILLARS=['년주','월주','일주','시주'];
  const P_HAN  =['年柱','月柱','日柱','時柱'];
  const P_KOR  =['년주','월주','일주','시주'];

  // 오행 점수 (saju_calc 보강된 d 우선)
  const SC={木:+(d['목점수']||d4['목점수']||d1['목점수']||mp['목점수']||0),火:+(d['화점수']||d4['화점수']||d1['화점수']||mp['화점수']||0),土:+(d['토점수']||d4['토점수']||d1['토점수']||mp['토점수']||0),金:+(d['금점수']||d4['금점수']||d1['금점수']||mp['금점수']||0),水:+(d['수점수']||d4['수점수']||d1['수점수']||mp['수점수']||0)};
  const scT=Object.values(SC).reduce((a,b)=>a+b,0)||1;
  const scM=Math.max(...Object.values(SC))||1;

  // 용신 계열 (ch08/ch06 우선)
  const _c8=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch08.json`),'utf-8')):{};
  const _c6=fs.existsSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`))?JSON.parse(fs.readFileSync(path.join(QUEUE_DIR,`${slotId}_ch06.json`),'utf-8')):{};
  const yongK =ohKey(_c8['용신오행']||_c6['용신오행']||d['용신오행']||mp['용신오행']||'');
  const huiK  =ohKey(_c8['희신오행']||_c6['희신오행']||d['희신오행']||mp['희신오행']||'');
  const byeongK=ohKey(_c8['기신오행']||_c6['기신오행']||d['기신오행']||mp['기신오행']||'');
  const hanK  =ohKey(_c8['한신오행']||_c6['한신오행']||mp['한신오행']||d['한신오행']||'');

  // 일주 오행 → 포인트 컬러
  const ilKey=ohKey(d['일주_천간_오행']||'');
  const ilC  =OH[ilKey]||OH.earth;

  // ── CSS ─────────────────────────────────────────────
  const CSS=`<style>
${FONT_FACE_CSS}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans KR',sans-serif;
       background:#f5f5f5; padding:40px 0;
       display:flex; justify-content:center; align-items:flex-start; min-height:100vh; }
.page { border:1px solid #333; width:604px; padding:6px 10px; background:transparent;
        border-radius:8px;  overflow:hidden; box-sizing:border-box; }
.banner-hdr { display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-radius:8px; }
.banner-hdr-title { font-size:10pt;font-weight:900;color:white; }
.banner-hdr-sub { font-size:6.5pt;color:rgba(255,255,255,.75);margin-top:2px; }
.banner-hdr-name { font-size:10pt;font-weight:800;text-align:right;background:linear-gradient(90deg,#ffd54f,#fff176,#ffffff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.banner-hdr-detail { font-size:6.5pt;color:rgba(255,255,255,.75);text-align:right;margin-top:2px; }
.card { border:2px solid #333; border-radius:12px; overflow:hidden; margin-top:5px; }
.card-hd { padding:5px 14px; display:flex; align-items:center; justify-content:space-between; }
.card-hd-title { font-size:9pt; font-weight:900; color:white; }
.card-hd-sub { font-size:6.5pt; color:rgba(255,255,255,.85); }
.main-tbl { width:100%; border-collapse:collapse; table-layout:fixed; }
.main-tbl th, .main-tbl td { border:1px solid #3335b5; width:20%; }
.col-hd { text-align:center; padding:5px 4px; color:#fff; }
.col-hd .hanja { font-size:12pt; font-weight:900; letter-spacing:1px; display:block; }
.col-hd .kor { font-size:7pt; opacity:.75; margin-top:1px; }
.col-hd .ganju { font-size:8.5pt; font-weight:normal; opacity:.88;
                 border-top:1px solid rgba(255,255,255,.25); margin-top:2px; padding-top:2px; }
.row-lbl { background:#f0ebe0; text-align:center; width:56px; padding:0 4px;
           border-right:2px solid #ccc5b5; vertical-align:middle; }
.row-lbl .r1 { font-size:10pt; font-weight:900; color:#475569; display:block; line-height:1.1; }
.row-lbl .r2 { font-size:6.5pt; color:#555570; display:block; margin-top:1px; }
.tg-cell { text-align:center; padding:5px 4px 4px; vertical-align:middle; }
.tg-hj { font-size:19pt; font-weight:900; display:block; line-height:1; }
.tg-kr { font-size:7.5pt; color:#555570; display:block; margin-top:2px; }
.jj-cell { text-align:center; padding:5px 4px 3px; vertical-align:middle; }
.jj-hj { font-size:16pt; font-weight:800; display:block; line-height:1; }
.jj-kr { font-size:7.5pt; color:#555570; display:block; margin-top:2px; }
.badge { display:inline-block; padding:2px 7px; border-radius:10px; font-size:7.5pt; font-weight:bold; margin:2px 1px; }
.sum-tbl { width:100%; border-collapse:collapse; }
.sum-tbl td { border:1px solid #3335b5; padding:3px 8px; font-size:8.5pt; vertical-align:middle; }
.sum-k { background:#f0ebe0; font-weight:bold; font-size:8pt; color:#1a3a60;
         width:95px; text-align:right; padding-right:12px; white-space:nowrap; }
.sum-v { background:transparent; }
.sum-v2 { background:#faf8f3; }
.oh-bar-bg { background:#e8e4da; border-radius:3px; height:7px; overflow:hidden; }
.oh-bar-fg { height:7px; border-radius:3px; }
.yb { display:inline-flex; align-items:center; gap:4px; padding:2px 8px 2px 6px;
      border-radius:16px; font-size:8pt; font-weight:bold; margin:2px; }
.yd { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.oh-row { display:flex; gap:4px; flex-wrap:wrap; }
.oh-item { display:flex; align-items:center; gap:4px; min-width:105px;
           border-radius:5px; padding:2px 5px; }
.oh-nm { font-weight:bold; font-size:8pt; min-width:36px; }
.oh-tr { flex:1; height:6px; background:#e8e8e8; border-radius:3px; overflow:hidden; min-width:30px; }
.oh-fl { height:100%; border-radius:3px; }
.oh-pc { font-size:7pt; color:#888; min-width:26px; text-align:right; }
@media print {
  body { background:transparent; padding:0; display:block; min-height:0; }
  .page { border:1px solid #333; margin:0;  width:604px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:604px 820px; margin:0; }
}
</style>`;

  // ── HTML 조립 ─────────────────────────────────────────
  const P_HAN2 = ['年柱','月柱','日柱','時柱'];
  const P_KOR2 = ['년주','월주','일주','시주'];

  const siNgYak  = d['신강약']||mp['신강약']||'';
  const gangDo   = mp['일간강도수치']?`${mp['일간강도수치']}%`:'';
  const sngC     = siNgYak.includes('신강')?'#8b0000':siNgYak.includes('신약')?'#1a5276':'#444';
  const ilgan    = d['일주_천간']||'';
  const ilganEum = d['일주_천간_음']||'';
  const ilC2     = oh(d['일주_천간_오행']);
  const name     = d['이름']||slotId;
  const ilju     = d['일주']||'';
  const gyeok    = d['격국명']||'';
  const birthS   = d['birth_solar']||d['생년월일']||'';
  const gender   = d['user_gender']||'';
  const age      = d['user_age']||'';

  function yb(label,k){
    if(!k) return '';
    const c=OH[k]||OH.metal;
    return `<span class="yb" style="background:${c.badge};color:${c.badgeText};border:1px solid ${c.border};">`
          +`<span class="yd" style="background:${c.main};"></span>`
          +`<span style="font-size:7pt;color:#999;">${label}</span> `
          +`<span style="font-size:9pt;">${ohHan(k)}</span>`
          +`</span>`;
  }

  const OH_KEYS=['木','火','土','金','水'];
  const OH_EN  =['wood','fire','earth','metal','water'];
  const OH_KOR =['목(木)','화(火)','토(土)','금(金)','수(水)'];
  let bars=`<div class="oh-row">`;
  for(let i=0;i<5;i++){
    const sc=SC[OH_KEYS[i]]||0;
    const pct=Math.round(sc/scT*100);
    const w  =Math.round(sc/scM*100);
    const c  =OH[OH_EN[i]];
    const tag=(ohKey(OH_KEYS[i])===yongK)?'★용':(ohKey(OH_KEYS[i])===huiK)?'◆희':(ohKey(OH_KEYS[i])===byeongK)?'▲병':'';
    const tc =(ohKey(OH_KEYS[i])===yongK)?'#1a7a3c':(ohKey(OH_KEYS[i])===huiK)?'#2980b9':(ohKey(OH_KEYS[i])===byeongK)?'#c0392b':'';
    bars+=`<div class="oh-item" style="border:1px solid ${c.border};background:${c.pale};">`
         +`<span class="oh-nm" style="color:${c.main};">${OH_KOR[i]}</span>`
         +`<div class="oh-tr"><div class="oh-fl" style="width:${w}%;background:${c.bar};"></div></div>`
         +`<span class="oh-pc">${sc.toFixed(1)}<br>${pct}%</span>`
         +(tag?`<span style="font-size:7pt;font-weight:bold;color:${tc};">${tag}</span>`:'')
         +`</div>`;
  }
  bars+=`</div>`;

  const comboItems=[];
  if(d['지지합목록'])   comboItems.push(`<span style="color:#1e6b2a;font-weight:bold;">합</span> ${esc(d['지지합목록'])}`);
  if(d['지지충목록'])   comboItems.push(`<span style="color:#b92e27;font-weight:bold;">충</span> ${esc(d['지지충목록'])}`);
  if(d['지지형목록'])   comboItems.push(`<span style="color:#e67e22;font-weight:bold;">형</span> ${esc(d['지지형목록'])}`);
  if(d['지지파해목록']) comboItems.push(`<span style="color:#8b0000;font-weight:bold;">파·해</span> ${esc(d['지지파해목록'])}`);

  let H='';
  H+=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">\n`;
  H+=`<title>사주기본표 》 ${esc(name)}</title>\n`;
  H+=CSS+`\n</head>\n<body>\n<div class="page">\n`;

  // ── banner-hdr ──────────────────────────────────────
  H+=`<div class="banner-hdr" style="background:linear-gradient(135deg,#1a237e,#4a148c);">
  <div>
    <div class="banner-hdr-title">📋 사주 기본표 (四柱 基本表)</div>
    <div class="banner-hdr-sub">${esc(ilju)} 일주 · ${esc(gyeok)}</div>
  </div>
  <div>
    <div class="banner-hdr-name">${esc(name)} 님</div>
    <div class="banner-hdr-detail">${esc(birthS)}${gender?' · '+esc(gender):''}${age?' · '+esc(age)+'세':''} · ${esc(siNgYak)} · 用神 ${ohHan(yongK)}</div>
  </div>
</div>\n`;

  // ── Card 1: 사주 원국 ────────────────────────────────
  H+=`<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#475569,#64748b);">
    <div class="card-hd-title">① 사주 원국 (四柱 原局)</div>
    <div class="card-hd-sub">네 기둥 여덟 글자</div>
  </div>
  <table class="main-tbl"><thead><tr>
    <th style="background:#475569;width:56px;"></th>\n`;
  for(let i=0;i<4;i++){
    const pk=PILLARS[i];
    const c=oh(d[`${pk}_천간_오행`]);
    H+=`    <th class="col-hd" style="background:${c.grad};">`
      +`<span class="hanja">${P_HAN2[i]}</span>`
      +`<span class="kor">${P_KOR2[i]}</span>`
      +`<div class="ganju">${esc(d[pk]||'')}</div>`
      +`</th>\n`;
  }
  H+=`  </tr></thead><tbody>\n`;

  // 天干
  H+=`  <tr><td class="row-lbl"><span class="r1">天干</span><span class="r2">천간</span></td>\n`;
  for(const pk of PILLARS){
    const c=oh(d[`${pk}_천간_오행`]);
    H+=`    <td class="tg-cell" style="background:${c.pale};">`
      +`<span class="tg-hj" style="color:${c.main};">${esc(d[`${pk}_천간`]||'')}</span>`
      +`<span class="tg-kr">${esc(d[`${pk}_천간_음`]||'')}</span></td>\n`;
  }
  H+=`  </tr>\n`;

  // 地支
  H+=`  <tr><td class="row-lbl"><span class="r1">地支</span><span class="r2">지지</span></td>\n`;
  for(const pk of PILLARS){
    const c=oh(d[`${pk}_지지_오행`]);
    H+=`    <td class="jj-cell" style="background:${c.light};">`
      +`<span class="jj-hj" style="color:${c.mid};">${esc(d[`${pk}_지지`]||'')}</span>`
      +`<span class="jj-kr">${esc(d[`${pk}_지지_음`]||'')}</span></td>\n`;
  }
  H+=`  </tr>\n`;

  // 十星
  H+=`  <tr style="background:#fdfaf8;"><td class="row-lbl"><span class="r1">十星</span><span class="r2">십성</span></td>\n`;
  for(const pk of PILLARS){
    H+=`    <td style="text-align:center;padding:5px 4px;">`
      +`<div style="margin-bottom:3px;">${ssBadge(d[`${pk}_천간십성`]||'',true)}</div>`
      +`<div>${ssBadge(d[`${pk}_지지십성`]||'',true)}</div></td>\n`;
  }
  H+=`  </tr>\n`;

  // 藏干
  H+=`  <tr><td class="row-lbl"><span class="r1">藏干</span><span class="r2">지장간</span></td>\n`;
  for(const pk of PILLARS){
    H+=`    <td style="padding:5px 7px;vertical-align:middle;">${jjgFmt(d[`${pk}_지장간_HTML`]||'')}</td>\n`;
  }
  H+=`  </tr>\n`;

  // 神殺
  H+=`  <tr style="background:#fdfaf8;"><td class="row-lbl"><span class="r1">神殺</span><span class="r2">신살</span></td>\n`;
  for(const pk of PILLARS){
    H+=`    <td style="text-align:center;padding:4px 3px;">${ssalTags(d[`${pk}_신살_HTML`]||'')}</td>\n`;
  }
  H+=`  </tr>\n  </tbody></table>\n</div>\n`;

  // ── Card 2: 핵심 명리 정보 ──────────────────────────
  H+=`<div class="card">
  <div class="card-hd" style="background:linear-gradient(135deg,#c65c00,#e87020);">
    <div class="card-hd-title">② 핵심 명리 정보 (命理 要約)</div>
    <div class="card-hd-sub">격국 · 용신 · 신강약 · 오행</div>
  </div>
  <table class="sum-tbl"><tbody>\n`;

  H+=`  <tr><td class="sum-k">일간 · 신강약</td><td class="sum-v">`
    +`<span style="font-size:15pt;font-weight:900;color:${ilC2.main};">${esc(ilgan)}</span>`
    +`<span style="font-size:8pt;color:#888;margin-left:4px;">${esc(ilganEum)} · ${ohHan(d['일주_천간_오행'])}</span>`
    +` &nbsp; <span style="font-size:9.5pt;font-weight:bold;color:#555;">${esc(ilju)}</span>`
    +` &nbsp;&nbsp; <span style="font-weight:bold;color:${sngC};font-size:9.5pt;">${esc(siNgYak)}</span>`
    +(gangDo?`<span style="font-size:7.5pt;color:#aaa;margin-left:5px;">${gangDo}</span>`:'')
    +`</td></tr>\n`;

  H+=`  <tr><td class="sum-k">격국 (格局)</td><td class="sum-v2">`
    +`<span style="font-weight:bold;color:#222;font-size:9.5pt;">${esc(gyeok||'—')}</span>`
    +`</td></tr>\n`;

  H+=`  <tr><td class="sum-k">용신 체계</td><td class="sum-v" style="line-height:1.7;">`
    +yb('용신',yongK)+yb('희신',huiK)+yb('기신',byeongK)+(hanK?yb('한신',hanK):'')
    +`</td></tr>\n`;

  H+=`  <tr><td class="sum-k">오행 분포</td><td class="sum-v2">${bars}</td></tr>\n`;

  H+=`  <tr><td class="sum-k">공망 (空亡)</td><td class="sum-v" style="font-size:8.5pt;color:#555;">`
    +`${esc(d['공망표기']||`${d['공망1']||''}·${d['공망2']||''}`)}</td></tr>\n`;

  H+=`  <tr><td class="sum-k">합·충·형·파해</td><td class="sum-v2" style="font-size:8pt;line-height:1.9;">`
    +(comboItems.length?comboItems.join(' &nbsp;|&nbsp; '):'<span style="color:#bbb;">없음</span>')
    +`</td></tr>\n`;

  H+=`  <tr><td class="sum-k">귀인 신살</td><td class="sum-v" style="font-size:8pt;">${ssalTags(d['귀인신살요약']||d['길신요약']||'')}</td></tr>\n`;
  H+=`  <tr><td class="sum-k">흉 살</td><td class="sum-v2" style="font-size:8pt;">${ssalTags(d['흉살요약']||d['살신살목록']||'')}</td></tr>\n`;

  H+=`  </tbody></table>\n</div>\n</div>\n</body>\n</html>\n`;

  // ── 저장 ─────────────────────────────────────
  const outDir=path.join(TABLES_DIR,slotId);
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  const outFile=path.join(outDir,'사주기본표.html');
  require('./_guards').safeWriteHtml(outFile, H, { 이름: name }, '사주기본표');
  console.log(`✅ ${outFile}  (${fs.statSync(outFile).size.toLocaleString()}B)`);
  return outFile;
}

const slotId=process.argv[2];
if(!slotId){console.error('사용법: node generate_사주기본표.js <slot_id>');process.exit(1);}
generate(slotId);
