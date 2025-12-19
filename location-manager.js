// Simple Location Manager for PacksList
// Unified location system with user-selected cities

class LocationManager {
  constructor() {
    this.currentCity = null;
    this.cities = [
      // Massachusetts
      { name: 'Boston', state: 'MA', key: 'boston', lat: 42.3601, lng: -71.0589 },
      { name: 'Springfield', state: 'MA', key: 'springfield', lat: 42.1015, lng: -72.5898 },
      { name: 'Worcester', state: 'MA', key: 'worcester', lat: 42.2626, lng: -71.8023 },
      { name: 'South Coast', state: 'MA', key: 'south-coast', lat: 41.6362, lng: -70.9342 },
      { name: 'North Shore', state: 'MA', key: 'north-shore', lat: 42.6648, lng: -71.1581 },
      
      // Rhode Island
      { name: 'Providence', state: 'RI', key: 'providence', lat: 41.8240, lng: -71.4128 },
      { name: 'Newport', state: 'RI', key: 'newport', lat: 41.4901, lng: -71.3128 },
      { name: 'Woonsocket', state: 'RI', key: 'woonsocket', lat: 42.0029, lng: -71.5153 },
      
      // Connecticut
      { name: 'Hartford', state: 'CT', key: 'hartford', lat: 41.7658, lng: -72.6734 },
      { name: 'New Haven', state: 'CT', key: 'new-haven', lat: 41.3083, lng: -72.9279 },
      { name: 'Bridgeport', state: 'CT', key: 'bridgeport', lat: 41.1865, lng: -73.2052 },
      { name: 'Stamford', state: 'CT', key: 'stamford', lat: 41.0534, lng: -73.5387 }
    ];
    
    this.listeners = [];
    this.init();
  }

  init() {
    // Load saved city from localStorage
    const savedCity = localStorage.getItem('packslist-selected-city');
    if (savedCity) {
      const cityData = this.getCityByKey(savedCity);
      if (cityData) {
        this.currentCity = cityData;
      }
    }
    
    // Default to Boston if no saved city
    if (!this.currentCity) {
      this.currentCity = this.getCityByKey('boston');
    }
    
    console.log('LocationManager initialized:', this.currentCity);
  }

  // Get all available cities
  getCities() {
    return [...this.cities];
  }

  // Get city by key
  getCityByKey(key) {
    return this.cities.find(city => city.key === key);
  }

  // Get current selected city
  getCurrentCity() {
    return this.currentCity;
  }

  // Set current city
  setCurrentCity(cityKey) {
    const city = this.getCityByKey(cityKey);
    if (!city) {
      console.error('Invalid city key:', cityKey);
      return false;
    }

    this.currentCity = city;
    
    // Save to localStorage
    localStorage.setItem('packslist-selected-city', cityKey);
    
    // Notify listeners
    this.notifyListeners(city);
    
    console.log('City changed to:', city);
    return true;
  }

  // Add listener for city changes
  onCityChange(callback) {
    this.listeners.push(callback);
  }

  // Remove listener
  removeCityChangeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notify all listeners of city change
  notifyListeners(city) {
    this.listeners.forEach(callback => {
      try {
        callback(city);
      } catch (error) {
        console.error('Error in city change listener:', error);
      }
    });
  }

  // Get display name for current city
  getCurrentCityDisplay() {
    if (!this.currentCity) return 'Select City';
    return `${this.currentCity.name}, ${this.currentCity.state}`;
  }

  // Get cities grouped by state for dropdown
  getCitiesGroupedByState() {
    const grouped = {};
    this.cities.forEach(city => {
      if (!grouped[city.state]) {
        grouped[city.state] = [];
      }
      grouped[city.state].push(city);
    });
    return grouped;
  }

  // Create city picker dropdown HTML
  createCityPickerHTML() {
    const grouped = this.getCitiesGroupedByState();
    
    let html = `
      <div class="city-picker">
        <label for="city-select">Choose your city:</label>
        <select id="city-select" class="city-select">
    `;
    
    Object.entries(grouped).forEach(([state, cities]) => {
      html += `<optgroup label="${state}">`;
      cities.forEach(city => {
        const selected = this.currentCity && this.currentCity.key === city.key ? 'selected' : '';
        html += `<option value="${city.key}" ${selected}>${city.name}</option>`;
      });
      html += `</optgroup>`;
    });
    
    html += `
        </select>
      </div>
    `;
    
    return html;
  }

  // Initialize city picker event listener
  initCityPicker() {
    // Use a timeout to ensure DOM is ready
    setTimeout(() => {
      const citySelect = document.getElementById('city-select');
      if (citySelect && !citySelect.hasAttribute('data-initialized')) {
        citySelect.setAttribute('data-initialized', 'true');
        citySelect.addEventListener('change', (e) => {
          this.setCurrentCity(e.target.value);
        });
        console.log('City picker initialized successfully');
      }
    }, 100);
  }

  // Get coordinates for current city
  getCurrentCoordinates() {
    if (!this.currentCity) return null;
    return {
      lat: this.currentCity.lat,
      lng: this.currentCity.lng
    };
  }
}

// Create global instance
window.locationManager = new LocationManager();
console.log('LocationManager: Global instance created', window.locationManager);

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocationManager;
}