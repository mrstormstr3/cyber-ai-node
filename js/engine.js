/* ===== SimEngine: state, clock, PRNG, scenario director. Emits events on the bus; views never mutate state. ===== */
const TICK = 0.25, TPS = 4;
const DUR = { heartbeat: 1.2, evidence: 2.2, ack: 1.2, bundle: 1.8, gateway: 1.4, peer: 1.6 };
const BYTES = { heartbeat: 1400, evidence: 18600, ack: 420 };
const KIND_LABEL = { heartbeat: "Heartbeat summary", evidence: "Evidence package", ack: "Update ack", bundle: "Update bundle", gateway: "Gateway rule", peer: "Peer alert" };
const EPOCH = Date.UTC(2026, 9, 27, 15, 0, 0);
const SIGN_KEY = "regional-ops-console/demo-signing-key-2026";
const PATTERN = "Watch for Modbus write from unregistered device after cabinet open";
const RECOMMENDED = "Isolate sensor VLAN port and revoke the unfamiliar device's session at the security gateway. Requires operator confirmation.";
const PANEL_TEXT = "Anomaly: unexpected Modbus write from unregistered device after cabinet intrusion. Confidence: High (0.92). Evidence package ready.";
const GUIDED = { origin: "demo-sub-a", canary: "blundell", offlineAtUpdate: "honeycomb" };
const PAUSE_AT = [2, 3, 6, 7];
const BUNDLE_META = {
  detection_rules: { p: "DP", label: "Detection pack", title: 'Detection pack: "Modbus write from unregistered device + cabinet-open correlation"' },
  threat_intel: { p: "TI", label: "Threat intel", title: "Threat intel: unregistered-vendor MAC OUIs and known scanning sources" },
  policy: { p: "PL", label: "Policy", title: "Policy: sensor VLAN admission requires a registered device certificate" }
};
const iso = t => new Date(EPOCH + Math.round(t * 1000)).toISOString();

class SimEngine {
  constructor(bus) { this.bus = bus; this.seed = 2026; this.globalConn = "online"; this.buildOut = false; }

  /* ----- lifecycle ----- */
  reset(seed) {
    if (seed != null) this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.tick = 0; this.t = 0; this.seq = 0; this.events = [];
    this.jobs = []; this.jobSeq = 0; this.packets = []; this.pktSeq = 0;
    this.pkgSeq = 0; this.bundleSeq = 3; this.inbox = []; this.rollout = null; this.rejected = 0; this.evSent = 0;
    this.metrics = { detectStart: null, detectEnd: null, evidenceAt: null, decisionAt: null };
    this.guided = null; this.paused = false; this.pending = null; this.lastScenario = null;
    this.nodes = {}; this.order = [];
    let idx = 0;
    for (const s of SITES) {
      if (s.kind === "console") { this.consoleSite = s; continue; }
      if (s.kind === "node") this._addNode(s.id, s, null, idx++);
      else if (s.kind === "line" && s.path && s.path.length > 1) {
        const p = s.path, a = p[0], b = p[p.length - 1], en = s.endNames || ["end A", "end B"], eo = s.endOffsets || [];
        this._addNode(s.id + "-a", Object.assign({}, s, { lat: a[0], lon: a[1], labelOffset: eo[0] || null }), s, idx++, en[0]);
        this._addNode(s.id + "-b", Object.assign({}, s, { lat: b[0], lon: b[1], labelOffset: eo[1] || null }), s, idx++, en[1]);
      }
    }
    this.draft = this._makeDraft("threat_intel");
    this.bus.emit("reset", this); this.bus.emit("state", this);
  }
  _addNode(id, site, line, idx, end) {
    const n = {
      id, site, line, end, name: line ? `${site.name} · line monitor (${end})` : site.name,
      short: line ? `${site.shortName || "Line"} · ${end}` : site.name, category: site.category || "other",
      type: site.type, mode: site.nodeMode, override: null, up: [], down: [], version: "1.4.2",
      raw: 0, sent: 0, hbOff: (idx * 13) % 40, status: "monitoring", pipe: -1, scen: null,
      contained: false, watchUntil: 0, upd: null, updUntil: 0, hyp: false, lastSeen: null
    };
    this.nodes[id] = n; this.order.push(n);
  }

