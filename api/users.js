import { getDb } from '../src/database.js';
// Assuming 'btoa' is available globally in the browser environment.
// If not, it might need to be imported or polyfilled if this code runs where btoa is not defined.
// The original project had 'btoa' as a dependency, implying it might have been used in Node.js.

export async function getUserById(userId) {
    if (!userId) {
        throw new Error("ID field is required.");
    }
    const db = await getDb();
    const parsedUserId = parseInt(userId);
    const userQuery = db.exec("SELECT * FROM users WHERE _id = ?", [parsedUserId]);
    if (userQuery.length === 0 || userQuery[0].values.length === 0) {
        return null;
    }
    const columns = userQuery[0].columns;
    const values = userQuery[0].values[0];
    const result = {};
    columns.forEach((col, i) => result[col] = values[i]);
    return result;
}

export async function logoutUser(userId) {
    if (!userId) {
        throw new Error("ID field is required for logout.");
    }
    const db = await getDb();
    const parsedUserId = parseInt(userId);
    const newStatus = 'Logged Out_' + new Date().toISOString();
    db.run('UPDATE users SET status = ? WHERE _id = ?', [newStatus, parsedUserId]);
    return { message: "User status updated to logged out.", userId: parsedUserId };
}

export async function loginUser(username, password) {
    const db = await getDb();
    const encodedPassword = btoa(password); // Replicating original encoding

    const userQuery = db.exec("SELECT * FROM users WHERE username = ? AND password = ?", [username, encodedPassword]);

    if (userQuery.length === 0 || userQuery[0].values.length === 0) {
        return null; // User not found or password incorrect
    }

    const columns = userQuery[0].columns;
    const values = userQuery[0].values[0];
    const user = {};
    columns.forEach((col, i) => user[col] = values[i]);

    const newStatus = 'Logged In_' + new Date().toISOString();
    db.run('UPDATE users SET status = ? WHERE _id = ?', [newStatus, user._id]);

    user.status = newStatus; // Update status in the returned object

    // Fetch user roles
    const rolesQuery = db.exec(`
        SELECT r.role_name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = ?
    `, [user._id]);

    if (rolesQuery.length > 0 && rolesQuery[0].values.length > 0) {
        user.roles = rolesQuery[0].values.map(row => row[0]); // Extracts role names into an array
    } else {
        user.roles = []; // No roles assigned or error
    }

    return user;
}

export async function getAllUsers() {
    const db = await getDb();
    // Fetch all users
    const usersQuery = db.exec("SELECT * FROM users");
    if (usersQuery.length === 0 || usersQuery[0].values.length === 0) {
        return [];
    }
    const columns = usersQuery[0].columns;
    const users = usersQuery[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });

    // For each user, fetch their roles
    for (const user of users) {
        const rolesQuery = db.exec(`
            SELECT r.role_name
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.role_id
            WHERE ur.user_id = ?
        `, [user._id]);

        if (rolesQuery.length > 0 && rolesQuery[0].values.length > 0) {
            user.roles = rolesQuery[0].values.map(row => row[0]);
        } else {
            user.roles = [];
        }
    }
    return users;
}

export async function deleteUser(userId) {
    const db = await getDb();
    const parsedUserId = parseInt(userId);
    db.run('DELETE FROM users WHERE _id = ?', [parsedUserId]);
    return { message: "User deleted successfully", deletedId: parsedUserId };
}

