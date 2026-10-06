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

async function updateModules() {
  const client = await pool.connect();
  try {
    // Exact list from User Excel Sheet
    const modules = [
      {
        id: 'mod-aps-550',
        brand: 'APS',
        model: 'APS 550W TOPCon Mono Bifacial (Australian Premium Solar)',
        wattage: 550,
        cell_tech: 'TOPCon Mono Bifacial',
        rate_per_wp: '₹ 22.50/Wp',
        warranty: '30 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: false,
        is_archived: false
      },
      {
        id: 'mod-aps-600',
        brand: 'APS',
        model: 'APS 600W TOPCon Bifacial Dual Glass (Australian Premium Solar)',
        wattage: 600,
        cell_tech: 'N-Type TOPCon 16BB Dual Glass',
        rate_per_wp: '₹ 24.20/Wp',
        warranty: '30 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: false,
        is_archived: false
      },
      {
        id: 'mod-waaree-540',
        brand: 'Waaree',
        model: 'Waaree 540W Mono PERC Half-Cut (Waaree Energies Limited)',
        wattage: 540,
        cell_tech: 'Mono PERC Bifacial',
        rate_per_wp: '₹ 22.50/Wp',
        warranty: '27 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: false,
        is_archived: false
      },
      {
        id: 'mod-waaree-585',
        brand: 'Waaree',
        model: 'Waaree 585W TOPCon Bifacial (Waaree Energies Limited)',
        wattage: 585,
        cell_tech: 'N-Type TOPCon Dual-Glass Bifacial',
        rate_per_wp: '₹ 26.00/Wp',
        warranty: '27 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: true,
        is_archived: false
      },
      {
        id: 'mod-waaree-610',
        brand: 'Waaree',
        model: 'Waaree 610W TOPCon Bifacial Dual Glass (Waaree Energies Limited)',
        wattage: 610,
        cell_tech: 'N-Type TOPCon Dual Glass ALMM',
        rate_per_wp: '₹ 27.30/Wp',
        warranty: '27 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: false,
        is_archived: false
      },
      {
        id: 'mod-waaree-615',
        brand: 'Waaree',
        model: 'Waaree 615W TOPCon Bifacial Dual Glass (Waaree Energies Limited)',
        wattage: 615,
        cell_tech: 'N-Type TOPCon Multi-Busbar',
        rate_per_wp: '₹ 27.30/Wp',
        warranty: '27 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: false,
        is_archived: false
      },
      {
        id: 'mod-rayzon-550',
        brand: 'Rayzon',
        model: 'Rayzon 550W Mono PERC Bifacial (Rayzon Solar Limited)',
        wattage: 550,
        cell_tech: 'Mono PERC 10BB Silver Frame',
        rate_per_wp: '₹ 22.50/Wp',
        warranty: '30 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: false,
        is_archived: false
      },
      {
        id: 'mod-adani-550',
        brand: 'Adani',
        model: 'Adani 550W Vertex Mono PERC (Mudra Solar)',
        wattage: 550,
        cell_tech: 'P-Type Multi-Busbar MBB',
        rate_per_wp: '₹ 25.50/Wp',
        warranty: '25 Years Performance',
        dimensions: '2278 × 1134 × 30 mm | 28 kg',
        is_default: false,
        is_archived: false
      }
    ];

    // Clear and insert clean set
    await client.query('DELETE FROM public.solar_modules;');
    for (const m of modules) {
      await client.query(
        'INSERT INTO public.solar_modules (id, brand, model, wattage, cell_tech, rate_per_wp, warranty, dimensions, is_default, is_archived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [m.id, m.brand, m.model, m.wattage, m.cell_tech, m.rate_per_wp, m.warranty, m.dimensions, m.is_default, m.is_archived]
      );
    }

    const res = await client.query('SELECT brand, wattage, rate_per_wp, warranty, model FROM public.solar_modules ORDER BY brand, wattage;');
    console.log('--- UPDATED SOLAR MODULES TABLE ---');
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

updateModules();
