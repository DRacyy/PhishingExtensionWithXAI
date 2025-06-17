// Updated history.js with authentication support
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - History
    const historyTableBody = document.getElementById('historyTableBody');
    const emptyHistory = document.getElementById('emptyHistory');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    const sitesScanned = document.getElementById('sitesScanned');
    const threatsDetected = document.getElementById('threatsDetected');
    const daysActive = document.getElementById('daysActive');
    
    // Search and Filter Elements
    const searchInput = document.getElementById('searchInput');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');
    
    // DOM Elements - Authentication
    const authStatus = document.getElementById('authStatus');
    const historyLoginBtn = document.getElementById('historyLoginBtn');
    const syncHistoryBtn = document.getElementById('syncHistoryBtn');
    
    // API Configuration - Change this to your Flask API URL
    const API_BASE_URL = 'http://localhost:5000/api';
    
    // Pagination variables
    let itemsPerPage = 20; // Changed from 50 to 20
    let currentPage = 1;
    let totalPages = 1;
    let historyData = [];
    let filteredData = [];
    let isAuthenticated = false;
    
    // Initialize date inputs with last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    startDate.valueAsDate = thirtyDaysAgo;
    endDate.valueAsDate = today;
    
    // Check auth status first
    checkAuthStatus();
    
    // Load history and stats
    loadStats();
    
    // Button event listeners
    clearHistoryBtn.addEventListener('click', clearHistory);
    exportHistoryBtn.addEventListener('click', exportHistory);
    prevPageBtn.addEventListener('click', () => navigateToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => navigateToPage(currentPage + 1));
    
    // Auth-related event listeners
    if (historyLoginBtn) {
        historyLoginBtn.addEventListener('click', function() {
            chrome.tabs.create({ url: 'login.html' });
        });
    }
    
    if (syncHistoryBtn) {
        syncHistoryBtn.addEventListener('click', handleSync);
    }
    
    // Add event listeners for search and filters
    searchInput.addEventListener('input', applyFilters);
    startDate.addEventListener('change', applyFilters);
    endDate.addEventListener('change', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    sortBy.addEventListener('change', applyFilters);
    
    // Check authentication status
    function checkAuthStatus() {
        chrome.runtime.sendMessage({action: "checkAuth"}, function(response) {
            if (response && response.isAuthenticated) {
                // User is authenticated
                isAuthenticated = true;
                showAuthenticatedUI(response.email);
                
                // First load local data to show something immediately
                loadStats(() => {
                    // Then load server data
                    loadFullHistory().catch(error => {
                        console.error('Error loading server history:', error);
                        showToast('Using local history data', 'info');
                    });
                });
            } else {
                // User is not authenticated
                isAuthenticated = false;
                showUnauthenticatedUI();
                
                // Just load local history
                loadStats();
            }
        });
    }
    
    // Show UI for authenticated users
    function showAuthenticatedUI(email) {
        // Update auth status indicator
        if (authStatus) {
            authStatus.className = 'auth-status signed-in';
            authStatus.innerHTML = `
                <i class="material-icons">check_circle</i>
                <span>Signed in as ${email}</span>
            `;
        }
        
        // Hide login button
        if (historyLoginBtn) {
            historyLoginBtn.style.display = 'none';
        }
        
        // Show sync button
        if (syncHistoryBtn) {
            syncHistoryBtn.style.display = 'flex';
        }
    }
    
    // Show UI for unauthenticated users
    function showUnauthenticatedUI() {
        // Update auth status indicator
        if (authStatus) {
            authStatus.className = 'auth-status signed-out';
            authStatus.innerHTML = `
                <i class="material-icons">info</i>
                <span>Sign in to sync history across devices</span>
            `;
        }
        
        // Show login button
        if (historyLoginBtn) {
            historyLoginBtn.style.display = 'flex';
        }
        
        // Hide sync button
        if (syncHistoryBtn) {
            syncHistoryBtn.style.display = 'none';
        }
    }
    
    // Handle sync button click
    function handleSync() {
        // Add visual feedback for syncing
        const originalText = syncHistoryBtn.innerHTML;
        syncHistoryBtn.innerHTML = '<i class="material-icons rotating">sync</i> Syncing...';
        syncHistoryBtn.disabled = true;
        
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
                    loadStats(() => {
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
                syncHistoryBtn.innerHTML = originalText;
                syncHistoryBtn.disabled = false;
            }, 1000);
        }
    }
    
    // Load stats and history from storage
    function loadStats(callback) {
        chrome.storage.local.get(['stats'], function(result) {
            if (result.stats) {
                // Update statistics
                sitesScanned.textContent = result.stats.scanned || 0;
                threatsDetected.textContent = result.stats.threats || 0;
                
                // Calculate days active
                const installDate = result.stats.installDate || Date.now();
                const daysSinceInstall = Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24));
                daysActive.textContent = daysSinceInstall;
                
                // Store the history data
                if (result.stats.history && result.stats.history.length > 0) {
                    historyData = result.stats.history;
                    // Only initialize filtered data if it's empty
                    if (!filteredData || filteredData.length === 0) {
                        filteredData = [...historyData];
                    }
                    
                    // Display the data
                    displayFilteredHistory(currentPage);
                    updatePaginationUI();
                } else {
                    // No history data
                    emptyHistory.classList.add('visible');
                    historyTableBody.innerHTML = '';
                    updatePaginationUI();
                }
                
                // Call callback if provided
                if (callback) callback();
            } else {
                // No stats found, initialize
                emptyHistory.classList.add('visible');
                historyTableBody.innerHTML = '';
                updatePaginationUI();
                
                // Call callback if provided
                if (callback) callback();
            }
        });
    }
    
    // Function to load history from server (for authenticated users)
    function loadFullHistory() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['auth'], function(result) {
                if (!result.auth || !result.auth.token) {
                    // If not authenticated, just use local data
                    displayFilteredHistory(currentPage);
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
                    displayFilteredHistory(currentPage);
                    reject(error);
                });
            });
        });
    }
    
    // Function to merge server and local history data
    function mergeHistoryData(serverHistory, localHistory) {
        // Create a map of existing server entries
        const serverEntries = new Map(
            serverHistory.map(item => [`${item.url}-${item.date}`, item])
        );
        
        // Add local entries that don't exist in server data
        localHistory.forEach(item => {
            const key = `${item.url}-${item.date}`;
            if (!serverEntries.has(key)) {
                serverHistory.push(item);
            }
        });
        
        // Sort by date (newest first)
        return serverHistory.sort((a, b) => b.date - a.date);
    }
    
    // Function to display history from server
    function displayServerHistory(history, pagination) {
        // Clear the table
        historyTableBody.innerHTML = '';
        
        // Hide the empty state if we have data
        if (history.length > 0) {
            emptyHistory.classList.remove('visible');
        } else {
            emptyHistory.classList.add('visible');
            return;
        }
        
        // Store the history data
        historyData = history;
        
        // Display the history items
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = Math.min(startIndex + pagination.limit, history.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = history[i];
            const row = createHistoryRow(item, i - startIndex);
            historyTableBody.appendChild(row);
        }
        
        // Update pagination
        currentPage = pagination.page;
        totalPages = pagination.totalPages;
        updatePaginationUI();
        
        // Update stats display
        sitesScanned.textContent = pagination.totalItems || history.length;
        
        // Count threats
        const threatCount = history.filter(item => !item.isSafe).length;
        threatsDetected.textContent = threatCount;
    }
    
    // Function to apply filters and sort
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const start = startDate.valueAsDate ? startDate.valueAsDate.getTime() : 0;
        const end = endDate.valueAsDate ? endDate.valueAsDate.getTime() + 86400000 : Date.now(); // Add 24 hours to include the end date
        const status = statusFilter.value;
        const sortOrder = sortBy.value;
        
        // Filter the data
        filteredData = historyData.filter(item => {
            const matchesSearch = item.url.toLowerCase().includes(searchTerm);
            const matchesDate = item.date >= start && item.date <= end;
            const matchesStatus = status === 'all' || 
                               (status === 'safe' && item.isSafe) || 
                               (status === 'threat' && !item.isSafe);
            
            return matchesSearch && matchesDate && matchesStatus;
        });
        
        // Sort the filtered data
        filteredData.sort((a, b) => {
            switch(sortOrder) {
                case 'oldest':
                    return a.date - b.date;
                case 'url':
                    return a.url.localeCompare(b.url);
                case 'newest':
                default:
                    return b.date - a.date;
            }
        });
        
        // Reset to first page and update display
        currentPage = 1;
        totalPages = Math.ceil(filteredData.length / itemsPerPage);
        displayFilteredHistory(currentPage);
        updatePaginationUI();
    }
    
    // Modified display function to use filtered data
    function displayFilteredHistory(page) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
        
        // Clear the table
        historyTableBody.innerHTML = '';
        
        // Check if there's any filtered data
        if (filteredData.length === 0) {
            emptyHistory.classList.add('visible');
            emptyHistory.textContent = 'No matching results found';
            return;
        }
        
        // Hide the empty state and show the history
        emptyHistory.classList.remove('visible');
        
        // Display the slice of filtered data for the current page
        for (let i = startIndex; i < endIndex; i++) {
            const item = filteredData[i];
            const row = createHistoryRow(item, i - startIndex);
            historyTableBody.appendChild(row);
        }
    }
    
    // Create a history row
    function createHistoryRow(item, index) {
        const row = document.createElement('tr');
        
        const statusCell = document.createElement('td');
        const statusIndicator = document.createElement('span');
        statusIndicator.className = `status-indicator ${item.isSafe ? 'safe' : 'danger'}`;
        statusIndicator.title = item.isSafe ? 'Safe' : 'Threat Detected';
        statusCell.appendChild(statusIndicator);
        
        const urlCell = document.createElement('td');
        urlCell.className = 'url-cell';
        urlCell.textContent = item.url;
        urlCell.title = item.url;
        
        const dateCell = document.createElement('td');
        const date = new Date(item.date);
        dateCell.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        const actionsCell = document.createElement('td');
        actionsCell.className = 'action-cell';
        
        const viewButton = document.createElement('button');
        viewButton.className = 'action-button';
        viewButton.innerHTML = '<i class="material-icons">visibility</i>';
        viewButton.title = 'View Details';
        viewButton.addEventListener('click', () => viewDetails(item));
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button';
        deleteButton.innerHTML = '<i class="material-icons">delete</i>';
        deleteButton.title = 'Delete Entry';
        
        // Different delete handling based on authentication
        if (isAuthenticated && item.id) {
            // Server-side deletion for authenticated users with server item ID
            deleteButton.addEventListener('click', () => deleteServerEntry(item.id));
        } else {
            // Local deletion
            deleteButton.addEventListener('click', () => deleteEntry(index));
        }
        
        actionsCell.appendChild(viewButton);
        actionsCell.appendChild(deleteButton);
        
        row.appendChild(statusCell);
        row.appendChild(urlCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);
        
        return row;
    }
    
    // Update pagination UI
    function updatePaginationUI() {
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
    }
    
    // Navigate to a specific page
    function navigateToPage(page) {
        if (page < 1 || page > totalPages) return;
        
        currentPage = page;
        displayFilteredHistory(currentPage);
        updatePaginationUI();
    }
    
    // Clear all history
    function clearHistory() {
        if (!confirm('Are you sure you want to clear all history?')) return;
        
        if (isAuthenticated) {
            // If authenticated, clear from the server first
            chrome.storage.local.get(['auth'], function(result) {
                if (result.auth && result.auth.token) {
                    fetch(`${API_BASE_URL}/history/clear`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${result.auth.token}`
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Clear local storage too
                            clearLocalHistory();
                            showToast('History cleared from all devices');
                        } else {
                            showToast('Failed to clear history from server', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Error clearing server history:', error);
                        showToast('Failed to clear history from server', 'error');
                    });
                } else {
                    // Token not found, just clear local
                    clearLocalHistory();
                }
            });
        } else {
            // Not authenticated, just clear local
            clearLocalHistory();
        }
    }
    
    // Clear history from local storage
    function clearLocalHistory() {
        chrome.storage.local.get(['stats'], function(result) {
            if (result.stats) {
                const stats = result.stats;
                stats.history = [];
                
                chrome.storage.local.set({stats: stats}, function() {
                    historyData = [];
                    currentPage = 1;
                    totalPages = 1;
                    displayFilteredHistory(currentPage);
                    updatePaginationUI();
                    showToast('History cleared');
                });
            }
        });
    }
    
    // Delete a single entry (local)
    function deleteEntry(index) {
        chrome.storage.local.get(['stats'], function(result) {
            if (result.stats) {
                const stats = result.stats;
                
                // Calculate the actual index in the history array
                const actualIndex = (currentPage - 1) * itemsPerPage + index;
                
                // Remove the entry
                stats.history.splice(actualIndex, 1);
                
                chrome.storage.local.set({stats: stats}, function() {
                    // Update local data
                    historyData = stats.history;
                    
                    // Recalculate total pages
                    totalPages = Math.ceil(historyData.length / itemsPerPage);
                    
                    // If the current page is now empty (except for the last page)
                    if (currentPage > totalPages) {
                        currentPage = totalPages || 1;
                    }
                    
                    // Redisplay the history
                    displayFilteredHistory(currentPage);
                    updatePaginationUI();
                });
            }
        });
    }
    
    // Delete entry from server
    function deleteServerEntry(id) {
        chrome.storage.local.get(['auth'], function(result) {
            if (result.auth && result.auth.token) {
                fetch(`${API_BASE_URL}/history/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${result.auth.token}`
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Refresh the display
                        loadFullHistory();
                        showToast('Entry deleted');
                    } else {
                        showToast('Failed to delete entry', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error deleting history item:', error);
                    showToast('Failed to delete entry', 'error');
                });
            } else {
                showToast('Authentication required', 'error');
            }
        });
    }
    
    // View details of an entry
    function viewDetails(item) {
        const date = new Date(item.date);
        const dateTimeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        const status = item.isSafe ? 'Safe' : 'Threat Detected';
        
        // Build a more detailed message for items with threat info
        let detailsMessage = `URL: ${item.url}\nScanned on: ${dateTimeStr}\nStatus: ${status}`;
        
        if (!item.isSafe && item.threatType) {
            detailsMessage += `\nThreat Type: ${item.threatType}`;
            
            if (item.threatScore) {
                detailsMessage += `\nConfidence: ${(item.threatScore * 100).toFixed(0)}%`;
            }
        }
        
        alert(detailsMessage);
    }
    
    // Export history to CSV
    function exportHistory() {
        if (historyData.length === 0) {
            alert('No history data to export');
            return;
        }
        
        let csvContent = 'URL,Date,Status,Threat Type,Confidence\n';
        
        historyData.forEach(item => {
            const date = new Date(item.date);
            const dateTimeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            const status = item.isSafe ? 'Safe' : 'Threat Detected';
            const threatType = item.isSafe ? '' : (item.threatType || 'Unknown');
            const threatScore = item.isSafe ? '' : (item.threatScore || '');
            
            // Escape quotes in URL
            const escapedUrl = item.url.replace(/"/g, '""');
            
            csvContent += `"${escapedUrl}","${dateTimeStr}","${status}","${threatType}","${threatScore}"\n`;
        });
        
        // Create a Blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'ShieldScan_History.csv');
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(function() {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    // Show toast notification
    function showToast(message, type = 'info') {
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
            toast.classList.add('toast-hide');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Add loadFullHistory to filter change handlers
    searchInput.addEventListener('input', debounce(() => {
        if (isAuthenticated) {
            loadFullHistory();
        } else {
            applyFilters();
        }
    }, 300));
    
    startDate.addEventListener('change', () => {
        if (isAuthenticated) {
            loadFullHistory();
        } else {
            applyFilters();
        }
    });
    
    endDate.addEventListener('change', () => {
        if (isAuthenticated) {
            loadFullHistory();
        } else {
            applyFilters();
        }
    });
    
    statusFilter.addEventListener('change', () => {
        if (isAuthenticated) {
            loadFullHistory();
        } else {
            applyFilters();
        }
    });
    
    sortBy.addEventListener('change', () => {
        if (isAuthenticated) {
            loadFullHistory();
        } else {
            applyFilters();
        }
    });
    
    // Debounce function to limit API calls
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
