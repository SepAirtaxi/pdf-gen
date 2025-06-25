// js/certificate-settings.js

const certSettingsModalArea = document.getElementById('cert-settings-modal-area');
let currentEditingDisclaimerId = null;
let currentEditingCertSigneeId = null;

// Constants for Firestore collections
const PRODUCT_DISCLAIMERS_COLLECTION = 'productDisclaimers';
const CERT_SIGNEES_COLLECTION = 'signees'; // Reuse the same signees collection

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
    currentEditingCertSigneeId = null;
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

// ===== SIGNEE MANAGEMENT (REUSED FROM INVOICE GENERATOR) =====
async function openManageCertSigneesModal() {
    currentEditingCertSigneeId = null;
    const signees = await getAllDocs(CERT_SIGNEES_COLLECTION);
    let listHtml = '<ul class="settings-list">';
    signees.sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(signee => {
        listHtml += `<li><span>${signee.name || 'N/A'}</span>${signee.signatureBase64 ? `<img src="${signee.signatureBase64}" alt="Sig" style="max-height:30px;border:1px solid #eee;margin-left:10px;">` : '(No sig)'}<span class="actions"><button class="button" onclick="openAddEditCertSigneeModal('${signee.id}')">Edit</button><button class="action-button" onclick="deleteCertSignee('${signee.id}')">Remove</button></span></li>`;
    });
    listHtml += '</ul>';
    createCertModal('Manage Signees', `${listHtml}<button class="button" onclick="openAddEditCertSigneeModal()">Add New Signee</button>`, null, null, 'manage-cert-signees-modal', true);
}

async function openAddEditCertSigneeModal(signeeId = null) {
    currentEditingCertSigneeId = signeeId;
    let signeeData = { name: '', signatureBase64: '' };
    if (signeeId) {
        const doc = await getDocById(CERT_SIGNEES_COLLECTION, signeeId);
        if (doc) signeeData = {...signeeData, ...doc};
    }
    const formHtml = `<div id="cert-signee-form">
        <div><label for="cert-signee-name">Signee Name:</label><input type="text" id="cert-signee-name" value="${signeeData.name}" required></div>
        <div><label for="cert-signee-signature-file">Signature (PNG):</label><input type="file" id="cert-signee-signature-file" accept="image/png"></div>
        <div id="cert-signature-preview-container" style="margin-top:10px; margin-left: 210px;">${signeeData.signatureBase64 ? `Current: <img id="cert-signature-preview-img" src="${signeeData.signatureBase64}" alt="Sig" style="max-height:60px;border:1px solid #ddd;">` : '<span id="cert-signature-preview-img">No signature.</span>'}</div>
        <small style="margin-left: 210px; display: block;">Upload new to replace. Small PNG (e.g., <100KB).</small>
    </div>`;
    createCertModal(signeeId ? 'Edit Signee' : 'Add New Signee', formHtml, saveCertSignee, null, 'add-edit-cert-signee-modal');
    document.getElementById('cert-signee-signature-file').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (file.type === "image/png") {
            if (file.size > 500000) {
                alert("Signature file too large (max 500KB).");
                event.target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewContainer = document.getElementById('cert-signature-preview-container');
                let imgEl = document.getElementById('cert-signature-preview-img');
                if (!imgEl || imgEl.tagName !== 'IMG') {
                    previewContainer.innerHTML = `New Preview: <img id="cert-signature-preview-img" src="${e.target.result}" alt="Preview" style="max-height:60px;border:1px solid #ddd;">`;
                } else {
                    imgEl.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        } else {
            alert("Please select a PNG file.");
            event.target.value = "";
        }
    });
}

async function saveCertSignee() {
    const name = document.getElementById('cert-signee-name').value.trim();
    if (!name) {
        alert('Please enter signee name.');
        return;
    }
    const signatureFile = document.getElementById('cert-signee-signature-file').files[0];
    let signeeData = { name };
    
    if (currentEditingCertSigneeId) {
        const existing = await getDocById(CERT_SIGNEES_COLLECTION, currentEditingCertSigneeId);
        if (existing && existing.signatureBase64) signeeData.signatureBase64 = existing.signatureBase64;
    }
    
    try {
        if (signatureFile) {
            signeeData.signatureBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(signatureFile);
            });
        } else if (!signeeData.signatureBase64 && currentEditingCertSigneeId) {
            const existing = await getDocById(CERT_SIGNEES_COLLECTION, currentEditingCertSigneeId);
            if (existing && !existing.signatureBase64) signeeData.signatureBase64 = '';
        } else if (!signeeData.signatureBase64 && !currentEditingCertSigneeId) {
            signeeData.signatureBase64 = '';
        }

        if (currentEditingCertSigneeId) {
            await updateDoc(CERT_SIGNEES_COLLECTION, currentEditingCertSigneeId, signeeData);
        } else {
            await addDoc(CERT_SIGNEES_COLLECTION, signeeData);
        }
        alert('Signee saved successfully!');
        closeCertModal('add-edit-cert-signee-modal');
        openManageCertSigneesModal();
        populateCertSigneesDropdown();
    } catch (error) {
        console.error("Error saving signee:", error);
        alert(`Error: ${error.message}`);
    }
}

async function deleteCertSignee(signeeId) {
    if (confirm('Are you sure you want to delete this signee?')) {
        try {
            await deleteDoc(CERT_SIGNEES_COLLECTION, signeeId);
            alert('Signee deleted!');
            openManageCertSigneesModal();
            populateCertSigneesDropdown();
        } catch (error) {
            console.error("Error deleting signee:", error);
            alert(`Error: ${error.message}`);
        }
    }
}

function populateCertSigneesDropdown() {
    const selectElement = document.getElementById('cert-signed-by');
    if (!selectElement) return;

    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">-- Select Signee --</option>`;

    getAllDocs(CERT_SIGNEES_COLLECTION).then(signees => {
        signees.sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(signee => {
            const option = document.createElement('option');
            option.value = signee.id;
            option.textContent = signee.name;
            selectElement.appendChild(option);
        });

        if (currentValue) {
            selectElement.value = currentValue;
        }
    }).catch(error => {
        console.error("Error populating signees dropdown:", error);
    });
}

// --- INITIALIZE CERTIFICATE SETTINGS ---
function initializeCertificateSettings() {
    document.getElementById('manage-product-disclaimers-btn').addEventListener('click', openManageProductDisclaimersModal);
    document.getElementById('manage-cert-signees-btn').addEventListener('click', openManageCertSigneesModal);

    populateProductTypesDropdown();
    populateCertSigneesDropdown();
}