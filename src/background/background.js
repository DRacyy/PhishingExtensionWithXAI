// Updated background.js with database integration
const API_BASE_URL = 'http://localhost:5000/api'; // Change this to your Flask API URL

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener(function() {
    console.log('ShieldScan extension installed/updated');
    
    // Initialize storage
    chrome.storage.local.get(['stats'], function(result) {
        if (!result.stats) {
            const stats = {
                scanned: 0,
                threats: 0,
                installDate: Date.now(),
                history: [],
                lastSync: null
            };
            
            chrome.storage.local.set({stats: stats});
        }
    });
    
    // Initialize settings with defaults
    chrome.storage.local.get(['settings'], function(result) {
        if (!result.settings) {
            const settings = {
                urlAnalysis: true,
                mlDetection: true, 
                notifications: true,
                autoScan: true,
                showCount: true,
                scanFrequency: 'always',
                scanMode: 'optimal',
                whitelist: []
            };
            
            chrome.storage.local.set({settings: settings});
        }
    });
    
    // Check auth status
    chrome.storage.local.get(['auth'], function(result) {
        if (result.auth) {
            // Verify token is still valid
            verifyAuthToken(result.auth.token);
        }
    });
    
    // Create alarms for sync - more frequent during testing
    chrome.alarms.create('periodicSync', { periodInMinutes: 5 }); // Changed from 30 to 5 minutes
});

// Listen for tab updates to potentially auto-scan new pages
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Only run when page is fully loaded and has a valid URL
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        chrome.storage.local.get(['settings'], function(result) {
            if (result.settings && result.settings.autoScan) {
                // Check if the URL is whitelisted
                const whitelist = result.settings.whitelist || [];
                const url = new URL(tab.url);
                const domain = url.hostname;
                
                // Skip scanning if the domain is in the whitelist
                if (whitelist.some(item => domain.includes(item))) {
                    console.log("Skipping scan for whitelisted domain:", domain);
                    return;
                }
                
                // Otherwise, get page info and analyze
                chrome.tabs.sendMessage(tabId, {action: "getPageInfo"}, function(response) {
                    if (response) {
                        console.log("Auto-scanning page:", response.url);
                        analyzeUrl(response.url, response);
                    }
                });
            }
        });
    }
});

// Listen for alarms (periodic sync)
chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'periodicSync' || alarm.name === 'quickSync') {
        syncDataWithServer();
    }
});

