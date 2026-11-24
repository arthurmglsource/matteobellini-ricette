(() => {
  const BASE_CHECKOUT_URL = 'https://pay.hotmart.com/R108565132R?checkoutMode=10';
  const HOTMART_SEP = 'hQwK21wXxR';
  const LEAD_ID_SEP = 'jLj';
  const CLICK_ID_SEP = '::';
  const EXP_DAYS = 7;
  const TRACKED_KEYS = [
    'utm_source',
    'utm_campaign',
    'utm_medium',
    'utm_content',
    'utm_term',
    'xcod',
    'sck',
    'src',
    'fbclid',
    'gclid',
    'gbraid',
    'wbraid',
    'ttclid',
    'utm_id'
  ];

  // In-memory store guarantees attribution in Safari Private / Instagram & Facebook WebViews
  const memoryStore = Object.create(null);

  function getStorage(name) {
    try {
      return window[name];
    } catch (_) {
      return null;
    }
  }

  function safeGet(name, key) {
    try {
      const s = getStorage(name);
      return s ? s.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function safeSet(name, key, val) {
    try {
      const s = getStorage(name);
      if (s) s.setItem(key, val);
    } catch (_) {}
  }

  function safeRemove(name, key) {
    try {
      const s = getStorage(name);
      if (s) s.removeItem(key);
    } catch (_) {}
  }

  function canPersistMarketing() {
    if (typeof window.__mbCanTrack === 'function') return window.__mbCanTrack();
    try {
      if (navigator && navigator.globalPrivacyControl === true) return false;
      if (window.__matteoConsent && window.__matteoConsent.marketing === false) return false;
      const stored = safeGet('localStorage', 'mb_consent_marketing')
        || safeGet('localStorage', 'cookie_consent')
        || safeGet('localStorage', 'utmify_consent');
      if (stored && /^(false|denied|rejected|0)$/i.test(String(stored))) return false;
    } catch (_) {}
    return true;
  }

  function cleanValue(v) {
    if (v == null) return '';
    const s = String(v).trim();
    return (!s || s === 'null' || s === 'undefined') ? '' : s;
  }

  function readPersisted(key) {
    if (!canPersistMarketing()) return '';
    const sVal = cleanValue(safeGet('sessionStorage', 'mb_utm_' + key));
    if (sVal) return sVal;
    const lVal = cleanValue(safeGet('localStorage', key));
    if (!lVal) return '';
    const exp = safeGet('localStorage', key + '_exp');
    if (exp && new Date(exp) < new Date()) {
      safeRemove('localStorage', key);
      safeRemove('localStorage', key + '_exp');
      return '';
    }
    return lVal;
  }

  function persistKey(key, val) {
    if (!val || !canPersistMarketing()) return;
    const expIso = new Date(Date.now() + EXP_DAYS * 864e5).toISOString();
    safeSet('sessionStorage', 'mb_utm_' + key, val);
    safeSet('localStorage', key, val);
    safeSet('localStorage', key + '_exp', expIso);
  }

  function clearPersisted() {
    TRACKED_KEYS.forEach((k) => {
      safeRemove('sessionStorage', 'mb_utm_' + k);
      safeRemove('localStorage', k);
      safeRemove('localStorage', k + '_exp');
    });
    safeRemove('localStorage', 'lead');
  }

  function getUtmifyLeadId() {
    if (!canPersistMarketing()) return '';
    try {
      const raw = safeGet('localStorage', 'lead');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return cleanValue(parsed && parsed._id);
    } catch (_) {
      return '';
    }
  }

  function captureFromLocation() {
    let qs;
    try {
      qs = new URLSearchParams(window.location.search);
    } catch (_) {
      return;
    }
    TRACKED_KEYS.forEach((k) => {
      const v = cleanValue(qs.get(k));
      if (v) {
        memoryStore[k] = v;
        persistKey(k, v);
      }
    });
  }

  function truncateHotmartXcod(value) {
    if (!value || value.length <= 255) return value;
    const parts = value.split(HOTMART_SEP);
    if (parts.length !== 5) return value.slice(0, 255);
    const maxPart = Math.max(8, Math.floor((255 - 4 * HOTMART_SEP.length - 12 - 80 - 29) / 5));
    const trimPart = (part, keepId, idSep) => {
      if (!part || part.length <= maxPart) return part;
      if (!keepId) return part.slice(0, maxPart) + '...';
      const sep = idSep || '|';
      const pieces = part.split(sep);
      if (pieces.length <= 1) return part.slice(0, maxPart) + '...';
      const id = pieces[pieces.length - 1];
      const prefix = pieces.slice(0, -1).join(sep);
      return `${prefix.slice(0, maxPart)}...${sep}${id}`;
    };
    return [
      trimPart(parts[0], true, 'jLj'),
      trimPart(parts[1], true),
      trimPart(parts[2], true),
      trimPart(parts[3], true),
      trimPart(parts[4], false)
    ].join(HOTMART_SEP);
  }

  function collectParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmifyParams = window.utmParams instanceof URLSearchParams ? window.utmParams : null;
    const out = Object.create(null);

    const getBest = (key) => {
      const fromUrl = cleanValue(urlParams.get(key));
      if (fromUrl) return fromUrl;
      const fromMem = cleanValue(memoryStore[key]);
      if (fromMem) return fromMem;
      const fromUtmify = utmifyParams ? cleanValue(utmifyParams.get(key)) : '';
      if (fromUtmify) return fromUtmify;
      return readPersisted(key);
    };

    TRACKED_KEYS.forEach((k) => {
      const v = getBest(k);
      if (v) out[k] = v;
    });

    const leadId = getUtmifyLeadId();
    if (leadId && out.utm_source && !out.utm_source.includes(LEAD_ID_SEP)) {
      out.utm_source = `${out.utm_source}${LEAD_ID_SEP}${leadId}`;
    }

    const cleanContent = out.utm_content ? out.utm_content.split(CLICK_ID_SEP)[0] : '';
    const hasCoreUtm = Boolean(out.utm_source || out.utm_campaign || out.utm_medium || cleanContent || out.utm_term);

    if (leadId && hasCoreUtm) {
      // Rebuild xcod with the UTMify Pixel lead ID (jLj...) attached to utm_source, matching utmify/latest.js
      out.xcod = truncateHotmartXcod([
        out.utm_source || '',
        out.utm_campaign || '',
        out.utm_medium || '',
        cleanContent,
        out.utm_term || ''
      ].join(HOTMART_SEP));
      out.sck = out.xcod;
    } else if (!out.xcod && hasCoreUtm) {
      out.xcod = truncateHotmartXcod([
        out.utm_source || '',
        out.utm_campaign || '',
        out.utm_medium || '',
        cleanContent,
        out.utm_term || ''
      ].join(HOTMART_SEP));
    } else if (out.xcod) {
      out.xcod = truncateHotmartXcod(out.xcod);
    }

    if (out.xcod && !out.sck) {
      out.sck = out.xcod;
    }

    // Match UTMify click-ID fallback on utm_content without ever duplicating ::fbclid::
    if (out.fbclid && cleanContent && !out.utm_content.includes(CLICK_ID_SEP)) {
      out.utm_content = `${cleanContent}${CLICK_ID_SEP}${out.fbclid}${CLICK_ID_SEP}`;
    }

    return out;
  }

  function buildCheckoutUrl(rawBase) {
    let parsed;
    try {
      parsed = new URL(rawBase || BASE_CHECKOUT_URL, window.location.origin);
    } catch (_) {
      return rawBase || BASE_CHECKOUT_URL;
    }

    const baseSearch = new URLSearchParams();
    parsed.searchParams.forEach((v, k) => {
      if (!TRACKED_KEYS.includes(k)) baseSearch.set(k, v);
    });
    if (!baseSearch.has('checkoutMode') && parsed.hostname === 'pay.hotmart.com') {
      baseSearch.set('checkoutMode', '10');
    }

    const tracked = collectParams();
    Object.keys(tracked).forEach((k) => {
      if (tracked[k]) baseSearch.set(k, tracked[k]);
    });

    const query = baseSearch.toString();
    return query ? `${parsed.origin}${parsed.pathname}?${query}` : `${parsed.origin}${parsed.pathname}`;
  }

  function decorateCheckoutLinks() {
    document.querySelectorAll('a[data-checkout="hotmart"]').forEach((link) => {
      if (!link.dataset.baseHref) {
        const raw = link.getAttribute('href') || BASE_CHECKOUT_URL;
        try {
          const u = new URL(raw, window.location.origin);
          const clean = new URLSearchParams();
          u.searchParams.forEach((v, k) => {
            if (!TRACKED_KEYS.includes(k)) clean.set(k, v);
          });
          link.dataset.baseHref = clean.toString()
            ? `${u.origin}${u.pathname}?${clean.toString()}`
            : `${u.origin}${u.pathname}`;
        } catch (_) {
          link.dataset.baseHref = BASE_CHECKOUT_URL;
        }
      }
      link.href = buildCheckoutUrl(link.dataset.baseHref);
    });
  }

  function bindCheckoutLinks() {
    document.querySelectorAll('a[data-checkout="hotmart"]').forEach((link) => {
      const refresh = () => {
        link.href = buildCheckoutUrl(link.dataset.baseHref || BASE_CHECKOUT_URL);
      };
      link.addEventListener('pointerdown', refresh, { passive: true });
      link.addEventListener('click', refresh);
    });
  }

  function setConsent(prefs) {
    const allowed = Boolean(prefs && prefs.marketing !== false);
    window.__matteoConsent = Object.assign({}, window.__matteoConsent, { marketing: allowed });
    safeSet('localStorage', 'mb_consent_marketing', allowed ? 'granted' : 'denied');
    if (!allowed) {
      clearPersisted();
    } else {
      captureFromLocation();
      if (typeof window.__mbLoadUtmify === 'function') window.__mbLoadUtmify();
    }
    decorateCheckoutLinks();
  }

  // Optional TCF v2 / CMP listener (Italian Garante Privacy compatibility without visual UI changes)
  function attachCmpListeners() {
    if (typeof window.__tcfapi === 'function') {
      try {
        window.__tcfapi('addEventListener', 2, (tcData, success) => {
          if (!success || !tcData) return;
          if (tcData.eventStatus === 'useractioncomplete' || tcData.eventStatus === 'tcloaded') {
            const p = tcData.purpose && tcData.purpose.consents;
            if (p && typeof p[1] === 'boolean') {
              setConsent({ marketing: Boolean(p[1] && (p[7] !== false)) });
            }
          }
        });
      } catch (_) {}
    }
    window.addEventListener('CookiebotOnConsentReady', () => {
      if (window.Cookiebot && window.Cookiebot.consent) {
        setConsent({ marketing: Boolean(window.Cookiebot.consent.marketing) });
      }
    });
    window.addEventListener('mb:consent-updated', (ev) => {
      if (ev && ev.detail) setConsent(ev.detail);
    });
  }

  // Expose clean read/consent API (no conflict with UTMify or future Meta Pixel)
  window.MatteoTracking = {
    getParams: collectParams,
    buildCheckoutUrl,
    refreshLinks: decorateCheckoutLinks,
    canPersist: canPersistMarketing,
    setConsent
  };

  // Initialize tracking capture and decorate CTAs immediately
  captureFromLocation();
  decorateCheckoutLinks();
  bindCheckoutLinks();
  attachCmpListeners();

  window.addEventListener('hashchange', decorateCheckoutLinks, { passive: true });
  window.addEventListener('pageshow', () => {
    captureFromLocation();
    decorateCheckoutLinks();
  }, { passive: true });

  // Preserve programmatic checkout event with full attribution
  window.addEventListener('open-book-checkout', () => {
    window.location.assign(buildCheckoutUrl(BASE_CHECKOUT_URL));
  });

  // Existing page UI behavior (unchanged)
  const selection = document.getElementById('book-selection');
  const sticky = document.querySelector('body > div.fixed');
  let visible = false;
  function syncSticky() {
    if (!sticky) return;
    sticky.classList.toggle('translate-y-full', scrollY <= 700 || visible);
    sticky.classList.toggle('translate-y-0', scrollY > 700 && !visible);
  }
  if (selection && sticky) {
    new IntersectionObserver((entries) => {
      visible = entries.some((v) => v.isIntersecting);
      syncSticky();
    }, { threshold: 0.05 }).observe(selection);
    window.addEventListener('scroll', syncSticky, { passive: true });
  }
  document.querySelectorAll('.reviews-viewport').forEach((v) => {
    v.addEventListener('touchstart', () => v.classList.add('touch-paused'), { passive: true });
    v.addEventListener('touchend', () => setTimeout(() => v.classList.remove('touch-paused'), 2500), { passive: true });
  });

  // Real fixed-deadline promo countdown (Europe/Rome midnight: 2026-11-25T00:00:00+01:00)
  (function initPromoCountdown() {
    const bar = document.getElementById('promo-bar');
    const timerEl = document.getElementById('promo-countdown');
    if (!bar || !timerEl) return;

    const endAttr = bar.getAttribute('data-promo-end') || '2026-11-25T00:00:00+01:00';
    const endMs = Date.parse(endAttr);
    if (Number.isNaN(endMs)) return;

    const forceExpired = (() => {
      try {
        return new URLSearchParams(window.location.search).get('promo_state') === 'expired';
      } catch (_) {
        return false;
      }
    })();

    const pad = (n) => (n < 10 ? '0' + n : String(n));
    const hEls = Array.from(document.querySelectorAll('[data-promo-h]'));
    const mEls = Array.from(document.querySelectorAll('[data-promo-m]'));
    const sEls = Array.from(document.querySelectorAll('[data-promo-s]'));

    function expirePromoOffer() {
      document.body.classList.add('promo-expired');
      bar.hidden = true;
      timerEl.textContent = '00:00:00';
      hEls.forEach((el) => { el.textContent = '00'; });
      mEls.forEach((el) => { el.textContent = '00'; });
      sEls.forEach((el) => { el.textContent = '00'; });

      // End the 2 free gift books offer cleanly when the campaign deadline is reached
      document.querySelectorAll('.bundle-book-side, .bundle-caption, .price-save-pill, .price-strike').forEach((el) => {
        el.hidden = true;
      });
      const offerH = document.getElementById('offer-heading');
      if (offerH) offerH.textContent = 'Il ricettario digitale a soli 9,99 €';
      const offerSub = document.querySelector('.offer-sub');
      if (offerSub) offerSub.textContent = '100 ricette da chef per portare ogni giorno qualcosa di speciale in tavola.';
      const offerTag = document.querySelector('[data-offer-tag]');
      if (offerTag) offerTag.textContent = 'RICETTARIO + 4 BONUS';
      const offerPdf = document.querySelector('[data-offer-pdf]');
      if (offerPdf) offerPdf.lastChild.textContent = 'Ricettario in formato PDF';
      const offerBooks = document.querySelector('.offer-books');
      if (offerBooks) offerBooks.style.gridTemplateColumns = 'minmax(0,170px)';
      document.querySelectorAll('a[data-checkout="hotmart"]').forEach((cta) => {
        const mainSpan = cta.querySelector('.offer-cta-main');
        if (mainSpan) mainSpan.textContent = 'SÌ, VOGLIO IL RICETTARIO — 9,99 €';
        else cta.textContent = 'VOGLIO IL RICETTARIO — 9,99 €';
        cta.setAttribute('aria-label', 'VOGLIO IL RICETTARIO — 9,99 €');
      });
      const q1 = document.querySelector('[data-faq-q1]');
      if (q1) q1.textContent = 'Ricevi il ricettario digitale Ricette da chef, fatte in casa con 100 ricette per tutti i giorni, più il menù di 7 giorni, la lista della spesa, la tabella delle sostituzioni e i consigli per organizzare i pasti della settimana. Tutto in un unico acquisto, senza costi aggiuntivi.';
      const q9 = document.querySelector('[data-faq-q9]');
      if (q9) q9.textContent = 'Perché invece di cercare ogni giorno nuove ricette tra video, siti e social, avrai 100 idee raccolte e organizzate in un unico ricettario digitale. Ingredienti, quantità, procedimenti e materiali per organizzare la settimana: tutto in un unico posto, da consultare quando vuoi.';
      const pvCopy = document.querySelector('[data-preview-cta-copy]');
      if (pvCopy) pvCopy.textContent = 'Questo è solo un assaggio. Scopri tutte le 100 ricette e porta nuove idee nella tua cucina.';
      const pvBtn = document.querySelector('[data-preview-cta-btn]');
      if (pvBtn) pvBtn.textContent = 'VOGLIO TUTTE LE 100 RICETTE';
      const pvNote = document.querySelector('[data-preview-cta-note]');
      if (pvNote) pvNote.textContent = 'Ricettario digitale + 4 bonus · Solo 9,99 €';
    }

    function tick() {
      const remaining = forceExpired ? 0 : endMs - Date.now();
      if (remaining <= 0) {
        expirePromoOffer();
        return false;
      }
      const totalSec = Math.floor(remaining / 1000);
      const hours = pad(Math.floor(totalSec / 3600));
      const mins = pad(Math.floor((totalSec % 3600) / 60));
      const secs = pad(totalSec % 60);
      timerEl.textContent = `${hours}:${mins}:${secs}`;
      hEls.forEach((el) => { el.textContent = hours; });
      mEls.forEach((el) => { el.textContent = mins; });
      sEls.forEach((el) => { el.textContent = secs; });
      return true;
    }

    if (tick()) {
      const intervalId = window.setInterval(() => {
        if (!tick()) window.clearInterval(intervalId);
      }, 1000);
    }
  })();

  // Accessible single-open FAQ accordion (keyboard + ARIA + smooth toggle)
  (function initFaqAccordion() {
    const container = document.querySelector('[data-faq-accordion]');
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.faq-item'));
    const triggers = items.map((item) => item.querySelector('.faq-trigger')).filter(Boolean);

    function setItemState(item, open) {
      const btn = item.querySelector('.faq-trigger');
      const panel = item.querySelector('.faq-panel');
      if (!btn || !panel) return;
      item.setAttribute('data-open', open ? 'true' : 'false');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        panel.hidden = false;
      } else {
        window.setTimeout(() => {
          if (item.getAttribute('data-open') !== 'true') panel.hidden = true;
        }, 240);
      }
    }

    items.forEach((item, idx) => {
      const btn = item.querySelector('.faq-trigger');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const isOpen = item.getAttribute('data-open') === 'true';
        items.forEach((other) => {
          if (other !== item && other.getAttribute('data-open') === 'true') {
            setItemState(other, false);
          }
        });
        setItemState(item, !isOpen);
      });
      btn.addEventListener('keydown', (ev) => {
        const visibleTriggers = triggers.filter((t) => !t.closest('.faq-item')?.hidden && getComputedStyle(t.closest('.faq-item')).display !== 'none');
        const cur = visibleTriggers.indexOf(btn);
        if (cur === -1) return;
        let next = -1;
        if (ev.key === 'ArrowDown') next = (cur + 1) % visibleTriggers.length;
        else if (ev.key === 'ArrowUp') next = (cur - 1 + visibleTriggers.length) % visibleTriggers.length;
        else if (ev.key === 'Home') next = 0;
        else if (ev.key === 'End') next = visibleTriggers.length - 1;
        if (next !== -1) {
          ev.preventDefault();
          visibleTriggers[next].focus();
        }
      });
    });
  })();

  // Interactive eBook Flipbook Preview (#anteprima)
  (function initFlipbookPreview() {
    const section = document.getElementById('anteprima');
    const book = document.getElementById('fp-book');
    const stage = document.getElementById('fp-stage');
    if (!section || !book) return;

    const PAGES = [
      { n: 1, label: 'Copertina', src640: '/it/assets/preview/page-01-640.webp', src1152: '/it/assets/preview/page-01-1152.webp' },
      { n: 4, label: 'Indice', src640: '/it/assets/preview/page-02-640.webp', src1152: '/it/assets/preview/page-02-1152.webp' },
      { n: 10, label: 'Risotto al limone e Parmigiano', src640: '/it/assets/preview/page-03-640.webp', src1152: '/it/assets/preview/page-03-1152.webp' },
      { n: 11, label: 'Fusilli integrali con pomodorini e ricotta', src640: '/it/assets/preview/page-04-640.webp', src1152: '/it/assets/preview/page-04-1152.webp' },
      { n: 21, label: 'Piadine verdi di spinaci e avena', src640: '/it/assets/preview/page-05-640.webp', src1152: '/it/assets/preview/page-05-1152.webp' },
      { n: 22, label: 'Focaccine di chia e avena in padella', src640: '/it/assets/preview/page-06-640.webp', src1152: '/it/assets/preview/page-06-1152.webp' },
      { n: 109, label: 'Gelato espresso di banana e cacao', src640: '/it/assets/preview/page-07-640.webp', src1152: '/it/assets/preview/page-07-1152.webp' },
      { n: 110, label: 'Mousse al cacao, avocado e datteri', src640: '/it/assets/preview/page-08-640.webp', src1152: '/it/assets/preview/page-08-1152.webp' },
      { n: 119, label: 'Menù di 7 giorni', src640: '/it/assets/preview/page-09-640.webp', src1152: '/it/assets/preview/page-09-1152.webp' },
      { n: 120, label: 'Lista della spesa', src640: '/it/assets/preview/page-10-640.webp', src1152: '/it/assets/preview/page-10-1152.webp' }
    ];

    const $ = (id) => document.getElementById(id);
    const im1 = $('fp-im1');
    const im2 = $('fp-im2');
    const btnLeft = $('fp-left');
    const btnRight = $('fp-right');
    const btnPrev = $('fp-prev');
    const btnNext = $('fp-next');
    const btnZoom = $('fp-zoom');
    const countEl = $('fp-count');
    const captionEl = $('fp-caption');
    const dotsEl = $('fp-dots');
    const modal = $('fp-modal');
    const mImg = $('fp-mimg');
    const mWrap = $('fp-mwrap');
    const mCount = $('fp-mcount');
    const mLabel = $('fp-mlabel');
    const mPrev = $('fp-mprev');
    const mNext = $('fp-mnext');
    const mScale = $('fp-mscale');
    const mClose = $('fp-mclose');

    const mq = window.matchMedia('(max-width: 640px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const step = () => (mq.matches ? 1 : 2);

    let current = 0;
    let mi = 0;
    let busy = false;
    let opener = null;
    const preloaded = Object.create(null);

    function preloadUrl(url) {
      if (!url || preloaded[url]) return;
      preloaded[url] = true;
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }

    function preloadAhead(idx) {
      const s = step();
      for (let offset = 0; offset < s + 2; offset++) {
        const target = PAGES[idx + offset];
        if (target) preloadUrl(target.src640);
      }
      if (idx - 1 >= 0) preloadUrl(PAGES[idx - 1].src640);
    }

    function applyImg(el, page) {
      if (!el || !page) return;
      el.src = page.src640;
      el.srcset = `${page.src640} 640w, ${page.src1152} 1152w`;
      el.alt = `${page.label} — pagina ${page.n}`;
    }

    function render() {
      const s = step();
      current = Math.max(0, Math.min(current, PAGES.length - s));
      if (s === 2) current -= current % 2;

      const leftPage = PAGES[current];
      const rightPage = PAGES[Math.min(current + 1, PAGES.length - 1)];
      applyImg(im1, leftPage);
      applyImg(im2, rightPage);

      if (btnLeft) btnLeft.setAttribute('aria-label', `Ingrandisci: ${leftPage.label} (pagina ${leftPage.n})`);
      if (btnRight) btnRight.setAttribute('aria-label', `Ingrandisci: ${rightPage.label} (pagina ${rightPage.n})`);

      const endIdx = Math.min(current + s - 1, PAGES.length - 1);
      const totalViews = Math.ceil(PAGES.length / s);
      const viewNum = Math.floor(current / s) + 1;
      if (countEl) {
        countEl.textContent = (s === 1
          ? `Pagina ${leftPage.n}`
          : `Pagine ${leftPage.n} e ${PAGES[endIdx].n}`) + ` · ${viewNum} di ${totalViews}`;
      }
      if (captionEl) {
        captionEl.textContent = s === 1
          ? leftPage.label
          : `${leftPage.label} · ${PAGES[endIdx].label}`;
      }

      if (btnPrev) btnPrev.disabled = current === 0;
      if (btnNext) btnNext.disabled = current + s >= PAGES.length;

      if (dotsEl) {
        dotsEl.replaceChildren();
        for (let i = 0; i < PAGES.length; i += s) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'fp-dot' + (i === current ? ' is-active' : '');
          b.setAttribute('aria-label', `Vai all'anteprima ${Math.floor(i / s) + 1}`);
          if (i === current) b.setAttribute('aria-current', 'true');
          b.addEventListener('click', () => go(i));
          dotsEl.appendChild(b);
        }
      }

      preloadAhead(current);
    }

    function go(nextIdx) {
      if (busy || nextIdx === current || nextIdx < 0 || nextIdx >= PAGES.length) return;
      const old = current;
      const s = step();
      const forward = nextIdx > old;

      if (reducedMotion.matches) {
        current = nextIdx;
        render();
        return;
      }

      const leaf = document.createElement('div');
      leaf.className = 'fp-turn' + (forward ? '' : ' is-prev');
      const front = document.createElement('img');
      const back = document.createElement('img');
      front.className = 'fp-turn-front';
      back.className = 'fp-turn-back';
      front.alt = '';
      back.alt = '';
      front.src = PAGES[old + (forward && s === 2 ? 1 : 0)].src640;
      back.src = PAGES[Math.min(nextIdx + (!forward && s === 2 ? 1 : 0), PAGES.length - 1)].src640;
      leaf.append(front, back);

      current = nextIdx;
      render();
      busy = true;
      book.appendChild(leaf);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        leaf.remove();
        busy = false;
      };
      leaf.addEventListener('animationend', cleanup, { once: true });
      window.setTimeout(cleanup, 650);
    }

    if (btnPrev) btnPrev.addEventListener('click', () => go(current - step()));
    if (btnNext) btnNext.addEventListener('click', () => go(current + step()));
    if (btnLeft) btnLeft.addEventListener('click', () => openZoom(current));
    if (btnRight) btnRight.addEventListener('click', () => openZoom(Math.min(current + 1, PAGES.length - 1)));
    if (btnZoom) btnZoom.addEventListener('click', () => openZoom(current));

    // Touch swipe on mobile without blocking vertical scroll
    let touchX = 0;
    let touchY = 0;
    let swiped = false;
    book.addEventListener('touchstart', (ev) => {
      if (!ev.touches || !ev.touches.length) return;
      touchX = ev.touches[0].clientX;
      touchY = ev.touches[0].clientY;
      swiped = false;
    }, { passive: true });
    book.addEventListener('touchend', (ev) => {
      if (!ev.changedTouches || !ev.changedTouches.length) return;
      const dx = ev.changedTouches[0].clientX - touchX;
      const dy = ev.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        swiped = true;
        go(current + (dx < 0 ? step() : -step()));
      }
    }, { passive: true });
    book.addEventListener('click', (ev) => {
      if (swiped) {
        ev.preventDefault();
        ev.stopPropagation();
        swiped = false;
      }
    }, true);

    // Zoom modal
    function showModal() {
      const p = PAGES[mi];
      if (!p || !mImg) return;
      mImg.src = p.src1152;
      mImg.alt = `${p.label} — pagina ${p.n}`;
      if (mCount) mCount.textContent = `Pagina ${p.n} · ${mi + 1}/${PAGES.length}`;
      if (mLabel) mLabel.textContent = p.label;
      if (mPrev) mPrev.disabled = mi === 0;
      if (mNext) mNext.disabled = mi === PAGES.length - 1;
      if (modal) modal.scrollTop = 0;
      if (mi + 1 < PAGES.length) preloadUrl(PAGES[mi + 1].src1152);
      if (mi - 1 >= 0) preloadUrl(PAGES[mi - 1].src1152);
    }

    function openZoom(index) {
      if (!modal) return;
      opener = document.activeElement;
      mi = Math.max(0, Math.min(index, PAGES.length - 1));
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (mImg) mImg.classList.remove('is-large');
      if (mWrap) mWrap.classList.remove('is-large');
      if (mScale) {
        mScale.textContent = '+';
        mScale.setAttribute('aria-pressed', 'false');
      }
      showModal();
      if (mClose) mClose.focus();
    }

    function closeZoom() {
      if (!modal || !modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      if (opener && typeof opener.focus === 'function') opener.focus();
    }

    if (mClose) mClose.addEventListener('click', closeZoom);
    if (mPrev) mPrev.addEventListener('click', () => { if (mi > 0) { mi -= 1; showModal(); } });
    if (mNext) mNext.addEventListener('click', () => { if (mi < PAGES.length - 1) { mi += 1; showModal(); } });
    if (mScale) {
      mScale.addEventListener('click', () => {
        if (!mImg) return;
        const enlarged = mImg.classList.toggle('is-large');
        if (mWrap) mWrap.classList.toggle('is-large', enlarged);
        mScale.textContent = enlarged ? '−' : '+';
        mScale.setAttribute('aria-pressed', enlarged ? 'true' : 'false');
      });
    }
    if (modal) {
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal || ev.target === mWrap) closeZoom();
      });
    }

    // Keyboard support: trapped in modal when open, or inside #anteprima when focused
    document.addEventListener('keydown', (ev) => {
      if (modal && modal.classList.contains('is-open')) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          closeZoom();
        } else if (ev.key === 'ArrowLeft' && mPrev && !mPrev.disabled) {
          ev.preventDefault();
          mPrev.click();
        } else if (ev.key === 'ArrowRight' && mNext && !mNext.disabled) {
          ev.preventDefault();
          mNext.click();
        } else if (ev.key === 'Tab') {
          const controls = Array.from(modal.querySelectorAll('button:not(:disabled)'));
          if (!controls.length) return;
          if (ev.shiftKey && document.activeElement === controls[0]) {
            ev.preventDefault();
            controls[controls.length - 1].focus();
          } else if (!ev.shiftKey && document.activeElement === controls[controls.length - 1]) {
            ev.preventDefault();
            controls[0].focus();
          }
        }
        return;
      }
      if (section.contains(document.activeElement)) {
        if (ev.key === 'ArrowLeft') {
          ev.preventDefault();
          go(current - step());
        } else if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          go(current + step());
        }
      }
    });

    // Smooth scroll CTA to #oferta
    const previewCta = section.querySelector('[data-preview-cta-btn]');
    if (previewCta) {
      previewCta.addEventListener('click', (ev) => {
        const target = document.getElementById('oferta');
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      });
    }

    // Subtle entrance reveal without ever auto-turning pages
    if (stage && 'IntersectionObserver' in window && !reducedMotion.matches) {
      const rect = stage.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.92) {
        stage.classList.add('fp-will-reveal');
        const io = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              stage.classList.add('fp-revealed');
              preloadAhead(current);
              io.disconnect();
            }
          });
        }, { rootMargin: '0px 0px -40px 0px', threshold: 0.08 });
        io.observe(stage);
      }
    }

    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', render);
    else if (typeof mq.addListener === 'function') mq.addListener(render);

    render();
  })();
})();
