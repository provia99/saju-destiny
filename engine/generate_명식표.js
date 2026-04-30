#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');
const { FONT_FACE_CSS, FONT_FACE_WEB_CSS } = require('./font_config');
const { 전체사주계산, 오행점수계산 } = require('./saju_calc');

const SCRIPT_DIR = __dirname;
const QUEUE_DIR  = path.join(SCRIPT_DIR, 'queue');
const TABLES_DIR = path.join(SCRIPT_DIR, 'tables');

const OH_KR = {木:'목',火:'화',土:'토',金:'금',水:'수'};
const OH_CLR = {木:'#2e7d32',火:'#e65100',土:'#c9a227',金:'#546e7a',水:'#1565c0'};
const TG_OH = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const JJ_OH = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const TG_KR = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const JJ_KR = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const YANG = new Set(['甲','丙','戊','庚','壬','子','寅','辰','午','申','戌']);
const 시간범위 = {자시:'23:30~01:30',축시:'01:30~03:30',인시:'03:30~05:30',묘시:'05:30~07:30',진시:'07:30~09:30',사시:'09:30~11:30',오시:'11:30~13:30',미시:'13:30~15:30',신시:'15:30~17:30',유시:'17:30~19:30',술시:'19:30~21:30',해시:'21:30~23:30'};
const 천간순 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const 지지순 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const 띠맵 = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
const 절기월 = ['소한','입춘','경칩','청명','입하','망종','소서','입추','백로','한로','입동','대설'];

function get십성(일간, 대상) {
  if (!일간 || !대상) return '';
  const oh일 = TG_OH[일간] || JJ_OH[일간];
  const oh대 = TG_OH[대상] || JJ_OH[대상];
  if (!oh일 || !oh대) return '';
  const 양일 = YANG.has(일간), 양대 = YANG.has(대상);
  const same = 양일 === 양대;
  if (oh일 === oh대) return same ? '비견' : '겁재';
  const 생 = {木:'火',火:'土',土:'金',金:'水',水:'木'};
  const 극 = {木:'土',火:'金',土:'水',金:'木',水:'火'};
  if (생[oh일] === oh대) return same ? '식신' : '상관';
  if (극[oh일] === oh대) return same ? '편재' : '정재';
  if (극[oh대] === oh일) return same ? '편관' : '정관';
  if (생[oh대] === oh일) return same ? '편인' : '정인';
  return '';
}

function get12운성(일간, 지지) {
  const 표 = {
    甲:{子:'목욕',丑:'관대',寅:'건록',卯:'제왕',辰:'쇠',巳:'병',午:'사',未:'묘',申:'절',酉:'태',戌:'양',亥:'장생'},
    乙:{子:'병',丑:'쇠',寅:'제왕',卯:'건록',辰:'관대',巳:'목욕',午:'장생',未:'양',申:'태',酉:'절',戌:'묘',亥:'사'},
    丙:{子:'태',丑:'양',寅:'장생',卯:'목욕',辰:'관대',巳:'건록',午:'제왕',未:'쇠',申:'병',酉:'사',戌:'묘',亥:'절'},
    丁:{子:'절',丑:'묘',寅:'사',卯:'병',辰:'쇠',巳:'제왕',午:'건록',未:'관대',申:'목욕',酉:'장생',戌:'양',亥:'태'},
    戊:{子:'태',丑:'양',寅:'장생',卯:'목욕',辰:'관대',巳:'건록',午:'제왕',未:'쇠',申:'병',酉:'사',戌:'묘',亥:'절'},
    己:{子:'절',丑:'묘',寅:'사',卯:'병',辰:'쇠',巳:'제왕',午:'건록',未:'관대',申:'목욕',酉:'장생',戌:'양',亥:'태'},
    庚:{子:'사',丑:'묘',寅:'절',卯:'태',辰:'양',巳:'장생',午:'목욕',未:'관대',申:'건록',酉:'제왕',戌:'쇠',亥:'병'},
    辛:{子:'장생',丑:'양',寅:'태',卯:'절',辰:'묘',巳:'사',午:'병',未:'쇠',申:'제왕',酉:'건록',戌:'관대',亥:'목욕'},
    壬:{子:'제왕',丑:'쇠',寅:'병',卯:'사',辰:'묘',巳:'절',午:'태',未:'양',申:'장생',酉:'목욕',戌:'관대',亥:'건록'},
    癸:{子:'건록',丑:'관대',寅:'목욕',卯:'장생',辰:'양',巳:'태',午:'절',未:'묘',申:'사',酉:'병',戌:'쇠',亥:'제왕'},
  };
  return 표[일간]?.[지지] || '';
}

