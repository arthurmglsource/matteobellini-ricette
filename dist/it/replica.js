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

  // Synchronized Europe/Rome Black Friday deadline countdown.
  // Never hides the 3 books while they remain part of the active Hotmart checkout offer.
  (function initPromoCountdown() {
    const bar = document.getElementById('promo-bar');
    const timerEl = document.getElementById('promo-countdown');
    if (!bar || !timerEl) return;

    const romeOffsetFmt = new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Rome',
      timeZoneName: 'longOffset'
    });

    function resolveRomeMidnightMs(isoDate) {
      const wallMidnight = Date.parse(`${isoDate}T00:00:00Z`);
      if (!Number.isFinite(wallMidnight)) return NaN;
      let ms = wallMidnight;
      for (let i = 0; i < 2; i++) {
        const zone = romeOffsetFmt.formatToParts(ms).find((part) => part.type === 'timeZoneName');
        const match = zone && /^GMT([+-])(\d{2}):(\d{2})$/.exec(zone.value);
        if (!match) break;
        const offsetMs = (Number(match[2]) * 60 + Number(match[3])) * 60000;
        ms = wallMidnight - (match[1] === '+' ? offsetMs : -offsetMs);
      }
      return ms;
    }

    const endDate = bar.getAttribute('data-promo-end-date') || OFFER.promoEndDate || '2026-12-01';
    const endMs = resolveRomeMidnightMs(endDate);
    if (!Number.isFinite(endMs)) return;
    timerEl.dateTime = new Date(endMs).toISOString();

    const pad = (n) => (n < 10 ? '0' + n : String(n));
    const hEls = Array.from(document.querySelectorAll('[data-promo-h]'));
    const mEls = Array.from(document.querySelectorAll('[data-promo-m]'));
    const sEls = Array.from(document.querySelectorAll('[data-promo-s]'));

    // When Black Friday weekend ends, update only promotional Black Friday copy cleanly
    // while keeping all 3 books visible to match the live Hotmart checkout offer.
    function switchToPostBlackFridayCopy() {
      const headline = bar.querySelector('[data-promo-headline]');
      if (headline) headline.textContent = '🎁 OFFERTA SPECIALE · 2 RICETTARI IN REGALO · 200 RICETTE A 6,99 €';
      const wrap = bar.querySelector('.promo-countdown-wrap');
      if (wrap) wrap.hidden = true;
      const sep = bar.querySelector('.promo-sep');
      if (sep) sep.hidden = true;
      document.querySelectorAll('[data-bf-label]').forEach((el) => {
        el.textContent = 'OFFERTA SPECIALE · 2 RICETTARI IN REGALO';
      });
      document.querySelectorAll('[data-bf-timer-box]').forEach((el) => {
        el.hidden = true;
      });
    }

    function tick() {
      const remaining = endMs - Date.now();
      if (remaining <= 0) {
        switchToPostBlackFridayCopy();
        return false;
      }
      const totalSec = Math.ceil(remaining / 1000);
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
      let timeoutId;
      const refresh = () => {
        window.clearTimeout(timeoutId);
        if (tick()) timeoutId = window.setTimeout(refresh, 1000 - (Date.now() % 1000));
      };
      timeoutId = window.setTimeout(refresh, 1000 - (Date.now() % 1000));
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('pageshow', refresh);
    }
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
})();
