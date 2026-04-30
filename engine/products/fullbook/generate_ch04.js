'use strict';

// ── 신강약 정규화 헬퍼 ──
function _normalize신강약(raw) {
  if (!raw) return '신약(身弱)';
  if (/강신약/.test(raw)) return '신약(身弱)';
  if (/약신강/.test(raw)) return '신강(身强)';
  if (/강신강/.test(raw)) return '신강(身强)';
  if (/약신약/.test(raw)) return '신약(身弱)';
  if (raw.includes('('))  return raw;
  return raw.includes('강') ? '신강(身强)' : '신약(身弱)';
}
const fs   = require('fs');
const path = require('path');
const { 전체사주계산, 오행점수계산, 오행등급, 천간오행, 지지오행, 천간음양, 지지음양, 지지띠, 천간한글, 지지한글, _양력to음력 } = require('../../saju_calc');


const inputArg   = process.argv[2] || 'choi_wonsuk_master.json';
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, 'queue', inputArg);
const samplesDir = path.dirname(inputPath);
const M = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const 결과 = 전체사주계산({
  이름: M.이름, 음력입력: M.음력입력 ?? true, 윤달: M.윤달,
  년: M.생년, 월: M.생월, 일: M.생일,
  시간: M.생시, 성별: M.성별 ?? '남',
  활동상태: M.활동상태, 결혼상태: M.결혼상태, 자녀: M.자녀,
  고민분야: M.고민분야, 형제유무: M.형제유무, 부모상황: M.부모상황, 건강관심: M.건강관심, self_q1: M.self_q1, self_q2: M.self_q2, self_q3: M.self_q3, self_q4: M.self_q4, self_q5: M.self_q5, self_q6: M.self_q6, self_q7: M.self_q7,
});

// ⚠️ saju_calc 결과가 정확하므로, saju_engine으로 억부용신을 덮어쓰지 않음

// ── 신살(神殺) 슬롯 추가 ──
const 신살 = 결과.신살 || {};
const 길신목록 = [];
const 흉살목록 = [];
// 길신
if ((신살.천을귀인||[]).length) 길신목록.push(`천을귀인(天乙貴人) ${(신살.천을귀인||[]).join('·')}에 위치`);
if ((신살.문창귀인||[]).length) 길신목록.push(`문창귀인(文昌貴人) ${(신살.문창귀인||[]).join('·')}에 위치`);
if ((신살.태극귀인||[]).length) 길신목록.push(`태극귀인(太極貴人) ${(신살.태극귀인||[]).join('·')}에 위치`);
if ((신살.천덕귀인||[]).length) 길신목록.push(`천덕귀인(天德貴人) ${(신살.천덕귀인||[]).join('·')}에 위치`);
if ((신살.월덕귀인||[]).length) 길신목록.push(`월덕귀인(月德貴人) ${(신살.월덕귀인||[]).join('·')}에 위치`);
// 흉살
if ((신살.도화살||[]).length) 흉살목록.push(`도화살(桃花殺) ${(신살.도화살||[]).join('·')}에 위치`);
if ((신살.홍염살||[]).length) 흉살목록.push(`홍염살(紅艶殺) ${(신살.홍염살||[]).join('·')}에 위치`);
if ((신살.백호대살||[]).length) 흉살목록.push(`백호대살(白虎大殺) ${(신살.백호대살||[]).join('·')}에 위치`);
if ((신살.괴강살||[]).length) 흉살목록.push(`괴강살(魁罡殺) ${(신살.괴강살||[]).join('·')}에 위치`);
// 12신살
const 신살12 = 신살.신살_12 || {};
if ((신살12.역마살||[]).length) 흉살목록.push(`역마살(驛馬殺) ${신살12.역마살.join('·')}에 위치`);
if ((신살12.장성살||[]).length) 길신목록.push(`장성살(將星殺) ${신살12.장성살.join('·')}에 위치`);

const 길신요약 = 길신목록.length ? 길신목록.join(' / ') : '없음';
const 흉살요약 = 흉살목록.length ? 흉살목록.join(' / ') : '없음';
const 도화살유무 = (신살.도화살||[]).length > 0 ? '있음' : '없음';
const 역마살유무 = (신살12.역마살||[]).length > 0 ? '있음' : '없음';
const 천을귀인유무 = (신살.천을귀인||[]).length > 0 ? '있음' : '없음';
const 백호살유무 = (신살.백호대살||[]).length > 0 ? '있음' : '없음';
const 홍염살유무 = (신살.홍염살||[]).length > 0 ? '있음' : '없음';
const 괴강살유무 = (신살.괴강살||[]).length > 0 ? '있음' : '없음';

