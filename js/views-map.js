/* ===== MapView + NodeDrawer (subscribers; read engine state, dispatch actions via app) ===== */
const MAP = (() => { const KY = 150, KX = 150 * Math.cos(39.5 * Math.PI / 180), M = 44; return { KY, KX, M, W: 1066, H: 850 }; })();
function proj(lat, lon) { return { x: MAP.M + (lon + 114.05) * MAP.KX, y: MAP.M + (42 - lat) * MAP.KY }; }
function insetOf(lat, lon) { return INSETS.find(I => lat >= I.lat[0] && lat <= I.lat[1] && lon >= I.lon[0] && lon <= I.lon[1]); }
function projAny(lat, lon) { const I = insetOf(lat, lon); return I ? { x: I.x0 + (lon - I.lon[0]) * MAP.KX * I.scale, y: I.y0 + (I.lat[1] - lat) * MAP.KY * I.scale } : proj(lat, lon); }
const UPD_TXT = { pending: "Update pending", received: "Update received", verified: "Signature verified ✓", applied: "Update applied", acked: "Ack sent", rejected: "Signature invalid, rejected" };
const STATUS_TXT = { monitoring: "Monitoring", investigating: "Analyzing on-device", finding: "Finding: evidence ready", awaiting: "Awaiting operator decision", containing: "Approved: applying gateway rule", contained: "Contained (gateway rule)", retained: "Monitoring, finding retained" };

function nodeChip(e, n) {
  if (!e.isActive(n)) return null;
  const drill = n.hyp && n.status !== "monitoring" ? "Drill · " : "";
  if (n.upd) return { text: UPD_TXT[n.upd], cls: n.upd === "rejected" ? "red" : n.upd === "pending" ? "amber" : "violet" };
  switch (n.status) {
    case "investigating": return { text: drill + "Analyzing on-device", cls: "amber" };
    case "finding": return { text: drill + (n.up.some(m => m.kind === "evidence") ? "Evidence queued locally" : "Evidence sent"), cls: "red" };
    case "awaiting": return { text: drill + "Awaiting operator", cls: "red" };
    case "containing": return { text: drill + "Approved · applying rule", cls: "teal" };
    case "contained": return { text: drill + "Contained (gateway rule)", cls: "teal" };
    case "retained": return { text: drill + "Finding retained", cls: "amber" };
  }
  if (n.watchUntil > e.t) return { text: "Watching for pattern", cls: "amber" };
  return null;
}
function nodeStatusText(e, n) {
  if (!e.isActive(n)) return "Planned deployment";
  let s = STATUS_TXT[n.status] || "Monitoring";
  if (n.status === "monitoring" && n.watchUntil > e.t) s = "Watching for pattern";
  if (n.hyp && n.status !== "monitoring") s = "Hypothetical drill · " + s;
  return `${e.isPre(n) ? "Pre-deployment (simulated) · " : ""}${s} · link ${e.conn(n)}`;
}

