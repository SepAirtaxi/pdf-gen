// js/settings.js

const settingsModalArea = document.getElementById('settings-modal-area');
let currentEditingEntityId = null;
let currentEditingSigneeId = null;
let currentEditingPackingTemplateId = null;

// For Simple Settings Modals
let _currentSimpleSettingsCollection = '';
let _currentEditingSimpleSettingId = null;
let _currentSimpleSettingFieldsConfig = null; 
let _currentSimpleSettingListRefreshCallback = null;
let _currentSimpleSettingDropdownRefreshCallback = null;

// Constants for Firestore collections (can be shared with other JS files if needed)
const COMPANY_SETTINGS_COLLECTION = 'appSettings'; // Collection for company details
const COMPANY_DETAILS_DOC_ID = 'mainCompanyDetails'; // Fixed ID for the single company doc
const ENTITIES_COLLECTION = 'entities';
const CURRENCIES_COLLECTION = 'currencies';
const COMMODITY_CODES_COLLECTION = 'commodityCodes';
const INCOTERMS_COLLECTION = 'incoterms';
const STATEMENTS_COLLECTION = 'statements';
const PACKING_TYPES_COLLECTION = 'packingTypes';
const PACKING_TEMPLATES_COLLECTION = 'packingTemplates';
const SIGNEES_COLLECTION = 'signees';


// --- Utility to create and show a modal ---
function createModal(title, contentHtml, onSave = null, onCancel = null, modalId = 'settings-generic-modal', closeOnly = false) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    let buttonsHtml = '';
    if (closeOnly) {
        buttonsHtml = `<button class="button" onclick="closeModal('${modalId}')">Close</button>`;
    } else {
        buttonsHtml = `
            <button id="${modalId}-save-btn" class="button primary-button">Save</button>
            <button class="button" onclick="closeModal('${modalId}')">Cancel</button>
        `;
    }

    const modalHTML = `
        <div id="${modalId}" class="modal">
            <div class="modal-content">
                <span class="close-button" onclick="closeModal('${modalId}')">×</span>
                <h2>${title}</h2>
                ${contentHtml}
                <div class="modal-actions">
                    ${buttonsHtml}
                </div>
            </div>
        </div>
    `;
    settingsModalArea.innerHTML = modalHTML;
    
    const modalElement = document.getElementById(modalId);
    modalElement.style.display = 'block';

    if (!closeOnly) {
        const saveButton = document.getElementById(`${modalId}-save-btn`);
        if (onSave) {
            saveButton.onclick = () => {
                onSave(); 
            };
        }
    }
}

function closeModal(modalId = 'settings-generic-modal') {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.style.display = 'none';
        modalElement.remove();
    }
    currentEditingEntityId = null; 
    currentEditingSigneeId = null;
    currentEditingPackingTemplateId = null;

    _currentSimpleSettingsCollection = '';
    _currentEditingSimpleSettingId = null;
    _currentSimpleSettingFieldsConfig = null;
    _currentSimpleSettingListRefreshCallback = null;
    _currentSimpleSettingDropdownRefreshCallback = null;
}

// --- Populate Dropdowns ---
async function populateSelectWithOptions(selectElementId, collectionName, valueField, displayField, defaultOptionText = "Select an option") {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        return;
    }

    const currentValue = selectElement.value; 
    selectElement.innerHTML = `<option value="">-- ${defaultOptionText} --</option>`; 
    
    try {
        const items = await getAllDocs(collectionName); // Assumes getAllDocs is in db.js
        items.sort((a, b) => {
            const valA = String(a[displayField] || '').toLowerCase();
            const valB = String(b[displayField] || '').toLowerCase();
            return valA.localeCompare(valB);
        });
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField] || item.id; 
            option.textContent = item[displayField];
            selectElement.appendChild(option);
        });
        if (items.find(item => (item[valueField] || item.id) === currentValue)) {
            selectElement.value = currentValue;
        }
    } catch (error) {
        console.error(`Error populating select ${selectElementId}:`, error);
    }
}