  /* ----- queries (read-only helpers used by views) ----- */
  isActive(n) { return n.mode === "active" || (this.buildOut && n.mode === "planned"); }
  isPre(n) { return n.mode === "planned" && this.buildOut; }
  conn(n) { return n.override || this.globalConn; }
  activeNodes() { return this.order.filter(n => this.isActive(n)); }
  signal(n, sig, t) {
    let v = sig.base + sig.amp * fnoise(this.seed, n.id + sig.k, t / sig.per);
    if (sig.min != null) v = Math.max(sig.min, v); if (sig.max != null) v = Math.min(sig.max, v);
    return v;
  }
  security(n, t) {
    const P = PROFILES[n.type], sd = this.seed, s = n.scen;
    const devOn = !!(s && s.device != null && t >= s.device), cabOpen = !!(s && s.cab != null && t >= s.cab);
    let flows = P.flows * (1 + 0.07 * fnoise(sd, n.id + "fl", t / 25)); if (devOn && !n.contained) flows *= 1.28;
    let auth = Math.max(0, Math.round(1 + 1.2 * fnoise(sd, n.id + "au", t / 40))); if (devOn && !n.contained) auth += 5;
    const camera = Math.max(0, Math.round(0.6 + 0.8 * fnoise(sd, n.id + "cm", t / 60))) + (cabOpen ? 3 : 0);
    const proto = P.protocols.map((p, i) => ({ p, rate: Math.round((P.protoBase[i] || 400) * (1 + 0.1 * fnoise(sd, n.id + p, t / 15))) }));
    return {
      flows: Math.round(flows), unknown: devOn && !n.contained ? 1 : 0, quarantined: devOn && n.contained ? 1 : 0,
      cfg: "Hash OK", auth, cabOpen, cabinet: cabOpen ? "OPEN · no badge record" : "Closed", camera, proto,
      writes: s && s.write != null && t >= s.write ? 1 : 0
    };
  }

  /* ----- event log ----- */
  log(node_id, type, severity, message, payload) {
    const ev = { seq: ++this.seq, t: this.t, node_id, type, severity, message, payload: payload || {} };
    this.events.push(ev); this.bus.emit("log", ev); return ev;
  }

  /* ----- clock ----- */
  at(dt, fn) { this.jobs.push({ k: this.tick + Math.max(0, Math.round(dt * TPS)), s: this.jobSeq++, fn }); }
  advance(ticks) { for (let i = 0; i < ticks && !this.paused; i++) this._step(); this.bus.emit("state", this); }
  _runJobs() {
    for (;;) {
      if (this.paused) return;
      let b = -1;
      for (let i = 0; i < this.jobs.length; i++) {
        const j = this.jobs[i];
        if (j.k <= this.tick && (b < 0 || j.k < this.jobs[b].k || (j.k === this.jobs[b].k && j.s < this.jobs[b].s))) b = i;
      }
      if (b < 0) return;
      this.jobs.splice(b, 1)[0].fn();
    }
  }
  _step() {
    this.tick++; this.t = this.tick / TPS;
    this._runJobs(); if (this.paused) return;
    for (const n of this.order) {
      if (!this.isActive(n)) continue;
      n.raw += PROFILES[n.type].rawMBmin * 1e6 / 60 / TPS;
      if ((((this.tick - n.hbOff) % 40) + 40) % 40 === 0) this._heartbeat(n);
      this._pump(n, "up"); this._pump(n, "down");
      if (n.watchUntil && this.t >= n.watchUntil) n.watchUntil = 0;
      if (n.updUntil && this.t >= n.updUntil) { n.upd = null; n.updUntil = 0; }
    }
    for (let i = 0; i < this.packets.length;) {
      const p = this.packets[i];
      if (this.t >= p.t1) { this.packets.splice(i, 1); this._arrive(p); } else i++;
    }
  }

