// js/nis-form.js

// ===== FORM DATA FUNCTIONS =====
function getNisFormData() {
    const form = document.getElementById('nis-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Get aircraft name for display
    const aircraftSelect = document.getElementById('nis-aircraft');
    data.aircraftName = aircraftSelect.options[aircraftSelect.selectedIndex]?.text.replace('-- Select Aircraft --','').trim();

    // Use centralized signee utility
    data.signedByName = getSelectedSigneeName('nis-signed-by');

    // Get component details
    data.partNumber = document.getElementById('nis-part-number').value.trim();
    data.description = document.getElementById('nis-description').value.trim();
    data.serialNo = document.getElementById('nis-serial-no').value.trim();
    
    // Handle TSO and CSO with N/A functionality
    const tsoNAChecked = document.getElementById('nis-tso-na').checked;
    const csoNAChecked = document.getElementById('nis-cso-na').checked;
    
    data.tso = tsoNAChecked ? 'N/A' : document.getElementById('nis-tso').value.trim();
    data.cso = csoNAChecked ? 'N/A' : document.getElementById('nis-cso').value.trim();
    data.tsoNA = tsoNAChecked;
    data.csoNA = csoNAChecked;

    return data;
}

// ===== FORM POPULATION FOR LOADING =====
async function populateNisFormWithLoadedData(nisData) {
    document.getElementById('nis-date').value = nisData.nis.date || new Date().toISOString().split('T')[0];
    document.getElementById('nis-aircraft').value = nisData.nis.aircraft || '';
    document.getElementById('nis-signed-by').value = nisData.nis.signedBy || '';
    
    // Component details
    document.getElementById('nis-part-number').value = nisData.nis.partNumber || '';
    document.getElementById('nis-description').value = nisData.nis.description || '';
    document.getElementById('nis-serial-no').value = nisData.nis.serialNo || '';
    
    // TSO and CSO with N/A handling
    const tsoNACheckbox = document.getElementById('nis-tso-na');
    const csoNACheckbox = document.getElementById('nis-cso-na');
    const tsoInput = document.getElementById('nis-tso');
    const csoInput = document.getElementById('nis-cso');
    
    if (nisData.nis.tsoNA) {
        tsoNACheckbox.checked = true;
        tsoInput.value = '';
        tsoInput.disabled = true;
    } else {
        tsoNACheckbox.checked = false;
        tsoInput.value = nisData.nis.tso || '';
        tsoInput.disabled = false;
    }
    
    if (nisData.nis.csoNA) {
        csoNACheckbox.checked = true;
        csoInput.value = '';
        csoInput.disabled = true;
    } else {
        csoNACheckbox.checked = false;
        csoInput.value = nisData.nis.cso || '';
        csoInput.disabled = false;
    }
}

// ===== FORM INITIALIZATION =====
function initializeNisForm() {
    // Set today's date as default
    const nisDateInput = document.getElementById('nis-date');
    if (nisDateInput) {
        nisDateInput.valueAsDate = new Date();
    }

    // TSO N/A checkbox functionality
    const tsoNACheckbox = document.getElementById('nis-tso-na');
    const tsoInput = document.getElementById('nis-tso');
    if (tsoNACheckbox && tsoInput) {
        tsoNACheckbox.addEventListener('change', function() {
            if (this.checked) {
                tsoInput.disabled = true;
                tsoInput.value = '';
            } else {
                tsoInput.disabled = false;
            }
        });
        // Initialize state
        if (tsoNACheckbox.checked) {
            tsoInput.disabled = true;
        }
    }

    // CSO N/A checkbox functionality
    const csoNACheckbox = document.getElementById('nis-cso-na');
    const csoInput = document.getElementById('nis-cso');
    if (csoNACheckbox && csoInput) {
        csoNACheckbox.addEventListener('change', function() {
            if (this.checked) {
                csoInput.disabled = true;
                csoInput.value = '';
            } else {
                csoInput.disabled = false;
            }
        });
        // Initialize state
        if (csoNACheckbox.checked) {
            csoInput.disabled = true;
        }
    }

    console.log("NIS form initialized.");
}