// js/nis-pdf.js

// Helper function to format date as DD/MM/YYYY
function formatNisDate(dateString) {
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

// Helper function to get next NIS sequential ID
async function getNextNisSequentialId() {
    console.log("getNextNisSequentialId called");
    if (!db) {
        console.error("Firestore 'db' not available in getNextNisSequentialId.");
        return "ERR";
    }
    const counterRef = db.collection('counters').doc('nisCounter');
    try {
        return await db.runTransaction(async (transaction) => {
            console.log("[Transaction] Getting NIS counter document...");
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
            return String(newCount).padStart(4, '0'); // 4-digit number
        });
    } catch (error) {
        console.error("Sequential ID Transaction failed: ", error);
        return "RND" + String(Math.floor(Math.random() * 10000)).padStart(4, '0'); // 4-digit fallback
    }
}

async function generateNisPDF() {
    console.log("Starting NIS PDF generation...");
    
    // Show loading spinner
    showLoadingSpinner();
    
    try {
        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        
        const nisData = getNisFormData();
        
        // Validation
        if (!nisData.aircraft || !nisData.signedBy || !nisData.partNumber || !nisData.description || !nisData.serialNo) {
            hideLoadingSpinner();
            showToast("Please fill in all required fields.", 5000);
            return;
        }

        // Generate tracking ID
        let sequentialId = 'XXXX';
        try {
            sequentialId = await getNextNisSequentialId();
        } catch (seqError) {
            console.error("Error getting sequential ID:", seqError);
        }
        
        // Get aircraft details for filename
        const aircraftDetails = nisData.aircraft ? await getDocById(AIRCRAFT_COLLECTION, nisData.aircraft) : null;
        const tailNumber = aircraftDetails ? aircraftDetails.tailNumber : 'Unknown';
        const cleanTailNumber = tailNumber.replace(/[^a-z0-9]/gi, '_');
        
        const generatedPdfFileName = `NIS_${cleanTailNumber}_${sequentialId}.pdf`;
        console.log("Generated PDF Filename:", generatedPdfFileName);

        // Save NIS data to Firestore
        let savedNisId;
        try {
            savedNisId = await saveNisDataToFirestore(nisData, generatedPdfFileName);
            console.log("NIS data saved with ID:", savedNisId);
            if (typeof populateSavedNisDropdown === "function") {
                populateSavedNisDropdown();
            }
        } catch (error) {
            console.error("Error saving NIS data:", error);
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
        
        // 1. Company Header (reuse from other modules)
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

        // 2. Date (top right)
        const formattedDate = formatNisDate(nisData.date);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Date:", pageWidth - margin - 40, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(formattedDate, pageWidth - margin - 20, currentY);

        // 3. Page Title
        currentY += 10;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        const titleText = "Incident/Accident Clearance Statement (Non-incident)";
        const titleWidth = doc.getTextWidth(titleText);
        doc.text(titleText, (pageWidth - titleWidth) / 2, currentY);
        currentY += 8;

        // 4. "To Whom It May Concern:"
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("To Whom It May Concern:", margin, currentY);
        currentY += 8;

        // 5. Main paragraph
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const aircraftNameForText = aircraftDetails ? aircraftDetails.tailNumber : 'N/A';
        const mainParagraphText = `This component installed on aircraft ${aircraftNameForText}, details of which are specified below, has been operated by Airseven since 03/12/2020. The aircraft has a valid Certificate of Airworthiness from Danish Civil Aviation Authority as of the date of this statement.`;
        const mainParagraphLines = doc.splitTextToSize(mainParagraphText, usableWidth);
        mainParagraphLines.forEach(line => {
            doc.text(line, margin, currentY);
            currentY += 4;
        });
        currentY += 5;

        // 6. "Configuration details as of date of this statement;"
        doc.setFont("helvetica", "bold");
        doc.text("Configuration details as of date of this statement;", margin, currentY);
        currentY += 8;

        // 7. Component Details Table
        const componentTableHeaders = [["Part number", "Description", "Serial No.", "TSO", "CSO"]];
        const componentTableData = [[
            nisData.partNumber || '',
            nisData.description || '',
            nisData.serialNo || '',
            nisData.tso || 'N/A',
            nisData.cso || 'N/A'
        ]];

        // Add "(In hours)" subtitle under TSO and CSO headers
        const componentTableHeaders2 = [["", "", "", "(In hours)", ""]];
        const componentTableData2 = [["", "", "", "N/A", "N/A"]];

        doc.autoTable({
            startY: currentY,
            head: componentTableHeaders.concat(componentTableHeaders2),
            body: componentTableData.concat(componentTableData2),
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
                valign: 'middle',
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
                textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: 0,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                halign: 'center'
            },
            didParseCell: function(data) {
                if (data.row.index === 1 && data.section === 'head') {
                    // Second header row - make font smaller and italic
                    data.cell.styles.fontSize = 7;
                    data.cell.styles.fontStyle = 'italic';
                }
                if (data.row.index === 1 && data.section === 'body') {
                    // Second body row
                    data.cell.styles.fontSize = 8;
                    data.cell.styles.fontStyle = 'italic';
                }
            },
            margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY + 12;

        // 8. Certification statement
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const certificationText = "I hereby certify that, to the best of my knowledge, during the period since the aircraft entered service with Airseven:";
        const certificationLines = doc.splitTextToSize(certificationText, usableWidth);
        certificationLines.forEach(line => {
            doc.text(line, margin, currentY);
            currentY += 4;
        });
        currentY += 5;

        // 9. Numbered list items
        const listItems = [
            {
                number: "1.",
                text: "Neither the aircraft, nor any part installed have been;",
                subItems: [
                    {
                        letter: "a.",
                        text: "damaged during, or identified as the root cause of, a reportable incident or accident as defined by Annex 13 to the Chicago Convention, or"
                    },
                    {
                        letter: "b.",
                        text: "subjected to severe stress or heat (such as in a major engine failure, accident, or fire) or has been submersed in salt water,"
                    }
                ]
            }
        ];

        listItems.forEach(item => {
            doc.text(item.number, margin, currentY);
            const itemLines = doc.splitTextToSize(item.text, usableWidth - 10);
            itemLines.forEach((line, index) => {
                doc.text(line, margin + 8, currentY + (index * 4));
            });
            currentY += itemLines.length * 4 + 3;

            if (item.subItems) {
                item.subItems.forEach(subItem => {
                    doc.text(subItem.letter, margin + 15, currentY);
                    const subItemLines = doc.splitTextToSize(subItem.text, usableWidth - 25);
                    subItemLines.forEach((line, index) => {
                        doc.text(line, margin + 23, currentY + (index * 4));
                    });
                    currentY += subItemLines.length * 4 + 3;
                });
            }
        });

        // 10. Unless clause
        const unlessText = "unless its airworthiness status was re-established by an approved maintenance organisation in accordance with the applicable airworthiness regulations and instructions of the type certificate holder and/or supplemental type certificate holder and/or OEM of the part, and supported by an authorised airworthiness release certificate.";
        const unlessLines = doc.splitTextToSize(unlessText, usableWidth - 15);
        unlessLines.forEach(line => {
            doc.text(line, margin + 15, currentY);
            currentY += 4;
        });
        currentY += 8;

        // 11. Second numbered item
        doc.text("2.", margin, currentY);
        const item2Text = "No part has been installed on the aircraft which was obtained from a military source or was previously fitted to a state aircraft as deemed by Article 3 of the Chicago Convention.";
        const item2Lines = doc.splitTextToSize(item2Text, usableWidth - 10);
        item2Lines.forEach((line, index) => {
            doc.text(line, margin + 8, currentY + (index * 4));
        });
        currentY += item2Lines.length * 4 + 15;

        // 12. Signee Section
        doc.setFont("helvetica", "bold");
        doc.text("Authorised Airline Representative", margin, currentY);
        currentY += 10;

        // Use centralized signee system
        const signeeDetails = nisData.signedBy ? await getSigneeById(nisData.signedBy) : null;
        if (signeeDetails) {
            // Signature image
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
                        doc.addImage(signeeDetails.signatureBase64, 'PNG', margin + 25, currentY, sigW, sigH);
                        currentY += sigH + 3;
                    }
                } catch (e) {
                    console.error("Signature error:", e);
                }
            }

            // Signature line and labels with title/position
            doc.setFont("helvetica", "normal");
            doc.text("Signature: ______________________", margin, currentY);
            currentY += 8;
            doc.text(`Name: ${signeeDetails.name || '______________________'}`, margin, currentY);
            currentY += 8;
            // Use centralized title field or default
            doc.text(`Position: ${signeeDetails.title || '______________________'}`, margin, currentY);
        } else {
            doc.setFont("helvetica", "normal");
            doc.text("Signature: ______________________", margin, currentY);
            currentY += 8;
            doc.text("Name: ______________________", margin, currentY);
            currentY += 8;
            doc.text("Position: ______________________", margin, currentY);
        }

        currentY += 15;

        // 13. Note at bottom
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        const noteText = "Note: Please see also the Guidelines for understanding the Incident / Accident Clearance Statement (ICS) associated with this form.";
        const noteLines = doc.splitTextToSize(noteText, usableWidth);
        noteLines.forEach(line => {
            doc.text(line, margin, currentY);
            currentY += 3.5;
        });

        // Save PDF
        doc.save(generatedPdfFileName);
        
        // Hide spinner and show success message
        hideLoadingSpinner();
        showToast(`NIS "${generatedPdfFileName}" generated and data saved!`);
        console.log("NIS PDF generation complete.");
        
    } catch (error) {
        hideLoadingSpinner();
        console.error("Error generating NIS PDF:", error);
        showToast("An error occurred while generating the NIS PDF: " + error.message, 5000);
    }
}

// Save NIS data to Firestore
async function saveNisDataToFirestore(nisData, pdfFileName) {
    const nisRecord = {
        nis: nisData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        pdfFileName: pdfFileName
    };
    try {
        const docRef = await db.collection(SAVED_NIS_COLLECTION_LOAD).add(nisRecord);
        return docRef.id;
    } catch (error) {
        console.error("Error writing NIS data:", error);
        throw error;
    }
}

// Helper functions (reuse from other modules)
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