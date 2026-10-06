import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { hardwareService } from '../../services/hardwareService';
import { systemSettingsService } from '../../services/systemSettingsService';
import { STANDARD_BOM_CATALOG } from '../../data/standardBomData';
import ViewModeToggle, { useTableViewMode } from '../Shared/ViewModeToggle';

const DEFAULT_BOM_CATEGORIES = [
  { value: 'structure', label: 'Mounting Structure' },
  { value: 'electrical', label: 'Electrical & Switchgear' },
  { value: 'cables', label: 'Solar Cables & Wiring' },
  { value: 'conduits', label: 'Conduits & Piping' },
  { value: 'safety', label: 'Safety & Earthing' },
  { value: 'metering', label: 'Metering & Auxiliary' },
  { value: 'civil', label: 'Civil Works & Foundation' },
  { value: 'logistics', label: 'Logistics & Transportation' },
  { value: 'other', label: 'Custom Hardware' }
];

const DEFAULT_BOM_UNITS = [
  'Nos', 'Meter', 'Mtr', 'Set', 'Pair', 'Kg', 'Box', 'Roll', 'Packet', 'Packer', 'Bundle', 'Liter', 'Feet'
];

export default function HardwareMaster() {
  const {
    modulesList,
    setModulesList,
    invertersList,
    setInvertersList,
    addNotification,
    pdfBomSpecs,
    dealers,
    isHardwareDbConnected,
    isHardwareDbSyncing,
    bomCatalog,
    setBomCatalog,
    addBomItem,
    updateBomItem,
    deleteBomItem,
    archiveBomItem,
    bomRates,
    updateBomItemRate
  } = useApp();
  const [activeTab, setActiveTab] = useState('modules'); // 'modules' | 'inverters' | 'bos'
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [inverterSearch, setInverterSearch] = useState('');
  const [inverterFilter, setInverterFilter] = useState('all');
  const [bosCapacityFilter, setBosCapacityFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddInverterModal, setShowAddInverterModal] = useState(false);
  const [modulesViewMode, setModulesViewMode] = useTableViewMode('admin_hw_modules');
  const [invertersViewMode, setInvertersViewMode] = useTableViewMode('admin_hw_inverters');
  const [bomViewMode, setBomViewMode] = useTableViewMode('admin_hw_bom');

  // Custom Pure UI Deletion Confirmation State
  const [deleteModalState, setDeleteModalState] = useState(null);

  // Dynamic Units & Categories (Database Persisted)
  const [availableUnits, setAvailableUnits] = useState(DEFAULT_BOM_UNITS);
  const [availableCategories, setAvailableCategories] = useState(DEFAULT_BOM_CATEGORIES);
  const [isAddingCustomUnit, setIsAddingCustomUnit] = useState(false);
  const [customUnitInput, setCustomUnitInput] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Fetch custom units and categories from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    systemSettingsService.getCustomUnitsAndCategories().then(res => {
      if (!isMounted || !res) return;
      if (Array.isArray(res.units) && res.units.length > 0) {
        setAvailableUnits(prev => Array.from(new Set([...prev, ...res.units])));
      }
      if (Array.isArray(res.categories) && res.categories.length > 0) {
        setAvailableCategories(prev => {
          const existingKeys = new Set(prev.map(c => c.value));
          const newCats = res.categories.filter(c => !existingKeys.has(c.value));
          return [...prev, ...newCats];
        });
      }
    });
    return () => { isMounted = false; };
  }, []);

  // BOM Management State
  const [bomSearch, setBomSearch] = useState('');
  const [bomCategoryFilter, setBomCategoryFilter] = useState('all');
  const [showAddBomModal, setShowAddBomModal] = useState(false);
  const [editingBomItem, setEditingBomItem] = useState(null);
  const [showPdfMatrix, setShowPdfMatrix] = useState(false);
  const [bomForm, setBomForm] = useState({
    name: '',
    category: 'structure',
    make: '',
    unit: 'Nos',
    spec: '',
    rate: '450',
    gstRate: '18'
  });

  // Import Specs Modal state (SR-22)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedPreviewItems, setImportedPreviewItems] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  // Import BOM Components Modal state
  const [showImportBomModal, setShowImportBomModal] = useState(false);
  const [importedBomPreviewItems, setImportedBomPreviewItems] = useState([]);
  const [bomImportFileName, setBomImportFileName] = useState('');
  const [bomImportError, setBomImportError] = useState('');
  const bomFileInputRef = useRef(null);

  // Bulk Price Update Modal state (SR-22)
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkRates, setBulkRates] = useState({});
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState('percent'); // 'percent' | 'flat'
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState('');

  const DEFAULT_CELL_TECHS = [
    'TOPCon Mono Bifacial',
    'N-Type TOPCon',
    'Mono PERC',
    'Mono PERC Half-Cut',
    'HJT Ultra-Efficiency',
    'Polycrystalline DCR',
    'Bifacial Dual-Glass TOPCon'
  ];

  const [editingModule, setEditingModule] = useState(null);
  const [editingInverter, setEditingInverter] = useState(null);
  const [isCustomCellTech, setIsCustomCellTech] = useState(false);
  const [customCellTechInput, setCustomCellTechInput] = useState('');

  // Dynamically derived from DB catalog and defaults — no local storage fragmentation
  const availableCellTechs = Array.from(new Set([
    ...DEFAULT_CELL_TECHS,
    ...(modulesList || []).map(m => m.cellTech).filter(Boolean)
  ]));
  const customCellTechs = availableCellTechs;

  const [moduleForm, setModuleForm] = useState({
    brand: '',
    model: '',
    cellTech: 'TOPCon Mono Bifacial',
    wattage: '550',
    efficiency: '22.6%',
    ratePerWp: '19.20',
    warranty: '30 Years Performance',
    dimensions: '2278 × 1134 × 30 mm | 28 kg'
  });

  const [inverterForm, setInverterForm] = useState({
    brand: '',
    model: '',
    capacity: '5 kW',
    phase: '3-Phase 415V',
    efficiency: '98.4%',
    warranty: '10 Years'
  });

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleOpenAddModule = () => {
    setEditingModule(null);
    setModuleForm({
      brand: '',
      model: '',
      cellTech: 'TOPCon Mono Bifacial',
      wattage: '550',
      efficiency: '22.6%',
      ratePerWp: '19.20',
      warranty: '30 Years Performance',
      dimensions: '2278 × 1134 × 30 mm | 28 kg'
    });
    setIsCustomCellTech(false);
    setCustomCellTechInput('');
    setShowAddModuleModal(true);
  };

  const handleEditModule = (mod) => {
    setEditingModule(mod);
    setModuleForm({
      brand: mod.brand || '',
      model: mod.model || '',
      cellTech: mod.cellTech || 'TOPCon Mono Bifacial',
      wattage: String(mod.wattage || 550),
      efficiency: mod.efficiency || '22.6%',
      ratePerWp: mod.ratePerWp ? String(mod.ratePerWp).replace(/[^0-9.]/g, '') : '19.20',
      warranty: mod.warranty || '30 Years Performance',
      dimensions: mod.dimensions || '2278 × 1134 × 30 mm | 28 kg'
    });
    setIsCustomCellTech(false);
    setCustomCellTechInput('');
    setShowAddModuleModal(true);
  };

  const handleToggleArchiveModule = async (mod) => {
    const isCurrentlyArchived = !!mod.isArchived;
    const confirmMsg = isCurrentlyArchived
      ? `Restore and unarchive ${mod.brand} ${mod.model} to active dealer catalog?`
      : `Archive ${mod.brand} ${mod.model}? It will be hidden from dealer quotation selection.`;

    if (window.confirm(confirmMsg)) {
      const updated = { ...mod, isArchived: !isCurrentlyArchived };
      if (setModulesList) {
        setModulesList(prev => prev.map(m => m.id === mod.id ? updated : m));
      }
      await hardwareService.archiveModule(mod.id, !isCurrentlyArchived);

      if (addNotification) {
        addNotification({
          type: isCurrentlyArchived ? 'success' : 'warning',
          icon: isCurrentlyArchived ? 'unarchive' : 'archive',
          title: isCurrentlyArchived ? `Solar Module Restored: ${mod.brand} ${mod.model}` : `Solar Module Archived: ${mod.brand} ${mod.model}`,
          description: isCurrentlyArchived
            ? `${mod.brand} ${mod.model} re-enabled for all dealer proposals.`
            : `${mod.brand} ${mod.model} archived and disabled from dealer quotation selection.`,
          audience: 'all'
        });
      }
      triggerToast(isCurrentlyArchived ? `Restored ${mod.brand} ${mod.model} in database!` : `Archived ${mod.brand} ${mod.model} in database!`);
    }
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleForm.brand.trim() || !moduleForm.model.trim()) return;

    let finalCellTech = moduleForm.cellTech;
    if (isCustomCellTech && customCellTechInput.trim()) {
      finalCellTech = customCellTechInput.trim();
    }

    const wattageNum = Number(moduleForm.wattage) || 550;
    const rateClean = String(moduleForm.ratePerWp).replace(/[^0-9.]/g, '') || '19.20';
    const rateFormatted = `₹ ${rateClean}/Wp`;

    const isEdit = !!editingModule;
    const currentEditing = editingModule;
    const brandTrimmed = moduleForm.brand.trim();
    const modelTrimmed = moduleForm.model.trim();

    // 1. Immediately close modal and reset state so modal never hangs
    setShowAddModuleModal(false);
    setEditingModule(null);
    setIsCustomCellTech(false);
    setCustomCellTechInput('');
    setModuleForm({
      brand: '',
      model: '',
      cellTech: 'TOPCon Mono Bifacial',
      wattage: '550',
      efficiency: '22.6%',
      ratePerWp: '19.20',
      warranty: '30 Years Performance',
      dimensions: '2278 × 1134 × 30 mm | 28 kg'
    });

    if (isEdit && currentEditing) {
      const updatedMod = {
        ...currentEditing,
        brand: brandTrimmed,
        model: modelTrimmed,
        cellTech: finalCellTech,
        wattage: wattageNum,
        efficiency: moduleForm.efficiency.trim() || '22.6%',
        ratePerWp: rateFormatted,
        warranty: moduleForm.warranty.trim() || '30 Years Performance',
        dimensions: moduleForm.dimensions?.trim() || currentEditing.dimensions || '2278 × 1134 × 30 mm | 28 kg'
      };

      if (setModulesList) {
        setModulesList(prev => (prev || []).map(m => m.id === currentEditing.id ? updatedMod : m));
      }

      if (addNotification) {
        addNotification({
          type: 'success',
          icon: 'solar_power',
          title: `Updated Solar Module: ${updatedMod.brand} ${updatedMod.model}`,
          description: `${updatedMod.wattage}W (${updatedMod.cellTech}) specifications updated.`,
          audience: 'all',
          targetTab: 'create_quote'
        });
      }

      const res = await hardwareService.saveModule(updatedMod);
      if (res && res.success) {
        triggerToast(`Saved ${updatedMod.brand} ${updatedMod.model} to Supabase database!`);
      } else {
        triggerToast(`Saved locally. (Supabase not reached: ${res?.error || 'Project Paused / Offline'})`);
      }
    } else {
      const newMod = {
        id: `mod-${Date.now()}`,
        brand: brandTrimmed,
        model: modelTrimmed,
        cellTech: finalCellTech,
        wattage: wattageNum,
        efficiency: moduleForm.efficiency.trim() || '22.6%',
        ratePerWp: rateFormatted,
        warranty: moduleForm.warranty.trim() || '30 Years Performance',
        dimensions: moduleForm.dimensions?.trim() || '2278 × 1134 × 30 mm | 28 kg',
        isNew: true,
        createdAt: Date.now()
      };

      if (setModulesList) {
        setModulesList(prev => [newMod, ...(prev || [])]);
      }

      if (addNotification) {
        addNotification({
          type: 'success',
          icon: 'solar_power',
          title: `New Solar Module Added: ${newMod.brand} ${newMod.model}`,
          description: `High-efficiency ${newMod.wattage}W (${newMod.cellTech}) published.`,
          audience: 'all',
          targetTab: 'create_quote'
        });
      }

      const res = await hardwareService.saveModule(newMod);
      if (res && res.success) {
        triggerToast(`Added ${newMod.brand} ${newMod.model} to Supabase database!`);
      } else {
        triggerToast(`Added locally. (Supabase not reached: ${res?.error || 'Project Paused / Offline'})`);
      }
    }
  };

  const getInverterCapacityText = (inv) => {
    if (inv?.capacity) {
      return String(inv.capacity).toLowerCase().includes('kw') ? inv.capacity : `${inv.capacity} kW`;
    }
    if (inv?.capacityKW !== undefined && inv?.capacityKW !== null) {
      return `${inv.capacityKW} kW`;
    }
    const match = inv?.model?.match(/(\d+(?:\.\d+)?)\s*KW/i);
    if (match) {
      return `${match[1]} kW`;
    }
    return '-';
  };

  const handleOpenAddInverter = () => {
    setEditingInverter(null);
    setInverterForm({
      brand: '',
      model: '',
      capacity: '5 kW',
      phase: '3-Phase 415V',
      efficiency: '98.4%',
      warranty: '10 Years',
      basePrice: '₹ 54,000'
    });
    setShowAddInverterModal(true);
  };

  const handleEditInverter = (inv) => {
    setEditingInverter(inv);
    setInverterForm({
      brand: inv.brand || '',
      model: inv.model || '',
      capacity: inv.capacity || `${inv.capacityKW || 5.0} kW`,
      phase: inv.phase || '3-Phase 415V',
      efficiency: inv.efficiency || '98.4%',
      warranty: inv.warranty || '10 Years',
      basePrice: inv.basePrice || '₹ 54,000'
    });
    setShowAddInverterModal(true);
  };

  const handleToggleArchiveInverter = async (inv) => {
    const isCurrentlyArchived = !!inv.isArchived;
    const confirmMsg = isCurrentlyArchived
      ? `Restore and unarchive ${inv.brand} ${inv.model} to active catalog?`
      : `Archive ${inv.brand} ${inv.model}? It will be hidden from dealer quotations.`;

    if (window.confirm(confirmMsg)) {
      const updated = { ...inv, isArchived: !isCurrentlyArchived };
      if (setInvertersList) {
        setInvertersList(prev => (prev || []).map(i => i.id === inv.id ? updated : i));
      }
      await hardwareService.archiveInverter(inv.id, !isCurrentlyArchived);
      triggerToast(isCurrentlyArchived ? `Restored ${inv.brand} ${inv.model} in database!` : `Archived ${inv.brand} ${inv.model} in database!`);
    }
  };

  const handleSaveInverter = async (e) => {
    e.preventDefault();
    if (!inverterForm.brand.trim() || !inverterForm.model.trim()) return;
    const rawCap = inverterForm.capacity?.trim() || '5.0 kW';
    const formattedCap = rawCap.toLowerCase().includes('kw') ? rawCap : `${rawCap} kW`;
    const numCap = parseFloat(rawCap.replace(/[^0-9.]/g, '')) || 5.0;

    const isEdit = !!editingInverter;
    const currentEditingInv = editingInverter;
    const brandTrimmed = inverterForm.brand.trim();
    const modelTrimmed = inverterForm.model.trim();

    // 1. Immediately close modal and reset form
    setShowAddInverterModal(false);
    setEditingInverter(null);
    setInverterForm({
      brand: '',
      model: '',
      capacity: '5 kW',
      phase: '3-Phase 415V',
      efficiency: '98.4%',
      warranty: '10 Years',
      basePrice: '₹ 54,000'
    });

    if (isEdit && currentEditingInv) {
      const updatedInv = {
        ...currentEditingInv,
        brand: brandTrimmed,
        model: modelTrimmed,
        capacity: formattedCap,
        capacityKW: numCap,
        phase: inverterForm.phase,
        efficiency: inverterForm.efficiency,
        warranty: inverterForm.warranty,
        basePrice: inverterForm.basePrice || currentEditingInv.basePrice || '₹ 54,000'
      };
      if (setInvertersList) {
        setInvertersList(prev => (prev || []).map(i => i.id === currentEditingInv.id ? updatedInv : i));
      }
      const res = await hardwareService.saveInverter(updatedInv);
      if (res && res.success) {
        triggerToast(`Saved ${updatedInv.brand} ${updatedInv.model} to Supabase database!`);
      } else {
        triggerToast(`Saved locally. (Supabase not reached: ${res?.error || 'Project Paused / Offline'})`);
      }
    } else {
      const newInv = {
        id: `inv-${Date.now()}`,
        brand: brandTrimmed,
        model: modelTrimmed,
        capacity: formattedCap,
        capacityKW: numCap,
        phase: inverterForm.phase,
        efficiency: inverterForm.efficiency,
        warranty: inverterForm.warranty,
        basePrice: inverterForm.basePrice || '₹ 54,000',
        createdAt: Date.now()
      };
      if (setInvertersList) {
        setInvertersList(prev => [...(prev || []), newInv]);
      }
      const res = await hardwareService.saveInverter(newInv);
      if (res && res.success) {
        triggerToast(`Added ${newInv.brand} ${newInv.model} to Supabase database!`);
      } else {
        triggerToast(`Added locally. (Supabase not reached: ${res?.error || 'Project Paused / Offline'})`);
      }
    }
  };

  const handleDeleteModule = (mod) => {
    setDeleteModalState({
      title: 'Delete Solar PV Module',
      badge: 'Solar PV Module',
      itemName: `${mod.brand} ${mod.model}`,
      itemDetails: `${mod.wattage}W · ${mod.cellTech || ''} · ${mod.dimensions || ''}`,
      itemRate: mod.ratePerWp ? `${mod.ratePerWp}` : 'Benchmark Rate',
      warning: 'This module will be permanently removed from the catalog, presets, and Supabase database.',
      confirmButtonText: 'Permanently Delete Module',
      onConfirm: async () => {
        if (setModulesList) {
          setModulesList(prev => (prev || []).filter(m => m.id !== mod.id));
        }
        await hardwareService.deleteModule(mod.id);
        triggerToast(`Removed ${mod.brand} ${mod.model} from database`);
        setDeleteModalState(null);
      }
    });
  };

  const handleDeleteInverter = (inv) => {
    setDeleteModalState({
      title: 'Delete String Inverter',
      badge: 'Solar Inverter',
      itemName: `${inv.brand} ${inv.model}`,
      itemDetails: `${inv.capacity || `${inv.capacityKW} kW`} · ${inv.phase || ''} · ${inv.warranty || ''}`,
      itemRate: inv.basePrice || 'Benchmark Price',
      warning: 'This inverter model will be permanently removed from the catalog, presets, and Supabase database.',
      confirmButtonText: 'Permanently Delete Inverter',
      onConfirm: async () => {
        if (setInvertersList) {
          setInvertersList(prev => (prev || []).filter(i => i.id !== inv.id));
        }
        await hardwareService.deleteInverter(inv.id);
        triggerToast(`Removed ${inv.brand} ${inv.model} from database`);
        setDeleteModalState(null);
      }
    });
  };

  // Custom Unit & Category Handlers
  const handleAddCustomUnit = async () => {
    const clean = customUnitInput.trim();
    if (!clean) return;
    if (!availableUnits.includes(clean)) {
      const nextUnits = [...availableUnits, clean];
      setAvailableUnits(nextUnits);
      await systemSettingsService.saveCustomUnitsAndCategories(nextUnits, availableCategories);
      triggerToast(`Custom unit "${clean}" saved to database!`);
    }
    setBomForm(prev => ({ ...prev, unit: clean }));
    setCustomUnitInput('');
    setIsAddingCustomUnit(false);
  };

  const handleAddCustomCategory = async () => {
    const clean = customCategoryInput.trim();
    if (!clean) return;
    const catKey = clean.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!availableCategories.some(c => c.value === catKey)) {
      const newCatObj = { value: catKey, label: clean };
      const nextCats = [...availableCategories, newCatObj];
      setAvailableCategories(nextCats);
      await systemSettingsService.saveCustomUnitsAndCategories(availableUnits, nextCats);
      triggerToast(`Custom category "${clean}" saved to database!`);
    }
    setBomForm(prev => ({ ...prev, category: catKey }));
    setCustomCategoryInput('');
    setIsAddingCustomCategory(false);
  };

  // ==========================================
  // BILL OF MATERIALS (BOM) CATALOG CONTROLS
  // ==========================================
  const handleOpenAddBom = () => {
    setEditingBomItem(null);
    setBomForm({
      name: '',
      category: 'structure',
      make: '',
      unit: 'Nos',
      spec: '',
      rate: '',
      gstRate: '18'
    });
    setIsAddingCustomCategory(false);
    setIsAddingCustomUnit(false);
    setShowAddBomModal(true);
  };

  const handleEditBom = (item) => {
    setEditingBomItem(item);
    setBomForm({
      name: item.name || '',
      category: item.category || 'structure',
      make: item.make || '',
      unit: item.unit || 'Nos',
      spec: item.spec || item.specs || '',
      rate: item.rate !== undefined ? String(item.rate) : (item.defaultRate !== undefined ? String(item.defaultRate) : ''),
      gstRate: item.gstRate !== undefined ? String(item.gstRate) : '18'
    });
    setIsAddingCustomCategory(false);
    setIsAddingCustomUnit(false);
    setShowAddBomModal(true);
  };

  const handleToggleArchiveBom = (item) => {
    const isCurrentlyArchived = !!item.isArchived;
    setDeleteModalState({
      title: isCurrentlyArchived ? 'Restore BOM Component' : 'Archive BOM Component',
      badge: isCurrentlyArchived ? 'RESTORE ITEM' : 'ARCHIVE ITEM',
      itemName: item.name,
      itemDetails: `Category: ${item.category || 'structure'} · Unit: ${item.unit || 'Nos'}`,
      itemRate: `₹ ${Number(item.rate || item.defaultRate || 0).toLocaleString('en-IN')}`,
      warning: isCurrentlyArchived
        ? 'This item will be restored and will appear in active quotation presets and BOM builder.'
        : 'This item will be archived and hidden from default quotation presets.',
      confirmButtonText: isCurrentlyArchived ? 'Restore Component' : 'Archive Component',
      isArchive: !isCurrentlyArchived,
      isRestore: isCurrentlyArchived,
      onConfirm: async () => {
        if (archiveBomItem) {
          await archiveBomItem(item.id, !isCurrentlyArchived);
        }
        triggerToast(isCurrentlyArchived ? `Restored ${item.name}` : `Archived ${item.name}`);
        setDeleteModalState(null);
      }
    });
  };

  const handleDeleteBom = (item) => {
    setDeleteModalState({
      title: 'Delete BOM Hardware Component',
      badge: (item.category || 'BOM ITEM').toUpperCase(),
      itemName: item.name,
      itemDetails: `Make: ${item.make || 'Approved Brand'} · Unit: ${item.unit || 'Nos'} · GST: ${item.gstRate || 18}%`,
      itemRate: `₹ ${Number(item.rate || item.defaultRate || 0).toLocaleString('en-IN')}`,
      warning: 'This component will be permanently removed from BOM catalog, standard presets, and Supabase database.',
      confirmButtonText: 'Permanently Delete Component',
      onConfirm: async () => {
        if (deleteBomItem) {
          await deleteBomItem(item.id);
        }
        triggerToast(`Removed ${item.name} from catalog and database`);
        setDeleteModalState(null);
      }
    });
  };

  const handleSaveBom = async (e) => {
    e.preventDefault();
    if (!bomForm.name.trim()) {
      triggerToast('Please provide an item name');
      return;
    }

    const rateNum = parseFloat(bomForm.rate) || 0;
    const gstNum = parseFloat(bomForm.gstRate) || 18;
    const isEdit = !!editingBomItem;

    setShowAddBomModal(false);

    if (isEdit && editingBomItem) {
      const updatedItem = {
        ...editingBomItem,
        name: bomForm.name.trim(),
        category: bomForm.category,
        make: bomForm.make.trim(),
        unit: bomForm.unit.trim() || 'Nos',
        spec: bomForm.spec.trim(),
        rate: rateNum,
        gstRate: gstNum
      };
      if (updateBomItem) {
        await updateBomItem(updatedItem);
      }
      triggerToast(`Updated ${updatedItem.name} in database`);
    } else {
      const newItem = {
        name: bomForm.name.trim(),
        category: bomForm.category,
        make: bomForm.make.trim(),
        unit: bomForm.unit.trim() || 'Nos',
        spec: bomForm.spec.trim(),
        rate: rateNum,
        gstRate: gstNum,
        isArchived: false,
        status: 'active'
      };
      if (addBomItem) {
        await addBomItem(newItem);
      }
      triggerToast(`Added ${newItem.name} to database`);
    }
  };

  // ==========================================
  // HARDWARE CATALOG CONTROLS (SR-22)
  // ==========================================

  // 1. Export Ledger to CSV
  const handleExportLedger = () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      let csv = '=== SUNVINE RENEWABLE ENERGY - SOLAR HARDWARE CATALOG ===\n';
      csv += `Export Date: ${new Date().toLocaleString('en-IN')}\n\n`;

      // 1. Solar Modules
      csv += '--- APPROVED SOLAR PHOTOVOLTAIC MODULES ---\n';
      csv += 'Brand,Model,Cell Technology,Rated Wattage (Wp),Efficiency,Benchmark Rate (₹/Wp),Product & Power Warranty,Physical Dimensions,Status\n';
      (modulesList || []).forEach(m => {
        const row = [
          `"${(m.brand || '').replace(/"/g, '""')}"`,
          `"${(m.model || '').replace(/"/g, '""')}"`,
          `"${(m.cellTech || '').replace(/"/g, '""')}"`,
          m.wattage || '',
          `"${(m.efficiency || '').replace(/"/g, '""')}"`,
          `"${(m.ratePerWp || '').replace(/"/g, '""')}"`,
          `"${(m.warranty || '').replace(/"/g, '""')}"`,
          `"${(m.dimensions || '').replace(/"/g, '""')}"`,
          m.isArchived ? 'Archived' : 'Active'
        ];
        csv += row.join(',') + '\n';
      });

      // 2. Solar Inverters
      csv += '\n--- APPROVED SOLAR STRING INVERTERS ---\n';
      csv += 'Brand,Model / Series,Rated Capacity (kW),Phase Topology,Peak Efficiency,Manufacturer Warranty,Status\n';
      (invertersList || []).forEach(inv => {
        const row = [
          `"${(inv.brand || '').replace(/"/g, '""')}"`,
          `"${(inv.model || '').replace(/"/g, '""')}"`,
          `"${getInverterCapacityText(inv).replace(/"/g, '""')}"`,
          `"${(inv.phase || '').replace(/"/g, '""')}"`,
          `"${(inv.efficiency || '').replace(/"/g, '""')}"`,
          `"${(inv.warranty || '').replace(/"/g, '""')}"`,
          inv.isArchived ? 'Archived' : 'Active'
        ];
        csv += row.join(',') + '\n';
      });

      // 3. BOM Specs
      if (pdfBomSpecs && pdfBomSpecs.length > 0) {
        csv += '\n--- BILL OF MATERIALS (BOM) BENCHMARK SPECIFICATIONS ---\n';
        csv += 'Component Category,Item Description & Make,Specification & Standard,Benchmark Scope\n';
        pdfBomSpecs.forEach(b => {
          const row = [
            `"${(b.category || '').replace(/"/g, '""')}"`,
            `"${(b.item || '').replace(/"/g, '""')}"`,
            `"${(b.spec || '').replace(/"/g, '""')}"`,
            `"${(b.scope || 'Turnkey EPC Scope').replace(/"/g, '""')}"`
          ];
          csv += row.join(',') + '\n';
        });
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Sunvine_Solar_Hardware_Catalog_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast('Hardware catalog inventory spreadsheet exported successfully!');
    } catch (err) {
      console.error(err);
      triggerToast('Failed to export catalog spreadsheet');
    }
  };

  // 2. Download Sample CSV Template for Import
  const handleDownloadSampleCsvTemplate = () => {
    const csv = `Brand,Model,Cell Technology,Rated Wattage,Efficiency,Rate Per Wp,Warranty,Dimensions
Waaree,585W TOPCon Bifacial,N-Type TOPCon,585,22.6%,19.50,30 Years Performance,2278 × 1134 × 30 mm | 28 kg
Rayzone,600W Bi-Fi Elite,TOPCon Mono Bifacial,600,22.8%,19.80,30 Years Performance,2278 × 1134 × 30 mm | 28 kg
Adani Solar,550W Vertex Dual Glass,Mono PERC,550,21.5%,18.90,25 Years Performance,2278 × 1134 × 30 mm | 28 kg`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sunvine_hardware_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Sample CSV template downloaded!');
  };

  // 3. File upload and parse handler for Import
  const handleFileSelect = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');
    setImportedPreviewItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (!text || typeof text !== 'string') {
          setImportError('File is empty or unreadable.');
          return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('===') && !l.startsWith('---'));
        if (lines.length < 2) {
          setImportError('No valid data rows found in file.');
          return;
        }

        const headerLine = lines[0];
        const delimiter = headerLine.includes('\t') ? '\t' : ',';
        const headers = headerLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

        const brandIdx = headers.findIndex(h => h.includes('brand') || h.includes('oem') || h.includes('make'));
        const modelIdx = headers.findIndex(h => h.includes('model') || h.includes('series'));
        const cellTechIdx = headers.findIndex(h => h.includes('cell') || h.includes('tech'));
        const wattIdx = headers.findIndex(h => h.includes('watt') || h.includes('capacity') || h.includes('power'));
        const effIdx = headers.findIndex(h => h.includes('eff'));
        const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price') || h.includes('wp'));
        const warIdx = headers.findIndex(h => h.includes('war'));
        const dimIdx = headers.findIndex(h => h.includes('dim'));

        if (brandIdx === -1 || modelIdx === -1) {
          setImportError('Could not find required "Brand" and "Model" header columns in CSV.');
          return;
        }

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const rawRow = lines[i];
          const cols = rawRow.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
          if (cols.length < 2 || !cols[brandIdx] || !cols[modelIdx]) continue;

          const brand = cols[brandIdx];
          const model = cols[modelIdx];
          const cellTech = cellTechIdx >= 0 && cols[cellTechIdx] ? cols[cellTechIdx] : 'N-Type TOPCon';
          const wattage = wattIdx >= 0 && cols[wattIdx] ? parseFloat(cols[wattIdx].replace(/[^0-9.]/g, '')) || 585 : 585;
          const efficiency = effIdx >= 0 && cols[effIdx] ? cols[effIdx] : '22.6%';
          const rawRate = rateIdx >= 0 && cols[rateIdx] ? parseFloat(cols[rateIdx].replace(/[^0-9.]/g, '')) || 19.50 : 19.50;
          const warranty = warIdx >= 0 && cols[warIdx] ? cols[warIdx] : '30 Years Performance';
          const dimensions = dimIdx >= 0 && cols[dimIdx] ? cols[dimIdx] : '2278 × 1134 × 30 mm | 28 kg';

          parsed.push({
            id: `mod-imp-${Date.now()}-${i}`,
            brand,
            model,
            cellTech,
            wattage,
            efficiency,
            ratePerWp: `₹ ${rawRate.toFixed(2)}`,
            warranty,
            dimensions,
            isNew: true,
            createdAt: Date.now()
          });
        }

        if (parsed.length === 0) {
          setImportError('No valid module specifications could be parsed from this file.');
          return;
        }

        setImportedPreviewItems(parsed);
      } catch (err) {
        console.error(err);
        setImportError('Error parsing file: ' + err.message);
      }
    };
    reader.onerror = () => setImportError('Failed to read selected file.');
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importedPreviewItems.length === 0) return;

    if (setModulesList) {
      setModulesList(prev => [...importedPreviewItems, ...(prev || [])]);
    }
    // Sync directly to Supabase DB
    await hardwareService.bulkImportModules(importedPreviewItems);

    if (addNotification) {
      addNotification({
        type: 'success',
        icon: 'upload_file',
        title: `Imported ${importedPreviewItems.length} Module Specifications`,
        description: `Catalog bulk imported from ${importFileName || 'file'}. Synced to Supabase database.`,
        audience: 'all',
        targetTab: 'create_quote'
      });
    }

    triggerToast(`Successfully imported and synced ${importedPreviewItems.length} module specifications to database!`);
    setShowImportModal(false);
    setImportedPreviewItems([]);
    setImportFileName('');
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // BOM File Import Handlers
  const handleOpenImportBom = () => {
    setImportedBomPreviewItems([]);
    setBomImportFileName('');
    setBomImportError('');
    setShowImportBomModal(true);
  };

  const handleBomFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBomImportFileName(file.name);
    setBomImportError('');
    setImportedBomPreviewItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (!text || typeof text !== 'string') {
          setBomImportError('File appears to be empty or unreadable.');
          return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          setBomImportError('File must contain a header row and at least one item data row.');
          return;
        }

        const headerLine = lines[0];
        const delimiter = headerLine.includes('\t') ? '\t' : (headerLine.includes(';') ? ';' : ',');
        const headers = headerLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

        const nameIdx = headers.findIndex(h => h.includes('item') || h.includes('name') || h.includes('component') || h.includes('description') || h.includes('material') || h === 'category');
        const brandIdx = headers.findIndex(h => h.includes('brand') || h.includes('make') || h.includes('oem') || h.includes('manufacturer'));
        const catIdx = headers.findIndex(h => (h.includes('category') && h !== 'category') || h.includes('cat') || h.includes('group') || h.includes('type'));
        const unitIdx = headers.findIndex(h => h.includes('unit') || h.includes('uom'));
        const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price') || h.includes('cost') || h.includes('amount'));
        const modelIdx = headers.findIndex(h => h.includes('model') || h.includes('spec') || h.includes('size'));
        const phaseIdx = headers.findIndex(h => h.includes('phase'));
        const kwIdx = headers.findIndex(h => h.includes('kw') || h.includes('watt') || h.includes('capacity'));
        const gstIdx = headers.findIndex(h => h.includes('gst') || h.includes('tax'));

        if (nameIdx === -1 && brandIdx === -1) {
          setBomImportError('Could not find required item name/category column in file header.');
          return;
        }

        const actualNameIdx = nameIdx !== -1 ? nameIdx : 0;
        const parsed = [];

        for (let i = 1; i < lines.length; i++) {
          const rawRow = lines[i];
          const cols = rawRow.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
          if (cols.length === 0 || !cols[actualNameIdx]) continue;

          let rawName = cols[actualNameIdx].trim();
          const rawModel = modelIdx >= 0 && cols[modelIdx] ? cols[modelIdx].trim() : '';
          const rawPhase = phaseIdx >= 0 && cols[phaseIdx] ? cols[phaseIdx].trim() : '';
          const rawKw = kwIdx >= 0 && cols[kwIdx] ? cols[kwIdx].trim() : '';

          // If model is like 60X40 and name is GI PIPE, format to GI PIPE 60X40
          if (rawModel && !rawName.toLowerCase().includes(rawModel.toLowerCase())) {
            rawName = `${rawName} ${rawModel}`;
          }

          const rawBrand = brandIdx >= 0 && cols[brandIdx] ? cols[brandIdx].trim() : 'STANDARD';
          let rawCat = catIdx >= 0 && cols[catIdx] ? cols[catIdx].toLowerCase() : '';
          
          // Auto deduce category
          if (!rawCat || !['structure', 'electrical', 'cables', 'conduits', 'safety'].includes(rawCat)) {
            const low = (rawName + ' ' + rawModel + ' ' + rawPhase).toLowerCase();
            if ((low.includes('pipe') && low.includes('gi')) || low.includes('stud') || low.includes('nut') || low.includes('wiser') || low.includes('washer') || low.includes('zinc') || low.includes('angle') || low.includes('fasner') || low.includes('fastener') || low.includes('bolt')) {
              rawCat = 'structure';
            } else if (low.includes('acdb') || low.includes('dcdb') || low.includes('mc4') || low.includes('inverter') || low.includes('switchgear')) {
              rawCat = 'electrical';
            } else if (low.includes('cable') || low.includes('wire') || low.includes('tye') || low.includes('tie')) {
              rawCat = (low.includes('earthing') || low.includes('la')) ? 'safety' : 'cables';
            } else if (low.includes('pvc') || low.includes('elbow') || low.includes('tee') || low.includes('saddle') || low.includes('conduit')) {
              rawCat = 'conduits';
            } else if (low.includes('earthing') || low.includes('la')) {
              rawCat = 'safety';
            } else {
              rawCat = 'structure';
            }
          }

          // Auto deduce unit if not specified
          let rawUnit = unitIdx >= 0 && cols[unitIdx] ? cols[unitIdx].trim() : '';
          if (!rawUnit) {
            const low = rawName.toLowerCase();
            if (low.includes('pipe') && !low.includes('pvc elbow') && !low.includes('pvc tee')) {
              rawUnit = 'Meter';
            } else if (low.includes('cable') || low.includes('wire')) {
              rawUnit = 'Meter';
            } else if (low.includes('combo') || low.includes('kit') || low.includes('set')) {
              rawUnit = 'Set';
            } else if (low.includes('mc4') || low.includes('pair')) {
              rawUnit = 'Pair';
            } else if (low.includes('tye') || low.includes('tie') || low.includes('clip') || low.includes('packet')) {
              rawUnit = 'Packet';
            } else if (low.includes('spray')) {
              rawUnit = 'Can';
            } else {
              rawUnit = 'Nos';
            }
          }

          const rateClean = rateIdx >= 0 && cols[rateIdx] ? parseFloat(cols[rateIdx].replace(/[^0-9.]/g, '')) || 0 : 0;
          
          // Combine specs from model, phase, kw
          const specParts = [rawModel, rawPhase, rawKw ? `${rawKw} KW` : ''].filter(Boolean);
          const specClean = specParts.join(', ');
          const gstClean = gstIdx >= 0 && cols[gstIdx] ? parseFloat(cols[gstIdx].replace(/[^0-9.]/g, '')) || 18 : 18;

          const slugId = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

          parsed.push({
            id: slugId || `bom_imp_${Date.now()}_${i}`,
            name: rawName,
            make: rawBrand,
            category: rawCat,
            unit: rawUnit,
            defaultRate: rateClean,
            rate: rateClean,
            specs: specClean,
            description: specClean || rawName,
            gstRate: gstClean,
            isNew: true
          });
        }

        if (parsed.length === 0) {
          setBomImportError('No valid BOM component rows could be parsed from this file.');
          return;
        }

        setImportedBomPreviewItems(parsed);
      } catch (err) {
        console.error(err);
        setBomImportError('Error parsing file: ' + err.message);
      }
    };
    reader.onerror = () => setBomImportError('Failed to read selected file.');
    reader.readAsText(file);
  };

  const handleConfirmBomImport = async () => {
    if (importedBomPreviewItems.length === 0) return;

    if (setBomCatalog) {
      setBomCatalog(prev => {
        const mergedMap = new Map();
        (prev || []).forEach(it => mergedMap.set(it.id, it));
        importedBomPreviewItems.forEach(it => mergedMap.set(it.id, { ...(mergedMap.get(it.id) || {}), ...it }));
        return Array.from(mergedMap.values());
      });
    }

    if (updateBomItemRate) {
      importedBomPreviewItems.forEach(it => {
        if (it.defaultRate !== undefined) {
          updateBomItemRate(it.id, it.defaultRate);
        }
      });
    }

    // Upsert into Supabase bom_catalog table
    await hardwareService.bulkImportBomItems(importedBomPreviewItems);

    if (addNotification) {
      addNotification({
        type: 'success',
        icon: 'inventory_2',
        title: `Imported ${importedBomPreviewItems.length} BOM Components`,
        description: `BOM catalog updated from ${bomImportFileName || 'Excel / CSV'}. Persisted to Supabase database.`,
        audience: 'all',
        targetTab: 'pricing_master'
      });
    }

    triggerToast(`Successfully imported & synced ${importedBomPreviewItems.length} BOM components to database!`);
    setShowImportBomModal(false);
    setImportedBomPreviewItems([]);
    setBomImportFileName('');
    setBomImportError('');
    if (bomFileInputRef.current) bomFileInputRef.current.value = '';
  };

  const handleResetToMasterBom = async () => {
    if (window.confirm('Load all 24 official Gujarat Rooftop BOM specifications and rates from Excel master into your catalog?')) {
      if (setBomCatalog) {
        setBomCatalog(STANDARD_BOM_CATALOG);
      }
      if (updateBomItemRate) {
        STANDARD_BOM_CATALOG.forEach(it => {
          updateBomItemRate(it.id, it.defaultRate);
        });
      }
      await hardwareService.bulkImportBomItems(STANDARD_BOM_CATALOG);
      triggerToast('Successfully loaded and synced all 24 Master BOM components to database!');
    }
  };

  const handleDownloadSampleBomCsvTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(
      'Item Name,Make / Brand,Category,Unit,Rate (₹),Model / Specs,GST Rate (%)\n' +
      STANDARD_BOM_CATALOG.map(it => 
        `"${it.name}","${it.make || 'STANDARD'}","${it.category}","${it.unit}","${it.defaultRate}","${it.specs || it.description || ''}","${it.gstRate || 18}"`
      ).join('\n')
    );
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'master_bom_catalog_24_items.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Bulk Price Update Handlers
  const handleOpenBulkPriceModal = () => {
    const initialRates = {};
    (modulesList || []).forEach(m => {
      const cleanRate = parseFloat(String(m.ratePerWp || '19.20').replace(/[^0-9.]/g, '')) || 19.20;
      initialRates[m.id] = cleanRate;
    });
    setBulkRates(initialRates);
    setBulkAdjustmentValue('');
    setShowBulkPriceModal(true);
  };

  const handleApplyBulkAdjustment = () => {
    const val = parseFloat(bulkAdjustmentValue);
    if (isNaN(val) || val === 0) return;

    setBulkRates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        const current = next[id];
        if (bulkAdjustmentType === 'percent') {
          next[id] = Math.round((current * (1 + val / 100)) * 100) / 100;
        } else {
          next[id] = Math.max(1, Math.round((current + val) * 100) / 100);
        }
      });
      return next;
    });
    triggerToast(`Applied ${val > 0 ? '+' : ''}${val}${bulkAdjustmentType === 'percent' ? '%' : ' ₹/Wp'} across all modules!`);
  };

  const handleSaveBulkPrices = async () => {
    let hasChanges = false;
    (modulesList || []).forEach(m => {
      if (bulkRates[m.id] !== undefined) {
        const currentRate = parseFloat(String(m.ratePerWp).replace(/[^0-9.]/g, '')) || 0;
        const newRate = Number(bulkRates[m.id]);
        if (Math.abs(currentRate - newRate) > 0.001) {
          hasChanges = true;
        }
      }
    });

    if (!hasChanges) {
      setShowBulkPriceModal(false);
      triggerToast('No changes detected in bulk module pricing.');
      return;
    }

    if (setModulesList) {
      setModulesList(prev => (prev || []).map(m => {
        if (bulkRates[m.id] !== undefined) {
          return {
            ...m,
            ratePerWp: `₹ ${Number(bulkRates[m.id]).toFixed(2)}`
          };
        }
        return m;
      }));
    }

    // Sync directly to Supabase DB
    await hardwareService.bulkUpdateModulePrices(bulkRates);

    if (addNotification) {
      addNotification({
        type: 'info',
        icon: 'price_change',
        title: 'Bulk Module Pricing Updated',
        description: `Admin updated benchmark rates for ${(modulesList || []).length} modules. Synced to Supabase database.`,
        audience: 'all',
        targetTab: 'create_quote'
      });
    }
    setShowBulkPriceModal(false);
    triggerToast(`Bulk pricing saved to Supabase database across ${(modulesList || []).length} modules!`);
  };

  // Filtered lists
  const filteredModules = (modulesList || []).filter(mod => {
    const term = moduleSearch.toLowerCase();
    const matchText = (mod.brand && mod.brand.toLowerCase().includes(term)) ||
                      (mod.model && mod.model.toLowerCase().includes(term)) ||
                      (mod.cellTech && mod.cellTech.toLowerCase().includes(term)) ||
                      String(mod.wattage).includes(term);
    if (!matchText) return false;
    if (moduleFilter === 'archived') return !!mod.isArchived;
    if (moduleFilter !== 'all' && mod.isArchived) return false;
    if (moduleFilter === 'topcon' && !(mod.cellTech || '').toLowerCase().includes('topcon')) return false;
    if (moduleFilter === 'perc' && !(mod.cellTech || '').toLowerCase().includes('perc')) return false;
    if (moduleFilter === 'commercial' && Number(mod.wattage) < 585) return false;
    return true;
  });

  const filteredInverters = (invertersList || []).filter(inv => {
    const term = inverterSearch.toLowerCase();
    const capText = getInverterCapacityText(inv).toLowerCase();
    const matchText = (inv.brand && inv.brand.toLowerCase().includes(term)) ||
                      (inv.model && inv.model.toLowerCase().includes(term)) ||
                      capText.includes(term);
    if (!matchText) return false;
    if (inverterFilter === 'single' && !(inv.phase || '').toLowerCase().includes('1-phase')) return false;
    if (inverterFilter === 'three' && !(inv.phase || '').toLowerCase().includes('3-phase')) return false;
    return true;
  });

  const filteredBomSpecs = (pdfBomSpecs || []).filter(spec => {
    if (bosCapacityFilter === 'all') return true;
    return spec.capacityKW.includes(bosCapacityFilter);
  });

  const filteredBomCatalog = (bomCatalog || []).filter(item => {
    const term = bomSearch.toLowerCase();
    const matchText = (item.name && item.name.toLowerCase().includes(term)) ||
                      (item.make && item.make.toLowerCase().includes(term)) ||
                      (item.spec && item.spec.toLowerCase().includes(term)) ||
                      (item.category && item.category.toLowerCase().includes(term));
    if (!matchText) return false;
    if (bomCategoryFilter === 'archived') return !!item.isArchived;
    if (bomCategoryFilter !== 'all' && item.isArchived) return false;
    if (bomCategoryFilter !== 'all' && item.category !== bomCategoryFilter) return false;
    return true;
  });

  const getBomItemRate = (item) => {
    if (bomRates && bomRates[item?.id] !== undefined && bomRates[item?.id] !== null) {
      return Number(bomRates[item.id]) || 0;
    }
    if (item?.rate !== undefined && item?.rate !== null && item?.rate !== '') {
      return Number(item.rate) || 0;
    }
    if (item?.defaultRate !== undefined && item?.defaultRate !== null && item?.defaultRate !== '') {
      return Number(item.defaultRate) || 0;
    }
    return 0;
  };

  const totalDealersCount = dealers?.length || 550;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 pointer-events-none flex items-center gap-2 px-4 py-3 rounded-lg bg-on-secondary-fixed text-on-secondary shadow-xl font-label-sm ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <span className="material-symbols-outlined text-[20px] text-primary-fixed">check_circle</span>
        <span>{toastMessage}</span>
      </div>

      {/* PAGE HEADER BLOCK */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-6 border-b border-surface-container-highest">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-inverse-surface tracking-tight">
              Solar Equipment &amp; Hardware Master Catalog
            </h1>
            <span className="bg-primary-container/15 text-primary text-label-xs font-semibold px-2.5 py-0.5 rounded-full border border-primary-container/30">
              ALMM Compliant 2025 • Gujarat DISCOMs
            </span>
            {isHardwareDbConnected ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 text-label-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Supabase DB Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 text-label-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/20" title="Supabase project is paused or unreachable. Ensure active URL in .env">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Supabase Disconnected (Project Inactive)
              </span>
            )}
          </div>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Manage approved solar modules, string inverters, and BOS specifications persisted directly to Supabase cloud database.
          </p>
        </div>
        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Hidden file input for CSV/Excel import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => {
              setImportedPreviewItems([]);
              setImportFileName('');
              setImportError('');
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 border border-surface-container-highest bg-surface-container-lowest text-inverse-surface font-label-md rounded-lg hover:bg-surface-container-low transition-colors shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-secondary">upload_file</span>
            <span>Import Specs (CSV)</span>
          </button>
          <button
            type="button"
            onClick={handleOpenBulkPriceModal}
            className="flex items-center gap-1.5 px-3 py-2 border border-surface-container-highest bg-surface-container-lowest text-inverse-surface font-label-md rounded-lg hover:bg-surface-container-low transition-colors shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-secondary">price_change</span>
            <span>Bulk Price Update</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddBom}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 font-label-md rounded-lg transition-colors shadow-sm cursor-pointer text-xs sm:text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>+ Add BOM Item</span>
          </button>
          <button
            onClick={handleOpenAddInverter}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-inverse-surface bg-surface-container-lowest text-inverse-surface font-label-md rounded-lg hover:bg-surface-container-low transition-colors shadow-sm cursor-pointer text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined">add</span>
            <span>+ Add Inverter Model</span>
          </button>
          <button
            onClick={handleOpenAddModule}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-label-md font-bold rounded-lg shadow-sm transition-colors cursor-pointer text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined">add_circle</span>
            <span>+ Add Solar Module</span>
          </button>
        </div>
      </div>

      {/* TOP TELEMETRY KPI QUICK STATS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 my-6">
        {/* Card 1: Active PV Modules */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-sm hover:border-emerald-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 group-hover:text-emerald-700 transition-colors">Active PV Modules</span>
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-mono text-3xl font-extrabold text-slate-900">{modulesList?.length ?? 0}</span>
            <span className="text-xs font-semibold text-slate-500">ALMM Models</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-sm">verified</span>
            <span className="text-xs font-bold text-emerald-700">Waaree, APS, Adani, Rayzone</span>
          </div>
        </div>

        {/* Card 2: Active Inverters */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-sm hover:border-blue-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 group-hover:text-blue-700 transition-colors">Active Inverters</span>
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/60 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">power</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-mono text-3xl font-extrabold text-slate-900">{invertersList?.length ?? 0}</span>
            <span className="text-xs font-semibold text-slate-500">Single &amp; 3-Phase</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="material-symbols-outlined text-blue-600 text-sm">bolt</span>
            <span className="text-xs font-bold text-slate-700">Polycab, Vsole, Deye, APS</span>
          </div>
        </div>

        {/* Card 3: BOM Catalog Items */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-sm hover:border-emerald-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 group-hover:text-emerald-700 transition-colors">BOM Hardware Catalog</span>
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-mono text-3xl font-extrabold text-slate-900">{(bomCatalog || []).length}</span>
            <span className="text-xs font-semibold text-slate-500">Hardware Components</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-sm">inventory</span>
            <span className="text-xs font-bold text-emerald-700">Structure, Cables, Switchgear</span>
          </div>
        </div>

        {/* Card 4: Catalog Synchronization */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-sm hover:border-emerald-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 group-hover:text-emerald-700 transition-colors">Catalog Synchronization</span>
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">sync</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading">Live Supabase DB</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-emerald-700">Realtime sync active</span>
          </div>
        </div>
      </section>

      {/* SEGMENTED TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3.5 gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('modules')}
            className={`px-3.5 sm:px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer text-xs sm:text-sm ${
              activeTab === 'modules'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-400">solar_power</span>
            <span>Solar PV Modules (ALMM Approved)</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'modules' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
            }`}>{modulesList?.length ?? 0} Models</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inverters')}
            className={`px-3.5 sm:px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer text-xs sm:text-sm ${
              activeTab === 'inverters'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] text-blue-400">settings_input_component</span>
            <span>Solar Inverters (Grid-Tied &amp; Hybrid)</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'inverters' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
            }`}>{invertersList?.length ?? 0} Models</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bos')}
            className={`px-3.5 sm:px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer text-xs sm:text-sm ${
              activeTab === 'bos'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] text-amber-400">inventory_2</span>
            <span>Bill of Materials (BOM Catalog)</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'bos' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
            }`}>{(bomCatalog || []).length} Items</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleExportLedger}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:border-emerald-500 text-emerald-700 hover:text-emerald-800 font-bold text-xs sm:text-sm shadow-xs hover:bg-emerald-50/50 self-end sm:self-center shrink-0 cursor-pointer transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span>Export Ledger</span>
        </button>
      </div>

      {/* SECTION 1: SOLAR MODULES CATALOG TABLE */}
      {activeTab === 'modules' && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
                <input
                  className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs font-medium"
                  placeholder="Filter by OEM make, wattage, or cell tech..."
                  type="text"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-1">Filter:</span>
              <button
                type="button"
                onClick={() => setModuleFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  moduleFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                All ({modulesList?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setModuleFilter('topcon')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  moduleFilter === 'topcon'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                TOPCon Bifacial
              </button>
              <button
                type="button"
                onClick={() => setModuleFilter('perc')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  moduleFilter === 'perc'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Mono PERC
              </button>
              <button
                type="button"
                onClick={() => setModuleFilter('commercial')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  moduleFilter === 'commercial'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                High Wattage (≥ 585W)
              </button>
              <button
                type="button"
                onClick={() => setModuleFilter('archived')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  moduleFilter === 'archived'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Archived ({(modulesList || []).filter(m => m.isArchived).length})
              </button>
              <ViewModeToggle viewMode={modulesViewMode} onViewModeChange={setModulesViewMode} />
            </div>
          </div>

          {modulesViewMode === 'card' ? (
            <div className="p-4 sm:p-5 bg-slate-50/50">
              {filteredModules.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-4xl text-slate-400 block mb-2">search_off</span>
                  No solar modules match your current filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {filteredModules.map((mod, idx) => {
                    const initial = mod.brand ? mod.brand.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PV';
                    return (
                      <div
                        key={mod.id || idx}
                        className="bg-white border-2 border-slate-200/90 hover:border-emerald-500/70 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 group"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-800 font-extrabold text-sm flex items-center justify-center border border-emerald-200 shadow-2xs shrink-0">
                              {initial}
                            </span>
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900 text-base leading-tight block truncate group-hover:text-emerald-700 transition-colors">
                                {mod.brand}
                              </span>
                              <span className="text-xs text-slate-600 font-medium block truncate mt-0.5" title={mod.model}>
                                {mod.model}
                              </span>
                            </div>
                          </div>
                          {mod.isArchived ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 shrink-0 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                            </span>
                          )}
                        </div>

                        {/* Cell Tech & Specs */}
                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            (mod.cellTech || '').includes('TOPCon')
                              ? 'bg-teal-50 text-teal-800 border-teal-200'
                              : (mod.cellTech || '').includes('PERC')
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {mod.cellTech || 'TOPCon Mono Bifacial'}
                          </span>
                          <span className="font-extrabold text-slate-900 font-mono text-base bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80">
                            {mod.wattage} <span className="text-xs font-bold text-emerald-700">Wp</span>
                          </span>
                        </div>

                        {/* 2-Col Key Stats Box */}
                        <div className="grid grid-cols-2 gap-2 bg-gradient-to-r from-slate-50 to-emerald-50/30 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Efficiency</span>
                            <span className="font-extrabold text-emerald-700 font-mono text-sm block mt-0.5">{mod.efficiency || '22.4%'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Rate / Wp</span>
                            <span className="font-extrabold text-slate-900 font-mono text-sm block mt-0.5">{mod.ratePerWp || '₹ 18.50 / Wp'}</span>
                          </div>
                        </div>

                        {/* Dimensions & Physical specs */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-mono font-medium bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                          <span className="material-symbols-outlined text-[15px] text-slate-400 shrink-0">straighten</span>
                          <span className="truncate">{mod.dimensions || '2278 × 1134 × 30 mm | 28 kg'}</span>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                          <span className="text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-amber-600">verified_user</span>
                            <span>{mod.warranty || '30 Yrs Warranty'}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditModule(mod)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer text-xs"
                              title="Edit Spec"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleArchiveModule(mod)}
                              className={`p-1.5 rounded-lg border border-slate-300 bg-white transition-all shadow-2xs cursor-pointer ${
                                mod.isArchived
                                  ? 'hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'
                                  : 'hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-700'
                              }`}
                              title={mod.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                            >
                              <span className="material-symbols-outlined text-[16px]">{mod.isArchived ? 'unarchive' : 'archive'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(mod)}
                              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:border-rose-400 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-all shadow-2xs cursor-pointer"
                              title="Delete Spec"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider h-11 border-b border-slate-800">
                  <th className="px-4 py-3">OEM Brand / Make</th>
                  <th className="px-4 py-3">Model Name &amp; Series</th>
                  <th className="px-4 py-3">Cell Tech</th>
                  <th className="px-4 py-3 text-right">Wattage</th>
                  <th className="px-4 py-3">Dimensions &amp; Weight</th>
                  <th className="px-4 py-3 text-right">Efficiency %</th>
                  <th className="px-4 py-3 text-right">Base Procurement Rate</th>
                  <th className="px-4 py-3">Performance Warranty</th>
                  <th className="px-4 py-3 text-center">Dealer Catalog</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-900 bg-white">
                {filteredModules.map((mod, idx) => {
                  const initial = mod.brand ? mod.brand.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PV';
                  return (
                    <tr key={mod.id || idx} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
                            {initial}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{mod.brand}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{mod.model}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                          (mod.cellTech || '').includes('TOPCon')
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : (mod.cellTech || '').includes('PERC')
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {mod.cellTech || 'TOPCon Mono Bifacial'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono text-sm">{mod.wattage} WP</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{mod.dimensions || '2278 × 1134 × 30 mm | 28 kg'}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-700 font-mono text-sm">{mod.efficiency || '22.4%'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-extrabold text-slate-900 font-mono text-sm">{mod.ratePerWp || '₹ 18.50 / Wp'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">₹ {Math.round(Number(mod.wattage || 550) * 18.5).toLocaleString()} / Panel</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{mod.warranty || '30 Years Performance'}</td>
                      <td className="px-4 py-3 text-center">
                        {mod.isArchived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleEditModule(mod)}
                            className="p-1.5 rounded-lg border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 bg-white transition-colors cursor-pointer shadow-2xs"
                            title="Edit Spec"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchiveModule(mod)}
                            className={`p-1.5 rounded-lg border border-slate-300 bg-white transition-colors cursor-pointer shadow-2xs ${mod.isArchived ? 'hover:border-emerald-500 hover:text-emerald-700' : 'hover:border-amber-400 hover:text-amber-700'}`}
                            title={mod.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                          >
                            <span className="material-symbols-outlined text-[16px]">{mod.isArchived ? 'unarchive' : 'archive'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(mod)}
                            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:border-rose-400 hover:text-rose-700 transition-colors cursor-pointer shadow-2xs"
                            title="Delete Spec"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {/* SECTION 2: SOLAR INVERTERS CATALOG TABLE */}
      {activeTab === 'inverters' && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-slate-900 font-extrabold text-base sm:text-lg">
                Approved String &amp; Central Inverters Master (Single &amp; Three Phase)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Preset efficiencies, phase configurations, and base distributor rates for Gujarat quotations.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Search inverters..."
                  value={inverterSearch}
                  onChange={(e) => setInverterSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs font-medium"
                />
              </div>
              <button
                type="button"
                onClick={() => setInverterFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  inverterFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                All ({invertersList?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setInverterFilter('single')}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  inverterFilter === 'single'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                1-Phase
              </button>
              <button
                type="button"
                onClick={() => setInverterFilter('three')}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  inverterFilter === 'three'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                3-Phase
              </button>
              <button
                type="button"
                onClick={() => setInverterFilter('archived')}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  inverterFilter === 'archived'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Archived ({(invertersList || []).filter(i => i.isArchived).length})
              </button>
              <ViewModeToggle viewMode={invertersViewMode} onViewModeChange={setInvertersViewMode} />
            </div>
          </div>

          {invertersViewMode === 'card' ? (
            <div className="p-4 sm:p-5 bg-slate-50/50">
              {filteredInverters.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-4xl text-slate-400 block mb-2">search_off</span>
                  No solar inverters match your current filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {filteredInverters.map((inv, idx) => {
                    const initial = inv.brand ? inv.brand.slice(0, 2).toUpperCase() : 'IN';
                    return (
                      <div
                        key={inv.id || idx}
                        className="bg-white border-2 border-slate-200/90 hover:border-blue-500/70 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 group"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-800 font-extrabold text-sm flex items-center justify-center border border-blue-200 shadow-2xs shrink-0">
                              {initial}
                            </span>
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900 text-base leading-tight block truncate group-hover:text-blue-700 transition-colors">
                                {inv.brand}
                              </span>
                              <span className="text-xs text-slate-600 font-medium block truncate mt-0.5" title={inv.model}>
                                {inv.model}
                              </span>
                            </div>
                          </div>
                          {inv.isArchived ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 shrink-0 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                            </span>
                          )}
                        </div>

                        {/* Specs & Phase */}
                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold border bg-purple-50 text-purple-800 border-purple-200">
                            {inv.phase || '3-Phase'}
                          </span>
                          <span className="font-extrabold text-slate-900 font-mono text-base bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80">
                            {getInverterCapacityText(inv)}
                          </span>
                        </div>

                        {/* 2-Col Key Stats */}
                        <div className="grid grid-cols-2 gap-2 bg-gradient-to-r from-slate-50 to-blue-50/30 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Euro Efficiency</span>
                            <span className="font-extrabold text-emerald-700 font-mono text-sm block mt-0.5">{inv.efficiency || '98.6%'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Base Price</span>
                            <span className="font-extrabold text-slate-900 font-mono text-sm block mt-0.5">{inv.basePrice || '₹ 54,000'}</span>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                          <span className="text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-amber-600">verified_user</span>
                            <span>{inv.warranty || '8 Yrs Warranty'}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditInverter(inv)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer text-xs"
                              title="Edit Spec"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleArchiveInverter(inv)}
                              className={`p-1.5 rounded-lg border border-slate-300 bg-white transition-all shadow-2xs cursor-pointer ${
                                inv.isArchived ? 'hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700' : 'hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-700'
                              }`}
                              title={inv.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                            >
                              <span className="material-symbols-outlined text-[16px]">{inv.isArchived ? 'unarchive' : 'archive'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInverter(inv)}
                              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:border-rose-400 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-all shadow-2xs cursor-pointer"
                              title="Delete Spec"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider h-11 border-b border-slate-800">
                  <th className="px-4 py-3">Brand / OEM</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3 text-right">Rated Capacity</th>
                  <th className="px-4 py-3">Grid Phase &amp; MPPT</th>
                  <th className="px-4 py-3 text-right">Euro Efficiency</th>
                  <th className="px-4 py-3 text-right">Inverter Base Price (₹)</th>
                  <th className="px-4 py-3">Replacement Warranty</th>
                  <th className="px-4 py-3 text-center">Dealer Quoting</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-900 bg-white">
                {filteredInverters.map((inv, idx) => {
                  const initial = inv.brand ? inv.brand.slice(0, 2).toUpperCase() : 'IN';
                  return (
                    <tr key={inv.id || idx} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-800 font-bold text-xs flex items-center justify-center border border-blue-200">
                            {initial}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{inv.brand}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{inv.model}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono text-sm">{getInverterCapacityText(inv)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold border bg-purple-50 text-purple-800 border-purple-200">
                          {inv.phase || '3-Phase'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-700 font-mono text-sm">{inv.efficiency || '98.6%'}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono text-sm">{inv.basePrice || '₹ 54,000'}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{inv.warranty || '8 Years Comprehensive'}</td>
                      <td className="px-4 py-3 text-center">
                        {inv.isArchived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleEditInverter(inv)}
                            className="p-1.5 rounded-lg border border-slate-300 hover:border-blue-500 hover:text-blue-700 bg-white transition-colors cursor-pointer shadow-2xs"
                            title="Edit Spec"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchiveInverter(inv)}
                            className={`p-1.5 rounded-lg border border-slate-300 bg-white transition-colors cursor-pointer shadow-2xs ${inv.isArchived ? 'hover:border-emerald-500 hover:text-emerald-700' : 'hover:border-amber-400 hover:text-amber-700'}`}
                            title={inv.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                          >
                            <span className="material-symbols-outlined text-[16px]">{inv.isArchived ? 'unarchive' : 'archive'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInverter(inv)}
                            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:border-rose-400 hover:text-rose-700 transition-colors cursor-pointer shadow-2xs"
                            title="Delete Spec"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {/* SECTION 3: BILL OF MATERIALS (BOM) MASTER CATALOG & PRESETS */}
      {activeTab === 'bos' && (
        <div className="mt-6 space-y-6">
          {/* BOM Catalog Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-slate-900 font-extrabold text-base sm:text-lg">
                    Bill of Materials (BOM) Hardware Catalog
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Supabase DB Synced
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Manage standard structural members, DC/AC switchgear, cables, conduits, and accessories dynamically synced with Quotation Presets.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Hidden file input for BOM CSV/Excel import */}
                <input
                  ref={bomFileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={handleBomFileSelect}
                />
                <button
                  type="button"
                  onClick={handleOpenImportBom}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all shadow-xs text-xs sm:text-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-slate-500">upload_file</span>
                  <span>Import BOM (Excel/CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToMasterBom}
                  className="flex items-center gap-1.5 px-3 py-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl transition-all shadow-xs cursor-pointer text-xs sm:text-sm"
                  title="Load official 24-item Gujarat Rooftop BOM specifications and rates from Excel"
                >
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                  <span>Load Master BOM (24 Items)</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddBom}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer text-xs sm:text-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>+ Add BOM Component</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Search BOM by name, OEM make, or spec..."
                  value={bomSearch}
                  onChange={(e) => setBomSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs font-medium"
                />
                {bomSearch && (
                  <button
                    onClick={() => setBomSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {/* Category Filters */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  {[
                    { id: 'all', label: `All (${(bomCatalog || []).length})` },
                    { id: 'structure', label: 'Structure' },
                    { id: 'electrical', label: 'Electrical' },
                    { id: 'cables', label: 'Cables' },
                    { id: 'conduits', label: 'Conduits' },
                    { id: 'safety', label: 'Safety/Earthing' },
                    { id: 'archived', label: 'Archived' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setBomCategoryFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${
                        bomCategoryFilter === tab.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* View Mode Toggle */}
                <ViewModeToggle viewMode={bomViewMode} onViewModeChange={setBomViewMode} />
              </div>
            </div>

            {/* Catalog Items Display: Cards or Table */}
            {filteredBomCatalog.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">inventory_2</span>
                <p className="text-sm font-semibold text-slate-600">No BOM components match your search or filter.</p>
                <button
                  type="button"
                  onClick={handleOpenAddBom}
                  className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-xs transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Add First BOM Component</span>
                </button>
              </div>
            ) : bomViewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {filteredBomCatalog.map((item) => {
                  const catColors = {
                    structure: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                    electrical: 'bg-amber-100 text-amber-800 border-amber-300',
                    cables: 'bg-blue-100 text-blue-800 border-blue-300',
                    conduits: 'bg-cyan-100 text-cyan-800 border-cyan-300',
                    safety: 'bg-purple-100 text-purple-800 border-purple-300',
                    other: 'bg-slate-100 text-slate-800 border-slate-300'
                  };
                  const badgeColor = catColors[item.category] || catColors.other;
                  const itemRate = getBomItemRate(item);

                  return (
                    <div
                      key={item.id}
                      className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3.5 group ${
                        item.isArchived
                          ? 'border-slate-200 bg-slate-50/70 opacity-70'
                          : 'border-slate-200/90 bg-white hover:border-emerald-500/70 hover:shadow-md shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border uppercase tracking-wider ${badgeColor}`}>
                            {item.category || 'Hardware'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditBom(item)}
                              className="p-1.5 rounded-lg border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 bg-white text-slate-600 transition-colors cursor-pointer shadow-2xs"
                              title="Edit Component"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleArchiveBom(item)}
                              className={`p-1.5 rounded-lg border border-slate-300 bg-white transition-colors cursor-pointer shadow-2xs ${
                                item.isArchived ? 'hover:border-emerald-500 hover:text-emerald-700 text-slate-600' : 'hover:border-amber-400 hover:text-amber-700 text-slate-600'
                              }`}
                              title={item.isArchived ? 'Restore Component' : 'Archive Component'}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {item.isArchived ? 'unarchive' : 'archive'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBom(item)}
                              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:border-rose-400 hover:text-rose-700 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                              title="Delete Component"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>

                        <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-emerald-700 transition-colors">
                          {item.name}
                        </h3>
                        {item.spec && (
                          <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">{item.spec}</p>
                        )}
                      </div>

                      {/* Benchmark & Rate Box */}
                      <div className="bg-gradient-to-r from-slate-50 to-emerald-50/30 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">OEM / Make</span>
                          <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">{item.make || 'Standard'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Unit Benchmark</span>
                          <span className="font-mono font-extrabold text-emerald-700 text-sm mt-0.5 block">
                            ₹ {itemRate.toLocaleString('en-IN')}
                            <span className="text-slate-600 font-bold text-xs ml-0.5">/{item.unit || 'Nos'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] font-mono">
                          GST: {item.gstRate || 18}%
                        </span>
                        {item.isArchived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider h-11 border-b border-slate-800">
                      <th className="px-4 py-3">Component Name &amp; Spec</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">OEM / Make</th>
                      <th className="px-3 py-3 text-center">Unit</th>
                      <th className="px-3 py-3 text-right">Unit Rate (₹)</th>
                      <th className="px-3 py-3 text-center">GST %</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-900 bg-white">
                    {filteredBomCatalog.map((item, idx) => {
                      const catColors = {
                        structure: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                        electrical: 'bg-amber-100 text-amber-800 border-amber-300',
                        cables: 'bg-blue-100 text-blue-800 border-blue-300',
                        conduits: 'bg-cyan-100 text-cyan-800 border-cyan-300',
                        safety: 'bg-purple-100 text-purple-800 border-purple-300',
                        other: 'bg-slate-100 text-slate-800 border-slate-300'
                      };
                      const badgeColor = catColors[item.category] || catColors.other;
                      const itemRate = getBomItemRate(item);

                      return (
                        <tr
                          key={item.id || idx}
                          className={`hover:bg-slate-50 transition-colors ${
                            idx % 2 === 1 ? 'bg-slate-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                            {item.spec && (
                              <div className="text-xs text-slate-600 mt-0.5 line-clamp-1">{item.spec}</div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${badgeColor}`}>
                              {item.category || 'Hardware'}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-700">{item.make || 'Standard'}</td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">{item.unit || 'Nos'}</td>
                          <td className="px-3 py-3 text-right font-mono font-extrabold text-slate-900 text-sm">
                            ₹ {itemRate.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">{item.gstRate || 18}%</td>
                          <td className="px-3 py-3 text-center">
                            {item.isArchived ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Archived
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 text-slate-600">
                              <button
                                type="button"
                                onClick={() => handleEditBom(item)}
                                className="p-1.5 rounded-lg border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 bg-white transition-colors cursor-pointer shadow-2xs"
                                title="Edit Component"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleArchiveBom(item)}
                                className={`p-1.5 rounded-lg border border-slate-300 bg-white transition-colors cursor-pointer shadow-2xs ${item.isArchived ? 'hover:border-emerald-500 hover:text-emerald-700' : 'hover:border-amber-400 hover:text-amber-700'}`}
                                title={item.isArchived ? 'Restore Component' : 'Archive Component'}
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {item.isArchived ? 'unarchive' : 'archive'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBom(item)}
                                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:border-rose-400 hover:text-rose-700 transition-colors cursor-pointer shadow-2xs"
                                title="Delete Component"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Collapsible Section: Official PDF BOS Capacity Specification Reference Matrix */}
          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPdfMatrix(prev => !prev)}
              className="w-full p-5 flex items-center justify-between hover:bg-surface-container-low/40 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-surface-container-high text-primary">
                  <span className="material-symbols-outlined text-xl">table_view</span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline-sm text-sm font-bold text-inverse-surface">
                      Official PDF Capacity Specification Reference Matrix
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-[10px] font-bold">
                      2.16 kW – 8.10 kW Reference
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-secondary mt-0.5">
                    Standard DISCOM baseline matrix for cables, switchgear, and earthing quantities across system sizes.
                  </p>
                </div>
              </div>
              <span className={`material-symbols-outlined text-secondary transition-transform duration-200 ${showPdfMatrix ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>

            {showPdfMatrix && (
              <div className="p-6 pt-0 border-t border-surface-container-highest">
                <div className="flex items-center justify-between py-3">
                  <span className="text-xs text-secondary">Filter by system capacity:</span>
                  <select
                    value={bosCapacityFilter}
                    onChange={(e) => setBosCapacityFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-surface-container-highest bg-surface-container-lowest"
                  >
                    <option value="all">All Capacities (2.16kW to 8.10kW)</option>
                    <option value="2.16">2.16 kW</option>
                    <option value="2.70">2.70 kW</option>
                    <option value="3.24">3.24 kW</option>
                    <option value="3.78">3.78 kW</option>
                    <option value="4.32">4.32 kW</option>
                    <option value="4.86">4.86 kW</option>
                    <option value="5.40">5.40 kW</option>
                    <option value="5.94">5.94 kW</option>
                    <option value="8.10">8.10 kW</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-11 border-b border-surface-container-lowest/10">
                        <th className="px-3 py-2 font-label-sm">Capacity</th>
                        <th className="px-3 py-2 font-label-sm">Modules</th>
                        <th className="px-3 py-2 font-label-sm">Inverter</th>
                        <th className="px-3 py-2 font-label-sm">DC Wire (1C×4)</th>
                        <th className="px-3 py-2 font-label-sm">AC Wire</th>
                        <th className="px-3 py-2 font-label-sm">Earthing Wire</th>
                        <th className="px-3 py-2 font-label-sm">LA Wire</th>
                        <th className="px-3 py-2 font-label-sm">ACDB / DCDB</th>
                        <th className="px-3 py-2 font-label-sm">Earthing Kit</th>
                        <th className="px-3 py-2 font-label-sm">PVC &amp; Hardware</th>
                        <th className="px-3 py-2 font-label-sm">MC4</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-highest font-body-sm text-xs text-on-surface">
                      {filteredBomSpecs.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-surface-container-low/60 transition-colors ${idx % 2 === 1 ? 'bg-surface-container-low/20' : ''}`}>
                          <td className="px-3 py-3 font-bold text-inverse-surface font-mono">{row.capacityKW}</td>
                          <td className="px-3 py-3 font-semibold text-primary">{row.modulesQty}</td>
                          <td className="px-3 py-3">{row.inverterQty}</td>
                          <td className="px-3 py-3 font-mono">{row.dcWire}</td>
                          <td className="px-3 py-3 font-mono">{row.acWire}</td>
                          <td className="px-3 py-3 font-mono">{row.earthingWire}</td>
                          <td className="px-3 py-3 font-mono">{row.laWire}</td>
                          <td className="px-3 py-3">{row.acdbDcdb}</td>
                          <td className="px-3 py-3">{row.earthingKit}</td>
                          <td className="px-3 py-3">{row.pvcHardware}</td>
                          <td className="px-3 py-3 font-mono">{row.mc4Connectors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Standard compliance tags */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-surface-container-highest">
                  <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-highest">
                    <div className="font-label-md font-bold text-on-surface">Galvanized Structure (IS 2062)</div>
                    <p className="text-xs text-secondary mt-1">80 Micron minimum zinc coating, withstands 150 km/h wind load.</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-highest">
                    <div className="font-label-md font-bold text-on-surface">Solar DC Cables (EN 50618)</div>
                    <p className="text-xs text-secondary mt-1">XLPO insulated, UV resistant, electron-beam cross-linked copper.</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-highest">
                    <div className="font-label-md font-bold text-on-surface">SPD Type II ACDB / DCDB (IP65)</div>
                    <p className="text-xs text-secondary mt-1">Polycarbonate distribution enclosures with surge protection.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER & AUDIT TRAIL ADVISORY */}
      <div className="mt-8 mb-4 p-4 rounded-xl bg-surface-container-lowest border border-surface-container-highest flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-secondary-container text-on-secondary-fixed">
            <span className="material-symbols-outlined">info</span>
          </span>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md font-semibold text-inverse-surface">Global Catalog Engine Advisory</span>
            <span className="font-body-sm text-body-sm text-secondary">Hardware additions immediately reflect inside the dealer quotation calculation engine for all active DISCOM regions.</span>
          </div>
        </div>
      </div>

      {/* ADD SOLAR MODULE MODAL */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">solar_power</span>
                </span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  {editingModule ? 'Edit Solar PV Module' : 'Add Solar PV Module'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModuleModal(false);
                  setEditingModule(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">OEM Brand / Make *</label>
                  <input
                    required
                    type="text"
                    value={moduleForm.brand}
                    onChange={(e) => setModuleForm({ ...moduleForm, brand: e.target.value })}
                    placeholder="e.g. Adani Solar / Waaree"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Model Name &amp; Series *</label>
                  <input
                    required
                    type="text"
                    value={moduleForm.model}
                    onChange={(e) => setModuleForm({ ...moduleForm, model: e.target.value })}
                    placeholder="e.g. Shine 600WP TOPCon"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Wattage (W) *</label>
                  <input
                    required
                    type="number"
                    value={moduleForm.wattage}
                    onChange={(e) => setModuleForm({ ...moduleForm, wattage: e.target.value })}
                    placeholder="550"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Efficiency %</label>
                  <input
                    type="text"
                    value={moduleForm.efficiency}
                    onChange={(e) => setModuleForm({ ...moduleForm, efficiency: e.target.value })}
                    placeholder="22.6%"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Rate (₹/Wp)</label>
                  <input
                    type="text"
                    value={moduleForm.ratePerWp}
                    onChange={(e) => setModuleForm({ ...moduleForm, ratePerWp: e.target.value })}
                    placeholder="19.20"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Dimensions &amp; Weight</label>
                  <input
                    type="text"
                    value={moduleForm.dimensions}
                    onChange={(e) => setModuleForm({ ...moduleForm, dimensions: e.target.value })}
                    placeholder="e.g. 2278 × 1134 × 30 mm | 28 kg"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Performance Warranty</label>
                  <input
                    type="text"
                    value={moduleForm.warranty}
                    onChange={(e) => setModuleForm({ ...moduleForm, warranty: e.target.value })}
                    placeholder="e.g. 30 Years Performance"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-secondary">Cell Technology *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCellTech(!isCustomCellTech);
                      if (!isCustomCellTech) setCustomCellTechInput('');
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {isCustomCellTech ? '← Choose from standard' : '+ Custom Technology'}
                  </button>
                </div>
                {isCustomCellTech ? (
                  <input
                    type="text"
                    required
                    value={customCellTechInput}
                    onChange={(e) => setCustomCellTechInput(e.target.value)}
                    placeholder="e.g. Perovskite Tandem / BC IBC"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                ) : (
                  <select
                    value={moduleForm.cellTech}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomCellTech(true);
                        setCustomCellTechInput('');
                      } else {
                        setModuleForm({ ...moduleForm, cellTech: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  >
                    <option value="TOPCon Mono Bifacial">TOPCon Mono Bifacial (Recommended)</option>
                    <option value="Mono PERC">Mono PERC Half-Cut</option>
                    <option value="HJT Ultra-Efficiency">HJT Ultra-Efficiency</option>
                    <option value="Polycrystalline DCR">Polycrystalline DCR</option>
                    {availableCellTechs.filter(t => !['TOPCon Mono Bifacial', 'Mono PERC', 'HJT Ultra-Efficiency', 'Polycrystalline DCR'].includes(t)).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="__custom__">+ Enter Custom Cell Tech...</option>
                  </select>
                )}
              </div>

              <div className="pt-3 border-t border-surface-container-high flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModuleModal(false);
                    setEditingModule(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-primary-container text-surface-container-lowest hover:bg-primary rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  {editingModule ? 'Save Changes' : 'Publish to Catalog & Notify Dealers'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD INVERTER MODEL MODAL */}
      {showAddInverterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                </span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  {editingInverter ? 'Edit Inverter Model' : 'Add Inverter Model'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddInverterModal(false);
                  setEditingInverter(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveInverter} className="py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Brand / OEM Make *</label>
                  <input
                    required
                    type="text"
                    value={inverterForm.brand}
                    onChange={(e) => setInverterForm({ ...inverterForm, brand: e.target.value })}
                    placeholder="e.g. Sungrow / Solis / Sunvine"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Model Name *</label>
                  <input
                    required
                    type="text"
                    value={inverterForm.model}
                    onChange={(e) => setInverterForm({ ...inverterForm, model: e.target.value })}
                    placeholder="e.g. SG10RT 3-Phase Multi-MPPT"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Rated Capacity *</label>
                  <input
                    required
                    type="text"
                    value={inverterForm.capacity}
                    onChange={(e) => setInverterForm({ ...inverterForm, capacity: e.target.value })}
                    placeholder="10 kW"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Phase</label>
                  <select
                    value={inverterForm.phase}
                    onChange={(e) => setInverterForm({ ...inverterForm, phase: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  >
                    <option value="3-Phase 415V">3-Phase 415V</option>
                    <option value="1-Phase 230V">1-Phase 230V</option>
                    <option value="Hybrid Battery-Ready">Hybrid Battery-Ready</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Efficiency</label>
                  <input
                    type="text"
                    value={inverterForm.efficiency}
                    onChange={(e) => setInverterForm({ ...inverterForm, efficiency: e.target.value })}
                    placeholder="98.5%"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Base Distributor Price (₹)</label>
                  <input
                    type="text"
                    value={inverterForm.basePrice}
                    onChange={(e) => setInverterForm({ ...inverterForm, basePrice: e.target.value })}
                    placeholder="₹ 54,000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Replacement Warranty</label>
                  <input
                    type="text"
                    value={inverterForm.warranty}
                    onChange={(e) => setInverterForm({ ...inverterForm, warranty: e.target.value })}
                    placeholder="10 Years Comprehensive"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-surface-container-high flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddInverterModal(false);
                    setEditingInverter(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-primary-container text-surface-container-lowest hover:bg-primary rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  {editingInverter ? 'Save Changes to Database' : 'Publish to Catalog & Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* IMPORT SPECS MODAL (SR-22)                                     */}
      {/* ============================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-surface-container-highest animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">upload_file</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                    Import Module Specifications
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Upload a CSV file with Brand, Model, Cell Tech, Wattage, Rate per Wp, and Warranty columns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Upload Zone */}
              <div
                className="border-2 border-dashed border-surface-container-highest rounded-xl p-6 text-center flex flex-col items-center gap-3 hover:border-primary/50 transition-colors cursor-pointer bg-surface-container-low/40"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined text-4xl text-secondary">cloud_upload</span>
                <div>
                  <p className="font-bold text-on-surface text-sm">
                    {importFileName ? importFileName : 'Click to Select CSV / Excel File'}
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    Supports .csv, .xlsx, .xls, .txt · Max 5 MB
                  </p>
                </div>
                {importFileName && !importError && importedPreviewItems.length === 0 && (
                  <span className="text-xs text-amber-600 font-semibold">Parsing file…</span>
                )}
              </div>

              {/* Error Banner */}
              {importError && (
                <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-2 text-error text-xs">
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview Table */}
              {importedPreviewItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-on-surface">
                      Preview: {importedPreviewItems.length} module{importedPreviewItems.length > 1 ? 's' : ''} parsed
                    </p>
                    <span className="text-[11px] text-secondary">Confirm below to add to catalog</span>
                  </div>
                  <div className="overflow-x-auto border border-surface-container-highest rounded-xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                      <thead>
                        <tr className="bg-surface-container-low text-secondary font-semibold uppercase tracking-wide text-[11px]">
                          <th className="px-3 py-2">Brand</th>
                          <th className="px-3 py-2">Model</th>
                          <th className="px-3 py-2">Cell Tech</th>
                          <th className="px-3 py-2 text-right">Wp</th>
                          <th className="px-3 py-2 text-right">₹/Wp</th>
                          <th className="px-3 py-2">Warranty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-highest text-on-surface">
                        {importedPreviewItems.slice(0, 8).map((item, idx) => (
                          <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-3 py-2 font-semibold">{item.brand}</td>
                            <td className="px-3 py-2">{item.model}</td>
                            <td className="px-3 py-2 text-secondary">{item.cellTech}</td>
                            <td className="px-3 py-2 text-right font-mono">{item.wattage}W</td>
                            <td className="px-3 py-2 text-right font-mono text-primary">{item.ratePerWp}</td>
                            <td className="px-3 py-2 text-secondary">{item.warranty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importedPreviewItems.length > 8 && (
                      <div className="px-3 py-2 text-xs text-secondary bg-surface-container-low border-t border-surface-container-highest">
                        +{importedPreviewItems.length - 8} more modules not shown in preview
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-secondary">
                <span>Need the correct format?</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsvTemplate}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Download Sample CSV Template</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container-low flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg border border-surface-container-highest bg-surface-container-low text-on-surface text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">folder_open</span>
                <span>Browse File</span>
              </button>
              <button
                type="button"
                disabled={importedPreviewItems.length === 0}
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Import {importedPreviewItems.length > 0 ? `${importedPreviewItems.length} Modules` : 'Modules'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* IMPORT BOM COMPONENTS MODAL                                   */}
      {/* ============================================================= */}
      {showImportBomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-surface-container-highest animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">inventory_2</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                    Import BOM Hardware Components (Excel / CSV)
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Upload an Excel or CSV file containing component names, makes/brands, categories, units, and rates.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportBomModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Upload Zone */}
              <div
                className="border-2 border-dashed border-surface-container-highest rounded-xl p-6 text-center flex flex-col items-center gap-3 hover:border-emerald-600/50 transition-colors cursor-pointer bg-surface-container-low/40"
                onClick={() => bomFileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined text-4xl text-emerald-600">cloud_upload</span>
                <div>
                  <p className="font-bold text-on-surface text-sm">
                    {bomImportFileName ? bomImportFileName : 'Click to Select BOM CSV / Excel File'}
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    Supports .csv, .xlsx, .xls, .txt · Structure, Cables, Electrical, Conduits, Safety
                  </p>
                </div>
                {bomImportFileName && !bomImportError && importedBomPreviewItems.length === 0 && (
                  <span className="text-xs text-amber-600 font-semibold">Parsing BOM items…</span>
                )}
              </div>

              {/* Error Banner */}
              {bomImportError && (
                <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-2 text-error text-xs">
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                  <span>{bomImportError}</span>
                </div>
              )}

              {/* Preview Table */}
              {importedBomPreviewItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-on-surface">
                      Preview: {importedBomPreviewItems.length} BOM component{importedBomPreviewItems.length > 1 ? 's' : ''} parsed
                    </p>
                    <span className="text-[11px] text-secondary">Confirm below to import into catalog</span>
                  </div>
                  <div className="overflow-x-auto border border-surface-container-highest rounded-xl max-h-[280px]">
                    <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                      <thead className="sticky top-0 bg-surface-container-low z-10">
                        <tr className="text-secondary font-semibold uppercase tracking-wide text-[11px]">
                          <th className="px-3 py-2">Item Name</th>
                          <th className="px-3 py-2">Make / Brand</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Unit</th>
                          <th className="px-3 py-2 text-right">Default Rate</th>
                          <th className="px-3 py-2">Specs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-highest text-on-surface">
                        {importedBomPreviewItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-3 py-2 font-semibold text-inverse-surface">{item.name}</td>
                            <td className="px-3 py-2 text-secondary">{item.make}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container-high text-inverse-surface capitalize">
                                {item.category}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-secondary">{item.unit}</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700 font-bold">
                              ₹ {Number(item.defaultRate || item.rate).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-secondary text-[11px] truncate max-w-[150px]">{item.specs || item.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-secondary">
                <span>Need Gujarat Rooftop format sample?</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleBomCsvTemplate}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Download Master BOM (24 Items) CSV</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container-low flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportBomModal(false)}
                className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => bomFileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg border border-surface-container-highest bg-surface-container-low text-on-surface text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">folder_open</span>
                <span>Browse File</span>
              </button>
              <button
                type="button"
                disabled={importedBomPreviewItems.length === 0}
                onClick={handleConfirmBomImport}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Import {importedBomPreviewItems.length > 0 ? `${importedBomPreviewItems.length} BOM Items` : 'BOM Items'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* BULK PRICE UPDATE MODAL (SR-22)                                */}
      {/* ============================================================= */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-surface-container-highest animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">price_change</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                    Bulk Price Update
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Adjust benchmark ₹/Wp rates across all {(modulesList || []).length} solar modules at once.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkPriceModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Global Adjustment Controls */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-highest flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface">Adjustment Type</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkAdjustmentType('percent')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                        bulkAdjustmentType === 'percent'
                          ? 'bg-primary-container text-surface-container-lowest border-primary-container'
                          : 'bg-surface-container-lowest border-surface-container-highest text-secondary'
                      }`}
                    >
                      % Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkAdjustmentType('flat')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                        bulkAdjustmentType === 'flat'
                          ? 'bg-primary-container text-surface-container-lowest border-primary-container'
                          : 'bg-surface-container-lowest border-surface-container-highest text-secondary'
                      }`}
                    >
                      ₹/Wp Flat Amount
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-secondary">
                      {bulkAdjustmentType === 'percent' ? 'Change (%)' : 'Change (₹/Wp)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={bulkAdjustmentType === 'percent' ? '0.5' : '0.10'}
                        placeholder={bulkAdjustmentType === 'percent' ? '+5 or -3' : '+0.50'}
                        value={bulkAdjustmentValue}
                        onChange={(e) => setBulkAdjustmentValue(e.target.value)}
                        className="w-36 h-9 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!bulkAdjustmentValue || isNaN(parseFloat(bulkAdjustmentValue))}
                    onClick={handleApplyBulkAdjustment}
                    className="h-9 px-4 bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Apply to All
                  </button>
                </div>
              </div>

              {/* Per-Module Rate Editor */}
              <div className="border border-surface-container-highest rounded-xl overflow-hidden">
                <div className="bg-surface-container-low px-4 py-2.5 border-b border-surface-container-highest flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Module-by-Module Rate Editor</span>
                  <span className="text-[11px] text-secondary">{(modulesList || []).length} modules</span>
                </div>
                <div className="overflow-y-auto max-h-64 divide-y divide-surface-container-highest">
                  {(modulesList || []).filter(m => !m.isArchived).map((mod) => {
                    const currentRate = bulkRates[mod.id] ?? parseFloat(String(mod.ratePerWp || '19.20').replace(/[^0-9.]/g, '')) ?? 19.20;
                    const originalRate = parseFloat(String(mod.ratePerWp || '19.20').replace(/[^0-9.]/g, '')) || 19.20;
                    const changed = Math.abs(currentRate - originalRate) > 0.001;
                    return (
                      <div key={mod.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-container-low/50 transition-colors">
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="font-semibold text-on-surface text-xs truncate">
                            {mod.brand} {mod.model}
                          </div>
                          <div className="text-[11px] text-secondary mt-0.5">
                            {mod.wattage}W · {mod.cellTech}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {changed && (
                            <span className="text-[10px] text-secondary line-through font-mono">₹{originalRate.toFixed(2)}</span>
                          )}
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-xs text-secondary font-mono pointer-events-none">₹</span>
                            <input
                              type="number"
                              step="0.10"
                              min="1"
                              value={currentRate}
                              onChange={(e) => setBulkRates(prev => ({
                                ...prev,
                                [mod.id]: parseFloat(e.target.value) || 0
                              }))}
                              className={`w-24 h-8 pl-6 pr-2 text-xs font-bold font-mono rounded-lg border focus:outline-none focus:border-primary transition-colors ${
                                changed
                                  ? 'border-primary-container bg-primary/5 text-primary'
                                  : 'border-surface-container-highest bg-surface-container-lowest text-on-surface'
                              }`}
                            />
                          </div>
                          <span className="text-[11px] text-secondary font-mono w-10">/Wp</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container-low flex items-center justify-between shrink-0">
              <span className="text-[11px] text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-amber-500">info</span>
                Changes apply to all active dealer quotations immediately.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkPriceModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBulkPrices}
                  className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Save & Publish Prices</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* ADD / EDIT BOM HARDWARE COMPONENT MODAL                        */}
      {/* ============================================================= */}
      {showAddBomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-surface-container-highest animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">inventory_2</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                    {editingBomItem ? 'Edit BOM Hardware Component' : 'Add BOM Hardware Component'}
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Persisted directly to Supabase cloud database and synced with quotation presets.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddBomModal(false);
                  setEditingBomItem(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveBom} className="py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Component Name &amp; Description *</label>
                <input
                  required
                  type="text"
                  value={bomForm.name}
                  onChange={(e) => setBomForm({ ...bomForm, name: e.target.value })}
                  placeholder="e.g. GI Pipe 60x40 (Structure Column)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container text-on-surface"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-secondary">Component Category *</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomCategory(!isAddingCustomCategory)}
                      className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      {isAddingCustomCategory ? 'Cancel' : '+ New Category'}
                    </button>
                  </div>
                  {isAddingCustomCategory ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. Civil Works"
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-surface-container-highest bg-surface-container-lowest text-on-surface"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomCategory}
                        className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={bomForm.category}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setIsAddingCustomCategory(true);
                        } else {
                          setBomForm({ ...bomForm, category: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container text-on-surface cursor-pointer"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                      <option value="__add_new__">+ Add Custom Category...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Approved OEM / Make</label>
                  <input
                    type="text"
                    value={bomForm.make}
                    onChange={(e) => setBomForm({ ...bomForm, make: e.target.value })}
                    placeholder="e.g. Fortune / Jindal / Polycab"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-secondary">Standard Unit *</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomUnit(!isAddingCustomUnit)}
                      className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      {isAddingCustomUnit ? 'Cancel' : '+ New Unit'}
                    </button>
                  </div>
                  {isAddingCustomUnit ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. Packet, Nos"
                        value={customUnitInput}
                        onChange={(e) => setCustomUnitInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-surface-container-highest bg-surface-container-lowest text-on-surface"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomUnit}
                        className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={bomForm.unit}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setIsAddingCustomUnit(true);
                        } else {
                          setBomForm({ ...bomForm, unit: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container text-on-surface cursor-pointer"
                    >
                      {availableUnits.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                      <option value="__add_new__">+ Add Custom Unit...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Benchmark Rate (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-secondary font-mono">₹</span>
                    <input
                      required
                      type="number"
                      step="any"
                      min="0"
                      value={bomForm.rate}
                      onChange={(e) => setBomForm({ ...bomForm, rate: e.target.value })}
                      placeholder="450"
                      className="w-full pl-6 pr-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container text-on-surface font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">GST Rate (%)</label>
                  <select
                    value={bomForm.gstRate}
                    onChange={(e) => setBomForm({ ...bomForm, gstRate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container text-on-surface font-mono cursor-pointer"
                  >
                    <option value="18">18% (Standard)</option>
                    <option value="12">12%</option>
                    <option value="5">5% (Solar Concession)</option>
                    <option value="0">0% (Nil)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Technical Specification / Standard</label>
                <textarea
                  rows="2"
                  value={bomForm.spec}
                  onChange={(e) => setBomForm({ ...bomForm, spec: e.target.value })}
                  placeholder="e.g. Galvanized 80 micron HDGI, IS 2062 compliant, corrosion resistant"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container text-on-surface"
                />
              </div>

              <div className="pt-3 border-t border-surface-container-low flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBomModal(false);
                    setEditingBomItem(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{editingBomItem ? 'Update Component' : 'Save Component'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* CUSTOM PURE UI HARDWARE DELETION / ARCHIVE CONFIRMATION MODAL */}
      {/* ============================================================= */}
      {deleteModalState && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in zoom-in-95 space-y-4">
            {/* Header with Danger / Warning badge */}
            <div className="flex items-start gap-3.5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                deleteModalState.isRestore
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : deleteModalState.isArchive
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}>
                <span className="material-symbols-outlined text-2xl">
                  {deleteModalState.isRestore ? 'unarchive' : deleteModalState.isArchive ? 'archive' : 'delete_forever'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  {deleteModalState.badge || 'Hardware Catalog'}
                </span>
                <h3 className="font-bold text-slate-900 text-lg leading-tight mt-0.5">
                  {deleteModalState.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalState(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Hardware Item Info Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-sm font-bold text-slate-900">
                {deleteModalState.itemName}
              </div>
              {deleteModalState.itemDetails && (
                <div className="text-xs text-slate-600">
                  {deleteModalState.itemDetails}
                </div>
              )}
              {deleteModalState.itemRate && (
                <div className="text-xs font-mono font-bold text-emerald-700 pt-0.5">
                  Rate: {deleteModalState.itemRate}
                </div>
              )}
            </div>

            {/* Warning Text */}
            <div className={`text-xs p-3 rounded-xl border flex items-start gap-2 ${
              deleteModalState.isRestore
                ? 'bg-emerald-50/60 text-emerald-800 border-emerald-200'
                : deleteModalState.isArchive
                  ? 'bg-amber-50/60 text-amber-800 border-amber-200'
                  : 'bg-rose-50/60 text-rose-800 border-rose-200'
            }`}>
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                {deleteModalState.isRestore ? 'info' : 'warning'}
              </span>
              <span className="leading-relaxed">
                {deleteModalState.warning}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModalState(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 min-h-[44px] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteModalState.onConfirm}
                className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs min-h-[44px] cursor-pointer shadow-sm flex items-center gap-1.5 transition-colors ${
                  deleteModalState.isRestore
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : deleteModalState.isArchive
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {deleteModalState.isRestore ? 'check_circle' : deleteModalState.isArchive ? 'archive' : 'delete'}
                </span>
                <span>{deleteModalState.confirmButtonText || 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
