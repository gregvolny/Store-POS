import { getDb } from '../src/database.js';
import * as InventoryService from "./inventory.js"; // Import refactored inventory service

// Helper to convert SQLite exec output to an array of objects
function rowsFromSqliteOutput(sqliteOutput) {
    if (!sqliteOutput || sqliteOutput.length === 0 || !sqliteOutput[0].columns || !sqliteOutput[0].values) {
        return [];
    }
    const columns = sqliteOutput[0].columns;
    return sqliteOutput[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => {
            // Attempt to parse JSON fields
            if (col.endsWith('_json') && typeof row[i] === 'string') {
                try {
                    obj[col.replace('_json', '')] = JSON.parse(row[i]);
                } catch (e) {
                    console.warn(`Failed to parse JSON for column ${col}:`, e);
                    obj[col.replace('_json', '')] = row[i]; // Keep as string if parse fails
                }
            } else {
                 obj[col] = row[i];
            }
        });
        return obj;
    });
}


export async function getAllTransactions() {
    const db = await getDb();
    const queryResult = db.exec("SELECT * FROM transactions ORDER BY date DESC");
    return rowsFromSqliteOutput(queryResult);
}

export async function getOnHoldTransactions() {
    const db = await getDb();
    // ref_number IS NOT NULL AND ref_number != '' AND status = 0
    const queryResult = db.exec("SELECT * FROM transactions WHERE ref_number IS NOT NULL AND ref_number != '' AND status = 0 ORDER BY date DESC");
    return rowsFromSqliteOutput(queryResult);
}

export async function getCustomerOrders() {
    const db = await getDb();
    // customer_id IS NOT NULL AND customer_id != '0' AND status = 0 AND (ref_number IS NULL OR ref_number = '')
    const queryResult = db.exec("SELECT * FROM transactions WHERE customer_id IS NOT NULL AND customer_id != '0' AND status = 0 AND (ref_number IS NULL OR ref_number = '') ORDER BY date DESC");
    return rowsFromSqliteOutput(queryResult);
}

export async function getTransactionsByDate(filters) {
    const { start, end, user, till, status } = filters;
    const db = await getDb();

    let sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? AND status = ?";
    const params = [new Date(start).toJSON(), new Date(end).toJSON(), parseInt(status)];

    if (user && parseInt(user) !== 0) {
        sql += " AND user_id = ?";
        params.push(parseInt(user));
    }
    if (till && parseInt(till) !== 0) {
        sql += " AND till_id = ?"; // Changed from 'till' to 'till_id'
        params.push(parseInt(till));
    }
    sql += " ORDER BY date DESC";

    const queryResult = db.exec(sql, params);
    return rowsFromSqliteOutput(queryResult);
}

export async function createTransaction(transactionData) {
    const db = await getDb();
    // Ensure required fields and structure for DB
    const newTransaction = {
        _id: transactionData._id || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate a unique ID if not provided
        date: transactionData.date ? new Date(transactionData.date).toJSON() : new Date().toJSON(),
        status: typeof transactionData.status === 'number' ? transactionData.status : 0,
        user_id: transactionData.user_id ? parseInt(transactionData.user_id) : null,
        till_id: transactionData.till ? parseInt(transactionData.till) : (transactionData.till_id ? parseInt(transactionData.till_id) : null),
        customer_id: transactionData.customer || transactionData.customer_id || "0",
        ref_number: transactionData.ref_number || null,
        total_amount: parseFloat(transactionData.total) || 0,
        paid_amount: parseFloat(transactionData.paid) || 0,
        change_amount: parseFloat(transactionData.change) || 0,
        payment_method: transactionData.paymentMethod || transactionData.payment_method || null,
        items_json: JSON.stringify(transactionData.items || []),
        notes: transactionData.notes || null,
        other_details_json: JSON.stringify(transactionData.other_details || {}) // Store any extra fields
    };

    db.run(
        'INSERT INTO transactions (_id, date, status, user_id, till_id, customer_id, ref_number, total_amount, paid_amount, change_amount, payment_method, items_json, notes, other_details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            newTransaction._id, newTransaction.date, newTransaction.status, newTransaction.user_id, newTransaction.till_id,
            newTransaction.customer_id, newTransaction.ref_number, newTransaction.total_amount, newTransaction.paid_amount,
            newTransaction.change_amount, newTransaction.payment_method, newTransaction.items_json, newTransaction.notes,
            newTransaction.other_details_json
        ]
    );

    if (newTransaction.paid_amount >= newTransaction.total_amount && newTransaction.status !== 0 /* e.g. status is paid */) {
        if (transactionData.items && transactionData.items.length > 0) {
            try {
                await InventoryService.decrementInventory(transactionData.items);
            } catch (invError) {
                console.error("Failed to decrement inventory:", invError);
                // Decide if transaction should be rolled back or flagged
            }
        }
    }
    return { ...newTransaction, items: JSON.parse(newTransaction.items_json), other_details: JSON.parse(newTransaction.other_details_json) };
}

