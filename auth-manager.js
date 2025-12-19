// Authentication Manager for PacksList
// Handles complete user authentication flows with Firebase

class AuthManager {
  constructor() {
    this.user = null;
    this.userProfile = null;
    this.isAdmin = false;
    this.authListeners = [];
    this.onboardingData = {};
    this.isInitialized = false;
    
    // Initialize when Firebase is ready
    this.initializeWhenReady();
  }

  // Wait for Firebase to be ready and initialize
  async initializeWhenReady() {
    const maxAttempts = 50; // 5 seconds max wait
    let attempts = 0;
    
    const checkFirebase = () => {
      attempts++;
      
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        try {
          // Initialize Firebase Auth
          this.auth = firebase.auth();
          this.db = firebase.firestore();
          
          // Firebase initialized successfully
          
          // Auth state change listener
          this.auth.onAuthStateChanged((user) => {
            this.handleAuthStateChange(user);
          });
          
          this.isInitialized = true;
          // AuthManager initialization complete
          
        } catch (error) {
          // AuthManager: Error initializing Firebase services
          if (attempts < maxAttempts) {
            setTimeout(checkFirebase, 100);
          }
        }
      } else if (attempts < maxAttempts) {
        // AuthManager: Waiting for Firebase
        setTimeout(checkFirebase, 100);
      } else {
        // AuthManager: Firebase initialization timeout
      }
    };
    
