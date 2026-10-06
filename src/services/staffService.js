import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';

export const staffService = {
  /**
   * Fetch all staff members from Supabase PostgreSQL
   */
  async getAllStaff() {
    try {
      const { data, error } = await supabase
        .from('staff_accounts')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('[staffService] Fetch staff warning:', error.message);
        return [];
      }

      if (Array.isArray(data)) {
        return data.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          phone: s.phone,
          email: s.email,
          zone: s.zone,
          city: s.city,
          department: s.department || (String(s.role || '').toLowerCase().includes('verification') ? 'Verification' : 'Sales'),
          status: s.status || 'Active',
          onboardedDate: s.onboarded_date || '2026-01-10',
          dealersCount: Number(s.dealers_count) || 0,
          directFilesCount: Number(s.direct_files_count) || 0,
          dealerFilesCount: Number(s.dealer_files_count) || 0,
          pipelineKw: Number(s.pipeline_kw) || 0,
          rating: Number(s.rating) || 4.9
        }));
      }
    } catch (err) {
      console.warn('[staffService] Error fetching staff:', err);
    }

    return [];
  },

  /**
   * Create staff member with Bcrypt password hashing
   */
  async createStaff(staff) {
    if (!staff || !staff.name || !staff.phone) {
      return { success: false, error: 'Staff name and phone number required' };
    }

    const cleanPhone = String(staff.phone).replace(/\D/g, '').slice(-10);
    const staffId = staff.id || `STF-${Date.now().toString().slice(-4)}`;
    const plainPassword = String(staff.password || staff.accessCode || 'Sunvine@2026').trim();
    const isVerification = String(staff.role || '').toLowerCase().includes('verification') || String(staff.department || '').toLowerCase().includes('verification');
    const department = staff.department || (isVerification ? 'verification' : 'sales');

    // 1. Try server-side secure manage-credentials endpoint
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-staff',
          payload: {
            ...staff,
            id: staffId,
            phone: cleanPhone,
            mobile: cleanPhone,
            password: plainPassword,
            department: String(department).toLowerCase(),
            status: 'active'
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, id: data.staff?.id || staffId };
        }
      }
    } catch (apiErr) {
      console.warn('[staffService] Server credential creation failed, using client fallback:', apiErr.message);
    }

    // 2. Client fallback with Bcrypt hashing
    try {
      const passwordHash = bcrypt.hashSync(plainPassword, 10);
      const payload = {
        id: staffId,
        name: staff.name,
        role: staff.role || (isVerification ? 'Verification Desk Officer' : 'Solar Field Executive'),
        phone: cleanPhone,
        mobile_number: cleanPhone,
        email: staff.email || `${cleanPhone}@sunvine.in`,
        password_hash: passwordHash,
        zone: staff.zone || 'Gujarat',
        city: staff.city || 'Ahmedabad',
        department: String(department).toLowerCase(),
        status: 'active',
        dealers_count: Number(staff.dealersCount) || 0,
        direct_files_count: Number(staff.directFilesCount) || 0,
        dealer_files_count: Number(staff.dealerFilesCount) || 0,
        pipeline_kw: Number(staff.pipelineKw) || 0,
        rating: Number(staff.rating) || 4.9,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('staff_accounts').upsert([payload], { onConflict: 'id' });
      if (error) {
        console.warn('[staffService] Supabase upsert error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, id: staffId, staff: payload };
    } catch (err) {
      console.error('[staffService] Exception creating staff:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Save / Upsert staff member
   */
  async saveStaff(staff) {
    if (!staff || !staff.id) return { success: false, error: 'Staff ID required' };
    return this.updateStaff(staff.id, staff);
  },

  /**
   * Update staff member fields in Supabase
   */
  async updateStaff(staffId, fields) {
    if (!staffId) return { success: false, error: 'Staff ID required' };

    const payload = {
      updated_at: new Date().toISOString()
    };

    if (fields.name !== undefined) payload.name = fields.name;
    if (fields.role !== undefined) {
      payload.role = fields.role;
      if (!fields.department) {
        payload.department = fields.role.toLowerCase().includes('verification') ? 'verification' : 'sales';
      }
    }
    if (fields.phone !== undefined) {
      const cleanPhone = String(fields.phone).replace(/\D/g, '').slice(-10);
      payload.phone = cleanPhone;
      payload.mobile_number = cleanPhone;
    }
    if (fields.email !== undefined) payload.email = fields.email;
    if (fields.zone !== undefined) payload.zone = fields.zone;
    if (fields.city !== undefined) payload.city = fields.city;
    if (fields.department !== undefined) payload.department = String(fields.department).toLowerCase();
    if (fields.status !== undefined) payload.status = String(fields.status).toLowerCase();
    if (fields.dealersCount !== undefined) payload.dealers_count = Number(fields.dealersCount);
    if (fields.directFilesCount !== undefined) payload.direct_files_count = Number(fields.directFilesCount);
    if (fields.dealerFilesCount !== undefined) payload.dealer_files_count = Number(fields.dealerFilesCount);
    if (fields.pipelineKw !== undefined) payload.pipeline_kw = Number(fields.pipelineKw);
    if (fields.rating !== undefined) payload.rating = Number(fields.rating);

    if (fields.password || fields.accessCode) {
      const plainPassword = String(fields.password || fields.accessCode).trim();
      payload.password_hash = bcrypt.hashSync(plainPassword, 10);
    }

    // Try server manage-credentials API if credentials changed
    if (fields.password || fields.accessCode || fields.phone || fields.email || fields.name || fields.role) {
      try {
        await fetch('/api/auth/manage-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'update-staff-credentials',
            payload: {
              staffId,
              name: fields.name,
              phone: payload.phone,
              email: fields.email,
              role: fields.role,
              department: payload.department || fields.department,
              password: fields.password || fields.accessCode
            }
          })
        });
      } catch (_) {}
    }

    try {
      const { data, error } = await supabase
        .from('staff_accounts')
        .update(payload)
        .eq('id', staffId);

      if (error) {
        console.warn('[staffService] Update staff warning:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[staffService] Update staff error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Update staff password (Bcrypt Hash)
   */
  async updateStaffPassword(staffId, newPassword) {
    if (!newPassword || newPassword.length < 1) {
      return { success: false, error: 'Password cannot be empty.' };
    }

    // 1. Try server-side endpoint
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-staff-credentials',
          payload: { staffId, password: newPassword }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) return { success: true };
      }
    } catch (_) {}

    // 2. Client fallback with Bcrypt hashing
    try {
      const passwordHash = bcrypt.hashSync(newPassword, 10);
      const { error } = await supabase
        .from('staff_accounts')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', staffId);

      if (error) {
        console.warn('[staffService] Supabase update password error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[staffService] Update staff password error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete staff member from database
   */
  async deleteStaff(staffId) {
    if (!staffId) return { success: false, error: 'Staff ID is required.' };
    try {
      // 1. Try server-side delete
      try {
        await fetch('/api/auth/manage-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'delete-staff',
            payload: { staffId }
          })
        });
      } catch (_) {}

      // 2. Direct Supabase delete
      const { error } = await supabase
        .from('staff_accounts')
        .delete()
        .eq('id', staffId);

      if (error) {
        console.warn('[staffService] Delete staff warning:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[staffService] Delete staff exception:', err);
      return { success: false, error: err.message };
    }
  }
};