// ===== COMPANY DETAILS MANAGEMENT (SINGLE DOCUMENT) =====
async function openManageCompanyDetailsModal() {
    let companyData = { companyName: '', address1: '', address2: '', zipCode: '', city: '', country: '', vatNumber: '', easaApproval: '', email: '', phone: '', website: '', logoBase64: '' };
    // getDocById is from db.js
    const doc = await getDocById(COMPANY_SETTINGS_COLLECTION, COMPANY_DETAILS_DOC_ID);
    if (doc) companyData = { ...companyData, ...doc };

    const formHtml = `
        <div id="company-details-form">
            <div><label for="cd-companyName">Company Name:</label><input type="text" id="cd-companyName" value="${companyData.companyName || ''}" required></div>
            <div><label for="cd-address1">Address 1:</label><input type="text" id="cd-address1" value="${companyData.address1 || ''}"></div>
            <div><label for="cd-address2">Address 2:</label><input type="text" id="cd-address2" value="${companyData.address2 || ''}"></div>
            <div><label for="cd-zipCode">ZIP Code:</label><input type="text" id="cd-zipCode" value="${companyData.zipCode || ''}"></div>
            <div><label for="cd-city">City:</label><input type="text" id="cd-city" value="${companyData.city || ''}"></div>
            <div><label for="cd-country">Country:</label><input type="text" id="cd-country" value="${companyData.country || ''}"></div>
            <div><label for="cd-vatNumber">VAT Number:</label><input type="text" id="cd-vatNumber" value="${companyData.vatNumber || ''}"></div>
            <div><label for="cd-easaApproval">EASA Approval:</label><input type="text" id="cd-easaApproval" value="${companyData.easaApproval || ''}"></div>
            <div><label for="cd-email">Email:</label><input type="email" id="cd-email" value="${companyData.email || ''}"></div>
            <div><label for="cd-phone">Phone:</label><input type="tel" id="cd-phone" value="${companyData.phone || ''}"></div>
            <div><label for="cd-website">Website:</label><input type="text" id="cd-website" value="${companyData.website || ''}"></div>
            <div><label for="cd-logo-file">Logo (PNG, small):</label><input type="file" id="cd-logo-file" accept="image/png"></div>
            <div id="cd-logo-preview-container" style="margin-top:10px; margin-left: 210px;"> <!-- Aligned with inputs -->
                ${companyData.logoBase64 ? `Current Logo: <img id="cd-logo-preview-img" src="${companyData.logoBase64}" alt="Logo Preview" style="max-height: 60px; display: block; margin-top: 5px; border: 1px solid #ddd;">` : '<span id="cd-logo-preview-img">No logo uploaded.</span>'}
            </div>
             <small style="margin-left: 210px; display: block;">Upload a new logo (PNG, max 500KB) to replace the existing one.</small>
        </div>
    `;
    createModal('Manage Company Details', formHtml, saveCompanyDetails, null, 'manage-company-details-modal');
    
    const logoFileInput = document.getElementById('cd-logo-file');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file && file.type === "image/png") {
                if (file.size > 500000) { // Approx 500KB
                    alert("Logo file is too large. Please choose a file smaller than 500KB.");
                    event.target.value = ""; // Clear the input
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewContainer = document.getElementById('cd-logo-preview-container');
                    let imgElement = document.getElementById('cd-logo-preview-img');
                    if (!imgElement || imgElement.tagName !== 'IMG') {
                        previewContainer.innerHTML = 'New Logo Preview: <img id="cd-logo-preview-img" src="" alt="Logo Preview" style="max-height: 60px; display: block; margin-top: 5px; border: 1px solid #ddd;">';
                        imgElement = document.getElementById('cd-logo-preview-img');
                    }
                    imgElement.src = e.target.result;
                }
                reader.readAsDataURL(file);
            } else if (file) {
                alert("Please select a PNG file for the logo.");
                event.target.value = "";
            }
        });
    }
}

async function saveCompanyDetails() {
    const companyData = {
        companyName: document.getElementById('cd-companyName').value.trim(),
        address1: document.getElementById('cd-address1').value.trim(),
        address2: document.getElementById('cd-address2').value.trim(),
        zipCode: document.getElementById('cd-zipCode').value.trim(),
        city: document.getElementById('cd-city').value.trim(),
        country: document.getElementById('cd-country').value.trim(),
        vatNumber: document.getElementById('cd-vatNumber').value.trim(),
        easaApproval: document.getElementById('cd-easaApproval').value.trim(),
        email: document.getElementById('cd-email').value.trim(),
        phone: document.getElementById('cd-phone').value.trim(),
        website: document.getElementById('cd-website').value.trim(),
        // logoBase64 will be handled below
    };
    const logoFile = document.getElementById('cd-logo-file').files[0];

    if (!companyData.companyName) {
        alert('Company Name is required.');
        return;
    }

    try {
        const existingDetails = await getDocById(COMPANY_SETTINGS_COLLECTION, COMPANY_DETAILS_DOC_ID);
        if (existingDetails && existingDetails.logoBase64 && !logoFile) {
            companyData.logoBase64 = existingDetails.logoBase64;
        }

        if (logoFile) {
            // Validation already done in event listener, but can double check type/size
            companyData.logoBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(logoFile);
            });
        } else if (!companyData.logoBase64 && existingDetails && !existingDetails.logoBase64) {
            // If no new file and no existing logo, ensure it's null or empty string
            companyData.logoBase64 = ''; 
        }
        
        await db.collection(COMPANY_SETTINGS_COLLECTION).doc(COMPANY_DETAILS_DOC_ID).set(companyData, { merge: true });
        alert('Company details saved successfully!');
        closeModal('manage-company-details-modal');
    } catch (error) {
        console.error("Error saving company details:", error);
        alert(`Error saving company details: ${error.message}`);
    }
}


