/* ===== App wiring: URL params, controls, simulation loop ===== */
(function () {
  const qs = new URLSearchParams(location.search);
  const seedQ = parseInt(qs.get("seed"), 10), seed = Number.isFinite(seedQ) ? seedQ : 2026;
  const sp = parseInt(qs.get("speed") || store.get("cain.speed") || "1", 10);
  const $ = s => document.querySelector(s);

  const bus = createBus(), engine = new SimEngine(bus); engine.seed = seed;
  const app = { speed: [1, 2, 4].includes(sp) ? sp : 1, wallAt: performance.now(), showHb: false, filter: "all", last: { kind: "guided" } };

  app.dispatch = (action, ...a) => {
    switch (action) {
      case "decide": engine.decide(a[0], a[1], "operator"); break;
      case "publish": engine.publish(); break;
      case "unsigned": engine.sendUnsigned(); break;
      case "draftKind": engine.setDraftKind(a[0]); break;
      case "setNodeConn": engine.setConn(a[0], a[1]); break;
    }
  };
  app.openNode = id => app.drawer.open(id);

  app.map = new MapView($("#map"), engine, bus, app);
  app.drawer = new NodeDrawer($("#drawer"), engine, bus, app);
  new ConsoleView($("#console"), engine, bus, app);
  new StepView($("#stepbar"), engine, bus, $("#sr"));
  new MetricsView($("#metrics"), engine, bus);
  app.log = new LogView($("#log"), engine, bus, app);

  /* controls */
  const runGuided = () => { app.last = { kind: "guided" }; engine.runGuided({ autoApprove: $("#chkAuto").checked, stepMode: $("#chkStep").checked }); app.wallAt = performance.now(); };
  $("#btnRun").addEventListener("click", runGuided);
  $("#btnNext").addEventListener("click", () => { if (engine.pending) engine.next(); else if (!engine.guided || engine.guided.done) runGuided(); });
  $("#chkStep").addEventListener("change", ev => { if (engine.guided) engine.guided.stepMode = ev.target.checked; if (!ev.target.checked && engine.pending) engine.next(); sync(); });
  $("#chkAuto").addEventListener("change", ev => { if (engine.guided) engine.guided.autoApprove = ev.target.checked; });
  $("#btnAnomaly").addEventListener("click", () => {
    const id = $("#selOrigin").value;
    if (engine.triggerAnomaly(id)) { app.last = { kind: "anomaly", id }; engine.bus.emit("state", engine); }
  });
  $("#segConn").addEventListener("click", ev => { const b = ev.target.closest("button"); if (b) engine.setConn("global", b.dataset.v); });
  $("#segSpeed").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; app.speed = +b.dataset.v; store.set("cain.speed", b.dataset.v); sync(); });
  $("#segCat").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; app.filter = b.dataset.v; bus.emit("state", engine); });
  $("#btnReset").addEventListener("click", () => { engine.reset(seed); app.last = { kind: "guided" }; });
  $("#btnReplay").addEventListener("click", () => { if (app.last.kind === "anomaly") engine.runAnomaly(app.last.id); else runGuided(); });
  $("#chkHb").addEventListener("change", ev => { app.showHb = ev.target.checked; app.log.render(); });
  $("#btnExport").addEventListener("click", () => {
    const data = { seed: engine.seed, generator: "Cyber AI Node edge simulator", note: "All telemetry is synthetic.", event_count: engine.events.length, events: engine.events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `cyber-ai-node-event-log-${engine.seed}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* reflect engine state into toolbar */
  let originSig = "";
  function sync() {
    $("#clock").textContent = fmtT(engine.t);
    document.querySelectorAll("#segConn button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === engine.globalConn)));
    document.querySelectorAll("#segSpeed button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === app.speed)));
    $("#btnNext").disabled = !$("#chkStep").checked;
    $("#btnNext").classList.toggle("pulse", !!engine.pending);
    const cnt = id => engine.activeNodes().filter(n => id === "all" || n.category === id).length;
    const segs = [{ id: "all", label: "All" }].concat(CATEGORIES);
    const catSig = app.filter + segs.map(c => cnt(c.id)).join();
    if (catSig !== app._catSig) $("#segCat").innerHTML = segs.map(c => `<button data-v="${c.id}" aria-pressed="${app.filter === c.id}">${esc(c.label)} <span class="cnt">${cnt(c.id)}</span></button>`).join("");
    if (catSig !== app._catSig) { const foc = document.activeElement && document.activeElement.closest && document.activeElement.closest("#segCat"); app._catSig = catSig; if (foc) { const b = $(`#segCat button[data-v="${app.filter}"]`); if (b) b.focus(); } }
    const act = engine.activeNodes(), s = act.map(n => n.id).join();
    if (s !== originSig) {
      originSig = s; const sel = $("#selOrigin"), v = sel.value;
      sel.innerHTML = CATEGORIES.map(c => { const ns = act.filter(n => n.category === c.id); return ns.length ? `<optgroup label="${esc(c.label)}">${ns.map(n => `<option value="${n.id}">${esc(n.name)}${n.site.status !== "synthetic" ? " · hypothetical drill" : ""}</option>`).join("")}</optgroup>` : ""; }).join("");
      if (act.some(n => n.id === v)) sel.value = v;
    }
    const g = engine.guided; $("#runstate").textContent = engine.pending ? "Paused (step mode)" : g && !g.done ? `Guided demo · step ${g.step} of 7` : g && g.done ? (g.denied ? "Guided demo · ended (denied)" : "Guided demo · complete") : "Free run";
  }
  bus.on("state", sync);

  window.cyberAINode = { engine, bus, app };
  $("#seedv").textContent = seed;
  engine.reset(seed);

  setInterval(() => { if (!engine.paused) { engine.advance(app.speed); app.wallAt = performance.now(); } }, 250);

  if (qs.get("autoplay") === "1") { $("#chkAuto").checked = true; runGuided(); }
})();
