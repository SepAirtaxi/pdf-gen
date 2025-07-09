// js/nis-settings.js

const nisSettingsModalArea = document.getElementById('nis-settings-modal-area');
let currentEditingAircraftId = null;

// Constants for Firestore collections
const AIRCRAFT_COLLECTION = 'aircraft';

// --- Utility to create and show a modal ---
function createNisModal(title, contentHtml, onSave = null, onCancel = null, modalId = 'nis-settings-generic-modal', closeOnly = false) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    let buttonsHtml = '';
    if (closeOnly) {
        buttonsHtml = `<button class="button" onclick="closeNisModal('${modalId}')">Close</button>`;
    } else {
        buttonsHtml = `
            <button id="${modalId}-save-btn" class="button primary-button">Save</button>
            <button class="button" onclick="closeNisModal('${modalId}')">Cancel</button>
        `;
    }

    const modalHTML = `
        <div id="${modalId}" class="modal">
            <div class="modal-content">
                <span class="close-button" onclick="closeNisModal('${modalId}')">×</span>
                <h2>${title}</h2>
                ${contentHtml}
                <div class="modal-actions">
                    ${buttonsHtml}
                </div>
            </div>
        </div>
    `;
    nisSettingsModalArea.innerHTML = modalHTML;
    
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

function closeNisModal(modalId = 'nis-settings-generic-modal') {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.style.display = 'none';
        modalElement.remove();
    }
    currentEditingAircraftId = null;
}

// ===== AIRCRAFT MANAGEMENT =====
async function openManageAircraftModal() {
    currentEditingAircraftId = null;
    const aircraft = await getAllDocs(AIRCRAFT_COLLECTION);
    let aircraftListHtml = '<ul class="settings-list">';
    aircraft.sort((a,b) => (a.tailNumber||'').localeCompare(b.tailNumber||'')).forEach(aircraft => {
        aircraftListHtml += `<li><span><strong>${aircraft.tailNumber || 'N/A'}</strong><br><small>MSN: ${aircraft.msn || 'N/A'}</small></span><span class="actions"><button class="button" onclick="openAddEditAircraftModal('${aircraft.id}')">Edit</button><button class="action-button" onclick="deleteAircraft('${aircraft.id}')">Remove</button></span></li>`;
    });
    aircraftListHtml += '</ul>';
    createNisModal('Manage Aircraft', `${aircraftListHtml}<button class="button" onclick="openAddEditAircraftModal()">Add New Aircraft</button>`, null, null, 'manage-aircraft-modal', true);
}

async function openAddEditAircraftModal(aircraftId = null) {
    currentEditingAircraftId = aircraftId;
    let aircraftData = { tailNumber: '', msn: '' };
    if (aircraftId) {
        const doc = await getDocById(AIRCRAFT_COLLECTION, aircraftId);
        if (doc) aircraftData = {...aircraftData, ...doc};
    }
    const formHtml = `<div id="aircraft-form">
        <div><label for="aircraft-tail-number">Tail Number:</label><input type="text" id="aircraft-tail-number" value="${aircraftData.tailNumber}" required placeholder="e.g., OY-CAT"></div>
        <div><label for="aircraft-msn">MSN (Manufacturer Serial Number):</label><input type="text" id="aircraft-msn" value="${aircraftData.msn}" required placeholder="e.g., 12345"></div>
    </div>`;
    createNisModal(aircraftId ? 'Edit Aircraft' : 'Add New Aircraft', formHtml, saveAircraft, null, 'add-edit-aircraft-modal');
}

async function saveAircraft() {
    const aircraftData = {
        tailNumber: document.getElementById('aircraft-tail-number').value.trim(),
        msn: document.getElementById('aircraft-msn').value.trim()
    };
    if (!aircraftData.tailNumber || !aircraftData.msn) {
        alert('Please fill in both Tail Number and MSN.');
        return;
    }
    try {
        if (currentEditingAircraftId) {
            await updateDoc(AIRCRAFT_COLLECTION, currentEditingAircraftId, aircraftData);
        } else {
            await addDoc(AIRCRAFT_COLLECTION, aircraftData);
        }
        alert(`Aircraft ${currentEditingAircraftId ? 'updated' : 'added'} successfully!`);
        closeNisModal('add-edit-aircraft-modal');
        openManageAircraftModal();
        populateAircraftDropdown();
    } catch (error) {
        console.error("Error saving aircraft:", error);
        alert(`Error saving aircraft: ${error.message}`);
    }
}

async function deleteAircraft(aircraftId) {
    if (confirm('Are you sure you want to delete this aircraft?')) {
        try {
            await deleteDoc(AIRCRAFT_COLLECTION, aircraftId);
            alert('Aircraft deleted successfully!');
            openManageAircraftModal();
            populateAircraftDropdown();
        } catch (error) {
            console.error("Error deleting aircraft:", error);
            alert(`Error deleting aircraft: ${error.message}`);
        }
    }
}

function populateAircraftDropdown() {
    const selectElement = document.getElementById('nis-aircraft');
    if (!selectElement) return;

    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">-- Select Aircraft --</option>`;

    getAllDocs(AIRCRAFT_COLLECTION).then(aircraft => {
        aircraft.sort((a,b) => (a.tailNumber||'').localeCompare(b.tailNumber||'')).forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft.id;
            option.textContent = `${aircraft.tailNumber} (MSN: ${aircraft.msn})`;
            selectElement.appendChild(option);
        });

        if (currentValue) {
            selectElement.value = currentValue;
        }
    }).catch(error => {
        console.error("Error populating aircraft dropdown:", error);
    });
}

// --- INITIALIZE NIS SETTINGS ---
function initializeNisSettings() {
    document.getElementById('manage-aircraft-btn').addEventListener('click', openManageAircraftModal);

    populateAircraftDropdown();
    
    // Use centralized signee management
    if (typeof populateSigneeDropdown === 'function') {
        populateSigneeDropdown('nis-signed-by', 'Select Signee');
    }
}