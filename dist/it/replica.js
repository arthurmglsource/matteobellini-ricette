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

  // Smart floating mobile sticky bar (appears after Hero CTA, hides on Offer/FAQ CTAs)
  const selection = document.getElementById('book-selection');
  const heroCta = document.querySelector('.cta-3d--hero');
  const faqCta = document.querySelector('.cta-3d--faq');
  const sticky = document.getElementById('mb-sticky-bar') || document.querySelector('body > div.fixed');
  let offerVisible = false;
  let faqVisible = false;
  function syncSticky() {
    if (!sticky) return;
    const passedHero = heroCta
      ? heroCta.getBoundingClientRect().bottom < 20
      : window.scrollY > 700;
    const shouldShow = passedHero && !offerVisible && !faqVisible;
    if (sticky.classList.contains('mb-sticky-bar')) {
      sticky.classList.toggle('is-hidden', !shouldShow);
    } else {
      sticky.classList.toggle('translate-y-full', !shouldShow);
      sticky.classList.toggle('translate-y-0', shouldShow);
    }
  }
  if (sticky) {
    if (selection && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        offerVisible = entries.some((v) => v.isIntersecting);
        syncSticky();
      }, { threshold: 0.05 }).observe(selection);
    }
    if (faqCta && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        faqVisible = entries.some((v) => v.isIntersecting);
        syncSticky();
      }, { threshold: 0.05 }).observe(faqCta);
    }
    window.addEventListener('scroll', syncSticky, { passive: true });
    window.addEventListener('resize', syncSticky, { passive: true });
    syncSticky();
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
      if (offerH) offerH.textContent = '100 ricette con il Metodo 5·30 a soli 9,99 €';
      const offerSub = document.querySelector('.offer-sub');
      if (offerSub) offerSub.textContent = 'Tutto quello che ti serve per riscoprire il piacere della buona cucina, ogni giorno.';
      const offerTag = document.querySelector('[data-offer-tag]');
      if (offerTag) offerTag.textContent = 'METODO 5·30 · 100 RICETTE';
      const offerPdf = document.querySelector('[data-offer-pdf]');
      if (offerPdf) offerPdf.lastChild.textContent = 'Ricettario in formato PDF';
      const offerBooks = document.querySelector('.offer-books');
      if (offerBooks) offerBooks.style.gridTemplateColumns = 'minmax(0,170px)';
      document.querySelectorAll('a[data-checkout="hotmart"]').forEach((cta) => {
        const labelSpan = cta.querySelector('.cta-label') || cta.querySelector('.offer-cta-main');
        if (labelSpan) labelSpan.textContent = 'VOGLIO IL RICETTARIO — 9,99 €';
        else cta.textContent = 'VOGLIO IL RICETTARIO — 9,99 €';
        cta.setAttribute('aria-label', 'VOGLIO IL RICETTARIO — 9,99 €');
      });
      const q2 = document.querySelector('[data-faq-q2]');
      if (q2) q2.textContent = 'Ricevi il ricettario digitale principale con 100 ricette del Metodo 5·30 in formato PDF, con un unico pagamento di 9,99 € e senza costi aggiuntivi.';
      const q9 = document.querySelector('[data-faq-q9]');
      if (q9) q9.textContent = 'La promozione Black Friday con i due ricettari in regalo è terminata. Con 9,99 € ricevi il ricettario digitale principale con le 100 ricette del Metodo 5·30.';
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
})();
