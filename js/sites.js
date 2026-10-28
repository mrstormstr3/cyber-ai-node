/* ===== Map geometry ===== */
const UTAH_OUTLINE = [[42.0,-114.05],[42.0,-111.05],[41.0,-111.05],[41.0,-109.05],[37.0,-109.05],[37.0,-114.05]];
const REF_TOWNS = [
  { name: "Salt Lake City", lat: 40.76, lon: -111.89 },
  { name: "Ogden", lat: 41.23, lon: -111.97 },
  { name: "Provo", lat: 40.23, lon: -111.66 },
  { name: "Delta", lat: 39.35, lon: -112.58 },
  { name: "Price", lat: 39.60, lon: -110.81 },
  { name: "Green River", lat: 38.99, lon: -110.16 },
  { name: "Milford", lat: 38.40, lon: -113.01 },
  { name: "Cedar City", lat: 37.68, lon: -113.06 },
  { name: "St. George", lat: 37.10, lon: -113.58 }
];

/* Detail insets: sites inside a region render in the inset at larger scale (dense clusters). */
const INSETS = [
  { id: "wasatch", title: "Wasatch Front · detail", lat: [39.98, 41.32], lon: [-112.15, -111.45], scale: 2.6, x0: 706, y0: 64, box: { x: 690, y: 36, w: 360, h: 608 } },
  { id: "milford", title: "Milford geothermal cluster · detail", lat: [38.38, 38.58], lon: [-113.06, -112.80], scale: 4, x0: 770, y0: 690, box: { x: 690, y: 654, w: 360, h: 186 } }
];

/* Segments for the map filter */
const CATEGORIES = [
  { id: "storage_renewables", label: "Storage & renewables" },
  { id: "geothermal", label: "Geothermal" },
  { id: "transmission", label: "Transmission" },
  { id: "industrial", label: "Industrial & data centers" },
  { id: "substations", label: "Substations" }
];

/* ===== Sites (append objects to add locations; no other code changes needed) =====
   category: segment for the filter. labelOffset displaces the marker (with a leader line) to avoid collisions.
   labelSide: "left" to put the label on the left. Lines: shortName, endNames, endOffsets, lineLabel, lineLabelAt. */
