import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PDF_BOS_PRICE_MATRIX } from '../../data/defaultPresets';
import { hardwareService } from '../../services/hardwareService';
import { pricingService } from '../../services/pricingService';
import { settingsService } from '../../services/settingsService';
import DealerCustomPricingMatrix from './DealerCustomPricingMatrix';

const DEFAULT_INVERTER_BENCHMARK_MATRIX = [
  { id: 'inv-bm-1', capacityKW: 2.2, brand: 'Solis / Solaryaan', series: 'Single Phase Grid-Tied', phase: '1-Phase / Dual MPPT', benchmarkPrice: 24500 },
  { id: 'inv-bm-2', capacityKW: 3.0, brand: 'Sunvine Smart Series', series: '1-Phase Smart MPPT On-Grid', phase: '1-Phase / Dual MPPT', benchmarkPrice: 29800 },
  { id: 'inv-bm-3', capacityKW: 3.6, brand: 'Solis / Vsole', series: 'Dual MPPT On-Grid', phase: '1-Phase / Dual MPPT', benchmarkPrice: 33500 },
  { id: 'inv-bm-4', capacityKW: 5.0, brand: 'Sunvine Smart Series', series: '3-Phase Smart MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 42000 },
  { id: 'inv-bm-5', capacityKW: 6.0, brand: 'Sunvine Smart Series', series: '3-Phase Smart MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 48500 },
  { id: 'inv-bm-6', capacityKW: 10.0, brand: 'Growatt / Deye', series: '3-Phase Dual MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 72000 },
  { id: 'inv-bm-7', capacityKW: 50.0, brand: 'Solis Cloud Series', series: 'Commercial 3-Phase Grid-Tied', phase: '3-Phase / 4-MPPT', benchmarkPrice: 245000 },
  { id: 'inv-bm-8', capacityKW: 125.0, brand: 'Solaryaan / Vsole', series: 'Industrial String Inverter', phase: '3-Phase / 6-MPPT', benchmarkPrice: 580000 },
];

export default function PricingMaster() {
  const {
    pricingMaster,
    updatePricingMaster,
    addNotification,
    pdfBosMatrix,
    setPdfBosMatrix,
    pdfBomSpecs,
    officialProfile,
    dealers,
    getAccessibleDealers,
    updateDealerProductRate,
    removeDealerProductRate,
    tierMargins,
    updateTierMargins,
    modulesList,
    setModulesList,
    invertersList,
    setInvertersList,
    addNewModule,
    addNewInverter,
    bomCatalog,
    bomCategories,
    bomRates,
    updateBomItemRate,
    capacityBomMatrix,
    updateCapacityBomItemQty,
    updateCapacityBomPreset,
    getResolvedBom,
    inverterBenchmarkMatrix: globalInverterBenchmarks
  } = useApp();

  // Initialize tab from URL query param if present (?tab=base|modules|bom|bank|dealer_custom)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (['base', 'modules', 'bom', 'bank', 'dealer_custom'].includes(tabParam)) {
        return tabParam;
      }
    }
    return 'base';
  });

  const [toastMessage, setToastMessage] = useState('');
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const totalDealersCount = dealers?.length || 550;

  // Local state for BOS Matrix editing
  const [localBosMatrix, setLocalBosMatrix] = useState(() => {
    return Array.isArray(pdfBosMatrix) && pdfBosMatrix.length > 0 ? pdfBosMatrix : PDF_BOS_PRICE_MATRIX;
  });

  // Keep local matrix synced when global state changes from outside
  useEffect(() => {
    if (Array.isArray(pdfBosMatrix) && pdfBosMatrix.length > 0) {
      setLocalBosMatrix(pdfBosMatrix);
    }
  }, [pdfBosMatrix]);

  // Modal states for Matrix Editing & Adding
  const [isInlineEditingMatrix, setIsInlineEditingMatrix] = useState(false);
  const [showAddSlabModal, setShowAddSlabModal] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [slabForm, setSlabForm] = useState({
    capacityKW: '',
    noOfModules: '',
    inverterCapacityKW: '',
    adaniBiFiPrice: '',
    apsBiFiPrice: '',
    rayzonePrice: '',
    topcon585CapacityKW: '',
    waaree585Price: '',
    topcon600CapacityKW: '',
    apsTopcon600Price: ''
  });

  // Dedicated Inverter Sizing & Benchmark Pricing Matrix states (SR-57)
  const [inverterBenchmarkMatrix, setInverterBenchmarkMatrix] = useState(() => {
    return Array.isArray(globalInverterBenchmarks) && globalInverterBenchmarks.length > 0
      ? globalInverterBenchmarks
      : DEFAULT_INVERTER_BENCHMARK_MATRIX;
  });

  useEffect(() => {
    if (Array.isArray(globalInverterBenchmarks) && globalInverterBenchmarks.length > 0) {
      setInverterBenchmarkMatrix(globalInverterBenchmarks);
    }
  }, [globalInverterBenchmarks]);
  const [isInlineEditingInverters, setIsInlineEditingInverters] = useState(false);
  const [showAddInvBenchmarkModal, setShowAddInvBenchmarkModal] = useState(false);
  const [editingInvBenchmarkIdx, setEditingInvBenchmarkIdx] = useState(null);
  const [invBenchmarkForm, setInvBenchmarkForm] = useState({
    capacityKW: '',
    brand: '',
    series: '',
    phase: '1-Phase / Dual MPPT',
    benchmarkPrice: ''
  });

  // Tier margins state
  const [localTierMargins, setLocalTierMargins] = useState(() => tierMargins || {});

  useEffect(() => {
    if (tierMargins && Object.keys(tierMargins).length > 0) {
      setLocalTierMargins(tierMargins);
    }
  }, [tierMargins]);

  // Add Module Modal state
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleForm, setNewModuleForm] = useState({
    brand: '',
    model: '',
    cellTech: 'N-Type TOPCon',
    wattage: 585,
    efficiency: '22.6%',
    ratePerWp: 19.50,
    warranty: '30 Yrs'
  });

  // Add Inverter Modal state
  const [showAddInverterModal, setShowAddInverterModal] = useState(false);
  const [newInverterForm, setNewInverterForm] = useState({
    brand: '',
    model: '',
    capacity: '5.0 kW',
    phase: '1-Phase 230V / 2 MPPT',
    efficiency: '98.5%',
    warranty: '8 Years',
    cloud: 'Integrated Wi-Fi'
  });

  // Capacity selector for BOM Tab (e.g. 2.2, 3.3, 4.4, 5.5, 6.6, 8.0, 10.0)
  const [selectedBomCapacity, setSelectedBomCapacity] = useState('3.3');
  const [customBomKwInput, setCustomBomKwInput] = useState('');

  // WhatsApp broadcast state (SR-23)
  const [showWhatsAppBroadcastModal, setShowWhatsAppBroadcastModal] = useState(false);
  const [selectedDealerPhone, setSelectedDealerPhone] = useState('');
  const [customBroadcastPhone, setCustomBroadcastPhone] = useState('');
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Dealer Product Override Modal State
  const [dealerOverrideModal, setDealerOverrideModal] = useState({
    isOpen: false,
    product: null
  });
  const [overrideTargetDealerId, setOverrideTargetDealerId] = useState('');
  const [overrideRateInput, setOverrideRateInput] = useState('');

  const accessibleDealersList = useMemo(() => {
    if (getAccessibleDealers) return getAccessibleDealers();
    return dealers || [];
  }, [dealers, getAccessibleDealers]);

  const getDealerDisplayName = (d) => {
    if (!d) return 'Dealer Partner';
    return d.name || d.dealerName || d.firmName || d.businessName || d.contactPerson || d.id || 'Dealer Partner';
  };

  const handleOpenDealerOverride = (product) => {
    const defaultDealer = accessibleDealersList[0];
    setDealerOverrideModal({
      isOpen: true,
      product
    });
    setOverrideTargetDealerId(defaultDealer?.id || '');
    const existing = defaultDealer?.pricingConfig?.customProductRates?.[product.id] ?? defaultDealer?.pricingConfig?.customProductRates?.[product.name];
    setOverrideRateInput(existing !== undefined ? String(existing) : String(product.benchmarkPrice || ''));
  };

  const handleSaveDealerOverride = (e) => {
    if (e) e.preventDefault();
    if (!dealerOverrideModal.product || !overrideTargetDealerId) return;
    const num = parseFloat(overrideRateInput);
    if (isNaN(num) || num < 0) {
      triggerToast('Please enter a valid price');
      return;
    }

    if (updateDealerProductRate) {
      updateDealerProductRate(overrideTargetDealerId, dealerOverrideModal.product.id, num, {
        name: dealerOverrideModal.product.name,
        category: dealerOverrideModal.product.category,
        benchmarkPrice: dealerOverrideModal.product.benchmarkPrice,
        unit: dealerOverrideModal.product.unit
      });
    }

    const d = accessibleDealersList.find(x => x.id === overrideTargetDealerId);
    triggerToast(`Negotiated rate set for ${dealerOverrideModal.product.name}: ₹${num} ${dealerOverrideModal.product.unit} (${getDealerDisplayName(d)})`);
    setDealerOverrideModal({ isOpen: false, product: null });
  };

  // Form states initialized with pricingMaster or realistic defaults
  const [rate1to3, setRate1to3] = useState(pricingMaster?.baseRates?.tier1to3kw || 62000);
  const [rate3to10, setRate3to10] = useState(pricingMaster?.baseRates?.tier3to10kw || 58000);
  const [rateCommercial, setRateCommercial] = useState(pricingMaster?.baseRates?.tier10to50kw || 24000);

  // Default Hardware selections
  const [selectedDefaultModule, setSelectedDefaultModule] = useState(
    pricingMaster?.defaultHardware?.module || 'Waaree 585W TOPCon Bifacial (ALMM List-I)'
  );
  const [selectedDefaultInverter, setSelectedDefaultInverter] = useState(
    pricingMaster?.defaultHardware?.inverter || 'Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)'
  );
  const [moduleRating, setModuleRating] = useState('585 WP TOPCon Bifacial Half-Cut');
  const [moduleEfficiency, setModuleEfficiency] = useState('22.6% STC Peak');
  const [moduleWarranty, setModuleWarranty] = useState('12 Yrs Product / 30 Yrs Linear Power Warranty');

  const [inverterTopology, setInverterTopology] = useState('1-Phase / 3-Phase Grid-Tied Cloud Wi-Fi');
  const [inverterEfficiency, setInverterEfficiency] = useState('98.6% Euro Efficiency');
  const [inverterWarranty, setInverterWarranty] = useState('8 Years Full Replacement + Remote Telemetry');

  // Bank details matching official PDF
  const [beneficiaryName, setBeneficiaryName] = useState(pricingMaster?.bankDetails?.accountName || 'SUNVINE RENEWABLE');
  const [bankName, setBankName] = useState(pricingMaster?.bankDetails?.bankName || 'HDFC BANK LTD.');
  const [accountNumber, setAccountNumber] = useState(pricingMaster?.bankDetails?.accountNumber || '99998000050580');
  const [ifscCode, setIfscCode] = useState(pricingMaster?.bankDetails?.ifscCode || 'HDFC0002012');
  const [branch, setBranch] = useState(pricingMaster?.bankDetails?.branch || 'METODA GIDC BRANCH, RAJKOT - 360021 (GUJARAT)');

  // Terms matching official PDF
  const [paymentMilestones, setPaymentMilestones] = useState('10% Advance with PO, 90% before material dispatch (All Prices GST Included)');
  const [deliveryTimeline, setDeliveryTimeline] = useState('Transport & Installation: Dealer Scope | Documents: Light Bill, Bank Detail, Aadhar, Mobile');
  const [validityDays, setValidityDays] = useState('15 Days from generation date due to commodity pricing');

  // Helper getters for robust field access across both formats
  const getModules = (row) => row.noOfModules ?? row.modules ?? '-';
  const getInverter = (row) => {
    if (row.inverterCapacityKW) return `${row.inverterCapacityKW} kW`;
    if (row.inverter) return row.inverter;
    return '-';
  };
  const getAdaniPrice = (row) => row.adaniBiFiPrice ?? row.adaniBiFi ?? 0;
  const getApsBiFiPrice = (row) => row.apsBiFiPrice ?? row.apsBiFi ?? 0;
  const getRayzonePrice = (row) => row.rayzonePrice ?? row.rayzone ?? 0;
  const getWaareePrice = (row) => row.waaree585Price ?? row.waaree585Topcon ?? 0;
  const getApsTopconPrice = (row) => row.apsTopcon600Price ?? row.apsTopcon600 ?? 0;

  const formatINR = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹\u00A00';
    return '₹\u00A0' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  // Sync tab with URL search params
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      window.history.replaceState({ ...window.history.state, subtab: tabKey }, '', url.toString());
    }
  };

  // Listen to popstate for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (['base', 'modules', 'bom', 'bank', 'dealer_custom'].includes(tabParam)) {
          setActiveTab(tabParam);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // WhatsApp Broadcast Engine (SR-23)
  const getBroadcastMessage = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sunvine-dealer.vprotech.online';
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return `*☀️ SUNVINE RENEWABLE ENERGY - OFFICIAL PRICING REVISION NOTICE*

Dear EPC Partners & Authorized Dealers,

Please find the revised turnkey EPC benchmark rates and PM Surya Ghar DBT subsidy slabs effective *${dateStr}* across all Gujarat territories (PGVCL / DGVCL / UGVCL / MGVCL):

📊 *BENCHMARK EPC BASE RATES*
━━━━━━━━━━━━━━━━━━━━
• *1.0 kW – 3.0 kW Residential:* *₹${Number(rate1to3).toLocaleString('en-IN')} / kW*
• *3.0 kW – 10.0 kW Residential:* *₹${Number(rate3to10).toLocaleString('en-IN')} / kW*
• *Commercial & Industrial (> 10 kW):* *₹${Number(rateCommercial).toLocaleString('en-IN')} / kW*

🏛️ *CENTRAL GOVT. PM SURYA GHAR DBT SUBSIDY*
━━━━━━━━━━━━━━━━━━━━
• *1 kW System:* ₹30,000 Direct Benefit Transfer
• *2 kW System:* ₹60,000 Direct Benefit Transfer
• *≥ 3 kW System:* Up to ₹78,000 Maximum Central Subsidy

⚙️ *KEY HARDWARE SPECIFICATIONS*
• Solar Modules: ${selectedDefaultModule}
• Solar Inverter: ${selectedDefaultInverter}
• Composite GST: 13.8% included in BoS matrix
• Portal Proposals: All new quotations will automatically apply these updated matrices.

🔗 *Access Dealer Portal & Create Proposals:*
${origin}/?tab=pricing_master

📞 *Sunvine Dealer Helpdesk:* +91 80000 50580
🏢 *Sunvine Renewable Energy*, Metoda GIDC, Rajkot, Gujarat.`;
  };

  const handleOpenWhatsAppBroadcast = (phone = null) => {
    const msg = getBroadcastMessage();
    let url;
    if (phone) {
      const cleanDigits = String(phone).replace(/\D/g, '');
      const fullPhone = cleanDigits.length === 10 ? '91' + cleanDigits : cleanDigits;
      url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    }
    window.open(url, '_blank');
    triggerToast('WhatsApp opened with updated pricing catalog!');
  };

  const handleCopyBroadcastMessage = () => {
    const msg = getBroadcastMessage();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(msg);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
      triggerToast('Broadcast message copied to clipboard!');
    }
  };

  // Handle saving matrix changes
  const handleSaveMatrix = (updatedMatrix) => {
    const matrixToSave = updatedMatrix || localBosMatrix;
    if (pdfBosMatrix && JSON.stringify(matrixToSave) === JSON.stringify(pdfBosMatrix)) {
      setIsInlineEditingMatrix(false);
      triggerToast('No changes detected in BOS Price Matrix.');
      return;
    }
    if (setPdfBosMatrix) {
      setPdfBosMatrix(matrixToSave);
    }
    pricingService.saveBosMatrix(matrixToSave);
    setIsInlineEditingMatrix(false);
    if (addNotification) {
      addNotification({
        type: 'success',
        icon: 'table_chart',
        title: 'BOS Price List Matrix Updated',
        description: `BOS price slabs updated across ${matrixToSave.length} capacities. Synced to all ${totalDealersCount} dealers.`,
        targetTab: 'pricing_master'
      });
    }
    triggerToast(`BOS Price Matrix saved successfully (${matrixToSave.length} capacity slabs)!`);
  };

  // Handle inline cell changes in Matrix
  const handleMatrixCellChange = (index, field, value) => {
    const updated = [...localBosMatrix];
    updated[index] = {
      ...updated[index],
      [field]: Number(value) || value
    };
    setLocalBosMatrix(updated);
  };

  // Handle adding or editing a single slab from modal
  const handleOpenAddSlabModal = () => {
    setEditingRowIndex(null);
    setSlabForm({
      capacityKW: '',
      noOfModules: '',
      inverterCapacityKW: '',
      adaniBiFiPrice: '',
      apsBiFiPrice: '',
      rayzonePrice: '',
      topcon585CapacityKW: '',
      waaree585Price: '',
      topcon600CapacityKW: '',
      apsTopcon600Price: ''
    });
    setShowAddSlabModal(true);
  };

  const handleOpenEditSlabModal = (index) => {
    const row = localBosMatrix[index];
    setEditingRowIndex(index);
    setSlabForm({
      capacityKW: row.capacityKW ?? '',
      noOfModules: getModules(row),
      inverterCapacityKW: row.inverterCapacityKW ?? row.inverter ?? '',
      adaniBiFiPrice: getAdaniPrice(row),
      apsBiFiPrice: getApsBiFiPrice(row),
      rayzonePrice: getRayzonePrice(row),
      topcon585CapacityKW: row.topcon585CapacityKW ?? '',
      waaree585Price: getWaareePrice(row),
      topcon600CapacityKW: row.topcon600CapacityKW ?? '',
      apsTopcon600Price: getApsTopconPrice(row)
    });
    setShowAddSlabModal(true);
  };

  const handleSaveSlabForm = (e) => {
    e.preventDefault();
    if (!slabForm.capacityKW) {
      triggerToast('Please provide a capacity (kW)');
      return;
    }

    const newRow = {
      capacityKW: Number(slabForm.capacityKW) || slabForm.capacityKW,
      noOfModules: Number(slabForm.noOfModules) || slabForm.noOfModules,
      inverterCapacityKW: Number(slabForm.inverterCapacityKW) || slabForm.inverterCapacityKW,
      adaniBiFiPrice: Number(slabForm.adaniBiFiPrice) || 0,
      apsBiFiPrice: Number(slabForm.apsBiFiPrice) || 0,
      rayzonePrice: Number(slabForm.rayzonePrice) || 0,
      topcon585CapacityKW: Number(slabForm.topcon585CapacityKW) || Number(slabForm.capacityKW),
      waaree585Price: Number(slabForm.waaree585Price) || 0,
      topcon600CapacityKW: Number(slabForm.topcon600CapacityKW) || Number(slabForm.capacityKW),
      apsTopcon600Price: Number(slabForm.apsTopcon600Price) || 0
    };

    let updated;
    if (editingRowIndex !== null && editingRowIndex >= 0) {
      updated = [...localBosMatrix];
      updated[editingRowIndex] = newRow;
      triggerToast(`Updated ${newRow.capacityKW} kW pricing slab!`);
    } else {
      updated = [...localBosMatrix, newRow];
      // Sort by capacityKW ascending
      updated.sort((a, b) => (Number(a.capacityKW) || 0) - (Number(b.capacityKW) || 0));
      triggerToast(`Added new ${newRow.capacityKW} kW pricing slab!`);
    }

    setLocalBosMatrix(updated);
    if (setPdfBosMatrix) {
      setPdfBosMatrix(updated);
    }
    pricingService.saveBosMatrix(updated);
    setShowAddSlabModal(false);
  };

  const handleDeleteSlab = async (index) => {
    const row = localBosMatrix[index];
    if (window.confirm(`Are you sure you want to delete the ${row.capacityKW} kW pricing slab?`)) {
      const updated = localBosMatrix.filter((_, i) => i !== index);
      setLocalBosMatrix(updated);
      if (setPdfBosMatrix) {
        setPdfBosMatrix(updated);
      }
      pricingService.saveBosMatrix(updated);
      await pricingService.deleteBosSlab(row.capacityKW);
      triggerToast(`Deleted ${row.capacityKW} kW slab from database`);
    }
  };

  const handleSaveInverterMatrix = (updatedList) => {
    const toSave = updatedList || inverterBenchmarkMatrix;
    setInverterBenchmarkMatrix(toSave);
    pricingService.saveInverterBenchmarks(toSave);
    setIsInlineEditingInverters(false);
    triggerToast('Inverter Sizing & Benchmark Pricing Matrix saved to database!');
  };

  const handleInverterCellChange = (idx, field, value) => {
    const updated = [...inverterBenchmarkMatrix];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'benchmarkPrice' || field === 'capacityKW' ? (Number(value) || value) : value
    };
    setInverterBenchmarkMatrix(updated);
  };

  const handleDeleteInverterBenchmark = async (idx) => {
    const item = inverterBenchmarkMatrix[idx];
    if (window.confirm(`Delete ${item.capacityKW} kW inverter benchmark entry?`)) {
      const updated = inverterBenchmarkMatrix.filter((_, i) => i !== idx);
      setInverterBenchmarkMatrix(updated);
      pricingService.saveInverterBenchmarks(updated);
      await pricingService.deleteInverterBenchmark(item.capacityKW);
      triggerToast('Inverter benchmark entry removed from database');
    }
  };

  const handleOpenAddInvModal = () => {
    setEditingInvBenchmarkIdx(null);
    setInvBenchmarkForm({
      capacityKW: '',
      brand: 'Sunvine Smart Series',
      series: 'Grid-Tied On-Grid Inverter',
      phase: '1-Phase / Dual MPPT',
      benchmarkPrice: ''
    });
    setShowAddInvBenchmarkModal(true);
  };

  const handleOpenEditInvModal = (idx) => {
    const item = inverterBenchmarkMatrix[idx];
    setEditingInvBenchmarkIdx(idx);
    setInvBenchmarkForm({
      capacityKW: item.capacityKW,
      brand: item.brand,
      series: item.series,
      phase: item.phase,
      benchmarkPrice: item.benchmarkPrice
    });
    setShowAddInvBenchmarkModal(true);
  };

  const handleSaveInvModalForm = (e) => {
    e.preventDefault();
    if (!invBenchmarkForm.capacityKW) {
      triggerToast('Please provide an inverter capacity');
      return;
    }
    const item = {
      id: editingInvBenchmarkIdx !== null && inverterBenchmarkMatrix[editingInvBenchmarkIdx]
        ? inverterBenchmarkMatrix[editingInvBenchmarkIdx].id
        : `inv-bm-${Date.now()}`,
      capacityKW: Number(invBenchmarkForm.capacityKW) || invBenchmarkForm.capacityKW,
      brand: invBenchmarkForm.brand.trim() || 'Sunvine Smart Series',
      series: invBenchmarkForm.series.trim() || 'Smart MPPT Inverter',
      phase: invBenchmarkForm.phase || '1-Phase / Dual MPPT',
      benchmarkPrice: Number(invBenchmarkForm.benchmarkPrice) || 0
    };

    let updated;
    if (editingInvBenchmarkIdx !== null && editingInvBenchmarkIdx >= 0) {
      updated = [...inverterBenchmarkMatrix];
      updated[editingInvBenchmarkIdx] = item;
      triggerToast(`Updated ${item.capacityKW} kW inverter pricing spec!`);
    } else {
      updated = [...inverterBenchmarkMatrix, item];
      updated.sort((a, b) => (Number(a.capacityKW) || 0) - (Number(b.capacityKW) || 0));
      triggerToast(`Added ${item.capacityKW} kW inverter pricing spec!`);
    }
    handleSaveInverterMatrix(updated);
    setShowAddInvBenchmarkModal(false);
  };

  const handleResetMatrixToDefault = () => {
    if (window.confirm('Reset the BOS Price Matrix to the official PDF defaults?')) {
      setLocalBosMatrix(PDF_BOS_PRICE_MATRIX);
      if (setPdfBosMatrix) {
        setPdfBosMatrix(PDF_BOS_PRICE_MATRIX);
      }
      triggerToast('Reset BOS Price Matrix to official PDF defaults');
    }
  };

  const handleSaveModuleForm = (e) => {
    e.preventDefault();
    if (!newModuleForm.brand.trim() || !newModuleForm.model.trim()) {
      triggerToast('Please provide both Brand and Model name');
      return;
    }
    const created = addNewModule(newModuleForm);
    setShowAddModuleModal(false);
    setNewModuleForm({
      brand: '',
      model: '',
      cellTech: 'N-Type TOPCon',
      wattage: 585,
      efficiency: '22.6%',
      ratePerWp: 19.50,
      warranty: '30 Yrs'
    });
    triggerToast(`Added ${created.brand} ${created.model} - "NEW" badge active for dealers!`);
  };

  const handleDeleteModule = async (idx) => {
    const mod = modulesList[idx];
    if (window.confirm(`Remove ${mod.brand} ${mod.model} from master catalog?`)) {
      setModulesList(prev => prev.filter((_, i) => i !== idx));
      if (mod.id) {
        await hardwareService.deleteModule(mod.id);
      }
      triggerToast(`Removed ${mod.brand} ${mod.model} from catalog and database`);
    }
  };

  const handleSaveInverterForm = (e) => {
    e.preventDefault();
    if (!newInverterForm.brand.trim() || !newInverterForm.model.trim()) {
      triggerToast('Please provide both Brand and Series/Model name');
      return;
    }
    const created = addNewInverter(newInverterForm);
    setShowAddInverterModal(false);
    setNewInverterForm({
      brand: '',
      model: '',
      capacity: '5.0 kW',
      phase: '1-Phase 230V / 2 MPPT',
      efficiency: '98.5%',
      warranty: '8 Years',
      cloud: 'Integrated Wi-Fi'
    });
    triggerToast(`Added ${created.brand} ${created.model} - "NEW" badge active for dealers!`);
  };

  const handleDeleteInverter = async (idx) => {
    const inv = invertersList[idx];
    if (window.confirm(`Remove ${inv.brand} ${inv.model} from master catalog?`)) {
      setInvertersList(prev => prev.filter((_, i) => i !== idx));
      if (inv.id) {
        await hardwareService.deleteInverter(inv.id);
      }
      triggerToast(`Removed ${inv.brand} ${inv.model} from catalog and database`);
    }
  };

  // Helper to serialize current configuration for deep comparison (diff check) (SR-58)
  const getSnapshotString = () => JSON.stringify({
    baseRates: {
      tier1to3kw: Number(rate1to3),
      tier3to10kw: Number(rate3to10),
      tier10to50kw: Number(rateCommercial),
      tierAbove50kw: Number(rateCommercial),
    },
    defaultHardware: {
      module: selectedDefaultModule,
      inverter: selectedDefaultInverter
    },
    bankDetails: {
      accountName: beneficiaryName,
      bankName,
      accountNumber,
      ifscCode,
      branch,
    },
    localBosMatrix,
    inverterBenchmarkMatrix,
    bomRates,
    capacityBomMatrix
  });

  const baselineSnapshotRef = React.useRef(null);

  useEffect(() => {
    if (!baselineSnapshotRef.current) {
      baselineSnapshotRef.current = getSnapshotString();
    }
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();

    const currentSnapshot = getSnapshotString();
    const hasChanges = baselineSnapshotRef.current !== currentSnapshot;

    if (updatePricingMaster) {
      updatePricingMaster({
        baseRates: {
          tier1to3kw: Number(rate1to3),
          tier3to10kw: Number(rate3to10),
          tier10to50kw: Number(rateCommercial),
          tierAbove50kw: Number(rateCommercial),
        },
        defaultHardware: {
          module: selectedDefaultModule,
          inverter: selectedDefaultInverter
        },
        bankDetails: {
          accountName: beneficiaryName,
          bankName,
          accountNumber,
          ifscCode,
          branch,
        }
      });
    }

    if (setPdfBosMatrix) {
      setPdfBosMatrix(localBosMatrix);
    }

    // Direct backend persistence to Supabase database (eliminating local-only reliance)
    try {
      await settingsService.savePricingPresets({
        baseRates: {
          tier1to3kw: Number(rate1to3),
          tier3to10kw: Number(rate3to10),
          tier10to50kw: Number(rateCommercial),
          tierAbove50kw: Number(rateCommercial),
        },
        defaultHardware: {
          module: selectedDefaultModule,
          inverter: selectedDefaultInverter
        },
        bankDetails: {
          accountName: beneficiaryName,
          bankName,
          accountNumber,
          ifscCode,
          branch,
        },
        bomRates,
        capacityBomMatrix,
        inverterBenchmarkMatrix,
        tierMargins: localTierMargins
      });
      await settingsService.saveBosPriceMatrix(localBosMatrix);
    } catch (dbErr) {
      console.warn('Failed to persist presets to Supabase:', dbErr);
    }

    // SR-58: Diff-based notification check. If no fields changed, suppress dealer notification
    if (!hasChanges) {
      triggerToast('Configuration saved to database. No changes detected from current presets.');
      return;
    }

    // Actual changes detected: update baseline snapshot and dispatch real-time dealer notification
    baselineSnapshotRef.current = currentSnapshot;

    if (addNotification) {
      addNotification({
        type: 'info',
        icon: 'bolt',
        title: 'Master EPC Pricing & Presets Published',
        description: `Admin revised benchmark rates, hardware specifications, and BOM presets. Synced to Supabase database and across ${totalDealersCount} Gujarat dealers.`,
        targetTab: 'pricing_master'
      });
    }
    triggerToast(`Master pricing & presets published to Supabase database and synced across ${totalDealersCount} Gujarat dealers!`);
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Toast */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 pointer-events-none flex items-center gap-2 px-4 py-3 rounded-lg bg-on-secondary-fixed text-on-secondary shadow-xl font-label-sm ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <span className="material-symbols-outlined text-[20px] text-primary-fixed">check_circle</span>
        <span>{toastMessage}</span>
      </div>

      {/* Breadcrumb & Master Title Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between pb-6 gap-4 border-b border-surface-container-highest">
        <div>
          <div className="flex items-center gap-2 font-label-sm text-label-sm text-secondary mb-1.5">
            <span>Admin Console</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span>Commercial Master Rules</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-on-surface font-semibold">Quotation Presets</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-inverse-surface tracking-tight">
            Quotation Presets &amp; Master Pricing Engine
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-1 max-w-3xl">
            Configure baseline turnkey equipment pricing from official Sunvine BOS Price List, DBT subsidy matrices, standard BOM, banking instruments, and commercial terms enforced across {totalDealersCount} authorized Gujarat dealers.
          </p>
        </div>
        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start xl:self-center shrink-0">
          <button
            onClick={() => {
              setRate1to3(62000);
              setRate3to10(58000);
              setRateCommercial(24000);
              handleResetMatrixToDefault();
              triggerToast('Reset to default system presets');
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-surface-container-highest bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-label-md font-label-md transition-colors shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg text-secondary">restart_alt</span>
            <span>Reset to Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest font-label-md text-label-md transition-colors shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">cloud_sync</span>
            <span>Save &amp; Publish Changes</span>
            <span className="ml-1 text-[10px] font-bold uppercase bg-surface-container-lowest/20 px-1.5 py-0.5 rounded">{totalDealersCount} Dealers</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar — Mobile Dropdown (sm:hidden) & Desktop Segmented Tabs (hidden sm:grid) */}
      <div className="mt-4">
        {/* Mobile Custom Animated Dropdown Popover */}
        <div className="sm:hidden relative">
          <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">
            Select Pricing Section
          </label>
          
          {/* Dropdown Trigger Button */}
          <button
            type="button"
            onClick={() => setMobileDropdownOpen((prev) => !prev)}
            className={`w-full flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border transition-all duration-200 cursor-pointer shadow-xs ${
              mobileDropdownOpen
                ? 'border-primary ring-2 ring-primary/20 shadow-md'
                : 'border-surface-container-high hover:border-primary/40'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[22px] leading-none flex items-center justify-center select-none">
                  {activeTab === 'base' && 'payments'}
                  {activeTab === 'modules' && 'solar_power'}
                  {activeTab === 'bom' && 'inventory_2'}
                  {activeTab === 'bank' && 'account_balance'}
                  {activeTab === 'dealer_custom' && 'tune'}
                </span>
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface truncate">
                    {activeTab === 'base' && 'Base Pricing & Subsidy Slabs'}
                    {activeTab === 'modules' && 'Modules & Inverters Master'}
                    {activeTab === 'bom' && 'Default Bill of Material (BOM)'}
                    {activeTab === 'bank' && 'Company Bank Details & Terms'}
                    {activeTab === 'dealer_custom' && 'Dealer Custom Pricing Matrix'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-primary text-surface-container-lowest font-bold shrink-0">
                    Active
                  </span>
                </div>
                <span className="text-[11px] text-secondary truncate">
                  {activeTab === 'base' && 'Official BOS Matrix & Subsidy Rates'}
                  {activeTab === 'modules' && `${(modulesList?.length ?? 0) + (invertersList?.length ?? 0)} Hardware Items Catalog`}
                  {activeTab === 'bom' && `${pdfBomSpecs?.length || 8} Slabs Capacity Presets`}
                  {activeTab === 'bank' && 'Payment Terms & Bank Info'}
                  {activeTab === 'dealer_custom' && `${totalDealersCount} Dealers Custom Margins`}
                </span>
              </div>
            </div>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
              mobileDropdownOpen 
                ? 'rotate-180 text-primary bg-primary/15' 
                : 'text-secondary bg-surface-container-low hover:bg-surface-container'
            }`}>
              <span className="material-symbols-outlined text-[20px] leading-none select-none flex items-center justify-center">expand_more</span>
            </div>
          </button>

          {/* Animated Dropdown Menu Popover */}
          {mobileDropdownOpen && (
            <>
              {/* Invisible Backdrop to close on click outside */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMobileDropdownOpen(false)}
              />

              <div className="absolute top-full left-0 right-0 mt-2 z-50 p-1.5 bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-200">
                {[
                  {
                    id: 'base',
                    icon: 'payments',
                    title: 'Base Pricing & Subsidy Slabs',
                    subtitle: 'Official BOS Matrix & Subsidy Rates',
                    badge: 'BOS Slabs'
                  },
                  {
                    id: 'modules',
                    icon: 'solar_power',
                    title: 'Modules & Inverters Master',
                    subtitle: `${(modulesList?.length ?? 0) + (invertersList?.length ?? 0)} Hardware Items`,
                    badge: `${(modulesList?.length ?? 0) + (invertersList?.length ?? 0)} Items`
                  },
                  {
                    id: 'bom',
                    icon: 'inventory_2',
                    title: 'Default Bill of Material (BOM)',
                    subtitle: `${pdfBomSpecs?.length || 8} Slabs Component Specs`,
                    badge: `${pdfBomSpecs?.length || 8} Slabs`
                  },
                  {
                    id: 'bank',
                    icon: 'account_balance',
                    title: 'Company Bank Details & Terms',
                    subtitle: 'Payment Terms, Warranty & Bank Info',
                    badge: 'Legal & Bank'
                  },
                  {
                    id: 'dealer_custom',
                    icon: 'tune',
                    title: 'Dealer Custom Pricing Matrix',
                    subtitle: `${totalDealersCount} Partner Pricing Rules`,
                    badge: `${totalDealersCount} Dealers`
                  }
                ].map((item) => {
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        handleTabChange(item.id);
                        setMobileDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left cursor-pointer min-h-[48px] ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30 text-on-surface font-semibold shadow-xs'
                          : 'bg-transparent border border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-primary text-surface-container-lowest shadow-xs'
                              : 'bg-surface-container text-secondary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs truncate ${isSelected ? 'font-bold text-primary' : 'font-medium text-on-surface'}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] text-secondary truncate">{item.subtitle}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                            isSelected
                              ? 'bg-primary/20 text-primary'
                              : 'bg-surface-container text-secondary'
                          }`}
                        >
                          {isSelected ? 'Active' : item.badge}
                        </span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-primary text-[18px]">check</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Desktop / Tablet Segmented Tabs */}
        <div className="hidden sm:grid grid-cols-5 gap-2 p-1.5 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xs">
          {/* TAB 1: Base Pricing & Subsidy Slabs */}
          <button
            type="button"
            onClick={() => handleTabChange('base')}
            className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-left border min-w-0 ${
              activeTab === 'base'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-transparent border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${activeTab === 'base' ? 'text-primary' : 'text-secondary'}`}>
                payments
              </span>
              <span className="text-xs tracking-tight truncate">Base Pricing</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-semibold ${
              activeTab === 'base'
                ? 'bg-primary text-surface-container-lowest'
                : 'bg-surface-container text-secondary'
            }`}>
              {activeTab === 'base' ? 'Active' : 'Slabs'}
            </span>
          </button>

          {/* TAB 2: Modules & Inverters Master */}
          <button
            type="button"
            onClick={() => handleTabChange('modules')}
            className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-left border min-w-0 ${
              activeTab === 'modules'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-transparent border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${activeTab === 'modules' ? 'text-primary' : 'text-secondary'}`}>
                solar_power
              </span>
              <span className="text-xs tracking-tight truncate">Hardware</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-semibold ${
              activeTab === 'modules'
                ? 'bg-primary text-surface-container-lowest'
                : 'bg-surface-container text-secondary'
            }`}>
              {activeTab === 'modules' ? 'Active' : `${(modulesList?.length ?? 0) + (invertersList?.length ?? 0)} Items`}
            </span>
          </button>

          {/* TAB 3: Default Bill of Material (BOM) */}
          <button
            type="button"
            onClick={() => handleTabChange('bom')}
            className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-left border min-w-0 ${
              activeTab === 'bom'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-transparent border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${activeTab === 'bom' ? 'text-primary' : 'text-secondary'}`}>
                inventory_2
              </span>
              <span className="text-xs tracking-tight truncate">BOM Master</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-semibold ${
              activeTab === 'bom'
                ? 'bg-primary text-surface-container-lowest'
                : 'bg-surface-container text-secondary'
            }`}>
              {activeTab === 'bom' ? 'Active' : `${pdfBomSpecs?.length || 8} Slabs`}
            </span>
          </button>

          {/* TAB 4: Company Bank Details & Terms */}
          <button
            type="button"
            onClick={() => handleTabChange('bank')}
            className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-left border min-w-0 ${
              activeTab === 'bank'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-transparent border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${activeTab === 'bank' ? 'text-primary' : 'text-secondary'}`}>
                account_balance
              </span>
              <span className="text-xs tracking-tight truncate">Bank & Terms</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-semibold ${
              activeTab === 'bank'
                ? 'bg-primary text-surface-container-lowest'
                : 'bg-surface-container text-secondary'
            }`}>
              {activeTab === 'bank' ? 'Active' : 'Legal'}
            </span>
          </button>

          {/* TAB 5: Dealer Custom Pricing Matrix */}
          <button
            type="button"
            onClick={() => handleTabChange('dealer_custom')}
            className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-left border min-w-0 ${
              activeTab === 'dealer_custom'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-transparent border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${activeTab === 'dealer_custom' ? 'text-primary' : 'text-secondary'}`}>
                tune
              </span>
              <span className="text-xs tracking-tight truncate">Dealer Pricing</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-semibold ${
              activeTab === 'dealer_custom'
                ? 'bg-primary text-surface-container-lowest'
                : 'bg-surface-container text-secondary'
            }`}>
              {activeTab === 'dealer_custom' ? 'Active' : `${totalDealersCount} D`}
            </span>
          </button>
        </div>
      </div>

      {/* Main Workspace Full-Width Layout (SR-45) */}
      <div className="w-full flex flex-col gap-6 mt-6">

          {/* ========================================================================= */}
          {/* TAB 1: BASE PRICING & SUBSIDY SLABS                                      */}
          {/* ========================================================================= */}
          {activeTab === 'base' && (
            <>
              {/* OFFICIAL PDF BOS PRICE LIST MATRIX (NOW FULLY EDITABLE WITH ADD/EDIT CONTROLS) */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">table_chart</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-headline-md text-headline-md text-inverse-surface font-bold">
                          Sunvine Official BOS Price List Matrix
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-[11px] font-bold">
                          {localBosMatrix.length} Slabs
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                        GST Included • Transport &amp; Fitting Dealer Scope • Click &quot;Edit Matrix&quot; or &quot;+ Add Slab&quot; to customize prices.
                      </p>
                    </div>
                  </div>

                  {/* Matrix Actions: Add Slab & Toggle Inline Editing */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={handleOpenAddSlabModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-container/15 hover:bg-primary-container/25 text-primary text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>Add Slab</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isInlineEditingMatrix) {
                          handleSaveMatrix();
                        } else {
                          setIsInlineEditingMatrix(true);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        isInlineEditingMatrix
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isInlineEditingMatrix ? 'check' : 'edit'}
                      </span>
                      <span>{isInlineEditingMatrix ? 'Save Matrix' : 'Edit Matrix'}</span>
                    </button>
                  </div>
                </div>

                {/* MOBILE VIEW: Responsive Compact Cards (< md) */}
                <div className="block md:hidden space-y-3">
                  {localBosMatrix.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-3"
                    >
                      {/* Top Row: Capacity, Modules, and Action Buttons */}
                      <div className="flex items-center justify-between gap-2 border-b border-surface-container-high/60 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isInlineEditingMatrix ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-secondary">KW:</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.capacityKW}
                                onChange={(e) => handleMatrixCellChange(idx, 'capacityKW', e.target.value)}
                                className="w-16 px-1.5 py-1 bg-surface-container-low border border-surface-container-high rounded text-xs font-mono font-bold text-center"
                              />
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-inverse-surface text-surface-container-lowest font-mono font-bold text-xs">
                              {row.capacityKW} kW
                            </span>
                          )}

                          {isInlineEditingMatrix ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-secondary">Mods:</span>
                              <input
                                type="number"
                                value={getModules(row)}
                                onChange={(e) => handleMatrixCellChange(idx, 'noOfModules', e.target.value)}
                                className="w-14 px-1.5 py-1 bg-surface-container-low border border-surface-container-high rounded text-xs font-mono text-primary font-bold text-center"
                              />
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold text-[11px] border border-emerald-200">
                              {getModules(row)} Modules
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSlabModal(idx)}
                            className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-primary transition-colors cursor-pointer"
                            title="Edit slab"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit_note</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlab(idx)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-secondary hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete slab"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Equipment Prices Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Adani Bi-Fi */}
                        <div className="p-2 rounded-lg bg-surface-container-low/40 border border-surface-container-high/40">
                          <div className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Adani Bi-Fi</div>
                          {isInlineEditingMatrix ? (
                            <input
                              type="number"
                              value={getAdaniPrice(row)}
                              onChange={(e) => handleMatrixCellChange(idx, 'adaniBiFiPrice', e.target.value)}
                              className="w-full mt-1 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-high rounded text-xs font-mono font-semibold"
                            />
                          ) : (
                            <div className="font-mono font-semibold text-on-surface mt-0.5">
                              ₹ {Number(getAdaniPrice(row)).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>

                        {/* APS Bi-Fi */}
                        <div className="p-2 rounded-lg bg-surface-container-low/40 border border-surface-container-high/40">
                          <div className="text-[10px] font-semibold text-secondary uppercase tracking-wider">APS Bi-Fi</div>
                          {isInlineEditingMatrix ? (
                            <input
                              type="number"
                              value={getApsBiFiPrice(row)}
                              onChange={(e) => handleMatrixCellChange(idx, 'apsBiFiPrice', e.target.value)}
                              className="w-full mt-1 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-high rounded text-xs font-mono font-semibold"
                            />
                          ) : (
                            <div className="font-mono font-semibold text-on-surface mt-0.5">
                              ₹ {Number(getApsBiFiPrice(row)).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>

                        {/* Rayzone */}
                        <div className="p-2 rounded-lg bg-surface-container-low/40 border border-surface-container-high/40">
                          <div className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Rayzone</div>
                          {isInlineEditingMatrix ? (
                            <input
                              type="number"
                              value={getRayzonePrice(row)}
                              onChange={(e) => handleMatrixCellChange(idx, 'rayzonePrice', e.target.value)}
                              className="w-full mt-1 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-high rounded text-xs font-mono font-semibold"
                            />
                          ) : (
                            <div className="font-mono font-semibold text-on-surface mt-0.5">
                              ₹ {Number(getRayzonePrice(row)).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>

                        {/* APS TOPCon 600W */}
                        <div className="p-2 rounded-lg bg-surface-container-low/40 border border-surface-container-high/40">
                          <div className="text-[10px] font-semibold text-[#256676] uppercase tracking-wider">APS 600W TOPCon</div>
                          {isInlineEditingMatrix ? (
                            <input
                              type="number"
                              value={getApsTopconPrice(row)}
                              onChange={(e) => handleMatrixCellChange(idx, 'apsTopcon600Price', e.target.value)}
                              className="w-full mt-1 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-high rounded text-xs font-mono font-bold text-[#256676]"
                            />
                          ) : (
                            <div className="font-mono font-bold text-[#256676] mt-0.5">
                              ₹ {Number(getApsTopconPrice(row)).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>

                        {/* Waaree 585W TOPCon (Full-width featured on mobile) */}
                        <div className="col-span-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Waaree 585W TOPCon</div>
                            <div className="text-[10px] text-emerald-700">Official Gujarat Standard</div>
                          </div>
                          {isInlineEditingMatrix ? (
                            <input
                              type="number"
                              value={getWaareePrice(row)}
                              onChange={(e) => handleMatrixCellChange(idx, 'waaree585Price', e.target.value)}
                              className="w-28 px-1.5 py-1 bg-white border border-emerald-300 rounded text-xs font-mono font-bold text-primary text-right"
                            />
                          ) : (
                            <div className="font-mono font-bold text-primary text-sm">
                              ₹ {Number(getWaareePrice(row)).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP VIEW: Full Comparison Table (>= md) */}
                <div className="hidden md:block overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[700px] md:min-w-full">
                    <thead>
                      <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-11 border-none">
                        <th className="px-2 py-2 text-xs text-center w-16 whitespace-nowrap">KW</th>
                        <th className="px-2 py-2 text-xs text-center w-16 whitespace-nowrap">Modules</th>
                        <th className="px-2 py-2 text-xs text-right leading-tight max-w-[90px]">
                          Adani<br/>Bi-Fi
                        </th>
                        <th className="px-2 py-2 text-xs text-right leading-tight max-w-[90px]">
                          APS<br/>Bi-Fi
                        </th>
                        <th className="px-2 py-2 text-xs text-right leading-tight max-w-[85px]">
                          Rayzone
                        </th>
                        <th className="px-2 py-2 text-xs text-right leading-tight max-w-[105px]">
                          Waaree 585W<br/>TOPCon
                        </th>
                        <th className="px-2 py-2 text-xs text-right leading-tight max-w-[105px]">
                          APS TOPCon<br/>600W
                        </th>
                        <th className="px-2 py-2 text-xs text-center w-16 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-highest font-body-sm text-xs text-on-surface">
                      {localBosMatrix.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-surface-container-low/60 transition-colors ${idx % 2 === 1 ? 'bg-surface-container-low/20' : ''}`}>
                          {/* Capacity KW */}
                          <td className="px-2 py-2.5 font-bold font-mono text-inverse-surface text-center whitespace-nowrap">
                            {isInlineEditingMatrix ? (
                              <input
                                type="number"
                                step="0.01"
                                value={row.capacityKW}
                                onChange={(e) => handleMatrixCellChange(idx, 'capacityKW', e.target.value)}
                                className="w-14 px-1 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs font-mono font-bold text-center"
                              />
                            ) : (
                              `${row.capacityKW} kW`
                            )}
                          </td>

                          {/* No of Modules */}
                          <td className="px-2 py-2.5 font-semibold text-primary font-mono text-center whitespace-nowrap">
                            {isInlineEditingMatrix ? (
                              <input
                                type="number"
                                value={getModules(row)}
                                onChange={(e) => handleMatrixCellChange(idx, 'noOfModules', e.target.value)}
                                className="w-12 px-1 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs font-mono text-primary font-bold text-center"
                              />
                            ) : (
                              getModules(row)
                            )}
                          </td>

                          {/* Adani Bi-Fi */}
                          <td className="px-2 py-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                            {isInlineEditingMatrix ? (
                              <input
                                type="number"
                                value={getAdaniPrice(row)}
                                onChange={(e) => handleMatrixCellChange(idx, 'adaniBiFiPrice', e.target.value)}
                                className="w-20 px-1 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs text-right font-mono"
                              />
                            ) : (
                              <span className="whitespace-nowrap">₹ {Number(getAdaniPrice(row)).toLocaleString('en-IN')}</span>
                            )}
                          </td>

                          {/* APS Bi-Fi */}
                          <td className="px-2 py-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                            {isInlineEditingMatrix ? (
                              <input
                                type="number"
                                value={getApsBiFiPrice(row)}
                                onChange={(e) => handleMatrixCellChange(idx, 'apsBiFiPrice', e.target.value)}
                                className="w-20 px-1 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs text-right font-mono"
                              />
                            ) : (
                              <span className="whitespace-nowrap">₹ {Number(getApsBiFiPrice(row)).toLocaleString('en-IN')}</span>
                            )}
                          </td>

                          {/* Rayzone */}
                          <td className="px-2 py-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                            {isInlineEditingMatrix ? (
                              <input
                                type="number"
                                value={getRayzonePrice(row)}
                                onChange={(e) => handleMatrixCellChange(idx, 'rayzonePrice', e.target.value)}
                                className="w-20 px-1 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs text-right font-mono"
                              />
                            ) : (
                              <span className="whitespace-nowrap">₹ {Number(getRayzonePrice(row)).toLocaleString('en-IN')}</span>
                            )}
                          </td>

                          {/* Waaree 585W TOPCon */}
                          <td className="px-2 py-2.5 text-right font-mono font-bold text-primary whitespace-nowrap tabular-nums">
                            {isInlineEditingMatrix ? (
                              <input
                                type="number"
                                value={getWaareePrice(row)}
                                onChange={(e) => handleMatrixCellChange(idx, 'waaree585Price', e.target.value)}
                                className="w-20 px-1 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs text-right font-mono text-primary font-bold"
                              />
                            ) : (
                              <span className="whitespace-nowrap">₹ {Number(getWaareePrice(row)).toLocaleString('en-IN')}</span>
                            )}
                          </td>

                          {/* APS TOPCon 600W */}
                          <td className="px-2 py-2.5 text-right font-mono font-bold text-[#256676] whitespace-nowrap tabular-nums">
                            {isInlineEditingMatrix ? (
                              <input
                                type="number"
                                value={getApsTopconPrice(row)}
                                onChange={(e) => handleMatrixCellChange(idx, 'apsTopcon600Price', e.target.value)}
                                className="w-20 px-1 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs text-right font-mono text-[#256676] font-bold"
                              />
                            ) : (
                              <span className="whitespace-nowrap">₹ {Number(getApsTopconPrice(row)).toLocaleString('en-IN')}</span>
                            )}
                          </td>

                          {/* Actions: Edit Modal / Delete */}
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditSlabModal(idx)}
                                className="p-1 rounded hover:bg-surface-container text-secondary hover:text-primary transition-colors cursor-pointer"
                                title="Edit this slab in modal"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSlab(idx)}
                                className="p-1 rounded hover:bg-rose-50 text-secondary hover:text-rose-600 transition-colors cursor-pointer"
                                title="Delete this slab"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isInlineEditingMatrix && (
                  <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-secondary italic">
                      Tip: Modify the input fields directly in the table, then click &quot;Save Matrix Changes&quot; to apply.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveMatrix()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-xs font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Save Matrix Changes</span>
                    </button>
                  </div>
                )}
              </div>

              {/* DEDICATED INVERTER SIZING & BENCHMARK PRICING MATRIX (SR-57) */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-4 sm:p-6 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                      <span className="material-symbols-outlined text-xl">electric_bolt</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-headline-md text-base sm:text-headline-md text-inverse-surface font-bold">
                          Inverter Sizing &amp; Benchmark Pricing Matrix
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          {inverterBenchmarkMatrix.length} Ratings
                        </span>
                      </div>
                      <p className="font-body-sm text-xs sm:text-body-sm text-secondary mt-0.5">
                        Standard grid-tied string inverter benchmark pricing and phase topologies decoupled from module BOS tiers.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={handleOpenAddInvModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>Add Inverter Spec</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isInlineEditingInverters) {
                          handleSaveInverterMatrix();
                        } else {
                          setIsInlineEditingInverters(true);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        isInlineEditingInverters
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isInlineEditingInverters ? 'check' : 'edit'}
                      </span>
                      <span>{isInlineEditingInverters ? 'Save Inverter Prices' : 'Edit Inverter Prices'}</span>
                    </button>
                  </div>
                </div>

                {/* MOBILE VIEW: Responsive Inverter Cards (< md) */}
                <div className="block md:hidden space-y-3">
                  {inverterBenchmarkMatrix.map((inv, idx) => (
                    <div
                      key={inv.id || idx}
                      className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-surface-container-high/60 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isInlineEditingInverters ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-semibold text-secondary">KW:</span>
                              <input
                                type="number"
                                step="0.1"
                                value={inv.capacityKW}
                                onChange={(e) => handleInverterCellChange(idx, 'capacityKW', e.target.value)}
                                className="w-16 px-1.5 py-1 bg-surface-container-low border border-surface-container-high rounded text-xs font-mono font-bold text-center"
                              />
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-inverse-surface text-surface-container-lowest font-mono font-bold text-xs">
                              {inv.capacityKW} kW
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {inv.phase}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditInvModal(idx)}
                            className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-primary transition-colors cursor-pointer"
                            title="Edit inverter"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit_note</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInverterBenchmark(idx)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-secondary hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete inverter"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                        <div className="min-w-0 flex-1">
                          {isInlineEditingInverters ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={inv.brand}
                                onChange={(e) => handleInverterCellChange(idx, 'brand', e.target.value)}
                                placeholder="Brand"
                                className="w-full px-1.5 py-1 bg-surface-container-low border border-surface-container-high rounded text-xs font-semibold"
                              />
                              <input
                                type="text"
                                value={inv.series}
                                onChange={(e) => handleInverterCellChange(idx, 'series', e.target.value)}
                                placeholder="Series"
                                className="w-full px-1.5 py-1 bg-surface-container-low border border-surface-container-high rounded text-[11px] text-secondary"
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-on-surface truncate">{inv.brand}</div>
                              <div className="text-[11px] text-secondary truncate">{inv.series}</div>
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-semibold text-secondary uppercase">Benchmark Price</div>
                          {isInlineEditingInverters ? (
                            <input
                              type="number"
                              value={inv.benchmarkPrice}
                              onChange={(e) => handleInverterCellChange(idx, 'benchmarkPrice', e.target.value)}
                              className="w-24 mt-1 px-1.5 py-1 bg-surface-container-low border border-surface-container-high rounded text-xs font-mono font-bold text-right"
                            />
                          ) : (
                            <div className="font-mono font-bold text-sm text-on-surface mt-0.5">
                              ₹ {Number(inv.benchmarkPrice || 0).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP VIEW: Full Comparison Table (>= md) */}
                <div className="hidden md:block overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[700px] md:min-w-full">
                    <thead>
                      <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-10 border-none">
                        <th className="px-3 py-2 text-xs font-semibold whitespace-nowrap min-w-[110px]">Capacity (kW)</th>
                        <th className="px-3 py-2 text-xs font-semibold min-w-[200px]">Brand / Series</th>
                        <th className="px-3 py-2 text-xs font-semibold min-w-[160px]">Topology / Phase</th>
                        <th className="px-3 py-2 text-xs font-semibold text-right min-w-[150px] whitespace-nowrap">Benchmark Price (₹)</th>
                        <th className="px-3 py-2 text-xs font-semibold text-center w-24 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-highest font-body-sm text-xs text-on-surface">
                      {inverterBenchmarkMatrix.map((inv, idx) => (
                        <tr key={inv.id || idx} className={`hover:bg-surface-container-low/60 transition-colors ${idx % 2 === 1 ? 'bg-surface-container-low/20' : ''}`}>
                          {/* Capacity (kW) */}
                          <td className="px-3 py-2.5 font-bold font-mono text-inverse-surface whitespace-nowrap">
                            {isInlineEditingInverters ? (
                              <input
                                type="number"
                                step="0.1"
                                value={inv.capacityKW}
                                onChange={(e) => handleInverterCellChange(idx, 'capacityKW', e.target.value)}
                                className="w-16 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs font-mono font-bold"
                              />
                            ) : (
                              `${inv.capacityKW} kW`
                            )}
                          </td>

                          {/* Brand / Series */}
                          <td className="px-3 py-2.5">
                            {isInlineEditingInverters ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={inv.brand}
                                  onChange={(e) => handleInverterCellChange(idx, 'brand', e.target.value)}
                                  placeholder="Brand"
                                  className="w-1/2 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs font-medium"
                                />
                                <input
                                  type="text"
                                  value={inv.series}
                                  onChange={(e) => handleInverterCellChange(idx, 'series', e.target.value)}
                                  placeholder="Series / Model"
                                  className="w-1/2 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs text-secondary"
                                />
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-on-surface">{inv.brand}</div>
                                <div className="text-[11px] text-secondary">{inv.series}</div>
                              </div>
                            )}
                          </td>

                          {/* Topology / Phase */}
                          <td className="px-3 py-2.5">
                            {isInlineEditingInverters ? (
                              <input
                                type="text"
                                value={inv.phase}
                                onChange={(e) => handleInverterCellChange(idx, 'phase', e.target.value)}
                                className="w-36 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs"
                              />
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {inv.phase}
                              </span>
                            )}
                          </td>

                          {/* Benchmark Price */}
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-inverse-surface whitespace-nowrap tabular-nums">
                            {isInlineEditingInverters ? (
                              <input
                                type="number"
                                value={inv.benchmarkPrice}
                                onChange={(e) => handleInverterCellChange(idx, 'benchmarkPrice', e.target.value)}
                                className="w-28 px-1.5 py-1 bg-surface-container-lowest border border-surface-container-highest rounded text-xs text-right font-mono font-bold"
                              />
                            ) : (
                              <span>₹ {Number(inv.benchmarkPrice || 0).toLocaleString('en-IN')}</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditInvModal(idx)}
                                className="p-1 rounded hover:bg-surface-container text-secondary hover:text-primary transition-colors cursor-pointer"
                                title="Edit inverter benchmark"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInverterBenchmark(idx)}
                                className="p-1 rounded hover:bg-rose-50 text-secondary hover:text-rose-600 transition-colors cursor-pointer"
                                title="Delete inverter benchmark"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isInlineEditingInverters && (
                  <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between">
                    <span className="text-xs text-secondary italic">
                      Tip: Edit prices or capacities inline, then click &quot;Save Inverter Prices&quot; to apply.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveInverterMatrix()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-label-md text-xs font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Save Inverter Prices</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION A: Base Turnkey Pricing per kW */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container-low">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface">Tier-based Base EPC Pricing (Turnkey BOS + Modules)</h2>
                      <p className="font-body-sm text-body-sm text-secondary">Standard reference baseline enforced in dealer quotation calculations prior to dealer margin addon.</p>
                    </div>
                  </div>
                  <span className="font-label-xs text-label-xs bg-surface-container-low text-secondary px-2.5 py-1 rounded border border-surface-container-highest">Currency: INR (₹)</span>
                </div>
                {/* Tier Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Tier 1 */}
                  <div className="border border-surface-container-highest rounded-lg p-4 bg-surface-container-lowest hover:border-primary-container/60 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-label-md text-label-md font-bold text-on-surface">Residential (1 to 3 kW)</span>
                        <span className="font-label-xs text-label-xs bg-surface-container px-2 py-0.5 rounded text-secondary">Small Grid</span>
                      </div>
                      <label className="font-body-sm text-body-sm text-secondary block mb-1.5">Base Rate per kW</label>
                      <div className="relative flex items-center mb-3">
                        <span className="absolute left-3 font-semibold text-secondary">₹</span>
                        <input
                          className="w-full pl-8 pr-12 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-headline-sm font-headline-sm font-bold text-inverse-surface focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                          type="number"
                          value={rate1to3}
                          onChange={(e) => setRate1to3(e.target.value)}
                        />
                        <span className="absolute right-3 font-label-xs text-label-xs text-secondary">/ kW</span>
                      </div>
                      <div className="flex items-center justify-between text-body-sm text-secondary bg-surface-container-low px-2 py-1.5 rounded">
                        <span>Benchmark</span>
                        <span className="font-semibold text-on-surface">Avg Market: ₹63.5k</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between">
                      <span className="font-label-xs text-label-xs text-secondary">Enforce Minimum Floor</span>
                      <input defaultChecked className="rounded text-primary-container focus:ring-primary-container w-4 h-4 cursor-pointer" type="checkbox"/>
                    </div>
                  </div>

                  {/* Tier 2 */}
                  <div className="border border-surface-container-highest rounded-lg p-4 bg-surface-container-lowest hover:border-primary-container/60 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-label-md text-label-md font-bold text-on-surface">Residential (3 to 10 kW)</span>
                        <span className="font-label-xs text-label-xs bg-primary-container/15 text-primary px-2 py-0.5 rounded font-semibold">High Volume Tier</span>
                      </div>
                      <label className="font-body-sm text-body-sm text-secondary block mb-1.5">Base Rate per kW</label>
                      <div className="relative flex items-center mb-3">
                        <span className="absolute left-3 font-semibold text-secondary">₹</span>
                        <input
                          className="w-full pl-8 pr-12 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-headline-sm font-headline-sm font-bold text-inverse-surface focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                          type="number"
                          value={rate3to10}
                          onChange={(e) => setRate3to10(e.target.value)}
                        />
                        <span className="absolute right-3 font-label-xs text-label-xs text-secondary">/ kW</span>
                      </div>
                      <div className="flex items-center justify-between text-body-sm text-secondary bg-surface-container-low px-2 py-1.5 rounded">
                        <span>Gross 5 kW Est.</span>
                        <span className="font-semibold text-on-surface">₹ {(Number(rate3to10) * 5).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between">
                      <span className="font-label-xs text-label-xs text-secondary">Enforce Minimum Floor</span>
                      <input defaultChecked className="rounded text-primary-container focus:ring-primary-container w-4 h-4 cursor-pointer" type="checkbox"/>
                    </div>
                  </div>

                  {/* Tier 3 */}
                  <div className="border border-surface-container-highest rounded-lg p-4 bg-surface-container-lowest hover:border-primary-container/60 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-label-md text-label-md font-bold text-on-surface">Commercial (C&amp;I &gt; 10 kW)</span>
                        <span className="font-label-xs text-label-xs bg-tertiary-container/20 text-tertiary px-2 py-0.5 rounded font-semibold">LT / HT Commercial</span>
                      </div>
                      <label className="font-body-sm text-body-sm text-secondary block mb-1.5">Base Rate per kW</label>
                      <div className="relative flex items-center mb-3">
                        <span className="absolute left-3 font-semibold text-secondary">₹</span>
                        <input
                          className="w-full pl-8 pr-12 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-headline-sm font-headline-sm font-bold text-inverse-surface focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                          type="number"
                          value={rateCommercial}
                          onChange={(e) => setRateCommercial(e.target.value)}
                        />
                        <span className="absolute right-3 font-label-xs text-label-xs text-secondary">/ kW</span>
                      </div>
                      <div className="flex items-center justify-between text-body-sm text-secondary bg-surface-container-low px-2 py-1.5 rounded">
                        <span>Structure Scope</span>
                        <span className="font-semibold text-on-surface text-[11px]">Excl. HT Yard</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between">
                      <span className="font-label-xs text-label-xs text-secondary">Custom Margin Review</span>
                      <input defaultChecked className="rounded text-primary-container focus:ring-primary-container w-4 h-4 cursor-pointer" type="checkbox"/>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: Central Govt. PM Surya Ghar Subsidy Slabs */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">account_balance</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface">Central Govt. PM Surya Ghar Subsidy Matrix</h2>
                      <p className="font-body-sm text-body-sm text-secondary">National DBT Portal guidelines for Direct Benefit Transfer applied to quote sheets.</p>
                    </div>
                  </div>
                  <span className="font-label-xs text-label-xs bg-primary-container/15 text-primary px-3 py-1 rounded-full font-bold self-start sm:self-center">
                    MNRE National Portal DBT Matrix 2024-25
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-surface-container-low border border-surface-container-highest relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-primary-container"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-label-md text-label-md font-bold text-on-surface">Capacity: 1.0 kW</span>
                      <span className="font-label-xs text-label-xs text-secondary">Slab Tier 1</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-secondary mb-1">Fixed Central Subsidy</p>
                    <div className="text-headline-lg font-headline-lg text-primary font-bold">₹ 30,000</div>
                    <p className="font-label-xs text-label-xs text-secondary mt-2">Flat ₹30,000/kW assistance</p>
                  </div>
                  <div className="p-4 rounded-lg bg-surface-container-low border border-surface-container-highest relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-primary-container"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-label-md text-label-md font-bold text-on-surface">Capacity: 2.0 kW</span>
                      <span className="font-label-xs text-label-xs text-secondary">Slab Tier 2</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-secondary mb-1">Cumulative Central Subsidy</p>
                    <div className="text-headline-lg font-headline-lg text-primary font-bold">₹ 60,000</div>
                    <p className="font-label-xs text-label-xs text-secondary mt-2">Direct deposit to beneficiary account</p>
                  </div>
                  <div className="p-4 rounded-lg bg-surface-container-low border border-surface-container-highest relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-primary-container"></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-label-md text-label-md font-bold text-on-surface">Capacity: 3.0 kW &amp; Above</span>
                      <span className="font-label-xs text-label-xs text-secondary">Maximum Cap</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-secondary mb-1">Max Residential Subsidy</p>
                    <div className="text-headline-lg font-headline-lg text-primary font-bold">₹ 78,000</div>
                    <p className="font-label-xs text-label-xs text-secondary mt-2">Capped at ₹78k for ≥ 3 kW</p>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-surface border border-surface-container-highest flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-secondary text-lg mt-0.5">info</span>
                  <p className="font-body-sm text-body-sm text-secondary">
                    <strong className="text-on-surface">DBT Process Note:</strong> Subsidy is automatically credited via DBT directly to customer Aadhaar-linked bank account upon Discom net-metering commissioning and joint inspection report upload.
                  </p>
                </div>
              </div>

              {/* SECTION B.2: Dealer Commission Tiers & Default Margins */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">price_check</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface">
                        Dealer Commission Tiers &amp; Default Margin Ceilings
                      </h2>
                      <p className="font-body-sm text-body-sm text-secondary">
                        Configure base dealer margins and anti-gouging regulatory caps automatically enforced per partner tier.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const hasChanges = Object.keys(localTierMargins || {}).some(key => {
                        const existing = tierMargins?.[key];
                        const updated = localTierMargins?.[key];
                        if (!existing || !updated) return true;
                        return Number(existing.defaultMarginPerKw) !== Number(updated.defaultMarginPerKw) ||
                               Number(existing.maxMarginCapPerKw) !== Number(updated.maxMarginCapPerKw);
                      });

                      if (!hasChanges) {
                        triggerToast('No changes detected in tier default margins.');
                        return;
                      }

                      if (updateTierMargins) {
                        updateTierMargins(localTierMargins);
                      }
                      triggerToast(`Tier default margins saved and broadcasted to ${totalDealersCount} Gujarat dealers!`);
                    }}
                    className="px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-label-md text-xs sm:text-sm font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Save Tier Margins</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'diamond', name: 'Diamond EPC Partner', desc: 'Premier High-Volume Partners (> 5.0 MW/quarter)', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                    { key: 'platinum', name: 'Platinum Tier', desc: 'Tier-1 Large Scale EPC (> 3.0 MW/quarter)', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { key: 'gold', name: 'Gold EPC Partner', desc: 'Established Standard Installers (1.5 - 3.0 MW/quarter)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { key: 'silver', name: 'Silver Installer', desc: 'Entry / Regional Empanelled Installers (< 1.5 MW/quarter)', badge: 'bg-slate-100 text-slate-700 border-slate-300' }
                  ].map((tier) => {
                    const conf = localTierMargins[tier.key] || tierMargins?.[tier.key] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 };
                    return (
                      <div key={tier.key} className="p-4 rounded-xl border border-surface-container-highest bg-surface-container-low/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${tier.badge}`}>
                            {tier.name}
                          </span>
                        </div>
                        <p className="text-xs text-secondary">{tier.desc}</p>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-xs font-semibold text-on-surface mb-1">
                              Default Margin (₹/kW)
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-secondary font-bold text-xs">₹</span>
                              <input
                                type="number"
                                value={conf.defaultMarginPerKw}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setLocalTierMargins((prev) => ({
                                    ...prev,
                                    [tier.key]: {
                                      ...(prev[tier.key] || tierMargins[tier.key]),
                                      defaultMarginPerKw: val
                                    }
                                  }));
                                }}
                                className="w-full h-9 pl-7 pr-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-on-surface mb-1">
                              Ceiling Cap (₹/kW)
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-secondary font-bold text-xs">₹</span>
                              <input
                                type="number"
                                value={conf.maxMarginCapPerKw}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setLocalTierMargins((prev) => ({
                                    ...prev,
                                    [tier.key]: {
                                      ...(prev[tier.key] || tierMargins[tier.key]),
                                      maxMarginCapPerKw: val
                                    }
                                  }));
                                }}
                                className="w-full h-9 pl-7 pr-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B.3: Real-Time System Synchronization (SR-58) */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                      <span className="material-symbols-outlined text-xl">sync</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface font-bold">
                        Real-Time System Synchronization
                      </h2>
                      <p className="font-body-sm text-body-sm text-secondary">
                        Automated state propagation of pricing matrices, subsidy guidelines, and BOM catalog to Gujarat dealer portals.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Real-Time Sync Active</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-surface-container-highest bg-surface-container-low/50 flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-600 text-xl mt-0.5">verified</span>
                    <div>
                      <div className="font-bold text-on-surface text-sm">{totalDealersCount} Authorized Dealers</div>
                      <p className="text-xs text-secondary mt-0.5">Active Gujarat solar EPC partners connected to live calculation engine.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-surface-container-highest bg-surface-container-low/50 flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-xl mt-0.5">sync_alt</span>
                    <div>
                      <div className="font-bold text-on-surface text-sm">Discom Tariff Grids Synced</div>
                      <p className="text-xs text-secondary mt-0.5">PGVCL, DGVCL, UGVCL, and MGVCL net-metering slabs unified.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-surface-container-highest bg-surface-container-low/50 flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 text-xl mt-0.5">verified_user</span>
                    <div>
                      <div className="font-bold text-on-surface text-sm">ALMM Module List Validated</div>
                      <p className="text-xs text-secondary mt-0.5">Approved MNRE List-I TOPCon &amp; Mono Bifacial panels verified.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-surface-container-low flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-secondary">
                    <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                    <span>Last synced: {pricingMaster?.lastSynced || 'Today, just now'}</span>
                  </div>
                  <span className="text-xs text-secondary">Changes published via top action bar instantly trigger in-app updates</span>
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MODULES & INVERTERS MASTER                                         */}
          {/* ========================================================================= */}
          {activeTab === 'modules' && (
            <>
              {/* Hardware Defaults Form for Quotation Generator */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container-low">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">solar_power</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface">Default System Specifications for Quotation Generator</h2>
                      <p className="font-body-sm text-body-sm text-secondary">These hardware specifications auto-populate when a dealer creates a new residential or light-commercial estimate.</p>
                    </div>
                  </div>
                  <span className="font-label-xs text-label-xs bg-surface-container px-2.5 py-1 rounded text-secondary font-semibold">Tier-1 Hardware</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Module Defaults */}
                  <div className="border border-surface-container-highest rounded-lg p-4 bg-surface-container-low">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">grid_view</span>
                        <h3 className="font-label-md text-label-md font-bold text-on-surface">Default Solar Module</h3>
                      </div>
                      <span className="font-label-xs text-label-xs bg-primary-container/15 text-primary px-2 py-0.5 rounded font-semibold">ALMM Approved</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="font-body-sm text-body-sm text-secondary block mb-1">Assigned Make &amp; Model</label>
                        <select
                          value={selectedDefaultModule}
                          onChange={(e) => setSelectedDefaultModule(e.target.value)}
                          className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                        >
                          <option>Waaree 585W TOPCon Bifacial (ALMM List-I)</option>
                          <option>APS 600W TOPCon Bifacial (ALMM List-I)</option>
                          <option>Adani Bi-Fi 550W Vertex Mono PERC</option>
                          <option>APS Bi-Fi 550W Mono Bifacial</option>
                          <option>Rayzone 550W Bifacial TOPCon</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-body-sm text-body-sm text-secondary block mb-1">Module Rating</label>
                          <input
                            className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                            type="text"
                            value={moduleRating}
                            onChange={(e) => setModuleRating(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="font-body-sm text-body-sm text-secondary block mb-1">Module Efficiency</label>
                          <input
                            className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                            type="text"
                            value={moduleEfficiency}
                            onChange={(e) => setModuleEfficiency(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="font-body-sm text-body-sm text-secondary block mb-1">Warranty Term Rendered on PDF</label>
                        <input
                          className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                          type="text"
                          value={moduleWarranty}
                          onChange={(e) => setModuleWarranty(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Inverter Defaults */}
                  <div className="border border-surface-container-highest rounded-lg p-4 bg-surface-container-low">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">electrical_services</span>
                        <h3 className="font-label-md text-label-md font-bold text-on-surface">Default Solar Inverter</h3>
                      </div>
                      <span className="font-label-xs text-label-xs bg-primary-container/15 text-primary px-2 py-0.5 rounded font-semibold">Cloud IoT Sync</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="font-body-sm text-body-sm text-secondary block mb-1">Assigned Make &amp; Series</label>
                        <select
                          value={selectedDefaultInverter}
                          onChange={(e) => setSelectedDefaultInverter(e.target.value)}
                          className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                        >
                          <option>Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)</option>
                          <option>Solis S6 Pro Series 5kW 3-Phase</option>
                          <option>Sungrow SG5.0RS Residential Grid-Tied</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-body-sm text-body-sm text-secondary block mb-1">Topology &amp; Interface</label>
                          <input
                            className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                            type="text"
                            value={inverterTopology}
                            onChange={(e) => setInverterTopology(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="font-body-sm text-body-sm text-secondary block mb-1">Peak Efficiency</label>
                          <input
                            className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                            type="text"
                            value={inverterEfficiency}
                            onChange={(e) => setInverterEfficiency(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="font-body-sm text-body-sm text-secondary block mb-1">Warranty Term Rendered on PDF</label>
                        <input
                          className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                          type="text"
                          value={inverterWarranty}
                          onChange={(e) => setInverterWarranty(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Master Catalog: Approved Solar Modules */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">grid_view</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface font-bold">
                        Approved Solar Modules Master Catalog
                      </h2>
                      <p className="font-body-sm text-body-sm text-secondary">
                        ALMM List-I compliant high-efficiency bifacial &amp; mono PERC modules for Gujarat installations. Newly added modules will display a "NEW" badge for dealers until selected.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-xs text-label-xs bg-primary-container/15 text-primary px-2.5 py-1 rounded-full font-bold">
                      {modulesList?.length ?? 0} ALMM Models
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddModuleModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-container hover:bg-primary text-on-primary rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>Add New Module</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-10 border-none">
                        <th className="px-3 py-2 text-xs whitespace-nowrap">Brand &amp; Make</th>
                        <th className="px-3 py-2 text-xs whitespace-nowrap">Model Name</th>
                        <th className="px-3 py-2 text-xs whitespace-nowrap">Cell Technology</th>
                        <th className="px-3 py-2 text-xs text-center whitespace-nowrap">Wattage (Wp)</th>
                        <th className="px-3 py-2 text-xs text-center whitespace-nowrap">Efficiency</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Benchmark Wp Rate</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Warranty</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Dealer Pricing</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-highest font-body-sm text-xs text-on-surface">
                      {(modulesList || []).map((mod, idx) => {
                        const rawRate = typeof mod.ratePerWp === 'string' ? parseFloat(mod.ratePerWp.replace(/[^0-9.]/g, '')) : Number(mod.ratePerWp);
                        const bench = rawRate || 18.25;
                        const modId = mod.id || `mod-${mod.brand}-${mod.wattage}`;
                        const modName = `${mod.brand} ${mod.wattage ? `${mod.wattage}W` : ''} ${mod.model || ''}`.trim();
                        return (
                          <tr key={mod.id || idx} className="hover:bg-surface-container-low/60 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-inverse-surface whitespace-nowrap flex items-center gap-1.5">
                              <span>{mod.brand}</span>
                              {mod.isNew && (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                  NEW
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-primary whitespace-nowrap">{mod.model}</td>
                            <td className="px-3 py-2.5 text-secondary whitespace-nowrap">{mod.cellTech}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-on-surface whitespace-nowrap">{mod.wattage} W</td>
                            <td className="px-3 py-2.5 text-center font-mono whitespace-nowrap">{mod.efficiency}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-inverse-surface whitespace-nowrap tabular-nums">{mod.ratePerWp}</td>
                            <td className="px-3 py-2.5 text-right text-secondary whitespace-nowrap">{mod.warranty}</td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenDealerOverride({
                                  id: modId,
                                  name: modName,
                                  category: 'module',
                                  benchmarkPrice: bench,
                                  unit: '₹/Wp'
                                })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary-container/15 hover:bg-primary-container hover:text-on-primary text-primary transition-colors text-[11px] font-semibold cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">tune</span>
                                <span>Set Dealer Rate</span>
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDeleteModule(idx)}
                                title="Delete module from catalog"
                                className="text-secondary hover:text-error transition-colors p-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Master Catalog: Approved Solar Inverters */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">bolt</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface font-bold">
                        Approved Solar Inverters Master Catalog
                      </h2>
                      <p className="font-body-sm text-body-sm text-secondary">
                        Grid-tied string inverters with built-in Wi-Fi monitoring and dual MPPT algorithms. Newly added models show a "NEW" badge for dealers until selected.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-xs text-label-xs bg-primary-container/15 text-primary px-2.5 py-1 rounded-full font-bold">
                      {invertersList?.length ?? 0} Certified Series
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddInverterModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-container hover:bg-primary text-on-primary rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>Add New Inverter</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[680px]">
                    <thead>
                      <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-10 border-none">
                        <th className="px-3 py-2 text-xs">Brand</th>
                        <th className="px-3 py-2 text-xs">Series / Model</th>
                        <th className="px-3 py-2 text-xs text-center">Rated Capacity</th>
                        <th className="px-3 py-2 text-xs">Phase Topology</th>
                        <th className="px-3 py-2 text-xs text-center">Peak Efficiency</th>
                        <th className="px-3 py-2 text-right">Warranty Term</th>
                        <th className="px-3 py-2 text-center">Cloud Sync</th>
                        <th className="px-3 py-2 text-center">Dealer Pricing</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-highest font-body-sm text-xs text-on-surface">
                      {(invertersList || []).map((inv, idx) => {
                        const capKW = parseFloat(inv.capacityKW || inv.capacity) || 5.0;
                        const bench = inv.benchmarkPrice || (capKW <= 3 ? 28000 : capKW <= 5 ? 42000 : 70000);
                        const invId = inv.id || `inv-${inv.brand}-${capKW}`;
                        const invName = `${inv.brand} ${inv.capacity ? inv.capacity : `${capKW} kW`} ${inv.model || ''}`.trim();
                        return (
                          <tr key={inv.id || idx} className="hover:bg-surface-container-low/60 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-inverse-surface flex items-center gap-1.5">
                              <span>{inv.brand}</span>
                              {inv.isNew && (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                  NEW
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-primary">{inv.model}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-on-surface">{inv.capacity}</td>
                            <td className="px-3 py-2.5 text-secondary">{inv.phase}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{inv.efficiency}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-inverse-surface">{inv.warranty}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-container/20 text-primary">
                                {inv.cloud || 'Wi-Fi IoT'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenDealerOverride({
                                  id: invId,
                                  name: invName,
                                  category: 'inverter',
                                  benchmarkPrice: bench,
                                  unit: '₹/unit'
                                })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary-container/15 hover:bg-primary-container hover:text-on-primary text-primary transition-colors text-[11px] font-semibold cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">tune</span>
                                <span>Set Dealer Rate</span>
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDeleteInverter(idx)}
                                title="Delete inverter from catalog"
                                className="text-secondary hover:text-error transition-colors p-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Dealer Negotiated Hardware Rates Table */}
              {(() => {
                const hardwareOverrides = [];
                (dealers || []).forEach(d => {
                  const cfg = d.pricingConfig || {};
                  const rates = cfg.customProductRates || {};
                  const details = cfg.productDetails || {};
                  Object.keys(rates).forEach(prodId => {
                    const detail = details[prodId];
                    if (!detail || detail.category === 'module' || detail.category === 'inverter' || prodId.startsWith('mod-') || prodId.startsWith('inv-')) {
                      hardwareOverrides.push({
                        dealerId: d.id,
                        dealerName: getDealerDisplayName(d),
                        dealerFirm: d.firmName || d.businessName || 'Channel Partner',
                        dealerCity: d.city || 'Gujarat',
                        productId: prodId,
                        productName: detail?.name || prodId,
                        category: detail?.category || (prodId.startsWith('mod-') ? 'module' : 'inverter'),
                        customPrice: rates[prodId],
                        unit: detail?.unit || (prodId.startsWith('mod-') ? '₹/Wp' : '₹/unit')
                      });
                    }
                  });
                });

                return (
                  <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-container">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary-container/15 text-primary">
                          <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                        </div>
                        <div>
                          <h3 className="font-headline-sm text-sm font-bold text-inverse-surface flex items-center gap-2">
                            Active Dealer-Wise Negotiated Hardware Rates Ledger
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {hardwareOverrides.length} Configured
                            </span>
                          </h3>
                          <p className="text-xs text-secondary mt-0.5">
                            Specific price overrides configured per authorized dealer. When quotes are generated, these prices auto-populate.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-surface-container rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-surface-container bg-surface-container-low text-secondary font-semibold uppercase text-[10px] tracking-wider">
                            <th className="py-2.5 px-3">Dealer Partner</th>
                            <th className="py-2.5 px-3">Hardware Product</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-right">Negotiated Custom Rate</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          {hardwareOverrides.length > 0 ? (
                            hardwareOverrides.map((row, idx) => (
                              <tr key={`${row.dealerId}-${row.productId}-${idx}`} className="hover:bg-surface-container-low/50 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-on-surface">{row.dealerName}</div>
                                  <div className="text-[10px] text-secondary">{row.dealerFirm} • {row.dealerCity}</div>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-on-surface">
                                  {row.productName}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    row.category === 'module'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  }`}>
                                    {row.category === 'module' ? 'Solar Module' : 'Solar Inverter'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                                  ₹{Number(row.customPrice).toLocaleString('en-IN')} {row.unit}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    Active for Dealer
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Remove custom rate for ${row.productName} on ${row.dealerName}?`)) {
                                        if (removeDealerProductRate) {
                                          removeDealerProductRate(row.dealerId, row.productId);
                                        }
                                        triggerToast(`Removed custom rate for ${row.productName}`);
                                      }
                                    }}
                                    className="px-2 py-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors text-[11px] font-medium cursor-pointer"
                                    title="Reset to benchmark"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-secondary text-xs">
                                No dealer hardware overrides configured yet. Click "Set Dealer Rate" on any module or inverter above to set dealer-specific prices.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: DEFAULT BILL OF MATERIAL (BOM)                                     */}
          {/* ========================================================================= */}
          {activeTab === 'bom' && (() => {
            const resolved = getResolvedBom ? getResolvedBom(selectedBomCapacity) : null;
            const availableCapacities = capacityBomMatrix
              ? Object.keys(capacityBomMatrix).sort((a, b) => parseFloat(a) - parseFloat(b))
              : ['2.2', '3.3', '4.4', '5.5', '6.6', '8.0', '10.0'];

            const categoryLabels = {
              structure: { name: '1. Mounting Structure (GI Pipes & Fasteners)', icon: 'foundation', desc: '60x40 & 40x40 GI pipes, anchor fasteners, L-A patti, zinc spray (6/8ft standard)' },
              electrical: { name: '2. Switchgear & Protection', icon: 'electrical_services', desc: 'Solar Inverter, ACDB+DCDB combo box, Chemical earthing kit, MC4 pairs' },
              cables: { name: '3. Solar DC & AC Cables', icon: 'cable', desc: 'Assumed Ground + 1st floor run (DC, AC, Earthing, and Lightning Arrestor copper wires)' },
              conduits: { name: '4. Conduits, Piping & Installation Fixtures', icon: 'plumbing', desc: 'Heavy-duty PVC pipes, elbows, tees, cable ties and saddle clamps' },
              safety: { name: '5. Safety, Earthing & Grounding Systems', icon: 'shield', desc: 'Chemical earthing electrodes, bentonite compound, lightning arrestor' },
              metering: { name: '6. DISCOM Metering & Grid Interconnection', icon: 'speed', desc: 'Bi-directional net meter box, solar generation meter box, safety caution plates' },
              other: { name: '7. Custom Balance of System Hardware', icon: 'build', desc: 'Specialized rooftop fixtures, auxiliary clamps, and site-specific items' }
            };

            return (
              <>
                {/* Main BOM Card */}
                <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-surface-container-low gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                        <span className="material-symbols-outlined text-xl">inventory_2</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-headline-md text-headline-md text-inverse-surface font-bold">
                            Interactive Bill of Material (BOM) &amp; BoS Preset Engine
                          </h2>
                          <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-[11px] font-bold">
                            Field Standard (3.3 kW Doc)
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                          Admin controls physical component quantities and live unit rates. Synced in real-time with Dealer Quotation Generator.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-secondary text-xs font-semibold border border-surface-container-highest">
                        <span className="material-symbols-outlined text-[16px] text-primary">cloud_done</span>
                        <span>Auto-Synced • Publish via Top Header</span>
                      </span>
                    </div>
                  </div>

                  {/* Capacity Selector Bar */}
                  <div className="mb-6 p-4 rounded-xl bg-surface-container-low/60 border border-surface-container-highest">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">tune</span>
                        <span className="font-label-md text-label-md font-bold text-on-surface">Select Capacity Preset Slab:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Add kW (e.g. 12.0)"
                            value={customBomKwInput}
                            onChange={(e) => setCustomBomKwInput(e.target.value)}
                            className="w-36 h-8 px-2.5 text-xs bg-surface-container-lowest border border-surface-container-highest rounded-lg font-mono focus:outline-none focus:border-primary"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!customBomKwInput || isNaN(parseFloat(customBomKwInput))) {
                              triggerToast('Enter a valid kW number');
                              return;
                            }
                            const formatted = parseFloat(customBomKwInput).toFixed(1);
                            // If not exists, resolve will initialize it
                            setSelectedBomCapacity(formatted);
                            setCustomBomKwInput('');
                            triggerToast(`Configuring BOM for ${formatted} kW!`);
                          }}
                          className="h-8 px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold rounded-lg cursor-pointer"
                        >
                          + Add Slab
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                      {availableCapacities.map((cap) => {
                        const isSelected = String(selectedBomCapacity) === String(cap);
                        const isDocBase = String(cap) === '3.3';
                        return (
                          <button
                            key={cap}
                            type="button"
                            onClick={() => setSelectedBomCapacity(cap)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              isSelected
                                ? 'bg-primary-container text-surface-container-lowest shadow-sm ring-2 ring-primary/20'
                                : 'bg-surface-container-lowest border border-surface-container-highest text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            <span className="font-mono">{cap} kW</span>
                            {isDocBase && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                Base Spec
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Real-time BoS Cost Summary Cards for selected capacity */}
                  {resolved && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                      <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-highest">
                        <div className="text-[11px] font-semibold text-secondary flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">foundation</span>
                          Structure
                        </div>
                        <div className="text-base sm:text-lg font-bold font-mono text-inverse-surface mt-1">
                          {formatINR(resolved.categoryTotals.structure)}
                        </div>
                        <span className="text-[10px] text-secondary">Pipes, Fasteners &amp; Hardware</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-highest">
                        <div className="text-[11px] font-semibold text-secondary flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">electrical_services</span>
                          Electrical
                        </div>
                        <div className="text-base sm:text-lg font-bold font-mono text-inverse-surface mt-1">
                          {formatINR(resolved.categoryTotals.electrical)}
                        </div>
                        <span className="text-[10px] text-secondary">Inverter, ACDB/DCDB, MC4</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-highest">
                        <div className="text-[11px] font-semibold text-secondary flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">cable</span>
                          Solar Cables
                        </div>
                        <div className="text-base sm:text-lg font-bold font-mono text-inverse-surface mt-1">
                          {formatINR(resolved.categoryTotals.cables)}
                        </div>
                        <span className="text-[10px] text-secondary">AC, DC, Earthing &amp; LA</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-highest">
                        <div className="text-[11px] font-semibold text-secondary flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">plumbing</span>
                          Conduits
                        </div>
                        <div className="text-base sm:text-lg font-bold font-mono text-inverse-surface mt-1">
                          {formatINR(resolved.categoryTotals.conduits)}
                        </div>
                        <span className="text-[10px] text-secondary">PVC pipes &amp; fixtures</span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-primary-container/10 border-2 border-primary/30">
                        <div className="text-[11px] font-bold text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">savings</span>
                          Total BoS Cost
                        </div>
                        <div className="text-base sm:text-xl font-bold font-mono text-primary mt-1">
                          {formatINR(resolved.totalBoSCost)}
                        </div>
                        <span className="text-[10px] text-secondary font-mono">
                          ~{formatINR(Math.round(resolved.totalBoSCost / (parseFloat(selectedBomCapacity) || 1)))}/kW
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Categorized BOM Components Customization Tables */}
                  {resolved && (
                    <div className="space-y-6">
                      {(() => {
                        const standardKeys = ['structure', 'electrical', 'cables', 'conduits', 'safety', 'metering', 'other'];
                        const presentCategories = Array.from(new Set(resolved.items.map(it => it.category || 'other')));
                        const sortedCategories = [
                          ...standardKeys.filter(k => presentCategories.includes(k)),
                          ...presentCategories.filter(k => !standardKeys.includes(k))
                        ];

                        return sortedCategories.map((catKey) => {
                          const catMeta = categoryLabels[catKey] || {
                            name: `${catKey.charAt(0).toUpperCase() + catKey.slice(1)} Components`,
                            icon: 'category',
                            desc: 'Custom balance of system hardware'
                          };
                          const catItems = resolved.items.filter((it) => (it.category || 'other') === catKey);
                          if (catItems.length === 0) return null;

                          return (
                            <div key={catKey} className="border border-surface-container-highest rounded-xl overflow-hidden shadow-xs">
                              <div className="bg-surface-container-low px-4 py-3 border-b border-surface-container-highest flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-primary text-lg">{catMeta.icon}</span>
                                  <h3 className="font-label-md text-label-md font-bold text-on-surface">{catMeta.name}</h3>
                                </div>
                                <span className="text-xs text-secondary hidden sm:inline">{catMeta.desc}</span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                  <thead>
                                    <tr className="bg-surface-container-lowest text-secondary text-[11px] font-semibold uppercase tracking-wider border-b border-surface-container-highest">
                                      <th className="px-4 py-2">Item Description &amp; Specification</th>
                                      <th className="px-3 py-2 text-center w-24">Unit</th>
                                      <th className="px-3 py-2 text-center w-36">Preset Qty ({selectedBomCapacity} kW)</th>
                                      <th className="px-3 py-2 text-right w-44">Unit Benchmark Rate (₹)</th>
                                      <th className="px-4 py-2 text-right w-36">Total Amount (₹)</th>
                                      <th className="px-3 py-2 text-center w-28">Dealer Rate</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-surface-container-highest font-body-sm text-xs text-on-surface">
                                    {catItems.map((item) => (
                                      <tr key={item.id} className="hover:bg-surface-container-low/40 transition-colors">
                                        <td className="px-4 py-2.5 font-medium text-inverse-surface">
                                          {item.name}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-secondary font-mono">
                                          {item.unit}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          <div className="relative inline-flex items-center justify-center">
                                            <input
                                              type="number"
                                              min="0"
                                              step="any"
                                              value={item.qty}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                if (updateCapacityBomItemQty) {
                                                  updateCapacityBomItemQty(selectedBomCapacity, item.id, val);
                                                }
                                              }}
                                              className="w-24 h-8 text-center bg-surface-container-lowest border border-surface-container-highest rounded-lg font-mono font-bold text-on-surface focus:outline-none focus:border-primary text-xs"
                                            />
                                          </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                          <div className="relative inline-flex items-center justify-end">
                                            <span className="absolute left-2.5 text-secondary text-xs">₹</span>
                                            <input
                                              type="number"
                                              min="0"
                                              step="any"
                                              value={item.unitRate}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                if (updateBomItemRate) {
                                                  updateBomItemRate(item.id, val);
                                                }
                                              }}
                                              className="w-32 h-8 pl-6 pr-2.5 text-right bg-surface-container-lowest border border-surface-container-highest rounded-lg font-mono font-semibold text-on-surface focus:outline-none focus:border-primary text-xs"
                                            />
                                          </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-inverse-surface whitespace-nowrap">
                                          {formatINR(item.totalCost)}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenDealerOverride({
                                              id: item.id,
                                              name: item.name,
                                              category: 'bom',
                                              benchmarkPrice: item.unitRate,
                                              unit: `₹/${item.unit}`
                                            })}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-primary-container hover:text-on-primary text-secondary transition-colors text-[11px] font-semibold cursor-pointer"
                                            title="Set dealer negotiated rate for this BOM item"
                                          >
                                            <span className="material-symbols-outlined text-[13px]">tune</span>
                                            <span>Dealer</span>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* Informational Callout */}
                  <div className="mt-6 p-4 rounded-xl bg-surface-container-low border border-surface-container-highest flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-xl mt-0.5">verified_user</span>
                    <div className="text-xs text-secondary leading-relaxed">
                      <strong className="text-on-surface font-semibold">Real-Time Sync Notice:</strong> Changes made here immediately update the dealer quotation calculation engine for <strong className="text-primary">{selectedBomCapacity} kW</strong> systems across all empanelled Gujarat dealers. Dealers select only the system size, module, and inverter—all BOM calculations roll up automatically!
                    </div>
                  </div>
                </div>

                {/* Active Dealer Negotiated BOM Component Rates Ledger */}
                {(() => {
                  const bomOverrides = [];
                  (dealers || []).forEach(d => {
                    const cfg = d.pricingConfig || {};
                    const rates = cfg.customProductRates || cfg.customBomRates || {};
                    const details = cfg.productDetails || {};
                    Object.keys(rates).forEach(prodId => {
                      const detail = details[prodId];
                      if (detail?.category === 'bom' || prodId.startsWith('bom-') || cfg.customBomRates?.[prodId]) {
                        bomOverrides.push({
                          dealerId: d.id,
                          dealerName: getDealerDisplayName(d),
                          dealerFirm: d.firmName || d.businessName || 'Channel Partner',
                          dealerCity: d.city || 'Gujarat',
                          productId: prodId,
                          productName: detail?.name || prodId,
                          customPrice: rates[prodId],
                          unit: detail?.unit || '₹'
                        });
                      }
                    });
                  });

                  return (
                    <div className="mt-6 bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-container">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-primary-container/15 text-primary">
                            <span className="material-symbols-outlined text-[20px]">handshake</span>
                          </div>
                          <div>
                            <h3 className="font-headline-sm text-sm font-bold text-inverse-surface flex items-center gap-2">
                              Active Dealer-Wise Negotiated BOM Component Rates Ledger
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {bomOverrides.length} Configured
                              </span>
                            </h3>
                            <p className="text-xs text-secondary mt-0.5">
                              Custom material rates negotiated for specific channel partners. When those partners generate proposals, these exact prices apply.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-surface-container rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-surface-container bg-surface-container-low text-secondary font-semibold uppercase text-[10px] tracking-wider">
                              <th className="py-2.5 px-3">Dealer Partner</th>
                              <th className="py-2.5 px-3">BOM Hardware Component</th>
                              <th className="py-2.5 px-3 text-right">Negotiated Custom Rate</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-container">
                            {bomOverrides.length > 0 ? (
                              bomOverrides.map((row, idx) => (
                                <tr key={`${row.dealerId}-${row.productId}-${idx}`} className="hover:bg-surface-container-low/50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-on-surface">{row.dealerName}</div>
                                    <div className="text-[10px] text-secondary">{row.dealerFirm} • {row.dealerCity}</div>
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-on-surface">
                                    {row.productName}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                                    ₹{Number(row.customPrice).toLocaleString('en-IN')} {row.unit}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                      Active for Dealer
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Remove custom rate for ${row.productName} on ${row.dealerName}?`)) {
                                          if (removeDealerProductRate) {
                                            removeDealerProductRate(row.dealerId, row.productId);
                                          }
                                          triggerToast(`Removed custom rate for ${row.productName}`);
                                        }
                                      }}
                                      className="px-2 py-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors text-[11px] font-medium cursor-pointer"
                                      title="Reset to benchmark"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-secondary text-xs">
                                  No dealer BOM item overrides configured yet. Click "Dealer" on any component in the tables above to assign dealer-specific rates.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Technical Quality Standards Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary text-xl">foundation</span>
                      <h3 className="font-label-md text-label-md font-bold text-inverse-surface">Mounting Structure</h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      60x40 &amp; 40x40 GI pipe (2mm thickness) with 80+ microns HDG coating. Engineered to withstand 150 km/h wind speeds per IS 875 Part-3.
                    </p>
                  </div>

                  <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary text-xl">cable</span>
                      <h3 className="font-label-md text-label-md font-bold text-inverse-surface">Solar DC &amp; AC Cables</h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      TUV Rheinland certified UV-resistant cross-linked halogen-free solar DC cables. Pure electrolytic copper conductors with minimal voltage drop (&lt; 2%).
                    </p>
                  </div>

                  <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary text-xl">shield</span>
                      <h3 className="font-label-md text-label-md font-bold text-inverse-surface">Earthing &amp; Protection</h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      Chemical earthing rods with bentonite compound. Class-II Surge Protection Devices (SPD) installed in both ACDB and DCDB enclosures.
                    </p>
                  </div>
                </div>
              </>
            );
          })()}

          {/* ========================================================================= */}
          {/* TAB 4: COMPANY BANK DETAILS & TERMS & CONDITIONS                          */}
          {/* ========================================================================= */}
          {activeTab === 'bank' && (
            <>
              {/* SECTION D: Official Bank Account for Quotation PDF Footer */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container-low">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface">Official Remittance Account (Customer Quotation Footer)</h2>
                      <p className="font-body-sm text-body-sm text-secondary">Verified Sunvine bank details automatically injected into payment schedules and PDF footers (from official PDF).</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-container/15 text-primary rounded-full font-label-xs text-label-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    <span>Verified RTGS Account</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">Beneficiary Firm Name</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface font-semibold"
                      type="text"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">Bank Name</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">Current Account Number</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface font-mono"
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">IFSC Code</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface font-mono uppercase"
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">Branch Name &amp; Clearing Location</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION E: Quotation Terms & Conditions Editor */}
              <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container-low">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                      <span className="material-symbols-outlined text-xl">gavel</span>
                    </div>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-inverse-surface">Commercial Milestones &amp; Legal Terms</h2>
                      <p className="font-body-sm text-body-sm text-secondary">Default clause presets appended to dealer quotation terms from Sunvine price matrix.</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">Default Payment Milestones</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                      type="text"
                      value={paymentMilestones}
                      onChange={(e) => setPaymentMilestones(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">Commissioning Delivery Timeline</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                      type="text"
                      value={deliveryTimeline}
                      onChange={(e) => setDeliveryTimeline(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-body-sm text-body-sm text-secondary block mb-1">Quotation Proposal Validity</label>
                    <input
                      className="w-full py-2 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface"
                      type="text"
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-surface-container-highest self-end">
                    <div>
                      <span className="font-label-md text-label-md font-bold text-on-surface block">Statutory CEIG / Net Metering</span>
                      <span className="font-body-sm text-body-sm text-secondary">Dealer Assisted Discom Liaison Included</span>
                    </div>
                    <input defaultChecked className="rounded text-primary-container focus:ring-primary-container w-4 h-4 cursor-pointer" type="checkbox"/>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: DEALER CUSTOM PRICING MATRIX & OVERRIDES (SR-62)                  */}
          {/* ========================================================================= */}
          {activeTab === 'dealer_custom' && (
            <DealerCustomPricingMatrix onShowToast={triggerToast} />
          )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PRICING SLAB                                            */}
      {/* ========================================================================= */}
      {showAddSlabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container-low">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                  <span className="material-symbols-outlined text-xl">
                    {editingRowIndex !== null ? 'edit_note' : 'add_chart'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md font-bold text-inverse-surface">
                    {editingRowIndex !== null ? `Edit ${slabForm.capacityKW} kW Pricing Slab` : 'Add New Capacity Pricing Slab'}
                  </h3>
                  <p className="text-xs text-secondary">
                    Define equipment specs and manufacturer prices (GST Included).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSlabModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSlabForm} className="space-y-4">
              {/* Capacity & Core Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    System Capacity (kW) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={slabForm.capacityKW}
                    onChange={(e) => setSlabForm({ ...slabForm, capacityKW: e.target.value })}
                    placeholder="e.g. 5.5"
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    No. of Solar Modules *
                  </label>
                  <input
                    type="number"
                    required
                    value={slabForm.noOfModules}
                    onChange={(e) => setSlabForm({ ...slabForm, noOfModules: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Inverter Rating (kW)
                  </label>
                  <input
                    type="text"
                    value={slabForm.inverterCapacityKW}
                    onChange={(e) => setSlabForm({ ...slabForm, inverterCapacityKW: e.target.value })}
                    placeholder="e.g. 5.0 or 6"
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Module Prices by Brand */}
              <div className="border-t border-surface-container-high pt-3">
                <h4 className="text-xs font-bold text-inverse-surface uppercase tracking-wider mb-2.5">
                  Manufacturer Package Prices (₹ Total Including GST)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      Adani Bi-Fi Package (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-secondary font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={slabForm.adaniBiFiPrice}
                        onChange={(e) => setSlabForm({ ...slabForm, adaniBiFiPrice: e.target.value })}
                        placeholder="e.g. 202950"
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-semibold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      APS Bi-Fi Package (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-secondary font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={slabForm.apsBiFiPrice}
                        onChange={(e) => setSlabForm({ ...slabForm, apsBiFiPrice: e.target.value })}
                        placeholder="e.g. 183150"
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-semibold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">
                      Rayzone Package (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-secondary font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={slabForm.rayzonePrice}
                        onChange={(e) => setSlabForm({ ...slabForm, rayzonePrice: e.target.value })}
                        placeholder="e.g. 183150"
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-semibold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">
                      Waaree 585W TOPCon Package (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-primary font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={slabForm.waaree585Price}
                        onChange={(e) => setSlabForm({ ...slabForm, waaree585Price: e.target.value })}
                        placeholder="e.g. 225120"
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-primary/40 rounded-lg text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#256676] mb-1">
                      APS TOPCon 600W Package (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-[#256676] font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={slabForm.apsTopcon600Price}
                        onChange={(e) => setSlabForm({ ...slabForm, apsTopcon600Price: e.target.value })}
                        placeholder="e.g. 216000"
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-[#256676]/40 rounded-lg text-xs font-mono font-bold text-[#256676] focus:outline-none focus:border-[#256676]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddSlabModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest bg-surface-container-lowest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{editingRowIndex !== null ? 'Update Slab' : 'Save New Slab'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT INVERTER BENCHMARK SPEC (SR-57)                          */}
      {/* ========================================================================= */}
      {showAddInvBenchmarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-low">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <span className="material-symbols-outlined text-xl">electric_bolt</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md font-bold text-inverse-surface">
                    {editingInvBenchmarkIdx !== null ? `Edit ${invBenchmarkForm.capacityKW} kW Inverter Spec` : 'Add Inverter Pricing Spec'}
                  </h3>
                  <p className="text-xs text-secondary">
                    Configure turnkey string inverter rating, phase topology, and benchmark pricing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInvBenchmarkModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveInvModalForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Inverter Capacity (kW) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={invBenchmarkForm.capacityKW}
                    onChange={(e) => setInvBenchmarkForm({ ...invBenchmarkForm, capacityKW: e.target.value })}
                    placeholder="e.g. 5.0"
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Benchmark Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={invBenchmarkForm.benchmarkPrice}
                    onChange={(e) => setInvBenchmarkForm({ ...invBenchmarkForm, benchmarkPrice: e.target.value })}
                    placeholder="e.g. 42000"
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Manufacturer / Brand
                </label>
                <input
                  type="text"
                  required
                  value={invBenchmarkForm.brand}
                  onChange={(e) => setInvBenchmarkForm({ ...invBenchmarkForm, brand: e.target.value })}
                  placeholder="e.g. Sunvine Smart Series, Solis, Growatt"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Series / Model Description
                </label>
                <input
                  type="text"
                  value={invBenchmarkForm.series}
                  onChange={(e) => setInvBenchmarkForm({ ...invBenchmarkForm, series: e.target.value })}
                  placeholder="e.g. 3-Phase Smart MPPT On-Grid with Wi-Fi"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Phase &amp; MPPT Topology
                </label>
                <select
                  value={invBenchmarkForm.phase}
                  onChange={(e) => setInvBenchmarkForm({ ...invBenchmarkForm, phase: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="1-Phase / Dual MPPT">1-Phase / Dual MPPT</option>
                  <option value="1-Phase / Single MPPT">1-Phase / Single MPPT</option>
                  <option value="3-Phase / Multi MPPT">3-Phase / Multi MPPT</option>
                  <option value="3-Phase / Dual MPPT">3-Phase / Dual MPPT</option>
                  <option value="3-Phase / 4-MPPT">3-Phase / 4-MPPT (Commercial)</option>
                  <option value="3-Phase / 6-MPPT">3-Phase / 6-MPPT (Industrial)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddInvBenchmarkModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest bg-surface-container-lowest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{editingInvBenchmarkIdx !== null ? 'Update Inverter Spec' : 'Save Inverter Spec'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW SOLAR MODULE                                               */}
      {/* ========================================================================= */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-low">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                  <span className="material-symbols-outlined text-xl">grid_view</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md font-bold text-inverse-surface">
                    Add New Solar Module
                  </h3>
                  <p className="text-xs text-secondary">
                    Shows "NEW" badge on dealer quotation dropdown until selected.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModuleModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveModuleForm} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Brand / Manufacturer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Waaree, Tata, Saatvik"
                    value={newModuleForm.brand}
                    onChange={(e) => setNewModuleForm({ ...newModuleForm, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Model Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 590W TOPCon Bifacial"
                    value={newModuleForm.model}
                    onChange={(e) => setNewModuleForm({ ...newModuleForm, model: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Cell Tech
                  </label>
                  <input
                    type="text"
                    placeholder="N-Type TOPCon"
                    value={newModuleForm.cellTech}
                    onChange={(e) => setNewModuleForm({ ...newModuleForm, cellTech: e.target.value })}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Wattage (Wp) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="590"
                    value={newModuleForm.wattage}
                    onChange={(e) => setNewModuleForm({ ...newModuleForm, wattage: e.target.value })}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Efficiency (%)
                  </label>
                  <input
                    type="text"
                    placeholder="22.8%"
                    value={newModuleForm.efficiency}
                    onChange={(e) => setNewModuleForm({ ...newModuleForm, efficiency: e.target.value })}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Benchmark Wp Rate (₹/Wp)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="19.50"
                    value={newModuleForm.ratePerWp}
                    onChange={(e) => setNewModuleForm({ ...newModuleForm, ratePerWp: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Warranty Term
                  </label>
                  <input
                    type="text"
                    placeholder="30 Yrs Linear"
                    value={newModuleForm.warranty}
                    onChange={(e) => setNewModuleForm({ ...newModuleForm, warranty: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddModuleModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Add Module to Catalog</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW SOLAR INVERTER                                             */}
      {/* ========================================================================= */}
      {showAddInverterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-low">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary-container/10 text-primary">
                  <span className="material-symbols-outlined text-xl">bolt</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md font-bold text-inverse-surface">
                    Add New Solar Inverter
                  </h3>
                  <p className="text-xs text-secondary">
                    Shows "NEW" badge on dealer quotation dropdown until selected.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInverterModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveInverterForm} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Brand / Manufacturer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sungrow, Solis, Deye"
                    value={newInverterForm.brand}
                    onChange={(e) => setNewInverterForm({ ...newInverterForm, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Series / Model Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SG6.0RS Dual MPPT"
                    value={newInverterForm.model}
                    onChange={(e) => setNewInverterForm({ ...newInverterForm, model: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Rated Capacity
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5.0 kW / 6.0 kW"
                    value={newInverterForm.capacity}
                    onChange={(e) => setNewInverterForm({ ...newInverterForm, capacity: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Phase Topology
                  </label>
                  <input
                    type="text"
                    placeholder="1-Phase 230V / 2 MPPT"
                    value={newInverterForm.phase}
                    onChange={(e) => setNewInverterForm({ ...newInverterForm, phase: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Efficiency
                  </label>
                  <input
                    type="text"
                    placeholder="98.5%"
                    value={newInverterForm.efficiency}
                    onChange={(e) => setNewInverterForm({ ...newInverterForm, efficiency: e.target.value })}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Warranty
                  </label>
                  <input
                    type="text"
                    placeholder="8 Years"
                    value={newInverterForm.warranty}
                    onChange={(e) => setNewInverterForm({ ...newInverterForm, warranty: e.target.value })}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Cloud IoT
                  </label>
                  <input
                    type="text"
                    placeholder="Integrated Wi-Fi"
                    value={newInverterForm.cloud}
                    onChange={(e) => setNewInverterForm({ ...newInverterForm, cloud: e.target.value })}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setShowAddInverterModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Add Inverter to Catalog</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Decommissioned WhatsApp Price Update Broadcast Modal (SR-58) */}
      {false && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-surface-container-highest animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">forum</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                    Broadcast Price Update to WhatsApp
                  </h3>
                  <p className="text-xs text-secondary">
                    Transmit official benchmark rates &amp; DBT subsidy slabs across {totalDealersCount} Gujarat EPC partners
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppBroadcastModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Broadcast Options Banner */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-700 text-2xl shrink-0">mark_chat_unread</span>
                  <div>
                    <span className="font-bold text-emerald-900 text-xs sm:text-sm block">Broadcast to All Dealer Groups</span>
                    <span className="text-[11px] text-emerald-800">Opens WhatsApp Web with pre-formatted catalog text ready to share with any group or contact.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenWhatsAppBroadcast();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  <span>Launch WhatsApp Web</span>
                </button>
              </div>

              {/* Pre-formatted Message Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-secondary">drafts</span>
                    Pre-formatted Broadcast Message Preview
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyBroadcastMessage}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">{copiedMessage ? 'check' : 'content_copy'}</span>
                    <span>{copiedMessage ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-highest text-xs font-mono text-on-surface whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed select-all">
                  {getBroadcastMessage()}
                </div>
              </div>

              {/* Send to Specific Dealer or Custom Contact */}
              <div className="border-t border-surface-container-low pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Direct Send to Specific Partner Contact
                  </h4>
                  <span className="text-[11px] text-secondary">Search from {totalDealersCount} Gujarat dealers</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-base">search</span>
                    <input
                      type="text"
                      placeholder="Search dealer by name, city, or phone..."
                      value={dealerSearchQuery}
                      onChange={(e) => setDealerSearchQuery(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Custom phone input */}
                  <div className="relative sm:w-48 flex items-center">
                    <span className="absolute left-2.5 text-xs text-secondary font-mono">+91</span>
                    <input
                      type="tel"
                      placeholder="Custom 10-digit #"
                      value={customBroadcastPhone}
                      onChange={(e) => setCustomBroadcastPhone(e.target.value)}
                      className="w-full h-9 pl-11 pr-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!customBroadcastPhone || customBroadcastPhone.replace(/\D/g, '').length < 10}
                    onClick={() => handleOpenWhatsAppBroadcast(customBroadcastPhone)}
                    className="h-9 px-3 bg-primary-container hover:bg-primary text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1 shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    <span>Send Custom</span>
                  </button>
                </div>

                {/* Filtered Dealers Mini List */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-surface-container-highest rounded-xl p-2 bg-surface-container-lowest">
                  {(dealers || [])
                    .filter((d) => {
                      if (!dealerSearchQuery.trim()) return true;
                      const q = dealerSearchQuery.toLowerCase();
                      return (
                        (d.name && d.name.toLowerCase().includes(q)) ||
                        (d.city && d.city.toLowerCase().includes(q)) ||
                        (d.phone && d.phone.toLowerCase().includes(q)) ||
                        (d.company && d.company.toLowerCase().includes(q))
                      );
                    })
                    .slice(0, 10)
                    .map((dealer, dIdx) => (
                      <div
                        key={dIdx}
                        className="p-2 rounded-lg bg-surface-container-low/50 hover:bg-surface-container-low flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-on-surface truncate flex items-center gap-1.5">
                            <span>{dealer.name || dealer.company}</span>
                            {dealer.tier && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary uppercase font-bold">
                                {dealer.tier}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-secondary flex items-center gap-2 mt-0.5">
                            <span>{dealer.city || 'Gujarat'}</span>
                            <span>•</span>
                            <span className="font-mono">{dealer.phone || '+91 98250 12345'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppBroadcast(dealer.phone || '9825012345')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <span className="material-symbols-outlined text-[13px]">chat</span>
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container-low flex items-center justify-between shrink-0">
              <span className="text-[11px] text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-emerald-600">security</span>
                Official Sunvine Broadcast protocol active
              </span>
              <button
                type="button"
                onClick={() => setShowWhatsAppBroadcastModal(false)}
                className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SET DEALER NEGOTIATED PRODUCT PRICE                                */}
      {/* ========================================================================= */}
      {dealerOverrideModal.isOpen && dealerOverrideModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary-container/20 text-primary">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-base font-bold text-inverse-surface">
                    Set Dealer Negotiated Rate
                  </h3>
                  <p className="text-xs text-secondary">
                    Configure custom rate for {dealerOverrideModal.product.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDealerOverrideModal({ isOpen: false, product: null })}
                className="text-secondary hover:text-on-surface p-1 rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex items-center justify-between text-xs">
                <div>
                  <span className="text-secondary block text-[11px]">Selected Item</span>
                  <span className="font-bold text-on-surface">{dealerOverrideModal.product.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-secondary block text-[11px]">Benchmark Rate</span>
                  <span className="font-mono font-bold text-primary">
                    ₹{dealerOverrideModal.product.benchmarkPrice.toLocaleString('en-IN')} {dealerOverrideModal.product.unit}
                  </span>
                </div>
              </div>

              {/* 1. Select Dealer Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Select Dealer Partner
                </label>
                <select
                  value={overrideTargetDealerId}
                  onChange={(e) => {
                    const dId = e.target.value;
                    setOverrideTargetDealerId(dId);
                    const targetD = accessibleDealersList.find(x => x.id === dId);
                    const existing = targetD?.pricingConfig?.customProductRates?.[dealerOverrideModal.product.id] ?? targetD?.pricingConfig?.customProductRates?.[dealerOverrideModal.product.name];
                    if (existing !== undefined && existing !== null) {
                      setOverrideRateInput(String(existing));
                    } else {
                      setOverrideRateInput(String(dealerOverrideModal.product.benchmarkPrice || ''));
                    }
                  }}
                  className="w-full h-10 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                >
                  {accessibleDealersList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {getDealerDisplayName(d)} ({d.city || 'Gujarat'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Custom Negotiated Price */}
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Negotiated Custom Rate ({dealerOverrideModal.product.unit})
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-secondary font-mono text-xs">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={overrideRateInput}
                    onChange={(e) => setOverrideRateInput(e.target.value)}
                    className="w-full h-10 pl-7 pr-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                {overrideRateInput && !isNaN(parseFloat(overrideRateInput)) && (
                  <span className="text-[11px] font-mono mt-1 block">
                    Delta vs Benchmark:{' '}
                    <span className={parseFloat(overrideRateInput) < dealerOverrideModal.product.benchmarkPrice ? 'text-emerald-400 font-bold' : parseFloat(overrideRateInput) > dealerOverrideModal.product.benchmarkPrice ? 'text-amber-400 font-bold' : 'text-secondary'}>
                      {parseFloat(overrideRateInput) === dealerOverrideModal.product.benchmarkPrice
                        ? 'Equal to Benchmark'
                        : `${parseFloat(overrideRateInput) < dealerOverrideModal.product.benchmarkPrice ? '-' : '+'}₹${Math.abs(Math.round((parseFloat(overrideRateInput) - dealerOverrideModal.product.benchmarkPrice) * 100) / 100).toLocaleString('en-IN')} ${dealerOverrideModal.product.unit}`}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setDealerOverrideModal({ isOpen: false, product: null })}
                className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDealerOverride}
                className="px-5 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Save Rate for Dealer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
