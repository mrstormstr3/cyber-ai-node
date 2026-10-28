/* ===== Narrated walkthrough: drives the guided demo, speaks the 2-minute script, captions + spotlight ===== */
(function () {
  const { engine, bus, app } = window.cyberAINode;
  const $ = s => document.querySelector(s);
  const ORIGIN = "demo-sub-a";
  const sc = e => e.nodes[ORIGIN] && e.nodes[ORIGIN].scen;
  const NODE = id => `.nd[data-id="${id}"]`;

  // Cue list: fires in order when `when` is true. If the previous line is still speaking, the sim pauses so visuals stay in sync.
  const CUES = [
    { when: e => e.t >= 0.5, focus: ".mapp", text: "This is Cyber AI Node, a supervised edge security system. Here it runs on synthetic data across Utah energy sites. Each square is a node. The hexagon is the operator console." },
    { when: e => sc(e) && sc(e).device != null, focus: NODE(ORIGIN), pad: 40, text: "At our test substation, an unfamiliar device joins the sensor network. The node's network agent flags it on-site. Raw data never leaves." },
    { when: e => sc(e) && sc(e).cab != null, focus: NODE(ORIGIN), pad: 40, text: "Next, the cabinet door opens with no badge record." },
    { when: e => sc(e) && sc(e).write != null, focus: "#stepbar", text: "Then, an unexpected Modbus write. The correlator links all three events. High severity, ninety-two percent confidence." },
    { when: e => e.nodes[ORIGIN].up.some(m => m.kind === "evidence"), focus: NODE(ORIGIN), pad: 40, text: "Notice the link just dropped. The analysis still finished, and the evidence package waits in a local queue until the link returns." },
    { when: e => e.inbox.length > 0, focus: "#console .card", consoleTo: 1, text: "The operator receives one structured package: the correlated events, a tamper-evident hash, and a recommended action at the security gateway. Breakers and setpoints are never touched. A person decides.", after: "approve" },
    { when: e => e.inbox[0] && e.inbox[0].status === "approved", focus: NODE(ORIGIN), pad: 40, text: "Approved. The gateway isolates the port. The threat is contained, and the power keeps flowing." },
    { when: e => !!e.rollout, focus: "#console section:nth-of-type(3)", consoleTo: 3, text: "Now the fleet learns. A signed detection pack goes to one canary node first, then to every node. Each verifies the signature before applying it." },
    { when: e => e.guided && e.guided.reconnectSet, focus: NODE("honeycomb"), pad: 40, text: "Honeycomb was offline. It applies the update as soon as it reconnects." },
    { when: e => e.guided && e.guided.step >= 7, focus: ".mapp", text: "Every site also gets a sanitized alert. The pattern only, no raw data." },
    { when: () => true, focus: "#btnUnsigned", consoleTo: 2, click: "#btnUnsigned", text: "And an unsigned update? Every node rejects it." },
    { when: e => e.rejected > 0, focus: "#metrics", text: "Detection in twenty-four seconds. Over ninety-nine percent of data stays on-site. And a person approves every response. Cyber AI Node, designed to reduce risk from AI-assisted attacks." }
  ];

  const VOICE_PREF = ["Microsoft Andrew Online (Natural)", "Microsoft Brian Online (Natural)", "Microsoft Roger Online (Natural)", "Microsoft Steffan Online (Natural)", "Evan (Premium)", "Nathan (Premium)", "Tom (Premium)", "Evan (Enhanced)", "Nathan (Enhanced)", "Tom (Enhanced)", "Aaron (Enhanced)", "Daniel (Enhanced)", "Oliver (Enhanced)", "Microsoft Guy Online (Natural)", "Microsoft Christopher Online (Natural)", "Microsoft Brian Online (Natural)", "Microsoft Davis Online (Natural)", "Microsoft Eric Online (Natural)", "Google UK English Male", "Daniel", "Aaron", "Arthur", "Alex", "Microsoft David", "Fred"];
  const tts = "speechSynthesis" in window ? window.speechSynthesis : null;
  let voices = [];
  function loadVoices() {
    if (!tts) return;
    const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Junior|Ralph|Fred|Kathy|Rocko|Sandy|Shelley|Flo|Eddy|Reed)\b/;
    const q = v => /Natural|Premium|Enhanced|Neural/i.test(v.name) ? 0 : 1;
    voices = tts.getVoices().filter(v => /^en/i.test(v.lang) && !NOVELTY.test(v.name)).sort((a, b) => q(a) - q(b));
    const sel = $("#pVoice"); if (!sel) return;
    const cur = sel.value || (pickVoice() || {}).name || "";
    sel.innerHTML = (AUDIO.ok ? `<option value="__audio">Recorded narration (audio/)</option>` : "") + (voices.length ? voices.map(v => `<option value="${esc(v.name)}">${esc(v.name.replace(/^Microsoft /, "").replace(/ - English.*$/, ""))}${/Natural|Premium|Enhanced|Neural/i.test(v.name) ? " ★" : ""}</option>`).join("") : `<option value="">Default voice</option>`);
    if (AUDIO.ok && !sel.dataset.touched) { sel.value = "__audio"; return; }
    if (cur) sel.value = cur;
  }
  function pickVoice() {
    for (const n of VOICE_PREF) { const v = voices.find(x => x.name === n || x.name.startsWith(n)); if (v) return v; }
    return voices.find(v => /male|guy|man\b|david|daniel|alex|andrew|brian|christopher|eric|davis/i.test(v.name)) || voices.find(v => v.lang === "en-US") || voices[0] || null;
  }
  // Optional recorded narration: audio/cue-01.mp3 … audio/cue-12.mp3 (any human or AI voice). Used instead of browser speech when all files load.
  const AUDIO = { ok: false, els: [] };
  (function probe() {
    let loaded = 0, failed = false;
    for (let i = 0; i < CUES.length; i++) {
      const a = new Audio(); a.preload = "auto";
      a.addEventListener("loadedmetadata", () => { if (++loaded === CUES.length && !failed) { AUDIO.ok = true; loadVoices(); } }, { once: true });
      a.addEventListener("error", () => { failed = true; }, { once: true });
      a.src = `audio/cue-${String(i + 1).padStart(2, "0")}.mp3`; AUDIO.els.push(a);
    }
  })();
  if (tts) { loadVoices(); tts.onvoiceschanged = loadVoices; }

  const P = { running: false, i: 0, speaking: false, busy: false, muted: false, target: null, pad: 14, t0: 0, rate: 0.95 };

  function ui() {
    const spot = document.createElement("div"); spot.className = "pspot";
    const cap = document.createElement("div"); cap.className = "pcap"; cap.setAttribute("role", "status"); cap.setAttribute("aria-live", "polite");
    cap.innerHTML = `<span class="pn mono"></span><p></p>`;
    const ctl = document.createElement("div"); ctl.className = "pctl";
    ctl.innerHTML = `<span class="prec" aria-hidden="true"></span><b class="mono" id="pTime">0:00</b><label class="sr-only" for="pVoice">Narrator voice</label><select id="pVoice"></select><button type="button" id="pMute" aria-pressed="false">Mute</button><button type="button" id="pStop">Stop</button>`;
    document.body.append(spot, cap, ctl);
    P.el = { spot, cap, ctl };
    loadVoices();
    ctl.querySelector("#pStop").addEventListener("click", () => stop());
    ctl.querySelector("#pVoice").addEventListener("change", ev => { ev.target.dataset.touched = "1"; });
    ctl.querySelector("#pMute").addEventListener("click", ev => { P.muted = !P.muted; ev.target.setAttribute("aria-pressed", String(P.muted)); ev.target.textContent = P.muted ? "Unmute" : "Mute"; });
  }

  function caption(i, text) { P.el.cap.querySelector("p").textContent = text; P.el.cap.querySelector(".pn").textContent = `${i + 1}/${CUES.length}`; P.el.cap.classList.add("on"); }

  function usableBottom() { return innerHeight - (P.el.cap.offsetHeight + 34); }
  function ensureVisible(el) {
    if (!el) return;
    const r = el.getBoundingClientRect(), ub = usableBottom();
    const base = Math.max(0, $(".toolbar").getBoundingClientRect().top + scrollY - 6);
    const stepB = $("#stepbar").getBoundingClientRect().bottom + scrollY;
    let top = scrollY;
    if (r.top + scrollY >= base && r.bottom + scrollY <= base + ub && stepB <= base + ub + 40) top = base;
    else if (r.top < 8 || r.bottom > ub) top = scrollY + r.top - Math.max(8, (ub - r.height) / 2);
    if (Math.abs(top - scrollY) > 4) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
  function consoleTo(n) {
    const inner = $("#console .inner"), sec = inner && inner.querySelector(`section:nth-of-type(${n})`);
    if (!sec || inner.scrollHeight <= inner.clientHeight) return;
    inner.scrollTo({ top: n === 1 ? 0 : sec.offsetTop - 64, behavior: "smooth" });
  }
  function spotLoop() {
    if (!P.running) return;
    const el = P.target && document.querySelector(P.target);
    if (el && el.getClientRects().length) {
      const r = el.getBoundingClientRect(), p = P.pad, s = P.el.spot.style;
      s.left = (r.left - p) + "px"; s.top = (r.top - p) + "px"; s.width = (r.width + 2 * p) + "px"; s.height = (r.height + 2 * p) + "px";
      P.el.spot.classList.add("on");
    } else P.el.spot.classList.remove("on");
    const sec = Math.floor((performance.now() - P.t0) / 1000);
    $("#pTime").textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    requestAnimationFrame(spotLoop);
  }
  function focus(sel, pad) { P.target = sel; P.pad = pad || 12; ensureVisible(document.querySelector(sel)); }
  function ripple(el) {
    const r = el.getBoundingClientRect(), d = document.createElement("div");
    d.className = "pclick"; d.style.left = (r.left + r.width / 2) + "px"; d.style.top = (r.top + r.height / 2) + "px";
    document.body.appendChild(d); setTimeout(() => d.remove(), 800);
  }

  function speak(text, done, idx) {
    const words = text.split(/\s+/).length, est = words / 2.4 * 1000;
    let finished = false; const fin = () => { if (finished) return; finished = true; clearTimeout(P.dog); done(); };
    const selV = $("#pVoice") && $("#pVoice").value;
    if (AUDIO.ok && selV === "__audio" && AUDIO.els[idx]) {
      const a = AUDIO.els[idx]; a.currentTime = 0; a.muted = P.muted; P.a = a;
      a.onended = fin; a.onerror = () => { P.dog = setTimeout(fin, est); };
      P.dog = setTimeout(fin, ((a.duration || est / 1000) * 1000) + 3000);
      a.play().catch(() => { clearTimeout(P.dog); P.dog = setTimeout(fin, est); });
      return;
    }
    if (!tts || P.muted) { P.dog = setTimeout(fin, est); return; }
    const parts = text.match(/[^.!?:]+[.!?:]+/g) || [text]; let i = 0;
    const sel = $("#pVoice"), v = voices.find(x => x.name === (sel && sel.value)) || pickVoice();
    const next = () => {
      if (!P.running) return;
      if (i >= parts.length) { fin(); return; }
      const u = new SpeechSynthesisUtterance(parts[i++].trim());
      if (v) u.voice = v; u.lang = v ? v.lang : "en-US"; u.rate = P.rate; u.pitch = 0.92; u.volume = 1;
      u.onend = () => setTimeout(next, 140); u.onerror = () => setTimeout(next, 140);
      P.u = u; tts.speak(u);
    };
    P.dog = setTimeout(fin, est * 2 + 4000);
    next();
  }

  function fire(i) {
    const c = CUES[i];
    P.speaking = true;
    if (c.consoleTo) consoleTo(c.consoleTo);
    setTimeout(() => focus(c.focus, c.pad), c.consoleTo ? 350 : 0);
    caption(i, c.text);
    if (c.click) setTimeout(() => { const b = $(c.click); if (b && P.running) { ripple(b); b.click(); } }, 900);
    speak(c.text, () => {
      P.speaking = false;
      if (c.after === "approve") {
        P.busy = true;
        const sel = '#console [data-a="approve"]'; focus(sel, 8);
        setTimeout(() => { const b = $(sel); if (b && P.running) { ripple(b); b.click(); } P.busy = false; }, 1000);
      }
    }, i);
  }

  function tick() {
    if (!P.running) return;
    const c = CUES[P.i];
    if (!c) { if (!P.speaking && !P.busy) { engine.paused = false; setTimeout(stop, 1200); P.running = "ending"; } return; }
    if (c.when(engine)) {
      if (P.speaking || P.busy) engine.paused = true;
      else { engine.paused = false; fire(P.i); P.i++; }
    } else if (!P.speaking && !P.busy) engine.paused = false;
  }

  function start() {
    if (P.running) return;
    if (!P.el) ui();
    if (app.drawer.id) app.drawer.close();
    document.querySelectorAll(".info[aria-expanded=true]").forEach(b => b.click());
    $("#chkStep").checked = false; $("#chkAuto").checked = false;
    app.speed = 1; app.filter = "all"; app.last = { kind: "guided" };
    document.body.classList.add("presenting");
    P.running = true; P.i = 0; P.speaking = false; P.busy = false; P.t0 = performance.now();
    if (tts) tts.cancel();
    engine.runGuided({ autoApprove: false, stepMode: false, lead: 14, offlineFor: 14 });
    app.wallAt = performance.now();
    window.scrollTo({ top: Math.max(0, $(".toolbar").getBoundingClientRect().top + scrollY - 6), behavior: "smooth" });
    P.timer = setInterval(tick, 100);
    requestAnimationFrame(spotLoop);
    $("#pStop").focus();
  }
  function stop() {
    if (!P.running) return;
    P.running = false; clearInterval(P.timer); clearTimeout(P.dog);
    if (tts) tts.cancel();
    if (P.a) { P.a.pause(); P.a = null; }
    engine.paused = false;
    document.body.classList.remove("presenting");
    P.el.spot.classList.remove("on"); P.el.cap.classList.remove("on");
    bus.emit("state", engine);
    $("#btnPresent").focus();
  }

  $("#btnPresent").addEventListener("click", start);
  window.addEventListener("keydown", ev => { if (ev.key === "Escape" && P.running) stop(); });
  window.cyberAINode.presenter = { start, stop, cues: CUES };
})();
