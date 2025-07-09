// js/app.js
function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove("active-tab-content"); // Remove active class
    }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    const currentTab = document.getElementById(tabName);
    currentTab.style.display = "block";
    currentTab.classList.add("active-tab-content"); // Add active class
    evt.currentTarget.className += " active";
}

document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the invoice generator page
    if (document.getElementById('inv-date')) {
        const invDateInput = document.getElementById('inv-date');
        if (invDateInput) {
            invDateInput.valueAsDate = new Date();
        }

        if (typeof initializeSettings === 'function') {
            initializeSettings();
        }
        // Initialize invoice form AFTER settings (so dropdowns from settings are ready)
        if (typeof initializeInvoiceForm === 'function') {
            initializeInvoiceForm().then(() => { // If initializeInvoiceForm is async
                console.log("Invoice form initialized.");
                 // Set the first tab as active after all initializations
                const firstTabButton = document.querySelector('.tabs .tab-link');
                if (firstTabButton) {
                    // No need to click if HTML already sets the 'active' class and 'active-tab-content'
                    // The HTML added script handles the click, this is more for state consistency
                    if (!document.querySelector('.tab-content.active-tab-content')) {
                        firstTabButton.click(); 
                    }
                }
            }).catch(error => console.error("Error initializing invoice form:", error));
        } else {
             const firstTabButton = document.querySelector('.tabs .tab-link');
                if (firstTabButton) {
                    if (!document.querySelector('.tab-content.active-tab-content')) {
                       firstTabButton.click(); 
                    }
                }
        }

        if (typeof initializeLoadInvoice === 'function') {
            initializeLoadInvoice();
        }

        const generatePdfBtn = document.getElementById('generate-pdf-btn');
        if (generatePdfBtn && typeof generateInvoicePDF === 'function') {
            generatePdfBtn.addEventListener('click', generateInvoicePDF);
        }
    }

    // Check if we're on the certificate generator page
    if (document.getElementById('cert-product-type')) {
        if (typeof initializeCertificateSettings === 'function') {
            initializeCertificateSettings();
        }
        
        if (typeof initializeCertificateForm === 'function') {
            initializeCertificateForm();
            console.log("Certificate form initialized.");
            
            // Set the first tab as active after all initializations
            const firstTabButton = document.querySelector('.tabs .tab-link');
            if (firstTabButton) {
                if (!document.querySelector('.tab-content.active-tab-content')) {
                    firstTabButton.click(); 
                }
            }
        }

        if (typeof initializeLoadCertificate === 'function') {
            initializeLoadCertificate();
        }

        const generateCertPdfBtn = document.getElementById('generate-certificate-pdf-btn');
        if (generateCertPdfBtn && typeof generateCertificatePDF === 'function') {
            generateCertPdfBtn.addEventListener('click', generateCertificatePDF);
        }
    }

    // Check if we're on the NIS generator page
    if (document.getElementById('nis-date')) {
        const nisDateInput = document.getElementById('nis-date');
        if (nisDateInput) {
            nisDateInput.valueAsDate = new Date();
        }

        if (typeof initializeNisSettings === 'function') {
            initializeNisSettings();
        }
        
        if (typeof initializeNisForm === 'function') {
            initializeNisForm();
            console.log("NIS form initialized.");
            
            // Set the first tab as active after all initializations
            const firstTabButton = document.querySelector('.tabs .tab-link');
            if (firstTabButton) {
                if (!document.querySelector('.tab-content.active-tab-content')) {
                    firstTabButton.click(); 
                }
            }
        }

        if (typeof initializeLoadNis === 'function') {
            initializeLoadNis();
        }

        const generateNisPdfBtn = document.getElementById('generate-nis-pdf-btn');
        if (generateNisPdfBtn && typeof generateNisPDF === 'function') {
            generateNisPdfBtn.addEventListener('click', generateNisPDF);
        }
    }

    // Check if we're on the global settings page
    if (document.getElementById('signees-list')) {
        if (typeof initializeGlobalSettings === 'function') {
            initializeGlobalSettings();
        }
    }
});