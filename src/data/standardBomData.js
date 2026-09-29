// Standard EPC Bill of Materials (BOM) Master Data & Calculation Engine
// Based on real Gujarat Rooftop Solar EPC Field Specifications (3.3 kW / 6-panel baseline)

export const STANDARD_BOM_CATEGORIES = [
  { id: 'structure', name: 'Mounting Structure & Hardware', icon: 'foundation' },
  { id: 'electrical', name: 'Electrical Protection & Switchgear', icon: 'electric_meter' },
  { id: 'cables', name: 'Solar & Grid Cabling', icon: 'cable' },
  { id: 'conduits', name: 'Piping, Conduits & Accessories', icon: 'plumbing' }
];

export const STANDARD_BOM_CATALOG = [
  // 1. Structure & Fasteners
  {
    id: 'gi_pipe_60x40',
    category: 'structure',
    name: '60x40 GI Pipe (20 ft, 2mm thickness)',
    description: 'Hot-dip galvanized structural column / purlin pipe',
    unit: 'Nos',
    defaultRate: 1850
  },
  {
    id: 'gi_pipe_40x40',
    category: 'structure',
    name: '40x40 GI Pipe (20 ft, 2mm thickness)',
    description: 'Hot-dip galvanized bracing / rafter pipe',
    unit: 'Nos',
    defaultRate: 1450
  },
  {
    id: 'anchor_fastener',
    category: 'structure',
    name: 'Anchor Fastener Bolts (M10/M12)',
    description: 'RCC rooftop heavy-duty foundation anchor bolts',
    unit: 'Nos',
    defaultRate: 45
  },
  {
    id: 'la_patti',
    category: 'structure',
    name: 'L-A Patti (Galvanized Clamping Plates)',
    description: 'Structure joinery and angle bracket fittings',
    unit: 'Nos',
    defaultRate: 85
  },
  {
    id: 'stud',
    category: 'structure',
    name: 'Structural Threaded Stud',
    description: 'High-tensile zinc plated connection stud',
    unit: 'Nos',
    defaultRate: 65
  },
  {
    id: 'nut_bolts_washers',
    category: 'structure',
    name: 'SS/GI Nut & Washer Sets (Grade 8.8)',
    description: 'Nut + Spring Washer + Flat Washer set',
    unit: 'Sets',
    defaultRate: 15
  },
  {
    id: 'zinc_spray',
    category: 'structure',
    name: 'Cold Galvanizing Zinc Spray Can',
    description: 'Anti-rust protective weld & cut coating (400ml)',
    unit: 'Can',
    defaultRate: 450
  },

  // 2. Electrical Protection & Switchgear
  {
    id: 'acdb_dcdb_combo',
    category: 'electrical',
    name: 'ACDB + DCDB Combo Box (IP65)',
    description: 'Enclosure with Type-II SPD, MCB/MCCB, and fuse disconnectors',
    unit: 'Nos',
    defaultRate: 3600
  },
  {
    id: 'earthing_kit',
    category: 'electrical',
    name: 'Chemical Earthing Kit (Electrode + BFC Compound)',
    description: 'Maintenance-free copper-bonded electrode kit (2-3 meter)',
    unit: 'Set',
    defaultRate: 2200
  },
  {
    id: 'mc4_connectors',
    category: 'electrical',
    name: 'MC4 Solar Connectors (Pair M+F)',
    description: 'IP68 1000V/1500V UV-resistant solar module string connectors',
    unit: 'Pairs',
    defaultRate: 75
  },

  // 3. Cables & Wires
  {
    id: 'dc_wire_4sqmm',
    category: 'cables',
    name: 'DC Solar Cable 4 sq mm (Red + Black)',
    description: 'TUV / EN 50618 certified XLPO UV/Ozone resistant dual cable',
    unit: 'Meter',
    defaultRate: 48
  },
  {
    id: 'ac_wire_4sqmm',
    category: 'cables',
    name: 'AC Grid Copper Cable 4 sq mm (Red + Black)',
    description: 'FRLS ISI certified copper conductor cable for inverter to ACDB',
    unit: 'Meter',
    defaultRate: 62
  },
  {
    id: 'earthing_wire_4sqmm',
    category: 'cables',
    name: 'Earthing Wire 4 sq mm (Green)',
    description: 'Multi-strand flexible copper grounding conductor',
    unit: 'Meter',
    defaultRate: 32
  },
  {
    id: 'la_cable_16sqmm',
    category: 'cables',
    name: 'Lightning Arrester (LA) Cable 16 sq mm',
    description: 'High-current copper / GI down conductor for lightning protection',
    unit: 'Meter',
    defaultRate: 88
  },

  // 4. Conduits, Piping & Accessories
  {
    id: 'pvc_conduit_pipe',
    category: 'conduits',
    name: 'PVC Conduit Pipe (10 ft, 25mm Heavy)',
    description: 'UV-stabilized rigid PVC cable management conduits',
    unit: 'Nos',
    defaultRate: 95
  },
  {
    id: 'pvc_elbow',
    category: 'conduits',
    name: 'PVC Conduit Elbows (25mm)',
    description: '90-degree smooth curve conduit bends',
    unit: 'Nos',
    defaultRate: 15
  },
  {
    id: 'pvc_tee',
    category: 'conduits',
    name: 'PVC Conduit Tees (25mm)',
    description: '3-way inspection tee junction fittings',
    unit: 'Nos',
    defaultRate: 20
  },
  {
    id: 'cable_ties_pack',
    category: 'conduits',
    name: 'UV Resistant Cable Ties (Pack of 100)',
    description: '300mm heavy-duty nylon solar cable ties',
    unit: 'Pack',
    defaultRate: 140
  },
  {
    id: 'saddle_clips_pack',
    category: 'conduits',
    name: 'Saddle Pipe Clamps (Pack of 100)',
    description: 'GI/PVC conduit wall & rooftop mounting saddles with screws',
    unit: 'Pack',
    defaultRate: 160
  }
];

