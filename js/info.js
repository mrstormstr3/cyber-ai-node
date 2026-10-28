/* ===== Training info popovers: (i) buttons anywhere with data-info="key" ===== */
const INFO = {
  local: { t: "Local monitoring", b: ["Each Cyber AI Node sits inside the site network. It collects OT protocol traffic, network flows, and physical sensors such as cabinet doors and cameras.", "Raw telemetry is stored and analyzed on-site. It never leaves the site."] },
  ondevice: { t: "On-device analysis", b: ["Specialist agents run on the node: network, physical, OT protocol, correlator, and evidence.", "The correlator links weak signals into one finding and weights it by consequence. Nothing has to go to the cloud first, so detection still works on a poor link."] },
  human: { t: "Human-gated response", b: ["The node recommends and the operator decides. Nothing happens to equipment on its own.", "Containment is a network rule at the security gateway, such as isolating a port or revoking a session. It is applied only after approval.", "The node never commands breakers, reactors, turbines, inverters, or battery dispatch. Electrical protection stays independent."] },
  offline: { t: "Works offline (store-and-forward)", b: ["If the link drops, analysis still finishes and messages are queued on the node. The amber number on a marker is the queue depth.", "On an intermittent link, each send has a 50% chance of failing and is retried after 2, 4, then 8 seconds.", "When the link comes back, the queue is sent in order."] },
  signed: { t: "Signed updates", b: ["The console publishes signed bundles: detection rules, threat intel, or policy.", "Each node checks the signature before applying a bundle. Rollout is staged: one canary node first, then all the others.", "A node that is offline shows \"Update pending\" and applies the bundle when it reconnects. Unsigned or altered bundles are rejected."] },
  map: { t: "Reading the map", b: ["Square = Cyber AI Node. Hexagon = operator console. Dashed line = transmission route, with a monitoring node at each end.", "Cyan dots = uplink (heartbeats, evidence, acks). Violet dots = downlink (updates, gateway rules). Amber dashed lines = peer alerts.", "Red ring = active finding. Amber number = queued messages. GW badge = gateway rule applied. Chips under a label show the current state.", "The insets show the Wasatch Front and the Milford cluster at a larger scale. All marker positions are approximate."] },
  segments: { t: "Segment filter", b: ["Shows only the nodes in one segment on the map and in the fleet table.", "This only changes what is displayed. Filtered-out nodes keep running and still get updates and peer alerts."] },
  present: { t: "Narrated walkthrough", b: ["Plays the guided demo with a spoken narration of under 2 minutes, captions, and a highlight on each feature as it is explained. It clicks Approve and runs the tamper test for you.", "To make a video, screen-record this tab with system audio. Microsoft Edge has the most natural free male voices. Pick a voice in the control box at the top right.", "Press Esc or Stop to end it at any time."] },
  guided: { t: "Guided demo", b: ["Plays the seven steps in about 75 seconds at 1× speed: Sense, Analyze, Send, Decide, Contain, Update, Share.", "It waits at step 4 for you to click Approve or Deny. Tick \"Auto-approve after 8s\" for a hands-free run.", "Step mode pauses before steps 2, 3, 6 and 7. Press Next step to continue."] },
  anomaly: { t: "Simulate anomaly", b: ["Replays the three-event scenario at the node you pick: an unfamiliar device, then a cabinet opened with no badge record, then an unexpected Modbus write.", "If you pick a real site, every message about it is labeled \"Hypothetical drill\"."] },
  conn: { t: "Connectivity", b: ["Sets the link state for every node: Online, Intermittent, or Offline.", "To change a single node, open its details panel. A per-node setting overrides the global one."] },
  replay: { t: "Speed, Reset, Replay", b: ["Speed runs the simulated clock at 1×, 2× or 4×.", "Reset clears everything back to T+0. Replay runs the last scenario again with the same seed.", "Running with the same ?seed= value produces an identical event log."] },
  steps: { t: "Workflow steps", b: ["Sense → Analyze → Send → Decide → Contain → Update → Share.", "This is the supervised loop: local sensing, on-device analysis, evidence to the operator, human approval, limited local response, then the fleet learns from it."] },
  inbox: { t: "Evidence inbox", b: ["An evidence package is a small structured summary, about 18 KB. It holds the severity, the confidence score, the three correlated events, a consequence weight, and a recommended action.", "Each package is SHA-256 hashed when it is created so the console can check it hasn't been changed. Raw telemetry is not included.", "Every package has requires_approval set to true."] },
  publisher: { t: "Update publisher", b: ["After a finding, the publisher is pre-filled with a detection pack for that attack pattern.", "Sign & publish signs the bundle and starts the staged rollout: the canary first, then all other active nodes."] },
  unsigned: { t: "Tamper test", b: ["Sends a bundle with no signature to every node. Each node rejects it, logs \"signature invalid, rejected\", and keeps its current rules.", "This shows that the update channel can't be used to take over a node."] },
  fleet: { t: "Fleet & rollout", b: ["Shows each active node's link state, installed version, queue depth (↓ = updates waiting to be delivered), and rollout progress.", "Rollout states: Pending → Received → Verified → Applied → Acked."] },
  metrics: { t: "Metrics", b: ["Time to detect: from the first event to the finished evidence package.", "Time to decision: from evidence reaching the console to the operator's decision.", "Data kept on-site: raw bytes kept locally, divided by all bytes produced. It should stay around 99%."] },
  log: { t: "Event log", b: ["Newest events are at the top. Each line shows the simulated time, the node, the event type, and a message.", "The log uses the same schema a real node would publish over WebSocket. Export JSON downloads the whole log."] },
  pipeline: { t: "Agent pipeline", b: ["Ingest → Correlate → Prioritize → Package. The highlighted stage is what the node is working on now.", "All four stages run on the node itself."] },
  telemetry: { t: "Live telemetry", b: ["Synthetic signals for this type of site, plus network security counters. Each sparkline covers the last 60 simulated seconds.", "Operational values are read-only. The node observes them and never writes them."] },
  boundary: { t: "Response boundary", b: ["The only action the node can take is a network rule at the security gateway, and only with operator approval.", "Electrical protection, such as relays and breakers, is independent and is not controlled by the node."] },
  residency: { t: "Data residency", b: ["Raw telemetry builds up on the node at megabytes per minute. Only heartbeats, evidence, and acks are sent upstream, which adds up to kilobytes.", "The percentage kept on-site shows the node's local-first design."] }
};
function infoBtn(k) { const i = INFO[k]; return i ? `<button type="button" class="info" data-info="${k}" aria-label="About: ${esc(i.t)}" aria-expanded="false" aria-haspopup="dialog">i</button>` : ""; }

