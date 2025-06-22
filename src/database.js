import initSqlJs from 'sql.js';

let db = null;

// Configuration for sql.js
// const SQL_WASM_PATH_OLD = '/node_modules/sql.js/dist/sql-wasm.wasm'; // Old path
const SQL_WASM_PATH = 'wasm/sql-wasm.wasm'; // New path relative to dist/

async function initializeDatabase() {
  try {
    if (db) {
      return db;
    }

    const SQL = await initSqlJs({
      locateFile: file => {
        if (file === 'sql-wasm.wasm') {
          // Path should be relative to where the bundled JS (e.g. bundle.js in dist/) will look for it.
          // If bundle.js is in dist/, and wasm is in dist/wasm/, then 'wasm/sql-wasm.wasm' is correct.
          return SQL_WASM_PATH;
        }
        return file; // For other files sql.js might need (though typically it's just the wasm)
      }
    });

    // Create a new database or load an existing one if persisted
    // For now, creating a new in-memory database.
    // Persistence can be added later using SQL.js features for IndexedDB.
    db = new SQL.Database();
    console.log("SQLite database initialized successfully (in-memory).");

    // TODO: Define and create schema (tables) if they don't exist
    // This will be done incrementally as we refactor other API modules.
    // Example:
    // db.run(`
    //   CREATE TABLE IF NOT EXISTS inventory (
    //     _id INTEGER PRIMARY KEY,
    //     name TEXT,
    //     price REAL,
    //     category TEXT,
    //     quantity INTEGER,
    //     stock INTEGER,
    //     unit TEXT,
    //     lotnumber TEXT,
    //     img TEXT
    //   );
    // `);
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        _id INTEGER PRIMARY KEY,
        name TEXT,
        price REAL,
        category TEXT,
        quantity INTEGER,
        stock INTEGER, /* 0 means track stock, 1 means don't track (disable stock check) */
        unit TEXT,
        lotnumber TEXT,
        img TEXT
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        _id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE /* Assuming category names should be unique */
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        _id INTEGER PRIMARY KEY, /* Or TEXT if using UUIDs generated client-side */
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        _id INTEGER PRIMARY KEY DEFAULT 1, /* Ensure only one row for settings */
        settings_json TEXT /* Store all settings as a JSON string */
      );
    `);
    // Ensure the settings row exists with default empty object if not present
    db.run(`INSERT OR IGNORE INTO settings (_id, settings_json) VALUES (1, '{}')`);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        _id INTEGER PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullname TEXT,
        perm_products INTEGER DEFAULT 0,
        perm_categories INTEGER DEFAULT 0,
        perm_transactions INTEGER DEFAULT 0,
        perm_users INTEGER DEFAULT 0,
        perm_settings INTEGER DEFAULT 0,
        status TEXT
      );
    `);
    // Default admin user (mimicking /check route logic)
    // btoa('admin') is YWRtaW4=
    db.run(`
      INSERT OR IGNORE INTO users (_id, username, password, fullname, perm_products, perm_categories, perm_transactions, perm_users, perm_settings, status)
      VALUES (1, 'admin', 'YWRtaW4=', 'Administrator', 1, 1, 1, 1, 1, '')
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        _id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        status INTEGER DEFAULT 0, /* 0: unpaid/on-hold, 1: paid, 2: voided/cancelled etc. */
        user_id INTEGER,
        till_id INTEGER,
        customer_id TEXT,
        ref_number TEXT,
        total_amount REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        change_amount REAL DEFAULT 0,
        payment_method TEXT,
        items_json TEXT, /* JSON array of transaction items */
        notes TEXT,
        other_details_json TEXT /* For any other dynamic fields from original NeDB document */
      );
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_ref_number ON transactions(ref_number);`);


    console.log("Initial schema (inventory, categories, customers, settings, users, transactions tables) created or verified.");

    return db;
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err);
    throw err; // Re-throw the error to be caught by the caller
  }
}

// Export a function to get the database instance.
// This ensures the database is initialized before being used.
async function getDb() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

// Export utility functions for common operations (optional, but can be helpful)
// async function run(sql, params = []) {
//   const currentDb = await getDb();
//   return currentDb.run(sql, params);
// }

// async function get(sql, params = []) {
//   const currentDb = await getDb();
//   return currentDb.get(sql, params);
// }

// async function all(sql, params = []) {
//   const currentDb = await getDb();
//   return currentDb.all(sql, params);
// }

export { initializeDatabase, getDb /*, run, get, all */ };