// Baseline Sizing & Quantity Matrix per Standard Capacity (kW)
export const DEFAULT_CAPACITY_BOM = {
  '2.2': {
    capacityKW: 2.2,
    moduleCount: 4,
    structureHeight: '6/8 Standard',
    items: {
      gi_pipe_60x40: 2,
      gi_pipe_40x40: 2,
      anchor_fastener: 6,
      la_patti: 3,
      stud: 1,
      nut_bolts_washers: 8,
      zinc_spray: 1,
      acdb_dcdb_combo: 1,
      earthing_kit: 1,
      mc4_connectors: 2,
      dc_wire_4sqmm: 40,
      ac_wire_4sqmm: 10,
      earthing_wire_4sqmm: 25,
      la_cable_16sqmm: 25,
      pvc_conduit_pipe: 9,
      pvc_elbow: 10,
      pvc_tee: 4,
      cable_ties_pack: 1,
      saddle_clips_pack: 1
    }
  },
  '3.3': {
    // Exact specification from "bom calculaiton.docx"
    capacityKW: 3.3,
    moduleCount: 6,
    structureHeight: '6/8 Standard (6ft front, 8ft rear)',
    items: {
      gi_pipe_60x40: 3,
      gi_pipe_40x40: 3,
      anchor_fastener: 8,
      la_patti: 4,
      stud: 1,
      nut_bolts_washers: 10,
      zinc_spray: 1,
      acdb_dcdb_combo: 1,
      earthing_kit: 1,
      mc4_connectors: 2,
      dc_wire_4sqmm: 50,
      ac_wire_4sqmm: 10,
      earthing_wire_4sqmm: 35,
      la_cable_16sqmm: 30,
      pvc_conduit_pipe: 12,
      pvc_elbow: 15,
      pvc_tee: 5,
      cable_ties_pack: 1,
      saddle_clips_pack: 1
    }
  },
  '4.4': {
    capacityKW: 4.4,
    moduleCount: 8,
    structureHeight: '6/8 Standard',
    items: {
      gi_pipe_60x40: 4,
      gi_pipe_40x40: 4,
      anchor_fastener: 10,
      la_patti: 5,
      stud: 2,
      nut_bolts_washers: 14,
      zinc_spray: 1,
      acdb_dcdb_combo: 1,
      earthing_kit: 2,
      mc4_connectors: 2,
      dc_wire_4sqmm: 60,
      ac_wire_4sqmm: 15,
      earthing_wire_4sqmm: 40,
      la_cable_16sqmm: 35,
      pvc_conduit_pipe: 15,
      pvc_elbow: 18,
      pvc_tee: 6,
      cable_ties_pack: 2,
      saddle_clips_pack: 1
    }
  },
  '5.5': {
    capacityKW: 5.5,
    moduleCount: 10,
    structureHeight: '6/8 Standard',
    items: {
      gi_pipe_60x40: 5,
      gi_pipe_40x40: 5,
      anchor_fastener: 12,
      la_patti: 6,
      stud: 2,
      nut_bolts_washers: 18,
      zinc_spray: 2,
      acdb_dcdb_combo: 1,
      earthing_kit: 2,
      mc4_connectors: 4,
      dc_wire_4sqmm: 75,
      ac_wire_4sqmm: 20,
      earthing_wire_4sqmm: 45,
      la_cable_16sqmm: 35,
      pvc_conduit_pipe: 18,
      pvc_elbow: 22,
      pvc_tee: 8,
      cable_ties_pack: 2,
      saddle_clips_pack: 2
    }
  },
  '6.6': {
    capacityKW: 6.6,
    moduleCount: 12,
    structureHeight: '6/8 Standard',
    items: {
      gi_pipe_60x40: 6,
      gi_pipe_40x40: 6,
      anchor_fastener: 14,
      la_patti: 8,
      stud: 2,
      nut_bolts_washers: 22,
      zinc_spray: 2,
      acdb_dcdb_combo: 1,
      earthing_kit: 2,
      mc4_connectors: 4,
      dc_wire_4sqmm: 90,
      ac_wire_4sqmm: 25,
      earthing_wire_4sqmm: 50,
      la_cable_16sqmm: 40,
      pvc_conduit_pipe: 22,
      pvc_elbow: 25,
      pvc_tee: 10,
      cable_ties_pack: 2,
      saddle_clips_pack: 2
    }
  },
  '8.0': {
    capacityKW: 8.0,
    moduleCount: 15,
    structureHeight: '6/8 Standard',
    items: {
      gi_pipe_60x40: 8,
      gi_pipe_40x40: 8,
      anchor_fastener: 18,
      la_patti: 10,
      stud: 3,
      nut_bolts_washers: 28,
      zinc_spray: 2,
      acdb_dcdb_combo: 1,
      earthing_kit: 3,
      mc4_connectors: 4,
      dc_wire_4sqmm: 110,
      ac_wire_4sqmm: 30,
      earthing_wire_4sqmm: 60,
      la_cable_16sqmm: 45,
      pvc_conduit_pipe: 26,
      pvc_elbow: 30,
      pvc_tee: 12,
      cable_ties_pack: 3,
      saddle_clips_pack: 2
    }
  },
  '10.0': {
    capacityKW: 10.0,
    moduleCount: 18,
    structureHeight: '6/8 Standard',
    items: {
      gi_pipe_60x40: 10,
      gi_pipe_40x40: 10,
      anchor_fastener: 24,
      la_patti: 12,
      stud: 4,
      nut_bolts_washers: 36,
      zinc_spray: 3,
      acdb_dcdb_combo: 1,
      earthing_kit: 3,
      mc4_connectors: 6,
      dc_wire_4sqmm: 130,
      ac_wire_4sqmm: 35,
      earthing_wire_4sqmm: 70,
      la_cable_16sqmm: 50,
      pvc_conduit_pipe: 32,
      pvc_elbow: 36,
      pvc_tee: 15,
      cable_ties_pack: 3,
      saddle_clips_pack: 3
    }
  }
};

