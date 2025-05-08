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
});