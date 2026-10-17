/* ============================================================
   The script injected into the site inside the WebView.

   One script for every site: what differs — how a card links to a
   listing, and where the id sits in that link — is handed in by the
   site's adapter.

   The user browses the site as they always would — scrolling, and
   turning its pages — and the reader hands over what each page has
   drawn as it draws it. The app keeps the running total across those
   pages, because a new page is a new document and the script that
   read the last one is gone. Every card is handed over as raw text;
   the parsing, the geography and the ranking all happen in the app,
   so there is one parser rather than two.

   Written as a plain string with concatenation instead of template
   literals: it is embedded in a template literal itself, and `${`
   inside would be swallowed on the way in.
   ============================================================ */

import type { Site } from "./sites";

/* A ranking is a comparison, and a comparison needs a crowd: below this many
   listings the medians are guesswork, so the button waits. It is also the
   number of rows the ranking keeps, so nothing gathered goes to waste. */
export const MIN_CARDS = 100;

export function readerJs(site: Site): string {
  return `
(function () {
  var CARD_SELECTOR = ${JSON.stringify(site.cardSelector)};
  var ID_RE = new RegExp(${JSON.stringify(site.idPattern)});
  var MIN_CARDS = ${MIN_CARDS};
  if (window.__hfReader) { window.__hfReader.refresh(); return; }

  var PRICE = /(\\d{1,3}(?:[\\s\\u00a0.,]\\d{3})+|\\d{4,})/;
  var AREA = /([\\d]+(?:[.,]\\d+)?)\\s*(?:m\\s*\\u00b2|m\\s*2(?!\\d)|kv\\.?\\s*m)/i;

  function visibleText(el) {
    var parts = [];
    (function walk(node) {
      if (node.nodeType === 3) {
        var t = node.nodeValue ? node.nodeValue.trim() : "";
        if (t) parts.push(t);
        return;
      }
      for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    })(el);
    return parts.join(" ").replace(/\\s+/g, " ").trim();
  }

  function idsIn(el) {
    var out = {};
    var links = el.querySelectorAll(CARD_SELECTOR);
    for (var i = 0; i < links.length; i++) {
      var m = ID_RE.exec(links[i].getAttribute("href") || "");
      if (m) out[m[1]] = true;
    }
    return Object.keys(out);
  }

  // Climb to the smallest ancestor holding both a price and a size, and stop
  // once the ancestor covers a different listing — otherwise a card without a
  // price would borrow its neighbour's numbers.
  function cardRoot(anchor, id) {
    var el = anchor;
    for (var i = 0; i < 8 && el; i++) {
      var ids = idsIn(el);
      if (ids.length > 1 || (ids.length === 1 && ids[0] !== id)) return null;
      var text = visibleText(el);
      if (PRICE.test(text) && AREA.test(text)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function collect() {
    var anchors = document.querySelectorAll(CARD_SELECTOR);
    var seen = {};
    var cards = [];
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute("href") || "";
      var m = ID_RE.exec(href);
      if (!m || seen[m[1]]) continue;
      seen[m[1]] = true;
      var root = cardRoot(anchors[i], m[1]);
      cards.push({
        id: m[1],
        url: anchors[i].href,
        text: root ? visibleText(root) : ""
      });
    }
    return cards;
  }

  /* The bar keeps out of the way until the user has started reading: it
     slides in on the first scroll, and the page is padded by its height so a
     listing never ends up underneath it. */
  var SHOW_AFTER = 140;

  var bar = document.createElement("div");
  bar.setAttribute("style", [
    "position:fixed", "left:0", "right:0", "bottom:0", "z-index:2147483647",
    "padding:12px 16px calc(12px + env(safe-area-inset-bottom))",
    "background:rgba(238,240,243,.97)", "backdrop-filter:blur(8px)",
    "border-top:1px solid rgba(20,22,26,.10)",
    "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif",
    "box-shadow:0 -6px 20px rgba(0,0,0,.10)",
    "transform:translateY(140%)", "transition:transform .22s ease-out"
  ].join(";"));

  var button = document.createElement("button");
  button.setAttribute("style", [
    "display:block", "width:100%", "border:0", "border-radius:12px",
    "padding:14px 16px", "background:#14161a", "color:#ffffff",
    "font-size:15px", "font-weight:650", "font-family:inherit", "cursor:pointer"
  ].join(";"));
  var note = document.createElement("div");
  note.setAttribute("style", [
    "margin-top:8px", "text-align:center", "font-size:11.5px", "line-height:1.35",
    "color:#6b7280", "font-family:inherit"
  ].join(";"));

  bar.appendChild(button);
  bar.appendChild(note);

  // What this page holds, and what the app has gathered over all pages.
  var count = 0;
  var total = 0;

  function label() {
    var shown = Math.max(total, count);
    var ready = shown >= MIN_CARDS;
    button.textContent = ready
      ? "Nəticələri analiz et (" + shown + " elan)"
      : "Elanlar toplanır — " + shown + "/" + MIN_CARDS;
    button.disabled = !ready;
    button.style.opacity = ready ? "1" : ".55";
    note.textContent = ready
      ? "Toplanan " + shown + " elanın hamısı sıralanacaq."
      : "Sıralama üçün ən azı " + MIN_CARDS + " elan lazımdır — sürüşdürün və növbəti səhifələrə keçin.";
  }

  function refresh() {
    var cards = collect();
    var changed = cards.length !== count;
    count = cards.length;
    label();
    // Every page hands itself over as it fills; the app merges and answers
    // with the running total.
    if (changed && count) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "cards",
        url: location.href,
        cards: cards
      }));
    }
  }

  function setTotal(value) {
    total = value;
    label();
  }

  button.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var payload = { type: "analyze", url: location.href, cards: collect() };
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  });

  var visible = false;
  function follow() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var wanted = y > SHOW_AFTER;
    if (wanted === visible) return;
    visible = wanted;
    bar.style.transform = wanted ? "translateY(0)" : "translateY(140%)";
  }

  function mount() {
    if (!document.body) return setTimeout(mount, 200);
    document.body.appendChild(bar);
    // The page ends above the bar, not under it.
    document.body.style.paddingBottom = bar.offsetHeight + 16 + "px";
    window.addEventListener("scroll", follow, { passive: true });
    follow();
    // The site loads more as the user scrolls; the count follows along.
    var observer = new MutationObserver(function () {
      if (window.__hfPending) return;
      window.__hfPending = setTimeout(function () {
        window.__hfPending = null;
        refresh();
      }, 500);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    refresh();
  }

  window.__hfReader = { refresh: refresh, setTotal: setTotal };
  mount();
})();
true;
`;
}

/** What the reader posts back: what a page holds, and the final ask. */
export interface ReaderMessage {
  /** "cards": a page filled in; "analyze": the user pressed the button */
  type: "cards" | "analyze";
  url: string;
  cards: { id: string; url: string; text: string }[];
}

