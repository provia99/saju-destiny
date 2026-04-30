/* SPA-style 부분 네비게이션 — 헤더/슬라이더/하단탭바 고정, <main class="main-content">만 swap */
(function () {
  if (window.__spaNavInit) return;
  window.__spaNavInit = true;

  const MAIN_SELECTOR = 'main.main-content';

  function isInternal(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
    try {
      const u = new URL(a.href, location.href);
      return u.origin === location.origin;
    } catch (_) { return false; }
  }

  function updateActiveStates(url) {
    const u = new URL(url, location.href).pathname;
    document.querySelectorAll('.service-item, .nav-item').forEach(a => {
      try {
        const p = new URL(a.getAttribute('href'), location.href).pathname;
        a.classList.toggle('active', p === u);
      } catch (_) {}
    });
  }

  async function swap(url, push) {
    let resp;
    try {
      resp = await fetch(url, { credentials: 'same-origin' });
    } catch (_) {
      window.location.href = url; return;
    }
    if (!resp.ok || !(resp.headers.get('content-type') || '').includes('text/html')) {
      window.location.href = url; return;
    }
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newMain = doc.querySelector(MAIN_SELECTOR);
    const curMain = document.querySelector(MAIN_SELECTOR);
    if (!newMain || !curMain) { window.location.href = url; return; }

    document.title = doc.title || document.title;

    /* 이전에 SPA로 주입한 style/script 제거 */
    document.querySelectorAll('style[data-spa-injected],script[data-spa-injected]')
      .forEach(el => el.remove());

    /* 새 페이지의 head 내 <style>을 주입 — 단, chrome의 핵심 layout CSS는 이미 있으니
       *페이지별로 다른 스타일*만 가져오기 위해 *body 영역 클래스 매칭* CSS만 가져오면
       이상적이지만 실제로는 풀-CSS를 그대로 주입. 대신 chrome 영역(.service-slider/.bottom-nav 등)에
       transition을 일시 차단해 active class 토글 시 깜빡임 방지. */
    const noTr = document.createElement('style');
    noTr.setAttribute('data-spa-injected', '1');
    noTr.textContent =
      '.service-item,.service-icon,.service-label,' +
      '.nav-item,.nav-icon,.nav-label,.bb-slide,.bb-icon,' +
      '.hdr-icon-btn,.header-icons button,.header-icons a,' +
      '.top-header,.top-header *,.service-slider-wrap,.service-slider' +
      '{transition:none !important;animation:none !important;}';
    document.head.appendChild(noTr);
    /* swap 후 320ms 뒤 transition 복원 (transition: all 0.2s 보다 충분히 길게) */
    setTimeout(() => { try { noTr.remove(); } catch(_){} }, 320);

    doc.querySelectorAll('head style').forEach(s => {
      const ns = document.createElement('style');
      ns.textContent = s.textContent;
      ns.setAttribute('data-spa-injected', '1');
      document.head.appendChild(ns);
    });

    /* main 콘텐츠 교체 */
    curMain.innerHTML = newMain.innerHTML;

    /* 상대/대상 선택 시트(#subjSheetOverlay, #subjSheet)는 main 밖에 있어
       main만 swap하면 stale 상태가 남는다. _page/_pair에 따라 시트의 href·param이
       달라지므로 새 문서의 시트로 교체. */
    ['subjSheetOverlay', 'subjSheet'].forEach(id => {
      const cur = document.getElementById(id);
      const nw  = doc.getElementById(id);
      if (cur && nw) {
        cur.replaceWith(nw);
      } else if (!cur && nw) {
        document.body.appendChild(nw);
      } else if (cur && !nw) {
        cur.remove();
      }
    });

    /* main 안의 <script>는 innerHTML로 들어왔지만 실행되지 않으므로 재생성 */
    curMain.querySelectorAll('script').forEach(oldS => {
      const ns = document.createElement('script');
      for (const a of oldS.attributes) ns.setAttribute(a.name, a.value);
      ns.textContent = oldS.textContent;
      oldS.replaceWith(ns);
    });

    /* body 직속 <script>들 재실행 (배너 슬라이더 init, toggleView 등 페이지 스크립트) */
    doc.querySelectorAll('body > script').forEach(s => {
      const src = s.getAttribute('src') || '';
      if (src.includes('spa-nav.js')) return;  // 자기 자신은 다시 로드 X
      const ns = document.createElement('script');
      for (const a of s.attributes) ns.setAttribute(a.name, a.value);
      ns.textContent = s.textContent;
      ns.setAttribute('data-spa-injected', '1');
      document.body.appendChild(ns);
    });

    if (push) history.pushState({ spa: true, url }, '', url);
    updateActiveStates(url);
    window.scrollTo({ top: 0 });
  }

  function bind() {
    document.body.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      const a = e.target.closest('a.service-item, a.nav-item, a[data-spa]');
      if (!a || !isInternal(a)) return;
      const target = new URL(a.href, location.href);
      if (target.pathname === location.pathname && target.search === location.search) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      e.preventDefault();
      swap(a.href, true);
    });

    window.addEventListener('popstate', () => swap(location.href, false));
    updateActiveStates(location.href);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