    checkFirebase();
  }

  // Handle authentication state changes
  async handleAuthStateChange(user) {
    this.user = user;
    
    if (user) {
      await this.loadUserProfile();
      await this.checkAdminStatus();
      this.notifyAuthListeners('authenticated', { user: this.user, profile: this.userProfile });
    } else {
      this.userProfile = null;
      this.isAdmin = false;
      this.notifyAuthListeners('unauthenticated');
    }
    
    this.updateUIForAuthState();
  }

  // Load user profile from Firestore
  async loadUserProfile() {
    if (!this.user) return null;
    
    try {
      const profileDoc = await this.db.collection('users').doc(this.user.uid).get();
      
      if (profileDoc.exists) {
        this.userProfile = profileDoc.data();
        
        // Update lastLogin and add missing fields if needed
        const needsUpdate = !this.userProfile.createdAt || !this.userProfile.lastLogin;
        if (needsUpdate) {
          const updateData = {
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          };
          
          // Add createdAt if missing (for existing users)
          if (!this.userProfile.createdAt) {
            updateData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          }
          
          // Add email if missing
          if (!this.userProfile.email && this.user.email) {
            updateData.email = this.user.email;
          }
          
          // Add displayName if missing
          if (!this.userProfile.displayName && (this.user.displayName || this.user.email)) {
            updateData.displayName = this.user.displayName || this.user.email.split('@')[0];
          }
          
          // Add role if missing
          if (!this.userProfile.role) {
            const isAdminEmail = this.user.email === 'sxpxru@gmail.com' || this.user.email === 'admin@packslist.com';
            const isSuperAdmin = this.user.email === 'sxpxru@gmail.com';
            updateData.role = isSuperAdmin ? 'super_admin' : (isAdminEmail ? 'admin' : 'user');
          }
          
          await this.db.collection('users').doc(this.user.uid).update(updateData);
          this.userProfile = { ...this.userProfile, ...updateData };
          console.log('Updated existing user profile with missing fields');
        } else {
          // Just update lastLogin
          await this.db.collection('users').doc(this.user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // Create initial profile
        this.userProfile = await this.createUserProfile();
      }
      
      return this.userProfile;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  // Create initial user profile
  async createUserProfile() {
    if (!this.user) return null;
    
    // Check if this is an admin email and assign appropriate role
    const isAdminEmail = this.user.email === 'sxpxru@gmail.com' || this.user.email === 'admin@packslist.com';
    const isSuperAdmin = this.user.email === 'sxpxru@gmail.com';
    
    const profile = {
      uid: this.user.uid,
      email: this.user.email,
      displayName: this.user.displayName || '',
      photoURL: this.user.photoURL || '',
      role: isSuperAdmin ? 'super_admin' : (isAdminEmail ? 'admin' : 'user'),
      permissions: isSuperAdmin ? 
        ['browse', 'post', 'moderate', 'manage_users', 'view_analytics', 'manage_settings', 'manage_admins', 'delete_data'] :
        (isAdminEmail ? ['browse', 'post', 'moderate', 'manage_users', 'view_analytics'] : ['browse', 'post']),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      preferences: {
        locationSharing: false,
        emailNotifications: true,
        pushNotifications: false
      },
      onboardingCompleted: false,
      accountStatus: 'active'
    };
    
    try {
      await this.db.collection('users').doc(this.user.uid).set(profile);
      return profile;
    } catch (error) {
      // Error creating user profile
      return null;
    }
  }

  // Check if user has admin privileges
  async checkAdminStatus() {
    if (!this.user || !this.userProfile) {
      this.isAdmin = false;
      return false;
    }
    
    // Check if user is in admin emails list from config
    const adminConfig = window.configManager?.getConfig('auth-settings');
    const adminEmails = adminConfig?.adminEmails || ['admin@packslist.com', 'sxpxru@gmail.com'];
    
    this.isAdmin = adminEmails.includes(this.user.email) || 
                   this.userProfile.role === 'admin' || 
                   this.userProfile.role === 'super_admin';
    
    return this.isAdmin;
  }

  // Sign up new user
  async signUp(email, password, userData = {}) {
    if (!this.isInitialized || !this.auth) {
      this.showAuthError('Authentication system not ready. Please try again.');
      return { success: false, error: 'Not initialized' };
    }
    
    try {
      this.showAuthLoading('Creating your account...');
      
      // Create user account
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Update display name if provided
      if (userData.displayName) {
        await user.updateProfile({
          displayName: userData.displayName
        });
      }
      
      // Send email verification
      try {
        await user.sendEmailVerification();
        console.log('Email verification sent to:', user.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail the signup if email verification fails
      }
      
      // Complete onboarding immediately (email verification happens separately)
      await this.completeOnboarding(userData);
      
      this.hideAuthLoading();
      this.showAuthSuccess('Account created successfully! Please check your email to verify your account.');
      
      return { success: true, user };
    } catch (error) {
      this.hideAuthLoading();
      this.showAuthError(this.getErrorMessage(error));
      return { success: false, error };
    }
  }

  // Sign in existing user
  async signIn(email, password) {
    if (!this.isInitialized || !this.auth) {
      this.showAuthError('Authentication system not ready. Please try again.');
      return { success: false, error: 'Not initialized' };
    }
    
    try {
      this.showAuthLoading('Signing you in...');
      
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Update last login
      if (this.userProfile) {
        await this.db.collection('users').doc(user.uid).update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      this.hideAuthLoading();
      this.showAuthSuccess('Welcome back!');
      
      return { success: true, user };
    } catch (error) {
      this.hideAuthLoading();
      this.showAuthError(this.getErrorMessage(error));
      return { success: false, error };
    }
  }

  // Sign out user
  async signOut() {
    try {
      await this.auth.signOut();
      this.showAuthSuccess('You have been signed out.');
      
      // Redirect to home page
      if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
        window.location.href = 'index.html';
      }
      
      return { success: true };
    } catch (error) {
      this.showAuthError('Error signing out. Please try again.');
      return { success: false, error };
    }
  }

  // Email verification functions removed - no longer needed

  // Complete user onboarding
  async completeOnboarding(userData = {}) {
    if (!this.user) return;
    
    try {
      const updateData = {
        ...this.onboardingData,
        ...userData,
        onboardingCompleted: true,
        email: this.user.email,
        displayName: this.user.displayName || userData.displayName || this.user.email?.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        role: 'user' // Default role
      };
      
      // Update or create user profile
      await this.db.collection('users').doc(this.user.uid).set(updateData, { merge: true });
      this.userProfile = { ...this.userProfile, ...updateData };
      
      this.onboardingData = {};
      this.notifyAuthListeners('onboardingCompleted');
      
      console.log('User profile created/updated:', this.user.uid);
      
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  // Reset password
  async resetPassword(email) {
    try {
      await this.auth.sendPasswordResetEmail(email);
      this.showAuthSuccess('Password reset email sent! Check your inbox.');
      return { success: true };
    } catch (error) {
      this.showAuthError(this.getErrorMessage(error));
      return { success: false, error };
    }
  }

  // Send email verification
  async sendEmailVerification() {
    if (!this.user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      await this.user.sendEmailVerification();
      this.showAuthSuccess('Verification email sent! Please check your inbox and spam folder.');
      return { success: true };
    } catch (error) {
      console.error('Email verification error:', error);
      this.showAuthError('Failed to send verification email: ' + this.getErrorMessage(error));
      return { success: false, error };
    }
  }

  // Update user profile
  async updateProfile(updates) {
    if (!this.user) return { success: false, error: 'Not authenticated' };
    
    try {
      // Update Firebase Auth profile if needed
      const authUpdates = {};
      if (updates.displayName !== undefined) authUpdates.displayName = updates.displayName;
      if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;
      
      if (Object.keys(authUpdates).length > 0) {
        await this.user.updateProfile(authUpdates);
      }
      
      // Update Firestore profile
      await this.db.collection('users').doc(this.user.uid).update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update local profile
      this.userProfile = { ...this.userProfile, ...updates };
      
      this.notifyAuthListeners('profileUpdated', this.userProfile);
      return { success: true };
    } catch (error) {
      // Error updating profile
      return { success: false, error };
    }
  }

  // Check if user can perform action
  canPerformAction(action) {
    if (!this.userProfile) return false;
    
    const permissions = this.userProfile.permissions || [];
    return permissions.includes(action) || this.isAdmin;
  }

  // Email verification bypass function removed - no longer needed

  // Check if email is verified (email verification removed - always true)
  get isEmailVerified() {
    return true; // Email verification removed - all users considered verified
  }

  // Require authentication for action
  requireAuth(action = null) {
    if (!this.user) {
      this.showSignInModal();
      return false;
    }
    
    // Email verification removed - users can access immediately after signup
    
    if (action && !this.canPerformAction(action)) {
      this.showAuthError('You do not have permission to perform this action.');
      return false;
    }
    
    return true;
  }

  // Require admin access
  requireAdmin() {
    // RequireAdmin called - checking admin status
    
    // Check basic authentication first
    if (!this.user) {
      // RequireAdmin: No user found
      this.showSignInModal();
      return false;
    }
    // RequireAdmin: User exists
    
    // Check if profile exists
    if (!this.userProfile) {
      // RequireAdmin: No user profile found
      return false;
    }
    // RequireAdmin: User profile exists
    
    // Email verification removed - check admin status directly
    // RequireAdmin: Checking admin status directly
    console.log('  - isAdmin property:', this.isAdmin);
    console.log('  - userProfile.role:', this.userProfile.role);
    console.log('  - user email:', this.user.email);
    
    if (this.isAdmin) {
      console.log('✅ requireAdmin: Admin access GRANTED');
      return true;
    } else {
      console.log('❌ requireAdmin: isAdmin is false');
      this.showAuthError('Admin access required.');
      return false;
    }
  }

  // Get user-friendly error messages
  getErrorMessage(error) {
    console.error('Auth Error Details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    const errorMessages = {
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/operation-not-allowed': 'This operation is not allowed.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/missing-email': 'Please enter an email address.',
      'auth/missing-password': 'Please enter a password.',
      'auth/invalid-login-credentials': 'Invalid email or password.'
    };
    
    const friendlyMessage = errorMessages[error.code];
    if (!friendlyMessage) {
      console.warn('Unhandled auth error code:', error.code);
      return `Authentication error: ${error.message}`;
    }
    
    return friendlyMessage;
  }

  // UI Helper Methods
  updateUIForAuthState() {
    const authButtons = document.querySelectorAll('.auth-required');
    const guestButtons = document.querySelectorAll('.guest-only');
    const adminButtons = document.querySelectorAll('.admin-only');
    
    authButtons.forEach(btn => {
      btn.style.display = this.user ? 'block' : 'none';
    });
    
    guestButtons.forEach(btn => {
      btn.style.display = this.user ? 'none' : 'block';
    });
    
    adminButtons.forEach(btn => {
      btn.style.display = this.isAdmin ? 'block' : 'none';
    });
    
    // Update user info in header
    this.updateHeaderUserInfo();
  }

  updateHeaderUserInfo() {
    const userIndicator = document.getElementById('user-indicator');
    if (userIndicator) {
      if (this.user) {
        const displayName = this.userProfile?.displayName || this.user.email.split('@')[0];
        const adminBadge = this.isAdmin ? ' 👑' : '';
        userIndicator.textContent = `${displayName}${adminBadge}`;
        userIndicator.classList.add('authenticated');
      } else {
        userIndicator.textContent = 'Guest';
        userIndicator.classList.remove('authenticated');
      }
    }
  }

  // Modal Management
  showSignInModal() {
    this.showModal('sign-in-modal');
  }

  showSignUpModal() {
    this.showModal('sign-up-modal');
  }

  // Email verification modal removed - no longer needed

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  hideAllModals() {
    const modals = document.querySelectorAll('.auth-modal');
    modals.forEach(modal => modal.classList.remove('active'));
  }

  // Loading and Message Management
  showAuthLoading(message) {
    const loader = document.getElementById('auth-loader');
    const loaderText = document.getElementById('auth-loader-text');
    if (loader && loaderText) {
      loaderText.textContent = message;
      loader.classList.add('active');
    }
  }

  hideAuthLoading() {
    const loader = document.getElementById('auth-loader');
    if (loader) {
      loader.classList.remove('active');
    }
  }

  showAuthSuccess(message) {
    this.showAuthMessage(message, 'success');
  }

  showAuthError(message) {
    this.showAuthMessage(message, 'error');
  }

  showAuthMessage(message, type) {
    // Create or get message container
    let messageContainer = document.getElementById('auth-messages');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'auth-messages';
      messageContainer.className = 'auth-messages';
      document.body.appendChild(messageContainer);
    }
    
    const messageEl = document.createElement('div');
    messageEl.className = `auth-message auth-message-${type}`;
    messageEl.textContent = message;
    
    messageContainer.appendChild(messageEl);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 5000);
  }

  // Event Listeners
  addAuthListener(callback) {
    this.authListeners.push(callback);
  }

  removeAuthListener(callback) {
    const index = this.authListeners.indexOf(callback);
    if (index > -1) {
      this.authListeners.splice(index, 1);
    }
  }

  notifyAuthListeners(event, data = null) {
    this.authListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  // Public getters
  get currentUser() {
    return this.user;
  }

  get currentUserProfile() {
    return this.userProfile;
  }

  get isAuthenticated() {
    return !!this.user;
  }

  // Legacy getter - email verification removed
  get isEmailVerified() {
    return true; // Email verification removed - all users considered verified
  }

  get isAdminUser() {
    return this.isAdmin;
  }
}

// Initialize global auth manager
window.authManager = new AuthManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}