export async function saveUser(userData) {
    const db = await getDb();
    const {
        id,
        username,
        password, // Expect raw password
        fullname,
        perm_products,
        perm_categories,
        perm_transactions,
        perm_users,
        perm_settings
    } = userData;

    if (!username) throw new Error("Username is required.");
    if (!id && !password) throw new Error("Password is required for new users."); // Password can be optional for updates if not changing

    const encodedPassword = password ? btoa(password) : null;

    const userRecord = {
        username: username,
        fullname: fullname,
        perm_products: perm_products == "on" || perm_products === 1 || perm_products === true ? 1 : 0,
        perm_categories: perm_categories == "on" || perm_categories === 1 || perm_categories === true ? 1 : 0,
        perm_transactions: perm_transactions == "on" || perm_transactions === 1 || perm_transactions === true ? 1 : 0,
        perm_users: perm_users == "on" || perm_users === 1 || perm_users === true ? 1 : 0,
        perm_settings: perm_settings == "on" || perm_settings === 1 || perm_settings === true ? 1 : 0,
    };

    if (!id) { // New user
        userRecord._id = Math.floor(Date.now() / 1000);
        userRecord.password = encodedPassword; // Must have password
        userRecord.status = ""; // Initial status

        try {
            db.run(
                'INSERT INTO users (_id, username, password, fullname, perm_products, perm_categories, perm_transactions, perm_users, perm_settings, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [userRecord._id, userRecord.username, userRecord.password, userRecord.fullname, userRecord.perm_products, userRecord.perm_categories, userRecord.perm_transactions, userRecord.perm_users, userRecord.perm_settings, userRecord.status]
            );
            return { ...userRecord }; // Return the newly created user data
        } catch (e) {
            if (e.message.includes("UNIQUE constraint failed: users.username")) {
                throw new Error(`Username "${userRecord.username}" already exists.`);
            }
            throw e;
        }
    } else { // Update existing user
        const parsedId = parseInt(id);
        // Fetch existing password if not provided for update
        let finalPassword = encodedPassword;
        if (!finalPassword) {
            const existingUserQuery = db.exec("SELECT password FROM users WHERE _id = ?", [parsedId]);
            if (existingUserQuery.length > 0 && existingUserQuery[0].values.length > 0) {
                finalPassword = existingUserQuery[0].values[0][0];
            } else {
                throw new Error(`User with ID ${parsedId} not found for password retrieval.`);
            }
        }

        try {
            db.run(
                'UPDATE users SET username = ?, password = ?, fullname = ?, perm_products = ?, perm_categories = ?, perm_transactions = ?, perm_users = ?, perm_settings = ? WHERE _id = ?',
                [userRecord.username, finalPassword, userRecord.fullname, userRecord.perm_products, userRecord.perm_categories, userRecord.perm_transactions, userRecord.perm_users, userRecord.perm_settings, parsedId]
            );
            return { message: "User updated successfully", updatedId: parsedId };
        } catch (e) {
             if (e.message.includes("UNIQUE constraint failed: users.username")) {
                throw new Error(`Username "${userRecord.username}" already exists on another account.`);
            }
            throw e;
        }
    }
}

// The /check route logic for ensuring a default admin is now handled during DB initialization in database.js

export async function registerUser(userData) {
    const { fullname, username, password } = userData;
    if (!fullname || !username || !password) {
        throw new Error("Full name, username, and password are required for registration.");
    }

    const db = await getDb();
    const newId = Math.floor(Date.now() / 1000);
    const encodedPassword = btoa(password); // Standard browser btoa

    try {
        // Insert user
        db.run(
            'INSERT INTO users (_id, username, password, fullname, perm_products, perm_categories, perm_transactions, perm_users, perm_settings, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, username, encodedPassword, fullname,
             1, 1, 1, 0, 0, // Default permissions for a 'cashier' like role (can be adjusted)
             'Registered']
        );

        // Assign 'cashier' role
        // First, get the role_id for 'cashier'
        const cashierRoleQuery = db.exec("SELECT role_id FROM roles WHERE role_name = 'cashier'");
        if (cashierRoleQuery.length === 0 || cashierRoleQuery[0].values.length === 0) {
            // This should not happen if roles are seeded correctly
            console.error("Default 'cashier' role not found during registration.");
            // Optionally, proceed without assigning role or throw more specific error
        } else {
            const cashierRoleId = cashierRoleQuery[0].values[0][0];
            db.run(
                'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                [newId, cashierRoleId]
            );
        }

        return { _id: newId, username, fullname, message: "User registered successfully." };

    } catch (e) {
        if (e.message && e.message.includes("UNIQUE constraint failed: users.username")) {
            throw new Error(`Username "${username}" is already taken.`);
        }
        console.error("Error during user registration in DB:", e);
        throw new Error("User registration failed due to a database error.");
    }
}