import React, { useState, useEffect, useMemo, startTransition } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { adminAccountService } from '../../services/adminAccountService';
import { pushNotificationService } from '../../services/pushNotificationService';

export default function AdminSettings() {
  const { addToast } = useToast();
  const {
    currentAdmin,
    setStaffList,
    setDealers,
    masterDocRegistry,
    categoryDocRules,
    addMasterDocument,
    updateMasterDocument,
    deleteMasterDocument,
    updateCategoryDocRule,
    resetDocumentRulesToDefault,
    refreshMasterDocuments,
    applicationCategories
  } = useApp();

  const VALID_SETTINGS_TABS = ['account_center', 'document_rules', 'security', 'system'];
  const VALID_CATEGORIES = ['RESIDENTIAL', 'BANK_LOAN', 'NBFC_LOAN', 'COMMERCIAL', 'HOUSING_SOCIETY'];

  // Primary Settings Page Tabs: 'account_center' | 'document_rules' | 'security' | 'system'
  const [settingsTab, setSettingsTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') || params.get('subtab') || params.get('section');
      if (VALID_SETTINGS_TABS.includes(tabParam)) {
        return tabParam;
      }
    }
    return 'account_center';
  });

  // Account Center Sub-Tabs: 'admins' | 'dealers' | 'staff'
  const [accountSubTab, setAccountSubTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const subParam = params.get('accountTab');
      if (['admins', 'dealers', 'staff'].includes(subParam)) {
        return subParam;
      }
    }
    return 'admins';
  });

  // Document Rules Tab State
  const [isSyncingDocs, setIsSyncingDocs] = useState(false);

  // OS Push Notifications Console State
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('default');

  useEffect(() => {
    if (pushNotificationService.isPushSupported()) {
      pushNotificationService.isSubscribed().then(setIsPushSubscribed);
      setPermissionState(pushNotificationService.getPermissionState());
    }
  }, []);

  const handleToggleAdminPush = async () => {
    setIsPushLoading(true);
    try {
      if (isPushSubscribed) {
        await pushNotificationService.unsubscribeUser();
        setIsPushSubscribed(false);
        setPermissionState(pushNotificationService.getPermissionState());
        addToast('OS Push notifications disabled on this device', 'info');
      } else {
        const res = await pushNotificationService.subscribeUser({
          userId: currentAdmin?.id || 'admin',
          role: 'admin'
        });
        if (res.success) {
          setIsPushSubscribed(true);
          setPermissionState('granted');
          addToast('OS Push notifications enabled successfully for Admin!', 'success');
        } else {
          addToast(res.error || 'Failed to enable push notifications', 'error');
        }
      }
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleSendAdminTestPush = async () => {
    setIsPushLoading(true);
    try {
      const res = await pushNotificationService.sendTestPush({
        targetUserId: 'admin',
        role: 'admin'
      });
      if (res.success) {
        addToast(`Admin test push sent! (${res.sentCount || 0} device notified)`, 'success');
      } else {
        addToast(res.error || 'Could not send test push', 'error');
      }
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setIsPushLoading(false);
    }
  };

  // Document Rules Tab State (URL Synchronized)
  const [selectedCategoryRule, setSelectedCategoryRule] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const catParam = params.get('category');
      if (VALID_CATEGORIES.includes(catParam)) {
        return catParam;
      }
    }
    return 'RESIDENTIAL';
  });

  // Keep URL query params synchronized so page refreshes maintain exact tab & category view
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', settingsTab);
      if (settingsTab === 'document_rules') {
        params.set('category', selectedCategoryRule);
      } else {
        params.delete('category');
      }
      if (settingsTab === 'account_center') {
        params.set('accountTab', accountSubTab);
      } else {
        params.delete('accountTab');
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [settingsTab, selectedCategoryRule, accountSubTab]);

  // Back/Forward browser history listener
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab') || params.get('subtab') || params.get('section');
        if (VALID_SETTINGS_TABS.includes(tabParam)) {
          setSettingsTab(tabParam);
        }
        const catParam = params.get('category');
        if (VALID_CATEGORIES.includes(catParam)) {
          setSelectedCategoryRule(catParam);
        }
        const accParam = params.get('accountTab');
        if (['admins', 'dealers', 'staff'].includes(accParam)) {
          setAccountSubTab(accParam);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);
  const [docForm, setDocForm] = useState({
    key: '',
    label: '',
    category: 'Applicant KYC',
    description: '',
    icon: 'description',
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
  });
  const [deleteDocModal, setDeleteDocModal] = useState(null);

  // Helper to convert document title into clean camelCase key (e.g., 'Property Tax Receipt' -> 'propertyTaxReceipt')
  const formatDocumentKey = (title) => {
    if (!title) return '';
    const words = title
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .trim()
      .split(/[\s_-]+/);
    if (words.length === 0 || !words[0]) return '';
    return words
      .map((w, idx) => {
        if (idx === 0) return w.toLowerCase();
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join('');
  };

  // Live Accounts State from PostgreSQL
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [adminsList, setAdminsList] = useState([]);
  const [dealersList, setDealersList] = useState([]);
  const [staffListState, setStaffListState] = useState([]);

  // Filters & Search
  const [staffFilter, setStaffFilter] = useState('all'); // 'all' | 'sales' | 'verification'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    role: 'admin',
    password: ''
  });

  const [showDealerModal, setShowDealerModal] = useState(false);
  const [editingDealer, setEditingDealer] = useState(null);
  const [dealerForm, setDealerForm] = useState({
    id: '',
    dealerCode: '',
    firmName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    city: 'Ahmedabad',
    state: 'Gujarat',
    discom: 'UGVCL',
    tier: 'Gold EPC',
    maxMarginCapPerKw: 6000,
    status: 'Active',
    password: '',
    assignedStaffId: 'STF-DIRECT',
    assignedStaffName: 'Direct to Company (HQ Desk)'
  });

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    department: 'Sales',
    role: 'Senior Solar Field Executive',
    status: 'Active',
    password: ''
  });

  // Password Update Modal
  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    accountType: '', // 'admin' | 'dealer' | 'staff'
    account: null,
    newPassword: '',
    confirmPassword: '',
    showPass: false
  });

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    accountType: '', // 'admin' | 'dealer' | 'staff'
    account: null
  });

  const [submitting, setSubmitting] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(''), 4500);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  // Fetch live accounts from PostgreSQL
  const loadAccounts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const data = await adminAccountService.fetchAccounts();
      setAdminsList(data.admins || []);
      setDealersList(data.dealers || []);
      setStaffListState(data.staff || []);

      if (typeof setStaffList === 'function' && Array.isArray(data.staff)) {
        setStaffList(data.staff);
      }
      if (typeof setDealers === 'function' && Array.isArray(data.dealers)) {
        setDealers(data.dealers.map(d => ({
          ...d,
          mobile: d.mobile_number || d.mobile,
          firmName: d.firm_name || d.firmName,
          contactPerson: d.contact_person || d.contactPerson
        })));
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to PostgreSQL database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Filtered lists
  const filteredAdmins = useMemo(() => {
    if (!searchQuery.trim()) return adminsList;
    const q = searchQuery.toLowerCase();
    return adminsList.filter(a =>
      (a.full_name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.mobile_number || '').includes(q)
    );
  }, [adminsList, searchQuery]);

  const filteredDealers = useMemo(() => {
    if (!searchQuery.trim()) return dealersList;
    const q = searchQuery.toLowerCase();
    return dealersList.filter(d =>
      (d.firm_name || d.firmName || '').toLowerCase().includes(q) ||
      (d.contact_person || d.contactPerson || '').toLowerCase().includes(q) ||
      (d.mobile_number || d.mobile || '').includes(q) ||
      (d.dealer_code || d.dealerCode || '').toLowerCase().includes(q)
    );
  }, [dealersList, searchQuery]);

  const filteredStaff = useMemo(() => {
    return staffListState.filter(s => {
      const isVer = (s.department || '').toLowerCase().includes('verification') || (s.role || '').toLowerCase().includes('verification');
      const matchesFilter =
        staffFilter === 'all'
          ? true
          : staffFilter === 'verification'
          ? isVer
          : !isVer;

      if (!matchesFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q)
      );
    });
  }, [staffListState, staffFilter, searchQuery]);

  const CATEGORY_TABS = [
    { key: 'RESIDENTIAL', label: 'Residential Cash', icon: 'home', badge: 'PM Surya Ghar', desc: 'Direct consumer cash rooftop projects' },
    { key: 'BANK_LOAN', label: 'Nationalized Bank Loan', icon: 'account_balance', badge: 'PSB Solar Loan', desc: 'SBI, PNB, Canara, BoB PM Surya Ghar bank loans' },
    { key: 'NBFC_LOAN', label: 'NBFC / FinTech Loan', icon: 'credit_card', badge: 'FinTech Credit', desc: 'Ecofy, Credit Fair, Metafin digital loan files' },
    { key: 'COMMERCIAL', label: 'Commercial & Industrial', icon: 'factory', badge: 'C&I Projects', desc: 'Commercial solar, factory & industrial rooftop 10kW-500kW' },
    { key: 'HOUSING_SOCIETY', label: 'Housing Society', icon: 'apartment', badge: 'Common Meter', desc: 'Residential societies, RWA, apartment common meters' }
  ];

  const DOC_CATEGORY_GROUPS = [
    'Applicant KYC',
    'Bank & Financial',
    'Utility & Property',
    'Technical & Approvals',
    'Co-Applicant KYC',
    'Commercial & Legal',
    'General'
  ];

  const DOC_ICONS = [
    'description', 'badge', 'account_balance', 'bolt', 'receipt_long',
    'photo_camera', 'contract', 'factory', 'apartment', 'verified',
    'shield', 'folder', 'assignment', 'domain'
  ];

  const [showResetRulesModal, setShowResetRulesModal] = useState(false);

  // Stable display order per category tab: sorts active (Mandatory -> Optional) first on initial page load / tab switch,
  // preventing disorienting in-place card jumping while user clicks toggle buttons.
  const initialCategoryOrder = useMemo(() => {
    const list = masterDocRegistry || [];
    const rules = categoryDocRules?.[selectedCategoryRule] || {};

    const RULE_PRIORITY = {
      mandatory: 1,
      optional: 2,
      disabled: 3
    };

    const sorted = [...list].sort((a, b) => {
      const ruleA = rules[a.key] || 'mandatory';
      const ruleB = rules[b.key] || 'mandatory';
      const rankA = RULE_PRIORITY[ruleA] ?? 2;
      const rankB = RULE_PRIORITY[ruleB] ?? 2;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (a.label || '').localeCompare(b.label || '');
    });

    const orderMap = {};
    sorted.forEach((doc, idx) => {
      orderMap[doc.key] = idx;
    });
    return orderMap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryRule, masterDocRegistry]);

  // Document Rules Memos - Stable order during live edits, active cards first on page refresh / tab switch
  const filteredMasterDocs = useMemo(() => {
    const list = masterDocRegistry || [];

    let filtered = list;
    if (docSearchQuery.trim()) {
      const q = docSearchQuery.toLowerCase();
      filtered = list.filter(d =>
        (d.label || '').toLowerCase().includes(q) ||
        (d.key || '').toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      const posA = initialCategoryOrder[a.key] ?? 999;
      const posB = initialCategoryOrder[b.key] ?? 999;
      if (posA !== posB) return posA - posB;
      return (a.label || '').localeCompare(b.label || '');
    });
  }, [masterDocRegistry, initialCategoryOrder, docSearchQuery]);

  const currentCategoryStats = useMemo(() => {
    const rules = categoryDocRules?.[selectedCategoryRule] || {};
    let mandatory = 0;
    let optional = 0;
    let disabled = 0;
    (masterDocRegistry || []).forEach(doc => {
      const status = rules[doc.key] || 'mandatory';
      if (status === 'mandatory') mandatory++;
      else if (status === 'optional') optional++;
      else if (status === 'disabled') disabled++;
    });
    return { mandatory, optional, disabled, total: (masterDocRegistry || []).length };
  }, [masterDocRegistry, categoryDocRules, selectedCategoryRule]);

  // Admin Modal Handlers
  const handleOpenAddAdmin = () => {
    setEditingAdmin(null);
    setAdminForm({
      fullName: '',
      email: '',
      mobileNumber: '',
      role: 'admin',
      password: ''
    });
    setError('');
    setShowAdminModal(true);
  };

  const handleOpenEditAdmin = (admin) => {
    setEditingAdmin(admin);
    setAdminForm({
      fullName: admin.full_name || '',
      email: admin.email || '',
      mobileNumber: admin.mobile_number || '',
      role: admin.role || 'admin',
      password: ''
    });
    setError('');
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.fullName.trim() || !adminForm.email.trim()) {
      setError('Full Name and Email are required.');
      return;
    }
    const cleanMobile = adminForm.mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      setError('Valid 10-digit mobile number is required.');
      return;
    }
    if (!editingAdmin && !adminForm.password.trim()) {
      setError('Password is required for new admin account.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (editingAdmin) {
        const res = await adminAccountService.updateAdmin({
          id: editingAdmin.id,
          fullName: adminForm.fullName,
          email: adminForm.email,
          mobileNumber: cleanMobile,
          role: adminForm.role,
          password: adminForm.password ? adminForm.password.trim() : undefined
        });
        if (!res.success) throw new Error(res.error || 'Failed to update admin');
        setSuccessToast(`Admin ${adminForm.fullName} updated in live database.`);
      } else {
        const res = await adminAccountService.createAdmin({
          fullName: adminForm.fullName,
          email: adminForm.email,
          mobileNumber: cleanMobile,
          role: adminForm.role,
          password: adminForm.password.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to create admin');
        setSuccessToast(`Admin ${adminForm.fullName} created in live database.`);
      }

      setShowAdminModal(false);
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dealer Modal Handlers
  const handleOpenAddDealer = () => {
    setEditingDealer(null);
    const existingNums = (dealersList || [])
      .map(d => {
        const codeStr = String(d?.dealer_code || d?.dealerCode || (String(d?.id || '').startsWith('SV-DLR') ? d.id : ''));
        const match = codeStr.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(n => n !== null && !isNaN(n) && n > 0 && n < 100000);
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 800;
    const nextNum = maxNum + 1;
    const nextCode = `SV-DLR-${String(nextNum).padStart(4, '0')}`;
    setDealerForm({
      id: nextCode,
      dealerCode: nextCode,
      firmName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      city: 'Ahmedabad',
      state: 'Gujarat',
      discom: 'UGVCL',
      tier: 'Gold EPC',
      maxMarginCapPerKw: 6000,
      status: 'Active',
      password: '',
      assignedStaffId: 'STF-DIRECT',
      assignedStaffName: 'Direct to Company (HQ Desk)'
    });
    setError('');
    setShowDealerModal(true);
  };

  const handleOpenEditDealer = (dealer) => {
    setEditingDealer(dealer);
    setDealerForm({
      id: dealer.id || dealer.dealer_code,
      dealerCode: dealer.dealer_code || dealer.dealerCode || dealer.id,
      firmName: dealer.firm_name || dealer.firmName || '',
      contactPerson: dealer.contact_person || dealer.contactPerson || '',
      mobile: dealer.mobile_number || dealer.mobile || '',
      email: dealer.email || '',
      city: dealer.city || 'Ahmedabad',
      state: dealer.state || 'Gujarat',
      discom: dealer.discom || 'UGVCL',
      tier: dealer.tier || 'Gold EPC',
      maxMarginCapPerKw: dealer.max_margin_cap_per_kw || dealer.maxMarginCapPerKw || 6000,
      status: dealer.status || 'Active',
      password: '',
      assignedStaffId: dealer.assigned_staff_id || dealer.assignedStaffId || 'STF-DIRECT',
      assignedStaffName: dealer.assigned_staff_name || dealer.assignedStaffName || 'Direct to Company (HQ Desk)'
    });
    setError('');
    setShowDealerModal(true);
  };

  const handleSaveDealer = async (e) => {
    e.preventDefault();
    if (!dealerForm.firmName.trim() || !dealerForm.contactPerson.trim()) {
      setError('Firm Name and Contact Person are required.');
      return;
    }
    const cleanMobile = dealerForm.mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      setError('Valid 10-digit mobile number is required.');
      return;
    }
    const cleanEmail = (dealerForm.email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cleanEmail && !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. partner@example.com) or leave it empty.');
      return;
    }
    if (!editingDealer && !dealerForm.password.trim()) {
      setError('Initial password is required for new dealer.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (editingDealer) {
        const res = await adminAccountService.updateDealer({
          id: editingDealer.id,
          dealerCode: dealerForm.dealerCode,
          firmName: dealerForm.firmName,
          contactPerson: dealerForm.contactPerson,
          mobile: cleanMobile,
          email: dealerForm.email && dealerForm.email.trim() ? dealerForm.email.trim() : null,
          city: dealerForm.city,
          state: dealerForm.state,
          discom: dealerForm.discom,
          tier: dealerForm.tier,
          maxMarginCapPerKw: Number(dealerForm.maxMarginCapPerKw) || 6000,
          status: dealerForm.status,
          password: dealerForm.password ? dealerForm.password.trim() : undefined,
          assignedStaffId: dealerForm.assignedStaffId || 'STF-DIRECT',
          assignedStaffName: dealerForm.assignedStaffName || 'Direct to Company (HQ Desk)'
        });
        if (!res.success) throw new Error(res.error || 'Failed to update dealer');
        setSuccessToast(`Dealer ${dealerForm.firmName} updated in live database.`);
      } else {
        const res = await adminAccountService.createDealer({
          dealerCode: dealerForm.dealerCode,
          firmName: dealerForm.firmName,
          contactPerson: dealerForm.contactPerson,
          mobile: cleanMobile,
          email: dealerForm.email && dealerForm.email.trim() ? dealerForm.email.trim() : null,
          city: dealerForm.city,
          state: dealerForm.state,
          discom: dealerForm.discom,
          tier: dealerForm.tier,
          maxMarginCapPerKw: Number(dealerForm.maxMarginCapPerKw) || 6000,
          status: dealerForm.status,
          password: dealerForm.password.trim(),
          assignedStaffId: dealerForm.assignedStaffId || 'STF-DIRECT',
          assignedStaffName: dealerForm.assignedStaffName || 'Direct to Company (HQ Desk)'
        });
        if (!res.success) throw new Error(res.error || 'Failed to create dealer');
        setSuccessToast(`Dealer ${dealerForm.firmName} created in live database.`);
      }

      setShowDealerModal(false);
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Staff Modal Handlers
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    const existingNums = (staffListState || [])
      .map(s => {
        const codeStr = String(s?.id || s?.staffId || '');
        const match = codeStr.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(n => n !== null && !isNaN(n) && n > 0 && n < 100000);
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 805;
    const nextCode = `STF-${String(maxNum + 1).padStart(3, '0')}`;
    setStaffForm({
      id: nextCode,
      name: '',
      phone: '',
      email: '',
      department: 'Sales',
      role: 'Senior Solar Field Executive',
      status: 'Active',
      password: ''
    });
    setError('');
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (staff) => {
    setEditingStaff(staff);
    const isVer = (staff.department || '').toLowerCase().includes('verification') || (staff.role || '').toLowerCase().includes('verification');
    setStaffForm({
      id: staff.id,
      name: staff.name || '',
      phone: staff.phone || '',
      email: staff.email || '',
      department: isVer ? 'Verification' : 'Sales',
      role: staff.role || (isVer ? 'Field Verification Officer' : 'Senior Solar Field Executive'),
      status: staff.status || 'Active',
      password: ''
    });
    setError('');
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.name.trim()) {
      setError('Staff Name is required.');
      return;
    }
    const cleanPhone = staffForm.phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setError('Valid 10-digit mobile number is required.');
      return;
    }
    if (!editingStaff && !staffForm.password.trim()) {
      setError('Password is required for new staff account.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (editingStaff) {
        const res = await adminAccountService.updateStaff({
          id: editingStaff.id,
          name: staffForm.name,
          phone: cleanPhone,
          email: staffForm.email || `${cleanPhone}@sunvine.in`,
          department: staffForm.department,
          role: staffForm.role,
          status: staffForm.status,
          password: staffForm.password ? staffForm.password.trim() : undefined
        });
        if (!res.success) throw new Error(res.error || 'Failed to update staff');
        setSuccessToast(`Staff ${staffForm.name} updated in live database.`);
      } else {
        const res = await adminAccountService.createStaff({
          id: staffForm.id,
          name: staffForm.name,
          phone: cleanPhone,
          email: staffForm.email || `${cleanPhone}@sunvine.in`,
          department: staffForm.department,
          role: staffForm.role,
          status: staffForm.status,
          password: staffForm.password.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to create staff');
        setSuccessToast(`Staff ${staffForm.name} created in live database.`);
      }

      setShowStaffModal(false);
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Password Reset Handlers
  const handleOpenPasswordModal = (type, account) => {
    setPasswordModal({
      isOpen: true,
      accountType: type,
      account,
      newPassword: '',
      confirmPassword: '',
      showPass: false
    });
    setError('');
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!passwordModal.newPassword.trim()) {
      setError('Password cannot be empty.');
      return;
    }
    if (passwordModal.newPassword !== passwordModal.confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (passwordModal.accountType === 'admin') {
        const res = await adminAccountService.updateAdmin({
          id: passwordModal.account.id,
          password: passwordModal.newPassword.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to update admin password.');
        setSuccessToast(`Password updated for Admin ${passwordModal.account.full_name} in live database.`);
      } else if (passwordModal.accountType === 'dealer') {
        const res = await adminAccountService.updateDealer({
          id: passwordModal.account.id,
          dealerCode: passwordModal.account.dealer_code || passwordModal.account.dealerCode,
          password: passwordModal.newPassword.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to update dealer password.');
        setSuccessToast(`Password updated for Dealer ${passwordModal.account.firm_name || passwordModal.account.firmName} in live database.`);
      } else {
        const res = await adminAccountService.updateStaff({
          id: passwordModal.account.id,
          password: passwordModal.newPassword.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to update staff password.');
        setSuccessToast(`Password updated for Staff ${passwordModal.account.name} in live database.`);
      }

      setPasswordModal({ isOpen: false, accountType: '', account: null, newPassword: '', confirmPassword: '', showPass: false });
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Password update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handlers
  const handleOpenDelete = (type, account) => {
    if (type === 'admin' && adminsList.length <= 1) {
      setError('Cannot delete the only remaining admin account.');
      return;
    }
    setDeleteModal({
      isOpen: true,
      accountType: type,
      account
    });
    setError('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.account) return;
    setSubmitting(true);
    setError('');

    try {
      if (deleteModal.accountType === 'admin') {
        const res = await adminAccountService.deleteAdmin(deleteModal.account.id);
        if (!res.success) throw new Error(res.error || 'Failed to delete admin');
        setSuccessToast(`Admin ${deleteModal.account.full_name} removed from live database.`);
      } else if (deleteModal.accountType === 'dealer') {
        const targetId = deleteModal.account.dealer_code || deleteModal.account.dealerCode || deleteModal.account.id;
        const res = await adminAccountService.deleteDealer(targetId);
        if (!res.success) throw new Error(res.error || 'Failed to delete dealer');
        setSuccessToast(`Dealer ${deleteModal.account.firm_name || deleteModal.account.firmName} removed from live database.`);
      } else {
        const res = await adminAccountService.deleteStaff(deleteModal.account.id);
        if (!res.success) throw new Error(res.error || 'Failed to delete staff');
        setSuccessToast(`Staff ${deleteModal.account.name} removed from live database.`);
      }

      setDeleteModal({ isOpen: false, accountType: '', account: null });
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Deletion failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Document Master Handlers
  const handleSyncDocs = async () => {
    setIsSyncingDocs(true);
    try {
      await refreshMasterDocuments?.();
      setSuccessToast('Document Master & Category Rules synced with live database.');
    } catch (err) {
      setError(err?.message || 'Failed to sync with live database.');
    } finally {
      setIsSyncingDocs(false);
    }
  };

  const handleOpenAddDoc = () => {
    setEditingDoc(null);
    setIsKeyManuallyEdited(false);
    setDocForm({
      key: '',
      label: '',
      category: 'Applicant KYC',
      description: '',
      icon: 'description',
      allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
    });
    setError('');
    setShowDocModal(true);
  };

  const handleOpenEditDoc = (doc) => {
    setEditingDoc(doc);
    setIsKeyManuallyEdited(true);
    setDocForm({
      key: doc.key,
      label: doc.label,
      category: doc.category || 'Applicant KYC',
      description: doc.description || '',
      icon: doc.icon || 'description',
      allowedExtensions: doc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
    });
    setError('');
    setShowDocModal(true);
  };

  const handleSaveDoc = (e) => {
    e.preventDefault();
    if (!docForm.label.trim()) {
      setError('Please provide a document title.');
      return;
    }

    const cleanKey = editingDoc
      ? editingDoc.key
      : (docForm.key.trim() || docForm.label.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, ''));

    if (!cleanKey) {
      setError('Invalid document key.');
      return;
    }

    if (editingDoc) {
      updateMasterDocument(cleanKey, {
        label: docForm.label.trim(),
        category: docForm.category,
        description: docForm.description.trim(),
        icon: docForm.icon,
        allowedExtensions: docForm.allowedExtensions
      });
      setSuccessToast(`Document "${docForm.label}" updated successfully.`);
    } else {
      addMasterDocument({
        key: cleanKey,
        label: docForm.label.trim(),
        category: docForm.category,
        description: docForm.description.trim(),
        icon: docForm.icon,
        allowedExtensions: docForm.allowedExtensions
      });
      setSuccessToast(`New document type "${docForm.label}" registered.`);
    }

    setShowDocModal(false);
  };

  const handleConfirmDeleteDoc = () => {
    if (!deleteDocModal) return;
    deleteMasterDocument(deleteDocModal.key);
    setSuccessToast(`Document type "${deleteDocModal.label}" removed from master registry.`);
    setDeleteDocModal(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl transition-all animate-bounce">
          <span className="material-symbols-outlined text-white text-xl">check_circle</span>
          <p className="text-sm font-semibold">{successToast}</p>
          <button
            onClick={() => setSuccessToast('')}
            className="text-emerald-100 hover:text-white cursor-pointer ml-2"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span>Admin Console</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 tracking-tight">
            Settings &amp; Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure system settings, dynamic document requirements, security, and live database credentials.
          </p>
        </div>

        {/* Status Chip & Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>PostgreSQL Live Sync</span>
          </div>

          <button
            onClick={() => loadAccounts(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Reload live records from database"
          >
            <span className={`material-symbols-outlined text-sm text-slate-500 ${refreshing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{refreshing ? 'Syncing...' : 'Sync Live DB'}</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-600">error</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800 cursor-pointer">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ========================================================
          PRIMARY SETTINGS TABS
          ======================================================== */}
      <div className="border-b border-slate-200 flex items-center gap-1 sm:gap-2 flex-wrap">
        <button
          onClick={() => startTransition(() => setSettingsTab('account_center'))}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            settingsTab === 'account_center'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">manage_accounts</span>
          <span>Account Center</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-bold ml-1">
            {adminsList.length + dealersList.length + staffListState.length}
          </span>
        </button>

        <button
          onClick={() => startTransition(() => setSettingsTab('document_rules'))}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            settingsTab === 'document_rules'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">folder_managed</span>
          <span>Document Master &amp; Rules</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-bold ml-1">
            {(masterDocRegistry || []).length}
          </span>
        </button>

        <button
          onClick={() => startTransition(() => setSettingsTab('security'))}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            settingsTab === 'security'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">security</span>
          <span>Security &amp; Policies</span>
        </button>

        <button
          onClick={() => startTransition(() => setSettingsTab('system'))}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            settingsTab === 'system'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">tune</span>
          <span>System &amp; Presets</span>
        </button>
      </div>

      {/* ========================================================
          TAB CONTENT: 1. ACCOUNT CENTER (Live Database Management)
          ======================================================== */}
      {settingsTab === 'account_center' && (
        <div className="space-y-6">
          {/* Key Metric Highlights in Clean Enterprise Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setAccountSubTab('admins')}
              className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                accountSubTab === 'admins'
                  ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admins</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{adminsList.length}</div>
                  <div className="text-xs text-purple-700 font-medium mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified_user</span>
                    HO System Authority
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setAccountSubTab('dealers')}
              className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                accountSubTab === 'dealers'
                  ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">EPC Dealers</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{dealersList.length}</div>
                  <div className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">handshake</span>
                    Authorized Partners
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">apartment</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setAccountSubTab('staff')}
              className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                accountSubTab === 'staff'
                  ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff &amp; Desk</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{staffListState.length}</div>
                  <div className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">groups</span>
                    Sales &amp; Verification Team
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">badge</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Sub-Tabs Header (Admins / Dealers / Staff) + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setAccountSubTab('admins')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  accountSubTab === 'admins'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                <span>Admins ({adminsList.length})</span>
              </button>

              <button
                onClick={() => setAccountSubTab('dealers')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  accountSubTab === 'dealers'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">apartment</span>
                <span>Dealers ({dealersList.length})</span>
              </button>

              <button
                onClick={() => setAccountSubTab('staff')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  accountSubTab === 'staff'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">groups</span>
                <span>Staff ({staffListState.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Box */}
              <div className="relative min-w-0 sm:w-60">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder={`Search ${accountSubTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* Add Action Button */}
              {accountSubTab === 'admins' && (
                <button
                  onClick={handleOpenAddAdmin}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  <span>New Admin</span>
                </button>
              )}

              {accountSubTab === 'dealers' && (
                <button
                  onClick={handleOpenAddDealer}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">add_business</span>
                  <span>New Dealer</span>
                </button>
              )}

              {accountSubTab === 'staff' && (
                <button
                  onClick={handleOpenAddStaff}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">group_add</span>
                  <span>New Staff</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================
              SUB-TAB 1: ADMIN ACCOUNTS TABLE
              ======================================================== */}
          {accountSubTab === 'admins' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl animate-spin text-emerald-600">sync</span>
                  <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
                </div>
              ) : filteredAdmins.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">no_accounts</span>
                  <p className="text-sm font-medium">No admin accounts found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Administrator</th>
                        <th className="py-3 px-4">Mobile Number</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Database State</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAdmins.map((admin) => (
                        <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                                {(admin.full_name || 'A').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{admin.full_name}</span>
                                  {admin.email === currentAdmin?.email && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                                      Current Session
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">ID: {admin.id.slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-slate-400 text-sm">phone_iphone</span>
                              <span>{admin.mobile_number || '8000050580'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                            {admin.email}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              admin.role === 'super_admin'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              <span className="material-symbols-outlined text-xs">
                                {admin.role === 'super_admin' ? 'stars' : 'shield_person'}
                              </span>
                              <span>{admin.role === 'super_admin' ? 'Super Admin' : 'Admin Officer'}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Bcrypt Verified
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Password Button */}
                              <button
                                onClick={() => handleOpenPasswordModal('admin', admin)}
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
                                title="Change Password"
                              >
                                <span className="material-symbols-outlined text-sm">key</span>
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => handleOpenEditAdmin(admin)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                                title="Edit Admin"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleOpenDelete('admin', admin)}
                                disabled={adminsList.length <= 1}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title={adminsList.length <= 1 ? 'Cannot delete the only admin' : 'Delete Admin'}
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              SUB-TAB 2: DEALER ACCOUNTS TABLE
              ======================================================== */}
          {accountSubTab === 'dealers' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl animate-spin text-emerald-600">sync</span>
                  <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
                </div>
              ) : filteredDealers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">storefront</span>
                  <p className="text-sm font-medium">No dealer partners found in database.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Dealer Partner / Firm</th>
                        <th className="py-3 px-4">Mobile Number</th>
                        <th className="py-3 px-4">City / DISCOM</th>
                        <th className="py-3 px-4">Partner Tier</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDealers.map((dealer) => {
                        const firm = dealer.firm_name || dealer.firmName || 'Dealer Firm';
                        const contact = dealer.contact_person || dealer.contactPerson || 'Authorized Person';
                        const code = dealer.dealer_code || dealer.dealerCode || dealer.id;
                        const mobile = dealer.mobile_number || dealer.mobile || '8000050580';
                        return (
                          <tr key={dealer.id || code} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm">
                                  {firm.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900">{firm}</div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span>{contact}</span>
                                    <span>•</span>
                                    <span className="font-mono text-emerald-700 font-semibold">{code}</span>
                                    <span>•</span>
                                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      (!dealer.assigned_staff_id || dealer.assigned_staff_id === 'STF-DIRECT' || dealer.assignedStaffId === 'STF-DIRECT')
                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}>
                                      {(!dealer.assigned_staff_id || dealer.assigned_staff_id === 'STF-DIRECT' || dealer.assignedStaffId === 'STF-DIRECT')
                                        ? 'Direct to Company'
                                        : `Sales: ${dealer.assigned_staff_name || dealer.assignedStaffName || 'Sales Staff'}`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-slate-400 text-sm">phone_iphone</span>
                                <span>{mobile}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-slate-900 font-medium">{dealer.city || 'Ahmedabad'}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{dealer.discom || 'UGVCL'} Circle</div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="material-symbols-outlined text-xs">workspace_premium</span>
                                <span>{dealer.tier || 'Gold EPC'}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>Active in DB</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Password Button */}
                                <button
                                  onClick={() => handleOpenPasswordModal('dealer', dealer)}
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
                                  title="Change Dealer Password"
                                >
                                  <span className="material-symbols-outlined text-sm">key</span>
                                </button>

                                {/* Edit Button */}
                                <button
                                  onClick={() => handleOpenEditDealer(dealer)}
                                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                                  title="Edit Dealer Profile"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>

                                {/* Delete Button */}
                                <button
                                  onClick={() => handleOpenDelete('dealer', dealer)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                                  title="Delete Dealer"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
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

          {/* ========================================================
              SUB-TAB 3: STAFF ACCOUNTS TABLE
              ======================================================== */}
          {accountSubTab === 'staff' && (
            <div className="space-y-3">
              {/* Filter Pills */}
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: `All Staff (${staffListState.length})` },
                  { id: 'sales', label: `Field Sales (${staffListState.filter(s => !(s.department || '').toLowerCase().includes('verification') && !(s.role || '').toLowerCase().includes('verification')).length})` },
                  { id: 'verification', label: `Verification Desk (${staffListState.filter(s => (s.department || '').toLowerCase().includes('verification') || (s.role || '').toLowerCase().includes('verification')).length})` }
                ].map(pill => (
                  <button
                    key={pill.id}
                    onClick={() => setStaffFilter(pill.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                      staffFilter === pill.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {loading ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-3xl animate-spin text-emerald-600">sync</span>
                    <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">person_off</span>
                    <p className="text-sm font-medium">No staff members found matching filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Staff Member</th>
                          <th className="py-3 px-4">Mobile Number</th>
                          <th className="py-3 px-4">Department &amp; Role</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStaff.map((staff) => {
                          const isVer = (staff.department || '').toLowerCase().includes('verification') || (staff.role || '').toLowerCase().includes('verification');
                          return (
                            <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-sm ${
                                    isVer ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {(staff.name || 'S').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900">{staff.name}</div>
                                    <div className="text-[11px] text-slate-400 font-mono">ID: {staff.id}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-slate-400 text-sm">phone_iphone</span>
                                  <span>{staff.phone || '8000050580'}</span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div>
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    isVer
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    <span className="material-symbols-outlined text-xs">
                                      {isVer ? 'fact_check' : 'campaign'}
                                    </span>
                                    <span>{isVer ? 'Verification Desk' : 'Field Sales'}</span>
                                  </span>
                                  <div className="text-xs text-slate-500 mt-1">{staff.role}</div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                                {staff.email}
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>Active in DB</span>
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Password Button */}
                                  <button
                                    onClick={() => handleOpenPasswordModal('staff', staff)}
                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
                                    title="Change Password"
                                  >
                                    <span className="material-symbols-outlined text-sm">key</span>
                                  </button>

                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleOpenEditStaff(staff)}
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                                    title="Edit Staff Profile"
                                  >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    onClick={() => handleOpenDelete('staff', staff)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                                    title="Delete Staff"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
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
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB CONTENT: 2. DOCUMENT MASTER & CATEGORY RULES MATRIX
          ======================================================== */}
      {settingsTab === 'document_rules' && (
        <div className="space-y-6">
          {/* Category Switcher Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">rule_folder</span>
                  <span>Project Category Rules Matrix</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an application category below to customize mandatory, optional, and disabled document requirements.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSyncDocs}
                  disabled={isSyncingDocs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-300 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Force instant sync of Document Master & Category Rules directly from Supabase PostgreSQL database"
                >
                  <span className={`material-symbols-outlined text-sm ${isSyncingDocs ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  <span>{isSyncingDocs ? 'Syncing Live DB...' : 'Sync Live DB'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddDoc}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  <span>Add Document Type</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowResetRulesModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                  title="Reset all document rules to standard system defaults"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2">
              {CATEGORY_TABS.map((cat) => {
                const isSelected = selectedCategoryRule === cat.key;
                const catRules = categoryDocRules?.[cat.key] || {};
                const reqCount = (masterDocRegistry || []).filter(d => (catRules[d.key] || 'mandatory') === 'mandatory').length;
                const optCount = (masterDocRegistry || []).filter(d => catRules[d.key] === 'optional').length;

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => startTransition(() => setSelectedCategoryRule(cat.key))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {cat.icon}
                        </span>
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                          {cat.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono mt-1">
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                        {reqCount} Req
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">
                        {optCount} Opt
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Category Header & Search Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">
                    {CATEGORY_TABS.find(c => c.key === selectedCategoryRule)?.icon || 'folder'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    <span>{CATEGORY_TABS.find(c => c.key === selectedCategoryRule)?.label}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-normal">
                      Active Rule Matrix
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {CATEGORY_TABS.find(c => c.key === selectedCategoryRule)?.desc}
                  </p>
                </div>
              </div>

              {/* Category Live Counts */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>{currentCategoryStats.mandatory} Mandatory</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span>{currentCategoryStats.optional} Optional</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>{currentCategoryStats.disabled} Disabled</span>
                </div>
              </div>
            </div>

            {/* Search and Quick Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search master documents by name, key, category..."
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
                {docSearchQuery && (
                  <button
                    onClick={() => setDocSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Showing {filteredMasterDocs.length} of {(masterDocRegistry || []).length} Document Types</span>
              </div>
            </div>

            {/* Master Document Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
              {filteredMasterDocs.map((doc) => {
                const currentRule = categoryDocRules?.[selectedCategoryRule]?.[doc.key] || 'mandatory';

                return (
                  <div
                    key={doc.key}
                    className={`rounded-2xl border p-4 transition-all flex flex-col justify-between space-y-3.5 ${
                      currentRule === 'mandatory'
                        ? 'bg-white border-rose-200/90 shadow-xs'
                        : currentRule === 'optional'
                        ? 'bg-white border-sky-200/90 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 opacity-70'
                    }`}
                  >
                    {/* Top Metadata */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            currentRule === 'mandatory'
                              ? 'bg-rose-50 text-rose-700'
                              : currentRule === 'optional'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            <span className="material-symbols-outlined text-lg">
                              {doc.icon || 'description'}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {doc.label}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                {doc.category || 'KYC'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                #{doc.key}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Edit & Delete Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDoc(doc)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                            title="Edit Document Definition"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDocModal(doc)}
                            className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                            title="Remove from Master Registry"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Description / Instructions */}
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {doc.description || 'Customer document required for processing and verification.'}
                      </p>
                    </div>

                    {/* Rule Switcher 3-Way Segmented Control */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Requirement in this Category:
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            updateCategoryDocRule(selectedCategoryRule, doc.key, 'mandatory');
                            setSuccessToast(`Set "${doc.label}" as Mandatory for ${selectedCategoryRule}`);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            currentRule === 'mandatory'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">star</span>
                          <span>Mandatory</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            updateCategoryDocRule(selectedCategoryRule, doc.key, 'optional');
                            setSuccessToast(`Set "${doc.label}" as Optional for ${selectedCategoryRule}`);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            currentRule === 'optional'
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">tune</span>
                          <span>Optional</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            updateCategoryDocRule(selectedCategoryRule, doc.key, 'disabled');
                            setSuccessToast(`Disabled "${doc.label}" for ${selectedCategoryRule}`);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            currentRule === 'disabled'
                              ? 'bg-slate-700 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">visibility_off</span>
                          <span>Disabled</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredMasterDocs.length === 0 && (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <span className="material-symbols-outlined text-3xl text-slate-300">folder_off</span>
                <p className="text-xs font-semibold text-slate-700 mt-2">No master documents matched your search.</p>
                <button
                  type="button"
                  onClick={() => setDocSearchQuery('')}
                  className="mt-2 text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
                >
                  Clear search query
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB CONTENT: 3. SECURITY & POLICIES (Future Tab Placeholder)
          ======================================================== */}
      {settingsTab === 'security' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">shield</span>
          </div>
          <h3 className="font-bold text-slate-900 text-base">Security &amp; Policy Governance</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Two-factor authentication, distributed rate limiting, session TTL policies, and audit trails are active via server security middleware.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
            <span className="material-symbols-outlined text-sm">lock</span>
            Bcrypt Hashing &amp; JWT HTTP-Only Cookies Active
          </div>
        </div>
      )}

      {/* ========================================================
          TAB CONTENT: 3. SYSTEM & PRESETS (Future Tab Placeholder)
          ======================================================== */}
      {/* ========================================================
          TAB CONTENT: 3. SYSTEM & OS PUSH NOTIFICATIONS
          ======================================================== */}
      {settingsTab === 'system' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* OS Push Notification Management Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isPushSubscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className="material-symbols-outlined text-2xl">
                    {isPushSubscribed ? 'notifications_active' : 'notifications'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                      OS-Level Web Push Notifications (Desktop &amp; Mobile)
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      isPushSubscribed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {isPushSubscribed ? 'Active & Connected' : 'Not Enabled on this Device'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                    Receive instant Windows 10/11 Action Center, macOS Notification Center, and mobile notifications when dealers create customer applications—even when your browser is completely closed.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                {isPushSubscribed && (
                  <button
                    type="button"
                    onClick={handleSendAdminTestPush}
                    disabled={isPushLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    <span>Send Test Notification</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleAdminPush}
                  disabled={isPushLoading}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                    isPushSubscribed
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {isPushSubscribed ? 'notifications_off' : 'add_alert'}
                  </span>
                  <span>{isPushLoading ? 'Connecting...' : isPushSubscribed ? 'Unsubscribe Device' : 'Enable OS Notifications'}</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Badges & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6">
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Standard &amp; Engine</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">W3C Web Push &bull; RFC 8292 (VAPID)</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Service Worker: Active (sw-push.js)</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Browser OS Permission</span>
                <span className={`text-xs font-bold mt-1 block capitalize ${
                  permissionState === 'granted' ? 'text-emerald-700' : permissionState === 'denied' ? 'text-rose-600' : 'text-amber-700'
                }`}>
                  {permissionState === 'granted' ? 'Granted (Ready to Receive)' : permissionState === 'denied' ? 'Blocked in Browser Settings' : 'Prompt on Activation'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Notification.permission API</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Target Recipient Rule</span>
                <span className="text-xs font-bold text-emerald-800 mt-1 block">Admin HQ: All Files (100%)</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Salesmen: Assigned Files Only</span>
              </div>
            </div>

            {/* Routing Rules Card */}
            <div className="mt-5 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                <span>Automated Push Routing Logic</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-700 text-[11px]">
                <li><strong>Dealer creates file:</strong> Admin receives OS desktop notification banner immediately.</li>
                <li><strong>Assigned Salesman:</strong> If dealer is linked to a salesman (e.g. Mayank Vekariya, STF-802), that specific salesman receives the alert on their desktop/phone.</li>
                <li><strong>Direct Company:</strong> If dealer is handled direct by company (STF-DIRECT), only Admin receives the push notification.</li>
                <li><strong>Click to Navigate:</strong> Clicking the OS notification banner automatically opens the portal and highlights the new file in the Sales Team &amp; Files view.</li>
              </ul>
            </div>
          </div>

          {/* Quick System Links */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-3">Master Configuration Quick Consoles</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer" onClick={() => startTransition(() => setSettingsTab('account_center'))}>
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 mb-1">
                  <span className="material-symbols-outlined text-sm text-primary">badge</span>
                  <span>Staff &amp; Dealer Accounts</span>
                </div>
                <p className="text-[11px] text-slate-500">Manage dealer-to-salesman assignments and system credentials.</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer" onClick={() => startTransition(() => setSettingsTab('document_rules'))}>
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 mb-1">
                  <span className="material-symbols-outlined text-sm text-primary">folder_managed</span>
                  <span>Document Vault Master</span>
                </div>
                <p className="text-[11px] text-slate-500">Configure mandatory documents per category and loan requirements.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT ADMIN
          ======================================================== */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scaleIn">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">admin_panel_settings</span>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingAdmin ? 'Edit Administrator Profile' : 'Add New Administrator'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={adminForm.fullName}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="8000050580"
                      value={adminForm.mobileNumber}
                      onChange={(e) => setAdminForm(prev => ({ ...prev, mobileNumber: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                    <select
                      value={adminForm.role}
                      onChange={(e) => setAdminForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 cursor-pointer"
                    >
                      <option value="super_admin">Super Admin Desk</option>
                      <option value="admin">Operations Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@sunvinerenewable.com"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingAdmin ? 'New Password (optional)' : 'Initial Password'}
                  </label>
                  <input
                    type="text"
                    required={!editingAdmin}
                    placeholder={editingAdmin ? 'Leave blank to keep unchanged' : 'e.g. admin123'}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Saved directly to live PostgreSQL with Bcrypt encryption.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>{editingAdmin ? 'Save Changes' : 'Create Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT DEALER
          ======================================================== */}
      {showDealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scaleIn">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">apartment</span>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingDealer ? 'Edit Dealer Partner Profile' : 'Onboard New Dealer Partner'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDealerModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDealer} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dealer Code</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingDealer)}
                      value={dealerForm.dealerCode}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, dealerCode: e.target.value.toUpperCase() }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Partner Tier</label>
                    <select
                      value={dealerForm.tier}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, tier: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Diamond EPC">Diamond EPC</option>
                      <option value="Platinum EPC">Platinum EPC</option>
                      <option value="Gold EPC">Gold EPC</option>
                      <option value="Silver Installer">Silver Installer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Firm / Agency Trade Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saur Urja Solutions"
                    value={dealerForm.firmName}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, firmName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nilesh Shah"
                      value={dealerForm.contactPerson}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 font-mono text-xs font-bold text-slate-600 select-none pointer-events-none flex items-center gap-1 z-10">
                        <span>+91</span>
                        <span className="text-slate-300 font-normal">|</span>
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="8000050580"
                        value={dealerForm.mobile}
                        onChange={(e) => setDealerForm(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        className="w-full pl-12 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      required
                      placeholder="Ahmedabad"
                      value={dealerForm.city}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">DISCOM</label>
                    <select
                      value={dealerForm.discom}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, discom: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                      <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                      <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                      <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                      <option value="Torrent Power">Torrent Power</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Business Email <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="partner@sunvinedealer.in"
                    value={dealerForm.email}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Sales Channel & Salesman Alignment */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Sales Channel &amp; Account Alignment
                    </label>
                    <span className="text-[11px] text-slate-400">Direct to HQ or Assigned Salesman</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDealerForm(prev => ({
                        ...prev,
                        assignedStaffId: 'STF-DIRECT',
                        assignedStaffName: 'Direct to Company (HQ Desk)'
                      }))}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                        dealerForm.assignedStaffId === 'STF-DIRECT'
                          ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-400/20 text-indigo-900'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg text-indigo-600 mt-0.5">bolt</span>
                      <div>
                        <div className="text-xs font-bold">Direct to Company</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Deals with Sunvine HQ directly</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const firstStaff = (staffListState || []).find(s => s.department === 'Sales') || (staffListState || [])[0];
                        setDealerForm(prev => ({
                          ...prev,
                          assignedStaffId: firstStaff?.id || 'STF-801',
                          assignedStaffName: firstStaff?.name || 'Sunvine Sales Staff'
                        }));
                      }}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                        dealerForm.assignedStaffId !== 'STF-DIRECT'
                          ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20 text-emerald-900'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg text-emerald-600 mt-0.5">person</span>
                      <div>
                        <div className="text-xs font-bold">Field Sales Executive</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Managed by field sales staff</div>
                      </div>
                    </button>
                  </div>

                  {dealerForm.assignedStaffId !== 'STF-DIRECT' && (
                    <div className="pt-1.5 animate-fadeIn">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Select Assigned Sales Representative</label>
                      <select
                        value={dealerForm.assignedStaffId}
                        onChange={(e) => {
                          const sId = e.target.value;
                          const match = (staffListState || []).find(s => s.id === sId);
                          setDealerForm(prev => ({
                            ...prev,
                            assignedStaffId: sId,
                            assignedStaffName: match?.name || 'Sunvine Sales Staff'
                          }));
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {(staffListState || []).map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.id}) • {s.role || s.department || 'Sales'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingDealer ? 'New Password (optional)' : 'Initial Password'}
                  </label>
                  <input
                    type="text"
                    required={!editingDealer}
                    placeholder={editingDealer ? 'Leave blank to keep unchanged' : 'dealer123'}
                    value={dealerForm.password}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Saved directly to live PostgreSQL with Bcrypt encryption.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDealerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>{editingDealer ? 'Save Changes' : 'Onboard Dealer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT STAFF
          ======================================================== */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scaleIn">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">group_add</span>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingStaff ? 'Edit Staff Profile' : 'Add New Staff Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Staff ID</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingStaff)}
                      placeholder="STF-802"
                      value={staffForm.id}
                      onChange={(e) => setStaffForm(prev => ({ ...prev, id: e.target.value.toUpperCase() }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <select
                      value={staffForm.department}
                      onChange={(e) => {
                        const dept = e.target.value;
                        setStaffForm(prev => ({
                          ...prev,
                          department: dept,
                          role: dept === 'Verification' ? 'Field Verification Officer' : 'Senior Solar Field Executive'
                        }));
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Sales">Field Sales</option>
                      <option value="Verification">Verification Desk</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nilesh Vaghela"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="8000050580"
                      value={staffForm.phone}
                      onChange={(e) => setStaffForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / Role</label>
                    <input
                      type="text"
                      list="adminSettingsRolesList"
                      required
                      value={staffForm.role}
                      onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                      placeholder="Type or select designation..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                    <datalist id="adminSettingsRolesList">
                      <option value="Field Sales Executive" />
                      <option value="Area Sales Manager" />
                      <option value="Regional Solar Lead" />
                      <option value="Senior Solar Field Executive" />
                      <option value="Verification Desk Officer" />
                      <option value="Senior Technical Auditor" />
                      <option value="Document Verification Lead" />
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="staff@sunvine.in"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingStaff ? 'New Password (optional)' : 'Initial Password'}
                  </label>
                  <input
                    type="text"
                    required={!editingStaff}
                    placeholder={editingStaff ? 'Leave blank to keep unchanged' : (staffForm.department === 'Verification' ? 'desk123' : 'staff123')}
                    value={staffForm.password}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Saved directly to live PostgreSQL with Bcrypt encryption.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>{editingStaff ? 'Save Changes' : 'Create Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CHANGE PASSWORD (Bcrypt Live)
          ======================================================== */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">key</span>
                <h3 className="font-bold text-slate-900 text-base">
                  Change Password
                </h3>
              </div>
              <button
                onClick={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Updating credentials for{' '}
                <strong className="font-semibold text-slate-900">
                  {passwordModal.account?.full_name || passwordModal.account?.firm_name || passwordModal.account?.firmName || passwordModal.account?.name}
                </strong>
                . Changes are encrypted via Bcrypt and written directly to PostgreSQL.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={passwordModal.showPass ? 'text' : 'password'}
                    required
                    placeholder="Enter new password"
                    value={passwordModal.newPassword}
                    onChange={(e) => setPasswordModal(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordModal(prev => ({ ...prev, showPass: !prev.showPass }))}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {passwordModal.showPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <input
                  type={passwordModal.showPass ? 'text' : 'password'}
                  required
                  placeholder="Re-enter password"
                  value={passwordModal.confirmPassword}
                  onChange={(e) => setPasswordModal(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DELETE CONFIRMATION
          ======================================================== */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Delete Account</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">
                  {deleteModal.account?.full_name || deleteModal.account?.firm_name || deleteModal.account?.firmName || deleteModal.account?.name}
                </strong>{' '}
                from the live PostgreSQL database? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, accountType: '', account: null })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT MASTER DOCUMENT TYPE
          ======================================================== */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scaleIn">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">note_add</span>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingDoc ? 'Edit Document Definition' : 'Register New Master Document'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CEI Electrical Safety Approval"
                    value={docForm.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDocForm(prev => ({
                        ...prev,
                        label: val,
                        key: (!editingDoc && !isKeyManuallyEdited) ? formatDocumentKey(val) : prev.key
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Unique Key Identifier</label>
                      {!editingDoc && !isKeyManuallyEdited && docForm.key && (
                        <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Auto-generated
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingDoc)}
                      placeholder="e.g. ceiApproval"
                      value={docForm.key}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s+/g, '');
                        if (!val) {
                          setIsKeyManuallyEdited(false);
                          setDocForm(prev => ({ ...prev, key: formatDocumentKey(prev.label) }));
                        } else {
                          setIsKeyManuallyEdited(true);
                          setDocForm(prev => ({ ...prev, key: val }));
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Unique database identifier &amp; storage prefix</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Group Category</label>
                    <select
                      value={docForm.category}
                      onChange={(e) => setDocForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {DOC_CATEGORY_GROUPS.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Icon</label>
                  <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-slate-50 border border-slate-200 rounded-xl max-h-28 overflow-y-auto">
                    {DOC_ICONS.map(ic => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setDocForm(prev => ({ ...prev, icon: ic }))}
                        className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          docForm.icon === ic
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">{ic}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions / Description</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Chief Electrical Inspectorate clearance certificate copy for >10kW solar system."
                    value={docForm.description}
                    onChange={(e) => setDocForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{editingDoc ? 'Save Changes' : 'Register Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DELETE MASTER DOCUMENT CONFIRMATION
          ======================================================== */}
      {deleteDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete</span>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Remove Document Type</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <strong className="text-slate-900">{deleteDocModal.label}</strong> from the master registry? Existing uploaded customer files will retain their attachments.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteDocModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDoc}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95"
              >
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: RESET RULES TO STANDARD DEFAULTS
          ======================================================== */}
      {showResetRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">restart_alt</span>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Reset Standard Defaults</h3>
              <p className="text-xs text-slate-500">
                This will reset all project category document requirement rules (Residential, Bank Loan, NBFC, Commercial, Society) back to factory presets.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetRulesModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDocumentRulesToDefault();
                  setShowResetRulesModal(false);
                  setSuccessToast('All document master rules restored to standard factory presets.');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95"
              >
                <span>Reset to Factory Defaults</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
