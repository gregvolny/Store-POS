import { getDb } from '../src/database.js';

// Removed Express, multer, fs, os, path, etc. File handling for images is simplified.

export async function getSettings() {
    const db = await getDb();
    const result = db.exec("SELECT settings_json FROM settings WHERE _id = 1");

    if (result.length > 0 && result[0].values.length > 0) {
        try {
            // The settings_json column stores the settings object as a JSON string.
            // The original structure had { _id: 1, settings: {...} }
            // We will return the inner 'settings' object directly.
            const settingsData = JSON.parse(result[0].values[0][0]);
            return settingsData.settings || settingsData; // Return inner settings object, or full if that's how it's stored
        } catch (e) {
            console.error("Error parsing settings JSON from DB:", e);
            return {}; // Return empty object or default settings on error
        }
    }
    // This should ideally not happen due to INSERT OR IGNORE in database.js
    console.warn("No settings found in database, returning empty object.");
    return {};
}

export async function saveSettings(settingsDataFromForm, imageFile = null) {
    const db = await getDb();

    let imageName = settingsDataFromForm.img || ''; // Existing image name

    // Image removal logic (fs.unlinkSync) is removed. Client needs to handle this.
    if (settingsDataFromForm.remove == 1 && settingsDataFromForm.img) {
        // console.log(`TODO: Handle removal of settings image: ${settingsDataFromForm.img}`); // Original TODO
        // For static app without image upload, if 'remove' (likely for logo) is set, we clear the imageName.
        imageName = '';
        console.log(`Logo image reference "${settingsDataFromForm.img}" will be removed. Actual file not deleted from assets.`);
    }

    if (imageFile) {
        // For this static version, new image uploads are not supported.
        console.warn(`New logo image file "${imageFile.name}" was provided, but image uploads are not supported in this static version. The image will not be saved.`);
        if (!settingsDataFromForm.img || settingsDataFromForm.remove == 1) {
            imageName = '';
        } else {
            imageName = settingsDataFromForm.img; // Retain existing
        }
    }
          
    // Construct the settings object as it was structured before
    const fullSettingsObject = {
        _id: 1, // Keep the original _id convention for the single settings document
        settings: {
            "app": settingsDataFromForm.app,
            "store": settingsDataFromForm.store,
            "address_one": settingsDataFromForm.address_one,
            "address_two": settingsDataFromForm.address_two,
            "contact": settingsDataFromForm.contact,
            "tax": settingsDataFromForm.tax,
            "symbol": settingsDataFromForm.symbol,
            "currency": settingsDataFromForm.currency,
            "percentage": settingsDataFromForm.percentage,
            "charge_tax": settingsDataFromForm.charge_tax, // Ensure this is boolean or correct type
            "footer": settingsDataFromForm.footer,
            "img": imageName, // Use the processed image name
            "stripe": { // Stripe settings are now part of the main JSON
                "category": settingsDataFromForm.stripemcc,
                "live": (settingsDataFromForm.stripestatus === 'live' || settingsDataFromForm.stripestatus === true), // Ensure boolean
                "publishable": {
                    "live": settingsDataFromForm.stripelivepublishable,
                    "test": settingsDataFromForm.stripetestpublishable
                },
                "secret": {
                    // Secrets are no longer stored client-side for security reasons.
                    // "live": settingsDataFromForm.stripelivesecret, // REMOVED
                    // "test": settingsDataFromForm.stripetestsecret  // REMOVED
                },
                "terminal": {
                    "locationid": {
                        "live": settingsDataFromForm.stripeterminallivelocationid,
                        "test": settingsDataFromForm.stripeterminaltestlocationid
                    }
                }
            }
        }       
    };

    // fs.writeFileSync for stripe.json is removed.
    // console.log("Stripe settings (to be saved in DB):", fullSettingsObject.settings.stripe);

    const settingsJsonString = JSON.stringify(fullSettingsObject);

    // NeDB insert/update logic is combined into an UPSERT for SQLite
    // The settings table is designed to have only one row with _id = 1.
    db.run(
        'UPDATE settings SET settings_json = ? WHERE _id = 1',
        [settingsJsonString]
    );

    return { message: "Settings saved successfully.", newSettings: fullSettingsObject.settings };
}