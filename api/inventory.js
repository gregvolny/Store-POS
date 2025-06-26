// import Datastore from "nedb"; // nedb is being replaced
import asyncLib from "async"; // Renamed to avoid conflict with async keyword
import { getDb } from '../src/database.js'; // Import getDb

// Node.js core modules (fs, os, path) and Express/Multer are removed as they are server-side.
// File handling (uploads) and directory creation will be managed differently in a client-side context.

// NeDB instantiation and file system specific code is removed.
// let inventoryDB = new Datastore( {
//     filename: path.join(os.homedir(),".storepos/POS/server/databases/inventory.db"),
//     autoload: true
// } );
// inventoryDB.ensureIndex({ fieldName: '_id', unique: true });


export async function getProductById(productId) {
    if (!productId) {
        throw new Error("ID field is required.");
    }
    const db = await getDb();
    const parsedProductId = parseInt(productId);
    const product = db.exec("SELECT * FROM inventory WHERE _id = ?", [parsedProductId]);
    if (product.length === 0 || product[0].values.length === 0) {
        return null;
    }
    // Helper to convert exec output to a more usable object
    const columns = product[0].columns;
    const values = product[0].values[0];
    const result = {};
    columns.forEach((col, i) => result[col] = values[i]);
    return result;
}

export async function getAllProducts() {
    const db = await getDb();
    const products = db.exec("SELECT * FROM inventory");
    if (products.length === 0 || products[0].values.length === 0) {
        return [];
    }
    const columns = products[0].columns;
    return products[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

export async function saveProduct(productData, imageFile = null) {
    // imageFile parameter is a placeholder for browser File object. Handling will be added later.
    // Multer logic (upload.single) is removed.

    let imageName = productData.img || ''; // Existing image name or empty

    // File removal logic using 'fs' is removed.
    // This needs to be re-implemented if images are stored in IndexedDB or similar.
    if (productData.remove_img == 1 && productData.img) {
        // console.log(`TODO: Handle removal of image: ${productData.img}`); // Original TODO
        // For static app without image upload, if 'remove_img' is set, we clear the imageName.
        // Actual deletion from 'assets/images/' is not handled client-side.
        imageName = '';
        console.log(`Image reference "${productData.img}" will be removed from product. Actual file not deleted from assets.`);
    }

    if (imageFile) {
        // For this static version, new image uploads are not supported.
        // Retain existing image name if not explicitly removed.
        // If productData.img was already set, and remove_img is not 1, imageName keeps productData.img
        // If productData.img was empty, and imageFile is provided, we ignore imageFile.
        console.warn(`New image file "${imageFile.name}" was provided, but image uploads are not supported in this static version. The image will not be saved.`);
        if (!productData.img || productData.remove_img == 1) { // If there was no previous image or it was marked for removal
            imageName = ''; // Ensure imageName is cleared if a new (unsupported) upload was attempted over nothing
        } else {
            imageName = productData.img; // Retain existing image if one was there and not removed.
        }
    }

    const productRecord = {
        _id: productData.id ? parseInt(productData.id) : Math.floor(Date.now() / 1000),
        price: parseFloat(productData.price),
        category: productData.category,
        quantity: productData.quantity === "" ? 0 : parseInt(productData.quantity),
        name: productData.name,
        stock: productData.stock === "on" ? 0 : 1, // Assuming 0 means track stock, 1 means don't track (disable stock check)
        unit: productData.unit,
        lotnumber: productData.lotnumber,
        img: imageName
    };

    const db = await getDb();
    if (!productData.id) { // New product
        db.run(
            'INSERT INTO inventory (_id, name, price, category, quantity, stock, unit, lotnumber, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [productRecord._id, productRecord.name, productRecord.price, productRecord.category, productRecord.quantity, productRecord.stock, productRecord.unit, productRecord.lotnumber, productRecord.img]
        );
        // To confirm insertion or get the inserted row, you might need to query it back if `run` doesn't return it.
        // For simplicity, returning the record as is. The _id is already set.
        return productRecord;
    } else { // Update existing product
        db.run(
            'UPDATE inventory SET name = ?, price = ?, category = ?, quantity = ?, stock = ?, unit = ?, lotnumber = ?, img = ? WHERE _id = ?',
            [productRecord.name, productRecord.price, productRecord.category, productRecord.quantity, productRecord.stock, productRecord.unit, productRecord.lotnumber, productRecord.img, productRecord._id]
        );
        return { message: "Product updated successfully", updatedId: productRecord._id };
    }
}

export async function deleteProduct(productId) {
    const db = await getDb();
    const parsedProductId = parseInt(productId);
    db.run('DELETE FROM inventory WHERE _id = ?', [parsedProductId]);
    return { message: "Product deleted successfully", deletedId: parsedProductId };
}

export async function getProductBySku(skuCode) {
    // Assuming SKU is the _id for now as per original NeDB structure.
    // If SKU is a different column, the query and potentially schema need adjustment.
    const db = await getDb();
    const parsedSkuCode = parseInt(skuCode);
    const product = db.exec("SELECT * FROM inventory WHERE _id = ?", [parsedSkuCode]);
     if (product.length === 0 || product[0].values.length === 0) {
        return null;
    }
    const columns = product[0].columns;
    const values = product[0].values[0];
    const result = {};
    columns.forEach((col, i) => result[col] = values[i]);
    return result;
}

export async function decrementInventory(products) {
    // Using asyncLib for compatibility with the original structure.
    // This could be refactored to use Promise.all or a for...of loop with async/await for better readability with modern JS.
    const db = await getDb();
    return new Promise((resolve, reject) => {
        asyncLib.eachSeries(products, async (transactionProduct, callback) => {
            try {
                // Fetch product details directly from DB to ensure latest quantity
                // The original getProductById might return a slightly different structure than NeDB, ensure compatibility
                const productQuery = db.exec("SELECT _id, quantity FROM inventory WHERE _id = ?", [parseInt(transactionProduct.id)]);

                let currentProduct = null;
                if (productQuery.length > 0 && productQuery[0].values.length > 0) {
                    const pColumns = productQuery[0].columns;
                    const pValues = productQuery[0].values[0];
                    currentProduct = {};
                    pColumns.forEach((col, i) => currentProduct[col] = pValues[i]);
                }

                if (!currentProduct || typeof currentProduct.quantity !== 'number') {
                    console.warn(`Product with ID ${transactionProduct.id} not found or has invalid quantity.`);
                    callback(); // Skip this product or handle error
                    return;
                }

                let updatedQuantity =
                    parseInt(currentProduct.quantity) -
                    parseInt(transactionProduct.quantity);

                if (updatedQuantity < 0) {
                    console.warn(`Product ID ${currentProduct._id} stock would go negative. Setting to 0 or handling as error.`);
                    // Decide on behavior: set to 0, or throw error, or skip.
                    // For now, let's assume it's an error or should be handled by business logic not to go < 0.
                    // updatedQuantity = 0; // Option: prevent negative stock
                }

                db.run('UPDATE inventory SET quantity = ? WHERE _id = ?', [updatedQuantity, parseInt(currentProduct._id)]);
                callback();
            } catch (err) {
                console.error(`Error decrementing inventory for product ID ${transactionProduct.id}:`, err);
                callback(err); // Propagate error to eachSeries
            }
        }, (err) => {
            if (err) {
                console.error("Failed to decrement inventory for one or more products:", err);
                reject(err);
            } else {
                resolve({ message: "Inventory decremented successfully for all applicable products." });
            }
        });
    });
}