  /* ----- transport: store-and-forward ----- */
  _queueOrSend(n, dir, m) {
    const q = dir === "up" ? n.up : n.down, c = this.conn(n);
    if (c === "online" && !q.length) { this._send(n, dir, m, false); return "sent"; }
    if (c === "intermittent" && !q.length && this.rng() >= 0.5) { this._send(n, dir, m, false); return "sent"; }
    if (m.kind === "heartbeat") { const i = q.findIndex(x => x.kind === "heartbeat"); if (i >= 0) q.splice(i, 1); }
    m.due = this.tick + 2 * TPS; m.backoff = 2; q.push(m);
    if (m.kind === "bundle" && !m.tamper) n.upd = "pending";
    return c === "intermittent" ? "retry" : "queued";
  }
  _pump(n, dir) {
    const q = dir === "up" ? n.up : n.down; if (!q.length) return;
    const c = this.conn(n); if (c === "offline") return;
    if (c === "online") { if (this.tick % 2 === 0) this._send(n, dir, q.shift(), true); return; }
    const m = q[0]; if (this.tick < m.due) return;
    if (this.rng() < 0.5) {
      m.backoff = Math.min(m.backoff * 2, 8); m.due = this.tick + m.backoff * TPS;
      if (m.kind !== "heartbeat") this.log(n.id, "uplink_queued", "low", `${KIND_LABEL[m.kind]} retry failed (unstable link). Next attempt in ${m.backoff}s`, { kind: m.kind, direction: dir, queue: q.length });
      return;
    }
    this._send(n, dir, q.shift(), true);
  }
  _send(n, dir, m, flushed) {
    if (dir === "up") {
      const bytes = BYTES[m.kind] || 500; n.sent += bytes;
      if (m.kind === "evidence") this.evSent++;
      if (flushed) this.log(n.id, "uplink_flushed", m.kind === "evidence" ? "high" : "info", `${KIND_LABEL[m.kind]}${m.pkg ? " " + m.pkg.package_id : ""} forwarded from local queue (${n.up.length} left)`, { kind: m.kind, queue_remaining: n.up.length, package_id: m.pkg ? m.pkg.package_id : undefined });
      else if (m.kind === "evidence") this.log(n.id, "uplink_sent", "high", `Evidence ${m.pkg.package_id} sent to console (${(bytes / 1024).toFixed(1)} KB). Raw telemetry stays on-site`, { package_id: m.pkg.package_id, bytes });
      this._pkt("up", m.kind, n.id, m);
    } else {
      if (flushed && m.kind === "bundle") this.log("console", "update_published", "info", `Held bundle ${m.bundle.bundle_id} delivered to ${n.name} on reconnect`, { bundle_id: m.bundle.bundle_id, target: n.id });
      this._pkt(m.kind === "peer" ? "peer" : "down", m.kind, n.id, m);
    }
  }
  _pkt(dir, kind, node, m) { this.packets.push({ id: ++this.pktSeq, dir, kind, node, t0: this.t, t1: this.t + DUR[kind], m }); }
  _arrive(p) { const n = this.nodes[p.node]; if (p.dir === "up") this._consoleRecv(n, p.m); else this._nodeRecv(n, p.m); }

  _heartbeat(n) {
    const sec = this.security(n, this.t);
    const payload = { health: "ok", version: n.version, queue: n.up.length, flows_per_min: sec.flows, unknown_devices: sec.unknown, config: sec.cfg };
    const r = this._queueOrSend(n, "up", { kind: "heartbeat", payload });
    this.log(n.id, "telemetry_summary", "info", `Heartbeat · health OK · v${n.version} · ${sec.flows} flows/min · queue ${n.up.length}${r === "sent" ? "" : r === "queued" ? " · held locally (offline)" : " · retrying"}`, Object.assign({ delivery: r }, payload));
  }