const SITES = [
  {
    id: "console", kind: "console", type: "console", status: "synthetic", nodeMode: "active",
    name: "Regional Ops Console (demo)", owner: "Fictional operator", county: "Salt Lake",
    lat: 40.76, lon: -111.89,
    facts: ["Fictional operator console used to show supervised review and update publishing."],
    sources: []
  },
  {
    id: "demo-sub-a", kind: "node", type: "substation", category: "substations", status: "synthetic", nodeMode: "active",
    name: "Demo Substation A (synthetic)", owner: "Fictional", county: "Fictional",
    lat: 38.85, lon: -112.15,
    facts: ["Fictional distribution substation. Default origin of the replayed anomaly scenario."],
    sources: []
  },
  /* --- Battery energy storage & renewables --- */
  {
    id: "green-river", kind: "node", type: "solar_bess", category: "storage_renewables", status: "operating", nodeMode: "active",
    name: "Green River Energy Center", owner: "rPlus Energies", county: "Emery",
    lat: 38.85, lon: -110.35,
    facts: [
      "Utah's largest solar-plus-storage facility.",
      "400 MW solar array paired with a 400 MW / 1,600 MWh battery energy storage system.",
      "Achieved commercial operations in mid-2026."
    ],
    sources: []
  },
  {
    id: "honeycomb", kind: "node", type: "bess", category: "storage_renewables", status: "operating", nodeMode: "active",
    name: "Honeycomb Energy Center", owner: "Clearway Energy Group", county: "Iron & Beaver",
    lat: 38.05, lon: -113.20,
    facts: [
      "320 MW / 1,280 MWh battery storage portfolio across Iron and Beaver counties.",
      "Brought online in May 2026 using Tesla equipment under a 20-year agreement with PacifiCorp."
    ],
    sources: [
      "https://www.clearwayenergygroup.com/press-releases/utah-celebrates-launch-of-clearways-320-mw-energy-storage-portfolio-strengthening-grid-and-community-investment/",
      "https://www.clearwayenergygroup.com/community/utah/"
    ]
  },
  {
    id: "clearway-210", kind: "node", type: "bess", category: "storage_renewables", status: "under_development", nodeMode: "active",
    name: "PacifiCorp / Clearway 210 MW Addition", owner: "PacifiCorp / Clearway Energy Group", county: "Not yet public",
    lat: 38.25, lon: -113.50,
    facts: [
      "An additional 210 MW of battery energy storage signed in October 2026 to further expand Utah's grid-enhancing storage capacity.",
      "Location not yet public. Marker placed near the Honeycomb portfolio for illustration only."
    ],
    sources: []
  },
  {
    id: "zion-solar", kind: "node", type: "solar", category: "storage_renewables", status: "under_development", nodeMode: "active",
    name: "Zion Solar Project", owner: "NextEra Energy Resources", county: "Iron",
    lat: 37.85, lon: -113.55,
    facts: [
      "A major utility-scale solar development in Iron County.",
      "Over $755 million in project investment, with up to 350 construction jobs.",
      "Marker position approximate."
    ],
    sources: []
  },
  {
    id: "utah-solar-1", kind: "node", type: "solar", category: "storage_renewables", status: "under_development", nodeMode: "active",
    name: "Utah Solar 1", owner: "EDF Power Solutions North America", county: "Millard",
    lat: 39.05, lon: -112.75, labelSide: "left",
    facts: [
      "300 MWac / 394 MWdc solar facility.",
      "Slated to deliver power to the Los Angeles Department of Water and Power starting mid-2027.",
      "Financial close Sept 2026."
    ],
    sources: ["https://solarquarter.com/2026/09/21/edf-power-solutions-reaches-financial-close-on-394-mw-utah-solar-project/"]
  },
  {
    id: "faraday-bess-1", kind: "node", type: "bess", category: "storage_renewables", status: "under_development", nodeMode: "active",
    name: "Faraday BESS 1", owner: "Lydian Energy", county: "Utah",
    lat: 40.42, lon: -112.00,
    facts: [
      "A 150 MW battery energy storage system under development in Utah County.",
      "Built to support the broader Western Electricity Coordinating Council (WECC) grid.",
      "Marker position approximate."
    ],
    sources: []
  },
  /* --- Geothermal --- */
  {
    id: "fervo-cape", kind: "node", type: "geothermal_egs", category: "geothermal", status: "operating", nodeMode: "active",
    name: "Cape Station", owner: "Fervo Energy", county: "Beaver",
    lat: 38.50, lon: -112.92, labelOffset: { dx: -12, dy: -20 },
    facts: [
      "World's first greenfield Enhanced Geothermal System (EGS) to achieve commercial operations.",
      "Delivered its first 33 MW in September 2026 and aims for 100 MW by January 2027.",
      "Phase II construction underway for another 400 MW by 2028, with total peak potential up to 4.3 GW.",
      "Offtake agreements include 396 MW dedicated to Google."
    ],
    sources: ["https://www.renewableenergymagazine.com/geothermal/fervo-energy-declares-commercial-operation-at-cape-20261002"]
  },
  {
    id: "utah-forge", kind: "node", type: "geothermal_egs", category: "geothermal", status: "operating", nodeMode: "active",
    name: "Utah FORGE", owner: "University of Utah (DOE-funded)", county: "Beaver",
    lat: 38.50, lon: -112.89, labelOffset: { dx: 12, dy: -20 },
    facts: [
      "An active U.S. Department of Energy (DOE) funded research hub managed by the University of Utah near Milford.",
      "Underground laboratory for testing the EGS horizontal drilling and hydraulic fracturing technologies that de-risked commercial projects like Cape Station."
    ],
    sources: []
  },
  {
    id: "cove-fort", kind: "node", type: "geothermal_hydro", category: "geothermal", status: "under_development", nodeMode: "active",
    name: "Cove Fort Project", owner: "Ormat / University of Utah EGI", county: "Millard",
    lat: 38.60, lon: -112.58,
    facts: [
      "Newly funded exploratory project using a portion of a $99 million federal grant awarded in autumn 2026.",
      "The University of Utah's Energy & Geoscience Institute is partnering with Ormat at Cove Fort to drill and study a large subsurface thermal anomaly.",
      "The companion Dixie Valley West project is in Nevada, outside this map."
    ],
    sources: []
  },
  {
    id: "blundell", kind: "node", type: "geothermal_hydro", category: "geothermal", status: "operating", nodeMode: "active",
    name: "Blundell Geothermal Plant", owner: "PacifiCorp", county: "Beaver",
    lat: 38.49, lon: -112.85, labelOffset: { dx: 12, dy: 18 },
    facts: [
      "Utah's longest-running hydrothermal plant (since 1984) at Roosevelt Hot Springs.",
      "Currently produces around 34 MW, with long-term considerations to expand capacity toward 72 MW."
    ],
    sources: ["https://en.wikipedia.org/wiki/Blundell_Geothermal_Power_Plant"]
  },
  /* --- Transmission (each line gets two line monitoring nodes at its endpoints) --- */
  {
    id: "cross-tie", kind: "line", type: "transmission", category: "transmission", status: "proposed", nodeMode: "active",
    name: "Cross-Tie Transmission Line", owner: "TransCanyon", county: "Juab & Millard to Nevada",
    lat: 39.55, lon: -112.80,
    path: [[39.82,-111.86],[39.60,-112.40],[39.45,-113.20],[39.35,-114.04]],
    shortName: "Cross-Tie", endNames: ["Clover", "NV state line"], lineLabel: "Cross-Tie 500 kV (proposed)", lineLabelAt: [39.57, -113.75],
    facts: [
      "A proposed 214-mile, 500 kV transmission line connecting Utah and Nevada.",
      "Currently targeting an in-service date of 2027. Route shown is approximate."
    ],
    sources: []
  },
  {
    id: "suvps", kind: "line", type: "transmission", category: "transmission", status: "under_development", nodeMode: "active",
    name: "Southern Utah Valley Power Systems (SUVPS) Phase 1", owner: "Southern Utah Valley Power Systems", county: "Utah",
    lat: 40.08, lon: -111.67,
    path: [[40.13,-111.64],[40.03,-111.69]],
    shortName: "SUVPS", endNames: ["Canyon Road", "Taylor"], endOffsets: [{ dx: 0, dy: 36 }, { dx: 0, dy: 40 }],
    lineLabel: "SUVPS Phase 1 upgrade", lineLabelAt: [40.08, -111.70], lineLabelLeft: true,
    facts: [
      "Grid improvement program upgrading the existing high-voltage Canyon Road to Taylor Transmission Line through Salem and Spanish Fork.",
      "Following resolved supply chain issues for power poles, construction set to begin as early as March 2026."
    ],
    sources: []
  },
  {
    id: "three-peaks-purgatory", kind: "line", type: "transmission", category: "transmission", status: "proposed", nodeMode: "active",
    name: "Three Peaks Transmission Line Project", owner: "Rocky Mountain Power", county: "Iron & Washington",
    lat: 37.44, lon: -113.29,
    path: [[37.72,-113.13],[37.45,-113.30],[37.15,-113.45]],
    shortName: "Three Peaks", endNames: ["Cedar City", "Washington City"], lineLabel: "Three Peaks 345 kV (proposed)",
    facts: [
      "A proposed 54-mile, 345 kV transmission line connecting substations near Cedar City and Washington City in Southern Utah.",
      "Construction preliminarily planned from 2031 through 2033. Route not final."
    ],
    sources: ["https://kutv.com/news/local/rocky-mountain-power-plans-54-mile-transmission-line-through-southern-utah-communities"]
  },
  /* --- Industrial power projects --- */
  {
    id: "creekstone-delta", kind: "node", type: "gas_solar_datacenter", category: "industrial", status: "under_development", nodeMode: "active",
    name: "Creekstone Gigasite", owner: "Creekstone Energy", county: "Millard",
    lat: 39.40, lon: -112.55,
    facts: [
      "A $17 billion-backed power and AI data center campus near Delta.",
      "Integrated on-site natural gas generation (tapping the Kern River Gas Pipeline) and utility-scale solar.",
      "Operates independently from the public utility grid."
    ],
    sources: [
      "https://www.areadevelopment.com/newsitems/4-21-2026/creekstone-energy-millard-county-utah.shtml",
      "https://aimagazine.com/news/zeo-creekstone-powering-the-worlds-largest-data-centre"
    ]
  },
  {
    id: "project-beehive", kind: "node", type: "nuclear_datacenter", category: "industrial", status: "proposed", nodeMode: "active",
    name: "Project Beehive", owner: "Valar Atomics", county: "near Price",
    lat: 39.45, lon: -110.70,
    facts: [
      "A proposed nuclear reactor and data center project aiming to install 456 small nuclear reactors on 9,000 acres near Price, Utah.",
      "Received initial state trust land approvals in September 2026."
    ],
    sources: ["https://www.kunc.org/npr-news/2026-09-30/a-startup-wants-to-build-a-massive-nuclear-powered-data-center-on-public-land-in-utah"]
  },
  {
    id: "joule-hpc", kind: "node", type: "hpc_datacenter", category: "industrial", status: "proposed", nodeMode: "active",
    name: "Joule HP Computer Campus", owner: "Not specified", county: "Millard",
    lat: 39.33, lon: -112.62, labelOffset: { dx: 14, dy: 22 },
    facts: [
      "A planned high-performance computing campus in Delta.",
      "Expected to bring 1.4 GW of capacity, a major contributor to the state's multi-gigawatt development pipeline."
    ],
    sources: []
  },
  /* --- Substations (approximate locations) --- */
  {
    id: "slc-southeast-sub", kind: "node", type: "substation", category: "substations", status: "operating", nodeMode: "active",
    name: "Utah Power - Southeast Substation", owner: "Utah Power", county: "Salt Lake",
    lat: 40.70, lon: -111.85, labelOffset: { dx: 0, dy: 12 },
    facts: ["Utility substation managing local power distribution within the central regional grid of Salt Lake City.", "Marker position approximate."],
    sources: []
  },
  {
    id: "pioneer-sub", kind: "node", type: "substation", category: "substations", status: "operating", nodeMode: "active",
    name: "Pioneer Substation", owner: "Not specified", county: "Weber",
    lat: 41.20, lon: -111.97,
    facts: ["Electrical substation in Ogden that supports the broader Northern Utah grid infrastructure.", "Marker position approximate."],
    sources: []
  },
  {
    id: "provo-power", kind: "node", type: "substation", category: "substations", status: "operating", nodeMode: "active",
    name: "Provo City Power", owner: "Provo City Power", county: "Utah",
    lat: 40.234, lon: -111.658, labelOffset: { dx: 0, dy: -36 },
    facts: ["Primary power distribution and utility facility located in Provo.", "Marker position approximate."],
    sources: []
  },
  {
    id: "provo-power-2", kind: "node", type: "substation", category: "substations", status: "operating", nodeMode: "active",
    name: "Provo City Power (secondary)", owner: "Provo City Power", county: "Utah",
    lat: 40.234, lon: -111.658,
    facts: ["Secondary Provo City Power listing providing additional city power services and local grid support for the surrounding community.", "Marker position approximate."],
    sources: []
  },
  {
    id: "provo-energy-dept", kind: "node", type: "substation", category: "substations", status: "operating", nodeMode: "active",
    name: "Provo Electric Energy Department", owner: "Provo City", county: "Utah",
    lat: 40.234, lon: -111.658, labelOffset: { dx: 0, dy: 36 },
    facts: ["Handles electrical distribution duties and shares the primary utility operations site.", "Marker position approximate."],
    sources: []
  },
  {
    id: "st-george-sub", kind: "node", type: "substation", category: "substations", status: "operating", nodeMode: "active",
    name: "St. George Substation", owner: "Not specified", county: "Washington",
    lat: 37.10, lon: -113.58, labelOffset: { dx: 16, dy: 22 },
    facts: ["Localized substation serving the power step-down needs of the community in St. George.", "Marker position approximate."],
    sources: []
  }
];

