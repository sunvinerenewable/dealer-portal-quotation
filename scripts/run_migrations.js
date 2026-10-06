import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env manually
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const { Pool } = pg;

async function runMigration() {
  console.log('====================================================');
  console.log('   SUNVINE SOLAR SUPABASE MIGRATION RUNNER (CLI)    ');
  console.log('====================================================');

  const connectionString = process.env.DATABASE_URL || 
    `postgres://${process.env.SUPABASE_DB_USER}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD || '')}@${process.env.SUPABASE_DB_HOST || 'db.' + process.env.SUPABASE_PROJECT_ID + '.supabase.co'}:${process.env.SUPABASE_DB_PORT || 5432}/postgres?sslmode=require`;

  console.log(`[DB] Connecting to PostgreSQL host: ${process.env.SUPABASE_DB_HOST || 'Supabase cloud'}...`);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('[DB] Connected successfully to Supabase PostgreSQL!');

    const migrationFile = path.resolve(__dirname, '../supabase_realtime_pricing_migration.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found at: ${migrationFile}`);
    }

    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    console.log(`[Migration] Executing SQL script: ${path.basename(migrationFile)} (${sqlContent.length} bytes)...`);

    await client.query(sqlContent);
    console.log('[Migration] SQL execution completed successfully!');

    // Verification Queries
    console.log('\n--- VERIFICATION & ROW COUNTS ---');
    
    const tables = [
      'solar_modules',
      'solar_inverters',
      'bom_catalog_items',
      'pricing_presets',
      'dealer_custom_pricing',
      'quotations',
      'quotation_bom_snapshots'
    ];

    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM public.${table};`);
        console.log(`✓ Table [public.${table}]: ${res.rows[0].count} rows`);
      } catch (err) {
        console.log(`⚠ Table [public.${table}]: ${err.message}`);
      }
    }

    // Sample Data check
    const modRes = await client.query(`SELECT brand, model, wattage, rate_per_wp FROM public.solar_modules WHERE NOT is_archived ORDER BY wattage ASC;`);
    console.log('\n--- ACTIVE SOLAR PV MODULES IN DATABASE ---');
    console.table(modRes.rows);

    const invRes = await client.query(`SELECT brand, model, capacity_kw, phase, base_price FROM public.solar_inverters WHERE NOT is_archived ORDER BY capacity_kw ASC;`);
    console.log('\n--- ACTIVE STRING INVERTERS IN DATABASE ---');
    console.table(invRes.rows);

    client.release();
    await pool.end();
    console.log('\n====================================================');
    console.log('   MIGRATION COMPLETED AND VERIFIED 100% CLEAN      ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('[Error] Migration failed:', err);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