// ===== ENTITY MANAGEMENT =====
async function openManageEntitiesModal() {
    currentEditingEntityId = null; 
    const entities = await getAllDocs(ENTITIES_COLLECTION);
    let entitiesListHtml = '<ul class="settings-list">';
    entities.sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(entity => {
        entitiesListHtml += `<li><span>${entity.name} (${entity.companyName || 'N/A'})</span><span class="actions"><button class="button" onclick="openAddEditEntityModal('${entity.id}')">Edit</button><button class="action-button" onclick="deleteEntity('${entity.id}')">Remove</button></span></li>`;
    });
    entitiesListHtml += '</ul>';
    createModal('Manage Entities', `${entitiesListHtml}<button class="button" onclick="openAddEditEntityModal()">Add New Entity</button>`, null, null, 'manage-entities-modal', true);
}
async function openAddEditEntityModal(entityId = null) {
    currentEditingEntityId = entityId;
    let entityData = { name: '', companyName: '', co: '', address1: '', address2: '', zipCode: '', city: '', stateArea: '', country: '', vatEori: '', email: '', phone: '' };
    if (entityId) {
        const doc = await getDocById(ENTITIES_COLLECTION, entityId);
        if (doc) entityData = {...entityData, ...doc};
    }
    const formHtml = `<div id="entity-form">
        <div><label for="entity-name">Name (for app list):</label><input type="text" id="entity-name" value="${entityData.name}" required></div>
        <div><label for="entity-companyName">Company Name (for PDF):</label><input type="text" id="entity-companyName" value="${entityData.companyName}" required></div>
        <div><label for="entity-co">C/O:</label><input type="text" id="entity-co" value="${entityData.co}"></div>
        <div><label for="entity-address1">Address 1:</label><input type="text" id="entity-address1" value="${entityData.address1}" required></div>
        <div><label for="entity-address2">Address 2:</label><input type="text" id="entity-address2" value="${entityData.address2}"></div>
        <div><label for="entity-zipCode">ZIP Code:</label><input type="text" id="entity-zipCode" value="${entityData.zipCode}" required></div>
        <div><label for="entity-city">City:</label><input type="text" id="entity-city" value="${entityData.city}" required></div>
        <div><label for="entity-stateArea">State/Area:</label><input type="text" id="entity-stateArea" value="${entityData.stateArea}"></div>
        <div><label for="entity-country">Country:</label><input type="text" id="entity-country" value="${entityData.country}" required></div>
        <div><label for="entity-vatEori">VAT/EORI:</label><input type="text" id="entity-vatEori" value="${entityData.vatEori}"></div>
        <div><label for="entity-email">Email:</label><input type="email" id="entity-email" value="${entityData.email}"></div>
        <div><label for="entity-phone">Phone:</label><input type="tel" id="entity-phone" value="${entityData.phone}"></div>
    </div>`;
    createModal(entityId ? 'Edit Entity' : 'Add New Entity', formHtml, saveEntity, null, 'add-edit-entity-modal');
}
async function saveEntity() {
    const entityData = {
        name: document.getElementById('entity-name').value.trim(), companyName: document.getElementById('entity-companyName').value.trim(),
        co: document.getElementById('entity-co').value.trim(), address1: document.getElementById('entity-address1').value.trim(),
        address2: document.getElementById('entity-address2').value.trim(), zipCode: document.getElementById('entity-zipCode').value.trim(),
        city: document.getElementById('entity-city').value.trim(), stateArea: document.getElementById('entity-stateArea').value.trim(),
        country: document.getElementById('entity-country').value.trim(), vatEori: document.getElementById('entity-vatEori').value.trim(),
        email: document.getElementById('entity-email').value.trim(), phone: document.getElementById('entity-phone').value.trim(),
    };
    if (!entityData.name || !entityData.companyName || !entityData.address1 || !entityData.zipCode || !entityData.city || !entityData.country) {
        alert('Please fill in all required fields for the entity.'); return;
    }
    try {
        if (currentEditingEntityId) await updateDoc(ENTITIES_COLLECTION, currentEditingEntityId, entityData);
        else await addDoc(ENTITIES_COLLECTION, entityData);
        alert(`Entity ${currentEditingEntityId ? 'updated' : 'added'} successfully!`);
        closeModal('add-edit-entity-modal'); openManageEntitiesModal(); populateEntityDropdowns();
    } catch (error) { console.error("Error saving entity:", error); alert(`Error saving entity: ${error.message}`);}
}
async function deleteEntity(entityId) {
    if (confirm('Are you sure you want to delete this entity?')) {
        try { await deleteDoc(ENTITIES_COLLECTION, entityId); alert('Entity deleted successfully!'); openManageEntitiesModal(); populateEntityDropdowns();
        } catch (error) { console.error("Error deleting entity:", error); alert(`Error deleting entity: ${error.message}`);}
    }
}
function populateEntityDropdowns() {
    populateSelectWithOptions('inv-from', ENTITIES_COLLECTION, 'id', 'name', 'Select From Entity');
    populateSelectWithOptions('inv-to', ENTITIES_COLLECTION, 'id', 'name', 'Select To Entity');
}


