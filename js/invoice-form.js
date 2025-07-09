// js/invoice-form.js - Modified to use centralized signee management

const MIN_ITEM_ROWS = 1; 
const MIN_COLLI_ROWS = 1;
let itemLineCounter = 0;
let colliLineCounter = 0;

// ===== GENERAL FORM HELPERS =====
function updateTotalValue() {
    const itemsTableBody = document.getElementById('items-table-body');
    let totalValue = 0;
    itemsTableBody.querySelectorAll('tr').forEach(row => {
        const valueInput = row.querySelector('input[name="item-value"]');
        if (valueInput && valueInput.value) {
            const value = parseFloat(valueInput.value);
            if (!isNaN(value)) {
                totalValue += value;
            }
        }
    });
    const totalValueInput = document.getElementById('inv-total-value');
    if (totalValueInput) {
        totalValueInput.value = totalValue.toFixed(2);
    }
}

function updateTotalWeight() {
    const colliTableBody = document.getElementById('colli-table-body');
    let totalWeight = 0;
    colliTableBody.querySelectorAll('tr').forEach(row => {
        const weightInput = row.querySelector('input[name="colli-weight"]');
        if (weightInput && weightInput.value) {
            const weight = parseFloat(weightInput.value);
            if (!isNaN(weight)) {
                totalWeight += weight;
            }
        }
    });
    const totalWeightInput = document.getElementById('inv-total-weight');
    if (totalWeightInput) {
        totalWeightInput.value = totalWeight.toFixed(2);
    }
}


// ===== ITEMS TABLE MANAGEMENT =====
function createItemRow(itemData = {}) {
    itemLineCounter++;
    const itemsTableBody = document.getElementById('items-table-body');
    const row = itemsTableBody.insertRow();
    row.id = `item-row-${itemLineCounter}`;

    const qty = itemData.qty || '';
    const uom = itemData.uom || 'Ea.'; 
    const pn = itemData.pn || '';
    const sn = itemData.sn || '';
    const description = itemData.description || '';
    const origin = itemData.origin || '';
    const value = itemData.value || '';

    row.innerHTML = `
        <td><span class="item-line-number">${itemsTableBody.rows.length}</span></td>
        <td><input type="number" name="item-qty" value="${qty}" placeholder="1" min="0" style="width: 90%;"></td>
        <td><input type="text" name="item-uom" value="${uom}" placeholder="Ea." style="width: 90%;"></td>
        <td><input type="text" name="item-pn" value="${pn}" placeholder="Part Number" style="width: 98%;"></td>
        <td><input type="text" name="item-sn" value="${sn}" placeholder="Serial Number" style="width: 98%;"></td>
        <td><input type="text" name="item-description" value="${description}" placeholder="Description" style="width: 98%;"></td>
        <td><input type="text" name="item-origin" value="${origin}" placeholder="USA" style="width: 90%;"></td>
        <td><input type="number" name="item-value" value="${value}" placeholder="0.00" step="0.01" min="0" style="width: 90%;"></td>
        <td><button type="button" class="action-button item-clear-row-btn">Clear</button></td>
    `;

    const valueInput = row.querySelector('input[name="item-value"]');
    if (valueInput) {
        valueInput.addEventListener('input', updateTotalValue);
        valueInput.addEventListener('change', updateTotalValue); 
    }
    
    const clearButton = row.querySelector('.item-clear-row-btn');
    if (clearButton) {
        clearButton.addEventListener('click', () => clearItemRowContents(row)); 
    }
    
    updateItemRowNumbersAndButtonsState(); 
    return row;
}

function clearItemRowContents(rowElement) { 
    if (rowElement) {
        rowElement.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
            if (input.name === "item-uom") input.value = "Ea."; 
            else if (input.name === "item-qty") input.value = ""; 
            else input.value = "";
        });
        updateTotalValue(); 
    }
}

