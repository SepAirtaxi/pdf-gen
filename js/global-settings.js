// js/global-settings.js

const globalSettingsModalArea = document.getElementById('global-settings-modal-area');
let currentEditingSigneeId = null;

// Constants for Firestore collections
const GLOBAL_SIGNEES_COLLECTION = 'signees';
const COMPANY_SETTINGS_COLLECTION = 'appSettings';
const COMPANY_DETAILS_DOC_ID = 'mainCompanyDetails';

// --- Utility to create and show a modal ---
function createGlobalModal(title, contentHtml, onSave = null, onCancel = null, modalId = 'global-settings-modal', closeOnly = false) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    let buttonsHtml = '';
    if (closeOnly) {
        buttonsHtml = `<button class="button" onclick="closeGlobalModal('${modalId}')">Close</button>`;
    } else {
        buttonsHtml = `
            <button id="${modalId}-save-btn" class="button primary-button">Save</button>
            <button class="button" onclick="closeGlobalModal('${modalId}')">Cancel</button>
        `;
    }

    const modalHTML = `
        <div id="${modalId}" class="modal">
            <div class="modal-content">
                <span class="close-button" onclick="closeGlobalModal('${modalId}')">×</span>
                <h2>${title}</h2>
                ${contentHtml}
                <div class="modal-actions">
                    ${buttonsHtml}
                </div>
            </div>
        </div>
    `;
    globalSettingsModalArea.innerHTML = modalHTML;
    
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

function closeGlobalModal(modalId = 'global-settings-modal') {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.style.display = 'none';
        modalElement.remove();
    }
    currentEditingSigneeId = null;
}