  /* ----- console side ----- */
  _consoleRecv(n, m) {
    n.lastSeen = this.t;
    if (m.kind === "evidence") {
      const card = { pkg: m.pkg, node: n.id, arrivedAt: this.t, status: "awaiting", hyp: n.hyp, autoAt: null };
      this.inbox.unshift(card);
      if (this.metrics.evidenceAt == null) this.metrics.evidenceAt = this.t;
      n.status = "awaiting";
      this.log("console", "evidence_received", "high", `${n.hyp ? "Hypothetical drill · " : ""}Evidence ${m.pkg.package_id} from ${n.name} received · hash verified · awaiting operator`, { package_id: m.pkg.package_id, sha256: m.pkg.sha256 });
      if (this.guided && !this.guided.done) {
        this._gEnter(4);
        if (this.guided.autoApprove) { card.autoAt = this.t + 8; this.at(8, () => { if (card.status === "awaiting") this.decide(m.pkg.package_id, true, "auto"); }); }
      }
    } else if (m.kind === "ack") {
      const r = this.rollout; if (!r || r.bundle.bundle_id !== m.bundle_id || !(n.id in r.st)) return;
      r.st[n.id] = "acked";
      const acked = r.targets.filter(id => r.st[id] === "acked").length, total = r.targets.length;
      this.log("console", "update_ack", "info", `Ack from ${n.name} · ${acked} of ${total} nodes`, { bundle_id: m.bundle_id, from: n.id, acked, total });
      if (r.phase === "canary" && n.id === r.canary) this._promote();
      if (acked === total) {
        r.phase = "done";
        this.log("console", "update_published", "info", `Rollout of ${r.bundle.bundle_id} complete: ${total} of ${total} nodes acked`, { bundle_id: r.bundle.bundle_id });
        const g = this.guided;
        if (g && g.awaitRollout === r.bundle.bundle_id) { g.awaitRollout = null; this.at(1.5, () => this._gEnter(7, () => { this.sharePeer(g.origin); this.at(6, () => { g.step = 8; g.done = true; this.bus.emit("step", 8); }); })); }
      } else if (this.guided && r.phase === "all" && !this.guided.reconnectSet) {
        const rem = r.targets.filter(id => r.st[id] !== "acked");
        if (rem.length && rem.every(id => this.conn(this.nodes[id]) === "offline")) {
          this.guided.reconnectSet = true;
          this.at(3, () => rem.forEach(id => this.setConn(id, null)));
        }
      }
    }
  }
  _promote() {
    const r = this.rollout; r.phase = "all";
    const others = r.targets.filter(id => id !== r.canary);
    this.log("console", "update_published", "info", `Canary ${this.nodes[r.canary].name} acked. Rolling out to ${others.length} remaining nodes`, { bundle_id: r.bundle.bundle_id, targets: others });
    others.forEach(id => {
      const n = this.nodes[id], res = this._queueOrSend(n, "down", { kind: "bundle", bundle: r.bundle });
      if (res !== "sent") this.log("console", "update_published", "medium", `${n.name} is ${this.conn(n)}: update pending, will apply on reconnect`, { bundle_id: r.bundle.bundle_id, target: id, status: "pending" });
    });
  }

  /* ----- node side ----- */
  _nodeRecv(n, m) {
    if (m.kind === "bundle") {
      const b = m.bundle, r = this.rollout && this.rollout.bundle.bundle_id === b.bundle_id ? this.rollout : null;
      const setSt = s => { if (r && n.id in r.st) r.st[n.id] = s; };
      n.upd = "received"; n.updUntil = 0; setSt("received");
      this.log(n.id, "update_received", "info", `Bundle ${b.bundle_id} received${b.signature ? "" : " (no signature)"}`, { bundle_id: b.bundle_id, version: b.version });
      this.at(0.75, () => {
        if (!this._verify(b)) {
          n.upd = "rejected"; n.updUntil = this.t + 8; this.rejected++;
          this.log(n.id, "update_rejected", "medium", `Signature invalid, rejected. ${b.bundle_id} discarded; installed rules unchanged (v${n.version})`, { bundle_id: b.bundle_id, reason: "signature_invalid" });
          return;
        }
        n.upd = "verified"; setSt("verified");
        this.log(n.id, "update_verified", "info", `Signature verified ✓ (${b.signature.slice(0, 24)}…)`, { bundle_id: b.bundle_id, signature: b.signature });
        this.at(0.75, () => {
          const from = n.version; n.version = b.version; n.upd = "applied"; setSt("applied");
          this.log(n.id, "update_applied", "info", `Applied ${BUNDLE_META[b.kind].label.toLowerCase()} ${b.bundle_id}: v${from} → v${b.version}`, { bundle_id: b.bundle_id, from, to: b.version });
          this.at(0.5, () => {
            n.upd = "acked"; n.updUntil = this.t + 6;
            const res = this._queueOrSend(n, "up", { kind: "ack", bundle_id: b.bundle_id });
            this.log(n.id, "update_ack", "info", `Ack sent for ${b.bundle_id}${res === "sent" ? "" : " (queued)"}`, { bundle_id: b.bundle_id, delivery: res });
          });
        });
      });
    } else if (m.kind === "gateway") {
      n.contained = true; n.status = "contained"; n.pipe = -1;
      this.log(n.id, "gateway_rule_applied", "info", `${n.hyp ? "Hypothetical drill · " : ""}Security gateway: sensor VLAN port isolated, device session revoked. Rule applied under operator authority. Electrical protection unchanged`, { package_id: m.pkg, rule: "isolate_port+revoke_session" });
      if (this.guided && !this.guided.done) this.at(2, () => this._gEnter(6, () => {
        const off = this.nodes[GUIDED.offlineAtUpdate];
        if (off && this.isActive(off)) this.setConn(off.id, "offline");
        this.at(1.5, () => { const b = this.publish(); if (b) this.guided.awaitRollout = b.bundle_id; });
      }));
    } else if (m.kind === "peer") {
      n.watchUntil = this.t + 20;
      this.log(n.id, "peer_alert", "low", `Sanitized alert received. Watching for pattern for 20s`, { pattern: m.pattern });
    }
  }

