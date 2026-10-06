import { supabase } from '../lib/supabase';

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

/**
 * Enterprise Supabase Hardware Service
 * Manages approved solar PV modules and string inverters in Supabase PostgreSQL
 */
export const hardwareService = {
  /**
   * Check connection status to Supabase
   */
  async checkConnection() {
    try {
      const { data, error } = await supabase.from('solar_modules').select('id').limit(1);
      if (error) return { connected: false, error: error.message };
      return { connected: true };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  },

  /**
   * Fetch all solar modules from Supabase
   */
  async getAllModules() {
    // 1. Direct Supabase Query (Mandatory Single Source of Truth)
    try {
      const { data, error } = await supabase
        .from('solar_modules')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(row => ({
          id: row.id,
          brand: row.brand,
          model: row.model,
          wattage: Number(row.wattage) || 550,
          cellTech: row.cell_tech || 'TOPCon Mono Bifacial',
          efficiency: row.efficiency || '22.6%',
          ratePerWp: row.rate_per_wp || '₹ 19.20/Wp',
          warranty: row.warranty || '30 Years Performance',
          dimensions: row.dimensions || '2278 × 1134 × 30 mm | 28 kg',
          isArchived: !!row.is_archived,
          isDefault: !!row.is_default,
          isNew: !!row.is_new,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        }));
      }
    } catch (err) {
      console.warn('[hardwareService] Direct Supabase fetch notice:', err);
    }

    return [];
  },

  /**
   * Save or update a solar module in Supabase
   */
  async saveModule(mod) {
    if (!mod || !mod.brand || !mod.model) {
      return { success: false, error: 'Brand and Model are required' };
    }

    const payload = {
      id: mod.id || `mod-${Date.now()}`,
      brand: mod.brand.trim(),
      model: mod.model.trim(),
      wattage: Number(mod.wattage) || 550,
      cell_tech: mod.cellTech || 'TOPCon Mono Bifacial',
      efficiency: mod.efficiency || '22.6%',
      rate_per_wp: mod.ratePerWp ? (String(mod.ratePerWp).startsWith('₹') ? mod.ratePerWp : `₹ ${mod.ratePerWp}/Wp`) : '₹ 19.20/Wp',
      warranty: mod.warranty || '30 Years Performance',
      dimensions: mod.dimensions || '2278 × 1134 × 30 mm | 28 kg',
      is_archived: !!mod.isArchived,
      is_default: !!mod.isDefault,
      is_new: mod.isNew !== undefined ? !!mod.isNew : false,
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('solar_modules')
        .upsert([payload], { onConflict: 'id' })
        .select();

      invalidateCatalogCache(['catalog:hardware']);

      if (error) {
        console.warn('[hardwareService] Supabase saveModule error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('[hardwareService] saveModule exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Toggle archive state of a solar module in Supabase
   */
  async archiveModule(moduleId, isArchived) {
    try {
      const { error } = await supabase
        .from('solar_modules')
        .update({
          is_archived: isArchived,
          updated_at: new Date().toISOString()
        })
        .eq('id', moduleId);

      invalidateCatalogCache(['catalog:hardware']);

      if (error) {
        console.warn('[hardwareService] Supabase archiveModule error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] archiveModule exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a solar module from Supabase
   */
  async deleteModule(moduleId) {
    try {
      const { error } = await supabase
        .from('solar_modules')
        .delete()
        .eq('id', moduleId);

      invalidateCatalogCache(['catalog:hardware']);

      if (error) {
        console.warn('[hardwareService] Supabase deleteModule error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] deleteModule exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk update rates for multiple modules in Supabase
   */
  async bulkUpdateModulePrices(bulkRatesMap) {
    try {
      const updates = Object.entries(bulkRatesMap).map(([id, rate]) => ({
        id,
        rate_per_wp: `₹ ${Number(rate).toFixed(2)}/Wp`,
        updated_at: new Date().toISOString()
      }));

      for (const item of updates) {
        await supabase
          .from('solar_modules')
          .update({
            rate_per_wp: item.rate_per_wp,
            updated_at: item.updated_at
          })
          .eq('id', item.id);
      }

      return { success: true };
    } catch (err) {
      console.error('[hardwareService] bulkUpdateModulePrices error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk import multiple solar modules into Supabase
   */
  async bulkImportModules(modules) {
    if (!modules || modules.length === 0) return { success: true, count: 0 };

    const payloads = modules.map((mod, i) => ({
      id: mod.id || `mod-imp-${Date.now()}-${i}`,
      brand: mod.brand.trim(),
      model: mod.model.trim(),
      wattage: Number(mod.wattage) || 550,
      cell_tech: mod.cellTech || 'TOPCon Mono Bifacial',
      efficiency: mod.efficiency || '22.6%',
      rate_per_wp: mod.ratePerWp ? (String(mod.ratePerWp).startsWith('₹') ? mod.ratePerWp : `₹ ${mod.ratePerWp}/Wp`) : '₹ 19.50/Wp',
      warranty: mod.warranty || '30 Years Performance',
      dimensions: mod.dimensions || '2278 × 1134 × 30 mm | 28 kg',
      is_archived: false,
      is_default: false,
      is_new: true,
      updated_at: new Date().toISOString()
    }));

    try {
      const { data, error } = await supabase
        .from('solar_modules')
        .upsert(payloads, { onConflict: 'id' })
        .select();

      if (error) {
        console.warn('[hardwareService] bulkImportModules error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, count: data?.length || payloads.length };
    } catch (err) {
      console.error('[hardwareService] bulkImportModules exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch all string inverters from Supabase
   */
  async getAllInverters() {
    // 1. Direct Supabase Query (Mandatory Single Source of Truth)
    try {
      const { data, error } = await supabase
        .from('solar_inverters')
        .select('*')
        .order('capacity_kw', { ascending: true });

      if (!error && Array.isArray(data)) {
        return data.map(row => ({
          id: row.id,
          brand: row.brand,
          model: row.model,
          capacity: row.capacity || `${row.capacity_kw} kW`,
          capacityKW: Number(row.capacity_kw) || 5.0,
          phase: row.phase || 'Three Phase',
          efficiency: row.efficiency || '98.4%',
          warranty: row.warranty || '8 Years Comprehensive',
          basePrice: row.base_price || '₹ 54,000',
          isArchived: !!row.is_archived,
          isDefault: !!row.is_default,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        }));
      }
    } catch (err) {
      console.warn('[hardwareService] Direct Supabase inverters fetch notice:', err);
    }

    return [];
  },

  /**
   * Save or update a string inverter in Supabase
   */
  async saveInverter(inv) {
    if (!inv || !inv.brand || !inv.model) {
      return { success: false, error: 'Brand and Model are required' };
    }

    const rawCap = inv.capacity?.trim() || `${inv.capacityKW || 5.0} kW`;
    const formattedCap = rawCap.toLowerCase().includes('kw') ? rawCap : `${rawCap} kW`;
    const numCap = Number(inv.capacityKW) || parseFloat(rawCap.replace(/[^0-9.]/g, '')) || 5.0;

    const payload = {
      id: inv.id || `inv-${Date.now()}`,
      brand: inv.brand.trim(),
      model: inv.model.trim(),
      capacity: formattedCap,
      capacity_kw: numCap,
      phase: inv.phase || 'Three Phase',
      efficiency: inv.efficiency || '98.4%',
      warranty: inv.warranty || '8 Years Comprehensive',
      base_price: inv.basePrice || inv.base_price || '₹ 54,000',
      is_archived: !!inv.isArchived,
      is_default: !!inv.isDefault,
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('solar_inverters')
        .upsert([payload], { onConflict: 'id' })
        .select();

      invalidateCatalogCache(['catalog:hardware']);

      if (error) {
        console.warn('[hardwareService] Supabase saveInverter error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('[hardwareService] saveInverter exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Toggle archive state of an inverter in Supabase
   */
  async archiveInverter(inverterId, isArchived) {
    try {
      const { error } = await supabase
        .from('solar_inverters')
        .update({
          is_archived: isArchived,
          updated_at: new Date().toISOString()
        })
        .eq('id', inverterId);

      invalidateCatalogCache(['catalog:hardware']);

      if (error) {
        console.warn('[hardwareService] Supabase archiveInverter error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] archiveInverter exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete an inverter from Supabase
   */
  async deleteInverter(inverterId) {
    try {
      const { error } = await supabase
        .from('solar_inverters')
        .delete()
        .eq('id', inverterId);

      invalidateCatalogCache(['catalog:hardware']);

      if (error) {
        console.warn('[hardwareService] Supabase deleteInverter error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] deleteInverter exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Seed Initial Modules and Inverters to Supabase if empty
   */
  async seedInitialHardwareIfEmpty(defaultModules, defaultInverters) {
    try {
      const { count: modCount } = await supabase
        .from('solar_modules')
        .select('*', { count: 'exact', head: true });

      if (modCount === 0 && defaultModules?.length > 0) {
        const payloads = defaultModules.map(m => ({
          id: m.id,
          brand: m.brand,
          model: m.model,
          wattage: Number(m.wattage) || 550,
          cell_tech: m.cellTech || 'TOPCon Mono Bifacial',
          efficiency: m.efficiency || '22.6%',
          rate_per_wp: m.ratePerWp || '₹ 18.00/Wp',
          warranty: `${m.warrantyYears || 30} Years Performance`,
          dimensions: '2278 × 1134 × 30 mm | 28 kg',
          is_archived: false,
          is_default: !!m.isDefault
        }));
        await supabase.from('solar_modules').upsert(payloads, { onConflict: 'id' });
      }

      const { count: invCount } = await supabase
        .from('solar_inverters')
        .select('*', { count: 'exact', head: true });

      if (invCount === 0 && defaultInverters?.length > 0) {
        const payloads = defaultInverters.map(i => ({
          id: i.id,
          brand: i.brand,
          model: i.model,
          capacity: `${i.capacityKW} kW`,
          capacity_kw: Number(i.capacityKW) || 5.0,
          phase: i.phase || 'Three Phase',
          efficiency: i.efficiency || '98.4%',
          warranty: `${i.warrantyYears || 8} Years Comprehensive`,
          base_price: '₹ 54,000',
          is_archived: false,
          is_default: !!i.isDefault
        }));
        await supabase.from('solar_inverters').upsert(payloads, { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('[hardwareService] Seed notice:', err.message);
    }
  },

  /**
   * Fetch all Bill of Materials (BOM) Hardware Catalog Items from Supabase
   */
  async getAllBomItems() {
    try {
      const { data, error } = await supabase
        .from('bom_catalog')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('[hardwareService] Supabase bom_catalog fetch error:', error.message);
        return [];
      }

      if (Array.isArray(data)) {
        return data
          .filter(row => !row.id.startsWith('bom-') || row.inverter_spec?.match(/structure|electrical|cables|conduits|safety/i))
          .map(row => {
            const rawRate = Number(row.capacity_kw) || 0;
            return {
              id: row.id,
              name: row.modules_spec || row.id,
              category: row.inverter_spec || 'structure',
              description: row.dc_wire || '',
              unit: row.ac_wire || 'Nos',
              defaultRate: rawRate,
              rate: rawRate,
              make: row.hardware || 'Approved Make',
              specs: row.earthing_wire || '',
              gstRate: Number(row.la_wire) || 18,
              isArchived: row.acdb === 'archived',
              updatedAt: row.updated_at
            };
          });
      }

      return [];
    } catch (err) {
      console.error('[hardwareService] getAllBomItems exception:', err);
      return [];
    }
  },

  /**
   * Save or update a BOM hardware item directly in Supabase
   */
  async saveBomItem(item) {
    if (!item || !item.name) {
      return { success: false, error: 'Item name is required' };
    }

    const parsedRate = item.defaultRate !== undefined && item.defaultRate !== null && !isNaN(Number(item.defaultRate))
      ? Number(item.defaultRate)
      : (item.rate !== undefined && item.rate !== null && !isNaN(Number(item.rate)) ? Number(item.rate) : 100);

    const payload = {
      id: item.id || `bom_hw_${Date.now()}`,
      modules_spec: item.name.trim(),
      inverter_spec: item.category || 'structure',
      dc_wire: item.description || '',
      ac_wire: item.unit || 'Nos',
      capacity_kw: parsedRate,
      hardware: item.make || 'Approved Brand',
      earthing_wire: item.specs || '',
      la_wire: String(item.gstRate !== undefined ? item.gstRate : 18),
      acdb: item.isArchived ? 'archived' : 'active',
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('bom_catalog')
        .upsert([payload], { onConflict: 'id' })
        .select();

      if (error) {
        console.warn('[hardwareService] saveBomItem error:', error.message);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          id: payload.id,
          name: payload.modules_spec,
          category: payload.inverter_spec,
          description: payload.dc_wire,
          unit: payload.ac_wire,
          defaultRate: payload.capacity_kw,
          make: payload.hardware,
          specs: payload.earthing_wire,
          gstRate: Number(payload.la_wire) || 18,
          isArchived: payload.acdb === 'archived'
        }
      };
    } catch (err) {
      console.error('[hardwareService] saveBomItem exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a BOM hardware item from Supabase
   */
  async deleteBomItem(itemId) {
    if (!itemId) return { success: false, error: 'Item ID is required' };
    try {
      const { error } = await supabase
        .from('bom_catalog')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.warn('[hardwareService] deleteBomItem error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] deleteBomItem exception:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Toggle archive status of a BOM hardware item
   */
  async archiveBomItem(itemId, isArchived) {
    if (!itemId) return { success: false, error: 'Item ID is required' };
    try {
      const { error } = await supabase
        .from('bom_catalog')
        .update({
          acdb: isArchived ? 'archived' : 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk update benchmark rates for BOM hardware items
   */
  async bulkUpdateBomRates(ratesMap) {
    try {
      const updates = Object.entries(ratesMap).map(([id, rate]) => ({
        id,
        capacity_kw: Number(rate) || 0,
        updated_at: new Date().toISOString()
      }));

      for (const item of updates) {
        await supabase
          .from('bom_catalog')
          .update({
            capacity_kw: item.capacity_kw,
            updated_at: item.updated_at
          })
          .eq('id', item.id);
      }
      return { success: true };
    } catch (err) {
      console.error('[hardwareService] bulkUpdateBomRates error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Bulk import multiple BOM hardware items into Supabase
   */
  async bulkImportBomItems(items) {
    if (!items || items.length === 0) return { success: true, count: 0 };

    const payloads = items.map((it, idx) => {
      const parsedRate = it.defaultRate !== undefined && it.defaultRate !== null && !isNaN(Number(it.defaultRate))
        ? Number(it.defaultRate)
        : (it.rate !== undefined && it.rate !== null && !isNaN(Number(it.rate)) ? Number(it.rate) : 100);

      return {
        id: it.id || `bom_imp_${Date.now()}_${idx}`,
        modules_spec: (it.name || it.description || 'Hardware Item').trim(),
        inverter_spec: it.category || 'structure',
        dc_wire: it.description || it.specs || '',
        ac_wire: it.unit || 'Nos',
        capacity_kw: parsedRate,
        hardware: it.make || 'STANDARD',
        earthing_wire: it.specs || '',
        la_wire: String(it.gstRate !== undefined ? it.gstRate : 18),
        acdb: it.isArchived ? 'archived' : 'active',
        updated_at: new Date().toISOString()
      };
    });

    try {
      const { data, error } = await supabase
        .from('bom_catalog')
        .upsert(payloads, { onConflict: 'id' })
        .select();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, count: data?.length || payloads.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
