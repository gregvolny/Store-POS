import { getDb } from '../src/database.js';

// Removed Express, bodyParser, Datastore, async, fs, os, path, and custom createDirectory logic

export async function getCustomerById(customerId) {
    if (!customerId) {
        throw new Error("ID field is required.");
    }
    const db = await getDb();
    // Note: Original NeDB used `_id: req.params.customerId` which could be string or number.
    // Assuming _id in DB is INTEGER for now. If it can be TEXT, adjust schema and parsing.
    const customerQuery = db.exec("SELECT * FROM customers WHERE _id = ?", [parseInt(customerId)]); // Or pass customerId directly if it's TEXT
    if (customerQuery.length === 0 || customerQuery[0].values.length === 0) {
        return null;
    }
    const columns = customerQuery[0].columns;
    const values = customerQuery[0].values[0];
    const result = {};
    columns.forEach((col, i) => result[col] = values[i]);
    return result;
}

export async function getAllCustomers() {
    const db = await getDb();
    const customersQuery = db.exec("SELECT * FROM customers");
    if (customersQuery.length === 0 || customersQuery[0].values.length === 0) {
        return [];
    }
    const columns = customersQuery[0].columns;
    return customersQuery[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

export async function addCustomer(customerData) {
    const db = await getDb();
    // Original code: `var newCustomer = req.body; customerDB.insert( newCustomer, ...)`
    // This implies _id might be part of customerData or NeDB generates it.
    // For SQLite, if _id is INTEGER PRIMARY KEY and not provided, it's auto-generated.
    // If we want to control _id (e.g. timestamp based), we should generate it.
    // Let's assume an _id is provided or generated before this call for now.
    // If _id is not in customerData and not auto-increment, this will fail.
    // Let's generate one if not present, similar to other modules.

    const newId = customerData._id || Math.floor(Date.now() / 1000);
    const name = customerData.name;
    const phone = customerData.phone || null;
    const email = customerData.email || null;
    const address = customerData.address || null;

    if (!name) {
        throw new Error("Customer name is required.");
    }

    db.run(
        'INSERT INTO customers (_id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
        [newId, name, phone, email, address]
    );
    // Return the customer data including the ID.
    return { _id: newId, name, phone, email, address };
}

export async function deleteCustomer(customerId) {
    const db = await getDb();
    // Assuming customerId is an integer ID.
    db.run('DELETE FROM customers WHERE _id = ?', [parseInt(customerId)]);
    return { message: "Customer deleted successfully", deletedId: parseInt(customerId) };
}

export async function updateCustomer(customerData) {
    const db = await getDb();
    const { _id, name, phone, email, address } = customerData;

    if (!_id) {
        throw new Error("Customer _id is required for update.");
    }
    if (!name) {
        // Depending on requirements, name might be optional for update if not changing.
        // For now, let's assume if name is in customerData, it's being updated.
        // The original code `req.body` would update all fields present in `req.body`.
        throw new Error("Customer name is required.");
    }

    // Build query dynamically based on provided fields if not all are required for update
    // For simplicity, assuming all relevant fields are provided for an update.
    db.run(
        'UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE _id = ?',
        [name, phone || null, email || null, address || null, parseInt(_id)]
    );
    return { message: "Customer updated successfully", updatedId: parseInt(_id) };
}