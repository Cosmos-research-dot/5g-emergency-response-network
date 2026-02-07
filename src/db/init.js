/**
 * Database Initialization Service
 * Runs migrations and seeds data
 */

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

/**
 * Run all migrations
 */
async function runMigrations() {
  console.log('[DB] Running migrations...');
  
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    try {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`[DB] Running migration: ${file}`);
      await pool.query(sql);
      console.log(`[DB] ✓ Migration complete: ${file}`);
    } catch (error) {
      console.error(`[DB] Migration failed: ${file}`, error.message);
      throw error;
    }
  }
}

/**
 * Seed initial data
 */
async function seedData() {
  console.log('[DB] Seeding initial data...');
  
  try {
    // Check if data already exists
    const result = await pool.query('SELECT COUNT(*) FROM hospitals');
    if (result.rows[0].count > 0) {
      console.log('[DB] Data already seeded, skipping...');
      return;
    }

    const seedPath = path.join(__dirname, 'seeds', 'seed-data.js');
    const seeds = require(seedPath);
    
    // Run seed functions in order
    await seeds.seedHospitals();
    await seeds.seedAmbulanceStations();
    await seeds.seedUsers();
    await seeds.seedAmbulances();
    await seeds.seedPatients();
    
    console.log('[DB] ✓ Data seeding complete');
  } catch (error) {
    console.error('[DB] Seeding failed:', error.message);
    throw error;
  }
}

/**
 * Initialize database
 */
async function initialize() {
  try {
    console.log('\n[DB] Initializing database...\n');
    
    // Test connection
    const client = await pool.getPool().connect();
    console.log('[DB] ✓ Database connection successful');
    client.release();
    
    // Run migrations
    await runMigrations();
    
    // Seed data
    await seedData();
    
    console.log('\n[DB] ✓ Database initialization complete\n');
    return true;
  } catch (error) {
    console.error('[DB] ✗ Database initialization failed:', error);
    process.exit(1);
  }
}

module.exports = { initialize, runMigrations, seedData };