/**
 * Resolves the BOM item list and total costing for any arbitrary capacity (kW).
 * If exact capacity exists in matrix, uses explicit preset.
 * Otherwise interpolates/extrapolates based on kW scaling.
 */
export function resolveCapacityBom(capacityKW, customMatrix = DEFAULT_CAPACITY_BOM, customRates = {}) {
  const kw = parseFloat(capacityKW) || 3.3;
  const kwKey = kw.toFixed(1);
  const preset = customMatrix[kwKey] || customMatrix['3.3'];

  // Ratio scaling if custom capacity
  const ratio = kw / (preset?.capacityKW || 3.3);

  const resolvedItems = STANDARD_BOM_CATALOG.map((catItem) => {
    const baseQty = preset?.items?.[catItem.id] ?? 0;
    const finalQty = customMatrix[kwKey]
      ? baseQty
      : Math.max(1, Math.round(baseQty * ratio));
    const unitRate = customRates[catItem.id] ?? catItem.defaultRate;
    const totalAmount = finalQty * unitRate;

    return {
      ...catItem,
      quantity: finalQty,
      unitRate,
      totalAmount
    };
  });

  const categoryTotals = STANDARD_BOM_CATEGORIES.map((cat) => {
    const items = resolvedItems.filter((i) => i.category === cat.id);
    const sum = items.reduce((acc, i) => acc + i.totalAmount, 0);
    return {
      ...cat,
      items,
      total: sum
    };
  });

  const totalBoSCost = resolvedItems.reduce((acc, i) => acc + i.totalAmount, 0);

  return {
    capacityKW: kw,
    structureHeight: preset?.structureHeight || '6/8 Standard',
    items: resolvedItems,
    categoryTotals,
    totalBoSCost
  };
}

