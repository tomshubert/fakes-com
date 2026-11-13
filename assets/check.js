(function () {
  var form = document.getElementById("checker");
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var lastHadImagesOnly = false, images = [], pdf = null, email = null, attachment = null, token = "", widget = null, mode = "message";
  var MAX_IMAGES = 3;

  var MODES = {
    message: {
      label: "Paste the message, email, link or phone number",
      placeholder: "Example: USPS: Your package is on hold. Update your address within 12 hours: ...",
      photos: "Add a screenshot, PDF, saved email or attachment", multi: false, docs: true, emails: true, attachments: true,
      empty: "Paste the message, or add a screenshot, PDF, saved email or attachment first."
    },
    listing: {
      label: "Paste the product listing: the item, price, seller name and web address",
      placeholder: "Example: Apple AirPods Pro 2, $49.99, sold by TechDealsDirect, ships from overseas in 2-3 weeks, link: ...",
      photos: "Add screenshots (up to 3) or a PDF", multi: true, docs: true,
      empty: "Paste the listing details or add a screenshot first."
    },
    claim: {
      label: "Paste the post, caption, rumor or claim, or add a screenshot of the photo or video",
      placeholder: "Example: Eating two tablespoons of apple cider vinegar a day reverses type 2 diabetes, doctors are hiding this!",
      photos: "Add a screenshot or PDF", multi: false, docs: true,
      empty: "Paste the post or rumor, or add a screenshot first.",
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

  function readAs(file, how) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      if (how === "text") r.readAsText(file); else if (how === "buffer") r.readAsArrayBuffer(file); else r.readAsDataURL(file);
    });
  }
  // File types that can run programs or hide malware. We never upload these; we warn right away.
  var DANGER = {
    program: ["exe","msi","bat","cmd","com","scr","pif","jar","app","apk","dmg","pkg","dll","xll","hta","reg","lnk"],
    script: ["js","jse","vbs","vbe","wsf","wsh","ps1","svg"],
    archive: ["zip","rar","7z","gz","tar","cab"],
    disk: ["iso","img","vhd","vhdx"],
    macro: ["docm","xlsm","pptm","dotm","xltm","one"],
    legacy: ["doc","xls","ppt"]
  };
  var DANGER_TEXT = {
    program: "This is a program. Opening it would run it on your computer, and real companies almost never email programs.",
    script: "This file can contain code that runs when it's opened. Scammers use this type to install malware or show fake login pages.",
    archive: "This is a compressed file. Scammers use them to hide programs from email filters.",
    disk: "This is a disk image. Opening it can reveal a hidden program. It's a common way to sneak malware past email filters.",
    macro: "This document type can contain macros, small programs that run when you click \"Enable content\". It's a classic way to install malware.",
    legacy: "This older Office format can contain hidden macros. Don't open it unless you were expecting it, and never click \"Enable content\" or \"Enable editing\"."
  };
  function dangerKind(name) {
    var n = name.toLowerCase(), ext = n.split(".").pop();
    if (/\.(pdf|docx?|xlsx?|jpe?g|png|txt)\.[a-z0-9]{2,4}$/.test(n) && ext !== "pdf") return "disguised";
    for (var k in DANGER) if (DANGER[k].indexOf(ext) !== -1) return k;
    return "";
  }
  function showDanger(name, kind) {
    var box = $("danger"); box.textContent = ""; box.hidden = false;
    var head = document.createElement("div"); head.className = "verdict-head";
    var st = document.createElement("span"); st.className = "stamp"; st.textContent = kind === "legacy" ? "CAUTION" : "DON'T OPEN";
    var hl = document.createElement("p"); hl.className = "verdict-line";
    hl.textContent = kind === "legacy" ? "Be careful with this file: " + name : "Don't open this file: " + name;
    head.appendChild(st); head.appendChild(hl); box.appendChild(head);
    var why = document.createElement("p");
    why.textContent = kind === "disguised"
      ? "Its name pretends to be a document or picture, but the real ending is different. That's a trick to get you to run a program."
      : DANGER_TEXT[kind];
    box.appendChild(why);
    box.appendChild(section("What to do", li([
      "Don't open it or click anything in the email.",
      "Delete the email. If it claims to be from someone you know, call them on a number you already have to ask if they sent it.",
      "If you already opened it, disconnect from the internet, run a full scan with your antivirus, and change important passwords from a different device."
    ])));
    var vt = document.createElement("p"); vt.className = "fine";
    vt.textContent = "Your file was not uploaded. We judged it by its name only. For a full virus scan, you can upload it to VirusTotal.com, but files uploaded there can be seen by security researchers, so don't upload anything private.";
    box.appendChild(vt);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function isPdf(f) { return f.type === "application/pdf" || /\.pdf$/i.test(f.name); }
  function isEmail(f) { return f.type === "message/rfc822" || /\.eml$/i.test(f.name); }
  function isImage(f) { return /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.name); }

  function isHtml(f) { return f.type === "text/html" || /\.(html?|xhtml|shtml)$/i.test(f.name); }
  function isOffice(f) { return /\.(docx|xlsx)$/i.test(f.name); }

  function readOffice(file) {
    return readAs(file, "buffer").then(function (buf) {
      if (!window.JSZip) throw new Error("no zip");
      return window.JSZip.loadAsync(buf);
    }).then(function (zip) {
      var names = Object.keys(zip.files);
      var macros = names.some(function (n) { return /vbaProject\.bin$/i.test(n); });
      var parts = /\.docx$/i.test(file.name)
        ? names.filter(function (n) { return /^word\/(document|header\d*|footer\d*)\.xml$/.test(n); })
        : names.filter(function (n) { return /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(n); }).slice(0, 6);
      return Promise.all(parts.map(function (n) { return zip.file(n).async("string"); })).then(function (xmls) {
        var text = xmls.join(" ").replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");
        return { kind: /\.docx$/i.test(file.name) ? "docx" : "xlsx", name: file.name, text: text.slice(0, 200000), macros: macros };
      });
    });
  }

  // Saved emails often carry large attachments or images the checker doesn't need.
  // Keep every header, every text/HTML part and each attachment's name and type,
  // but drop the bulky contents of other parts, right here in the browser.
  function slimEmail(raw) {
    var MAX = 950000;
    if (raw.length <= MAX) return raw;
    var bounds = [];
    raw.replace(/boundary="?([^";\r\n]+)"?/gi, function (m, b) { bounds.push("--" + b.trim()); return m; });
    var lines = raw.split(/\r?\n/), out = [], state = "top", keep = true, hdr = [], dropped = 0;
    function isBoundary(l) { for (var i = 0; i < bounds.length; i++) if (l.indexOf(bounds[i]) === 0) return true; return false; }
    function flushDropped() { if (dropped) { out.push("[Attachment content removed by Fakes.com to save space: about " + Math.round(dropped / 1024) + " KB]"); dropped = 0; } }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (bounds.length && isBoundary(l)) { flushDropped(); out.push(l); state = "hdr"; hdr = []; keep = true; continue; }
      if (state === "hdr") {
        out.push(l);
        if (l === "") {
          var h = hdr.join("\n").toLowerCase();
          var ct = (h.match(/content-type:\s*([^;\s]+)/) || [])[1] || "text/plain";
          keep = /^(text\/|multipart\/|message\/)/.test(ct);
          state = "body";
        } else hdr.push(l);
        continue;
      }
      if (state === "body" && !keep) { dropped += l.length + 1; continue; }
      out.push(l);
    }
    flushDropped();
    var slim = out.join("\r\n");
    return slim.length > MAX ? slim.slice(0, MAX) : slim;
  }

  function takeFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    var cfg = MODES[mode];
    images = []; pdf = null; email = null; attachment = null; $("shot-name").textContent = ""; $("danger").hidden = true; $("shot-note").hidden = true;
    if (!files.length) return;
    var risky = files.find(function (f) { return dangerKind(f.name); });
    if (risky) { $("shot").value = ""; showDanger(risky.name, dangerKind(risky.name)); return; }
    var att = files.find(function (f) { return isHtml(f) || isOffice(f); });
    if (att) {
      if (!cfg.attachments) { $("shot-name").textContent = "Email attachments can be checked in the \"message, email or website\" option."; return; }
      if (att.size > 5 * 1024 * 1024) { $("shot-name").textContent = "That file is too large (limit 5 MB)."; return; }
      var job = isHtml(att)
        ? readAs(att, "text").then(function (txt) { return { kind: "html", name: att.name, text: String(txt).slice(0, 1000000) }; })
        : readOffice(att);
      return job.then(function (a) { attachment = a; $("shot-name").textContent = "Added: " + att.name; })
        .catch(function () { $("shot-name").textContent = "That file couldn't be read."; });
    }
    var doc = files.find(function (f) { return isPdf(f) || isEmail(f); });
    if (doc) {
      if (isEmail(doc) && !cfg.emails) { $("shot-name").textContent = "Saved emails can be checked in the \"message, email or website\" option."; return; }
      if (isPdf(doc) && !cfg.docs) { $("shot-name").textContent = "Please add photos for this kind of check."; return; }
      var limitMB = isPdf(doc) ? 3 : 25;
      if (doc.size > limitMB * 1024 * 1024) { $("shot-name").textContent = "That file is too large (limit " + limitMB + " MB)."; return; }
      return readAs(doc, isEmail(doc) ? "text" : "dataurl").then(function (res) {
        if (isEmail(doc)) email = slimEmail(String(res)); else pdf = { data: String(res).split(",")[1] };
        $("shot-name").textContent = "Added: " + doc.name;
      }).catch(function () { $("shot-name").textContent = "That file couldn't be read."; });
    }
    var pics = files.filter(isImage);
    if (!pics.length) { $("shot-name").textContent = "That type of file can't be checked here. Use a photo, screenshot, PDF, saved email (.eml), or a Word, Excel or HTML attachment."; return; }
    var limit = cfg.multi ? MAX_IMAGES : 1;
    if (pics.length > limit) { $("shot-name").textContent = "Only the first " + limit + " will be used."; pics = pics.slice(0, limit); }
    Promise.all(pics.map(shrink)).then(function (list) {
      images = list;
      $("shot-name").textContent = "Added: " + pics.map(function (f) { return f.name; }).join(", ");
      if (mode === "message") { $("shot-note").hidden = false; $("email-help").open = true; }
    }).catch(function () { $("shot-name").textContent = "A file couldn't be read. Try JPG or PNG photos."; });
  }

  function setMode(m) {
    mode = MODES[m] ? m : "message";
    var cfg = MODES[mode];
    $("msg-label").textContent = cfg.label;
    $("msg").placeholder = cfg.placeholder;
    $("shot-label").textContent = cfg.photos;
    $("shot").multiple = cfg.multi;
    $("shot").accept = cfg.attachments ? "" : "image/*" + (cfg.docs ? ",.pdf,application/pdf" : "") + (cfg.emails ? ",.eml,message/rfc822" : "");
    $("email-help").hidden = !cfg.emails;
    $("mode-note").textContent = cfg.note || "";
    $("mode-note").hidden = !cfg.note;
    images = []; pdf = null; email = null; attachment = null; $("shot").value = ""; $("shot-name").textContent = ""; $("danger").hidden = true; $("shot-note").hidden = true;
    $("err").textContent = ""; $("result").hidden = true;
    document.querySelectorAll(".mode-tabs input").forEach(function (r) { r.checked = r.value === mode; });
  }
  document.querySelectorAll(".mode-tabs input").forEach(function (r) {
    r.addEventListener("change", function () { if (r.checked) setMode(r.value); });
  });
  var fromHash = (location.hash || "").replace("#", "");
  setMode(MODES[fromHash] ? fromHash : "message");

  $("shot").addEventListener("change", function () { takeFiles(this.files); });

  // Drag and drop anywhere on the form.
  ["dragenter", "dragover"].forEach(function (ev) {
    form.addEventListener(ev, function (e) { e.preventDefault(); form.classList.add("dragging"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    form.addEventListener(ev, function (e) { e.preventDefault(); if (ev === "drop" || e.target === form) form.classList.remove("dragging"); });
  });
  form.addEventListener("drop", function (e) { takeFiles(e.dataTransfer && e.dataTransfer.files); });

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
    if (mode === "message" && lastHadImagesOnly) {
      var n = document.createElement("p");
      n.textContent = "This answer is based on a picture, which can't show where the links in an email or text really go. A message can look completely genuine while its buttons lead to a scam site. For a full check, save the email as a file and add it here, and don't click its links in the meantime.";
      out.appendChild(section("What a screenshot can't show", n));
    }
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
    if (!text && !images.length && !pdf && !email && !attachment) { $("err").textContent = MODES[mode].empty; return; }
    lastHadImagesOnly = images.length > 0 && !email && !pdf && !attachment;
    var btn = $("go"); btn.disabled = true; btn.textContent = "Checking…";
    var hasLink = /https?:\/\/|www\.|\.[a-z]{2,}\//i.test(text) || !!email || !!attachment;
    var steps = ["Reading what you sent…"];
    if (images.length) steps.push(mode === "item" ? "Looking closely at your photos…" : "Reading your screenshot…");
    if (pdf) steps.push("Reading the PDF…");
    if (email) steps.push("Checking who really sent the email…", "Finding where its links really go…");
    else if (attachment) steps.push("Looking inside the attachment…");
    if (hasLink && mode !== "item") steps.push("Checking the website against Google's list of dangerous sites…", "Looking up when the website was created…");
    if (mode === "claim") steps.push("Searching the web for reliable sources…", "Comparing what the sources say…");
    else if (mode === "listing") steps.push("Comparing the listing with common counterfeit signs…");
    else steps.push("Looking for common scam warning signs…");
    steps.push("Writing up what we found…", "Still working. Detailed checks can take a little longer…");
    $("working-est").textContent = mode === "claim" ? "30–60" : hasLink ? "15–30" : "10–20";
    $("working-step").textContent = steps[0]; $("working-secs").textContent = "0"; $("working").hidden = false;
    var started = Date.now(), stepAt = 0;
    var ticker = setInterval(function () {
      var secs = Math.floor((Date.now() - started) / 1000);
      $("working-secs").textContent = String(secs);
      var next = Math.min(steps.length - 1, Math.floor(secs / (mode === "claim" ? 7 : 4)));
      if (next !== stepAt) { stepAt = next; $("working-step").textContent = steps[next]; }
    }, 500);
    var payload = JSON.stringify({ mode: mode, text: text, images: images, pdf: pdf, email: email, attachment: attachment, turnstile: token });
    // Use XMLHttpRequest so we can show upload progress for larger files (fetch can't report it).
    new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/check"); xhr.setRequestHeader("content-type", "application/json");
      if (payload.length > 250000 && xhr.upload) {
        $("upload").hidden = false; $("upload-bar").style.width = "0%"; $("upload-pct").textContent = "0%";
        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable) return;
          var pct = Math.min(100, Math.round(e.loaded / e.total * 100));
          $("upload-bar").style.width = pct + "%"; $("upload-pct").textContent = pct + "%";
        };
        xhr.upload.onload = function () { $("upload").hidden = true; started = Date.now(); };
      }
      xhr.onload = function () { var d = null; try { d = JSON.parse(xhr.responseText); } catch (e) {} resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, d: d }); };
      xhr.onerror = function () { reject(new Error("The checker couldn't be reached. Please check your internet connection and try again.")); };
      xhr.send(payload);
    })
      .then(function (x) {
        if (!x.d) throw new Error("The checker had a problem (error " + x.status + "). Please try again in a minute.");
        if (!x.ok || x.d.error) throw new Error((x.d.error || "Something went wrong.") + (x.d.code ? " (code " + x.d.code + ")" : "")); render(x.d); })
      .catch(function (e) { $("err").textContent = (e && e.message && !/JSON|token/i.test(e.message)) ? e.message : "The checker couldn't be reached. Please try again in a minute."; })
      .finally(function () { clearInterval(ticker); $("working").hidden = true; $("upload").hidden = true; btn.disabled = false; btn.textContent = "Check it"; if (widget !== null && window.turnstile) { window.turnstile.reset(widget); token = ""; } });
  });
})();
