// js/certificate-pdf.js

// Helper function to format date as DD/MM/YYYY
function formatCertificateDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error("Date formatting error:", e);
        return dateString;
    }
}

// Helper function to get next certificate sequential ID
async function getNextCertificateSequentialId() {
    console.log("getNextCertificateSequentialId called");
    if (!db) {
        console.error("Firestore 'db' not available in getNextCertificateSequentialId.");
        return "ERR";
    }
    const counterRef = db.collection('counters').doc('certificateCounter');
    try {
        return await db.runTransaction(async (transaction) => {
            console.log("[Transaction] Getting certificate counter document...");
            const counterDoc = await transaction.get(counterRef);
            console.log(`[Transaction] Counter doc received. Exists property value: ${counterDoc?.exists}`);
            
            let newCount = 1;
            if (counterDoc && typeof counterDoc.exists === 'boolean' && counterDoc.exists === true) {
                newCount = (counterDoc.data()?.count || 0) + 1;
                console.log(`[Transaction] Incrementing counter to ${newCount}.`);
                transaction.update(counterRef, { count: newCount });
            } else if (counterDoc && typeof counterDoc.exists === 'boolean' && counterDoc.exists === false) {
                console.log("[Transaction] Counter document doesn't exist, creating with count 1.");
                transaction.set(counterRef, { count: newCount });
            } else {
                console.error("[Transaction] Invalid counterDoc snapshot received:", counterDoc);
                throw new Error("Invalid counter document snapshot in transaction.");
            }
            return String(newCount).padStart(5, '0'); // 5-digit number for CAT-COC-xxxxx
        });
    } catch (error) {
        console.error("Sequential ID Transaction failed: ", error);
        return "RND" + String(Math.floor(Math.random() * 100000)).padStart(5, '0'); // 5-digit fallback
    }
}