// === SIGNEE MANAGEMENT ===
async function loadSigneesList() {
    const signeesList = document.getElementById('signees-list');
    if (!signeesList) return;

    signeesList.innerHTML = '<li style="text-align: center; color: #666;">Loading signees...</li>';

    try {
        const signees = await getAllDocs(GLOBAL_SIGNEES_COLLECTION);
        signeesList.innerHTML = '';

        if (signees.length === 0) {
            signeesList.innerHTML = '<li style="text-align: center; color: #666;">No signees added yet. Click "Add New Signee" to get started.</li>';
            return;
        }

        signees.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(signee => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${signee.name || 'N/A'}</strong>
                    <br>
                    <small style="color: #666;">${signee.title || 'No title specified'}</small>
                    ${signee.signatureBase64 ? 
                        `<img src="${signee.signatureBase64}" alt="Signature" style="max-height:30px;border:1px solid #eee;margin-left:10px;margin-top:5px;">` : 
                        '<span style="color: #999; margin-left: 10px;">(No signature)</span>'
                    }
                </div>
                <span class="actions">
                    <button class="button" onclick="openEditSigneeModal('${signee.id}')">Edit</button>
                    <button class="action-button" onclick="deleteSignee('${signee.id}', '${signee.name}')">Remove</button>
                </span>
            `;
            signeesList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading signees:', error);
        signeesList.innerHTML = '<li style="text-align: center; color: #e74c3c;">Error loading signees. Please refresh the page.</li>';
    }
}

async function openAddSigneeModal() {
    currentEditingSigneeId = null;
    openSigneeModal('Add New Signee', { name: '', title: '', signatureBase64: '' });
}

async function openEditSigneeModal(signeeId) {
    currentEditingSigneeId = signeeId;
    try {
        const signee = await getDocById(GLOBAL_SIGNEES_COLLECTION, signeeId);
        if (signee) {
            openSigneeModal('Edit Signee', signee);
        } else {
            alert('Signee not found.');
        }
    } catch (error) {
        console.error('Error loading signee:', error);
        alert('Error loading signee data.');
    }
}

function openSigneeModal(title, signeeData) {
    const formHtml = `
        <div id="signee-form">
            <div>
                <label for="signee-name">Name:</label>
                <input type="text" id="signee-name" value="${signeeData.name || ''}" required placeholder="Enter signee name">
            </div>
            <div>
                <label for="signee-title">Title/Position:</label>
                <input type="text" id="signee-title" value="${signeeData.title || ''}" required placeholder="e.g., Technical Manager, CEO">
            </div>
            <div>
                <label for="signee-signature-file">Signature (PNG):</label>
                <input type="file" id="signee-signature-file" accept="image/png">
            </div>
            <div id="signature-preview-container" style="margin-top:10px; margin-left: 210px;">
                ${signeeData.signatureBase64 ? 
                    `Current: <img id="signature-preview-img" src="${signeeData.signatureBase64}" alt="Signature" style="max-height:60px;border:1px solid #ddd;">` : 
                    '<span id="signature-preview-img">No signature uploaded.</span>'
                }
            </div>
            <small style="margin-left: 210px; display: block; margin-top: 5px;">Upload a PNG file to replace current signature. Keep file size under 500KB.</small>
        </div>
    `;
    
    createGlobalModal(title, formHtml, saveSignee, null, 'signee-modal');
    
    // Set up file input handler
    const fileInput = document.getElementById('signee-signature-file');
    if (fileInput) {
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            if (file.type !== "image/png") {
                alert("Please select a PNG file.");
                event.target.value = "";
                return;
            }
            
            if (file.size > 500000) {
                alert("File is too large. Please choose a file smaller than 500KB.");
                event.target.value = "";
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewContainer = document.getElementById('signature-preview-container');
                let imgEl = document.getElementById('signature-preview-img');
                
                if (!imgEl || imgEl.tagName !== 'IMG') {
                    previewContainer.innerHTML = `New Preview: <img id="signature-preview-img" src="${e.target.result}" alt="Preview" style="max-height:60px;border:1px solid #ddd;">`;
                } else {
                    imgEl.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

async function saveSignee() {
    const name = document.getElementById('signee-name').value.trim();
    const title = document.getElementById('signee-title').value.trim();
    const signatureFile = document.getElementById('signee-signature-file').files[0];
    
    if (!name || !title) {
        alert('Please enter both name and title/position.');
        return;
    }
    
    let signeeData = { name, title };
    
    // Handle existing signature
    if (currentEditingSigneeId) {
        try {
            const existing = await getDocById(GLOBAL_SIGNEES_COLLECTION, currentEditingSigneeId);
            if (existing && existing.signatureBase64) {
                signeeData.signatureBase64 = existing.signatureBase64;
            }
        } catch (error) {
            console.error('Error loading existing signee:', error);
        }
    }
    
    // Handle new signature file
    if (signatureFile) {
        try {
            signeeData.signatureBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(signatureFile);
            });
        } catch (error) {
            console.error('Error reading signature file:', error);
            alert('Error processing signature file.');
            return;
        }
    }
    
    // Ensure signatureBase64 is set to empty string if not provided
    if (!signeeData.signatureBase64) {
        signeeData.signatureBase64 = '';
    }
    
    try {
        if (currentEditingSigneeId) {
            await updateDoc(GLOBAL_SIGNEES_COLLECTION, currentEditingSigneeId, signeeData);
        } else {
            await addDoc(GLOBAL_SIGNEES_COLLECTION, signeeData);
        }
        
        showToast(`Signee ${currentEditingSigneeId ? 'updated' : 'added'} successfully!`);
        closeGlobalModal('signee-modal');
        loadSigneesList();
    } catch (error) {
        console.error('Error saving signee:', error);
        alert(`Error saving signee: ${error.message}`);
    }
}

async function deleteSignee(signeeId, signeeName) {
    if (confirm(`Are you sure you want to delete "${signeeName}"? This will affect all modules that use this signee.`)) {
        try {
            await deleteDoc(GLOBAL_SIGNEES_COLLECTION, signeeId);
            showToast('Signee deleted successfully!');
            loadSigneesList();
        } catch (error) {
            console.error('Error deleting signee:', error);
            alert(`Error deleting signee: ${error.message}`);
        }
    }
}

// === COMPANY DETAILS MANAGEMENT ===
async function openManageCompanyDetailsModal() {
    let companyData = { 
        companyName: '', address1: '', address2: '', zipCode: '', city: '', country: '', 
        vatNumber: '', easaApproval: '', email: '', phone: '', website: '', logoBase64: '' 
    };
    
    try {
        const doc = await getDocById(COMPANY_SETTINGS_COLLECTION, COMPANY_DETAILS_DOC_ID);
        if (doc) companyData = { ...companyData, ...doc };
    } catch (error) {
        console.error('Error loading company details:', error);
    }

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
            <div id="cd-logo-preview-container" style="margin-top:10px; margin-left: 210px;">
                ${companyData.logoBase64 ? 
                    `Current Logo: <img id="cd-logo-preview-img" src="${companyData.logoBase64}" alt="Logo Preview" style="max-height: 60px; display: block; margin-top: 5px; border: 1px solid #ddd;">` : 
                    '<span id="cd-logo-preview-img">No logo uploaded.</span>'
                }
            </div>
            <small style="margin-left: 210px; display: block;">Upload a new logo (PNG, max 500KB) to replace the existing one.</small>
        </div>
    `;
    
    createGlobalModal('Manage Company Details', formHtml, saveCompanyDetails, null, 'company-details-modal');
    
    // Set up file input handler
    const logoFileInput = document.getElementById('cd-logo-file');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file && file.type === "image/png") {
                if (file.size > 500000) {
                    alert("Logo file is too large. Please choose a file smaller than 500KB.");
                    event.target.value = "";
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
            companyData.logoBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(logoFile);
            });
        } else if (!companyData.logoBase64 && existingDetails && !existingDetails.logoBase64) {
            companyData.logoBase64 = ''; 
        }
        
        await db.collection(COMPANY_SETTINGS_COLLECTION).doc(COMPANY_DETAILS_DOC_ID).set(companyData, { merge: true });
        showToast('Company details saved successfully!');
        closeGlobalModal('company-details-modal');
    } catch (error) {
        console.error("Error saving company details:", error);
        alert(`Error saving company details: ${error.message}`);
    }
}

// === UTILITY FUNCTIONS ===
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    
    if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
}

// === INITIALIZATION ===
function initializeGlobalSettings() {
    // Set up event listeners
    const addSigneeBtn = document.getElementById('add-signee-btn');
    if (addSigneeBtn) {
        addSigneeBtn.addEventListener('click', openAddSigneeModal);
    }
    
    const manageCompanyBtn = document.getElementById('manage-company-details-btn');
    if (manageCompanyBtn) {
        manageCompanyBtn.addEventListener('click', openManageCompanyDetailsModal);
    }
    
    // Load initial data
    loadSigneesList();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeGlobalSettings);