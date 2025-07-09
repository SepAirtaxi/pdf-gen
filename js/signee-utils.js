// js/signee-utils.js
// Shared utility functions for signee management across all modules

const SIGNEES_COLLECTION = 'signees';

/**
 * Populate a signee dropdown with centralized signee data
 * @param {string} selectElementId - The ID of the select element
 * @param {string} defaultOptionText - Text for the default option
 */
async function populateSigneeDropdown(selectElementId, defaultOptionText = 'Select Signee') {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        console.warn(`Signee dropdown element with ID '${selectElementId}' not found`);
        return;
    }

    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">-- ${defaultOptionText} --</option>`;

    try {
        const signees = await getAllDocs(SIGNEES_COLLECTION);
        signees.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(signee => {
            const option = document.createElement('option');
            option.value = signee.id;
            // Display name with title if available
            option.textContent = signee.title ? `${signee.name} (${signee.title})` : signee.name;
            selectElement.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
            selectElement.value = currentValue;
        }
    } catch (error) {
        console.error(`Error populating signee dropdown '${selectElementId}':`, error);
        selectElement.innerHTML = `<option value="">Error loading signees</option>`;
    }
}

/**
 * Get signee details by ID
 * @param {string} signeeId - The ID of the signee
 * @returns {Promise<Object|null>} Signee data or null if not found
 */
async function getSigneeById(signeeId) {
    if (!signeeId) return null;
    
    try {
        return await getDocById(SIGNEES_COLLECTION, signeeId);
    } catch (error) {
        console.error('Error fetching signee:', error);
        return null;
    }
}

/**
 * Get formatted signee name with title for display
 * @param {string} signeeId - The ID of the signee
 * @returns {Promise<string>} Formatted signee name
 */
async function getSigneeDisplayName(signeeId) {
    const signee = await getSigneeById(signeeId);
    if (!signee) return 'N/A';
    
    return signee.title ? `${signee.name} (${signee.title})` : signee.name;
}

/**
 * Get signee name from dropdown selection
 * @param {string} selectElementId - The ID of the select element
 * @returns {string} Selected signee name or empty string
 */
function getSelectedSigneeName(selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement || !selectElement.value) return '';
    
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    return selectedOption ? selectedOption.textContent.replace(/^-- .* --$/, '').trim() : '';
}