function isRowEmpty(rowElement) {
    if (!rowElement) return true;
    const inputs = rowElement.querySelectorAll('input[type="text"], input[type="number"]');
    for (let input of inputs) {
        // Check if UOM is different from default or if other fields have content
        if (input.name === "item-uom" && input.value && input.value.trim().toLowerCase() !== "ea." && input.value.trim() !== "") return false;
        if (input.name !== "item-uom" && input.value && input.value.trim() !== "") return false;
    }
    return true;
}

function removeLastItemRow() {
    const itemsTableBody = document.getElementById('items-table-body');
    if (itemsTableBody.rows.length > MIN_ITEM_ROWS) {
        const lastRow = itemsTableBody.rows[itemsTableBody.rows.length - 1];
        if (!isRowEmpty(lastRow)) {
            if (!confirm("The last item line contains data. Are you sure you want to remove it?")) {
                return; 
            }
        }
        lastRow.remove();
        updateItemRowNumbersAndButtonsState();
        updateTotalValue();
    } else {
        alert(`Cannot remove row. Minimum ${MIN_ITEM_ROWS} item row required.`);
    }
}

function updateItemRowNumbersAndButtonsState() {
    const itemsTableBody = document.getElementById('items-table-body');
    let currentLineNumber = 1;
    Array.from(itemsTableBody.rows).forEach(row => {
        const lineNumberCell = row.querySelector('.item-line-number');
        if (lineNumberCell) {
            lineNumberCell.textContent = currentLineNumber++;
        }
    });
    const removeBtnAbove = document.getElementById('remove-item-row-above');
    if (removeBtnAbove) {
        removeBtnAbove.disabled = itemsTableBody.rows.length <= MIN_ITEM_ROWS;
    }
}

function addDefaultItemRows() {
    const itemsTableBody = document.getElementById('items-table-body');
    itemLineCounter = 0; 
    itemsTableBody.innerHTML = ''; 
    for (let i = 0; i < MIN_ITEM_ROWS; i++) { 
        createItemRow();
    }
    updateItemRowNumbersAndButtonsState(); // Ensure button state is correct after adding defaults
    updateTotalValue(); 
}


// ===== COLLI TABLE MANAGEMENT =====
async function createColliRow(colliData = {}) {
    colliLineCounter++;
    const colliTableBody = document.getElementById('colli-table-body');
    const row = colliTableBody.insertRow();
    row.id = `colli-row-${colliLineCounter}`;

    const packing = colliData.packing || '';
    const length = colliData.length || '';
    const width = colliData.width || '';
    const height = colliData.height || '';
    const weight = colliData.weight || '';
    const selectedTemplateId = colliData.templateId || '';

    const packingTypes = await getAllDocs(PACKING_TYPES_COLLECTION);
    let packingOptionsHtml = '<option value="">Select Packing</option>';
    packingTypes.sort((a,b) => (a.typeName||'').localeCompare(b.typeName||'')).forEach(pt => {
        packingOptionsHtml += `<option value="${pt.typeName}" ${packing === pt.typeName ? 'selected' : ''}>${pt.typeName}</option>`;
    });

    const packingTemplates = await getAllDocs(PACKING_TEMPLATES_COLLECTION);
    let templateOptionsHtml = '<option value="">Select Template</option>';
    packingTemplates.sort((a,b)=>(a.templateName||'').localeCompare(b.templateName||'')).forEach(t => {
        templateOptionsHtml += `<option value="${t.id}" data-details='${JSON.stringify(t)}' ${selectedTemplateId === t.id ? 'selected' : ''}>${t.templateName}</option>`;
    });
    
    row.innerHTML = `
        <td><span class="colli-line-number">${colliTableBody.rows.length}</span></td>
        <td><select name="colli-packing" style="width: 95%;">${packingOptionsHtml}</select></td>
        <td><input type="number" name="colli-length" value="${length}" placeholder="0" step="any" min="0" style="width: 90%;"></td>
        <td><input type="number" name="colli-width" value="${width}" placeholder="0" step="any" min="0" style="width: 90%;"></td>
        <td><input type="number" name="colli-height" value="${height}" placeholder="0" step="any" min="0" style="width: 90%;"></td>
        <td><input type="number" name="colli-weight" value="${weight}" placeholder="0.00" step="any" min="0" style="width: 90%;"></td>
        <td><select name="colli-template" style="width: 95%;">${templateOptionsHtml}</select></td>
        <td><button type="button" class="action-button colli-clear-row-btn">Clear</button></td>
    `;

    const weightInput = row.querySelector('input[name="colli-weight"]');
    const lengthInput = row.querySelector('input[name="colli-length"]');
    const widthInput = row.querySelector('input[name="colli-width"]');
    const heightInput = row.querySelector('input[name="colli-height"]');
    
    if (weightInput) {
        weightInput.addEventListener('input', updateTotalWeight);
        weightInput.addEventListener('change', updateTotalWeight);
    }
    
    const templateSelect = row.querySelector('select[name="colli-template"]');
    if (templateSelect) {
        templateSelect.addEventListener('change', (event) => {
            const selectedOption = event.target.selectedOptions[0];
            if (selectedOption && selectedOption.value) {
                const templateDetails = JSON.parse(selectedOption.dataset.details);
                row.querySelector('select[name="colli-packing"]').value = templateDetails.packingType || '';
                lengthInput.value = templateDetails.length || '';
                widthInput.value = templateDetails.width || '';
                heightInput.value = templateDetails.height || '';
                weightInput.value = templateDetails.weight || '';
                updateTotalWeight(); 
            }
        });
    }
    
    const clearButton = row.querySelector('.colli-clear-row-btn');
    if (clearButton) {
        clearButton.addEventListener('click', () => clearColliRowContents(row)); 
    }
    
    updateColliRowNumbersAndButtonsState(); 
    return row;
}

