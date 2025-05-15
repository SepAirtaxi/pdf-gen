// js/invoice-pdf.js
const { jsPDF } = window.jspdf; 

// Helper function to show the loading spinner
function showLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.add('active');
    }
}

// Helper function to hide the loading spinner
function hideLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.remove('active');
    }
}

// Helper function to show a toast notification
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    
    if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        // Auto-hide after duration
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
}

// Helper function to add page numbers
function addPageNumbers(doc, pageCount, margin, pageHeight, pageWidth, pageNumY) {
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); 
        doc.setFontSize(8); 
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0); 
        const pageNumText = `Page ${i} of ${pageCount}`;
        doc.text(pageNumText, pageWidth - margin, pageNumY, { align: 'right' }); 
    }
}

async function generateInvoicePDF() {
    console.log("Starting PDF generation (Layout Fix 6 - Final Alignment)...");
    
    // Show loading spinner first
    showLoadingSpinner();
    
    try {
        const generalData = getGeneralFormData(); 
        const itemsData = getItemsTableData();     
        const colliData = getColliTableData();     
        if (!generalData.from || !generalData.to || !generalData.date) { 
            hideLoadingSpinner(); // Hide spinner
            showToast("Please select 'From', 'To' entities and Date.", 5000); 
            return; 
        }

        const toEntityNameClean = generalData.toEntityName ? generalData.toEntityName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'entity';
        let sequentialIdForName = 'XXXX';
        try { sequentialIdForName = await getNextInvoiceSequentialId(toEntityNameClean); } 
        catch (seqError) { console.error("Error getting sequential ID:", seqError); }
        
        // Use the selected invoice type in the filename (or default to "Proforma")
        const invoiceType = generalData.invoiceType || 'Proforma Invoice';
        const invoiceTypeForFilename = invoiceType.replace('Invoice', '').trim();
        const generatedPdfFileName = `${invoiceTypeForFilename}_${toEntityNameClean}_${sequentialIdForName}.pdf`;
        console.log("Generated PDF Filename:", generatedPdfFileName);

        let savedInvoiceId;
        try {
            savedInvoiceId = await saveInvoiceDataToFirestore(generalData, itemsData, colliData, generatedPdfFileName);
            console.log("Invoice data saved with ID:", savedInvoiceId);
            if (typeof populateSavedInvoicesDropdown === "function") { populateSavedInvoicesDropdown(); }
        } catch (error) { 
            console.error("Error saving invoice data:", error); 
            hideLoadingSpinner(); // Hide spinner
            showToast("Error saving: " + error.message, 5000); 
            return; 
        }

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;
        const usableWidth = pageWidth - 2 * margin;
        let currentY = margin; 

        // --- PDF Content ---

        // A. Company Header ---
        console.log("Fetching company details...");
        const companyDetails = await getDocById(COMPANY_SETTINGS_COLLECTION, COMPANY_DETAILS_DOC_ID); 
        console.log("Company Details Fetched:", companyDetails);
        const companyHeaderStartY = currentY;
        let logoEndY = companyHeaderStartY; // Y position after the logo is drawn

        if (companyDetails && companyDetails.logoBase64) {
            try {
                const img = new Image(); img.src = companyDetails.logoBase64;
                await new Promise((resolve, reject) => { img.onload=resolve; img.onerror=reject; });
                if(img.width > 0 && img.height > 0) {
                    let logoWidth = 35 * 1.15; 
                    let logoHeight = (img.height * logoWidth) / img.width;
                    const logoMaxHeight = 25; 
                    if (logoHeight > logoMaxHeight) { logoWidth = (img.width * logoMaxHeight) / img.height; logoHeight = logoMaxHeight; }
                    doc.addImage(companyDetails.logoBase64, 'PNG', margin, currentY, logoWidth, logoHeight);
                    logoEndY = currentY + logoHeight;
                } else { console.warn("Logo Base64 invalid."); logoEndY = currentY; } // Keep currentY if logo fails
            } catch (e) { console.error("Logo processing error:", e); logoEndY = currentY; }
        } else {
            logoEndY = currentY; // If no logo, text starts at the top margin
        }
        
        // *** Start text BELOW logo/start Y + padding ***
        currentY = logoEndY + 8; // Start text Y below logo end Y + padding
        let companyTextEndY = currentY; // Track end of text from this new start

        if (companyDetails) {
            const textX = margin; // Always start text at the left margin
            doc.setFontSize(10); doc.setFont("helvetica", "bold");
            if (companyDetails.companyName) {doc.text(companyDetails.companyName, textX, currentY); currentY += 4.5;}
            doc.setFontSize(8); doc.setFont("helvetica", "normal");
            let addrLine1 = companyDetails.address1 || ''; let addrLine2 = companyDetails.address2 || '';
            let zipCity = [companyDetails.zipCode, companyDetails.city].filter(Boolean).join(' '); let country = companyDetails.country || '';
            let fullAddrLine = [addrLine1, zipCity, country].filter(Boolean).join(' // ');
            if(fullAddrLine) { doc.text(fullAddrLine, textX, currentY); currentY += 3.5; }
            if(addrLine2) { doc.text(addrLine2, textX, currentY); currentY += 3.5; }
            let contactLine = [ companyDetails.phone ? `Ph.: ${companyDetails.phone}` : null, companyDetails.email ? `Email: ${companyDetails.email}` : null, companyDetails.website ? companyDetails.website : null ].filter(Boolean).join(' // ');
            if(contactLine) { doc.text(contactLine, textX, currentY); currentY += 3.5; }
            let regLine = [ companyDetails.vatNumber ? `VAT: ${companyDetails.vatNumber}` : null, companyDetails.easaApproval ? `EASA: ${companyDetails.easaApproval}` : null ].filter(Boolean).join(' // ');
            if(regLine) { doc.text(regLine, textX, currentY); currentY += 3.5; }
            companyTextEndY = currentY; // Update final text position
        } else { companyTextEndY = logoEndY + 5; } // Minimal space if no text details
        
        // End Y for the whole header section is now just the text end Y
        const companyHeaderEndY = companyTextEndY;
        
        // B. PDF Info & Declaration Box (Top Right) ---
        const topRightStartY = companyHeaderStartY; // Align top of this content block with top margin
        const rightColumnX = pageWidth - margin; 
        let topRightInfoY = topRightStartY; 
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150); 
        doc.text(generatedPdfFileName + ` - ${generalData.date}`, rightColumnX, topRightInfoY, { align: 'right' });
        topRightInfoY += 4; 
        const pageNumY = topRightInfoY; // Store Y pos for page number function
        topRightInfoY += 4; // Space after page number line

        let declarationBoxEndY = topRightInfoY; 
        let signeeDetails = generalData.signedBy ? await getDocById(SIGNEES_COLLECTION, generalData.signedBy) : null;
        if (signeeDetails) {
            const boxWidth = 70; 
            const boxHeight = 30; 
            const boxX = rightColumnX - boxWidth; 
            const boxY = pageNumY + 2; // Start box below page number Y
            declarationBoxEndY = boxY + boxHeight;

            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.1); doc.rect(boxX, boxY, boxWidth, boxHeight); 

            doc.setFontSize(7.5); doc.setTextColor(0, 0, 0); 
            let textYInBox = boxY + 2; // CHANGE: Further reduced top padding from 3 to 2
            const declarationText = "I declare the below information to be true and correct.";
            const splitDeclText = doc.splitTextToSize(declarationText, boxWidth - 2); // CHANGE: Further reduced side padding from 4 to 2
            doc.text(splitDeclText, boxX + boxWidth / 2, textYInBox, { align: 'center', baseline: 'top' });
            textYInBox += (splitDeclText.length * 3) + 2; // Keep this spacing

            const signedByText = `Signed by: ${signeeDetails.name || 'N/A'}`;
            doc.text(signedByText, boxX + boxWidth / 2, textYInBox, { align: 'center' });
            textYInBox += 3; // CHANGE: Reduced space before signature from 4 to 3

            if (signeeDetails.signatureBase64) {
                try { 
                    const sigImg = new Image();
                    sigImg.src = signeeDetails.signatureBase64;
                    await new Promise((res, rej) => {
                        sigImg.onload = res;
                        sigImg.onerror = rej;
                    });
                    
                    if (sigImg.width > 0 && sigImg.height > 0) {
                        // Allow more space at bottom of box
                        const sigMaxH = boxHeight - (textYInBox - boxY) - 2.5; // FIXED: Reduced from 5 to 2.5 (50% reduction)
                        const sigMaxW = boxWidth - 10;
                        let sigW = sigImg.width;
                        let sigH = sigImg.height;
                        // Using a scaling factor of 1.0 instead of 1.2 to make signature smaller
                        const r = Math.min(sigMaxW/sigW, sigMaxH/sigH);
                        sigW = sigW * r * 1.0; // Reduced from 1.20 to 1.0 for smaller signature
                        sigH = sigH * r * 1.0; // Reduced from 1.20 to 1.0 for smaller signature
                        const sigX = boxX + (boxWidth - sigW) / 2;
                        doc.addImage(signeeDetails.signatureBase64, 'PNG', sigX, textYInBox, sigW, sigH);
                    } else {
                        doc.text("(Inv Sig)", boxX + 3, textYInBox + 3);
                    }
                } catch (e) { 
                    console.error("Sig err:", e); 
                    doc.text("(Sig Error)", boxX + 3, textYInBox + 3); 
                }
            } else { 
                doc.text("(No signature)", boxX + boxWidth / 2, textYInBox + 3, { align: 'center' }); 
            }
        } 

        // Reset main Y position below the taller of the two top sections
        currentY = Math.max(companyHeaderEndY, declarationBoxEndY) + 8; 
        console.log("After Top Sections, Y:", currentY);

        // C. Invoice Title (Use selected invoice type) --- 
        doc.setFontSize(20); doc.setFont("helvetica", "bold");
        const titleText = generalData.invoiceType || "Proforma Invoice"; // Use the selected invoice type
        const titleWidth = doc.getTextWidth(titleText);
        doc.text(titleText, (pageWidth - titleWidth) / 2, currentY);
        currentY += 3; // *** Further reduced space below title ***
        console.log("After Title, Y:", currentY);

        // D. From / To Addresses Table --- (Keep as is)
        const fromEntityDetails = generalData.from ? await getDocById(ENTITIES_COLLECTION, generalData.from) : null;
        const toEntityDetails = generalData.to ? await getDocById(ENTITIES_COLLECTION, generalData.to) : null;
        const fromToData = []; const maxLines=8; for(let i=0;i<maxLines;i++)fromToData.push(['','']);
        let lineFrom=0; if(fromEntityDetails){/* Populate fromToData[lineFrom++][0] */}
        let lineTo=0; if(toEntityDetails){/* Populate fromToData[lineTo++][1] */}
        if(fromEntityDetails){if(fromEntityDetails.companyName)fromToData[lineFrom++][0]=fromEntityDetails.companyName; let fa1=fromEntityDetails.address1||''; if(fromEntityDetails.co)fa1=`C/O ${fromEntityDetails.co}, ${fa1}`; if(fa1)fromToData[lineFrom++][0]=fa1; if(fromEntityDetails.address2)fromToData[lineFrom++][0]=fromEntityDetails.address2; let fzc=[fromEntityDetails.zipCode,fromEntityDetails.city].filter(Boolean).join(' '); if(fzc)fromToData[lineFrom++][0]=fzc; if(fromEntityDetails.country)fromToData[lineFrom++][0]=fromEntityDetails.country; if(fromEntityDetails.vatEori)fromToData[lineFrom++][0]=`VAT/EORI: ${fromEntityDetails.vatEori}`; if(fromEntityDetails.email)fromToData[lineFrom++][0]=`Email: ${fromEntityDetails.email}`; if(fromEntityDetails.phone)fromToData[lineFrom++][0]=`Phone: ${fromEntityDetails.phone}`;}
        if(toEntityDetails){if(toEntityDetails.companyName)fromToData[lineTo++][1]=toEntityDetails.companyName; let ta1=toEntityDetails.address1||''; if(toEntityDetails.co)ta1=`C/O ${toEntityDetails.co}, ${ta1}`; if(ta1)fromToData[lineTo++][1]=ta1; if(toEntityDetails.address2)fromToData[lineTo++][1]=toEntityDetails.address2; let tzc=[toEntityDetails.zipCode,toEntityDetails.city].filter(Boolean).join(' '); if(tzc)fromToData[lineTo++][1]=tzc; if(toEntityDetails.country)fromToData[lineTo++][1]=toEntityDetails.country; if(toEntityDetails.vatEori)fromToData[lineTo++][1]=`VAT/EORI: ${toEntityDetails.vatEori}`; if(toEntityDetails.email)fromToData[lineTo++][1]=`Email: ${toEntityDetails.email}`; if(toEntityDetails.phone)fromToData[lineTo++][1]=`Phone: ${toEntityDetails.phone}`;}
        while(fromToData.length > 0 && fromToData[fromToData.length-1][0] === '' && fromToData[fromToData.length-1][1] === '') fromToData.pop();
        const fromToColWidth = (usableWidth / 2); 
        doc.autoTable({
            startY: currentY, head: [['From:', 'To:']], body: fromToData, theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1, valign: 'top', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] }, 
            headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold', cellPadding: 1 }, 
            columnStyles: { 0: { cellWidth: fromToColWidth }, 1: { cellWidth: fromToColWidth } }, 
            margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY + 5; 
        console.log("After From/To Table, Y:", currentY);

        // E. & F. Split Details & Statements Tables --- (Keep as is)
        const detailsTableStartY = currentY;
        let detailsTableEndY = currentY; let statementsTableEndY = currentY;
        const detailsBodyData = [];
        const detailLabels = ["Date:", "Location:", "Total Value:", "Total Weight KG:", "Commodity Code:", "Shipment Ref:", "Priority:", "Incoterms:"];
        const detailValues = [ generalData.date, generalData.location, `${generalData.totalValue} ${generalData.currency || ''}`, generalData.totalWeight, generalData.commodityCode, generalData.shipmentRef, generalData.priority, generalData.incoterms ];
        for (let i = 0; i < detailLabels.length; i++) { detailsBodyData.push([ detailLabels[i], detailValues[i] || '' ]); }
        const detailsTableWidth = 95; const statementsTableWidth = usableWidth - detailsTableWidth; 
        const detailsColWidths = [35, detailsTableWidth - 35]; 
        doc.autoTable({ // Details Table
            startY: detailsTableStartY, body: detailsBodyData, theme: 'grid', 
            styles: { fontSize: 8, cellPadding: 1, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] }, 
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: detailsColWidths[0], fillColor: [230, 230, 230] }, 1: { cellWidth: detailsColWidths[1] } },
            tableWidth: detailsTableWidth, margin: { left: margin, right: pageWidth - margin - detailsTableWidth } 
        });
        detailsTableEndY = doc.lastAutoTable.finalY;
        const statementsBodyData = [];
        if (generalData.selectedStatements && generalData.selectedStatements.length > 0) { generalData.selectedStatements.forEach(stmt => { statementsBodyData.push([stmt]); }); }
        if (statementsBodyData.length > 0) { // Statements Table
            const statementsTableStartX = margin + detailsTableWidth; 
            doc.autoTable({
                startY: detailsTableStartY, head: [['Statements:']], body: statementsBodyData, theme: 'grid', 
                styles: { fontSize: 8, cellPadding: 1, valign: 'top', lineColor: [0, 0, 0], lineWidth: 0.1, overflow: 'linebreak', textColor: [0,0,0] }, 
                headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold', cellPadding: 1 }, 
                columnStyles: { 0: { cellWidth: statementsTableWidth } }, 
                tableWidth: statementsTableWidth, margin: { left: statementsTableStartX, right: margin } 
            });
            statementsTableEndY = doc.lastAutoTable.finalY;
        } else { statementsTableEndY = detailsTableEndY; }
        currentY = Math.max(detailsTableEndY, statementsTableEndY) + 8; 
        console.log("After Details/Statements Tables, Y:", currentY);

        // G. Items Table --- 
        doc.setFontSize(10); doc.setFont("helvetica", "bold");
        const itemsTitleText = "Items:"; const itemsTitleWidth = doc.getTextWidth(itemsTitleText);
        doc.text(itemsTitleText, (pageWidth - itemsTitleWidth) / 2, currentY); 
        currentY += 3; 
        const itemsTableHeaders = [["#", "UOM", "PN", "SN", "Description", "Origin", `Value ${generalData.currency || ''}`]];
        const itemsTableBodyData = itemsData.filter(item => item.pn||item.description||item.qty).map((item, index) => [ (index + 1).toString(), item.uom || '', item.pn || '', item.sn || '', item.description || '', item.origin || '', parseFloat(item.value || 0).toFixed(2) ]);
        const itemColWidths = { num: 8, uom: 12, origin: 18, value: 22, pn: 40, sn: 40 }; 
        let usedWidthItems = itemColWidths.num + itemColWidths.uom + itemColWidths.origin + itemColWidths.value + itemColWidths.pn + itemColWidths.sn;
        itemColWidths.description = Math.max(10, usableWidth - usedWidthItems); 
        doc.autoTable({ 
            startY: currentY, head: itemsTableHeaders, body: itemsTableBodyData, theme: 'grid', 
            styles: { fontSize: 8, cellPadding: 1, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] }, 
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center', cellPadding: 1 }, // *** Reduced head padding ***
            bodyStyles: { halign: 'center'}, // CHANGE: Set all body cells centered by default
            columnStyles: { 
                0: { cellWidth: itemColWidths.num, halign: 'center' }, 
                1: { cellWidth: itemColWidths.uom, halign: 'center' }, 
                2: { cellWidth: itemColWidths.pn, halign: 'center' }, 
                3: { cellWidth: itemColWidths.sn, halign: 'center' }, 
                4: { cellWidth: itemColWidths.description, halign: 'center' }, 
                5: { cellWidth: itemColWidths.origin, halign: 'center' }, 
                6: { cellWidth: itemColWidths.value, halign: 'center' } // FIXED: Now center-aligned as requested
            },
            margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY + 8;
        console.log("After Items Table, Y:", currentY);

        // H. Colli Table ---
        doc.setFontSize(10); doc.setFont("helvetica", "bold");
        const colliTitleText = "All packed in:"; const colliTitleWidth = doc.getTextWidth(colliTitleText);
        doc.text(colliTitleText, (pageWidth - colliTitleWidth) / 2, currentY); 
        currentY += 3; 
        const colliTableHeaders = [["#", "Packing", "Length CM", "Width CM", "Height CM", "Weight KG"]];
        const colliTableBodyData = colliData.filter(colli => colli.packing || colli.length || colli.weight).map((colli, index) => [ (index + 1).toString(), colli.packing || '', colli.length || '', colli.width || '', colli.height || '', parseFloat(colli.weight || 0).toFixed(2) ]);
        if (colliTableBodyData.length > 0) {
            doc.autoTable({ 
                startY: currentY, head: colliTableHeaders, body: colliTableBodyData, theme: 'grid', 
                styles: { fontSize: 8, cellPadding: 1, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] }, 
                headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center', cellPadding: 1 }, // *** Reduced head padding ***
                bodyStyles: { halign: 'center' }, // CHANGE: Set all cells to center-aligned by default
                columnStyles: { 
                    0: { cellWidth: 10, halign: 'center' }, 
                    1: { cellWidth: 'auto', halign: 'center' }, // CHANGE: Changed from left to center alignment
                    2: { cellWidth: 25, halign: 'center' }, 
                    3: { cellWidth: 25, halign: 'center' }, 
                    4: { cellWidth: 25, halign: 'center' }, 
                    5: { cellWidth: 25, halign: 'center' }  
                },
                margin: { left: margin, right: margin }
            });
        } else { doc.setFontSize(8); doc.text("No packing details provided.", margin, currentY); }
        console.log("After Colli Table, Y:", currentY);

        // I. Page Numbering (Final Update) ---
        const pageCount = doc.internal.getNumberOfPages();
        addPageNumbers(doc, pageCount, margin, pageHeight, pageWidth, pageNumY); // Use helper
        console.log("Page numbers added.");

        doc.save(generatedPdfFileName); 
        
        // Hide spinner and show toast notification
        hideLoadingSpinner();
        
        // Show toast notification instead of alert
        showToast(`PDF "${generatedPdfFileName}" generated and data saved!`);
        console.log("PDF generation complete.");
    } catch (error) {
        // Ensure spinner is hidden in case of any errors
        hideLoadingSpinner();
        console.error("Error generating PDF:", error);
        showToast("An error occurred while generating the PDF: " + error.message, 5000);
    }
}

// --- DATA SAVING FUNCTION ---
async function saveInvoiceDataToFirestore(generalData, itemsData, colliData, pdfFileName) { 
    const invoiceRecord = { general: generalData, items: itemsData, collis: colliData, createdAt: firebase.firestore.FieldValue.serverTimestamp(), pdfFileName: pdfFileName };
    try { const docRef = await db.collection(SAVED_INVOICES_COLLECTION_LOAD).add(invoiceRecord); return docRef.id; } 
    catch (error) { console.error("Error writing invoice data:", error); throw error; }
}