// Dynamic Header Manager for PacksList
// Centralized header configuration and rendering across all pages

class HeaderManager {
  constructor() {
    this.config = {
      // Main brand configuration
      brand: {
        icon: '🌿',
        name: 'PacksList',
        homeUrl: 'index.html'
      },
      
      // Location indicator settings
      location: {
        enabled: true,
        defaultText: 'Detecting...'
      },
      
      // Authentication settings
      auth: {
        enabled: true,
        showUserInfo: true,
        guestIndicator: 'Guest'
      },
      
      // Admin-specific header config
      adminHeader: {
        title: 'PacksList Admin',
        backToSiteUrl: '../index.html',
        showAdminBadge: true
      }
    };
    
    this.isInitialized = false;
    this.headerType = this.detectHeaderType();
  }

  // Initialize header manager
  initialize() {
    if (this.isInitialized) return;
    
    console.log('HeaderManager: Initializing...', { type: this.headerType });
    
    // Render appropriate header based on context
    if (this.headerType === 'admin') {
      this.renderAdminHeader();
    } else {
      this.renderMainHeader();
    }
    
    // Set up dynamic updates
    this.setupDynamicUpdates();
    
    this.isInitialized = true;
    console.log('HeaderManager: Initialized successfully');
  }

  // Detect what type of header to render
  detectHeaderType() {
    const path = window.location.pathname;
    const isAdminPage = path.includes('/admin/') || path.includes('admin-panel');
    
    return isAdminPage ? 'admin' : 'main';
  }

  // Render main application header
  renderMainHeader() {
    const headerContainer = document.querySelector('.header') || this.createHeaderContainer();
    
    const headerHTML = `
      <div class="header-content">
        <div class="logo" onclick="window.location.href='${this.config.brand.homeUrl}'" title="Go to ${this.config.brand.name} Home">
          <div class="logo-icon">${this.config.brand.icon}</div>
          <span class="logo-text">${this.config.brand.name}</span>
        </div>
        <div class="header-city-picker">
          <div id="header-city-picker-container"></div>
        </div>
      </div>
    `;
    
    headerContainer.innerHTML = headerHTML;
    
    // Initialize city picker in header
    this.initializeHeaderCityPicker();
    
    // Initialize navigation manager if available
    if (window.navigationManager) {
      window.navigationManager.initialize();
    }
  }

  // Initialize city picker in header
  initializeHeaderCityPicker() {
    console.log('HeaderManager: Trying to initialize city picker');
    const container = document.getElementById('header-city-picker-container');
    console.log('HeaderManager: Container found?', !!container);
    console.log('HeaderManager: LocationManager available?', !!window.locationManager);
    
    if (container && window.locationManager) {
      console.log('HeaderManager: Creating city picker HTML');
      container.innerHTML = window.locationManager.createCityPickerHTML();
      console.log('HeaderManager: HTML created, container innerHTML:', container.innerHTML.slice(0, 100));
      
      // Initialize with a small delay to ensure DOM is updated
      setTimeout(() => {
        console.log('HeaderManager: Initializing city picker event listeners');
        window.locationManager.initCityPicker();
      }, 200);
    } else if (container) {
      // Retry after a delay if location manager isn't ready
      console.log('HeaderManager: LocationManager not ready, retrying...');
      setTimeout(() => {
        this.initializeHeaderCityPicker();
      }, 300);
    } else {
      console.log('HeaderManager: Container not found');
    }
  }

  // Render admin header
  renderAdminHeader() {
    const headerContainer = document.querySelector('.admin-header') || this.createAdminHeaderContainer();
    
    const headerHTML = `
      <div class="admin-header-content">
        <div class="admin-logo" onclick="window.location.href='${this.config.adminHeader.backToSiteUrl}'" title="Go to ${this.config.brand.name}">
          <div class="logo-icon">${this.config.brand.icon}</div>
          <span class="logo-text">${this.config.adminHeader.title}</span>
        </div>
        <div class="admin-header-actions">
          <div class="admin-user-info">
            <span id="admin-user-name">Admin User</span>
            ${this.config.adminHeader.showAdminBadge ? '<span class="admin-badge">👑</span>' : ''}
          </div>
          <button class="btn btn-outline btn-sm" onclick="window.location.href='${this.config.adminHeader.backToSiteUrl}'">
            🏠 Back to Site
          </button>
          <button class="btn btn-link btn-sm" onclick="window.authManager?.signOut()">
            Sign Out
          </button>
        </div>
      </div>
    `;
    
    headerContainer.innerHTML = headerHTML;
  }

