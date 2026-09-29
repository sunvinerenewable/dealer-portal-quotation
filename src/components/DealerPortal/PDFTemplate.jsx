import React from 'react';
import { resolveCapacityBom, calculateFieldBOMTotals } from '../../data/standardBomData';

// Format Indian Rupee currency with commas
const formatINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(val);
};

export default function PDFTemplate({ quotation, activePage = 'all' }) {
  if (!quotation) return null;

  const {
    id = 'SV-2026-Q801',
    date = new Date().toLocaleDateString('en-GB'),
    customerName = 'Valued Customer',
    customerPhone = '',
    location = 'Rajkot, Gujarat',
    city = 'Rajkot',
    systemCapacityKW,
    capacityKW,
    capacity,
    solarModule = '585W TOPCon Bifacial',
    moduleWattage,
    moduleCount,
    pvModuleSize = '2278 × 1134 × 30 mm',
    inverterCapacity,
    inverterCount = '1 NOS',
    inverterType = 'Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)',
    baseRatePerKW = 59800,
    dealerMarginPerKW = 0,
    dealerName,
    isDirectCompanyQuote,
    projectType = 'Residential',
    multiBrandComparison = false,
    multiBrandPackages = null,
    selectedModuleMake = '',
    selectedInverterMake = '',
    coverImage,
    customCoverUrl,
    bomItems,
    bomTotals
  } = quotation;

  // Resolve numerical capacity and dimensions
  const resolvedCapKW = Number(parseFloat(systemCapacityKW || capacityKW || capacity || 3.3).toFixed(2));
  const rawWattMatch = (solarModule || '').match(/(\d{3})\s*W/i);
  const resolvedWatt = Number(moduleWattage || (rawWattMatch ? rawWattMatch[1] : 585));
  const resolvedCount = Number(moduleCount || Math.ceil((resolvedCapKW * 1000) / resolvedWatt) || 6);
  const resolvedArea = Math.round(resolvedCapKW * 64);

  const effectiveModuleMake = selectedModuleMake || (solarModule ? solarModule.split(' ')[0] : 'WAAREE');
  const effectiveInverterMake = selectedInverterMake || (inverterType ? inverterType.split(' ')[0] : 'SOLARYAAN');
  const resolvedInverterCap = inverterCapacity || `${resolvedCapKW} kW`;

  // Standard engineering BOM for this capacity
  const resolvedBom = resolveCapacityBom(resolvedCapKW);
  const bomQtyMap = (resolvedBom?.items || []).reduce((acc, i) => {
    acc[i.id] = i.quantity;
    return acc;
  }, {});

  // Commercial financial figures
  const customerRatePerKW = baseRatePerKW + (dealerMarginPerKW || 0);
  const grossTurnkey = quotation.grandTotalCustomer || quotation.totalAmount || Math.round(customerRatePerKW * resolvedCapKW);
  const baseBeforeGst = quotation.baseBeforeGst || Math.round(grossTurnkey / 1.138);
  const gstAmount = quotation.gstAmount || (grossTurnkey - baseBeforeGst);

  const subsidyAmount = quotation.subsidyAmount !== undefined 
    ? quotation.subsidyAmount 
    : (projectType === 'Commercial' ? 0 : (resolvedCapKW <= 1 ? 30000 : resolvedCapKW <= 2 ? 60000 : 78000));
  const netPayable = quotation.netPayable !== undefined ? quotation.netPayable : Math.max(0, grossTurnkey - subsidyAmount);

  // Line item breakdown
  const transportCharge = quotation.transportCharge || 2500;
  const installationCost = quotation.installationEstimatedCost || Math.round(resolvedCapKW * 2500);
  const moduleCost = quotation.moduleEstimatedCost || Math.round(resolvedWatt * resolvedCount * (quotation.ratePerWp || 18.00));
  const inverterCost = quotation.inverterEstimatedCost || Math.round(resolvedCapKW <= 3 ? 29800 : resolvedCapKW <= 5.5 ? 42000 : resolvedCapKW <= 7 ? 48500 : 72000);
  const structureCost = quotation.structureEstimatedCost || Math.round(resolvedCount * 3200);
  const bosCost = quotation.bosEstimatedCost || Math.max(0, baseBeforeGst - (moduleCost + inverterCost + structureCost + transportCharge + installationCost));

  // Telemetry metrics
  const annualGenUnits = quotation.annualGenerationUnits || Math.round(resolvedCapKW * 1440);
  const annualSavings = quotation.annualSavings || Math.round(annualGenUnits * 6.67);
  const paybackYears = quotation.paybackYears || (annualSavings > 0 ? (netPayable / annualSavings).toFixed(1) : '3.6');

  const resolvedCoverSrc = customCoverUrl || coverImage || '/mirana_page1_original.jpg';

  return (
    <div className="pdf-document font-sans text-[#0F1B2E] bg-white print:bg-white select-none">
      {/* ========================================================
          PAGE 1: DYNAMIC SUNVINE PROPOSAL COVER PAGE (SR-34)
          ======================================================== */}
      <div className={`pdf-page pdf-page-cover relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto bg-white border border-gray-300 shadow-xl print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!p-0 print:!h-[295mm] print:!max-h-[295mm] mb-8 overflow-hidden items-center justify-center box-border ${activePage === 'all' || activePage === 1 ? 'flex' : 'hidden print:flex'}`}>
        <img
          src={resolvedCoverSrc}
          alt="Sunvine Quotation Cover"
          className="w-full h-full object-cover block select-none"
        />
      </div>

      {/* ========================================================
          PAGE 2: EXECUTIVE COMMERCIAL PROPOSAL & SYSTEM SPECIFICATION
          ======================================================== */}
      <div className={`pdf-page pdf-page-content relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto p-8 flex flex-col justify-between bg-white border border-gray-300 shadow-xl print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!h-[295mm] print:!max-h-[295mm] mb-8 overflow-hidden box-border ${activePage === 'all' || activePage === 2 ? 'flex' : 'hidden print:flex'}`}>
        <div>
          {/* Top Header with Corporate Identity */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src="/sunvine_logo_transparent.png" alt="Sunvine" className="h-10 object-contain" />
              <div>
                <h1 className="text-lg font-black text-[#0B2545] tracking-tight uppercase leading-none">
                  SUNVINE RENEWABLE ENERGY
                </h1>
                <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                  ISO 9001:2015 &amp; MNRE Registered Solar EPC Channel Partner • Gujarat
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block bg-[#0B2545] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                REF: {id}
              </div>
              <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                Date: <strong className="text-gray-900">{date}</strong> | Validity: <strong>15 Days</strong>
              </p>
            </div>
          </div>

          {/* Color Gradient Accent Bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#2E7D32] via-[#6CBF3D] to-[#0B2545] my-2 rounded-full"></div>

          {/* Section: Project & Client Intelligence Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3 bg-[#F8FAFC] border border-slate-200 rounded-lg p-3">
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Client Information</div>
              <div className="text-xs font-black text-[#0B2545] uppercase mt-0.5">{customerName}</div>
              <div className="text-[11px] text-gray-700 mt-0.5">
                <span>Site: {location || `${city}, Gujarat`}</span>
                {customerPhone && <span className="ml-2 font-mono">| Tel: {customerPhone}</span>}
              </div>
              <div className="text-[10px] text-[#2E7D32] font-bold mt-0.5">
                Scheme: {projectType === 'Commercial' ? 'Commercial / Industrial Captive Solar' : 'PM Surya Ghar: Muft Bijli Yojana (Central DBT)'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">System Architecture</div>
              <div className="text-xs font-black text-[#0B2545] mt-0.5">
                {resolvedCapKW} kW On-Grid Solar PV Plant
              </div>
              <div className="text-[11px] text-gray-700 mt-0.5">
                {resolvedCount} Pcs × {resolvedWatt}W {effectiveModuleMake} TOPCon ({((resolvedCount * resolvedWatt)/1000).toFixed(2)} kWp)
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                Inverter: {inverterType.split('(')[0]?.trim() || inverterType} • Roof: ~{resolvedArea} Sq. Ft.
              </div>
            </div>
          </div>

          {/* Heading: Commercial Price Breakdown */}
          <div className="flex items-center justify-between my-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 bg-[#2E7D32] inline-block rounded-xs"></span>
              <h2 className="text-xs font-black text-[#0B2545] tracking-wide uppercase">
                ITEMIZED COMMERCIAL PROPOSAL &amp; STATUTORY TAX BREAKDOWN
              </h2>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold">All figures in Indian Rupees (INR)</span>
          </div>

          {/* TABLE: ITEM ITEMIZATION WITH GST & TRANSPORTATION */}
          <div className="overflow-hidden border border-slate-300 rounded-md mb-2 shadow-2xs">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-1.5 px-3 font-bold uppercase w-10 text-center border-r border-slate-700">SR</th>
                  <th className="py-1.5 px-3 font-bold uppercase border-r border-slate-700">DESCRIPTION OF SUPPLY &amp; TURNKEY SERVICES</th>
                  <th className="py-1.5 px-2 font-bold uppercase text-center w-20 border-r border-slate-700">HSN/SAC</th>
                  <th className="py-1.5 px-3 font-bold uppercase text-right w-28">TAXABLE (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-gray-900 font-medium">
                {/* Item 1 */}
                <tr className="bg-white">
                  <td className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-gray-500">1</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <span className="font-bold text-[#0B2545]">Tier-1 High-Efficiency Solar PV Modules &amp; On-Grid Inverter</span>
                    <p className="text-[10px] text-gray-600 leading-tight">
                      {resolvedCount} Nos × {resolvedWatt}W {effectiveModuleMake} Mono Bifacial Dual Glass Modules (ALMM List-I) + {inverterType.split('(')[0]?.trim()} with Built-in Cloud WiFi Monitoring.
                    </p>
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 text-[10px] font-mono text-gray-600">8541 / 8504</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">{formatINR(moduleCost + inverterCost)}</td>
                </tr>

                {/* Item 2 */}
                <tr className="bg-slate-50/50">
                  <td className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-gray-500">2</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <span className="font-bold text-[#0B2545]">Module Mounting Structure (MMS) &amp; Electrical BOS Hardware</span>
                    <p className="text-[10px] text-gray-600 leading-tight">
                      Elevated Hot-Dip Galvanized (80+ Micron) / Aluminium structure rated for 150 km/h wind speed, Polycab/RR UV-resistant DC/AC cabling, MC4 connectors, and IP65 ACDB/DCDB combo box.
                    </p>
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 text-[10px] font-mono text-gray-600">7308 / 8537</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">{formatINR(structureCost + bosCost)}</td>
                </tr>

                {/* Item 3 */}
                <tr className="bg-white">
                  <td className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-gray-500">3</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <span className="font-bold text-[#0B2545]">Safe Logistics, Freight, Packaging &amp; Transit Insurance</span>
                    <p className="text-[10px] text-gray-600 leading-tight">
                      Factory-to-site transportation, transit insurance protection against damage/theft, and doorstep unloading.
                    </p>
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 text-[10px] font-mono text-gray-600">9965</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">{formatINR(transportCharge)}</td>
                </tr>

                {/* Item 4 */}
                <tr className="bg-slate-50/50">
                  <td className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-gray-500">4</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <span className="font-bold text-[#0B2545]">Turnkey Civil &amp; Electrical Installation + DISCOM Net-Metering Liaisoning</span>
                    <p className="text-[10px] text-gray-600 leading-tight">
                      Array civil anchoring, electrical stringing, dual-chemical earthing pits (&lt;5Ω), DISCOM net-metering application, inspection coordination, and CEI safety compliance.
                    </p>
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 text-[10px] font-mono text-gray-600">9954</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">
                    {formatINR(installationCost + (quotation.dealerTotalMargin || quotation.dealerMargin || 0))}
                  </td>
                </tr>

                {/* Taxable Subtotal */}
                <tr className="bg-slate-100 font-bold text-gray-900 border-t border-slate-300">
                  <td colSpan={3} className="py-1.5 px-3 text-right uppercase tracking-wider text-[10px] border-r border-slate-300">
                    TOTAL TAXABLE VALUE (EXCLUDING GST) :
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold text-xs">{formatINR(baseBeforeGst)}</td>
                </tr>

                {/* Composite GST 13.8% */}
                <tr className="bg-emerald-50/40 text-emerald-950 font-bold border-t border-emerald-200">
                  <td colSpan={3} className="py-1.5 px-3 text-right text-[10px] border-r border-slate-300">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded uppercase">Statutory GST</span>
                      <span>COMPOSITE GST @ 13.8% (70% GOODS @ 12% + 30% SERVICES @ 18%) :</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold text-xs text-emerald-900">{formatINR(gstAmount)}</td>
                </tr>

                {/* Gross Turnkey Price */}
                <tr className="bg-[#0B2545] text-white font-black text-xs">
                  <td colSpan={3} className="py-2 px-3 text-right uppercase tracking-wider border-r border-slate-700">
                    GROSS TURNKEY PROJECT COST (INCLUSIVE OF ALL TAXES) :
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm font-black text-amber-300">{formatINR(grossTurnkey)}</td>
                </tr>

                {/* Subsidy Row */}
                {subsidyAmount > 0 && (
                  <tr className="bg-emerald-100/80 text-emerald-950 font-bold">
                    <td colSpan={3} className="py-1.5 px-3 text-right text-[10px] border-r border-emerald-300">
                      <span className="bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold mr-1.5">DBT BENEFIT</span>
                      LESS: PM SURYA GHAR MUFT BIJLI YOJANA CENTRAL SUBSIDY :
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-xs text-emerald-900">- {formatINR(subsidyAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Luxury Net Payable Highlight Banner */}
          <div className="bg-gradient-to-r from-[#1B5E20] via-[#2E7D32] to-[#1B5E20] text-white rounded-lg p-2.5 px-4 mb-3 flex items-center justify-between shadow-md">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Final Net Investment Post-Subsidy
              </div>
              <div className="text-xs font-semibold text-white/90">
                Direct bank reimbursement by Ministry of New &amp; Renewable Energy (MNRE)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-mono tracking-tight text-white">
                ₹ {formatINR(netPayable)}
              </span>
              <span className="bg-amber-400 text-slate-950 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded shadow-xs">
                Net Cost
              </span>
            </div>
          </div>

          {/* Key ROI & Energy Telemetry Badges */}
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-center">
              <div className="text-[10px] font-bold text-gray-500 uppercase">Est. Annual Generation</div>
              <div className="text-sm font-black text-[#0B2545] font-mono mt-0.5">
                ~{annualGenUnits.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-gray-600">Units/Yr</span>
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">4.0–4.2 units / kW / day average</div>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-center">
              <div className="text-[10px] font-bold text-gray-500 uppercase">Est. Annual Savings</div>
              <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">
                ₹ {formatINR(annualSavings)} <span className="text-[10px] font-normal text-gray-600">/ Year</span>
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">Calculated @ ₹6.67/unit benchmark</div>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-center">
              <div className="text-[10px] font-bold text-gray-500 uppercase">Estimated Payback</div>
              <div className="text-sm font-black text-[#0B2545] font-mono mt-0.5">
                {paybackYears} <span className="text-[10px] font-normal text-gray-600">Years</span>
              </div>
              <div className="text-[9px] text-emerald-700 font-bold mt-0.5">21+ Yrs Free Solar Electricity</div>
            </div>
          </div>

          {/* Official Bank Coordinates & Company Legal Identifiers */}
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-md p-2 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 mb-1">
              <span className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider">
                Official Banking Settlement Coordinates
              </span>
              <span className="text-[10px] font-mono text-gray-600">GSTIN: <strong>24AAMCS7145F1ZA</strong></span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-800">
              <div>
                <span className="text-gray-500 font-medium">Beneficiary:</span> <strong>SUNVINE RENEWABLE</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Bank:</span> <strong>HDFC BANK LTD.</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Branch:</span> <strong>METODA GIDC, RAJKOT</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">A/C No.:</span> <strong className="font-mono">99998000050580</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">IFSC:</span> <strong className="font-mono">HDFC0002012</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Email:</span> <strong>sunvinerenewable@gmail.com</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="text-[9px] text-gray-500 pt-1 border-t border-gray-200 flex items-center justify-between">
          <span>Sunvine Renewable Energy • Commercial Proposal • Ref: {id}</span>
          <span>Page 2 of 4</span>
        </div>
      </div>

      {/* ========================================================
          PAGE 3: ENGINEERING BILL OF MATERIALS (BOM) & COMPLIANCE
          ======================================================== */}
      <div className={`pdf-page pdf-page-content relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto p-8 flex flex-col justify-between bg-white border border-gray-300 shadow-xl print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!h-[295mm] print:!max-h-[295mm] mb-8 overflow-hidden box-border ${activePage === 'all' || activePage === 3 ? 'flex' : 'hidden print:flex'}`}>
        <div>
          {/* Top Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src="/sunvine_logo_transparent.png" alt="Sunvine" className="h-10 object-contain" />
              <div>
                <h1 className="text-lg font-black text-[#0B2545] tracking-tight uppercase leading-none">
                  BILL OF MATERIALS &amp; TECHNICAL STANDARDS
                </h1>
                <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                  MNRE Approved • ALMM List-I Tier-1 Components • BIS &amp; IEC Certified
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-[#0B2545] font-mono">{resolvedCapKW} kW System</div>
              <p className="text-[10px] text-gray-600 mt-0.5">Ref: {id}</p>
            </div>
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-[#2E7D32] via-[#6CBF3D] to-[#0B2545] my-2 rounded-full"></div>

          {/* ITEM BOM TABLE - Exact Gujarat Field Excel Standard */}
          {bomItems && Array.isArray(bomItems) && bomItems.length > 0 ? (
            <div className="overflow-hidden border border-slate-300 rounded-md mb-2 shadow-2xs">
              <table className="w-full text-[9px] text-left">
                <thead className="bg-[#0B2545] text-white font-bold">
                  <tr>
                    <th className="py-1 px-2 w-7 text-center border-r border-slate-700">SR</th>
                    <th className="py-1 px-2 border-r border-slate-700 min-w-[200px]">PRODUCT / SERVICE DESCRIPTION &amp; SPECIFICATION</th>
                    <th className="py-1 px-1.5 text-center w-12 border-r border-slate-700">QTY</th>
                    <th className="py-1 px-1.5 text-center w-12 border-r border-slate-700">UNIT</th>
                    <th className="py-1 px-2 text-right w-18 border-r border-slate-700">RATE (₹)</th>
                    <th className="py-1 px-1 text-center w-10 border-r border-slate-700">GST</th>
                    <th className="py-1 px-2 text-right w-20">TOTAL (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-gray-900 font-medium">
                  {bomItems.map((item, idx) => {
                    const itemName = item.name || item.item || item.description || `BOM Item #${idx + 1}`;
                    const gst = item.gstRate !== undefined ? item.gstRate : (item.taxRate !== undefined ? item.taxRate : 18);
                    const qty = Number(item.qty) || 0;
                    const rate = Number(item.rate) || 0;
                    const lineTotal = (item.totalWithGst !== undefined && item.totalWithGst > 0)
                      ? item.totalWithGst
                      : (item.total !== undefined && item.total > 0)
                        ? Math.round(item.total * (1 + gst / 100))
                        : Math.round(qty * rate * (1 + gst / 100));

                    return (
                      <tr key={item.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                        <td className="py-0.5 px-2 text-center text-gray-500 font-mono border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-0.5 px-2 border-r border-slate-200">
                          <span className="font-bold text-[#0B2545]">{itemName}</span>
                          {item.specs && <span className="text-[8px] text-gray-500 ml-1">({item.specs})</span>}
                        </td>
                        <td className="py-0.5 px-1.5 text-center font-mono font-bold border-r border-slate-200">
                          {qty}
                        </td>
                        <td className="py-0.5 px-1.5 text-center font-mono text-[8.5px] text-gray-600 border-r border-slate-200">
                          {item.unit || 'NOS'}
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono border-r border-slate-200">
                          {formatINR(rate)}
                        </td>
                        <td className="py-0.5 px-1 text-center border-r border-slate-200">
                          <span className={`px-1 py-0.2 rounded font-bold text-[8px] ${gst === 5 ? 'bg-emerald-100 text-emerald-800' : gst === 0 ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>
                            {gst}%
                          </span>
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono font-bold text-gray-900">
                          {formatINR(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Field BOM Subtotals Summary Rows */}
                  {(bomTotals || (bomItems && bomItems.length > 0 ? calculateFieldBOMTotals(bomItems) : null)) && (() => {
                    const effectiveTotals = bomTotals || calculateFieldBOMTotals(bomItems);
                    return (
                      <>
                        <tr className="bg-slate-100 font-bold text-gray-800 text-[8.5px] border-t border-slate-300">
                          <td colSpan={4} className="py-1 px-2 text-right border-r border-slate-300 uppercase">
                            SOLAR PV MODULES, INVERTER &amp; MC4 CONNECTORS (5% GST BASE: ₹{formatINR(effectiveTotals.subtotal5GstBase)} + TAX: ₹{formatINR(effectiveTotals.gst5Total)}) :
                          </td>
                          <td colSpan={3} className="py-1 px-2 text-right font-mono font-bold text-[#0B2545]">
                            ₹ {formatINR(effectiveTotals.subtotal5GstBase + effectiveTotals.gst5Total)}
                          </td>
                        </tr>
                        <tr className="bg-slate-100 font-bold text-gray-800 text-[8.5px]">
                          <td colSpan={4} className="py-1 px-2 text-right border-r border-slate-300 uppercase">
                            STRUCTURE &amp; BOS MATERIALS (18% GST BASE: ₹{formatINR(effectiveTotals.subtotal18GstBase)} + TAX: ₹{formatINR(effectiveTotals.gst18Total)}) :
                          </td>
                          <td colSpan={3} className="py-1 px-2 text-right font-mono font-bold text-[#0B2545]">
                            ₹ {formatINR(effectiveTotals.subtotal18GstBase + effectiveTotals.gst18Total)}
                          </td>
                        </tr>
                        {effectiveTotals.transportTotal > 0 && (
                          <tr className="bg-slate-100 font-bold text-gray-800 text-[8.5px]">
                            <td colSpan={4} className="py-1 px-2 text-right border-r border-slate-300 uppercase">
                              FREIGHT, PACKAGING &amp; TRANSIT LOGISTICS (0% GST BASE: ₹{formatINR(effectiveTotals.transportTotal)}) :
                            </td>
                            <td colSpan={3} className="py-1 px-2 text-right font-mono font-bold text-[#0B2545]">
                              ₹ {formatINR(effectiveTotals.transportTotal)}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-[#0B2545] text-white font-black text-[9.5px]">
                          <td colSpan={4} className="py-1 px-2 text-right uppercase tracking-wider border-r border-slate-700">
                            TOTAL ENGINEERING BILL OF MATERIALS (GROSS INCL. GST) :
                          </td>
                          <td colSpan={3} className="py-1 px-2 text-right font-mono text-xs font-black text-amber-300">
                            ₹ {formatINR(effectiveTotals.grossTurnkeyCost)}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-300 rounded-md mb-2 shadow-2xs">
              <table className="w-full text-[10.5px] text-left">
                <thead className="bg-[#0B2545] text-white">
                  <tr>
                    <th className="py-1 px-2.5 font-bold uppercase w-10 text-center border-r border-slate-700">SR</th>
                    <th className="py-1 px-3 font-bold uppercase border-r border-slate-700">EQUIPMENT &amp; MATERIAL DESCRIPTION</th>
                    <th className="py-1 px-2.5 font-bold uppercase text-center w-24 border-r border-slate-700">QTY</th>
                    <th className="py-1 px-2.5 font-bold uppercase text-center w-36">APPROVED MAKE / SPEC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-gray-900">
                  {/* 1. SOLAR MODULES */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="py-0.5 px-2.5 text-center border-r border-slate-300">1</td>
                    <td className="py-0.5 px-3 border-r border-slate-300 uppercase text-[#0B2545]">SOLAR PV MODULES (ALMM LIST-I COMPLIANT)</td>
                    <td className="py-0.5 px-2.5 border-r border-slate-300"></td>
                    <td className="py-0.5 px-2.5"></td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500">1.1</td>
                    <td className="py-1 px-3 border-r border-slate-200">
                      {solarModule || `${resolvedWatt}W TOPCon Mono Bifacial Panel`} (Dual-Glass, Multi-Busbar)
                    </td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-bold font-mono">{resolvedCount} Nos</td>
                    <td className="py-1 px-2.5 text-center font-bold text-[#0B2545]">{effectiveModuleMake} / Tier-1</td>
                  </tr>

                  {/* 2. INVERTER */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="py-0.5 px-2.5 text-center border-r border-slate-300">2</td>
                    <td className="py-0.5 px-3 border-r border-slate-300 uppercase text-[#0B2545]">SOLAR INVERTER &amp; TELEMETRY</td>
                    <td className="py-0.5 px-2.5 border-r border-slate-300"></td>
                    <td className="py-0.5 px-2.5"></td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500">2.1</td>
                    <td className="py-1 px-3 border-r border-slate-200">
                      High Efficiency String Inverter ({resolvedInverterCap}), Dual MPPT, IP65, Built-in WiFi Logger
                    </td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-bold font-mono">1 NOS</td>
                    <td className="py-1 px-2.5 text-center font-bold text-[#0B2545]">{effectiveInverterMake} / Any Reputed</td>
                  </tr>

                  {/* 3. STRUCTURE */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="py-0.5 px-2.5 text-center border-r border-slate-300">3</td>
                    <td className="py-0.5 px-3 border-r border-slate-300 uppercase text-[#0B2545]">MODULE MOUNTING STRUCTURE (MMS)</td>
                    <td className="py-0.5 px-2.5 border-r border-slate-300"></td>
                    <td className="py-0.5 px-2.5"></td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500">3.1</td>
                    <td className="py-1 px-3 border-r border-slate-200">Aluminium Channel Mono Rails, Mid &amp; End Clamps with EPDM Gaskets</td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono">{resolvedCount * 2 + 4} Sets</td>
                    <td className="py-1 px-2.5 text-center text-gray-700">Anodized 6063-T6</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500">3.2</td>
                    <td className="py-1 px-3 border-r border-slate-200">Hot-Dip Galvanized Iron (HDGI 80 Micron) Purlins &amp; Legs (60x40 / 40x40 2mm)</td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-[9.5px]">
                      {bomQtyMap['gi_pipe_60x40'] || 3} Pcs (60x40) + {bomQtyMap['gi_pipe_40x40'] || 3} Pcs (40x40)
                    </td>
                    <td className="py-1 px-2.5 text-center text-gray-700 text-[10px]">Fortune / Hindustar / Reputed</td>
                  </tr>

                  {/* 4. DC CABLES */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="py-0.5 px-2.5 text-center border-r border-slate-300">4</td>
                    <td className="py-0.5 px-3 border-r border-slate-300 uppercase text-[#0B2545]">DC SOLAR POWER CABLES</td>
                    <td className="py-0.5 px-2.5 border-r border-slate-300"></td>
                    <td className="py-0.5 px-2.5"></td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500">4.1</td>
                    <td className="py-1 px-3 border-r border-slate-200">1C × 4 sq.mm (Red/Black) UV &amp; Ozone Resistant Tinned Copper Solar Cable</td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono">{bomQtyMap['dc_wire_4sqmm'] || 50} Meters</td>
                    <td className="py-1 px-2.5 text-center font-bold text-[#0B2545]">Polycab / RR Kabel (EN 50618)</td>
                  </tr>

                  {/* 5. AC CABLES */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="py-0.5 px-2.5 text-center border-r border-slate-300">5</td>
                    <td className="py-0.5 px-3 border-r border-slate-300 uppercase text-[#0B2545]">AC GRID CABLING</td>
                    <td className="py-0.5 px-2.5 border-r border-slate-300"></td>
                    <td className="py-0.5 px-2.5"></td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500">5.1</td>
                    <td className="py-1 px-3 border-r border-slate-200">AC Grid Copper Armoured / Flexible Cable (4 sq.mm / 6 sq.mm)</td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono">{bomQtyMap['ac_wire_4sqmm'] || 10} Meters</td>
                    <td className="py-1 px-2.5 text-center font-bold text-[#0B2545]">Polycab / Havells / RR Kabel</td>
                  </tr>

                  {/* 6. SWITCHGEAR */}
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500 font-bold">6</td>
                    <td className="py-1 px-3 border-r border-slate-200 font-bold text-[#0B2545]">
                      ACDB + DCDB Array Protection Combo Box (Type-II SPD, MCB &amp; Isolator)
                    </td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono font-bold">1 Combo Unit</td>
                    <td className="py-1 px-2.5 text-center text-gray-800 text-[10px] font-bold">L&amp;T / Schneider / Havells</td>
                  </tr>

                  {/* 7. LIGHTNING PROTECTION & LA CABLE */}
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500 font-bold">7</td>
                    <td className="py-1 px-3 border-r border-slate-200">
                      Pure Copper Lightning Arrestor (LA) + 1C × 16 sq.mm Down Conductor
                    </td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono">{bomQtyMap['la_cable_16sqmm'] || 30} Meters</td>
                    <td className="py-1 px-2.5 text-center text-gray-700 text-[10px]">Vasundhara / Polycab (ISI)</td>
                  </tr>

                  {/* 8. CHEMICAL EARTHING */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="py-0.5 px-2.5 text-center border-r border-slate-300">8</td>
                    <td className="py-0.5 px-3 border-r border-slate-300 uppercase text-[#0B2545]">EARTHING SYSTEM &amp; SAFETY PROTECTION</td>
                    <td className="py-0.5 px-2.5 border-r border-slate-300"></td>
                    <td className="py-0.5 px-2.5"></td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500">8.1</td>
                    <td className="py-1 px-3 border-r border-slate-200">
                      Dual Chemical Gel Earthing System (Heavy Duty Electrode + BFC Compound)
                    </td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono">{bomQtyMap['earthing_kit'] || 2} Kits</td>
                    <td className="py-1 px-2.5 text-center text-gray-800 text-[10px]">IS 3043 Compliant (&lt;5Ω)</td>
                  </tr>

                  {/* 9. FASTENERS & ACCESSORIES */}
                  <tr>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-gray-500 font-bold">9</td>
                    <td className="py-1 px-3 border-r border-slate-200">
                      Anchor Fasteners (M10/M12), SS Nut/Bolts/Washers, MC4 Pairs &amp; Rigid PVC Conduits
                    </td>
                    <td className="py-1 px-2.5 text-center border-r border-slate-200 font-mono text-[10px]">Complete Set</td>
                    <td className="py-1 px-2.5 text-center text-gray-700 text-[10px]">ISI Heavy Duty Standard</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Turnkey Scope of Work & Statutory Checklist */}
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-md p-3 mb-2">
            <div className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider mb-1">
              Turnkey EPC Scope of Work &amp; Statutory Approvals Included
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] text-gray-700">
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>DISCOM Net-Metering Application &amp; Sanctioning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>Bi-Directional Meter Testing Coordination</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>Dual Chemical Gel Earthing Pits (&lt; 5 Ohms Certified)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>WiFi Cloud Telemetry &amp; Mobile App Handover</span>
              </div>
            </div>
          </div>

          {/* Bottom Engineering Notes */}
          <div className="text-[9.5px] text-gray-600 leading-normal border-t border-slate-200 pt-1.5">
            <p><strong>* Note:</strong> Standard BOM quantities are calibrated for standard RCC rooftop layout. Actual site cable routing distance and elevation heights may require minor adjustments during final site survey.</p>
            <p className="mt-0.5 text-gray-500"><strong>Equivalence Clause:</strong> In the event of temporary supply chain constraints for any specific brand, Sunvine guarantees installation of equal or superior Tier-1 MNRE/BIS approved materials without compromising plant performance.</p>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="text-[9px] text-gray-500 pt-1 border-t border-gray-200 flex items-center justify-between">
          <span>Sunvine Renewable Energy • Engineering BOM • Ref: {id}</span>
          <span>Page 3 of 4</span>
        </div>
      </div>

      {/* ========================================================
          PAGE 4: TERMS & CONDITIONS (EXACT UNTOUCHED TEXT)
          ======================================================== */}
      <div className={`pdf-page pdf-page-content relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto p-8 flex flex-col justify-between bg-white border border-gray-300 shadow-xl print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!h-[295mm] print:!max-h-[295mm] mb-8 overflow-hidden box-border ${activePage === 'all' || activePage === 4 ? 'flex' : 'hidden print:flex'}`}>
        <div>
          {/* Top Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src="/sunvine_logo_transparent.png" alt="Sunvine" className="h-10 object-contain" />
              <div>
                <h1 className="text-lg font-black text-[#0B2545] tracking-tight uppercase leading-none">
                  TERMS &amp; CONDITIONS
                </h1>
                <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                  Standard Warranty Terms, Payment Schedule &amp; Handover Protocols
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-gray-700">Ref: {id}</span>
              <p className="text-[10px] text-gray-600 mt-0.5">Date: {date}</p>
            </div>
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-[#2E7D32] via-[#6CBF3D] to-[#0B2545] my-2 rounded-full"></div>

          {/* EXACT UNTOUCHED TERMS AND CONDITIONS BODY */}
          <div className="space-y-1.5 text-[9.5px] text-gray-900 leading-normal">
            <div>
              <strong className="block font-bold text-gray-950">Guarantee &amp; Warranty of The Plant</strong>
              <strong className="block font-bold mt-0.5 text-gray-900">Module Warranty:</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-800">
                <li>The 30-year limited warranty covers the module as follows:</li>
                <li>10 years against manufacturing defects.</li>
                <li>90% power output for the first 10 years, and 80% for the next 15 years. (Terms subject to the module's manufacturing conditions.)</li>
                <li>From the date of commissioning and handover of the solar power system (Day One), the responsibility for cleaning and maintaining the solar panels shall be solely borne by the customer.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Inverter Warranty:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>The solar inverter comes with a 8-year warranty against manufacturing defects (Terms subject to the inverter's manufacturing conditions and based on inverter make).</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Other Equipment Warranty:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>Up to 5 years from installation.</li>
              </ul>
            </div>

            <div className="pt-0.5">
              <strong className="block font-bold text-gray-900">Warranty Exclusions: (This warranty shall not apply to damages, failures, or defects resulting from) :</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-800">
                <li>Switch Gears (L&amp;T): 12-month manufacturing defect warranty from the invoice date (No burning conditions covered).</li>
                <li>SPD: No coverage for burning or failure.</li>
                <li>DCDB/ACDB (Residential Projects): No warranty.</li>
                <li>No Returns: Goods once sold will not be accepted back.</li>
                <li>Natural disasters including but not limited to flood, cyclone, lightning, earthquake, storm, fire, or other force majeure events.</li>
                <li>Improper use, negligence, misuse, vandalism, theft, accidental damage, or unauthorized modifications.</li>
                <li>Repairs, alterations, relocation, or servicing performed by any person or organization not authorized by the Company.</li>
                <li>Voltage fluctuations, power surges, grid abnormalities, or electrical faults originating from the utility supply.</li>
                <li>Structural defects, water leakage, corrosion, or issues related to the customer's premises.</li>
                <li>Failure to follow recommended operating and maintenance procedures.</li>
              </ul>
            </div>

            <div className="pt-0.5">
              <strong className="block font-bold text-gray-900">Terms of Payment:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>10% advance with purchase order.</li>
                <li>90% before material dispatch.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Delivery:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>Typically, 30 days from the PO date, subject to legal and government approvals.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Insurance:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>After commissioning, the plant will be handed over to the client, who must arrange appropriate asset insurance for the PV system.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Validity:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>Our offer is valid for 15 days from the date of this offer</li>
              </ul>
            </div>

            <div className="font-bold pt-0.5 text-[#0B2545]">
              Note: Breakage of panels or other equipment is not covered under warranty.
            </div>
          </div>

          {/* Large Centered Banner */}
          <div className="text-center my-2 p-2 bg-[#F0FDF4] border border-[#6CBF3D]/40 rounded-lg">
            <h3 className="text-xs font-black text-[#2E7D32] tracking-wide uppercase">
              THANK YOU FOR CHOOSING SUNVINE RENEWABLE
            </h3>
            <p className="text-[10px] text-gray-600 mt-0.5">Committed to Green Energy Independence &amp; Sustainable Growth</p>
          </div>

          {/* Formal Sign-off and Corporate Stamp Block */}
          <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t-2 border-slate-200">
            {/* Customer Sign-off Block */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
              <div className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider mb-1">
                Client Acceptance &amp; Order Confirmation
              </div>
              <p className="text-[9px] text-gray-500 leading-tight mb-6">
                I/We hereby accept the technical configuration, prices, and terms outlined in this proposal.
              </p>
              <div className="border-t border-dashed border-gray-400 pt-1 flex items-center justify-between text-[10px] text-gray-700">
                <span>Authorized Signatory</span>
                <span>Date: ____________</span>
              </div>
            </div>

            {/* Sunvine Authorized Signatory Stamp */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider">
                    For Sunvine Renewable Energy
                  </span>
                  <span className="text-[9px] text-[#2E7D32] font-bold">Authorized Seal</span>
                </div>
                <p className="text-[9.5px] text-gray-700 mt-0.5">
                  G-705, Second Gate, Metoda GIDC, Rajkot - 360021 (Guj.)
                </p>
                <div className="text-[9.5px] text-gray-700 font-mono mt-0.5">
                  +91 95865 33750 • sunvinerenewable@gmail.com
                </div>
              </div>
              <div className="border-t border-dashed border-gray-400 pt-1 flex items-center justify-between text-[10px] text-gray-700 mt-4">
                <span>Authorized Executive</span>
                <span className="font-semibold text-emerald-800">Sunvine EPC Operations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="text-[9px] text-gray-500 pt-1 border-t border-gray-200 flex items-center justify-between">
          <span>Sunvine Renewable Energy • Terms &amp; Conditions • Ref: {id}</span>
          <span>Page 4 of 4</span>
        </div>
      </div>
    </div>
  );
}