// =====================================================================
// SUNVINE FIELD BOM ENGINE (EXACT MATCH FOR GUJARAT ROOFTOP EXCEL FORMAT)
// 5% GST on Solar Panels & Inverters, 18% GST on all BOS & Materials
// =====================================================================

export const FIELD_BOM_MASTER_CATALOG = [
  { id: 'gi_pipe_40x40', name: '40*40 Hot Dip GI Pipe', category: 'structure', unit: 'NOS', defaultRate: 1420, gstRate: 18 },
  { id: 'gi_pipe_60x40', name: '60*40 Hot Dip GI Pipe', category: 'structure', unit: 'NOS', defaultRate: 1785, gstRate: 18 },
  { id: 'stud_12x2m', name: 'STUD 12*2MTR (Threaded Stud)', category: 'structure', unit: 'NOS', defaultRate: 140, gstRate: 18 },
  { id: 'ms_angels', name: 'MS Angles (Structural Bracing)', category: 'structure', unit: 'NOS', defaultRate: 35, gstRate: 18 },
  { id: 'fastner', name: 'Fastener Anchor Bolts (M10/M12)', category: 'structure', unit: 'NOS', defaultRate: 15, gstRate: 18 },
  { id: 'ms_j_bolt', name: 'MS J-Bolt (40*40)', category: 'structure', unit: 'NOS', defaultRate: 15, gstRate: 18 },
  { id: 'mc4_connector', name: 'MC4 Solar Connectors (M+F Pair)', category: 'electrical', unit: 'NOS', defaultRate: 35, gstRate: 5 },
  { id: 'pvc_pipe_25mm', name: '25mm Heavy PVC Conduit Pipe', category: 'conduits', unit: 'NOS', defaultRate: 45, gstRate: 18 },
  { id: 'pvc_tee_25mm', name: 'PVC Tee 25mm Polycab', category: 'conduits', unit: 'PSC', defaultRate: 5, gstRate: 18 },
  { id: 'pvc_elbow_25mm', name: 'PVC Elbow 25mm Polycab', category: 'conduits', unit: 'PSC', defaultRate: 6, gstRate: 18 },
  { id: 'shadel_clamp', name: 'Shadel / Saddle Clamps', category: 'conduits', unit: 'PKT', defaultRate: 120, gstRate: 18 },
  { id: 'acdb_dcdb_combo', name: 'ASG ACDB / DCDB Combo (1kW - 6kW)', category: 'electrical', unit: 'SET', defaultRate: 1650, gstRate: 18 },
  { id: 'dc_wire_4sqmm', name: 'DC 4 Sq.mm 1-Core Red/Black (EN Type)', category: 'cables', unit: 'MTR', defaultRate: 60, gstRate: 18 },
  { id: 'ac_wire_4sqmm', name: 'AC Cable 4 Sq.mm Copper (Red/Black)', category: 'cables', unit: 'MTR', defaultRate: 58, gstRate: 18 },
  { id: 'la_cable', name: 'LA Cable 1-Core 16 Sq.mm (Down Conductor)', category: 'cables', unit: 'MTR', defaultRate: 20, gstRate: 18 },
  { id: 'earthing_cable', name: 'Earthing Cable 4 Sq.mm (Reputed Make)', category: 'cables', unit: 'MTR', defaultRate: 35, gstRate: 18 },
  { id: 'earthing_kit', name: 'Chemical Earthing Kit (Electrode + BFC)', category: 'electrical', unit: 'NOS', defaultRate: 650, gstRate: 18 },
  { id: 'foundation_bag', name: 'RCC Foundation Bag / Grouting', category: 'structure', unit: 'NOS', defaultRate: 120, gstRate: 18 },
  { id: 'walkway', name: 'Rooftop Safety Walkway Set', category: 'structure', unit: 'SET', defaultRate: 420, gstRate: 18 },
  { id: 'zinc_spray', name: 'Zinc Spray Can (200ml Anti-Rust)', category: 'structure', unit: 'NOS', defaultRate: 140, gstRate: 18 },
  { id: 'nut_washer', name: 'SS Nut & Washers (Grade 8.8)', category: 'structure', unit: 'NOS', defaultRate: 2.50, gstRate: 18 },
  { id: 'transportation', name: 'Transportation & Doorstep Freight', category: 'logistics', unit: 'SET', defaultRate: 1000, gstRate: 0 }
];

