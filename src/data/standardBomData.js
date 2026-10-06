// Standard EPC Bill of Materials (BOM) Master Data & Calculation Engine
// Based on real Gujarat Rooftop Solar EPC Field Specifications (3.3 kW / 6-panel baseline)

export const STANDARD_BOM_CATEGORIES = [
  { id: 'structure', name: 'Mounting Structure & Hardware', icon: 'foundation' },
  { id: 'electrical', name: 'Electrical Protection & Switchgear', icon: 'electric_meter' },
  { id: 'cables', name: 'Solar & Grid Cabling', icon: 'cable' },
  { id: 'conduits', name: 'Piping, Conduits & Accessories', icon: 'plumbing' },
  { id: 'safety', name: 'Safety & Earthing', icon: 'shield' }
];

export const STANDARD_BOM_CATALOG = [
  // 1. Structure & Fasteners
  {
    id: 'gi_pipe_60x40',
    category: 'structure',
    name: 'GI PIPE 60X40',
    make: 'HINDUSTAN',
    description: 'Hot-dip galvanized structural pipe (60X40, 18 KW)',
    specs: '60X40, 18 KW',
    unit: 'Meter',
    defaultRate: 85,
    rate: 85,
    gstRate: 18
  },
  {
    id: 'gi_pipe_40x40',
    category: 'structure',
    name: 'GI PIPE 40X40',
    make: 'HINDUSTAN',
    description: 'Hot-dip galvanized structural pipe (40X40, 15 KW)',
    specs: '40X40, 15 KW',
    unit: 'Meter',
    defaultRate: 84,
    rate: 84,
    gstRate: 18
  },
  {
    id: 'stud',
    category: 'structure',
    name: 'STUD',
    make: 'STANDARD',
    description: '12*2MTR Structural Threaded Stud Grade 8.8',
    specs: '12*2MTR Threaded Stud',
    unit: 'Nos',
    defaultRate: 140,
    rate: 140,
    gstRate: 18
  },
  {
    id: 'nutt',
    category: 'structure',
    name: 'NUTT',
    make: 'STANDARD',
    description: 'SS 304 / Grade 8.8 Structural Nut',
    specs: 'Grade 8.8 / SS 304',
    unit: 'Nos',
    defaultRate: 2.5,
    rate: 2.5,
    gstRate: 18
  },
  {
    id: 'wiser',
    category: 'structure',
    name: 'WISER',
    make: 'STANDARD',
    description: 'SS 304 Flat & Spring Washer Set',
    specs: 'SS 304 / Grade 8.8',
    unit: 'Nos',
    defaultRate: 2.5,
    rate: 2.5,
    gstRate: 18
  },
  {
    id: 'zinc_spray',
    category: 'structure',
    name: 'ZINK SPRAY',
    make: 'STANDARD',
    description: 'Cold Galvanizing Anti-Rust Spray Can',
    specs: 'Anti-Rust Coating (200-400ml)',
    unit: 'Can',
    defaultRate: 130,
    rate: 130,
    gstRate: 18
  },
  {
    id: 'l_angle',
    category: 'structure',
    name: 'L - ANGLE',
    make: 'STANDARD',
    description: 'MS Galvanized Structural L-Angle Bracket',
    specs: 'MS Galvanized / LA Patti',
    unit: 'Nos',
    defaultRate: 32,
    rate: 32,
    gstRate: 18
  },
  {
    id: 'anchor_fasner',
    category: 'structure',
    name: 'ANCHOR FASNER',
    make: 'STANDARD',
    description: 'RCC Rooftop Heavy-Duty Anchor Fastener Bolt',
    specs: 'M10 / M12 RCC Heavy Duty',
    unit: 'Nos',
    defaultRate: 12,
    rate: 12,
    gstRate: 18
  },
  {
    id: 'j_bolt_40x40',
    category: 'structure',
    name: 'J BOLT (40X40)',
    make: 'STANDARD',
    description: 'HDGI J-Bolt for 40x40 pipe clamping',
    specs: '40x40 Pipe Clamp',
    unit: 'Nos',
    defaultRate: 15,
    rate: 15,
    gstRate: 18
  },
  {
    id: 'j_bolt_60x40',
    category: 'structure',
    name: 'J BOLT (60X40)',
    make: 'STANDARD',
    description: 'HDGI J-Bolt for 60x40 pipe clamping',
    specs: '60x40 Pipe Clamp',
    unit: 'Nos',
    defaultRate: 16,
    rate: 16,
    gstRate: 18
  },

  // 1.1 Monorail & Short Rail Components (Industrial Metal Sheet Roofs)
  {
    id: 'monorail_400mm',
    category: 'structure',
    name: 'ALUMINIUM MINI RAIL (400MM)',
    make: 'AL6063-T6',
    description: 'Extruded Aluminium 400mm Short Rail with EPDM backing channel',
    specs: '400mm Extruded AL 6063-T6',
    unit: 'Nos',
    defaultRate: 140,
    rate: 140,
    gstRate: 18
  },
  {
    id: 'epdm_gasket_pad',
    category: 'structure',
    name: 'EPDM WATERPROOFING PAD',
    make: 'STANDARD',
    description: 'High-density EPDM rubber waterproofing cushion pad for metal sheets',
    specs: 'EPDM Self-Adhesive',
    unit: 'Nos',
    defaultRate: 15,
    rate: 15,
    gstRate: 18
  },
  {
    id: 'self_drilling_screws',
    category: 'structure',
    name: 'SELF DRILLING SCREWS (EPDM)',
    make: 'CORROSHIELD / SS410',
    description: 'Bi-metal SS410 Self-Drilling Screws with Neoprene Washer',
    specs: 'SS 410 / Bi-metal with EPDM Washer',
    unit: 'Nos',
    defaultRate: 6.5,
    rate: 6.5,
    gstRate: 18
  },
  {
    id: 'mid_clamps',
    category: 'structure',
    name: 'ALUMINIUM MID CLAMP',
    make: 'AL6063-T6',
    description: 'Universal Rapid Mid Clamp with SS304 Allen Bolt & Spring Nut',
    specs: 'AL 6063-T6 + SS 304 Bolt',
    unit: 'Nos',
    defaultRate: 28,
    rate: 28,
    gstRate: 18
  },
  {
    id: 'end_clamps',
    category: 'structure',
    name: 'ALUMINIUM END CLAMP',
    make: 'AL6063-T6',
    description: 'Universal Rapid End Clamp with SS304 Allen Bolt & Spring Nut',
    specs: 'AL 6063-T6 + SS 304 Bolt (30/35/40mm)',
    unit: 'Nos',
    defaultRate: 28,
    rate: 28,
    gstRate: 18
  },

  // 2. Electrical Protection & Switchgear
  {
    id: 'acdb_dcdb_combo',
    category: 'electrical',
    name: 'ACDB+DCDB COMBO',
    make: 'POLYCAB+ WINSURGE',
    description: 'IP65 ACDB + DCDB Combo Box (1 Phase, 1 to 6 kW)',
    specs: '1 PHASE, 1 TO 6 KW',
    unit: 'Set',
    defaultRate: 1700,
    rate: 1700,
    gstRate: 18
  },
  {
    id: 'mc4_connector',
    category: 'electrical',
    name: 'MC4 CONNECTOR',
    make: 'SIBBAS',
    description: 'IP68 1000V/1500V Solar Connectors (M+F Pair)',
    specs: 'M+F Pair IP68',
    unit: 'Pair',
    defaultRate: 30,
    rate: 30,
    gstRate: 18
  },

  // 3. Cables & Wires
  {
    id: 'dc_cable_red',
    category: 'cables',
    name: 'DC CABLE RED',
    make: 'POLYCAB',
    description: 'TUV / EN 50618 DC Solar Cable 4 sq mm (Red)',
    specs: '4 sq mm Red (EN 50618)',
    unit: 'Meter',
    defaultRate: 60,
    rate: 60,
    gstRate: 18
  },
  {
    id: 'dc_cable_black',
    category: 'cables',
    name: 'DC CABLE BLACK',
    make: 'POLYCAB',
    description: 'TUV / EN 50618 DC Solar Cable 4 sq mm (Black)',
    specs: '4 sq mm Black (EN 50618)',
    unit: 'Meter',
    defaultRate: 60,
    rate: 60,
    gstRate: 18
  },
  {
    id: 'ac_cable_red',
    category: 'cables',
    name: 'AC CABLE RED',
    make: 'POLYCAB',
    description: 'FRLS Copper Conductor Grid Cable 4 sq mm (Red)',
    specs: '4 sq mm Red Copper',
    unit: 'Meter',
    defaultRate: 59,
    rate: 59,
    gstRate: 18
  },
  {
    id: 'ac_cable_black',
    category: 'cables',
    name: 'AC CABLE BLACK',
    make: 'POLYCAB',
    description: 'FRLS Copper Conductor Grid Cable 4 sq mm (Black)',
    specs: '4 sq mm Black Copper',
    unit: 'Meter',
    defaultRate: 59,
    rate: 59,
    gstRate: 18
  },
  {
    id: 'cable_tye',
    category: 'cables',
    name: 'CABLE TYE',
    make: 'STANDARD',
    description: 'UV Resistant Heavy-Duty Nylon Cable Ties (Pack of 100)',
    specs: 'Pack of 100 Nos UV Resistant',
    unit: 'Packet',
    defaultRate: 130,
    rate: 130,
    gstRate: 18
  },

  // 4. Safety & Earthing
  {
    id: 'earthing_kit',
    category: 'safety',
    name: 'EARTHING KIT',
    make: 'VASUNDHARA',
    description: 'Chemical Earthing Kit (Electrode + BFC Compound)',
    specs: 'Chemical Kit (IS 3043)',
    unit: 'Set',
    defaultRate: 650,
    rate: 650,
    gstRate: 18
  },
  {
    id: 'la_cable',
    category: 'safety',
    name: 'LA CABLE',
    make: 'STANDARD',
    description: 'Lightning Arrester Down Conductor 16 sq mm',
    specs: '16 sq mm Down Conductor',
    unit: 'Meter',
    defaultRate: 20,
    rate: 20,
    gstRate: 18
  },
  {
    id: 'earthing_cable',
    category: 'safety',
    name: 'EARTHING CABLE',
    make: 'STANDARD',
    description: 'Flexible Copper Grounding Conductor 4 sq mm',
    specs: '4 sq mm Copper Conductor',
    unit: 'Meter',
    defaultRate: 32,
    rate: 32,
    gstRate: 18
  },

  // 5. Conduits, Piping & Accessories
  {
    id: 'pvc_pipe',
    category: 'conduits',
    name: 'PVC PIPE',
    make: 'STANDARD',
    description: 'Rigid Heavy-Duty PVC Conduit Pipe 25mm',
    specs: '25mm Heavy Duty',
    unit: 'Meter',
    defaultRate: 47,
    rate: 47,
    gstRate: 18
  },
  {
    id: 'pvc_elbow',
    category: 'conduits',
    name: 'ELBOW',
    make: 'STANDARD',
    description: '25mm 90-Degree PVC Conduit Elbow Bends',
    specs: '25mm 90° Bend',
    unit: 'Nos',
    defaultRate: 5,
    rate: 5,
    gstRate: 18
  },
  {
    id: 'pvc_tee',
    category: 'conduits',
    name: 'TEE',
    make: 'STANDARD',
    description: '25mm 3-Way PVC Conduit Junction Tees',
    specs: '25mm 3-Way Tee',
    unit: 'Nos',
    defaultRate: 4.5,
    rate: 4.5,
    gstRate: 18
  },
  {
    id: 'saddle_clip',
    category: 'conduits',
    name: 'SADDLE CLIP',
    make: 'STANDARD',
    description: 'GI/PVC Conduit Pipe Mounting Saddle Clips (Pack of 100)',
    specs: 'Pack of 100 Nos',
    unit: 'Packet',
    defaultRate: 120,
    rate: 120,
    gstRate: 18
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
export function resolveCapacityBom(capacityKW, customMatrix = DEFAULT_CAPACITY_BOM, customRates = {}, customCatalog = null) {
  const kw = parseFloat(capacityKW) || 3.3;
  const kwKey = kw.toFixed(1);
  const preset = customMatrix[kwKey] || customMatrix['3.3'];

  // Ratio scaling if custom capacity
  const ratio = kw / (preset?.capacityKW || 3.3);

  const activeCatalog = (Array.isArray(customCatalog) && customCatalog.length > 0)
    ? customCatalog
    : STANDARD_BOM_CATALOG;

  const ID_ALIASES = {
    anchor_fastener: 'anchor_fasner',
    anchor_fasner: 'anchor_fastener',
    la_patti: 'l_angle',
    l_angle: 'la_patti',
    nut_bolts_washers: 'nutt',
    nutt: 'nut_bolts_washers',
    wiser: 'nut_bolts_washers',
    cable_ties_pack: 'cable_tye',
    cable_tye: 'cable_ties_pack',
    saddle_clips_pack: 'saddle_clip',
    saddle_clip: 'saddle_clips_pack',
    dc_wire_4sqmm: 'dc_cable_red',
    dc_cable_red: 'dc_wire_4sqmm',
    dc_cable_black: 'dc_wire_4sqmm',
    ac_wire_4sqmm: 'ac_cable_red',
    ac_cable_red: 'ac_wire_4sqmm',
    ac_cable_black: 'ac_wire_4sqmm',
    la_cable_16sqmm: 'la_cable',
    la_cable: 'la_cable_16sqmm',
    earthing_wire_4sqmm: 'earthing_cable',
    earthing_cable: 'earthing_wire_4sqmm',
    pvc_conduit_pipe: 'pvc_pipe',
    pvc_pipe: 'pvc_conduit_pipe',
    mc4_connectors: 'mc4_connector',
    mc4_connector: 'mc4_connectors'
  };

  const resolvedItems = activeCatalog.map((catItem) => {
    const altKey = ID_ALIASES[catItem.id];
    const hasDirectQty = preset?.items?.[catItem.id] !== undefined;
    const hasAltQty = altKey && preset?.items?.[altKey] !== undefined;
    const hasPresetQty = hasDirectQty || hasAltQty;
    
    const baseQty = hasDirectQty
      ? preset.items[catItem.id]
      : (hasAltQty ? preset.items[altKey] : (catItem.defaultQty || (catItem.category === 'structure' ? 2 : 1)));

    const finalQty = customMatrix[kwKey] && hasPresetQty
      ? baseQty
      : Math.max(1, Math.round(baseQty * ratio));
    const unitRate = customRates[catItem.id] ?? (catItem.defaultRate || catItem.rate || 100);
    const totalAmount = finalQty * unitRate;

    return {
      ...catItem,
      quantity: finalQty,
      unitRate,
      totalAmount
    };
  });

  const categoriesList = STANDARD_BOM_CATEGORIES;
  const categoryTotals = categoriesList.map((cat) => {
    const items = resolvedItems.filter((i) => i.category === cat.id);
    const sum = items.reduce((acc, i) => acc + i.totalAmount, 0);
    return {
      ...cat,
      items,
      total: sum
    };
  });

  // Also include any custom category items
  const standardCatIds = new Set(categoriesList.map(c => c.id));
  const customCategories = [];
  resolvedItems.forEach(it => {
    if (it.category && !standardCatIds.has(it.category)) {
      let existing = customCategories.find(c => c.id === it.category);
      if (!existing) {
        existing = {
          id: it.category,
          name: it.category.charAt(0).toUpperCase() + it.category.slice(1),
          icon: 'category',
          items: [],
          total: 0
        };
        customCategories.push(existing);
      }
      existing.items.push(it);
      existing.total += it.totalAmount;
    }
  });

  const totalBoSCost = resolvedItems.reduce((acc, i) => acc + i.totalAmount, 0);

  return {
    capacityKW: kw,
    structureHeight: preset?.structureHeight || '6/8 Standard',
    items: resolvedItems,
    categoryTotals: [...categoryTotals, ...customCategories],
    totalBoSCost
  };
}

// =====================================================================
// SUNVINE FIELD BOM ENGINE (EXACT MATCH FOR GUJARAT ROOFTOP EXCEL FORMAT)
// 5% GST on Solar Panels & Inverters, 18% GST on all BOS & Materials
// =====================================================================

export const FIELD_BOM_MASTER_CATALOG = [
  { id: 'gi_pipe_40x40', name: '40*40 Hot Dip GI Pipe', make: 'Fortune / Jindal (HDGI)', category: 'structure', unit: 'NOS', defaultRate: 1420, gstRate: 18 },
  { id: 'gi_pipe_60x40', name: '60*40 Hot Dip GI Pipe', make: 'Fortune / Jindal (HDGI)', category: 'structure', unit: 'NOS', defaultRate: 1785, gstRate: 18 },
  { id: 'stud_12x2m', name: 'STUD 12*2MTR (Threaded Stud)', make: 'Grade 8.8 / Reputed', category: 'structure', unit: 'NOS', defaultRate: 140, gstRate: 18 },
  { id: 'ms_angels', name: 'MS Angles (Structural Bracing)', make: 'Tata / Jindal', category: 'structure', unit: 'NOS', defaultRate: 35, gstRate: 18 },
  { id: 'fastner', name: 'Fastener Anchor Bolts (M10/M12)', make: 'Hilti / Fischer / Reputed', category: 'structure', unit: 'NOS', defaultRate: 15, gstRate: 18 },
  { id: 'ms_j_bolt', name: 'MS J-Bolt (40*40)', make: 'HDGI Standard', category: 'structure', unit: 'NOS', defaultRate: 15, gstRate: 18 },
  { id: 'mc4_connector', name: 'MC4 Solar Connectors (M+F Pair)', make: 'Staubli / Multi-Contact', category: 'electrical', unit: 'NOS', defaultRate: 35, gstRate: 5 },
  { id: 'pvc_pipe_25mm', name: '25mm Heavy PVC Conduit Pipe', make: 'Polycab / Precision', category: 'conduits', unit: 'NOS', defaultRate: 45, gstRate: 18 },
  { id: 'pvc_tee_25mm', name: 'PVC Tee 25mm Polycab', make: 'Polycab', category: 'conduits', unit: 'PSC', defaultRate: 5, gstRate: 18 },
  { id: 'pvc_elbow_25mm', name: 'PVC Elbow 25mm Polycab', make: 'Polycab', category: 'conduits', unit: 'PSC', defaultRate: 6, gstRate: 18 },
  { id: 'shadel_clamp', name: 'Shadel / Saddle Clamps', make: 'Heavy Duty GI', category: 'conduits', unit: 'PKT', defaultRate: 120, gstRate: 18 },
  { id: 'acdb_dcdb_combo', name: 'ASG ACDB / DCDB Combo (1kW - 6kW)', make: 'ASG / L&T / Schneider', category: 'electrical', unit: 'SET', defaultRate: 1650, gstRate: 18 },
  { id: 'dc_wire_4sqmm', name: 'DC 4 Sq.mm 1-Core Red/Black (EN Type)', make: 'Polycab / RR Kabel (EN 50618)', category: 'cables', unit: 'MTR', defaultRate: 60, gstRate: 18 },
  { id: 'ac_wire_4sqmm', name: 'AC Cable 4 Sq.mm Copper (Red/Black)', make: 'Polycab / Havells / RR Kabel', category: 'cables', unit: 'MTR', defaultRate: 58, gstRate: 18 },
  { id: 'la_cable', name: 'LA Cable 1-Core 16 Sq.mm (Down Conductor)', make: 'Polycab / Vasundhara (ISI)', category: 'cables', unit: 'MTR', defaultRate: 20, gstRate: 18 },
  { id: 'earthing_cable', name: 'Earthing Cable 4 Sq.mm (Reputed Make)', make: 'Polycab / RR Kabel', category: 'cables', unit: 'MTR', defaultRate: 35, gstRate: 18 },
  { id: 'earthing_kit', name: 'Chemical Earthing Kit (Electrode + BFC)', make: 'Vasundhara / Chemical Gel (IS 3043)', category: 'electrical', unit: 'NOS', defaultRate: 650, gstRate: 18 },
  { id: 'foundation_bag', name: 'RCC Foundation Bag / Grouting', make: 'UltraTech / Standard', category: 'structure', unit: 'NOS', defaultRate: 120, gstRate: 18 },
  { id: 'walkway', name: 'Rooftop Safety Walkway Set', make: 'Sunvine / FRP Heavy Duty', category: 'structure', unit: 'SET', defaultRate: 420, gstRate: 18 },
  { id: 'zinc_spray', name: 'Zinc Spray Can (200ml Anti-Rust)', make: '3M / Rust-Oleum', category: 'structure', unit: 'NOS', defaultRate: 140, gstRate: 18 },
  { id: 'nut_washer', name: 'SS Nut & Washers (Grade 8.8)', make: 'SS 304 / Grade 8.8', category: 'structure', unit: 'NOS', defaultRate: 2.50, gstRate: 18 },
  { id: 'transportation', name: 'Transportation & Doorstep Freight', make: 'Doorstep Insured Logistics', category: 'logistics', unit: 'SET', defaultRate: 1000, gstRate: 0 }
];

export function generateFieldBOM({
  kw = 3.3,
  panelBrand = 'Waaree Energies',
  panelWatt = 540,
  panelQuantity = 6,
  ratePerWp = 18.00,
  inverterBrand = 'Sunvine Solaryaan',
  inverterCapacityKw = 3.3,
  inverterQuantity = 1,
  inverterModel = 'Sunvine Solaryaan 5.0G',
  inverterPrice = 14400,
  structureType = 'standard_hdgi', // 'standard_hdgi' | 'monorail' | 'hybrid'
  monorailRatio = 0.5, // 0.0 to 1.0 (for hybrid split)
  transportCharge = 1000,
  installationRatePerKw = 2000,
  installationPricingMode = 'per_kw',
  installationFixedAmount = 0,
  customBomRates = {},
  customCatalog = null
} = {}) {
  const safeRates = (customBomRates && typeof customBomRates === 'object') ? customBomRates : {};
  const panelPricePerPiece = Math.round(panelWatt * ratePerWp);
  const pCount = Math.max(1, panelQuantity);
  
  // 1. Major Equipment (5% GST)
  const panelItem = {
    id: 'solar_panel',
    name: `SOLAR PANEL (${panelBrand.toUpperCase()} ${panelWatt}WP X ${panelQuantity} PANEL)`,
    make: panelBrand ? `${panelBrand} / Tier-1` : 'Waaree Energies / Tier-1',
    category: 'panel',
    unit: 'Nos',
    qty: panelQuantity,
    rate: panelPricePerPiece,
    gstRate: 5,
    isMajorEquipment: true
  };

  const invQty = Number(inverterQuantity) || 1;
  const invRate = Number(inverterPrice) || (kw <= 3.6 ? 14400 : kw <= 5.5 ? 24500 : 38000);
  const invTotal = invQty * invRate;

  const inverterItem = {
    id: 'solar_inverter',
    name: `SOLAR INVERTER (${(inverterBrand || inverterModel).toUpperCase()} ${inverterCapacityKw || kw}KW)`,
    make: inverterBrand || inverterModel || 'Sunvine Solaryaan',
    category: 'inverter',
    unit: 'Nos',
    qty: invQty,
    rate: invRate,
    total: invTotal,
    totalWithGst: Math.round(invTotal * 1.05),
    gstRate: 5,
    isMajorEquipment: true
  };

  const catalog = (Array.isArray(customCatalog) && customCatalog.length > 0)
    ? customCatalog
    : STANDARD_BOM_CATALOG;

  // Structure weighting
  const isMonorail = structureType === 'monorail';
  const isHybrid = structureType === 'hybrid';
  const monoFrac = isMonorail ? 1.0 : (isHybrid ? Math.max(0.1, Math.min(0.9, Number(monorailRatio) || 0.5)) : 0.0);
  const hdgiFrac = 1.0 - monoFrac;

  // Dynamic Quantity Calculation per BOM Item ID / Category
  const getDynamicQty = (item) => {
    const id = item.id;

    // Standard HDGI Items
    if (id === 'gi_pipe_60x40') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(1, Math.round(pCount * 0.67 * hdgiFrac));
    }
    if (id === 'gi_pipe_40x40') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(1, Math.round(pCount * 0.5 * hdgiFrac));
    }
    if (id === 'stud' || id === 'stud_12x2m') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(1, Math.round(pCount * 0.33 * hdgiFrac));
    }
    if (id === 'nutt' || id === 'nut_washer' || id === 'nut_bolts_washers') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(8, Math.round(pCount * 4 * hdgiFrac));
    }
    if (id === 'wiser') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(8, Math.round(pCount * 4 * hdgiFrac));
    }
    if (id === 'zinc_spray') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(1, Math.round(pCount * 0.2 * hdgiFrac));
    }
    if (id === 'l_angle' || id === 'ms_angels' || id === 'la_patti') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(2, Math.round(pCount * 1.33 * hdgiFrac));
    }
    if (id === 'anchor_fasner' || id === 'fastner' || id === 'anchor_fastener') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(4, Math.round(pCount * 2.67 * hdgiFrac));
    }
    if (id === 'j_bolt_40x40' || id === 'ms_j_bolt') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(6, Math.round(pCount * 4 * hdgiFrac));
    }
    if (id === 'j_bolt_60x40') {
      if (monoFrac >= 0.99) return 0;
      return Math.max(6, Math.round(pCount * 4 * hdgiFrac));
    }

    // Monorail & Short Rail Items
    if (id === 'monorail_400mm') {
      if (monoFrac <= 0.01) return 0;
      return Math.max(2, Math.round(pCount * 2.2 * monoFrac));
    }
    if (id === 'epdm_gasket_pad') {
      if (monoFrac <= 0.01) return 0;
      return Math.max(2, Math.round(pCount * 2.2 * monoFrac));
    }
    if (id === 'self_drilling_screws') {
      if (monoFrac <= 0.01) return 0;
      return Math.max(8, Math.round(pCount * 8 * monoFrac));
    }
    if (id === 'mid_clamps') {
      if (monoFrac <= 0.01) return 0;
      return Math.max(2, Math.round((pCount - 1) * 2 * monoFrac));
    }
    if (id === 'end_clamps') {
      if (monoFrac <= 0.01) return 0;
      return Math.max(2, Math.round(4 * monoFrac));
    }

    // Electrical, Cables & Balance of System
    if (id === 'acdb_dcdb_combo') return 1;
    if (id === 'mc4_connector' || id === 'mc4_connectors') return Math.max(2, Math.round(pCount * 0.33));
    if (id === 'dc_cable_red' || id === 'dc_wire_4sqmm') return Math.max(30, Math.round(pCount * 8.33));
    if (id === 'dc_cable_black') return Math.max(30, Math.round(pCount * 8.33));
    if (id === 'ac_cable_red' || id === 'ac_wire_4sqmm') return Math.max(10, Math.round(pCount * 1.67));
    if (id === 'ac_cable_black') return Math.max(10, Math.round(pCount * 1.67));
    if (id === 'cable_tye' || id === 'cable_ties_pack') return 1;
    if (id === 'earthing_kit') return Math.max(1, kw > 5 ? 2 : 1);
    if (id === 'la_cable' || id === 'la_cable_16sqmm') return 25;
    if (id === 'earthing_cable' || id === 'earthing_wire_4sqmm') return Math.max(30, Math.round(pCount * 6.67));
    if (id === 'pvc_pipe' || id === 'pvc_conduit_pipe' || id === 'pvc_pipe_25mm') return Math.max(6, Math.round(pCount * 1.67));
    if (id === 'pvc_elbow' || id === 'pvc_elbow_25mm') return Math.max(12, Math.round(pCount * 4.17));
    if (id === 'pvc_tee' || id === 'pvc_tee_25mm') return Math.max(4, Math.round(pCount * 1.17));
    if (id === 'saddle_clip' || id === 'shadel_clamp' || id === 'saddle_clips_pack') return 1;
    if (id === 'transportation') return 0; // handled via explicit transportationItem below
    if (id === 'turnkey_installation') return 0; // handled via explicit installationItem below
    
    // Category fallbacks
    if (item.category === 'structure') return Math.max(2, Math.round(pCount * 0.5));
    if (item.category === 'cables') return Math.max(10, Math.round(pCount * 2));
    if (item.category === 'conduits') return Math.max(4, Math.round(pCount));
    return 1;
  };

  const dynamicBosItems = catalog
    .filter(i => i.id !== 'transportation' && i.id !== 'turnkey_installation')
    .map(item => {
      const qty = getDynamicQty(item);
      if (qty <= 0) return null;

      const rate = (safeRates[item.id] !== undefined
        ? Number(safeRates[item.id])
        : (item.defaultRate !== undefined ? Number(item.defaultRate) : (Number(item.rate) || 0)));

      return {
        id: item.id,
        name: item.name,
        make: item.make || 'STANDARD',
        category: item.category || 'structure',
        unit: item.unit || 'Nos',
        qty,
        rate,
        gstRate: Number(item.gstRate !== undefined ? item.gstRate : 18),
        specs: item.specs || item.description || ''
      };
    })
    .filter(Boolean);

  const structureItems = dynamicBosItems.filter(i => i.category === 'structure');
  const otherBosItems = dynamicBosItems.filter(i => i.category !== 'structure');

  // Explicit Logistics Item (Doorstep Freight)
  const transportRate = Math.max(0, Number(transportCharge) || 0);
  const transportationItem = {
    id: 'transportation',
    name: transportRate > 0 ? 'Doorstep Freight & Safe Logistics' : 'Doorstep Freight (Dealer / Client Scope)',
    make: 'Doorstep Transit Logistics',
    category: 'logistics',
    unit: 'LOT',
    qty: 1,
    rate: transportRate,
    gstRate: 0,
    specs: transportRate === 1000 ? 'Rajkot Local Flat Tempo Freight' : (transportRate === 0 ? 'Dealer Scope / Self Vehicle' : 'Outstation Custom Transit Freight'),
    isLogistics: true
  };

  // Explicit Installation & Net-Metering Service Item
  const isFixedInstall = installationPricingMode === 'fixed' || installationPricingMode === 'amount';
  const installRate = Math.max(0, Number(installationRatePerKw) || 2000);
  const totalInstallBase = isFixedInstall
    ? Math.max(0, Number(installationFixedAmount) || 0)
    : Math.round((Number(kw) || 3.3) * installRate);
  
  const installationItem = {
    id: 'turnkey_installation',
    name: isFixedInstall
      ? `Installation Charge (Flat General Service Charge)`
      : `Installation Charge (${kw} kW @ ₹${installRate.toLocaleString('en-IN')}/kW)`,
    make: 'Sunvine Certified EPC Field Team',
    category: 'services',
    unit: 'JOB',
    qty: 1,
    rate: totalInstallBase,
    gstRate: 18,
    specs: structureType === 'monorail' ? 'Tin Shed Monorail Anchoring & Net-Metering' : (structureType === 'hybrid' ? 'Hybrid Structure Anchoring & Net-Metering' : 'RCC Elevated Structure Anchoring & Net-Metering'),
    isService: true
  };

  return [
    ...structureItems,
    panelItem,
    inverterItem,
    ...otherBosItems,
    transportationItem,
    installationItem
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