function clearColliRowContents(rowElement) { 
    if (rowElement) {
        rowElement.querySelectorAll('input[type="number"], select').forEach(input => {
            if (input.tagName === 'SELECT') input.value = ""; 
            else input.value = ""; 
        });
        updateTotalWeight(); 
    }
}

function isColliRowEmpty(rowElement) {
    if (!rowElement) return true;
    const inputs = rowElement.querySelectorAll('input[type="number"], select');
    for (let input of inputs) {
        if (input.value && input.value.trim() !== "") return false;
    }
    return true;
}

function removeLastColliRow() {
    const colliTableBody = document.getElementById('colli-table-body');
    if (colliTableBody.rows.length > MIN_COLLI_ROWS) {
        const lastRow = colliTableBody.rows[colliTableBody.rows.length - 1];
        if (!isColliRowEmpty(lastRow)) {
            if (!confirm("The last colli line contains data. Are you sure you want to remove it?")) {
                return; 
            }
        }
        lastRow.remove();
        updateColliRowNumbersAndButtonsState();
        updateTotalWeight();
    } else {
        alert(`Cannot remove row. Minimum ${MIN_COLLI_ROWS} colli row required.`);
    }
}

function updateColliRowNumbersAndButtonsState() {
    const colliTableBody = document.getElementById('colli-table-body');
    let currentLineNumber = 1;
    Array.from(colliTableBody.rows).forEach(row => {
        const lineNumberCell = row.querySelector('.colli-line-number');
        if (lineNumberCell) {
            lineNumberCell.textContent = currentLineNumber++;
        }
    });
    const removeBtnAbove = document.getElementById('remove-colli-row-above');
    if (removeBtnAbove) {
        removeBtnAbove.disabled = colliTableBody.rows.length <= MIN_COLLI_ROWS;
    }
}

async function addDefaultColliRows() {
    const colliTableBody = document.getElementById('colli-table-body');
    colliLineCounter = 0; 
    colliTableBody.innerHTML = ''; 
    for (let i = 0; i < MIN_COLLI_ROWS; i++) { 
        await createColliRow(); 
    }
    updateColliRowNumbersAndButtonsState(); // Ensure button state is correct
    updateTotalWeight(); 
}


