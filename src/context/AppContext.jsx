import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import {
  DEFAULT_PRICING_MASTER,
  DEFAULT_MODULES,
  DEFAULT_INVERTERS,
  INITIAL_DEALERS,
  INITIAL_QUOTATIONS,
  DEFAULT_NOTIFICATIONS,
  PDF_BOS_PRICE_MATRIX,
  PDF_BOM_SPECIFICATIONS,
  SUNVINE_OFFICIAL_PROFILE
} from '../data/defaultPresets';
import {
  STANDARD_BOM_CATALOG,
  STANDARD_BOM_CATEGORIES,
  DEFAULT_CAPACITY_BOM,
  resolveCapacityBom
} from '../data/standardBomData';
import {
  DEFAULT_STAFF,
  DEFAULT_CUSTOMER_FILES,
  getAssignedStaffForDealer
} from '../data/staffData';
import {
  DEFAULT_SYSTEM_SETTINGS,
  INITIAL_AUDIT_LOGS
} from '../data/systemSettingsDefaults';
import {
  DEFAULT_REQUIRED_DOCUMENTS,
  APPLICATION_CATEGORIES,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_MASTER_DOCUMENT_REGISTRY,
  DEFAULT_CATEGORY_DOC_RULES,
  DOCUMENT_SCHEMAS,
  getDocumentListForFile,
  getDocumentCompletion,
  isDocMandatoryForCategory
} from '../data/defaultRequiredDocuments';
import {
  calculateStaffPerformance,
  calculateDealerPerformance,
  calculateOverallBusinessMetrics
} from '../utils/performanceAnalytics';
import { hardwareService } from '../services/hardwareService';
import { quotationService } from '../services/quotationService';
import { pricingService } from '../services/pricingService';
import { customerFileService } from '../services/customerFileService';
import { staffService } from '../services/staffService';
import { systemSettingsService } from '../services/systemSettingsService';
import { documentMasterService } from '../services/documentMasterService';
import { auditLogService } from '../services/auditLogService';
import { dealerService } from '../services/dealerService';
import { bankService } from '../services/bankService';
import { settingsService } from '../services/settingsService';
import { authService } from '../services/authService';
import { pushNotificationService } from '../services/pushNotificationService';
import { supabase } from '../lib/supabase';
import { generateFieldBOM } from '../data/standardBomData';
import { cacheManager } from '../utils/cacheManager';
import { TopProgressBar } from '../components/Shared/Skeleton';

const DB_VERSION = 'sunvine_gujarat_ledger_200_v1';

function broadcastDbEvent(type) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('sunvine_db_sync');
      bc.postMessage({ type });
      bc.close();
    }
  } catch (_) {}
}

export const DEFAULT_GOVERNANCE_SETTINGS = {
  enforceAlmm: true,
  pmSuryaGharActive: true,
  maxDealerMarginPerKW: 8000,
  minDealerMarginPerKW: 0,
  quoteExpiryDays: 15,
  autoGedaSync: true,
  requireAdminApprovalAboveKW: 100,
  retentionMonths: 36,
  discomApiStatus: 'Online - 12ms ping',
  gedaSyncStatus: 'Connected (Hourly)',
  lastBackupTimestamp: 'Today, 01:15 AM'
};

const AppContext = createContext();

const TAB_TO_PATH = {
  // Dealer & Common
  dashboard: '/dashboard',
  create_quote: '/new-quotation',
  admin_create_quote: '/admin/new-quotation',
  preview_quote: '/preview-quotation',
  my_quotes: '/my-quotations',
  my_applications: '/my-applications',
  profile: '/settings',
  dealer_settings: '/settings',
  dealer_performance: '/dealer/performance',
  lead_generation: '/leads',
  docs: '/documentation',

  // Admin
  admin_dashboard: '/admin',
  admin_performance: '/admin/performance',
  dealers_mgmt: '/admin/dealers',
  staff_mgmt: '/admin/staff',
  pricing_master: '/admin/pricing',
  hardware_master: '/admin/hardware',
  all_quotes: '/admin/quotations',
  admin_settings: '/admin/settings',
  admin_reports: '/admin/reports',
  admin_audit: '/admin/audit-logs',
  admin_docs: '/admin/documentation',

  // Staff
  staff_dashboard: '/staff',
  staff_files: '/staff/files',
  staff_pricing: '/staff/pricing',
  staff_performance: '/staff/performance',
  staff_new_lead: '/staff/new-lead',
  staff_map: '/staff/map',
  verification_desk: '/staff/verification',
  staff_verification: '/staff/verification'
};

const PATH_TO_TAB = Object.entries(TAB_TO_PATH).reduce((acc, [tab, path]) => {
  acc[path] = tab;
  return acc;
}, {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/profile': 'dealer_settings',
  '/admin/new-quotation': 'create_quote',
  '/admin/dashboard': 'admin_dashboard',
  '/staff': 'staff_dashboard',
  '/staff/dashboard': 'staff_dashboard',
  '/staff/pricing': 'staff_pricing',
  '/staff/files': 'staff_files',
  '/staff/verification': 'verification_desk',
  '/staff/new-quotation': 'create_quote',
  '/admin/quotations': 'all_quotes'
});

const isPublicProposalRoute = () => {
  if (typeof window === 'undefined') return false;
  const search = window.location.search || '';
  const searchParams = new URLSearchParams(search);
  if (searchParams.get('view') === 'quote' || searchParams.has('quoteId')) {
    return true;
  }
  const hash = window.location.hash || '';
  if (hash.startsWith('#/quote/') || hash.startsWith('#/view-quote/')) {
    return true;
  }
  return false;
};

const getInitialAuthViewFromUrl = () => {
  if (typeof window === 'undefined') return 'dealer_login';
  const pathname = (window.location.pathname || '').toLowerCase();
  if (pathname.startsWith('/admin')) return 'admin_login';
  if (pathname.startsWith('/staff')) return 'staff_login';
  return 'dealer_login';
};

const getInitialTabFromUrl = () => {
  if (typeof window === 'undefined') return 'dashboard';
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  if (pathname === '/profile') {
    window.history.replaceState({ tab: 'dealer_settings' }, '', '/settings');
    return 'dealer_settings';
  }
  const matched = PATH_TO_TAB[pathname];
  if (matched) {
    return matched === 'profile' ? 'dealer_settings' : matched;
  }
  if (pathname === '/' || pathname === '' || pathname === '/login' || pathname === '/admin/login' || pathname === '/staff/login') {
    const saved = localStorage.getItem('sunvine_tab');
    return saved === 'profile' ? 'dealer_settings' : saved || 'dashboard';
  }
  return localStorage.getItem('sunvine_tab') || 'dashboard';
};

export const AppProvider = ({ children }) => {
  // Authentication & Session State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('sunvine_auth') === 'true';
  });

  // Auth screen toggle when not authenticated ('dealer_login', 'admin_login', or 'staff_login')
  const [authView, setAuthViewState] = useState(getInitialAuthViewFromUrl);

  const setAuthView = (newView, replace = false) => {
    startTransition(() => {
      setAuthViewState(newView);
    });
    if (typeof window !== 'undefined') {
      let targetPath = '/login';
      if (newView === 'admin_login') targetPath = '/admin/login';
      else if (newView === 'staff_login') targetPath = '/staff/login';

      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState({ authView: newView }, '', targetPath);
        } else {
          window.history.pushState({ authView: newView }, '', targetPath);
        }
      }
    }
  };

  // Role: 'dealer' or 'admin'
  const [role, setRole] = useState(() => localStorage.getItem('sunvine_role') || 'dealer');
  const [activeTab, setActiveTabState] = useState(getInitialTabFromUrl);

  const setActiveTab = (newTab, replace = false) => {
    const effectiveTab = newTab === 'profile' ? 'dealer_settings' : newTab;
    startTransition(() => {
      setActiveTabState(effectiveTab);
    });
    safeSetItem('sunvine_tab', effectiveTab);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      let targetPath = TAB_TO_PATH[effectiveTab];
      if (role === 'admin') {
        if (effectiveTab === 'create_quote' || effectiveTab === 'admin_create_quote') {
          targetPath = '/admin/new-quotation';
        }
      } else if (role === 'staff') {
        if (effectiveTab === 'create_quote') {
          targetPath = '/staff/new-quotation';
        } else if (effectiveTab === 'pricing_master' || effectiveTab === 'staff_pricing') {
          targetPath = '/staff/pricing';
        }
      }

      if (!targetPath) {
        if (role === 'admin') targetPath = '/admin';
        else if (role === 'staff') targetPath = '/staff';
        else targetPath = '/dashboard';
      }

      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState({ tab: effectiveTab }, '', targetPath);
        } else {
          window.history.pushState({ tab: effectiveTab }, '', targetPath);
        }
      }
    }
  };

  // Push Notification & Deep-link Target File Tracking
  const [highlightedFileId, setHighlightedFileId] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('openFile') || null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const openFile = params.get('openFile');
    const tabParam = params.get('tab');

    if (openFile) {
      setHighlightedFileId(openFile);
      if (role === 'admin') setActiveTab('staff_mgmt');
      else if (role === 'staff') setActiveTab('staff_files');
      else if (role === 'dealer') setActiveTab('my_applications');
    } else if (tabParam === 'applications') {
      if (role === 'admin') setActiveTab('staff_mgmt');
      else if (role === 'staff') setActiveTab('staff_files');
      else if (role === 'dealer') setActiveTab('my_applications');
    }

    if ('serviceWorker' in navigator) {
      const handleSwMessage = (event) => {
        if (event.data?.type === 'SUNVINE_OPEN_FILE' && event.data?.fileId) {
          const fId = event.data.fileId;
          setHighlightedFileId(fId);
          if (role === 'admin') setActiveTab('staff_mgmt');
          else if (role === 'staff') setActiveTab('staff_files');
          else if (role === 'dealer') setActiveTab('my_applications');
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  }, [role]);

  // Browser back/forward button synchronization
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.replace(/\/$/, '') || '/';

        // Unauthenticated popstate navigation between login screens
        if (!isAuthenticated) {
          if (path.startsWith('/admin')) {
            startTransition(() => {
              setAuthViewState('admin_login');
            });
            if (path !== '/admin/login') {
              window.history.replaceState({ authView: 'admin_login' }, '', '/admin/login');
            }
          } else if (path.startsWith('/staff')) {
            startTransition(() => {
              setAuthViewState('staff_login');
            });
            if (path !== '/staff/login') {
              window.history.replaceState({ authView: 'staff_login' }, '', '/staff/login');
            }
          } else {
            startTransition(() => {
              setAuthViewState('dealer_login');
            });
            if (path !== '/login') {
              window.history.replaceState({ authView: 'dealer_login' }, '', '/login');
            }
          }
          return;
        }

        // Authenticated popstate navigation
        if (path === '/profile') {
          window.history.replaceState({ tab: 'dealer_settings' }, '', '/settings');
          startTransition(() => {
            setActiveTabState('dealer_settings');
          });
          return;
        }
        const matchedTab = PATH_TO_TAB[path];
        if (matchedTab) {
          startTransition(() => {
            setActiveTabState(matchedTab === 'profile' ? 'dealer_settings' : matchedTab);
          });
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated]);

  // Enforce login URL redirection for unauthenticated navigation across all pages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isPublicProposalRoute()) return;

    if (!isAuthenticated) {
      const pathname = (window.location.pathname || '').replace(/\/$/, '') || '/';

      if (pathname.startsWith('/admin')) {
        if (pathname !== '/admin/login') {
          window.history.replaceState({ authView: 'admin_login' }, '', '/admin/login');
        }
        if (authView !== 'admin_login') {
          setAuthViewState('admin_login');
        }
      } else if (pathname.startsWith('/staff')) {
        if (pathname !== '/staff/login') {
          window.history.replaceState({ authView: 'staff_login' }, '', '/staff/login');
        }
        if (authView !== 'staff_login') {
          setAuthViewState('staff_login');
        }
      } else {
        // Any other route (e.g. /dashboard, /new-quotation, /preview-quotation, /my-quotations, /settings, /, etc.)
        if (pathname !== '/login') {
          window.history.replaceState({ authView: 'dealer_login' }, '', '/login');
        }
        if (authView !== 'dealer_login') {
          setAuthViewState('dealer_login');
        }
      }
    }
  }, [isAuthenticated, authView]);

  // Update URL on initial load if logged in & guard roles against unauthorized paths
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      if (isPublicProposalRoute()) return;

      if (window.location.pathname === '/profile' || window.location.pathname === '/settings') {
        if (role === 'admin') {
          window.history.replaceState({ tab: 'admin_settings' }, '', '/admin/settings');
          setActiveTabState('admin_settings');
        } else if (role === 'staff') {
          window.history.replaceState({ tab: 'staff_dashboard' }, '', '/staff');
          setActiveTabState('staff_dashboard');
        } else {
          window.history.replaceState({ tab: 'dashboard' }, '', '/dashboard');
          setActiveTabState('dashboard');
        }
        return;
      }
      if (role !== 'admin' && (activeTab === 'dealer_settings' || activeTab === 'admin_settings')) {
        const safeTab = role === 'staff' ? 'staff_dashboard' : 'dashboard';
        setActiveTabState(safeTab);
      }
      let targetPath = TAB_TO_PATH[activeTab];
      if (role === 'admin' && (activeTab === 'create_quote' || activeTab === 'admin_create_quote')) {
        targetPath = '/admin/new-quotation';
      } else if (role === 'staff' && activeTab === 'create_quote') {
        targetPath = '/staff/new-quotation';
      } else if (role === 'staff' && (activeTab === 'pricing_master' || activeTab === 'staff_pricing')) {
        targetPath = '/staff/pricing';
      } else if (!targetPath) {
        targetPath = role === 'admin' ? '/admin' : (role === 'staff' ? '/staff' : '/dashboard');
      }

      const curPath = window.location.pathname.replace(/\/$/, '') || '/';
      const isLoginOrRoot = curPath === '/' || curPath === '/login' || curPath === '/admin/login' || curPath === '/staff/login';

      if (isLoginOrRoot) {
        window.history.replaceState({ tab: activeTab }, '', targetPath);
      }

      // Role isolation: prevent unauthorized role paths in browser address bar
      if (role === 'dealer' && (curPath.startsWith('/admin') || curPath.startsWith('/staff'))) {
        const fallback = activeTab === 'create_quote' ? '/new-quotation' : '/dashboard';
        window.history.replaceState({ tab: activeTab }, '', fallback);
      } else if (role === 'staff' && curPath.startsWith('/admin')) {
        window.history.replaceState({ tab: 'staff_dashboard' }, '', '/staff');
        setActiveTabState('staff_dashboard');
      }
    }
  }, [isAuthenticated, activeTab, role]);
  
