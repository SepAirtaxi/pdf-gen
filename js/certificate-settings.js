// js/certificate-settings.js

const certSettingsModalArea = document.getElementById('cert-settings-modal-area');
let currentEditingDisclaimerId = null;

// Constants for Firestore collections
const PRODUCT_DISCLAIMERS_COLLECTION = 'productDisclaimers';

// --- Utility to create and show a modal ---
function createCertModal(title, contentHtml, onSave = null, onCancel = null, modalId = 'cert-settings-generic-modal', closeOnly = false) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    let buttonsHtml = '';
    if (closeOnly) {
        buttonsHtml = `<button class="button" onclick="closeCertModal('${modalId}')">Close</button>`;
    } else {
        buttonsHtml = `
            <button id="${modalId}-save-btn" class="button primary-button">Save</button>
            <button class="button" onclick="closeCertModal('${modalId}')">Cancel</button>
        `;
    }

    const modalHTML = `
        <div id="${modalId}" class="modal">
            <div class="modal-content">
                <span class="close-button" onclick="closeCertModal('${modalId}')">×</span>
                <h2>${title}</h2>
                ${contentHtml}
                <div class="modal-actions">
                    ${buttonsHtml}
                </div>
            </div>
        </div>
    `;
    certSettingsModalArea.innerHTML = modalHTML;
    
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

function closeCertModal(modalId = 'cert-settings-generic-modal') {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.style.display = 'none';
        modalElement.remove();
    }
    currentEditingDisclaimerId = null;
}

// ===== PRODUCT DISCLAIMERS MANAGEMENT =====
async function openManageProductDisclaimersModal() {
    currentEditingDisclaimerId = null;
    const disclaimers = await getAllDocs(PRODUCT_DISCLAIMERS_COLLECTION);
    let disclaimersListHtml = '<ul class="settings-list">';
    disclaimers.sort((a,b) => (a.productType||'').localeCompare(b.productType||'')).forEach(disclaimer => {
        const truncatedText = disclaimer.disclaimerText ? 
            (disclaimer.disclaimerText.length > 100 ? disclaimer.disclaimerText.substring(0, 100) + '...' : disclaimer.disclaimerText) : 
            'No text';
        disclaimersListHtml += `<li><span><strong>${disclaimer.productType || 'N/A'}</strong><br><small>${truncatedText}</small></span><span class="actions"><button class="button" onclick="openAddEditProductDisclaimerModal('${disclaimer.id}')">Edit</button><button class="action-button" onclick="deleteProductDisclaimer('${disclaimer.id}')">Remove</button></span></li>`;
    });
    disclaimersListHtml += '</ul>';
    createCertModal('Manage Product Disclaimers', `${disclaimersListHtml}<button class="button" onclick="openAddEditProductDisclaimerModal()">Add New Product Disclaimer</button>`, null, null, 'manage-product-disclaimers-modal', true);
}

async function openAddEditProductDisclaimerModal(disclaimerId = null) {
    currentEditingDisclaimerId = disclaimerId;
    let disclaimerData = { productType: '', disclaimerText: '' };
    if (disclaimerId) {
        const doc = await getDocById(PRODUCT_DISCLAIMERS_COLLECTION, disclaimerId);
        if (doc) disclaimerData = {...disclaimerData, ...doc};
    }
    const formHtml = `<div id="disclaimer-form">
        <div><label for="disclaimer-product-type">Product Type:</label><input type="text" id="disclaimer-product-type" value="${disclaimerData.productType}" required placeholder="e.g., Aircraft Components"></div>
        <div><label for="disclaimer-text">Disclaimer Text:</label><textarea id="disclaimer-text" rows="6" required placeholder="Enter the disclaimer text that will appear on certificates...">${disclaimerData.disclaimerText}</textarea></div>
    </div>`;
    createCertModal(disclaimerId ? 'Edit Product Disclaimer' : 'Add New Product Disclaimer', formHtml, saveProductDisclaimer, null, 'add-edit-disclaimer-modal');
}

async function saveProductDisclaimer() {
    const disclaimerData = {
        productType: document.getElementById('disclaimer-product-type').value.trim(),
        disclaimerText: document.getElementById('disclaimer-text').value.trim()
    };
    if (!disclaimerData.productType || !disclaimerData.disclaimerText) {
        alert('Please fill in both Product Type and Disclaimer Text.');
        return;
    }
    try {
        if (currentEditingDisclaimerId) {
            await updateDoc(PRODUCT_DISCLAIMERS_COLLECTION, currentEditingDisclaimerId, disclaimerData);
        } else {
            await addDoc(PRODUCT_DISCLAIMERS_COLLECTION, disclaimerData);
        }
        alert(`Product disclaimer ${currentEditingDisclaimerId ? 'updated' : 'added'} successfully!`);
        closeCertModal('add-edit-disclaimer-modal');
        openManageProductDisclaimersModal();
        populateProductTypesDropdown();
    } catch (error) {
        console.error("Error saving product disclaimer:", error);
        alert(`Error saving product disclaimer: ${error.message}`);
    }
}

async function deleteProductDisclaimer(disclaimerId) {
    if (confirm('Are you sure you want to delete this product disclaimer?')) {
        try {
            await deleteDoc(PRODUCT_DISCLAIMERS_COLLECTION, disclaimerId);
            alert('Product disclaimer deleted successfully!');
            openManageProductDisclaimersModal();
            populateProductTypesDropdown();
        } catch (error) {
            console.error("Error deleting product disclaimer:", error);
            alert(`Error deleting product disclaimer: ${error.message}`);
        }
    }
}

function populateProductTypesDropdown() {
    const selectElement = document.getElementById('cert-product-type');
    if (!selectElement) return;

    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">-- Select Product Type --</option>`;

    getAllDocs(PRODUCT_DISCLAIMERS_COLLECTION).then(disclaimers => {
        disclaimers.sort((a,b) => (a.productType||'').localeCompare(b.productType||'')).forEach(disclaimer => {
            const option = document.createElement('option');
            option.value = disclaimer.id;
            option.textContent = disclaimer.productType;
            selectElement.appendChild(option);
        });

        if (currentValue) {
            selectElement.value = currentValue;
        }
    }).catch(error => {
        console.error("Error populating product types dropdown:", error);
    });
}

// --- INITIALIZE CERTIFICATE SETTINGS ---
function initializeCertificateSettings() {
    document.getElementById('manage-product-disclaimers-btn').addEventListener('click', openManageProductDisclaimersModal);

    populateProductTypesDropdown();
    
    // Use centralized signee management
    if (typeof populateSigneeDropdown === 'function') {
        populateSigneeDropdown('cert-signed-by', 'Select Signee');
    }
}