// ===== FORM INITIALIZATION =====
async function initializeInvoiceForm() {
    // Add Item Row Button (Above Table)
    const addItemRowBtnAbove = document.getElementById('add-item-row-above');
    if (addItemRowBtnAbove) {
        addItemRowBtnAbove.addEventListener('click', () => createItemRow());
    }

    // Remove Last Item Row Button (Above Table)
    const removeItemRowBtnAbove = document.getElementById('remove-item-row-above');
    if (removeItemRowBtnAbove) {
        removeItemRowBtnAbove.addEventListener('click', removeLastItemRow);
    }

    // Add Colli Row Button (Above Table)
    const addColliRowBtnAbove = document.getElementById('add-colli-row-above');
    if (addColliRowBtnAbove) {
        addColliRowBtnAbove.addEventListener('click', () => createColliRow());
    }

    // Remove Last Colli Row Button (Above Table)
    const removeColliRowBtnAbove = document.getElementById('remove-colli-row-above');
    if (removeColliRowBtnAbove) {
        removeColliRowBtnAbove.addEventListener('click', removeLastColliRow);
    }

    addDefaultItemRows();
    await addDefaultColliRows(); 
    
    updateTotalValue();
    updateTotalWeight();

    const currencySelect = document.getElementById('inv-currency');
    if (currencySelect) {
        const updateCurrencyDisplay = () => {
            const selectedCurrency = currencySelect.value || ''; 
            const itemValueDisplay = document.getElementById('display-currency-item-value');
            const totalValueDisplay = document.getElementById('display-currency-total-value'); 
            
            if(itemValueDisplay) itemValueDisplay.textContent = selectedCurrency;
            if(totalValueDisplay) totalValueDisplay.textContent = selectedCurrency;
        };
        currencySelect.removeEventListener('change', updateCurrencyDisplay); 
        currencySelect.addEventListener('change', updateCurrencyDisplay);
        updateCurrencyDisplay(); 
    }
}


