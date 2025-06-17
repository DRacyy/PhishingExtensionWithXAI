document.addEventListener('DOMContentLoaded', function() {
    // Constants
    const ITEMS_PER_PAGE = 10;
    const API_BASE_URL = 'http://localhost:5000/api';
    const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

    // Initialize Lucide icons
    lucide.createIcons();

    // Initialize theme from localStorage or default to light
    document.documentElement.classList.add(localStorage.getItem('theme') || 'light');

    // DOM Elements - Stats
    const sitesScannedEl = document.getElementById('sitesScanned');
    const threatsDetectedEl = document.getElementById('threatsDetected');
    const safeUrlsEl = document.getElementById('safeUrls');
    const daysActiveEl = document.getElementById('daysActive');
    
    // DOM Elements - Search and Filter
    const searchInput = document.getElementById('searchInput');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');
    
    // DOM Elements - Buttons
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const exportBtn = document.getElementById('exportBtn');
    const syncPrompt = document.querySelector('.sync-prompt');
    const syncNowBtn = document.getElementById('syncNowBtn');
    
    // DOM Elements - Pagination
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    
    // Theme toggle functionality
    const themeToggle = document.querySelector('.theme-toggle');
    const moonIcon = `<i data-lucide="moon"></i>`;
    const sunIcon = `<i data-lucide="sun"></i>`;
    
    // Check saved theme preference
    // const savedTheme = localStorage.getItem('theme') || 'light'; // This line is still useful for updateThemeIcon indirectly via localStorage
    // document.body.className = savedTheme; // Removed: Theme class is handled by documentElement
    // themeToggle.innerHTML = savedTheme === 'dark' ? sunIcon : moonIcon; // Removed: updateThemeIcon handles this
    
    function updateThemeIcon() {
        const isDark = document.documentElement.classList.contains('dark');
        themeToggle.innerHTML = isDark ? sunIcon : moonIcon;
        lucide.createIcons(); // Re-initialize icons after changing innerHTML
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        document.documentElement.classList.remove(isDark ? 'dark' : 'light');
        document.documentElement.classList.add(isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        updateThemeIcon();
    });

    // Initialize theme icon on load
    updateThemeIcon();

    // State management
    let currentPage = 1;
    let totalPages = 1;
    let historyData = [];
    let filteredData = [];
    let isAuthenticated = false;
    let autoSyncIntervalId = null; // Variable to store the auto-sync interval ID
    
    // Function to clear history
    function clearHistory() {
        if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
            chrome.storage.local.get(['stats'], function(result) {
                if (result.stats) {
                    // Create a new stats object without the history
                    const newStats = {
                        ...result.stats,
                        history: [],
                        scanned: 0,
                        threats: 0
                    };

                    // Update storage
                    chrome.storage.local.set({ stats: newStats }, function() {
                        // Reset data
                        historyData = [];
                        filteredData = [];
                        currentPage = 1;
                        totalPages = 1;

                        // Update UI
                        updateStats(newStats);
                        displayHistory();
                        showToast('History cleared successfully');
                    });
                }
            });
        }
    }

    // Initialize date inputs with last 30 days
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of day to include all of today's entries
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0); // Set to start of day

    // Format dates to YYYY-MM-DD for input value
    const formatDate = (date) => {
        // Get the local date components
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Set the date inputs with proper timezone handling
    if (startDate) {
        startDate.value = formatDate(thirtyDaysAgo);
        startDate.max = formatDate(today);
    }
    if (endDate) {
        endDate.value = formatDate(today);
        endDate.max = formatDate(today);
    }

    // Check auth status first
    checkAuthStatus();
    
    // Initialize event listeners
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));
    if (startDate) startDate.addEventListener('change', applyFilters);
    if (endDate) endDate.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (sortBy) sortBy.addEventListener('change', applyFilters);
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
    if (exportBtn) exportBtn.addEventListener('click', exportHistory);
    if (syncNowBtn) syncNowBtn.addEventListener('click', handleSync);
    if (syncPrompt) {
        syncPrompt.addEventListener('click', function() {
            chrome.tabs.create({ url: 'login.html' });
        });
    }
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => navigateToPage(currentPage - 1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => navigateToPage(currentPage + 1));
    
    // Initialize select options with values
    statusFilter.innerHTML = `
        <option value="all">All Status</option>
        <option value="safe">Safe</option>
        <option value="threat">Threats</option>
    `;

    sortBy.innerHTML = `
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="url">URL (A-Z)</option>
    `;
    
    function displayHistory() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        if (!filteredData || filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-state">
                            <div class="empty-icon">
                                <i data-lucide="search"></i>
                            </div>
                            <h3>No scan history yet</h3>
                            <p>Start browsing to see your scan results here</p>
                        </div>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length);
        const pageItems = filteredData.slice(startIndex, endIndex);

        // Clear existing content
        tbody.innerHTML = '';

        // Add new rows
        pageItems.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Status cell
            const statusCell = document.createElement('td');
            statusCell.className = `status-cell ${item.isSafe ? 'safe' : 'threat'}`;
            statusCell.innerHTML = `<div class="status-dot"></div>`;

            // URL cell
            const urlCell = document.createElement('td');
            urlCell.innerHTML = `<div class="url-cell">${item.url}</div>`;

            // Date/Time cell
            const dateCell = document.createElement('td');
            const date = new Date(item.timestamp || item.date);
            dateCell.innerHTML = `<span class="date-time">${date.toLocaleString()}</span>`;

            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-cell';
            
            // View button
            const viewBtn = document.createElement('button');
            viewBtn.className = 'action-btn ghost';
            viewBtn.innerHTML = '<i data-lucide="eye"></i>';
            viewBtn.addEventListener('click', () => viewDetails(item));

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn ghost';
            deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            deleteBtn.addEventListener('click', () => deleteEntry(item.id));

            actionsCell.appendChild(viewBtn);
            actionsCell.appendChild(deleteBtn);

            // Append all cells
            row.appendChild(statusCell);
            row.appendChild(urlCell);
            row.appendChild(dateCell);
            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });

        // Initialize icons
        lucide.createIcons();

        // Update pagination
        updatePagination();
    }

    function updatePagination() {
        const totalItems = filteredData.length;
        totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        
        // Update pagination text
        const pageIndicator = document.querySelector('.pagination span');
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        
        // Update button states
        const prevPageBtn = document.querySelector('.pagination .page-btn:first-child');
        const nextPageBtn = document.querySelector('.pagination .page-btn:last-child');
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    function navigateToPage(page) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            displayHistory();
        }
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const start = startDate.valueAsDate ? new Date(startDate.value + 'T00:00:00') : 0;
        const end = endDate.valueAsDate ? new Date(endDate.value + 'T23:59:59.999') : Date.now();
        const status = statusFilter.value.toLowerCase();
        const sort = sortBy.value.toLowerCase();
        
        // Filter data
        filteredData = historyData.filter(item => {
            const matchesSearch = item.url.toLowerCase().includes(searchTerm);
            const itemDate = new Date(item.timestamp || item.date);
            const matchesDate = itemDate >= start && itemDate <= end;
            const matchesStatus = status === 'all' || 
                               (status === 'safe' && item.isSafe) || 
                               (status === 'threat' && !item.isSafe);
            
            return matchesSearch && matchesDate && matchesStatus;
        });
        
        // Sort data
        filteredData.sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date).getTime();
            const dateB = new Date(b.timestamp || b.date).getTime();
            
            switch(sort) {
                case 'oldest':
                    return dateA - dateB;
                case 'url':
                    return a.url.localeCompare(b.url);
                case 'newest':
                default:
                    return dateB - dateA;
            }
        });
        
        // Reset to first page when filters change
        currentPage = 1;
        displayHistory();
    }

    // Auth-related event listeners
    if (syncPrompt) {
        syncPrompt.addEventListener('click', handleSync);
    }
    
    // Initialize stats with zeros
    function initializeStats() {
        if (sitesScannedEl) sitesScannedEl.textContent = '0';
        if (threatsDetectedEl) threatsDetectedEl.textContent = '0';
        if (safeUrlsEl) safeUrlsEl.textContent = '0';
        if (daysActiveEl) daysActiveEl.textContent = '0';
    }

    // Update stats with actual data
    function updateStats(stats) {
        if (!stats) return;

        const { scanned = 0, threats = 0, installDate } = stats;
        const daysActive = installDate 
            ? Math.max(0, Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24)))
            : 0;

        // Update stats with animation
        if (sitesScannedEl) animateNumber(sitesScannedEl, parseInt(sitesScannedEl.textContent) || 0, scanned);
        if (threatsDetectedEl) animateNumber(threatsDetectedEl, parseInt(threatsDetectedEl.textContent) || 0, threats);
        if (safeUrlsEl) animateNumber(safeUrlsEl, parseInt(safeUrlsEl.textContent) || 0, scanned - threats);
        if (daysActiveEl) animateNumber(daysActiveEl, parseInt(daysActiveEl.textContent) || 0, daysActive);
    }

    // Animate number changes
    function animateNumber(element, start, end) {
        if (!element) return;
        
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

    function loadHistory() {
        // Initialize with zeros first
        initializeStats();

        chrome.storage.local.get(['stats'], function(result) {
            if (result.stats) {
                const stats = result.stats;
                
                // Update stats
                updateStats(stats);
                
                // Update history
                if (stats.history && stats.history.length > 0) {
                    historyData = stats.history;
                    filteredData = [...stats.history];
                    applyFilters();
                } else {
                    showEmptyState();
                }

                // If authenticated, try to load server data
                if (isAuthenticated) {
                    loadServerHistory();
                }
            } else {
                showEmptyState();
            }
        });
    }

    // Load history from server for authenticated users
    function loadServerHistory() {
        chrome.storage.local.get(['auth'], function(result) {
            if (!result.auth || !result.auth.token) {
                return;
            }

            fetch(`${API_BASE_URL}/history`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${result.auth.token}`
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success && data.history) {
                    // Merge server data with local data
                    chrome.storage.local.get(['stats'], function(result) {
                        const stats = result.stats || {};
                        const mergedHistory = mergeHistoryData(data.history, stats.history || []);
                        stats.history = mergedHistory;
                        
                        // Update storage and display
                        chrome.storage.local.set({ stats }, function() {
                            historyData = mergedHistory;
                            filteredData = [...mergedHistory];
                            applyFilters();
                        });
                    });
                }
            })
            .catch(error => {
                console.error('Error loading server history:', error);
            });
        });
    }

    // Merge local and server history data
    function mergeHistoryData(serverHistory, localHistory) {
        const historyMap = new Map();

        // Add local history items to the map, keyed by their ID.
        if (Array.isArray(localHistory)) {
            localHistory.forEach(item => {
                if (item && item.id != null) { // Ensure item and item.id exist
                    historyMap.set(item.id, item);
                }
            });
        }

        // Merge server history items. If an ID exists, server data takes precedence.
        if (Array.isArray(serverHistory)) {
            serverHistory.forEach(serverEntry => {
                if (serverEntry && serverEntry.id != null) { // Ensure serverEntry and serverEntry.id exist
                    historyMap.set(serverEntry.id, serverEntry);
                }
            });
        }

        // Convert map values back to an array and sort by timestamp, newest first.
        return Array.from(historyMap.values()).sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date);
            const dateB = new Date(b.timestamp || b.date);
            return dateB - dateA;
        });
    }

    // Show empty state
    function showEmptyState() {
        const tbody = document.querySelector('.history-table tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i data-lucide="search"></i>
                        </div>
                        <h3>No scan history yet</h3>
                        <p>Start browsing to see your scan results here</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        updatePagination();
    }

    // Listen for storage changes
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local' && changes.stats) {
            const newStats = changes.stats.newValue;
            if (newStats) {
                historyData = newStats.history || [];
                filteredData = [...historyData];
                updateStats(newStats);
                applyFilters();
            }
        }
    });

    // Update stats when new scan is added
    function updateStatsOnNewScan(isThreat = false) {
        chrome.storage.local.get(['stats'], function(result) {
            const stats = result.stats || {};
            stats.scanned = (stats.scanned || 0) + 1;
            if (isThreat) {
                stats.threats = (stats.threats || 0) + 1;
            }
            if (!stats.installDate) {
                stats.installDate = Date.now();
            }

            chrome.storage.local.set({ stats }, function() {
                updateStats(stats);
            });
        });
    }
    
    function exportHistory() {
        const exportData = {
            history: filteredData,
            stats: {
                scanned: parseInt(sitesScannedEl.textContent) || 0,
                threats: parseInt(threatsDetectedEl.textContent) || 0,
                safeUrls: parseInt(safeUrlsEl.textContent) || 0,
                daysActive: parseInt(daysActiveEl.textContent) || 0
            },
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shieldscan-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function syncHistory() {
        if (!isAuthenticated) {
            // Redirect to login page if not authenticated
            chrome.tabs.create({ url: 'login.html' });
            return;
        }

        // Add loading state to sync button
        if (syncPrompt) {
            const originalText = syncPrompt.innerHTML;
            syncPrompt.innerHTML = `
                <i data-lucide="loader-2" class="rotating"></i>
                Syncing...
            `;
            syncPrompt.disabled = true;
            lucide.createIcons();

            // Attempt to sync
            chrome.runtime.sendMessage({ action: "syncNow" }, function(response) {
                if (response && response.success) {
                    loadHistory(); // Reload data after successful sync
                }
                
                // Reset button state
                setTimeout(() => {
                    syncPrompt.innerHTML = originalText;
                    syncPrompt.disabled = false;
                    lucide.createIcons();
                }, 1000);
            });
        }
    }
    
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // Check authentication status
    function checkAuthStatus() {
        chrome.runtime.sendMessage({action: "checkAuth"}, function(response) {
            if (response && response.isAuthenticated) {
                // User is authenticated
                isAuthenticated = true;
                
                // Hide sync prompt (for non-logged in users)
                if (syncPrompt) {
                    syncPrompt.style.display = 'none';
                }
                // Show Sync Now button
                if (syncNowBtn) {
                    syncNowBtn.style.display = 'inline-flex';
                }

                // Add status badge after sync prompt
                const container = document.querySelector('.container');
                const statsGrid = document.querySelector('.stats-grid');
                
                // Only add the status badge if it doesn't exist
                if (!document.querySelector('.status-badge')) {
                    const statusBadge = document.createElement('div');
                    statusBadge.className = 'status-badge success';
                    statusBadge.innerHTML = `
                        <div class="badge">
                            <div class="status-dot"></div>
                            Signed in
                        </div>
                        <span class="email">${response.email}</span>
                    `;
                    
                    // Insert the status badge before the stats grid
                    container.insertBefore(statusBadge, statsGrid);
                }
                
                // Perform initial sync and start auto-sync when authenticated
                performBackgroundSync(); // Initial sync on load/login
                if (autoSyncIntervalId) clearInterval(autoSyncIntervalId); // Clear previous interval
                autoSyncIntervalId = setInterval(performBackgroundSync, SYNC_INTERVAL);
                console.log(`Auto-sync interval started: ${SYNC_INTERVAL / (60 * 1000)} minutes.`);

                // First load local data to show something immediately
                loadHistory(() => {
                    // Then load server data
                    loadFullHistory().catch(error => {
                        console.error('Error loading server history:', error);
                        showToast('Using local history data', 'info');
                    });
                });
            } else {
                // User is not authenticated
                isAuthenticated = false;
                
                // Show sync prompt (for non-logged in users)
                if (syncPrompt) {
                    syncPrompt.style.display = 'inline-flex';
                }
                // Hide Sync Now button
                if (syncNowBtn) {
                    syncNowBtn.style.display = 'none';
                }
                
                // Remove status badge if it exists
                const statusBadge = document.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.remove();
                }
                
                // Stop auto-sync if user is not authenticated
                if (autoSyncIntervalId) {
                    clearInterval(autoSyncIntervalId);
                    autoSyncIntervalId = null;
                    console.log('Auto-sync interval stopped.');
                }
                
                // Just load local history
                loadHistory();
            }
        });
    }
    
    // Handle sync button click with new design classes
    function handleSync() {
        // Use syncNowBtn for UI updates if it exists, otherwise fallback to syncPrompt (for old logic if needed)
        const currentSyncButton = syncNowBtn || syncPrompt;
        if (!currentSyncButton) return; // Should not happen if button exists

        // Store original text and disable button
        const originalText = currentSyncButton.innerHTML;
        currentSyncButton.innerHTML = `
            <i data-lucide="loader-2" class="rotating"></i>
            Syncing...
        `;
        currentSyncButton.disabled = true;
        lucide.createIcons();
        
        // Store current display state
        const currentDisplayState = {
            page: currentPage,
            searchTerm: searchInput.value,
            startDate: startDate.valueAsDate,
            endDate: endDate.valueAsDate,
            status: statusFilter.value,
            sortOrder: sortBy.value
        };
        
        // Get local history first
        chrome.storage.local.get(['stats', 'auth'], function(result) {
            if (!result.stats || !result.stats.history) {
                showToast('No history to sync', 'info');
                resetSyncButton();
                return;
            }

            if (!result.auth || !result.auth.token) {
                showToast('Please log in to sync history', 'error');
                resetSyncButton();
                return;
            }

            // Send sync message to background script
            chrome.runtime.sendMessage({
                action: "syncNow"
            }, async function(response) {
                if (response && response.success) {
                    showToast('History synchronized successfully');
                    console.log(`Sync completed: Added ${response.added} items, Updated ${response.updated} items`);
                    
                    // Wait a moment for the background sync to complete
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // First reload local data
                    loadHistory(() => {
                        // Then load server data
                        loadFullHistory().then(() => {
                            // Restore display state
                            currentPage = currentDisplayState.page;
                            searchInput.value = currentDisplayState.searchTerm;
                            startDate.valueAsDate = currentDisplayState.startDate;
                            endDate.valueAsDate = currentDisplayState.endDate;
                            statusFilter.value = currentDisplayState.status;
                            sortBy.value = currentDisplayState.sortOrder;
                            
                            // Reapply filters with restored state
                            if (isAuthenticated) {
                                loadFullHistory();
                            } else {
                                applyFilters();
                            }
                        });
                    });
                } else {
                    showToast('Failed to sync history', 'error');
                    console.error('Sync failed:', response?.error || 'Unknown error');
                }
                resetSyncButton();
            });
        });

        function resetSyncButton() {
            setTimeout(() => {
                // Use currentSyncButton here as well
                if (currentSyncButton) {
                    currentSyncButton.innerHTML = originalText;
                    currentSyncButton.disabled = false;
                    lucide.createIcons();
                }
            }, 1000);
        }
    }
    
    // Function to load history from server (for authenticated users)
    function loadFullHistory() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['auth'], function(result) {
                if (!result.auth || !result.auth.token) {
                    // If not authenticated, just use local data
                    displayHistory();
                    resolve();
                    return;
                }
                
                // Build query parameters
                const params = new URLSearchParams({
                    limit: '1000', // Request more items to avoid pagination issues
                    page: '1',
                    search: searchInput.value,
                    status: statusFilter.value,
                    sort: sortBy.value
                });
                
                // Add date parameters if they exist
                if (startDate.valueAsDate) {
                    params.append('start_date', startDate.valueAsDate.getTime().toString());
                }
                if (endDate.valueAsDate) {
                    params.append('end_date', endDate.valueAsDate.getTime().toString());
                }
                
                fetch(`${API_BASE_URL}/history?${params.toString()}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${result.auth.token}`
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.history) {
                        // Merge server data with local data
                        const mergedHistory = mergeHistoryData(data.history, historyData);
                        
                        // Update both historyData and filteredData
                        historyData = mergedHistory;
                        filteredData = [...mergedHistory];
                        
                        // Apply current filters
                        applyFilters();
                        
                        // Save merged data back to local storage
                        chrome.storage.local.get(['stats'], function(result) {
                            const stats = result.stats || {};
                            stats.history = mergedHistory;
                            chrome.storage.local.set({stats: stats}, function() {
                                console.log('History saved to local storage');
                            });
                        });
                        
                        resolve();
                    } else {
                        reject(new Error('Invalid server response'));
                    }
                })
                .catch(error => {
                    console.error('Error fetching history:', error);
                    showToast('Failed to load history from server', 'error');
                    // On error, display local data
                    displayHistory();
                    reject(error);
                });
            });
        });
    }
    
    // View details of an entry
    function viewDetails(item) {
        const date = new Date(item.timestamp || item.date);
        const dateTimeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        const status = item.isSafe ? 'Safe' : 'Threat Detected';
        
        let detailsMessage = `URL: ${item.url}\nScanned on: ${dateTimeStr}\nStatus: ${status}`;
        
        if (!item.isSafe && item.threatType) {
            detailsMessage += `\nThreat Type: ${item.threatType}`;
            if (item.threatScore) {
                detailsMessage += `\nConfidence: ${(item.threatScore * 100).toFixed(0)}%`;
            }
        }
        
        alert(detailsMessage);
    }
    
    // Delete a single entry
    function deleteEntry(id) {
        if (!id) return;
        
        if (confirm('Are you sure you want to delete this entry?')) {
            chrome.storage.local.get(['stats'], function(result) {
                if (result.stats && result.stats.history) {
                    const entryIndex = result.stats.history.findIndex(item => item.id === id);
                    
                    if (entryIndex !== -1) {
                        const stats = result.stats;
                        const entry = stats.history[entryIndex];
                        
                        // Update threat count if needed
                        if (!entry.isSafe) {
                            stats.threats = Math.max(0, (stats.threats || 0) - 1);
                        }
                        
                        // Remove the entry
                        stats.history.splice(entryIndex, 1);
                        
                        // Update storage
                        chrome.storage.local.set({ stats }, function() {
                            historyData = stats.history;
                            filteredData = [...historyData];
                            applyFilters();
                            updateStats(stats);
                            showToast('Entry deleted successfully');
                        });
                    }
                }
            });
        }
    }

    // Function to perform background synchronization silently
    function performBackgroundSync() {
        if (!isAuthenticated) {
            console.log('Background sync skipped: User not authenticated.');
            // Ensure interval is cleared if somehow called without auth
            if (autoSyncIntervalId) {
                clearInterval(autoSyncIntervalId);
                autoSyncIntervalId = null;
            }
            return;
        }

        console.log('Performing background sync...');
        chrome.storage.local.get(['auth'], function(result) { 
            if (!result.auth || !result.auth.token) {
                console.error('Background sync failed: Not authenticated or no token found.');
                return;
            }

            chrome.runtime.sendMessage({ action: "syncNow" }, async function(response) {
                if (response && response.success) {
                    console.log(`Background sync completed: Added ${response.added} items, Updated ${response.updated} items`);
                    // Reload data silently after successful background sync
                    // loadHistory will handle local, and then loadFullHistory for server data if still authenticated
                    loadHistory(() => {
                        if(isAuthenticated) { // Re-check as loadHistory might take time
                            loadFullHistory().catch(error => {
                                console.error('Error loading server history after background sync:', error);
                            });
                        }
                    });
                } else {
                    console.error('Background sync failed:', response?.error || 'Unknown error');
                }
            });
        });
    }

    // Add all styles at the end
    const style = document.createElement('style');
    style.textContent = `
        .status-cell {
            position: relative;
            width: 48px;
            text-align: left;
            padding-left: 16px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin: 0;
        }
        .status-cell.safe .status-dot {
            background-color: var(--success-green);
        }
        .status-cell.threat .status-dot {
            background-color: var(--danger-red);
        }
        .url-cell {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #1a1a1a;
            text-align: left;
        }
        .date-time {
            color: #666666;
            font-size: 0.875rem;
            text-align: left;
            display: block;
        }
        .actions-cell {
            display: flex;
            gap: 8px;
            justify-content: flex-start;
        }
        .action-btn.ghost {
            background: none;
            border: none;
            padding: 4px;
            color: #666666;
            cursor: pointer;
            border-radius: 4px;
        }
        .action-btn.ghost:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }

        /* Dark mode styles */
        .dark .url-cell {
            color: #ffffff;
        }
        .dark .date-time {
            color: #a1a1aa;
        }
        .dark .action-btn.ghost {
            color: #a1a1aa;
        }
        .dark .action-btn.ghost:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }

        /* Table header styles */
        .history-table th {
            text-align: left;
            padding: 12px 16px;
        }
        .history-table td {
            padding: 12px 16px;
        }

        /* Date input styles */
        input[type="date"]::-webkit-calendar-picker-indicator {
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
        }
        
        input[type="date"]::-webkit-datetime-edit-day-field:focus,
        input[type="date"]::-webkit-datetime-edit-month-field:focus,
        input[type="date"]::-webkit-datetime-edit-year-field:focus {
            background-color: var(--primary-color);
            color: white;
            outline: none;
        }

        input[type="date"] {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 14px;
            color: #1a1a1a;
            background-color: white;
        }

        .dark input[type="date"] {
            background-color: #1a1a1a;
            border-color: #2d2d2d;
            color: white;
        }

        input[type="date"]:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 1px var(--primary-color);
        }
    `;
    document.head.appendChild(style);
});