async function generateCertificatePDF() {
    console.log("Starting Certificate PDF generation...");
    
    // Show loading spinner
    showLoadingSpinner();
    
    try {
        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        
        const certificateData = getCertificateFormData();
        const itemsData = getCertItemsTableData();
        
        // Validation
        if (!certificateData.productType || !certificateData.signedBy) {
            hideLoadingSpinner();
            showToast("Please select Product Type and Signee.", 5000);
            return;
        }

        // Generate tracking ID
        let sequentialId = 'XXXXX';
        try {
            sequentialId = await getNextCertificateSequentialId();
        } catch (seqError) {
            console.error("Error getting sequential ID:", seqError);
        }
        
        const trackingId = `CAT-COC-${sequentialId}`;
        certificateData.trackingId = trackingId;
        
        const generatedPdfFileName = `Certificate_${trackingId}.pdf`;
        console.log("Generated PDF Filename:", generatedPdfFileName);

        // Save certificate data to Firestore
        let savedCertificateId;
        try {
            savedCertificateId = await saveCertificateDataToFirestore(certificateData, itemsData, generatedPdfFileName);
            console.log("Certificate data saved with ID:", savedCertificateId);
            if (typeof populateSavedCertificatesDropdown === "function") {
                populateSavedCertificatesDropdown();
            }
        } catch (error) {
            console.error("Error saving certificate data:", error);
            hideLoadingSpinner();
            showToast("Error saving: " + error.message, 5000);
            return;
        }

        // Create PDF
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;
        const usableWidth = pageWidth - 2 * margin;
        let currentY = margin;

        // --- PDF Content Generation (Following Specified Order) ---
        
        // 1. Company Header (reuse from invoice generator)
        console.log("Fetching company details...");
        const companyDetails = await getDocById('appSettings', 'mainCompanyDetails');
        console.log("Company Details Fetched:", companyDetails);
        
        const companyHeaderStartY = currentY;
        let logoEndY = companyHeaderStartY;

        if (companyDetails && companyDetails.logoBase64) {
            try {
                const img = new Image();
                img.src = companyDetails.logoBase64;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                if (img.width > 0 && img.height > 0) {
                    // Same logo sizing as invoice generator
                    let logoWidth = 35 * 1.5;
                    let logoHeight = (img.height * logoWidth) / img.width;
                    const logoMaxHeight = 32;
                    if (logoHeight > logoMaxHeight) {
                        logoWidth = (img.width * logoMaxHeight) / img.height;
                        logoHeight = logoMaxHeight;
                    }
                    doc.addImage(companyDetails.logoBase64, 'PNG', margin, currentY, logoWidth, logoHeight);
                    logoEndY = currentY + logoHeight;
                } else {
                    console.warn("Logo Base64 invalid.");
                    logoEndY = currentY;
                }
            } catch (e) {
                console.error("Logo processing error:", e);
                logoEndY = currentY;
            }
        } else {
            logoEndY = currentY;
        }
        
        // Company text below logo (same as invoice generator)
        currentY = logoEndY + 8;
        let companyTextEndY = currentY;

        if (companyDetails) {
            const textX = margin;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            if (companyDetails.companyName) {
                doc.text(companyDetails.companyName, textX, currentY);
                currentY += 4.5;
            }
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            let addrLine1 = companyDetails.address1 || '';
            let addrLine2 = companyDetails.address2 || '';
            let zipCity = [companyDetails.zipCode, companyDetails.city].filter(Boolean).join(' ');
            let country = companyDetails.country || '';
            let fullAddrLine = [addrLine1, zipCity, country].filter(Boolean).join(' // ');
            if (fullAddrLine) {
                doc.text(fullAddrLine, textX, currentY);
                currentY += 3.5;
            }
            if (addrLine2) {
                doc.text(addrLine2, textX, currentY);
                currentY += 3.5;
            }
            let contactLine = [
                companyDetails.phone ? `Ph.: ${companyDetails.phone}` : null,
                companyDetails.email ? `Email: ${companyDetails.email}` : null,
                companyDetails.website ? companyDetails.website : null
            ].filter(Boolean).join(' // ');
            if (contactLine) {
                doc.text(contactLine, textX, currentY);
                currentY += 3.5;
            }
            let regLine = [
                companyDetails.vatNumber ? `VAT: ${companyDetails.vatNumber}` : null,
                companyDetails.easaApproval ? `EASA: ${companyDetails.easaApproval}` : null
            ].filter(Boolean).join(' // ');
            if (regLine) {
                doc.text(regLine, textX, currentY);
                currentY += 3.5;
            }
            companyTextEndY = currentY;
        }

        // Reset position after company header
        currentY = companyTextEndY + 15;
        doc.setTextColor(0, 0, 0);

        // 2. Page Title "Certificate of Conformity" (same format as invoice generator)
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        const titleText = "Certificate of Conformity";
        const titleWidth = doc.getTextWidth(titleText);
        doc.setTextColor(120, 120, 120); // Medium gray color like invoice generator
        doc.text(titleText, (pageWidth - titleWidth) / 2, currentY);
        currentY += 10; // Space below title
        doc.setTextColor(0, 0, 0); // Reset text color to black

        // 3. Date: DD/MM/YYYY (Date: bold, date itself non-bold)
        const currentDate = new Date();
        const formattedDate = formatCertificateDate(currentDate);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Date: ", margin, currentY);
        const dateWidth = doc.getTextWidth("Date: ");
        doc.setFont("helvetica", "normal");
        doc.text(formattedDate, margin + dateWidth, currentY);
        currentY += 6;

        // 4. Form Tracking Number: CAT-COC-XXXXX (Title bold, number non-bold)
        doc.setFont("helvetica", "bold");
        doc.text("Form Tracking Number: ", margin, currentY);
        const trackingTitleWidth = doc.getTextWidth("Form Tracking Number: ");
        doc.setFont("helvetica", "normal");
        doc.text(trackingId, margin + trackingTitleWidth, currentY);
        currentY += 12; // Extra space before items table

        // 5. Items Table
        if (itemsData.length > 0) {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            const itemsTitle = "Certified Items:";
            const itemsTitleWidth = doc.getTextWidth(itemsTitle);
            doc.text(itemsTitle, (pageWidth - itemsTitleWidth) / 2, currentY); // Center aligned
            currentY += 6;

            const itemsTableHeaders = [["#", "Qty", "Part Number", "Description", "Tracking Number", "Expiry Date"]];
            const itemsTableBodyData = itemsData.map((item, index) => [
                (index + 1).toString(),
                item.qty || '1',
                item.partNumber || '',
                item.description || '',
                item.trackingNumber || '',
                item.expiryNA ? 'N/A' : (item.expiryDate || '')
            ]);

            doc.autoTable({
                startY: currentY,
                head: itemsTableHeaders,
                body: itemsTableBodyData,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 1 },
                    valign: 'middle',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.3,
                    textColor: [0, 0, 0]
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: 0,
                    fontStyle: 'bold',
                    halign: 'left'
                },
                bodyStyles: {
                    halign: 'left'
                },
                columnStyles: {
                    0: { halign: 'center' }, // Center align first column (#) - both header and data
                    1: { halign: 'left' },
                    2: { halign: 'left' },
                    3: { halign: 'left' },
                    4: { halign: 'left' },
                    5: { halign: 'left' }
                },
                didParseCell: function(data) {
                    // Center align the header of the first column
                    if (data.column.index === 0 && data.section === 'head') {
                        data.cell.styles.halign = 'center';
                    }
                },
                margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 12;
        }

        // 6. Notes (only if populated) - as a table
        if (certificateData.notes && certificateData.notes.trim()) {
            const notesTableData = [
                ["Notes:"], // Header row
                [certificateData.notes.trim()] // Content row
            ];

            doc.autoTable({
                startY: currentY,
                body: notesTableData,
                theme: 'grid',
                styles: {
                    fontSize: 9,
                    cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 1 }, // Much smaller padding like items table
                    valign: 'middle',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.3,
                    textColor: [0, 0, 0]
                },
                didParseCell: function(data) {
                    if (data.row.index === 0) {
                        // First row - "Notes:" header
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.halign = 'center';
                        data.cell.styles.fontSize = 10;
                        data.cell.styles.fillColor = [220, 220, 220]; // Same gray as items table header
                    } else {
                        // Second row - notes content
                        data.cell.styles.fontStyle = 'normal';
                        data.cell.styles.halign = 'left';
                        data.cell.styles.fontSize = 9;
                    }
                },
                margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 12;
        }

        // 7. Product Disclaimer (smaller font, center aligned, medium/dark grey)
        if (certificateData.productType) {
            const productDisclaimer = await getDocById(PRODUCT_DISCLAIMERS_COLLECTION, certificateData.productType);
            if (productDisclaimer) {
                doc.setFontSize(8); // Smaller font as requested
                doc.setFont("helvetica", "normal");
                doc.setTextColor(90, 90, 90); // Medium/dark grey color
                const disclaimerLines = doc.splitTextToSize(productDisclaimer.disclaimerText, usableWidth);
                // Center align each line of the disclaimer
                disclaimerLines.forEach((line, index) => {
                    const lineWidth = doc.getTextWidth(line);
                    doc.text(line, (pageWidth - lineWidth) / 2, currentY + (index * 3.5));
                });
                currentY += disclaimerLines.length * 3.5 + 10; // Smaller line height for smaller font
                doc.setTextColor(0, 0, 0); // Reset text color to black
            }
        }

        // 8. Signee Section (signature picture, name, and title - all center aligned)
        // Use centralized signee system
        const signeeDetails = certificateData.signedBy ? await getSigneeById(certificateData.signedBy) : null;
        if (signeeDetails) {
            // Ensure we have space at the bottom of the page
            const signatureBoxY = Math.max(currentY, pageHeight - 50);
            
            // Signature image (center aligned)
            if (signeeDetails.signatureBase64) {
                try {
                    const sigImg = new Image();
                    sigImg.src = signeeDetails.signatureBase64;
                    await new Promise((res, rej) => {
                        sigImg.onload = res;
                        sigImg.onerror = rej;
                    });
                    
                    if (sigImg.width > 0 && sigImg.height > 0) {
                        const sigMaxH = 15;
                        const sigMaxW = 40;
                        let sigW = sigImg.width;
                        let sigH = sigImg.height;
                        const r = Math.min(sigMaxW / sigW, sigMaxH / sigH);
                        sigW = sigW * r * 0.8;
                        sigH = sigH * r * 0.8;
                        // Center the signature horizontally
                        const sigX = (pageWidth - sigW) / 2;
                        doc.addImage(signeeDetails.signatureBase64, 'PNG', sigX, signatureBoxY, sigW, sigH);
                        currentY = signatureBoxY + sigH + 3;
                    } else {
                        currentY = signatureBoxY;
                    }
                } catch (e) {
                    console.error("Signature error:", e);
                    currentY = signatureBoxY;
                }
            } else {
                currentY = signatureBoxY;
            }

            // Signee name (center aligned)
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            const signeeName = signeeDetails.name || 'N/A';
            const signeeNameWidth = doc.getTextWidth(signeeName);
            doc.text(signeeName, (pageWidth - signeeNameWidth) / 2, currentY);
            currentY += 4;
            
            // Title/position (center aligned) - use centralized title field
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            const title = signeeDetails.title || "Authorized Signatory";
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, (pageWidth - titleWidth) / 2, currentY);
        }

        // Save PDF
        doc.save(generatedPdfFileName);
        
        // Hide spinner and show success message
        hideLoadingSpinner();
        showToast(`Certificate "${generatedPdfFileName}" generated and data saved!`);
        console.log("Certificate PDF generation complete.");
        
    } catch (error) {
        hideLoadingSpinner();
        console.error("Error generating certificate PDF:", error);
        showToast("An error occurred while generating the certificate PDF: " + error.message, 5000);
    }
}

// Save certificate data to Firestore
async function saveCertificateDataToFirestore(certificateData, itemsData, pdfFileName) {
    const certificateRecord = {
        certificate: certificateData,
        items: itemsData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        pdfFileName: pdfFileName
    };
    try {
        const docRef = await db.collection(SAVED_CERTIFICATES_COLLECTION_LOAD).add(certificateRecord);
        return docRef.id;
    } catch (error) {
        console.error("Error writing certificate data:", error);
        throw error;
    }
}

// Helper functions (reuse from invoice-pdf.js)
function showLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.add('active');
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.remove('active');
    }
}

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