export function generateFieldBOM({
  kw = 3.3,
  panelBrand = 'Waaree Energies',
  panelWatt = 540,
  panelQuantity = 6,
  ratePerWp = 18.00,
  inverterModel = 'Sunvine Solaryaan 5.0G',
  inverterPrice = 14400,
  customBomRates = {}
} = {}) {
  const safeRates = (customBomRates && typeof customBomRates === 'object') ? customBomRates : {};
  const panelPricePerPiece = Math.round(panelWatt * ratePerWp);
  
  // 1. Major Equipment (5% GST)
  const panelItem = {
    id: 'solar_panel',
    name: `SOLAR PANEL (${panelBrand.toUpperCase()} ${panelWatt}WP X ${panelQuantity} PANEL)`,
    category: 'panel',
    unit: 'NOS',
    qty: panelQuantity,
    rate: panelPricePerPiece,
    gstRate: 5,
    isMajorEquipment: true
  };

  const inverterItem = {
    id: 'solar_inverter',
    name: `SOLAR INVERTER (${inverterModel.toUpperCase()})`,
    category: 'inverter',
    unit: 'NOS',
    qty: 1,
    rate: Number(inverterPrice) || (kw <= 3.6 ? 14400 : kw <= 5.5 ? 24500 : 38000),
    gstRate: 5,
    isMajorEquipment: true
  };

  // 2. Standard Materials & BOS calibrated to panel count (MC4 = 5% GST, other BOS = 18% GST)
  const pCount = Math.max(1, panelQuantity);
  const bosItems = [
    { id: 'gi_pipe_40x40', name: '40*40 HOT DIP PIPE', category: 'structure', unit: 'NOS', qty: Math.max(2, Math.round(pCount * 0.5)), rate: safeRates.gi_pipe_40x40 || 1420, gstRate: 18 },
    { id: 'gi_pipe_60x40', name: '60*40 HOT DIP GIPIPE', category: 'structure', unit: 'NOS', qty: Math.max(2, Math.round(pCount * 0.67)), rate: safeRates.gi_pipe_60x40 || 1785, gstRate: 18 },
    { id: 'stud_12x2m', name: 'STUD 12*2MTR', category: 'structure', unit: 'NOS', qty: Math.max(1, Math.round(pCount * 0.33)), rate: safeRates.stud_12x2m || 140, gstRate: 18 },
    { id: 'ms_angels', name: 'MS ANGLES', category: 'structure', unit: 'NOS', qty: Math.max(4, Math.round(pCount * 1.33)), rate: safeRates.ms_angels || 35, gstRate: 18 },
    { id: 'fastner', name: 'ANCHOR FASTENER', category: 'structure', unit: 'NOS', qty: Math.max(8, Math.round(pCount * 2.67)), rate: safeRates.fastner || 15, gstRate: 18 },
    { id: 'ms_j_bolt', name: 'MS J-BOLT (40*40)', category: 'structure', unit: 'NOS', qty: Math.max(12, pCount * 4), rate: safeRates.ms_j_bolt || 15, gstRate: 18 },
    { id: 'mc4_connector', name: 'MC4 CONNECTOR', category: 'electrical', unit: 'NOS', qty: Math.max(2, Math.round(pCount * 0.33)), rate: safeRates.mc4_connector || 35, gstRate: 5 },
    { id: 'pvc_pipe_25mm', name: 'PVC PIPE 25MM', category: 'conduits', unit: 'NOS', qty: Math.max(6, Math.round(pCount * 1.67)), rate: safeRates.pvc_pipe_25mm || 45, gstRate: 18 },
    { id: 'pvc_tee_25mm', name: 'POLYCAB PVC TEE 25MM', category: 'conduits', unit: 'NOS', qty: Math.max(4, Math.round(pCount * 1.17)), rate: safeRates.pvc_tee_25mm || 5, gstRate: 18 },
    { id: 'pvc_elbow_25mm', name: 'POLYCAB PVC ELBOW 25MM', category: 'conduits', unit: 'NOS', qty: Math.max(12, Math.round(pCount * 4.17)), rate: safeRates.pvc_elbow_25mm || 6, gstRate: 18 },
    { id: 'shadel_clamp', name: 'SADDLE CLAMP', category: 'conduits', unit: 'PKT', qty: 1, rate: safeRates.shadel_clamp || 120, gstRate: 18 },
    { id: 'acdb_dcdb_combo', name: 'ASG ACDB-DCDB 1KW - 6KW', category: 'electrical', unit: 'SET', qty: 1, rate: safeRates.acdb_dcdb_combo || 1650, gstRate: 18 },
    { id: 'dc_wire_4sqmm', name: 'DC 4 SQMM 1 CORE RED/BLACK EN TYPE', category: 'cables', unit: 'MTR', qty: Math.max(30, Math.round(pCount * 8.33)), rate: safeRates.dc_wire_4sqmm || 60, gstRate: 18 },
    { id: 'ac_wire_4sqmm', name: 'AC CABLE 4SQ MM', category: 'cables', unit: 'MTR', qty: Math.max(10, Math.round(pCount * 1.67)), rate: safeRates.ac_wire_4sqmm || 58, gstRate: 18 },
    { id: 'la_cable', name: 'LA CABLE', category: 'cables', unit: 'MTR', qty: 25, rate: safeRates.la_cable || 20, gstRate: 18 },
    { id: 'earthing_cable', name: 'EARTHING CABLE 4SQ MM (REPUTED MAKE)', category: 'cables', unit: 'MTR', qty: Math.max(30, Math.round(pCount * 6.67)), rate: safeRates.earthing_cable || 35, gstRate: 18 },
    { id: 'earthing_kit', name: 'EARTHING KIT', category: 'electrical', unit: 'SET', qty: Math.max(1, kw > 5 ? 2 : 1), rate: safeRates.earthing_kit || 650, gstRate: 18 },
    { id: 'foundation_bag', name: 'FOUNDATION BAG', category: 'structure', unit: 'NOS', qty: Math.max(2, Math.round(pCount * 0.5)), rate: safeRates.foundation_bag || 120, gstRate: 18 },
    { id: 'walkway', name: 'WALKWAY', category: 'structure', unit: 'NOS', qty: 0, rate: safeRates.walkway || 420, gstRate: 18 },
    { id: 'zinc_spray', name: 'ZINC SPRAY (200ML)', category: 'structure', unit: 'NOS', qty: 1, rate: safeRates.zinc_spray || 140, gstRate: 18 },
    { id: 'nut_washer', name: 'NUT WASHER', category: 'structure', unit: 'NOS', qty: Math.max(16, pCount * 4), rate: safeRates.nut_washer || 2.50, gstRate: 18 },
    { id: 'transportation', name: 'TRANSPORTATION', category: 'logistics', unit: 'NOS', qty: 1, rate: safeRates.transportation || 1000, gstRate: 0 }
  ];

  return [
    ...bosItems.slice(0, 11),
    panelItem,
    bosItems[11], // ACDB
    inverterItem,
    ...bosItems.slice(12)
  ];
}