export async function updateTransaction(transactionId, transactionData) {
    const db = await getDb();
    // Similar to createTransaction, map fields from transactionData to DB columns
    // For simplicity, this example assumes transactionData contains all necessary fields for update.
    // A more robust version would selectively update fields.

    const updatedTransaction = {
        date: transactionData.date ? new Date(transactionData.date).toJSON() : new Date().toJSON(),
        status: typeof transactionData.status === 'number' ? transactionData.status : 0,
        user_id: transactionData.user_id ? parseInt(transactionData.user_id) : null,
        till_id: transactionData.till ? parseInt(transactionData.till) : (transactionData.till_id ? parseInt(transactionData.till_id) : null),
        customer_id: transactionData.customer || transactionData.customer_id || "0",
        ref_number: transactionData.ref_number || null,
        total_amount: parseFloat(transactionData.total) || 0,
        paid_amount: parseFloat(transactionData.paid) || 0,
        change_amount: parseFloat(transactionData.change) || 0,
        payment_method: transactionData.paymentMethod || transactionData.payment_method || null,
        items_json: JSON.stringify(transactionData.items || []),
        notes: transactionData.notes || null,
        other_details_json: JSON.stringify(transactionData.other_details || {})
    };

    db.run(
        'UPDATE transactions SET date = ?, status = ?, user_id = ?, till_id = ?, customer_id = ?, ref_number = ?, total_amount = ?, paid_amount = ?, change_amount = ?, payment_method = ?, items_json = ?, notes = ?, other_details_json = ? WHERE _id = ?',
        [
            updatedTransaction.date, updatedTransaction.status, updatedTransaction.user_id, updatedTransaction.till_id,
            updatedTransaction.customer_id, updatedTransaction.ref_number, updatedTransaction.total_amount, updatedTransaction.paid_amount,
            updatedTransaction.change_amount, updatedTransaction.payment_method, updatedTransaction.items_json,
            updatedTransaction.notes, updatedTransaction.other_details_json,
            transactionId
        ]
    );
     // After update, if it becomes paid, decrement inventory
    if (updatedTransaction.paid_amount >= updatedTransaction.total_amount && updatedTransaction.status !== 0) {
        if (transactionData.items && transactionData.items.length > 0) {
             try {
                await InventoryService.decrementInventory(transactionData.items);
            } catch (invError) {
                console.error("Failed to decrement inventory on transaction update:", invError);
            }
        }
    }
    return { message: "Transaction updated successfully", updatedId: transactionId };
}

export async function deleteTransaction(orderId) {
    const db = await getDb();
    db.run('DELETE FROM transactions WHERE _id = ?', [orderId]);
    return { message: "Transaction deleted successfully", deletedId: orderId };
}

export async function getTransactionById(transactionId) {
    const db = await getDb();
    const queryResult = db.exec("SELECT * FROM transactions WHERE _id = ?", [transactionId]);
    const rows = rowsFromSqliteOutput(queryResult);
    return rows.length > 0 ? rows[0] : null;
}
