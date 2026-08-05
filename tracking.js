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

   GA4 ID is set per-page by the inline gtag('config', 'G-67D7X60CJF')
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