export function calculateFieldBOMTotals(items = []) {
  let subtotal5GstBase = 0;
  let gst5Total = 0;
  let subtotal18GstBase = 0;
  let gst18Total = 0;
  let transportTotal = 0;
  let grossTurnkeyCost = 0;

  const calculatedItems = (items || []).map((item, idx) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const gstRate = Number(item.gstRate !== undefined ? item.gstRate : 18);
    const baseAmount = Math.round(qty * rate);
    const gstAmount = Math.round(baseAmount * (gstRate / 100));
    const totalWithGst = baseAmount + gstAmount;

    if (gstRate === 5) {
      subtotal5GstBase += baseAmount;
      gst5Total += gstAmount;
    } else if (gstRate === 18) {
      subtotal18GstBase += baseAmount;
      gst18Total += gstAmount;
    } else {
      transportTotal += baseAmount;
    }

    grossTurnkeyCost += totalWithGst;

    return {
      ...item,
      srNo: idx + 1,
      qty,
      rate,
      gstRate,
      baseAmount,
      gstAmount,
      totalWithGst
    };
  });

  const totalGstAmount = gst5Total + gst18Total;
  const totalTaxableBase = subtotal5GstBase + subtotal18GstBase + transportTotal;

  return {
    calculatedItems,
    subtotal5GstBase,
    gst5Total,
    subtotal18GstBase,
    gst18Total,
    transportTotal,
    totalTaxableBase,
    totalGstAmount,
    grossTurnkeyCost
  };
}