// ── 오행 분포 슬롯 추가 ──
const 오행점수 = 오행점수계산(결과.원국);
const 오행등급결과 = {};
for (const [o, s] of Object.entries(오행점수)) {
  오행등급결과[o] = 오행등급(s);
}
const 태과오행 = Object.entries(오행등급결과).filter(([,v])=>v==='매우강'||v==='강').map(([k])=>k).join('·') || '없음';
const 불급오행 = Object.entries(오행등급결과).filter(([,v])=>v==='매우약'||v==='약').map(([k])=>k).join('·') || '없음';
const 오행분포요약 = Object.entries(오행등급결과)
  .map(([o,g])=>`${o}(${g})`)
  .join(' ');


const 오행순위 = 결과.오행순위; // [{오행,점수,등급,한글}, ...]

// ── 오행균형점수 직접 계산 (5개 점수의 균등 분포 기준) ──
const 합계 = Object.values(오행점수).reduce((a,b)=>a+b, 0);
const 정규화 = Object.values(오행점수).map(v => v / 합계 * 100);
const 편차합 = 정규화.reduce((a,b) => a + Math.abs(b - 20), 0);
const 균형점수 = Math.max(0, Math.round(100 - 편차합));

// ── 오행등급목록 슬롯 생성 (막대그래프형 텍스트 포함) ──
const 오행한글 = { 木:'목',火:'화',土:'토',金:'금',水:'수' };
function 막대(점수, 최대) {
  const 칸수 = Math.round(점수 / 최대 * 20);
  return '█'.repeat(칸수) + '░'.repeat(20 - 칸수);
}
const 최대점수 = Math.max(...Object.values(오행점수));

const 오행등급목록 = 오행순위.map(r => {
  const bar = 막대(r.점수, 최대점수);
  return `${r.오행}(${r.한글}) [${bar}] ${r.점수.toFixed(1)}점 · ${r.등급}`;
}).join('\n');

// ── [NEW] 오행 개수 및 음양 빈도 분석 ──
const 띠동물 = {
  子:'🐉 쥐', 丑:'🐮 소', 寅:'🐯 호랑이', 卯:'🐰 토끼', 辰:'🐉 용',
  巳:'🐍 뱀', 午:'🐴 말', 未:'🐏 양', 申:'🐵 원숭이',酉:'🐔 닭', 戌:'🐶 개', 亥:'🐷 돼지'
};
const 띠표   = { 子:'쥐',丑:'소',寅:'호랑이',卯:'토끼',辰:'용',巳:'뱀',午:'말',未:'양',申:'원숭이',酉:'닭',戌:'개',亥:'돼지' };
const 오행색상 = { 木: '#4caf50', 火: '#f44336', 土: '#ffb300', 金: '#9e9e9e', 水: '#2196f3' };
const 오행한자 = { 木: '木', 火: '火', 土: '土', 金: '金', 水: '水' };

const 원국 = 결과.원국;
const 기둥들 = [원국.년주, 원국.월주, 원국.일주, 원국.시주];
const ohaeng_counts = { 木:0, 火:0, 土:0, 金:0, 水:0 };
let yang_count = 0, yin_count = 0;

기둥들.forEach(p => {
  ohaeng_counts[천간오행[p.천간]]++;
  ohaeng_counts[지지오행[p.지지]]++;
  if (천간음양[p.천간] === '양') yang_count++; else yin_count++;
  if (지지음양[p.지지] === '양') yang_count++; else yin_count++;
});

// ── [NEW] 현대적 비유 (세대별 오행 키워드) ──
function getModernMeta(ohaeng, 만나이) {
  const meta = {
    '木': { title: '스타트업 개척 정신', desc: '새로운 시스템을 설계하고 첫 발을 떼는 강력한 추진 에너지' },
    '火': { title: '브랜딩 및 퍼포먼스', desc: '자신을 알리고 열정을 전파하여 무대를 장악하는 표현 에너지' },
    '土': { title: '플랫폼 및 신뢰 자산', desc: '모든 것을 연결하고 갈등을 조율하며 중심을 잡는 안정 에너지' },
    '金': { title: '데이터 및 핵심 로직', desc: '핵심만 남기고 냉철하게 판단하며 실수를 줄이는 분석 에너지' },
    '水': { title: '전략적 통찰 및 지혜', desc: '흐름을 읽고 보이지 않는 리스크까지 관리하는 유연한 에너지' }
  };
  if (만나이 >= 50) {
    meta['木'].title = '새로운 인생 설계'; meta['火'].title = '사회적 영향력 전파';
    meta['土'].title = '경험의 안정적 자산화'; meta['金'].title = '거름망 같은 노련함';
    meta['水'].title = '삶의 통찰과 지혜';
  }
  return meta[ohaeng];
}