  /* ----- scenario ----- */
  triggerAnomaly(id) {
    const n = this.nodes[id];
    if (!n || !this.isActive(n) || (n.scen && !n.scen.done)) return false;
    n.hyp = n.site.status !== "synthetic"; n.contained = false; n.status = "investigating"; n.pipe = 0;
    const tag = n.hyp ? "Hypothetical drill · " : "";
    const hx = () => Math.floor(this.rng() * 256).toString(16).padStart(2, "0");
    const mac = `02:${hx()}:${hx()}:${hx()}:${hx()}:${hx()}`, ip = `10.40.12.${100 + Math.floor(this.rng() * 120)}`;
    const s = n.scen = { start: this.t, device: null, cab: null, write: null, mac, ip, done: false };
    const target = PROFILES[n.type].setpoint, corr = [];
    this.lastScenario = id;
    this.at(0, () => {
      s.device = this.t; if (this.metrics.detectStart == null) this.metrics.detectStart = this.t;
      corr.push({ t_sim: this.t, at: iso(this.t), agent: "network", event: "device_detected", detail: `Unfamiliar device ${mac} (${ip}) joined sensor VLAN, vendor unknown` });
      this.log(id, "device_detected", "medium", `${tag}Network agent: unfamiliar device joined sensor VLAN (MAC ${mac}, vendor unknown)`, { mac, ip, agent: "network" });
    });
    this.at(12, () => {
      s.cab = this.t; n.pipe = 1;
      corr.push({ t_sim: this.t, at: iso(this.t), agent: "physical", event: "physical_event", detail: "Cabinet door opened with no badge record" });
      this.log(id, "physical_event", "medium", `${tag}Physical agent: cabinet door opened with no badge record`, { sensor: "cabinet_door", badge: null, agent: "physical" });
    });
    this.at(20, () => {
      s.write = this.t;
      corr.push({ t_sim: this.t, at: iso(this.t), agent: "ot_protocol", event: "protocol_event", detail: `Modbus FC 16 write to ${target} from ${ip}` });
      this.log(id, "protocol_event", "high", `${tag}OT protocol agent: unexpected Modbus write (FC 16) to ${target} from unregistered device`, { protocol: "Modbus TCP", function_code: 16, src: ip, agent: "ot_protocol" });
    });
    this.at(22, () => {
      n.pipe = 2;
      this.log(id, "correlation", "high", `${tag}Correlator: 3 events linked, consequence weighting applied → High, confidence 0.92`, { linked: 3, severity: "high", confidence: 0.92, consequence_weight: 0.86 });
      if (!this.rollout || this.rollout.phase === "done") this.draft = this._makeDraft("detection_rules", true);
    });
    this.at(24, () => {
      n.pipe = 3; n.status = "finding"; s.done = true; this.metrics.detectEnd = this.t;
      const pkg = this._package(n, corr);
      this.log(id, "evidence_packaged", "high", `${tag}Evidence agent: package ${pkg.package_id} created and hashed (sha256 ${pkg.sha256.slice(0, 12)}…)`, { package_id: pkg.package_id, confidence: 0.92, sha256: pkg.sha256 });
      const r = this._queueOrSend(n, "up", { kind: "evidence", pkg });
      if (r !== "sent") this.log(id, "uplink_queued", "medium", `Link ${this.conn(n)}: evidence ${pkg.package_id} held in local queue (${n.up.length}). Analysis complete on-device`, { package_id: pkg.package_id, queue: n.up.length });
    });
    return true;
  }
  _package(n, corr) {
    const id = "EP-" + String(++this.pkgSeq).padStart(4, "0");
    const body = {
      package_id: id, node_id: n.id, created_at: iso(this.t), severity: "high", confidence: 0.92,
      summary: `${n.hyp ? "Hypothetical drill. " : ""}Unexpected Modbus write from unregistered device after cabinet intrusion.`,
      correlated_events: corr.slice(), consequence_weight: 0.86, recommended_action: RECOMMENDED,
      requires_approval: true, raw_telemetry_included: false
    };
    body.sha256 = sha256(JSON.stringify(body));
    return body;
  }
  decide(pkgId, approve, by) {
    const c = this.inbox.find(x => x.pkg.package_id === pkgId);
    if (!c || c.status !== "awaiting") return;
    c.status = approve ? "approved" : "denied"; c.decidedAt = this.t; c.by = by || "operator";
    if (this.metrics.decisionAt == null) this.metrics.decisionAt = this.t;
    const n = this.nodes[c.node];
    this.log("console", "operator_decision", approve ? "info" : "medium",
      approve ? `Operator approved containment for ${pkgId}${by === "auto" ? " (autoplay)" : ""}` : `Operator denied ${pkgId}. Reason: Operator declined`,
      { package_id: pkgId, decision: approve ? "approve" : "deny", reason: approve ? null : "Operator declined", by: c.by });
    if (approve) {
      n.status = "containing";
      this._queueOrSend(n, "down", { kind: "gateway", pkg: pkgId });
      if (this.guided && !this.guided.done) this._gEnter(5);
      else this.at(2, () => this.sharePeer(n.id));
    } else {
      n.status = "retained";
      if (this.guided) { this.guided.denied = true; this.guided.done = true; }
    }
    this.bus.emit("state", this);
  }
  sharePeer(originId) {
    const targets = this.activeNodes().filter(x => x.id !== originId);
    this.log("console", "peer_alert", "low", `Relaying sanitized alert to ${targets.length} nodes: "${PATTERN}" (pattern only, no raw data)`, { pattern: PATTERN, targets: targets.map(x => x.id) });
    targets.forEach(x => this._queueOrSend(x, "down", { kind: "peer", pattern: PATTERN }));
  }

