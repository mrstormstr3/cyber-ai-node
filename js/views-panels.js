/* ===== ConsoleView, StepView, MetricsView, LogView ===== */
const ROLL_TXT = { pending: "Pending", received: "Received", verified: "Verified", applied: "Applied", acked: "Acked ✓" };
const nodeName = (e, id) => id === "console" ? "Ops Console" : (e.nodes[id] ? e.nodes[id].name : id);

class ConsoleView {
  constructor(el, e, bus, app) {
    this.el = el; this.e = e; this.app = app;
    el.innerHTML = `<div class="inner">
<div class="ch"><div><div class="eyebrow">Operator console</div><h2>Regional Ops Console (demo)</h2></div><div class="fleet" data-f="fleet"></div></div>
<section class="cs"><div class="csh"><div class="hi"><h3>Evidence inbox</h3>${infoBtn("inbox")}</div><span class="mu" data-f="inboxn"></span></div><div class="inbox" data-f="inbox"></div></section>
<section class="cs"><div class="csh"><div class="hi"><h3>Update publisher</h3>${infoBtn("publisher")}</div><span class="mu">Signed bundles · staged rollout</span></div>
<div class="pub"><div class="frow"><label for="pubKind">Bundle kind</label><select id="pubKind"><option value="detection_rules">Detection rules</option><option value="threat_intel">Threat intel</option><option value="policy">Policy</option></select></div>
<p class="prefill" data-f="prefill"></p><dl class="kv mono" data-f="draft"></dl>
<div class="act"><button class="primary" id="btnPub">Sign &amp; publish</button><button class="warn" id="btnUnsigned">Send unsigned bundle</button>${infoBtn("unsigned")}</div>
<p class="note">Nodes verify the console signature before applying any bundle. Unsigned or altered bundles are rejected and logged.</p></div></section>
<section class="cs"><div class="csh"><div class="hi"><h3>Fleet &amp; rollout</h3>${infoBtn("fleet")}</div><span class="mu" data-f="rsum"></span></div><div class="tblw"><table class="tbl"><thead><tr><th scope="col">Node</th><th scope="col">Link</th><th scope="col">Version</th><th scope="col">Queue</th><th scope="col">Update</th></tr></thead><tbody data-f="tbody"></tbody></table></div></section>
</div>`;
    this.q = k => el.querySelector(`[data-f="${k}"]`);
    el.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b || b.classList.contains("info")) return;
      if (b.dataset.a === "approve") app.dispatch("decide", b.dataset.id, true);
      if (b.dataset.a === "deny") app.dispatch("decide", b.dataset.id, false);
      if (b.id === "btnPub") app.dispatch("publish");
      if (b.id === "btnUnsigned") app.dispatch("unsigned");
    });
    el.querySelector("#pubKind").addEventListener("change", ev => app.dispatch("draftKind", ev.target.value));
    bus.on("state", () => this.update()); bus.on("reset", () => { this._sig = null; });
  }
  card(c) {
    const e = this.e, p = c.pkg, n = e.nodes[c.node], id = p.package_id;
    let foot;
    if (c.status === "awaiting") foot = `<div class="act"><button class="primary" data-a="approve" data-id="${id}">Approve</button><button data-a="deny" data-id="${id}">Deny</button><span class="mu" data-auto="${id}"></span></div>`;
    else if (c.status === "approved") foot = `<div class="outcome ok">Approved ${fmtT(c.decidedAt)}${c.by === "auto" ? " (autoplay)" : ""} · ${n.contained ? "gateway rule applied under operator authority" : "rule sent to security gateway"}</div>`;
    else foot = `<div class="outcome no">Denied ${fmtT(c.decidedAt)} · Operator declined. Finding retained at node; no rule applied.</div>`;
    return `<article class="card ${c.status}" aria-label="Evidence package ${id}">
<header><span class="sev">High · ${p.confidence.toFixed(2)}</span><span class="mono">${id}</span><time>${fmtT(c.arrivedAt)}</time></header>
<div class="site">${esc(n.name)}${c.hyp ? ` <span class="tag amber">Hypothetical drill</span>` : ""}</div>
<p class="sum">${esc(p.summary)}</p>
<ol class="corr">${p.correlated_events.map(x => `<li><time>${fmtT(x.t_sim)}</time><b>${esc(x.agent.replace("_", " "))}</b><span>${esc(x.detail)}</span></li>`).join("")}</ol>
<dl class="kv mono small"><dt>Package</dt><dd>${id} · ${p.created_at}</dd><dt>sha256</dt><dd class="hash">${p.sha256}</dd><dt>Consequence weight</dt><dd>${p.consequence_weight}</dd><dt>Raw telemetry included</dt><dd>No</dd></dl>
<div class="rec"><div class="eyebrow">Recommended action</div><p>${esc(p.recommended_action)}</p><p class="note">Electrical protection remains independent and is not changed.</p></div>${foot}</article>`;
  }
  update() {
    const e = this.e, act = e.activeNodes(), planned = e.order.filter(n => !e.isActive(n) && !n.line).length;
    const online = act.filter(n => e.conn(n) === "online").length;
    this.q("fleet").innerHTML = `<span><b>${act.length}</b> active</span><span><b>${online}</b> online</span><span><b>${planned}</b> planned</span>`;
    const sig = e.inbox.map(c => c.pkg.package_id + c.status + e.nodes[c.node].contained).join("|");
    if (sig !== this._sig) {
      this._sig = sig;
      const foc = document.activeElement && this.el.contains(document.activeElement) ? document.activeElement.dataset.a : null;
      this.q("inbox").innerHTML = e.inbox.length ? e.inbox.map(c => this.card(c)).join("") : `<p class="empty">No findings. Nodes are analyzing telemetry locally; only heartbeat summaries are arriving.</p>`;
      if (foc) { const b = this.el.querySelector(`[data-a="${foc}"]`); if (b) b.focus(); }
    }
    this.q("inboxn").textContent = `${e.inbox.filter(c => c.status === "awaiting").length} awaiting · ${e.inbox.length} total`;
    e.inbox.forEach(c => { const s = this.el.querySelector(`[data-auto="${c.pkg.package_id}"]`); if (s) s.textContent = c.autoAt ? `Auto-approve in ${Math.max(0, Math.ceil(c.autoAt - e.t))}s` : "Requires operator confirmation"; });
    const d = e.draft, r = e.rollout, busy = r && r.phase !== "done";
    const ks = this.el.querySelector("#pubKind"); if (document.activeElement !== ks) ks.value = d.kind;
    this.q("prefill").innerHTML = d.fromFinding ? `Pre-filled from finding ${e.inbox.length ? e.inbox[e.inbox.length - 1].pkg.package_id : ""}` : "";
    const canary = act.find(n => n.id === GUIDED.canary) ? e.nodes[GUIDED.canary].name : (act[0] ? act[0].name : "—");
    this.q("draft").innerHTML = `<dt>bundle_id</dt><dd>${d.bundle_id}</dd><dt>version</dt><dd>${d.version}</dd><dt>kind</dt><dd>${d.kind}</dd><dt>title</dt><dd class="sans">${esc(d.title)}</dd><dt>targets</dt><dd>${act.length} active nodes</dd><dt>rollout</dt><dd>canary_then_all · canary: ${esc(canary)}</dd><dt>signature</dt><dd>ed25519-sim, applied on publish</dd>`;
    const bp = this.el.querySelector("#btnPub"); bp.disabled = !!busy; bp.textContent = busy ? "Rollout in progress…" : "Sign & publish";
    if (r) {
      const acked = r.targets.filter(id => r.st[id] === "acked").length, pend = r.targets.length - acked;
      this.q("rsum").textContent = `${r.bundle.bundle_id} · ${acked} of ${r.targets.length} acked${pend ? `, ${pend} pending` : ""}`;
    } else this.q("rsum").textContent = "No rollout yet";
    const f = this.app.filter || "all";
    this.q("tbody").innerHTML = act.filter(n => f === "all" || n.category === f).map(n => {
      const c = e.conn(n), st = r && r.st[n.id];
      let u = st ? ROLL_TXT[st] + (st === "pending" && c === "offline" ? " (offline)" : "") : "—";
      if (n.upd === "rejected") u = `<span class="t-red">Rejected unsigned</span>`;
      else if (st) u = `<span class="rs-${st}">${u}</span>${r.canary === n.id ? ` <span class="tag small">canary</span>` : ""}`;
      return `<tr><td><span class="nm">${esc(n.short)}</span>${e.isPre(n) ? `<span class="mu small"> pre-deployment</span>` : ""}</td><td><span class="dot ${c}"></span>${c}</td><td class="mono">v${n.version}</td><td class="mono">${n.up.length}${n.down.length ? ` / ↓${n.down.length}` : ""}</td><td>${u}</td></tr>`;
    }).join("");
  }
}