const 만나이 = 결과.만나이;
const generation_label = 만나이 < 20 ? '알파세대' : 만나이 < 40 ? 'MZ세대' : 만나이 < 60 ? 'X세대' : '시니어세대';

// 오행 테이블용 데이터 객체 배열 생성
const ohaeng_data_list = ['木','火','土','金','水'].map(key => {
  const meta = getModernMeta(key, 만나이);
  return {
    key: key === '木' ? 'wood' : key === '火' ? 'fire' : key === '土' ? 'earth' : key === '金' ? 'metal' : 'water',
    name: `${key}(${오행한글[key]})`,
    count: ohaeng_counts[key],
    score: 오행점수[key].toFixed(1),
    status: 오행등급결과[key],
    color: 오행색상[key],
    hanja: key,
    hanja_um: 오행한글[key],
    meta_title: meta.title,
    meta_desc: meta.desc
  };
});

// [PRE-RENDER] 오행 분석용 행 생성
const ohaeng_table_rows = ohaeng_data_list.map(item => {
  const scoreNum = parseFloat(item.score);
  // 점수에 따른 상태 색상 (ohaeng_test.html 로직: 4.0이상 강조, 2.0미만 연하게)
  const statusColor = scoreNum >= 4.0 ? '#d32f2f' : (scoreNum < 2.0 && scoreNum > 0) ? '#666' : scoreNum === 0 ? '#888' : '#333';
  return `
                <tr>
                    <td><span class="ohaeng-label ${item.key}">${item.name}</span></td>
                    <td>${item.count}개</td>
                    <td style="width: 150px;">
                        <span style="font-weight:700;">${item.score}점</span>
                        <div class="strength-container"><div class="strength-bar" style="width: ${Math.round((scoreNum / 최대점수) * 100)}%; max-width: 100%; background: ${item.color};"></div></div>
                    </td>
                    <td><span style="color:${statusColor}"><strong>${item.status}</strong></span></td>
                </tr>`;
}).join('');

// [PRE-RENDER] 오행 상세용 행 생성
const ohaeng_detail_rows = ohaeng_data_list.map(item => `
                    <tr>
                        <td class="col-hanja" style="color: ${item.color}; font-size: 24px;">${item.hanja}</td>
                        <td class="col-name"><strong>${item.hanja_um}</strong></td>
                        <td class="col-desc">
                            <b>${item.meta_title}:</b> ${item.meta_desc}
                        </td>
                        <td class="col-score">
                            <strong>${item.status} (${item.score}점)</strong>
                        </td>
                    </tr>`).join('');