// Function to send URL to backend for analysis
function analyzeUrl(url, additionalInfo = {}) {
    // Get auth token and settings
    chrome.storage.local.get(['settings', 'auth'], function(result) {
        if (result.settings) {
            let useRemoteAnalysis = false;
            let authToken = null;
            
            // Check if user is authenticated for remote analysis
            if (result.auth && result.auth.token) {
                authToken = result.auth.token;
                useRemoteAnalysis = true;
            }
            
            if (useRemoteAnalysis) {
                // Send to remote API for authenticated users
                console.log(`Sending ${url} to ${API_BASE_URL} for remote analysis with auth`);
                
                // Extract relevant info to send to API
                const scanInfo = {
                    url: url,
                    hasLoginForm: additionalInfo.hasLoginForm || false,
                    hasSensitiveFields: additionalInfo.hasSensitiveFields || false
                };
                
                // Make actual API call for remote analysis
                remoteAnalyzeUrl(url, authToken, scanInfo)
                    .then(analysisResult => {
                        // Update stats with the result
                        updateStats(url, analysisResult.isThreat, {
                            confidence: analysisResult.confidence,
                            threatType: analysisResult.threatType
                        });
                        
                        // Show notification if needed
                        if (analysisResult.isThreat && result.settings.notifications) {
                            showNotification(url, {
                                confidence: analysisResult.confidence,
                                threatType: analysisResult.threatType
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Remote analysis error:', error);
                        // Fall back to local/simulated analysis
                        performLocalAnalysis(url, result.settings, additionalInfo);
                    });
            } else {
                // Use local/simulated analysis for non-authenticated users
                performLocalAnalysis(url, result.settings, additionalInfo);
            }
        }
    });
}

// Perform local (simulated) analysis
function performLocalAnalysis(url, settings, additionalInfo) {
    console.log(`Performing local analysis for ${url}`);
    
    // This is a simulation - in a real extension, you'd use more sophisticated checks
    const isThreat = Math.random() > 0.7; // 30% chance of being a threat
    
    // Update stats
    updateStats(url, isThreat, {
        confidence: Math.random().toFixed(2),
        threatType: "Phishing"
    });
    
    // Show notification if needed
    if (isThreat && settings.notifications) {
        showNotification(url, {
            confidence: Math.random().toFixed(2),
            threatType: "Phishing"
        });
    }
}

// Perform remote analysis through API
async function remoteAnalyzeUrl(url, authToken, additionalInfo) {
    try {
        const response = await fetch(`${API_BASE_URL}/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                url: url,
                hasLoginForm: additionalInfo.hasLoginForm,
                hasSensitiveFields: additionalInfo.hasSensitiveFields
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'API scan failed');
        }
        
        return {
            isThreat: result.isThreat || false,
            confidence: result.confidence || 0.5,
            threatType: result.threatType || "Unknown"
        };
    } catch (error) {
        console.error('Remote URL analysis failed:', error);
        throw error;
    }
}

// Show a notification for a detected threat
function showNotification(url, analysisData) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Phishing Alert!',
        message: `The website ${url} has been detected as a potential phishing site.`,
        priority: 2
    });
}

// Update stats after a scan
function updateStats(url, isThreat, analysisData = {}) {
    chrome.storage.local.get(['stats'], function(result) {
        let stats = result.stats || {
            scanned: 0,
            threats: 0,
            installDate: Date.now(),
            history: [],
            lastSync: null,
            syncedItems: {}
        };
        
        // Update counts
        stats.scanned++;
        if (isThreat) stats.threats++;
        
        // Add to history with needsSync flag
        stats.history.unshift({
            url: url,
            date: Date.now(),
            isSafe: !isThreat,
            threatType: isThreat ? analysisData.threatType || "Phishing" : null,
            threatScore: isThreat ? analysisData.confidence || 0.5 : null,
            needsSync: true
        });
        
        // Save to storage
        chrome.storage.local.set({stats: stats});
        
        // Update badge if show count is enabled
        chrome.storage.local.get(['settings'], function(settingsResult) {
            if (settingsResult.settings && settingsResult.settings.showCount) {
                chrome.action.setBadgeText({text: stats.threats.toString()});
                chrome.action.setBadgeBackgroundColor({color: '#D32F2F'});
            } else {
                chrome.action.setBadgeText({text: ''});
            }
        });
        
        // Schedule a sync if user is authenticated
        scheduleSync();
    });
}

// Schedule data sync with server
function scheduleSync() {
    chrome.storage.local.get(['auth'], function(result) {
        if (result.auth && result.auth.token) {
            // Schedule a sync in 2 seconds (reduced from 5 seconds)
            chrome.alarms.create('quickSync', { delayInMinutes: 0.033 }); // ~2 seconds
        }
    });
}

// Sync data with the server
function syncDataWithServer() {
    console.log('Starting sync process...');
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['auth', 'stats'], function(result) {
            if (!result.auth || !result.auth.token) {
                console.log('Not authenticated, skipping sync');
                resolve({ success: false, message: 'Not authenticated' });
                return;
            }
            
            // Check token expiration
            if (result.auth.expiresAt && result.auth.expiresAt < Date.now()) {
                console.log('Auth token expired, skipping sync');
                chrome.storage.local.remove(['auth']);
                resolve({ success: false, message: 'Token expired' });
                return;
            }
            
            const token = result.auth.token;
            const stats = result.stats || { history: [], syncedItems: {} };
            
            // Ensure we have the necessary tracking objects
            if (!stats.syncedItems) {
                stats.syncedItems = {};
            }
            
            // Find items that need syncing - either they have needsSync flag or haven't been synced before
            const unsynced = stats.history.filter(item => {
                return item.needsSync === true || !stats.syncedItems[`${item.url}-${item.date}`];
            });
            
            console.log(`Found ${unsynced.length} items that need syncing out of ${stats.history.length} total items`);
            
            if (unsynced.length === 0) {
                console.log('No items need syncing');
                resolve({ success: true, added: 0, updated: 0 });
                return;
            }
            
            // Format the history data for the API
            const formattedHistory = unsynced.map(item => ({
                url: item.url,
                date: item.date,
                isSafe: item.isSafe,
                threatType: item.threatType || null,
                threatScore: item.threatScore ? parseFloat(item.threatScore) : null
            }));
            
            // Send the history to the server
            fetch(`${API_BASE_URL}/history/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    history: formattedHistory
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.message || `HTTP error! status: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log('History synced successfully:', data);
                    console.log(`Added ${data.added} new items, updated ${data.updated} items`);
                    
                    // Update sync status for all items
                    const updatedHistory = stats.history.map(item => {
                        const itemKey = `${item.url}-${item.date}`;
                        if (unsynced.some(unsyncedItem => 
                            unsyncedItem.url === item.url && 
                            unsyncedItem.date === item.date)) {
                            stats.syncedItems[itemKey] = true;
                            return { ...item, needsSync: false };
                        }
                        return item;
                    });
                    
                    // Update storage with sync information
                    const updatedStats = {
                        ...stats,
                        history: updatedHistory,
                        lastSync: Date.now()
                    };
                    
                    chrome.storage.local.set({ stats: updatedStats }, function() {
                        if (chrome.runtime.lastError) {
                            console.error('Error updating sync status:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            console.log('Sync status updated successfully');
                            resolve({ 
                                success: true, 
                                added: data.added,
                                updated: data.updated
                            });
                        }
                    });
                } else {
                    console.error('Sync failed:', data);
                    reject(new Error(data.message || 'Sync failed'));
                }
            })
            .catch(error => {
                console.error('Sync error:', error);
                reject(error);
            });
        });
    });
}

// Sync settings if they've been updated since the last sync
function syncSettingsIfNeeded(token, settings) {
    if (!settings || !settings.updated) {
        console.log('No settings to sync or no update timestamp');
        return;
    }
    
    // Check if settings have been updated since last sync
    if (!settings.lastSync || settings.updated > settings.lastSync) {
        console.log('Settings need sync - last update:', new Date(settings.updated));
        
        // Use camelCase field names as the API expects
        const apiSettings = {
            urlAnalysis: settings.urlAnalysis,
            mlDetection: settings.mlDetection,
            notifications: settings.notifications,
            autoScan: settings.autoScan,
            showCount: settings.showCount,
            whitelist: Array.isArray(settings.whitelist) ? settings.whitelist : []
        };
        
        console.log('Sending settings to server:', apiSettings);
        
        fetch(`${API_BASE_URL}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiSettings)
        })
        .then(response => {
            console.log('Settings sync response status:', response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Settings sync error response:', text);
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error(`Server error: ${text}`);
                    }
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('Settings synced successfully');
                
                // Update settings with sync timestamp
                settings.lastSync = Date.now();
                chrome.storage.local.set({ settings: settings }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error saving sync timestamp:', chrome.runtime.lastError);
                    } else {
                        console.log('Settings sync timestamp updated');
                    }
                });
            } else {
                console.error('Settings sync failed:', data.message);
            }
        })
        .catch(error => {
            console.error('Settings sync failed:', error);
            console.log('Was trying to sync settings with payload:', JSON.stringify(apiSettings, null, 2));
        });
    } else {
        console.log('Settings are up to date, no sync needed');
    }
}