const STEPS = ["Sense", "Analyze", "Send", "Decide", "Contain", "Update", "Share"];
const CAPTIONS = {
  1: "Sense: every node collects OT, network and physical telemetry on-site. Raw data stays local.",
  2: "Analyze: on-device agents correlate events at Demo Substation A. No cloud round-trip needed.",
  3: "Send: the link drops. Analysis still completes, the evidence package queues locally and forwards on reconnect.",
  4: "Decide: the operator reviews the evidence package. Nothing acts without human approval.",
  5: "Contain: approved. The security gateway isolates the port. Electrical protection is untouched.",
  6: "Update: the console publishes a signed detection pack, canary first, then all. The offline node applies it on reconnect.",
  7: "Share: a sanitized pattern alert goes to every node. Pattern only, no raw data.",
  8: "Demo complete. Export the event log, or Replay with the same seed for an identical run."
};
class StepView {
  constructor(el, e, bus, sr) {
    this.el = el; this.e = e; this.sr = sr; this.latest = "";
    el.querySelector("#steps").innerHTML = STEPS.map((s, i) => `<li data-s="${i + 1}"><span class="num">${i + 1}</span><span>${s}</span></li>`).join("");
    this.cap = el.querySelector("#caption"); this.live = el.querySelector("#live");
    bus.on("log", ev => { if (ev.type !== "telemetry_summary") this.latest = `${fmtT(ev.t)} · ${nodeName(e, ev.node_id)} · ${ev.message}`; });
    bus.on("step", n => { this.sr.textContent = CAPTIONS[n] || ""; });
    bus.on("reset", () => { this.latest = ""; });
    bus.on("state", () => this.update());
  }
  update() {
    const e = this.e, g = e.guided, cur = g ? g.step : 0;
    this.el.querySelectorAll("#steps li").forEach(li => { const s = +li.dataset.s; li.className = s === cur ? "on" : s < cur ? "done" : ""; li.setAttribute("aria-current", s === cur ? "step" : "false"); });
    let cap;
    if (!g) cap = "Free run: nodes are monitoring locally. Press Run guided demo, or trigger an anomaly at any active node.";
    else if (e.pending) cap = `Step mode: press Next for step ${e.pending.n}, ${STEPS[e.pending.n - 1]}.`;
    else if (g.denied) cap = "Operator declined. The finding is retained at the node and no gateway rule was applied.";
    else {
      cap = CAPTIONS[cur] || "";
      if (cur === 4) { const c = e.inbox.find(x => x.status === "awaiting"); if (c) cap += c.autoAt ? ` Auto-approve in ${Math.max(0, Math.ceil(c.autoAt - e.t))}s.` : " Click Approve or Deny in the console."; }
    }
    this.cap.textContent = cap; this.live.textContent = this.latest;
    this.el.classList.toggle("waiting", !!(g && cur === 4 && e.inbox.some(x => x.status === "awaiting")));
  }
}