class MapView {
  constructor(el, e, bus, app) {
    this.el = el; this.e = e; this.app = app; this.pk = new Map(); this.sel = null;
    this.reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    bus.on("reset", () => this.build()); bus.on("state", () => this.update());
    const loop = () => { this.frame(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  pos(n) { const b = projAny(n.site.lat, n.site.lon), o = n.site.labelOffset || { dx: 0, dy: 0 }; return { x: b.x + o.dx, y: b.y + o.dy, bx: b.x, by: b.y, left: o.dx < 0 || n.site.labelSide === "left", off: !!(o.dx || o.dy) }; }
  visible(n) { const f = this.app.filter || "all"; return f === "all" || n.category === f; }
  build() {
    const e = this.e, { W, H, M } = MAP, c = projAny(e.consoleSite.lat, e.consoleSite.lon); this.c = c;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Map of Utah showing Cyber AI Node sites"><defs><pattern id="mg" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="rgba(148,163,184,.06)"></path></pattern></defs><rect width="${W}" height="${H}" fill="url(#mg)"></rect>`;
    for (let la = 38; la <= 41; la++) { const y = proj(la, -114).y; s += `<line class="grat" x1="${M - 10}" x2="${W - M + 10}" y1="${y}" y2="${y}"></line><text class="gratl" x="${M - 14}" y="${y + 3}" text-anchor="end">${la}°N</text>`; }
    for (let lo = -113; lo <= -110; lo++) { const x = proj(40, lo).x; s += `<line class="grat" y1="${M - 10}" y2="${H - M + 10}" x1="${x}" x2="${x}"></line><text class="gratl" x="${x}" y="${H - M + 24}" text-anchor="middle">${-lo}°W</text>`; }
    s += `<polygon class="ut" points="${UTAH_OUTLINE.map(([a, b]) => { const p = proj(a, b); return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ")}"></polygon>`;
    s += `<text class="stl" x="${proj(41.6, -113.9).x}" y="${proj(41.6, -113.9).y}">UTAH</text>`;
    INSETS.forEach(I => {
      const a = proj(I.lat[1], I.lon[0]), b = proj(I.lat[0], I.lon[1]), B = I.box;
      s += `<rect class="inset-src" x="${a.x}" y="${a.y}" width="${b.x - a.x}" height="${b.y - a.y}"></rect><line class="inset-con" x1="${b.x}" y1="${a.y}" x2="${B.x}" y2="${B.y}"></line><line class="inset-con" x1="${b.x}" y1="${b.y}" x2="${B.x}" y2="${B.y + B.h}"></line><rect class="inset-box" x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="6"></rect><text class="inset-t" x="${B.x + 12}" y="${B.y + 18}">${esc(I.title)} · ${I.scale}×</text>`;
    });
    REF_TOWNS.forEach(t => { const p = projAny(t.lat, t.lon), tx = Math.hypot(p.x - c.x, p.y - c.y) < 20 ? p.x - 20 : p.x - 6; s += `<g class="town"><circle cx="${p.x}" cy="${p.y}" r="2.5"></circle><text x="${tx}" y="${p.y + 4}" text-anchor="end">${esc(t.name)}</text></g>`; });
    SITES.filter(x => x.kind === "line" && x.path).forEach(ls => {
      const pts = ls.path.map(([a, b]) => { const p = projAny(a, b); return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
      const ml = ls.lineLabelAt || ls.path[Math.floor(ls.path.length / 2)], mid = projAny(ml[0], ml[1]), lx = ls.lineLabelLeft ? mid.x - 12 : mid.x + 12;
      s += `<g class="lsite" data-id="${ls.id}-a" data-cat="${ls.category || ""}" tabindex="0" role="button" aria-label="${esc(ls.name)}, ${STATUS_LABEL[ls.status]}. Open details"><polyline class="thit" points="${pts}"></polyline><polyline class="tline" points="${pts}"></polyline><text class="tlbl" x="${lx}" y="${mid.y + 4}" text-anchor="${ls.lineLabelLeft ? "end" : "start"}">${esc(ls.lineLabel || ls.name)}</text></g>`;
    });
    s += `<g id="bhL">`;
    e.order.forEach(n => { const p = this.pos(n); s += `<line class="bh" data-bh="${n.id}" x1="${p.x}" y1="${p.y}" x2="${c.x}" y2="${c.y}"></line>`; });
    s += `</g><g id="peerL"></g><g id="nodeL">`;
    e.order.forEach(n => {
      const p = this.pos(n), lx = p.left ? -14 : 14, an = p.left ? "end" : "start";
      s += `<g class="nd" data-id="${n.id}" tabindex="0" role="button">`;
      if (p.off) s += `<line class="leader" x1="${p.bx}" y1="${p.by}" x2="${p.x}" y2="${p.y}"></line><circle class="truept" cx="${p.bx}" cy="${p.by}" r="2"></circle>`;
      s += `<g transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})"><rect class="ring" x="-13" y="-13" width="26" height="26" rx="7"></rect><rect class="hit" x="-14" y="-14" width="28" height="28"></rect><rect class="body" x="-8" y="-8" width="16" height="16" rx="4"></rect><rect class="core" x="-3" y="-3" width="6" height="6" rx="1.5"></rect>`;
      s += `<text class="lbl" x="${lx}" y="-1" text-anchor="${an}">${esc(n.short)}</text><text class="sub" x="${lx}" y="12" text-anchor="${an}"></text>`;
      s += `<g class="chip" data-left="${p.left ? 1 : 0}"><rect y="2" height="15" rx="3"></rect><text y="13"></text></g>`;
      s += `<g class="qb" transform="translate(9,-10)"><circle r="7"></circle><text></text></g><g class="gw" transform="translate(-10,-11)"><rect x="-8" y="-6" width="16" height="11" rx="2"></rect><text y="2.5">GW</text></g><text class="txrx" x="0" y="-17" text-anchor="middle"></text></g></g>`;
    });
    s += `</g><g class="cons" aria-label="Regional Ops Console (demo)"><polygon class="hex" points="${[0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 6 + k * Math.PI / 3; return (c.x + 14 * Math.cos(a)).toFixed(1) + "," + (c.y + 14 * Math.sin(a)).toFixed(1); }).join(" ")}"></polygon><polygon class="hexin" points="${[0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 6 + k * Math.PI / 3; return (c.x + 6 * Math.cos(a)).toFixed(1) + "," + (c.y + 6 * Math.sin(a)).toFixed(1); }).join(" ")}"></polygon><text class="lbl" x="${c.x + 20}" y="${c.y - 1}">${esc(e.consoleSite.name)}</text><text class="sub" x="${c.x + 20}" y="${c.y + 12}">Operator console · human approval</text></g><g id="pkL"></g></svg>`;
    this.el.innerHTML = s;
    this.svg = this.el.querySelector("svg"); this.pkL = this.svg.querySelector("#pkL"); this.peerL = this.svg.querySelector("#peerL");
    this.g = new Map(); this.svg.querySelectorAll(".nd").forEach(g => this.g.set(g.dataset.id, g));
    this.bh = new Map(); this.svg.querySelectorAll("[data-bh]").forEach(l => this.bh.set(l.dataset.bh, l));
    this.pk.clear();
    const open = ev => { const t = ev.target.closest("[data-id]"); if (t) this.app.openNode(t.dataset.id); };
    this.svg.addEventListener("click", open);
    this.svg.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(ev); } });
    this.update();
  }
  select(id) { this.sel = id; this.update(); }
  update() {
    const e = this.e; if (!this.g) return;
    this.svg.querySelectorAll(".lsite").forEach(l => { const f = this.app.filter || "all"; l.style.display = f === "all" || l.dataset.cat === f ? "" : "none"; });
    const txrx = {}; if (this.reduced) e.packets.forEach(p => { txrx[p.node] = (txrx[p.node] || "") + (p.dir === "up" ? "↑" : "↓"); });
    this.g.forEach((g, id) => {
      const n = e.nodes[id], act = e.isActive(n), c = e.conn(n), chip = nodeChip(e, n);
      const vis = this.visible(n);
      g.style.display = (n.line && !act) || !vis ? "none" : "";
      const bh = this.bh.get(id); bh.style.display = act && vis ? "" : "none"; bh.setAttribute("class", "bh" + (act && c !== "online" ? " " + c : ""));
      const alert = ["investigating", "finding", "awaiting"].includes(n.status);
      g.setAttribute("class", ["nd", act ? "act" : "plan", e.isPre(n) ? "pre" : "", act ? c : "", alert ? "alert" : "", n.status === "contained" || n.status === "containing" ? "contained" : "", n.watchUntil > e.t ? "watch" : "", this.sel === id ? "sel" : "", txrx[id] ? "tx" : ""].filter(Boolean).join(" "));
      g.setAttribute("aria-label", `${n.name}, ${nodeStatusText(e, n)}. Open details`);
      const subEl = g.querySelector(".sub"); subEl.style.display = chip ? "none" : ""; subEl.textContent = !act ? "Planned deployment" : `${e.isPre(n) ? "Pre-deployment · " : ""}v${n.version} · ${c}`;
      const cg = g.querySelector(".chip");
      if (chip) {
        const w = chip.text.length * 6.1 + 12, left = cg.dataset.left === "1", x0 = left ? -14 - w : 14;
        cg.setAttribute("class", "chip on " + chip.cls); const r = cg.querySelector("rect"), t = cg.querySelector("text");
        r.setAttribute("x", x0); r.setAttribute("width", w); t.setAttribute("x", x0 + 6); t.textContent = chip.text;
      } else cg.setAttribute("class", "chip");
      const q = n.up.length, qb = g.querySelector(".qb"); qb.style.display = act && q ? "" : "none"; qb.querySelector("text").textContent = q;
      g.querySelector(".gw").style.display = n.contained ? "" : "none";
      g.querySelector(".txrx").textContent = txrx[id] ? (txrx[id].includes("↑") ? "↑ TX" : "↓ RX") : "";
    });
    let pl = "";
    e.order.forEach(n => { if (e.isActive(n) && n.watchUntil > e.t && this.visible(n)) { const p = this.pos(n); pl += `<line class="peerline" x1="${this.c.x}" y1="${this.c.y}" x2="${p.x}" y2="${p.y}"></line>`; } });
    if (pl !== this._pl) { this.peerL.innerHTML = pl; this._pl = pl; }
  }
  curve(p) {
    const n = this.e.nodes[p.node], a = this.pos(n), b = this.c;
    const from = p.dir === "up" ? a : b, to = p.dir === "up" ? b : a;
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1, k = (p.dir === "up" ? 1 : p.dir === "peer" ? 0 : -1) * 0.12 * len;
    return { from, to, cx: (from.x + to.x) / 2 - dy / len * k, cy: (from.y + to.y) / 2 + dx / len * k };
  }
  frame() {
    const e = this.e; if (!this.pkL) return;
    if (this.reduced) { if (this.pk.size) { this.pkL.innerHTML = ""; this.pk.clear(); } return; }
    const ext = e.paused ? 0 : Math.min(1, (performance.now() - this.app.wallAt) / 250) * TICK * this.app.speed, T = e.t + ext;
    const live = new Set();
    for (const p of e.packets) {
      live.add(p.id);
      let el = this.pk.get(p.id);
      if (!el) {
        el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const r = { evidence: 6, bundle: 4.5, heartbeat: 2.6, ack: 3, gateway: 4.5, peer: 3.5 }[p.kind] || 3;
        let label = p.kind === "evidence" ? p.m.pkg.package_id : p.kind === "bundle" ? (p.m.tamper ? "unsigned" : p.m.bundle.bundle_id) : p.kind === "gateway" ? "rule" : "";
        el.setAttribute("class", `pk ${p.dir} ${p.kind}${p.m && p.m.tamper ? " tamper" : ""}`);
        el.innerHTML = `<circle r="${r}"></circle>${label ? `<text x="${r + 4}" y="4">${esc(label)}</text>` : ""}`;
        this.pkL.appendChild(el); this.pk.set(p.id, el);
        p._c = this.curve(p);
      }
      const f = Math.max(0, Math.min(1, (T - p.t0) / (p.t1 - p.t0))), c = p._c || (p._c = this.curve(p)), u = 1 - f;
      const x = u * u * c.from.x + 2 * u * f * c.cx + f * f * c.to.x, y = u * u * c.from.y + 2 * u * f * c.cy + f * f * c.to.y;
      el.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      el.style.display = this.visible(e.nodes[p.node]) ? "" : "none";
    }
    this.pk.forEach((el, id) => { if (!live.has(id)) { el.remove(); this.pk.delete(id); } });
  }
}

/* ----- Node detail drawer ----- */
class NodeDrawer {
  constructor(el, e, bus, app) {
    this.el = el; this.e = e; this.app = app; this.id = null;
    bus.on("state", () => { if (this.id) this.update(); });
    bus.on("reset", () => { if (this.id) this.open(this.id, true); });
    el.addEventListener("click", ev => { if (ev.target.closest(".x")) this.close(); });
    el.addEventListener("change", ev => { if (ev.target.matches("[data-f=conn]")) app.dispatch("setNodeConn", this.id, ev.target.value || null); });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape" && this.id) this.close(); });
  }
  open(id, keepFocus) {
    const e = this.e, n = e.nodes[id]; if (!n) return;
    const s = n.site, P = PROFILES[n.type], live = e.isActive(n);
    this.id = id; this.live = live; this.sigs = P.signals.slice(0, 4); this.extra = P.signals.slice(4);
    const src = s.sources.length ? s.sources.map(u => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ""); } catch (x) { } return `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(h)}</a>`; }).join("") : `<span class="mu">${s.status === "synthetic" ? "No public source (fictional site)" : "Not provided"}</span>`;
    const sparks = [{ k: "__flows", label: "Network flows", unit: "/min" }].concat(this.sigs);
    let h = `<div class="dh"><div><div class="eyebrow">${esc(TYPE_LABEL[n.type] || n.type)}${n.line ? " · line monitoring node" : ""}</div><h3 id="drawerTitle">${esc(n.name)}</h3></div><button class="x" aria-label="Close node details">×</button></div>
<div class="tags" data-f="tags"></div>
<section><dl class="kv"><dt>Owner</dt><dd>${esc(s.owner)}</dd><dt>County</dt><dd>${esc(s.county)}</dd><dt>Project status</dt><dd>${STATUS_LABEL[s.status]}</dd></dl><ul class="facts">${s.facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul><div class="src"><span class="mu">Source</span>${src}</div></section>`;
    if (!live) {
      h += `<section class="plannote"><h4>Planned deployment</h4><p>No live telemetry. Turn on <b>Show future build-out</b> to simulate this site as a pre-deployment node.</p></section>`;
    } else {
      h += `<section><h4>Node status</h4><p class="ptext" data-f="ptext"></p></section>
<section><h4>Agent pipeline <span class="mu">on-device</span>${infoBtn("pipeline")}</h4><ol class="pipe">${["Ingest", "Correlate", "Prioritize", "Package"].map((x, i) => `<li data-i="${i}">${x}</li>`).join("")}</ol></section>
<section><h4>Live telemetry <span class="mu">synthetic · last 60 s</span>${infoBtn("telemetry")}</h4><div class="sparks">${sparks.map(g => `<div class="sp" data-k="${g.k}"><div class="spl"><span>${esc(g.label)}</span><b></b></div><svg viewBox="0 0 120 26" preserveAspectRatio="none" aria-hidden="true"><polyline></polyline></svg></div>`).join("")}</div><dl class="kv" data-f="states"></dl></section>
<section><h4>Security telemetry</h4><dl class="kv" data-f="sec"></dl><div class="proto" data-f="proto"></div></section>
<section><h4>Response boundary${infoBtn("boundary")}</h4><dl class="kv"><dt>Security gateway</dt><dd data-f="gw"></dd><dt>Electrical protection</dt><dd>Independent, not controlled by the node</dd></dl></section>
<section><h4>Connectivity${infoBtn("offline")}</h4><label class="fl"><span>Link for this node</span><select data-f="conn"><option value="">Follow global</option><option value="online">Online</option><option value="intermittent">Intermittent</option><option value="offline">Offline</option></select></label><dl class="kv"><dt>Uplink queue</dt><dd data-f="q"></dd><dt>Held downlink</dt><dd data-f="dq"></dd></dl></section>
<section><h4>Updates${infoBtn("signed")}</h4><dl class="kv"><dt>Installed version</dt><dd class="mono" data-f="ver"></dd><dt>Update state</dt><dd data-f="upd"></dd></dl></section>
<section><h4>Data residency${infoBtn("residency")}</h4><div class="res"><div><span>Raw telemetry retained locally</span><b data-f="raw"></b></div><div><span>Summaries sent upstream</span><b data-f="sent"></b></div><div class="bar"><i data-f="bar"></i></div><p><b data-f="pct"></b> of data kept on-site</p></div></section>`;
    }
    this.el.innerHTML = h; this.el.hidden = false; this.app.map.select(id);
    if (!keepFocus) this.el.querySelector(".x").focus();
    this.update();
  }
  close() {
    const id = this.id; this.id = null; this.el.hidden = true; this.app.map.select(null);
    const g = this.app.map.g && this.app.map.g.get(id); if (g) g.focus();
  }
  f(k) { return this.el.querySelector(`[data-f="${k}"]`); }
  update() {
    const e = this.e, n = e.nodes[this.id], t = e.t;
    if (e.isActive(n) !== this.live) { this.open(this.id, true); return; }
    const tags = [];
    if (!this.live) tags.push(`<span class="tag dash">Planned deployment</span>`);
    if (e.isPre(n)) tags.push(`<span class="tag dash">Pre-deployment (simulated)</span>`);
    if (n.site.status === "synthetic") tags.push(`<span class="tag">Synthetic site</span>`);
    if (n.hyp && n.status !== "monitoring") tags.push(`<span class="tag amber">Hypothetical drill</span>`);
    const chip = nodeChip(e, n); if (chip) tags.push(`<span class="tag ${chip.cls}">${esc(chip.text)}</span>`);
    if (this.live) tags.push(`<span class="tag link-${e.conn(n)}">Link ${e.conn(n)}${n.override ? " (override)" : ""}</span>`);
    this.f("tags").innerHTML = tags.join("");
    if (!this.live) return;
    const showPanel = ["finding", "awaiting", "containing"].includes(n.status);
    this.f("ptext").innerHTML = esc(nodeStatusText(e, n)) + (showPanel ? `<span class="panel-alert">${n.hyp ? "Hypothetical drill. " : ""}${esc(PANEL_TEXT)}</span>` : "");
    this.el.querySelectorAll(".pipe li").forEach(li => { const i = +li.dataset.i; li.className = n.pipe < 0 ? (i === 0 ? "on idle" : "") : (i === n.pipe ? "on" : i < n.pipe ? "done" : ""); });
    const sec = e.security(n, t);
    this.el.querySelectorAll(".sp").forEach(sp => {
      const k = sp.dataset.k, sig = this.sigs.find(x => x.k === k), pts = [];
      for (let i = 0; i <= 60; i++) pts.push(k === "__flows" ? e.security(n, t - 60 + i).flows : e.signal(n, sig, t - 60 + i));
      const lo = Math.min(...pts), hi = Math.max(...pts), rg = (hi - lo) || 1;
      sp.querySelector("polyline").setAttribute("points", pts.map((v, i) => `${(i * 2).toFixed(0)},${(23 - (v - lo) / rg * 20).toFixed(1)}`).join(" "));
      const v = pts[60]; sp.querySelector("b").textContent = k === "__flows" ? `${v} /min` : `${v.toFixed(sig.dec)} ${sig.unit}`;
    });
    this.f("states").innerHTML = this.extra.map(sg => `<dt>${esc(sg.label)}</dt><dd>${e.signal(n, sg, t).toFixed(sg.dec)} ${esc(sg.unit)}</dd>`).join("") + PROFILES[n.type].states.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("");
    this.f("sec").innerHTML = [
      ["Network flows / min", sec.flows], ["New or unknown devices", sec.unknown ? `<span class="t-red">${sec.unknown} unregistered</span>` : sec.quarantined ? `0 (1 revoked)` : "0"],
      ["Config baseline", `<span class="t-teal">${sec.cfg}</span>`], ["Auth failures (10 min)", sec.auth > 4 ? `<span class="t-amber">${sec.auth}</span>` : sec.auth],
      ["Cabinet door", sec.cabOpen ? `<span class="t-red">${sec.cabinet}</span>` : sec.cabinet], ["Camera motion (10 min)", sec.camera],
      ["Modbus writes from unknown src", sec.writes ? `<span class="t-red">${sec.writes} (FC 16)</span>` : "0"]
    ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("");
    const mx = Math.max(...sec.proto.map(p => p.rate));
    this.f("proto").innerHTML = `<div class="mu small">OT protocol packets / min</div>` + sec.proto.map(p => `<div class="pr"><span>${esc(p.p)}</span><i style="width:${(p.rate / mx * 100).toFixed(0)}%"></i><b>${p.rate.toLocaleString("en-US")}</b></div>`).join("");
    this.f("gw").innerHTML = n.contained ? `<span class="t-teal">Rule applied under operator authority</span>` : n.status === "containing" ? "Approved · rule in transit" : "Default policy · no active rule";
    const sel = this.f("conn"); if (document.activeElement !== sel) sel.value = n.override || "";
    this.f("q").textContent = n.up.length ? `${n.up.length} (${n.up.map(m => KIND_LABEL[m.kind].toLowerCase()).join(", ")})` : "0";
    this.f("dq").textContent = n.down.length ? `${n.down.length} (${n.down.map(m => KIND_LABEL[m.kind].toLowerCase()).join(", ")})` : "0";
    this.f("ver").textContent = "v" + n.version;
    this.f("upd").textContent = n.upd ? UPD_TXT[n.upd] : "Up to date";
    const pct = n.raw + n.sent ? n.raw / (n.raw + n.sent) * 100 : 100;
    this.f("raw").textContent = fmtBytes(n.raw); this.f("sent").textContent = fmtBytes(n.sent);
    this.f("pct").textContent = pct.toFixed(2) + "%"; this.f("bar").style.width = pct.toFixed(2) + "%";
  }
}
