// js/nis-settings.js

const nisSettingsModalArea = document.getElementById('nis-settings-modal-area');
let currentEditingAircraftId = null;
let currentEditingOperatorId = null;

// Constants for Firestore collections
const AIRCRAFT_COLLECTION = 'aircraft';
const OPERATORS_COLLECTION = 'operators';

// --- Utility to create and show a modal ---
function createNisModal(title, contentHtml, onSave = null, onCancel = null, modalId = 'nis-settings-generic-modal', closeOnly = false) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

// ===== OPERATORS MANAGEMENT =====
async function openManageOperatorsModal() {
    currentEditingOperatorId = null;
    const operators = await getAllDocs(OPERATORS_COLLECTION);
    let operatorsListHtml = '<ul class="settings-list">';
    operators.sort((a,b) => (a.operatorName||'').localeCompare(b.operatorName||'')).forEach(operator => {
        operatorsListHtml += `<li><span><strong>${operator.operatorName || 'N/A'}</strong></span><span class="actions"><button class="button" onclick="openAddEditOperatorModal('${operator.id}')">Edit</button><button class="action-button" onclick="deleteOperator('${operator.id}')">Remove</button></span></li>`;
    });
    operatorsListHtml += '</ul>';
    createNisModal('Manage Operators/Airlines', `${operatorsListHtml}<button class="button" onclick="openAddEditOperatorModal()">Add New Operator</button>`, null, null, 'manage-operators-modal', true);
}

async function openAddEditOperatorModal(operatorId = null) {
    currentEditingOperatorId = operatorId;
    let operatorData = { operatorName: '' };
    if (operatorId) {
        const doc = await getDocById(OPERATORS_COLLECTION, operatorId);
        if (doc) operatorData = {...operatorData, ...doc};
    }
    const formHtml = `<div id="operator-form">
        <div><label for="operator-name">Operator/Airline Name:</label><input type="text" id="operator-name" value="${operatorData.operatorName}" required placeholder="e.g., Airseven"></div>
    </div>`;
    createNisModal(operatorId ? 'Edit Operator' : 'Add New Operator', formHtml, saveOperator, null, 'add-edit-operator-modal');
}

async function saveOperator() {
    const operatorData = {
        operatorName: document.getElementById('operator-name').value.trim()
    };
    if (!operatorData.operatorName) {
        alert('Please fill in the Operator/Airline Name.');
        return;
    }
    try {
        if (currentEditingOperatorId) {
            await updateDoc(OPERATORS_COLLECTION, currentEditingOperatorId, operatorData);
        } else {
            await addDoc(OPERATORS_COLLECTION, operatorData);
        }
        alert(`Operator ${currentEditingOperatorId ? 'updated' : 'added'} successfully!`);
        closeNisModal('add-edit-operator-modal');
        openManageOperatorsModal();
        populateOperatorDropdown();
    } catch (error) {
        console.error("Error saving operator:", error);
        alert(`Error saving operator: ${error.message}`);
    }
}

async function deleteOperator(operatorId) {
    if (confirm('Are you sure you want to delete this operator?')) {
        try {
            await deleteDoc(OPERATORS_COLLECTION, operatorId);
            alert('Operator deleted successfully!');
            openManageOperatorsModal();
            populateOperatorDropdown();
        } catch (error) {
            console.error("Error deleting operator:", error);
            alert(`Error deleting operator: ${error.message}`);
        }
    }
}

function populateOperatorDropdown() {
    const selectElement = document.getElementById('nis-operator');
    if (!selectElement) return;

    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">-- Select Operator/Airline --</option>`;

    getAllDocs(OPERATORS_COLLECTION).then(operators => {
        operators.sort((a,b) => (a.operatorName||'').localeCompare(b.operatorName||'')).forEach(operator => {
            const option = document.createElement('option');
            option.value = operator.id;
            option.textContent = operator.operatorName;
            selectElement.appendChild(option);
        });

        if (currentValue) {
            selectElement.value = currentValue;
        }
    }).catch(error => {
        console.error("Error populating operator dropdown:", error);
    });
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
    currentEditingOperatorId = null;
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
    document.getElementById('manage-operators-btn').addEventListener('click', openManageOperatorsModal);

    populateAircraftDropdown();
    populateOperatorDropdown();
    
    // Use centralized signee management
    if (typeof populateSigneeDropdown === 'function') {
        populateSigneeDropdown('nis-signed-by', 'Select Signee');
    }
}