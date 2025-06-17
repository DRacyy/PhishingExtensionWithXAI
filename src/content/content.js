// This script runs in the context of web pages
// It can extract URLs or other information from the current page

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getPageInfo") {
        // Collect information about the current page
        const pageInfo = {
            url: window.location.href,
            domain: window.location.hostname,
            title: document.title,
            hasLoginForm: checkForLoginForm(),
            hasSensitiveFields: checkForSensitiveFields(),
            links: getExternalLinks()
        };
        
        // Send the information back
        sendResponse(pageInfo);
    }
});

// Check if the page has a login form
function checkForLoginForm() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    const loginForms = document.querySelectorAll('form');
    
    return passwordFields.length > 0 || loginForms.length > 0;
}

// Check for sensitive input fields
function checkForSensitiveFields() {
    const sensitiveInputTypes = ['password', 'email', 'tel', 'number', 'credit-card'];
    const sensitiveNamePatterns = ['card', 'credit', 'ccnum', 'security', 'cvv', 'ssn', 'social'];
    
    const inputs = document.querySelectorAll('input');
    
    for (const input of inputs) {
        const type = input.getAttribute('type');
        const name = input.getAttribute('name') || '';
        const id = input.getAttribute('id') || '';
        const placeholder = input.getAttribute('placeholder') || '';
        
        // Check type
        if (sensitiveInputTypes.includes(type)) {
            return true;
        }
        
        // Check for sensitive patterns in name, id, or placeholder
        const attributes = [name.toLowerCase(), id.toLowerCase(), placeholder.toLowerCase()];
        for (const attr of attributes) {
            for (const pattern of sensitiveNamePatterns) {
                if (attr.includes(pattern)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// Get all external links on the page
function getExternalLinks() {
    const currentDomain = window.location.hostname;
    const links = document.querySelectorAll('a[href]');
    const externalLinks = [];
    
    for (const link of links) {
        const href = link.getAttribute('href');
        if (href.startsWith('http') && !href.includes(currentDomain)) {
            externalLinks.push(href);
        }
    }
    
    return externalLinks.slice(0, 20); // Limit to 20 links
}