class MetricsView {
  constructor(el, e, bus) {
    this.el = el; this.e = e;
    const M = [["detect", "Time to detect"], ["decide", "Time to operator decision"], ["pkgs", "Evidence packages"], ["res", "Data kept on-site"], ["roll", "Update rollout"], ["rej", "Unsigned updates rejected"]];
    el.innerHTML = `<div class="ph"><div class="hi"><h2>Metrics</h2>${infoBtn("metrics")}</div></div><div class="mgrid">${M.map(([k, l]) => `<div class="m" data-m="${k}"><span>${l}</span><b></b><small></small></div>`).join("")}</div>`;
    bus.on("state", () => this.update());
  }
  set(k, v, s) { const m = this.el.querySelector(`[data-m="${k}"]`); m.querySelector("b").textContent = v; m.querySelector("small").textContent = s || ""; }
  update() {
    const e = this.e, mt = e.metrics, act = e.activeNodes();
    this.set("detect", mt.detectEnd != null ? `${(mt.detectEnd - mt.detectStart).toFixed(1)} s` : "—", "first event → evidence package");
    this.set("decide", mt.decisionAt != null ? `${(mt.decisionAt - mt.evidenceAt).toFixed(1)} s` : mt.evidenceAt != null ? "pending" : "—", "evidence received → decision");
    const q = act.reduce((a, n) => a + n.up.filter(m => m.kind === "evidence").length, 0);
    this.set("pkgs", `${e.evSent} sent / ${q} queued`, "store-and-forward");
    const raw = act.reduce((a, n) => a + n.raw, 0), sent = act.reduce((a, n) => a + n.sent, 0);
    this.set("res", raw + sent ? `${(raw / (raw + sent) * 100).toFixed(2)}%` : "100%", `${fmtBytes(raw)} local · ${fmtBytes(sent)} sent`);
    const r = e.rollout;
    if (r) { const a = r.targets.filter(id => r.st[id] === "acked").length, p = r.targets.length - a; this.set("roll", `${a} of ${r.targets.length} nodes acked${p ? `, ${p} pending` : ""}`, r.bundle.bundle_id); }
    else this.set("roll", "No rollout yet", "");
    this.set("rej", String(e.rejected), "signature check at each node");
  }
}

