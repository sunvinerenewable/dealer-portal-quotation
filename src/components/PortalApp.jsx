import React, { useState, Suspense, lazy } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import Navigation from './Navigation';
import ViewSkeleton from './Shared/ViewSkeleton';

import SplashScreen from './SplashScreen';
import AppUpdateModal from './Shared/AppUpdateModal';
import UpdateNotificationPopup from './Shared/UpdateNotificationPopup';
import NetworkStatusBanner from './Shared/NetworkStatusBanner';

// Top-Level Lazy-Loaded Authentication Views
const DealerLogin = lazy(() => import('./Auth/DealerLogin'));
const AdminLogin = lazy(() => import('./Auth/AdminLogin'));
const StaffLogin = lazy(() => import('./Auth/StaffLogin'));

// Top-Level Lazy-Loaded Dealer Portal Views
const DealerDashboard = lazy(() => import('./DealerPortal/DealerDashboard'));
const CreateQuotation = lazy(() => import('./DealerPortal/CreateQuotation'));
const QuotationPreview = lazy(() => import('./DealerPortal/QuotationPreview'));
const MyQuotations = lazy(() => import('./DealerPortal/MyQuotations'));
const MyApplications = lazy(() => import('./DealerPortal/MyApplications'));
const DealerSettings = lazy(() => import('./DealerPortal/DealerSettings'));

// Top-Level Lazy-Loaded Staff Portal Views
const StaffDashboard = lazy(() => import('./StaffPortal/StaffDashboard'));
const StaffFiles = lazy(() => import('./StaffPortal/StaffFiles'));
const VerificationDesk = lazy(() => import('./StaffPortal/VerificationDesk'));

// Top-Level Lazy-Loaded Admin Portal Views
const AdminDashboard = lazy(() => import('./AdminPortal/AdminDashboard'));
const DealerManagement = lazy(() => import('./AdminPortal/DealerManagement'));
const PricingMaster = lazy(() => import('./AdminPortal/PricingMaster'));
const HardwareMaster = lazy(() => import('./AdminPortal/HardwareMaster'));
const AllQuotations = lazy(() => import('./AdminPortal/AllQuotations'));
const AdminSettings = lazy(() => import('./AdminPortal/AdminSettings'));
const StaffManagement = lazy(() => import('./AdminPortal/StaffManagement'));
const BusinessPerformance = lazy(() => import('./AdminPortal/BusinessPerformance'));
const ReportsAnalytics = lazy(() => import('./AdminPortal/ReportsAnalytics'));
const AuditLogViewer = lazy(() => import('./AdminPortal/AuditLogViewer'));

// Shared Views
const LeadGenerationComingSoon = lazy(() => import('./Shared/LeadGenerationComingSoon'));
const DocumentationHub = lazy(() => import('./Shared/DocumentationHub'));
const ComingSoonPlaceholder = lazy(() => import('./Shared/ComingSoonPlaceholder'));

