(() => {
  const OFFER = Object.assign({
    checkoutUrl: 'https://pay.hotmart.com/R108565132R?off=ibnszeis&checkoutMode=10',
    price: 6.99,
    priceFormatted: '6,99 €',
    currency: 'EUR',
    contentName: 'Il Metodo 5·30, Collezione Completa 200 Ricette',
    contentIds: ['R108565132R'],
    numItems: 3,
    totalRecipes: 200,
    guaranteeDays: 15,
    promoEndDate: '2026-12-01'
  }, window.MATTEO_OFFER || {});

  const BASE_CHECKOUT_URL = OFFER.checkoutUrl;
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
    try { return window[name]; } catch (_) { return null; }
  }
  function safeGet(name, key) {
    try {
      const s = getStorage(name);
      return s ? s.getItem(key) : null;
    } catch (_) { return null; }
  }
  function safeSet(name, key, val) {
    try {
      const s = getStorage(name);
      if (s) s.setItem(key, val);
    } catch (_) { }
  }
  function safeRemove(name, key) {
    try {
      const s = getStorage(name);
      if (s) s.removeItem(key);
    } catch (_) { }
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
    } catch (_) { }
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
    } catch (_) { return ''; }
  }

  function captureFromLocation() {
    let qs;
    try { qs = new URLSearchParams(window.location.search); } catch (_) { return; }
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

    if (out.fbclid && cleanContent && !out.utm_content.includes(CLICK_ID_SEP)) {
      out.utm_content = `${cleanContent}${CLICK_ID_SEP}${out.fbclid}${CLICK_ID_SEP}`;
    }

    return out;
  }

  // Always preserves required Hotmart params (off=ibnszeis & checkoutMode=10) without duplication
  function buildCheckoutUrl(rawBase) {
    let parsed;
    try {
      parsed = new URL(rawBase || BASE_CHECKOUT_URL, window.location.origin);
    } catch (_) {
      return BASE_CHECKOUT_URL;
    }

    const canonical = new URL(BASE_CHECKOUT_URL);
    const baseSearch = new URLSearchParams();
    canonical.searchParams.forEach((v, k) => {
      if (!TRACKED_KEYS.includes(k)) baseSearch.set(k, v);
    });
    parsed.searchParams.forEach((v, k) => {
      if (!TRACKED_KEYS.includes(k)) baseSearch.set(k, v);
    });

    const tracked = collectParams();
    Object.keys(tracked).forEach((k) => {
      if (tracked[k]) baseSearch.set(k, tracked[k]);
    });

    const query = baseSearch.toString();
    return query ? `${parsed.origin}${parsed.pathname}?${query}` : `${parsed.origin}${parsed.pathname}`;
  }

  // Meta Pixel event dispatcher (respects consent, prevents duplicate ViewContent / InitiateCheckout, never fires Purchase)
  let lastInitiateCheckoutTs = 0;

  function fireMetaEvent(eventName, payload) {
    if (!canPersistMarketing()) return false;
    if (typeof window.fbq !== 'function') return false;
    try {
      window.fbq('track', eventName, payload);
      return true;
    } catch (_) {
      return false;
    }
  }

  function trackViewContentOnce() {
    if (window.__mbViewContentSent) return;
    if (!canPersistMarketing()) return;
    window.__mbViewContentSent = true;
    fireMetaEvent('ViewContent', {
      value: OFFER.price,
      currency: OFFER.currency,
      content_name: OFFER.contentName,
      content_ids: OFFER.contentIds,
      content_type: 'product'
    });
  }

  function trackInitiateCheckoutOnce() {
    const now = Date.now();
    if (now - lastInitiateCheckoutTs < 2500) return;
    lastInitiateCheckoutTs = now;
    fireMetaEvent('InitiateCheckout', {
      value: OFFER.price,
      currency: OFFER.currency,
      content_name: OFFER.contentName,
      content_ids: OFFER.contentIds,
      content_type: 'product',
      num_items: OFFER.numItems
    });
  }

  function decorateCheckoutLinks() {
    document.querySelectorAll('a[data-checkout="hotmart"]').forEach((link) => {
      if (!link.dataset.baseHref) {
        link.dataset.baseHref = BASE_CHECKOUT_URL;
      }
      link.href = buildCheckoutUrl(link.dataset.baseHref);
    });
  }

  let checkoutClickedInSession = safeGet('sessionStorage', 'mb_checkout_clicked') === '1';

  function bindCheckoutLinks() {
    document.querySelectorAll('a[data-checkout="hotmart"]').forEach((link) => {
      const refresh = () => {
        link.href = buildCheckoutUrl(link.dataset.baseHref || BASE_CHECKOUT_URL);
      };
      link.addEventListener('pointerdown', refresh, { passive: true });
      link.addEventListener('click', () => {
        refresh();
        checkoutClickedInSession = true;
        safeSet('sessionStorage', 'mb_checkout_clicked', '1');
        trackInitiateCheckoutOnce();
      });
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
      trackViewContentOnce();
    }
    decorateCheckoutLinks();
  }

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
      } catch (_) { }
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

  window.MatteoTracking = {
    offer: OFFER,
    getParams: collectParams,
    buildCheckoutUrl,
    refreshLinks: decorateCheckoutLinks,
    canPersist: canPersistMarketing,
    setConsent
  };

  captureFromLocation();
  decorateCheckoutLinks();
  bindCheckoutLinks();
  attachCmpListeners();
  trackViewContentOnce();

  window.addEventListener('hashchange', decorateCheckoutLinks, { passive: true });
  window.addEventListener('pageshow', () => {
    captureFromLocation();
    decorateCheckoutLinks();
  }, { passive: true });

  window.addEventListener('open-book-checkout', () => {
    trackInitiateCheckoutOnce();
    window.location.assign(buildCheckoutUrl(BASE_CHECKOUT_URL));
  });

  // Always-on fixed sticky CTA bar: appears smoothly on first scroll and stays visible 100% of navigation
  (function initPersistentStickyBar() {
    const sticky = document.getElementById('mb-sticky-bar');
    if (!sticky) return;

    let stickyRevealed = false;
    let rafPending = false;

    function revealSticky() {
      if (stickyRevealed) return;
      if ((window.scrollY || window.pageYOffset || 0) > 24) {
        stickyRevealed = true;
        sticky.classList.add('is-visible');
      }
    }

    function onScroll() {
      if (stickyRevealed || rafPending) return;
      rafPending = true;
      window.requestAnimationFrame(() => {
        rafPending = false;
        revealSticky();
      });
    }

    revealSticky();
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  // Sales recovery exit-intent popup (desktop mouseout + mobile fast upward scroll; never hijacks back button)
  (function initExitRecoveryPopup() {
    const overlay = document.getElementById('mb-exit-popup');
    if (!overlay) return;

    const box = overlay.querySelector('.mb-exit-box');
    const closeBtn = overlay.querySelector('.mb-exit-close');
    const dismissBtn = overlay.querySelector('.mb-exit-dismiss');
    const STORAGE_KEY = 'mb_exit_popup_seen';

    let popupDone = safeGet('sessionStorage', STORAGE_KEY) === '1';
    let isOpen = false;
    let lastFocused = null;
    const pageStartMs = Date.now();

    function getFocusable() {
      return Array.from(
        overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);
    }

    function canTrigger() {
      if (popupDone || isOpen || checkoutClickedInSession) return false;
      if (safeGet('sessionStorage', STORAGE_KEY) === '1') {
        popupDone = true;
        return false;
      }
      if (safeGet('sessionStorage', 'mb_checkout_clicked') === '1') {
        checkoutClickedInSession = true;
        return false;
      }
      return true;
    }

    function openPopup(forcePreview) {
      if (!forcePreview && !canTrigger()) return false;
      if (isOpen) return false;
      if (!forcePreview) {
        popupDone = true;
        safeSet('sessionStorage', STORAGE_KEY, '1');
      }
      isOpen = true;
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      decorateCheckoutLinks();
      overlay.hidden = false;
      document.body.classList.add('mb-popup-open');
      window.requestAnimationFrame(() => {
        if (closeBtn) closeBtn.focus();
        else if (box) box.focus();
      });
      return true;
    }

    function closePopup() {
      if (!isOpen) return;
      isOpen = false;
      popupDone = true;
      safeSet('sessionStorage', STORAGE_KEY, '1');
      overlay.hidden = true;
      document.body.classList.remove('mb-popup-open');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus({ preventScroll: true }); } catch (_) { lastFocused.focus(); }
      }
    }

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (dismissBtn) dismissBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) closePopup();
    });

    document.addEventListener('keydown', (ev) => {
      if (!isOpen) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closePopup();
        return;
      }
      if (ev.key === 'Tab') {
        const focusable = getFocusable();
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (ev.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    });

    const isFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (isFinePointer) {
      document.addEventListener('mouseout', (ev) => {
        if (!canTrigger()) return;
        if (Date.now() - pageStartMs < 6000) return;
        if (!ev.relatedTarget && typeof ev.clientY === 'number' && ev.clientY <= 10) {
          openPopup(false);
        }
      });
    } else {
      let maxScrollY = 0;
      let anchorY = window.scrollY || 0;
      let anchorTime = Date.now();
      let scrollRaf = false;

      window.addEventListener('scroll', () => {
        if (!canTrigger() || scrollRaf) return;
        scrollRaf = true;
        window.requestAnimationFrame(() => {
          scrollRaf = false;
          const now = Date.now();
          const y = window.scrollY || window.pageYOffset || 0;
          if (y > maxScrollY) maxScrollY = y;
          if (y >= anchorY) { anchorY = y; anchorTime = now; return; }
          if (now - anchorTime > 420) { anchorY = y; anchorTime = now; return; }
          const upwardDelta = anchorY - y;
          if ((now - pageStartMs) >= 12000 && maxScrollY >= 450 && upwardDelta >= 180 && y > 80) {
            openPopup(false);
          }
        });
      }, { passive: true });
    }

    window.MatteoPopup = {
      open: () => openPopup(true),
      close: closePopup
    };
  })();

  // Carousel touch-pause & lazy pre-decoder (zero LCP cost, zero flash when gliding)
  document.querySelectorAll('.mb-photo-carousel').forEach((v) => {
    v.addEventListener('touchstart', () => v.classList.add('touch-paused'), { passive: true });
    v.addEventListener('touchend', () => setTimeout(() => v.classList.remove('touch-paused'), 2500), { passive: true });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          v.querySelectorAll('img[loading="lazy"]').forEach((im) => { im.loading = 'eager'; });
          io.disconnect();
        }
      }, { rootMargin: '600px 0px' });
      io.observe(v);
    }
  });

  // Bulletproof daily Europe/Rome midnight (00:00) countdown.
  // Always displays HH:MM:SS (00:00:01 - 23:59:59), never >23h, never days, and rolls cleanly at 00:00.
  (function initPromoCountdown() {
    const timerEl = document.getElementById('promo-countdown');
    const hEls = Array.from(document.querySelectorAll('[data-promo-h]'));
    const mEls = Array.from(document.querySelectorAll('[data-promo-m]'));
    const sEls = Array.from(document.querySelectorAll('[data-promo-s]'));
    if (!timerEl && !hEls.length) return;

    const pad = (n) => (n < 10 ? '0' + n : String(n));
    let romeClockFmt = null;
    try {
      romeClockFmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Rome',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (_) { }

    function getSecondsUntilRomeMidnight() {
      try {
        if (romeClockFmt) {
          const parts = romeClockFmt.formatToParts(new Date());
          const get = (type) => {
            const p = parts.find((x) => x.type === type);
            return p ? Number(p.value) : 0;
          };
          const h = get('hour') % 24;
          const m = get('minute');
          const s = get('second');
          const rem = 86400 - (h * 3600 + m * 60 + s);
          if (rem > 0 && rem <= 86400) return Math.min(86399, rem);
        }
      } catch (_) { }
      const now = new Date();
      const remLocal = 86400 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
      return remLocal > 0 && remLocal <= 86400 ? Math.min(86399, remLocal) : 86399;
    }

    function tick() {
      const totalSec = getSecondsUntilRomeMidnight();
      const hours = pad(Math.floor(totalSec / 3600));
      const mins = pad(Math.floor((totalSec % 3600) / 60));
      const secs = pad(totalSec % 60);
      if (timerEl) timerEl.textContent = `${hours}:${mins}:${secs}`;
      hEls.forEach((el) => { el.textContent = hours; });
      mEls.forEach((el) => { el.textContent = mins; });
      sEls.forEach((el) => { el.textContent = secs; });
      return true;
    }

    tick();
    let timeoutId;
    const refresh = () => {
      window.clearTimeout(timeoutId);
      tick();
      timeoutId = window.setTimeout(refresh, 1000 - (Date.now() % 1000));
    };
    timeoutId = window.setTimeout(refresh, 1000 - (Date.now() % 1000));
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
  })();

  // Accessible single-open FAQ accordion
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

    items.forEach((item) => {
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

  // Recipe Video Reels Carousel: progressive multi-visible IntersectionObserver autoplay (up to 2 on mobile,
  // up to 3 on desktop), continuous muted loop, exclusive audio toggle, pause on leave, Safari/IG/FB WebView safe.
  (function initRecipeReelsCarousel() {
    const section = document.getElementById('ricette-video');
    if (!section) return;
    const track = section.querySelector('[data-reels-track]');
    if (!track) return;

    const dotsWrap = section.querySelector('[data-reels-dots]');
    const prevBtn = section.querySelector('[data-reels-prev]');
    const nextBtn = section.querySelector('[data-reels-next]');

    // Sync from centralized config if future recipes are added to window.MATTEO_RECIPE_VIDEOS
    const cfg = Array.isArray(window.MATTEO_RECIPE_VIDEOS)
      ? window.MATTEO_RECIPE_VIDEOS
        .filter((item) => item && item.video && item.poster && item.title)
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      : null;

    function buildCardHtml(item, idx) {
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const w = Number(item.width) || 360;
      const h = Number(item.height) || 640;
      return `<article class="mb-reel-card" data-reel-card="${idx}" data-reel-id="${esc(item.id || idx)}"><div class="mb-reel-frame" role="button" tabindex="0" aria-label="Riproduci o metti in pausa: ${esc(item.title)}"><img class="mb-reel-poster" src="${esc(item.poster)}" alt="${esc(item.title)}" width="${w}" height="${h}" loading="lazy" decoding="async" fetchpriority="low"/><video class="mb-reel-video" data-src="${esc(item.video)}" width="480" height="854" preload="none" autoplay="" muted="" loop="" playsinline="" webkit-playsinline="" disablepictureinpicture="" controlslist="nodownload noplaybackrate noremoteplayback" aria-hidden="true"></video><div class="mb-reel-vignette" aria-hidden="true"></div><button type="button" class="mb-reel-play" aria-label="Avvia video ${esc(item.title)}" tabindex="-1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5z"/></svg></button><button type="button" class="mb-reel-audio" aria-label="Attiva o disattiva audio: ${esc(item.title)}" aria-pressed="false"><svg class="icon-sound-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg><svg class="icon-sound-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></button></div><p class="mb-reel-title">${esc(item.title)}</p></article>`;
    }

    if (cfg) {
      if (cfg.length === 0) {
        section.hidden = true;
        return;
      }
      const existingIds = Array.from(track.querySelectorAll('[data-reel-card]')).map((el) => el.getAttribute('data-reel-id'));
      const cfgIds = cfg.map((it) => String(it.id));
      if (existingIds.join('|') !== cfgIds.join('|')) {
        track.innerHTML = cfg.map((item, i) => buildCardHtml(item, i)).join('');
      }
    }

    const cards = Array.from(track.querySelectorAll('[data-reel-card]'));
    if (!cards.length) {
      section.hidden = true;
      return;
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = cards.map((_, i) =>
        `<button type="button" class="mb-reels-dot${i === 0 ? ' is-active' : ''}" data-reel-dot="${i}" aria-label="Vai alla ricetta ${i + 1}"></button>`
      ).join('');
    }
    const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('[data-reel-dot]')) : [];

    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(conn && (conn.saveData === true || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'));
    const allowAutoplay = !reducedMotion && !saveData;

    let sectionInView = false;
    let activeIdx = 0;
    const userPausedSet = new Set();
    let scrollSettleTimer = null;
    let rafPending = false;
    let wasDragging = false;
    let gestureUnlockBound = false;

    function getMaxSimultaneous() {
      return window.innerWidth >= 1024 ? 3 : 2;
    }

    function hydrateVideo(video) {
      if (!video || video.dataset.hydrated === '1') return;
      const src = video.getAttribute('data-src');
      if (!src) return;
      video.dataset.hydrated = '1';
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.src = src;
      video.preload = 'metadata';
      video.load();
    }

    function updateMuteButton(card, unmuted) {
      const btn = card.querySelector('.mb-reel-audio');
      if (btn) btn.setAttribute('aria-pressed', unmuted ? 'true' : 'false');
    }

    function muteOthers(keepIdx) {
      cards.forEach((c, i) => {
        if (i === keepIdx) return;
        const v = c.querySelector('video');
        if (v) v.muted = true;
        updateMuteButton(c, false);
      });
    }

    function pauseCard(card, resetMute) {
      const video = card.querySelector('video');
      card.classList.remove('is-playing');
      if (video) {
        if (!video.paused) {
          try { video.pause(); } catch (_) { }
        }
        if (resetMute) {
          video.muted = true;
          updateMuteButton(card, false);
        }
      }
    }

    function pauseAll(resetMute) {
      cards.forEach((c) => pauseCard(c, resetMute));
    }

    function bindGestureUnlock() {
      if (gestureUnlockBound || !allowAutoplay) return;
      gestureUnlockBound = true;
      const retry = () => {
        window.removeEventListener('touchstart', retry);
        window.removeEventListener('pointerdown', retry);
        gestureUnlockBound = false;
        if (sectionInView) syncVisiblePlayback();
      };
      window.addEventListener('touchstart', retry, { passive: true, once: true });
      window.addEventListener('pointerdown', retry, { passive: true, once: true });
    }

    function startCard(idx, withSound) {
      const card = cards[idx];
      if (!card) return;
      const video = card.querySelector('video');
      if (!video) return;

      hydrateVideo(video);
      if (withSound) {
        muteOthers(idx);
        video.muted = false;
        updateMuteButton(card, true);
      } else if (video.muted) {
        updateMuteButton(card, false);
      }

      card.classList.remove('is-user-paused');
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          card.classList.remove('is-blocked');
          card.classList.add('is-playing', 'is-ready');
        }).catch(() => {
          if (withSound) {
            video.muted = true;
            updateMuteButton(card, false);
            video.play().then(() => {
              card.classList.remove('is-blocked');
              card.classList.add('is-playing', 'is-ready');
            }).catch(() => {
              card.classList.remove('is-playing');
              card.classList.add('is-blocked');
              bindGestureUnlock();
            });
          } else {
            card.classList.remove('is-playing');
            card.classList.add('is-blocked');
            bindGestureUnlock();
          }
        });
      } else {
        card.classList.remove('is-blocked');
        card.classList.add('is-playing', 'is-ready');
      }
    }

    function getVisibleCandidates() {
      const tr = track.getBoundingClientRect();
      const focalX = tr.left + tr.width * 0.45;
      const list = [];
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const visW = Math.max(0, Math.min(r.right, tr.right) - Math.max(r.left, tr.left));
        const ratio = r.width > 0 ? visW / r.width : 0;
        if (ratio >= 0.55) {
          const dist = Math.abs((r.left + r.width / 2) - focalX);
          list.push({ idx: i, ratio, dist });
        }
      });
      list.sort((a, b) => (b.ratio - a.ratio) || (a.dist - b.dist));
      return list;
    }

    function updateNavButtons() {
      if (!prevBtn || !nextBtn) return;
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      prevBtn.disabled = track.scrollLeft <= 4;
      nextBtn.disabled = track.scrollLeft >= maxScroll - 4;
    }

    function syncVisiblePlayback() {
      const candidates = getVisibleCandidates();
      const maxPlay = getMaxSimultaneous();
      const targetSet = new Set(candidates.slice(0, maxPlay).map((c) => c.idx));
      if (candidates.length) {
        activeIdx = candidates[0].idx;
      }
      cards.forEach((c, i) => c.classList.toggle('is-active', targetSet.has(i)));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === activeIdx));

      // Pause any card that left the visible playback window (and mute it cleanly)
      cards.forEach((card, i) => {
        if (!targetSet.has(i)) {
          userPausedSet.delete(i);
          card.classList.remove('is-user-paused');
          pauseCard(card, true);
        }
      });

      if (!sectionInView) {
        pauseAll(false);
        updateNavButtons();
        return;
      }

      if (!allowAutoplay) {
        targetSet.forEach((idx) => {
          const v = cards[idx].querySelector('video');
          if (!v || v.paused) cards[idx].classList.add('is-blocked');
        });
        updateNavButtons();
        return;
      }

      targetSet.forEach((idx) => {
        if (userPausedSet.has(idx)) return;
        const card = cards[idx];
        const v = card.querySelector('video');
        if (!v || v.paused || v.ended) {
          startCard(idx, Boolean(v && !v.muted));
        }
      });
      updateNavButtons();
    }

    // Card interactions: tap toggles play/pause; audio button unmutes this video & mutes all others
    cards.forEach((card, idx) => {
      const frame = card.querySelector('.mb-reel-frame');
      const video = card.querySelector('video');
      const audioBtn = card.querySelector('.mb-reel-audio');

      if (video) {
        video.addEventListener('loadeddata', () => card.classList.add('is-ready'), { passive: true });
        video.addEventListener('playing', () => {
          card.classList.remove('is-blocked', 'is-user-paused');
          card.classList.add('is-playing', 'is-ready');
        }, { passive: true });
        video.addEventListener('error', () => {
          card.classList.remove('is-playing', 'is-ready');
          card.classList.add('is-blocked');
        }, { passive: true });
      }

      function togglePlay() {
        if (wasDragging) return;
        const isPlaying = video && !video.paused && !video.ended;
        if (isPlaying) {
          userPausedSet.add(idx);
          card.classList.add('is-user-paused');
          pauseCard(card, false);
        } else {
          userPausedSet.delete(idx);
          card.classList.remove('is-user-paused', 'is-blocked');
          startCard(idx, Boolean(video && !video.muted));
        }
      }

      if (frame) {
        frame.addEventListener('click', (ev) => {
          if (ev.target && ev.target.closest('.mb-reel-audio')) return;
          togglePlay();
        });
        frame.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            togglePlay();
          }
        });
      }

      if (audioBtn) {
        audioBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (!video) return;
          const currentlyUnmuted = audioBtn.getAttribute('aria-pressed') === 'true';
          if (!currentlyUnmuted) {
            userPausedSet.delete(idx);
            muteOthers(idx);
            startCard(idx, true);
          } else {
            video.muted = true;
            updateMuteButton(card, false);
          }
        });
      }
    });

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        const card = cards[idx];
        if (!card) return;
        const left = card.offsetLeft - 16;
        track.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? 'auto' : 'smooth' });
        window.setTimeout(syncVisiblePlayback, 260);
      });
    });

    function scrollByCards(dir) {
      const step = (cards[0] ? cards[0].getBoundingClientRect().width + 16 : 240) * 2;
      track.scrollBy({ left: dir * step, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    if (prevBtn) prevBtn.addEventListener('click', () => scrollByCards(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByCards(1));

    // Desktop mouse drag-to-scroll
    let isPointerDown = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    track.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      if (ev.target && ev.target.closest('button')) return;
      isPointerDown = true;
      wasDragging = false;
      dragStartX = ev.clientX;
      dragStartScroll = track.scrollLeft;
    });
    window.addEventListener('pointermove', (ev) => {
      if (!isPointerDown) return;
      const dx = ev.clientX - dragStartX;
      if (Math.abs(dx) > 6) {
        wasDragging = true;
        track.classList.add('is-dragging');
        track.scrollLeft = dragStartScroll - dx;
      }
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      track.classList.remove('is-dragging');
      if (wasDragging) window.setTimeout(() => { wasDragging = false; }, 60);
    }, { passive: true });

    track.addEventListener('scroll', () => {
      if (!rafPending) {
        rafPending = true;
        window.requestAnimationFrame(() => {
          rafPending = false;
          updateNavButtons();
        });
      }
      window.clearTimeout(scrollSettleTimer);
      scrollSettleTimer = window.setTimeout(syncVisiblePlayback, 120);
    }, { passive: true });

    // Section IntersectionObserver: autoplay visible videos on enter, pause all on leave
    if ('IntersectionObserver' in window) {
      const sectionIO = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        sectionInView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        if (sectionInView) {
          syncVisiblePlayback();
        } else {
          pauseAll(false);
        }
      }, { threshold: [0, 0.2, 0.45] });
      sectionIO.observe(section);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseAll(false);
      else if (sectionInView) syncVisiblePlayback();
    });

    window.addEventListener('resize', () => {
      updateNavButtons();
      if (sectionInView) syncVisiblePlayback();
    }, { passive: true });

    cards[0].classList.add('is-active');
    if (cards[1]) cards[1].classList.add('is-active');
    updateNavButtons();
  })();

  // Editorial 2-Row Recipe Catalog Carousel (#semplicita) + Enlarged Dish Lightbox & On-Demand Sample Ebook Page
  (function initRecipeCatalogCarousel() {
    const section = document.getElementById('semplicita');
    if (!section) return;
    const track = section.querySelector('[data-cat-track]');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('[data-cat-card]'));
    const dots = Array.from(section.querySelectorAll('[data-cat-dot]'));
    const prevBtn = section.querySelector('[data-cat-prev]');
    const nextBtn = section.querySelector('[data-cat-next]');

    const modal = document.getElementById('mb-cat-lightbox');
    const modalBox = modal ? modal.querySelector('.mb-cat-modal-box') : null;
    const modalMedia = modal ? modal.querySelector('[data-cat-modal-media]') : null;
    const modalImg = modal ? modal.querySelector('[data-cat-modal-img]') : null;
    const modalTitle = modal ? modal.querySelector('#mb-cat-modal-title') : null;
    const modalTime = modal ? modal.querySelector('[data-cat-modal-time]') : null;
    const modalSource = modal ? modal.querySelector('[data-cat-modal-source]') : null;
    const modalSwitch = modal ? modal.querySelector('[data-cat-modal-switch]') : null;

    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let activeCard = null;
    let currentMode = 'photo';
    let lastFocused = null;
    let wasDragging = false;
    let rafPending = false;

    function updateNavAndDots() {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
      if (nextBtn) nextBtn.disabled = track.scrollLeft >= maxScroll - 4;
      if (dots.length) {
        const progress = maxScroll > 0 ? Math.min(1, Math.max(0, track.scrollLeft / maxScroll)) : 0;
        const activeDot = Math.round(progress * (dots.length - 1));
        dots.forEach((d, i) => d.classList.toggle('is-active', i === activeDot));
      }
    }

    function renderModal(card, mode) {
      if (!modal || !modalImg || !card) return;
      activeCard = card;
      currentMode = mode === 'page' && card.dataset.page ? 'page' : 'photo';
      const title = card.dataset.title || '';
      const minutes = card.dataset.minutes || '';
      const source = card.dataset.source || 'Ricette da chef, fatte in casa';
      const photoSrc = card.dataset.photo || '';
      const pageSrc = card.dataset.page || '';

      if (modalMedia) {
        modalMedia.classList.toggle('is-page', currentMode === 'page');
        modalMedia.scrollTop = 0;
      }
      modalImg.src = currentMode === 'page' ? pageSrc : photoSrc;
      modalImg.alt = currentMode === 'page'
        ? `Anteprima pagina originale del ricettario: ${title}`
        : title;
      if (modalTitle) modalTitle.textContent = title;
      if (modalTime) modalTime.textContent = minutes ? `${minutes} min` : '';
      if (modalSource) modalSource.textContent = currentMode === 'page' ? `${source} · Anteprima originale` : source;

      if (modalSwitch) {
        if (pageSrc) {
          modalSwitch.hidden = false;
          modalSwitch.textContent = currentMode === 'page' ? 'Torna alla foto del piatto' : "Sfoglia un'anteprima";
        } else {
          modalSwitch.hidden = true;
        }
      }
    }

    function openLightbox(card, mode) {
      if (!modal || !card) return;
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : card;
      renderModal(card, mode);
      modal.hidden = false;
      document.body.classList.add('mb-popup-open');
      window.requestAnimationFrame(() => {
        const closeBtn = modal.querySelector('[data-cat-close]');
        if (closeBtn) closeBtn.focus();
        else if (modalBox) modalBox.focus();
      });
    }

    function closeLightbox() {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove('mb-popup-open');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus({ preventScroll: true }); } catch (_) { lastFocused.focus(); }
      }
    }

    cards.forEach((card) => {
      const openPreviewBtn = card.querySelector('[data-cat-open-page]');
      if (openPreviewBtn) {
        openPreviewBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (wasDragging) return;
          openLightbox(card, 'page');
        });
      }
      card.addEventListener('click', () => {
        if (wasDragging) return;
        openLightbox(card, 'photo');
      });
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openLightbox(card, 'photo');
        }
      });
    });

    if (modal) {
      modal.querySelectorAll('[data-cat-close]').forEach((btn) => btn.addEventListener('click', closeLightbox));
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) closeLightbox();
      });
      if (modalSwitch) {
        modalSwitch.addEventListener('click', () => {
          if (!activeCard) return;
          renderModal(activeCard, currentMode === 'page' ? 'photo' : 'page');
        });
      }
      document.addEventListener('keydown', (ev) => {
        if (!modal.hidden && ev.key === 'Escape') {
          ev.preventDefault();
          closeLightbox();
        }
      });
    }

    // Navigation arrows & pagination dots
    function scrollByStep(dir) {
      const colW = cards[0] ? cards[0].getBoundingClientRect().width + 16 : 260;
      track.scrollBy({ left: dir * colW * 2, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    if (prevBtn) prevBtn.addEventListener('click', () => scrollByStep(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByStep(1));

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const target = dots.length > 1 ? (maxScroll * i) / (dots.length - 1) : 0;
        track.scrollTo({ left: target, behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    });

    // Desktop mouse pointer drag-to-scroll (touch remains 100% native)
    let isPointerDown = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    track.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      if (ev.target && ev.target.closest('button')) return;
      isPointerDown = true;
      wasDragging = false;
      dragStartX = ev.clientX;
      dragStartScroll = track.scrollLeft;
    });
    window.addEventListener('pointermove', (ev) => {
      if (!isPointerDown) return;
      const dx = ev.clientX - dragStartX;
      if (Math.abs(dx) > 6) {
        wasDragging = true;
        track.classList.add('is-dragging');
        track.scrollLeft = dragStartScroll - dx;
      }
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      track.classList.remove('is-dragging');
      if (wasDragging) window.setTimeout(() => { wasDragging = false; }, 60);
    }, { passive: true });

    track.addEventListener('scroll', () => {
      if (rafPending) return;
      rafPending = true;
      window.requestAnimationFrame(() => {
        rafPending = false;
        updateNavAndDots();
      });
    }, { passive: true });

    window.addEventListener('resize', updateNavAndDots, { passive: true });
    updateNavAndDots();
  })();

  // Recipe Video Reels Carousel: progressive multi-visible IntersectionObserver autoplay (up to 2 on mobile,
  // up to 3 on desktop), continuous muted loop, exclusive audio toggle, pause on leave, Safari/IG/FB WebView safe.
  (function initRecipeReelsCarousel() {
    const section = document.getElementById('ricette-video');
    if (!section) return;
    const track = section.querySelector('[data-reels-track]');
    if (!track) return;

    const dotsWrap = section.querySelector('[data-reels-dots]');
    const prevBtn = section.querySelector('[data-reels-prev]');
    const nextBtn = section.querySelector('[data-reels-next]');

    // Sync from centralized config if future recipes are added to window.MATTEO_RECIPE_VIDEOS
    const cfg = Array.isArray(window.MATTEO_RECIPE_VIDEOS)
      ? window.MATTEO_RECIPE_VIDEOS
        .filter((item) => item && item.video && item.poster && item.title)
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      : null;

    function buildCardHtml(item, idx) {
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const w = Number(item.width) || 360;
      const h = Number(item.height) || 640;
      return `<article class="mb-reel-card" data-reel-card="${idx}" data-reel-id="${esc(item.id || idx)}"><div class="mb-reel-frame" role="button" tabindex="0" aria-label="Riproduci o metti in pausa: ${esc(item.title)}"><img class="mb-reel-poster" src="${esc(item.poster)}" alt="${esc(item.title)}" width="${w}" height="${h}" loading="lazy" decoding="async" fetchpriority="low"/><video class="mb-reel-video" data-src="${esc(item.video)}" width="480" height="854" preload="none" autoplay="" muted="" loop="" playsinline="" webkit-playsinline="" disablepictureinpicture="" controlslist="nodownload noplaybackrate noremoteplayback" aria-hidden="true"></video><div class="mb-reel-vignette" aria-hidden="true"></div><button type="button" class="mb-reel-play" aria-label="Avvia video ${esc(item.title)}" tabindex="-1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5z"/></svg></button><button type="button" class="mb-reel-audio" aria-label="Attiva o disattiva audio: ${esc(item.title)}" aria-pressed="false"><svg class="icon-sound-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg><svg class="icon-sound-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></button></div><p class="mb-reel-title">${esc(item.title)}</p></article>`;
    }

    if (cfg) {
      if (cfg.length === 0) {
        section.hidden = true;
        return;
      }
      const existingIds = Array.from(track.querySelectorAll('[data-reel-card]')).map((el) => el.getAttribute('data-reel-id'));
      const cfgIds = cfg.map((it) => String(it.id));
      if (existingIds.join('|') !== cfgIds.join('|')) {
        track.innerHTML = cfg.map((item, i) => buildCardHtml(item, i)).join('');
      }
    }

    const cards = Array.from(track.querySelectorAll('[data-reel-card]'));
    if (!cards.length) {
      section.hidden = true;
      return;
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = cards.map((_, i) =>
        `<button type="button" class="mb-reels-dot${i === 0 ? ' is-active' : ''}" data-reel-dot="${i}" aria-label="Vai alla ricetta ${i + 1}"></button>`
      ).join('');
    }
    const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('[data-reel-dot]')) : [];

    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(conn && (conn.saveData === true || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'));
    const allowAutoplay = !reducedMotion && !saveData;

    let sectionInView = false;
    let activeIdx = 0;
    const userPausedSet = new Set();
    let scrollSettleTimer = null;
    let rafPending = false;
    let wasDragging = false;
    let gestureUnlockBound = false;

    function getMaxSimultaneous() {
      return window.innerWidth >= 1024 ? 3 : 2;
    }

    function hydrateVideo(video) {
      if (!video || video.dataset.hydrated === '1') return;
      const src = video.getAttribute('data-src');
      if (!src) return;
      video.dataset.hydrated = '1';
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.src = src;
      video.preload = 'metadata';
      video.load();
    }

    function updateMuteButton(card, unmuted) {
      const btn = card.querySelector('.mb-reel-audio');
      if (btn) btn.setAttribute('aria-pressed', unmuted ? 'true' : 'false');
    }

    function muteOthers(keepIdx) {
      cards.forEach((c, i) => {
        if (i === keepIdx) return;
        const v = c.querySelector('video');
        if (v) v.muted = true;
        updateMuteButton(c, false);
      });
    }

    function pauseCard(card, resetMute) {
      const video = card.querySelector('video');
      card.classList.remove('is-playing');
      if (video) {
        if (!video.paused) {
          try { video.pause(); } catch (_) { }
        }
        if (resetMute) {
          video.muted = true;
          updateMuteButton(card, false);
        }
      }
    }

    function pauseAll(resetMute) {
      cards.forEach((c) => pauseCard(c, resetMute));
    }

    function bindGestureUnlock() {
      if (gestureUnlockBound || !allowAutoplay) return;
      gestureUnlockBound = true;
      const retry = () => {
        window.removeEventListener('touchstart', retry);
        window.removeEventListener('pointerdown', retry);
        gestureUnlockBound = false;
        if (sectionInView) syncVisiblePlayback();
      };
      window.addEventListener('touchstart', retry, { passive: true, once: true });
      window.addEventListener('pointerdown', retry, { passive: true, once: true });
    }

    function startCard(idx, withSound) {
      const card = cards[idx];
      if (!card) return;
      const video = card.querySelector('video');
      if (!video) return;

      hydrateVideo(video);
      if (withSound) {
        muteOthers(idx);
        video.muted = false;
        updateMuteButton(card, true);
      } else if (video.muted) {
        updateMuteButton(card, false);
      }

      card.classList.remove('is-user-paused');
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          card.classList.remove('is-blocked');
          card.classList.add('is-playing', 'is-ready');
        }).catch(() => {
          if (withSound) {
            video.muted = true;
            updateMuteButton(card, false);
            video.play().then(() => {
              card.classList.remove('is-blocked');
              card.classList.add('is-playing', 'is-ready');
            }).catch(() => {
              card.classList.remove('is-playing');
              card.classList.add('is-blocked');
              bindGestureUnlock();
            });
          } else {
            card.classList.remove('is-playing');
            card.classList.add('is-blocked');
            bindGestureUnlock();
          }
        });
      } else {
        card.classList.remove('is-blocked');
        card.classList.add('is-playing', 'is-ready');
      }
    }

    function getVisibleCandidates() {
      const tr = track.getBoundingClientRect();
      const focalX = tr.left + tr.width * 0.45;
      const list = [];
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const visW = Math.max(0, Math.min(r.right, tr.right) - Math.max(r.left, tr.left));
        const ratio = r.width > 0 ? visW / r.width : 0;
        if (ratio >= 0.55) {
          const dist = Math.abs((r.left + r.width / 2) - focalX);
          list.push({ idx: i, ratio, dist });
        }
      });
      list.sort((a, b) => (b.ratio - a.ratio) || (a.dist - b.dist));
      return list;
    }

    function updateNavButtons() {
      if (!prevBtn || !nextBtn) return;
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      prevBtn.disabled = track.scrollLeft <= 4;
      nextBtn.disabled = track.scrollLeft >= maxScroll - 4;
    }

    function syncVisiblePlayback() {
      const candidates = getVisibleCandidates();
      const maxPlay = getMaxSimultaneous();
      const targetSet = new Set(candidates.slice(0, maxPlay).map((c) => c.idx));
      if (candidates.length) {
        activeIdx = candidates[0].idx;
      }
      cards.forEach((c, i) => c.classList.toggle('is-active', targetSet.has(i)));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === activeIdx));

      // Pause any card that left the visible playback window (and mute it cleanly)
      cards.forEach((card, i) => {
        if (!targetSet.has(i)) {
          userPausedSet.delete(i);
          card.classList.remove('is-user-paused');
          pauseCard(card, true);
        }
      });

      if (!sectionInView) {
        pauseAll(false);
        updateNavButtons();
        return;
      }

      if (!allowAutoplay) {
        targetSet.forEach((idx) => {
          const v = cards[idx].querySelector('video');
          if (!v || v.paused) cards[idx].classList.add('is-blocked');
        });
        updateNavButtons();
        return;
      }

      targetSet.forEach((idx) => {
        if (userPausedSet.has(idx)) return;
        const card = cards[idx];
        const v = card.querySelector('video');
        if (!v || v.paused || v.ended) {
          startCard(idx, Boolean(v && !v.muted));
        }
      });
      updateNavButtons();
    }

    // Card interactions: tap toggles play/pause; audio button unmutes this video & mutes all others
    cards.forEach((card, idx) => {
      const frame = card.querySelector('.mb-reel-frame');
      const video = card.querySelector('video');
      const audioBtn = card.querySelector('.mb-reel-audio');

      if (video) {
        video.addEventListener('loadeddata', () => card.classList.add('is-ready'), { passive: true });
        video.addEventListener('playing', () => {
          card.classList.remove('is-blocked', 'is-user-paused');
          card.classList.add('is-playing', 'is-ready');
        }, { passive: true });
        video.addEventListener('error', () => {
          card.classList.remove('is-playing', 'is-ready');
          card.classList.add('is-blocked');
        }, { passive: true });
      }

      function togglePlay() {
        if (wasDragging) return;
        const isPlaying = video && !video.paused && !video.ended;
        if (isPlaying) {
          userPausedSet.add(idx);
          card.classList.add('is-user-paused');
          pauseCard(card, false);
        } else {
          userPausedSet.delete(idx);
          card.classList.remove('is-user-paused', 'is-blocked');
          startCard(idx, Boolean(video && !video.muted));
        }
      }

      if (frame) {
        frame.addEventListener('click', (ev) => {
          if (ev.target && ev.target.closest('.mb-reel-audio')) return;
          togglePlay();
        });
        frame.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            togglePlay();
          }
        });
      }

      if (audioBtn) {
        audioBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (!video) return;
          const currentlyUnmuted = audioBtn.getAttribute('aria-pressed') === 'true';
          if (!currentlyUnmuted) {
            userPausedSet.delete(idx);
            muteOthers(idx);
            startCard(idx, true);
          } else {
            video.muted = true;
            updateMuteButton(card, false);
          }
        });
      }
    });

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        const card = cards[idx];
        if (!card) return;
        const left = card.offsetLeft - 16;
        track.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? 'auto' : 'smooth' });
        window.setTimeout(syncVisiblePlayback, 260);
      });
    });

    function scrollByCards(dir) {
      const step = (cards[0] ? cards[0].getBoundingClientRect().width + 16 : 240) * 2;
      track.scrollBy({ left: dir * step, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    if (prevBtn) prevBtn.addEventListener('click', () => scrollByCards(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByCards(1));

    // Desktop mouse drag-to-scroll
    let isPointerDown = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    track.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      if (ev.target && ev.target.closest('button')) return;
      isPointerDown = true;
      wasDragging = false;
      dragStartX = ev.clientX;
      dragStartScroll = track.scrollLeft;
    });
    window.addEventListener('pointermove', (ev) => {
      if (!isPointerDown) return;
      const dx = ev.clientX - dragStartX;
      if (Math.abs(dx) > 6) {
        wasDragging = true;
        track.classList.add('is-dragging');
        track.scrollLeft = dragStartScroll - dx;
      }
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      track.classList.remove('is-dragging');
      if (wasDragging) window.setTimeout(() => { wasDragging = false; }, 60);
    }, { passive: true });

    track.addEventListener('scroll', () => {
      if (!rafPending) {
        rafPending = true;
        window.requestAnimationFrame(() => {
          rafPending = false;
          updateNavButtons();
        });
      }
      window.clearTimeout(scrollSettleTimer);
      scrollSettleTimer = window.setTimeout(syncVisiblePlayback, 120);
    }, { passive: true });

    // Section IntersectionObserver: autoplay visible videos on enter, pause all on leave
    if ('IntersectionObserver' in window) {
      const sectionIO = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        sectionInView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        if (sectionInView) {
          syncVisiblePlayback();
        } else {
          pauseAll(false);
        }
      }, { threshold: [0, 0.2, 0.45] });
      sectionIO.observe(section);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseAll(false);
      else if (sectionInView) syncVisiblePlayback();
    });

    window.addEventListener('resize', () => {
      updateNavButtons();
      if (sectionInView) syncVisiblePlayback();
    }, { passive: true });

    cards[0].classList.add('is-active');
    if (cards[1]) cards[1].classList.add('is-active');
    updateNavButtons();
  })();

  // Editorial 2-Row Recipe Catalog Carousel (#semplicita) + Enlarged Dish Lightbox & On-Demand Sample Ebook Page
  (function initRecipeCatalogCarousel() {
    const section = document.getElementById('semplicita');
    if (!section) return;
    const track = section.querySelector('[data-cat-track]');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('[data-cat-card]'));
    const dots = Array.from(section.querySelectorAll('[data-cat-dot]'));
    const prevBtn = section.querySelector('[data-cat-prev]');
    const nextBtn = section.querySelector('[data-cat-next]');

    const modal = document.getElementById('mb-cat-lightbox');
    const modalBox = modal ? modal.querySelector('.mb-cat-modal-box') : null;
    const modalMedia = modal ? modal.querySelector('[data-cat-modal-media]') : null;
    const modalImg = modal ? modal.querySelector('[data-cat-modal-img]') : null;
    const modalTitle = modal ? modal.querySelector('#mb-cat-modal-title') : null;
    const modalTime = modal ? modal.querySelector('[data-cat-modal-time]') : null;
    const modalSource = modal ? modal.querySelector('[data-cat-modal-source]') : null;
    const modalSwitch = modal ? modal.querySelector('[data-cat-modal-switch]') : null;

    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let activeCard = null;
    let currentMode = 'photo';
    let lastFocused = null;
    let wasDragging = false;
    let rafPending = false;

    function updateNavAndDots() {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
      if (nextBtn) nextBtn.disabled = track.scrollLeft >= maxScroll - 4;
      if (dots.length) {
        const progress = maxScroll > 0 ? Math.min(1, Math.max(0, track.scrollLeft / maxScroll)) : 0;
        const activeDot = Math.round(progress * (dots.length - 1));
        dots.forEach((d, i) => d.classList.toggle('is-active', i === activeDot));
      }
    }

    function renderModal(card, mode) {
      if (!modal || !modalImg || !card) return;
      activeCard = card;
      currentMode = mode === 'page' && card.dataset.page ? 'page' : 'photo';
      const title = card.dataset.title || '';
      const minutes = card.dataset.minutes || '';
      const source = card.dataset.source || 'Ricette da chef, fatte in casa';
      const photoSrc = card.dataset.photo || '';
      const pageSrc = card.dataset.page || '';

      if (modalMedia) {
        modalMedia.classList.toggle('is-page', currentMode === 'page');
        modalMedia.scrollTop = 0;
      }
      modalImg.src = currentMode === 'page' ? pageSrc : photoSrc;
      modalImg.alt = currentMode === 'page'
        ? `Anteprima pagina originale del ricettario: ${title}`
        : title;
      if (modalTitle) modalTitle.textContent = title;
      if (modalTime) modalTime.textContent = minutes ? `${minutes} min` : '';
      if (modalSource) modalSource.textContent = currentMode === 'page' ? `${source} · Anteprima originale` : source;

      if (modalSwitch) {
        if (pageSrc) {
          modalSwitch.hidden = false;
          modalSwitch.textContent = currentMode === 'page' ? 'Torna alla foto del piatto' : "Sfoglia un'anteprima";
        } else {
          modalSwitch.hidden = true;
        }
      }
    }

    function openLightbox(card, mode) {
      if (!modal || !card) return;
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : card;
      renderModal(card, mode);
      modal.hidden = false;
      document.body.classList.add('mb-popup-open');
      window.requestAnimationFrame(() => {
        const closeBtn = modal.querySelector('[data-cat-close]');
        if (closeBtn) closeBtn.focus();
        else if (modalBox) modalBox.focus();
      });
    }

    function closeLightbox() {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove('mb-popup-open');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus({ preventScroll: true }); } catch (_) { lastFocused.focus(); }
      }
    }

    cards.forEach((card) => {
      const openPreviewBtn = card.querySelector('[data-cat-open-page]');
      if (openPreviewBtn) {
        openPreviewBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (wasDragging) return;
          openLightbox(card, 'page');
        });
      }
      card.addEventListener('click', () => {
        if (wasDragging) return;
        openLightbox(card, 'photo');
      });
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openLightbox(card, 'photo');
        }
      });
    });

    if (modal) {
      modal.querySelectorAll('[data-cat-close]').forEach((btn) => btn.addEventListener('click', closeLightbox));
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) closeLightbox();
      });
      if (modalSwitch) {
        modalSwitch.addEventListener('click', () => {
          if (!activeCard) return;
          renderModal(activeCard, currentMode === 'page' ? 'photo' : 'page');
        });
      }
      document.addEventListener('keydown', (ev) => {
        if (!modal.hidden && ev.key === 'Escape') {
          ev.preventDefault();
          closeLightbox();
        }
      });
    }

    // Navigation arrows & pagination dots
    function scrollByStep(dir) {
      const colW = cards[0] ? cards[0].getBoundingClientRect().width + 16 : 260;
      track.scrollBy({ left: dir * colW * 2, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    if (prevBtn) prevBtn.addEventListener('click', () => scrollByStep(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByStep(1));

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const target = dots.length > 1 ? (maxScroll * i) / (dots.length - 1) : 0;
        track.scrollTo({ left: target, behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    });

    // Desktop mouse pointer drag-to-scroll (touch remains 100% native)
    let isPointerDown = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    track.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      if (ev.target && ev.target.closest('button')) return;
      isPointerDown = true;
      wasDragging = false;
      dragStartX = ev.clientX;
      dragStartScroll = track.scrollLeft;
    });
    window.addEventListener('pointermove', (ev) => {
      if (!isPointerDown) return;
      const dx = ev.clientX - dragStartX;
      if (Math.abs(dx) > 6) {
        wasDragging = true;
        track.classList.add('is-dragging');
        track.scrollLeft = dragStartScroll - dx;
      }
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      track.classList.remove('is-dragging');
      if (wasDragging) window.setTimeout(() => { wasDragging = false; }, 60);
    }, { passive: true });

    track.addEventListener('scroll', () => {
      if (rafPending) return;
      rafPending = true;
      window.requestAnimationFrame(() => {
        rafPending = false;
        updateNavAndDots();
      });
    }, { passive: true });

    window.addEventListener('resize', updateNavAndDots, { passive: true });
    updateNavAndDots();
  })();
})();