/* ===== Telemetry profiles (synthetic) =====
   signals: smooth seeded noise around base±amp with period `per` (sim seconds). */
const PROFILES = {
  substation: {
    protocols: ["DNP3", "IEC 61850 GOOSE", "Modbus TCP"], protoBase: [420, 1800, 260], flows: 640, rawMBmin: 2.4,
    setpoint: "feeder setpoint register",
    signals: [
      { k: "feeder_load", label: "Feeder load", unit: "%", base: 62, amp: 9, per: 40, dec: 1 },
      { k: "xfmr_temp", label: "Transformer temp", unit: "°C", base: 57, amp: 3, per: 90, dec: 1 },
      { k: "relay_events", label: "Relay events", unit: "/hr", base: 2, amp: 2, per: 30, dec: 0, min: 0 }
    ],
    states: [["Breaker status", "Closed (monitored, read-only)"]]
  },
  bess: {
    protocols: ["Modbus TCP", "DNP3"], protoBase: [2400, 380], flows: 1150, rawMBmin: 3.1,
    setpoint: "inverter real-power setpoint register",
    signals: [
      { k: "soc", label: "State of charge", unit: "%", base: 64, amp: 20, per: 150, dec: 1, min: 5, max: 98 },
      { k: "rack_temp", label: "Rack temp", unit: "°C", base: 27, amp: 2, per: 60, dec: 1 },
      { k: "inv_sp", label: "Inverter setpoint (read)", unit: "MW", base: 40, amp: 60, per: 120, dec: 1, min: -80, max: 80 }
    ],
    states: [["BMS alarms", "0 active"]]
  },
  geothermal_egs: {
    protocols: ["Modbus TCP", "OPC UA"], protoBase: [1500, 900], flows: 820, rawMBmin: 2.8,
    setpoint: "turbine governor setpoint register",
    signals: [
      { k: "whp", label: "Wellhead pressure", unit: "bar", base: 18.4, amp: 1.2, per: 50, dec: 2 },
      { k: "brine", label: "Brine flow", unit: "kg/s", base: 410, amp: 22, per: 45, dec: 0 },
      { k: "rpm", label: "Turbine speed", unit: "rpm", base: 3600, amp: 5, per: 12, dec: 0 },
      { k: "netmw", label: "Net output", unit: "MW", base: 31.6, amp: 1.1, per: 70, dec: 1 }
    ],
    states: []
  },
  gas_solar_datacenter: {
    protocols: ["Modbus TCP", "BACnet", "SNMP", "Redfish"], protoBase: [3200, 2100, 5400, 1600], flows: 4800, rawMBmin: 9.6,
    setpoint: "gas turbine load setpoint register",
    signals: [
      { k: "gtmw", label: "Gas turbine output", unit: "MW", base: 182, amp: 18, per: 80, dec: 0 },
      { k: "it", label: "IT load", unit: "MW", base: 212, amp: 14, per: 60, dec: 0 },
      { k: "gpu", label: "GPU cluster power", unit: "MW", base: 158, amp: 12, per: 30, dec: 0 },
      { k: "cool", label: "Cooling supply temp", unit: "°C", base: 18.2, amp: 0.8, per: 50, dec: 1 },
      { k: "solar", label: "Solar inverter output", unit: "MW", base: 118, amp: 40, per: 200, dec: 0, min: 0 },
      { k: "fuel", label: "Fuel flow", unit: "MMscf/d", base: 38, amp: 3, per: 80, dec: 1 }
    ],
    states: []
  },
  solar: {
    protocols: ["Modbus TCP (SunSpec)"], protoBase: [2600], flows: 700, rawMBmin: 1.6,
    setpoint: "inverter power-limit register",
    signals: [
      { k: "irr", label: "Irradiance", unit: "W/m²", base: 840, amp: 110, per: 70, dec: 0, min: 0 },
      { k: "inv", label: "Inverter output", unit: "MW", base: 236, amp: 38, per: 70, dec: 0, min: 0 }
    ],
    states: [["Tracker status", "Tracking (auto)"]]
  },
  nuclear_datacenter: {
    protocols: ["OPC UA", "SNMP"], protoBase: [1200, 3800], flows: 3600, rawMBmin: 6.2,
    setpoint: "cooling loop setpoint register (placeholder)",
    signals: [
      { k: "mt", label: "Module thermal (placeholder)", unit: "MWt", base: 812, amp: 8, per: 90, dec: 0 },
      { k: "it", label: "IT load", unit: "MW", base: 604, amp: 30, per: 60, dec: 0 },
      { k: "cool", label: "Cooling temp", unit: "°C", base: 21.3, amp: 0.9, per: 50, dec: 1 }
    ],
    states: [["Profile", "Placeholder signals only"]]
  },
  transmission: {
    protocols: ["IEC 61850", "DNP3"], protoBase: [1400, 300], flows: 420, rawMBmin: 1.2,
    setpoint: "endpoint RTU setpoint register",
    signals: [
      { k: "load", label: "Line loading", unit: "%", base: 54, amp: 11, per: 90, dec: 1 }
    ],
    states: [["Breaker status (endpoints)", "Closed / Closed (read-only)"]]
  }
};
PROFILES.solar_bess = {
  protocols: ["Modbus TCP (SunSpec)", "DNP3"], protoBase: [3100, 420], flows: 1300, rawMBmin: 3.6,
  setpoint: "BESS real-power setpoint register",
  signals: [
    { k: "irr", label: "Irradiance", unit: "W/m²", base: 830, amp: 110, per: 70, dec: 0, min: 0 },
    { k: "pv", label: "PV output", unit: "MW", base: 318, amp: 50, per: 70, dec: 0, min: 0 },
    { k: "soc", label: "BESS state of charge", unit: "%", base: 58, amp: 22, per: 150, dec: 1, min: 5, max: 98 },
    { k: "bess", label: "BESS power (read)", unit: "MW", base: 80, amp: 160, per: 120, dec: 0, min: -400, max: 400 }
  ],
  states: [["BMS alarms", "0 active"]]
};
PROFILES.hpc_datacenter = {
  protocols: ["BACnet", "SNMP", "Redfish", "Modbus TCP"], protoBase: [1900, 5100, 2200, 900], flows: 4200, rawMBmin: 8.4,
  setpoint: "chiller plant setpoint register",
  signals: [
    { k: "it", label: "IT load", unit: "MW", base: 380, amp: 25, per: 60, dec: 0 },
    { k: "gpu", label: "GPU cluster power", unit: "MW", base: 290, amp: 20, per: 30, dec: 0 },
    { k: "feed", label: "Utility feed", unit: "MW", base: 420, amp: 25, per: 80, dec: 0 },
    { k: "cool", label: "Cooling supply temp", unit: "°C", base: 18.6, amp: 0.8, per: 50, dec: 1 }
  ],
  states: [["Profile", "Planned campus, simulated"]]
};
PROFILES.geothermal_hydro = PROFILES.geothermal_egs;

const TYPE_LABEL = {
  substation: "Distribution substation", solar_bess: "Solar + battery storage", hpc_datacenter: "High-performance computing campus", bess: "Battery energy storage", geothermal_egs: "Enhanced geothermal (EGS)",
  geothermal_hydro: "Hydrothermal geothermal", gas_solar_datacenter: "Gas + solar AI data center campus",
  nuclear_datacenter: "Nuclear-powered data center campus", solar: "Utility-scale solar", transmission: "Transmission line", console: "Operator console"
};
const STATUS_LABEL = { operating: "Operating", under_development: "Under development", proposed: "Proposed", synthetic: "Synthetic (fictional)" };
