import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { quotationService } from '../../services/quotationService';
import { useToast } from '../Shared/Toast';
import PanelLayoutVisualizer from '../Shared/PanelLayoutVisualizer';
import { GROUPED_SOLAR_BANKS } from '../../data/solarBanksData';
import SolarBankSelectorModal from '../Shared/SolarBankSelectorModal';
import ViewModeToggle, { useTableViewMode } from '../Shared/ViewModeToggle';
import {
  generateFieldBOM,
  calculateFieldBOMTotals,
  FIELD_BOM_MASTER_CATALOG
} from '../../data/standardBomData';

const formatINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹\u00A00';
  return '₹\u00A0' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const SOLAR_PANEL_BRANDS = [
  { id: 'waaree', name: 'Waaree Energies', tech: 'TOPCon Mono Bifacial Dual Glass', defaultWp: 585, ratePerWp: 18.25 },
  { id: 'adani', name: 'Adani Solar', tech: 'Elan Bi-Fi Mono PERC Half-Cut', defaultWp: 550, ratePerWp: 17.80 },
  { id: 'aps', name: 'APS / Sunvine Premier', tech: 'TOPCon Mono Bifacial Tier-1', defaultWp: 600, ratePerWp: 18.00 },
  { id: 'rayzone', name: 'Rayzone Solar', tech: 'Bi-Fi Mono PERC Half-Cut', defaultWp: 550, ratePerWp: 17.50 },
  { id: 'vikram', name: 'Vikram Solar', tech: 'Hypersol N-Type TOPCon', defaultWp: 580, ratePerWp: 18.10 },
  { id: 'goldi', name: 'Goldi Solar', tech: 'Heloc Pro Mono Bifacial', defaultWp: 550, ratePerWp: 17.65 }
];

export const STANDARD_WATTS = [540, 550, 580, 585, 600];
export const QUICK_PANEL_COUNTS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24];

export const BOM_MOBILE_CATEGORIES = [
  { id: 'all', label: 'All Items' },
  { id: 'major', label: 'Solar & Inverter (5%)', match: ['panel', 'inverter'] },
  { id: 'structure', label: 'Structure & Mounting', match: ['structure'] },
  { id: 'electrical', label: 'Electrical & ACDB', match: ['electrical'] },
  { id: 'cables', label: 'Cables & Conduits', match: ['cables', 'conduits'] },
  { id: 'other', label: 'Logistics / Custom', match: ['logistics', 'custom'] }
];

export const getAutoMatchingInverter = (kwVal) => {
  if (kwVal <= 2.5) return 'Sunvine Solaryaan 2.2G (1-Phase)';
  if (kwVal <= 3.6) return 'Sunvine Solaryaan 3.3G (1-Phase 2 MPPT)';
  if (kwVal <= 5.5) return 'Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)';
  if (kwVal <= 6.8) return 'Sunvine Solaryaan 6.0G (3-Phase Smart MPPT)';
  if (kwVal <= 11.0) return 'Growatt / Deye 10.0 KW 3-Phase';
  return 'Industrial String Inverter 3-Phase';
};

