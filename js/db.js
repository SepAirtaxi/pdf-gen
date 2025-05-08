// js/db.js

// Generic function to get all documents from a collection
async function getAllDocs(collectionName) {
    // console.log(`getAllDocs called for: ${collectionName}`); 
    if (!db) { console.error(`Firestore 'db' not available in getAllDocs for ${collectionName}.`); return []; }
    try {
        const snapshot = await db.collection(collectionName).get();
        // console.log(`getAllDocs successful for ${collectionName}, docs count: ${snapshot.docs.length}`); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { console.error(`Error fetching collection ${collectionName}:`, error); return []; }
}

// Generic function to add a document to a collection
async function addDoc(collectionName, data) {
    // console.log(`addDoc called for: ${collectionName}`);
    if (!db) { console.error(`Firestore 'db' not available in addDoc for ${collectionName}.`); throw new Error("Firestore not initialized"); }
    try {
        const docRef = await db.collection(collectionName).add(data);
        // console.log(`addDoc successful for ${collectionName}, new ID: ${docRef.id}`);
        return docRef.id;
    } catch (error) { console.error(`Error adding document to ${collectionName}: `, error); throw error; }
}

// Generic function to update a document in a collection
async function updateDoc(collectionName, docId, data) {
    // console.log(`updateDoc called for: ${collectionName}/${docId}`);
    if (!db) { console.error(`Firestore 'db' not available in updateDoc for ${collectionName}/${docId}.`); throw new Error("Firestore not initialized"); }
    if (!docId) { console.error("updateDoc called with invalid docId:", docId); throw new Error("Invalid document ID"); }
    try {
        await db.collection(collectionName).doc(docId).update(data);
        // console.log(`Document in ${collectionName} with ID ${docId} updated successfully.`);
    } catch (error) { console.error(`Error updating document ${docId} in ${collectionName}: `, error); throw error; }
}

// Generic function to delete a document from a collection
async function deleteDoc(collectionName, docId) {
    // console.log(`deleteDoc called for: ${collectionName}/${docId}`);
     if (!db) { console.error(`Firestore 'db' not available in deleteDoc for ${collectionName}/${docId}.`); throw new Error("Firestore not initialized"); }
    if (!docId) { console.error("deleteDoc called with invalid docId:", docId); throw new Error("Invalid document ID"); }
    try {
        await db.collection(collectionName).doc(docId).delete();
        // console.log(`Document in ${collectionName} with ID ${docId} deleted successfully.`);
    } catch (error) { console.error(`Error deleting document ${docId} from ${collectionName}: `, error); throw error; }
}

// Function to get a document by ID - *** CORRECTED .exists CHECK ***
async function getDocById(collectionName, docId) {
    console.log(`getDocById called for: ${collectionName}/${docId}`); 
     if (!db) { console.error(`Firestore 'db' not available in getDocById for ${collectionName}/${docId}.`); return null; }
    if (!docId || typeof docId !== 'string' || docId.trim() === '') { console.error(`Invalid docId: "${docId}" for collection "${collectionName}"`); return null; }
    
    try {
        const docRef = db.collection(collectionName).doc(docId);
        // console.log(`[getDocById] Getting snapshot for: ${collectionName}/${docId}`); 
        const docSnap = await docRef.get(); 
        // console.log(`[getDocById] Snapshot received for ${collectionName}/${docId}. Type: ${typeof docSnap}, Exists property value: ${docSnap?.exists}`); // Log the boolean value directly

        // *** CORRECTED CHECK: Use the boolean property docSnap.exists ***
        if (docSnap && typeof docSnap.exists === 'boolean' && docSnap.exists === true) {
            // console.log(`[getDocById] Document exists for ${collectionName}/${docId}`);
            return { id: docSnap.id, ...docSnap.data() };
        } else if (docSnap && typeof docSnap.exists === 'boolean' && docSnap.exists === false) {
             console.warn(`[getDocById] Document NOT found for ${collectionName}/${docId}`);
             return null; 
        } else {
            // This case means docSnap wasn't a proper snapshot object or .exists wasn't a boolean
            console.error(`[getDocById] Invalid snapshot object received for ${collectionName}/${docId}. Snapshot:`, docSnap);
            return null;
        }
    } catch (error) {
        console.error(`[getDocById] Error fetching document ${docId} from ${collectionName}:`, error);
        return null; 
    }
}

// Function to get a sequential ID - *** CORRECTED .exists CHECK ***
async function getNextInvoiceSequentialId(toEntityName) {
    console.log("getNextInvoiceSequentialId called");
     if (!db) { console.error("Firestore 'db' not available in getNextInvoiceSequentialId."); return "ERR"; }
    const counterRef = db.collection('counters').doc('invoiceCounter');
    try {
        return await db.runTransaction(async (transaction) => { // Added await here
            console.log("[Transaction] Getting counter document...");
            const counterDoc = await transaction.get(counterRef);
            console.log(`[Transaction] Counter doc received. Exists property value: ${counterDoc?.exists}`);
            
            let newCount = 1;
            // *** CORRECTED CHECK: Use the boolean property counterDoc.exists ***
            if (counterDoc && typeof counterDoc.exists === 'boolean' && counterDoc.exists === true) {
                newCount = (counterDoc.data()?.count || 0) + 1; 
                console.log(`[Transaction] Incrementing counter to ${newCount}.`);
                transaction.update(counterRef, { count: newCount });
            } else if (counterDoc && typeof counterDoc.exists === 'boolean' && counterDoc.exists === false) {
                console.log("[Transaction] Counter document doesn't exist, creating with count 1.");
                transaction.set(counterRef, { count: newCount });
            } else {
                 console.error("[Transaction] Invalid counterDoc snapshot received:", counterDoc);
                 throw new Error("Invalid counter document snapshot in transaction."); // Throw error to abort transaction
            }
            return String(newCount).padStart(3, '0');
        });
    } catch (error) {
        console.error("Sequential ID Transaction failed: ", error);
        return "RND" + String(Math.floor(Math.random() * 1000)).padStart(3, '0'); 
    }
}