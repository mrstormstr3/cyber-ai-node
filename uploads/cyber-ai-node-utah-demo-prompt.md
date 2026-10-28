# Cyber AI Node: Utah Distributed Edge Network Demo (Build Prompt)

> Paste this whole file into your AI coding tool. It describes one deliverable: a single `index.html` that runs a telemetry simulation of Cyber AI Nodes across Utah energy sites. Nodes collect telemetry locally, send evidence upstream, and receive signed updates back.

---

## 1. Goal

Build a single-page, self-contained interactive simulation (HTML + CSS + vanilla JavaScript, no dependencies) that deploys to Vercel as a static file.

It shows a **distributed network of Cyber AI Nodes** on a map of Utah. The demo needs to prove three capabilities to hackathon judges in under 90 seconds:

1. **Collect:** each node continuously collects OT, network, and physical telemetry, and analyzes it **on-device**. Raw data stays on-site.
2. **Send:** nodes send small, structured **evidence packages and heartbeat summaries** to an operator console. When offline, they **queue and forward later** (store-and-forward).
3. **Receive updates:** the console publishes **signed update bundles** (detection rules, threat intel, policy). Nodes verify, apply, and acknowledge them in a staged rollout. Offline nodes apply them when they reconnect.

The demo must also show the supervised workflow from the business plan: local sensing → on-device multi-agent analysis → evidence to operator → human approval → constrained local response. **Nothing acts autonomously on high-impact equipment.**

This is the hackathon proof of concept described in the 1-page plan: *"replays synthetic substation data (unfamiliar device, cabinet intrusion, unexpected command) and shows event correlation, operator alert with evidence package, and a containment recommendation with simulated human approval. Deliverables: running dashboard, repeatable replay, and event log."*

---

## 2. Honesty rules (non-negotiable)

- **All telemetry is synthetic.** Show a persistent banner: *"Simulation. All telemetry is synthetic. Sites are public Utah energy projects shown for context only. No affiliation, data sharing, or endorsement is implied."*
- **The attack scenario runs at a fictional site** by default: "Demo Substation A (synthetic)". If the user triggers an anomaly at a real named site, label it **"Hypothetical drill"** everywhere it appears.
- **No logos**, brand colors, or trade dress from any real company. Use plain text names only.
- Never show the AI directly operating breakers, reactors, turbines, or inverters. Enforcement happens in the **security gateway** (network rules), and only after operator approval. Electrical protection is labeled "independent, not controlled by the node."
- No claims of "prevents all attacks." Use **"designed to reduce risk from AI-assisted attacks."**
- Planned or proposed projects appear as **planned deployments**, not as live nodes (see Section 5).

---

## 3. Visual style

- Dark industrial theme: near-black background (`#0B0F14`), panels `#121922`, teal/cyan accents (`#22D3C5`, `#38BDF8`), amber for warnings (`#F5A524`), red only for high-priority findings (`#F0525B`), and a subtle grid. Professional, not sci-fi.
- System font stack. No external fonts or CDNs.
- Simple SVG shapes for nodes: a rounded square for active nodes, a dashed outline for planned ones, and a hexagon for the console.
- Packet animation: small dots moving along SVG paths. Use different colors per direction: **uplink** (node → console) cyan, **downlink** (console → node) violet `#A78BFA`, and **peer alerts** amber dashed.
- Respect `prefers-reduced-motion`: replace the moving dots with blinking state badges.
- Text contrast must meet WCAG AA.

---