export default function CreateQuotation() {
  const { 
    currentDealer, 
    role,
    dealers,
    currentStaff,
    addQuotation, 
    updateQuotation, 
    saveDesignRecord,
    editingQuotation, 
    clearEditingQuotation, 
    activeDraftQuote,
    setActiveDraftQuote,
    clearActiveDraftQuote,
    setActiveTab, 
    setPreviewQuotation,
    addNotification,
    pricingPresets,
    tierMargins,
    modulesList,
    invertersList,
    isCatalogItemNew,
    markCatalogItemSeen,
    kitsPresets,
    saveKitPreset,
    deleteKitPreset,
    getAccessibleDealers,
    updateDealerPricing
  } = useApp();

  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';
  const initialSource = editingQuotation || activeDraftQuote;

  // Strictly filter dealers: Sales staff only sees their assigned dealers; Admin sees all
  const accessibleDealers = useMemo(() => {
    return getAccessibleDealers ? getAccessibleDealers() : (dealers || []);
  }, [getAccessibleDealers, dealers, role, currentStaff]);

  // Channel configuration (Direct Company Quote vs Dealer Partner)
  const [quoteChannel, setQuoteChannel] = useState(() => {
    if (initialSource?.isDirectCompanyQuote !== undefined) {
      return initialSource.isDirectCompanyQuote ? 'direct' : 'dealer';
    }
    return isAdmin ? 'direct' : 'dealer';
  });

  const [assignedDealerId, setAssignedDealerId] = useState(() => {
    if (initialSource?.dealerCode && initialSource?.dealerCode !== 'SV-DIRECT') {
      return initialSource.dealerCode;
    }
    return currentDealer?.id || (accessibleDealers && accessibleDealers[0]?.id) || 'SV-DLR-0104';
  });

  const isDirectCompanyQuote = (isAdmin || isStaff) ? (quoteChannel === 'direct') : false;
  const effectiveDealer = isDirectCompanyQuote
    ? null
    : ((isAdmin || isStaff) ? (accessibleDealers?.find(d => d.id === assignedDealerId) || currentDealer) : currentDealer);

  // Pricing mode: 'standard' (Company Base Price) vs 'custom' (Dealer Negotiated Price)
  const [bomPricingMode, setBomPricingMode] = useState(() => {
    if (initialSource?.pricingMode) return initialSource.pricingMode;
    return effectiveDealer?.pricingConfig?.pricingMode === 'custom' ? 'custom' : 'standard';
  });

  // Derive dealer tier margin configuration & custom pricing
  const dealerTierKey = isDirectCompanyQuote ? 'gold' :
                        (effectiveDealer?.tier || '').toLowerCase().includes('diamond') ? 'diamond' :
                        (effectiveDealer?.tier || '').toLowerCase().includes('platinum') ? 'platinum' :
                        (effectiveDealer?.tier || '').toLowerCase().includes('silver') ? 'silver' : 'gold';
  const tierConfig = isDirectCompanyQuote
    ? { defaultMarginPerKw: 0, maxMarginCapPerKw: 0 }
    : (tierMargins?.[dealerTierKey] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 });

  // Custom Negotiated Dealer Pricing Resolution
  const hasCustomDealerPricing = Boolean(!isDirectCompanyQuote && (bomPricingMode === 'custom' || effectiveDealer?.pricingConfig?.pricingMode === 'custom'));
  const customWpRate = hasCustomDealerPricing ? Number(effectiveDealer?.pricingConfig?.customBaseRatePerWp) : null;
  const customKwRate = hasCustomDealerPricing ? Number(effectiveDealer?.pricingConfig?.customBaseRatePerKw) : null;
  const customMarginKw = hasCustomDealerPricing ? Number(effectiveDealer?.pricingConfig?.customMarginPerKw) : null;
  const customDiscountPercent = hasCustomDealerPricing ? Number(effectiveDealer?.pricingConfig?.customDiscountPercent || 0) : 0;

  // Step 1.1 Customer Details (Persisted across multi-step navigation)
  const [custName, setCustName] = useState(initialSource?.customerName || '');
  const [custPhone, setCustPhone] = useState(initialSource?.customerPhone || '');
  const [custLocation, setCustLocation] = useState(initialSource?.location || initialSource?.city || '');
  const [financeType, setFinanceType] = useState(initialSource?.financeType || initialSource?.paymentMode || 'CASH');
  const [loanBank, setLoanBank] = useState(initialSource?.loanBank || 'State Bank of India (Surya Ghar Loan)');
  const [customCoverUrl, setCustomCoverUrl] = useState(initialSource?.customCoverUrl || initialSource?.coverImage || '');

  // Step 1.2 Dynamic Hardware: Brand -> Wattage (Wp) -> Panel Quantity -> Auto kW
  const [panelBrand, setPanelBrand] = useState(() => {
    if (initialSource?.selectedModuleMake) return initialSource.selectedModuleMake;
    if (initialSource?.solarModule) {
      const match = SOLAR_PANEL_BRANDS.find(b => initialSource.solarModule.includes(b.name));
      if (match) return match.name;
    }
    return 'Waaree Energies';
  });

  const [panelWatt, setPanelWatt] = useState(() => {
    if (initialSource?.moduleWattage) return Number(initialSource.moduleWattage);
    const m = (initialSource?.solarModule || initialSource?.panelType || '').match(/(\d{3})\s*W/i);
    return m ? Number(m[1]) : 585;
  });

  const [panelQuantity, setPanelQuantity] = useState(() => {
    if (initialSource?.moduleCount) return Number(initialSource.moduleCount);
    const rawKw = parseFloat(initialSource?.systemCapacityKW || initialSource?.capacity || 3.3);
    return Math.max(1, Math.round((rawKw * 1000) / 585)) || 6;
  });

  // Auto-calculated System Capacity (kW) = (Wattage * Quantity) / 1000
  const kw = Number(((panelWatt * panelQuantity) / 1000).toFixed(2));
  const moduleCount = panelQuantity;
  const rooftopAreaSqFt = Math.round(kw * 64);

  // Inverter Model with auto-suggestion
  const [inverterModel, setInverterModel] = useState(() => {
    return initialSource?.inverterType || getAutoMatchingInverter(kw);
  });
  const [userOverrodeInverter, setUserOverrodeInverter] = useState(false);

  useEffect(() => {
    if (!userOverrodeInverter && !editingQuotation) {
      setInverterModel(getAutoMatchingInverter(kw));
    }
  }, [kw, userOverrodeInverter, editingQuotation]);

  const [projectType, setProjectType] = useState(() => {
    if (initialSource?.projectType) return initialSource.projectType;
    if (typeof initialSource?.type === 'string' && initialSource.type.includes('Commercial')) return 'Commercial';
    return 'Residential';
  });
  const [showInverterModal, setShowInverterModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  // 2D Solar Panel Structure & Mounting Layout Studio
  const [showLayoutStudio, setShowLayoutStudio] = useState(false);
  const [layoutStudioInitialTab, setLayoutStudioInitialTab] = useState('2d');
  const [isInlineLayoutOpen, setIsInlineLayoutOpen] = useState(false);
  const [selectedStructureLayout, setSelectedStructureLayout] = useState(() => {
    return initialSource?.structureLayout || null;
  });

  const [quotationRoofConfig, setQuotationRoofConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('sunvine_saved_roof_config');
      return saved ? JSON.parse(saved) : (initialSource?.roofConfig || null);
    } catch (e) {
      return initialSource?.roofConfig || null;
    }
  });

  const handleUpdateRoofConfig = newCfg => {
    setQuotationRoofConfig(newCfg);
    try {
      localStorage.setItem('sunvine_saved_roof_config', JSON.stringify(newCfg));
    } catch (e) {}
  };

  // Multi-Panel Quotation Toggle
  const [multiBrandComparison, setMultiBrandComparison] = useState(initialSource?.multiBrandComparison || false);

  // Step 1.3 Pricing & Dynamic Rates with Per-Panel & Rate/Wp Bidirectional Reactivity
  const activeBrandObj = SOLAR_PANEL_BRANDS.find(b => b.name === panelBrand) || SOLAR_PANEL_BRANDS[0];
  const initialWpRate = customWpRate || activeBrandObj.ratePerWp || 18.00;
  const [ratePerWp, setRatePerWp] = useState(initialWpRate);
  const [perPanelPrice, setPerPanelPrice] = useState(() => Math.round(initialWpRate * (panelWatt || 585)));
  const [isRateDropdownOpen, setIsRateDropdownOpen] = useState(false);

  // Bidirectional reactivity handlers
  const handleRatePerWpChange = (val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setRatePerWp(num);
    setPerPanelPrice(Math.round(num * panelWatt));
  };

  const handlePerPanelPriceChange = (val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setPerPanelPrice(num);
    if (panelWatt > 0) {
      setRatePerWp(parseFloat((num / panelWatt).toFixed(2)));
    }
  };

  // Sync when brand, watt, or custom pricing mode updates
  useEffect(() => {
    if (customWpRate && bomPricingMode === 'custom') {
      setRatePerWp(customWpRate);
      setPerPanelPrice(Math.round(customWpRate * panelWatt));
    } else {
      const brandRate = activeBrandObj.ratePerWp || 18.00;
      setRatePerWp(brandRate);
      setPerPanelPrice(Math.round(brandRate * panelWatt));
    }
  }, [panelBrand, panelWatt, customWpRate, bomPricingMode]);

  const defaultKwRate = customKwRate || pricingPresets?.baseRatePerKw || 59800;
  const [ratePerKw, setRatePerKw] = useState(() => Number(initialSource?.baseRatePerKW) || defaultKwRate);

  useEffect(() => {
    if (customKwRate && bomPricingMode === 'custom') {
      setRatePerKw(customKwRate);
    } else if (pricingPresets?.baseRatePerKw) {
      setRatePerKw(pricingPresets.baseRatePerKw);
    }
  }, [customKwRate, pricingPresets?.baseRatePerKw, bomPricingMode]);

  // Margin configuration
  const effectiveMarginPerKw = isDirectCompanyQuote ? 0 : (
    customMarginKw !== null ? customMarginKw : (tierConfig?.defaultMarginPerKw || 4500)
  );

  const [marginMode, setMarginMode] = useState('amount');
  const [dealerMarginRate, setDealerMarginRate] = useState(isDirectCompanyQuote ? 0 : 8);
  const [dealerMarginFixed, setDealerMarginFixed] = useState(() => {
    if (initialSource?.dealerTotalMargin !== undefined) return Number(initialSource.dealerTotalMargin);
    if (isDirectCompanyQuote) return 0;
    return effectiveMarginPerKw * kw;
  });
  const [saveStatus, setSaveStatus] = useState('');

  // Inverter procurement price mapping
  const inverterProcurementPrice = useMemo(() => {
    if (kw <= 2.5) return 12500;
    if (kw <= 3.6) return 14400; // Standard 3.3G from Image 2
    if (kw <= 5.5) return 21000;
    if (kw <= 6.8) return 26000;
    if (kw <= 11.0) return 38000;
    return 55000;
  }, [kw]);

  // Initial Field BOM items list
  const [bomItems, setBomItems] = useState(() => {
    if (initialSource?.bomItems && Array.isArray(initialSource.bomItems) && initialSource.bomItems.length > 0) {
      return initialSource.bomItems;
    }
    return generateFieldBOM({
      kw,
      panelBrand,
      panelWatt,
      panelQuantity,
      ratePerWp,
      inverterModel,
      inverterPrice: inverterProcurementPrice,
      customBomRates: (bomPricingMode === 'custom' && effectiveDealer?.pricingConfig?.customBomRates) 
        ? effectiveDealer.pricingConfig.customBomRates 
        : {}
    });
  });

  // Selected kit preset for loading & View Mode
  const [bomViewMode, setBomViewMode] = useTableViewMode('dealer_quote_bom', 'table');
  const [mobileBomCategory, setMobileBomCategory] = useState('all');
  const [selectedKitId, setSelectedKitId] = useState('');
  const [isSaveKitModalOpen, setIsSaveKitModalOpen] = useState(false);
  const [newKitName, setNewKitName] = useState('');
  const [showAddCustomBomItemModal, setShowAddCustomBomItemModal] = useState(false);
  const [customItemForm, setCustomItemForm] = useState({
    item: '',
    category: 'custom',
    unit: 'NOS',
    qty: 1,
    rate: 1000,
    taxRate: 18,
    specs: ''
  });

  // Auto-sync solar panels & inverters in BOM when inputs change
  useEffect(() => {
    if (editingQuotation && initialSource?.bomItems) return; // Keep existing quotation items if editing
    setBomItems(prev => {
      const hasPanel = prev.some(i => i.id === 'solar_panel');
      if (!hasPanel) {
        return generateFieldBOM({
          kw,
          panelBrand,
          panelWatt,
          panelQuantity,
          ratePerWp,
          inverterModel,
          inverterPrice: inverterProcurementPrice,
          customBomRates: (bomPricingMode === 'custom' && effectiveDealer?.pricingConfig?.customBomRates) 
            ? effectiveDealer.pricingConfig.customBomRates 
            : {}
        });
      }
      return prev.map(item => {
        if (item.id === 'solar_panel') {
          const baseRate = Math.round(panelWatt * ratePerWp);
          const total = baseRate * panelQuantity;
          const totalWithGst = Math.round(total * 1.05);
          return {
            ...item,
            item: `${panelBrand} ${panelWatt}W TOPCon Bifacial Panel`,
            qty: panelQuantity,
            rate: baseRate,
            ratePerWp,
            total,
            totalWithGst
          };
        }
        if (item.id === 'solar_inverter') {
          const total = inverterProcurementPrice * 1;
          const totalWithGst = Math.round(total * 1.05);
          return {
            ...item,
            item: `${inverterModel} (Dual MPPT / IP65)`,
            rate: inverterProcurementPrice,
            total,
            totalWithGst
          };
        }
        // Scalable structure items update unless user explicitly modified qty
        if (item.id === 'gi_pipe_60x40' && !item.userOverridden) {
          const dynamicQty = Math.max(2, Math.round(panelQuantity * 0.5));
          return {
            ...item,
            qty: dynamicQty,
            total: dynamicQty * item.rate,
            totalWithGst: Math.round(dynamicQty * item.rate * 1.18)
          };
        }
        if (item.id === 'gi_pipe_40x40' && !item.userOverridden) {
          const dynamicQty = Math.max(2, Math.round(panelQuantity * 0.5));
          return {
            ...item,
            qty: dynamicQty,
            total: dynamicQty * item.rate,
            totalWithGst: Math.round(dynamicQty * item.rate * 1.18)
          };
        }
        if (item.id === 'j_bolt' && !item.userOverridden) {
          const dynamicQty = Math.max(4, Math.round(panelQuantity * 1.5));
          return {
            ...item,
            qty: dynamicQty,
            total: dynamicQty * item.rate,
            totalWithGst: Math.round(dynamicQty * item.rate * 1.18)
          };
        }
        return item;
      });
    });
  }, [kw, panelBrand, panelWatt, panelQuantity, ratePerWp, inverterModel, inverterProcurementPrice]);

  // Live BOM Totals
  const bomTotals = useMemo(() => {
    return calculateFieldBOMTotals(bomItems);
  }, [bomItems]);

  // Mobile Filtered Category Items
  const filteredMobileBomItems = useMemo(() => {
    if (mobileBomCategory === 'all') return bomItems;
    const catObj = BOM_MOBILE_CATEGORIES.find(c => c.id === mobileBomCategory);
    if (!catObj || !catObj.match) return bomItems;
    return bomItems.filter(i => catObj.match.includes(i.category || ''));
  }, [bomItems, mobileBomCategory]);

  // Item quantity updater
  const handleBomQtyChange = (itemId, newQty) => {
    const numericQty = Math.max(0, Number(newQty) || 0);
    setBomItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const gst = item.gstRate !== undefined ? item.gstRate : (item.taxRate !== undefined ? item.taxRate : 18);
      const total = numericQty * item.rate;
      const totalWithGst = Math.round(total * (1 + gst / 100));
      return {
        ...item,
        qty: numericQty,
        total,
        totalWithGst,
        gstRate: gst,
        taxRate: gst,
        userOverridden: true
      };
    }));
  };

  // Item unit rate updater
  const handleBomRateChange = (itemId, newRate) => {
    const numericRate = Math.max(0, Number(newRate) || 0);
    setBomItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const gst = item.gstRate !== undefined ? item.gstRate : (item.taxRate !== undefined ? item.taxRate : 18);
      const total = item.qty * numericRate;
      const totalWithGst = Math.round(total * (1 + gst / 100));
      return {
        ...item,
        rate: numericRate,
        total,
        totalWithGst,
        gstRate: gst,
        taxRate: gst,
        userOverridden: true
      };
    }));
  };

  // Item deletion
  const handleRemoveBomItem = (itemId) => {
    setBomItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Custom Item insertion
  const handleAddCustomBomItem = (e) => {
    if (e) e.preventDefault();
    if (!customItemForm.item.trim()) return;
    const qty = Math.max(1, Number(customItemForm.qty) || 1);
    const rate = Math.max(0, Number(customItemForm.rate) || 0);
    const taxRate = Number(customItemForm.taxRate) || 18;
    const total = qty * rate;
    const totalWithGst = Math.round(total * (1 + taxRate / 100));

    setBomItems(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        item: customItemForm.item.trim(),
        category: customItemForm.category || 'custom',
        unit: customItemForm.unit || 'NOS',
        qty,
        rate,
        taxRate,
        total,
        totalWithGst,
        specs: customItemForm.specs || 'Custom Field Item',
        isCustom: true
      }
    ]);
    setShowAddCustomBomItemModal(false);
    setCustomItemForm({
      item: '',
      category: 'custom',
      unit: 'NOS',
      qty: 1,
      rate: 1000,
      taxRate: 18,
      specs: ''
    });
    addToast({
      title: 'Item Added to BOM',
      message: `Added custom line item to field BOM.`,
      type: 'success'
    });
  };

  // Apply Kit Preset
  const handleApplyKitPreset = (kitId) => {
    const targetKit = (kitsPresets || []).find(k => k.id === kitId);
    if (!targetKit || !targetKit.items) return;
    setBomItems(targetKit.items);
    if (targetKit.capacityKw) {
      const panelItem = targetKit.items.find(i => i.id === 'solar_panel');
      if (panelItem && panelItem.qty) {
        setPanelQuantity(panelItem.qty);
      }
    }
    addToast({
      title: 'Kit Preset Loaded',
      message: `Loaded ${targetKit.name} with ${targetKit.items.length} BOM line items.`,
      type: 'success'
    });
  };

  // Save current BOM as Kit Preset
  const handleSaveAsKit = async () => {
    if (!newKitName.trim()) {
      addToast({
        title: 'Kit Name Required',
        message: 'Please enter a recognizable name for this solar BOM kit.',
        type: 'warning'
      });
      return;
    }
    const newKit = {
      id: `kit-${Date.now()}`,
      name: newKitName.trim(),
      capacityKw: kw,
      createdBy: role === 'admin' ? 'Sunvine Admin HO' : currentStaff?.name || 'Sales Staff',
      creatorRole: role,
      creatorStaffId: role === 'staff' ? currentStaff?.id : null,
      items: bomItems
    };
    if (saveKitPreset) {
      await saveKitPreset(newKit);
    }
    setIsSaveKitModalOpen(false);
    setNewKitName('');
    addToast({
      title: 'Kit Preset Saved',
      message: `Kit "${newKit.name}" saved successfully for reuse across quotations.`,
      type: 'success'
    });
  };


  // Turnkey Base Cost before dealer margin strictly follows Field BOM Totals!
  const baseProjectCost = bomTotals.grossTurnkeyCost;

  // Commercial margin computation (dual mode: % or fixed ₹ amount)
  // For dealer partners: Custom Dealer Margin. For direct company quotes: Sunvine HO Company Margin.
  const dealerMarginINR = marginMode === 'percent'
    ? Math.round(baseProjectCost * (dealerMarginRate / 100))
    : Math.round(dealerMarginFixed);

  // Discount (if negotiated)
  const discountAmount = customDiscountPercent > 0 ? Math.round((baseProjectCost + dealerMarginINR) * (customDiscountPercent / 100)) : 0;

  // Turnkey gross cost inclusive of GST
  const grossTurnkeyBeforeSubsidy = Math.max(0, baseProjectCost + dealerMarginINR - discountAmount);
  const totalCost = grossTurnkeyBeforeSubsidy;

  // Transparent GST Invoice Breakdown:
  const baseBeforeGst = bomTotals.totalTaxableBase;
  const gstAmount = bomTotals.totalGstAmount;

  // Equipment & Service Component Breakdown from BOM:
  const moduleEstimatedCost = bomItems.find(i => i.id === 'solar_panel')?.total || Math.round(panelWatt * panelQuantity * ratePerWp);
  const inverterEstimatedCost = bomItems.find(i => i.id === 'solar_inverter')?.total || inverterProcurementPrice;
  const structureEstimatedCost = bomItems.filter(i => i.category === 'structure').reduce((sum, i) => sum + i.total, 0);
  const bosEstimatedCost = bomItems.filter(i => ['bos', 'cable', 'earthing', 'fastener'].includes(i.category)).reduce((sum, i) => sum + i.total, 0);
  const transportCharge = bomItems.find(i => i.id === 'transportation')?.total || 1000;
  const installationEstimatedCost = Math.round(kw * 2500);

  // Effective margin percentage
  const effectiveMarginPercent = baseProjectCost > 0
    ? ((dealerMarginINR / baseProjectCost) * 100).toFixed(1)
    : '0.0';

  // Tier Margin Cap & Audit Validation
  const maxMarginCapPerKw = isDirectCompanyQuote ? 0 : (effectiveDealer?.maxMarginCapPerKw || tierConfig?.maxMarginCapPerKw || 6000);
  const currentMarginPerKw = (isDirectCompanyQuote || kw <= 0) ? 0 : Math.round(dealerMarginINR / kw);
  const isMarginExceeded = isDirectCompanyQuote ? false : (currentMarginPerKw > maxMarginCapPerKw);

  // PM Surya Ghar Central DBT Subsidy Formula
  const calculateSubsidy = (capacity, type) => {
    if (type === 'Commercial') return 0;
    const maxSubsidy = pricingPresets?.subsidyCap || 78000;
    if (capacity <= 1) return Math.min(30000, maxSubsidy);
    if (capacity <= 2) return Math.min(60000, maxSubsidy);
    return maxSubsidy;
  };

  const subsidy = calculateSubsidy(kw, projectType);
  const finalPayable = Math.max(0, totalCost - subsidy);
  const annualGenerationUnits = Math.round(kw * 1440);
  const monthlyGenerationUnits = Math.round(annualGenerationUnits / 12);
  const annualSavings = Math.round(annualGenerationUnits * 6.67);
  const monthlySavings = Math.round(annualSavings / 12);
  const paybackYears = annualSavings > 0 ? (finalPayable / annualSavings).toFixed(1) : '3.8';
  const paybackPercent = Math.min(100, Math.round((parseFloat(paybackYears) / 10) * 100));
  const breakEvenYear = new Date().getFullYear() + Math.ceil(parseFloat(paybackYears));

  // Multi-brand comparison package calculator (Waaree vs APS vs Adani)
  const multiBrandPackages = useMemo(() => {
    if (!multiBrandComparison) return null;
    const candidates = [
      { name: 'Waaree 585W TOPCon Bifacial', brand: 'Waaree', wattage: 585, rateOffset: 0 },
      { name: 'APS 600W TOPCon Bifacial', brand: 'APS', wattage: 600, rateOffset: -600 },
      { name: 'Adani 550W Vertex Mono PERC', brand: 'Adani', wattage: 550, rateOffset: +500 }
    ];
    return candidates.map((c) => {
      const pWatt = c.wattage;
      const count = Math.ceil((kw * 1000) / pWatt);
      const pkgRate = ratePerKw + c.rateOffset;
      const bCost = Math.round(kw * pkgRate);
      const tCost = bCost + dealerMarginINR;
      const payable = Math.max(0, tCost - subsidy);
      return {
        brand: c.brand,
        name: c.name,
        wattage: pWatt,
        moduleCount: count,
        ratePerKw: pkgRate,
        baseCost: bCost,
        totalCost: tCost,
        subsidy,
        netPayable: payable
      };
    });
  }, [multiBrandComparison, kw, ratePerKw, dealerMarginINR, subsidy]);

  const availableInverters = [
    { name: 'Sunvine Solar Hybrid Inverter 5kW 3-Phase', efficiency: '98.4%', specs: 'Built-in WiFi Smart Logger • IP65 Protection' },
    { name: 'Sunvine On-Grid String Inverter 5kW Single Phase', efficiency: '98.2%', specs: 'Dual MPPT • Zero Export Device Compatible' },
    { name: 'Sungrow SG5.0RS Residential Inverter', efficiency: '98.5%', specs: 'Ultra-silent convection cooling • 10 Yr Warranty' },
    { name: 'Solis S6 Pro Series 5kW 3-Phase Hybrid', efficiency: '98.6%', specs: 'AFCI Arc Fault Protection • Generator Sync' }
  ];

  const handleReset = () => {
    if (clearEditingQuotation) clearEditingQuotation();
    if (clearActiveDraftQuote) clearActiveDraftQuote();
    setCustName('');
    setCustPhone('');
    setCustLocation('');
    setSystemCapacity('3.3');
    setPanelBrand('Waaree 585W TOPCon Bifacial (ALMM List-I)');
    setInverterModel('Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)');
    setProjectType('Residential');
    setMultiBrandComparison(false);
    setRatePerKw(pricingPresets?.baseRatePerKw || 59800);
    if (isAdmin) {
      setQuoteChannel('direct');
      setDealerMarginFixed(0);
      setDealerMarginRate(0);
    } else {
      setDealerMarginFixed(tierConfig.defaultMarginPerKw * 3.3);
    }
  };

  const handleSaveDraft = async () => {
    if (!custName.trim()) {
      addToast({
        title: 'Customer Name Required',
        message: 'Please enter the customer name before saving the draft.',
        type: 'warning'
      });
      return;
    }

    const isEdit = Boolean(editingQuotation?.id);
    const resolvedDealerCode = isDirectCompanyQuote ? 'SV-DIRECT' : (effectiveDealer?.id || currentDealer?.id || 'SV-DLR-0104');
    const resolvedDealerName = isDirectCompanyQuote ? 'Sunvine Renewable Energy (Head Office)' : (effectiveDealer?.firmName || currentDealer?.firmName || 'Rajesh Solar Solutions');

    const fullPanelDescription = `${panelBrand} ${panelWatt}W TOPCon Bifacial (${panelWatt}Wp)`;
    const quotePayload = {
      id: isEdit ? editingQuotation.id : `SV-2026-Q${Math.floor(100 + Math.random() * 900)}`,
      date: isEdit ? (editingQuotation.date || new Date().toLocaleDateString('en-GB')) : new Date().toLocaleDateString('en-GB'),
      customerName: custName,
      customerPhone: custPhone,
      location: custLocation,
      city: custLocation.split(',')[0]?.trim() || 'Rajkot',
      state: 'Gujarat',
      projectType,
      type: `${panelBrand.split(' ')[0]} • ${projectType}`,
      systemCapacityKW: kw,
      capacityKW: kw,
      panelType: fullPanelDescription,
      solarModule: fullPanelDescription,
      selectedModuleMake: panelBrand,
      selectedInverterMake: inverterModel.split(' ')[0],
      moduleWattage: panelWatt,
      moduleCount: panelQuantity,
      ratePerWp: ratePerWp,
      multiBrandComparison,
      multiBrandPackages: multiBrandComparison ? multiBrandPackages : null,
      structureLayout: selectedStructureLayout || null,
      pvModuleSize: '4 * 8',
      inverterType: inverterModel,
      inverterCapacity: `${kw} kW`,
      inverterCount: '1 NOS',
      baseRatePerKW: ratePerKw,
      baseCost: baseProjectCost,
      dealerMargin: dealerMarginINR,
      dealerTotalMargin: dealerMarginINR,
      dealerMarginPerKW: isDirectCompanyQuote ? 0 : (kw > 0 ? Math.round(dealerMarginINR / kw) : 0),
      hasCustomDealerPricing,
      customDiscountPercent,
      discountAmount,
      moduleEstimatedCost,
      inverterEstimatedCost,
      structureEstimatedCost,
      bosEstimatedCost,
      transportCharge,
      installationEstimatedCost,
      baseBeforeGst,
      gstPercentage: 13.8,
      gstAmount,
      isGstInclusive: true,
      annualGenerationUnits,
      monthlyGenerationUnits,
      annualSavings,
      monthlySavings,
      paybackYears,
      isDirectCompanyQuote,
      quoteChannel,
      creatorRole: role,
      creatorStaffId: isStaff ? currentStaff?.id : null,
      creatorStaffName: isStaff ? currentStaff?.name : null,
      isFlagged: isMarginExceeded,
      requiresAudit: isMarginExceeded,
      auditFlagReason: isMarginExceeded ? `Margin of ₹${currentMarginPerKw}/kW exceeds tier cap of ₹${maxMarginCapPerKw}/kW` : null,
      totalAmount: totalCost,
      grandTotalCustomer: totalCost,
      subsidyAmount: subsidy,
      netPayable: finalPayable,
      status: isEdit ? (editingQuotation.status || (isDirectCompanyQuote ? 'Approved / Direct' : 'Draft')) : (isMarginExceeded ? 'Audit Required' : (isDirectCompanyQuote ? 'Approved / Direct' : 'Draft')),
      statusClass: isEdit ? (editingQuotation.statusClass || 'bg-secondary/15 text-secondary') : (isMarginExceeded ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-primary/15 text-primary'),
      dealerCode: resolvedDealerCode,
      dealerId: resolvedDealerCode,
      dealerName: resolvedDealerName,
      financeType,
      paymentMode: financeType,
      loanBank: financeType === 'LOAN' ? loanBank : null,
      roofConfig: quotationRoofConfig,
      coverImage: customCoverUrl || null,
      customCoverUrl: customCoverUrl || null,
      bomItems,
      bomTotals,
      pricingMode: bomPricingMode
    };

    setIsSubmitting(true);
    setSaveStatus('Saving quotation...');
    try {
      if (isEdit && updateQuotation) {
        updateQuotation(quotePayload);
      } else if (addQuotation) {
        addQuotation(quotePayload);
      }
      if (saveDesignRecord && (quotationRoofConfig || selectedStructureLayout)) {
        saveDesignRecord({
          quotationId: quotePayload.id,
          customerName: custName,
          capacityKw: kw,
          type: '2D_ROOF_CAD',
          roofConfig: quotationRoofConfig,
          structureLayout: selectedStructureLayout,
          specs: { moduleCount, panelWatt, rooftopAreaSqFt }
        });
      }
      await quotationService.saveQuotation(quotePayload);
      setSaveStatus(isEdit ? 'Quotation updated successfully!' : 'Draft saved successfully to cloud!');
      addToast({
        title: isEdit ? 'Quotation Updated' : 'Draft Saved',
        message: `Quotation #${quotePayload.id} for ${custName} saved successfully.${isMarginExceeded ? ' Note: Margin exceeds tier cap and requires compliance audit.' : ''}`,
        type: isMarginExceeded ? 'warning' : 'success'
      });
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      addToast({
        title: 'Save Failed',
        message: 'Could not save quotation to storage.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    if (!custName.trim()) {
      addToast({
        title: 'Customer Name Required',
        message: 'Please specify the customer name before generating proposal preview.',
        type: 'warning'
      });
      return;
    }

    if (isMarginExceeded) {
      addToast({
        title: 'Margin Audit Alert',
        message: `Configured margin (₹${currentMarginPerKw.toLocaleString('en-IN')}/kW) exceeds your tier cap of ₹${maxMarginCapPerKw.toLocaleString('en-IN')}/kW. Proposal flagged for super admin compliance audit.`,
        type: 'warning'
      });
    }

    const isEdit = Boolean(editingQuotation?.id);
    const resolvedDealerCode = isDirectCompanyQuote ? 'SV-DIRECT' : (effectiveDealer?.id || currentDealer?.id || 'SV-DLR-0104');
    const resolvedDealerName = isDirectCompanyQuote ? 'Sunvine Renewable Energy (Head Office)' : (effectiveDealer?.firmName || currentDealer?.firmName || 'Rajesh Solar Solutions');

    const fullPanelDescription = `${panelBrand} ${panelWatt}W TOPCon Bifacial (${panelWatt}Wp)`;
    const quotePayload = {
      id: isEdit ? editingQuotation.id : `SV-2026-Q${Math.floor(100 + Math.random() * 900)}`,
      date: isEdit ? (editingQuotation.date || new Date().toLocaleDateString('en-GB')) : new Date().toLocaleDateString('en-GB'),
      customerName: custName,
      customerPhone: custPhone,
      location: custLocation,
      city: custLocation.split(',')[0]?.trim() || 'Rajkot',
      state: 'Gujarat',
      projectType,
      type: `${panelBrand.split(' ')[0]} • ${projectType}`,
      systemCapacityKW: kw,
      capacityKW: kw,
      solarModule: fullPanelDescription,
      panelType: fullPanelDescription,
      selectedModuleMake: panelBrand,
      selectedInverterMake: inverterModel.split(' ')[0],
      moduleWattage: panelWatt,
      moduleCount: panelQuantity,
      ratePerWp: ratePerWp,
      multiBrandComparison,
      multiBrandPackages: multiBrandComparison ? multiBrandPackages : null,
      structureLayout: selectedStructureLayout || null,
      pvModuleSize: '4 * 8',
      inverterCapacity: `${kw} kW`,
      inverterType: inverterModel,
      inverterCount: '1 NOS',
      baseRatePerKW: ratePerKw,
      baseCost: baseProjectCost,
      dealerMarginPerKW: isDirectCompanyQuote ? 0 : (kw > 0 ? Math.round(dealerMarginINR / kw) : 0),
      dealerTotalMargin: dealerMarginINR,
      dealerMargin: dealerMarginINR,
      hasCustomDealerPricing,
      customDiscountPercent,
      discountAmount,
      moduleEstimatedCost,
      inverterEstimatedCost,
      structureEstimatedCost,
      bosEstimatedCost,
      transportCharge,
      installationEstimatedCost,
      baseBeforeGst,
      gstPercentage: 13.8,
      gstAmount,
      isGstInclusive: true,
      annualGenerationUnits,
      monthlyGenerationUnits,
      annualSavings,
      monthlySavings,
      paybackYears,
      isDirectCompanyQuote,
      quoteChannel,
      creatorRole: role,
      creatorStaffId: isStaff ? currentStaff?.id : null,
      creatorStaffName: isStaff ? currentStaff?.name : null,
      isFlagged: isMarginExceeded,
      requiresAudit: isMarginExceeded,
      auditFlagReason: isMarginExceeded ? `Margin of ₹${currentMarginPerKw}/kW exceeds tier cap of ₹${maxMarginCapPerKw}/kW` : null,
      totalAmount: totalCost,
      grandTotalCustomer: totalCost,
      subsidyAmount: subsidy,
      netPayable: finalPayable,
      status: isEdit ? (editingQuotation.status || 'Active / Sent') : (isMarginExceeded ? 'Audit Required' : 'Active / Sent'),
      statusClass: isEdit ? (editingQuotation.statusClass || 'bg-primary/15 text-primary') : (isMarginExceeded ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-primary/15 text-primary'),
      dealerId: resolvedDealerCode,
      dealerCode: resolvedDealerCode,
      dealerName: resolvedDealerName,
      financeType,
      paymentMode: financeType,
      loanBank: financeType === 'LOAN' ? loanBank : null,
      roofConfig: quotationRoofConfig,
      coverImage: customCoverUrl || null,
      customCoverUrl: customCoverUrl || null,
      bomItems,
      bomTotals,
      pricingMode: bomPricingMode
    };

    if (isEdit && updateQuotation) {
      updateQuotation(quotePayload);
    } else if (addQuotation) {
      addQuotation(quotePayload);
    }
    if (saveDesignRecord && (quotationRoofConfig || selectedStructureLayout)) {
      saveDesignRecord({
        quotationId: quotePayload.id,
        customerName: custName,
        capacityKw: kw,
        type: '2D_ROOF_CAD',
        roofConfig: quotationRoofConfig,
        structureLayout: selectedStructureLayout,
        specs: { moduleCount, panelWatt, rooftopAreaSqFt }
      });
    }
    if (setPreviewQuotation) setPreviewQuotation(quotePayload);
    if (setActiveDraftQuote) setActiveDraftQuote(quotePayload);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    setActiveTab('preview_quote');
  };

  return (
    <div className="flex flex-col w-full pb-8 min-w-0 overflow-x-hidden">
      {/* Top Navigation Bar & Progress Track (Exact Stitch Stepper) */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col gap-1 min-w-0">
          <button
            onClick={() => {
              if (clearEditingQuotation) clearEditingQuotation();
              if (clearActiveDraftQuote) clearActiveDraftQuote();
              setActiveTab(isAdmin ? 'admin_dashboard' : 'dashboard');
            }}
            className="inline-flex items-center gap-1.5 text-secondary hover:text-on-surface font-label-sm transition-colors w-fit group"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            <span>{isAdmin ? 'Back to Overview' : 'Back to Dashboard'}</span>
          </button>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl text-on-surface tracking-tight font-bold">
              {editingQuotation ? 'Edit Quotation' : (isDirectCompanyQuote ? 'New Direct Company Quotation' : 'New Quotation')}
            </h1>
            <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] tracking-wide uppercase font-semibold shrink-0">
              {editingQuotation
                ? `#${editingQuotation.id}`
                : (isDirectCompanyQuote
                    ? (dealerMarginINR > 0 ? `Sunvine HO Direct (+${formatINR(dealerMarginINR)})` : 'Sunvine HO Direct (Zero Margin)')
                    : 'Ref #SV-2025-Q408')}
            </span>
            {editingQuotation && (
              <button
                onClick={handleReset}
                type="button"
                className="text-xs text-secondary hover:text-error underline font-medium"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center bg-surface-container-lowest p-1.5 rounded-xl shadow-sm self-start border border-surface-container-high overflow-x-auto max-w-full">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary font-label-sm shrink-0">
            <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
            <span className="text-xs font-semibold whitespace-nowrap">Details &amp; Pricing</span>
            <span className="bg-primary-container/20 text-on-primary-container text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide shrink-0">Active</span>
          </div>
          <div className="w-4 h-0.5 bg-surface-container-high mx-1 shrink-0"></div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-secondary/60 font-label-sm select-none cursor-not-allowed opacity-75 shrink-0"
            title="Complete quotation details and use 'Preview & Send' button below to proceed"
          >
            <span className="w-5 h-5 rounded-full bg-surface-container-high text-secondary/60 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
            <span className="text-xs font-medium whitespace-nowrap">Preview &amp; Send</span>
          </div>
        </div>
      </div>

      {/* Admin & Staff Channel Selection Bar (Head Office Direct vs Dealer Partner) */}
      {(isAdmin || isStaff) && (
        <div className="mb-6 p-4 rounded-2xl bg-[#0F1B2E] text-white shadow-md border border-slate-700/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6CBF3D]/20 border border-[#6CBF3D]/40 flex items-center justify-center text-[#6CBF3D] shrink-0">
              <span className="material-symbols-outlined text-[24px]">corporate_fare</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6CBF3D]">
                  {isAdmin ? 'Sunvine Admin Console' : 'Sunvine Staff Console'}
                </span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/15 text-slate-200 font-semibold">
                  {isAdmin ? 'Central EPC Issuance' : 'Staff Quotation Engine'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isDirectCompanyQuote
                  ? 'Issuing direct company quotation with standard HO pricing (0% middleman markup).'
                  : `Issuing quotation on behalf of authorized partner: ${effectiveDealer?.firmName || 'Partner'}.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center p-1 bg-slate-800/90 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setQuoteChannel('direct');
                  setDealerMarginFixed(0);
                  setDealerMarginRate(0);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quoteChannel === 'direct'
                    ? 'bg-[#6CBF3D] text-[#0F1B2E] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">apartment</span>
                <span>Sunvine Direct (Company Margin)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuoteChannel('dealer');
                  if (tierConfig?.defaultMarginPerKw) {
                    setDealerMarginFixed(tierConfig.defaultMarginPerKw * kw);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quoteChannel === 'dealer'
                    ? 'bg-white text-[#0F1B2E] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">handshake</span>
                <span>Dealer Partner</span>
              </button>
            </div>

            {quoteChannel === 'dealer' && (
              <select
                value={assignedDealerId}
                onChange={(e) => setAssignedDealerId(e.target.value)}
                className="h-9 px-3 text-xs bg-slate-800 text-white rounded-xl border border-slate-700 outline-none focus:border-[#6CBF3D] cursor-pointer max-w-[280px]"
              >
                {(accessibleDealers || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firmName} ({d.city}) • {d.tier}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Save Notification Banner */}
      {saveStatus && (
        <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-label-sm flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Form Layout Grid (Stacked on Mobile/Tablet, Asymmetrical Split on Desktop >=1280px: 7 Cols Left / 5 Cols Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full min-w-0">
        {/* Left Column: Specs & Inputs (7 cols on XL) */}
        <div className="xl:col-span-7 flex flex-col gap-6 min-w-0">
          {/* Card 1: Customer Details */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 md:p-6 shadow-sm border border-surface-container-high">
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-surface-container-high/60 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">person</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-on-secondary-fixed leading-tight">Customer Details</h2>
                  <p className="text-xs text-secondary hidden sm:block">Site contact &amp; regional grid jurisdictional data</p>
                </div>
              </div>
              <span className="text-[10px] text-secondary-fixed-dim uppercase tracking-wider font-semibold shrink-0">Step 1.1</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="custName">
                  Customer Name <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">badge</span>
                  <input
                    className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
                    id="custName"
                    placeholder="Enter customer's full name"
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="custPhone">
                  Mobile Number <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">phone</span>
                  <input
                    className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono"
                    id="custPhone"
                    placeholder="10-digit mobile number"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={custPhone}
                    onChange={(e) => {
                      const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setCustPhone(numericOnly);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="custLocation">
                  Installation City / Pincode <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">location_on</span>
                  <input
                    className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
                    id="custLocation"
                    placeholder="e.g. Rajkot, 360004"
                    type="text"
                    value={custLocation}
                    onChange={(e) => setCustLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Payment Mode: Cash vs Solar Bank Loan */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-surface-container-high/60 min-w-0">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold truncate">
                    Payment / Finance Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setFinanceType('CASH')}
                      className={`h-10 px-2 sm:px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
                        financeType === 'CASH'
                          ? 'bg-[#6CBF3D] text-white border-[#6CBF3D] shadow-xs'
                          : 'bg-surface-container-lowest text-secondary border-surface-container-high hover:border-[#6CBF3D]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] shrink-0">payments</span>
                      <span className="truncate">Cash Case</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinanceType('LOAN')}
                      className={`h-10 px-2 sm:px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
                        financeType === 'LOAN'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-surface-container-lowest text-secondary border-surface-container-high hover:border-amber-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] shrink-0">account_balance</span>
                      <span className="truncate">Solar Loan (EMI)</span>
                    </button>
                  </div>
                </div>

                {financeType === 'LOAN' && (
                  <div className="flex flex-col gap-1.5 animate-in fade-in duration-200 min-w-0">
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <label className="font-label-sm text-label-sm text-amber-900 font-semibold truncate shrink-0">
                        Financing Bank / Provider
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowBankModal(true)}
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[13px]">manage_search</span>
                        <span>Browse 40+ Banks</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      <div className="flex-1 min-w-0">
                        <select
                          value={loanBank}
                          onChange={(e) => setLoanBank(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-md outline-none shadow-sm border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer text-xs truncate"
                        >
                          {GROUPED_SOLAR_BANKS.map((group) => (
                            <optgroup key={group.category} label={group.label}>
                              {group.banks.map((b) => (
                                <option key={b.id} value={b.name}>
                                  {b.name} ({b.interestRate.split(' ')[0]})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBankModal(true)}
                        className="h-10 w-10 min-w-[40px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-colors"
                        title="Browse All 40+ Banks, Rates & Tenures"
                      >
                        <span className="material-symbols-outlined text-[18px]">search</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Cover Page (Page 1) Attachment Option */}
            <div className="mt-4 pt-4 border-t border-surface-container-high/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">attachment</span>
                  <span className="font-label-sm text-xs font-bold text-on-surface">Proposal Cover Page (Page 1)</span>
                </div>
                <span className="text-[10px] text-secondary">
                  {customCoverUrl ? '✓ Custom Cover Attached' : 'Standard Sunvine Cover Active'}
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-16 rounded-md bg-surface-container border border-surface-container-high flex items-center justify-center shrink-0 overflow-hidden relative shadow-xs">
                    {customCoverUrl ? (
                      <img src={customCoverUrl} alt="Custom Cover Preview" className="w-full h-full object-cover" />
                    ) : (
                      <img src="/mirana_page1_original.jpg" alt="Default Cover" className="w-full h-full object-cover opacity-80" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-on-surface truncate">
                      {customCoverUrl ? 'Custom Front Page Attached' : 'Sunvine Executive Corporate Cover'}
                    </p>
                    <p className="text-[11px] text-secondary mt-0.5">
                      {customCoverUrl
                        ? 'Custom attachment will appear as Page 1 of the generated PDF.'
                        : 'Default high-resolution Sunvine brand cover will be used.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <label className="h-8 px-3 rounded-lg bg-surface border border-surface-container-high hover:border-primary text-xs font-semibold text-on-surface flex items-center gap-1.5 cursor-pointer transition-all shadow-xs">
                    <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
                    <span>{customCoverUrl ? 'Change Cover' : 'Attach Custom Cover'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 8 * 1024 * 1024) {
                            addToast({
                              title: 'File Too Large',
                              message: 'Please choose an image under 8MB.',
                              type: 'warning'
                            });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setCustomCoverUrl(ev.target.result);
                            addToast({
                              title: 'Custom Cover Attached',
                              message: 'Custom front page successfully attached for Page 1.',
                              type: 'success'
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {customCoverUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCoverUrl('');
                        addToast({
                          title: 'Default Cover Restored',
                          message: 'Restored standard Sunvine cover page.',
                          type: 'info'
                        });
                      }}
                      className="h-8 px-2.5 rounded-lg bg-error/10 hover:bg-error/20 text-error text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                      title="Reset to Default Cover"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                      <span>Default</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: System Details */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 md:p-6 shadow-sm border border-surface-container-high">
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-surface-container-high/60 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">solar_power</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-on-secondary-fixed leading-tight">System Details</h2>
                  <p className="text-xs text-secondary hidden sm:block">Hardware configuration, inverter tier &amp; module capacity</p>
                </div>
              </div>
              <span className="text-[10px] text-secondary-fixed-dim uppercase tracking-wider font-semibold shrink-0">Step 1.2</span>
            </div>

            <div className="flex flex-col gap-4">
              {/* BRAND SELECTION & WATTAGE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Panel Brand Selector */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="panelBrand">
                      1. Select Panel Brand *
                    </label>
                    {hasCustomDealerPricing && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">bolt</span>
                        Custom: ₹{ratePerWp}/Wp
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-primary text-[20px] pointer-events-none">grid_view</span>
                    <select
                      className="w-full h-10 pl-10 pr-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer font-semibold"
                      id="panelBrand"
                      value={panelBrand}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPanelBrand(val);
                        const found = SOLAR_PANEL_BRANDS.find(b => b.name === val);
                        if (found) {
                          setPanelWatt(found.defaultWp);
                          if (!hasCustomDealerPricing) {
                            setRatePerWp(found.ratePerWp);
                          }
                        }
                      }}
                    >
                      {SOLAR_PANEL_BRANDS.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name} ({b.tech})
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">arrow_drop_down</span>
                  </div>
                  <span className="text-[11px] text-secondary">
                    {activeBrandObj?.tech || 'Tier-1 ALMM / BIS Approved'}
                  </span>
                </div>

                {/* Wattage per piece (Wp) and Dual Reactive Rate Controls */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                      2. Watt per Piece (Wp) *
                    </label>
                    <span className="text-[11px] text-primary font-bold">
                      {panelWatt}W × ₹{ratePerWp.toFixed(2)}/Wp
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {STANDARD_WATTS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setPanelWatt(w)}
                        className={`h-10 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                          panelWatt === w
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface-container-lowest text-on-surface border-surface-container-high hover:border-primary'
                        }`}
                      >
                        <span>{w}W</span>
                      </button>
                    ))}
                  </div>

                  {/* Collapsible Dropdown Menu: Rate / Wp AND Price / Panel */}
                  <div className="mt-0.5 border border-surface-container-high rounded-lg overflow-hidden bg-surface-container-lowest transition-all">
                    <button
                      type="button"
                      onClick={() => setIsRateDropdownOpen(prev => !prev)}
                      className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-surface-container/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[17px] text-primary shrink-0">tune</span>
                        <span className="text-xs font-semibold text-on-surface truncate">Custom Rate &amp; Price per Panel</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-primary font-bold shrink-0">
                          ₹{ratePerWp.toFixed(2)}/Wp
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[11px] font-mono font-bold text-secondary hidden xs:inline">
                          ₹{perPanelPrice.toLocaleString('en-IN')}/pc
                        </span>
                        <span className={`material-symbols-outlined text-[18px] text-secondary transition-transform duration-200 ${isRateDropdownOpen ? 'rotate-180 text-primary' : ''}`}>
                          expand_more
                        </span>
                      </div>
                    </button>

                    {isRateDropdownOpen && (
                      <div className="p-2.5 pt-2 border-t border-surface-container-high/60 bg-surface/50 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block">
                                Rate per Wp
                              </label>
                              <span className="text-[10px] text-primary font-semibold">₹ / Watt</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary font-bold select-none">₹</span>
                              <input
                                type="number"
                                step="0.05"
                                min="10"
                                max="40"
                                value={ratePerWp}
                                onChange={(e) => handleRatePerWpChange(e.target.value)}
                                className="w-full h-8 pl-6 pr-2 rounded-md bg-surface-container-lowest text-on-surface text-xs font-bold border border-surface-container-high focus:border-primary outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block">
                                Price per Panel
                              </label>
                              <span className="text-[10px] text-primary font-semibold">₹ / Piece</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary font-bold select-none">₹</span>
                              <input
                                type="number"
                                step="50"
                                min="1000"
                                max="25000"
                                value={perPanelPrice}
                                onChange={(e) => handlePerPanelPriceChange(e.target.value)}
                                className="w-full h-8 pl-6 pr-2 rounded-md bg-surface-container-lowest text-on-surface text-xs font-bold border border-surface-container-high focus:border-primary outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-secondary">
                          <span>Default: ₹{(activeBrandObj?.ratePerWp || 18).toFixed(2)}/Wp</span>
                          {ratePerWp !== (activeBrandObj?.ratePerWp || 18) && (
                            <button
                              type="button"
                              onClick={() => handleRatePerWpChange(activeBrandObj?.ratePerWp || 18)}
                              className="text-primary hover:underline font-semibold cursor-pointer"
                            >
                              Reset to Default
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PANEL QUANTITY & AUTO-CALCULATED KW */}
              <div className="p-4 bg-surface-container-low border border-surface-container-high rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="font-label-sm text-label-sm text-on-surface font-semibold block">
                      3. Number of Panels (Pieces) *
                    </label>
                    <span className="text-xs text-secondary">Select or enter total number of solar PV modules</span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setPanelQuantity(prev => Math.max(1, prev - 1))}
                      className="w-9 h-9 rounded-lg bg-surface border border-surface-container-high text-on-surface hover:bg-surface-container font-bold flex items-center justify-center cursor-pointer shadow-xs"
                      title="Decrease 1 Panel"
                    >
                      <span className="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="2000"
                        value={panelQuantity}
                        onChange={(e) => setPanelQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="w-20 h-9 bg-surface border-2 border-primary/40 rounded-lg text-center font-bold text-sm text-on-surface focus:outline-none focus:border-primary font-mono shadow-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPanelQuantity(prev => prev + 1)}
                      className="w-9 h-9 rounded-lg bg-surface border border-surface-container-high text-on-surface hover:bg-surface-container font-bold flex items-center justify-center cursor-pointer shadow-xs"
                      title="Increase 1 Panel"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                    <span className="text-xs font-semibold text-secondary ml-1">Pieces</span>
                  </div>
                </div>


                {/* Auto-Calculated Capacity Highlight Banner */}
                <div className="p-3 sm:p-3.5 bg-emerald-500/15 border-2 border-emerald-500/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950">
                  <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                      <span className="material-symbols-outlined text-[20px] sm:text-[24px]">electric_bolt</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider bg-emerald-700 text-white px-2 py-0.5 rounded-full shrink-0">
                          Auto-Calculated Plant Capacity
                        </span>
                        <span className="text-[11px] font-medium text-emerald-800">
                          ({panelWatt}W × {panelQuantity} Pcs) ÷ 1000
                        </span>
                      </div>
                      <div className="text-lg sm:text-2xl font-black text-emerald-900 mt-1 sm:mt-0.5 tracking-tight font-mono break-words">
                        {kw} kW System <span className="text-sm sm:text-lg font-bold text-emerald-800">({((panelWatt * panelQuantity) / 1000).toFixed(2)} kWp)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center pt-2 sm:pt-0 border-t border-emerald-500/30 sm:border-t-0 sm:border-l sm:border-emerald-300 sm:pl-4 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-800">Rooftop Area Required</div>
                      <div className="text-[9px] sm:text-[10px] text-emerald-700 hidden xs:block sm:block">Shadow-free roof space</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-bold text-emerald-950 font-mono">~{rooftopAreaSqFt} Sq. Ft.</div>
                      <div className="text-[9px] text-emerald-700 xs:hidden">Shadow-free space</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* INVERTER SELECTION & PROJECT TYPE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Inverter Unit */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                      4. Inverter Unit *
                    </label>
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Auto-Matched for {kw} kW
                    </span>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">developer_board</span>
                    <select
                      className="w-full h-10 pl-10 pr-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer font-semibold"
                      value={inverterModel}
                      onChange={(e) => {
                        setInverterModel(e.target.value);
                        setUserOverrodeInverter(true);
                      }}
                    >
                      <option value="Sunvine Solaryaan 2.2G (1-Phase)">Sunvine Solaryaan 2.2G (1-Phase Grid-Tied)</option>
                      <option value="Sunvine Solaryaan 3.3G (1-Phase 2 MPPT)">Sunvine Solaryaan 3.3G (1-Phase 2 MPPT)</option>
                      <option value="Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)">Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)</option>
                      <option value="Sunvine Solaryaan 6.0G (3-Phase Smart MPPT)">Sunvine Solaryaan 6.0G (3-Phase Smart MPPT)</option>
                      <option value="Growatt / Deye 10.0 KW 3-Phase">Growatt / Deye 10.0 KW 3-Phase Dual MPPT</option>
                      <option value="Solis S6-GR1P-5K (1-Phase 2 MPPT)">Solis S6-GR1P-5K (1-Phase 2 MPPT)</option>
                      <option value="Sungrow SG5.0RS Residential Grid-Tied">Sungrow SG5.0RS Residential Grid-Tied</option>
                      <option value="Industrial String Inverter 3-Phase">Industrial String Inverter 3-Phase (&gt; 10kW)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">arrow_drop_down</span>
                  </div>
                  <span className="text-[11px] text-secondary">
                    8 Years Standard Product Warranty • Dual MPPT Tracking
                  </span>
                </div>

                {/* Project Type */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="projectType">
                      Project Type / Scheme
                    </label>
                    <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">
                      {projectType === 'Residential' ? 'PM Surya Ghar DBT' : 'Commercial EPC'}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">apartment</span>
                    <select
                      className="w-full h-10 pl-10 pr-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer font-semibold"
                      id="projectType"
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                    >
                      <option value="Residential">Residential (PM Surya Ghar Subsidy Eligible)</option>
                      <option value="Commercial">Commercial / Industrial (Non-Subsidy Accelerated Depr.)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">arrow_drop_down</span>
                  </div>
                  <span className="text-[11px] text-secondary">
                    {projectType === 'Residential' ? 'Central DBT subsidy up to ₹78,000 applicable' : 'No government DBT subsidy for C&I'}
                  </span>
                </div>
              </div>

              {/* FIELD ENGINEERING BILL OF MATERIALS (BOM) & LIVE COSTING */}
              <div className="p-3.5 sm:p-5 bg-surface-container-low rounded-xl border border-surface-container-high space-y-4">
                {/* Header & Controls Bar */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-500/30">
                      <span className="material-symbols-outlined text-[24px]">format_list_bulleted</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm sm:text-base text-on-surface truncate">Field Engineering BOM &amp; Costing</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 uppercase shrink-0">
                          Excel Field Standard
                        </span>
                      </div>
                      <p className="text-xs text-secondary mt-0.5 truncate hidden sm:block">
                        Interactive component list with dual statutory GST (5% panels/inverters, 18% materials). Editable qty &amp; rates.
                      </p>
                    </div>
                  </div>

                  {/* Mode & Kit Presets Bar */}
                  <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto shrink-0">
                    {/* View Mode Switcher (Cards vs Table) */}
                    <ViewModeToggle
                      viewMode={bomViewMode}
                      onViewModeChange={setBomViewMode}
                      className="hidden sm:inline-flex"
                    />

                    {/* Pricing Mode Toggle */}
                    <div className="flex items-center p-0.5 rounded-lg bg-surface border border-surface-container-high text-xs">
                      <button
                        type="button"
                        onClick={() => setBomPricingMode('standard')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          bomPricingMode === 'standard'
                            ? 'bg-primary text-white shadow-xs font-bold'
                            : 'text-secondary hover:text-on-surface'
                        }`}
                        title="Use official company procurement base rates"
                      >
                        Company Base
                      </button>
                      <button
                        type="button"
                        onClick={() => setBomPricingMode('custom')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          bomPricingMode === 'custom'
                            ? 'bg-amber-600 text-white shadow-xs font-bold'
                            : 'text-secondary hover:text-on-surface'
                        }`}
                        title="Use customized rates negotiated for this dealer"
                      >
                        Dealer Custom
                      </button>
                    </div>

                    {/* Kit Preset Selector */}
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedKitId}
                        onChange={(e) => {
                          const kId = e.target.value;
                          setSelectedKitId(kId);
                          if (kId) handleApplyKitPreset(kId);
                        }}
                        className="h-8 px-2 rounded-lg bg-surface text-on-surface text-xs font-semibold border border-surface-container-high outline-none cursor-pointer max-w-[130px] sm:max-w-[150px] truncate"
                      >
                        <option value="">-- Load Kit Preset --</option>
                        {(kitsPresets || []).map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} ({k.capacityKw} kW)
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setIsSaveKitModalOpen(true)}
                        className="h-8 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        title="Save current BOM itemization as a reusable kit"
                      >
                        <span className="material-symbols-outlined text-[15px] text-primary">bookmark_add</span>
                        <span className="hidden md:inline">Save Kit</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* DESKTOP / TABLET VIEW: Zero-Clipping Fluid Data Table */}
                {bomViewMode === 'table' ? (
                  <div className="hidden md:block rounded-xl border border-surface-container-high bg-surface overflow-x-auto shadow-xs">
                    <table className="w-full text-left text-xs min-w-[680px]">
                      <thead className="bg-[#0D1527] text-slate-200 font-semibold border-b border-surface-container-high">
                        <tr>
                          <th className="py-2.5 px-2 w-8 text-center text-slate-400">#</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Product / Material Description</th>
                          <th className="py-2.5 px-2 text-center w-20">Qty</th>
                          <th className="py-2.5 px-1.5 text-center w-12 text-slate-400">Unit</th>
                          <th className="py-2.5 px-2 text-right w-24">Rate (₹)</th>
                          <th className="py-2.5 px-1.5 text-center w-14">GST</th>
                          <th className="py-2.5 px-2.5 text-right w-24">Total (₹)</th>
                          <th className="py-2.5 px-2 text-center w-8 text-slate-400">Act</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-high/60 font-medium text-on-surface">
                        {bomItems.map((item, idx) => {
                          const itemName = item.name || item.item || item.description || `BOM Material #${idx + 1}`;
                          const gst = item.gstRate !== undefined ? item.gstRate : (item.taxRate !== undefined ? item.taxRate : 18);
                          const lineTotal = (item.totalWithGst !== undefined && item.totalWithGst > 0)
                            ? item.totalWithGst
                            : Math.round((Number(item.qty) || 0) * (Number(item.rate) || 0) * (1 + gst / 100));

                          return (
                            <tr key={item.id || idx} className={`${idx % 2 === 1 ? 'bg-surface-container-lowest/40' : 'bg-surface'} hover:bg-primary/5 transition-colors`}>
                              <td className="py-2 px-2 text-center text-secondary font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 min-w-0">
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-on-surface text-xs leading-snug">{itemName}</span>
                                  {item.specs && (
                                    <span className="text-[10px] text-secondary truncate">{item.specs}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step={item.unit === 'MTR' ? '5' : '1'}
                                    value={item.qty}
                                    onChange={(e) => handleBomQtyChange(item.id, e.target.value)}
                                    className="w-14 h-7 text-center font-mono font-bold bg-surface-container-lowest border border-surface-container-high rounded px-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono text-[10px] text-secondary">
                                {item.unit || 'NOS'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <div className="relative inline-flex items-center justify-end w-full">
                                  <span className="text-[10px] text-secondary mr-1 font-bold">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="10"
                                    value={item.rate}
                                    onChange={(e) => handleBomRateChange(item.id, e.target.value)}
                                    className="w-16 h-7 text-right font-mono font-bold bg-surface-container-lowest border border-surface-container-high rounded px-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-1.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  gst === 5
                                    ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                                    : 'bg-blue-500/15 text-blue-800 border border-blue-500/30'
                                }`}>
                                  {gst}%
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-bold text-on-surface whitespace-nowrap text-xs">
                                {formatINR(lineTotal)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBomItem(item.id)}
                                  className="w-6 h-6 rounded hover:bg-error/15 text-secondary hover:text-error flex items-center justify-center cursor-pointer transition-colors"
                                  title="Remove line item"
                                >
                                  <span className="material-symbols-outlined text-[15px]">delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {/* MOBILE VIEW OR CARD VIEW: Sleek Categorized & Compact Cards */}
                <div className={`space-y-3 ${bomViewMode === 'table' ? 'md:hidden' : ''}`}>
                  {/* Mobile Category Quick Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-surface-container-high/60">
                    {BOM_MOBILE_CATEGORIES.map(cat => {
                      const count = cat.id === 'all'
                        ? bomItems.length
                        : bomItems.filter(i => cat.match.includes(i.category || '')).length;
                      if (count === 0 && cat.id !== 'all') return null;

                      const isActive = mobileBomCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setMobileBomCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            isActive
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-surface text-secondary border border-surface-container-high hover:border-primary/40'
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Compact Mobile Items List */}
                  <div className="space-y-2">
                    {filteredMobileBomItems.map((item, idx) => {
                      const itemName = item.name || item.item || item.description || `BOM Material #${idx + 1}`;
                      const gst = item.gstRate !== undefined ? item.gstRate : (item.taxRate !== undefined ? item.taxRate : 18);
                      const lineTotal = (item.totalWithGst !== undefined && item.totalWithGst > 0)
                        ? item.totalWithGst
                        : Math.round((Number(item.qty) || 0) * (Number(item.rate) || 0) * (1 + gst / 100));

                      return (
                        <div
                          key={item.id || idx}
                          className="p-2.5 bg-surface rounded-xl border border-surface-container-high shadow-2xs hover:border-primary/40 transition-all space-y-2"
                        >
                          {/* Row 1: Item Title + GST Chip + Line Total + Delete */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-5 h-5 rounded bg-surface-container text-secondary text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-xs text-on-surface truncate leading-snug">
                                  {itemName}
                                </h4>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                gst === 5
                                  ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                                  : 'bg-blue-500/15 text-blue-800 border border-blue-500/30'
                              }`}>
                                {gst}%
                              </span>
                              <span className="font-mono font-bold text-xs text-emerald-950">
                                {formatINR(lineTotal)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveBomItem(item.id)}
                                className="w-6 h-6 rounded hover:bg-error/15 text-secondary hover:text-error flex items-center justify-center cursor-pointer transition-colors ml-0.5"
                                title="Remove line item"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Inline Qty Stepper + Unit Rate in 1 clean line */}
                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-surface-container-high/40 text-xs">
                            {/* Quantity Stepper */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-secondary uppercase mr-0.5">Qty:</span>
                              <button
                                type="button"
                                onClick={() => handleBomQtyChange(item.id, Math.max(0, (Number(item.qty) || 0) - (item.unit === 'MTR' ? 5 : 1)))}
                                className="w-6 h-6 rounded bg-surface-container-lowest border border-surface-container-high text-on-surface hover:bg-surface-container flex items-center justify-center font-bold cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[13px]">remove</span>
                              </button>
                              <input
                                type="number"
                                min="0"
                                step={item.unit === 'MTR' ? '5' : '1'}
                                value={item.qty}
                                onChange={(e) => handleBomQtyChange(item.id, e.target.value)}
                                className="w-11 h-6 text-center font-mono font-bold bg-surface-container-lowest border border-surface-container-high rounded text-xs focus:border-primary outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleBomQtyChange(item.id, (Number(item.qty) || 0) + (item.unit === 'MTR' ? 5 : 1))}
                                className="w-6 h-6 rounded bg-surface-container-lowest border border-surface-container-high text-on-surface hover:bg-surface-container flex items-center justify-center font-bold cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[13px]">add</span>
                              </button>
                              <span className="text-[10px] font-bold text-secondary font-mono ml-0.5">{item.unit || 'NOS'}</span>
                            </div>

                            {/* Unit Rate Input */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-secondary uppercase mr-0.5">Rate:</span>
                              <div className="relative inline-flex items-center">
                                <span className="text-[10px] text-secondary font-bold mr-0.5">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={item.rate}
                                  onChange={(e) => handleBomRateChange(item.id, e.target.value)}
                                  className="w-16 h-6 text-right font-mono font-bold bg-surface-container-lowest border border-surface-container-high rounded px-1 text-xs focus:border-primary outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredMobileBomItems.length === 0 && (
                      <div className="text-center py-6 text-secondary text-xs bg-surface rounded-xl border border-surface-container-high">
                        No items found in this category.
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Custom Item Button & Live Category Breakdown Badges */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomBomItemModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-container bg-primary/10 hover:bg-primary/15 px-3 py-2 rounded-lg transition-colors cursor-pointer self-start"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    <span>+ Add Custom BOM Item / Surcharge</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 font-semibold">
                      5% GST (PV, Inv &amp; MC4): <strong>{formatINR(bomTotals.subtotal5GstBase + bomTotals.gst5Total)}</strong>
                    </span>
                    <span className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900 font-semibold">
                      18% GST (BOS/Structure): <strong>{formatINR(bomTotals.subtotal18GstBase + bomTotals.gst18Total)}</strong>
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-[#0D1527] text-white font-mono font-bold border border-slate-700 shadow-xs">
                      BOM Total: <span className="text-emerald-400">{formatINR(bomTotals.grossTurnkeyCost)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Panel Comparative Quotation Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high mt-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">view_column</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-label-md font-bold text-on-surface">Multi-Panel Comparative Proposal</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">Single PDF</span>
                    </div>
                    <p className="text-xs text-secondary">Present side-by-side brand pricing comparison (Waaree vs APS vs Adani) in customer quotation</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={multiBrandComparison}
                    onChange={(e) => setMultiBrandComparison(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Multi-Panel Comparison Live Preview Card when active */}
              {multiBrandComparison && multiBrandPackages && (
                <div className="p-3.5 rounded-xl bg-primary-container/5 border border-primary/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">compare_arrows</span>
                      Comparative Brand Breakdown ({kw} kW)
                    </span>
                    <span className="text-[10px] text-secondary">Injected into PDF Page 2</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {multiBrandPackages.map((pkg, pIdx) => (
                      <div key={pIdx} className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs space-y-1">
                        <div className="font-bold text-on-surface">{pkg.brand}</div>
                        <div className="text-[11px] text-secondary">{pkg.moduleCount} modules × {pkg.wattage}W</div>
                        <div className="text-primary font-bold">{formatINR(pkg.totalCost)}</div>
                        <div className="text-[10px] text-emerald-700 font-semibold">Net: {formatINR(pkg.netPayable)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual Hardware Configuration Tile */}
              <div className="mt-1 rounded-lg bg-surface border border-surface-container-high p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[28px]">energy_savings_leaf</span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      {moduleCount}x {panelWatt}W Half-Cut Array Configured
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Requires ~{rooftopAreaSqFt} sq. ft. shadow-free rooftop area
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="inline-flex items-center gap-1 font-label-xs text-primary bg-primary-fixed/40 px-3 py-1 rounded-full font-semibold">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>MNRE Compliant</span>
                  </span>
                </div>
              </div>

              {/* 2D Solar Structure & Panel Layout Presets Studio (Interactive 2D Presets) */}
              <div className="mt-3 rounded-xl bg-gradient-to-r from-[#0F1B2E] via-[#1E293B] to-[#0F1B2E] text-white p-4 shadow-md border border-slate-700/80 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#6CBF3D]/20 text-[#6CBF3D] flex items-center justify-center shrink-0 border border-[#6CBF3D]/40 shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">grid_view</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-white">2D Structure &amp; Panel Layout Presets</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                          Coming Soon
                        </span>
                      </div>
                      {selectedStructureLayout?.name ? (
                        <p className="text-xs text-slate-300 mt-0.5">
                          Active Layout: <span className="text-[#6CBF3D] font-bold">{selectedStructureLayout.name}</span>
                          {selectedStructureLayout.bom?.jBoltsCount && (
                            <span className="text-amber-400 font-bold ml-2">
                              • J-Bolts: {selectedStructureLayout.bom.jBoltsCount} Pcs
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Interactive rooftop structure mounting &amp; layout visualizer will be enabled in a future update.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Non-Clickable Coming Soon Status Indicator */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <div
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold text-xs select-none shadow-xs"
                      title="Interactive 2D & 3D Structure Studio is coming in a future update"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="material-symbols-outlined text-[16px] text-amber-400">lock_clock</span>
                      <span className="uppercase tracking-wider font-black text-[11px]">Coming Soon</span>
                    </div>
                  </div>
                </div>

                {/* Inline Collapsible Studio when active */}
                {isInlineLayoutOpen && (
                  <div className="mt-2 pt-3 border-t border-slate-700/80">
                    <PanelLayoutVisualizer
                      initialPanelCount={moduleCount}
                      moduleSpecs={(modulesList || []).find(m => `${m.brand} ${m.model}` === panelBrand)}
                      selectedLayoutId={selectedStructureLayout?.id}
                      initialRoofConfig={quotationRoofConfig}
                      onRoofConfigChange={handleUpdateRoofConfig}
                      initialTab="2d"
                      onSelectLayout={(layout) => {
                        setSelectedStructureLayout(layout);
                        if (addToast) {
                          addToast({
                            title: '2D Layout Selected',
                            message: `Selected ${layout.name} with ${layout.bom.jBoltsCount} J-Bolts.`,
                            type: 'success'
                          });
                        }
                      }}
                      onClose={() => setIsInlineLayoutOpen(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Full 2D / 3D Layout Studio Modal - Full Window Workspace */}
          {showLayoutStudio && (
            <div className="fixed inset-0 z-50 w-screen h-screen bg-[#070D18] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="relative w-full h-full flex flex-col overflow-y-auto">
                <PanelLayoutVisualizer
                  initialPanelCount={moduleCount}
                  moduleSpecs={(modulesList || []).find(m => `${m.brand} ${m.model}` === panelBrand)}
                  selectedLayoutId={selectedStructureLayout?.id}
                  initialRoofConfig={quotationRoofConfig}
                  onRoofConfigChange={handleUpdateRoofConfig}
                  initialTab={layoutStudioInitialTab}
                  onSelectLayout={(layout) => {
                    setSelectedStructureLayout(layout);
                    if (addToast) {
                      addToast({
                        title: '2D Layout Selected',
                        message: `Selected ${layout.name} with ${layout.bom.jBoltsCount} J-Bolts.`,
                        type: 'success'
                      });
                    }
                  }}
                  onClose={() => setShowLayoutStudio(false)}
                  isModal={true}
                />
              </div>
            </div>
          )}

          {/* Visual Context Imagery Preview */}
          <div className="relative w-full h-44 rounded-xl overflow-hidden shadow-sm border border-surface-container-high">
            <img
              alt="A clean modern suburban house with sleek black photovoltaic solar panels neatly installed"
              className="w-full h-full object-cover"
              src="/solar_field_cover.jpg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/25 to-transparent flex items-end p-3 sm:p-4">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between w-full text-white gap-1">
                <div className="flex items-center gap-1.5 font-label-sm">
                  <span className="material-symbols-outlined text-primary-container text-[16px] sm:text-[18px] shrink-0">verified</span>
                  <span className="font-semibold text-xs sm:text-sm">Standard Tier-1 Rooftop Assembly</span>
                </div>
                <span className="text-[10px] sm:text-xs opacity-85 shrink-0">25 Yr Performance Warranty</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Subsidy Calculator (5 cols on XL) */}
        <div className="xl:col-span-5 flex flex-col gap-6 min-w-0">
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 md:p-6 shadow-sm border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-start justify-between pb-4 border-b border-surface-container-high/60 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">calculate</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-on-secondary-fixed leading-tight">Pricing &amp; Subsidy</h2>
                  <p className="text-xs text-secondary hidden sm:block">PM Surya Ghar DBT computation</p>
                </div>
              </div>
              <span className="text-[10px] text-secondary-fixed-dim uppercase tracking-wider font-semibold shrink-0">Step 1.3</span>
            </div>

            {/* Input Field for Rate per kW */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="ratePerKw">
                  Rate per kW (₹)
                </label>
                <span className="text-[11px] text-secondary shrink-0">Benchmark: ₹62k–₹68k</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-headline-sm text-headline-sm text-secondary select-none">₹</span>
                <input
                  className="w-full h-11 pl-9 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-bold"
                  id="ratePerKw"
                  max="120000"
                  min="30000"
                  step="1000"
                  type="number"
                  value={ratePerKw}
                  onChange={(e) => setRatePerKw(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Highlighted Auto-Calculated Summary Box */}
            <div className="mt-1 rounded-xl bg-[#F0FDF4] p-5 shadow-xs flex flex-col gap-3.5 relative overflow-hidden border-2 border-[#6CBF3D]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-label-md font-bold">
                  <span className="material-symbols-outlined text-[20px]">auto_graph</span>
                  <span>Central DBT Subsidy Calculated</span>
                </div>
                <span className="material-symbols-outlined text-primary/20 text-[36px] absolute -top-1 -right-1 pointer-events-none">payments</span>
              </div>

              {/* Itemized Cost Breakdown */}
              <div className="space-y-2 pt-1 border-t border-emerald-200">
                {/* 1. Major Equipment & Hardware */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-800 font-semibold truncate">Tier-1 PV Modules &amp; Inverter</span>
                    <span className="text-[10px] text-slate-500">{panelQuantity} Pcs {panelBrand.split(' ')[0]} + {inverterModel.split(' ')[0]}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 shrink-0">
                    {formatINR(moduleEstimatedCost + inverterEstimatedCost)}
                  </span>
                </div>

                {/* 2. Structure & BOS Hardware */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-800 font-semibold truncate">Mounting Structure &amp; BOS Hardware</span>
                    <span className="text-[10px] text-slate-500">HDGI MMS, DC/AC Wires, ACDB/DCDB, Earthing</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 shrink-0">
                    {formatINR(structureEstimatedCost + bosEstimatedCost)}
                  </span>
                </div>

                {/* 3. Transportation & Freight */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-800 font-semibold">Safe Freight &amp; Transit Insurance</span>
                    <span className="text-[10px] text-slate-500">Doorstep delivery to site</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 shrink-0">
                    {formatINR(transportCharge)}
                  </span>
                </div>

                {/* 4. Turnkey Installation & Net-Metering */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-800 font-semibold">Turnkey Installation &amp; Liaisoning</span>
                    <span className="text-[10px] text-slate-500">Rooftop erection, testing, DISCOM net-metering</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 shrink-0">
                    {formatINR(installationEstimatedCost)}
                  </span>
                </div>

                {/* 5. Dealer / Channel Margin */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-800 font-semibold">Channel Margin</span>
                      {isDirectCompanyQuote ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-bold">
                          ₹0 Direct HO
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-semibold">
                          {marginMode === 'percent' ? `${dealerMarginRate}%` : `${effectiveMarginPercent}%`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`font-mono font-bold shrink-0 ${isDirectCompanyQuote ? 'text-slate-500' : 'text-emerald-700'}`}>
                    {isDirectCompanyQuote ? '₹\u00A00' : `+ ${formatINR(dealerMarginINR)}`}
                  </span>
                </div>

                {/* 6. Statutory Composite GST 13.8% */}
                <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-emerald-100/60 border border-emerald-200">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-950 font-bold">Statutory Composite GST (13.8%)</span>
                      <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded font-bold">Included</span>
                    </div>
                    <span className="text-[10px] text-emerald-800">
                      Taxable Base: {formatINR(baseBeforeGst)} • GST: {formatINR(gstAmount)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-900 shrink-0">
                    {formatINR(gstAmount)}
                  </span>
                </div>
              </div>

              {/* Total Project Cost */}
              <div className="flex items-center justify-between gap-2 py-1.5 border-t border-dashed border-primary/30">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-on-surface font-black">Gross Turnkey EPC Cost</span>
                  <span className="text-[10px] text-secondary">Inclusive of GST, freight &amp; liaisoning</span>
                </div>
                <span className="text-base text-on-secondary-fixed font-black tabular-nums whitespace-nowrap shrink-0">
                  {formatINR(totalCost)}
                </span>
              </div>

              {/* Government Subsidy */}
              <div className="flex items-center justify-between gap-2 bg-emerald-100/70 p-2 rounded-lg">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-emerald-950 font-bold">PM Surya Ghar DBT Subsidy</span>
                    <span className="bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold">
                      Central Govt.
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800">Direct-to-bank account reimbursement</span>
                </div>
                <span className="text-sm text-emerald-800 font-extrabold tabular-nums whitespace-nowrap shrink-0 font-mono">
                  - {formatINR(subsidy)}
                </span>
              </div>

              {/* Estimated Annual Savings */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex flex-col min-w-0">
                  <span className="text-secondary font-medium">Estimated Generation &amp; Savings</span>
                  <span className="text-[10px] text-secondary">{annualGenerationUnits.toLocaleString()} units/yr @ ~₹6.67/unit</span>
                </div>
                <span className="text-on-surface font-bold tabular-nums whitespace-nowrap shrink-0 font-mono">
                  {formatINR(annualSavings)} <span className="text-[10px] text-secondary font-normal">/ yr</span>
                </span>
              </div>

              {/* Final Customer Payable */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t-2 border-[#6CBF3D]">
                <div className="flex flex-col">
                  <span className="font-label-md text-xs sm:text-sm text-on-secondary-fixed uppercase tracking-wider font-extrabold">
                    Net Effective Investment
                  </span>
                  <span className="font-body-sm text-[11px] text-secondary">Final customer cost post-DBT reimbursement</span>
                </div>
                <div className="flex items-baseline gap-2 self-start sm:self-auto whitespace-nowrap shrink-0">
                  <span className="text-2xl sm:text-3xl font-black text-on-secondary-fixed tabular-nums whitespace-nowrap inline-flex items-baseline font-mono">
                    {formatINR(finalPayable)}
                  </span>
                  <span className="bg-primary text-on-primary text-label-xs px-2.5 py-0.5 rounded-full shadow-xs font-bold shrink-0">
                    Net
                  </span>
                </div>
              </div>
            </div>

            {/* ROI & Payback Micro-Telemetry Graphic */}
            <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3 border border-surface-container-high">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-secondary font-medium">Estimated Payback Period</span>
                <span className="font-label-md text-on-surface font-bold">{paybackYears} Years</span>
              </div>
              <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-primary-container h-full rounded-full transition-all duration-300" style={{ width: `${paybackPercent}%` }}></div>
              </div>
              <div className="flex items-center justify-between text-[10px] sm:text-label-xs text-secondary gap-2">
                <span className="shrink-0">Break-even: {breakEvenYear}</span>
                <span className="text-right">{25 - Math.ceil(parseFloat(paybackYears))}+ Yrs Free Power</span>
              </div>
            </div>

            {/* Interactive Commercials Card (Dealer Margin OR Admin Company Margin) */}
            <div className="p-3.5 sm:p-4 bg-surface rounded-xl border border-surface-container-high flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-primary text-[18px] sm:text-[20px] shrink-0">
                    {isDirectCompanyQuote ? 'corporate_fare' : 'account_balance_wallet'}
                  </span>
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    {isDirectCompanyQuote ? 'Company Margin' : 'Custom Dealer Margin'}
                  </span>
                  {isDirectCompanyQuote && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6CBF3D]/20 text-[#6CBF3D] border border-[#6CBF3D]/30">
                      Sunvine HO
                    </span>
                  )}
                </div>
                <span className="text-sm sm:text-base text-primary font-bold whitespace-nowrap shrink-0" id="dealerMarginDisplay">
                  {formatINR(dealerMarginINR)}
                </span>
              </div>

              {/* Mode Toggle: % vs ₹ */}
              <div className="flex items-center p-1 bg-surface-container-low rounded-lg border border-surface-container-high self-start">
                <button
                  type="button"
                  onClick={() => setMarginMode('percent')}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    marginMode === 'percent'
                      ? 'bg-primary-container text-on-primary shadow-xs'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span>% Percentage</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMarginMode('amount')}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    marginMode === 'amount'
                      ? 'bg-primary-container text-on-primary shadow-xs'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span>₹ Fixed Amount</span>
                </button>
              </div>

                {/* Preset Chips & Custom Input */}
                {marginMode === 'percent' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {isDirectCompanyQuote && (
                        <button
                          type="button"
                          onClick={() => setDealerMarginRate(0)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginRate === 0
                              ? 'bg-[#6CBF3D] text-[#0F1B2E] font-bold shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          0%
                        </button>
                      )}
                      {[5, 8, 10, 12, 15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDealerMarginRate(pct)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginRate === pct
                              ? 'bg-primary-container text-on-primary shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    {/* Custom % Input */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-secondary font-medium shrink-0">Custom %:</span>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={dealerMarginRate}
                          onChange={(e) => setDealerMarginRate(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 h-8 text-center text-xs font-bold rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                        />
                        <span className="absolute right-2 text-xs text-secondary font-bold pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {isDirectCompanyQuote && (
                        <button
                          type="button"
                          onClick={() => setDealerMarginFixed(0)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginFixed === 0
                              ? 'bg-[#6CBF3D] text-[#0F1B2E] font-bold shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          ₹0
                        </button>
                      )}
                      {[10000, 20000, 30000, 50000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDealerMarginFixed(amt)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginFixed === amt
                              ? 'bg-primary-container text-on-primary shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          ₹{(amt / 1000)}k
                        </button>
                      ))}
                    </div>
                    {/* Custom ₹ Input */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-secondary font-medium shrink-0">Custom ₹:</span>
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-xs text-secondary font-bold pointer-events-none">₹</span>
                        <input
                          type="number"
                          min="0"
                          max="500000"
                          step="1000"
                          value={dealerMarginFixed}
                          onChange={(e) => setDealerMarginFixed(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-24 h-8 pl-5 pr-2 text-xs font-bold rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-surface-container-high">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>
                      Spread: <strong className={isMarginExceeded ? 'text-error font-bold' : 'text-on-surface font-bold'}>{formatINR(currentMarginPerKw)} / kW</strong> ({effectiveMarginPercent}%)
                    </span>
                    <span className="text-secondary/60">•</span>
                    {isDirectCompanyQuote ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                        Sunvine HO Direct
                      </span>
                    ) : (
                      <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-medium">
                        Cap: <strong>{formatINR(maxMarginCapPerKw)}/kW</strong> ({effectiveDealer?.tier || currentDealer?.tier || 'Gold'})
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-primary font-medium text-[10px] bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    <span>Confidential (Hidden from Customer PDF)</span>
                  </span>
                </div>

                {isMarginExceeded && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-on-surface text-xs flex items-start gap-2.5 mt-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[18px] text-error shrink-0">warning</span>
                    <div className="flex-1">
                      <div className="font-bold text-error">
                        Tier Margin Cap Exceeded ({formatINR(currentMarginPerKw)}/kW &gt; {formatINR(maxMarginCapPerKw)}/kW)
                      </div>
                      <p className="text-[11px] text-secondary mt-0.5">
                        Your configured spread exceeds the {effectiveDealer?.tier || currentDealer?.tier || 'Standard'} tier threshold. This quotation will be flagged for Super Admin compliance audit upon submission.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (marginMode === 'amount') {
                            setDealerMarginFixed(Math.round(maxMarginCapPerKw * kw));
                          } else {
                            const capPct = Math.min(50, ((maxMarginCapPerKw * kw) / (baseProjectCost || 1)) * 100);
                            setDealerMarginRate(parseFloat(capPct.toFixed(1)));
                          }
                        }}
                        className="mt-1.5 text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">tune</span>
                        <span>Clamp to Tier Cap ({formatINR(Math.round(maxMarginCapPerKw * kw))})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

          {/* Action Submission Card (In-flow Form Card for Mobile & Desktop) */}
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm border border-surface-container-high flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-secondary uppercase tracking-wider font-semibold">Ready to proceed?</span>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-bold text-on-surface">Generate Customer Proposal</span>
                <span className="text-xs text-primary font-bold">({kw} kW • {formatINR(finalPayable)})</span>
              </div>
              <p className="text-xs text-secondary">
                Generate official 4-page branded PDF ready for preview &amp; WhatsApp sharing.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 min-w-0">
              <button
                onClick={handleReset}
                type="button"
                className="h-10 px-2 rounded-lg bg-surface-container-lowest text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors border border-surface-container-high shadow-xs cursor-pointer text-xs font-semibold flex items-center justify-center gap-1 min-w-0"
                title="Reset form"
              >
                <span className="material-symbols-outlined text-[16px] shrink-0">refresh</span>
                <span className="truncate">Reset</span>
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                type="button"
                className="h-10 px-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors border border-surface-container-high shadow-xs cursor-pointer text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50 min-w-0"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">bookmark_border</span>
                <span className="truncate">{isSubmitting ? 'Saving...' : 'Save Draft'}</span>
              </button>
              <button
                onClick={handlePreview}
                disabled={isSubmitting}
                type="button"
                className="h-10 px-2 rounded-lg bg-[#6CBF3D] hover:bg-[#4F9A2C] active:scale-[0.99] text-white transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer font-bold text-xs disabled:opacity-50 min-w-0"
              >
                <span className="truncate">Preview</span>
                <span className="material-symbols-outlined text-[16px] shrink-0">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inverter Selection Modal */}
      {showInverterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">Select Inverter Model</h3>
              <button
                onClick={() => setShowInverterModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-3">
              {availableInverters.map((inv, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setInverterModel(inv.name);
                    setShowInverterModal(false);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    inverterModel === inv.name
                      ? 'border-primary-container bg-primary/5 ring-1 ring-primary-container'
                      : 'border-surface-container-high hover:border-primary/50'
                  }`}
                >
                  <div>
                    <h4 className="font-label-md text-sm font-bold text-on-surface">{inv.name}</h4>
                    <p className="text-xs text-secondary mt-0.5">{inv.specs}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-container text-primary shrink-0 ml-2">
                    {inv.efficiency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BROWSE ALL 40+ OFFICIAL SOLAR LOAN BANKS & FINTECHS */}
      <SolarBankSelectorModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        selectedBankName={loanBank}
        onSelectBank={(selectedName) => setLoanBank(selectedName)}
      />

      {/* MODAL: SAVE AS KIT PRESET */}
      {isSaveKitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">bookmark_add</span>
                <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">Save Current BOM as Kit</h3>
              </div>
              <button
                onClick={() => setIsSaveKitModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-3.5">
              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-secondary">System Capacity:</span>
                  <strong className="text-on-surface font-mono">{kw} kW ({panelQuantity} Panels)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">BOM Items Count:</span>
                  <strong className="text-on-surface font-mono">{bomItems.length} line items</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">BOM Turnkey Value:</span>
                  <strong className="text-emerald-700 font-mono">{formatINR(bomTotals.grossTurnkeyCost)}</strong>
                </div>
              </div>

              <div>
                <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1.5">
                  Kit Preset Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3.3 kW Standard 6-Panel Field Kit"
                  value={newKitName}
                  onChange={(e) => setNewKitName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface border border-surface-container-high text-xs font-medium text-on-surface focus:border-primary outline-none"
                  autoFocus
                />
                <span className="text-[11px] text-secondary mt-1 block">
                  This kit preset will be stored and available to load across quotations.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setIsSaveKitModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-secondary hover:text-on-surface bg-surface-container hover:bg-surface-container-high cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsKit}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-container cursor-pointer transition-colors shadow-sm"
              >
                Save Kit Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOM BOM LINE ITEM */}
      {showAddCustomBomItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">add_circle</span>
                <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">Add Custom BOM Line Item</h3>
              </div>
              <button
                onClick={() => setShowAddCustomBomItemModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleAddCustomBomItem} className="py-4 space-y-3">
              <div>
                <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1">
                  Product / Service Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra 25mm PVC Conduit Pipe, Portal Fees, Crane Service"
                  value={customItemForm.item}
                  onChange={(e) => setCustomItemForm(prev => ({ ...prev, item: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-surface border border-surface-container-high text-xs font-medium text-on-surface focus:border-primary outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={customItemForm.qty}
                    onChange={(e) => setCustomItemForm(prev => ({ ...prev, qty: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg bg-surface border border-surface-container-high text-xs font-medium text-on-surface focus:border-primary outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1">
                    Unit
                  </label>
                  <select
                    value={customItemForm.unit}
                    onChange={(e) => setCustomItemForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg bg-surface border border-surface-container-high text-xs font-medium text-on-surface focus:border-primary outline-none cursor-pointer"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="NOS">NOS (Numbers)</option>
                    <option value="SET">SET</option>
                    <option value="BAG">BAG</option>
                    <option value="LOT">LOT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1">
                    Unit Rate (₹ before GST) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary font-bold select-none">₹</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={customItemForm.rate}
                      onChange={(e) => setCustomItemForm(prev => ({ ...prev, rate: e.target.value }))}
                      className="w-full h-9 pl-6 pr-3 rounded-lg bg-surface border border-surface-container-high text-xs font-medium text-on-surface focus:border-primary outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1">
                    Statutory GST Rate *
                  </label>
                  <select
                    value={customItemForm.taxRate}
                    onChange={(e) => setCustomItemForm(prev => ({ ...prev, taxRate: Number(e.target.value) }))}
                    className="w-full h-9 px-3 rounded-lg bg-surface border border-surface-container-high text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
                  >
                    <option value={18}>18% (Structure, BOS, Logistics, Service)</option>
                    <option value={5}>5% (Solar PV Modules &amp; Inverter)</option>
                    <option value={0}>0% (Tax Exempted Charge)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1">
                  Technical Specifications / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Heavy Duty, Grade 304, Site Specific Liaisoning"
                  value={customItemForm.specs}
                  onChange={(e) => setCustomItemForm(prev => ({ ...prev, specs: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-surface border border-surface-container-high text-xs font-medium text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high text-xs flex justify-between items-center font-mono">
                <span className="text-secondary font-sans">Estimated Line Total (with GST):</span>
                <strong className="text-emerald-700 text-sm">
                  {formatINR(Math.round((Number(customItemForm.qty) || 1) * (Number(customItemForm.rate) || 0) * (1 + (customItemForm.taxRate || 18) / 100)))}
                </strong>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setShowAddCustomBomItemModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-secondary hover:text-on-surface bg-surface-container hover:bg-surface-container-high cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-container cursor-pointer transition-colors shadow-sm"
                >
                  Add Line Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
