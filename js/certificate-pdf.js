// js/certificate-pdf.js

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

        // --- PDF Content Generation ---
        
        // Company Header (reuse from invoice generator)
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
        
        // Company text below logo
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
            // Add company address and contact info similar to invoice generator
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
            companyTextEndY = currentY;
        }

        // Certificate Title and Tracking ID (Top Right)
        const rightColumnX = pageWidth - margin;
        let topRightInfoY = companyHeaderStartY;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(120, 120, 120);
        doc.text("CERTIFICATE OF CONFORMITY", rightColumnX, topRightInfoY, { align: 'right' });
        topRightInfoY += 8;
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Tracking ID: ${trackingId}`, rightColumnX, topRightInfoY, { align: 'right' });
        topRightInfoY += 6;
        
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const currentDate = new Date().toLocaleDateString();
        doc.text(`Generated: ${currentDate}`, rightColumnX, topRightInfoY, { align: 'right' });

        // Reset position below header
        currentY = Math.max(companyTextEndY, topRightInfoY) + 15;
        doc.setTextColor(0, 0, 0);

        // Product Type and Disclaimer
        if (certificateData.productType) {
            const productDisclaimer = await getDocById(PRODUCT_DISCLAIMERS_COLLECTION, certificateData.productType);
            if (productDisclaimer) {
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(`Product Type: ${productDisclaimer.productType}`, margin, currentY);
                currentY += 8;
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                const disclaimerLines = doc.splitTextToSize(productDisclaimer.disclaimerText, usableWidth);
                doc.text(disclaimerLines, margin, currentY);
                currentY += disclaimerLines.length * 4 + 8;
            }
        }

        // Notes section
        if (certificateData.notes && certificateData.notes.trim()) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("Notes:", margin, currentY);
            currentY += 5;
            
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            const notesLines = doc.splitTextToSize(certificateData.notes, usableWidth);
            doc.text(notesLines, margin, currentY);
            currentY += notesLines.length * 4 + 8;
        }

        // Items Table
        if (itemsData.length > 0) {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Certified Items:", margin, currentY);
            currentY += 8;

            const itemsTableHeaders = [["#", "Qty", "Part Number", "Description", "Tracking Number", "Expiry Date"]];
            const itemsTableBodyData = itemsData.map((item, index) => [
                (index + 1).toString(),
                item.qty || '1',
                item.partNumber || '',
                item.description || '',
                item.trackingNumber || '',
                item.expiryDate || ''
            ]);

            doc.autoTable({
                startY: currentY,
                head: itemsTableHeaders,
                body: itemsTableBodyData,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
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
                margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 15;
        }

        // Signature Section
        const signeeDetails = certificateData.signedBy ? await getDocById(CERT_SIGNEES_COLLECTION, certificateData.signedBy) : null;
        if (signeeDetails) {
            const signatureBoxY = Math.max(currentY, pageHeight - 60);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text("This certificate confirms that the above items conform to the specified requirements.", margin, signatureBoxY);
            
            doc.setFontSize(9);
            doc.text(`Certified by: ${signeeDetails.name}`, margin, signatureBoxY + 8);
            doc.text(`Date: ${currentDate}`, margin, signatureBoxY + 16);
            
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
                        doc.addImage(signeeDetails.signatureBase64, 'PNG', margin + 80, signatureBoxY + 5, sigW, sigH);
                    }
                } catch (e) {
                    console.error("Signature error:", e);
                }
            }
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