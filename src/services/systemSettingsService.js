import { supabase } from '../lib/supabase';

export const systemSettingsService = {
  async getSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global_settings')
        .single();

      if (!error && data) {
        const tw = data.terms_and_warranties || {};
        return {
          companyProfile: data.company_profile,
          bankDetails: data.bank_details,
          termsAndWarranties: tw,
          statutoryTaxes: data.statutory_taxes,
          masterDocRegistry: tw.masterDocRegistry || data.master_doc_registry || null,
          categoryDocRules: tw.categoryDocRules || data.category_doc_rules || null
        };
      }
    } catch (err) {
      console.warn('Supabase fetch system settings fallback:', err);
    }

    return null;
  },

  async saveSystemSettings(settings) {
    if (!settings) return { success: false, error: 'Settings required' };

    try {
      const payload = {
        id: 'global_settings',
        company_profile: settings.companyProfile || settings,
        bank_details: settings.bankDetails || {},
        terms_and_warranties: settings.termsAndWarranties || {},
        statutory_taxes: settings.statutoryTaxes || {},
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('system_settings')
        .upsert([payload], { onConflict: 'id' });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async saveDocumentRules(masterDocRegistry, categoryDocRules) {
    try {
      const { data: curr } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global_settings')
        .maybeSingle();

      const tw = curr?.terms_and_warranties || {};
      tw.masterDocRegistry = masterDocRegistry;
      tw.categoryDocRules = categoryDocRules;

      const payload = {
        id: 'global_settings',
        company_profile: curr?.company_profile || {},
        bank_details: curr?.bank_details || {},
        terms_and_warranties: tw,
        statutory_taxes: curr?.statutory_taxes || {},
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('system_settings')
        .upsert([payload], { onConflict: 'id' });

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      console.warn('[systemSettingsService] Save doc rules fallback:', err);
      return { success: false, error: err.message };
    }
  },

  async getCustomUnitsAndCategories() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('terms_and_warranties')
        .eq('id', 'global_settings')
        .maybeSingle();

      const tw = data?.terms_and_warranties || {};
      return {
        units: Array.isArray(tw.customUnits) ? tw.customUnits : [],
        categories: Array.isArray(tw.customCategories) ? tw.customCategories : []
      };
    } catch (err) {
      console.warn('[systemSettingsService] getCustomUnitsAndCategories error:', err);
      return { units: [], categories: [] };
    }
  },

  async saveCustomUnitsAndCategories(units, categories) {
    try {
      const { data: curr } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global_settings')
        .maybeSingle();

      const tw = curr?.terms_and_warranties || {};
      if (Array.isArray(units)) tw.customUnits = units;
      if (Array.isArray(categories)) tw.customCategories = categories;

      const payload = {
        id: 'global_settings',
        company_profile: curr?.company_profile || {},
        bank_details: curr?.bank_details || {},
        terms_and_warranties: tw,
        statutory_taxes: curr?.statutory_taxes || {},
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('system_settings')
        .upsert([payload], { onConflict: 'id' });

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      console.error('[systemSettingsService] saveCustomUnitsAndCategories error:', err);
      return { success: false, error: err.message };
    }
  }
};