(function () {
  const pop = document.createElement("div");
  pop.className = "infopop"; pop.id = "infoPop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-labelledby", "infoPopT"); pop.hidden = true;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(pop));
  let owner = null;
  function close(refocus) {
    if (!owner) return; owner.setAttribute("aria-expanded", "false");
    const o = owner; owner = null; pop.hidden = true; if (refocus) o.focus();
  }
  function open(btn) {
    const i = INFO[btn.dataset.info]; if (!i) return;
    if (owner === btn) { close(true); return; }
    close(false); owner = btn; btn.setAttribute("aria-expanded", "true");
    pop.innerHTML = `<div class="iph"><span class="ipi" aria-hidden="true">i</span><h4 id="infoPopT">${esc(i.t)}</h4><button type="button" class="ipx" aria-label="Close">×</button></div>${i.b.map(p => `<p>${esc(p)}</p>`).join("")}`;
    pop.hidden = false;
    const r = btn.getBoundingClientRect(), w = Math.min(340, innerWidth - 16);
    pop.style.width = w + "px";
    let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    let y = r.bottom + 8; const h = pop.offsetHeight;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
    pop.style.left = x + "px"; pop.style.top = y + "px";
    pop.querySelector(".ipx").focus();
  }
  document.addEventListener("click", ev => {
    const b = ev.target.closest(".info");
    if (b) { ev.preventDefault(); ev.stopPropagation(); open(b); return; }
    if (ev.target.closest(".ipx")) { close(true); return; }
    if (owner && !pop.contains(ev.target)) close(false);
  }, true);
  window.addEventListener("keydown", ev => { if (ev.key === "Escape" && owner) { ev.stopImmediatePropagation(); close(true); } }, true);
  window.addEventListener("scroll", () => close(false), true);
  window.addEventListener("resize", () => close(false));
})();