// ===== GENERIC SIMPLE SETTINGS (CURRENCIES, COMMODITY CODES, etc.) =====
async function openAddEditSimpleSettingModal(collectionName, itemId = null, itemTypeName = 'Item', fieldsConfig = [], listRefreshCallback = null, dropdownRefreshCallback = null) {
    _currentSimpleSettingsCollection = collectionName; _currentEditingSimpleSettingId = itemId;
    _currentSimpleSettingFieldsConfig = fieldsConfig; _currentSimpleSettingListRefreshCallback = listRefreshCallback;
    _currentSimpleSettingDropdownRefreshCallback = dropdownRefreshCallback;
    let itemDataForForm = {};
    if (itemId) { const doc = await getDocById(collectionName, itemId); if (doc) itemDataForForm = doc; }
    const populatedFieldsConfig = fieldsConfig.map(fc => ({ ...fc, value: itemDataForForm[fc.field] || fc.value || '' }));
    let formHtml = `<div id="simple-setting-form">`;
    populatedFieldsConfig.forEach(fc => {
        const inputType = fc.type === 'textarea' ? 'textarea' : 'text'; const requiredAttr = fc.required ? 'required' : '';
        const displayValue = String(fc.value || '').replace(/"/g, '"');
        if (inputType === 'textarea') formHtml += `<div><label for="${fc.id}">${fc.label}:</label><textarea id="${fc.id}" ${requiredAttr}>${displayValue}</textarea></div>`;
        else formHtml += `<div><label for="${fc.id}">${fc.label}:</label><input type="${inputType}" id="${fc.id}" value="${displayValue}" ${requiredAttr}></div>`;
    });
    formHtml += `</div>`;
    createModal(itemId ? `Edit ${itemTypeName}` : `Add New ${itemTypeName}`, formHtml, saveSimpleSetting, null, 'add-edit-simple-setting-modal');
}
async function saveSimpleSetting() {
    if (!_currentSimpleSettingFieldsConfig || !_currentSimpleSettingsCollection) { console.error("Cannot save simple setting: Config missing."); alert("Error: Could not save."); return; }
    const dataToSave = {}; let allRequiredFilled = true; let firstInvalidField = null;
    _currentSimpleSettingFieldsConfig.forEach(fc => {
        const inputElement = document.getElementById(fc.id);
        if (inputElement) {
            const value = inputElement.value.trim(); dataToSave[fc.field] = value;
            if (fc.required && !value) { allRequiredFilled = false; if (!firstInvalidField) firstInvalidField = inputElement; }
        } else console.warn(`Input element ${fc.id} not found for field ${fc.field}.`);
    });
    if (!allRequiredFilled) {
        const itemTypeNameGuess = document.querySelector('#add-edit-simple-setting-modal h2')?.textContent.replace(/Edit |Add New /g, '') || 'Item';
        alert(`Please fill in all required fields for the ${itemTypeNameGuess}.`); if (firstInvalidField) firstInvalidField.focus(); return;
    }
    try {
        if (_currentEditingSimpleSettingId) await updateDoc(_currentSimpleSettingsCollection, _currentEditingSimpleSettingId, dataToSave);
        else await addDoc(_currentSimpleSettingsCollection, dataToSave);
        alert('Item saved successfully!');
        const modalToClose = 'add-edit-simple-setting-modal';
        const listRefreshCb = _currentSimpleSettingListRefreshCallback; const dropdownRefreshCb = _currentSimpleSettingDropdownRefreshCallback;
        closeModal(modalToClose);
        if (dropdownRefreshCb) dropdownRefreshCb(); if (listRefreshCb) listRefreshCb();
    } catch (error) { console.error("Error saving item:", error); alert(`Error saving item: ${error.message}`);}
}
async function deleteSimpleSetting(collectionName, itemId, itemTypeName = 'Item', listRefreshCallback = null, dropdownRefreshCallback = null) {
    if (confirm(`Are you sure you want to delete this ${itemTypeName}?`)) {
        try { await deleteDoc(collectionName, itemId); alert(`${itemTypeName} deleted successfully!`); if (dropdownRefreshCallback) dropdownRefreshCallback(); if (listRefreshCallback) listRefreshCallback();
        } catch (error) { console.error(`Error deleting ${itemTypeName}:`, error); alert(`Error deleting: ${error.message}`);}
    }
}

// Specific implementations for each simple setting type:
async function openManageCurrenciesModal() {
    const items = await getAllDocs(CURRENCIES_COLLECTION); let listHtml = '<ul class="settings-list">';
    items.sort((a,b) => (a.code||'').localeCompare(b.code||'')).forEach(item => { listHtml += `<li><span>${item.code || 'N/A'} ${item.name ? '('+item.name+')' : ''}</span><span class="actions"><button class="button" onclick="openAddEditSimpleSettingModal('${CURRENCIES_COLLECTION}', '${item.id}', 'Currency', [{label: 'Code (e.g., USD)', id: 'currency-code', field: 'code', required: true}, {label: 'Name (e.g., US Dollar)', id: 'currency-name', field: 'name'}], openManageCurrenciesModal, populateCurrenciesDropdown)">Edit</button><button class="action-button" onclick="deleteSimpleSetting('${CURRENCIES_COLLECTION}', '${item.id}', 'Currency', openManageCurrenciesModal, populateCurrenciesDropdown)">Remove</button></span></li>`; });
    listHtml += '</ul>'; createModal('Manage Currencies', `${listHtml}<button class="button" onclick="openAddEditSimpleSettingModal('${CURRENCIES_COLLECTION}', null, 'Currency', [{label: 'Code (e.g., USD)', id: 'currency-code', field: 'code', required: true}, {label: 'Name (e.g., US Dollar)', id: 'currency-name', field: 'name'}], openManageCurrenciesModal, populateCurrenciesDropdown)">Add New Currency</button>`, null, null, 'manage-currencies-modal', true);
}
function populateCurrenciesDropdown() {
    populateSelectWithOptions('inv-currency', CURRENCIES_COLLECTION, 'code', 'code', 'Select Currency');
    const currencySelect = document.getElementById('inv-currency');
    if (currencySelect) {
        const updateCurrencyDisplay = () => {
            const selectedCurrency = currencySelect.value || 'USD';
            const itemValueDisplay = document.getElementById('display-currency-item-value');
            const totalValueDisplay = document.getElementById('display-currency-total-value');
            if(itemValueDisplay) itemValueDisplay.textContent = selectedCurrency;
            if(totalValueDisplay) totalValueDisplay.textContent = selectedCurrency;
        };
        currencySelect.removeEventListener('change', updateCurrencyDisplay); currencySelect.addEventListener('change', updateCurrencyDisplay); updateCurrencyDisplay();
    }
}
async function openManageCommodityCodesModal() {
    const items = await getAllDocs(COMMODITY_CODES_COLLECTION); let listHtml = '<ul class="settings-list">';
    items.sort((a,b) => (a.code||'').localeCompare(b.code||'')).forEach(item => { listHtml += `<li><span>${item.code || 'N/A'} ${item.description ? '('+item.description+')' : ''}</span><span class="actions"><button class="button" onclick="openAddEditSimpleSettingModal('${COMMODITY_CODES_COLLECTION}', '${item.id}', 'Commodity Code', [{label: 'Code', id: 'cc-code', field: 'code', required: true}, {label: 'Description (Optional)', id: 'cc-description', field: 'description'}], openManageCommodityCodesModal, populateCommodityCodesDropdown)">Edit</button><button class="action-button" onclick="deleteSimpleSetting('${COMMODITY_CODES_COLLECTION}', '${item.id}', 'Commodity Code', openManageCommodityCodesModal, populateCommodityCodesDropdown)">Remove</button></span></li>`; });
    listHtml += '</ul>'; createModal('Manage Commodity Codes', `${listHtml}<button class="button" onclick="openAddEditSimpleSettingModal('${COMMODITY_CODES_COLLECTION}', null, 'Commodity Code', [{label: 'Code', id: 'cc-code', field: 'code', required: true}, {label: 'Description (Optional)', id: 'cc-description', field: 'description'}], openManageCommodityCodesModal, populateCommodityCodesDropdown)">Add New</button>`, null, null, 'manage-commodity-codes-modal', true);
}
function populateCommodityCodesDropdown() { 
    // Updated to show code plus description
    const selectElement = document.getElementById('inv-commodity-code');
    if (!selectElement) return;
    
    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">-- Select Commodity Code --</option>`;
    
    try {
        getAllDocs(COMMODITY_CODES_COLLECTION).then(items => {
            items.sort((a,b) => (a.code||'').localeCompare(b.code||'')).forEach(item => {
                const option = document.createElement('option');
                option.value = item.code;
                // Display both code and description in the dropdown
                option.textContent = item.description ? `${item.code} - ${item.description}` : item.code;
                selectElement.appendChild(option);
            });
            
            if (currentValue) {
                selectElement.value = currentValue;
            }
        });
    } catch (error) {
        console.error("Error populating commodity codes dropdown:", error);
    }
}
async function openManageIncotermsModal() {
    const items = await getAllDocs(INCOTERMS_COLLECTION); let listHtml = '<ul class="settings-list">';
    items.sort((a,b) => (a.term||'').localeCompare(b.term||'')).forEach(item => { listHtml += `<li><span>${item.term || 'N/A'} ${item.description ? '('+item.description+')' : ''}</span><span class="actions"><button class="button" onclick="openAddEditSimpleSettingModal('${INCOTERMS_COLLECTION}', '${item.id}', 'Incoterm', [{label: 'Term (e.g., DDP)', id: 'inco-term', field: 'term', required: true}, {label: 'Description (Optional)', id: 'inco-description', field: 'description'}], openManageIncotermsModal, populateIncotermsDropdown)">Edit</button><button class="action-button" onclick="deleteSimpleSetting('${INCOTERMS_COLLECTION}', '${item.id}', 'Incoterm', openManageIncotermsModal, populateIncotermsDropdown)">Remove</button></span></li>`; });
    listHtml += '</ul>'; createModal('Manage Incoterms', `${listHtml}<button class="button" onclick="openAddEditSimpleSettingModal('${INCOTERMS_COLLECTION}', null, 'Incoterm', [{label: 'Term (e.g., DDP)', id: 'inco-term', field: 'term', required: true}, {label: 'Description (Optional)', id: 'inco-description', field: 'description'}], openManageIncotermsModal, populateIncotermsDropdown)">Add New</button>`, null, null, 'manage-incoterms-modal', true);
}
function populateIncotermsDropdown() { populateSelectWithOptions('inv-incoterms', INCOTERMS_COLLECTION, 'term', 'term', 'Select Incoterm');}
async function openManageStatementsModal() {
    const items = await getAllDocs(STATEMENTS_COLLECTION); let listHtml = '<ul class="settings-list">';
    items.sort((a,b) => (a.statementText||'').localeCompare(b.statementText||'')).forEach(item => { listHtml += `<li><span style="white-space: pre-wrap; word-break: break-word;">${item.statementText || 'N/A'}</span><span class="actions"><button class="button" onclick="openAddEditSimpleSettingModal('${STATEMENTS_COLLECTION}', '${item.id}', 'Statement', [{label: 'Statement Text', id: 'stmt-text', field: 'statementText', type: 'textarea', required: true}], openManageStatementsModal, populateStatementsList)">Edit</button><button class="action-button" onclick="deleteSimpleSetting('${STATEMENTS_COLLECTION}', '${item.id}', 'Statement', openManageStatementsModal, populateStatementsList)">Remove</button></span></li>`; });
    listHtml += '</ul>'; createModal('Manage Statements', `${listHtml}<button class="button" onclick="openAddEditSimpleSettingModal('${STATEMENTS_COLLECTION}', null, 'Statement', [{label: 'Statement Text', id: 'stmt-text', field: 'statementText', type: 'textarea', required: true}], openManageStatementsModal, populateStatementsList)">Add New</button>`, null, null, 'manage-statements-modal', true);
}
async function populateStatementsList() {
    const statementsListDiv = document.getElementById('inv-statements-list'); if (!statementsListDiv) return; statementsListDiv.innerHTML = ''; 
    const statements = await getAllDocs(STATEMENTS_COLLECTION);
    statements.sort((a,b) => (a.statementText||'').localeCompare(b.statementText||'')).forEach(stmt => {
        const div = document.createElement('div'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `stmt-${stmt.id}`; checkbox.name = 'statements'; checkbox.value = stmt.statementText; 
        const label = document.createElement('label'); label.htmlFor = `stmt-${stmt.id}`; label.textContent = stmt.statementText; 
        div.appendChild(checkbox); div.appendChild(label); statementsListDiv.appendChild(div);
    });
}
async function openManagePackingTypesModal() {
    const items = await getAllDocs(PACKING_TYPES_COLLECTION); let listHtml = '<ul class="settings-list">';
    items.sort((a,b) => (a.typeName||'').localeCompare(b.typeName||'')).forEach(item => { listHtml += `<li><span>${item.typeName || 'N/A'}</span><span class="actions"><button class="button" onclick="openAddEditSimpleSettingModal('${PACKING_TYPES_COLLECTION}', '${item.id}', 'Packing Type', [{label: 'Type Name', id: 'pt-name', field: 'typeName', required: true}], openManagePackingTypesModal, populatePackingTypeDropdownsForTemplates)">Edit</button><button class="action-button" onclick="deleteSimpleSetting('${PACKING_TYPES_COLLECTION}', '${item.id}', 'Packing Type', openManagePackingTypesModal, populatePackingTypeDropdownsForTemplates)">Remove</button></span></li>`; });
    listHtml += '</ul>'; createModal('Manage Packing Types', `${listHtml}<button class="button" onclick="openAddEditSimpleSettingModal('${PACKING_TYPES_COLLECTION}', null, 'Packing Type', [{label: 'Type Name', id: 'pt-name', field: 'typeName', required: true}], openManagePackingTypesModal, populatePackingTypeDropdownsForTemplates)">Add New</button>`, null, null, 'manage-packing-types-modal', true);
}
function populatePackingTypeDropdownsForTemplates() { populateSelectWithOptions('template-packing-type', PACKING_TYPES_COLLECTION, 'typeName', 'typeName', 'Select Packing Type'); }


// ===== PACKING TEMPLATES MANAGEMENT =====
async function openManagePackingTemplatesModal() {
    currentEditingPackingTemplateId = null; const templates = await getAllDocs(PACKING_TEMPLATES_COLLECTION); let listHtml = '<ul class="settings-list">';
    templates.sort((a,b) => (a.templateName||'').localeCompare(b.templateName||'')).forEach(template => { listHtml += `<li><span>${template.templateName} (Packing: ${template.packingType || 'N/A'}, ${template.length || 0}x${template.width || 0}x${template.height || 0}cm, ${template.weight || 0}kg)</span><span class="actions"><button class="button" onclick="openAddEditPackingTemplateModal('${template.id}')">Edit</button><button class="action-button" onclick="deletePackingTemplate('${template.id}')">Remove</button></span></li>`; });
    listHtml += '</ul>'; createModal('Manage Packing Templates', `${listHtml}<button class="button" onclick="openAddEditPackingTemplateModal()">Add New Template</button>`, null, null, 'manage-packing-templates-modal', true);
}
async function openAddEditPackingTemplateModal(templateId = null) {
    currentEditingPackingTemplateId = templateId; let templateData = { templateName: '', packingType: '', length: '', width: '', height: '', weight: '' };
    if (templateId) { const doc = await getDocById(PACKING_TEMPLATES_COLLECTION, templateId); if (doc) templateData = {...templateData, ...doc}; }
    const formHtml = `<div id="packing-template-form">
        <div><label for="template-name">Template Name:</label><input type="text" id="template-name" value="${templateData.templateName}" required></div>
        <div><label for="template-packing-type">Packing Type:</label><select id="template-packing-type" required></select></div>
        <div><label for="template-length">Length (CM):</label><input type="number" id="template-length" value="${templateData.length}" step="any" required></div>
        <div><label for="template-width">Width (CM):</label><input type="number" id="template-width" value="${templateData.width}" step="any" required></div>
        <div><label for="template-height">Height (CM):</label><input type="number" id="template-height" value="${templateData.height}" step="any" required></div>
        <div><label for="template-weight">Weight (KG):</label><input type="number" id="template-weight" value="${templateData.weight}" step="any" required></div>
    </div>`;
    createModal(templateId ? 'Edit Packing Template' : 'Add New Template', formHtml, savePackingTemplate, null, 'add-edit-packing-template-modal');
    await populateSelectWithOptions('template-packing-type', PACKING_TYPES_COLLECTION, 'typeName', 'typeName', 'Select Packing Type');
    if(templateData.packingType) document.getElementById('template-packing-type').value = templateData.packingType;
}
async function savePackingTemplate() {
    const templateData = {
        templateName: document.getElementById('template-name').value.trim(), packingType: document.getElementById('template-packing-type').value,
        length: document.getElementById('template-length').value, width: document.getElementById('template-width').value,
        height: document.getElementById('template-height').value, weight: document.getElementById('template-weight').value,
    };
    if (!templateData.templateName || !templateData.packingType || templateData.length === '' || templateData.width === '' || templateData.height === '' || templateData.weight === '' ||
        isNaN(parseFloat(templateData.length)) || isNaN(parseFloat(templateData.width)) || isNaN(parseFloat(templateData.height)) || isNaN(parseFloat(templateData.weight))) {
        alert('Please fill all fields correctly with valid numbers.'); return;
    }
    try {
        if (currentEditingPackingTemplateId) await updateDoc(PACKING_TEMPLATES_COLLECTION, currentEditingPackingTemplateId, templateData);
        else await addDoc(PACKING_TEMPLATES_COLLECTION, templateData);
        alert('Packing template saved successfully!'); closeModal('add-edit-packing-template-modal'); openManagePackingTemplatesModal(); 
    } catch (error) { console.error("Error saving packing template:", error); alert(`Error: ${error.message}`);}
}
async function deletePackingTemplate(templateId) {
    if (confirm('Are you sure you want to delete this packing template?')) {
        try { await deleteDoc(PACKING_TEMPLATES_COLLECTION, templateId); alert('Template deleted!'); openManagePackingTemplatesModal(); 
        } catch (error) { console.error("Error deleting template:", error); alert(`Error: ${error.message}`);}
    }
}


// ===== SIGNEE MANAGEMENT (Base64) =====
async function openManageSigneesModal() {
    currentEditingSigneeId = null; const signees = await getAllDocs(SIGNEES_COLLECTION); let listHtml = '<ul class="settings-list">';
    signees.sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(signee => { listHtml += `<li><span>${signee.name || 'N/A'}</span>${signee.signatureBase64 ? `<img src="${signee.signatureBase64}" alt="Sig" style="max-height:30px;border:1px solid #eee;margin-left:10px;">` : '(No sig)'}<span class="actions"><button class="button" onclick="openAddEditSigneeModal('${signee.id}')">Edit</button><button class="action-button" onclick="deleteSignee('${signee.id}')">Remove</button></span></li>`; });
    listHtml += '</ul>'; createModal('Manage Signees', `${listHtml}<button class="button" onclick="openAddEditSigneeModal()">Add New Signee</button>`, null, null, 'manage-signees-modal', true);
}
async function openAddEditSigneeModal(signeeId = null) {
    currentEditingSigneeId = signeeId; let signeeData = { name: '', signatureBase64: '' }; 
    if (signeeId) { const doc = await getDocById(SIGNEES_COLLECTION, signeeId); if (doc) signeeData = {...signeeData, ...doc}; }
    const formHtml = `<div id="signee-form">
        <div><label for="signee-name">Signee Name:</label><input type="text" id="signee-name" value="${signeeData.name}" required></div>
        <div><label for="signee-signature-file">Signature (PNG):</label><input type="file" id="signee-signature-file" accept="image/png"></div>
        <div id="signature-preview-container" style="margin-top:10px; margin-left: 210px;">${signeeData.signatureBase64 ? `Current: <img id="signature-preview-img" src="${signeeData.signatureBase64}" alt="Sig" style="max-height:60px;border:1px solid #ddd;">` : '<span id="signature-preview-img">No signature.</span>'}</div>
        <small style="margin-left: 210px; display: block;">Upload new to replace. Small PNG (e.g., <100KB).</small>
    </div>`;
    createModal(signeeId ? 'Edit Signee' : 'Add New Signee', formHtml, saveSignee, null, 'add-edit-signee-modal');
    document.getElementById('signee-signature-file').addEventListener('change', function(event) {
        const file = event.target.files[0]; if (!file) return;
        if (file.type === "image/png") {
            if (file.size > 500000) { alert("Signature file too large (max 500KB)."); event.target.value = ""; return; }
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewContainer = document.getElementById('signature-preview-container');
                let imgEl = document.getElementById('signature-preview-img');
                if (!imgEl || imgEl.tagName !== 'IMG') { previewContainer.innerHTML = `New Preview: <img id="signature-preview-img" src="${e.target.result}" alt="Preview" style="max-height:60px;border:1px solid #ddd;">`;}
                else {imgEl.src = e.target.result;}
            }; reader.readAsDataURL(file);
        } else { alert("Please select a PNG file."); event.target.value = ""; }
    });
}
async function saveSignee() {
    const name = document.getElementById('signee-name').value.trim(); if (!name) { alert('Please enter signee name.'); return; }
    const signatureFile = document.getElementById('signee-signature-file').files[0];
    let signeeData = { name };
    if (currentEditingSigneeId) { const existing = await getDocById(SIGNEES_COLLECTION, currentEditingSigneeId); if (existing && existing.signatureBase64) signeeData.signatureBase64 = existing.signatureBase64; }
    try {
        if (signatureFile) {
            signeeData.signatureBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(signatureFile);
            });
        } else if (!signeeData.signatureBase64 && currentEditingSigneeId) { // If editing and no new file, and no old base64 was loaded (unlikely given above)
             const existing = await getDocById(SIGNEES_COLLECTION, currentEditingSigneeId);
             if (existing && !existing.signatureBase64) signeeData.signatureBase64 = ''; // Ensure it's explicitly empty if cleared
        } else if (!signeeData.signatureBase64 && !currentEditingSigneeId){ // New signee, no file, set to empty
            signeeData.signatureBase64 = '';
        }


        if (currentEditingSigneeId) await updateDoc(SIGNEES_COLLECTION, currentEditingSigneeId, signeeData);
        else await addDoc(SIGNEES_COLLECTION, signeeData);
        alert('Signee saved successfully!'); closeModal('add-edit-signee-modal'); openManageSigneesModal(); populateSigneesDropdown();
    } catch (error) { console.error("Error saving signee:", error); alert(`Error: ${error.message}`);}
}
async function deleteSignee(signeeId) {
    if (confirm('Are you sure you want to delete this signee?')) {
        try { await deleteDoc(SIGNEES_COLLECTION, signeeId); alert('Signee deleted!'); openManageSigneesModal(); populateSigneesDropdown();
        } catch (error) { console.error("Error deleting signee:", error); alert(`Error: ${error.message}`);}
    }
}
function populateSigneesDropdown() { populateSelectWithOptions('inv-signed-by', SIGNEES_COLLECTION, 'id', 'name', 'Select Signee'); }


// --- INITIALIZE SETTINGS ---
function initializeSettings() {
    document.getElementById('manage-company-details-btn').addEventListener('click', openManageCompanyDetailsModal);
    document.getElementById('manage-entities-btn').addEventListener('click', openManageEntitiesModal);
    document.getElementById('manage-currencies-btn').addEventListener('click', openManageCurrenciesModal);
    document.getElementById('manage-commodity-codes-btn').addEventListener('click', openManageCommodityCodesModal);
    document.getElementById('manage-incoterms-btn').addEventListener('click', openManageIncotermsModal);
    document.getElementById('manage-statements-btn').addEventListener('click', openManageStatementsModal);
    document.getElementById('manage-packing-types-btn').addEventListener('click', openManagePackingTypesModal);
    document.getElementById('manage-packing-templates-btn').addEventListener('click', openManagePackingTemplatesModal);
    document.getElementById('manage-signees-btn').addEventListener('click', openManageSigneesModal);

    populateEntityDropdowns();
    populateCurrenciesDropdown();
    populateCommodityCodesDropdown();
    populateIncotermsDropdown();
    populateStatementsList();
    populatePackingTypeDropdownsForTemplates();
    populateSigneesDropdown();
}