// --- Functions to get form data for saving/PDF generation ---
function getGeneralFormData() {
    const form = document.getElementById('general-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.selectedStatements = [];
    const statementCheckboxes = form.querySelectorAll('input[name="statements"]:checked');
    statementCheckboxes.forEach(checkbox => {
        data.selectedStatements.push(checkbox.value);
    });
    delete data.statements; 

    const fromSelect = document.getElementById('inv-from');
    data.fromEntityName = fromSelect.options[fromSelect.selectedIndex]?.text.replace('-- Select From Entity --','').trim();
    const toSelect = document.getElementById('inv-to');
    data.toEntityName = toSelect.options[toSelect.selectedIndex]?.text.replace('-- Select To Entity --','').trim();
    
    // Use centralized signee utility
    data.signedByName = getSelectedSigneeName('inv-signed-by');

    return data;
}

function getItemsTableData() {
    const items = [];
    const itemsTableBody = document.getElementById('items-table-body');
    itemsTableBody.querySelectorAll('tr').forEach(row => {
        const qtyInput = row.querySelector('input[name="item-qty"]');
        // Only add if there's actual data in the row (e.g., PN or Description is filled)
        const pnInput = row.querySelector('input[name="item-pn"]').value.trim();
        const descInput = row.querySelector('input[name="item-description"]').value.trim();

        if (pnInput || descInput || (qtyInput && qtyInput.value.trim())) { // Add if PN, Description, or Qty has content
            const item = {
                qty: qtyInput ? qtyInput.value : '',
                uom: row.querySelector('input[name="item-uom"]').value,
                pn: pnInput,
                sn: row.querySelector('input[name="item-sn"]').value.trim(),
                description: descInput,
                origin: row.querySelector('input[name="item-origin"]').value.trim(),
                value: row.querySelector('input[name="item-value"]').value
            };
            items.push(item);
        }
    });
    return items;
}

function getColliTableData() {
    const collis = [];
    const colliTableBody = document.getElementById('colli-table-body');
    colliTableBody.querySelectorAll('tr').forEach(row => {
        const packingSelect = row.querySelector('select[name="colli-packing"]');
        const lengthInput = row.querySelector('input[name="colli-length"]').value.trim();
        
        // Add if packing type is selected or length is specified (or other key field)
        if ((packingSelect && packingSelect.value) || lengthInput) { 
            const templateSelect = row.querySelector('select[name="colli-template"]');
            const colli = {
                packing: packingSelect ? packingSelect.value : '',
                length: lengthInput,
                width: row.querySelector('input[name="colli-width"]').value.trim(),
                height: row.querySelector('input[name="colli-height"]').value.trim(),
                weight: row.querySelector('input[name="colli-weight"]').value.trim(),
                templateId: templateSelect ? templateSelect.value : '',
                templateName: templateSelect ? (templateSelect.options[templateSelect.selectedIndex]?.text.replace('-- Select Template --','').trim()) : ''
            };
            collis.push(colli);
        }
    });
    return collis;
}

// --- Function to populate form from loaded data (will be used by load-invoice.js) ---
async function populateFormWithLoadedData(invoiceData) {
    document.getElementById('inv-date').value = invoiceData.general.date || new Date().toISOString().split('T')[0];
    document.getElementById('inv-from').value = invoiceData.general.from || '';
    document.getElementById('inv-to').value = invoiceData.general.to || '';
    document.getElementById('inv-priority').value = invoiceData.general.priority || 'Routine';
    document.getElementById('inv-incoterms').value = invoiceData.general.incoterms || '';
    document.getElementById('inv-currency').value = invoiceData.general.currency || '';
    document.getElementById('inv-commodity-code').value = invoiceData.general.commodityCode || '';
    document.getElementById('inv-location').value = invoiceData.general.location || '';
    document.getElementById('inv-shipment-ref').value = invoiceData.general.shipmentRef || '';
    document.getElementById('inv-signed-by').value = invoiceData.general.signedBy || '';
    
    // Handle the invoice type field
    if (invoiceData.general.invoiceType) {
        document.getElementById('inv-invoice-type').value = invoiceData.general.invoiceType;
    } else {
        document.getElementById('inv-invoice-type').value = 'Proforma Invoice'; // Default if not present
    }
    
    document.getElementById('inv-currency').dispatchEvent(new Event('change'));

    const statementsContainer = document.getElementById('inv-statements-list');
    statementsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    if (invoiceData.general.selectedStatements && Array.isArray(invoiceData.general.selectedStatements)) {
        invoiceData.general.selectedStatements.forEach(stmtText => {
            // Escape quotes for attribute selector
            const escapedStmtText = stmtText.replace(/"/g, '\\"');
            const checkbox = statementsContainer.querySelector(`input[value="${escapedStmtText}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    const itemsTableBody = document.getElementById('items-table-body');
    itemsTableBody.innerHTML = ''; 
    itemLineCounter = 0;
    if (invoiceData.items && invoiceData.items.length > 0) {
        invoiceData.items.forEach(item => createItemRow(item));
    }
    if (itemsTableBody.rows.length < MIN_ITEM_ROWS) { // Ensure at least one row if loaded data is empty
        for(let i = itemsTableBody.rows.length; i < MIN_ITEM_ROWS; i++) {
            createItemRow();
        }
    }
    updateTotalValue(); 

    const colliTableBody = document.getElementById('colli-table-body');
    colliTableBody.innerHTML = ''; 
    colliLineCounter = 0;
    if (invoiceData.collis && invoiceData.collis.length > 0) {
        for (const colli of invoiceData.collis) { 
            await createColliRow(colli);
        }
    }
    if (colliTableBody.rows.length < MIN_COLLI_ROWS) { // Ensure at least one row
         for(let i = colliTableBody.rows.length; i < MIN_COLLI_ROWS; i++) {
            await createColliRow();
        }
    }
    updateTotalWeight(); 
}