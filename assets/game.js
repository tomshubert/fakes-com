(function () {
  var pool = window.FAKES_GAME || [];
  var root = document.getElementById("game");
  if (!root || !pool.length) return;
  var perDay = 3;
  var day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  var start = (day * perDay) % pool.length;
  var today = [];
  for (var k = 0; k < perDay; k++) today.push(pool[(start + k) % pool.length]);

  var i = 0, right = 0, seen = 0;
  var $ = function (id) { return document.getElementById(id); };
  function show() {
    $("qnum").textContent = "Message " + (i + 1) + " of " + today.length;
    $("qmsg").textContent = today[i].m;
    $("qres").hidden = true; $("next").hidden = true;
    $("btn-real").disabled = $("btn-fake").disabled = false;
  }
  function pick(ans) {
    var q = today[i], ok = ans === q.a; seen++; if (ok) right++;
    var res = $("qres"); res.textContent = "";
    var b = document.createElement("b");
    b.style.color = q.a === "fake" ? "var(--fake)" : "var(--real)";
    b.textContent = (ok ? "Correct. " : "Not quite. ") + "It's " + q.a.toUpperCase() + ". ";
    res.appendChild(b); res.appendChild(document.createTextNode(q.why));
    res.hidden = false;
    $("score").textContent = "Score: " + right + " / " + seen;
    $("btn-real").disabled = $("btn-fake").disabled = true;
    $("next").textContent = i < today.length - 1 ? "Next message" : "Play again";
    $("next").hidden = false;
  }
  $("btn-real").addEventListener("click", function () { pick("real"); });
  $("btn-fake").addEventListener("click", function () { pick("fake"); });
  $("next").addEventListener("click", function () {
    if (i < today.length - 1) { i++; } else { i = 0; right = 0; seen = 0; $("score").textContent = "Score: 0 / 0"; }
    show();
  });
  show();
})();