## 4. Layout (desktop first, works on tablet at 768px+)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Header: "Cyber AI Node | Utah Edge Network Simulation"                │
│ "What this shows" chips: Local monitoring · On-device analysis ·      │
│ Human-gated response · Works offline · Signed updates                 │
│ Synthetic-data banner                                                 │
├──────────────────────────────────────────┬────────────────────────────┤
│ UTAH MAP (SVG, ~60% width)               │ OPERATOR CONSOLE           │
│  - state outline + reference towns       │  - Evidence inbox          │
│  - site nodes + transmission line        │  - Approve / Deny          │
│  - uplink/downlink/peer animations       │  - Update publisher        │
│  - click node → detail drawer            │  - Rollout table           │
├──────────────────────────────────────────┴────────────────────────────┤
│ STEP INDICATOR: 1 Sense → 2 Analyze → 3 Send → 4 Decide → 5 Contain → │
│                 6 Update → 7 Share                                    │
├───────────────────────────────────────────────────────────────────────┤
│ METRICS STRIP          │ EVENT LOG (live stream, Export JSON button)  │
└───────────────────────────────────────────────────────────────────────┘
Footer: disclaimer + "Same pattern applies to AI infrastructure,
defense, and aerospace sites."
```

**Node detail drawer** (opens on click or Enter):
- Site facts, with a source link
- Live telemetry: 3–5 sparklines for the site's profile
- Agent pipeline: `Ingest → Correlate → Prioritize → Package` with the active stage highlighted
- Connectivity selector for that node
- Uplink queue count
- Installed update version
- Data residency counter: raw bytes kept local vs. summary bytes sent

---

## 5. Map and site data

### 5.1 Map

- Draw Utah as an inline SVG polygon using a simple equirectangular projection. Lat 37.0–42.0, lon −114.05 to −109.05. Include the northeast notch.

```js
const UTAH_OUTLINE = [[42.0,-114.05],[42.0,-111.05],[41.0,-111.05],[41.0,-109.05],[37.0,-109.05],[37.0,-114.05]];
const REF_TOWNS = [
  { name: "Salt Lake City", lat: 40.76, lon: -111.89 },
  { name: "Delta", lat: 39.35, lon: -112.58 },
  { name: "Price", lat: 39.60, lon: -110.81 },
  { name: "Milford", lat: 38.40, lon: -113.01 },
  { name: "Cedar City", lat: 37.68, lon: -113.06 },
  { name: "St. George", lat: 37.10, lon: -113.58 }
];
```

- Put a small caption on the map: "Marker positions approximate, for illustration."
- Handle label collisions with each site's `labelOffset` and a thin leader line. The Milford cluster (Blundell and Cape Station) needs this.

### 5.2 Site schema (add locations by appending objects, with no other code changes)

```js
/**
 * @typedef Site
 * @prop {string} id
 * @prop {string} name
 * @prop {string} owner            // plain text, no logos
 * @prop {string} county
 * @prop {number} lat, lon         // approximate
 * @prop {"node"|"line"|"console"} kind
 * @prop {[number,number][]} [path] // for kind "line"
 * @prop {"bess"|"geothermal_egs"|"geothermal_hydro"|"gas_solar_datacenter"|
 *        "nuclear_datacenter"|"solar"|"transmission"|"substation"|"console"} type
 * @prop {"operating"|"under_development"|"proposed"|"synthetic"} status
 * @prop {"active"|"planned"} nodeMode  // active = simulated live node; planned = dashed future deployment
 * @prop {string[]} facts          // short, sourced statements shown in the drawer
 * @prop {string[]} sources        // URLs
 * @prop {{dx:number,dy:number}} [labelOffset]
 */
