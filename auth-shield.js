/**
 * Reliable Jewellery — Auth Shield Middleware
 * Instantly cloaks pages and verifies Firebase approval status.
 */

// Helper to determine the relative path to the root directory
function getRootPath() {
    const loc = window.location.pathname;
    const folders = ['quotation', 'price-list', 'catalog', 'gold-converter', 'tools', 'diamond'];
    const pathParts = loc.split('/');
    const isSubfolder = pathParts.some(part => folders.includes(part));
    return isSubfolder ? '../' : './';
}

// 1. Cloak the body immediately to prevent screen flashing
(function() {
    const path = window.location.pathname;
    if (path.includes('login.html') || path.includes('access-denied.html') || window.location.protocol === 'file:') {
        return; // Skip login, access denied, and local file:// pages
    }
    
    const style = document.createElement('style');
    style.id = 'auth-cloak';
    style.innerHTML = 'body { display: none !important; }';
    document.head.appendChild(style);
})();

// 2. Perform Authentication and Approval Whitelisting Checks
window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('login.html') || path.includes('access-denied.html')) {
        return; // Skip auth verification on login/access-denied pages
    }

    // Bypass auth check when running locally via file:// protocol
    if (window.location.protocol === 'file:') {
        console.warn("Auth Shield: Running under file:// protocol. Bypassing auth for local file access.");
        removeCloak();
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            console.log("Auth Shield: User not logged in, redirecting...");
            redirectToLogin();
            return;
        }

        try {
            const email = user.email.toLowerCase();
            const db = firebase.firestore();
            
            // Check whitelist document in Firestore
            const doc = await db.collection('approved_users').doc(email).get();

            if (doc.exists) {
                console.log(`Auth Shield: User ${email} approved.`);
                removeCloak();
            } else {
                console.warn(`Auth Shield: User ${email} is not approved.`);
                redirectToAccessDenied(user.email);
            }
        } catch (error) {
            console.error("Auth Shield verification error:", error);
            
            // Offline fallback
            if (!navigator.onLine) {
                console.warn("Auth Shield: Offline mode. Permitting access for cached session.");
                removeCloak();
            } else {
                // Deny access if online but verification failed (e.g. Permission Denied)
                redirectToAccessDenied(user.email);
            }
        }
    });
});

function removeCloak() {
    const cloak = document.getElementById('auth-cloak');
    if (cloak) {
        cloak.remove();
    }
}

function redirectToLogin() {
    const currentUrl = window.location.href;
    const root = getRootPath();
    window.location.href = root + 'login.html?redirect=' + encodeURIComponent(currentUrl);
}

function redirectToAccessDenied(email) {
    const root = getRootPath();
    window.location.href = root + 'access-denied.html?email=' + encodeURIComponent(email);
}
