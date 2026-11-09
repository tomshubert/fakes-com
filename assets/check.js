(function () {
  var form = document.getElementById("checker");
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var image = null, token = "", widget = null;

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

  $("shot").addEventListener("change", function () {
    var f = this.files && this.files[0];
    image = null; $("shot-name").textContent = "";
    if (!f) return;
    shrink(f).then(function (d) { image = d; $("shot-name").textContent = "Added: " + f.name; })
      .catch(function () { $("shot-name").textContent = "That file couldn't be read. Try a JPG or PNG screenshot."; });
  });

  var LABELS = {
    likely_scam: ["LIKELY SCAM", "fake"], suspicious: ["SUSPICIOUS", "fake"],
    no_red_flags_found: ["NO RED FLAGS FOUND", "real"], cant_tell: ["CAN'T TELL", "neutral"]
  };
  function li(arr) { var ul = document.createElement("ul"); arr.forEach(function (t) { var l = document.createElement("li"); l.textContent = t; ul.appendChild(l); }); return ul; }
  function section(title, node) { var d = document.createElement("div"); var h = document.createElement("h3"); h.textContent = title; d.appendChild(h); d.appendChild(node); return d; }

  function render(r) {
    var out = $("result"); out.textContent = ""; out.hidden = false;
    var lab = LABELS[r.verdict] || LABELS.cant_tell;
    var head = document.createElement("div"); head.className = "verdict-head";
    var st = document.createElement("span"); st.className = "stamp " + (lab[1] === "real" ? "real" : lab[1] === "neutral" ? "neutral" : ""); st.textContent = lab[0];
    var hl = document.createElement("p"); hl.className = "verdict-line"; hl.textContent = r.headline;
    head.appendChild(st); head.appendChild(hl); out.appendChild(head);
    if (r.red_flags.length) out.appendChild(section("Red flags", li(r.red_flags)));
    if (r.reassuring_signs.length) out.appendChild(section("Signs in its favor", li(r.reassuring_signs)));
    if (r.what_to_do.length) out.appendChild(section("What to do", li(r.what_to_do)));
    if (r.how_to_verify) { var p = document.createElement("p"); p.textContent = r.how_to_verify; out.appendChild(section("How to check for sure", p)); }
    var note = document.createElement("p"); note.className = "fine";
    note.textContent = "This is an automated check and can be wrong. When in doubt, contact the company or person directly using a phone number or website you find yourself.";
    out.appendChild(note);
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var text = $("msg").value.trim();
    $("err").textContent = "";
    if (!text && !image) { $("err").textContent = "Paste the message or add a screenshot first."; return; }
    var btn = $("go"); btn.disabled = true; btn.textContent = "Checking…";
    fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text, image: image, turnstile: token }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) { if (!x.ok || x.d.error) throw new Error(x.d.error || "Something went wrong."); render(x.d); })
      .catch(function (e) { $("err").textContent = e.message || "The checker couldn't be reached. Please try again."; })
      .finally(function () { btn.disabled = false; btn.textContent = "Check it"; if (widget !== null && window.turnstile) { window.turnstile.reset(widget); token = ""; } });
  });
})();
