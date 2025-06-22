// assets/js/database.js

const DB_CONFIG = {
    locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${filename}`
};

let db = null;

async function initDatabase() {
    try {
        if (db) {
            console.log("Database already initialized.");
            return db;
        }

        const SQL = await initSqlJs(DB_CONFIG);
        // Try to load the database from localStorage or IndexedDB (for persistence)
        // For sql.js, persistence is typically handled by exporting the database to a Uint8Array
        // and saving that. For now, we'll start with an in-memory database or a simple localStorage backup.

        let dbData = localStorage.getItem('sqliteDb');
        if (dbData) {
            const dbArray = Uint8Array.from(JSON.parse(dbData));
            db = new SQL.Database(dbArray);
            console.log("Database loaded from localStorage.");
        } else {
            db = new SQL.Database();
            console.log("New database initialized.");
            // Create tables if this is a new database
            await createTables();
            await backupDatabase(); // Save the new empty DB structure
        }
        return db;
    } catch (err) {
        console.error("Database initialization failed:", err);
        // Fallback or error handling
        return null;
    }
}

async function createTables() {
    if (!db) {
        console.error("Database not initialized. Cannot create tables.");
        return;
    }
    console.log("Creating tables...");

    // Settings Table (Key-Value Store)
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    // Users Table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            _id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT,
            username TEXT UNIQUE,
            password TEXT, -- Store securely if real app (e.g., hashed)
            status TEXT,
            perm_products INTEGER DEFAULT 0,
            perm_categories INTEGER DEFAULT 0,
            perm_transactions INTEGER DEFAULT 0,
            perm_users INTEGER DEFAULT 0,
            perm_settings INTEGER DEFAULT 0,
            last_login TEXT
        );
    `);
    // Create a default admin user if no users exist (example)
    // This might be better handled by a setup screen in a real app
    const userCount = db.exec("SELECT COUNT(*) FROM users")[0].values[0][0];
    if (userCount === 0) {
        console.log("Creating default admin user.");
        db.run("INSERT INTO users (fullname, username, password, perm_products, perm_categories, perm_transactions, perm_users, perm_settings) VALUES (?, ?, ?, 1, 1, 1, 1, 1)", ["Admin", "admin", btoa("admin")]); // btoa is not secure hashing!
    }


    // Categories Table
    db.run(`
        CREATE TABLE IF NOT EXISTS categories (
            _id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        );
    `);

    // Products Table
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            _id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            name TEXT,
            unit TEXT,
            lotnumber TEXT,
            price REAL,
            quantity INTEGER,
            stock INTEGER, -- 0 for disable stock check, 1 for enable
            sku TEXT UNIQUE,
            img TEXT, -- Path or base64 data
            FOREIGN KEY (category_id) REFERENCES categories(_id)
        );
    `);

    // Customers Table
    db.run(`
        CREATE TABLE IF NOT EXISTS customers (
            _id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT,
            email TEXT,
            address TEXT
        );
    `);

    // Orders Table (for sales/transactions and held orders)
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            _id INTEGER PRIMARY KEY, -- Using Math.floor(Date.now() / 1000) as in original
            ref_number TEXT,
            discount REAL DEFAULT 0,
            customer_id INTEGER,
            status INTEGER, -- 0 for hold, 1 for paid, (maybe 2 for cancelled?)
            subtotal REAL,
            tax REAL,
            total REAL,
            paid REAL,
            change REAL,
            payment_type TEXT, -- 'Cash', 'Card'
            payment_info TEXT, -- For card info or notes
            date TEXT, -- ISO 8601 format
            till TEXT, -- Till number if applicable
            mac TEXT, -- MAC address if applicable (might be less relevant in PWA)
            user_id INTEGER,
            user_fullname TEXT, -- Denormalized for easier display on receipts
            order_type INTEGER, -- 1 as seen in original code
            FOREIGN KEY (customer_id) REFERENCES customers(_id),
            FOREIGN KEY (user_id) REFERENCES users(_id)
        );
    `);

    // Order Items Table
    db.run(`
        CREATE TABLE IF NOT EXISTS order_items (
            item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            product_name TEXT, -- Denormalized
            sku TEXT, -- Denormalized
            price REAL, -- Price at the time of sale
            quantity INTEGER,
            FOREIGN KEY (order_id) REFERENCES orders(_id),
            FOREIGN KEY (product_id) REFERENCES products(_id)
        );
    `);

    console.log("Tables created (if they didn't exist).");
}

async function backupDatabase() {
    if (!db) {
        console.error("Database not initialized. Cannot backup.");
        return;
    }
    const dbArray = db.export();
    localStorage.setItem('sqliteDb', JSON.stringify(Array.from(dbArray))); // Storing as JSON array of numbers
    console.log("Database backed up to localStorage.");
}

async function getDb() {
    if (!db) {
        return await initDatabase();
    }
    return db;
}

// Expose functions to global scope or handle through module system if preferred
window.posDb = {
    initDatabase,
    createTables,
    backupDatabase,
    getDb,
    get: async (key) => { // Example getter for settings
        const dbInstance = await getDb();
        const stmt = dbInstance.prepare("SELECT value FROM settings WHERE key = :key");
        stmt.bind({ ':key': key });
        let value = null;
        if (stmt.step()) {
            value = stmt.get()[0];
        }
        stmt.free();
        return value ? JSON.parse(value) : null; // Assuming settings are stored as JSON strings
    },
    set: async (key, value) => { // Example setter for settings
        const dbInstance = await getDb();
        dbInstance.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
        await backupDatabase();
    }
};

// Initialize the database when the script loads
// We might want to call this more explicitly, e.g., after document is ready or user interaction.
// For now, let's try to initialize it early.
(async () => {
    try {
        await initDatabase();
        console.log("POS Database is ready.");
    } catch (e) {
        console.error("Error initializing POS Database on load:", e);
    }
})();