  /* ----- updates ----- */
  _makeDraft(kind, fromFinding) {
    const m = BUNDLE_META[kind];
    return { bundle_id: `${m.p}-2026.10.${this.bundleSeq}`, version: `1.4.${this.bundleSeq}`, kind, title: m.title, fromFinding: !!fromFinding };
  }
  setDraftKind(kind) { if (BUNDLE_META[kind]) this.draft = this._makeDraft(kind, kind === "detection_rules" && this.pkgSeq > 0); this.bus.emit("state", this); }
  _sign(b) { return "ed25519-sim:" + sha256([SIGN_KEY, b.bundle_id, b.version, b.kind, b.created_at, b.targets.join(",")].join("|")); }
  _verify(b) { return !!b.signature && b.signature === this._sign(b); }
  publish() {
    if (this.rollout && this.rollout.phase !== "done") return null;
    const d = this.draft, targets = this.activeNodes().map(n => n.id);
    if (!targets.length) return null;
    const b = { bundle_id: d.bundle_id, version: d.version, kind: d.kind, title: d.title, created_at: iso(this.t), signature: null, targets, rollout: "canary_then_all" };
    b.signature = this._sign(b);
    const canary = targets.includes(GUIDED.canary) && this.conn(this.nodes[GUIDED.canary]) !== "offline" ? GUIDED.canary : (targets.find(id => this.conn(this.nodes[id]) === "online") || targets[0]);
    this.rollout = { bundle: b, targets, canary, phase: "canary", st: Object.fromEntries(targets.map(id => [id, "pending"])), at: this.t };
    this.bundleSeq++; this.draft = this._makeDraft(d.kind, false);
    this.log("console", "update_published", "info", `Signed bundle ${b.bundle_id} (v${b.version}) published · staged rollout, canary: ${this.nodes[canary].name}`, { bundle_id: b.bundle_id, version: b.version, kind: b.kind, signature: b.signature, targets, rollout: b.rollout, canary });
    this._queueOrSend(this.nodes[canary], "down", { kind: "bundle", bundle: b });
    this.bus.emit("state", this);
    return b;
  }
  sendUnsigned() {
    const targets = this.activeNodes().map(n => n.id);
    const b = { bundle_id: `XX-UNSIGNED-${String(this.seq).padStart(3, "0")}`, version: "9.9.9", kind: "policy", title: "Unsigned bundle (tamper test)", created_at: iso(this.t), signature: null, targets, rollout: "all" };
    this.log("console", "update_published", "medium", `Tamper test: unsigned bundle ${b.bundle_id} injected on the update channel → ${targets.length} nodes`, { bundle_id: b.bundle_id, signature: null, targets });
    targets.forEach(id => this._queueOrSend(this.nodes[id], "down", { kind: "bundle", bundle: b, tamper: true }));
    this.bus.emit("state", this);
  }