// ── 개별 점수 슬롯 ──
const ch04 = {
  이름:         결과.이름,
  길신요약,
  흉살요약,
  도화살유무,
  역마살유무,
  천을귀인유무,
  백호살유무,
  홍염살유무,
  괴강살유무,
  오행분포요약,
  태과오행,
  불급오행,
  木등급: 오행등급결과['木'],
  火등급: 오행등급결과['火'],
  土등급: 오행등급결과['土'],
  金등급: 오행등급결과['金'],
  水등급: 오행등급결과['水'],
  목점수:       오행점수['木'].toFixed(1),
  화점수:       오행점수['火'].toFixed(1),
  토점수:       오행점수['土'].toFixed(1),
  금점수:       오행점수['金'].toFixed(1),
  수점수:       오행점수['水'].toFixed(1),
  최강오행:     `${오행순위[0].오행}(${오행순위[0].한글})`,
  최강오행한자:  오행순위[0].오행,
  최약오행:     `${오행순위[4].오행}(${오행순위[4].한글})`,
  최약오행한자:  오행순위[4].오행,
  // 최약오행이 용신/희신/기신 중 어느 역할인지
  최약오행역할: (() => {
    const 약 = 오행순위[4].오행;
    const 용 = (결과.용신||'').trim();
    const 희 = (결과.희신||'').trim();
    const 병 = (결과.기신||'').trim();
    if (약===용) return '용신';
    if (약===희) return '희신';
    if (약===병) return '기신';
    return '한신';
  })(),
  최강오행역할: (() => {
    const 강 = 오행순위[0].오행;
    const 용 = (결과.용신||'').trim();
    const 희 = (결과.희신||'').trim();
    const 병 = (결과.기신||'').trim();
    if (강===용) return '용신';
    if (강===희) return '희신';
    if (강===병) return '기신';
    return '한신';
  })(),
  최강오행등급: 오행순위[0].등급,
  최약오행등급: 오행순위[4].등급,
  오행균형점수: 균형점수.toString(),
  오행등급목록: 오행등급목록,
  // 2위~4위 슬롯 (순위별 해석 블록 선택용)
  이위오행:     `${오행순위[1].오행}(${오행순위[1].한글})`,
  삼위오행:     `${오행순위[2].오행}(${오행순위[2].한글})`,
  사위오행:     `${오행순위[3].오행}(${오행순위[3].한글})`,
  // 신강약
  신강약: _normalize신강약(결과.신강약),
  // 취약장기
  취약장기목록: (() => {
    const 맵 = {'木':'간(肝)·담(膽)','火':'심장(心臟)·소장(小腸)','土':'비장(脾臟)·위(胃)','金':'폐(肺)·대장(大腸)','水':'신장(腎臟)·방광(膀胱)'};
    const 불급 = Object.entries(오행등급결과).filter(([,v])=>v==='매우약'||v==='약').map(([k])=>k);
    return 불급.map(o=>맵[o]||o).join('·') || '없음';
  })(),
  // ── 일주·일간 슬롯 추가 ──
  일주:         (() => {
    const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
    const 지지음 = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
    const 간 = 결과.원국.일주.천간, 지 = 결과.원국.일주.지지;
    return `${간}${지}(${천간음[간]}${지지음[지]})`;
  })(),
  일간:         (() => {
    const 천간음 = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
    const 오행표 = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
    const 간 = 결과.원국.일주.천간;
    return `${간}${오행표[간]}(${천간음[간]}${오행표[간].toLowerCase().replace('木','목').replace('火','화').replace('土','토').replace('金','금').replace('水','수')})`;
  })(),
  // ── 용신 슬롯 추가 ──
  용신색상:     (() => {
    const 맵 = {'火':'적색·주황색','水':'흑색·남색','木':'청색·녹색','金':'백색·금색','土':'황색·갈색'};
    return 맵[(결과.용신||'').trim()] || '';
  })(),
  용신방위:     (() => {
    const 맵 = {'火':'남(南)','水':'북(北)','木':'동(東)','金':'서(西)','土':'중앙'};
    return 맵[(결과.용신||'').trim()] || '';
  })(),
  용신오행:     (() => {
    const 맵 = {'火':'火(화)','水':'水(수)','木':'木(목)','金':'金(금)','土':'土(토)'};
    return 맵[(결과.용신||'').trim()] || '';
  })(),
  용신표기:     (() => {
    const 맵 = {'火':'火(화)','水':'水(수)','木':'木(목)','金':'金(금)','土':'土(토)'};
    return 맵[(결과.용신||'').trim()] || '';
  })(),
  희신오행:     (() => {
    const 맵 = {'火':'火(화)','水':'水(수)','木':'木(목)','金':'金(금)','土':'土(토)'};
    return 맵[(결과.희신||'').trim()] || '';
  })(),
  기신오행:     (() => {
    const 맵 = {'火':'火(화)','水':'水(수)','木':'木(목)','金':'金(금)','土':'土(토)'};
    return 맵[(결과.기신||'').trim()] || '';
  })(),
  억부용신:     (() => {
    const 맵 = {'火':'火(화)','水':'水(수)','木':'木(목)','金':'金(금)','土':'土(토)'};
    return 맵[(결과.억부용신||'').trim()] || '';
  })(),
  조후용신:     (() => {
    const 맵 = {'火':'火(화)','水':'水(수)','木':'木(목)','金':'金(금)','土':'土(토)'};
    return 맵[(결과.조후용신||'').trim()] || '';
  })(),
  // ── 오행 테이블용 상세 슬롯 주입 ──
  user_name: M.이름 || 결과.이름,
  user_age: 만나이.toString(),
  user_gender_kr: M.성별 === '여' ? '여성' : '남성',
  ilju_animal: (() => {
    const d = { 木:'청', 火:'적', 土:'황금', 金:'백', 水:'흑' };
    const 일간 = 원국.일주.천간;
    return `${d[천간오행[일간]]}${띠표[원국.일주.지지]}(${일간}${원국.일주.지지})`;
  })(),
  ilju_animal_emoji: 띠동물[원국.일주.지지] ? 띠동물[원국.일주.지지].split(' ')[0] : '🐉',
  birth_solar: (() => {
    const 시간표기 = `${M.생시 || ''}${String(M.생시||'').endsWith('시')?'':'시'}`.trim();
    if (M.음력입력 && 결과.양력정보) {
      const m = 결과.양력정보.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
      if (m) return `${m[1]}-${m[2]}-${m[3]} ${시간표기}`;
    }
    return `${M.생년}-${M.생월}-${M.생일} ${시간표기}`;
  })(),
  birth_lunar: (() => {
    if (결과.입력음력) return 결과.입력음력;
    const l = _양력to음력({ 양력년: M.생년, 양력월: M.생월, 양력일: M.생일 });
    return l.표시 || '-';
  })(),
  yin_count: yin_count.toString(),
  yang_count: yang_count.toString(),
  generation_label: generation_label,
  ohaeng_table_rows,
  ohaeng_detail_rows,
};
// ── 개인화 슬롯 추가 (saju_calc 통합) ──
for (const k of ['활동상태', '활동명', '활동', '일', '성과', '동료', '관계자', '수입', '재물활동', '계약', '주의인물', '좋은날용도', '조심날설명', '총평단어', '활동설명', '활동조언', '성별', '배우자', '배우자호칭', '배우자와', '배우자와의', '배우자호칭와', '배우자호칭와의', '결혼가족', '형제자매', '본인호칭', '혼인표현', '배우자관계', '결혼상태', '결혼표현', '가족표현', '배우자표현', '결혼강조', '가정표현', '파트너', '자녀', '자녀표현', '자녀관계', '자녀파트', '자녀강조', '고민분야', '고민강조', '고민설명', '고민핵심', '고민파트', '형제유무', '형제표현', '형제관계', '형제설명', '형제강조', '부모상황', '부모표현', '부모관계', '부모설명', '부모강조', '건강관심', '건강깊이', '건강표현', '건강강조', '건강상세여부', '나이대', '만나이', '인생단계', '관심사', '주요이슈', '재물표현', '건강주의', '관심사']) {
  if (결과[k] !== undefined) ch04[k] = 결과[k];
}
if (M.id) ch04.id = M.id;