```

### 5.3 Initial sites (verified as of Oct 27, 2026)

```js
const SITES = [
  {
    id: "console", kind: "console", type: "console", status: "synthetic", nodeMode: "active",
    name: "Regional Ops Console (demo)", owner: "Fictional operator", county: "Salt Lake",
    lat: 40.76, lon: -111.89,
    facts: ["Fictional operator console used to show supervised review and update publishing."],
    sources: []
  },
  {
    id: "demo-sub-a", kind: "node", type: "substation", status: "synthetic", nodeMode: "active",
    name: "Demo Substation A (synthetic)", owner: "Fictional", county: "Fictional",
    lat: 38.75, lon: -112.40,
    facts: ["Fictional distribution substation. Default origin of the replayed anomaly scenario."],
    sources: []
  },
  {
    id: "fervo-cape", kind: "node", type: "geothermal_egs", status: "operating", nodeMode: "active",
    name: "Cape Station", owner: "Fervo Energy", county: "Beaver",
    lat: 38.50, lon: -112.92, labelOffset: { dx: -14, dy: -18 },
    facts: [
      "World's first greenfield Enhanced Geothermal System (EGS) to reach commercial operation.",
      "First 33 MW net GeoBlock synchronized to the grid Sept 24, 2026; commercial operation Sept 30, 2026.",
      "Phase I targets about 100 MW across three 33 MW GeoBlocks."
    ],
    sources: ["https://www.renewableenergymagazine.com/geothermal/fervo-energy-declares-commercial-operation-at-cape-20261002"]
  },
  {
    id: "blundell", kind: "node", type: "geothermal_hydro", status: "operating", nodeMode: "active",
    name: "Blundell Geothermal Plant", owner: "PacifiCorp", county: "Beaver",
    lat: 38.49, lon: -112.85, labelOffset: { dx: 14, dy: 16 },
    facts: [
      "Traditional hydrothermal plant at Roosevelt Hot Springs, northeast of Milford.",
      "Utah's longest-running geothermal plant, producing power since 1984.",
      "Two units, about 33 MW net combined."
    ],
    sources: ["https://en.wikipedia.org/wiki/Blundell_Geothermal_Power_Plant"]
  },
  {
    id: "honeycomb", kind: "node", type: "bess", status: "operating", nodeMode: "active",
    name: "Honeycomb Energy Center", owner: "Clearway Energy Group", county: "Iron & Beaver",
    lat: 38.05, lon: -113.20,
    facts: [
      "320 MW / 1,280 MWh battery storage portfolio: four 80 MW systems.",
      "Brought online May 2026 using Tesla equipment under 20-year agreements with PacifiCorp.",
      "Clearway and PacifiCorp signed an additional 210 MW of battery storage in Oct 2026 (location not yet public)."
    ],
    sources: [
      "https://www.clearwayenergygroup.com/press-releases/utah-celebrates-launch-of-clearways-320-mw-energy-storage-portfolio-strengthening-grid-and-community-investment/",
      "https://www.clearwayenergygroup.com/community/utah/"
    ]
  },
  {
    id: "creekstone-delta", kind: "node", type: "gas_solar_datacenter", status: "under_development", nodeMode: "planned",
    name: "Delta Gigasite", owner: "Creekstone Energy", county: "Millard",
    lat: 39.40, lon: -112.55,
    facts: [
      "$17 billion power and AI data center campus near Delta.",
      "Planned around on-site natural gas generation and utility-scale solar.",
      "Up to 10 GW of capacity at full build-out."
    ],
    sources: [
      "https://www.areadevelopment.com/newsitems/4-21-2026/creekstone-energy-millard-county-utah.shtml",
      "https://aimagazine.com/news/zeo-creekstone-powering-the-worlds-largest-data-centre"
    ]
  },
  {
    id: "utah-solar-1", kind: "node", type: "solar", status: "under_development", nodeMode: "planned",
    name: "Utah Solar 1", owner: "EDF Power Solutions North America", county: "Millard",
    lat: 39.05, lon: -112.75,
    facts: [
      "300 MWac / 394 MWdc solar facility.",
      "30-year PPA with the Southern California Public Power Authority, serving LADWP customers.",
      "Financial close Sept 2026; generation expected mid-2027."
    ],
    sources: ["https://solarquarter.com/2026/09/21/edf-power-solutions-reaches-financial-close-on-394-mw-utah-solar-project/"]
  },
  {
    id: "project-beehive", kind: "node", type: "nuclear_datacenter", status: "proposed", nodeMode: "planned",
    name: "Project Beehive", owner: "Valar Atomics", county: "near Price",
    lat: 39.45, lon: -110.70,
    facts: [
      "Proposed data center campus powered by 456 small nuclear reactors.",
      "More than 9,000 acres of BLM land near Price; about 9.6 GW.",
      "BLM application under review; NEPA process still required."
    ],
    sources: ["https://www.kunc.org/npr-news/2026-09-30/a-startup-wants-to-build-a-massive-nuclear-powered-data-center-on-public-land-in-utah"]
  },
  {
    id: "three-peaks-purgatory", kind: "line", type: "transmission", status: "proposed", nodeMode: "planned",
    name: "Three Peaks to Purgatory 345 kV Line", owner: "Rocky Mountain Power", county: "Iron & Washington",
    lat: 37.44, lon: -113.29,
    path: [[37.72,-113.13],[37.45,-113.30],[37.15,-113.45]],
    facts: [
      "Proposed 54-mile, 345 kV line from Three Peaks Substation (Cedar City) to Purgatory Flat Substation (Washington City).",
      "Engineering expected 2028, construction 2031, in service 2033. Route not final."
    ],
    sources: ["https://kutv.com/news/local/rocky-mountain-power-plans-54-mile-transmission-line-through-southern-utah-communities"]
  }
];
```

**Planned nodes:**
- Render with a dashed outline and a "Planned deployment" tag, with no live telemetry.
- Add a toggle, **"Show future build-out"**. When it's on, planned nodes become simulated **pre-deployment** nodes, labeled that way. They join the network so judges can see how the system scales.
- Draw the transmission line as a dashed path. When future build-out is on, add two small "line monitoring node" markers at its endpoints.

---

## 6. Telemetry profiles (synthetic, per site type)

Every active node streams **security telemetry** plus **operational telemetry** for its type. Generate values from a seeded PRNG with smooth noise. No real data.

**Security telemetry (all nodes):**
- Network flows per minute
- New or unknown devices
- Config baseline match (hash OK or drift)
- Authentication failures
- OT protocol packets by type
- Cabinet door state
- Camera motion events

**Operational telemetry by type:**

| type | Signals | Protocols shown |
|---|---|---|
| `substation` | feeder load %, breaker status, relay events, transformer temp | DNP3, IEC 61850 GOOSE, Modbus TCP |
| `bess` | state of charge %, rack temp, inverter real-power setpoint, BMS alarms | Modbus TCP, DNP3 |
| `geothermal_egs` / `geothermal_hydro` | wellhead pressure, brine flow, turbine RPM, net MW | Modbus TCP, OPC UA |
| `gas_solar_datacenter` | gas turbine MW, fuel flow, solar inverter MW, IT load MW, GPU cluster power, cooling supply temp | Modbus TCP, BACnet, SNMP, Redfish |
| `solar` | irradiance, inverter output, tracker status | Modbus TCP (SunSpec) |
| `nuclear_datacenter` | module thermal output (placeholder), IT load MW, cooling temp | OPC UA, SNMP (placeholder only) |
| `transmission` | line loading %, breaker status at endpoints | IEC 61850, DNP3 |

**Data residency counter:** each node accumulates "raw telemetry retained locally" (grows quickly, e.g. MB/min) and "summaries sent" (grows slowly, KB). Show the percentage kept on-site. This should land around 99% and is the visual proof of local-first design.

---

## 7. Communication model (the core of the demo)

### 7.1 Uplink: node → console
- **Heartbeat summary** every 10 simulated seconds: node health, counts, version, and queue depth. Small cyan dot.
- **Evidence package** on any high-priority finding. Larger cyan dot with a label. The package contains:
  `{ package_id, node_id, created_at, severity, confidence, summary, correlated_events[], consequence_weight, recommended_action, requires_approval: true, sha256 }`
- **Store-and-forward.**
  - Online: send immediately.
  - Intermittent: each send has a 50% chance of failing. Retry with backoff.
  - Offline: analysis still completes and the package goes into the node's **queue**. The badge shows the count. On reconnect, the queue flushes in order with a visible burst.

### 7.2 Downlink: console → nodes (receiving updates)
- In the console, the **Update publisher** offers a bundle. After the scenario it is pre-filled:
  `DP-2026.10.3: Detection pack: "Modbus write from unregistered device + cabinet-open correlation"`
- Bundle fields: `{ bundle_id, version, kind: "detection_rules"|"threat_intel"|"policy", created_at, signature, targets[], rollout: "canary_then_all" }`
- **Staged rollout:**
  1. A canary node (default: Blundell) receives the bundle, verifies the signature, and applies it.
  2. The canary sends its acknowledgment.
  3. All remaining active nodes receive it.
- **Every node shows the same sequence:** `received → signature verified ✓ → applied → ack sent`. Its version badge updates (e.g. `v1.4.2 → v1.4.3`).
- **Offline nodes** show "Update pending". They apply it automatically on reconnect and ack late. The rollout table in the console tracks each node: Pending / Verified / Applied / Acked.
- **Tamper demo (optional button):** "Send unsigned bundle". Every node rejects it with "signature invalid, rejected", and the rejection is logged. This shows the node can't be hijacked through the update path.

### 7.3 Peer coordination
- After the operator approves, the console relays a **sanitized alert** to other active nodes. It contains the pattern only, with no raw data: "Watch for Modbus write from unregistered device after cabinet open".
- Show it as amber dashed lines that appear only after the first finding. Each receiving node shows "Watching for pattern" for 20 seconds.

---

## 8. The scenario (repeatable replay)

Default origin: **Demo Substation A (synthetic)**. Times are simulated seconds after "Simulate anomaly".

| t | Event | Agent that catches it |
|---|---|---|
| 0 | Unfamiliar device joins the sensor VLAN (new MAC, unknown vendor) | Network agent |
| 12 | Cabinet door opens with no badge record | Physical agent |
| 20 | Unexpected Modbus write (FC 16) to a feeder setpoint from the unfamiliar device | OT protocol agent |
| 22 | Correlator links all three, applies consequence weighting → **High, confidence 0.92** | Correlator agent |
| 24 | Evidence package created and hashed | Evidence agent |

**Node panel text:**
*"Anomaly: unexpected Modbus write from unregistered device after cabinet intrusion. Confidence: High (0.92). Evidence package ready."*

**Operator console card:**
- Site
- Time
- Summary
- The 3 correlated events
- Evidence package ID and hash
- **Recommended action:** "Isolate sensor VLAN port and revoke the unfamiliar device's session at the security gateway. Requires operator confirmation."
- Note: "Electrical protection remains independent and is not changed."
- Buttons: **Approve** / **Deny**

**On Approve:**
- The gateway icon on that node shows "Rule applied under operator authority".
- The node status becomes **"Contained (gateway rule)"**.
- Steps 6 (updates) and 7 (peer share) follow automatically in guided mode.

**On Deny:**
- The node stays in "Monitoring, finding retained".
- The log records the denial and the reason "Operator declined".

**Replay determinism:** use the `mulberry32` PRNG with a default seed of 2026. Read `?seed=` from the URL. The same seed must produce an identical event log.

---

## 9. Controls

- **Run guided demo** (primary button). Plays steps 1–7 with the step indicator and a one-line caption per step. Pauses at step 4 for the judge to click Approve; auto-approves after 8 seconds in autoplay mode. Total runtime under 90 seconds.
- **Step mode**: a Next button advances one stage.
- **Simulate anomaly at:** a dropdown of active nodes. Real sites get the "Hypothetical drill" label.
- **Connectivity**: a global toggle (Online / Intermittent / Offline), plus a per-node override in the drawer.
- **Guided demo script:** at step 3, briefly drop Demo Substation A offline so judges see the evidence queue and then flush on reconnect. At step 6, keep one node offline so they see "Update pending" and then a late apply.
- **Show future build-out** toggle (planned nodes).
- **Send unsigned bundle** (tamper test).
- **Speed:** 1× / 2× / 4×.
- **Reset** and **Replay** (same seed).
- **Export event log** downloads `cyber-ai-node-event-log-<seed>.json`.
- URL params: `?autoplay=1`, `?seed=2026`, `?speed=2`.

---

## 10. Metrics strip

- **Time to detect:** first event to evidence package.
- **Time to operator decision.**
- **Evidence packages:** sent / queued.
- **Data kept on-site:** % across all nodes.
- **Update rollout:** e.g. "4 of 5 nodes acked, 1 pending".
- **Unsigned updates rejected:** count.

---

## 11. Event log

- Show the newest events at the top, color-coded by type. Each line shows the simulated timestamp, node, type, and a one-line message.
- Event types: `telemetry_summary`, `device_detected`, `physical_event`, `protocol_event`, `correlation`, `evidence_packaged`, `uplink_sent`, `uplink_queued`, `uplink_flushed`, `operator_decision`, `gateway_rule_applied`, `update_published`, `update_received`, `update_verified`, `update_rejected`, `update_applied`, `update_ack`, `peer_alert`, `connectivity_change`.
- Use this event schema. **Design it so a real node on AMD Ryzen AI Halo hardware could publish the same events later over WebSocket.** That's the funded next milestone, so keep the simulator and the renderer decoupled:

```js
{ seq: 41, t: 24.0, node_id: "demo-sub-a", type: "evidence_packaged",
  severity: "high", payload: { package_id: "EP-0007", confidence: 0.92, sha256: "…" } }
