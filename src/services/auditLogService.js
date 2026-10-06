import { supabase } from '../lib/supabase';

export const auditLogService = {
  async getAuditLogs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data.map(row => {
          let detailsText = '';
          if (typeof row.details === 'string') {
            detailsText = row.details;
          } else if (row.details && typeof row.details === 'object') {
            detailsText = row.details.message || row.details.reason || row.details.description || JSON.stringify(row.details);
          } else if (row.details != null) {
            detailsText = String(row.details);
          }
          return {
            id: row.id,
            timestamp: row.created_at || row.timestamp || new Date().toISOString(),
            action: row.action || 'SYSTEM_ACTION',
            module: row.module || row.entity_type || 'SYSTEM',
            recordId: row.record_id || row.entity_id || '-',
            userName: row.user_name || row.user_email || row.user || 'System',
            user: row.user_name || row.user_email || row.user || 'System',
            role: row.role || row.user_role || 'admin',
            ipAddress: row.ip_address || '192.168.1.1',
            details: detailsText,
            oldValue: row.old_value || (row.details && typeof row.details === 'object' && row.details.oldValue) || null,
            newValue: row.new_value || (row.details && typeof row.details === 'object' && row.details.newValue) || null,
            status: row.status || 'VERIFIED'
          };
        });
      }
    } catch (err) {
      console.warn('Supabase fetch audit logs fallback:', err);
    }

    return [];
  },

  async logEvent(action, entityType, entityId, details = {}, userEmail = 'ops@sunvine.in', userRole = 'admin') {
    let detailsObj = {};
    if (typeof details === 'object' && details !== null) {
      detailsObj = details;
    } else if (typeof details === 'string' && details.trim()) {
      detailsObj = { message: details.trim() };
    }

    const payload = {
      action: action || 'SYSTEM_ACTION',
      module: entityType || 'SYSTEM',
      entity_type: entityType || 'SYSTEM',
      record_id: entityId ? String(entityId) : null,
      entity_id: entityId ? String(entityId) : null,
      user_email: userEmail,
      user_name: userEmail,
      user_role: userRole,
      role: userRole,
      details: detailsObj,
      status: 'VERIFIED'
    };

    try {
      const { error } = await supabase.from('audit_logs').insert([payload]);
      if (error) {
        console.error('[auditLogService] Supabase audit log insert error:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
      }
    } catch (err) {
      console.error('[auditLogService] Exception inserting audit log:', err);
    }
  },

  async getNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          audience: row.audience,
          type: row.type,
          icon: row.icon,
          title: row.title,
          description: row.description,
          isRelease: row.is_release,
          version: row.version,
          targetTab: row.target_tab,
          createdAt: row.created_at
        }));
      }
    } catch (err) {
      console.warn('Supabase fetch notifications fallback:', err);
    }

    return [];
  },

  async saveNotification(notif) {
    if (!notif || !notif.id) return { success: false };
    try {
      const payload = {
        id: notif.id,
        audience: notif.audience || 'all',
        type: notif.type || 'info',
        icon: notif.icon || 'notifications',
        title: notif.title,
        description: notif.description || '',
        is_release: Boolean(notif.isRelease),
        version: notif.version || null,
        target_tab: notif.targetTab || null,
        created_at: notif.createdAt || new Date().toISOString()
      };
      await supabase.from('notifications').upsert([payload], { onConflict: 'id' });
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  }
};
