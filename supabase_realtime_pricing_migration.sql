-- ====================================================================
-- SUNVINE RENEWABLE ENERGY - MASTER REALTIME PRICING & BOM MIGRATION
-- Production-Ready Schema for Dynamic Solar PV Modules, Inverters,
-- Field BoS Hardware Catalog, Tier Margins, and Supabase Realtime Sync
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SOLAR PV MODULES TABLE
CREATE TABLE IF NOT EXISTS public.solar_modules (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(255) NOT NULL,
    wattage INTEGER NOT NULL,
    cell_tech VARCHAR(100) NOT NULL DEFAULT 'TOPCon Mono Bifacial',
    efficiency VARCHAR(50) DEFAULT '22.6%',
    rate_per_wp VARCHAR(50) NOT NULL DEFAULT '₹ 24.20/Wp',
    warranty VARCHAR(100) DEFAULT '30 Years Performance',
    dimensions VARCHAR(100) DEFAULT '2278 × 1134 × 30 mm | 28 kg',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_new BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_solar_modules_brand_watt ON public.solar_modules(brand, wattage);

-- 2. STRING INVERTERS TABLE
CREATE TABLE IF NOT EXISTS public.solar_inverters (
    id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(255) NOT NULL,
    capacity VARCHAR(100) NOT NULL DEFAULT '3.6 kW',
    capacity_kw NUMERIC(6,2) NOT NULL DEFAULT 3.6,
    phase VARCHAR(50) NOT NULL DEFAULT 'Single Phase',
    efficiency VARCHAR(50) DEFAULT '98.4%',
    warranty VARCHAR(100) DEFAULT '8 Years Comprehensive',
    base_price VARCHAR(50) NOT NULL DEFAULT '₹ 15,500',
    specs TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_solar_inverters_brand_cap ON public.solar_inverters(brand, capacity_kw);

-- 3. BILL OF MATERIALS (BOM) CATALOG ITEMS
CREATE TABLE IF NOT EXISTS public.bom_catalog_items (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'structure',
    make VARCHAR(100) NOT NULL DEFAULT 'STANDARD',
    unit VARCHAR(20) NOT NULL DEFAULT 'NOS',
    default_rate NUMERIC(10,2) NOT NULL DEFAULT 100.00,
    gst_rate NUMERIC(4,2) NOT NULL DEFAULT 18.00,
    specs TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 100,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. GLOBAL PRICING PRESETS
CREATE TABLE IF NOT EXISTS public.pricing_presets (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_default',
    base_rate_per_kw NUMERIC(10,2) NOT NULL DEFAULT 59800.00,
    subsidy_cap NUMERIC(10,2) NOT NULL DEFAULT 78000.00,
    min_margin_per_kw NUMERIC(10,2) NOT NULL DEFAULT 4000.00,
    enforce_min_margin BOOLEAN NOT NULL DEFAULT true,
    last_synced_by VARCHAR(100) DEFAULT 'Operations Desk',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. DEALER TIER MARGINS
CREATE TABLE IF NOT EXISTS public.dealer_custom_pricing (
    tier_id VARCHAR(50) PRIMARY KEY,
    tier_name VARCHAR(100) NOT NULL,
    default_margin_per_kw NUMERIC(10,2) NOT NULL DEFAULT 4500.00,
    max_margin_cap_per_kw NUMERIC(10,2) NOT NULL DEFAULT 6000.00,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. DEALER PRODUCT OVERRIDES
CREATE TABLE IF NOT EXISTS public.dealer_product_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL,
    product_type VARCHAR(50) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    custom_rate NUMERIC(10,2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(dealer_id, product_type, product_id)
);

-- 7. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
    id VARCHAR(50) PRIMARY KEY,
    dealer_id UUID,
    dealer_code VARCHAR(50),
    dealer_name VARCHAR(255),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_city VARCHAR(100),
    customer_state VARCHAR(100) DEFAULT 'Gujarat',
    system_capacity_kw NUMERIC(6,2) NOT NULL,
    project_type VARCHAR(50) DEFAULT 'Residential',
    panel_type VARCHAR(255),
    solar_module VARCHAR(255),
    selected_module_make VARCHAR(100),
    selected_inverter_make VARCHAR(100),
    module_wattage INTEGER,
    module_count INTEGER,
    rate_per_wp NUMERIC(8,2),
    inverter_brand VARCHAR(100),
    inverter_capacity_kw NUMERIC(6,2),
    inverter_quantity INTEGER DEFAULT 1,
    inverter_unit_price NUMERIC(10,2),
    inverter_type VARCHAR(255),
    base_cost NUMERIC(12,2) NOT NULL,
    dealer_margin NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    subsidy_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_payable NUMERIC(12,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active / Sent',
    is_direct_company_quote BOOLEAN DEFAULT false,
    bom_items JSONB,
    bom_totals JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. QUOTATION IMMUTABLE BOM SNAPSHOTS
CREATE TABLE IF NOT EXISTS public.quotation_bom_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id VARCHAR(50) NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    item_id VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    make VARCHAR(100),
    unit VARCHAR(20) NOT NULL,
    quantity NUMERIC(8,2) NOT NULL,
    unit_rate NUMERIC(10,2) NOT NULL,
    gst_rate NUMERIC(4,2) NOT NULL,
    base_amount NUMERIC(12,2) NOT NULL,
    gst_amount NUMERIC(12,2) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quote_bom_quote_id ON public.quotation_bom_snapshots(quotation_id);

-- ====================================================================
-- SEED DATA: SOLAR PV MODULES (ALMM Approved Master List)
-- ====================================================================
INSERT INTO public.solar_modules (id, brand, model, wattage, cell_tech, efficiency, rate_per_wp, warranty, is_default, is_new)
VALUES
    ('mod-waaree-585', 'Waaree', 'Waaree 585W TOPCon Bifacial', 585, 'N-Type TOPCon Dual-Glass Bifacial', '22.8%', '₹ 26.00/Wp', '30 Years Linear Performance', true, false),
    ('mod-waaree-550', 'Waaree', 'Waaree 550W Mono PERC', 550, 'Mono PERC Bi-facial Glass-Glass', '21.5%', '₹ 24.50/Wp', '25 Years Linear Performance', false, false),
    ('mod-aps-600', 'APS', 'APS 600W TOPCon Bifacial Dual Glass', 600, 'N-Type TOPCon 16BB High Density', '23.2%', '₹ 24.20/Wp', '30 Years Comprehensive', false, true),
    ('mod-aps-610', 'APS', 'APS 610W TOPCon Bifacial Ultra Power', 610, 'N-Type TOPCon Dual Glass ALMM', '23.4%', '₹ 24.50/Wp', '30 Years Performance', false, true),
    ('mod-aps-615', 'APS', 'APS 615W High Efficiency TOPCon', 615, 'N-Type TOPCon Multi-Busbar', '23.6%', '₹ 24.80/Wp', '30 Years Performance', false, true),
    ('mod-rayzon-550', 'Rayzon', 'Rayzon 550W Mono PERC Bifacial', 550, 'Mono PERC 10BB Silver Frame', '21.4%', '₹ 23.80/Wp', '27 Years Linear Warranty', false, false),
    ('mod-rayzon-585', 'Rayzon', 'Rayzon 585W TOPCon Bifacial Pro', 585, 'N-Type TOPCon 16BB Glass-Glass', '22.7%', '₹ 25.50/Wp', '30 Years Performance', false, false),
    ('mod-adani-550', 'Adani', 'Adani 550W Vertex Mono PERC', 550, 'P-Type Multi-Busbar MBB', '21.3%', '₹ 25.00/Wp', '25 Years Performance', false, false)
ON CONFLICT (id) DO UPDATE SET
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    wattage = EXCLUDED.wattage,
    rate_per_wp = EXCLUDED.rate_per_wp,
    updated_at = now();

-- ====================================================================
-- SEED DATA: STRING INVERTERS (Single & Three Phase Master List)
-- ====================================================================
INSERT INTO public.solar_inverters (id, brand, model, capacity, capacity_kw, phase, efficiency, base_price, warranty, is_default)
VALUES
    ('inv-polycab-3.6k', 'Polycab', 'Polycab 3.6kW Single Phase On-Grid Inverter', '3.6 kW', 3.6, 'Single Phase', '98.2%', '₹ 15,500', '8 Years Comprehensive', true),
    ('inv-polycab-4.6k', 'Polycab', 'Polycab 4.6kW Single Phase Dual MPPT Inverter', '4.6 kW', 4.6, 'Single Phase', '98.3%', '₹ 23,800', '8 Years Comprehensive', false),
    ('inv-polycab-5k-3p', 'Polycab', 'Polycab 5kW Three Phase On-Grid Inverter', '5.0 kW', 5.0, 'Three Phase', '98.5%', '₹ 26,000', '8 Years Comprehensive', false),
    ('inv-polycab-6k', 'Polycab', 'Polycab 6kW Three Phase Dual MPPT Inverter', '6.0 kW', 6.0, 'Three Phase', '98.5%', '₹ 40,000', '8 Years Comprehensive', false),
    ('inv-polycab-8k', 'Polycab', 'Polycab 8kW Three Phase High Efficiency Inverter', '8.0 kW', 8.0, 'Three Phase', '98.6%', '₹ 48,000', '8 Years Comprehensive', false),
    ('inv-polycab-10k', 'Polycab', 'Polycab 10kW Three Phase Commercial Inverter', '10.0 kW', 10.0, 'Three Phase', '98.7%', '₹ 54,000', '8 Years Comprehensive', false),
    ('inv-vsole-3.3k', 'Vsole', 'Vsole 3.3kW Single Phase Smart Inverter', '3.3 kW', 3.3, 'Single Phase', '97.8%', '₹ 14,800', '7 Years Warranty', false),
    ('inv-vsole-5k', 'Vsole', 'Vsole 5kW Single Phase Dual MPPT Inverter', '5.0 kW', 5.0, 'Single Phase', '98.1%', '₹ 24,500', '7 Years Warranty', false),
    ('inv-vsole-10k', 'Vsole', 'Vsole 10kW Three Phase Grid-Tied Inverter', '10.0 kW', 10.0, 'Three Phase', '98.4%', '₹ 52,000', '7 Years Warranty', false),
    ('inv-deye-3.6k', 'Deye', 'Deye 3.6kW Single Phase String Inverter', '3.6 kW', 3.6, 'Single Phase', '97.9%', '₹ 16,200', '5 Years Warranty', false),
    ('inv-deye-5k', 'Deye', 'Deye 5kW Single Phase Grid Inverter', '5.0 kW', 5.0, 'Single Phase', '98.2%', '₹ 26,500', '5 Years Warranty', false),
    ('inv-aps-5k', 'APS', 'APS 5kW Smart String Inverter with WiFi', '5.0 kW', 5.0, 'Single Phase', '98.4%', '₹ 25,500', '10 Years Warranty', false)
ON CONFLICT (id) DO UPDATE SET
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    capacity = EXCLUDED.capacity,
    capacity_kw = EXCLUDED.capacity_kw,
    base_price = EXCLUDED.base_price,
    updated_at = now();

-- ====================================================================
-- SEED DATA: FIELD BOM CATALOG ITEMS
-- ====================================================================
INSERT INTO public.bom_catalog_items (id, name, category, make, unit, default_rate, gst_rate, specs)
VALUES
    ('gi_pipe_60x40', '60X40 Hot Dip Galvanized Structural Pipe', 'structure', 'Fortune / Jindal (HDGI)', 'Meter', 85.00, 18.00, '60X40, 18 KW Structure Grade'),
    ('gi_pipe_40x40', '40X40 Hot Dip Galvanized Structural Pipe', 'structure', 'Fortune / Jindal (HDGI)', 'Meter', 84.00, 18.00, '40X40, 15 KW Structure Grade'),
    ('stud_12x2m', '12*2MTR Threaded Stud Grade 8.8', 'structure', 'Grade 8.8 / Standard', 'Nos', 140.00, 18.00, 'SS 304 / Grade 8.8 Structural Stud'),
    ('fastener', 'Heavy-Duty RCC Rooftop Anchor Fastener', 'structure', 'Hilti / Fischer / Reputed', 'Nos', 15.00, 18.00, 'M10 / M12 RCC Heavy Duty Anchor'),
    ('ms_j_bolt', 'HDGI J-Bolt for 40x40 Pipe Clamping', 'structure', 'HDGI Standard', 'Nos', 15.00, 18.00, '40x40 Pipe Clamp with Washers'),
    ('ms_angels', 'MS Galvanized Structural L-Angle Bracket (LA Patti)', 'structure', 'Tata / Jindal', 'Nos', 35.00, 18.00, 'MS Galvanized / LA Patti Bracing'),
    ('nut_washer', 'SS Nut & Spring Washers Set', 'structure', 'SS 304 / Grade 8.8', 'Nos', 2.50, 18.00, 'SS 304 Flat & Spring Washer Set'),
    ('zinc_spray', 'Cold Galvanizing Zinc Anti-Rust Spray Can', 'structure', '3M / Rust-Oleum', 'Can', 130.00, 18.00, 'Anti-Rust Coating (200-400ml)'),
    ('acdb_dcdb_combo', 'ASG ACDB / DCDB Dual Protection Box Combo', 'electrical', 'ASG / L&T / Schneider', 'Set', 1650.00, 18.00, '1kW - 6kW IP65 with SPD & MCB'),
    ('mc4_connector', 'MC4 Solar Connectors Pair (Male + Female)', 'electrical', 'Staubli / Multi-Contact', 'Nos', 35.00, 5.00, '1500V DC UV Resistant Connectors'),
    ('dc_wire_4sqmm', 'DC Solar Cable 4 Sq.mm Copper (EN 50618 Red/Black)', 'cables', 'Polycab / RR Kabel', 'Meter', 60.00, 18.00, 'TUV Certified 1-Core Solar Wire'),
    ('ac_wire_4sqmm', 'AC Cable 4 Sq.mm Heavy-Duty Copper 3/4-Core', 'cables', 'Polycab / Havells', 'Meter', 58.00, 18.00, 'IS 694 ISI Marked AC Wire'),
    ('earthing_cable', 'Earthing Cable 4 Sq.mm Pure Copper Wire', 'cables', 'Polycab / RR Kabel', 'Meter', 35.00, 18.00, 'Green PVC Insulated Earthing Cable'),
    ('la_cable', 'Lightning Arrestor Down Conductor 16 Sq.mm', 'cables', 'Polycab / Vasundhara', 'Meter', 20.00, 18.00, '1-Core 16 Sq.mm Down Conductor'),
    ('earthing_kit', 'Chemical Earthing Kit (Electrode + BFC Compound)', 'electrical', 'Vasundhara / Chemical Gel', 'Nos', 650.00, 18.00, 'Maintenance-Free IS 3043 Gel Earthing'),
    ('pvc_pipe_25mm', '25mm Heavy Duty PVC Conduit Pipe', 'conduits', 'Polycab / Precision', 'Nos', 45.00, 18.00, 'Rigid UV-Resistant Conduit (3Mtr)'),
    ('pvc_elbow_25mm', '25mm Heavy PVC Elbow Fittings', 'conduits', 'Polycab', 'Nos', 6.00, 18.00, 'Precision Conduit 90 Deg Elbow'),
    ('pvc_tee_25mm', '25mm Heavy PVC Tee Junction Fittings', 'conduits', 'Polycab', 'Nos', 5.00, 18.00, 'Precision Conduit Tee Junction'),
    ('shadel_clamp', 'Heavy Duty GI Saddle Clamps Packet', 'conduits', 'Heavy Duty GI', 'Pkt', 120.00, 18.00, 'Packet of 50 Pcs Clamps with Screws'),
    ('transportation', 'Insured Safe Freight & Doorstep Delivery', 'logistics', 'Sunvine Logistics', 'Set', 1000.00, 0.00, 'Direct-to-site insured transit')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    default_rate = EXCLUDED.default_rate,
    gst_rate = EXCLUDED.gst_rate,
    updated_at = now();

-- ====================================================================
-- SEED DATA: DEALER TIER MARGINS
-- ====================================================================
INSERT INTO public.dealer_custom_pricing (tier_id, tier_name, default_margin_per_kw, max_margin_cap_per_kw, description)
VALUES
    ('gold', 'Gold Tier Partner', 4500.00, 6000.00, 'Standard authorized dealer partner tier'),
    ('diamond', 'Diamond Elite Partner', 5500.00, 7500.00, 'High-volume EPC partner tier with priority dispatch'),
    ('platinum', 'Platinum Premier Partner', 6000.00, 8000.00, 'Distributor level tier with exclusive regional territory'),
    ('silver', 'Silver Associate Partner', 3500.00, 5000.00, 'Entry tier for registered solar installers')
ON CONFLICT (tier_id) DO UPDATE SET
    default_margin_per_kw = EXCLUDED.default_margin_per_kw,
    max_margin_cap_per_kw = EXCLUDED.max_margin_cap_per_kw,
    updated_at = now();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.solar_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_inverters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_custom_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_product_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_bom_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow All Public Read Modules" ON public.solar_modules FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Public Read Inverters" ON public.solar_inverters FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Public Read BOM Items" ON public.bom_catalog_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Public Read Presets" ON public.pricing_presets FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Public Read Tier Margins" ON public.dealer_custom_pricing FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All Quotations Access" ON public.quotations FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow All BOM Snapshots Access" ON public.quotation_bom_snapshots FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====================================================================
-- SUPABASE REALTIME REPLICATION ACTIVATION
-- ====================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solar_modules;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solar_inverters;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bom_catalog_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_presets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dealer_custom_pricing;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
