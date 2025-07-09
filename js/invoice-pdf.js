// js/invoice-pdf.js

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
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); 
        const pageNumText = `Page ${i} of ${pageCount}`;
        doc.text(pageNumText, pageWidth - margin, pageNumY, { align: 'right' }); 
    }
}

// Helper function to format date as DD/MM/YYYY
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString; // Return original if invalid
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error("Date formatting error:", e);
        return dateString; // Return original string if error
    }
}

async function generateInvoicePDF() {
    console.log("Starting PDF generation...");
    
    // Show loading spinner first
    showLoadingSpinner();
    
    try {
        // Initialize jsPDF here when we're certain the library is loaded
        const { jsPDF } = window.jspdf;
        
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
                    // Increased logo size by 30% as requested
                    let logoWidth = 35 * 1.5; // Changed from 1.15 to 1.5 (30% increase)
                    let logoHeight = (img.height * logoWidth) / img.width;
                    const logoMaxHeight = 32; // Increased from 25 to 32 (30% increase)
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
            if (companyDetails.companyName) {
                doc.text(companyDetails.companyName, textX, currentY);
                currentY += 4.5;
            }
            doc.setFontSize(8); doc.setFont("helvetica", "normal");
            let addrLine1 = companyDetails.address1 || ''; let addrLine2 = companyDetails.address2 || '';
            let zipCity = [companyDetails.zipCode, companyDetails.city].filter(Boolean).join(' '); let country = companyDetails.country || '';
            let fullAddrLine = [addrLine1, zipCity, country].filter(Boolean).join(' // ');
            if(fullAddrLine) { 
                doc.text(fullAddrLine, textX, currentY); 
                currentY += 3.5; 
            }
            if(addrLine2) { 
                doc.text(addrLine2, textX, currentY); 
                currentY += 3.5; 
            }
            let contactLine = [ companyDetails.phone ? `Ph.: ${companyDetails.phone}` : null, companyDetails.email ? `Email: ${companyDetails.email}` : null, companyDetails.website ? companyDetails.website : null ].filter(Boolean).join(' // ');
            if(contactLine) { 
                doc.text(contactLine, textX, currentY); 
                currentY += 3.5; 
            }
            let regLine = [ companyDetails.vatNumber ? `VAT: ${companyDetails.vatNumber}` : null, companyDetails.easaApproval ? `EASA: ${companyDetails.easaApproval}` : null ].filter(Boolean).join(' // ');
            if(regLine) { 
                doc.text(regLine, textX, currentY); 
                currentY += 3.5; 
            }
            companyTextEndY = currentY; // Update final text position
        } else { companyTextEndY = logoEndY + 5; } // Minimal space if no text details
        
        // End Y for the whole header section is now just the text end Y
        const companyHeaderEndY = companyTextEndY;
        
        // B. PDF Info & Declaration Box (Top Right) ---
        const topRightStartY = companyHeaderStartY; // Align top of this content block with top margin
        const rightColumnX = pageWidth - margin; 
        let topRightInfoY = topRightStartY; 
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150); 
        doc.text(`${generatedPdfFileName} - ${generalData.date}`, rightColumnX, topRightInfoY, { align: 'right' });
        topRightInfoY += 4; 
        const pageNumY = topRightInfoY; // Store Y pos for page number function
        topRightInfoY += 4; // Space after page number line

        let declarationBoxEndY = topRightInfoY; 
        // Use centralized signee system
        let signeeDetails = generalData.signedBy ? await getSigneeById(generalData.signedBy) : null;
        if (signeeDetails) {
            // Increased box width to accommodate full declaration text
            const boxWidth = 58; // Increased from 50 to fit the full statement
            const boxHeight = 22; // Keep height the same
            const boxX = rightColumnX - boxWidth; 
            const boxY = pageNumY + 2; // Start box below page number Y
            declarationBoxEndY = boxY + boxHeight;

            // Increased line width (thickness) for the box border
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); // Increased from 0.1 to 0.3
            doc.rect(boxX, boxY, boxWidth, boxHeight); 

            // Reduced font size for declaration and ensure it fits
            doc.setFontSize(6); // Reduced to ensure text fits within box
            doc.setTextColor(0, 0, 0); 
            let textYInBox = boxY + 2; 
            const declarationText = "I declare the below information to be true and correct.";
            const splitDeclText = doc.splitTextToSize(declarationText, boxWidth - 4); // Ensure it fits within box
            doc.text(splitDeclText, boxX + boxWidth / 2, textYInBox, { align: 'center', baseline: 'top' });
            textYInBox += (splitDeclText.length * 3) + 1; // Reduced space after text

            // Include title/position if available
            const signedByText = signeeDetails.title ? 
                `Signed by: ${signeeDetails.name || 'N/A'}, ${signeeDetails.title}` : 
                `Signed by: ${signeeDetails.name || 'N/A'}`;
            doc.text(signedByText, boxX + boxWidth / 2, textYInBox, { align: 'center' });
            textYInBox += 2; // Further reduced space before signature

            if (signeeDetails.signatureBase64) {
                try { 
                    const sigImg = new Image();
                    sigImg.src = signeeDetails.signatureBase64;
                    await new Promise((res, rej) => {
                        sigImg.onload = res;
                        sigImg.onerror = rej;
                    });
                    
                    if (sigImg.width > 0 && sigImg.height > 0) {
                        // Increased signature size by 15%
                        const sigMaxH = boxHeight - (textYInBox - boxY) - 2;
                        const sigMaxW = boxWidth - 8; // Reduced max width
                        let sigW = sigImg.width;
                        let sigH = sigImg.height;
                        // Increased scaling factor by 15%
                        const r = Math.min(sigMaxW/sigW, sigMaxH/sigH);
                        sigW = sigW * r * 0.92; // Increased from 0.8 to 0.92 (15% increase)
                        sigH = sigH * r * 0.92; // Increased from 0.8 to 0.92 (15% increase)
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
        // Changed title color to medium gray as requested
        doc.setTextColor(120, 120, 120); // Medium gray color
        doc.text(titleText, (pageWidth - titleWidth) / 2, currentY);
        currentY += 3; // *** Further reduced space below title ***
        doc.setTextColor(0, 0, 0); // Reset text color to black
        console.log("After Title, Y:", currentY);

        // D. From / To Addresses Table --- PROPER TWO-ROW TABLE WITH DYNAMIC HEIGHT
        const fromEntityDetails = generalData.from ? await getDocById(ENTITIES_COLLECTION, generalData.from) : null;
        const toEntityDetails = generalData.to ? await getDocById(ENTITIES_COLLECTION, generalData.to) : null;
        
        // Table configuration
        const columnWidth = usableWidth / 2;
        const fromHeaderX = margin;
        const toHeaderX = margin + columnWidth;
        const headerHeight = 5;
        
        // Prepare data sections first to calculate dynamic height
        let fromLines = [];
        if (fromEntityDetails) {
            if (fromEntityDetails.companyName) fromLines.push(fromEntityDetails.companyName);
            if (fromEntityDetails.co) fromLines.push("C/O " + fromEntityDetails.co);
            if (fromEntityDetails.address1) fromLines.push(fromEntityDetails.address1);
            if (fromEntityDetails.address2) fromLines.push(fromEntityDetails.address2);
            
            let zipCityState = "";
            if (fromEntityDetails.zipCode) zipCityState += fromEntityDetails.zipCode + " ";
            if (fromEntityDetails.city) zipCityState += fromEntityDetails.city;
            if (zipCityState) fromLines.push(zipCityState);
            
            if (fromEntityDetails.country) fromLines.push(fromEntityDetails.country);
            if (fromEntityDetails.vatEori) fromLines.push("VAT/EORI: " + fromEntityDetails.vatEori);
            if (fromEntityDetails.email) fromLines.push("Email: " + fromEntityDetails.email);
            if (fromEntityDetails.phone) fromLines.push("Phone: " + fromEntityDetails.phone);
        }
        
        let toLines = [];
        if (toEntityDetails) {
            if (toEntityDetails.companyName) toLines.push(toEntityDetails.companyName);
            if (toEntityDetails.co) toLines.push("C/O " + toEntityDetails.co);
            if (toEntityDetails.address1) toLines.push(toEntityDetails.address1);
            if (toEntityDetails.address2) toLines.push(toEntityDetails.address2);
            
            let zipCityState = "";
            if (toEntityDetails.zipCode) zipCityState += toEntityDetails.zipCode + " ";
            if (toEntityDetails.city) zipCityState += toEntityDetails.city;
            if (zipCityState) toLines.push(zipCityState);
            
            if (toEntityDetails.country) toLines.push(toEntityDetails.country);
            if (toEntityDetails.vatEori) toLines.push("VAT/EORI: " + toEntityDetails.vatEori);
            if (toEntityDetails.email) toLines.push("Email: " + toEntityDetails.email);
            if (toEntityDetails.phone) toLines.push("Phone: " + toEntityDetails.phone);
        }
        
        // Calculate dynamic height based on actual content - ensure minimum content
        const maxDataLines = Math.max(fromLines.length, toLines.length, 1);
        const lineHeight = 3.5; // Height per line of text
        const cellPadding = 2; // Top and bottom padding within each cell
        const dataHeight = (maxDataLines * lineHeight) + (cellPadding * 2);
        
        // Set drawing properties
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        
        // ROW 1: Draw header cells with borders and fill
        const headerRowY = currentY;
        doc.setFillColor(230, 230, 230);
        doc.rect(fromHeaderX, headerRowY, columnWidth, headerHeight, 'FD'); // Fill and Draw borders
        doc.rect(toHeaderX, headerRowY, columnWidth, headerHeight, 'FD'); // Fill and Draw borders
        
        // Draw header text with proper vertical centering
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('From:', fromHeaderX + 1, headerRowY + 3.5);
        doc.text('To:', toHeaderX + 1, headerRowY + 3.5);
        
        // ROW 2: Draw data cells with borders and white fill
        const dataRowY = headerRowY + headerHeight;
        doc.setFillColor(255, 255, 255);
        doc.rect(fromHeaderX, dataRowY, columnWidth, dataHeight, 'FD'); // Fill and Draw borders
        doc.rect(toHeaderX, dataRowY, columnWidth, dataHeight, 'FD'); // Fill and Draw borders
        
        // Render text in data cells with proper padding from top border
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        // Calculate starting Y position for text (with padding matching left padding)
        const textStartY = dataRowY + 4; // Match the left padding of 2mm
        
        // Render From column text
        let fromTextY = textStartY;
        for (let i = 0; i < fromLines.length; i++) {
            const line = fromLines[i];
            
            // Check if this is a line that should have bold prefix
            if (line.startsWith("VAT/EORI: ") || line.startsWith("Email: ") || line.startsWith("Phone: ")) {
                const parts = line.split(": ");
                const prefix = parts[0] + ": ";
                const rest = parts.slice(1).join(": ");
                
                // Draw prefix in bold
                doc.setFont('helvetica', 'bold');
                doc.text(prefix, fromHeaderX + 2, fromTextY); // Increased left padding
                
                // Draw rest of line in normal font
                const prefixWidth = doc.getTextWidth(prefix);
                doc.setFont('helvetica', 'normal');
                doc.text(rest, fromHeaderX + 2 + prefixWidth, fromTextY);
            } else {
                // Draw regular line in normal font
                doc.setFont('helvetica', 'normal');
                doc.text(line, fromHeaderX + 2, fromTextY); // Increased left padding
            }
            
            fromTextY += lineHeight;
        }
        
        // Render To column text
        let toTextY = textStartY;
        for (let i = 0; i < toLines.length; i++) {
            const line = toLines[i];
            
            // Check if this is a line that should have bold prefix
            if (line.startsWith("VAT/EORI: ") || line.startsWith("Email: ") || line.startsWith("Phone: ")) {
                const parts = line.split(": ");
                const prefix = parts[0] + ": ";
                const rest = parts.slice(1).join(": ");
                
                // Draw prefix in bold
                doc.setFont('helvetica', 'bold');
                doc.text(prefix, toHeaderX + 2, toTextY); // Increased left padding
                
                // Draw rest of line in normal font
                const prefixWidth = doc.getTextWidth(prefix);
                doc.setFont('helvetica', 'normal');
                doc.text(rest, toHeaderX + 2 + prefixWidth, toTextY);
            } else {
                // Draw regular line in normal font
                doc.setFont('helvetica', 'normal');
                doc.text(line, toHeaderX + 2, toTextY); // Increased left padding
            }
            
            toTextY += lineHeight;
        }
        
        // Update current Y position to bottom of the entire table
        currentY = dataRowY + dataHeight;
        console.log("After From/To Table, Y:", currentY);

        // E. & F. Split Details & Statements Tables ---
        currentY += 5; // Add some spacing
        const detailsTableStartY = currentY;
        let detailsTableEndY = currentY; let statementsTableEndY = currentY;
        const detailsBodyData = [];
        const detailLabels = ["Date:", "Location:", "Total Value:", "Total Weight KG:", "Commodity Code:", "Shipment Ref:", "Priority:", "Incoterms:"];
        
        // Format the date to DD/MM/YYYY
        const formattedDate = formatDate(generalData.date);
        
        const detailValues = [ 
            formattedDate, // Use formatted date
            generalData.location, 
            `${generalData.totalValue} ${generalData.currency || ''}`, 
            generalData.totalWeight, 
            generalData.commodityCode, 
            generalData.shipmentRef, 
            generalData.priority, 
            generalData.incoterms 
        ];
        
        for (let i = 0; i < detailLabels.length; i++) { 
            detailsBodyData.push([ detailLabels[i], detailValues[i] || '' ]); 
        }
        
        const detailsTableWidth = 95; const statementsTableWidth = usableWidth - detailsTableWidth; 
        const detailsColWidths = [35, detailsTableWidth - 35]; 
        doc.autoTable({ // Details Table
            startY: detailsTableStartY, 
            body: detailsBodyData, 
            theme: 'grid', 
            styles: { 
                fontSize: 8, 
                cellPadding: {top: 0.5, bottom: 0.5, left: 1, right: 1}, // MUCH reduced padding
                valign: 'middle', 
                lineColor: [0, 0, 0], 
                lineWidth: 0.3, // Increased thickness
                textColor: [0,0,0] 
            }, 
            columnStyles: { 
                0: { fontStyle: 'bold', cellWidth: detailsColWidths[0], fillColor: [230, 230, 230] }, 
                1: { cellWidth: detailsColWidths[1] } 
            },
            tableWidth: detailsTableWidth, 
            margin: { left: margin, right: pageWidth - margin - detailsTableWidth } 
        });
        detailsTableEndY = doc.lastAutoTable.finalY;
        const statementsBodyData = [];
        if (generalData.selectedStatements && generalData.selectedStatements.length > 0) { generalData.selectedStatements.forEach(stmt => { statementsBodyData.push([stmt]); }); }
        if (statementsBodyData.length > 0) { // Statements Table
            const statementsTableStartX = margin + detailsTableWidth; 
            doc.autoTable({
                startY: detailsTableStartY, 
                head: [['Statements:']], 
                body: statementsBodyData, 
                theme: 'grid', 
                styles: { 
                    fontSize: 8, 
                    cellPadding: {top: 0.5, bottom: 0.5, left: 1, right: 1}, // MUCH reduced padding
                    valign: 'top', 
                    lineColor: [0, 0, 0], 
                    lineWidth: 0.3, // Increased thickness
                    overflow: 'linebreak', 
                    textColor: [0,0,0] 
                }, 
                headStyles: { 
                    fillColor: [230, 230, 230], 
                    textColor: 0, 
                    fontStyle: 'bold', 
                    cellPadding: {top: 0.5, bottom: 0.5, left: 1, right: 1} // MUCH reduced padding
                }, 
                columnStyles: { 0: { cellWidth: statementsTableWidth } }, 
                tableWidth: statementsTableWidth, 
                margin: { left: statementsTableStartX, right: margin } 
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
        // Added Qty to the headers
        const itemsTableHeaders = [["#", "UOM", "Qty", "PN", "SN", "Description", "Origin", `Value ${generalData.currency || ''}`]];
        // Include the qty field in the data - DEFAULT TO "1" IF NOT SPECIFIED
        const itemsTableBodyData = itemsData.filter(item => item.pn||item.description||item.qty).map((item, index) => [ 
            (index + 1).toString(), 
            item.uom || '', 
            item.qty || '1', // Default to "1" if quantity not specified
            item.pn || '', 
            item.sn || '', 
            item.description || '', 
            item.origin || '', 
            parseFloat(item.value || 0).toFixed(2) 
        ]);
        
        // Adjusted column widths to fit titles more precisely
        const itemColWidths = { 
            num: 6, // Narrower for # column
            uom: 12, // Widened UOM column slightly
            qty: 10, // Added width for Qty column
            pn: 40,
            sn: 40,
            origin: 16, // Narrower for Origin
            value: 20 // Narrower for Value
        }; 
        let usedWidthItems = itemColWidths.num + itemColWidths.uom + itemColWidths.qty + itemColWidths.origin + itemColWidths.value + itemColWidths.pn + itemColWidths.sn;
        itemColWidths.description = Math.max(10, usableWidth - usedWidthItems); 
        doc.autoTable({ 
            startY: currentY, 
            head: itemsTableHeaders, 
            body: itemsTableBodyData, 
            theme: 'grid', 
            styles: { 
                fontSize: 8, 
                cellPadding: {top: 0.5, bottom: 0.5, left: 1, right: 1}, // MUCH reduced padding
                valign: 'middle', 
                lineColor: [0, 0, 0], 
                lineWidth: 0.3, // Increased line thickness
                textColor: [0,0,0] 
            }, 
            headStyles: { 
                fillColor: [220, 220, 220], 
                textColor: 0, 
                fontStyle: 'bold', 
                halign: 'left', // Changed to left align as requested
                cellPadding: {top: 0.5, bottom: 0.5, left: 1, right: 1} // MUCH reduced padding
            }, 
            bodyStyles: { 
                halign: 'left' // Changed to left align as requested
            }, 
            columnStyles: { 
                0: { cellWidth: itemColWidths.num, halign: 'left' }, 
                1: { cellWidth: itemColWidths.uom, halign: 'left' }, 
                2: { cellWidth: itemColWidths.qty, halign: 'left' }, // Qty column style
                3: { cellWidth: itemColWidths.pn, halign: 'left' }, 
                4: { cellWidth: itemColWidths.sn, halign: 'left' }, 
                5: { cellWidth: itemColWidths.description, halign: 'left' }, 
                6: { cellWidth: itemColWidths.origin, halign: 'left' }, 
                7: { cellWidth: itemColWidths.value, halign: 'left' }
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
            // Adjusted column widths for Colli table
            doc.autoTable({ 
                startY: currentY, 
                head: colliTableHeaders, 
                body: colliTableBodyData, 
                theme: 'grid', 
                styles: { 
                    fontSize: 8, 
                    cellPadding: {top: 0.5, bottom: 0.5, left: 1, right: 1}, // MUCH reduced padding
                    valign: 'middle', 
                    lineColor: [0, 0, 0], 
                    lineWidth: 0.3, // Increased line thickness
                    textColor: [0,0,0] 
                }, 
                headStyles: { 
                    fillColor: [220, 220, 220], 
                    textColor: 0, 
                    fontStyle: 'bold', 
                    halign: 'left', // Changed to left align
                    cellPadding: {top: 0.5, bottom: 0.5, left: 1, right: 1} // MUCH reduced padding
                }, 
                bodyStyles: { 
                    halign: 'left' // Changed to left align
                }, 
                columnStyles: { 
                    0: { cellWidth: 6, halign: 'left' }, // Narrower for #
                    1: { cellWidth: 'auto', halign: 'left' }, 
                    2: { cellWidth: 22, halign: 'left' }, // Narrower for Length CM
                    3: { cellWidth: 22, halign: 'left' }, // Narrower for Width CM
                    4: { cellWidth: 22, halign: 'left' }, // Narrower for Height CM
                    5: { cellWidth: 22, halign: 'left' }  // Narrower for Weight KG
                },
                margin: { left: margin, right: margin }
            });
        } else { 
            doc.setFontSize(8);
            doc.text("No packing details provided.", margin, currentY);
        }
        console.log("After Colli Table, Y:", currentY);

        // I. Page Numbering (Final Update) ---
        const pageCount = doc.internal.getNumberOfPages();
        addPageNumbers(doc, pageCount, margin, pageHeight, pageWidth, pageNumY); // Use helper with updated bold style
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