import React, { useState, useRef, useEffect, startTransition } from 'react';
import { useApp } from '../context/AppContext';
import NotificationPanel from './Shared/NotificationPanel';

export default function Navigation() {
  const {
    role,
    activeTab,
    setActiveTab,
    currentDealer,
    currentStaff,
    logout,
    unreadNotificationsCount,
    clearEditingQuotation,
    clearActiveDraftQuote,
    notificationsOpen,
    setNotificationsOpen
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const desktopNotificationRef = useRef(null);
  const mobileNotificationRef = useRef(null);

  const handleMenuClick = (tabId) => {
    if (tabId === 'create_quote' || tabId === 'dashboard' || tabId === 'my_quotes' || tabId === 'my_applications') {
      if (clearEditingQuotation) clearEditingQuotation();
      if (tabId === 'create_quote' && clearActiveDraftQuote) clearActiveDraftQuote();
    }
    startTransition(() => {
      setActiveTab(tabId);
    });
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Lock body scroll and listen for Escape key when mobile navigation drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setMobileOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileOpen]);

  const dealerMenu = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Dashboard', icon: 'home' },
    { id: 'create_quote', label: 'New Quotation', mobileLabel: 'New Quote', icon: 'note_add' },
    { id: 'my_quotes', label: 'My Quotations', mobileLabel: 'My Quotes', icon: 'folder_open' },
    { id: 'my_applications', label: 'My Applications', mobileLabel: 'Applications', icon: 'assignment' },
    { id: 'dealer_performance', label: 'My Performance', mobileLabel: 'Performance', icon: 'monitoring' },
    { id: 'lead_generation', label: 'Lead Generation', mobileLabel: 'Leads', icon: 'radar' },
    { id: 'docs', label: 'Agreements & Docs', mobileLabel: 'Docs', icon: 'description' },
  ];

  const adminMenu = [
    { id: 'admin_dashboard', label: 'Executive Overview', mobileLabel: 'Overview', icon: 'dashboard' },
    { id: 'admin_performance', label: 'Business Performance', mobileLabel: 'Performance', icon: 'monitoring' },
    { id: 'dealers_mgmt', label: 'Dealer Partners', mobileLabel: 'Dealers', icon: 'group' },
    { id: 'staff_mgmt', label: 'Sales Team & Files', mobileLabel: 'Sales Team', icon: 'badge' },
    { id: 'admin_reports', label: 'Reports & Export', mobileLabel: 'Reports', icon: 'download' },
    { id: 'admin_audit', label: 'Audit Logs Trail', mobileLabel: 'Audit', icon: 'receipt_long' },
    { id: 'lead_generation', label: 'Lead Generation', mobileLabel: 'Leads', icon: 'radar' },
    { id: 'create_quote', label: 'New Direct Quote', mobileLabel: 'New Quote', icon: 'note_add' },
    { id: 'pricing_master', label: 'Pricing & Presets', mobileLabel: 'Pricing', icon: 'tune' },
    { id: 'hardware_master', label: 'Hardware Catalog', mobileLabel: 'Hardware', icon: 'memory' },
    { id: 'all_quotes', label: 'All Quotations', mobileLabel: 'All Quotes', icon: 'inventory_2' },
    { id: 'admin_docs', label: 'Documentation Hub', mobileLabel: 'Docs', icon: 'description' },
    { id: 'admin_settings', label: 'Settings', mobileLabel: 'Settings', icon: 'settings' },
  ];

  const isVerificationStaff = Boolean(
    String(currentStaff?.department || '').toLowerCase() === 'verification' ||
    String(currentStaff?.role || '').toLowerCase().includes('verification')
  );

  const verificationStaffMenu = [
    { id: 'verification_desk', label: 'Verification Desk', mobileLabel: 'Verification', icon: 'verified_user' },
    { id: 'staff_files', label: 'Customer Files', mobileLabel: 'Files', icon: 'folder' },
    { id: 'docs', label: 'Policies & Docs', mobileLabel: 'Docs', icon: 'description' },
  ];

  const salesStaffMenu = [
    { id: 'staff_dashboard', label: 'My Dashboard', mobileLabel: 'Dashboard', icon: 'dashboard' },
    { id: 'create_quote', label: 'New Quotation', mobileLabel: 'New Quote', icon: 'note_add' },
    { id: 'staff_files', label: 'My Customer Files', mobileLabel: 'My Files', icon: 'folder' },
    { id: 'staff_pricing', label: 'Pricing & Presets', mobileLabel: 'Pricing', icon: 'tune' },
    { id: 'staff_performance', label: 'My Performance', mobileLabel: 'Performance', icon: 'monitoring' },
    { id: 'staff_new_lead', label: 'New Customer Lead', mobileLabel: 'New Lead', icon: 'person_add' },
    { id: 'staff_map', label: 'Nearby Radar (AI)', mobileLabel: 'Radar Map', icon: 'radar' },
    { id: 'lead_generation', label: 'Lead Engine', mobileLabel: 'Leads', icon: 'hub' },
    { id: 'docs', label: 'Policies & Docs', mobileLabel: 'Docs', icon: 'description' },
  ];

  const staffMenu = isVerificationStaff ? verificationStaffMenu : salesStaffMenu;

  const menuItems = role === 'admin' ? adminMenu : role === 'staff' ? staffMenu : dealerMenu;

  return (
    <>
      {/* Desktop Sidebar (Exact Stitch Design) */}
      <aside className="no-print hidden md:flex fixed left-0 top-0 h-screen w-64 bg-on-secondary-fixed z-50 flex-col justify-between select-none">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand Header */}
          <div className="h-16 px-space-lg flex items-center gap-space-sm border-b border-white/10 shrink-0">
            <img
              alt="Sunvine Renewable Energy Logo"
              className="h-8 w-auto object-contain cursor-pointer"
              src="/sunvine_logo_white.png"
              onClick={() => handleMenuClick(role === 'admin' ? 'admin_dashboard' : role === 'staff' ? (isVerificationStaff ? 'verification_desk' : 'staff_dashboard') : 'dashboard')}
            />
            <div className="flex flex-col">
              <span className="font-label-xs text-label-xs text-secondary-fixed-dim tracking-wider uppercase font-semibold">
                {role === 'admin' ? 'Portal' : role === 'staff' ? (isVerificationStaff ? 'Verification Desk' : 'Staff Portal') : 'Dealer Portal'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col mt-space-sm flex-1 overflow-y-auto scrollbar-hide py-1">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item.id)}
                  className={`flex items-center gap-space-sm px-space-lg py-2.5 transition-colors text-left cursor-pointer ${isActive
                    ? 'border-l-4 border-primary-container bg-white/10 text-on-secondary font-label-md'
                    : 'text-secondary-fixed-dim hover:bg-white/5 hover:text-on-secondary font-body-md'
                    }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-xs truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

      </aside>

      {/* Desktop Top Header (Exact Stitch Design) */}
      <header className="no-print hidden md:flex fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest border-b border-surface-container-high z-40 items-center justify-between px-3 sm:px-4 lg:px-6 xl:px-space-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        {/* Left Status Bar */}
        <div className="flex items-center gap-space-md min-w-0 shrink">
          <div className="flex items-center gap-space-xs text-secondary font-label-sm min-w-0">
            <span className="material-symbols-outlined text-[18px] shrink-0">solar_power</span>
            <span className="hidden xl:inline truncate">Dealer Operations</span>
            <span className="xl:hidden text-xs truncate">Sunvine Network</span>
          </div>
        </div>

        {/* Right Status / Profile Controls */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-space-lg shrink-0">
          {/* Notification Bell with Active Indicator */}
          <div className="relative" ref={desktopNotificationRef}>
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setDropdownOpen(false);
              }}
              className={`relative p-2 rounded-xl transition-all cursor-pointer ${notificationsOpen
                  ? 'bg-primary-container/15 text-primary ring-2 ring-primary/20'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
                }`}
              type="button"
              title="Notifications"
              aria-label="Toggle notifications panel"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error text-on-error rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs border-2 border-surface-container-lowest animate-in zoom-in duration-200">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-surface-container-high"></div>

          {/* Dealer Avatar & Dropdown Pill */}
          <div className="relative" ref={profileDropdownRef}>
            <div
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setNotificationsOpen(false);
              }}
              className={`flex items-center gap-2 sm:gap-space-sm cursor-pointer select-none px-2 py-1.5 rounded-xl transition-all duration-200 ${dropdownOpen
                  ? 'bg-surface-container-low ring-1 ring-primary/20'
                  : 'hover:bg-surface-container-lowest hover:shadow-xs'
                }`}
            >
              <img
                src={role === 'staff' ? (currentStaff?.avatar || '/dealer_avatar.jpg') : (currentDealer?.avatar || '/dealer_avatar.jpg')}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover shadow-xs border border-surface-container-high shrink-0 ring-1 ring-primary/30"
              />
              <div className="hidden sm:flex flex-col text-left max-w-[90px] md:max-w-[120px] lg:max-w-[180px] truncate">
                <span className="font-label-md text-label-md text-on-surface leading-tight truncate">
                  {role === 'admin'
                    ? 'Admin Desk'
                    : role === 'staff'
                      ? currentStaff?.name || 'Field Solar Executive'
                      : currentDealer?.firmName || 'Rajesh Solar Solutions'}
                </span>
                <span className="font-label-xs text-label-xs text-secondary leading-tight truncate">
                  {role === 'admin'
                    ? 'System Administrator'
                    : role === 'staff'
                      ? currentStaff?.role || 'Sales Representative'
                      : 'Authorized Dealer'}
                </span>
              </div>
              <span
                className={`material-symbols-outlined text-[20px] shrink-0 transition-transform duration-200 ease-out ${dropdownOpen ? 'rotate-180 text-primary' : 'rotate-0 text-secondary'
                  }`}
              >
                keyboard_arrow_down
              </span>
            </div>

            {/* Quick Profile Dropdown with Smooth Animation */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl shadow-xl border border-surface-container-high/80 p-1.5 z-50 animate-dropdown-enter ring-1 ring-black/5">
                <div className="px-3.5 py-2.5 mb-1 border-b border-surface-container-high/60 bg-surface-container-low/40 rounded-xl">
                  <p className="font-label-md text-on-surface text-xs font-bold truncate">
                    {role === 'admin'
                      ? 'System Admin'
                      : role === 'staff'
                        ? currentStaff?.name || 'Field Solar Executive'
                        : currentDealer?.contactPerson || currentDealer?.firmName || 'Authorized Partner'}
                  </p>
                  <p className="font-body-sm text-secondary text-[11px] truncate">
                    {role === 'admin'
                      ? 'admin@sunvine.in'
                      : role === 'staff'
                        ? currentStaff?.email || (currentStaff?.phone ? `+91 ${currentStaff.phone}` : 'staff@sunvine.in')
                        : currentDealer?.email || (currentDealer?.mobile ? `+91 ${currentDealer.mobile}` : 'dealer@sunvine.in')}
                  </p>
                </div>

                <div className="space-y-0.5">
                  {/* Governance Settings Option: STRICTLY FOR ADMIN ONLY */}
                  {role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleMenuClick('admin_settings');
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-on-surface hover:bg-primary/10 hover:text-primary active:scale-[0.98] cursor-pointer transition-all duration-150"
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      <span>Governance Settings</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-error hover:bg-error-container/20 active:scale-[0.98] cursor-pointer transition-all duration-150"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================
          MOBILE TOP BAR: With Responsive Hamburger Menu Trigger
          ======================================================== */}
      <header className="no-print fixed top-0 left-0 right-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high md:hidden h-16 px-3 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger Menu Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="w-10 h-10 -ml-1 flex items-center justify-center rounded-xl text-on-surface hover:bg-surface-container-high active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

          <img
            alt="Brand logo"
            className="h-7 sm:h-8 w-auto object-contain cursor-pointer shrink-0"
            src="/sunvine_logo_transparent.webp"
            onClick={() => {
              handleMenuClick(role === 'admin' ? 'admin_dashboard' : role === 'staff' ? (isVerificationStaff ? 'verification_desk' : 'staff_dashboard') : 'dashboard');
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-sm font-bold text-on-surface leading-tight tracking-tight truncate">
              Sunvine
            </span>
            <span className="font-label-xs text-[10px] text-secondary leading-tight tracking-wider uppercase font-semibold truncate">
              {role === 'admin' ? 'Admin Console' : role === 'staff' ? (isVerificationStaff ? 'Verification Desk' : 'Staff Portal') : 'Dealer Portal'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Notification Bell */}
          <div className="relative" ref={mobileNotificationRef}>
            <button
              aria-label="Notifications"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors relative cursor-pointer ${notificationsOpen
                  ? 'bg-primary-container/20 text-primary'
                  : 'text-secondary hover:bg-surface-container-high'
                }`}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-error text-on-error rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs border border-surface">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              ) : null}
            </button>
          </div>

          {role === 'admin' ? (
            <div
              onClick={() => {
                handleMenuClick('admin_settings');
              }}
              className="relative flex items-center justify-center p-0.5 rounded-full ring-1 ring-primary/40 cursor-pointer"
              title="Admin Settings"
            >
              <img
                alt="Profile"
                className="w-7 h-7 rounded-full object-cover"
                src="/dealer_avatar.jpg"
              />
            </div>
          ) : (
            <div
              className="relative flex items-center justify-center p-0.5 rounded-full ring-1 ring-primary/40"
              title={role === 'staff' ? (currentStaff?.name || 'Staff') : (currentDealer?.contactPerson || 'Dealer')}
            >
              <img
                alt="Profile"
                className="w-7 h-7 rounded-full object-cover"
                src={role === 'staff' ? (currentStaff?.avatar || '/dealer_avatar.jpg') : (currentDealer?.avatar || '/dealer_avatar.jpg')}
              />
            </div>
          )}
          <button
            aria-label="Logout"
            className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-error transition-colors cursor-pointer"
            onClick={logout}
            title="Sign Out"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </header>

      {/* Unified Single-Instance Notification Panel (Serves both Desktop Dropdown & Mobile Bottom Sheet) */}
      <NotificationPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        desktopTriggerRef={desktopNotificationRef}
        mobileTriggerRef={mobileNotificationRef}
      />

      {/* ========================================================
          MOBILE SLIDE-OUT SIDEBAR DRAWER (Replaces Bottom Navigation Bar)
          ======================================================== */}
      {/* Backdrop with Fade Transition */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-xs transition-opacity duration-300 md:hidden ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />

      {/* Slide-out Sidebar Panel */}
      <aside
        className={`no-print fixed top-0 bottom-0 left-0 w-[290px] max-w-[85vw] h-full z-50 bg-on-secondary-fixed text-white shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out md:hidden select-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        aria-label="Mobile Navigation Drawer"
      >
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Drawer Brand Header with Close Button */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0 bg-[#0A1120]">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                alt="Sunvine Logo"
                className="h-7 w-auto object-contain cursor-pointer"
                src="/sunvine_logo_white.png"
                onClick={() => {
                  handleMenuClick(role === 'admin' ? 'admin_dashboard' : role === 'staff' ? (isVerificationStaff ? 'verification_desk' : 'staff_dashboard') : 'dashboard');
                  setMobileOpen(false);
                }}
              />
              <span className="text-[10px] font-semibold text-secondary-fixed-dim uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 border border-white/10 shrink-0">
                {role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Dealer'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>


          {/* All Navigation Links (Zero Horizontal Overflow, Smooth Touch Targets) */}
          <nav className="flex flex-col mt-2 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-1 px-2 space-y-0.5">
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest text-white/40">
              Menu Navigation
            </div>
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleMenuClick(item.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-left cursor-pointer min-h-[44px] w-full min-w-0 ${isActive
                      ? 'bg-gradient-to-r from-emerald-600/30 to-teal-500/15 border-l-4 border-emerald-400 text-white font-semibold shadow-xs'
                      : 'text-secondary-fixed-dim hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 ${isActive ? 'text-emerald-400' : 'text-white/60'
                      }`}
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-xs truncate flex-1 min-w-0">{item.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>


      </aside>
    </>
  );
}