const TYPE_GROUP = { telemetry_summary: "tel", device_detected: "det", physical_event: "det", protocol_event: "det", correlation: "hi", evidence_packaged: "hi", evidence_received: "hi", uplink_sent: "up", uplink_queued: "q", uplink_flushed: "up", operator_decision: "op", gateway_rule_applied: "gw", update_published: "upd", update_received: "upd", update_verified: "upd", update_applied: "upd", update_ack: "upd", update_rejected: "rej", peer_alert: "peer", connectivity_change: "conn" };
class LogView {
  constructor(el, e, bus, app) {
    this.el = el; this.e = e; this.app = app;
    bus.on("reset", () => this.render()); bus.on("log", ev => this.add(ev));
  }
  row(ev) {
    const li = document.createElement("li");
    li.className = `ev g-${TYPE_GROUP[ev.type] || "tel"} sev-${ev.severity}`;
    const nm = nodeName(this.e, ev.node_id);
    li.innerHTML = `<time>${fmtT(ev.t)}</time><span class="nn" title="${esc(nm)}">${esc(nm)}</span><span class="ty">${ev.type}</span><span class="msg">${esc(ev.message)}</span>`;
    return li;
  }
  add(ev) {
    if (!this.app.showHb && ev.type === "telemetry_summary") return;
    this.el.insertBefore(this.row(ev), this.el.firstChild);
    while (this.el.children.length > 400) this.el.lastChild.remove();
  }
  render() {
    this.el.innerHTML = "";
    const evs = this.e.events.filter(ev => this.app.showHb || ev.type !== "telemetry_summary").slice(-400);
    const frag = document.createDocumentFragment(); for (let i = evs.length - 1; i >= 0; i--) frag.appendChild(this.row(evs[i]));
    this.el.appendChild(frag);
  }
}
