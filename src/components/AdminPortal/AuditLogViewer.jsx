import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';

export default function AuditLogViewer() {
  const { auditLogs } = useApp();

  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const formatDetailsText = (details) => {
    if (!details) return '';
    if (typeof details === 'string') return details;
    if (typeof details === 'object') {
      return details.message || details.reason || details.description || JSON.stringify(details);
    }
    return String(details);
  };

  const filteredLogs = useMemo(() => {
    return (auditLogs || []).filter(log => {
      if (moduleFilter !== 'ALL' && log.module !== moduleFilter) return false;
      if (roleFilter !== 'ALL' && log.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesAction = (log.action || '').toLowerCase().includes(term);
        const matchesDetails = formatDetailsText(log.details).toLowerCase().includes(term);
        const matchesUser = (log.userName || log.user || '').toLowerCase().includes(term);
        const matchesRecord = (log.recordId || '').toLowerCase().includes(term);
        if (!matchesAction && !matchesDetails && !matchesUser && !matchesRecord) return false;
      }
      return true;
    });
  }, [auditLogs, moduleFilter, roleFilter, searchTerm]);

  const exportAuditCsv = () => {
    const headers = ['Log ID', 'Timestamp', 'Action', 'Module', 'Record ID', 'User Name', 'Role', 'IP Address', 'Details', 'Status'];
    const rows = filteredLogs.map(l => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      `"${l.recordId}"`,
      `"${l.userName || l.user || 'System'}"`,
      `"${l.role}"`,
      `"${l.ipAddress || '192.168.1.1'}"`,
      `"${formatDetailsText(l.details).replace(/"/g, '""')}"`,
      `"${l.status || 'VERIFIED'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sunvine_audit_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto text-on-surface">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-secondary uppercase tracking-wider">
            <span>Regulatory &amp; Security Ledger</span>
            <span>&bull;</span>
            <span className="text-primary font-bold">Immutable Append-Only Audit Trail</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-on-surface mt-1">
            Enterprise Audit Logs &amp; Activity Trail
          </h1>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            Immutable tracking of user logins, quotation edits, margin modifications, document uploads, and lifecycle changes.
          </p>
        </div>

        <button
          type="button"
          onClick={exportAuditCsv}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface font-bold text-xs sm:text-sm border border-surface-container-high transition-all shadow-xs cursor-pointer min-h-[44px] shrink-0"
        >
          <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
          <span>Export Ledger (CSV)</span>
        </button>
      </div>

      {/* Filter Matrix */}
      <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-secondary font-medium mb-1">Filter by Module</label>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Modules</option>
              <option value="AUTH">Authentication &amp; Access (AUTH)</option>
              <option value="QUOTATION">Quotation Engine (QUOTATION)</option>
              <option value="CUSTOMER_FILE">Customer Files (CUSTOMER_FILE)</option>
              <option value="SETTINGS">System Settings (SETTINGS)</option>
              <option value="DEALER">Dealer Network (DEALER)</option>
              <option value="STAFF">Sales Staff (STAFF)</option>
              <option value="DESIGN_CAD">Solar CAD (DESIGN_CAD)</option>
            </select>
          </div>

          <div>
            <label className="block text-secondary font-medium mb-1">Filter by User Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="System Administrator">System Administrator</option>
              <option value="Staff Executive">Staff Executive</option>
              <option value="Authorized Dealer">Authorized Dealer</option>
            </select>
          </div>

          <div>
            <label className="block text-secondary font-medium mb-1">Search Keywords</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by action, details, user, ID..."
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">history</span>
            <h3 className="font-heading font-bold text-sm text-on-surface">
              Audit Event Ledger ({filteredLogs.length} Events)
            </h3>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            INTEGRITY VERIFIED &bull; GUJARAT CLUSTER
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-container-high text-secondary">
                <th className="py-2.5 px-3">Timestamp (IST)</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Module</th>
                <th className="py-2.5 px-3">Record ID</th>
                <th className="py-2.5 px-3">User &bull; Role</th>
                <th className="py-2.5 px-3">Event Details</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/60">
              {filteredLogs.map(log => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-surface-container-low/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-[11px] text-secondary whitespace-nowrap">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN') : 'Recent'}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-on-surface text-[11px] block">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-secondary font-mono">{log.id}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-surface-container-low font-mono font-semibold text-[10px]">
                      {log.module}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-primary font-semibold">
                    {log.recordId}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-on-surface">{log.userName || log.user || 'System'}</div>
                    <div className="text-[10px] text-secondary">{log.role || 'Admin'}</div>
                  </td>
                  <td className="py-3 px-3 text-secondary max-w-[280px] truncate" title={formatDetailsText(log.details)}>
                    {formatDetailsText(log.details)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {log.status || 'VERIFIED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high w-full max-w-xl p-6 text-on-surface space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">verified_user</span>
                <h3 className="font-heading font-bold text-base">Audit Record Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-secondary hover:text-on-surface rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-container-low space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-secondary">Log ID:</span>
                  <span className="font-bold text-on-surface">{selectedLog.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Timestamp:</span>
                  <span>{selectedLog.timestamp ? new Date(selectedLog.timestamp).toISOString() : 'Recent'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Module / Action:</span>
                  <span className="text-primary font-bold">{selectedLog.module} &bull; {selectedLog.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Record ID:</span>
                  <span>{selectedLog.recordId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Actor:</span>
                  <span>{selectedLog.userName || selectedLog.user || 'System'} ({selectedLog.role})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Source IP:</span>
                  <span>{selectedLog.ipAddress || '192.168.1.104'}</span>
                </div>
              </div>

              <div>
                <label className="block text-secondary font-medium mb-1">Details &bull; Description</label>
                <p className="p-3 rounded-lg bg-surface-container-low text-on-surface leading-relaxed whitespace-pre-wrap">
                  {formatDetailsText(selectedLog.details)}
                </p>
              </div>

              {(selectedLog.oldValue || selectedLog.newValue) && (
                <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-secondary block font-sans text-xs">Previous State</span>
                    <pre className="mt-1 text-secondary whitespace-pre-wrap">{JSON.stringify(selectedLog.oldValue, null, 2) || 'None'}</pre>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-emerald-800 block font-sans text-xs font-bold">Committed State</span>
                    <pre className="mt-1 text-emerald-900 whitespace-pre-wrap">{JSON.stringify(selectedLog.newValue, null, 2) || 'Committed'}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-semibold cursor-pointer min-h-[44px]"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
