# PDF Generator Web Application

## Overview

This web application provides a user-friendly interface for generating PDF documents, starting with Proforma Invoices for shipping purposes. It is designed for users without coding expertise to easily input data and download the corresponding PDF. The application utilizes Firebase Firestore for data storage and persistence, allowing colleagues to access and manage shared settings and saved invoice data.

The current primary module is the **Invoice Generator**. A placeholder for a **Certificate Generator** module also exists for future expansion.

## Features

*   **Modular Design:** Structured to support multiple PDF generation tools (Invoice, Certificate planned).
*   **Invoice Generator Module:**
    *   Tabbed interface for data entry: General, Items, Colli.
    *   Dynamic addition/removal of Item and Colli lines.
    *   Automatic calculation of Total Value (from Items) and Total Weight (from Colli).
    *   Data input fields include dropdowns, date pickers, and free text.
*   **Settings Management:**
    *   Centralized settings tab for managing application data.
    *   **Company Details:** Manage main company information (Name, Address, Logo, VAT, etc.) displayed on PDF headers.
    *   **Entities:** Add/Edit/Remove 'From' and 'To' shipping entities (addresses, contact info, VAT/EORI).
    *   **Currencies:** Define usable currency codes (e.g., USD, EUR).
    *   **Commodity Codes:** Manage commodity codes for selection.
    *   **Incoterms:** Manage shipping incoterms.
    *   **Statements:** Define reusable statements to be included on invoices via checkboxes.
    *   **Packing Types:** Define types of packaging (e.g., Fibreboard Box, Pallet).
    *   **Packing Templates:** Create templates for common package dimensions/weights, selectable in the Colli tab for auto-population.
    *   **Signees:** Manage users who can sign documents, including uploading signature images (stored as Base64).
*   **Data Persistence:**
    *   All settings and generated invoice data are stored in Google Firebase Firestore.
    *   Invoice data (General, Items, Colli) is automatically saved upon PDF generation.
*   **Load Previous Invoices:**
    *   A dedicated tab allows users to select and load previously saved invoice data back into the form for viewing or editing.
    *   Dropdown lists recent invoices using the generated PDF filename for easy identification.
*   **PDF Generation:**
    *   Uses `jsPDF` and `jsPDF-AutoTable` libraries to generate downloadable PDF documents.
    *   Layout includes:
        *   Fixed company header with logo.
        *   PDF filename and Date/Page Number.
        *   Signee declaration box with signature.
        *   Structured tables for From/To addresses, Shipment Details/Statements, Items, and Colli.
*   **Client-Side Operation:** Runs entirely in the web browser after initial code loading, interacting directly with Firebase services.

## Tech Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
*   **Backend/Database:** Google Firebase (Firestore)
*   **PDF Generation:** jsPDF, jsPDF-AutoTable

## Setup and Installation

Follow these steps to set up and run the application locally or deploy it.

**1. Prerequisites:**
    *   A modern web browser (Chrome, Firefox, Edge, Safari).
    *   A text editor (like VS Code, Sublime Text, Atom) for configuration.
    *   Git (optional, for cloning the repository).

**2. Firebase Project Setup:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/).
    *   Click "Add project" and follow the steps to create a new Firebase project.
    *   In your new project, navigate to **Firestore Database** (in the Build section).
    *   Click "Create database".
    *   Start in **Test Mode** (you can configure security rules later - **important for production!**). Choose a server location close to your users.
    *   Navigate to **Project settings** (click the gear icon near "Project Overview").
    *   Under the **General** tab, scroll down to **Your apps**.
    *   Click the Web icon (`</>`) to add a web app.
    *   Give your app a nickname (e.g., "PDF Generator App") and click "Register app". Firebase Hosting setup is optional at this stage.
    *   Firebase will provide you with a `firebaseConfig` object containing your project's credentials (apiKey, authDomain, projectId, etc.). **Copy this entire object.**

**3. Code Setup:**
    *   Clone the repository or download the source code files.
        ```bash
        git clone <repository-url>
        cd <repository-directory>
        ```
    *   Or, if downloaded as a ZIP, extract the files to a local directory.

