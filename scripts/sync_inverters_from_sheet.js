import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valParts] = trimmed.split('=');
      process.env[key.trim()] = valParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function syncCatalog() {
  const client = await pool.connect();
  try {
    console.log('--- PURGING & REPLACING INVERTERS IN SUPABASE ---');
    
    // 1. Purge all existing inverters
    await client.query('DELETE FROM public.solar_inverters;');

    // 2. Exact 12 Inverters from User Sheet
    const inverters = [
      {
        id: 'inv-polycab-3.6k',
        brand: 'Polycab',
        model: 'Polycab 3.6kW Single Phase On-Grid Inverter',
        capacity: '3.6 kW',
        capacity_kw: 3.6,
        phase: 'Single Phase',
        efficiency: '98.2%',
        warranty: '7 Years Comprehensive',
        base_price: '₹ 15,500',
        is_default: true,
        is_archived: false
      },
      {
        id: 'inv-vsole-3.6k',
        brand: 'Vsole',
        model: 'Vsole 3.6kW Single Phase Dual MPPT On-Grid',
        capacity: '3.6 kW',
        capacity_kw: 3.6,
        phase: 'Single Phase',
        efficiency: '97.9%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 14,700',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-deye-3.6k',
        brand: 'Deye',
        model: 'Deye 3.6kW Single Phase Dual MPPT On-Grid',
        capacity: '3.6 kW',
        capacity_kw: 3.6,
        phase: 'Single Phase',
        efficiency: '97.9%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 14,500',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-aps-3.6k',
        brand: 'APS',
        model: 'APS 3.6kW Single Phase Dual MPPT On-Grid',
        capacity: '3.6 kW',
        capacity_kw: 3.6,
        phase: 'Single Phase',
        efficiency: '98.0%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 14,700',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-polycab-4.6k',
        brand: 'Polycab',
        model: 'Polycab 4.6kW Single Phase Dual MPPT Inverter',
        capacity: '4.6 kW',
        capacity_kw: 4.6,
        phase: 'Single Phase',
        efficiency: '98.3%',
        warranty: '7 Years Comprehensive',
        base_price: '₹ 23,800',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-vsole-4.2k',
        brand: 'Vsole',
        model: 'Vsole 4.2kW Single Phase Dual MPPT On-Grid',
        capacity: '4.2 kW',
        capacity_kw: 4.2,
        phase: 'Single Phase',
        efficiency: '98.1%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 18,500',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-deye-4.2k',
        brand: 'Deye',
        model: 'Deye 4.2kW Single Phase Dual MPPT On-Grid',
        capacity: '4.2 kW',
        capacity_kw: 4.2,
        phase: 'Single Phase',
        efficiency: '98.1%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 18,500',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-aps-4.2k',
        brand: 'APS',
        model: 'APS 4.2kW Single Phase Dual MPPT On-Grid',
        capacity: '4.2 kW',
        capacity_kw: 4.2,
        phase: 'Single Phase',
        efficiency: '98.2%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 19,300',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-polycab-5k',
        brand: 'Polycab',
        model: 'Polycab 5.0kW Three Phase On-Grid Inverter',
        capacity: '5.0 kW',
        capacity_kw: 5.0,
        phase: 'Three Phase',
        efficiency: '98.5%',
        warranty: '7 Years Comprehensive',
        base_price: '₹ 26,000',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-vsole-5.4k',
        brand: 'Vsole',
        model: 'Vsole 5.4kW Three Phase Dual MPPT On-Grid',
        capacity: '5.4 kW',
        capacity_kw: 5.4,
        phase: 'Three Phase',
        efficiency: '98.3%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 25,000',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-deye-5k',
        brand: 'Deye',
        model: 'Deye 5.0kW Three Phase Dual MPPT On-Grid',
        capacity: '5.0 kW',
        capacity_kw: 5.0,
        phase: 'Three Phase',
        efficiency: '98.3%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 25,000',
        is_default: false,
        is_archived: false
      },
      {
        id: 'inv-aps-5k',
        brand: 'APS',
        model: 'APS 5.0kW Three Phase Dual MPPT On-Grid',
        capacity: '5.0 kW',
        capacity_kw: 5.0,
        phase: 'Three Phase',
        efficiency: '98.4%',
        warranty: '10 Years Comprehensive',
        base_price: '₹ 25,500',
        is_default: false,
        is_archived: false
      }
    ];

    for (const inv of inverters) {
      await client.query(
        'INSERT INTO public.solar_inverters (id, brand, model, capacity, capacity_kw, phase, efficiency, warranty, base_price, is_default, is_archived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [inv.id, inv.brand, inv.model, inv.capacity, inv.capacity_kw, inv.phase, inv.efficiency, inv.warranty, inv.base_price, inv.is_default, inv.is_archived]
      );
    }

    // 3. Update Waaree 540W rate in solar_modules to 25.5 as shown in sheet
    await client.query("UPDATE public.solar_modules SET rate_per_wp = '₹ 25.50/Wp' WHERE id = 'mod-waaree-540';");

    console.log('\n--- VERIFYING UPDATED INVERTERS TABLE ---');
    const invRes = await client.query('SELECT brand, capacity_kw, phase, base_price, warranty, model FROM public.solar_inverters ORDER BY brand, capacity_kw;');
    console.table(invRes.rows);

    console.log('\n--- VERIFYING SOLAR MODULES TABLE ---');
    const modRes = await client.query('SELECT brand, wattage, rate_per_wp, warranty, model FROM public.solar_modules ORDER BY brand, wattage;');
    console.table(modRes.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

syncCatalog();
