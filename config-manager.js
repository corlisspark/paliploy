// Dynamic Configuration Management System for PacksList
// Handles all dynamic content, privacy-first IDs, and smart caching

class ConfigManager {
  constructor() {
    this.configs = new Map();
    this.cache = new Map();
    this.isInitialized = false;
    this.callbacks = [];
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.sessionId = this.generateSessionId();
  }

  // Generate unique session ID for cache isolation
  generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
  }

  // Generate privacy-friendly unique IDs
  generatePublicId(type = 'item') {
    const prefix = {
      'pack': 'pack_',
      'city': 'city_',
      'user': 'user_',
      'vendor': 'vend_',
      'region': 'reg_'
    }[type] || 'item_';
    
    return prefix + Math.random().toString(36).substr(2, 8) + 
           Date.now().toString(36).substr(-4);
  }

  // Check if vendor information should be displayed
  shouldShowVendorInfo(context = 'card') {
    try {
      const vendorDisplayConfig = this.getConfig('vendor-display');
      if (!vendorDisplayConfig || Object.keys(vendorDisplayConfig).length === 0) {
        // Default behavior if no config exists
        return true;
      }
      
      switch(context) {
        case 'name':
          return vendorDisplayConfig.showVendorNames !== false;
        case 'icon':
          return vendorDisplayConfig.showVendorIcons !== false;
        case 'avatar':
          return vendorDisplayConfig.showVendorAvatars !== false;
        case 'modal':
          return vendorDisplayConfig.hideVendorInModal !== true;
        default:
          return vendorDisplayConfig.showVendorNames !== false;
      }
    } catch (error) {
      console.warn('Error checking vendor visibility:', error);
      return true; // Default to showing vendor info if there's an error
    }
  }

  // Initialize all configurations
  async initialize() {
    try {
      console.log('Initializing ConfigManager...');
      
      // Load critical configs first (needed for UI)
      await this.loadCriticalConfigs();
      
      // Load remaining configs in background
      this.loadAllConfigs();
      
      this.isInitialized = true;
      this.notifyCallbacks('initialized');
      
      return true;
    } catch (error) {
      console.error('ConfigManager initialization failed:', error);
      // Load fallback configs
      this.loadFallbackConfigs();
      return false;
    }
  }

  // Load essential configs for immediate UI rendering
  async loadCriticalConfigs() {
    const critical = {
      defaultPlaceholder: "Search packs, cities...",
      loadingMessage: "Loading your area...",
      errorMessage: "Unable to load your area",
      defaultRegion: "northeast"
    };
    
    try {
      // Try to load from Firebase first
      const snapshot = await db.collection("config").doc("ui-critical").get();
      if (snapshot.exists) {
        Object.assign(critical, snapshot.data());
      }
    } catch (error) {
      console.warn('Using fallback critical configs');
    }
    
    this.configs.set('critical', critical);
    return critical;
  }

  // Load all configuration data
  async loadAllConfigs() {
    const configTypes = [
      'cities',
      'product-types', 
      'vendor-categories',
      'metro-areas',
      'ui-strings',
      'region-settings'
    ];

    const promises = configTypes.map(type => this.loadConfigType(type));
    await Promise.allSettled(promises);
  }

  // Load specific configuration type
  async loadConfigType(type) {
    const cacheKey = `config_${type}_${this.sessionId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.configs.set(type, cached.data);
      return cached.data;
    }

    try {
      const snapshot = await db.collection("config")
        .doc(type)
        .get();
      
      let data = {};
      if (snapshot.exists) {
        data = snapshot.data();
      } else {
        // Create default document if it doesn't exist
        data = this.getDefaultConfig(type);
        await this.createDefaultConfig(type, data);
      }

      // Cache the data
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      this.configs.set(type, data);
      this.notifyCallbacks('configLoaded', { type, data });
      
      return data;
    } catch (error) {
      console.error(`Failed to load config type: ${type}`, error);
      
      // Use fallback data
      const fallback = this.getDefaultConfig(type);
      this.configs.set(type, fallback);
      return fallback;
    }
  }

  // Get default configuration for each type
  getDefaultConfig(type) {
    const defaults = {
      'cities': {
        items: [
          {
            id: this.generatePublicId('city'),
            key: 'boston',
            name: 'Boston',
            state: 'MA',
            coordinates: { lat: 42.3601, lng: -71.0589 },
            isActive: true,
            priority: 1,
            metroArea: 'greater-boston'
          },
          {
            id: this.generatePublicId('city'),
            key: 'providence',
            name: 'Providence', 
            state: 'RI',
            coordinates: { lat: 41.8240, lng: -71.4128 },
            isActive: true,
            priority: 2,
            metroArea: 'providence-metro'
          },
          {
            id: this.generatePublicId('city'),
            key: 'cambridge',
            name: 'Cambridge',
            state: 'MA', 
            coordinates: { lat: 42.3736, lng: -71.1097 },
            isActive: true,
            priority: 3,
            metroArea: 'greater-boston'
          }
        ]
      },

      'product-types': {
        items: [
          {
            id: this.generatePublicId('pack'),
            key: 'indica-pack',
            name: 'Indica Pack',
            category: 'cannabis',
            isActive: true,
            searchTerms: ['indica', 'relaxing', 'nighttime', 'chill'],
            icon: '🌙'
          },
          {
            id: this.generatePublicId('pack'),
            key: 'sativa-pack', 
            name: 'Sativa Pack',
            category: 'cannabis',
            isActive: true,
            searchTerms: ['sativa', 'energizing', 'daytime', 'focus'],
            icon: '☀️'
          },
          {
            id: this.generatePublicId('pack'),
            key: 'hybrid-pack',
            name: 'Hybrid Pack',
            category: 'cannabis', 
            isActive: true,
            searchTerms: ['hybrid', 'balanced', 'mixed', 'versatile'],
            icon: '🌿'
          }
        ]
      },

      'vendor-categories': {
        items: [
          {
            id: this.generatePublicId('vendor'),
            key: 'high-tolerance',
            name: 'High Tolerance',
            color: '#3498db',
            icon: 'H',
            isActive: true
          },
          {
            id: this.generatePublicId('vendor'),
            key: 'bozo-headstash',
            name: 'Bozo Headstash', 
            color: '#8e44ad',
            icon: 'B',
            isActive: true
          },
          {
            id: this.generatePublicId('vendor'),
            key: 'deep-fried',
            name: 'Deep Fried',
            color: '#f39c12',
            icon: 'D', 
            isActive: true
          },
          {
            id: this.generatePublicId('vendor'),
            key: 'gumbo',
            name: 'Gumbo',
            color: '#e74c3c',
            icon: 'G',
            isActive: true
          },
          {
            id: this.generatePublicId('vendor'),
            key: 'other',
            name: 'Other',
            color: '#95a5a6',
            icon: 'O',
            isActive: true
          }
        ]
      },

      'metro-areas': {
        items: [
          {
            id: this.generatePublicId('region'),
            key: 'greater-boston',
            name: 'Greater Boston',
            center: { lat: 42.3601, lng: -71.0589 },
            radius: 25,
            cities: ['boston', 'cambridge', 'somerville'],
            deliveryRadius: 15,
            isActive: true
          },
          {
            id: this.generatePublicId('region'),
            key: 'providence-metro',
            name: 'Providence Metro',
            center: { lat: 41.8240, lng: -71.4128 },
            radius: 20,
            cities: ['providence', 'cranston', 'warwick'],
            deliveryRadius: 12,
            isActive: true
          }
        ]
      },

      'ui-strings': {
        searchPlaceholders: [
          "Search packs in {cityName}...",
          "Find {productType} near you...",
          "Browse local packs...",
          "What are you looking for?",
          "Discover packs in your area..."
        ],
        
        locationMessages: [
          "Detecting your location in {regionName}...",
          "Found {packCount} packs near you",
          "Searching {cityName} area...",
          "Loading packs in your region..."
        ],
        
        personalizedPlaceholders: {
          returning_user: "Welcome back! Search your favorites...",
          first_time: "Discover packs in your area...", 
          mobile: "Tap to search nearby packs",
          desktop: "Search packs, cities, types...",
          evening: "Find evening packs near you...",
          morning: "Browse morning selections..."
        },
        
        errorMessages: {
          location_denied: "Enable location for better results",
          no_results: "No packs found in this area",
          connection_error: "Connection issue - try again",
          loading_error: "Unable to load content"
        }
      },

      'region-settings': {
        defaultRegion: 'northeast',
        fallbackLocation: { lat: 41.8240, lng: -71.4128 },
        maxSearchRadius: 50,
        cacheTimeout: 300000, // 5 minutes
        privacySettings: {
          fuzzyLocationRadius: 0.01, // ~1 mile
          hideExactCoordinates: true,
          sessionTimeout: 1800000 // 30 minutes
        }
      }
    };

    return defaults[type] || {};
  }

  // Create default config in Firebase
  async createDefaultConfig(type, data) {
    try {
      await db.collection("config").doc(type).set(data);
      console.log(`Created default config for ${type}`);
    } catch (error) {
      console.error(`Failed to create default config for ${type}:`, error);
    }
  }

  // Get configuration by type
  getConfig(type) {
    return this.configs.get(type) || {};
  }

  // Get specific config item by key
  getConfigItem(type, key) {
    const config = this.getConfig(type);
    if (config.items) {
      return config.items.find(item => item.key === key);
    }
    return null;
  }

  // Get active items only
  getActiveItems(type) {
    const config = this.getConfig(type);
    if (config.items) {
      return config.items.filter(item => item.isActive);
    }
    return [];
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Add callback for configuration updates
  onConfigUpdate(callback) {
    this.callbacks.push(callback);
  }

  // Notify all callbacks
  notifyCallbacks(event, data = null) {
    this.callbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Config callback error:', error);
      }
    });
  }

  // Load fallback configurations when Firebase fails
  loadFallbackConfigs() {
    console.warn('Loading fallback configurations');
    
    Object.keys(this.getDefaultConfig('')).forEach(type => {
      this.configs.set(type, this.getDefaultConfig(type));
    });
    
    this.isInitialized = true;
    this.notifyCallbacks('fallbackLoaded');
  }

  // Update configuration (for admin use)
  async updateConfig(type, data) {
    try {
      await db.collection("config").doc(type).update(data);
      
      // Update local cache
      this.configs.set(type, { ...this.getConfig(type), ...data });
      
      // Clear cache for this type
      const cacheKey = `config_${type}_${this.sessionId}`;
      this.cache.delete(cacheKey);
      
      this.notifyCallbacks('configUpdated', { type, data });
      
      return true;
    } catch (error) {
      console.error(`Failed to update config ${type}:`, error);
      return false;
    }
  }
}

// Global instance
window.configManager = new ConfigManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigManager;
}