**4. Firebase Configuration:**
    *   Open the file `js/firebase-config.js` in your text editor.
    *   You will see a placeholder `firebaseConfig` object.
    *   **Replace the entire placeholder object** with the actual `firebaseConfig` object you copied from the Firebase Console.
        ```javascript
        // js/firebase-config.js

        // PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE
        const firebaseConfig = {
          apiKey: "YOUR_API_KEY_FROM_FIREBASE",
          authDomain: "YOUR_AUTH_DOMAIN_FROM_FIREBASE",
          projectId: "YOUR_PROJECT_ID_FROM_FIREBASE",
          storageBucket: "YOUR_STORAGE_BUCKET_FROM_FIREBASE",
          messagingSenderId: "YOUR_MESSAGING_SENDER_ID_FROM_FIREBASE",
          appId: "YOUR_APP_ID_FROM_FIREBASE"
        };

        // ... rest of the file (initialization code) ...
        ```
    *   Save the `js/firebase-config.js` file.

**5. Company Logo (Required for PDF Header):**
    *   You need a Base64 representation of your company logo (PNG format recommended, keep file size small, e.g., < 100KB).
    *   Use an online tool (search "image to base64 converter") to convert your logo file (`.png`) into a Base64 string. Copy the *entire* string (it will start with `data:image/png;base64,...`).
    *   Run the application (see step 6).
    *   Navigate to the **Settings** tab -> **Company Details**.
    *   Paste the copied Base64 string into the appropriate field (or use the file upload if implemented that way) and fill in other company details.
    *   Click **Save**.

**6. Running the Application:**
    *   Since this application runs entirely client-side (interacting directly with Firebase), you can typically run it by simply opening the `index.html` file directly in your web browser.
    *   Navigate to the directory where you saved the project files and double-click `index.html`.
    *   **Note:** For some advanced features or if you encounter CORS issues later (unlikely with the current Firebase setup), you might need to serve the files from a simple local web server. Tools like `live-server` (an npm package) can be used for this.

## Usage

1.  **Open the App:** Open the `index.html` file in your browser.
2.  **Initial Setup (Settings):**
    *   Navigate to the **Settings** tab.
    *   Crucially, configure **Company Details** first, including the logo (see Setup step 5).
    *   Add necessary **Entities** (for From/To dropdowns).
    *   Configure **Currencies, Commodity Codes, Incoterms, Statements, Packing Types, Templates, and Signees** as needed. Data saved here will be available in the Invoice Generator dropdowns.
3.  **Generate an Invoice:**
    *   Navigate to the **Invoice Generator** module (via `index.html` or the "Back to Modules" link).
    *   Click the **General** tab and fill in the details, selecting options from the dropdowns populated by Settings.
    *   Click the **Items** tab. Fill in the details for each item being shipped. Use the "Add Item Line" / "Remove Last Item Line" buttons as needed.
    *   Click the **Colli** tab. Fill in the details for each package. Use templates or enter dimensions/weight manually. Use the "Add Colli Line" / "Remove Last Colli Line" buttons.
    *   Review all entered data.
    *   Click the **Generate PDF & Save Data** button (located above the tabs).
    *   The application will save the current invoice data to Firestore and then prompt you to download the generated PDF file.
4.  **Load/Edit an Invoice:**
    *   Navigate to the **Load Data** tab.
    *   Select a previously saved invoice from the dropdown list (identified by its filename).
    *   Click the **Load Invoice** button.
    *   The application will populate the General, Items, and Colli tabs with the loaded data.
    *   You can now edit the data and click **Generate PDF & Save Data** again. This will save a *new* record in Firestore and generate a new PDF; it does not overwrite the previously loaded record.

## Future Enhancements / Roadmap

*   Implement the **Certificate Generator** module.
*   Refine PDF layout further based on user feedback.
*   Implement **Firestore Security Rules** for production use (currently uses Test Mode rules).
*   Add user authentication (if multiple users need separate data/settings views).
*   Improve error handling and user feedback notifications.
*   Consider options for editing/overwriting saved invoices instead of always creating new ones.
*   Add sorting/filtering options to the "Load Data" dropdown.
*   Implement unit and integration tests.