  /* ----- connectivity & build-out ----- */
  setConn(scope, mode) {
    const before = {}; this.order.forEach(n => before[n.id] = this.conn(n));
    if (scope === "global") this.globalConn = mode; else if (this.nodes[scope]) this.nodes[scope].override = mode || null;
    for (const n of this.order) {
      const now = this.conn(n);
      if (!this.isActive(n) || before[n.id] === now) continue;
      const flush = now === "online" && (n.up.length || n.down.length) ? ` · flushing ${n.up.length} queued uplink, ${n.down.length} held downlink` : "";
      this.log(n.id, "connectivity_change", now === "offline" ? "medium" : "info", `Link ${before[n.id]} → ${now}${flush}`, { from: before[n.id], to: now, scope: scope === "global" ? "global" : "node" });
      if (now === "intermittent") [...n.up, ...n.down].forEach(m => { m.due = this.tick; });
    }
    this.bus.emit("state", this);
  }
  setBuildOut(on) {
    if (this.buildOut === !!on) return;
    this.buildOut = !!on;
    this.order.filter(n => n.mode === "planned").forEach(n => this.log(n.id, "connectivity_change", "info", on ? "Pre-deployment node joined network (simulated)" : "Pre-deployment node removed from simulation", { pre_deployment: !!on }));
    this.bus.emit("state", this);
  }

  /* ----- guided director ----- */
  runGuided(opts) {
    this.reset(this.seed);
    this.globalConn = "online";
    const g = this.guided = { autoApprove: !!opts.autoApprove, stepMode: !!opts.stepMode, step: 0, done: false, denied: false, origin: GUIDED.origin, reconnectSet: false, awaitRollout: null };
    this._gEnter(1);
    const A = GUIDED.origin, L = opts.lead != null ? opts.lead : 4, OFF = opts.offlineFor || 8;
    this.at(L, () => this.triggerAnomaly(A));
    this.at(L + 12, () => this._gEnter(2));
    this.at(L + 21, () => this.setConn(A, "offline"));
    this.at(L + 24, () => this._gEnter(3));
    this.at(L + 21 + OFF, () => this.setConn(A, null));
    this.bus.emit("state", this);
    return g;
  }
  runAnomaly(id) { this.reset(this.seed); this.at(4, () => this.triggerAnomaly(id)); this.lastScenario = id; this.bus.emit("state", this); }
  _gEnter(n, fn) {
    const g = this.guided; if (!g || g.done) return;
    if (g.stepMode && PAUSE_AT.includes(n)) { this.paused = true; this.pending = { n, fn }; this.bus.emit("state", this); return; }
    g.step = n; this.bus.emit("step", n); if (fn) fn();
  }
  next() {
    if (!this.pending) return;
    const { n, fn } = this.pending; this.pending = null; this.paused = false;
    this.guided.step = n; this.bus.emit("step", n); if (fn) fn();
    this.bus.emit("state", this);
  }
}
