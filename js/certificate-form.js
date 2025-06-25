// js/certificate-form.js

const MIN_CERT_ITEM_ROWS = 1;
let certItemLineCounter = 0;

// ===== CERTIFICATE ITEMS TABLE MANAGEMENT =====
function createCertItemRow(itemData = {}) {
    certItemLineCounter++;
    const itemsTableBody = document.getElementById('cert-items-table-body');
    const row = itemsTableBody.insertRow();
    row.id = `cert-item-row-${certItemLineCounter}`;

    const qty = itemData.qty || '';
    const partNumber = itemData.partNumber || '';
    const description = itemData.description || '';
    const trackingNumber = itemData.trackingNumber || '';
    const expiryDate = itemData.expiryDate || '';
    const expiryNA = itemData.expiryNA || false;

    row.innerHTML = `
        <td><span class="cert-item-line-number">${itemsTableBody.rows.length}</span></td>
        <td><input type="number" name="cert-item-qty" value="${qty}" placeholder="1" min="0" style="width: 90%;"></td>
        <td><input type="text" name="cert-item-part-number" value="${partNumber}" placeholder="Part Number" style="width: 98%;"></td>
        <td><input type="text" name="cert-item-description" value="${description}" placeholder="Description" style="width: 98%;"></td>
        <td><input type="text" name="cert-item-tracking-number" value="${trackingNumber}" placeholder="Tracking Number" style="width: 98%;"></td>
        <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <input type="date" name="cert-item-expiry-date" value="${expiryDate}" style="width: 100%;" ${expiryNA ? 'disabled' : ''}>
                <label style="font-size: 0.8em; display: flex; align-items: center; gap: 3px; justify-content: center;">
                    <input type="checkbox" name="cert-item-expiry-na" ${expiryNA ? 'checked' : ''} style="margin: 0;">
                    No shelf life
                </label>
            </div>
        </td>
        <td><button type="button" class="action-button cert-item-clear-row-btn">Clear</button></td>
    `;

    const clearButton = row.querySelector('.cert-item-clear-row-btn');
    if (clearButton) {
        clearButton.addEventListener('click', () => clearCertItemRowContents(row));
    }
    
    // Add event listener for expiry N/A checkbox
    const expiryNACheckbox = row.querySelector('input[name="cert-item-expiry-na"]');
    const expiryDateInput = row.querySelector('input[name="cert-item-expiry-date"]');
    if (expiryNACheckbox && expiryDateInput) {
        expiryNACheckbox.addEventListener('change', function() {
            if (this.checked) {
                expiryDateInput.disabled = true;
                expiryDateInput.value = '';
            } else {
                expiryDateInput.disabled = false;
            }
        });
    }
    
    updateCertItemRowNumbersAndButtonsState();
    return row;
}

function clearCertItemRowContents(rowElement) {
    if (rowElement) {
        rowElement.querySelectorAll('input[type="text"], input[type="number"], input[type="date"]').forEach(input => {
            if (input.name === "cert-item-qty") input.value = "";
            else input.value = "";
        });
        // Clear and enable expiry date checkbox
        const expiryNACheckbox = rowElement.querySelector('input[name="cert-item-expiry-na"]');
        const expiryDateInput = rowElement.querySelector('input[name="cert-item-expiry-date"]');
        if (expiryNACheckbox) {
            expiryNACheckbox.checked = false;
        }
        if (expiryDateInput) {
            expiryDateInput.disabled = false;
        }
    }
}

function isCertItemRowEmpty(rowElement) {
    if (!rowElement) return true;
    const inputs = rowElement.querySelectorAll('input[type="text"], input[type="number"], input[type="date"]');
    for (let input of inputs) {
        if (input.value && input.value.trim() !== "") return false;
    }
    // Check if expiry N/A checkbox is checked (considered as having data)
    const expiryNACheckbox = rowElement.querySelector('input[name="cert-item-expiry-na"]');
    if (expiryNACheckbox && expiryNACheckbox.checked) return false;
    
    return true;
}

function removeLastCertItemRow() {
    const itemsTableBody = document.getElementById('cert-items-table-body');
    if (itemsTableBody.rows.length > MIN_CERT_ITEM_ROWS) {
        const lastRow = itemsTableBody.rows[itemsTableBody.rows.length - 1];
        if (!isCertItemRowEmpty(lastRow)) {
            if (!confirm("The last item line contains data. Are you sure you want to remove it?")) {
                return;
            }
        }
        lastRow.remove();
        updateCertItemRowNumbersAndButtonsState();
    } else {
        alert(`Cannot remove row. Minimum ${MIN_CERT_ITEM_ROWS} item row required.`);
    }
}

