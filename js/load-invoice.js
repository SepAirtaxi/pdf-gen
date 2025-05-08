// js/load-invoice.js

const SAVED_INVOICES_COLLECTION_LOAD = 'savedInvoices'; 

async function populateSavedInvoicesDropdown() {
    const dropdown = document.getElementById('saved-invoices-dropdown');
    if (!dropdown) return;
    const currentSelectedValue = dropdown.value;
    dropdown.innerHTML = '<option value="">-- Select an Invoice to Load --</option>'; 

    // Ensure db is available before proceeding
    if (typeof db === 'undefined' || !db) {
        console.error("Firestore 'db' not available in populateSavedInvoicesDropdown. Cannot populate.");
        return;
    }

    try {
        const querySnapshot = await db.collection(SAVED_INVOICES_COLLECTION_LOAD)
                                     .orderBy("createdAt", "desc") 
                                     .limit(50) 
                                     .get();
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            let displayName = data.pdfFileName || `Invoice for ${data.general?.toEntityName || 'N/A'} on ${data.general?.date || 'N/A'} (ID: ${doc.id.substring(0,5)})`;
            option.textContent = displayName;
            dropdown.appendChild(option);
        });
        if (dropdown.querySelector(`option[value="${currentSelectedValue}"]`)) {
            dropdown.value = currentSelectedValue;
        }
    } catch (error) {
        console.error("Error populating saved invoices dropdown:", error);
    }
}

async function loadSelectedInvoice() {
    console.log("loadSelectedInvoice called..."); // Log entry
    const dropdown = document.getElementById('saved-invoices-dropdown');
    const selectedInvoiceId = dropdown.value;
    const detailsDiv = document.getElementById('loaded-invoice-details');
    if (detailsDiv) detailsDiv.textContent = ""; 

    if (!selectedInvoiceId) {
        if (detailsDiv) detailsDiv.textContent = "Please select an invoice from the dropdown.";
        console.log("No invoice selected.");
        return;
    }

    // *** Explicitly check if db and getDocById are available ***
    if (typeof db === 'undefined' || !db) {
         console.error("Firestore 'db' is not available right before fetching in loadSelectedInvoice!");
         alert("Database connection error. Please refresh.");
         return;
    }
     if (typeof getDocById === 'undefined' || !getDocById) {
         console.error("getDocById function is not available right before fetching in loadSelectedInvoice!");
         alert("Application script error. Please refresh.");
         return;
    }
    console.log(`Attempting to load invoice ID: ${selectedInvoiceId}`);

    try {
        // Call the globally available getDocById from db.js
        const invoiceData = await getDocById(SAVED_INVOICES_COLLECTION_LOAD, selectedInvoiceId); 
        
        console.log("Data returned from getDocById in loadSelectedInvoice:", invoiceData); // Log what was returned

        if (invoiceData) { // getDocById now returns the data object directly, or null
            if (typeof populateFormWithLoadedData === 'function') {
                await populateFormWithLoadedData(invoiceData); 
                if (detailsDiv) detailsDiv.textContent = `Successfully loaded: ${dropdown.options[dropdown.selectedIndex].text}`;
                alert("Invoice data loaded successfully!");
                const generalTabButton = document.querySelector('.tab-link[onclick*="general"]');
                if (generalTabButton) generalTabButton.click();
            } else {
                console.error("populateFormWithLoadedData function not found.");
                if (detailsDiv) detailsDiv.textContent = "Error: Core form population function is missing.";
            }
        } else {
            // This means getDocById returned null (either not found or error during fetch)
            console.log("Document data is null (not found or error fetching). ID:", selectedInvoiceId);
            if (detailsDiv) detailsDiv.textContent = "Selected invoice data could not be retrieved.";
             alert("Could not retrieve data for the selected invoice.");
        }
    } catch (error) {
        // Catch errors specifically from the getDocById call or subsequent processing
        console.error("Error during the loading process (ID: " + selectedInvoiceId + "):", error);
        if (detailsDiv) detailsDiv.textContent = "Error loading data: " + error.message;
        alert("An error occurred while loading the invoice data.");
    }
}

function initializeLoadInvoice() {
    console.log("Initializing Load Invoice...");
    const loadButton = document.getElementById('load-selected-invoice-btn');
    if (loadButton) {
        loadButton.addEventListener('click', loadSelectedInvoice);
        console.log("Load button event listener attached.");
    } else {
        console.error("Load button not found!");
    }
    // Initial population of the dropdown
    // Add a small delay to ensure db might be ready if timing is an issue
    setTimeout(() => {
        console.log("Populating saved invoices dropdown...");
        populateSavedInvoicesDropdown();
    }, 500); // 500ms delay
}