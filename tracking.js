/* ============================================
   Walk The Plank Adventures — booking_click tracking
   ============================================
   Single source of truth for the booking_click GA4 conversion event.
   Loaded site-wide via <script src="/tracking.js" defer> in <head>.

   Wires every booking anchor (FareHarbor links and CTA-class anchors)
   via document-level click delegation — no per-anchor onclick required.
   Survives runtime-rendered anchors.

   WTPA's booking model is hybrid: 1 own-inventory link to
   /walktheplankadventures/ plus 7 affiliate-tagged links to partner
   operators (asn-ref=walktheplankadventures + ref=walktheplankadventures).
   The delegated handler covers all of them.

   GA4 ID is set per-page by the inline gtag('config', 'G-4Q1H6GCM71')
   block; this file just calls gtag('event', 'booking_click', ...) and
   trusts whichever property is configured. Defensive no-op if gtag is
   undefined.

   utm_source tagging:
   - On every FareHarbor link click, we append utm_source=walktheplankadventures
     so GA4 can attribute the booking to WTPA.
   - Works for both the own-inventory link and the 7 affiliate-tagged
     links to partner operators (asn-ref / ref preserved on those).
   - appendUtmSource is a vendored copy of _tools/generators/source-tag.js
     (_tools PR #84, 4e73885). Inlined here instead of loaded as a
     separate <script> to avoid editing every page <head>.
*/

(function () {
    /* HOSTNAME GUARD — booking_click is emitted from the live domain only.
       ------------------------------------------------------------------
       Measured 2026-08-18 across the network: 84 of 1,066 booking_click
       events came from 127.0.0.1 — local preview servers and Playwright
       runs, not users. This site shares a GA4 property with keywestsandbartours, where 16 booking_click events came from localhost.

       EXACT hostname match, never a heuristic. www 301s to the bare host on
       all nine domains, so location.hostname is always the bare form at
       execution time; the www form is accepted anyway so a future DNS or
       Pages change cannot silently zero conversions.

       Installed as a gtag wrapper rather than a return at each call site
       because this repo emits booking_click from 16 call site(s) across
       14 file(s). Guarding only this file would leave the other emitters
       live and the localhost traffic would simply move to them. Every page
       carrying an inline emitter loads this file, and the inline
       `function gtag()` is defined in <head> before this deferred script
       runs, so the wrapper is installed before any click can fire.

       Only booking_click is suppressed. page_view and every other event are
       passed through untouched, so local QA still renders and reports
       normally — this removes a false conversion, not the tag. */
    var BOOKING_CLICK_ALLOWED_HOSTS = ['walktheplankadventures.com', 'www.walktheplankadventures.com'];
    function bookingClickHostIsLive() {
        return BOOKING_CLICK_ALLOWED_HOSTS.indexOf(location.hostname) !== -1;
    }
    if (!bookingClickHostIsLive()) {
        var _realGtagForGuard = (typeof window.gtag === 'function') ? window.gtag : null;
        window.gtag = function () {
            if (arguments[0] === 'event' && arguments[1] === 'booking_click') return;
            if (_realGtagForGuard) return _realGtagForGuard.apply(this, arguments);
            (window.dataLayer = window.dataLayer || []).push(arguments);
        };
    }

    function appendUtmSource(url, slug) {
        if (typeof url !== 'string' || !url) return url;
        if (typeof slug !== 'string' || !slug) return url;
        if (url.indexOf('fareharbor.com') === -1) return url;
        if (/[?&]utm_source=/.test(url)) return url;
        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return url + sep + 'utm_source=' + encodeURIComponent(slug);
    }

    var CTA_CLASSES = [
        'btn-book',          // homepage tour cards (8 booking buttons)
        'btn-primary',       // hero "Book Captain Dane"
        'btn-cta',           // blog post booking CTAs
        'header-cta',        // nav "Check Availability"
        'hero-cta',          // hero scroll indicator
        // Excluded by design: video-cta (video play), instagram-cta (social),
        // game-cta (Phaser game promo) — not booking anchors.
    ];

    var REGION_KEYWORDS = ['key-west', 'florida-keys', 'lower-keys', 'marathon', 'key-largo', 'islamorada'];

    function detectRegion() {
        var path = (location && location.pathname) || '';
        for (var i = 0; i < REGION_KEYWORDS.length; i++) {
            if (path.indexOf(REGION_KEYWORDS[i]) !== -1) return REGION_KEYWORDS[i];
        }
        return 'key-west';
    }

    function readContext(link) {
        var href = link.getAttribute('href') || '';
        var name = link.dataset.tourName
            || link.textContent.replace(/[→➤➔\s]+$/, '').trim()
            || 'unknown';
        var id = link.dataset.tourId || href || 'unknown';
        // For FareHarbor URLs, extract the items/<id>/ segment as a stable id.
        var itemMatch = href.match(/\/items\/(\d+)/);
        if (itemMatch) id = itemMatch[1];
        // For FareHarbor URLs, capture the operator slug as supplemental context.
        var slugMatch = href.match(/\/embeds\/book\/([^/]+)/);
        var operator = slugMatch ? slugMatch[1] : null;
        return { name: name, id: id, href: href, operator: operator };
    }

    if (typeof window.trackBookingClick !== 'function') {
        window.trackBookingClick = function (tourName, tourId, region) {
            if (typeof gtag === 'undefined') return;
            gtag('event', 'booking_click', {
                event_category: 'conversion',
                event_label: tourName,
                tour_name: tourName,
                tour_id: tourId,
                region: region || detectRegion()
            });
        };
    }

    function hasCtaClass(link) {
        if (!link.classList) return false;
        for (var i = 0; i < CTA_CLASSES.length; i++) {
            if (link.classList.contains(CTA_CLASSES[i])) return true;
        }
        return false;
    }

    document.addEventListener('click', function (e) {
        var link = e.target.closest && e.target.closest('a');
        if (!link) return;
        var onclickAttr = link.getAttribute('onclick') || '';
        if (onclickAttr.indexOf('trackBookingClick') !== -1) return;
        var href = link.getAttribute('href') || '';
        var isFareHarbor = href.indexOf('fareharbor.com') !== -1;
        if (!isFareHarbor && !hasCtaClass(link)) return;
        if (isFareHarbor) {
            link.href = appendUtmSource(link.href, 'walktheplankadventures');
        }
        var ctx = readContext(link);
        if (typeof gtag === 'undefined') return;
        gtag('event', 'booking_click', {
            event_category: 'conversion',
            event_label: ctx.name,
            tour_name: ctx.name,
            tour_id: ctx.id,
            operator: ctx.operator,
            region: detectRegion()
        });
    });
})();
