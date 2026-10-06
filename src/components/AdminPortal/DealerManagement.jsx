import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import ViewModeToggle, { useTableViewMode } from '../Shared/ViewModeToggle';

export default function DealerManagement() {
  const { dealers, addDealer, updateDealer, deleteDealer, toggleDealerStatus, updateDealerPassword, updateDealerPricing, tierMargins, updateTierMargins, addNotification, setActiveTab, staffList } = useApp();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState('all');
  const [discomFilter, setDiscomFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [salesmanFilter, setSalesmanFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDealer, setEditingDealer] = useState(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [viewMode, setViewMode] = useTableViewMode('admin_dealer_mgmt');
  const [dealerToDelete, setDealerToDelete] = useState(null);

  // Filter out Verification desk officers to only show Sales Team members
  const salesStaffList = useMemo(() => {
    const list = (staffList || []).filter(s => {
      const dept = (s.department || '').toLowerCase();
      const role = (s.role || '').toLowerCase();
      return !dept.includes('verification') && !role.includes('verification');
    });
    return list.length > 0 ? list : [
      { id: 'STF-801', name: 'Sunvine Sales Staff', role: 'Senior Solar Field Executive', city: 'Ahmedabad', zone: 'Gujarat Sales Desk', phone: '8000050580' }
    ];
  }, [staffList]);

  const handleConfirmDeleteDealer = () => {
    if (!dealerToDelete) return;
    if (deleteDealer) {
      deleteDealer(dealerToDelete.id || dealerToDelete.dealerCode);
    }
    if (addToast) {
      addToast({
        title: 'Dealer Partner Deleted',
        message: `${dealerToDelete.firmName} (${dealerToDelete.id}) was permanently removed.`,
        type: 'info'
      });
    }
    setDealerToDelete(null);
    if (credModalDealer?.id === dealerToDelete.id) {
      setCredModalDealer(null);
    }
    if (editingDealer?.id === dealerToDelete.id) {
      setEditingDealer(null);
      setShowAddModal(false);
    }
  };

  // Dealer Custom Pricing Modal States
  const [pricingModalDealer, setPricingModalDealer] = useState(null);
  const [pricingMode, setPricingMode] = useState('standard');
  const [customWpRate, setCustomWpRate] = useState(18.00);
  const [customKwRate, setCustomKwRate] = useState(58000);
  const [customMarginKw, setCustomMarginKw] = useState(4500);
  const [customDiscount, setCustomDiscount] = useState(0);
  const [customNotes, setCustomNotes] = useState('');

  const openPricingModal = (d) => {
    setPricingModalDealer(d);
    const cfg = d.pricingConfig || {};
    setPricingMode(cfg.pricingMode || 'standard');
    setCustomWpRate(cfg.customBaseRatePerWp !== undefined ? cfg.customBaseRatePerWp : 18.00);
    setCustomKwRate(cfg.customBaseRatePerKw !== undefined ? cfg.customBaseRatePerKw : 58000);
    setCustomMarginKw(cfg.customMarginPerKw !== undefined ? cfg.customMarginPerKw : 4500);
    setCustomDiscount(cfg.customDiscountPercent || 0);
    setCustomNotes(cfg.customNotes || '');
  };

  const handleSaveDealerPricing = () => {
    if (!pricingModalDealer) return;
    const newCfg = {
      pricingMode,
      customBaseRatePerWp: Number(customWpRate) || 18.00,
      customBaseRatePerKw: Number(customKwRate) || 58000,
      customMarginPerKw: Number(customMarginKw) || 4500,
      customDiscountPercent: Number(customDiscount) || 0,
      customNotes: customNotes.trim()
    };
    if (updateDealerPricing) {
      updateDealerPricing(pricingModalDealer.id, newCfg);
    }
    addToast(`Pricing updated for ${pricingModalDealer.firmName} (${pricingMode === 'custom' ? `Custom ₹${newCfg.customBaseRatePerWp}/Wp` : 'Standard Tier'})`, 'success');
    setPricingModalDealer(null);
  };

  // Helper: auto-increment dealer code based on highest numeric ID in existing dealers
  const computeNextDealerCode = (dealerList = []) => {
    const nums = (dealerList || [])
      .map(d => {
        const str = String(d?.id || d?.dealerCode || '');
        const match = str.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(n => n !== null && !isNaN(n));
    if (nums.length === 0) return 'SV-DLR-0801';
    const nextNum = Math.max(...nums) + 1;
    const formattedNum = nextNum < 1000 ? `0${nextNum}` : `${nextNum}`;
    return `SV-DLR-${formattedNum}`;
  };

  // Onboarding Form States
  const [newDealerCode, setNewDealerCode] = useState('');
  const [newFirm, setNewFirm] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAssignedStaffId, setNewAssignedStaffId] = useState('STF-801');
  const [newZone, setNewZone] = useState('Rajkot & Saurashtra Zone (Western Gujarat)');
  const [newAddress, setNewAddress] = useState('');
  const [newGstin, setNewGstinState] = useState('');
  const [newPan, setNewPan] = useState('');
  const [newDiscomCode, setNewDiscomCode] = useState('PGVCL-VND-2025-0845');
  const [newTier, setNewTier] = useState('Gold EPC Partner (Quarterly Cap: 1.5 MW)');
  const [newCap, setNewCap] = useState('5,000');
  const [newPassword, setNewPassword] = useState('Sunvine@2026');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formError, setFormError] = useState('');

  // Password / Credentials Modal for Existing Dealers
  const [credModalDealer, setCredModalDealer] = useState(null);
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [credSavedNotice, setCredSavedNotice] = useState(false);

  const openCredModal = (d) => {
    setCredModalDealer(d);
    setEditMobile(d.mobile || '');
    setEditEmail(d.email || '');
    setEditPassword(d.password || '');
    setShowEditPassword(false);
    setCopiedCreds(false);
    setCredSavedNotice(false);
  };

  const handleSaveDealerCredentials = () => {
    if (!credModalDealer) return;
    const cleanMobile = String(editMobile || '').replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      if (addToast) addToast({ title: 'Invalid Mobile', message: 'Enter a valid 10-digit mobile number.', type: 'error' });
      return;
    }
    const cleanEmail = editEmail.trim();
    const cleanPass = editPassword.trim();
    if (!cleanPass) {
      if (addToast) addToast({ title: 'Password Required', message: 'Password cannot be empty.', type: 'error' });
      return;
    }

    const updatedDealer = {
      ...credModalDealer,
      mobile: cleanMobile,
      email: cleanEmail ? cleanEmail : null,
      password: cleanPass
    };

    if (updateDealer) {
      updateDealer(updatedDealer);
    }
    if (updateDealerPassword) {
      updateDealerPassword(credModalDealer.id, cleanPass);
    }

    setCredSavedNotice(true);
    if (addToast) {
      addToast({
        title: 'Credentials Saved',
        message: `Updated login credentials for ${credModalDealer.firmName}.`,
        type: 'success'
      });
    }
    if (addNotification) {
      addNotification({
        title: 'Dealer Credentials Updated',
        description: `Portal login credentials for ${credModalDealer.firmName} updated by Admin.`,
        type: 'success',
        icon: 'key',
        audience: 'admin'
      });
    }
    setTimeout(() => {
      setCredModalDealer(null);
      setCredSavedNotice(false);
    }, 1200);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
    let pass = 'SV@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // Tier Margins Quick Editor Form State
  const [tempTierMargins, setTempTierMargins] = useState(() => tierMargins || {});

  useEffect(() => {
    if (tierMargins && Object.keys(tierMargins).length > 0) {
      setTempTierMargins(tierMargins);
    }
  }, [tierMargins]);

  const setNewGstin = (val) => {
    const upper = val.toUpperCase();
    setNewGstinState(upper);
    if (upper.length >= 12) {
      setNewPan(upper.slice(2, 12));
    }
  };

  // Dynamic Metrics from real Gujarat dealers
  const totalDealersCount = (dealers || []).length;
  const activeDealersCount = (dealers || []).filter(d => d.status === 'Active').length;
  const pendingDealersCount = (dealers || []).filter(d => d.status === 'Pending').length;
  const suspendedDealersCount = (dealers || []).filter(d => d.status === 'Suspended').length;
  const totalCapacityMw = ((dealers || []).reduce((acc, d) => acc + (d.totalCapacityKw || 0), 0) / 1000).toFixed(1);

  // Sort dealers: newly onboarded / updated dealers first
  const sortedDealers = useMemo(() => {
    return [...(dealers || [])].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return String(b.id || b.dealerCode || '').localeCompare(String(a.id || a.dealerCode || ''));
    });
  }, [dealers]);

  // Filter dealers across Gujarat
  const filteredDealers = sortedDealers.filter((d) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      (d.firmName && d.firmName.toLowerCase().includes(term)) ||
      (d.contactPerson && d.contactPerson.toLowerCase().includes(term)) ||
      (d.city && d.city.toLowerCase().includes(term)) ||
      (d.id && d.id.toLowerCase().includes(term)) ||
      (d.gstin && d.gstin.toLowerCase().includes(term));

    if (!matchSearch) return false;
    if (activeTabFilter === 'active' && d.status !== 'Active') return false;
    if (activeTabFilter === 'pending' && d.status !== 'Pending') return false;
    if (activeTabFilter === 'suspended' && d.status !== 'Suspended') return false;

    if (discomFilter !== 'all' && !(d.discom || '').toLowerCase().includes(discomFilter.toLowerCase())) return false;
    if (tierFilter !== 'all' && d.tier !== tierFilter) return false;
    if (salesmanFilter !== 'all') {
      const sId = d.assignedStaffId || 'STF-DIRECT';
      const sName = (d.assignedStaffName || '').toLowerCase();
      if (salesmanFilter === 'STF-DIRECT') {
        if (sId !== 'STF-DIRECT' && !sName.includes('direct') && !sName.includes('corporate') && !sName.includes('company')) return false;
      } else {
        if (sId !== salesmanFilter && d.assignedStaffName !== salesmanFilter) return false;
      }
    }

    return true;
  });

  const totalPages = Math.ceil(filteredDealers.length / pageSize) || 1;
  const paginatedDealers = filteredDealers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Structured Tabular CSV Export of Dealer Directory (SR-44)
  const handleExportDirectory = () => {
    const dataToExport = filteredDealers;
    if (!dataToExport || dataToExport.length === 0) {
      alert('No dealer partner records found for the selected filters.');
      return;
    }

    const headers = [
      'Dealer ID',
      'Dealer / Firm Name',
      'Contact Person',
      'Mobile',
      'Email',
      'Assigned Salesman ID',
      'Assigned Salesman Name',
      'City',
      'State',
      'DISCOM Circle',
      'Pricing Tier',
      'Default Margin / kW (INR)',
      'Max Margin Cap / kW (INR)',
      'Total Quotes Issued',
      'Capacity Sold (kW)',
      'GSTIN',
      'PAN Number',
      'KYC Status',
      'Portal Status'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(',')];

    dataToExport.forEach(d => {
      const tierKey = (d.tier || '').toLowerCase().includes('diamond') ? 'diamond' :
                      (d.tier || '').toLowerCase().includes('platinum') ? 'platinum' :
                      (d.tier || '').toLowerCase().includes('silver') ? 'silver' : 'gold';
      const conf = tierMargins?.[tierKey] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 };
      const defaultMargin = conf.defaultMarginPerKw || 4500;
      const marginCap = d.maxMarginCapPerKw || conf.maxMarginCapPerKw || 6000;

      const row = [
        escapeCsv(d.id),
        escapeCsv(d.firmName),
        escapeCsv(d.contactPerson),
        escapeCsv(d.mobile),
        escapeCsv(d.email),
        escapeCsv(d.assignedStaffId || 'STF-801'),
        escapeCsv(d.assignedStaffName || 'Sunvine Sales Staff'),
        escapeCsv(d.city || 'Gujarat'),
        escapeCsv('Gujarat'),
        escapeCsv((d.discom || '').includes('Circle') ? d.discom : `${d.discom || 'PGVCL'} Circle`),
        escapeCsv(d.tier || conf.tierName || 'Gold EPC Partner'),
        escapeCsv(defaultMargin),
        escapeCsv(marginCap),
        escapeCsv(d.totalQuotes || 0),
        escapeCsv(d.totalCapacityKw || 0),
        escapeCsv(d.gstin || '24AFPFS7402A1Z7'),
        escapeCsv(d.pan || (d.gstin ? d.gstin.slice(2, 12) : 'AFPFS7402A')),
        escapeCsv('Verified'),
        escapeCsv(d.status || 'Active')
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\r\n'));
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', csvContent);
    const dateStamp = new Date().toISOString().split('T')[0];
    downloadLink.setAttribute('download', `sunvine_dealer_partners_${activeTabFilter}_${dateStamp}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleOpenAddDealer = () => {
    setEditingDealer(null);
    setNewDealerCode(computeNextDealerCode(dealers));
    setNewFirm('');
    setNewContact('');
    setNewMobile('');
    setNewEmail('');
    setNewAssignedStaffId(salesStaffList[0]?.id || 'STF-801');
    setNewZone('Rajkot & Saurashtra Zone (Western Gujarat)');
    setNewAddress('');
    setNewGstinState('');
    setNewPan('');
    setNewDiscomCode('PGVCL-VND-2025-0845');
    setNewTier('Gold EPC Partner (Quarterly Cap: 1.5 MW)');
    setNewCap('5,000');
    setNewPassword('Sunvine@2026');
    setFormError('');
    setShowAddModal(true);
  };

  const handleEditDealer = (dealer) => {
    setEditingDealer(dealer);
    setNewDealerCode(dealer.id || dealer.dealerCode || '');
    setNewFirm(dealer.firmName || '');
    setNewContact(dealer.contactPerson || '');
    setNewMobile(dealer.mobile || dealer.phone || '');
    setNewEmail(dealer.email || '');
    setNewAssignedStaffId(dealer.assignedStaffId || salesStaffList[0]?.id || 'STF-801');
    const zone = (dealer.city || '').toLowerCase().includes('surat') ? 'Surat & South Gujarat Hub' :
                 (dealer.city || '').toLowerCase().includes('vadodara') ? 'Vadodara Industrial Corridor' :
                 (dealer.city || '').toLowerCase().includes('ahmedabad') ? 'Ahmedabad Central & Gandhinagar' :
                 (dealer.discom || '').toLowerCase().includes('ugvcl') ? 'North Gujarat Zone (UGVCL / Mehsana)' :
                 'Rajkot & Saurashtra Zone (Western Gujarat)';
    setNewZone(zone);
    setNewAddress(dealer.address || '');
    setNewGstinState(dealer.gstin || '');
    setNewPan(dealer.pan || '');
    setNewDiscomCode(dealer.discomLicense || dealer.gedaLicenseNo || 'PGVCL-VND-2025-0845');

    const tierStr = (dealer.tier || '').toLowerCase().includes('diamond') ? 'Diamond EPC Partner (Quarterly Cap: > 5 MW)' :
                    (dealer.tier || '').toLowerCase().includes('platinum') ? 'Platinum Tier (Quarterly Cap: > 3.0 MW)' :
                    (dealer.tier || '').toLowerCase().includes('silver') ? 'Silver Installer (Quarterly Cap: 500 kW)' :
                    'Gold EPC Partner (Quarterly Cap: 1.5 MW)';
    setNewTier(tierStr);
    setNewCap(dealer.maxMarginCapPerKw ? dealer.maxMarginCapPerKw.toLocaleString('en-IN') : '5,000');
    setNewPassword(dealer.password || 'Sunvine@2026');
    setFormError('');
    setShowAddModal(true);
  };

  const handleDiscardModal = () => {
    setEditingDealer(null);
    setNewDealerCode('');
    setNewFirm('');
    setNewContact('');
    setNewMobile('');
    setNewEmail('');
    setNewAssignedStaffId(salesStaffList[0]?.id || 'STF-801');
    setNewAddress('');
    setNewGstinState('');
    setNewPan('');
    setNewPassword('Sunvine@2026');
    setFormError('');
    setShowAddModal(false);
  };

  const handleSaveDealer = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanMobile = (newMobile || '').replace(/\D/g, '').slice(0, 10);
    if (!newFirm.trim() || !newContact.trim() || cleanMobile.length !== 10) {
      const msg = 'Please fill in required fields: Firm Name, Signatory, and a valid 10-digit Mobile Number.';
      setFormError(msg);
      if (addToast) addToast({ title: 'Validation Error', message: msg, type: 'error' });
      return;
    }

    const cleanEmail = newEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cleanEmail && !emailRegex.test(cleanEmail)) {
      const msg = 'Please enter a valid email address (e.g. partner@example.com) or leave it empty.';
      setFormError(msg);
      if (addToast) addToast({ title: 'Invalid Email', message: msg, type: 'error' });
      return;
    }

    const tierClean = newTier.includes('Diamond') ? 'Diamond EPC' :
                      newTier.includes('Platinum') ? 'Platinum Tier' :
                      newTier.includes('Silver') ? 'Silver Installer' : 'Gold EPC';

    const cleanCap = Number(String(newCap).replace(/[^0-9]/g, '')) || 5000;

    // Derive salesman assignment and region
    const isDirectCompany = newAssignedStaffId === 'STF-DIRECT';
    const foundStaff = (staffList || []).find(s => s.id === newAssignedStaffId) || (salesStaffList || []).find(s => s.id === newAssignedStaffId);
    const selectedStaff = isDirectCompany
      ? { id: 'STF-DIRECT', name: 'Direct to Company (HQ)', city: 'Ahmedabad', zone: 'Corporate All Gujarat Desk' }
      : foundStaff || {
          id: newAssignedStaffId || 'STF-801',
          name: 'Sunvine Sales Staff',
          city: 'Ahmedabad',
          zone: 'Gujarat Sales Desk'
        };

    const assignedStaffId = isDirectCompany ? 'STF-DIRECT' : (selectedStaff.id || newAssignedStaffId || 'STF-801');
    const assignedStaffName = isDirectCompany ? 'Direct to Company (HQ Desk)' : (selectedStaff.name || 'Sunvine Sales Staff');

    const staffCity = selectedStaff.city || 'Ahmedabad';
    const staffZone = selectedStaff.zone || '';
    const cityDerived = isDirectCompany ? 'Ahmedabad' :
                        staffCity.includes('Rajkot') ? 'Rajkot' :
                        staffCity.includes('Surat') ? 'Surat' :
                        staffCity.includes('Vadodara') ? 'Vadodara' :
                        staffCity.includes('Gandhinagar') ? 'Gandhinagar' :
                        staffCity.includes('Bhavnagar') ? 'Bhavnagar' :
                        staffCity.includes('Jamnagar') ? 'Jamnagar' :
                        staffCity.includes('Mehsana') ? 'Mehsana' : 'Ahmedabad';

    const discomDerived = isDirectCompany ? 'Gujarat Corporate Circle' :
                          staffZone.includes('PGVCL') || staffCity.includes('Rajkot') || staffCity.includes('Jamnagar') || staffCity.includes('Bhavnagar') ? 'PGVCL Circle' :
                          staffZone.includes('DGVCL') || staffCity.includes('Surat') || staffCity.includes('Bharuch') || staffCity.includes('Navsari') ? 'DGVCL Circle' :
                          staffZone.includes('MGVCL') || staffCity.includes('Vadodara') || staffCity.includes('Anand') ? 'MGVCL Circle' : 'UGVCL Circle';

    const finalEmail = cleanEmail ? cleanEmail : null;

    if (editingDealer) {
      const updatedDealerObj = {
        ...editingDealer,
        firmName: newFirm.trim(),
        contactPerson: newContact.trim(),
        mobile: cleanMobile,
        email: finalEmail,
        assignedStaffId,
        assignedStaffName,
        city: editingDealer.city || cityDerived,
        state: 'Gujarat',
        discom: editingDealer.discom || discomDerived,
        tier: tierClean,
        maxMarginCapPerKw: cleanCap,
        address: newAddress.trim() || editingDealer.address,
        gstin: newGstin.trim() || editingDealer.gstin || '24AAECB1234F1Z5',
        pan: newPan.trim() || (newGstin.trim() ? newGstin.trim().slice(2, 12) : editingDealer.pan || 'AAECB1234F'),
        discomLicense: newDiscomCode.trim() || editingDealer.discomLicense || editingDealer.gedaLicenseNo,
        password: newPassword.trim() || editingDealer.password || '',
        pricingConfig: {
          ...(editingDealer.pricingConfig || {}),
          assignedStaffId,
          assignedStaffName
        }
      };

      const isUnchanged =
        editingDealer.firmName === updatedDealerObj.firmName &&
        editingDealer.contactPerson === updatedDealerObj.contactPerson &&
        editingDealer.mobile === updatedDealerObj.mobile &&
        (editingDealer.email || '') === (updatedDealerObj.email || '') &&
        (editingDealer.assignedStaffId || 'STF-DIRECT') === updatedDealerObj.assignedStaffId &&
        editingDealer.city === updatedDealerObj.city &&
        editingDealer.discom === updatedDealerObj.discom &&
        editingDealer.tier === updatedDealerObj.tier &&
        Number(editingDealer.maxMarginCapPerKw) === Number(updatedDealerObj.maxMarginCapPerKw) &&
        (editingDealer.address || '') === (updatedDealerObj.address || '') &&
        (editingDealer.gstin || '') === (updatedDealerObj.gstin || '') &&
        (editingDealer.pan || '') === (updatedDealerObj.pan || '') &&
        (editingDealer.discomLicense || editingDealer.gedaLicenseNo || '') === (updatedDealerObj.discomLicense || '') &&
        (editingDealer.password || '') === (updatedDealerObj.password || '');

      if (isUnchanged) {
        if (addToast) {
          addToast({
            title: 'No Changes Detected',
            message: 'Dealer partner profile is already up to date.',
            type: 'info'
          });
        }
        setShowAddModal(false);
        setEditingDealer(null);
        return;
      }

      if (updateDealer) {
        updateDealer(updatedDealerObj);
      }
      if (addNotification) {
        addNotification({
          title: 'Dealer Partner Updated',
          description: `${newFirm.trim()} (${editingDealer.id}) profile was updated successfully.`,
          type: 'success',
          icon: 'edit',
          audience: 'admin'
        });
      }
      if (addToast) {
        addToast({
          title: 'Dealer Updated',
          message: `${newFirm.trim()} profile was updated successfully.`,
          type: 'success'
        });
      }
    } else {
      const finalDealerId = newDealerCode.trim() || computeNextDealerCode(dealers);
      const newDealerObj = {
        id: finalDealerId,
        dealerCode: finalDealerId,
        firmName: newFirm.trim(),
        contactPerson: newContact.trim(),
        mobile: cleanMobile,
        email: finalEmail,
        assignedStaffId,
        assignedStaffName,
        city: cityDerived,
        state: 'Gujarat',
        discom: discomDerived,
        tier: tierClean,
        maxMarginCapPerKw: cleanCap,
        address: newAddress.trim(),
        gstin: newGstin.trim() || '24AAECB1234F1Z5',
        pan: newPan.trim() || (newGstin.trim() ? newGstin.trim().slice(2, 12) : 'AAECB1234F'),
        discomLicense: newDiscomCode.trim(),
        totalQuotes: 0,
        totalCapacityKw: 0,
        status: 'Active',
        joinedDate: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()),
        password: newPassword.trim() || '',
        pricingConfig: {
          assignedStaffId,
          assignedStaffName
        }
      };

      if (addDealer) {
        addDealer(newDealerObj);
      }
      if (addNotification) {
        addNotification({
          title: 'New EPC Dealer Onboarded',
          description: `${newFirm.trim()} (${tierClean}) added under Salesman ${assignedStaffName}.`,
          type: 'success',
          icon: 'person_add',
          audience: 'admin'
        });
      }
    }

    handleDiscardModal();
  };

  // If Onboarding Mode is Active, show exact Stitch Onboard Screen
  if (showAddModal) {
    return (
      <div className="flex flex-col w-full pb-16">
        {/* Breadcrumb Header */}
        <section className="bg-surface-container-lowest border-b border-surface-container-highest px-4 sm:px-8 py-4 sm:py-5 -mt-4 -mx-4 sm:-mx-6 mb-6">
          <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={handleDiscardModal}
                  className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary hover:text-primary transition-colors font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Back to Dealer Management</span>
                </button>
                <span className="text-secondary/40 text-xs hidden sm:inline">/</span>
                <nav className="hidden sm:flex items-center gap-1.5 text-secondary font-label-xs text-label-xs">
                  <button
                    onClick={() => setActiveTab('admin_dashboard')}
                    className="hover:text-primary transition-colors cursor-pointer"
                    type="button"
                  >
                    Admin Console
                  </button>
                  <span>&gt;</span>
                  <button
                    onClick={handleDiscardModal}
                    className="hover:text-primary transition-colors cursor-pointer"
                    type="button"
                  >
                    Dealer Partners
                  </button>
                  <span>&gt;</span>
                  <span className="text-on-surface font-semibold">{editingDealer ? 'Edit Partner Profile' : 'Onboard New Partner'}</span>
                </nav>
              </div>
              <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
                {editingDealer ? `Edit EPC Dealer Partner (${editingDealer.id})` : 'Onboard New EPC Dealer Partner'}
              </h1>
              <p className="font-body-md text-body-md text-secondary">
                {editingDealer
                  ? 'Update authorized dealer profile, configure margin caps, DISCOM empanelment, and manage portal credentials.'
                  : 'Create authorized dealer profile, configure margin caps, DISCOM empanelment, and issue authenticated portal credentials.'}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={handleDiscardModal}
                className="flex-1 sm:flex-initial px-4 py-2 font-label-md text-label-md text-secondary hover:text-error transition-colors rounded-lg cursor-pointer text-center"
                type="button"
              >
                Discard Changes
              </button>
              <button
                onClick={handleSaveDealer}
                className="flex-1 sm:flex-initial px-4 py-2 bg-primary-container text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer font-semibold"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {editingDealer ? 'save' : 'person_add'}
                </span>
                <span>{editingDealer ? 'Save & Update' : 'Save & Onboard'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Visible Validation Error Banner */}
        {formError && (
          <div className="max-w-[1520px] mx-auto w-full mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2 shadow-xs">
            <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
            <span>{formError}</span>
          </div>
        )}

        {/* 12-Column Layout */}
        <div className="grid grid-cols-12 gap-6 max-w-[1520px] mx-auto w-full">
          {/* Left Column (8 cols) */}
          <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
            {/* Section 1: Firm & Agency Profile */}
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-4 sm:p-6 shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-surface-container-highest">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-container/15 flex items-center justify-center text-primary font-bold shrink-0">
                    <span className="material-symbols-outlined text-[20px]">apartment</span>
                  </div>
                  <div>
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">1. Firm &amp; Agency Profile</h2>
                    <p className="font-body-sm text-body-sm text-secondary">Statutory operational business identity and primary communications point</p>
                  </div>
                </div>
                <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-label-xs font-label-xs bg-primary-container/15 text-primary font-semibold flex items-center gap-1 shrink-0">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Verified Entity
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6">
                <div className="col-span-1 md:col-span-2">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5">
                    Firm / Agency Trade Name <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 font-medium"
                      type="text"
                      value={newFirm}
                      onChange={(e) => setNewFirm(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-primary">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                  </div>
                  <p className="mt-1 font-body-sm text-body-sm text-secondary">Registered under Registrar of Companies (ROC - Ahmedabad)</p>
                </div>
                <div className="col-span-1">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5">
                    Authorized Signatory / Person <span className="text-error">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                    type="text"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                    <span>Registered Mobile <span className="text-error">*</span></span>
                    <span className="font-label-xs text-label-xs text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span> Auth Key
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 font-mono text-sm font-bold text-slate-600 select-none pointer-events-none flex items-center gap-1.5 z-10">
                      <span>+91</span>
                      <span className="text-slate-300 font-normal">|</span>
                    </span>
                    <input
                      className="w-full pl-14 pr-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface font-semibold focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 font-mono tracking-wide"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="9876543210"
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      autoComplete="off"
                    />
                  </div>
                  <p className="mt-1 font-body-sm text-body-sm text-secondary">Primary authentication identifier for portal sign-in and signature OTPs</p>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5">
                    Official Business Email <span className="text-xs text-secondary font-normal">(Optional)</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                    type="email"
                    placeholder="e.g. partner@example.com (Optional)"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                {/* Sales Channel & Salesman Assignment (with Direct to Company Primary Option) */}
                <div className="col-span-1 md:col-span-2 flex flex-col gap-2.5 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <label className="block font-label-sm text-label-sm font-semibold text-on-surface">
                      Sales Channel &amp; Account Alignment <span className="text-error">*</span>
                    </label>
                    <span className="text-[11px] text-secondary">Choose whether this partner deals directly with Sunvine HQ or is managed by a Field Salesman</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Primary Button 1: DIRECT TO COMPANY */}
                    <button
                      type="button"
                      onClick={() => setNewAssignedStaffId('STF-DIRECT')}
                      className={`p-3.5 rounded-xl border transition-all text-left flex items-start gap-3 cursor-pointer relative ${
                        newAssignedStaffId === 'STF-DIRECT'
                          ? 'bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 border-indigo-500 shadow-sm ring-2 ring-indigo-500/25'
                          : 'bg-surface-container-lowest border-surface-container-highest hover:border-surface-container-high'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        newAssignedStaffId === 'STF-DIRECT'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-surface-container text-secondary'
                      }`}>
                        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <strong className={`font-semibold text-[13px] ${newAssignedStaffId === 'STF-DIRECT' ? 'text-indigo-950 font-poppins' : 'text-on-surface font-poppins'}`}>
                            ⚡ Direct to Company
                          </strong>
                          {newAssignedStaffId === 'STF-DIRECT' && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                              SELECTED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-secondary mt-1 leading-snug">
                          Dealer buys complete sets/BOS directly from Sunvine HQ or brings direct customer files. No field sales intermediary.
                        </p>
                      </div>
                    </button>

                    {/* Primary Button 2: ASSIGNED FIELD SALES EXECUTIVE */}
                    <button
                      type="button"
                      onClick={() => {
                        if (newAssignedStaffId === 'STF-DIRECT') {
                          const firstField = salesStaffList.find(s => s.id !== 'STF-DIRECT') || salesStaffList[0];
                          setNewAssignedStaffId(firstField?.id || 'STF-801');
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all text-left flex items-start gap-3 cursor-pointer relative ${
                        newAssignedStaffId !== 'STF-DIRECT'
                          ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-primary shadow-sm ring-2 ring-primary/25'
                          : 'bg-surface-container-lowest border-surface-container-highest hover:border-surface-container-high'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        newAssignedStaffId !== 'STF-DIRECT'
                          ? 'bg-primary text-on-primary shadow-xs'
                          : 'bg-surface-container text-secondary'
                      }`}>
                        <span className="material-symbols-outlined text-[22px]">person</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <strong className={`font-semibold text-[13px] ${newAssignedStaffId !== 'STF-DIRECT' ? 'text-primary font-poppins' : 'text-on-surface font-poppins'}`}>
                            👤 Field Sales Executive
                          </strong>
                          {newAssignedStaffId !== 'STF-DIRECT' && (
                            <span className="bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                              SELECTED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-secondary mt-1 leading-snug">
                          Dealer is assigned to a regional Sunvine Sales Executive who tracks their pipeline and visits.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Context-aware details below the choice */}
                  {newAssignedStaffId === 'STF-DIRECT' ? (
                    <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-lg flex items-start sm:items-center gap-2.5 text-xs text-indigo-950">
                      <span className="material-symbols-outlined text-indigo-700 text-[18px] shrink-0 mt-0.5 sm:mt-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      <span className="leading-snug">
                        <strong>Direct Corporate Account (STF-DIRECT):</strong> All solar kit quotations, factory inventory allotments, and escrow settlements are routed directly via Sunvine Central HQ Desk (Ahmedabad).
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <label className="block font-label-xs text-label-xs font-semibold text-secondary">
                        Choose Regional Sales Executive <span className="text-error">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={newAssignedStaffId}
                          onChange={(e) => setNewAssignedStaffId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none font-medium cursor-pointer"
                        >
                          {salesStaffList.filter(st => st.id !== 'STF-DIRECT').map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({st.id})
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-secondary">
                          <span className="material-symbols-outlined text-[20px]">unfold_more</span>
                        </div>
                      </div>
                      {(() => {
                        const s = (staffList || []).find(st => st.id === newAssignedStaffId) || salesStaffList[0];
                        if (!s || s.id === 'STF-DIRECT') return null;
                        return (
                          <div className="flex items-center gap-2 text-[11px] text-secondary bg-surface-container-low px-2.5 py-1.5 rounded border border-surface-container-highest">
                            <span className="material-symbols-outlined text-[15px] text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
                            <span className="truncate">
                              <strong className="text-on-surface font-semibold">{s.name}</strong> ({s.id}) • {s.role || 'Sales Executive'} • {s.city || 'Ahmedabad'} ({s.phone || '8000050580'})
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5">
                    Registered Office Physical Address <span className="text-error">*</span>
                  </label>
                  <textarea
                    className="w-full px-3.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                    rows={2}
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Commercial Controls & Dealer Margin Governance */}
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-4 sm:p-6 shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-surface-container-highest">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary-container/50 flex items-center justify-center text-on-secondary-container font-bold shrink-0">
                    <span className="material-symbols-outlined text-[20px]">price_check</span>
                  </div>
                  <div>
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">2. Commercial Controls &amp; Dealer Margin Governance</h2>
                    <p className="font-body-sm text-body-sm text-secondary">Enforce pricing safeguards, quote ceilings, and automated escrow payout workflows</p>
                  </div>
                </div>
                <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-label-xs font-label-xs bg-secondary-container text-on-secondary-fixed font-semibold shrink-0">
                  Audit Policy Active
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6">
                <div className="col-span-1">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5">
                    Assigned Partner Tier <span className="text-error">*</span>
                  </label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 font-semibold cursor-pointer"
                  >
                    <option>Gold EPC Partner (Quarterly Cap: 1.5 MW)</option>
                    <option>Platinum Tier (Quarterly Cap: &gt; 3.0 MW)</option>
                    <option>Silver Installer (Quarterly Cap: 500 kW)</option>
                    <option>Bronze Associate (Speculative)</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5">
                    Minimum Quote Enforced Floor (Turnkey Base) <span className="text-error">*</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface font-semibold focus:outline-none cursor-not-allowed"
                    readOnly
                    type="text"
                    value="₹ 54,000 / kW turnkey base"
                  />
                  <p className="mt-1 font-body-sm text-body-sm text-secondary">System-wide quality protection floor to prevent sub-standard module delivery</p>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block font-label-sm text-label-sm font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                    <span>Max Allowed Dealer Margin Addition Cap <span className="text-error">*</span></span>
                    <span className="font-label-xs text-label-xs text-primary font-bold">Standard Cap: ₹ 5,000</span>
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-body-md font-body-md text-on-surface font-bold focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                    type="text"
                    name="dealerMaxMarginCap"
                    autoComplete="off"
                    value={newCap}
                    onChange={(e) => setNewCap(e.target.value)}
                  />
                  <div className="mt-3 p-3.5 rounded-lg bg-amber-50 border border-amber-200/80 flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-700 text-[20px] mt-0.5 shrink-0">policy</span>
                    <p className="font-body-sm text-body-sm text-amber-900 leading-relaxed">
                      <strong className="font-semibold">Protective Regulatory Threshold:</strong> Prevents predatory consumer overcharging. Any customer quote generated with a margin addition exceeding <strong className="font-bold">₹5,000/kW</strong> will be paused and routed to the Sunvine Super Admin Desk for mandatory pricing review.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-6 shadow-[0px_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5 sticky top-20">
              <div className="flex items-center justify-between pb-4 border-b border-surface-container-highest">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[22px]">key</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">System Credentials</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary-container/20 text-primary border border-primary-container/30">
                  {editingDealer ? 'ACTIVE RECORD' : 'AUTO-ALLOCATED'}
                </span>
              </div>
              <div className="p-3.5 bg-surface-container-low rounded-lg border border-surface-container-highest flex items-center justify-between">
                <div>
                  <span className="font-label-xs text-label-xs text-secondary uppercase tracking-wider block">Assigned Partner ID / Dealer Code</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-headline-sm text-headline-sm font-bold font-mono text-on-surface">
                      {editingDealer ? editingDealer.id : (newDealerCode || computeNextDealerCode(dealers))}
                    </span>
                    {!editingDealer && (
                      <input
                        type="text"
                        value={newDealerCode}
                        onChange={(e) => setNewDealerCode(e.target.value.toUpperCase())}
                        placeholder="SV-DLR-0805"
                        className="text-xs font-mono font-bold px-2 py-0.5 bg-surface-container-highest border border-surface-container-highest rounded text-on-surface focus:outline-none focus:border-primary w-32"
                        title="Auto-incremented dealer code. Editable if needed."
                      />
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-label-xs text-label-xs text-secondary block">Provisioning Status</span>
                  <span className="inline-flex items-center gap-1 font-label-xs text-label-xs font-bold text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-ping"></span>
                    {editingDealer ? 'Active Partner' : 'Auto-Incremented'}
                  </span>
                </div>
              </div>
              <div className="space-y-3 bg-surface-bright p-4 rounded-lg border border-surface-container-highest">
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary uppercase font-semibold">Dealer Portal URL</span>
                  <span className="font-mono text-body-sm text-tertiary font-medium select-all">sunvine-dealer.vprotech.online</span>
                </div>
                <div className="h-px bg-surface-container-highest"></div>
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs text-secondary uppercase font-semibold">Login Username (Mobile)</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-body-sm font-semibold text-on-surface">Registered Mobile</span>
                    <span className="font-mono text-label-sm text-primary font-bold">{newMobile ? `+91 ${newMobile}` : '+91 (10-digit mobile)'}</span>
                  </div>
                </div>
                <div className="h-px bg-surface-container-highest"></div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-label-xs text-secondary uppercase font-semibold">Assigned Portal Password</span>
                    <button
                      type="button"
                      onClick={() => setNewPassword(generateRandomPassword())}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      Auto-Generate
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px]">key</span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-9 pl-9 pr-9 bg-white border border-surface-container-highest rounded-lg font-mono text-xs text-on-surface font-semibold focus:outline-none focus:border-primary-container"
                      placeholder="Assign password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 text-secondary hover:text-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {showNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  <p className="text-[11px] text-secondary">
                    Dealer logs in with registered mobile and this password. Dealer panel cannot alter this password.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSaveDealer}
                className="w-full h-11 bg-primary-container hover:bg-primary text-on-primary rounded-lg font-label-md font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">{editingDealer ? 'save' : 'how_to_reg'}</span>
                <span>{editingDealer ? 'Save & Update Partner' : 'Confirm & Issue Credentials'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render Exact Dealer Management Directory
  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Page Header & Action Clusters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs font-label-xs text-secondary mb-2">
            <button
              onClick={() => setActiveTab('admin_dashboard')}
              className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">dashboard</span>
              <span>Admin Console</span>
            </button>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <button
              onClick={() => {
                setActiveTabFilter('all');
                setDiscomFilter('all');
                setTierFilter('all');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="hover:text-primary transition-colors cursor-pointer"
              type="button"
            >
              Partner Directory
            </button>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-on-surface font-semibold">Dealer Partner Management</span>
          </nav>
          <h1 className="font-poppins font-bold text-headline-xl text-[#0F1B2E] tracking-tight">
            Dealer Partner Management
          </h1>
          <p className="text-body-md text-secondary mt-1">
            Manage onboarded EPC dealers, commission tiers, login credentials, and quotation permissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => {
              setTempTierMargins(tierMargins || {});
              setShowTierModal(true);
            }}
            className="h-10 px-3.5 sm:px-4 bg-white border border-[#E4E7EB] hover:border-primary text-on-surface font-label-md rounded-lg hover:bg-surface-container-low transition-all duration-150 flex items-center gap-2 shadow-xs cursor-pointer text-xs sm:text-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
            <span>Configure Tier Margins</span>
          </button>
          <button
            onClick={handleExportDirectory}
            className="h-10 px-3.5 sm:px-4 bg-white border border-[#0F1B2E] text-[#0F1B2E] font-label-md rounded-lg hover:bg-[#F6F8F7] transition-all duration-150 flex items-center gap-2 shadow-xs text-xs sm:text-sm cursor-pointer"
            type="button"
            title="Export Gujarat dealer directory as CSV"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export Directory</span>
          </button>
          <button
            onClick={handleOpenAddDealer}
            className="h-10 px-3.5 sm:px-4 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-label-md font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 shadow-sm focus:ring-2 focus:ring-primary-container focus:ring-offset-2 text-xs sm:text-sm cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>+ Onboard New Dealer</span>
          </button>
        </div>
      </div>

      {/* 4 METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1 */}
        <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px] group-hover:text-primary transition-colors">Total Registered Dealers</span>
              <span className="w-9 h-9 rounded-lg bg-surface-container group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-[#0F1B2E] transition-colors">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-headline-xl font-poppins font-bold text-[#0F1B2E]">{totalDealersCount}</span>
              <span className="inline-flex items-center gap-0.5 text-label-xs font-semibold text-[#2E7D32] bg-[#6CBF3D]/15 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">verified</span> 100% Gujarat
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F1F4F9] flex items-center justify-between text-body-sm text-secondary">
            <span>Western Grid Region</span>
            <span className="font-semibold text-on-surface">Gujarat (4 DISCOMs)</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px] group-hover:text-primary transition-colors">Active &amp; Quoting</span>
              <span className="w-9 h-9 rounded-lg bg-[#6CBF3D]/15 group-hover:bg-primary/20 flex items-center justify-center text-[#2E7D32] transition-colors">
                <span className="material-symbols-outlined text-[20px]">bolt</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-headline-xl font-poppins font-bold text-[#0F1B2E]">{activeDealersCount}</span>
              <span className="text-label-sm font-semibold text-secondary">
                ({totalDealersCount > 0 ? ((activeDealersCount / totalDealersCount) * 100).toFixed(0) : 0}% activation)
              </span>
              <span className="ml-auto inline-flex items-center text-label-xs font-semibold text-[#2E7D32]">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> Live
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F1F4F9] flex items-center justify-between text-body-sm text-secondary">
            <span>Cumulative Capacity</span>
            <span className="font-semibold text-[#2E7D32]">{totalCapacityMw} MW</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px] group-hover:text-primary transition-colors">Pending Verification / KYC</span>
              <span className="w-9 h-9 rounded-lg bg-amber-500/15 group-hover:bg-primary/10 flex items-center justify-center text-amber-700 transition-colors">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-headline-xl font-poppins font-bold text-[#0F1B2E]">{pendingDealersCount}</span>
              <span className="inline-flex items-center text-label-xs font-semibold text-[#B27204] bg-[#F9A825]/15 px-2 py-0.5 rounded-full">
                Requires Audit
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F1F4F9] flex items-center justify-between text-body-sm text-secondary">
            <span>Avg. review SLA</span>
            <span className="font-semibold text-on-surface font-poppins">4.2 hours</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="kpi-card bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-secondary font-label-sm uppercase tracking-wider text-[11px] group-hover:text-primary transition-colors">Suspended / Inactive</span>
              <span className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[20px]">person_off</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-headline-xl font-poppins font-bold text-[#0F1B2E]">{suspendedDealersCount}</span>
              <span className="inline-flex items-center text-label-xs font-medium text-secondary bg-surface-container px-2 py-0.5 rounded-full">
                {totalDealersCount > 0 ? ((suspendedDealersCount / totalDealersCount) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F1F4F9] text-body-sm text-secondary truncate">
            License review or dormant
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="bg-white rounded-xl border border-[#E4E7EB] p-4 shadow-[0px_2px_8px_rgba(0,0,0,0.06)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[280px] max-w-md relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">filter_list</span>
            <input
              className="w-full h-10 pl-9 pr-3 text-body-sm rounded-lg border border-[#E4E7EB] focus:border-[#6CBF3D] focus:ring-2 focus:ring-[#6CBF3D]/20 outline-none"
              placeholder="Search by Dealer, Firm Name, City, or GSTIN..."
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={salesmanFilter}
              onChange={(e) => { setSalesmanFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 px-3 bg-white border border-[#E4E7EB] rounded-lg text-body-sm text-on-surface focus:border-[#6CBF3D] outline-none cursor-pointer"
            >
              <option value="all">All Sales Channels (Company &amp; Field)</option>
              <option value="STF-DIRECT">⚡ Direct to Company (HQ Desk)</option>
              {salesStaffList.filter(st => st.id !== 'STF-DIRECT').map((st) => (
                <option key={st.id} value={st.id}>{st.name} ({st.id})</option>
              ))}
            </select>
            <select
              value={discomFilter}
              onChange={(e) => { setDiscomFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 px-3 bg-white border border-[#E4E7EB] rounded-lg text-body-sm text-on-surface focus:border-[#6CBF3D] outline-none cursor-pointer"
            >
              <option value="all">Region / DISCOM Circle (All Circles)</option>
              <option value="PGVCL">PGVCL - Paschim Gujarat</option>
              <option value="DGVCL">DGVCL - Dakshin Gujarat</option>
              <option value="MGVCL">MGVCL - Madhya Gujarat</option>
              <option value="UGVCL">UGVCL - Uttar Gujarat</option>
              <option value="Torrent">Torrent Power (Ahm/Surat)</option>
            </select>
            <select
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 px-3 bg-white border border-[#E4E7EB] rounded-lg text-body-sm text-on-surface focus:border-[#6CBF3D] outline-none cursor-pointer"
            >
              <option value="all">Margin Slab Tier (All Tiers)</option>
              <option value="Platinum Partner">Platinum Partner (₹7.5k/kW)</option>
              <option value="Gold EPC Partner">Gold EPC Partner (₹6.0k/kW)</option>
              <option value="Standard Tier">Standard Tier (₹5.0k/kW)</option>
              <option value="Diamond Partner">Diamond Partner (₹8.0k/kW)</option>
            </select>
            <button
              onClick={() => {
                setSearchTerm('');
                setActiveTabFilter('all');
                setDiscomFilter('all');
                setTierFilter('all');
                setSalesmanFilter('all');
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-lg text-secondary hover:text-[#0F1B2E] hover:bg-[#F6F8F7] text-label-sm flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset Filters"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            </button>
          </div>
        </div>

        {/* Quick Tabs & View Mode Toggle */}
        <div className="pt-3 border-t border-[#F1F4F9] flex flex-wrap items-center justify-between gap-3 text-label-sm">
          <div className="flex items-center gap-1 bg-[#F6F8F7] p-1 rounded-lg">
            <button
              onClick={() => { setActiveTabFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                activeTabFilter === 'all' ? 'bg-white text-[#0F1B2E] shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              All ({totalDealersCount})
            </button>
            <button
              onClick={() => { setActiveTabFilter('active'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTabFilter === 'active' ? 'bg-white text-[#0F1B2E] shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Active ({activeDealersCount})
            </button>
            <button
              onClick={() => { setActiveTabFilter('pending'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTabFilter === 'pending' ? 'bg-white text-[#0F1B2E] shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Pending KYC ({pendingDealersCount})
            </button>
            <button
              onClick={() => { setActiveTabFilter('suspended'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTabFilter === 'suspended' ? 'bg-white text-[#0F1B2E] shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Suspended ({suspendedDealersCount})
            </button>
          </div>
          <div className="flex items-center gap-3">
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            <div className="text-body-sm text-secondary">
              Showing <span className="font-semibold text-on-surface">{filteredDealers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredDealers.length)}</span> of <span className="font-semibold text-on-surface">{filteredDealers.length}</span> Gujarat Dealers
            </div>
          </div>
        </div>
      </div>

      {/* DATA PRESENTATION: CARDS OR TABLE */}
      <div className="bg-white rounded-xl border border-[#E4E7EB] shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        {viewMode === 'card' ? (
          <div className="p-4 sm:p-5">
            {paginatedDealers.length === 0 ? (
              <div className="py-12 text-center text-secondary">
                <span className="material-symbols-outlined text-4xl text-secondary/40 block mb-2">search_off</span>
                No Gujarat dealers match your current filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedDealers.map((d) => {
                  const isGold = d.tier.includes('Gold');
                  const isPlat = d.tier.includes('Platinum');
                  const isDiam = d.tier.includes('Diamond');
                  const tierColor = isPlat
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isDiam
                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                    : isGold
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-gray-100 text-gray-800 border-gray-300';
                  const initials = (d.firmName || 'ST').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                  const discomText = (d.discom || '').includes('Circle') ? d.discom : `${d.discom || 'PGVCL'} Circle`;
                  const tierKey = (d.tier || '').toLowerCase().includes('diamond') ? 'diamond' :
                                  (d.tier || '').toLowerCase().includes('platinum') ? 'platinum' :
                                  (d.tier || '').toLowerCase().includes('silver') ? 'silver' : 'gold';
                  const conf = tierMargins?.[tierKey] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 };

                  return (
                    <div key={d.id} className="bg-white border border-[#E4E7EB] rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/50 transition-all">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#0F1B2E] bg-surface-container px-2 py-0.5 rounded">
                          #{d.id}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          d.status === 'Active'
                            ? 'bg-[#6CBF3D]/15 text-[#2E7D32]'
                            : 'bg-surface-container text-secondary'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'Active' ? 'bg-[#2E7D32]' : 'bg-secondary'}`}></span>
                          {d.status}
                        </span>
                      </div>

                      {/* Firm & Contact details */}
                      <div className="flex items-start gap-2.5">
                        {d.avatar ? (
                          <img
                            alt={d.contactPerson}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-[#6CBF3D]/40 shrink-0 mt-0.5"
                            src={d.avatar}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-surface-container-high text-primary font-bold flex items-center justify-center text-xs shrink-0 border border-primary/20 mt-0.5">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-poppins font-semibold text-on-surface text-sm truncate leading-tight">
                            {d.firmName}
                          </h3>
                          <p className="text-xs text-secondary mt-0.5 font-medium">{d.contactPerson}</p>
                          <p className="text-[11px] text-secondary font-mono mt-0.5 truncate">{d.mobile} • {d.email}</p>
                        </div>
                      </div>

                      {/* Region & Tier */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1F4F9] text-xs">
                        <div>
                          <div className="text-secondary text-[11px]">Region &amp; DISCOM</div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            {discomText}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${tierColor}`}>
                            <span className="material-symbols-outlined text-[12px]">military_tech</span> {d.tier || conf.tierName}
                          </div>
                          <div className="text-[10px] text-secondary mt-0.5">Cap: ₹{(d.maxMarginCapPerKw || conf.maxMarginCapPerKw).toLocaleString('en-IN')}/kW</div>
                        </div>
                      </div>

                      {/* Assigned Salesman */}
                      {d.assignedStaffId === 'STF-DIRECT' ? (
                        <div className="flex items-center gap-2 bg-indigo-50/90 px-2.5 py-1.5 rounded-lg text-xs border border-indigo-200 text-indigo-950">
                          <span className="material-symbols-outlined text-[16px] text-indigo-700" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
                          <span className="font-semibold truncate">⚡ Direct to Company (HQ Desk)</span>
                        </div>
                      ) : (() => {
                        const matchedStaff = (staffList || []).find(s => s.id === d.assignedStaffId);
                        const isLegacy = d.assignedStaffName === 'Jayesh Patel' || d.assignedStaffId === 'STF-001';
                        const staffName = matchedStaff?.name || (!isLegacy && d.assignedStaffName) || salesStaffList[0]?.name || 'Sunvine Sales Staff';
                        const staffId = matchedStaff?.id || (!isLegacy && d.assignedStaffId) || salesStaffList[0]?.id || 'STF-801';
                        return (
                          <div className="flex items-center gap-2 bg-[#F6F8F7] px-2.5 py-1.5 rounded-lg text-xs border border-[#E4E7EB]/70">
                            <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                              {staffName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-on-surface truncate">
                                Salesman: <strong className="font-semibold text-primary">{staffName}</strong>
                              </span>
                              <span className="text-[10px] text-secondary font-mono ml-1 shrink-0">{staffId}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Metrics bar */}
                      <div className="grid grid-cols-2 gap-2 bg-[#F6F8F7] p-2.5 rounded-lg text-xs">
                        <div>
                          <span className="text-[10px] text-secondary block">Quotes Issued</span>
                          <span className="font-semibold text-on-surface font-poppins">{d.totalQuotes} Quotes</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-secondary block">Capacity Sold</span>
                          <span className="font-bold text-on-surface font-poppins">
                            {d.totalCapacityKw >= 1000 ? `${(d.totalCapacityKw / 1000).toFixed(2)} MW` : `${d.totalCapacityKw} kW`}
                          </span>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#F1F4F9]">
                        <span className="font-mono text-[10px] text-secondary truncate max-w-[130px]">
                          GSTIN: {d.gstin ? `${d.gstin.slice(0, 4)}...${d.gstin.slice(-3)}` : 'Verified'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openPricingModal(d)}
                            className="px-2 py-1 text-xs rounded border border-[#E4E7EB] hover:border-amber-500 text-amber-700 hover:bg-amber-50 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Configure Custom Dealer Pricing & Margins"
                          >
                            <span className="material-symbols-outlined text-[15px]">tune</span>
                            <span>{d.pricingConfig?.pricingMode === 'custom' ? `₹${d.pricingConfig.customBaseRatePerWp}/Wp` : 'Pricing'}</span>
                          </button>
                          <button
                            onClick={() => openCredModal(d)}
                            className="px-2 py-1 text-xs rounded border border-[#E4E7EB] hover:border-primary text-[#6CBF3D] hover:bg-[#6CBF3D]/10 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Manage Password & Credentials"
                          >
                            <span className="material-symbols-outlined text-[15px]">key</span>
                            <span>Key</span>
                          </button>
                          <button
                            onClick={() => toggleDealerStatus(d.id)}
                            className={`px-2 py-1 text-xs rounded border border-[#E4E7EB] transition-colors flex items-center gap-1 cursor-pointer ${
                              d.status === 'Active' ? 'text-secondary hover:text-error hover:border-error' : 'text-primary hover:border-primary'
                            }`}
                            title={d.status === 'Active' ? 'Suspend Portal Access' : 'Activate Dealer'}
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {d.status === 'Active' ? 'block' : 'check_circle'}
                            </span>
                            <span>{d.status === 'Active' ? 'Suspend' : 'Activate'}</span>
                          </button>
                          <button
                            onClick={() => handleEditDealer(d)}
                            className="p-1 rounded border border-[#E4E7EB] hover:border-on-surface text-secondary hover:text-[#0F1B2E] transition-colors cursor-pointer"
                            title="Edit Dealer Profile"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDealerToDelete(d)}
                            className="p-1 rounded border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                            title="Delete Dealer Partner"
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
          <div className="overflow-x-auto xl:overflow-x-hidden">
            <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-[#0F1B2E] text-white text-label-xs uppercase tracking-wider h-11 select-none">
                <th className="py-3 px-3.5 font-semibold text-left whitespace-nowrap min-w-[120px]">Dealer ID</th>
                <th className="py-3 px-3.5 font-semibold text-left min-w-[210px]">Dealer / Firm Name</th>
                <th className="py-3 px-3 font-semibold text-left min-w-[130px]">Region &amp; DISCOM</th>
                <th className="py-3 px-3 font-semibold text-left min-w-[150px]">Assigned Salesman</th>
                <th className="py-3 px-3 font-semibold text-left min-w-[135px]">Pricing &amp; Margin</th>
                <th className="py-3 px-3 font-semibold text-right min-w-[95px]">Quotes Issued</th>
                <th className="py-3 px-3 font-semibold text-right min-w-[110px]">Capacity Sold</th>
                <th className="py-3 px-3 font-semibold text-left min-w-[135px]">KYC &amp; GSTIN</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[90px]">Portal Status</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[95px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EB] text-body-sm">
              {paginatedDealers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-secondary">
                    <span className="material-symbols-outlined text-4xl text-secondary/40 block mb-2">search_off</span>
                    No Gujarat dealers match your current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedDealers.map((d) => {
                  const isGold = d.tier.includes('Gold');
                  const isPlat = d.tier.includes('Platinum');
                  const isDiam = d.tier.includes('Diamond');
                  const tierColor = isPlat
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isDiam
                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                    : isGold
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-gray-100 text-gray-800 border-gray-300';
                  const initials = (d.firmName || 'ST').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                  const discomText = (d.discom || '').includes('Circle') ? d.discom : `${d.discom || 'PGVCL'} Circle`;

                  return (
                    <tr key={d.id} className="bg-white hover:bg-[#F0F4F2] transition-colors duration-150 group">
                      <td className="py-4 px-3.5 align-top whitespace-nowrap">
                        <span className="font-mono text-label-xs font-semibold text-[#0F1B2E] bg-surface-container px-2 py-1 rounded inline-block whitespace-nowrap">
                          #{d.id}
                        </span>
                      </td>
                      <td className="py-4 px-3.5 align-top">
                        <div className="flex items-start gap-2.5">
                          {d.avatar ? (
                            <img
                              alt={d.contactPerson}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-[#6CBF3D]/40 shrink-0 mt-0.5"
                              src={d.avatar}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-surface-container-high text-primary font-bold flex items-center justify-center text-xs shrink-0 border border-primary/20 mt-0.5">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            {/* Line 1: Firm Name */}
                            <div className="font-poppins font-semibold text-on-surface group-hover:text-primary transition-colors text-[13px] leading-tight">
                              {d.firmName}
                            </div>
                            {/* Line 2: Contact Person */}
                            <div className="text-[12px] font-medium text-on-surface/90 mt-1 leading-tight">
                              {d.contactPerson}
                            </div>
                            {/* Line 3: Phone & Email */}
                            <div className="text-[11px] text-secondary flex items-center gap-1.5 mt-1 leading-tight flex-wrap font-mono">
                              <span>{d.mobile}</span>
                              <span className="text-outline-variant font-sans">•</span>
                              <span className="truncate max-w-[170px]">{d.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3 align-top">
                        <div className="font-medium text-on-surface text-[13px] leading-tight">{d.city}, Gujarat</div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
                          {discomText}
                        </span>
                      </td>
                      <td className="py-4 px-3 align-top">
                        {d.assignedStaffId === 'STF-DIRECT' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 font-medium text-[11px] shadow-xs">
                            <span className="material-symbols-outlined text-[15px] text-indigo-700" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
                            <span className="font-semibold whitespace-nowrap">Direct HQ</span>
                          </span>
                        ) : (() => {
                          const matchedStaff = (staffList || []).find(s => s.id === d.assignedStaffId);
                          const isLegacy = d.assignedStaffName === 'Jayesh Patel' || d.assignedStaffId === 'STF-001';
                          const staffName = matchedStaff?.name || (!isLegacy && d.assignedStaffName) || salesStaffList[0]?.name || 'Sunvine Sales Staff';
                          const staffId = matchedStaff?.id || (!isLegacy && d.assignedStaffId) || salesStaffList[0]?.id || 'STF-801';
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 border border-primary/20">
                                {staffName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-on-surface text-[12px] truncate leading-tight font-poppins">
                                  {staffName}
                                </div>
                                <div className="text-[10px] text-secondary font-mono mt-0.5">
                                  {staffId}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-4 px-3 align-top">
                        {(() => {
                          const tierKey = (d.tier || '').toLowerCase().includes('diamond') ? 'diamond' :
                                          (d.tier || '').toLowerCase().includes('platinum') ? 'platinum' :
                                          (d.tier || '').toLowerCase().includes('silver') ? 'silver' : 'gold';
                          const conf = tierMargins?.[tierKey] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 };
                          return (
                            <>
                              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tierColor} whitespace-nowrap`}>
                                <span className="material-symbols-outlined text-[13px]">military_tech</span> {d.tier || conf.tierName}
                              </div>
                              {d.pricingConfig?.pricingMode === 'custom' && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[11px]">bolt</span>
                                    Custom: ₹{d.pricingConfig.customBaseRatePerWp}/Wp
                                  </span>
                                </div>
                              )}
                              <div className="text-[11px] text-secondary mt-1 leading-tight">
                                Margin: <strong className="text-on-surface font-semibold whitespace-nowrap">₹{(d.pricingConfig?.pricingMode === 'custom' ? d.pricingConfig.customMarginPerKw : conf.defaultMarginPerKw).toLocaleString('en-IN')}/kW</strong>
                              </div>
                              <div className="text-[10px] text-secondary mt-0.5 leading-tight whitespace-nowrap">
                                Cap: ₹{(d.maxMarginCapPerKw || conf.maxMarginCapPerKw).toLocaleString('en-IN')}/kW
                              </div>
                            </>
                          );
                        })()}
                      </td>
                      <td className="py-4 px-3 text-right align-top">
                        <div className="font-semibold text-on-surface font-poppins text-[13px]">{d.totalQuotes} Quotes</div>
                        <div className="text-[11px] text-[#2E7D32] mt-0.5">Active partner</div>
                      </td>
                      <td className="py-4 px-3 text-right align-top">
                        <div className="font-bold text-on-surface font-poppins text-[13px]">
                          {d.totalCapacityKw >= 1000 ? `${(d.totalCapacityKw / 1000).toFixed(2)} MW` : `${d.totalCapacityKw} kW`}
                        </div>
                        <div className="w-20 ml-auto mt-1.5 bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div className="bg-[#6CBF3D] h-full rounded-full" style={{ width: `${Math.min(100, Math.max(20, (d.totalCapacityKw / 30)))}%` }}></div>
                        </div>
                        <div className="text-[10px] text-secondary mt-0.5">Gujarat Grid</div>
                      </td>
                      <td className="py-4 px-3 align-top">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-on-surface font-medium whitespace-nowrap">
                          <span>{d.gstin || '24AFPFS7402A1Z7'}</span>
                          <span className="material-symbols-outlined text-[14px] text-[#2E7D32]" title="GSTIN Active & Verified">check_circle</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-green-50 text-green-700 font-semibold whitespace-nowrap">PAN OK</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-green-50 text-green-700 font-semibold whitespace-nowrap">Aadhaar e-KYC</span>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-center align-top whitespace-nowrap">
                        <div className={`text-[10px] font-semibold inline-flex items-center gap-1 ${
                          d.status === 'Active' ? 'text-[#2E7D32]' : d.status === 'Pending' ? 'text-amber-700' : 'text-slate-500'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            d.status === 'Active' ? 'bg-[#6CBF3D]' : d.status === 'Pending' ? 'bg-amber-500' : 'bg-slate-400'
                          }`}></span> {d.status}
                        </div>
                      </td>
                      <td className="py-4 px-3 text-center align-top whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openPricingModal(d)}
                            className="w-7 h-7 rounded hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-colors flex items-center justify-center cursor-pointer"
                            title="Configure Custom Dealer Pricing & Margins"
                          >
                            <span className="material-symbols-outlined text-[17px]">tune</span>
                          </button>
                          <button
                            onClick={() => openCredModal(d)}
                            className="w-7 h-7 rounded hover:bg-surface-container text-[#6CBF3D] hover:text-[#4F9A2C] transition-colors flex items-center justify-center cursor-pointer"
                            title="Manage Password & Credentials"
                          >
                            <span className="material-symbols-outlined text-[17px]">key</span>
                          </button>
                          <button
                            onClick={() => toggleDealerStatus(d.id)}
                            className={`w-7 h-7 rounded hover:bg-surface-container transition-colors ${
                              d.status === 'Active' ? 'text-secondary hover:text-error' : 'text-primary hover:text-primary-container'
                            }`}
                            title={d.status === 'Active' ? 'Suspend Portal Access' : 'Activate Dealer'}
                          >
                            <span className="material-symbols-outlined text-[17px]">
                              {d.status === 'Active' ? 'block' : 'check_circle'}
                            </span>
                          </button>
                          <button
                            onClick={() => handleEditDealer(d)}
                            className="w-7 h-7 rounded hover:bg-surface-container text-secondary hover:text-[#0F1B2E] transition-colors cursor-pointer"
                            title="Edit Dealer Profile"
                          >
                            <span className="material-symbols-outlined text-[17px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDealerToDelete(d)}
                            className="w-7 h-7 rounded hover:bg-red-50 text-red-600 transition-colors flex items-center justify-center cursor-pointer"
                            title="Delete Dealer Partner"
                          >
                            <span className="material-symbols-outlined text-[17px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

        {/* Table Footer with real Gujarat pagination */}
        <div className="p-4 border-t border-[#E4E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-secondary font-label-sm text-label-sm">
          <span>
            Showing <span className="font-semibold text-on-surface">{filteredDealers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredDealers.length)}</span> of <span className="font-semibold text-on-surface">{filteredDealers.length}</span> Gujarat entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-[#E4E7EB] text-secondary hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 2 + i;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    currentPage === pageNum ? 'bg-[#0F1B2E] text-white' : 'hover:bg-surface-container text-on-surface'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-[#E4E7EB] text-secondary hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Configure Tier Margins Modal */}
      {showTierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">price_check</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                    Dealer Commission Tiers &amp; Default Margins
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Set default quotation margins and protective ceiling caps across all partner tiers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTierModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-5 space-y-4">
              {[
                { key: 'diamond', name: 'Diamond EPC Partner', desc: 'Premier High-Volume Partners (> 5.0 MW/quarter)', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                { key: 'platinum', name: 'Platinum Tier', desc: 'Tier-1 Large Scale EPC (> 3.0 MW/quarter)', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { key: 'gold', name: 'Gold EPC Partner', desc: 'Established Standard Installers (1.5 - 3.0 MW/quarter)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
                { key: 'silver', name: 'Silver Installer', desc: 'Entry / Regional Empanelled Installers (< 1.5 MW/quarter)', badge: 'bg-slate-100 text-slate-700 border-slate-300' }
              ].map((tier) => {
                const currentConfig = tempTierMargins[tier.key] || tierMargins?.[tier.key] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 };
                return (
                  <div key={tier.key} className="p-4 rounded-xl border border-surface-container-high bg-surface-container-low/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${tier.badge}`}>
                          {tier.name}
                        </span>
                        <span className="text-xs text-secondary hidden sm:inline">{tier.desc}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-on-surface mb-1">
                          Default Commercial Margin (₹/kW)
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-secondary font-bold text-xs">₹</span>
                          <input
                            type="number"
                            value={currentConfig.defaultMarginPerKw}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setTempTierMargins((prev) => ({
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
                          Protective Margin Cap (₹/kW)
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-secondary font-bold text-xs">₹</span>
                          <input
                            type="number"
                            value={currentConfig.maxMarginCapPerKw}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setTempTierMargins((prev) => ({
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

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const hasChanges = Object.keys(tempTierMargins || {}).some(key => {
                    const existing = tierMargins?.[key];
                    const updated = tempTierMargins?.[key];
                    if (!existing || !updated) return true;
                    return Number(existing.defaultMarginPerKw) !== Number(updated.defaultMarginPerKw) ||
                           Number(existing.maxMarginCapPerKw) !== Number(updated.maxMarginCapPerKw);
                  });

                  if (!hasChanges) {
                    if (addToast) {
                      addToast({
                        title: 'No Changes Detected',
                        message: 'Tier default margins are unchanged.',
                        type: 'info'
                      });
                    }
                    setShowTierModal(false);
                    return;
                  }

                  if (updateTierMargins) {
                    updateTierMargins(tempTierMargins);
                  }
                  if (addToast) {
                    addToast({
                      title: 'Tier Margins Updated',
                      message: 'Default tier margins updated successfully.',
                      type: 'success'
                    });
                  }
                  setShowTierModal(false);
                }}
                className="px-5 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Save Tier Margins
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dealer Credentials & Password Modal */}
      {credModalDealer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-surface-container-highest">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">vpn_key</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">Manage Dealer Credentials</h3>
                  <p className="text-xs text-secondary">Set portal login password for partner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCredModalDealer(null)}
                className="w-8 h-8 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="py-4 space-y-4">
              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-highest space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary">Dealer Firm</span>
                  <span className="text-xs font-bold text-on-surface truncate max-w-[200px]">{credModalDealer.firmName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary">Contact Person</span>
                  <span className="text-xs font-semibold text-on-surface">{credModalDealer.contactPerson}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary">Dealer ID</span>
                  <span className="text-xs font-mono font-bold text-primary">{credModalDealer.id}</span>
                </div>
              </div>

              {/* Login Mobile ID field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
                  <span>Registered Mobile (Portal Login ID) <span className="text-error">*</span></span>
                  <span className="text-[10px] text-secondary font-mono">10 digits</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px]">phone</span>
                  <input
                    type="tel"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full h-10 pl-9 pr-3 bg-white border border-surface-container-highest rounded-lg font-mono text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="9825012345"
                  />
                </div>
              </div>

              {/* Official Email field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface">Official Business Email</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px]">mail</span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-white border border-surface-container-highest rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="dealer@example.com"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-on-surface">Portal Password <span className="text-error">*</span></label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = generateRandomPassword();
                      setEditPassword(rand);
                    }}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">refresh</span>
                    Auto-Generate
                  </button>
                </div>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px]">lock</span>
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full h-10 pl-9 pr-10 bg-white border border-surface-container-highest rounded-lg font-mono text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 text-secondary hover:text-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showEditPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="text-[11px] text-secondary">
                  Login requires this Mobile Number and Password. Changes sync directly to PostgreSQL ledger.
                </p>
              </div>

              {credSavedNotice && (
                <div className="p-2.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                  <span>Credentials updated successfully!</span>
                </div>
              )}

              {/* Copy credentials helper */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = String(editMobile || credModalDealer.mobile).replace(/\D/g, '').slice(-10);
                    const text = `Sunvine Dealer Portal Credentials:\nPortal: https://sunvine-dealer.vprotech.online\nMobile: ${cleanPhone}\nEmail: ${editEmail || credModalDealer.email}\nPassword: ${editPassword}`;
                    navigator.clipboard.writeText(text);
                    setCopiedCreds(true);
                    setTimeout(() => setCopiedCreds(false), 3000);
                  }}
                  className="w-full py-2 px-3 rounded-lg border border-surface-container-highest hover:bg-surface-container-low text-xs font-semibold text-secondary hover:text-on-surface flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">{copiedCreds ? 'done' : 'content_copy'}</span>
                  <span>{copiedCreds ? 'Credentials Copied to Clipboard!' : 'Copy Login Details to Clipboard'}</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-surface-container-highest">
              <button
                type="button"
                onClick={() => {
                  const toDel = credModalDealer;
                  setCredModalDealer(null);
                  setDealerToDelete(toDel);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1 border border-red-200 cursor-pointer transition-colors"
                title="Delete this dealer partner completely"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                <span>Delete Dealer</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCredModalDealer(null)}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest text-xs font-semibold text-secondary hover:bg-surface-container-low cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveDealerCredentials}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-[#4F9A2C] text-on-primary text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Credentials</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DEALER CUSTOM PRICING & MARGINS CONFIGURATION */}
      {pricingModalDealer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-container-high rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto text-on-surface">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-surface-container-high pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    #{pricingModalDealer.id}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-surface-container-high text-secondary">
                    {pricingModalDealer.tier || 'Gold Partner'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-on-surface mt-1.5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600">tune</span>
                  <span>Custom Dealer Pricing &amp; Margin Configuration</span>
                </h2>
                <p className="text-xs text-secondary mt-0.5">
                  <strong>{pricingModalDealer.firmName}</strong> ({pricingModalDealer.contactPerson}, {pricingModalDealer.city})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPricingModalDealer(null)}
                className="text-secondary hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-surface-container-low rounded-xl border border-surface-container-high">
              <button
                type="button"
                onClick={() => setPricingMode('standard')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  pricingMode === 'standard'
                    ? 'bg-surface text-primary shadow-xs border border-primary/30'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">military_tech</span>
                <span>Standard Tier Pricing</span>
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('custom')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  pricingMode === 'custom'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                <span>Custom Negotiated Rate</span>
              </button>
            </div>

            {pricingMode === 'standard' ? (
              <div className="p-4 bg-surface-container-low border border-surface-container-high rounded-xl text-xs space-y-2 text-secondary">
                <p className="font-semibold text-on-surface">
                  This dealer is currently using <strong>Standard Tier Pricing</strong> ({pricingModalDealer.tier || 'Gold'}).
                </p>
                <p>
                  Turnkey base rate and margin defaults will follow the global master configuration for this partner tier.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <p className="font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Custom Dealer Pricing Active
                  </p>
                  <p className="mt-0.5 text-amber-800">
                    When this dealer generates quotations (or when office staff creates quotations for this dealer), the specific rates configured below will automatically apply instead of standard presets.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Custom Rate per Wp */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Custom Panel Rate per Wp (₹/Wp) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-secondary text-xs font-bold">₹</span>
                      <input
                        type="number"
                        step="0.05"
                        min="10"
                        max="35"
                        value={customWpRate}
                        onChange={(e) => setCustomWpRate(e.target.value)}
                        className="w-full bg-surface border border-surface-container-high rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                        placeholder="18.00"
                      />
                    </div>
                    <span className="text-[11px] text-secondary mt-1 block">Catalog baseline: ₹18.00/Wp</span>
                  </div>

                  {/* Custom Base Rate per kW */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Custom Turnkey Rate per kW (₹/kW) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-secondary text-xs font-bold">₹</span>
                      <input
                        type="number"
                        step="500"
                        min="20000"
                        max="90000"
                        value={customKwRate}
                        onChange={(e) => setCustomKwRate(e.target.value)}
                        className="w-full bg-surface border border-surface-container-high rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                        placeholder="58000"
                      />
                    </div>
                    <span className="text-[11px] text-secondary mt-1 block">Company baseline: ₹59,800/kW</span>
                  </div>

                  {/* Custom Dealer Margin per kW */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Custom Margin per kW (₹/kW)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-secondary text-xs font-bold">₹</span>
                      <input
                        type="number"
                        step="250"
                        min="0"
                        max="15000"
                        value={customMarginKw}
                        onChange={(e) => setCustomMarginKw(e.target.value)}
                        className="w-full bg-surface border border-surface-container-high rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                        placeholder="4500"
                      />
                    </div>
                    <span className="text-[11px] text-secondary mt-1 block">Tier baseline: ₹4,500/kW</span>
                  </div>

                  {/* Negotiated Discount */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Special Dealer Discount (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="20"
                        value={customDiscount}
                        onChange={(e) => setCustomDiscount(e.target.value)}
                        className="w-full bg-surface border border-surface-container-high rounded-lg px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-secondary text-xs font-bold">%</span>
                    </div>
                    <span className="text-[11px] text-secondary mt-1 block">Applicable on gross project turnkey</span>
                  </div>
                </div>

                {/* Commercial Notes */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Commercial Agreement Notes &amp; Terms
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g. Approved by Director for Saurashtra territory quarterly commitment of 2.5 MW."
                    className="w-full bg-surface border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Live Simulation Card */}
                <div className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl space-y-2">
                  <span className="text-xs font-bold text-on-surface block">
                    ⚡ Live Rate Simulation for {pricingModalDealer.firmName}:
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 bg-surface rounded-lg border border-surface-container-high text-center">
                      <span className="text-secondary block font-medium">3.30 kW (6 Panels)</span>
                      <strong className="text-primary font-bold block mt-0.5">
                        ₹{Math.round((Number(customKwRate) || 58000) * 3.3).toLocaleString('en-IN')}
                      </strong>
                      <span className="text-[10px] text-secondary">
                        Panel: ₹{Math.round(550 * 6 * (Number(customWpRate) || 18)).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-2 bg-surface rounded-lg border border-surface-container-high text-center">
                      <span className="text-secondary block font-medium">4.40 kW (8 Panels)</span>
                      <strong className="text-primary font-bold block mt-0.5">
                        ₹{Math.round((Number(customKwRate) || 58000) * 4.4).toLocaleString('en-IN')}
                      </strong>
                      <span className="text-[10px] text-secondary">
                        Panel: ₹{Math.round(550 * 8 * (Number(customWpRate) || 18)).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-2 bg-surface rounded-lg border border-surface-container-high text-center">
                      <span className="text-secondary block font-medium">6.00 kW (10 Panels)</span>
                      <strong className="text-primary font-bold block mt-0.5">
                        ₹{Math.round((Number(customKwRate) || 58000) * 6.0).toLocaleString('en-IN')}
                      </strong>
                      <span className="text-[10px] text-secondary">
                        Panel: ₹{Math.round(600 * 10 * (Number(customWpRate) || 18)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setPricingModalDealer(null)}
                className="px-4 py-2 rounded-lg border border-surface-container-high text-xs font-semibold text-secondary hover:bg-surface-container-low cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDealerPricing}
                className="px-5 py-2 rounded-lg bg-primary hover:bg-[#4F9A2C] text-on-primary text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Save Dealer Pricing</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DEALER MODAL */}
      {dealerToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-red-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-on-surface animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-on-surface">Delete Dealer Partner?</h3>
              <p className="text-xs text-secondary mt-1">
                Are you sure you want to permanently delete <strong className="text-on-surface">{dealerToDelete.firmName}</strong> ({dealerToDelete.id})? Their portal access and login credentials will be removed.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDealerToDelete(null)}
                className="px-4 py-2 rounded-lg border border-surface-container-high text-xs font-semibold text-secondary hover:bg-surface-container-low cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDealer}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