function PortalContent() {
  const { isAuthenticated, authView, role, activeTab, currentStaff } = useApp();
  const isVerificationStaff = Boolean(
    String(currentStaff?.department || '').toLowerCase() === 'verification' ||
    String(currentStaff?.role || '').toLowerCase().includes('verification')
  );
  const [splashFinished, setSplashFinished] = useState(() => {
    return sessionStorage.getItem('sunvine_splash_shown') === 'true';
  });

  const handleSplashFinish = () => {
    sessionStorage.setItem('sunvine_splash_shown', 'true');
    setSplashFinished(true);
  };

  // 1. Unauthenticated Gateway
  if (!isAuthenticated) {
    return (
      <>
        <Suspense fallback={<ViewSkeleton title="Loading Authentication..." />}>
          {authView === 'admin_login' ? (
            <AdminLogin />
          ) : authView === 'staff_login' ? (
            <StaffLogin />
          ) : (
            <DealerLogin />
          )}
        </Suspense>
        {!splashFinished && <SplashScreen onFinish={handleSplashFinish} />}
      </>
    );
  }

  // 2. Authenticated Portal Views
  const renderView = () => {
    // Shared 4-Page PDF proposal preview
    if (activeTab === 'preview_quote') {
      return <QuotationPreview />;
    }

    if (role === 'admin') {
      switch (activeTab) {
        case 'admin_dashboard':
          return <AdminDashboard />;
        case 'admin_performance':
          return <BusinessPerformance />;
        case 'create_quote':
        case 'admin_create_quote':
          return <CreateQuotation />;
        case 'dealers_mgmt':
          return <DealerManagement />;
        case 'staff_mgmt':
          return <StaffManagement />;
        case 'admin_reports':
          return <ReportsAnalytics />;
        case 'admin_audit':
          return <AuditLogViewer />;
        case 'lead_generation':
          return <LeadGenerationComingSoon />;
        case 'pricing_master':
          return <PricingMaster />;
        case 'hardware_master':
          return <HardwareMaster />;
        case 'all_quotes':
          return <AllQuotations />;
        case 'admin_docs':
          return <DocumentationHub />;
        case 'admin_settings':
          return <AdminSettings />;
        default:
          return <AdminDashboard />;
      }
    }

    if (role === 'staff') {
      switch (activeTab) {
        case 'verification_desk':
        case 'staff_verification':
          return <VerificationDesk />;
        case 'staff_dashboard':
          return <StaffDashboard />;
        case 'create_quote':
          return <CreateQuotation />;
        case 'staff_files':
          return <StaffFiles />;
        case 'staff_pricing':
          return <PricingMaster />;
        case 'staff_performance':
          return <BusinessPerformance />;
        case 'staff_new_lead':
          return (
            <ComingSoonPlaceholder
              title="New Customer Lead Engine"
              subtitle="Feature Under Construction"
              icon="person_add"
              description="We are building this module to streamline lead generation, instant customer file intake, and geo-allocated lead processing directly to field officers. This feature will be available in the next release."
              backTab="staff_dashboard"
            />
          );
        case 'staff_map':
          return (
            <ComingSoonPlaceholder
              title="Nearby Radar (AI) Discovery"
              subtitle="Feature Under Construction"
              icon="radar"
              description="AI-powered geographic rooftop solar density mapping, Gujarat DISCOM feeder proximity detection, and solar cluster prospect radar will be available in the next release."
              backTab="staff_dashboard"
            />
          );
        case 'lead_generation':
          return <LeadGenerationComingSoon />;
        case 'docs':
          return <DocumentationHub />;
        default:
          return isVerificationStaff ? <VerificationDesk /> : <StaffDashboard />;
      }
    }

    // Default: Dealer Portal Views
    switch (activeTab) {
      case 'dashboard':
        return <DealerDashboard />;
      case 'create_quote':
        return <CreateQuotation />;
      case 'my_quotes':
        return <MyQuotations />;
      case 'my_applications':
        return <MyApplications />;
      case 'dealer_performance':
        return <BusinessPerformance />;
      case 'lead_generation':
        return <LeadGenerationComingSoon />;
      case 'docs':
        return <DocumentationHub />;
      case 'profile':
      case 'dealer_settings':
        return role === 'admin' ? <AdminSettings /> : <DealerDashboard />;
      default:
        return <DealerDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#0F1B2E] font-sans antialiased">
      {/* Navigation Layout */}
      <Navigation />

      {/* Real-Time Update Notification Popup */}
      <UpdateNotificationPopup />

      {/* Main Content Area */}
      <main className={`md:pl-64 pt-16 pb-24 md:pb-8 transition-all w-full min-w-0 max-w-full ${activeTab === 'preview_quote' ? 'overflow-visible' : 'overflow-x-clip'}`}>
        <Suspense fallback={<ViewSkeleton />}>
          {activeTab === 'preview_quote' ? (
            <div className="w-full min-w-0">
              {renderView()}
            </div>
          ) : (
            <div className="p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0">
              {renderView()}
            </div>
          )}
        </Suspense>
      </main>

      {/* Real-time Network Offline / Restored Status Banner */}
      <NetworkStatusBanner />
    </div>
  );
}

export default function PortalApp() {
  return (
    <AppProvider>
      <PortalContent />
      <AppUpdateModal />
    </AppProvider>
  );
}
