// Claude Usage Tracker - Popup Script
// Handles UI display and user interactions

const elements = {
  loadingContainer: document.getElementById('loadingContainer'),
  contentContainer: document.getElementById('contentContainer'),
  errorContainer: document.getElementById('errorContainer'),
  
  tierBadge: document.getElementById('tierBadge'),
  
  // 5-Hour
  fiveHourSection: document.getElementById('fiveHourSection'),
  fiveHourPercent: document.getElementById('fiveHourPercent'),
  fiveHourBar: document.getElementById('fiveHourBar'),
  fiveHourReset: document.getElementById('fiveHourReset'),
  
  // 7-Day
  sevenDaySection: document.getElementById('sevenDaySection'),
  sevenDayPercent: document.getElementById('sevenDayPercent'),
  sevenDayBar: document.getElementById('sevenDayBar'),
  sevenDayReset: document.getElementById('sevenDayReset'),
  
  // Sonnet Weekly
  sonnetWeeklySection: document.getElementById('sonnetWeeklySection'),
  sonnetPercent: document.getElementById('sonnetPercent'),
  sonnetBar: document.getElementById('sonnetBar'),
  sonnetReset: document.getElementById('sonnetReset'),
  
  // Opus Weekly
  opusWeeklySection: document.getElementById('opusWeeklySection'),
  opusPercent: document.getElementById('opusPercent'),
  opusBar: document.getElementById('opusBar'),
  opusReset: document.getElementById('opusReset'),
  
  lastUpdated: document.getElementById('lastUpdated'),
  errorMessage: document.getElementById('errorMessage'),
  
  refreshBtn: document.getElementById('refreshBtn'),
  retryBtn: document.getElementById('retryBtn')
};

function toggleRefreshSpinner(isSpinning) {
  if (!elements.refreshBtn) {
    return;
  }

  if (isSpinning) {
    elements.refreshBtn.classList.add('is-spinning');
  } else {
    elements.refreshBtn.classList.remove('is-spinning');
  }
}

function revealSection(sectionEl, delayMs = 0) {
  if (!sectionEl) {
    return;
  }

  sectionEl.style.display = 'block';
  sectionEl.style.animationDelay = `${delayMs}ms`;
  sectionEl.classList.remove('reveal');
  void sectionEl.offsetWidth;
  sectionEl.classList.add('reveal');
}

/**
 * Get color class based on utilization percentage
 */
function getColorClass(percentage) {
  if (percentage < 70) {
    return 'safe';
  } else if (percentage < 90) {
    return 'warning';
  } else {
    return 'critical';
  }
}

/**
 * Format time display
 */
function getTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
  } else {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Display quota data in the popup
 */
function displayUsageData(data) {
  if (!data) {
    showError('No data received from background script');
    return;
  }
  
  // Show content container
  elements.loadingContainer.style.display = 'none';
  elements.errorContainer.style.display = 'none';
  elements.contentContainer.style.display = 'block';
  
  // Display subscription tier
  elements.tierBadge.textContent = data.subscriptionTier || 'Unknown Tier';
  
  // Display 5-Hour limit
  if (data.fiveHour) {
    revealSection(elements.fiveHourSection, 20);
    const percent = Math.round(data.fiveHour.utilization);
    elements.fiveHourPercent.textContent = `${percent}%`;
    elements.fiveHourBar.style.width = `${percent}%`;
    elements.fiveHourBar.className = `progress-fill ${getColorClass(percent)}`;
    elements.fiveHourReset.textContent = data.fiveHour.resetsAt;
  } else {
    elements.fiveHourSection.style.display = 'none';
  }
  
  // Display 7-Day limit
  if (data.sevenDay) {
    revealSection(elements.sevenDaySection, 90);
    const percent = Math.round(data.sevenDay.utilization);
    elements.sevenDayPercent.textContent = `${percent}%`;
    elements.sevenDayBar.style.width = `${percent}%`;
    elements.sevenDayBar.className = `progress-fill ${getColorClass(percent)}`;
    elements.sevenDayReset.textContent = data.sevenDay.resetsAt;
  } else {
    elements.sevenDaySection.style.display = 'none';
  }
  
  // Display Sonnet Weekly (if available)
  if (data.sonnetWeekly) {
    revealSection(elements.sonnetWeeklySection, 160);
    const percent = Math.round(data.sonnetWeekly.utilization);
    elements.sonnetPercent.textContent = `${percent}%`;
    elements.sonnetBar.style.width = `${percent}%`;
    elements.sonnetBar.className = `progress-fill ${getColorClass(percent)}`;
    elements.sonnetReset.textContent = data.sonnetWeekly.resetsAt;
  } else {
    elements.sonnetWeeklySection.style.display = 'none';
  }
  
  // Display Opus Weekly (if available)
  if (data.opusWeekly) {
    revealSection(elements.opusWeeklySection, 230);
    const percent = Math.round(data.opusWeekly.utilization);
    elements.opusPercent.textContent = `${percent}%`;
    elements.opusBar.style.width = `${percent}%`;
    elements.opusBar.className = `progress-fill ${getColorClass(percent)}`;
    elements.opusReset.textContent = data.opusWeekly.resetsAt;
  } else {
    elements.opusWeeklySection.style.display = 'none';
  }
  
  // Update last updated time
  const timeAgo = getTimeAgo(data.lastUpdatedTime);
  const staleIndicator = data.stale ? ' (cached)' : '';
  elements.lastUpdated.textContent = `Last updated: ${timeAgo}${staleIndicator}`;
  
  console.log('Usage data displayed:', data);
}

/**
 * Show error message
 */
function showError(errorMsg) {
  elements.loadingContainer.style.display = 'none';
  elements.contentContainer.style.display = 'none';
  elements.errorContainer.style.display = 'flex';
  elements.errorMessage.textContent = errorMsg;
  console.error('Error:', errorMsg);
}

/**
 * Show loading state
 */
function showLoading() {
  elements.loadingContainer.style.display = 'flex';
  elements.contentContainer.style.display = 'none';
  elements.errorContainer.style.display = 'none';
}

/**
 * Fetch and display usage data
 */
async function loadUsageData() {
  showLoading();
  toggleRefreshSpinner(true);
  
  try {
    // Send message to background script
    chrome.runtime.sendMessage({ action: 'getUsageData' }, (response) => {
      toggleRefreshSpinner(false);
      if (chrome.runtime.lastError) {
        showError('Extension error: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (response.success) {
        displayUsageData(response.data);
      } else {
        showError(response.error || 'Failed to fetch usage data');
      }
    });
  } catch (error) {
    toggleRefreshSpinner(false);
    showError('Failed to fetch data: ' + error.message);
  }
}

/**
 * Refresh button handler
 */
function handleRefresh() {
  showLoading();
  toggleRefreshSpinner(true);
  
  chrome.runtime.sendMessage({ action: 'refreshUsageData' }, (response) => {
    toggleRefreshSpinner(false);
    if (chrome.runtime.lastError) {
      showError('Extension error: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (response.success) {
      displayUsageData(response.data);
    } else {
      showError(response.error || 'Failed to refresh data');
    }
  });
}

/**
 * Retry button handler
 */
function handleRetry() {
  loadUsageData();
}

// Event listeners
elements.refreshBtn.addEventListener('click', handleRefresh);
elements.retryBtn.addEventListener('click', handleRetry);

// Load data when popup opens
console.log('Popup script loaded');
loadUsageData();