  // Render user info section
  renderUserInfo() {
    return `
      <div class="user-info">
        <span id="user-indicator">${this.config.auth.guestIndicator}</span>
      </div>
    `;
  }

  // Render authentication buttons
  renderAuthButtons() {
    return `
      <div class="auth-buttons guest-only">
        <button class="auth-button" onclick="this.handleSignIn()">Sign In</button>
        <button class="auth-button auth-button-primary" onclick="this.handleSignUp()">Sign Up</button>
      </div>
    `;
  }

  // Create header container if it doesn't exist
  createHeaderContainer() {
    const header = document.createElement('header');
    header.className = 'header';
    
    // Insert after any existing elements or at the beginning of body
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.insertBefore(header, appContainer.firstChild);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }
    
    return header;
  }

  // Create admin header container if it doesn't exist
  createAdminHeaderContainer() {
    const header = document.createElement('header');
    header.className = 'admin-header';
    
    const adminContainer = document.querySelector('.admin-container');
    if (adminContainer) {
      adminContainer.insertBefore(header, adminContainer.firstChild);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }
    
    return header;
  }

  // Set up dynamic updates for location, auth status, etc.
  setupDynamicUpdates() {
    // Listen for city changes from the new location manager
    if (window.locationManager) {
      window.locationManager.onCityChange((city) => {
        console.log('Header: City changed to', city);
      });
    } else {
      // Wait for location manager to be ready
      setTimeout(() => {
        this.initializeHeaderCityPicker();
      }, 500);
    }
    
    // Listen for auth state changes
    if (window.authManager) {
      // Set up auth state listener
      this.setupAuthStateListener();
    }
  }


  // Set up authentication state listener
  setupAuthStateListener() {
    // Listen for auth state changes
    window.addEventListener('authStateChanged', (event) => {
      const { user, isAdmin } = event.detail;
      this.updateAuthUI(user, isAdmin);
    });
  }

  // Update authentication UI
  updateAuthUI(user, isAdmin = false) {
    const userIndicator = document.getElementById('user-indicator');
    const adminUserName = document.getElementById('admin-user-name');
    const guestButtons = document.querySelector('.guest-only');
    
    if (user) {
      // User is signed in
      const displayName = user.displayName || user.email || 'User';
      
      if (userIndicator) {
        userIndicator.textContent = displayName;
      }
      
      if (adminUserName) {
        adminUserName.textContent = displayName;
      }
      
      if (guestButtons) {
        guestButtons.style.display = 'none';
      }
    } else {
      // User is signed out
      if (userIndicator) {
        userIndicator.textContent = this.config.auth.guestIndicator;
      }
      
      if (guestButtons) {
        guestButtons.style.display = 'flex';
      }
    }
  }

  // Handle sign in button click
  handleSignIn() {
    if (window.authModals) {
      window.authModals.showSignIn();
    } else {
      console.error('Auth system not ready');
      alert('Auth system not ready. Please refresh the page.');
    }
  }

  // Handle sign up button click
  handleSignUp() {
    if (window.authModals) {
      window.authModals.showSignUp();
    } else {
      console.error('Auth system not ready');
      alert('Auth system not ready. Please refresh the page.');
    }
  }

  // Update header configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Re-render header if already initialized
    if (this.isInitialized) {
      if (this.headerType === 'admin') {
        this.renderAdminHeader();
      } else {
        this.renderMainHeader();
      }
    }
  }

  // Get current configuration
  getConfig() {
    return { ...this.config };
  }

  // Refresh header (useful for dynamic updates)
  refresh() {
    if (this.headerType === 'admin') {
      this.renderAdminHeader();
    } else {
      this.renderMainHeader();
    }
    this.setupDynamicUpdates();
  }

  // Destroy header manager
  destroy() {
    this.isInitialized = false;
  }
}

// Global click handlers for auth buttons (needed for inline onclick)
window.handleSignIn = function() {
  if (window.headerManager) {
    window.headerManager.handleSignIn();
  }
};

window.handleSignUp = function() {
  if (window.headerManager) {
    window.headerManager.handleSignUp();
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Create global instance
  window.headerManager = new HeaderManager();
  
  // Wait for location manager to be ready before initializing
  let attempts = 0;
  const maxAttempts = 50;
  
  function waitForLocationManager() {
    if (window.locationManager || attempts >= maxAttempts) {
      console.log('HeaderManager: Initializing with LocationManager ready:', !!window.locationManager);
      window.headerManager.initialize();
    } else {
      attempts++;
      setTimeout(waitForLocationManager, 100);
    }
  }
  
  waitForLocationManager();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeaderManager;
}