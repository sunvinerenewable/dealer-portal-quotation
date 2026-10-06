import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  calculateStaffPerformance,
  calculateDealerPerformance,
  calculateOverallBusinessMetrics
} from '../../utils/performanceAnalytics';
import CustomerFileDetailModal from '../Shared/CustomerFileDetailModal';

export default function BusinessPerformance() {
  const { staffList, customerFiles, quotations, dealers, role, currentStaff, currentDealer } = useApp();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'staff', 'dealers', 'finance', 'funnel'
  const [staffSearch, setStaffSearch] = useState('');
  const [dealerSearch, setDealerSearch] = useState('');
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);
  const [selectedDealerDetail, setSelectedDealerDetail] = useState(null);
  const [selectedFileForModal, setSelectedFileForModal] = useState(null);

  // Role-Based Data Isolation (Mandate: Staff can only see assigned data; Admin sees all)
  const isStaffRole = role === 'staff';

  const isolatedDealers = useMemo(() => {
    if (!isStaffRole) return dealers || [];
    const sid = currentStaff?.id;
    const sname = currentStaff?.name;
    return (dealers || []).filter(d => 
      (d.assignedStaffId && d.assignedStaffId === sid) ||
      (d.assignedStaffName && d.assignedStaffName === sname)
    );
  }, [dealers, isStaffRole, currentStaff]);

  const isolatedDealerIds = useMemo(() => {
    return new Set(isolatedDealers.map(d => d.id || d.dealerId));
  }, [isolatedDealers]);

  const isolatedFiles = useMemo(() => {
    if (!isStaffRole) return customerFiles || [];
    const sid = currentStaff?.id;
    const sname = currentStaff?.name;
    return (customerFiles || []).filter(f =>
      f.staffId === sid ||
      f.staffName === sname ||
      (f.dealerId && isolatedDealerIds.has(f.dealerId))
    );
  }, [customerFiles, isStaffRole, currentStaff, isolatedDealerIds]);

  const isolatedQuotations = useMemo(() => {
    if (!isStaffRole) return quotations || [];
    const sid = currentStaff?.id;
    const sname = currentStaff?.name;
    return (quotations || []).filter(q =>
      q.staffId === sid ||
      q.staffName === sname ||
      (q.dealerId && isolatedDealerIds.has(q.dealerId))
    );
  }, [quotations, isStaffRole, currentStaff, isolatedDealerIds]);

  const isolatedStaffList = useMemo(() => {
    if (!isStaffRole) return staffList || [];
    const match = (staffList || []).filter(s => s.id === currentStaff?.id || s.name === currentStaff?.name);
    return match.length > 0 ? match : (currentStaff ? [currentStaff] : []);
  }, [staffList, isStaffRole, currentStaff]);

  // Calculate dynamic metrics strictly using isolated data
  const staffMetrics = useMemo(() => {
    const res = calculateStaffPerformance(isolatedStaffList, isolatedFiles, isolatedQuotations, isolatedDealers);
    return Array.isArray(res) ? res : [];
  }, [isolatedStaffList, isolatedFiles, isolatedQuotations, isolatedDealers]);

  const dealerMetrics = useMemo(() => {
    const res = calculateDealerPerformance(isolatedDealers, isolatedFiles, isolatedQuotations);
    return Array.isArray(res) ? res : [];
  }, [isolatedDealers, isolatedFiles, isolatedQuotations]);

  const overallMetrics = useMemo(() => {
    return calculateOverallBusinessMetrics(isolatedQuotations, isolatedFiles, isolatedDealers, isolatedStaffList) || {};
  }, [isolatedQuotations, isolatedFiles, isolatedDealers, isolatedStaffList]);

  // Filtered lists
  const filteredStaff = useMemo(() => {
    const list = Array.isArray(staffMetrics) ? staffMetrics : [];
    if (!staffSearch.trim()) return list;
    const term = staffSearch.toLowerCase();
    return list.filter(s =>
      (s.name || '').toLowerCase().includes(term) ||
      (s.role || '').toLowerCase().includes(term) ||
      (s.zone || '').toLowerCase().includes(term)
    );
  }, [staffMetrics, staffSearch]);

  const filteredDealers = useMemo(() => {
    const list = Array.isArray(dealerMetrics) ? dealerMetrics : [];
    if (!dealerSearch.trim()) return list.slice(0, 50); // limit for performant render
    const term = dealerSearch.toLowerCase();
    return list.filter(d =>
      (d.firmName || '').toLowerCase().includes(term) ||
      (d.city || '').toLowerCase().includes(term) ||
      (d.assignedStaffName && d.assignedStaffName.toLowerCase().includes(term))
    ).slice(0, 50);
  }, [dealerMetrics, dealerSearch]);

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto text-on-surface">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-secondary uppercase tracking-wider flex-wrap">
            {isStaffRole ? (
              <>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-bold border border-emerald-500/20">
                  Staff Role Isolation Active
                </span>
                <span>&bull;</span>
                <span className="text-primary font-bold">Assigned to {currentStaff?.name || 'Current Staff'} ({currentStaff?.id || 'STF'})</span>
              </>
            ) : (
              <>
                <span>Executive Business Analytics</span>
                <span>&bull;</span>
                <span className="text-primary font-bold">Consolidated Master Ledger</span>
              </>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-on-surface mt-1">
            {isStaffRole ? 'My Performance & Portfolio Analytics' : 'Performance & Attribution Intelligence'}
          </h1>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            {isStaffRole
              ? `Personal performance dashboard displaying exclusively your assigned dealers (${isolatedDealers.length}), customer files (${isolatedFiles.length}), and individual conversion metrics.`
              : 'Measurable, verifiable metrics tracking sales staff output, dealer network conversions, and cash vs loan business distribution.'}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-xl overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: 'monitoring' },
            { id: 'staff', label: isStaffRole ? 'My Attribution' : 'Sales Staff', icon: 'badge' },
            { id: 'dealers', label: isStaffRole ? `My Dealers (${isolatedDealers.length})` : 'Dealer Partners', icon: 'storefront' },
            { id: 'finance', label: 'Cash vs Loan', icon: 'account_balance' },
            { id: 'funnel', label: 'Conversion Funnel', icon: 'filter_alt' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer min-h-[38px] ${
                activeTab === tab.id
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs">
          <span className="text-[11px] font-medium text-secondary block">Total Quotations</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-on-surface mt-1 block">
            {overallMetrics?.totalQuotations ?? 0}
          </span>
          <span className="text-[10px] text-secondary font-mono">
            {(Number(overallMetrics?.totalQuotesCapacityKw) || 0).toFixed(1)} kW Proposed
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs">
          <span className="text-[11px] font-medium text-secondary block">Total Files</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-on-surface mt-1 block">
            {overallMetrics?.totalFiles ?? (isolatedFiles?.length || 0)}
          </span>
          <span className="text-[10px] text-secondary font-mono">
            {(Number(overallMetrics?.totalFilesCapacityKw) || 0).toFixed(1)} kW Onboarded
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs">
          <span className="text-[11px] font-medium text-secondary block">Overall Conversion</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-primary mt-1 block">
            {overallMetrics?.overallConversionRate ?? 0}%
          </span>
          <span className="text-[10px] text-secondary font-mono">
            {overallMetrics?.totalFiles ?? (isolatedFiles?.length || 0)} Customer Files
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs">
          <span className="text-[11px] font-medium text-secondary block">Pipeline Capacity</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-on-surface mt-1 block">
            {(Number(overallMetrics?.totalFilesCapacityKw) || 0).toFixed(1)} kW
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold font-mono">
            {overallMetrics?.completedFiles ?? 0} Connected to Grid
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs">
          <span className="text-[11px] font-medium text-secondary block">Contract Value</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-on-surface mt-1 block">
            ₹ {((Number(overallMetrics?.totalContractValue) || 0) / 100000).toFixed(1)}L
          </span>
          <span className="text-[10px] text-secondary font-mono">
            ₹ {((Number(overallMetrics?.totalSubsidyValue) || 0) / 100000).toFixed(1)}L MNRE Subsidy
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-secondary block">Cash vs Loan Ratio</span>
          <span className="font-mono text-lg sm:text-xl font-bold text-on-surface mt-1 block">
            {overallMetrics?.cashPercentage ?? 0}% / {overallMetrics?.loanPercentage ?? 0}%
          </span>
          <span className="text-[10px] text-secondary font-mono">
            {overallMetrics?.cashFilesCount ?? 0} Cash &bull; {overallMetrics?.loanFilesCount ?? 0} Bank Loans
          </span>
        </div>
      </div>

      {/* 3. Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Staff Summary Grid */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                <h3 className="font-heading font-bold text-base text-on-surface">
                  {isStaffRole ? 'My Sales & Attribution Summary' : 'Sales Staff Performance Leaderboard'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                {isStaffRole ? 'View My Details →' : 'View Full Team →'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container-high text-secondary">
                    <th className="py-2.5 px-3 font-semibold">Staff Member</th>
                    <th className="py-2.5 px-3 font-semibold">Zone / Region</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Dealers</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Direct Files</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Dealer Files</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Total kW</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/60">
                  {staffMetrics.slice(0, 4).map(s => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedStaffDetail(s)}
                      className="hover:bg-surface-container-low/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">{s.name}</div>
                        <div className="text-[11px] text-secondary font-mono">{s.id}</div>
                      </td>
                      <td className="py-3 px-3 text-secondary">{s.zone}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{s.dealersCount}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-primary">{s.directFilesCount}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{s.dealerFilesCount}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{(Number(s?.pipelineKw) || 0).toFixed(1)} kW</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-primary">{s.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Dealer Summary Grid */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">storefront</span>
                <h3 className="font-heading font-bold text-base text-on-surface">
                  {isStaffRole ? `My Assigned Gujarat Dealer Partners (${isolatedDealers.length})` : 'Top Active Gujarat Dealer Partners'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('dealers')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                {isStaffRole ? `View All My ${isolatedDealers.length} Dealers →` : `View All ${dealers.length} Dealers →`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container-high text-secondary">
                    <th className="py-2.5 px-3 font-semibold">Dealer Firm</th>
                    <th className="py-2.5 px-3 font-semibold">City / District</th>
                    <th className="py-2.5 px-3 font-semibold">Assigned Staff</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Quotes</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Files</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Cash/Loan</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/60">
                  {dealerMetrics.slice(0, 5).map(d => (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedDealerDetail(d)}
                      className="hover:bg-surface-container-low/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">{d.firmName}</div>
                        <div className="text-[11px] text-secondary font-mono">{d.id} &bull; {d.tier}</div>
                      </td>
                      <td className="py-3 px-3 text-secondary">{d.city}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-on-surface">{d.assignedStaffName || 'Assigned'}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{d.quotationsCount}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-primary">{d.customerFilesCount}</td>
                      <td className="py-3 px-3 text-center font-mono text-secondary">
                        {d.cashCount}C / {d.loanCount}L
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-primary">{d.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tab: Staff Performance Table */}
      {activeTab === 'staff' && (
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">badge</span>
              <h3 className="font-heading font-bold text-base sm:text-lg text-on-surface">
                {isStaffRole ? 'My Productivity & Attribution Record' : 'Sales Staff Productivity & Attribution Matrix'}
              </h3>
            </div>
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search staff by name, zone, role..."
                className="w-full text-xs p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-container-high text-secondary">
                  <th className="py-3 px-3 font-semibold">Sales Executive</th>
                  <th className="py-3 px-3 font-semibold">Territory Zone</th>
                  <th className="py-3 px-3 font-semibold text-center">Dealers Created</th>
                  <th className="py-3 px-3 font-semibold text-center">Direct Files</th>
                  <th className="py-3 px-3 font-semibold text-center">Dealer Files</th>
                  <th className="py-3 px-3 font-semibold text-center">Total Files</th>
                  <th className="py-3 px-3 font-semibold text-center">Cash / Loan</th>
                  <th className="py-3 px-3 font-semibold text-center">Capacity</th>
                  <th className="py-3 px-3 font-semibold text-right">Conversion</th>
                  <th className="py-3 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {filteredStaff.map(s => (
                  <tr key={s.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-on-surface">{s.name}</div>
                      <div className="text-[11px] text-secondary font-mono">{s.id} &bull; {s.phone}</div>
                    </td>
                    <td className="py-3.5 px-3 text-secondary max-w-[200px] truncate">{s.zone}</td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-on-surface">{s.dealersCount}</td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-primary">{s.directFilesCount}</td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-secondary">{s.dealerFilesCount}</td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-on-surface">{s.totalFiles}</td>
                    <td className="py-3.5 px-3 text-center font-mono text-[11px]">
                      <span className="text-emerald-700 font-bold">{s.cashFilesCount}</span>
                      <span className="text-secondary mx-0.5">/</span>
                      <span className="text-blue-700 font-bold">{s.loanFilesCount}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold">{(Number(s?.pipelineKw) || 0).toFixed(1)} kW</td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-primary">{s.conversionRate}%</td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedStaffDetail(s)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-primary font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Profile &bull; Drill-down
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab: Dealer Performance Table */}
      {activeTab === 'dealers' && (
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">storefront</span>
              <h3 className="font-heading font-bold text-base sm:text-lg text-on-surface">
                {isStaffRole ? `My Assigned Gujarat Dealer Directory (${isolatedDealers.length})` : 'Gujarat Authorized Dealer Directory & Volume Tracking'}
              </h3>
            </div>
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={dealerSearch}
                onChange={(e) => setDealerSearch(e.target.value)}
                placeholder="Search by firm name, city, staff..."
                className="w-full text-xs p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-container-high text-secondary">
                  <th className="py-3 px-3 font-semibold">Dealer Partner</th>
                  <th className="py-3 px-3 font-semibold">City / District</th>
                  <th className="py-3 px-3 font-semibold">Tier</th>
                  <th className="py-3 px-3 font-semibold">Assigned Staff</th>
                  <th className="py-3 px-3 font-semibold text-center">Quotes</th>
                  <th className="py-3 px-3 font-semibold text-center">Files</th>
                  <th className="py-3 px-3 font-semibold text-center">Cash/Loan</th>
                  <th className="py-3 px-3 font-semibold text-center">Pipeline kW</th>
                  <th className="py-3 px-3 font-semibold text-right">Conversion</th>
                  <th className="py-3 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {filteredDealers.map(d => (
                  <tr key={d.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-on-surface">{d.firmName}</div>
                      <div className="text-[11px] text-secondary font-mono">{d.id} &bull; {d.contactPerson}</div>
                    </td>
                    <td className="py-3.5 px-3 text-secondary">{d.city}</td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.tier === 'Diamond' ? 'bg-purple-100 text-purple-800' :
                        d.tier === 'Platinum' ? 'bg-cyan-100 text-cyan-800' :
                        d.tier === 'Gold' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {d.tier}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {d.assignedStaffId === 'STF-DIRECT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-semibold">
                          Direct HQ
                        </span>
                      ) : (
                        <>
                          <div className="font-medium text-on-surface">{d.assignedStaffName || 'Sunvine Sales Staff'}</div>
                          <div className="text-[10px] text-secondary font-mono">{d.assignedStaffId || 'STF-801'}</div>
                        </>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-on-surface">{d.quotationsCount}</td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-primary">{d.customerFilesCount}</td>
                    <td className="py-3.5 px-3 text-center font-mono text-[11px]">
                      <span className="text-emerald-700 font-bold">{d.cashCount}</span>
                      <span className="text-secondary mx-0.5">/</span>
                      <span className="text-blue-700 font-bold">{d.loanCount}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold">{(Number(d?.totalCapacityKw) || 0).toFixed(1)} kW</td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-primary">{d.conversionRate}%</td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedDealerDetail(d)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-primary font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Profile &bull; Drill-down
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Tab: Cash vs Loan Analytics */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cash vs Loan Share */}
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
              <h3 className="font-heading font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">pie_chart</span>
                Financing Share Distribution
              </h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Direct Cash / Cheque ({overallMetrics.cashFilesCount} Files)</span>
                    <span className="font-mono">{overallMetrics.cashPercentage}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${overallMetrics.cashPercentage}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Solar Bank Loan ({overallMetrics.loanFilesCount} Files)</span>
                    <span className="font-mono">{overallMetrics.loanPercentage}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${overallMetrics.loanPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low/40 text-xs text-secondary leading-relaxed">
                Solar bank loans allow Gujarat residential consumers to install 3kW - 10kW rooftop plants with zero upfront down payment under PM Surya Ghar DBT tie-ups.
              </div>
            </div>

            {/* Bank-wise Breakdown */}
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
              <h3 className="font-heading font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
                Gujarat Partner Banks Volume
              </h3>

              <div className="space-y-2.5 text-xs">
                {Object.entries(overallMetrics.bankBreakdown || {}).length === 0 ? (
                  <p className="text-secondary text-xs">No active bank loan applications recorded yet.</p>
                ) : (
                  Object.entries(overallMetrics.bankBreakdown).map(([bank, count]) => (
                    <div key={bank} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                      <span className="font-medium text-on-surface">{bank}</span>
                      <span className="font-mono font-bold text-primary">{count} Files</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab: Conversion Funnel */}
      {activeTab === 'funnel' && (
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">filter_alt</span>
            <h3 className="font-heading font-bold text-base sm:text-lg text-on-surface">
              End-to-End Quotation to Subsidy Disbursal Funnel
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { step: '1. Quotations', count: overallMetrics?.funnelStages?.quotations ?? 0, sub: 'Generated by Dealers & Staff' },
              { step: '2. Accepted Files', count: overallMetrics?.funnelStages?.filesAccepted ?? 0, sub: 'Customer Onboarded' },
              { step: '3. DISCOM Registered', count: overallMetrics?.funnelStages?.discomRegistered ?? 0, sub: 'Net-Meter Submitted' },
              { step: '4. Plant Commissioned', count: overallMetrics?.funnelStages?.installed ?? 0, sub: 'Hardware Setup Done' },
              { step: '5. Subsidy Disbursed', count: overallMetrics?.funnelStages?.subsidized ?? 0, sub: 'PM Surya Ghar DBT Released' }
            ].map((f, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-mono text-secondary font-semibold uppercase">{f.step}</span>
                  <span className="font-mono text-2xl font-bold text-primary mt-1 block">
                    {f.count}
                  </span>
                </div>
                <span className="text-[11px] text-secondary mt-2">{f.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down Modal: Staff Profile */}
      {selectedStaffDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high w-full max-w-2xl p-6 text-on-surface space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center font-bold">
                  {selectedStaffDetail.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg">{selectedStaffDetail.name}</h3>
                  <p className="text-xs text-secondary font-mono">{selectedStaffDetail.id} &bull; {selectedStaffDetail.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="p-1.5 text-secondary hover:text-on-surface rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Dealers Managed</span>
                <span className="font-mono font-bold text-sm text-on-surface">{selectedStaffDetail.dealersCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Direct Files</span>
                <span className="font-mono font-bold text-sm text-primary">{selectedStaffDetail.directFilesCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Dealer Files</span>
                <span className="font-mono font-bold text-sm text-on-surface">{selectedStaffDetail.dealerFilesCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Conversion</span>
                <span className="font-mono font-bold text-sm text-primary">{selectedStaffDetail.conversionRate}%</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-heading font-bold text-on-surface block">Associated Dealers in Territory</span>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {(selectedStaffDetail.dealersList || []).map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 rounded bg-surface-container-low/40">
                    <div>
                      <span className="font-semibold text-on-surface">{d.firmName}</span>
                      <span className="text-secondary ml-1 font-mono text-[10px]">({d.city})</span>
                    </div>
                    <span className="text-primary font-mono font-bold">{d.tier}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-semibold cursor-pointer min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal: Dealer Profile */}
      {selectedDealerDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high w-full max-w-2xl p-6 text-on-surface space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div>
                <h3 className="font-heading font-bold text-lg">{selectedDealerDetail.firmName}</h3>
                <p className="text-xs text-secondary font-mono">{selectedDealerDetail.id} &bull; {selectedDealerDetail.city}, Gujarat</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDealerDetail(null)}
                className="p-1.5 text-secondary hover:text-on-surface rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Assigned Staff</span>
                <span className="font-bold text-sm text-on-surface truncate block">{selectedDealerDetail.assignedStaffName || 'Assigned'}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Total Quotes</span>
                <span className="font-mono font-bold text-sm text-on-surface">{selectedDealerDetail.quotationsCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Converted Files</span>
                <span className="font-mono font-bold text-sm text-primary">{selectedDealerDetail.customerFilesCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-secondary block">Conversion Rate</span>
                <span className="font-mono font-bold text-sm text-primary">{selectedDealerDetail.conversionRate}%</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-heading font-bold text-on-surface block">Customer Files Sourced</span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {(selectedDealerDetail.filesList || []).length === 0 ? (
                  <p className="text-secondary text-xs">No active customer files sourced by this dealer yet.</p>
                ) : (
                  (selectedDealerDetail.filesList || []).map(f => (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSelectedDealerDetail(null);
                        setSelectedFileForModal(f);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low/40 hover:bg-surface-container-low cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="font-bold text-on-surface">{f.customerName}</span>
                        <span className="text-secondary text-[10px] ml-2 font-mono">{f.solarSystemKw || 4.4} kW</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {f.status || 'Active'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setSelectedDealerDetail(null)}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-semibold cursor-pointer min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer File Modal */}
      {selectedFileForModal && (
        <CustomerFileDetailModal
          file={selectedFileForModal}
          onClose={() => setSelectedFileForModal(null)}
        />
      )}
    </div>
  );
}
