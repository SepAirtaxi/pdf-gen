// ============================================================
// AUTHENTICATION CHECK
// ============================================================
// This script checks if a user is authenticated and redirects
// to login page if not. Include this at the top of every page
// that should be protected.
// ============================================================

(function() {
    // Check if user is authenticated
    const isAuthenticated = sessionStorage.getItem('pdfgen_authenticated') === 'true';
    
    // If not authenticated and not on login page, redirect to login
    if (!isAuthenticated && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
})();

// ============================================================
// LOGOUT FUNCTION
// ============================================================
function logout() {
    // Clear session
    sessionStorage.removeItem('pdfgen_authenticated');
    sessionStorage.removeItem('pdfgen_user');
    
    // Redirect to login
    window.location.href = 'login.html';
}

// ============================================================
// GET CURRENT USER
// ============================================================
function getCurrentUser() {
    return sessionStorage.getItem('pdfgen_user') || 'Guest';
}
