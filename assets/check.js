(function () {
  var form = document.getElementById("checker");
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var images = [], token = "", widget = null, mode = "message";
  var MAX_IMAGES = 3;

  var MODES = {
    message: {
      label: "Paste the message, email, link or phone number",
      placeholder: "Example: USPS: Your package is on hold. Update your address within 12 hours: ...",
      photos: "Add a screenshot", multi: false,
      empty: "Paste the message or add a screenshot first."
    },
    listing: {
      label: "Paste the product listing: the item, price, seller name and web address",
      placeholder: "Example: Apple AirPods Pro 2, $49.99, sold by TechDealsDirect, ships from overseas in 2-3 weeks, link: ...",
      photos: "Add screenshots (up to 3)", multi: true,
      empty: "Paste the listing details or add a screenshot first."
    },
    claim: {
      label: "Paste the post, caption, headline or claim (or add a screenshot)",
      placeholder: "Example: Eating two tablespoons of apple cider vinegar a day reverses type 2 diabetes, doctors are hiding this!",
      photos: "Add a screenshot", multi: false,
      empty: "Paste the post or claim, or add a screenshot first.",
      note: "One free fact-check per day. Facebook, Instagram and TikTok links can't be opened, so paste the words or add a screenshot."
    },
    item: {
      label: "Describe the item: brand, product, where you bought it and what you paid",
      placeholder: "Example: Nike Air Jordan 1 bought on a resale app for $90. The box label looks blurry.",
      photos: "Add photos of the item (up to 3)", multi: true,
      empty: "Add at least one photo of the item first."
    }
  };

  // Load the "verify you're human" check if it's configured.
  fetch("/api/config").then(function (r) { return r.json(); }).then(function (c) {
    if (!c.turnstileSiteKey) return;
    window.onTurnstileReady = function () {
      widget = window.turnstile.render("#human", {
        sitekey: c.turnstileSiteKey,
        callback: function (t) { token = t; },
        "expired-callback": function () { token = ""; },
        "error-callback": function () { token = ""; }
      });
    };
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady&render=explicit";
    s.async = true; document.head.appendChild(s);
  }).catch(function () {});

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1568, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ media_type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  function setMode(m) {
    mode = MODES[m] ? m : "message";
    var cfg = MODES[mode];
    $("msg-label").textContent = cfg.label;
    $("msg").placeholder = cfg.placeholder;
    $("shot-label").textContent = cfg.photos;
    $("shot").multiple = cfg.multi;
    $("mode-note").textContent = cfg.note || "";
    $("mode-note").hidden = !cfg.note;
    images = []; $("shot").value = ""; $("shot-name").textContent = "";
    $("err").textContent = ""; $("result").hidden = true;
    document.querySelectorAll(".mode-tabs input").forEach(function (r) { r.checked = r.value === mode; });
  }
  document.querySelectorAll(".mode-tabs input").forEach(function (r) {
    r.addEventListener("change", function () { if (r.checked) setMode(r.value); });
  });
  var fromHash = (location.hash || "").replace("#", "");
  setMode(MODES[fromHash] ? fromHash : "message");

  $("shot").addEventListener("change", function () {
    var files = Array.prototype.slice.call(this.files || []);
    images = []; $("shot-name").textContent = "";
    if (!files.length) return;
    var limit = MODES[mode].multi ? MAX_IMAGES : 1;
    if (files.length > limit) { $("shot-name").textContent = "Only the first " + limit + " will be used."; files = files.slice(0, limit); }
    Promise.all(files.map(shrink)).then(function (list) {
      images = list;
      $("shot-name").textContent = "Added: " + files.map(function (f) { return f.name; }).join(", ");
    }).catch(function () { $("shot-name").textContent = "A file couldn't be read. Try JPG or PNG photos."; });
  });

  var LABELS = {
    message: { likely_scam: ["LIKELY SCAM", "fake"], suspicious: ["SUSPICIOUS", "fake"], no_red_flags_found: ["NO RED FLAGS FOUND", "real"], cant_tell: ["CAN'T TELL", "neutral"] },
    product: { likely_scam: ["LIKELY FAKE", "fake"], suspicious: ["SUSPICIOUS", "fake"], no_red_flags_found: ["NO RED FLAGS FOUND", "real"], cant_tell: ["CAN'T TELL", "neutral"] }
  };
  function li(arr) { var ul = document.createElement("ul"); arr.forEach(function (t) { var l = document.createElement("li"); l.textContent = t; ul.appendChild(l); }); return ul; }
  function section(title, node) { var d = document.createElement("div"); var h = document.createElement("h3"); h.textContent = title; d.appendChild(h); d.appendChild(node); return d; }

  var RATINGS = {
    "false": ["FALSE", "fake"], misleading: ["MISLEADING", "fake"], unproven: ["UNPROVEN", "neutral"],
    disputed: ["DISPUTED", "neutral"], mostly_true: ["MOSTLY TRUE", "real"], "true": ["TRUE", "real"], opinion: ["OPINION", "neutral"]
  };
  var OVERALL = {
    "false": ["FALSE", "fake"], misleading: ["MISLEADING", "fake"], mixed: ["MIXED", "neutral"],
    supported: ["SUPPORTED", "real"], cant_tell: ["CAN'T TELL", "neutral"]
  };
  function stamp(lab, small) {
    var s = document.createElement("span");
    s.className = "stamp" + (lab[1] === "real" ? " real" : lab[1] === "neutral" ? " neutral" : "") + (small ? " small" : "");
    s.textContent = lab[0]; return s;
  }
  function renderClaim(r) {
    var out = $("result"); out.textContent = ""; out.hidden = false;
    var head = document.createElement("div"); head.className = "verdict-head";
    head.appendChild(stamp(OVERALL[r.overall] || OVERALL.cant_tell));
    var hl = document.createElement("p"); hl.className = "verdict-line"; hl.textContent = r.headline;
    head.appendChild(hl); out.appendChild(head);
    r.claims.forEach(function (c) {
      var box = document.createElement("div"); box.className = "claim";
      var top = document.createElement("div"); top.className = "claim-top";
      top.appendChild(stamp(RATINGS[c.rating] || RATINGS.unproven, true));
      var q = document.createElement("p"); q.className = "claim-text"; q.textContent = c.claim; top.appendChild(q);
      box.appendChild(top);
      var ex = document.createElement("p"); ex.textContent = c.explanation; box.appendChild(ex);
      if (c.sources.length) {
        var ul = document.createElement("ul"); ul.className = "claim-sources";
        c.sources.forEach(function (s) {
          var l = document.createElement("li"); var a = document.createElement("a");
          a.href = s.url; a.textContent = s.title || s.url; a.target = "_blank"; a.rel = "noopener nofollow";
          l.appendChild(a); ul.appendChild(l);
        });
        box.appendChild(ul);
      }
      out.appendChild(box);
    });
    if (r.what_to_do.length) out.appendChild(section("What to do", li(r.what_to_do)));
    var note = document.createElement("p"); note.className = "fine";
    note.textContent = "This is an automated fact-check based on a quick web search, and it can be wrong. Read the sources yourself before sharing or acting on anything.";
    out.appendChild(note);
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function render(r) {
    if (r.mode === "claim") return renderClaim(r);
    var out = $("result"); out.textContent = ""; out.hidden = false;
    var set = mode === "message" ? LABELS.message : LABELS.product;
    var lab = set[r.verdict] || set.cant_tell;
    var head = document.createElement("div"); head.className = "verdict-head";
    var st = document.createElement("span"); st.className = "stamp " + (lab[1] === "real" ? "real" : lab[1] === "neutral" ? "neutral" : ""); st.textContent = lab[0];
    var hl = document.createElement("p"); hl.className = "verdict-line"; hl.textContent = r.headline;
    head.appendChild(st); head.appendChild(hl); out.appendChild(head);
    if (r.red_flags.length) out.appendChild(section(mode === "message" ? "Red flags" : "Warning signs", li(r.red_flags)));
    if (r.reassuring_signs.length) out.appendChild(section("Signs in its favor", li(r.reassuring_signs)));
    if (r.what_to_do.length) out.appendChild(section("What to do", li(r.what_to_do)));
    if (r.how_to_verify) { var p = document.createElement("p"); p.textContent = r.how_to_verify; out.appendChild(section("How to check for sure", p)); }
    if (mode !== "message") {
      var more = document.createElement("p");
      more.appendChild(document.createTextNode("See our "));
      var a = document.createElement("a"); a.href = "/verify/"; a.textContent = "brand verification guides";
      more.appendChild(a); more.appendChild(document.createTextNode(" for official ways to confirm a product is genuine."));
      out.appendChild(more);
    }
    var note = document.createElement("p"); note.className = "fine";
    note.textContent = mode === "message"
      ? "This is an automated check and can be wrong. When in doubt, contact the company or person directly using a phone number or website you find yourself."
      : "This is an automated check and can be wrong. Photos can't prove a product is genuine. Only the brand or a professional authenticator can confirm that.";
    out.appendChild(note);
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var text = $("msg").value.trim();
    $("err").textContent = "";
    if (mode === "item" && !images.length) { $("err").textContent = MODES.item.empty; return; }
    if (!text && !images.length) { $("err").textContent = MODES[mode].empty; return; }
    var btn = $("go"); btn.disabled = true; btn.textContent = mode === "claim" ? "Fact-checking… (up to a minute)" : "Checking…";
    fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: mode, text: text, images: images, turnstile: token }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) { if (!x.ok || x.d.error) throw new Error(x.d.error || "Something went wrong."); render(x.d); })
      .catch(function (e) { $("err").textContent = e.message || "The checker couldn't be reached. Please try again."; })
      .finally(function () { btn.disabled = false; btn.textContent = "Check it"; if (widget !== null && window.turnstile) { window.turnstile.reset(widget); token = ""; } });
  });
})();