// Verify if auth token is still valid
function verifyAuthToken(token) {
    fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Token invalid: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.valid) {
            // Clear invalid token
            chrome.storage.local.remove(['auth']);
        }
    })
    .catch(error => {
        console.error('Token verification failed:', error);
        // Clear invalid token
        chrome.storage.local.remove(['auth']);
    });
}

// Add a listener for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Handle logout request
    if (request.action === "logout") {
        chrome.storage.local.get(['auth'], function(result) {
            if (result.auth && result.auth.token) {
                // Call logout API
                fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${result.auth.token}`
                    }
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Logout API response:', data);
                })
                .catch(error => {
                    console.error('Logout API error:', error);
                })
                .finally(() => {
                    // Remove auth data regardless of API response
                    chrome.storage.local.remove(['auth'], function() {
                        sendResponse({ success: true });
                    });
                });
            } else {
                sendResponse({ success: true });
            }
        });
        return true; // Indicates async response
    }
    
    // Handle manual sync request
    if (request.action === "syncNow") {
        console.log('Manual sync requested');
        // Execute sync and ensure we respond to the request
        syncDataWithServer()
            .then(result => {
                console.log('Sync completed:', result);
                sendResponse(result || { success: true });
            })
            .catch(error => {
                console.error('Sync failed:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    }
    
    // Handle auth check request
    if (request.action === "checkAuth") {
        chrome.storage.local.get(['auth'], function(result) {
            if (result.auth && result.auth.token) {
                // Check expiration
                if (result.auth.expiresAt && result.auth.expiresAt > Date.now()) {
                    sendResponse({ 
                        isAuthenticated: true,
                        email: result.auth.email
                    });
                } else {
                    sendResponse({ isAuthenticated: false });
                    // Clear expired token
                    chrome.storage.local.remove(['auth']);
                }
            } else {
                sendResponse({ isAuthenticated: false });
            }
        });
        return true; // Indicates async response
    }
    
    // Handle scan request from popup
    if (request.action === "scanUrl") {
        analyzeUrl(request.url, request.additionalInfo || {});
        sendResponse({ success: true });
        return true;
    }
});