```

- Architecture: put a `SimEngine` (state, clock, PRNG, emits events) behind a tiny event bus, with `MapView`, `ConsoleView`, `LogView`, and `MetricsView` subscribers. The views never mutate state directly. Buttons dispatch actions to the engine.

---

## 12. Technical constraints

- One file: `index.html` with embedded `<style>` and `<script>`. No frameworks, no CDNs, no network requests, no backend. It must deploy to Vercel as-is.
- Simulation tick: 250 ms real time, scaled by the speed setting. Use `requestAnimationFrame` for packet animation.
- Accessibility:
  - All controls are real `<button>`/`<select>` elements with labels.
  - Nodes are focusable (`tabindex="0"`, `role="button"`, `aria-label` with name and status).
  - The event log is `aria-live="polite"`. Throttle it to one announcement per step.
- Responsive: at ≥1200px, map and console sit side by side. At 768–1199px, the console stacks under the map.
- Wrap any `localStorage` use (e.g. remembering speed) in try/catch. The app must work without it.
- No console errors. Keep the code readable and commented by section.

---

## 13. Must not show

- The AI directly commanding breakers, reactors, turbines, inverters, or battery dispatch.
- A "system shutdown" or anything that cuts power to customers.
- Real company logos or styling, or a real incident at a real site.
- "Guaranteed" or "prevents all attacks" language.
- Raw telemetry leaving a site. Only summaries, evidence packages, and alerts move.

---

## 14. Acceptance checklist

- [ ] Guided demo runs start to finish in under 90 seconds and the step indicator tracks it.
- [ ] Offline at step 3: the analysis still completes, the queue badge increments, and the queue flushes on reconnect with matching log entries.
- [ ] Update rollout: canary first, then the rest. The offline node shows "Update pending" and applies on reconnect. Version badges change.
- [ ] Unsigned bundle is rejected by every node and logged.
- [ ] Deny path works and is logged.
- [ ] Same `?seed=` produces an identical exported event log.
- [ ] Adding a new object to `SITES` renders a new node, drawer, and telemetry with no other code changes.
- [ ] Planned sites are dashed and show no telemetry until "Show future build-out" is on.
- [ ] Synthetic-data banner and footer disclaimer are always visible.
- [ ] Keyboard-only run-through works. Reduced-motion mode works.
- [ ] No external requests in the network tab. No console errors.

---

## 15. Footer copy

*"Simulation of the Cyber AI Node supervised edge workflow. Not a production control system. All telemetry is synthetic. Every containment action requires human confirmation, and electrical protection remains independent. Energy is the primary example; the same pattern applies to AI infrastructure, defense, and aerospace sites. Built during Hard Tech Week, Oct 26–28, 2026."*

---

## 16. Output request

Return the complete, ready-to-deploy `index.html`. Then give a short list of what was implemented against the acceptance checklist, and anything stubbed. Make the core story obvious within 30 seconds of clicking **Run guided demo**: nodes **collect** locally, **send** evidence, the operator **approves**, and nodes **receive** a signed update.
