'use strict';
const { 브랜드블록, 결혼블록, 자녀블록, 고민강조블록, 고민강조블록_짧음, 형제블록, 부모블록, 건강블록, injectCh08Fields } = require('./ch_personal_db');

const fs   = require('fs');
const path = require('path');
const { DB_CH09, 십성해석, 운성해석, 월성격조언 } = require('./ch09_db');

const BANYA_CSS = '';



function main() {
  const jsonArg    = process.argv[2] || 'choi_wonsuk_ch09.json';
  const tplFile    = process.argv[3] || path.join(__dirname, 'ch09_template.txt');
  
  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(__dirname, 'queue', jsonArg);
const samplesDir = path.dirname(jsonPath);
  const M = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let tpl = fs.readFileSync(tplFile, 'utf8');

  // ── 슬롯 맵 (문자열 필드만) ──
  const slots = {};
  for (const [k, v] of Object.entries(M)) {
    if (typeof v === 'string') slots[k] = v;
  }


  // ch08 공유 필드 주입 (기신오행, 현재대운성격 등)
  injectCh08Fields(M, samplesDir, slots);
  // ── 슬롯 치환 ──
  for (const [k, v] of Object.entries(slots)) {
    tpl = tpl.replaceAll(`{{${k}}}`, v);
  }

  // ── <<IF>> 처리 ──
  tpl = tpl.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
    const [k, v] = condStr.trim().split('=');
    return (slots[k] ?? '') === v ? block : '';
  });

  function applySlots(text) {
    if (typeof text !== 'string') return String(text ?? '');
    for (const [k, v] of Object.entries(slots)) text = text.replaceAll(`{{${k}}}`, v ?? '');
    let prev;
    do {
      prev = text;
      text = text.replace(/<<IF ([^>]+)>>([\s\S]*?)<<ENDIF>>/g, (_, condStr, block) => {
        const conds = condStr.trim().split(/\s+/);
        const pass = conds.every(cond => {
          const [k, v] = cond.split('=');
          return (slots[k] ?? '') === v;
        });
        return pass ? block : '';
      });
    } while (text !== prev);
    text = text.replace(/<<ENDIF>>/g, '');
    return text;
  }

  function 날짜목록(arr) {
    return arr.map(x => `${x.d}일(${x.표기})`).join(', ');
  }

  function build월운텍스트(obj) {
    if (typeof obj === 'string') return applySlots(obj);
    if (!obj || typeof obj !== 'object') return '';

    const { 월이름: mn, 간지, to, jo, 십성명, 십성한자, 운성명, 성격, 절기,
            용신일=[], 희신일=[], 기신일=[], 중립일=[],
            최고날목록=[], 조심날목록=[] } = obj;

    const 연도표시 = obj.월 === 1 ? ` (${parseInt(slots['내년'] || slots['올해'] || '2026') }년)` : '';
    let txt = `✦ ${mn}${연도표시} 月운세   ${간지}  [${성격}]\n`;
    txt += `${절기 ? 절기+' 절기가 드는 달' : ''}\n`;
    txt += `천간 ${obj.천간}(${obj.천간음}) ${to} | 지지 ${obj.지지}(${obj.지지음}) ${jo}`;
    txt += ` | 십성 ${십성명}(${십성한자}) | 12운성 ${운성명}\n\n`;

    if (십성해석[십성명]) txt += applySlots(십성해석[십성명]) + '\n\n';
    if (운성해석[운성명]) txt += applySlots(운성해석[운성명]) + '\n\n';
    if (월성격조언[성격]) {
      // 맺음말 로테이션: 같은 유형이 반복될 때 다른 표현 사용
      const _맺음키 = `_${성격}맺음말목록`;
      const _맺음목록 = 월성격조언[_맺음키];
      const _월번호 = (typeof obj.월 === 'number' ? obj.월 : parseInt(obj.월) || 1);
      let 본문 = 월성격조언[성격];
      if (_맺음목록 && Array.isArray(_맺음목록)) {
        // 기본 맺음말 제거 후 로테이션 버전 삽입
        const _기본맺음 = _맺음목록[0];
        const _로테이션맺음 = _맺음목록[(_월번호 - 1) % _맺음목록.length];
        본문 = 본문.replace(_기본맺음, _로테이션맺음);
      }
      txt += applySlots(본문) + '\n\n';
    }

    // ── 달력 기반 월별 요약 (generate_운세달력 로직 연동) ──
    const 요약 = obj.달력요약;
    if (요약) {
      txt += `✦ ${mn} 달력 기반 운세 요약\n\n`;
      const _gil = 요약.길일수 > 0 ? `길일 ${요약.길일수}일` : '특별한 길일 없음';
      const _hyu = 요약.흉일수 > 0 ? `주의일 ${요약.흉일수}일` : '주의일 없음';
      txt += `이 달 ${_gil}, ${_hyu}\n`;
      if (요약.대길일목록 && 요약.대길일목록.length > 0) {
        txt += `🌟 대길일: ${요약.대길일목록.map(x => `${x.d}일(${x.표기})`).join(', ')}\n`;
      }
      if (요약.대주의일목록 && 요약.대주의일목록.length > 0) {
        txt += `⚠️ 대주의일: ${요약.대주의일목록.map(x => `${x.d}일(${x.표기})`).join(', ')}\n`;
      } else if (요약.흉일목록 && 요약.흉일목록.length > 0) {
        txt += `⚠️ 주의일: ${요약.흉일목록.slice(0,3).map(x => `${x.d}일(${x.표기})`).join(', ')}\n`;
      }
      if (요약.최고점수일) {
        txt += `📈 최고 에너지일: ${요약.최고점수일.d}일(${요약.최고점수일.표기}) ${요약.최고점수일.score}점\n`;
      }
      if (요약.최저점수일) {
        txt += `📉 최저 에너지일: ${요약.최저점수일.d}일(${요약.최저점수일.표기}) ${요약.최저점수일.score}점\n`;
      }
      if (요약.손없는날목록 && 요약.손없는날목록.length > 0) {
        txt += `손없는날: ${요약.손없는날목록.map(d => d+'일').join(', ')} (이사·행사 적합)\n`;
      }
      if (요약.역마일목록 && 요약.역마일목록.length > 0) {
        txt += `역마일: ${요약.역마일목록.map(d => d+'일').join(', ')} (여행·이동 좋은 날)\n`;
      }
      if (요약.도화일목록 && 요약.도화일목록.length > 0) {
        txt += `도화일: ${요약.도화일목록.map(d => d+'일').join(', ')} (인연·미용 좋은 날)\n`;
      }
      if (요약.충일목록 && 요약.충일목록.length > 0) {
        txt += `충(衝)일: ${요약.충일목록.map(x => x.d+'일').join(', ')} (변화·갈등 주의)\n`;
      }
      txt += `용신일 비율: ${요약.용신일비율}%\n`;
      txt += '\n';
    }

    txt += `✦ ${mn} 날짜별 길흉 가이드\n\n`;

    if (최고날목록.length > 0) {
      txt += `★ 가장 좋은 날 (용신일 ${최고날목록.length}일)\n`;
      txt += `   ${날짜목록(최고날목록)}\n\n`;
      txt += `   ${applySlots('{{좋은날용도}} 좋아요.')}\n`;
    }
    if (희신일.length > 0) {
      txt += `☆ 비교적 좋은 날 (희신일 ${희신일.length}일)\n`;
      txt += `   ${날짜목록(희신일)}\n\n`;
    }
    if (중립일.length > 0) {
      txt += `△ 무난한 날 (중립일 ${중립일.length}일)\n`;
      txt += `   ${날짜목록(중립일)}\n\n`;
    }
    if (조심날목록.length > 0) {
      txt += `▼ 조심이 필요한 날 (기신일 ${조심날목록.length}일)\n`;
      txt += `   ${날짜목록(조심날목록)}\n\n`;
    }

    txt += `✦ {{선생님이름}}의 이 달 핵심 조언\n\n`;

    const 이름 = slots['이름'] || '';
    const 선생님 = slots['선생님이름'] || '반야선생';
    const 활동상태 = slots['활동상태'] || '';

    // 같은 유형 월이 반복될 때 다른 표현을 쓰기 위한 인덱스 (월 번호 기반)
    const _월인덱스 = (typeof obj.월 === 'number' ? obj.월: parseInt(obj.월) || 1) - 1;

    const 용신월변형 = [
      `이 달은 ${이름} 님에게 가장 적극적으로 움직여야 할 달이에요. 용신 기운이 작동하는 달인 만큼, ${활동상태 ? `${활동상태}으로서의 ` : ''}중요한 결정과 새로운 시작을 이 달에 집중시키십시오.`,
      `${이름} 님의 에너지가 가장 잘 살아나는 달이에요. 밀어붙여야 할 일이 있다면 지금이 때이에요. ${활동상태 ? `${활동상태} ` : ''}활동에서도 주도적으로 나서는 것이 유리해요.`,
      `용신 기운이 들어오는 달이에요. 망설이던 결정을 내리거나 새 흐름을 여는 것을 이 달에 집중하세요. ${이름} 님의 직관이 가장 잘 맞는 때이기도 해요.`,
      `이 달은 ${이름} 님이 치고 나가야 할 시기예요. 에너지가 충전되고 상황이 유리하게 맞아 떨어지는 달이에요. 중요한 미팅이나 계약, 시작은 이 달 안에 실행하세요.`,
    ];
    const 희신월변형 = [
      `이 달은 ${이름} 님에게 안정 속에 꾸준히 쌓아가는 달이에요. 묵묵히 해온 것들이 인정받고 신뢰가 깊어지는 흐름이에요. 큰 결정보다 지금 하는 일에 집중하세요. 이 달에 맺은 인연이 오래 이어집니다.`,
      `실력을 조용히 쌓기에 좋은 달이에요. 화려한 결과보다 기반을 다지는 데 집중하면 나중에 큰 성과로 돌아와요. 인간관계에서도 따뜻한 신뢰를 쌓는 달로 활용하세요.`,
      `흐름이 순조로운 달이에요. ${이름} 님이 지금까지 해온 노력이 서서히 인정받기 시작하는 때이에요. 조급해하지 않아도 돼요, 이 달은 자연스럽게 좋아지는 달이에요.`,
    ];
    const 기신월변형 = [
      `이 달은 ${이름} 님에게 버티고 지키는 달이에요. 큰 결정은 다음 달로 미루고, 현재를 지키는 것을 최우선으로 하세요. 에너지를 아끼십시오. 이 달을 조용히 잘 넘기는 것이 다음 용신달을 잘 탈 수 있는 준비이에요.`,
      `이 달은 힘을 비축하는 달이에요. 새로운 것을 시작하기보다 지금 있는 것을 잘 지키는 전략이 맞아요. 예상치 못한 소모가 생기더라도 침착하게 대응하세요.`,
      `에너지가 분산되기 쉬운 달이에요. ${이름} 님의 강점은 내실이니, 이 달은 외부 활동을 줄이고 역량을 재충전하는 시간으로 활용하는 것이 현명해요.`,
    ];
    const 중립월변형 = [
      `이 달은 ${이름} 님에게 일한 만큼 나오는 공정한 달이에요. 묵묵히 실력을 발휘하고 신뢰를 쌓는 것이 전략이에요.`,
      `특별히 좋거나 나쁜 기운 없이 중립적인 달이에요. 꾸준한 루틴을 유지하면서 다음 용신달을 준비하세요.`,
    ];

    const 핵심본문변형맵 = { 용신월: 용신월변형, 희신월: 희신월변형, 기신월: 기신월변형, 중립월: 중립월변형 };
    const _변형목록 = 핵심본문변형맵[성격] || 중립월변형;
    const _핵심 = _변형목록[_월인덱스 % _변형목록.length];

    // 용신월은 최고의 날 추가
    const 좋은날 = 최고날목록.slice(0,3).map(x=>x.d+'일').join(', ');
    const 핵심본문str = 성격 === '용신월' && 좋은날
      ? _핵심 + ` ★ 최고의 날: ${좋은날}`
      : _핵심;

    txt += applySlots(핵심본문str) + '\n';
    return applySlots(txt);
  }

  function build월운개별() {
    const 순서 = ['2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월','1월'];
    return 순서.map(월 => {
      const obj = M[`월운_${월}`];
      if (!obj) return '';
      return build월운텍스트(obj);
    }).filter(Boolean).join('\n\n');
  }











  function resolveBlock(tag) {
    if (tag === 'BRAND.안내') return applySlots(브랜드블록.안내);
    if (tag.startsWith('PERSONAL.')) {
      if (tag === 'PERSONAL.고민') return applySlots(고민강조블록_짧음[M.고민분야] || 고민강조블록_짧음['종합']);
      if (tag === 'PERSONAL.결혼') return applySlots(결혼블록[M.결혼상태] || 결혼블록['미혼']);
    }
    if (!tag.startsWith('CH09.')) return `[NS없음: ${tag}]`;
    const section = tag.split('.')[1];
    if (section === '월별길흉막대그래프') return '';
    if (section === '연간운세요약' || section === '연간_요약표') return '';
    if (section === '대운_대운표') return '';
    if (section === '세운_세운표') return '';
    if (section === '월운_월운표') return '';
    if (section === '월운_개별') return applySlots(build월운개별());
    const node = DB_CH09[section];
    if (!node) return `[CH09없음: ${section}]`;
    return applySlots(typeof node === 'string' ? node : (node[tag.split('.')[2]] || ''));
  }

  tpl = tpl.replace(/\[\[([^\]]+)\]\]/g, (_, tag) => {
    const resolved = tag.replace(/\{\{([^}]+)\}\}/g, (__, k) => slots[k] ?? k);
    if (resolved === 'CH10.세운_월운_달력' || resolved === 'CH10.세운월운달력') return '';
    if (resolved === 'CH10.대운_대운표') return '';
    if (resolved === 'CH10.세운_세운표') return '';
    if (resolved === 'CH10.월운_월운표') return '';
    if (resolved === 'CH10.연간_요약표') return '';
    if (resolved === 'CH10.월별길흉막대그래프') return '';
    return resolveBlock(resolved);
  });

  tpl = tpl.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';
  const outPath = path.join(samplesDir, `${M.id || M.이름}_ch09_result.txt`);
  // {{슬롯}} 잔재 치환 (제목줄 등 [[]] 밖에 있는 것)
  tpl = applySlots(tpl);

  fs.writeFileSync(outPath, tpl, 'utf8');
  console.log(`✅ 렌더링 완료: queue/${path.basename(outPath)}`);
}

main();
