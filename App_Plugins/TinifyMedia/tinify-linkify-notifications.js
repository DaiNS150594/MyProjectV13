// Umbraco v13 Backoffice plugin
// Purpose: Umbraco notifications encode HTML in EventMessages, so we "linkify" our known Squoosh hint into a real anchor.
(function () {
  "use strict";

  var SQUOOSH_URL = "https://squoosh.app/";
  var MARKER = "here (" + SQUOOSH_URL + ")";
  var LINK_TEXT = "here";

  function createAnchor() {
    var a = document.createElement("a");
    a.href = SQUOOSH_URL;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = LINK_TEXT;
    return a;
  }

  function linkifyTextNode(textNode) {
    if (!textNode || textNode.nodeType !== 3) return false; // TEXT_NODE
    var value = textNode.nodeValue || "";
    var idx = value.indexOf(MARKER);
    if (idx === -1) return false;

    // Avoid double-processing
    var parent = textNode.parentNode;
    if (!parent) return false;
    if (parent.nodeName === "A") return false;

    var before = value.slice(0, idx);
    var after = value.slice(idx + MARKER.length);

    // Replace only the known marker with a real anchor.
    var frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(createAnchor());
    frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, textNode);
    return true;
  }

  function scan() {
    // Walk all text nodes under body; this is resilient to Umbraco DOM structure changes.
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    var replacedAny = false;
    while ((node = walker.nextNode())) {
      // Quick pre-filter
      if ((node.nodeValue || "").indexOf(MARKER) !== -1) {
        replacedAny = linkifyTextNode(node) || replacedAny;
      }
    }
    return replacedAny;
  }

  // Initial scan
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  // Observe new notifications
  var observer = new MutationObserver(function () {
    scan();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