// ── 브랜드 슬롯 주입 ─────────────────────────────────────────
(function() {
  const _id = M.id || M.이름;
  const _ch00Path = path.join(samplesDir, _id + '_ch00.json');
  try {
    // 1순위: ch00.json
    const ch00data = JSON.parse(fs.readFileSync(_ch00Path, 'utf8'));
    const brandKeys = ['선생님이름','연구소명','서명문구','마무리인사',
                       '호칭조사','선생님이름이','연락처','홈페이지',
                       '카카오채널','브랜드색상','금색','master_id','발행연도','생시모름'];
    brandKeys.forEach(k => { if (ch00data[k] !== undefined) ch04[k] = ch00data[k]; });
  } catch(e) {
    // 2순위: M(master.json) 및 profile.json
    const masterId = M.master_id || 'banya';
    const brandPath = path.join(__dirname, 'brands', masterId, 'profile.json');
    let brand = {};
    try { brand = JSON.parse(fs.readFileSync(brandPath, 'utf8')); } catch(e2) {}
    const brandKeys = ['선생님이름','연구소명','서명문구','마무리인사','호칭조사','연락처','홈페이지','카카오채널','브랜드색상','금색','발행연도'];
    brandKeys.forEach(k => {
      ch04[k] = M[k] || brand[k] || ch04[k] || '';
    });
    ch04['선생님이름이'] = (ch04['선생님이름']||'반야선생') + (ch04['호칭조사']||'이');
    ch04['master_id'] = masterId;
  }
})();

const fileId  = M.id || 결과.이름;
const outPath = path.join(samplesDir, `${fileId}_ch04.json`);

// 용신직업군 슬롯 (saju_calc 용신 기준)
if (!ch04['용신직업군']) {
  const _직업맵 = {木:'교육·출판·유통·농림·환경·패션·디자인',火:'요식업·엔터·마케팅·광고·에너지·IT',土:'부동산·건축·농업·중개·보험·요식',金:'금융·법률·기계·제조·군경·의료기기·회계',水:'무역·물류·수산·관광·미디어·컨설팅'};
  ch04['용신직업군'] = _직업맵[결과.용신] || M.용신직업군 || '연구·기획·유통·무역·IT';
}
// 기신오행 슬롯
ch04['기신오행'] = ch04['기신오행'] || M.기신오행 || M.기신 || '';

fs.writeFileSync(outPath, JSON.stringify(ch04, null, 2), 'utf8');
console.log(`✅ ch04: ${Object.keys(ch04).length}필드 → queue/${path.basename(outPath)}`);