function updateCertItemRowNumbersAndButtonsState() {
    const itemsTableBody = document.getElementById('cert-items-table-body');
    let currentLineNumber = 1;
    Array.from(itemsTableBody.rows).forEach(row => {
        const lineNumberCell = row.querySelector('.cert-item-line-number');
        if (lineNumberCell) {
            lineNumberCell.textContent = currentLineNumber++;
        }
    });
    const removeBtn = document.getElementById('remove-cert-item-row');
    if (removeBtn) {
        removeBtn.disabled = itemsTableBody.rows.length <= MIN_CERT_ITEM_ROWS;
    }
}

function addDefaultCertItemRows() {
    const itemsTableBody = document.getElementById('cert-items-table-body');
    certItemLineCounter = 0;
    itemsTableBody.innerHTML = '';
    for (let i = 0; i < MIN_CERT_ITEM_ROWS; i++) {
        createCertItemRow();
    }
    updateCertItemRowNumbersAndButtonsState();
}

// ===== FORM DATA FUNCTIONS =====
function getCertificateFormData() {
    const form = document.getElementById('certificate-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Get signee name
    const signedBySelect = document.getElementById('cert-signed-by');
    data.signedByName = signedBySelect.options[signedBySelect.selectedIndex]?.text.replace('-- Select Signee --','').trim();

    // Get product type name
    const productTypeSelect = document.getElementById('cert-product-type');
    data.productTypeName = productTypeSelect.options[productTypeSelect.selectedIndex]?.text.replace('-- Select Product Type --','').trim();

    return data;
}

function getCertItemsTableData() {
    const items = [];
    const itemsTableBody = document.getElementById('cert-items-table-body');
    itemsTableBody.querySelectorAll('tr').forEach(row => {
        const partNumberInput = row.querySelector('input[name="cert-item-part-number"]').value.trim();
        const descInput = row.querySelector('input[name="cert-item-description"]').value.trim();
        const qtyInput = row.querySelector('input[name="cert-item-qty"]');

        // Add if there's actual data in the row
        if (partNumberInput || descInput || (qtyInput && qtyInput.value.trim())) {
            const expiryNACheckbox = row.querySelector('input[name="cert-item-expiry-na"]');
            const expiryDateInput = row.querySelector('input[name="cert-item-expiry-date"]');
            
            const item = {
                qty: qtyInput ? qtyInput.value : '',
                partNumber: partNumberInput,
                description: descInput,
                trackingNumber: row.querySelector('input[name="cert-item-tracking-number"]').value.trim(),
                expiryDate: expiryDateInput ? expiryDateInput.value : '',
                expiryNA: expiryNACheckbox ? expiryNACheckbox.checked : false
            };
            items.push(item);
        }
    });
    return items;
}

// ===== FORM POPULATION FOR LOADING =====
async function populateCertificateFormWithLoadedData(certificateData) {
    document.getElementById('cert-product-type').value = certificateData.certificate.productType || '';
    document.getElementById('cert-signed-by').value = certificateData.certificate.signedBy || '';
    document.getElementById('cert-notes').value = certificateData.certificate.notes || '';

    // Populate items table
    const itemsTableBody = document.getElementById('cert-items-table-body');
    itemsTableBody.innerHTML = '';
    certItemLineCounter = 0;
    
    if (certificateData.items && certificateData.items.length > 0) {
        certificateData.items.forEach(item => createCertItemRow(item));
    }
    
    if (itemsTableBody.rows.length < MIN_CERT_ITEM_ROWS) {
        for(let i = itemsTableBody.rows.length; i < MIN_CERT_ITEM_ROWS; i++) {
            createCertItemRow();
        }
    }
}

// ===== FORM INITIALIZATION =====
function initializeCertificateForm() {
    // Add Item Row Button
    const addItemRowBtn = document.getElementById('add-cert-item-row');
    if (addItemRowBtn) {
        addItemRowBtn.addEventListener('click', () => createCertItemRow());
    }

    // Remove Last Item Row Button
    const removeItemRowBtn = document.getElementById('remove-cert-item-row');
    if (removeItemRowBtn) {
        removeItemRowBtn.addEventListener('click', removeLastCertItemRow);
    }

    // Initialize with default rows
    addDefaultCertItemRows();

    // Generate PDF button
    const generatePdfBtn = document.getElementById('generate-certificate-pdf-btn');
    if (generatePdfBtn && typeof generateCertificatePDF === 'function') {
        generatePdfBtn.addEventListener('click', generateCertificatePDF);
    }
}