function generate(slotId) {
  const isAbs = path.isAbsolute(slotId) || fs.existsSync(path.join(slotId, 'master.json'));
  const slotDir = isAbs ? slotId : path.join(QUEUE_DIR, path.dirname(slotId));
  let masterPath = isAbs ? path.join(slotId, 'master.json') : path.join(QUEUE_DIR, `${slotId}_master.json`);
  if (!fs.existsSync(masterPath)) masterPath = path.join(slotDir, 'master.json');
  if (!fs.existsSync(masterPath)) { console.error('master.json 없음'); return; }

  const M = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  const 올해 = parseInt(M.발행연도 || M._올해 || new Date().getFullYear());
  const r = 전체사주계산({
    이름:M.이름, 성별:M.성별, 년:M.생년, 월:M.생월, 일:M.생일,
    시간: M.생시||'모름', 음력입력:M.음력입력??true, 윤달:M.윤달,
    활동상태:M.활동상태, 결혼상태:M.결혼상태, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

  const w = r.원국;
  const 일간 = w.일주.천간;
  const 일지 = w.일주.지지;
  const 선생님 = M.선생님이름 || '반야선생';

  // 납음오행
  const 납음표 = {
    '甲子':'해중금','乙丑':'해중금','丙寅':'노중화','丁卯':'노중화','戊辰':'대림목','己巳':'대림목',
    '庚午':'노방토','辛未':'노방토','壬申':'검봉금','癸酉':'검봉금','甲戌':'산두화','乙亥':'산두화',
    '丙子':'간하수','丁丑':'간하수','戊寅':'성두토','己卯':'성두토','庚辰':'백랍금','辛巳':'백랍금',
    '壬午':'양류목','癸未':'양류목','甲申':'천중수','乙酉':'천중수','丙戌':'옥상토','丁亥':'옥상토',
    '戊子':'벽력화','己丑':'벽력화','庚寅':'송백목','辛卯':'송백목','壬辰':'장류수','癸巳':'장류수',
    '甲午':'사중금','乙未':'사중금','丙申':'산하화','丁酉':'산하화','戊戌':'평지목','己亥':'평지목',
    '庚子':'벽상토','辛丑':'벽상토','壬寅':'금박금','癸卯':'금박금','甲辰':'복등화','乙巳':'복등화',
    '丙午':'천하수','丁未':'천하수','戊申':'대역토','己酉':'대역토','庚戌':'차천금','辛亥':'차천금',
    '壬子':'상자목','癸丑':'상자목','甲寅':'대계수','乙卯':'대계수','丙辰':'사중토','丁巳':'사중토',
    '戊午':'천상화','己未':'천상화','庚申':'석류목','辛酉':'석류목','壬戌':'대해수','癸亥':'대해수',
  };
  const 일주납음 = 납음표[일간+일지] || '';

  // 일주 한 줄 특성
  const 색상한글 = {甲:'비취',乙:'비취',丙:'루비',丁:'루비',戊:'황금',己:'황금',庚:'백옥',辛:'백옥',壬:'흑진주',癸:'흑진주'};
  const 동물한글 = {子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지'};
  const 일주동물 = `${색상한글[일간]||''} ${동물한글[일지]||''}`;
  const 일간특성맵 = {甲:'곧은 추진력의 리더',乙:'유연한 적응의 생존자',丙:'밝고 따뜻한 태양',丁:'깊고 섬세한 등불',戊:'묵직한 대지의 안정감',己:'세심한 정원사',庚:'원칙의 결단력',辛:'정밀한 심미안',壬:'전략적 큰 흐름',癸:'깊은 통찰의 샘'};
  const 일주특성 = `${일주동물.trim()} — ${일간특성맵[일간]||''}`;

  // 공망 위치
  const 공망위치 = (() => {
    const g1 = r.공망?.공망1, g2 = r.공망?.공망2;
    if (!g1 && !g2) return '없음';
    const locs = [];
    [g1,g2].filter(Boolean).forEach(gm => {
      if (w.년주.지지 === gm) locs.push(`년지(${gm})`);
      if (w.월주.지지 === gm) locs.push(`월지(${gm})`);
      if (w.일주.지지 === gm) locs.push(`일지(${gm})`);
      if (w.시주.지지 === gm) locs.push(`시지(${gm})`);
    });
    return locs.length ? locs.join(' · ') : `${[g1,g2].filter(Boolean).join('·')} (원국 외)`;
  })();

  // 세운-원국 합충
  const 세운원국관계 = (() => {
    const st = r.현재세운?.천간, sj = r.현재세운?.지지;
    if (!st || !sj) return [];
    const rels = [];
    const 충맵 = {子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
    const 합맵 = {子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
    const jjs = [{n:'년지',v:w.년주.지지},{n:'월지',v:w.월주.지지},{n:'일지',v:w.일주.지지},{n:'시지',v:w.시주.지지}];
    jjs.forEach(({n,v}) => {
      if (충맵[sj] === v) rels.push(`${sj}↔${v} 충(${n})`);
      if (합맵[sj] === v) rels.push(`${sj}↔${v} 합(${n})`);
    });
    return rels;
  })();

  // 다음 전환점
  const 대운목록 = r.대운목록 || [];
  const 현재대운idx = 대운목록.findIndex(d => d.간지 === r.현재대운?.간지);
  const 다음대운 = 현재대운idx >= 0 ? 대운목록[현재대운idx + 1] : null;

  const pillars = [
    {name:'시주',t:w.시주.천간,j:w.시주.지지,tss:get십성(일간,w.시주.천간),jss:get십성(일간,w.시주.지지)},
    {name:'일주',t:w.일주.천간,j:w.일주.지지,tss:'일간',jss:get십성(일간,w.일주.지지)},
    {name:'월주',t:w.월주.천간,j:w.월주.지지,tss:get십성(일간,w.월주.천간),jss:get십성(일간,w.월주.지지)},
    {name:'년주',t:w.년주.천간,j:w.년주.지지,tss:get십성(일간,w.년주.천간),jss:get십성(일간,w.년주.지지)},
  ];

  // 지장간
  const 지장간 = r.지장간 || {};
  const getJJ = (jj) => (지장간[jj]?.항목 || []).map(x => `${x.천간}(${TG_KR[x.천간]})`).join(' ');

  // 오행 점수
  const 오행점수 = 오행점수계산(w);
  const maxScore = Math.max(...Object.values(오행점수), 1);

  // 합충
  const 합충 = [];
  if (r.천간합목록?.length) 합충.push('천간합: ' + r.천간합목록.join(', '));
  if (r.지지충목록?.length) 합충.push('충: ' + r.지지충목록.join(', '));
  if (r.지지합목록?.length) 합충.push('지지합: ' + r.지지합목록.join(', '));
  if (r.지지형목록?.length) 합충.push('형: ' + r.지지형목록.join(', '));

  // 신살
  const 신살 = r.신살 || {};
  const 신살목록 = [];
  if (신살.천을귀인?.length) 신살목록.push(`천을귀인(${신살.천을귀인.join('·')})`);
  if (신살.문창귀인?.length) 신살목록.push(`문창귀인(${신살.문창귀인.join('·')})`);
  if (신살.태극귀인?.length) 신살목록.push(`태극귀인(${신살.태극귀인.join('·')})`);
  if (신살.도화살?.length) 신살목록.push(`도화살(${신살.도화살.join('·')})`);
  if (신살.홍염살?.length) 신살목록.push(`홍염살(${신살.홍염살.join('·')})`);
  if (신살.백호대살?.length) 신살목록.push(`백호대살`);

  // 공망
  const 공망 = r.공망 || {};
  const 공망str = [공망.공망1, 공망.공망2].filter(Boolean).map(g => `${g}(${JJ_KR[g]||g})`).join('·') || '없음';

  // 대운
  const 대운 = (r.대운목록 || []).slice(0, 10);
  const 현재idx = 대운.findIndex(d => d.간지 === r.현재대운?.간지);

  // 세운 (올해)
  const 세운 = r.현재세운 || {};
  const 세운t = 세운.천간 || '', 세운j = 세운.지지 || '';
  const 세운성격 = (() => {
    const to = TG_OH[세운t], jo = JJ_OH[세운j];
    if (to===r.용신||jo===r.용신) return {t:'용신세운',c:'#2e7d32'};
    if (to===r.희신||jo===r.희신) return {t:'희신세운',c:'#1565c0'};
    if (to===r.기신||jo===r.기신) return {t:'기신세운',c:'#c62828'};
    return {t:'중립세운',c:'#888'};
  })();

  // 월운 12개월
  const 월운 = [];
  for (let m = 1; m <= 12; m++) {
    const 월지 = 지지순[((m + 1) % 12)]; // 1월=寅 기준 조정
    const 실제월지 = 지지순[(m + 1) % 12];
    const to = TG_OH[세운t], jo = JJ_OH[실제월지];
    const type = (jo===r.용신)?'y':(jo===r.희신)?'h':(jo===r.기신)?'g':'n';
    월운.push({월:m, 지지:실제월지, type, 절기:절기월[m-1]||''});
  }

  const ohCell = (ch) => {
    const oh = TG_OH[ch] || JJ_OH[ch] || '';
    return `<span style="color:${OH_CLR[oh]||'#333'}">${oh}</span>`;
  };
  const yy = (ch) => YANG.has(ch) ? '양' : '음';

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>${올해}년 사주 명식도 — ${M.이름}</title>
<style>
${FONT_FACE_CSS}
${FONT_FACE_WEB_CSS}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:transparent;font-family:'Noto Sans KR',sans-serif;font-size:7pt;}
.s{width:604px;min-height:840px;margin:0 auto;border:1.5px solid #d4af37;border-radius:8px;overflow:visible;background:#fff;display:flex;flex-direction:column;}
.hd{background:linear-gradient(135deg,#f8f4e8,#f0ece0);color:#5a4e3c;text-align:center;padding:7px 0;font-family:'Noto Serif KR',serif;font-size:10pt;font-weight:700;letter-spacing:5px;border-bottom:2px solid #d4af37;}
.mt{display:flex;justify-content:center;gap:14px;padding:4px 10px;font-size:6.5pt;color:#555;border-bottom:1px solid #ddd;background:#fafaf8;}
.mt b{color:#222;}
.sc{padding:2px 8px;font-size:6pt;color:#5a4e3c;font-weight:700;letter-spacing:2px;background:#f8f4e8;border-bottom:1px solid #e8e4d8;}
/* 원국 */
.wg{display:flex;border-bottom:1.5px solid #d4af37;}
.pl{flex:1;text-align:center;border-right:1px solid #e0e0e0;padding:3px 0;}
.pl:last-child{border-right:none;}
.pl.me{background:#fffde7;}
.pl-n{font-size:5.5pt;color:#999;}
.pl-h{font-family:'Noto Serif KR',serif;font-size:11pt;color:#333;line-height:1.1;}
.pl-k{font-size:5.5pt;color:#888;}
.pl-o{font-size:5.5pt;}
.pl-s{font-size:5.5pt;color:#6a5acd;}
.pl-12{font-size:5pt;color:#999;}
.pl-d{border-top:1px solid #e8e8e8;margin-top:2px;padding-top:2px;}
/* 지장간 */
.jj{display:flex;border-bottom:1px solid #ddd;}
.jj-c{flex:1;text-align:center;padding:4px 0;font-size:7pt;color:#555;border-right:1px solid #f0f0f0;}
.jj-c:last-child{border-right:none;}
/* 2열 */
.r2{display:flex;border-bottom:1px solid #ddd;}
.c2{flex:1;padding:3px 8px;border-right:1px solid #f0f0f0;}
.c2:last-child{border-right:none;}
.lb{font-size:5pt;color:#999;margin-bottom:1px;font-weight:600;}
/* 오행바 */
.ob{display:flex;align-items:center;gap:3px;margin:10px 0;}
.on{font-size:5.5pt;width:22px;text-align:right;font-weight:600;}
.of{height:12px;border-radius:3px;min-width:3px;}
.ov{font-size:5pt;color:#999;}
/* 대운 */
.dw{display:flex;border-bottom:1px solid #ddd;}
.di{flex:1;text-align:center;padding:2px 0;border-right:1px solid #f5f5f5;font-size:5pt;}
.di:last-child{border-right:none;}
.di.now{background:#fffde7;font-weight:700;}
.dg{font-family:'Noto Serif KR',serif;font-size:7pt;}
.da{font-size:4.5pt;color:#999;}
.dt{font-size:4.5pt;border-radius:2px;padding:0 2px;display:inline-block;margin-top:0.5px;}
.dy{background:#e8f5e9;color:#2e7d32;}.dh{background:#e3f2fd;color:#1565c0;}.dgi{background:#fce4ec;color:#c62828;}.dn{background:#f5f5f5;color:#999;}
/* 월운 */
.mw{display:flex;border-bottom:1px solid #ddd;}
.mi{flex:1;text-align:center;padding:2px 0;border-right:1px solid #f5f5f5;font-size:5pt;}
.mi:last-child{border-right:none;}
.mg{font-family:'Noto Serif KR',serif;font-size:6.5pt;}
/* 천간지지 참조 */
.ref{display:flex;border-bottom:1px solid #ddd;font-size:5pt;color:#666;}
.ref-c{flex:1;text-align:center;padding:1.5px 0;border-right:1px solid #f5f5f5;}
.ref-c:last-child{border-right:none;}
.ref-h{font-family:'Noto Serif KR',serif;font-size:6.5pt;color:#333;}
.ft{text-align:center;padding:3px 0;font-size:5pt;color:#aaa;margin-top:auto;}
</style></head>
<body>
<div class="s">
  <div class="hd">${올해}년 四柱命式圖</div>
  <div class="mt">
    <span><b>${M.이름}</b></span>
    <span>양력 ${r.양력정보}</span>
    <span>${M.성별==='남'?'남':'여'}</span>
    <span>${M.생시 ? `${M.생시}(${시간범위[M.생시]||''})` : '시미상'}</span>
    <span>${띠맵[w.년주.지지]||''}띠</span>
    <span>만${r.만나이||''}세</span>
    <span><b>${일주특성}</b></span>
  </div>

  <div class="sc">▣ 원국(原局) 四柱八字</div>
  <div class="wg">
${pillars.map(p => `    <div class="pl${p.name==='일주'?' me':''}">
      <div class="pl-n">${p.name}</div>
      <div class="pl-h">${p.t}(${TG_KR[p.t]})</div>
      <div class="pl-k">${ohCell(p.t)} · ${yy(p.t)}</div>
      <div class="pl-s">${p.tss}</div>
      <div class="pl-d">
        <div class="pl-h">${p.j}(${JJ_KR[p.j]})</div>
        <div class="pl-k">${ohCell(p.j)} · ${yy(p.j)}</div>
        <div class="pl-s">${p.jss}</div>
        <div class="pl-12">${get12운성(일간,p.j)}</div>
      </div>
    </div>`).join('\n')}
  </div>

  <div class="sc">▣ 지장간(地藏干)</div>
  <div class="jj">
${pillars.map(p => `    <div class="jj-c"><b>${p.j}(${JJ_KR[p.j]})</b> ${getJJ(p.j)||'-'}</div>`).join('\n')}
  </div>

  <div class="sc">▣ 오행분포 · 5신 · 신강약 · 격국</div>
  <div class="r2">
    <div class="c2" style="flex:1.3;">
      <div class="lb">오행 점수</div>
${['木','火','土','金','水'].map(o => {
  const s = (오행점수[o]||0).toFixed(1);
  const w2 = Math.round((오행점수[o]||0)/maxScore*100);
  return `      <div class="ob"><span class="on" style="color:${OH_CLR[o]}">${o}(${OH_KR[o]})</span><div class="of" style="width:${w2}px;background:${OH_CLR[o]}30;border:1px solid ${OH_CLR[o]}60;"></div><span class="ov">${s}</span></div>`;
}).join('\n')}
    </div>
    <div class="c2" style="font-size:6.5pt;">
      <div class="lb">5신 체계</div>
      <div style="line-height:1.8;">
        <span style="color:#2e7d32;font-weight:700;">용신 ${r.용신}(${OH_KR[r.용신]})</span><br>
        <span style="color:#1565c0;">희신 ${r.희신}(${OH_KR[r.희신]})</span><br>
        <span style="color:#c62828;">기신 ${r.기신}(${OH_KR[r.기신]})</span><br>
        <span style="color:#888;">구신 ${r.구신||'-'} · 한신 ${r.한신||'-'}</span>
      </div>
      <div class="lb" style="margin-top:2px;">억부/조후</div>
      <div>억부 ${r.억부용신||'-'} · 조후 ${r.조후용신||'-'}</div>
    </div>
    <div class="c2" style="font-size:6.5pt;">
      <div class="lb">신강약</div>
      <div style="font-weight:700;color:#1a1a2e;">${r.신강약}</div>
      <div class="lb" style="margin-top:2px;">격국</div>
      <div>${r.格국명||r.격국명||''}</div>
      <div class="lb" style="margin-top:2px;">대운</div>
      <div>${r.대운방향} · ${r.대운시작나이}세</div>
    </div>
  </div>

  <div class="sc">▣ 합충형파해 · 공망 · 신살 · 납음</div>
  <div class="r2">
    <div class="c2" style="font-size:6pt;"><div class="lb">합충형파해</div><div style="line-height:1.6;">${합충.length ? 합충.join('<br>') : '없음'}</div></div>
    <div class="c2" style="flex:0.6;font-size:6pt;"><div class="lb">공망</div><div style="font-weight:600;">${공망str}</div><div style="color:#888;margin-top:1px;">위치: ${공망위치}</div></div>
    <div class="c2" style="font-size:6pt;"><div class="lb">신살</div><div style="line-height:1.6;">${신살목록.length ? 신살목록.join(' · ') : '없음'}</div></div>
    <div class="c2" style="flex:0.5;font-size:6pt;"><div class="lb">납음오행</div><div style="font-weight:600;">${일주납음}</div></div>
  </div>

  <div class="sc">▣ 대운(大運) 10기</div>
  <div class="dw">
${대운.map((d, i) => {
  // saju_calc 결과(대운길흉) 우선 사용 — 천간/지지 단순매칭이 아닌 합충·십성 보정 포함된 종합판정
  const dwGil = d.대운길흉 || '';
  const type = dwGil.startsWith('용신')?'y':dwGil.startsWith('희신')?'h':dwGil.startsWith('기신')?'gi':'n';
  const label = dwGil.replace('대운','') || '중립';
  const isCur = i === 현재idx;
  return `    <div class="di${isCur?' now':''}"><div class="dg">${d.천간}${d.지지}</div><div class="da">${TG_KR[d.천간]||''}${JJ_KR[d.지지]||''} ${d.시작나이||''}~${d.종료나이||''}세</div><div class="dt d${type}">${label}${isCur?' ★':''}</div></div>`;
}).join('\n')}
  </div>

  <div class="sc">▣ ${올해}년 세운(歲運) ${세운t}${세운j}(${TG_KR[세운t]}${JJ_KR[세운j]}) · <span style="color:${세운성격.c}">${세운성격.t}</span></div>
  <div class="r2">
    <div class="c2" style="font-size:6.5pt;">
      <div class="lb">세운 간지</div>
      <div style="font-weight:700;">${세운t}${세운j}(${TG_KR[세운t]}${JJ_KR[세운j]})</div>
      <div>천간 ${ohCell(세운t)} ${yy(세운t)} · 지지 ${ohCell(세운j)} ${yy(세운j)}</div>
      <div>십성: ${get십성(일간,세운t)}/${get십성(일간,세운j)}</div>
    </div>
    <div class="c2" style="font-size:6.5pt;">
      <div class="lb">세운-원국 관계</div>
      <div>12운성: ${get12운성(일간,세운j)}</div>
      <div style="color:${세운성격.c};font-weight:600;">${세운성격.t}</div>
      <div style="font-size:5pt;color:#555;margin-top:1px;">${세운원국관계.length ? '합충: '+세운원국관계.join(', ') : '합충 없음'}</div>
    </div>
    <div class="c2" style="font-size:6.5pt;">
      <div class="lb">현재 대운</div>
      <div style="font-weight:600;">${r.현재대운?.천간||''}(${TG_KR[r.현재대운?.천간]||''})${r.현재대운?.지지||''}(${JJ_KR[r.현재대운?.지지]||''}) ${r.현재대운?.나이범위||''}</div>
      <div>대운+세운: ${(() => {
        // saju_calc의 현재대운 종합판정(대운길흉) 우선 사용
        const curDw = 대운목록[현재대운idx] || r.현재대운 || {};
        const dwGil = curDw.대운길흉 || '';
        const dType = dwGil ? dwGil.replace('대운','') : '중립';
        return dType + '대운 + ' + 세운성격.t;
      })()}</div>
      ${다음대운 ? `<div class="lb" style="margin-top:1px;">다음 전환점</div><div>${다음대운.천간}(${TG_KR[다음대운.천간]||''})${다음대운.지지}(${JJ_KR[다음대운.지지]||''}) ${다음대운.시작나이||''}세 ${다음대운.시작년도||''}년~</div>` : ''}
    </div>
  </div>

  <div class="sc">▣ ${올해}년 월운(月運) 12개월</div>
  <div class="mw">
${월운.map(m => {
  const clr = {y:'#2e7d32',h:'#1565c0',g:'#c62828',n:'#888'}[m.type];
  return `    <div class="mi"><div style="font-size:4.5pt;color:#999;">${m.절기}</div><div class="mg" style="color:${clr};">${m.월}월</div><div style="font-size:5pt;">${m.지지}(${JJ_KR[m.지지]})</div><div class="dt d${m.type==='g'?'gi':m.type}">${{y:'용',h:'희',g:'기',n:'중'}[m.type]}</div></div>`;
}).join('\n')}
  </div>

  <div class="sc">▣ 참조: 천간(天干) · 지지(地支)</div>
  <div class="ref">
${천간순.map(t => `    <div class="ref-c"><div class="ref-h" style="color:${OH_CLR[TG_OH[t]]}">${t}</div>${TG_KR[t]}·${OH_KR[TG_OH[t]]}·${yy(t)}</div>`).join('\n')}
  </div>
  <div class="ref">
${지지순.map(j => `    <div class="ref-c"><div class="ref-h" style="color:${OH_CLR[JJ_OH[j]]}">${j}</div>${JJ_KR[j]}·${OH_KR[JJ_OH[j]]}·${띠맵[j]||''}</div>`).join('\n')}
  </div>

  <div class="sc">▣ 용신(用神) ${r.용신}(${OH_KR[r.용신]}) 실용 가이드</div>
  <div class="r2">
    <div class="c2">
      <div class="lb">방위</div>
      <div style="font-size:6.5pt;">${{木:'동쪽(東)',火:'남쪽(南)',土:'중앙',金:'서쪽(西)',水:'북쪽(北)'}[r.용신]||''}</div>
    </div>
    <div class="c2">
      <div class="lb">색상</div>
      <div style="font-size:6.5pt;">${{木:'청색·녹색',火:'적색·주황색',土:'황색·갈색',金:'백색·금색',水:'흑색·남색'}[r.용신]||''}</div>
    </div>
    <div class="c2">
      <div class="lb">숫자</div>
      <div style="font-size:6.5pt;">${{木:'3·8',火:'2·7',土:'5·10',金:'4·9',水:'1·6'}[r.용신]||''}</div>
    </div>
    <div class="c2">
      <div class="lb">음식</div>
      <div style="font-size:6.5pt;">${{木:'신맛·채소·새싹',火:'쓴맛·볶음·구이',土:'단맛·곡물·뿌리',金:'매운맛·생강·마늘',水:'짠맛·해산물·수분'}[r.용신]||''}</div>
    </div>
    <div class="c2" style="flex:1.5;">
      <div class="lb">직업군</div>
      <div style="font-size:6.5pt;">${{木:'교육·언론·출판·의료·환경',火:'예술·방송·요식·IT·마케팅',土:'부동산·건축·농업·중개·관리',金:'금융·법률·기계·정밀·군경',水:'무역·유통·물류·연구·컨설팅'}[r.용신]||''}</div>
    </div>
  </div>

  <div class="sc">▣ ${올해}년 핵심 · 근묘화실 · 건강 주의</div>
  <div class="r2">
    <div class="c2" style="font-size:6.5pt;">
      <div class="lb">${올해}년 핵심 한 줄</div>
      <div style="font-weight:700;color:${세운성격.c};">${(() => {
        const dto = TG_OH[r.현재대운?.천간], djo = JJ_OH[r.현재대운?.지지];
        const dType = (dto===r.용신||djo===r.용신)?'용신':(dto===r.희신||djo===r.희신)?'희신':(dto===r.기신||djo===r.기신)?'기신':'중립';
        const 전략 = {
          '용신대운+용신세운':'최고의 해, 과감하게 도전',
          '용신대운+희신세운':'순조로운 흐름, 적극 추진',
          '용신대운+기신세운':'좋은 대운이지만 올해만 주의',
          '용신대운+중립세운':'안정적, 꾸준히 전진',
          '희신대운+용신세운':'기회가 오는 해, 놓치지 마세요',
          '희신대운+희신세운':'순탄한 흐름, 기반 다지기',
          '희신대운+기신세운':'흐름은 좋으나 올해 신중히',
          '희신대운+중립세운':'무난한 해, 준비에 집중',
          '기신대운+용신세운':'어려운 시기의 구원의 해',
          '기신대운+희신세운':'버티는 힘이 생기는 해',
          '기신대운+기신세운':'가장 어려운 해, 보수적으로',
          '기신대운+중립세운':'내실 다지기의 해',
          '중립대운+용신세운':'새로운 기회, 적극 활용',
          '중립대운+희신세운':'안정 속 성장',
          '중립대운+기신세운':'평소보다 신중하게',
          '중립대운+중립세운':'현상 유지, 실력 축적',
        };
        return 전략[dType+'대운+'+세운성격.t] || dType+'대운 + '+세운성격.t;
      })()}</div>
    </div>
    <div class="c2" style="font-size:6pt;">
      <div class="lb">근묘화실(根苗花實)</div>
      <div style="line-height:1.8;">
        <span style="color:#8a6d3b;">根</span>(뿌리·초년) <span style="color:${OH_CLR[TG_OH[w.년주.천간]]}">${w.년주.천간}(${TG_KR[w.년주.천간]})</span><span style="color:${OH_CLR[JJ_OH[w.년주.지지]]}">${w.년주.지지}(${JJ_KR[w.년주.지지]})</span><br>
        <span style="color:#2e7d32;">苗</span>(싹·중년) <span style="color:${OH_CLR[TG_OH[w.월주.천간]]}">${w.월주.천간}(${TG_KR[w.월주.천간]})</span><span style="color:${OH_CLR[JJ_OH[w.월주.지지]]}">${w.월주.지지}(${JJ_KR[w.월주.지지]})</span><br>
        <span style="color:#e65100;">花</span>(꽃·전성기) <span style="color:${OH_CLR[TG_OH[w.일주.천간]]}">${w.일주.천간}(${TG_KR[w.일주.천간]})</span><span style="color:${OH_CLR[JJ_OH[w.일주.지지]]}">${w.일주.지지}(${JJ_KR[w.일주.지지]})</span><br>
        <span style="color:#1565c0;">實</span>(열매·말년) <span style="color:${OH_CLR[TG_OH[w.시주.천간]]}">${w.시주.천간}(${TG_KR[w.시주.천간]})</span><span style="color:${OH_CLR[JJ_OH[w.시주.지지]]}">${w.시주.지지}(${JJ_KR[w.시주.지지]})</span>
      </div>
    </div>
    <div class="c2" style="font-size:6pt;">
      <div class="lb">건강 주의</div>
${(() => {
  const 약오행 = Object.entries(오행점수).sort((a,b)=>a[1]-b[1])[0]?.[0] || '';
  const 계통맵 = {木:'간·담낭·근육·눈',火:'심장·혈액·소장',土:'비장·위장·소화기',金:'폐·대장·피부·코',水:'신장·방광·뼈·귀'};
  const 계절맵 = {木:'봄(과잉 시)',火:'여름(과잉 시)',土:'환절기',金:'가을(과잉 시)',水:'겨울(과잉 시)'};
  return `      <div style="line-height:1.8;">
        <span style="color:#c62828;">취약</span> <span style="color:${OH_CLR[약오행]};font-weight:600;">${약오행}(${OH_KR[약오행]})</span> ${계통맵[약오행]||''}<br>
        <span style="color:#e65100;">계절</span> ${계절맵[약오행]||''}<br>
        <span style="color:#2e7d32;">보완</span> 용신 <span style="color:${OH_CLR[r.용신]};font-weight:600;">${r.용신}(${OH_KR[r.용신]})</span> 방향 양생
      </div>`;
})()}
    </div>
  </div>

</div>
</body></html>`;

  const outDir = (() => {
    if (isAbs) { const t = path.join(slotId,'tables'); if (fs.existsSync(t)) return t; }
    const bySlot = path.join(TABLES_DIR, slotId);
    if (fs.existsSync(bySlot)) return bySlot;
    fs.mkdirSync(bySlot, {recursive:true});
    return bySlot;
  })();
  fs.writeFileSync(path.join(outDir, '명식표.html'), html, 'utf-8');
  console.log(`  ✅ 명식표 생성: ${path.join(outDir, '명식표.html')}  (${Buffer.byteLength(html)}B)`);
}

const slotArg = process.argv[2];
if (!slotArg) { console.error('사용법: node generate_명식표.js <슬롯ID>'); process.exit(1); }
generate(slotArg);
