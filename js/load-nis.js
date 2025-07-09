// js/load-nis.js

const SAVED_NIS_COLLECTION_LOAD = 'savedNis';

async function populateSavedNisDropdown() {
    const dropdown = document.getElementById('saved-nis-dropdown');
    if (!dropdown) return;
    const currentSelectedValue = dropdown.value;
    dropdown.innerHTML = '<option value="">-- Select an NIS to Load --</option>';

    // Ensure db is available before proceeding
    if (typeof db === 'undefined' || !db) {
        console.error("Firestore 'db' not available in populateSavedNisDropdown. Cannot populate.");
        return;
    }

    try {
        const querySnapshot = await db.collection(SAVED_NIS_COLLECTION_LOAD)
                                     .orderBy("createdAt", "desc")
                                     .limit(50)
                                     .get();
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            let displayName = data.pdfFileName || `NIS for ${data.nis?.aircraftName || 'N/A'} on ${data.nis?.date || 'N/A'} (ID: ${doc.id.substring(0,5)})`;
            option.textContent = displayName;
            dropdown.appendChild(option);
        });
        if (dropdown.querySelector(`option[value="${currentSelectedValue}"]`)) {
            dropdown.value = currentSelectedValue;
        }
    } catch (error) {
        console.error("Error populating saved NIS dropdown:", error);
    }
}

async function loadSelectedNis() {
    console.log("loadSelectedNis called...");
    const dropdown = document.getElementById('saved-nis-dropdown');
    const selectedNisId = dropdown.value;
    const detailsDiv = document.getElementById('loaded-nis-details');
    if (detailsDiv) detailsDiv.textContent = "";

    if (!selectedNisId) {
        if (detailsDiv) detailsDiv.textContent = "Please select an NIS from the dropdown.";
        console.log("No NIS selected.");
        return;
    }

    // Explicitly check if db and getDocById are available
    if (typeof db === 'undefined' || !db) {
        console.error("Firestore 'db' is not available right before fetching in loadSelectedNis!");
        alert("Database connection error. Please refresh.");
        return;
    }
    if (typeof getDocById === 'undefined' || !getDocById) {
        console.error("getDocById function is not available right before fetching in loadSelectedNis!");
        alert("Application script error. Please refresh.");
        return;
    }
    console.log(`Attempting to load NIS ID: ${selectedNisId}`);

    try {
        // Call the globally available getDocById from db.js
        const nisData = await getDocById(SAVED_NIS_COLLECTION_LOAD, selectedNisId);
        
        console.log("Data returned from getDocById in loadSelectedNis:", nisData);

        if (nisData) {
            if (typeof populateNisFormWithLoadedData === 'function') {
                await populateNisFormWithLoadedData(nisData);
                if (detailsDiv) detailsDiv.textContent = `Successfully loaded: ${dropdown.options[dropdown.selectedIndex].text}`;
                alert("NIS data loaded successfully!");
                const nisTabButton = document.querySelector('.tab-link[onclick*="nis-details"]');
                if (nisTabButton) nisTabButton.click();
            } else {
                console.error("populateNisFormWithLoadedData function not found.");
                if (detailsDiv) detailsDiv.textContent = "Error: Core form population function is missing.";
            }
        } else {
            console.log("Document data is null (not found or error fetching). ID:", selectedNisId);
            if (detailsDiv) detailsDiv.textContent = "Selected NIS data could not be retrieved.";
            alert("Could not retrieve data for the selected NIS.");
        }
    } catch (error) {
        console.error("Error during the loading process (ID: " + selectedNisId + "):", error);
        if (detailsDiv) detailsDiv.textContent = "Error loading data: " + error.message;
        alert("An error occurred while loading the NIS data.");
    }
}

function initializeLoadNis() {
    console.log("Initializing Load NIS...");
    const loadButton = document.getElementById('load-selected-nis-btn');
    if (loadButton) {
        loadButton.addEventListener('click', loadSelectedNis);
        console.log("Load button event listener attached.");
    } else {
        console.error("Load button not found!");
    }
    // Initial population of the dropdown
    // Add a small delay to ensure db might be ready if timing is an issue
    setTimeout(() => {
        console.log("Populating saved NIS dropdown...");
        populateSavedNisDropdown();
    }, 500); // 500ms delay
}