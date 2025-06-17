// Complete popup.js with only settings button
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const scanBtn = document.getElementById('scanBtn');
    const quickScanBtn = document.getElementById('quickScanBtn');
    const toggleCustomScanBtn = document.getElementById('toggleCustomScanBtn');
    const customScanForm = document.getElementById('customScanForm');
    const currentUrl = document.getElementById('currentUrl');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusIcon = document.getElementById('statusIcon');
    const resultCard = document.getElementById('resultCard');
    const resultCircle = document.getElementById('resultCircle');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultDescription = document.getElementById('resultDescription');
    const continueBtn = document.getElementById('continueBtn');
    const viewDetailsBtn = document.getElementById('viewDetailsBtn');
    const sitesScanned = document.getElementById('sitesScanned');
    const threatsDetected = document.getElementById('threatsDetected');
    const daysActive = document.getElementById('daysActive');
    
    // Navigation buttons - only keep settings button
    const settingsBtn = document.getElementById('settingsBtn');

    // Make sure only settings button exists
    function ensureOnlySettingsButton() {
        const headerActions = document.querySelector('.header-actions');
        
        // Clear everything
        if (headerActions) {
            headerActions.innerHTML = '';
            
            // Add only settings button
            const settingsBtnElement = document.createElement('button');
            settingsBtnElement.className = 'icon-button';
            settingsBtnElement.id = 'settingsBtn';
            settingsBtnElement.innerHTML = '<i class="material-icons">settings</i>';
            settingsBtnElement.title = 'Settings';
            
            settingsBtnElement.addEventListener('click', function() {
                chrome.tabs.create({ url: 'src/pages/settings.html' });
            });
            
            headerActions.appendChild(settingsBtnElement);
        }
    }
    
    // Call this immediately to ensure only settings button is shown
    ensureOnlySettingsButton();

    // Toggle custom scan form
    toggleCustomScanBtn.addEventListener('click', function() {
        customScanForm.classList.toggle('active');
        toggleCustomScanBtn.classList.toggle('active');
    });

    // Get current URL
    getCurrentTab();

    // Load stats
    loadStats();

    // Check authentication status
    checkAuthStatus();

    // Scan button click
    scanBtn.addEventListener('click', function() {
        const url = urlInput.value.trim();
        if (url) {
            scanUrl(url);
        }
    });

    // Quick scan button click
    quickScanBtn.addEventListener('click', function() {
        getCurrentTab(true);
    });

    // Continue button click
    continueBtn.addEventListener('click', function() {
        hideResultCard();
    });

    // View details button click
    viewDetailsBtn.addEventListener('click', function() {
        // Would normally show detailed results
        alert('Detailed analysis would be shown here.');
    });

    // Get current tab URL
    function getCurrentTab(scanImmediately = false) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) {
                const url = tabs[0].url;
                currentUrl.textContent = url;
                urlInput.value = url;
                
                if (scanImmediately) {
                    scanUrl(url);
                }
            }
        });
    }

    // Scan a URL for phishing
    function scanUrl(url) {
        // Show loading state
        showResultCard('loading');

        // Get settings to check which features are enabled
        chrome.storage.local.get(['settings', 'auth'], function(result) {
            const settings = result.settings || {
                urlAnalysis: true,
                mlDetection: true,
                notifications: true
            };
            
            // Check if authenticated to use remote scanning
            const isAuthenticated = result.auth && result.auth.token && result.auth.expiresAt > Date.now();
            
            if (isAuthenticated) {
                // Send scan request to background script which will use remote API
                chrome.runtime.sendMessage({
                    action: "scanUrl", 
                    url: url,
                    additionalInfo: { 
                        type: 'manual_scan' 
                    }
                }, function(response) {
                    // Background script handles the stats update
                    // Just update the UI here
                    getCurrentTab();
                });
                
                // The background script will handle everything in this case
                // We just need to keep showing the loading state
                // The user can click Continue to dismiss
            } else {
                // Local scanning for non-authenticated users
                // In a real extension, this would call your Flask backend
                // For demo purposes, we'll simulate a response after a delay
                setTimeout(() => {
                    // Simulating a response - in a real extension, this would be from your backend
                    const isSafe = Math.random() > 0.3; // 70% chance of safe for demo
                    
                    if (isSafe) {
                        showResultCard('safe');
                        updateStatusIndicator('safe');
                    } else {
                        showResultCard('danger');
                        updateStatusIndicator('danger');
                        
                        // Show notification if enabled
                        if (settings.notifications) {
                            // In a real extension, this would trigger a browser notification
                            console.log("Would show notification for: " + url);
                        }
                    }

                    // Update stats
                    updateStats(url, !isSafe);
                    
                }, 1500);
            }
        });
    }

    // Update the status indicator
    function updateStatusIndicator(status) {
        statusIndicator.className = 'status-indicator ' + status;
        
        if (status === 'safe') {
            statusIcon.textContent = 'check_circle';
        } else if (status === 'danger') {
            statusIcon.textContent = 'dangerous';
        } else if (status === 'warning') {
            statusIcon.textContent = 'warning';
        } else {
            statusIcon.textContent = 'help';
        }
    }

    // Show the result card with appropriate styling
    function showResultCard(status) {
        // Hide other UI elements
        document.querySelectorAll('.card').forEach(card => {
            if (!card.classList.contains('result-card')) {
                card.style.display = 'none';
            }
        });
        
        resultCard.className = 'result-card';
        resultCircle.className = 'result-circle';
        
        if (status === 'loading') {
            resultCard.style.display = 'block';
            resultCircle.classList.add('neutral');
            resultIcon.textContent = 'hourglass_top';
            resultTitle.textContent = 'Analysis in progress...';
            resultDescription.textContent = 'Please wait while we analyze this URL.';
            continueBtn.style.display = 'none';
            viewDetailsBtn.style.display = 'none';
        }
        else if (status === 'safe') {
            resultCard.classList.add('safe');
            resultCard.style.display = 'block';
            resultCircle.classList.add('safe');
            resultIcon.textContent = 'check_circle';
            resultTitle.textContent = 'This website is safe';
            resultDescription.textContent = 'We\'ve checked this URL against our machine learning models and phishing databases. No suspicious activity detected.';
            continueBtn.style.display = 'block';
            viewDetailsBtn.style.display = 'block';
        }
        else if (status === 'danger') {
            resultCard.classList.add('danger');
            resultCard.style.display = 'block';
            resultCircle.classList.add('danger');
            resultIcon.textContent = 'dangerous';
            resultTitle.textContent = 'Phishing detected!';
            resultDescription.textContent = 'This website has been identified as a potential phishing site. We recommend you do not proceed.';
            continueBtn.style.display = 'block';
            viewDetailsBtn.style.display = 'block';
        }
    }

    // Hide the result card
    function hideResultCard() {
        resultCard.style.display = 'none';
        
        // Show other UI elements
        document.querySelectorAll('.card').forEach(card => {
            if (!card.classList.contains('result-card')) {
                card.style.display = 'block';
            }
        });
    }

    // Load stats from storage
    function loadStats() {
        chrome.storage.local.get(['stats'], function(result) {
            if (result.stats) {
                // Animate the number changes for better UX
                animateNumber(sitesScanned, parseInt(sitesScanned.textContent) || 0, result.stats.scanned || 0);
                animateNumber(threatsDetected, parseInt(threatsDetected.textContent) || 0, result.stats.threats || 0);
                
                // Calculate days active
                const installDate = result.stats.installDate || Date.now();
                const daysSinceInstall = Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24));
                animateNumber(daysActive, parseInt(daysActive.textContent) || 0, daysSinceInstall);
            } else {
                // Initialize stats
                const stats = {
                    scanned: 0,
                    threats: 0,
                    installDate: Date.now(),
                    history: []
                };
                
                chrome.storage.local.set({stats: stats});
                daysActive.textContent = '0';
            }
        });
    }

    // Update stats after a scan
    function updateStats(url, isThreat) {
        chrome.storage.local.get(['stats'], function(result) {
            let stats = result.stats || {
                scanned: 0,
                threats: 0,
                installDate: Date.now(),
                history: []
            };
            
            // Update counts
            stats.scanned++;
            if (isThreat) stats.threats++;
            
            // Add to history with unique ID and timestamp
            const newEntry = {
                id: Date.now(),
                url: url,
                timestamp: Date.now(),
                isSafe: !isThreat
            };
            
            // Add to beginning of history array
            stats.history.unshift(newEntry);
            
            // Save to storage and update UI
            chrome.storage.local.set({ stats }, function() {
                // Update UI with animation
                animateNumber(sitesScanned, parseInt(sitesScanned.textContent) || 0, stats.scanned);
                animateNumber(threatsDetected, parseInt(threatsDetected.textContent) || 0, stats.threats);
            });
        });
    }

    // Check authentication status - simplified to not modify UI
    function checkAuthStatus() {
        chrome.runtime.sendMessage({action: "checkAuth"}, function(response) {
            // Just keep track of auth state internally but don't modify UI
            if (response && response.isAuthenticated) {
                // Keep track of authentication state
                isAuthenticated = true;
            } else {
                isAuthenticated = false;
            }
            
            // Ensure only settings button is shown regardless of auth state
            ensureOnlySettingsButton();
        });
    }

    // Animate number changes
    function animateNumber(element, start, end) {
        const duration = 1000; // Animation duration in milliseconds
        const steps = 20; // Number of steps in animation
        const stepDuration = duration / steps;
        const increment = (end - start) / steps;
        let current = start;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current += increment;
            element.textContent = Math.round(current).toString();

            if (step >= steps) {
                clearInterval(timer);
                element.textContent = end.toString();
            }
        }, stepDuration);
    }

    // Listen for storage changes to keep popup in sync
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local' && changes.stats) {
            loadStats(); // Reload stats when they change
        }
    });
});