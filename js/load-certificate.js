// js/load-certificate.js

const SAVED_CERTIFICATES_COLLECTION_LOAD = 'savedCertificates';

async function populateSavedCertificatesDropdown() {
    const dropdown = document.getElementById('saved-certificates-dropdown');
    if (!dropdown) return;
    const currentSelectedValue = dropdown.value;
    dropdown.innerHTML = '<option value="">-- Select a Certificate to Load --</option>';

    // Ensure db is available before proceeding
    if (typeof db === 'undefined' || !db) {
        console.error("Firestore 'db' not available in populateSavedCertificatesDropdown. Cannot populate.");
        return;
    }

    try {
        const querySnapshot = await db.collection(SAVED_CERTIFICATES_COLLECTION_LOAD)
                                     .orderBy("createdAt", "desc")
                                     .limit(50)
                                     .get();
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            let displayName = data.pdfFileName || `Certificate ${data.certificate?.trackingId || 'N/A'} (ID: ${doc.id.substring(0,5)})`;
            option.textContent = displayName;
            dropdown.appendChild(option);
        });
        if (dropdown.querySelector(`option[value="${currentSelectedValue}"]`)) {
            dropdown.value = currentSelectedValue;
        }
    } catch (error) {
        console.error("Error populating saved certificates dropdown:", error);
    }
}

async function loadSelectedCertificate() {
    console.log("loadSelectedCertificate called...");
    const dropdown = document.getElementById('saved-certificates-dropdown');
    const selectedCertificateId = dropdown.value;
    const detailsDiv = document.getElementById('loaded-certificate-details');
    if (detailsDiv) detailsDiv.textContent = "";

    if (!selectedCertificateId) {
        if (detailsDiv) detailsDiv.textContent = "Please select a certificate from the dropdown.";
        console.log("No certificate selected.");
        return;
    }

    // Explicitly check if db and getDocById are available
    if (typeof db === 'undefined' || !db) {
        console.error("Firestore 'db' is not available right before fetching in loadSelectedCertificate!");
        alert("Database connection error. Please refresh.");
        return;
    }
    if (typeof getDocById === 'undefined' || !getDocById) {
        console.error("getDocById function is not available right before fetching in loadSelectedCertificate!");
        alert("Application script error. Please refresh.");
        return;
    }
    console.log(`Attempting to load certificate ID: ${selectedCertificateId}`);

    try {
        // Call the globally available getDocById from db.js
        const certificateData = await getDocById(SAVED_CERTIFICATES_COLLECTION_LOAD, selectedCertificateId);
        
        console.log("Data returned from getDocById in loadSelectedCertificate:", certificateData);

        if (certificateData) {
            if (typeof populateCertificateFormWithLoadedData === 'function') {
                await populateCertificateFormWithLoadedData(certificateData);
                if (detailsDiv) detailsDiv.textContent = `Successfully loaded: ${dropdown.options[dropdown.selectedIndex].text}`;
                alert("Certificate data loaded successfully!");
                const certificateTabButton = document.querySelector('.tab-link[onclick*="certificate"]');
                if (certificateTabButton) certificateTabButton.click();
            } else {
                console.error("populateCertificateFormWithLoadedData function not found.");
                if (detailsDiv) detailsDiv.textContent = "Error: Core form population function is missing.";
            }
        } else {
            console.log("Document data is null (not found or error fetching). ID:", selectedCertificateId);
            if (detailsDiv) detailsDiv.textContent = "Selected certificate data could not be retrieved.";
            alert("Could not retrieve data for the selected certificate.");
        }
    } catch (error) {
        console.error("Error during the loading process (ID: " + selectedCertificateId + "):", error);
        if (detailsDiv) detailsDiv.textContent = "Error loading data: " + error.message;
        alert("An error occurred while loading the certificate data.");
    }
}

function initializeLoadCertificate() {
    console.log("Initializing Load Certificate...");
    const loadButton = document.getElementById('load-selected-certificate-btn');
    if (loadButton) {
        loadButton.addEventListener('click', loadSelectedCertificate);
        console.log("Load button event listener attached.");
    } else {
        console.error("Load button not found!");
    }
    // Initial population of the dropdown
    // Add a small delay to ensure db might be ready if timing is an issue
    setTimeout(() => {
        console.log("Populating saved certificates dropdown...");
        populateSavedCertificatesDropdown();
    }, 500); // 500ms delay
}