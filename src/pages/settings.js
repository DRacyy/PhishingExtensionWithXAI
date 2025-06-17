// Updated settings.js with side-by-side login/signup buttons
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - Settings
    const urlAnalysisToggle = document.getElementById('urlAnalysisToggle');
    const mlDetectionToggle = document.getElementById('mlDetectionToggle');
    const notificationsToggle = document.getElementById('notificationsToggle');
    const autoScanToggle = document.getElementById('autoScanToggle');
    const showCountToggle = document.getElementById('showCountToggle');
    const serverUrlInput = document.getElementById('serverUrl'); // Renamed for clarity
    const apiKeyInput = document.getElementById('apiKey'); // Renamed for clarity
    const whitelistTextarea = document.getElementById('whitelist'); // Renamed for clarity
    const themeToggle = document.getElementById('themeToggle');
    
    // DOM Elements - New Save/Reset Functionality
    const savePopup = document.getElementById('savePopup');
    const newSaveBtn = document.getElementById('newSaveBtn'); // Button in the floating popup
    const resetBtn = document.getElementById('resetBtn');     // Button in the floating popup
    const dialogOverlay = document.getElementById('dialogOverlay');
    const saveDialog = document.getElementById('saveDialog');
    const discardBtn = document.getElementById('discardBtn');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn'); // Final save button in dialog
    const changesContainer = document.getElementById('changesContainer');
    
    // DOM Elements - Authentication
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    const syncNowBtn = document.getElementById('syncNowBtn');
    const unauthenticatedContent = document.getElementById('unauthenticatedContent');
    const authenticatedContent = document.getElementById('authenticatedContent');
    const settingsUserEmail = document.getElementById('settingsUserEmail');
    const lastSyncTime = document.getElementById('lastSyncTime');

    // Variables to store original settings
    let initialSettings = {};
    let currentSettings = {};
    let settingsChanged = false;
    let saveButtonTimeoutId = null;

    console.log("Settings.js: DOMContentLoaded, script starting.");

    // Initialize theme
    initializeTheme();

    // Load settings from storage
    loadSettingsAndInitialize();
    
    // Check authentication status
    checkAuthStatus();
    
    // Auth-related button event listeners
    if (signupBtn) {
        signupBtn.addEventListener('click', function() {
            chrome.tabs.create({ url: 'src/pages/login.html?mode=register' });
        });
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            chrome.tabs.create({ url: 'src/pages/login.html?mode=login' });
        });
    }

    if (settingsLogoutBtn) {
        settingsLogoutBtn.addEventListener('click', handleLogout);
    }
    
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', handleSync);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Event listeners for the new Save/Reset functionality
    if (newSaveBtn) newSaveBtn.addEventListener('click', showSaveDialog);
    if (resetBtn) resetBtn.addEventListener('click', performResetChanges);
    if (discardBtn) discardBtn.addEventListener('click', hideSaveDialog);
    if (confirmSaveBtn) confirmSaveBtn.addEventListener('click', performSaveChanges); // Points to new save wrapper
    if (dialogOverlay) dialogOverlay.addEventListener('click', hideSaveDialog);
        
    // Add change event listeners to all form elements to update currentSettings and check for changes
    function addChangeListenersToForm() {
        console.log("Settings.js: Adding change listeners to form elements.");
        const formElements = [
            urlAnalysisToggle, mlDetectionToggle, notificationsToggle,
            autoScanToggle, showCountToggle, serverUrlInput,
            apiKeyInput, whitelistTextarea
        ];
        formElements.forEach(element => {
            if (element) {
                const eventType = (element.type === 'checkbox' || element.tagName === 'TEXTAREA') ? 'change' : 'input';
                element.addEventListener(eventType, (event) => {
                    if (element.id === 'autoScanToggle' || element.id === 'showCountToggle') {
                        console.log(`Settings.js: Behavior setting changed: ${element.id}, New value: ${element.checked}`);
                    }
                    updateCurrentSettingsFromForm();
                    console.log('Settings.js: Current settings after update:', JSON.stringify(currentSettings, null, 2));
                    console.log('Settings.js: Initial settings for comparison:', JSON.stringify(initialSettings, null, 2));
                    handleSettingChange();
                });
            } else {
                // Find which element is null if any, helps debug element ID mismatches
                const expectedIds = ['urlAnalysisToggle', 'mlDetectionToggle', 'notificationsToggle', 'autoScanToggle', 'showCountToggle', 'serverUrl', 'apiKey', 'whitelist'];
                expectedIds.forEach(id => {
                    if (!document.getElementById(id) && formElements.find(el => el && el.id === id) === element) {
                        console.error(`Settings.js: Element with ID '${id}' not found in DOM during listener setup.`);
                    }
                });
            }
        });
    }

    function getCurrentSettingsFromForm() {
        return {
            urlAnalysis: urlAnalysisToggle.checked,
            mlDetection: mlDetectionToggle.checked,
            notifications: notificationsToggle.checked,
            autoScan: autoScanToggle.checked,
            showCount: showCountToggle.checked,
            serverUrl: serverUrlInput.value.trim(),
            apiKey: apiKeyInput.value.trim(),
            whitelist: whitelistTextarea.value 
        };
    }

    function updateCurrentSettingsFromForm() {
        currentSettings = getCurrentSettingsFromForm();
    }

    function hasChanges() {
        const iSettingsStr = JSON.stringify(initialSettings);
        const cSettingsStr = JSON.stringify(currentSettings);
        // console.log("Settings.js: Comparing for changes:\nInitial: " + iSettingsStr + "\nCurrent: " + cSettingsStr);
        return iSettingsStr !== cSettingsStr;
    }

    function handleSettingChange() {
        const changes = hasChanges();
        console.log('Settings.js: handleSettingChange - Has changes:', changes);
        if (changes) {
            console.log('Settings.js: Showing save popup because changes were detected.');
            showSavePopup();
        } else {
            console.log('Settings.js: Hiding save popup because no changes were detected.');
            hideSavePopup();
        }
    }

    // Load settings from storage and initialize both initial and current settings
    function loadSettingsAndInitialize() {
        console.log("Settings.js: loadSettingsAndInitialize called.");
        chrome.storage.local.get(['settings'], function(result) {
            if (chrome.runtime.lastError) {
                console.error("Settings.js: Error loading settings from storage:", chrome.runtime.lastError);
                // Initialize with defaults even if storage fails
            }
            const loaded = result && result.settings ? result.settings : {};
            console.log("Settings.js: Settings loaded from storage:", loaded);

            initialSettings = {
                urlAnalysis: loaded.urlAnalysis ?? true,
                mlDetection: loaded.mlDetection ?? true,
                notifications: loaded.notifications ?? true,
                autoScan: loaded.autoScan ?? true,
                showCount: loaded.showCount ?? true,
                serverUrl: loaded.serverUrl || 'http://localhost:5000',
                apiKey: loaded.apiKey || '',
                whitelist: loaded.whitelist ? (Array.isArray(loaded.whitelist) ? loaded.whitelist.join('\\n') : loaded.whitelist) : ''
            };
            console.log("Settings.js: Initial settings populated:", JSON.stringify(initialSettings, null, 2));

            if(urlAnalysisToggle) urlAnalysisToggle.checked = initialSettings.urlAnalysis;
            if(mlDetectionToggle) mlDetectionToggle.checked = initialSettings.mlDetection;
            if(notificationsToggle) notificationsToggle.checked = initialSettings.notifications;
            if(autoScanToggle) autoScanToggle.checked = initialSettings.autoScan;
            if(showCountToggle) showCountToggle.checked = initialSettings.showCount;
            if(serverUrlInput) serverUrlInput.value = initialSettings.serverUrl;
            if(apiKeyInput) apiKeyInput.value = initialSettings.apiKey;
            if(whitelistTextarea) whitelistTextarea.value = initialSettings.whitelist;
            console.log("Settings.js: UI elements updated from initialSettings.");

            currentSettings = { ...initialSettings };
            console.log("Settings.js: currentSettings initialized from initialSettings.");

            addChangeListenersToForm();
            updateLastSyncTime(); // From existing logic
            handleSettingChange(); // Check if popup should be shown initially (e.g. if defaults differ from empty form)
        });
    }
    
    // --- New Save/Reset Popup and Dialog Functions ---

    function showSavePopup() {
        if (!savePopup) { console.log("Settings.js: savePopup element not found for showSavePopup."); return; }
        console.log("Settings.js: showSavePopup called.");
        savePopup.classList.remove('animate-slide-down');
        savePopup.classList.add('show');
        savePopup.classList.add('animate-slide-up');
    }

    function hideSavePopup() {
        if (!savePopup) { console.log("Settings.js: savePopup element not found for hideSavePopup."); return; }
        console.log("Settings.js: hideSavePopup called.");
        savePopup.classList.add('animate-slide-down');
        setTimeout(() => {
            savePopup.classList.remove('show');
            // Ensure animation class is also removed to allow re-triggering
            savePopup.classList.remove('animate-slide-up'); 
        }, 300); // Duration of slideDown animation
    }

    function showSaveDialog() {
        console.log("Settings.js: showSaveDialog called.");
        populateChanges();
        if (dialogOverlay) dialogOverlay.classList.add('show');
        if (saveDialog) saveDialog.classList.add('show');
    }

    function hideSaveDialog() {
        console.log("Settings.js: hideSaveDialog called.");
        if (dialogOverlay) dialogOverlay.classList.remove('show');
        if (saveDialog) saveDialog.classList.remove('show');
    }

    function populateChanges() {
        if (!changesContainer) return;
        console.log("Settings.js: populateChanges called.");
        // Clear previous content (keeping the header)
        while (changesContainer.children.length > 1) {
            changesContainer.removeChild(changesContainer.lastChild);
        }
        
        const changedFields = [
            { key: 'urlAnalysis', name: 'URL Analysis', type: 'boolean' },
            { key: 'mlDetection', name: 'ML Detection', type: 'boolean' },
            { key: 'notifications', name: 'Notifications', type: 'boolean' },
            { key: 'autoScan', name: 'Auto Scan', type: 'boolean' },
            { key: 'showCount', name: 'Show Blocked Count', type: 'boolean' },
            { key: 'serverUrl', name: 'Server URL', type: 'text' },
            { key: 'apiKey', name: 'API Key', type: 'text', sensitive: true },
            { key: 'whitelist', name: 'Trusted Domains', type: 'textarea' }
        ];

        let changesFound = false;
        changedFields.forEach(field => {
            if (currentSettings[field.key] !== initialSettings[field.key]) {
                changesFound = true;
                let valueDisplay;
                let isEnabled = null; // For boolean styling

                if (field.type === 'boolean') {
                    valueDisplay = currentSettings[field.key] ? 'Enabled' : 'Disabled';
                    isEnabled = currentSettings[field.key];
                } else if (field.sensitive && currentSettings[field.key]) {
                    valueDisplay = 'Updated (hidden)';
                } else if (field.type === 'textarea' || field.type === 'text') {
                     if (currentSettings[field.key] !== initialSettings[field.key]) {
                        valueDisplay = `Changed from "${initialSettings[field.key] || '(empty)'}" to "${currentSettings[field.key] || '(empty)'}"`;
                        if (valueDisplay.length > 60) valueDisplay = "Updated"; // Keep it concise
        } else {
                         valueDisplay = "Updated";
                    }
                }
                 else {
                    valueDisplay = "Updated";
                }
                addChangeItem(field.name, valueDisplay, isEnabled);
            }
        });
        if (!changesFound) {
             addChangeItem("No changes detected.", "", null);
        }
    }

    function addChangeItem(name, value, isEnabled) {
        if (!changesContainer) return;
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between text-sm py-1';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-slate-300'; // Assuming dark theme for dialog text
        nameSpan.textContent = name;
        
        const valueSpan = document.createElement('span');
        
        if (isEnabled !== null) { // Boolean: Green for true (Enabled), slate for false (Disabled)
            valueSpan.className = `flex items-center gap-1 ${isEnabled ? 'text-green-400' : 'text-slate-400'}`;
            const iconHTML = isEnabled 
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            valueSpan.innerHTML = iconHTML; // Set innerHTML for SVG
            const text = document.createTextNode(" " + value); // Add space before text
            valueSpan.appendChild(text);
        } else { // Text changes: Purple
            valueSpan.className = 'text-purple-400 text-xs text-right'; // Ensure text aligns right for potentially long values
            valueSpan.textContent = value;
        }
        
        item.appendChild(nameSpan);
        item.appendChild(valueSpan);
        changesContainer.appendChild(item);
        if (lucide) lucide.createIcons(); // Re-render if any lucide icons were part of the valueSpan
    }

    // New main save function that handles UI and calls the actual storage save
    async function performSaveChanges() {
        console.log("Settings.js: performSaveChanges called.");
        if (confirmSaveBtn) {
            confirmSaveBtn.disabled = true;
            confirmSaveBtn.innerHTML = '<div class="spinner mr-1.5"></div> Saving...';
            if(lucide) lucide.createIcons(); // if spinner is a lucide icon
        }
        
        // Simulate save operation for now - replace with actual save
        // await new Promise(resolve => setTimeout(resolve, 1000)); 
        
        // Call the existing function to save to chrome.storage.local
        await persistSettingsToStorage(currentSettings); 
        
        initialSettings = { ...currentSettings }; // Update initialSettings to match current
        
        if (confirmSaveBtn) {
            confirmSaveBtn.disabled = false;
            confirmSaveBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 mr-1.5"></i> Save';
            if(lucide) lucide.createIcons();
        }
        
        hideSaveDialog();
        hideSavePopup(); // Hide the floating popup as well
        showToast('Settings saved successfully!', 'success'); // Use existing toast
        console.log("Settings.js: Settings saved, initialSettings updated.");
    }

    // Reset changes back to initialSettings
    function performResetChanges() {
        console.log("Settings.js: performResetChanges called.");
        // Reset form values to match initialSettings
        urlAnalysisToggle.checked = initialSettings.urlAnalysis;
        mlDetectionToggle.checked = initialSettings.mlDetection;
        notificationsToggle.checked = initialSettings.notifications;
        autoScanToggle.checked = initialSettings.autoScan;
        showCountToggle.checked = initialSettings.showCount;
        serverUrlInput.value = initialSettings.serverUrl;
        apiKeyInput.value = initialSettings.apiKey;
        whitelistTextarea.value = initialSettings.whitelist;
        
        updateCurrentSettingsFromForm(); // Update currentSettings to match the form
        
        handleSettingChange(); // This will hide the popup if no changes
        showToast('Changes have been reset.', 'info');
        console.log("Settings.js: Form elements reset to initialSettings.");
    }

    // Modified function to persist settings (adapted from old saveSettings)
    function persistSettingsToStorage(settingsToSave) {
        console.log("Settings.js: persistSettingsToStorage called with:", settingsToSave);
        return new Promise((resolve, reject) => {
            const whitelistArray = settingsToSave.whitelist
                .split('\\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            const finalSettings = {
                urlAnalysis: settingsToSave.urlAnalysis,
                mlDetection: settingsToSave.mlDetection,
                notifications: settingsToSave.notifications,
                autoScan: settingsToSave.autoScan,
                showCount: settingsToSave.showCount,
                // scanMode: 'optimal', // Retain if this is still a valid setting, otherwise remove
                serverUrl: settingsToSave.serverUrl,
                apiKey: settingsToSave.apiKey,
                whitelist: whitelistArray,
                updated: Date.now()
            };
            
            chrome.storage.local.set({settings: finalSettings}, function() {
                if (chrome.runtime.lastError) {
                    console.error("Settings.js: Error saving settings to storage:", chrome.runtime.lastError);
                    showToast('Error saving settings.', 'error');
                    reject(chrome.runtime.lastError);
                } else {
                    console.log("Settings.js: Settings successfully saved to storage:", finalSettings);
                    syncSettingsIfAuthenticated(); // From existing logic
                    resolve();
                }
            });
        });
    }
    
    // Check authentication status
    function checkAuthStatus() {
        // console.log("Settings.js: checkAuthStatus called.");
        chrome.runtime.sendMessage({action: "checkAuth"}, function(response) {
            if (response && response.isAuthenticated) {
                showAuthenticatedUI(response.email);
            } else {
                showUnauthenticatedUI();
            }
        });
    }

    // Show UI for authenticated users
    function showAuthenticatedUI(email) {
        // console.log("Settings.js: showAuthenticatedUI called.");
        // Hide unauthenticated content
        if (unauthenticatedContent) {
            unauthenticatedContent.style.display = 'none';
        }
        
        // Show authenticated content
        if (authenticatedContent) {
            authenticatedContent.style.display = 'block';
        }
        
        // Update user email
        if (settingsUserEmail) {
            settingsUserEmail.textContent = email;
        }
        
        // Update last sync time
        updateLastSyncTime();
    }

    // Show UI for unauthenticated users
    function showUnauthenticatedUI() {
        // console.log("Settings.js: showUnauthenticatedUI called.");
        // Show unauthenticated content
        if (unauthenticatedContent) {
            unauthenticatedContent.style.display = 'block';
        }
        
        // Hide authenticated content
        if (authenticatedContent) {
            authenticatedContent.style.display = 'none';
        }
    }
    
    // Update the last sync time display
    function updateLastSyncTime() {
        // console.log("Settings.js: updateLastSyncTime called.");
        chrome.storage.local.get(['stats'], function(result) {
            if (result.stats && result.stats.lastSync) {
                const syncDate = new Date(result.stats.lastSync);
                const now = new Date();
                const diffMs = now - syncDate;
                const diffMins = Math.floor(diffMs / 60000);
                
                let timeText;
                if (diffMins < 1) {
                    timeText = 'Just now';
                } else if (diffMins < 60) {
                    timeText = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                } else if (diffMins < 1440) {
                    const hours = Math.floor(diffMins / 60);
                    timeText = `${hours} hour${hours > 1 ? 's' : ''} ago`;
                } else {
                    timeText = syncDate.toLocaleDateString() + ' ' + syncDate.toLocaleTimeString();
                }
                
                lastSyncTime.textContent = timeText;
            } else {
                lastSyncTime.textContent = 'Never';
            }
        });
    }
    
    // Handle logout
    function handleLogout() {
        // console.log("Settings.js: handleLogout called.");
        if (confirm('Are you sure you want to sign out?')) {
            chrome.runtime.sendMessage({action: "logout"}, function(response) {
                if (response && response.success) {
                    showUnauthenticatedUI();
                    showToast('You have been signed out');
                }
            });
        }
    }
    
    // Handle sync button click
    function handleSync() {
        // console.log("Settings.js: handleSync called.");
        // Disable the button to prevent multiple clicks
        syncNowBtn.disabled = true;
        
        // Add rotating icon for visual feedback
        const originalHTML = syncNowBtn.innerHTML;
        // syncNowBtn.innerHTML = '<i class="material-icons rotating">sync</i> Syncing...'; // Old Material Icon
        syncNowBtn.innerHTML = '<i data-lucide="refresh-cw" class="rotating"></i> Syncing...'; // New Lucide Icon
        lucide.createIcons(); // Re-render icons if dynamically added

        // Send sync message to background script
        chrome.runtime.sendMessage({action: "syncNow"}, function(response) {
            if (response && response.success) {
                // Show success notification
                showToast('Data synchronized successfully');
                
                // Update the last sync time
                updateLastSyncTime();
            } else {
                // Show error notification
                showToast('Sync failed. Please try again later', 'error');
            }
            
            // Restore button after a delay
            setTimeout(() => {
                syncNowBtn.disabled = false;
                syncNowBtn.innerHTML = originalHTML;
            }, 1000);
        });
    }
    
    // Sync settings if user is authenticated
    function syncSettingsIfAuthenticated() {
        // console.log("Settings.js: syncSettingsIfAuthenticated called.");
        chrome.storage.local.get(['auth'], function(result) {
            if (result.auth && result.auth.token) {
                // Send sync message to background script
                chrome.runtime.sendMessage({action: "syncNow"});
            }
        });
    }
    
    // Show toast notification
    function showToast(message, type = 'info') {
        // console.log(`Settings.js: showToast called - Type: ${type}, Message: ${message}`);
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(t => t.remove());
        
        // Add to DOM
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            // toast.classList.add('toast-hide'); // Assuming toast-hide is for fade-out, not present in new CSS
            // setTimeout(() => { // Simpler removal without a hide class for now
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
            // }, 300); 
        }, 3000);
    }

    // Theme Toggling Functionality
    function initializeTheme() {
        console.log("Settings.js: initializeTheme called.");
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.body.className = currentTheme;
        updateThemeIcon(currentTheme);
        if (currentTheme === 'dark') {
            // Ensure theme toggle button itself reflects the state if needed
            // For example, if the icon should be sun in dark mode initially
            if(themeToggle) themeToggle.innerHTML = '<i data-lucide="sun"></i>';
        } else {
            if(themeToggle) themeToggle.innerHTML = '<i data-lucide="moon"></i>';
        }
        if (lucide) lucide.createIcons(); // Ensure icons are created after setting innerHTML
    }

    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
        console.log(`Settings.js: toggleTheme called. New theme: ${newTheme}`);
        document.body.className = newTheme;
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
        // console.log(`Settings.js: updateThemeIcon called. Theme: ${theme}`);
        if (themeToggle) {
            if (theme === 'dark') {
                themeToggle.innerHTML = '<i data-lucide="sun"></i>';
            } else {
                themeToggle.innerHTML = '<i data-lucide="moon"></i>';
            }
            if (lucide) lucide.createIcons(); // Re-render icons
        }
    }

    // Final call to create all icons once DOM is ready and theme is set.
    if (lucide) {
        console.log("Settings.js: Initial lucide.createIcons() call.");
        lucide.createIcons();
    }
    console.log("Settings.js: Script finished loading and executing initial setup.");
});