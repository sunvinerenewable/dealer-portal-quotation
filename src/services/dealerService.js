import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';

async function invalidateCatalogCache(keys) {
  try {
    await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'invalidate', keys: Array.isArray(keys) ? keys : [keys] })
    });
  } catch (_) {}
}

export const dealerService = {
  /**
   * Fetch all registered dealers from Supabase PostgreSQL
   */
  async getAllDealers() {
    try {
      const { data, error } = await supabase
        .from('dealer_accounts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[dealerService] Fetch dealers warning:', error.message);
        return [];
      }

      if (Array.isArray(data)) {
        return data.map(d => ({
          id: d.dealer_code || d.id,
          uuid: d.id,
          dealerCode: d.dealer_code,
          firmName: d.firm_name,
          contactPerson: d.contact_person,
          mobile: d.mobile_number,
          mobileNumber: d.mobile_number,
          email: d.email,
          city: d.city,
          state: d.state,
          discom: d.discom,
          status: d.status ? (d.status.charAt(0).toUpperCase() + d.status.slice(1).toLowerCase()) : 'Active',
          rating: Number(d.rating) || 4.9,
          tier: d.tier || 'Gold EPC',
          maxMarginCapPerKw: Number(d.max_margin_cap_per_kw) || 6000,
          totalCommissionedMw: Number(d.total_commissioned_mw) || 0,
          assignedStaffId: (() => {
            const rawId = d.assigned_staff_id || d.pricing_config?.assignedStaffId;
            if (rawId === 'STF-001') {
              return (d.pricing_config?.assignedStaffId && d.pricing_config?.assignedStaffId !== 'STF-001')
                ? d.pricing_config.assignedStaffId
                : 'STF-DIRECT';
            }
            return rawId || 'STF-DIRECT';
          })(),
          assignedStaffName: (() => {
            const rawId = d.assigned_staff_id || d.pricing_config?.assignedStaffId;
            if (rawId === 'STF-DIRECT') return 'Direct to Company (HQ Desk)';
            const rawName = d.assigned_staff_name || d.pricing_config?.assignedStaffName;
            if (rawName === 'Jayesh Patel') {
              return (d.pricing_config?.assignedStaffName && d.pricing_config?.assignedStaffName !== 'Jayesh Patel')
                ? d.pricing_config.assignedStaffName
                : (rawId === 'STF-DIRECT' ? 'Direct to Company (HQ Desk)' : 'Sunvine Sales Staff');
            }
            return rawName || 'Direct to Company (HQ Desk)';
          })(),
          bankName: d.bank_name || 'State Bank of India',
          accountNumber: d.account_number || '394857201948',
          ifscCode: d.ifsc_code || 'SBIN0001234',
          branch: d.branch || `${d.city || 'Ahmedabad'} Main Branch`,
          pricingConfig: d.pricing_config || {},
          createdAt: d.created_at
        }));
      }
    } catch (err) {
      console.warn('[dealerService] Error fetching dealers:', err);
    }

    return [];
  },

  /**
   * Create a new dealer securely with verified Bcrypt hashed credentials
   */
  async createDealer(dealer) {
    if (!dealer) return { success: false, error: 'Dealer details required' };
    const cleanPhone = String(dealer.mobile || dealer.mobileNumber || '').replace(/\D/g, '').slice(-10);
    const dealerCode = dealer.dealerCode || dealer.id || `SV-DLR-${Date.now().toString().slice(-4)}`;
    const plainPassword = String(dealer.password || dealer.accessCode || 'Sunvine@2026').trim();
    const assignedStaffId = dealer.assignedStaffId || 'STF-DIRECT';
    const assignedStaffName = assignedStaffId === 'STF-DIRECT'
      ? 'Direct to Company (HQ Desk)'
      : (dealer.assignedStaffName || 'Sunvine Sales Staff');

    // 1. Try server-side secure manage-credentials endpoint first
    try {
      const res = await fetch('/api/auth/manage-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-dealer',
          payload: {
            ...dealer,
            dealerCode,
            mobile: cleanPhone,
            password: plainPassword,
            assignedStaffId,
            assignedStaffName
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return { success: true, id: data.dealer?.dealer_code || dealerCode };
        }
      }
    } catch (apiErr) {
      console.warn('[dealerService] Server credential creation failed, using client fallback:', apiErr.message);
    }

    // 2. Client fallback with Bcrypt hashing
    try {
      const passwordHash = bcrypt.hashSync(plainPassword, 10);
      const payload = {
        dealer_code: dealerCode,
        firm_name: dealer.firmName || 'Gujarat Solar EPC',
        contact_person: dealer.contactPerson || 'Authorized Partner',
        mobile_number: cleanPhone,
        email: (dealer.email && String(dealer.email).trim()) ? String(dealer.email).trim() : null,
        password_hash: passwordHash,
        city: dealer.city || 'Ahmedabad',
        state: dealer.state || 'Gujarat',
        discom: dealer.discom || 'UGVCL',
        status: (dealer.status || 'active').toLowerCase(),
        tier: dealer.tier || 'Gold EPC',
        max_margin_cap_per_kw: Number(dealer.maxMarginCapPerKw) || 6000,
        assigned_staff_id: assignedStaffId,
        assigned_staff_name: assignedStaffName,
        pricing_config: {
          ...(dealer.pricingConfig || {}),
          assignedStaffId,
          assignedStaffName
        },
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('dealer_accounts').upsert([payload], { onConflict: 'dealer_code' });
      if (error) {
        console.warn('[dealerService] Supabase upsert error:', error.message);
      }
      return { success: true, id: dealerCode };
    } catch (err) {
      console.error('[dealerService] Exception creating dealer:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Save / Upsert dealer
   */
  async saveDealer(dealer) {
    if (!dealer) return { success: false, error: 'Dealer required' };
    const dealerCode = dealer.dealerCode || dealer.id;
    return this.updateDealer(dealerCode, dealer);
  },

  /**
   * Update dealer details in Supabase
   */
  async updateDealer(dealerCodeOrId, fields) {
    if (!dealerCodeOrId) return { success: false, error: 'Dealer ID required' };

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (fields.firmName !== undefined) updatePayload.firm_name = fields.firmName;
    if (fields.contactPerson !== undefined) updatePayload.contact_person = fields.contactPerson;
    if (fields.mobile !== undefined || fields.mobileNumber !== undefined) {
      updatePayload.mobile_number = String(fields.mobile || fields.mobileNumber).replace(/\D/g, '').slice(-10);
    }
    if (fields.email !== undefined) {
      updatePayload.email = (fields.email && String(fields.email).trim()) ? String(fields.email).trim() : null;
    }
    if (fields.city !== undefined) updatePayload.city = fields.city;
    if (fields.state !== undefined) updatePayload.state = fields.state;
    if (fields.discom !== undefined) updatePayload.discom = fields.discom;
    if (fields.status !== undefined) updatePayload.status = fields.status.toLowerCase();
    if (fields.tier !== undefined) updatePayload.tier = fields.tier;
    if (fields.maxMarginCapPerKw !== undefined) updatePayload.max_margin_cap_per_kw = Number(fields.maxMarginCapPerKw);
    if (fields.assignedStaffId !== undefined) {
      updatePayload.assigned_staff_id = fields.assignedStaffId;
      if (fields.assignedStaffId === 'STF-DIRECT') {
        updatePayload.assigned_staff_name = 'Direct to Company (HQ Desk)';
      }
    }
    if (fields.assignedStaffName !== undefined) {
      updatePayload.assigned_staff_name = fields.assignedStaffId === 'STF-DIRECT'
        ? 'Direct to Company (HQ Desk)'
        : fields.assignedStaffName;
    }
    if (fields.bankName !== undefined) updatePayload.bank_name = fields.bankName;
    if (fields.accountNumber !== undefined) updatePayload.account_number = fields.accountNumber;
    if (fields.ifscCode !== undefined) updatePayload.ifsc_code = fields.ifscCode;
    if (fields.branch !== undefined) updatePayload.branch = fields.branch;
    if (fields.pricingConfig !== undefined || fields.assignedStaffId !== undefined) {
      const finalStaffId = fields.assignedStaffId !== undefined ? fields.assignedStaffId : fields.pricingConfig?.assignedStaffId;
      const finalStaffName = finalStaffId === 'STF-DIRECT'
        ? 'Direct to Company (HQ Desk)'
        : (fields.assignedStaffName !== undefined ? fields.assignedStaffName : fields.pricingConfig?.assignedStaffName);
      updatePayload.pricing_config = {
        ...(fields.pricingConfig || {}),
        ...(finalStaffId ? { assignedStaffId: finalStaffId } : {}),
        ...(finalStaffName ? { assignedStaffName: finalStaffName } : {})
      };
    }
    if (fields.password || fields.accessCode) {
      const plainPassword = String(fields.password || fields.accessCode).trim();
      updatePayload.password_hash = bcrypt.hashSync(plainPassword, 10);
    }

    // Attempt server-side credential update if sensitive auth fields or assigned staff changed
    if (fields.password || fields.accessCode || fields.mobile || fields.mobileNumber || fields.email !== undefined || fields.assignedStaffId) {
      try {
        await fetch('/api/auth/manage-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'update-dealer-credentials',
            payload: {
              dealerCode: dealerCodeOrId,
              email: (fields.email && String(fields.email).trim()) ? String(fields.email).trim() : null,
              mobile: updatePayload.mobile_number,
              password: fields.password || fields.accessCode,
              firmName: fields.firmName,
              name: fields.contactPerson,
              assignedStaffId: fields.assignedStaffId,
              assignedStaffName: fields.assignedStaffName,
              pricingConfig: updatePayload.pricing_config
            }
          })
        });
      } catch (_) {}
    }

    try {
      const targetCode = String(dealerCodeOrId || '').trim();
      const cleanCode = targetCode.replace(/^#/, '');
      const { data, error } = await supabase
        .from('dealer_accounts')
        .update(updatePayload)
        .or(`dealer_code.eq.${targetCode},dealer_code.eq.${cleanCode},id.eq.${targetCode},id.eq.${cleanCode},dealer_code.eq.#${cleanCode}`);

      if (error) {
        console.warn('[dealerService] Update dealer warning:', error.message);
        return { success: false, error: error.message };
      }

      invalidateCatalogCache([`dealer:rates:${dealerCodeOrId}`, 'directory:dealers:min']);
      return { success: true, data };
    } catch (err) {
      console.error('[dealerService] Error updating dealer:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete dealer from database
   */
  async deleteDealer(dealerCodeOrId) {
    if (!dealerCodeOrId) return { success: false, error: 'Dealer identifier is required.' };
    try {
      // 1. Try server-side delete
      try {
        await fetch('/api/auth/manage-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'delete-dealer',
            payload: { dealerCode: dealerCodeOrId }
          })
        });
      } catch (_) {}

      // 2. Direct Supabase delete
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(dealerCodeOrId || ''));
      let query = supabase.from('dealer_accounts').delete();
      if (isUuid) {
        query = query.eq('id', dealerCodeOrId);
      } else {
        query = query.eq('dealer_code', dealerCodeOrId);
      }

      const { error } = await query;

      invalidateCatalogCache([`dealer:rates:${dealerCodeOrId}`, 'directory:dealers:min']);

      if (error) {
        console.warn('[dealerService] Delete dealer warning:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[dealerService] Delete dealer exception:', err);
      return { success: false, error: err.message };
    }
  }
};