// Safe storage parser and serializer
const safeJsonParse = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    const parsed = JSON.parse(item);
    return parsed ?? fallback;
  } catch (err) {
    console.warn(`[Sunvine Storage] Resetting corrupted key: ${key}`);
    try {
      localStorage.removeItem(key);
    } catch (_) {}
    return fallback;
  }
};

const safeSetItem = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (err) {
    console.warn(`[Sunvine Storage] Storage write suppressed for: ${key}`, err);
  }
};

  // Startup: One-time purge of legacy business entity keys from browser localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const legacyBusinessKeys = [
      'sunvine_customer_files',
      'sunvine_quotations',
      'sunvine_dealers',
      'sunvine_staff_list',
      'sunvine_pricing_master',
      'sunvine_pricing_presets',
      'sunvine_bos_price_matrix',
      'sunvine_bos_matrix_v2',
      'sunvine_inverters',
      'sunvine_modules',
      'sunvine_inverter_benchmark_matrix',
      'sunvine_bom_catalog',
      'sunvine_bom_catalog_v2',
      'sunvine_bom_rates',
      'sunvine_capacity_bom',
      'sunvine_solar_kits_presets_v2',
      'sunvine_dealer_custom_pricing_v2',
      'sunvine_tier_margins',
      'sunvine_system_settings',
      'sunvine_audit_logs',
      'sunvine_design_records',
      'sunvine_notifications',
      'sunvine_last_quote',
      'sunvine_preview_quotation',
      'sunvine_required_documents',
      'sunvine_application_stages',
      'sunvine_governance_settings',
      'sunvine_master_doc_registry',
      'master_doc_registry',
      'sunvine_category_doc_rules',
      'category_doc_rules',
      // Staff is DB-only: purge any previously cached staff data
      'sunvine_cache_staff_list'
    ];
    legacyBusinessKeys.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
  }, []);

  // Current Dealer Profile (Gujarat default)
  const [currentDealer, setCurrentDealer] = useState(() => {
    return safeJsonParse('sunvine_current_dealer', null) || null;
  });

  // Master Pricing Presets (Configurable by Admin & synced with PDF)
  const [pricingMaster, setPricingMaster] = useState(DEFAULT_PRICING_MASTER);

  // Benchmark Quotation Presets (Admin & Dealer Sync)
  const [pricingPresets, setPricingPresets] = useState(() => cacheManager.get('pricing_presets', DEFAULT_PRICING_MASTER.quotationPresets));

  // Commission Margins & Protective Caps by Dealer Tier
  const [tierMargins, setTierMargins] = useState(() => cacheManager.get('tier_margins', DEFAULT_PRICING_MASTER.tierMargins));

  // Admin Master Governance & Policy Settings
  const [governanceSettings, setGovernanceSettings] = useState(DEFAULT_GOVERNANCE_SETTINGS);

  // Solar Hardware Catalogs (Primary: Supabase DB + SWR local memory)
  const [modulesList, setModulesList] = useState(() => cacheManager.get('modules_list', []));
  const [invertersList, setInvertersList] = useState(() => cacheManager.get('inverters_list', []));

  const [isHardwareDbSyncing, setIsHardwareDbSyncing] = useState(true);
  const [customerFilesError, setCustomerFilesError] = useState(null);
  const [isHardwareDbConnected, setIsHardwareDbConnected] = useState(true);

  // Dynamic Master Document Registry (Supabase Live DB Authority - No localStorage)
  const [masterDocRegistry, setMasterDocRegistry] = useState(DEFAULT_MASTER_DOCUMENT_REGISTRY);

  // Dynamic Category Document Rules Matrix (Supabase Live DB Authority - No localStorage)
  const [categoryDocRules, setCategoryDocRules] = useState(DEFAULT_CATEGORY_DOC_RULES);

  // Solar Loan Partner Banks (Database Connected + SWR Cache)
  const [solarBanks, setSolarBanks] = useState(() => cacheManager.get('solar_banks', []));

  // Dedicated Inverter Sizing & Benchmark Pricing Matrix
  const [inverterBenchmarkMatrix, setInverterBenchmarkMatrix] = useState(() => cacheManager.get('inverter_benchmarks', [
    { id: 'inv-bm-1', capacityKW: 2.2, brand: 'Solis / Solaryaan', series: 'Single Phase Grid-Tied', phase: '1-Phase / Dual MPPT', benchmarkPrice: 24500 },
    { id: 'inv-bm-2', capacityKW: 3.0, brand: 'Sunvine Smart Series', series: '1-Phase Smart MPPT On-Grid', phase: '1-Phase / Dual MPPT', benchmarkPrice: 29800 },
    { id: 'inv-bm-3', capacityKW: 3.6, brand: 'Solis / Vsole', series: 'Dual MPPT On-Grid', phase: '1-Phase / Dual MPPT', benchmarkPrice: 33500 },
    { id: 'inv-bm-4', capacityKW: 5.0, brand: 'Sunvine Smart Series', series: '3-Phase Smart MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 42000 },
    { id: 'inv-bm-5', capacityKW: 6.0, brand: 'Sunvine Smart Series', series: '3-Phase Smart MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 48500 },
    { id: 'inv-bm-6', capacityKW: 10.0, brand: 'Growatt / Deye', series: '3-Phase Dual MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 72000 },
    { id: 'inv-bm-7', capacityKW: 50.0, brand: 'Solis Cloud Series', series: 'Commercial 3-Phase Grid-Tied', phase: '3-Phase / 4-MPPT', benchmarkPrice: 245000 },
    { id: 'inv-bm-8', capacityKW: 125.0, brand: 'Solaryaan / Vsole', series: 'Industrial String Inverter', phase: '3-Phase / 6-MPPT', benchmarkPrice: 580000 },
  ]));

  // Bill of Materials (BOM) Master Catalog (Live Supabase & Reactive Sync + SWR Cache)
  const [bomCatalog, setBomCatalog] = useState(() => cacheManager.get('bom_catalog', []));

  // Standard BOM Item Rates (Admin Configurable)
  const defaultBomRates = useMemo(() => {
    return (bomCatalog || []).reduce((acc, item) => {
      acc[item.id] = item.defaultRate !== undefined ? item.defaultRate : (item.rate || 0);
      return acc;
    }, {});
  }, [bomCatalog]);

  const [bomRates, setBomRates] = useState(defaultBomRates);

  // Standard Capacity-Wise BOM Quantities (Admin Configurable)
  const [capacityBomMatrix, setCapacityBomMatrix] = useState(DEFAULT_CAPACITY_BOM);

  // Reusable Solar BOM Kits & Presets (Field-Grade)
  const [kitsPresets, setKitsPresets] = useState([
    {
      id: 'kit-standard-3_3kw',
      name: '3.3 kW Standard 6-Panel HDGI Kit (Field Sheet)',
      capacityKw: 3.3,
      createdBy: 'Sunvine HO',
      creatorRole: 'admin',
      items: generateFieldBOM({ kw: 3.3, panelWatt: 540, panelQuantity: 6, ratePerWp: 18.00 })
    },
    {
      id: 'kit-standard-4_4kw',
      name: '4.4 kW Standard 8-Panel HDGI Kit',
      capacityKw: 4.4,
      createdBy: 'Sunvine HO',
      creatorRole: 'admin',
      items: generateFieldBOM({ kw: 4.4, panelWatt: 550, panelQuantity: 8, ratePerWp: 18.00 })
    },
    {
      id: 'kit-standard-5_5kw',
      name: '5.5 kW 10-Panel High-Rise HDGI Kit',
      capacityKw: 5.5,
      createdBy: 'Sunvine HO',
      creatorRole: 'admin',
      items: generateFieldBOM({ kw: 5.5, panelWatt: 550, panelQuantity: 10, ratePerWp: 18.00 })
    }
  ]);

  // Catalog items viewed by dealer (for "NEW" badge management)
  const [seenCatalogItemIds, setSeenCatalogItemIds] = useState(() => {
    return safeJsonParse('sunvine_seen_catalog_items', []);
  });

  // Quotations List (Live Supabase Database + SWR Cache)
  const [quotations, setQuotations] = useState(() => cacheManager.get('quotations_feed', []));

  // Active quotation loaded in 4-Page Preview
  const [previewQuotation, setPreviewQuotation] = useState(null);

  // Active quotation loaded for Editing in CreateQuotation
  const [editingQuotation, setEditingQuotation] = useState(null);

  // Active in-progress draft quotation for multi-step navigation persistence (SR-36)
  const [activeDraftQuote, setActiveDraftQuote] = useState(null);
  const clearActiveDraftQuote = () => {
    setActiveDraftQuote(null);
  };

  // Current Logged-in Staff Member
  const [currentStaff, setCurrentStaff] = useState(() => {
    return safeJsonParse('sunvine_current_staff', DEFAULT_STAFF[0]) || DEFAULT_STAFF[0];
  });

  // Sales Staff Directory — DB is sole source of truth. Never pre-populate from localStorage.
  const [staffList, setStaffList] = useState([]);

  // Master Dynamic System Settings
  const [systemSettings, setSystemSettings] = useState(DEFAULT_SYSTEM_SETTINGS);

  // Dynamic Required Documents Management (Categorized: Residential, Commercial, Common Meter)
  const [requiredDocuments, setRequiredDocuments] = useState(DEFAULT_REQUIRED_DOCUMENTS);

  // Master Dynamic Application / Pipeline Stages State
  const [applicationStages, setApplicationStages] = useState(DEFAULT_PIPELINE_STAGES);

  // Immutable Audit Activity Ledger
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // 2D and 3D Solar CAD Design Records
  const [designRecords, setDesignRecords] = useState([]);

  // System & Compliance Notifications
  const [notifications, setNotifications] = useState(() => cacheManager.get('system_notifs', []));

  // Determine if running in public proposal viewer mode
  const isPublicProposal = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'quote';

  const ensureDealerAttribution = (list) => {
    return (list || []).map(d => {
      if (!d) return d;
      const assigned = getAssignedStaffForDealer(d);
      const isLegacyMock = d.assignedStaffName === 'Jayesh Patel' || d.assignedStaffId === 'STF-001';
      let assignedStaffId = (d.assignedStaffId && !isLegacyMock) 
        ? d.assignedStaffId 
        : (d.pricingConfig?.assignedStaffId && d.pricingConfig?.assignedStaffId !== 'STF-001' ? d.pricingConfig.assignedStaffId : (assigned?.assignedStaffId || 'STF-DIRECT'));
      
      let assignedStaffName = (d.assignedStaffName && !isLegacyMock) 
        ? d.assignedStaffName 
        : (d.pricingConfig?.assignedStaffName && d.pricingConfig?.assignedStaffName !== 'Jayesh Patel' ? d.pricingConfig.assignedStaffName : (assigned?.assignedStaffName || 'Direct to Company (HQ Desk)'));

      if (assignedStaffId === 'STF-DIRECT') {
        assignedStaffName = 'Direct to Company (HQ Desk)';
      }

      const tierLower = (d.tier || '').toLowerCase();
      const defaultTierMargin = tierLower.includes('diamond') ? 6500 : tierLower.includes('platinum') ? 5500 : tierLower.includes('silver') ? 3500 : 4500;
      return {
        ...d,
        assignedStaffId,
        assignedStaffName,
        onboardedDate: d.onboardedDate || '2025-06-15',
        pricingConfig: {
          ...(d.pricingConfig || {}),
          assignedStaffId,
          assignedStaffName,
          pricingMode: d.pricingConfig?.pricingMode || 'standard',
          customBaseRatePerWp: d.pricingConfig?.customBaseRatePerWp || 18.00,
          customBaseRatePerKw: d.pricingConfig?.customBaseRatePerKw || 58000,
          customMarginPerKw: d.pricingConfig?.customMarginPerKw || defaultTierMargin,
          customDiscountPercent: d.pricingConfig?.customDiscountPercent || 0,
          customNotes: d.pricingConfig?.customNotes || ''
        }
      };
    });
  };

  const normalizeCustomerFileRow = (f, idx = 0) => {
    if (!f || !f.id) return null;
    const hasDealer = Boolean(f.dealerId || f.dealer_id || f.dealerName || f.dealer_name);
    const rawSource = (f.sourceType || f.source_type || f.source || '').toUpperCase();
    const sourceType = rawSource.includes('DIRECT') ? 'DIRECT_STAFF' : (rawSource === 'DEALER' || hasDealer ? 'DEALER' : (idx % 2 === 0 ? 'DIRECT_STAFF' : 'DEALER'));
    const rawFinance = (f.financeType || f.finance_type || f.paymentMode || '').toUpperCase();
    const financeType = rawFinance === 'LOAN' || Boolean(f.loanBank || f.loan_bank) ? 'LOAN' : (rawFinance === 'CASH' ? 'CASH' : 'CASH');
    const loanBank = financeType === 'LOAN' ? (f.loanBank || f.loan_bank || 'State Bank of India') : null;

    return {
      id: f.id,
      customerName: f.customer_name || f.customerName || 'Customer',
      phone: f.phone || '',
      address: f.address || '',
      city: f.city || '',
      discom: f.discom || 'PGVCL',
      discomCircle: f.discom || 'PGVCL',
      consumerNo: f.consumer_no || f.consumerNo || '',
      consumerNumber: f.consumer_no || f.consumerNo || '',
      sanctionedLoadKw: Number(f.sanctioned_load_kw || f.sanctionedLoadKw) || 0,
      solarSystemKw: Number(f.solar_system_kw || f.solarSystemKw) || 0,
      roofType: f.roof_type || f.roofType || 'RCC Flat',
      sourceType,
      source: sourceType,
      dealerId: f.dealer_id || f.dealerId || null,
      dealerName: f.dealer_name || f.dealerName || null,
      staffId: f.staff_id || f.staffId || 'STF-801',
      staffName: (f.staff_name === 'Jayesh Patel' || f.staffName === 'Jayesh Patel') ? 'Sunvine Sales Staff' : (f.staff_name || f.staffName || 'Sunvine Sales Staff'),
      financeType,
      paymentMode: financeType,
      loanBank,
      loanAccountNo: f.loan_account_no || f.loanAccountNo || null,
      loanRefNo: f.loan_account_no || f.loanAccountNo || null,
      stage: f.stage || 'LEAD_SOURCED',
      currentStage: f.stage || 'LEAD_SOURCED',
      status: f.status || 'Sourced',
      documents: (f.documents && typeof f.documents === 'object' && !Array.isArray(f.documents)) ? f.documents : {},
      timeline: Array.isArray(f.timeline) ? f.timeline : [],
      cancellationReason: f.cancellation_reason || f.cancellationReason || (f.timeline?.find(t => t.stage === 'CANCELLED' || t.title?.includes('Cancelled'))?.notes) || null,
      cancelledAt: f.cancelled_at || f.cancelledAt || (f.timeline?.find(t => t.stage === 'CANCELLED' || t.title?.includes('Cancelled'))?.timestamp) || null,
      cancelledBy: f.cancelled_by ? (typeof f.cancelled_by === 'object' ? f.cancelled_by.name || f.cancelled_by.id : String(f.cancelled_by)) : (f.cancelledBy || (f.timeline?.find(t => t.stage === 'CANCELLED' || t.title?.includes('Cancelled'))?.actor) || null),
      createdAt: f.created_at || f.createdAt || new Date().toISOString(),
      updatedAt: f.updated_at || f.updatedAt || new Date().toISOString()
    };
  };

  const ensureCustomerFileAttribution = (files) => {
    return (files || []).map((f, idx) => normalizeCustomerFileRow(f, idx)).filter(Boolean);
  };

  // Dealers Directory (Gujarat Dealers Only - Supabase DB Authority + SWR Cache)
  const [dealers, setDealers] = useState(() => {
    const cached = cacheManager.get('dealers_list', null);
    return Array.isArray(cached) && cached.length > 0 ? ensureDealerAttribution(cached) : [];
  });

  // Real PDF BOS Reference Data
  const [pdfBosMatrix, setPdfBosMatrix] = useState(() => cacheManager.get('bos_matrix', []));

  // Customer Files Pipeline (Synchronized between Admin and Sales Staff - Live Supabase DB Authority + SWR Cache)
  const [customerFiles, setCustomerFiles] = useState(() => {
    const cached = cacheManager.get('customer_files', []);
    return Array.isArray(cached) && cached.length > 0 ? ensureCustomerFileAttribution(cached) : [];
  });

  // Live Universal Database Hydration (Async startup from Supabase PostgreSQL with SWR Cache)
  const hydrateAllFromSupabase = useCallback(async () => {
    try {
      setIsHardwareDbSyncing(true);
      const [
        dbModules,
        dbInverters,
        dbPresets,
        dbBos,
        dbBenchmarks,
        dbTiers,
        dbDealers,
        dbQuotations,
        dbFiles,
        dbStaff,
        dbSettings,
        dbDocMaster,
        dbLogs,
        dbNotifs,
        dbBanks,
        dbBomItems
      ] = await Promise.allSettled([
        hardwareService.getAllModules(),
        hardwareService.getAllInverters(),
        pricingService.getPricingPresets(),
        pricingService.getBosMatrix(),
        pricingService.getInverterBenchmarks(),
        pricingService.getTierMargins(),
        dealerService.getAllDealers(),
        quotationService.getAllQuotations(100),
        customerFileService.getAllCustomerFiles({ throwOnError: false }),
        staffService.getAllStaff(),
        systemSettingsService.getSystemSettings(),
        documentMasterService.fetchDocumentMaster(),
        auditLogService.getAuditLogs(100),
        auditLogService.getNotifications(),
        bankService.getAllSolarBanks(),
        hardwareService.getAllBomItems()
      ]);

      if (dbModules.status === 'fulfilled' && Array.isArray(dbModules.value)) {
        setModulesList(dbModules.value);
        cacheManager.set('modules_list', dbModules.value);
        setIsHardwareDbConnected(true);
      }
      if (dbInverters.status === 'fulfilled' && Array.isArray(dbInverters.value)) {
        setInvertersList(dbInverters.value);
        cacheManager.set('inverters_list', dbInverters.value);
        setIsHardwareDbConnected(true);
      }
      if (dbPresets.status === 'fulfilled' && dbPresets.value) {
        setPricingPresets(dbPresets.value);
        cacheManager.set('pricing_presets', dbPresets.value);
      }
      if (dbBos.status === 'fulfilled' && Array.isArray(dbBos.value) && dbBos.value.length > 0) {
        setPdfBosMatrix(dbBos.value);
        cacheManager.set('bos_matrix', dbBos.value);
      }
      if (dbBenchmarks.status === 'fulfilled' && Array.isArray(dbBenchmarks.value) && dbBenchmarks.value.length > 0) {
        setInverterBenchmarkMatrix(dbBenchmarks.value);
        cacheManager.set('inverter_benchmarks', dbBenchmarks.value);
      }
      if (dbTiers.status === 'fulfilled' && dbTiers.value && Object.keys(dbTiers.value).length > 0) {
        setTierMargins(dbTiers.value);
        cacheManager.set('tier_margins', dbTiers.value);
      }
      if (dbDealers.status === 'fulfilled' && Array.isArray(dbDealers.value)) {
        const attributed = ensureDealerAttribution(dbDealers.value);
        setDealers(attributed);
        cacheManager.set('dealers_list', attributed);
      }
      if (dbQuotations.status === 'fulfilled' && Array.isArray(dbQuotations.value)) {
        setQuotations(dbQuotations.value);
        cacheManager.set('quotations_feed', dbQuotations.value);
      }
      if (dbFiles.status === 'fulfilled' && Array.isArray(dbFiles.value)) {
        const attributedFiles = ensureCustomerFileAttribution(dbFiles.value);
        setCustomerFiles(attributedFiles);
        cacheManager.set('customer_files', attributedFiles);
        setCustomerFilesError(null);
      } else if (dbFiles.status === 'rejected') {
        setCustomerFilesError(dbFiles.reason?.message || 'Failed to load customer files');
      }
      if (dbStaff.status === 'fulfilled' && Array.isArray(dbStaff.value)) {
        setStaffList(dbStaff.value);
        setCurrentStaff(prev => {
          if (!prev?.id) return prev;
          const live = dbStaff.value.find(s => s.id === prev.id || (s.phone && s.phone === prev.phone));
          return live ? { ...prev, ...live } : prev;
        });
      }
      if (dbSettings.status === 'fulfilled' && dbSettings.value) {
        setSystemSettings(prev => ({ ...(prev || {}), ...dbSettings.value }));
        if (dbSettings.value.governanceSettings) {
          setGovernanceSettings(dbSettings.value.governanceSettings);
        }
      }
      if (dbDocMaster.status === 'fulfilled' && dbDocMaster.value) {
        if (Array.isArray(dbDocMaster.value.registry) && dbDocMaster.value.registry.length > 0) {
          setMasterDocRegistry(dbDocMaster.value.registry);
        }
        if (dbDocMaster.value.rules && typeof dbDocMaster.value.rules === 'object') {
          setCategoryDocRules(dbDocMaster.value.rules);
        }
      }
      if (dbLogs.status === 'fulfilled' && Array.isArray(dbLogs.value)) {
        setAuditLogs(dbLogs.value);
      }
      if (dbNotifs.status === 'fulfilled' && Array.isArray(dbNotifs.value)) {
        setNotifications(dbNotifs.value);
      }
      if (dbBanks.status === 'fulfilled' && Array.isArray(dbBanks.value) && dbBanks.value.length > 0) {
        setSolarBanks(dbBanks.value);
        cacheManager.set('solar_banks', dbBanks.value);
      }
      if (dbBomItems.status === 'fulfilled' && Array.isArray(dbBomItems.value)) {
        setBomCatalog(dbBomItems.value);
        cacheManager.set('bom_catalog', dbBomItems.value);
        setBomRates(() => {
          const next = {};
          dbBomItems.value.forEach(it => {
            if (it.defaultRate !== undefined) {
              next[it.id] = it.defaultRate;
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.warn('[AppContext] Supabase live hydration notice:', err);
    } finally {
      setIsHardwareDbSyncing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    hydrateAllFromSupabase();
  }, [hydrateAllFromSupabase]);

  // Real-time Supabase Database Subscriptions across all major tables
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          const formatted = row.quote_payload && typeof row.quote_payload === 'object' ? { ...row.quote_payload, ...row, id: row.id } : row;
          setQuotations(prev => [formatted, ...prev.filter(q => q.id !== formatted.id)]);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          const formatted = row.quote_payload && typeof row.quote_payload === 'object' ? { ...row.quote_payload, ...row, id: row.id } : row;
          setQuotations(prev => prev.map(q => q.id === formatted.id ? { ...q, ...formatted } : q));
        } else if (payload.eventType === 'DELETE') {
          setQuotations(prev => prev.filter(q => q.id !== payload.old?.id));
        }
      })

      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_files' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const formatted = normalizeCustomerFileRow(payload.new);
          if (formatted) {
            setCustomerFiles(prev => {
              const next = [formatted, ...prev.filter(f => f.id !== formatted.id)];
              cacheManager.set('customer_files', next);
              return next;
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          const formatted = normalizeCustomerFileRow(payload.new);
          if (formatted) {
            setCustomerFiles(prev => {
              const next = prev.map(f => f.id === formatted.id ? { ...f, ...formatted } : f);
              cacheManager.set('customer_files', next);
              return next;
            });
          }
        } else if (payload.eventType === 'DELETE') {
          setCustomerFiles(prev => {
            const next = prev.filter(f => f.id !== payload.old?.id);
            cacheManager.set('customer_files', next);
            return next;
          });
        }

        // Silent relational sync with database
        customerFileService.getAllCustomerFiles().then(data => {
          if (data && Array.isArray(data)) {
            const attributed = ensureCustomerFileAttribution(data);
            setCustomerFiles(attributed);
            cacheManager.set('customer_files', attributed);
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solar_modules' }, () => {
        hardwareService.getAllModules().then(data => {
          if (Array.isArray(data)) {
            setModulesList(data);
            cacheManager.set('modules_list', data);
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solar_inverters' }, () => {
        hardwareService.getAllInverters().then(data => {
          if (Array.isArray(data)) {
            setInvertersList(data);
            cacheManager.set('inverters_list', data);
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricing_presets' }, () => {
        pricingService.getPricingPresets().then(data => { if (data) setPricingPresets(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bos_pricing_matrix' }, () => {
        pricingService.getBosMatrix().then(data => { if (data) setPdfBosMatrix(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inverter_benchmark_matrix' }, () => {
        pricingService.getInverterBenchmarks().then(data => { if (data) setInverterBenchmarkMatrix(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_custom_pricing' }, () => {
        pricingService.getTierMargins().then(data => { if (data) setTierMargins(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_accounts' }, () => {
        dealerService.getAllDealers().then(data => {
          if (Array.isArray(data)) {
            const attributed = ensureDealerAttribution(data);
            setDealers(attributed);
            cacheManager.set('dealers_list', attributed);
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_accounts' }, () => {
        staffService.getAllStaff().then(data => {
          if (Array.isArray(data)) setStaffList(data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bom_catalog_items' }, () => {
        hardwareService.getAllBomItems().then(data => {
          if (Array.isArray(data)) {
            setBomCatalog(data);
            cacheManager.set('bom_catalog', data);
            setBomRates(() => {
              const next = {};
              data.forEach(it => {
                if (it.defaultRate !== undefined) {
                  next[it.id] = it.defaultRate;
                }
              });
              return next;
            });
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bom_catalog' }, () => {
        hardwareService.getAllBomItems().then(data => {
          if (Array.isArray(data)) {
            setBomCatalog(data);
            cacheManager.set('bom_catalog', data);
            setBomRates(() => {
              const next = {};
              data.forEach(it => {
                if (it.defaultRate !== undefined) {
                  next[it.id] = it.defaultRate;
                }
              });
              return next;
            });
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        auditLogService.getNotifications().then(data => { if (data) setNotifications(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_master' }, async () => {
        try {
          const freshDocs = await documentMasterService.fetchDocumentMaster();
          if (freshDocs && Array.isArray(freshDocs.registry) && freshDocs.registry.length > 0) {
            setMasterDocRegistry(freshDocs.registry);
            if (freshDocs.rules) setCategoryDocRules(freshDocs.rules);
          }
        } catch (err) {
          console.warn('[AppContext] Realtime document_master sync error:', err);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Multi-Tab Focus & Periodic Auto-Sync (Instant update when user adds rows in Supabase Table Editor or other tabs)
  useEffect(() => {
    const syncFreshData = async () => {
      try {
        const [files, quotes, docMaster, freshStaff, freshDealers] = await Promise.allSettled([
          customerFileService.getAllCustomerFiles(),
          quotationService.getAllQuotations(100),
          documentMasterService.fetchDocumentMaster(),
          staffService.getAllStaff(),
          dealerService.getAllDealers()
        ]);
        if (files.status === 'fulfilled' && Array.isArray(files.value) && files.value.length > 0) {
          const attributed = ensureCustomerFileAttribution(files.value);
          setCustomerFiles(prev => {
            const prevIds = (prev || []).map(f => f.id).join(',');
            const nextIds = attributed.map(f => f.id).join(',');
            if (prevIds !== nextIds || (prev || []).length !== attributed.length) {
              cacheManager.set('customer_files', attributed);
              return attributed;
            }
            return prev;
          });
        }
        if (quotes.status === 'fulfilled' && Array.isArray(quotes.value) && quotes.value.length > 0) {
          setQuotations(prev => {
            const prevIds = (prev || []).map(q => q.id).join(',');
            const nextIds = quotes.value.map(q => q.id).join(',');
            if (prevIds !== nextIds || (prev || []).length !== quotes.value.length) {
              cacheManager.set('quotations_feed', quotes.value);
              return quotes.value;
            }
            return prev;
          });
        }
        // Only update if DB returned actual rows; empty [] means network error — don't overwrite valid state
        if (freshStaff.status === 'fulfilled' && Array.isArray(freshStaff.value) && freshStaff.value.length > 0) {
          setStaffList(freshStaff.value);
        }
        if (freshDealers.status === 'fulfilled' && Array.isArray(freshDealers.value) && freshDealers.value.length > 0) {
          const attributed = ensureDealerAttribution(freshDealers.value);
          setDealers(attributed);
          cacheManager.set('dealers_list', attributed);
        }
        if (docMaster.status === 'fulfilled' && docMaster.value && Array.isArray(docMaster.value.registry) && docMaster.value.registry.length > 0) {
          setMasterDocRegistry(docMaster.value.registry);
          if (docMaster.value.rules && typeof docMaster.value.rules === 'object') {
            setCategoryDocRules(docMaster.value.rules);
          }
        }
      } catch (err) {
        // silent background sync
      }
    };

    let lastSyncTime = 0;
    const MIN_SYNC_INTERVAL_MS = 10000; // 10 seconds minimum cooldown between focus syncs

    // Throttled sync to prevent request storms on rapid window/tab focus switches
    const throttledSync = () => {
      const now = Date.now();
      if (now - lastSyncTime < MIN_SYNC_INTERVAL_MS) return;
      lastSyncTime = now;
      if (document.visibilityState !== 'hidden') {
        syncFreshData();
      }
    };

    window.addEventListener('focus', throttledSync);
    document.addEventListener('visibilitychange', throttledSync);

    // BroadcastChannel for instant intentional cross-tab updates (when user actively edits data)
    let broadcastChannel;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('sunvine_db_sync');
        broadcastChannel.onmessage = (msg) => {
          if (msg?.data?.type === 'SYNC_STAFF' || msg?.data?.type === 'SYNC_DEALERS' || msg?.data?.type === 'SYNC_ALL' || msg?.data?.type === 'SYNC_FILES') {
            const now = Date.now();
            if (now - lastSyncTime >= 3000) {
              lastSyncTime = now;
              syncFreshData();
            }
          }
        };
      }
    } catch (_) {}

    return () => {
      window.removeEventListener('focus', throttledSync);
      document.removeEventListener('visibilitychange', throttledSync);
      if (broadcastChannel) broadcastChannel.close();
    };
  }, []);

  // Concurrency guard and throttling to prevent overlapping in-flight network requests or loop triggers
  const isFetchingCustomerFilesRef = useRef(false);
  const lastCustomerFilesFetchTimeRef = useRef(0);

  const refreshCustomerFiles = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - lastCustomerFilesFetchTimeRef.current < 2000) {
      return;
    }
    // If a database fetch is already actively in-flight, return to avoid race conditions
    if (isFetchingCustomerFilesRef.current) {
      return;
    }

    lastCustomerFilesFetchTimeRef.current = now;
    isFetchingCustomerFilesRef.current = true;

    try {
      const freshFiles = await customerFileService.getAllCustomerFiles({ throwOnError: false });
      if (freshFiles && Array.isArray(freshFiles)) {
        const attributed = ensureCustomerFileAttribution(freshFiles);
        setCustomerFiles(attributed);
        cacheManager.set('customer_files', attributed);
        setCustomerFilesError(null);
        return attributed;
      }
    } catch (err) {
      console.warn('[AppContext] refreshCustomerFiles error:', err);
      setCustomerFilesError(err?.message || 'Failed to load customer files');
    } finally {
      isFetchingCustomerFilesRef.current = false;
    }
  }, []);

  // Live refresh staff directory directly from database with concurrency and throttle protection
  const isFetchingStaffRef = useRef(false);
  const lastStaffFetchTimeRef = useRef(0);

  const refreshStaffList = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - lastStaffFetchTimeRef.current < 2000) {
      return;
    }
    if (isFetchingStaffRef.current) {
      return;
    }

    lastStaffFetchTimeRef.current = now;
    isFetchingStaffRef.current = true;

    try {
      const freshStaff = await staffService.getAllStaff();
      if (freshStaff && Array.isArray(freshStaff)) {
        setStaffList(freshStaff);
        setCurrentStaff(prev => {
          if (!prev?.id) return prev;
          const live = freshStaff.find(s => s.id === prev.id || (s.phone && s.phone === prev.phone));
          return live ? { ...prev, ...live } : prev;
        });
        return freshStaff;
      }
    } catch (err) {
      console.warn('[AppContext] refreshStaffList error:', err);
    } finally {
      isFetchingStaffRef.current = false;
    }
  }, []);

  // Synchronize client-only UI state with localStorage
  useEffect(() => {
    safeSetItem('sunvine_auth', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  useEffect(() => {
    safeSetItem('sunvine_role', role);
  }, [role]);

  useEffect(() => {
    safeSetItem('sunvine_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    safeSetItem('sunvine_current_dealer', currentDealer);
  }, [currentDealer]);

  useEffect(() => {
    safeSetItem('sunvine_current_staff', currentStaff);
  }, [currentStaff]);

  useEffect(() => {
    safeSetItem('sunvine_seen_catalog_items', seenCatalogItemIds);
  }, [seenCatalogItemIds]);

  const updateBomItemRate = (itemId, newRate) => {
    setBomRates(prev => ({
      ...prev,
      [itemId]: Number(newRate) || 0
    }));
  };

  const updateCapacityBomItemQty = (capacityKW, itemId, qty) => {
    const kwKey = parseFloat(capacityKW).toFixed(1);
    setCapacityBomMatrix(prev => {
      const existing = prev[kwKey] || prev['3.3'] || { capacityKW: parseFloat(capacityKW), items: {} };
      return {
        ...prev,
        [kwKey]: {
          ...existing,
          capacityKW: parseFloat(capacityKW),
          items: {
            ...existing.items,
            [itemId]: Math.max(0, Number(qty) || 0)
          }
        }
      };
    });
  };

  const updateCapacityBomPreset = (capacityKW, newPreset) => {
    const kwKey = parseFloat(capacityKW).toFixed(1);
    setCapacityBomMatrix(prev => ({
      ...prev,
      [kwKey]: newPreset
    }));
  };

  const addBomItem = async (newItem) => {
    const item = {
      id: newItem.id || `bom_hw_${Date.now()}`,
      category: newItem.category || 'structure',
      name: (newItem.name || 'New Hardware Component').trim(),
      description: newItem.description || '',
      unit: newItem.unit || 'Nos',
      defaultRate: Number(newItem.defaultRate || newItem.rate) || 100,
      make: newItem.make || 'Approved Brand',
      specs: newItem.specs || '',
      gstRate: Number(newItem.gstRate !== undefined ? newItem.gstRate : 18),
      isArchived: false,
      isNew: true,
      createdAt: Date.now()
    };

    setBomCatalog(prev => [item, ...(prev || []).filter(i => i.id !== item.id)]);
    setBomRates(prev => ({ ...prev, [item.id]: item.defaultRate }));

    // Persist directly to Supabase DB
    await hardwareService.saveBomItem(item);

    addNotification({
      type: 'success',
      icon: 'inventory_2',
      title: 'BOM Hardware Item Added',
      description: `Admin introduced ${item.name} (${item.make}) to master bill of materials.`,
      audience: 'all'
    });

    return item;
  };

  const updateBomItem = async (itemId, updatedFields) => {
    setBomCatalog(prev => prev.map(i => i.id === itemId ? { ...i, ...updatedFields } : i));
    if (updatedFields.defaultRate !== undefined || updatedFields.rate !== undefined) {
      const newRate = Number(updatedFields.defaultRate || updatedFields.rate) || 0;
      setBomRates(prev => ({ ...prev, [itemId]: newRate }));
    }
    const current = (bomCatalog || []).find(i => i.id === itemId);
    const merged = { ...current, ...updatedFields, id: itemId };
    await hardwareService.saveBomItem(merged);
  };

  const deleteBomItem = async (itemId) => {
    setBomCatalog(prev => prev.filter(i => i.id !== itemId));
    setBomRates(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    await hardwareService.deleteBomItem(itemId);
  };

  const archiveBomItem = async (itemId, isArchived) => {
    setBomCatalog(prev => prev.map(i => i.id === itemId ? { ...i, isArchived } : i));
    await hardwareService.archiveBomItem(itemId, isArchived);
  };

  const addNewModule = async (newModule) => {
    const brand = newModule.brand?.trim() || 'Custom';
    const model = newModule.model?.trim() || 'Solar Module';
    const id = newModule.id || `mod-${Date.now()}`;
    const moduleEntry = {
      id,
      brand,
      model,
      cellTech: newModule.cellTech || 'N-Type TOPCon',
      wattage: Number(newModule.wattage) || 550,
      efficiency: newModule.efficiency || '22.0%',
      ratePerWp: newModule.ratePerWp ? (typeof newModule.ratePerWp === 'number' ? `₹ ${newModule.ratePerWp.toFixed(2)}/Wp` : newModule.ratePerWp) : '₹ 19.50/Wp',
      warranty: newModule.warranty || '30 Yrs',
      dimensions: newModule.dimensions || '2278 × 1134 × 30 mm | 28 kg',
      isNew: true,
      createdAt: Date.now()
    };
    setModulesList(prev => [moduleEntry, ...prev]);
    addNotification({
      type: 'success',
      icon: 'solar_power',
      title: 'New Solar Module Added',
      description: `Admin introduced ${brand} ${model} (${moduleEntry.wattage}W) to dealer catalogs.`,
      audience: 'all'
    });
    // Sync directly to Supabase DB
    await hardwareService.saveModule(moduleEntry);
    return moduleEntry;
  };

  const addNewInverter = async (newInverter) => {
    const brand = newInverter.brand?.trim() || 'Custom';
    const model = newInverter.model?.trim() || 'Solar Inverter';
    const id = newInverter.id || `inv-${Date.now()}`;
    const capStr = newInverter.capacity ? (String(newInverter.capacity).toLowerCase().includes('kw') ? newInverter.capacity : `${newInverter.capacity} kW`) : '5.0 kW';
    const inverterEntry = {
      id,
      brand,
      model,
      capacity: capStr,
      capacityKW: parseFloat(capStr.replace(/[^0-9.]/g, '')) || 5.0,
      phase: newInverter.phase || '1-Phase 230V / 2 MPPT',
      efficiency: newInverter.efficiency || '98.5%',
      warranty: newInverter.warranty || '8 Years',
      basePrice: newInverter.basePrice || '₹ 54,000',
      cloud: newInverter.cloud || 'Integrated Wi-Fi',
      isNew: true,
      createdAt: Date.now()
    };
    setInvertersList(prev => [inverterEntry, ...prev]);
    addNotification({
      type: 'success',
      icon: 'bolt',
      title: 'New Solar Inverter Added',
      description: `Admin introduced ${brand} ${model} (${inverterEntry.capacity}) to dealer catalogs.`,
      audience: 'all'
    });
    // Sync directly to Supabase DB
    await hardwareService.saveInverter(inverterEntry);
    return inverterEntry;
  };

  const markCatalogItemSeen = (itemId) => {
    if (!itemId) return;
    setSeenCatalogItemIds(prev => {
      if (prev.includes(itemId)) return prev;
      return [...prev, itemId];
    });
  };

  const isCatalogItemNew = (item) => {
    if (!item) return false;
    const itemId = item.id || `${item.brand}-${item.model}`;
    if (seenCatalogItemIds.includes(itemId)) return false;
    if (item.isNew) return true;
    if (item.createdAt && (Date.now() - item.createdAt < 7 * 24 * 3600 * 1000)) return true;
    return false;
  };

  const getResolvedBom = (capacityKW) => {
    return resolveCapacityBom(capacityKW, capacityBomMatrix, bomRates, bomCatalog);
  };

  // Auth Actions
  const login = (userRole, userProfile = null) => {
    startTransition(() => {
      setIsAuthenticated(true);
      setRole(userRole);
      if (userRole === 'admin') {
        setActiveTab('admin_dashboard');
        pushNotificationService.autoSyncIfPermitted({ userId: 'admin', role: 'admin' });
      } else if (userRole === 'staff') {
        const isVerification = Boolean(
          String(userProfile?.department || '').toLowerCase() === 'verification' ||
          String(userProfile?.role || '').toLowerCase().includes('verification')
        );
        setActiveTab(isVerification ? 'verification_desk' : 'staff_dashboard');
        if (userProfile) setCurrentStaff(userProfile);
        pushNotificationService.autoSyncIfPermitted({ userId: userProfile?.id || 'staff', role: 'staff' });
      } else {
        setActiveTab('dashboard');
        if (userProfile) setCurrentDealer(userProfile);
      }
    });
    // Immediately re-hydrate full database data with authenticated credentials
    setTimeout(() => {
      hydrateAllFromSupabase();
    }, 50);
  };

  const logout = () => {
    startTransition(() => {
      setIsAuthenticated(false);
      setAuthView('dealer_login', true);
    });
    localStorage.removeItem('sunvine_auth');
    localStorage.removeItem('sunvine_current_staff');
    if (typeof window !== 'undefined') {
      window.history.replaceState({ authView: 'dealer_login' }, '', '/login');
    }
    authService.logout().catch(() => {});
  };

  // The UI flag (localStorage) can outlive the HttpOnly JWT cookie (24h). Validate on load;
  // only a definite 401 logs the user out (network errors are ignored so offline use still works).
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/auth/verify', { credentials: 'include' })
      .then(res => { if (res.status === 401) logout(); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staff and Customer File Actions
  const addStaff = async (newStaff) => {
    // 1. Optimistically add to state (no localStorage — DB is source of truth)
    setStaffList(prev => [newStaff, ...prev.filter(s => s.id !== newStaff.id)]);

    try {
      const res = await staffService.createStaff(newStaff);
      if (res?.success) {
        // Retrieve newly confirmed record from DB if available
        const confirmedStaff = res.staff ? { ...newStaff, ...res.staff } : newStaff;
        setStaffList(prev => [confirmedStaff, ...prev.filter(s => s.id !== newStaff.id && s.id !== confirmedStaff.id)]);
      }
      broadcastDbEvent('SYNC_STAFF');
    } catch (e) {
      console.warn('[AppContext] Failed to sync staff to DB:', e);
    }

    logActivity({
      action: 'CREATE_STAFF',
      module: 'STAFF_MANAGEMENT',
      recordId: newStaff.id,
      details: `Staff member ${newStaff.name} (${newStaff.role} - ${newStaff.department}) onboarded.`
    });
  };

  const updateStaff = async (staffId, updatedFields) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, ...updatedFields } : s));
    if (currentStaff?.id === staffId) {
      setCurrentStaff(prev => ({ ...prev, ...updatedFields }));
    }
    try {
      await staffService.updateStaff(staffId, updatedFields);
      broadcastDbEvent('SYNC_STAFF');
    } catch (e) {
      console.warn('[AppContext] Failed to update staff in DB:', e);
    }
    logActivity({
      action: 'UPDATE_STAFF',
      module: 'STAFF_MANAGEMENT',
      recordId: staffId,
      details: `Staff member ${staffId} updated.`
    });
  };

  const updateStaffPassword = async (staffId, newPassword) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, password: newPassword } : s));
    if (currentStaff?.id === staffId) {
      setCurrentStaff(prev => ({ ...prev, password: newPassword }));
    }
    try {
      await staffService.updateStaffPassword(staffId, newPassword);
      broadcastDbEvent('SYNC_STAFF');
    } catch (e) {
      console.warn('[AppContext] Failed to update staff password in DB:', e);
    }
  };

  const deleteStaff = async (staffId) => {
    setStaffList(prev => prev.filter(s => s.id !== staffId));
    // Reassign any dealers belonging to this deleted salesman to Direct to Company (STF-DIRECT)
    setDealers(prev => prev.map(d => {
      if (d.assignedStaffId === staffId) {
        dealerService.updateDealer(d.id, {
          assignedStaffId: 'STF-DIRECT',
          assignedStaffName: 'Direct to Company (HQ Desk)'
        }).catch(() => {});
        return {
          ...d,
          assignedStaffId: 'STF-DIRECT',
          assignedStaffName: 'Direct to Company (HQ Desk)',
          pricingConfig: {
            ...(d.pricingConfig || {}),
            assignedStaffId: 'STF-DIRECT',
            assignedStaffName: 'Direct to Company (HQ Desk)'
          }
        };
      }
      return d;
    }));

    // Reassign any customer files belonging to this deleted salesman to active sales desk STF-801
    setCustomerFiles(prev => prev.map(f => {
      if (f.staffId === staffId) {
        customerFileService.updateCustomerFile(f.id, {
          staffId: 'STF-801',
          staffName: 'Sunvine Sales Staff'
        }).catch(() => {});
        return {
          ...f,
          staffId: 'STF-801',
          staffName: 'Sunvine Sales Staff'
        };
      }
      return f;
    }));
    try {
      await staffService.deleteStaff(staffId);
      broadcastDbEvent('SYNC_STAFF');
      broadcastDbEvent('SYNC_DEALERS');
      broadcastDbEvent('SYNC_FILES');
    } catch (e) {
      console.warn('[AppContext] Failed to delete staff in DB:', e);
    }
    logActivity({
      action: 'DELETE_STAFF',
      module: 'STAFF_MANAGEMENT',
      recordId: staffId,
      details: `Staff member ${staffId} deleted. Any assigned dealers reassigned to Direct HQ.`
    });
  };

  const addCustomerFile = async (newFile) => {
    // 1. Resolve Dealer Attribution
    const isDealerSourced = newFile.sourceType === 'DEALER' || newFile.source === 'DEALER' || role === 'dealer';
    let fileToSave = { ...newFile };

    if (isDealerSourced) {
      const matchingDealer = (dealers || []).find(d => d.id === newFile.dealerId || d.dealerCode === newFile.dealerId) || currentDealer;
      const assignedStaffId = newFile.staffId || matchingDealer?.assignedStaffId || 'STF-DIRECT';
      const assignedStaffName = newFile.staffName || matchingDealer?.assignedStaffName || (assignedStaffId === 'STF-DIRECT' ? 'Direct to Company (HQ Desk)' : 'Sunvine Sales Staff');

      fileToSave = {
        ...fileToSave,
        sourceType: 'DEALER',
        source: 'DEALER',
        dealerId: fileToSave.dealerId || matchingDealer?.id || matchingDealer?.dealerCode || 'DLR-001',
        dealerName: fileToSave.dealerName || matchingDealer?.firmName || matchingDealer?.name || 'Authorized Dealer',
        staffId: assignedStaffId,
        staffName: assignedStaffName
      };

      // 2. Dispatch OS-level Web Push notification + Slack notification to Admin & matching Salesman
      pushNotificationService.sendApplicationCreatedPush({
        fileId: fileToSave.id,
        customerName: fileToSave.customerName,
        solarKw: fileToSave.solarSystemKw,
        sanctionedLoadKw: fileToSave.sanctionedLoadKw,
        dealerId: fileToSave.dealerId,
        dealerName: fileToSave.dealerName,
        assignedStaffId,
        assignedStaffName,
        city: fileToSave.city,
        discom: fileToSave.discom || fileToSave.discomCircle,
        financeType: fileToSave.financeType || fileToSave.paymentMode,
        roofType: fileToSave.roofType
      });
    }

    setCustomerFiles(prev => [fileToSave, ...prev]);
    // Also update staff totalFiles and pipelineKw
    if (fileToSave.staffId) {
      setStaffList(prev => prev.map(s => s.id === fileToSave.staffId ? {
        ...s,
        totalFiles: (s.totalFiles || 0) + 1,
        pipelineKw: Number(((s.pipelineKw || 0) + (fileToSave.solarSystemKw || 0)).toFixed(1))
      } : s));
    }
    try {
      await customerFileService.saveCustomerFile(fileToSave);
    } catch (e) {
      console.warn('[AppContext] Failed to save customer file to DB:', e);
    }
  };

  const logActivity = (logEntry) => {
    const newLog = {
      id: logEntry.id || `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: logEntry.action || 'SYSTEM_ACTION',
      module: logEntry.module || 'SYSTEM',
      recordId: logEntry.recordId || '-',
      userId: logEntry.userId || (role === 'admin' ? 'ADM-001' : role === 'staff' ? currentStaff?.id : currentDealer?.id),
      userName: logEntry.userName || (role === 'admin' ? 'Super Admin Desk' : role === 'staff' ? currentStaff?.name : currentDealer?.contactPerson),
      role: logEntry.role || (role === 'admin' ? 'System Administrator' : role === 'staff' ? 'Staff Executive' : 'Authorized Dealer'),
      details: logEntry.details || '',
      oldValue: logEntry.oldValue !== undefined ? logEntry.oldValue : null,
      newValue: logEntry.newValue !== undefined ? logEntry.newValue : null,
      ipAddress: '192.168.1.104',
      status: 'VERIFIED'
    };
    setAuditLogs(prev => [newLog, ...(prev || [])]);
    settingsService.logActivity(newLog);
  };

  const updateSystemSettings = async (section, updates) => {
    let updatedSectionData = null;
    setSystemSettings(prev => {
      const currentSection = prev?.[section] || {};
      const updatedSection = { ...currentSection, ...updates };
      updatedSectionData = updatedSection;
      return {
        ...prev,
        [section]: updatedSection
      };
    });

    if (updatedSectionData) {
      try {
        await settingsService.saveSystemSettings(section, updatedSectionData);
      } catch (e) {
        console.warn('[AppContext] Failed to sync system settings to DB:', e);
      }
    }

    logActivity({
      action: 'UPDATE_SYSTEM_SETTINGS',
      module: 'SETTINGS',
      recordId: section,
      details: `Updated settings configuration for section: ${section}`,
      newValue: updates
    });

    addNotification({
      type: 'info',
      icon: 'tune',
      title: 'System Settings Updated',
      description: `Configuration changes saved for ${section}.`,
      audience: 'admin'
    });
  };

  const saveDesignRecord = (designData) => {
    const recordId = designData.id || `DSGN-${Date.now()}`;
    const newRecord = {
      ...designData,
      id: recordId,
      version: designData.version || 1,
      createdAt: designData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDesignRecords(prev => {
      const existingIdx = (prev || []).findIndex(d => d.id === recordId || (d.quotationId && d.quotationId === designData.quotationId));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], ...newRecord, version: (copy[existingIdx].version || 1) + 1 };
        return copy;
      }
      return [newRecord, ...(prev || [])];
    });

    logActivity({
      action: 'SAVE_SOLAR_DESIGN',
      module: 'DESIGN_CAD',
      recordId,
      details: `Solar ${designData.type || '2D'} CAD design layout saved for quotation ${designData.quotationId || 'Unlinked'}`
    });

    return newRecord;
  };

  const addCustomerFileTimelineEvent = async (fileId, event) => {
    const timestamp = new Date().toISOString();
    const newMilestone = {
      id: event.id || `TL-${Date.now()}`,
      timestamp,
      date: timestamp.split('T')[0],
      stage: event.stage || 'STAGE_UPDATE',
      title: event.title || event.stage || 'Milestone Reached',
      status: event.status || 'In Progress',
      action: event.action || 'STAGE_PROGRESSION',
      actor: event.actor || (role === 'admin' ? 'Admin Ops' : currentStaff?.name || 'Staff Representative'),
      notes: event.notes || ''
    };

    let targetUpdatedFile = null;
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedTimeline = [...(f.timeline || []), newMilestone];
      targetUpdatedFile = {
        ...f,
        currentStage: event.stage || f.currentStage,
        stage: event.stage || f.stage,
        status: event.status || f.status,
        isCompleted: event.isCompleted !== undefined ? event.isCompleted : f.isCompleted,
        isFailed: event.isFailed !== undefined ? event.isFailed : f.isFailed,
        failureReason: event.failureReason || f.failureReason,
        timeline: updatedTimeline
      };
      return targetUpdatedFile;
    }));

    if (targetUpdatedFile) {
      try {
        await customerFileService.updateCustomerFile(fileId, targetUpdatedFile);
      } catch (e) {
        console.warn('[AppContext] Failed to update file timeline in DB:', e);
      }

      // Dispatch stage progression notification to Slack & Push channels
      pushNotificationService.sendFileStageUpdatedNotification({
        fileId,
        customerName: targetUpdatedFile.customerName,
        newStage: event.stage || targetUpdatedFile.currentStage,
        status: event.status || targetUpdatedFile.status,
        dealerName: targetUpdatedFile.dealerName,
        actor: newMilestone.actor,
        notes: newMilestone.notes
      });
    }

    logActivity({
      action: 'ADD_FILE_TIMELINE_EVENT',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Added timeline milestone [${newMilestone.title}]: ${newMilestone.notes || 'Status updated'}`,
      newValue: event.status || event.stage
    });
  };

  const updateCustomerFile = async (fileId, updatedFields) => {
    setCustomerFiles(prev => prev.map(f => f.id === fileId ? { ...f, ...updatedFields } : f));
    try {
      await customerFileService.updateCustomerFile(fileId, updatedFields);
    } catch (e) {
      console.warn('[AppContext] Failed to update customer file in DB:', e);
    }
    logActivity({
      action: 'UPDATE_CUSTOMER_FILE',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Updated customer file attributes`,
      newValue: Object.keys(updatedFields).join(', ')
    });
  };

  const editCustomerFile = async (fileId, updatedFields) => {
    const timestamp = new Date().toISOString();
    const editMilestone = {
      id: `TL-${Date.now()}`,
      timestamp,
      date: timestamp.split('T')[0],
      stage: 'DETAILS_UPDATED',
      title: 'Customer Details Updated',
      status: 'Updated',
      action: 'EDIT_FILE',
      actor: role === 'admin' ? 'Admin Desk' : currentStaff?.name || currentDealer?.contactPerson || 'Authorized User',
      notes: `File details updated: ${Object.keys(updatedFields).filter(k => !['timeline', 'updatedAt'].includes(k)).join(', ')}`
    };

    let targetUpdatedFile = null;
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedTimeline = [...(f.timeline || []), editMilestone];
      targetUpdatedFile = {
        ...f,
        ...updatedFields,
        timeline: updatedTimeline,
        updatedAt: timestamp
      };
      return targetUpdatedFile;
    }));

    if (targetUpdatedFile) {
      try {
        await customerFileService.updateCustomerFile(fileId, targetUpdatedFile);
      } catch (e) {
        console.warn('[AppContext] Failed to save updated customer file in DB:', e);
      }
    }

    logActivity({
      action: 'EDIT_CUSTOMER_FILE',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Edited customer file details for ${fileId}`
    });

    broadcastDbEvent('SYNC_FILES');
    return targetUpdatedFile;
  };

  const cancelCustomerFile = async (fileId, reason = 'Cancelled by user') => {
    const timestamp = new Date().toISOString();
    const actorName = role === 'admin' ? 'Admin Desk' : currentStaff?.name || currentDealer?.contactPerson || 'Authorized User';
    const cancelMilestone = {
      id: `TL-${Date.now()}`,
      timestamp,
      date: timestamp.split('T')[0],
      stage: 'CANCELLED',
      title: 'Customer File Cancelled',
      status: 'Cancelled',
      action: 'CANCEL_FILE',
      actor: actorName,
      notes: `Cancellation reason: ${reason}`
    };

    let targetCancelledFile = null;
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedTimeline = [...(f.timeline || []), cancelMilestone];
      targetCancelledFile = {
        ...f,
        status: 'Cancelled',
        stage: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: timestamp,
        cancelledBy: actorName,
        timeline: updatedTimeline,
        updatedAt: timestamp
      };
      return targetCancelledFile;
    }));

    try {
      await customerFileService.cancelCustomerFile(fileId, reason, actorName);
    } catch (e) {
      console.warn('[AppContext] Failed to cancel customer file in DB:', e);
    }

    if (targetCancelledFile) {
      pushNotificationService.sendFileCancelledNotification({
        fileId,
        customerName: targetCancelledFile.customerName,
        reason,
        cancelledBy: actorName
      });
    }

    logActivity({
      action: 'CANCEL_CUSTOMER_FILE',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Cancelled customer file ${fileId}. Reason: ${reason}`
    });

    broadcastDbEvent('SYNC_FILES');
    return targetCancelledFile;
  };

  const restoreCustomerFile = async (fileId) => {
    const targetFile = (customerFiles || []).find(f => f.id === fileId);
    if (targetFile?.cancelledAt) {
      const cancelTime = new Date(targetFile.cancelledAt).getTime();
      const diffDays = (Date.now() - cancelTime) / (1000 * 60 * 60 * 24);
      if (diffDays > 14) {
        throw new Error('Restoration locked: The 14-day recovery window for this cancelled file has expired.');
      }
    }

    const timestamp = new Date().toISOString();
    const restoreMilestone = {
      id: `TL-${Date.now()}`,
      timestamp,
      date: timestamp.split('T')[0],
      stage: 'LEAD_SOURCED',
      title: 'Customer File Restored',
      status: 'Sourced',
      action: 'RESTORE_FILE',
      actor: role === 'admin' ? 'Admin Desk' : currentStaff?.name || currentDealer?.contactPerson || 'Authorized User',
      notes: 'File restored to active Sourced pipeline.'
    };

    let targetRestoredFile = null;
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedTimeline = [...(f.timeline || []), restoreMilestone];
      targetRestoredFile = {
        ...f,
        status: 'Sourced',
        stage: 'LEAD_SOURCED',
        cancellationReason: null,
        cancelledAt: null,
        cancelledBy: null,
        timeline: updatedTimeline,
        updatedAt: timestamp
      };
      return targetRestoredFile;
    }));

    try {
      await customerFileService.restoreCustomerFile(fileId, targetFile);
    } catch (e) {
      console.warn('[AppContext] Failed to restore customer file in DB:', e);
      throw e;
    }

    if (targetRestoredFile) {
      pushNotificationService.sendFileRestoredNotification({
        fileId,
        customerName: targetRestoredFile.customerName,
        restoredBy: restoreMilestone.actor
      });
    }

    logActivity({
      action: 'RESTORE_CUSTOMER_FILE',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Restored customer file ${fileId} back to active Sourced pipeline.`
    });

    broadcastDbEvent('SYNC_FILES');
    return targetRestoredFile;
  };

  const deleteCustomerFile = async (fileId) => {
    const targetFile = (customerFiles || []).find(f => f.id === fileId);
    setCustomerFiles(prev => prev.filter(f => f.id !== fileId));
    try {
      await customerFileService.deleteCustomerFile(fileId, targetFile);
    } catch (e) {
      console.warn('[AppContext] Failed to delete customer file in DB:', e);
    }
    logActivity({
      action: 'DELETE_CUSTOMER_FILE',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Permanently purged customer file ${fileId} and all attached documents from storage.`
    });
    broadcastDbEvent('SYNC_FILES');
  };

  const updateFileStatus = async (fileId, nextStatus, notes = '') => {
    let targetUpdatedFile = null;
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedTimeline = [
        ...(f.timeline || []),
        {
          id: `TL-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          stage: f.currentStage,
          title: `Status changed to ${nextStatus}`,
          status: nextStatus,
          action: 'STATUS_CHANGE',
          actor: role === 'admin' ? 'Admin Desk' : currentStaff?.name || 'Staff Representative',
          notes: notes || `Status changed from ${f.status} to ${nextStatus}`
        }
      ];
      targetUpdatedFile = {
        ...f,
        status: nextStatus,
        isCompleted: nextStatus === 'Subsidized' || nextStatus === 'Completed',
        timeline: updatedTimeline
      };
      return targetUpdatedFile;
    }));

    if (targetUpdatedFile) {
      try {
        await customerFileService.updateCustomerFile(fileId, targetUpdatedFile);
      } catch (e) {
        console.warn('[AppContext] Failed to update file status in DB:', e);
      }
    }

    logActivity({
      action: 'UPDATE_FILE_STATUS',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Status updated to ${nextStatus}`,
      newValue: nextStatus
    });
  };

  const updateDealerProfile = async (updatedFields) => {
    const updated = { ...currentDealer, ...updatedFields };
    setCurrentDealer(updated);
    setDealers(prev => prev.map(d => d.id === currentDealer.id ? updated : d));
    try {
      await dealerService.updateDealer(currentDealer.id || currentDealer.dealerCode, updatedFields);
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer profile in DB:', e);
    }
  };

  // Quotation Actions
  const addQuotation = (newQuote) => {
    const updated = [newQuote, ...quotations];
    setQuotations(updated);
    setPreviewQuotation(newQuote);
    // Sync directly to Supabase DB
    quotationService.saveQuotation(newQuote);
  };

  const updateQuotation = (updatedQuote) => {
    setQuotations(prev => {
      const exists = prev.some(q => q.id === updatedQuote.id);
      if (exists) {
        return prev.map(q => q.id === updatedQuote.id ? { ...q, ...updatedQuote } : q);
      }
      return [updatedQuote, ...prev];
    });
    setPreviewQuotation(updatedQuote);
    setEditingQuotation(null);
    // Sync directly to Supabase DB
    quotationService.saveQuotation(updatedQuote);
  };

  const startEditingQuotation = (quote) => {
    setEditingQuotation(quote);
    setActiveTab('create_quote');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    }
  };

  const clearEditingQuotation = () => {
    setEditingQuotation(null);
  };

  const updateQuotationStatus = (id, newStatus) => {
    setQuotations(prev => {
      const updated = prev.map(q => q.id === id ? { ...q, status: newStatus } : q);
      const target = updated.find(q => q.id === id);
      if (target) {
        quotationService.saveQuotation(target);
      }
      return updated;
    });
  };

  const addDealer = async (newDealer) => {
    setDealers(prev => [newDealer, ...prev]);
    broadcastDbEvent('SYNC_DEALERS');
    try {
      await dealerService.createDealer(newDealer);
      broadcastDbEvent('SYNC_DEALERS');
    } catch (e) {
      console.warn('[AppContext] Failed to create dealer in DB:', e);
    }
  };

  const updateDealer = async (updatedDealer) => {
    if (!updatedDealer) return;
    const cleanId = String(updatedDealer.id || updatedDealer.dealerCode || '').replace(/^#/, '');
    const cleanEmail = (updatedDealer.email && String(updatedDealer.email).trim()) ? String(updatedDealer.email).trim() : null;
    const finalUpdated = { ...updatedDealer, email: cleanEmail };

    setDealers(prev => prev.map(d => {
      const dCode = String(d.id || d.dealerCode || '').replace(/^#/, '');
      if (dCode === cleanId || d.id === updatedDealer.id || d.dealerCode === updatedDealer.dealerCode) {
        return { ...d, ...finalUpdated };
      }
      return d;
    }));
    if (currentDealer && (String(currentDealer.id || currentDealer.dealerCode || '').replace(/^#/, '') === cleanId)) {
      setCurrentDealer(prev => ({ ...prev, ...finalUpdated }));
    }
    broadcastDbEvent('SYNC_DEALERS');
    try {
      await dealerService.updateDealer(updatedDealer.id || updatedDealer.dealerCode, finalUpdated);
      broadcastDbEvent('SYNC_DEALERS');
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer in DB:', e);
    }
  };

  const toggleDealerStatus = async (id) => {
    let nextStatus = 'Active';
    setDealers(prev => prev.map(d => {
      if (d.id === id) {
        nextStatus = d.status === 'Active' ? 'Suspended' : 'Active';
        return { ...d, status: nextStatus };
      }
      return d;
    }));
    broadcastDbEvent('SYNC_DEALERS');
    try {
      await dealerService.updateDealer(id, { status: nextStatus });
      broadcastDbEvent('SYNC_DEALERS');
    } catch (e) {
      console.warn('[AppContext] Failed to toggle dealer status in DB:', e);
    }
  };

  const updateDealerMarginCap = async (id, newCap) => {
    const numericCap = Number(newCap);
    setDealers(prev => {
      return prev.map(d => d.id === id ? { ...d, maxMarginCapPerKw: numericCap } : d);
    });
    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({ ...prev, maxMarginCapPerKw: numericCap }));
    }
    broadcastDbEvent('SYNC_DEALERS');
    try {
      await dealerService.updateDealer(id, { maxMarginCapPerKw: numericCap });
      broadcastDbEvent('SYNC_DEALERS');
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer margin in DB:', e);
    }
  };

  const updateDealerPassword = async (id, newPassword) => {
    setDealers(prev => prev.map(d => d.id === id ? { ...d, password: newPassword } : d));
    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({ ...prev, password: newPassword }));
    }
    broadcastDbEvent('SYNC_DEALERS');
    try {
      await authService.updatePassword('dealer', id, newPassword);
      broadcastDbEvent('SYNC_DEALERS');
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer password in DB:', e);
    }
  };

  const deleteDealer = async (id) => {
    setDealers(prev => prev.filter(d => d.id !== id && d.dealerCode !== id));
    if (currentDealer?.id === id || currentDealer?.dealerCode === id) {
      setCurrentDealer(null);
    }
    // Convert attached customer files from DEALER to DIRECT_STAFF
    setCustomerFiles(prev => prev.map(f => {
      if (f.dealerId === id || f.dealer_id === id) {
        customerFileService.updateCustomerFile(f.id, {
          sourceType: 'DIRECT_STAFF',
          source: 'DIRECT_STAFF',
          dealerId: null,
          dealerName: null
        }).catch(() => {});
        return {
          ...f,
          sourceType: 'DIRECT_STAFF',
          source: 'DIRECT_STAFF',
          dealerId: null,
          dealerName: null
        };
      }
      return f;
    }));
    broadcastDbEvent('SYNC_DEALERS');
    broadcastDbEvent('SYNC_FILES');
    try {
      await dealerService.deleteDealer(id);
      broadcastDbEvent('SYNC_DEALERS');
    } catch (e) {
      console.warn('[AppContext] Failed to delete dealer in DB:', e);
    }
    logActivity({
      action: 'DELETE_DEALER',
      module: 'DEALER_MANAGEMENT',
      recordId: id,
      details: `Admin deleted dealer partner ${id} from network register. Attached customer files converted to Direct Staff.`
    });
  };

  // Dynamic Required Documents Management Methods
  const addRequiredDocument = async (newDoc) => {
    const docEntry = {
      id: newDoc.id || `doc-${Date.now()}`,
      key: newDoc.key || `doc_${Date.now()}`,
      label: (newDoc.label || 'New Document').trim(),
      description: (newDoc.description || '').trim(),
      icon: newDoc.icon || 'description',
      categories: Array.isArray(newDoc.categories) && newDoc.categories.length > 0 ? newDoc.categories : ['residential'],
      mandatory: Boolean(newDoc.mandatory),
      allowedExtensions: newDoc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png'],
      captureMode: newDoc.captureMode || 'both'
    };
    const nextList = [...requiredDocuments, docEntry];
    setRequiredDocuments(nextList);
    updateSystemSettings('requiredDocuments', nextList);
    return docEntry;
  };

  const updateRequiredDocument = async (docId, updates) => {
    const nextList = requiredDocuments.map(d => d.id === docId ? { ...d, ...updates } : d);
    setRequiredDocuments(nextList);
    updateSystemSettings('requiredDocuments', nextList);
  };

  const deleteRequiredDocument = async (docId) => {
    const nextList = requiredDocuments.filter(d => d.id !== docId);
    setRequiredDocuments(nextList);
    updateSystemSettings('requiredDocuments', nextList);
  };

  const resetRequiredDocuments = () => {
    setRequiredDocuments(DEFAULT_REQUIRED_DOCUMENTS);
    updateSystemSettings('requiredDocuments', DEFAULT_REQUIRED_DOCUMENTS);
  };

  // Application Stages Management Handlers
  const addApplicationStage = (stageData) => {
    const newStage = {
      id: stageData.id ? stageData.id.trim() : `STAGE_${Date.now().toString().slice(-4)}`,
      label: stageData.label.trim(),
      description: stageData.description?.trim() || '',
      mandatory: stageData.mandatory !== undefined ? stageData.mandatory : true,
      order: stageData.order || (applicationStages.length + 1)
    };
    const nextList = [...applicationStages, newStage];
    setApplicationStages(nextList);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: nextList,
      stages: nextList.map(s => s.label)
    });
    return newStage;
  };

  const updateApplicationStage = (stageId, updates) => {
    const nextList = applicationStages.map(s => s.id === stageId ? { ...s, ...updates } : s);
    setApplicationStages(nextList);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: nextList,
      stages: nextList.map(s => s.label)
    });
  };

  const deleteApplicationStage = (stageId) => {
    const nextList = applicationStages.filter(s => s.id !== stageId);
    setApplicationStages(nextList);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: nextList,
      stages: nextList.map(s => s.label)
    });
  };

  const resetApplicationStages = () => {
    setApplicationStages(DEFAULT_PIPELINE_STAGES);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: DEFAULT_PIPELINE_STAGES,
      stages: DEFAULT_PIPELINE_STAGES.map(s => s.label)
    });
  };

  const updateDealerPricing = (id, pricingConfig) => {
    setDealers(prev => {
      const updated = prev.map(d => {
        if (d.id !== id) return d;
        const mergedConfig = {
          ...(d.pricingConfig || {}),
          ...pricingConfig
        };
        return {
          ...d,
          pricingConfig: mergedConfig
        };
      });
      return updated;
    });

    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({
        ...prev,
        pricingConfig: {
          ...(prev.pricingConfig || {}),
          ...pricingConfig
        }
      }));
    }

    // Persist to Supabase
    pricingService.saveDealerPricing(id, pricingConfig).catch(err => {
      console.warn('[AppContext] saveDealerPricing error:', err);
    });

    logActivity({
      action: 'UPDATE_DEALER_PRICING',
      module: 'DEALER_MANAGEMENT',
      recordId: id,
      details: `Custom pricing configured: Mode=${pricingConfig.pricingMode || 'standard'}, Wp=₹${pricingConfig.customBaseRatePerWp || 'N/A'}, kW=₹${pricingConfig.customBaseRatePerKw || 'N/A'}`
    });
  };

  const updateDealerProductRate = (dealerId, productId, customRate, productMeta = {}) => {
    let updatedConfig = null;
    const numRate = Number(customRate);

    setDealers(prev => {
      const updated = prev.map(d => {
        if (d.id !== dealerId && d.dealerCode !== dealerId) return d;
        const currentCfg = d.pricingConfig || {};
        const currentProductRates = { ...(currentCfg.customProductRates || {}) };
        const currentBomRates = { ...(currentCfg.customBomRates || {}) };
        const productDetails = { ...(currentCfg.productDetails || {}) };

        // Clean up legacy duplicate name key if it was previously set
        if (productMeta.name && productMeta.name !== productId) {
          delete currentProductRates[productMeta.name];
        }

        currentProductRates[productId] = numRate;

        if (productMeta.category === 'bom') {
          currentBomRates[productId] = numRate;
        }

        productDetails[productId] = {
          id: productId,
          name: productMeta.name || productId,
          category: productMeta.category || 'general',
          benchmarkPrice: productMeta.benchmarkPrice || 0,
          customPrice: numRate,
          unit: productMeta.unit || '₹',
          updatedAt: new Date().toISOString()
        };

        updatedConfig = {
          ...currentCfg,
          pricingMode: 'custom',
          customProductRates: currentProductRates,
          customBomRates: currentBomRates,
          productDetails
        };

        return {
          ...d,
          pricingConfig: updatedConfig
        };
      });
      return updated;
    });

    if (updatedConfig) {
      if (currentDealer?.id === dealerId) {
        setCurrentDealer(prev => ({
          ...prev,
          pricingConfig: updatedConfig
        }));
      }

      pricingService.saveDealerPricing(dealerId, updatedConfig).catch(err => {
        console.warn('[AppContext] saveDealerPricing error:', err);
      });

      logActivity({
        action: 'UPDATE_DEALER_PRODUCT_RATE',
        module: 'PRICING_MASTER',
        recordId: dealerId,
        details: `Updated custom price for product "${productMeta.name || productId}": ₹${numRate} (${productMeta.unit || ''}) for dealer ${dealerId}`
      });
    }
  };

  const removeDealerProductRate = (dealerId, productId) => {
    let updatedConfig = null;
    setDealers(prev => {
      const updated = prev.map(d => {
        if (d.id !== dealerId && d.dealerCode !== dealerId) return d;
        const currentCfg = d.pricingConfig || {};
        const currentProductRates = { ...(currentCfg.customProductRates || {}) };
        const currentBomRates = { ...(currentCfg.customBomRates || {}) };
        const productDetails = { ...(currentCfg.productDetails || {}) };

        const removedName = productDetails[productId]?.name;
        delete currentProductRates[productId];
        if (removedName) {
          delete currentProductRates[removedName];
        }
        delete currentBomRates[productId];
        delete productDetails[productId];

        updatedConfig = {
          ...currentCfg,
          customProductRates: currentProductRates,
          customBomRates: currentBomRates,
          productDetails
        };
        return {
          ...d,
          pricingConfig: updatedConfig
        };
      });
      return updated;
    });

    if (updatedConfig) {
      if (currentDealer?.id === dealerId) {
        setCurrentDealer(prev => ({
          ...prev,
          pricingConfig: updatedConfig
        }));
      }

      pricingService.saveDealerPricing(dealerId, updatedConfig).catch(err => {
        console.warn('[AppContext] saveDealerPricing error:', err);
      });

      logActivity({
        action: 'REMOVE_DEALER_PRODUCT_RATE',
        module: 'PRICING_MASTER',
        recordId: dealerId,
        details: `Removed custom negotiated price for product ${productId} on dealer ${dealerId}`
      });
    }
  };

  const saveKitPreset = async (kitData) => {
    const newKit = {
      ...kitData,
      id: kitData.id || `kit-${Date.now()}`,
      createdAt: kitData.createdAt || new Date().toISOString()
    };
    setKitsPresets(prev => {
      const idx = prev.findIndex(k => k.id === newKit.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newKit;
        return copy;
      }
      return [newKit, ...prev];
    });
    try {
      await pricingService.saveKitPreset(newKit);
    } catch (e) {
      console.warn('[AppContext] Failed to sync kit to Supabase:', e);
    }
    return newKit;
  };

  const deleteKitPreset = async (kitId) => {
    setKitsPresets(prev => prev.filter(k => k.id !== kitId));
    try {
      await pricingService.deleteKitPreset(kitId);
    } catch (e) {
      console.warn('[AppContext] Failed to delete kit from Supabase:', e);
    }
  };

  const getAccessibleDealers = () => {
    if (role === 'admin') return dealers;
    if (role === 'staff') {
      if (currentStaff?.department === 'verification') return dealers;
      const staffId = currentStaff?.id || 'STF-801';
      return dealers.filter(d => d.assignedStaffId === staffId);
    }
    if (currentDealer) return [currentDealer];
    return dealers;
  };

  const updatePricingMaster = (newMaster) => {
    setPricingMaster(newMaster);
  };

  const updatePricingPresets = async (newPresets) => {
    const isDifferent = Object.keys(newPresets || {}).some(key => {
      if (key === 'lastSynced') return false;
      return String(newPresets[key]) !== String(pricingPresets[key]);
    });
    if (!isDifferent) return;

    const timeStr = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
    const updated = {
      ...pricingPresets,
      ...newPresets,
      lastSynced: `Today, ${timeStr} by ${role === 'admin' ? 'Super Admin Desk' : 'Ops'}`
    };
    setPricingPresets(updated);
    pricingService.savePricingPresets(updated);
    try {
      await settingsService.savePricingPresets(updated);
    } catch (e) {
      console.warn('[AppContext] Failed to sync pricing presets to DB:', e);
    }
    addNotification({
      title: 'Quotation Presets Updated',
      description: `Base Rate: ₹${Number(updated.baseRatePerKw).toLocaleString('en-IN')}/kW | Min Margin: ₹${Number(updated.minMarginPerKw).toLocaleString('en-IN')}/kW.`,
      category: 'pricing',
      icon: 'tune'
    });
  };

  const updateTierMargins = async (newTiers) => {
    const isDifferent = Object.keys(newTiers || {}).some(tierKey => {
      const existing = tierMargins?.[tierKey];
      const updated = newTiers[tierKey];
      if (!existing || !updated) return true;
      return Number(existing.defaultMarginPerKw) !== Number(updated.defaultMarginPerKw) ||
             Number(existing.maxMarginCapPerKw) !== Number(updated.maxMarginCapPerKw);
    });
    if (!isDifferent) return;

    const updated = { ...tierMargins, ...newTiers };
    setTierMargins(updated);
    pricingService.saveTierMargins(updated);
    try {
      await settingsService.savePricingPresets({ tierMargins: updated });
    } catch (e) {
      console.warn('[AppContext] Failed to sync tier margins to DB:', e);
    }
    addNotification({
      title: 'Dealer Tier Margins Updated',
      description: `Default margin thresholds updated for Diamond, Platinum, Gold & Silver dealer tiers.`,
      category: 'pricing',
      icon: 'price_check',
      audience: 'all'
    });
  };

  const updateGovernanceSettings = async (newSettings) => {
    const isDifferent = Object.keys(newSettings || {}).some(key => {
      return String(newSettings[key]) !== String(governanceSettings?.[key]);
    });
    if (!isDifferent) return;

    const updated = { ...governanceSettings, ...newSettings };
    setGovernanceSettings(updated);
    try {
      await settingsService.saveSystemSettings('governanceSettings', updated);
    } catch (e) {
      console.warn('[AppContext] Failed to sync governance settings to DB:', e);
    }

    // If maxDealerMarginPerKW was updated, adjust any tier margin caps that exceed this national ceiling
    if (newSettings.maxDealerMarginPerKW) {
      const ceilingCap = Number(newSettings.maxDealerMarginPerKW);
      setTierMargins(prev => {
        const updatedTiers = { ...prev };
        let modified = false;
        Object.keys(updatedTiers).forEach(key => {
          if (updatedTiers[key] && updatedTiers[key].maxMarginCapPerKw > ceilingCap) {
            updatedTiers[key] = { ...updatedTiers[key], maxMarginCapPerKw: ceilingCap };
            modified = true;
          }
        });
        return modified ? updatedTiers : prev;
      });
    }

    addNotification({
      type: 'warning',
      icon: 'shield',
      title: 'Margin Governance & Policy Updated',
      description: `Max dealer margin ceiling set to ₹${Number(updated.maxDealerMarginPerKW).toLocaleString('en-IN')}/kW. Quote expiry: ${updated.quoteExpiryDays} days.`,
      targetTab: 'dealer_settings',
      audience: 'all'
    });
  };

  // Persistent read state IDs keyed by role
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`sunvine_read_notifs_${role}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Keep readNotifIds in sync if role changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sunvine_read_notifs_${role}`);
      setReadNotifIds(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setReadNotifIds([]);
    }
  }, [role]);

  // Persistent dismissed popup IDs keyed by role
  const [dismissedPopupIds, setDismissedPopupIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_popups_${role}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_popups_${role}`);
      setDismissedPopupIds(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setDismissedPopupIds([]);
    }
  }, [role]);

  // Persistent dismissed notification IDs across sessions (SR-46)
  const [dismissedNotifIds, setDismissedNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_notifs_${role}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_notifs_${role}`);
      setDismissedNotifIds(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setDismissedNotifIds([]);
    }
  }, [role]);

  const persistReadIds = (ids) => {
    setReadNotifIds(ids);
    safeSetItem(`sunvine_read_notifs_${role}`, ids);
  };

  const dismissPopupNotification = (id) => {
    setDismissedPopupIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      safeSetItem(`sunvine_dismissed_popups_${role}`, updated);
      return updated;
    });
  };

  // Role-partitioned visible notifications with real-time persistent read and dismissal status
  const visibleNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        if (dismissedNotifIds.includes(n.id)) return false;
        const aud = n.audience || 'all';
        if (aud === 'all') return true;
        return aud === role;
      })
      .map(n => ({
        ...n,
        read: readNotifIds.includes(n.id)
      }));
  }, [notifications, role, readNotifIds, dismissedNotifIds]);

  const unreadNotificationsCount = useMemo(() => {
    return visibleNotifications.filter(n => !n.read).length;
  }, [visibleNotifications]);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [selectedChangelogVersion, setSelectedChangelogVersion] = useState(null);

  const openChangelogModal = (version = null) => {
    setSelectedChangelogVersion(version);
    setIsChangelogModalOpen(true);
  };

  const markNotificationAsRead = (id) => {
    if (!readNotifIds.includes(id)) {
      persistReadIds([...readNotifIds, id]);
    }
  };

  const markAllNotificationsAsRead = () => {
    const allVisibleIds = visibleNotifications.map(n => n.id);
    const merged = Array.from(new Set([...readNotifIds, ...allVisibleIds]));
    persistReadIds(merged);
  };

  const deleteNotification = (id) => {
    setDismissedNotifIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      safeSetItem(`sunvine_dismissed_notifs_${role}`, updated);
      return updated;
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    const visibleIds = visibleNotifications.map(n => n.id);
    setDismissedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...visibleIds]));
      safeSetItem(`sunvine_dismissed_notifs_${role}`, updated);
      return updated;
    });
    setNotifications(prev => prev.filter(n => !visibleIds.includes(n.id)));
  };

  const addNotification = (notif) => {
    const newNotif = {
      id: notif.id || `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
      audience: notif.audience || (role === 'admin' ? 'admin' : 'dealer'),
      type: notif.type || 'info',
      ...notif
    };
    // If a new or updated notification arrives, remove from dismissed IDs so popup shows
    setDismissedPopupIds(prev => {
      const updated = prev.filter(id => id !== newNotif.id);
      safeSetItem(`sunvine_dismissed_popups_${role}`, updated);
      return updated;
    });
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== newNotif.id);
      return [newNotif, ...filtered];
    });
  };

  // Master Document Registry & Dynamic Category Rules Engine
  const addMasterDocument = async (newDoc) => {
    if (!newDoc || !newDoc.key) return;
    const cleanKey = newDoc.key.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const docItem = {
      key: cleanKey,
      label: newDoc.label?.trim() || cleanKey,
      category: newDoc.category || 'General KYC',
      description: newDoc.description?.trim() || 'Required customer document',
      icon: newDoc.icon || 'description',
      allowedExtensions: newDoc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
      isCustom: true
    };

    let nextRegistry;
    let nextRules;

    setMasterDocRegistry(prev => {
      const exists = prev.some(d => d.key === docItem.key);
      nextRegistry = exists ? prev.map(d => d.key === docItem.key ? { ...d, ...docItem } : d) : [...prev, docItem];
      return nextRegistry;
    });

    setCategoryDocRules(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(catKey => {
        if (!updated[catKey][docItem.key]) {
          updated[catKey] = { ...updated[catKey], [docItem.key]: 'optional' };
        }
      });
      nextRules = updated;
      return updated;
    });

    const rulesForDoc = {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'optional',
      NBFC_LOAN: 'optional',
      COMMERCIAL: 'optional',
      HOUSING_SOCIETY: 'optional'
    };

    try {
      await documentMasterService.upsertDocument(docItem, rulesForDoc);
      if (nextRegistry && nextRules) {
        await systemSettingsService.saveDocumentRules(nextRegistry, nextRules);
      }
    } catch (err) {
      console.warn('Sync add document error:', err);
    }
  };

  const updateMasterDocument = async (docKey, updatedFields) => {
    let updatedDoc;
    setMasterDocRegistry(prev => {
      const next = prev.map(d => {
        if (d.key === docKey) {
          updatedDoc = { ...d, ...updatedFields };
          return updatedDoc;
        }
        return d;
      });
      return next;
    });

    try {
      if (updatedDoc) {
        const rulesForDoc = {
          RESIDENTIAL: categoryDocRules.RESIDENTIAL?.[docKey] || 'mandatory',
          BANK_LOAN: categoryDocRules.BANK_LOAN?.[docKey] || 'mandatory',
          NBFC_LOAN: categoryDocRules.NBFC_LOAN?.[docKey] || 'mandatory',
          COMMERCIAL: categoryDocRules.COMMERCIAL?.[docKey] || 'mandatory',
          HOUSING_SOCIETY: categoryDocRules.HOUSING_SOCIETY?.[docKey] || 'mandatory'
        };
        await documentMasterService.upsertDocument(updatedDoc, rulesForDoc);
      }
      await systemSettingsService.saveDocumentRules(masterDocRegistry, categoryDocRules);
    } catch (err) {
      console.warn('Sync update document error:', err);
    }
  };

  const deleteMasterDocument = async (docKey) => {
    let nextRegistry;
    let nextRules;

    setMasterDocRegistry(prev => {
      nextRegistry = prev.filter(d => d.key !== docKey);
      return nextRegistry;
    });

    setCategoryDocRules(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(catKey => {
        const catCopy = { ...updated[catKey] };
        delete catCopy[docKey];
        updated[catKey] = catCopy;
      });
      nextRules = updated;
      return updated;
    });

    try {
      await documentMasterService.deleteDocument(docKey);
      if (nextRegistry && nextRules) {
        await systemSettingsService.saveDocumentRules(nextRegistry, nextRules);
      }
    } catch (err) {
      console.warn('Sync delete document error:', err);
    }
  };

  const updateCategoryDocRule = async (categoryKey, docKey, ruleStatus) => {
    let updatedRules;
    setCategoryDocRules(prev => {
      updatedRules = {
        ...prev,
        [categoryKey]: {
          ...(prev[categoryKey] || {}),
          [docKey]: ruleStatus // 'mandatory' | 'optional' | 'disabled'
        }
      };
      return updatedRules;
    });

    try {
      await documentMasterService.updateDocumentCategoryRule(docKey, categoryKey, ruleStatus);
      if (updatedRules) {
        await systemSettingsService.saveDocumentRules(masterDocRegistry, updatedRules);
      }
    } catch (err) {
      console.warn('Sync rule error:', err);
    }
  };

  const resetDocumentRulesToDefault = async () => {
    setMasterDocRegistry(DEFAULT_MASTER_DOCUMENT_REGISTRY);
    setCategoryDocRules(DEFAULT_CATEGORY_DOC_RULES);
    try {
      await documentMasterService.seedDefaultRegistry();
      await systemSettingsService.saveDocumentRules(DEFAULT_MASTER_DOCUMENT_REGISTRY, DEFAULT_CATEGORY_DOC_RULES);
    } catch (err) {
      console.warn('Sync reset error:', err);
    }
  };

  const refreshMasterDocuments = async () => {
    try {
      const freshDocs = await documentMasterService.fetchDocumentMaster();
      if (freshDocs && Array.isArray(freshDocs.registry) && freshDocs.registry.length > 0) {
        setMasterDocRegistry(freshDocs.registry);
        if (freshDocs.rules) setCategoryDocRules(freshDocs.rules);
        return freshDocs;
      }
    } catch (err) {
      console.warn('[AppContext] refreshMasterDocuments error:', err);
    }
    return null;
  };

  const getFileDocuments = (file) => {
    return getDocumentListForFile(file, masterDocRegistry, categoryDocRules);
  };

  const getFileDocsCompletion = (file) => {
    return getDocumentCompletion(file, masterDocRegistry, categoryDocRules);
  };

  const contextValue = useMemo(() => ({
    isAuthenticated,
    authView,
    setAuthView,
    login,
    logout,
    role,
    setRole,
    activeTab,
    setActiveTab,
    highlightedFileId,
    setHighlightedFileId,
    currentDealer,
    setCurrentDealer,
    updateDealerProfile,
    currentStaff,
    setCurrentStaff,
    staffList,
    setStaffList,
    customerFiles,
    setCustomerFiles,
    refreshCustomerFiles,
    refreshStaffList,
    customerFilesError,
    addStaff,
    updateStaff,
    updateStaffPassword,
    deleteStaff,
    addCustomerFile,
    updateCustomerFile,
    editCustomerFile,
    cancelCustomerFile,
    restoreCustomerFile,
    deleteCustomerFile,
    updateFileStatus,
    pricingMaster,
    updatePricingMaster,
    pricingPresets,
    updatePricingPresets,
    tierMargins,
    updateTierMargins,
    governanceSettings,
    updateGovernanceSettings,
    modulesList,
    setModulesList,
    invertersList,
    setInvertersList,
    isHardwareDbSyncing,
    isHardwareDbConnected,
    hardwareService,
    dealers,
    addDealer,
    updateDealer,
    deleteDealer,
    toggleDealerStatus,
    updateDealerMarginCap,
    updateDealerPassword,
    updateDealerPricing,
    updateDealerProductRate,
    removeDealerProductRate,
    getAccessibleDealers,
    kitsPresets,
    saveKitPreset,
    deleteKitPreset,
    quotations,
    addQuotation,
    updateQuotation,
    editingQuotation,
    startEditingQuotation,
    clearEditingQuotation,
    activeDraftQuote,
    setActiveDraftQuote,
    clearActiveDraftQuote,
    updateQuotationStatus,
    previewQuotation,
    setPreviewQuotation,
    notifications: visibleNotifications,
    unreadNotificationsCount,
    notificationsOpen,
    setNotificationsOpen,
    isChangelogModalOpen,
    setIsChangelogModalOpen,
    selectedChangelogVersion,
    openChangelogModal,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    addNotification,
    dismissedPopupIds,
    dismissPopupNotification,
    dismissedNotifIds,
    pdfBosMatrix,
    setPdfBosMatrix,
    inverterBenchmarkMatrix,
    setInverterBenchmarkMatrix,
    pdfBomSpecs: PDF_BOM_SPECIFICATIONS,
    officialProfile: SUNVINE_OFFICIAL_PROFILE,
    // Standard BOM & BoS Engine
    bomCatalog,
    setBomCatalog,
    bomCategories: STANDARD_BOM_CATEGORIES,
    bomRates,
    setBomRates,
    updateBomItemRate,
    capacityBomMatrix,
    updateCapacityBomItemQty,
    updateCapacityBomPreset,
    getResolvedBom,
    addBomItem,
    updateBomItem,
    deleteBomItem,
    archiveBomItem,
    // Dynamic Catalogs & 'NEW' Badge Tracking
    addNewModule,
    addNewInverter,
    seenCatalogItemIds,
    markCatalogItemSeen,
    isCatalogItemNew,
    // Master System Settings & Policies
    systemSettings,
    updateSystemSettings,
    // Dynamic Required Documents Management
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    masterDocRegistry,
    categoryDocRules,
    addMasterDocument,
    updateMasterDocument,
    deleteMasterDocument,
    updateCategoryDocRule,
    resetDocumentRulesToDefault,
    refreshMasterDocuments,
    getFileDocuments,
    getFileDocsCompletion,
    applicationCategories: APPLICATION_CATEGORIES,
    isDocMandatoryForCategory,
    // Master Dynamic Application Stages
    applicationStages,
    addApplicationStage,
    updateApplicationStage,
    deleteApplicationStage,
    resetApplicationStages,
    // Immutable Audit Activity Ledger
    auditLogs,
    logActivity,
    // Solar CAD Designs
    designRecords,
    saveDesignRecord,
    // Customer File Timeline Progression
    addCustomerFileTimelineEvent,
    // Solar Loan Partner Banks
    solarBanks
  }), [
    isAuthenticated,
    authView,
    role,
    activeTab,
    highlightedFileId,
    currentDealer,
    currentStaff,
    staffList,
    customerFiles,
    refreshCustomerFiles,
    refreshStaffList,
    customerFilesError,
    pricingMaster,
    pricingPresets,
    tierMargins,
    governanceSettings,
    modulesList,
    invertersList,
    isHardwareDbSyncing,
    isHardwareDbConnected,
    dealers,
    kitsPresets,
    quotations,
    editingQuotation,
    activeDraftQuote,
    previewQuotation,
    visibleNotifications,
    unreadNotificationsCount,
    notificationsOpen,
    isChangelogModalOpen,
    selectedChangelogVersion,
    dismissedPopupIds,
    dismissedNotifIds,
    pdfBosMatrix,
    inverterBenchmarkMatrix,
    bomCatalog,
    bomRates,
    capacityBomMatrix,
    seenCatalogItemIds,
    systemSettings,
    masterDocRegistry,
    categoryDocRules,
    applicationStages,
    auditLogs,
    designRecords,
    solarBanks,
    login,
    logout,
    updateDealerProfile,
    addStaff,
    updateStaff,
    updateStaffPassword,
    deleteStaff,
    addCustomerFile,
    updateCustomerFile,
    editCustomerFile,
    cancelCustomerFile,
    restoreCustomerFile,
    deleteCustomerFile,
    updateFileStatus,
    updatePricingMaster,
    updatePricingPresets,
    updateTierMargins,
    updateGovernanceSettings,
    addDealer,
    updateDealer,
    deleteDealer,
    toggleDealerStatus,
    updateDealerMarginCap,
    updateDealerPassword,
    updateDealerPricing,
    updateDealerProductRate,
    removeDealerProductRate,
    getAccessibleDealers,
    saveKitPreset,
    deleteKitPreset,
    addQuotation,
    updateQuotation,
    startEditingQuotation,
    clearEditingQuotation,
    setActiveDraftQuote,
    clearActiveDraftQuote,
    updateQuotationStatus,
    openChangelogModal,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    addNotification,
    dismissPopupNotification,
    updateBomItemRate,
    updateCapacityBomItemQty,
    updateCapacityBomPreset,
    getResolvedBom,
    addBomItem,
    updateBomItem,
    deleteBomItem,
    archiveBomItem,
    addNewModule,
    addNewInverter,
    markCatalogItemSeen,
    isCatalogItemNew,
    updateSystemSettings,
    addMasterDocument,
    updateMasterDocument,
    deleteMasterDocument,
    updateCategoryDocRule,
    resetDocumentRulesToDefault,
    refreshMasterDocuments,
    addApplicationStage,
    updateApplicationStage,
    deleteApplicationStage,
    resetApplicationStages,
    logActivity,
    saveDesignRecord,
    addCustomerFileTimelineEvent
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      <TopProgressBar active={isHardwareDbSyncing} />
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
