'use strict';
const path = require('path');

// WeasyPrint 및 브라우저에서 모두 동작하는 로컬 폰트 경로
const FONT_DIR = path.join(__dirname, 'fonts');
const FONT_BASE = `file:///${FONT_DIR.replace(/\\/g, '/')}`;

const FONT_FACE_CSS = `
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-Thin.ttf') format('truetype'); font-weight:100; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-ExtraLight.ttf') format('truetype'); font-weight:200; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-Light.ttf') format('truetype'); font-weight:300; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-Regular.ttf') format('truetype'); font-weight:400; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-Medium.ttf') format('truetype'); font-weight:500; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-SemiBold.ttf') format('truetype'); font-weight:600; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-Bold.ttf') format('truetype'); font-weight:700; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-ExtraBold.ttf') format('truetype'); font-weight:800; }
@font-face { font-family:'Noto Sans KR'; src:url('${FONT_BASE}/NotoSansKR-Black.ttf') format('truetype'); font-weight:900; }
@font-face { font-family:'Noto Serif KR'; src:url('${FONT_BASE}/NotoSerifKR-Regular.otf') format('opentype'); font-weight:400; }
@font-face { font-family:'Noto Serif KR'; src:url('${FONT_BASE}/NotoSerifKR-Light.otf') format('opentype'); font-weight:300; }
@font-face { font-family:'Noto Serif KR'; src:url('${FONT_BASE}/NotoSerifKR-Medium.otf') format('opentype'); font-weight:500; }
@font-face { font-family:'Noto Serif KR'; src:url('${FONT_BASE}/NotoSerifKR-SemiBold.otf') format('opentype'); font-weight:600; }
@font-face { font-family:'Noto Serif KR'; src:url('${FONT_BASE}/NotoSerifKR-Bold.otf') format('opentype'); font-weight:700; }
@font-face { font-family:'Noto Serif KR'; src:url('${FONT_BASE}/NotoSerifKR-ExtraBold.ttf') format('truetype'); font-weight:800; }
@font-face { font-family:'Noto Serif KR'; src:url('${FONT_BASE}/NotoSerifKR-Black.otf') format('opentype'); font-weight:900; }
@font-face { font-family:'Noto Sans TC'; src:url('${FONT_BASE}/NotoSansTC-Regular.ttf') format('truetype'); font-weight:400; }
@font-face { font-family:'Noto Sans TC'; src:url('${FONT_BASE}/NotoSansTC-Bold.ttf') format('truetype'); font-weight:700; }`.trim();

// 서버 경로 버전 (브라우저에서 localhost로 열 때 사용)
const FONT_WEB = '/static/fonts';
const FONT_FACE_WEB_CSS = FONT_FACE_CSS.replace(new RegExp(FONT_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), FONT_WEB);

module.exports = { FONT_BASE, FONT_FACE_CSS, FONT_WEB, FONT_FACE_WEB_CSS };
