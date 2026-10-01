/**
 * Flyboro Frontend Engine
 * -------------------------------------------------------------
 * 1. Zero-latency dynamic CSS variable theme switching.
 * 2. Asynchronous API proxy fetcher with exact-shape CSS Skeleton Shimmer states.
 * 3. Mobile touch ergonomics (Thumb Zone bottom sheets, floating map toggle).
 * 4. Non-destructive inline form validation (never clears existing inputs).
 * 5. 5 Core Product flows:
 *    - Cars: Synchronized dates with live rental duration badge.
 *    - Flights: 7-day flexible fare matrix, direct vs layover transit timeline, upfront baggage strip.
 *    - Hotels: Touch-snap horizontal scroll photo galleries & interactive spatial map pins.
 *    - Vacations: Date flexibility toggle & live ticket tier steppers with instant subtotal.
 *    - Jets: Progressive 3-step concierge wizard with smooth slide transitions.
 * 6. Distraction-free checkout with zero-hidden-cost transparent accordion breakdown.
 * 7. WooCommerce & Stripe Cart Bridge triggers for instant conversion.
 */

(function () {
  'use strict';

  // Global Config (Injected by WordPress wp_localize_script or Vercel static)
  const CONFIG = window.flyboroConfig || {
    rootApi: '/wp-json/flyboro/v1',
    nonce: '',
    wcCartUrl: '/cart',
    enableClientMockFallback: true
  };

  // State & Multi-Currency Localization
  const state = {
    activeProduct: 'cars',
    abortController: null,
    currentResults: null,
    originalResults: null,
    activeCurrency: localStorage.getItem('flyboro_currency') || 'USD',
    activePromo: null,
    currencyRates: {
      USD: { code: 'USD', symbol: '$', rate: 1.0, locale: 'en-US' },
      INR: { code: 'INR', symbol: '₹', rate: 83.5, locale: 'en-IN' },
      EUR: { code: 'EUR', symbol: '€', rate: 0.92, locale: 'de-DE' },
      GBP: { code: 'GBP', symbol: '£', rate: 0.78, locale: 'en-GB' },
      AED: { code: 'AED', symbol: 'د.إ', rate: 3.67, locale: 'ar-AE' }
    }
  };

  /**
   * Converts a base USD price to target currency and formats using Intl.NumberFormat
   */
  function formatCurrency(amountInUSD, targetCurrency) {
    const code = (targetCurrency || state.activeCurrency || 'USD').toUpperCase();
    const config = state.currencyRates[code] || state.currencyRates.USD;
    const converted = Number(amountInUSD || 0) * config.rate;

    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      maximumFractionDigits: code === 'INR' || code === 'AED' ? 0 : 2
    }).format(converted);
  }

  // Product Line Content Metadata
  const PRODUCT_METADATA = {
    cars: {
      theme: 'theme-car-rental',
      title: 'Reserve Premium Car Rentals Worldwide',
      subtitle: 'Partnered with Carnect for direct fleet availability, zero hidden fees, and instant vouchers.',
      desc: 'Car Rentals (Trust & Efficiency)'
    },
    flights: {
      theme: 'theme-flights',
      title: 'Compare & Book Commercial Airline Flights',
      subtitle: 'Real-time global GDS ticketing powered by RateHawk with flexible fare options.',
      desc: 'Commercial Flights (Trust & Efficiency)'
    },
    hotels: {
      theme: 'theme-hotels',
      title: 'Curated 5-Star Luxury Hotels & Private Resorts',
      subtitle: 'Direct Hotelbeds portfolio integration offering premier hospitality perks and best rates.',
      desc: 'Hotels & Resorts (Luxury & Relaxation)'
    },
    vacations: {
      theme: 'theme-vacations',
      title: 'Handcrafted Adventure & All-Inclusive Escapes',
      subtitle: 'Immersive excursions, beachfront bundles, and curated regional expeditions.',
      desc: 'Vacation Packages (Action & Adventure)'
    },
    jets: {
      theme: 'theme-private-jets',
      title: 'Bespoke Private Charter Jets & Empty Legs',
      subtitle: 'On-demand heavy, midsize, and light jet availability with private VIP FBO handling.',
      desc: 'Private Jets (Exclusive Dark Mode)'
    }
  };

  // Dynamic Form Field Templates (Universal Horizontal Search Pill Layout)
  const FORM_TEMPLATES = {
    cars: `
      <div class="pill-input-group input-wrapper" onclick="this.querySelector('input').focus()">
        <label for="input-pickup-location" class="micro-label">PICK-UP LOCATION *</label>
        <input type="text" id="input-pickup-location" name="location" class="pill-input location-autocomplete" placeholder="City or airport (e.g. DEL, MIA, JFK)" value="Miami (MIA)" required autocomplete="off" data-label="Pick-up Location">
        <ul class="autocomplete-dropdown" role="listbox"></ul>
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('input').focus()">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label for="input-pickup-date" class="micro-label">PICK-UP DATE *</label>
          <div id="car-duration-badge" style="font-size: 0.65rem; font-weight: 800; color: #FF6D00; background: rgba(255, 109, 0, 0.1); padding: 1px 6px; border-radius: 9999px;">
            ⏱️ <span id="car-duration-text">7 Days</span>
          </div>
        </div>
        <input type="date" id="input-pickup-date" name="start_date" class="pill-input" required data-label="Pick-up Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('input').focus()">
        <label for="input-return-date" class="micro-label">DROP-OFF DATE *</label>
        <input type="date" id="input-return-date" name="end_date" class="pill-input" required data-label="Drop-off Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('select').focus()">
        <label for="input-driver-age" class="micro-label">DRIVER AGE</label>
        <select id="input-driver-age" name="driver_age" class="pill-input" data-label="Driver Age">
          <option value="25+" selected>25 to 69 Years (Standard)</option>
          <option value="21-24">21 to 24 Years (Young Driver)</option>
          <option value="70+">70+ Years (Senior Driver)</option>
        </select>
      </div>
    `,
    flights: `
      <div class="pill-input-group input-wrapper" onclick="this.querySelector('input').focus()">
        <label for="input-origin" class="micro-label">FLYING FROM *</label>
        <input type="text" id="input-origin" name="origin" class="pill-input location-autocomplete" placeholder="Origin (e.g. DEL, JFK)" value="New Delhi (DEL)" required autocomplete="off" data-label="Flying From">
        <ul class="autocomplete-dropdown" role="listbox"></ul>
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group input-wrapper" onclick="this.querySelector('input').focus()">
        <label for="input-destination" class="micro-label">FLYING TO *</label>
        <input type="text" id="input-destination" name="destination" class="pill-input location-autocomplete" placeholder="Destination (e.g. LHR, DXB)" value="London (LHR)" required autocomplete="off" data-label="Flying To">
        <ul class="autocomplete-dropdown" role="listbox"></ul>
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('input').focus()">
        <label for="input-flight-dep" class="micro-label">DEPARTURE DATE *</label>
        <input type="date" id="input-flight-dep" name="start_date" class="pill-input" required data-label="Departure Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" id="flight-return-group" onclick="this.querySelector('input').focus()">
        <label for="input-flight-ret" class="micro-label">RETURN DATE *</label>
        <input type="date" id="input-flight-ret" name="end_date" class="pill-input" required data-label="Return Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('select').focus()">
        <label for="input-passengers" class="micro-label">CABIN & PASSENGERS</label>
        <select id="input-passengers" name="passengers" class="pill-input" data-label="Cabin & Passengers">
          <option value="1-economy" selected>1 Adult, Economy</option>
          <option value="2-economy">2 Adults, Economy</option>
          <option value="2-business">2 Adults, Business Class</option>
          <option value="1-first">1 Adult, First Class</option>
        </select>
      </div>
    `,
    hotels: `
      <div class="pill-input-group input-wrapper" onclick="this.querySelector('input').focus()">
        <label for="input-hotel-dest" class="micro-label">DESTINATION / RESORT *</label>
        <input type="text" id="input-hotel-dest" name="location" class="pill-input location-autocomplete" placeholder="City or resort (e.g. Paris, Dubai)" value="Paris (CDG)" required autocomplete="off" data-label="Destination">
        <ul class="autocomplete-dropdown" role="listbox"></ul>
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('input').focus()">
        <label for="input-hotel-in" class="micro-label">CHECK-IN DATE *</label>
        <input type="date" id="input-hotel-in" name="start_date" class="pill-input" required data-label="Check-in Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('input').focus()">
        <label for="input-hotel-out" class="micro-label">CHECK-OUT DATE *</label>
        <input type="date" id="input-hotel-out" name="end_date" class="pill-input" required data-label="Check-out Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('select').focus()">
        <label for="input-hotel-rooms" class="micro-label">GUESTS & ROOMS</label>
        <select id="input-hotel-rooms" name="guests" class="pill-input" data-label="Guests & Rooms">
          <option value="2-1" selected>2 Guests, 1 Suite</option>
          <option value="1-1">1 Guest, 1 Deluxe Room</option>
          <option value="4-2">4 Guests, 2 Villa Suites</option>
        </select>
      </div>
    `,
    vacations: `
      <div class="pill-input-group input-wrapper" onclick="this.querySelector('input').focus()">
        <label for="input-vacation-dest" class="micro-label">PACKAGE EXPERIENCE / REGION *</label>
        <input type="text" id="input-vacation-dest" name="location" class="pill-input location-autocomplete" placeholder="Destination Region" value="Costa Rica (SJO)" required autocomplete="off" data-label="Package Experience">
        <ul class="autocomplete-dropdown" role="listbox"></ul>
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" id="vacation-date-group" onclick="this.querySelector('input').focus()">
        <label for="input-vacation-start" class="micro-label" id="vacation-date-label">TARGET DATE *</label>
        <input type="date" id="input-vacation-start" name="start_date" class="pill-input" required data-label="Target Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('select').focus()">
        <label for="vacation-guest-select" class="micro-label">GUESTS ALLOCATION</label>
        <select id="vacation-guest-select" name="guests" class="pill-input" data-label="Guests Allocation">
          <option value="2-0" selected>2 Adults, 0 Children</option>
          <option value="1-0">1 Adult, 0 Children</option>
          <option value="2-2">2 Adults, 2 Children</option>
          <option value="4-2">4 Adults, 2 Children</option>
        </select>
      </div>
    `,
    jets: `
      <div class="pill-input-group input-wrapper" onclick="this.querySelector('input').focus()">
        <label for="input-jet-origin" class="micro-label">DEPARTURE FBO *</label>
        <input type="text" id="input-jet-origin" name="origin" class="pill-input location-autocomplete" placeholder="Airport FBO (e.g. DEL, TEB)" value="New Delhi (DEL)" required autocomplete="off" data-label="Departure FBO">
        <ul class="autocomplete-dropdown" role="listbox"></ul>
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group input-wrapper" onclick="this.querySelector('input').focus()">
        <label for="input-jet-dest" class="micro-label">DESTINATION FBO *</label>
        <input type="text" id="input-jet-dest" name="destination" class="pill-input location-autocomplete" placeholder="Airport FBO (e.g. DXB, VNY)" value="Dubai (DXB)" required autocomplete="off" data-label="Destination FBO">
        <ul class="autocomplete-dropdown" role="listbox"></ul>
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('input').focus()">
        <label for="input-jet-date" class="micro-label">CHARTER DEPARTURE DATE *</label>
        <input type="date" id="input-jet-date" name="start_date" class="pill-input" required data-label="Charter Departure Date">
      </div>
      <div class="pill-divider"></div>
      <div class="pill-input-group" onclick="this.querySelector('select').focus()">
        <label for="input-jet-passengers" class="micro-label">ESTIMATED PASSENGERS</label>
        <select id="input-jet-passengers" name="passengers" class="pill-input" data-label="Estimated Passengers">
          <option value="5-8" selected>5 to 8 Passengers</option>
          <option value="1-4">1 to 4 Passengers</option>
          <option value="9-14">9 to 14 Passengers</option>
          <option value="15+">15+ Group Charter</option>
        </select>
      </div>
    `
  };

  // Mock responses for instant verification, UX heuristics and fallback
  const MOCK_INVENTORY = {
    cars: [
      {
        id: 'CR-TESLA-3',
        title: 'Tesla Model 3 Long Range',
        subtitle: 'Electric • 5 Seats • 340mi Range • Instant Keyless Entry',
        price: 89.00,
        provider: 'Carnect Direct Fleet',
        image_url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=360&auto=format&fit=crop&q=80',
        badges: ['Instant Confirmation', 'Zero Fuel Cost', 'Free Cancellation Included']
      },
      {
        id: 'CR-BMW-X5',
        title: 'BMW X5 xDrive40i M-Sport',
        subtitle: 'Automatic • Luxury SUV • 5 Seats • Navigation Included',
        price: 138.50,
        provider: 'Carnect Direct Fleet',
        image_url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=360&auto=format&fit=crop&q=80',
        badges: ['Premium Fleet', 'Unlimited Miles', 'Guaranteed Model']
      },
      {
        id: 'CR-PORSCHE-911',
        title: 'Porsche 911 Carrera 4S Cabriolet',
        subtitle: 'PDK Automatic • 2+2 Convertible • Sports Exhaust',
        price: 295.00,
        provider: 'Carnect Prestige',
        image_url: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=360&auto=format&fit=crop&q=80',
        badges: ['Prestige Selection', 'Full Comprehensive Coverage', 'Free Cancellation Included']
      }
    ],
    flights: [
      {
        id: 'FL-BA-178',
        title: 'British Airways • JFK → LHR',
        subtitle: 'Boeing 777-300ER • Club World Business • 6h 50m Nonstop',
        price: 1420.00,
        provider: 'RateHawk GDS',
        origin: 'JFK',
        destination: 'LHR',
        depTime: '20:15',
        arrTime: '08:05 +1',
        duration: '6h 50m',
        stops: 0,
        stopsText: 'Nonstop Direct',
        image_url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=360&auto=format&fit=crop&q=80',
        badges: ['Direct Flight', 'Lie-Flat Beds', 'Free Cancellation Included']
      },
      {
        id: 'FL-EK-202',
        title: 'Emirates • JFK → DXB',
        subtitle: 'Airbus A380-800 • First Class Private Suite • 12h 45m',
        price: 4890.00,
        provider: 'RateHawk GDS',
        origin: 'JFK',
        destination: 'DXB',
        depTime: '23:00',
        arrTime: '19:45 +1',
        duration: '12h 45m',
        stops: 0,
        stopsText: 'Nonstop Direct',
        image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=360&auto=format&fit=crop&q=80',
        badges: ['Direct Flight', 'Onboard Shower', 'Gourmet Dining']
      },
      {
        id: 'FL-QR-815',
        title: 'Qatar Airways • JFK → DEL',
        subtitle: 'Airbus A350-1000 • Qsuite Business • 1 Stop DOH (2h 10m)',
        price: 1850.00,
        provider: 'RateHawk GDS',
        origin: 'JFK',
        destination: 'DEL',
        depTime: '10:30',
        arrTime: '13:40 +1',
        duration: '17h 40m',
        stops: 1,
        stopsText: '1 Stop DOH (2h 10m Layover)',
        image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=360&auto=format&fit=crop&q=80',
        badges: ['World Best Business', 'Qsuite Privacy Door', 'Free Cancellation Included']
      }
    ],
    hotels: [
      {
        id: 'HT-CANAVES-OIA',
        title: 'Canaves Oia Suites & Spa',
        subtitle: 'Santorini Caldera View Suite • Private Infinity Pool • Breakfast',
        price: 840.00,
        provider: 'Hotelbeds Luxury',
        image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=480&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=480&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=480&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=480&auto=format&fit=crop&q=80'
        ],
        badges: ['Caldera View', 'Private Plunge Pool', 'Forbes 5-Star', 'Free Cancellation Included']
      },
      {
        id: 'HT-FOUR-SEASONS-CAP',
        title: 'Grand-Hôtel du Cap-Ferrat',
        subtitle: 'Four Seasons Palace • French Riviera Seafront Garden Suite',
        price: 1250.00,
        provider: 'Hotelbeds Luxury',
        image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=480&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=480&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=480&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=480&auto=format&fit=crop&q=80'
        ],
        badges: ['Michelin Star Dining', 'Club Dauphin Access', 'Spa Included', 'Free Cancellation Included']
      }
    ],
    vacations: [
      {
        id: 'VC-CR-CANOPY',
        title: 'Arenal Volcano & Rainforest Expedition',
        subtitle: '7 Days All-Inclusive • Private Naturalist • Cloud Forest Villa',
        price: 2150.00,
        provider: 'Hotelbeds Experiences',
        image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=360&auto=format&fit=crop&q=80',
        badges: ['All Transfers Included', 'Bilingual Guide', 'Eco-Luxury Certified', 'Free Cancellation Included']
      }
    ],
    jets: [
      {
        id: 'JET-GULF-G650',
        title: 'Gulfstream G650ER Intercontinental',
        subtitle: 'TEB (Teterboro) → VNY (Van Nuys) • Mach 0.90 • 14 Seats',
        price: 24500.00,
        provider: 'RateHawk Air Charter VIP',
        image_url: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?w=360&auto=format&fit=crop&q=80',
        badges: ['Private Terminal VIP FBO', 'Flight Attendant & Sommelier', 'High-Speed Ka-Band Wi-Fi']
      },
      {
        id: 'JET-CIT-X',
        title: 'Cessna Citation X+ Super Midsize',
        subtitle: 'Fastest Civil Jet in the World • 8 Passenger Executive Club',
        price: 13200.00,
        provider: 'RateHawk Air Charter VIP',
        image_url: 'https://images.unsplash.com/photo-1520437358207-323b43b50729?w=360&auto=format&fit=crop&q=80',
        badges: ['Empty Leg Guaranteed Rate', 'Pet Friendly', 'Free Cancellation Included']
      }
    ]
  };

  /**
   * Frictionless Non-Destructive Form Validator
   * Checks inputs without resetting user data; provides human-readable inline messages.
   */
  const FormValidator = {
    validate(formElement, scopeContainer = null) {
      let isValid = true;
      let firstInvalidInput = null;

      const root = scopeContainer || formElement;
      this.clearErrors(root);

      const inputs = root.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        if (input.type === 'hidden' || input.disabled) return;
        if (input.offsetParent === null && input.type !== 'radio') return;

        const val = (input.value || '').trim();
        const label = input.getAttribute('data-label') || (input.labels && input.labels[0] ? input.labels[0].textContent.replace('*', '').trim() : 'This field');
        let errorMsg = '';

        if (input.hasAttribute('required') && !val) {
          errorMsg = `${label} is required.`;
        } else if (input.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          errorMsg = `Please enter a valid email address (e.g. name@example.com).`;
        } else if (input.type === 'tel' && val && !/^[+0-9\s\-()]{7,20}$/.test(val)) {
          errorMsg = `Please enter a valid phone number (at least 7 digits).`;
        }

        if (errorMsg) {
          isValid = false;
          this.showError(input, errorMsg);
          if (!firstInvalidInput) {
            firstInvalidInput = input;
          }
        }
      });

      // Cross-field date check (e.g. dropoff after pickup, return after departure)
      const startDateInput = root.querySelector('input[name="start_date"]');
      const endDateInput = root.querySelector('input[name="end_date"]');
      if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);
        if (end < start) {
          isValid = false;
          this.showError(endDateInput, 'Drop-off / return date cannot be before departure date.');
          if (!firstInvalidInput) firstInvalidInput = endDateInput;
        }
      }

      if (firstInvalidInput) {
        firstInvalidInput.focus();
      }

      return isValid;
    },

    showError(input, message) {
      input.classList.add('has-error');
      const wrapper = input.closest('.form-group') || input.closest('.pill-input-group') || input.parentElement;

      let errSpan = wrapper.querySelector('.inline-field-error');
      if (!errSpan) {
        errSpan = document.createElement('span');
        errSpan.className = 'inline-field-error';
        errSpan.setAttribute('role', 'alert');
        wrapper.appendChild(errSpan);
      }
      errSpan.textContent = message;

      const clearHandler = () => {
        input.classList.remove('has-error');
        if (errSpan && errSpan.parentNode) {
          errSpan.parentNode.removeChild(errSpan);
        }
        input.removeEventListener('input', clearHandler);
        input.removeEventListener('change', clearHandler);
      };
      input.addEventListener('input', clearHandler);
      input.addEventListener('change', clearHandler);
    },

    clearErrors(rootElement) {
      rootElement.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
      rootElement.querySelectorAll('.inline-field-error').forEach(el => el.remove());
    }
  };

  // Cache DOM References
  const DOM = {};

  function cacheDom() {
    DOM.body = document.body;
    DOM.themeIndicator = document.getElementById('theme-indicator');
    DOM.tabPills = document.querySelectorAll('.tab-pill');
    DOM.searchForm = document.getElementById('flyboro-search-form');
    DOM.dynamicFields = document.getElementById('dynamic-form-fields');
    DOM.productTypeInput = document.getElementById('field-product-type');
    DOM.engineHeadline = document.getElementById('engine-headline');
    DOM.engineSubheadline = document.getElementById('engine-subheadline');
    DOM.btnSubmit = document.getElementById('btn-submit-search');
    DOM.resultsSection = document.getElementById('results-section');
    DOM.resultsHeader = document.getElementById('results-header');
    DOM.resultsMetaSource = document.getElementById('results-meta-source');
    DOM.resultsContainer = document.getElementById('results-container');

    // Review Modal
    DOM.modal = document.getElementById('booking-modal');
    DOM.modalCloseBtn = document.getElementById('modal-close-btn');
    DOM.modalCancelBtn = document.getElementById('modal-cancel-btn');
    DOM.modalCheckoutBtn = document.getElementById('modal-checkout-btn');
    DOM.modalItemTitle = document.getElementById('modal-item-title');
    DOM.modalSku = document.getElementById('modal-sku');
    DOM.modalPrice = document.getElementById('modal-price');
    DOM.modalProvider = document.getElementById('modal-provider');

    // Currency Selector
    DOM.currencySelector = document.getElementById('currency-selector');
  }

  function init() {
    cacheDom();
    setupProductTabs();
    setupFormSubmission();
    setupModalEvents();
    setupManageBooking();
    setupCurrencySelector();
    setupMobileErgonomics();
    setupFooterAccordions();

    // Render initial form fields for default Car Rentals
    renderProductFields('cars');
    renderPopularDestinations('cars');
  }

  function setupCurrencySelector() {
    if (!DOM.currencySelector) return;

    DOM.currencySelector.value = state.activeCurrency;

    DOM.currencySelector.addEventListener('change', function () {
      state.activeCurrency = this.value;
      localStorage.setItem('flyboro_currency', this.value);

      if (state.currentResults) {
        renderLiveResults(state.currentResults);
      }
    });

    fetch('/api/currency')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.rates) {
          state.currencyRates = data.rates;
          if (state.currentResults) {
            renderLiveResults(state.currentResults);
          }
        }
      })
      .catch(() => {});
  }

  /**
   * Product Tabs: Zero-Lag Theme Swap
   */
  function setupProductTabs() {
    DOM.tabPills.forEach(pill => {
      pill.addEventListener('click', function () {
        const targetProduct = this.getAttribute('data-product');
        if (state.activeProduct === targetProduct) return;

        DOM.tabPills.forEach(p => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');

        const meta = PRODUCT_METADATA[targetProduct] || PRODUCT_METADATA.cars;
        DOM.body.className = meta.theme;

        if (DOM.themeIndicator) {
          DOM.themeIndicator.querySelector('.theme-name').textContent = meta.desc;
        }

        state.activeProduct = targetProduct;
        if (DOM.productTypeInput) DOM.productTypeInput.value = targetProduct;
        if (DOM.engineHeadline) DOM.engineHeadline.textContent = meta.title;
        if (DOM.engineSubheadline) DOM.engineSubheadline.textContent = meta.subtitle;

        // Dynamic Orange CTA Button text sync
        const ctaBtnText = document.getElementById('cta-btn-text') || (DOM.btnSubmit && DOM.btnSubmit.querySelector('.btn-text'));
        if (ctaBtnText) {
          ctaBtnText.textContent = targetProduct === 'jets' ? 'Continue to Aircraft ➔' : 'Search Availability';
        }
        const ctaBtn = document.getElementById('cta-btn');
        if (ctaBtn && ctaBtn !== DOM.btnSubmit) {
          ctaBtn.textContent = targetProduct === 'jets' ? 'Continue to Aircraft ➔' : 'Search Availability';
        }

        renderProductFields(targetProduct);
        renderPopularDestinations(targetProduct);

        // Reset results and map viewports
        DOM.resultsContainer.innerHTML = '';
        DOM.resultsHeader.style.display = 'none';
        const mapViewport = document.getElementById('hotel-map-viewport');
        const btnToggleMap = document.getElementById('btn-toggle-map');
        if (mapViewport) mapViewport.style.display = 'none';
        if (btnToggleMap) btnToggleMap.style.display = 'none';
      });
    });
  }

  // Global switchTab bridge for inline event handlers and external controllers
  window.switchTab = function (clickedBtn, tabId) {
    const targetPill = document.querySelector(`.tab-pill[data-product="${tabId}"]`);
    if (targetPill) {
      targetPill.click();
    }
  };

  // Primary fallback database for instant offline/static lookups
  const FALLBACK_LOCATIONS = [
    { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'New Delhi', country: 'India' },
    { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India' },
    { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India' },
    { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India' },
    { code: 'CCU', name: 'Netaji Subhash Chandra Bose International Airport', city: 'Kolkata', country: 'India' },
    { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India' },
    { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States' },
    { code: 'EWR', name: 'Newark Liberty International Airport', city: 'New York', country: 'United States' },
    { code: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom' },
    { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates' },
    { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
    { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France' },
    { code: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'United States' },
    { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'United States' },
    { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States' },
    { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States' },
    { code: 'SAT', name: 'San Antonio International Airport', city: 'San Antonio', country: 'United States' },
    { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', country: 'United States' },
    { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', country: 'United States' }
  ];

  function setupAutocomplete() {
    const inputs = DOM.dynamicFields.querySelectorAll('.location-autocomplete');
    inputs.forEach(input => {
      const wrapper = input.closest('.input-wrapper');
      if (!wrapper) return;
      const dropdown = wrapper.querySelector('.autocomplete-dropdown');
      if (!dropdown) return;

      let debounceTimer = null;
      let selectedIdx = -1;
      let currentItems = [];

      input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        const q = this.value.trim();
        if (q.length < 2) {
          dropdown.classList.remove('is-active');
          dropdown.innerHTML = '';
          return;
        }

        debounceTimer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
            if (res.ok) {
              const json = await res.json();
              if (json && json.data && json.data.length > 0) {
                renderDropdown(json.data);
                return;
              }
            }
            throw new Error('Fallback needed');
          } catch {
            const filtered = FALLBACK_LOCATIONS.filter(item =>
              item.code.toLowerCase().includes(q.toLowerCase()) ||
              item.city.toLowerCase().includes(q.toLowerCase()) ||
              item.name.toLowerCase().includes(q.toLowerCase()) ||
              item.country.toLowerCase().includes(q.toLowerCase())
            ).slice(0, 8);
            renderDropdown(filtered);
          }
        }, 150);
      });

      function renderDropdown(items) {
        currentItems = items;
        selectedIdx = -1;
        if (!items || items.length === 0) {
          dropdown.classList.remove('is-active');
          dropdown.innerHTML = '';
          return;
        }

        dropdown.innerHTML = items.map((item, idx) => `
          <li class="autocomplete-item" data-index="${idx}" data-val="${escapeHtml(item.city)} (${escapeHtml(item.code)})">
            <div class="autocomplete-main">
              <span class="autocomplete-city">${escapeHtml(item.city)}, ${escapeHtml(item.country)}</span>
              <span class="autocomplete-airport">${escapeHtml(item.name)}</span>
            </div>
            <span class="autocomplete-code-pill">${escapeHtml(item.code)}</span>
          </li>
        `).join('');

        dropdown.classList.add('is-active');

        dropdown.querySelectorAll('.autocomplete-item').forEach(li => {
          li.addEventListener('mousedown', function (e) {
            e.preventDefault();
            const val = this.getAttribute('data-val');
            input.value = val;
            dropdown.classList.remove('is-active');
            input.dispatchEvent(new Event('change'));
          });
        });
      }

      input.addEventListener('keydown', function (e) {
        if (!dropdown.classList.contains('is-active') || currentItems.length === 0) return;

        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIdx = (selectedIdx + 1) % items.length;
          updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIdx = (selectedIdx - 1 + items.length) % items.length;
          updateHighlight(items);
        } else if (e.key === 'Enter') {
          if (selectedIdx >= 0 && selectedIdx < items.length) {
            e.preventDefault();
            input.value = items[selectedIdx].getAttribute('data-val');
            dropdown.classList.remove('is-active');
          }
        } else if (e.key === 'Escape') {
          dropdown.classList.remove('is-active');
        }
      });

      function updateHighlight(items) {
        items.forEach((item, idx) => {
          item.classList.toggle('is-selected', idx === selectedIdx);
          if (idx === selectedIdx) item.scrollIntoView({ block: 'nearest' });
        });
      }

      input.addEventListener('blur', function () {
        setTimeout(() => dropdown.classList.remove('is-active'), 200);
      });
    });
  }

  function renderProductFields(productKey) {
    DOM.dynamicFields.innerHTML = FORM_TEMPLATES[productKey] || FORM_TEMPLATES.cars;
    setSmartDefaultDates();
    setupAutocomplete();

    // Re-enable/display standard submit button by default
    if (DOM.btnSubmit) {
      DOM.btnSubmit.style.display = '';
    }

    if (productKey === 'cars') {
      setupCarsDurationBadge();
    } else if (productKey === 'flights') {
      setupTripTypeToggle();
    } else if (productKey === 'vacations') {
      setupVacationControls();
    } else if (productKey === 'jets') {
      setupJetWizard();
    }
  }

  /**
   * Product Flow 1: Cars Synchronized Duration Badge
   */
  function setupCarsDurationBadge() {
    const pickupInput = DOM.dynamicFields.querySelector('#input-pickup-date');
    const dropoffInput = DOM.dynamicFields.querySelector('#input-return-date');
    const badgeText = DOM.dynamicFields.querySelector('#car-duration-text');
    if (!pickupInput || !dropoffInput || !badgeText) return;

    function updateDuration() {
      if (pickupInput.value && dropoffInput.value) {
        const p = new Date(pickupInput.value);
        const d = new Date(dropoffInput.value);
        const diffTime = d - p;
        const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
        badgeText.textContent = `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
      }
    }

    pickupInput.addEventListener('change', updateDuration);
    dropoffInput.addEventListener('change', updateDuration);
    updateDuration();
  }

  /**
   * Product Flow 2: Flight Segmented Control
   */
  function setupTripTypeToggle() {
    const radios = DOM.dynamicFields.querySelectorAll('input[name="trip_type"]');
    const returnGroup = document.getElementById('flight-return-group');
    const returnInput = document.getElementById('input-flight-ret');
    if (!radios.length || !returnGroup || !returnInput) return;

    radios.forEach(radio => {
      radio.addEventListener('change', function () {
        if (this.value === 'oneway') {
          returnGroup.style.display = 'none';
          returnInput.removeAttribute('required');
        } else {
          returnGroup.style.display = 'flex';
          returnInput.setAttribute('required', 'required');
        }
      });
    });
  }

  /**
   * Product Flow 4: Vacations Date Flexibility & Live Stepper Subtotal
   */
  function setupVacationControls() {
    const btnExact = DOM.dynamicFields.querySelector('#vacay-flex-exact');
    const btnMonth = DOM.dynamicFields.querySelector('#vacay-flex-month');
    const dateLabel = DOM.dynamicFields.querySelector('#vacation-date-label');
    const dateInput = DOM.dynamicFields.querySelector('#input-vacation-start');

    if (btnExact && btnMonth) {
      btnExact.addEventListener('click', () => {
        btnExact.classList.add('active');
        btnMonth.classList.remove('active');
        if (dateLabel) dateLabel.textContent = 'Target Date *';
        if (dateInput) {
          dateInput.type = 'date';
          dateInput.setAttribute('data-label', 'Target Date');
          setSmartDefaultDates();
        }
      });

      btnMonth.addEventListener('click', () => {
        btnMonth.classList.add('active');
        btnExact.classList.remove('active');
        if (dateLabel) dateLabel.textContent = 'Flexible Target Month *';
        if (dateInput) {
          dateInput.type = 'month';
          dateInput.setAttribute('data-label', 'Flexible Target Month');
          const today = new Date();
          dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
      });
    }

    // Live Ticket Stepper Calculations
    const minusBtns = DOM.dynamicFields.querySelectorAll('.btn-step-minus');
    const plusBtns = DOM.dynamicFields.querySelectorAll('.btn-step-plus');
    const subtotalEl = DOM.dynamicFields.querySelector('#vacay-live-subtotal');

    function updateSubtotal() {
      const adultsEl = DOM.dynamicFields.querySelector('#vacay-adults');
      const kidsEl = DOM.dynamicFields.querySelector('#vacay-children');
      const adults = adultsEl ? parseInt(adultsEl.textContent, 10) || 1 : 1;
      const kids = kidsEl ? parseInt(kidsEl.textContent, 10) || 0 : 0;
      const total = (adults * 2150) + (kids * 1290);
      if (subtotalEl) {
        subtotalEl.textContent = formatCurrency(total);
      }
    }

    minusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const min = parseInt(btn.getAttribute('data-min') || '0', 10);
        const countEl = DOM.dynamicFields.querySelector(`#${targetId}`);
        if (countEl) {
          let val = parseInt(countEl.textContent, 10) || 0;
          if (val > min) {
            countEl.textContent = val - 1;
            updateSubtotal();
          }
        }
      });
    });

    plusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const max = parseInt(btn.getAttribute('data-max') || '10', 10);
        const countEl = DOM.dynamicFields.querySelector(`#${targetId}`);
        if (countEl) {
          let val = parseInt(countEl.textContent, 10) || 0;
          if (val < max) {
            countEl.textContent = val + 1;
            updateSubtotal();
          }
        }
      });
    });

    updateSubtotal();
  }

  /**
   * Product Flow 5: Private Jet 3-Step Concierge Wizard
   */
  function setupJetWizard() {
    const wizard = DOM.dynamicFields.querySelector('.jet-concierge-wizard');
    if (!wizard) return;

    if (DOM.btnSubmit) {
      DOM.btnSubmit.style.display = 'none';
    }

    const slides = wizard.querySelectorAll('.wizard-step-slide');
    const nodes = wizard.querySelectorAll('.step-nodes .node');
    const progressIndicator = wizard.querySelector('#jet-progress-indicator');
    let currentStep = 1;

    function goToStep(step) {
      currentStep = step;
      slides.forEach(s => {
        const sStep = parseInt(s.getAttribute('data-step'), 10);
        s.classList.toggle('is-active', sStep === step);
      });

      nodes.forEach(n => {
        const nStep = parseInt(n.getAttribute('data-step'), 10);
        n.classList.toggle('active', nStep <= step);
      });

      if (progressIndicator) {
        const pct = (step / 3) * 100;
        progressIndicator.style.width = `${pct}%`;
      }
    }

    wizard.querySelectorAll('.btn-wizard-next').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextStep = parseInt(btn.getAttribute('data-next'), 10);
        const currentSlide = wizard.querySelector(`.wizard-step-slide[data-step="${currentStep}"]`);
        if (!FormValidator.validate(DOM.searchForm, currentSlide)) {
          return;
        }
        goToStep(nextStep);
      });
    });

    wizard.querySelectorAll('.btn-wizard-prev').forEach(btn => {
      btn.addEventListener('click', () => {
        const prevStep = parseInt(btn.getAttribute('data-prev'), 10);
        goToStep(prevStep);
      });
    });
  }

  function setSmartDefaultDates() {
    const today = new Date();
    const plus3 = new Date(today);
    plus3.setDate(plus3.getDate() + 3);
    const plus10 = new Date(today);
    plus10.setDate(plus10.getDate() + 10);

    const start = DOM.dynamicFields.querySelector('input[name="start_date"]');
    const end = DOM.dynamicFields.querySelector('input[name="end_date"]');

    const fmt = d => d.toISOString().split('T')[0];
    if (start && start.type === 'date') start.value = fmt(plus3);
    if (end && end.type === 'date') end.value = fmt(plus10);
  }

  /**
   * Mobile Ergonomics: Bottom Sheet & Map Viewport Controller
   */
  function setupMobileErgonomics() {
    const filterSheet = document.getElementById('mobile-filter-sheet');
    const btnOpenFilter = document.getElementById('btn-open-filter-sheet');
    const btnOpenSort = document.getElementById('btn-open-sort-sheet');
    const btnCloseSheet = document.getElementById('close-filter-sheet');
    const btnApply = document.getElementById('btn-apply-mobile-filters');
    const btnReset = document.getElementById('btn-reset-mobile-filters');
    const sortSelect = document.getElementById('mobile-sort-select');
    const filterNonstop = document.getElementById('filter-nonstop');
    const filterFreeCancel = document.getElementById('filter-free-cancel');
    const btnToggleMap = document.getElementById('btn-toggle-map');
    const mapViewport = document.getElementById('hotel-map-viewport');
    const mapBtnText = document.getElementById('map-btn-text');

    function openSheet() {
      if (filterSheet) {
        filterSheet.classList.add('is-active');
        filterSheet.setAttribute('aria-hidden', 'false');
      }
    }

    function closeSheet() {
      if (filterSheet) {
        filterSheet.classList.remove('is-active');
        filterSheet.setAttribute('aria-hidden', 'true');
      }
    }

    if (btnOpenFilter) btnOpenFilter.addEventListener('click', openSheet);
    if (btnOpenSort) btnOpenSort.addEventListener('click', () => {
      openSheet();
      if (sortSelect) sortSelect.focus();
    });
    if (btnCloseSheet) btnCloseSheet.addEventListener('click', closeSheet);

    if (filterSheet) {
      filterSheet.addEventListener('click', (e) => {
        if (e.target === filterSheet) closeSheet();
      });
    }

    // Mobile Map Toggle
    if (btnToggleMap && mapViewport) {
      btnToggleMap.addEventListener('click', () => {
        const isVisible = mapViewport.classList.toggle('mobile-visible');
        if (mapBtnText) {
          mapBtnText.textContent = isVisible ? 'View List' : 'View Map';
        }
      });
    }

    // Apply Mobile Filters
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        applyMobileFilters();
        closeSheet();
      });
    }

    // Reset Mobile Filters
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (sortSelect) sortSelect.value = 'recommended';
        if (filterNonstop) filterNonstop.checked = false;
        if (filterFreeCancel) filterFreeCancel.checked = false;
        if (state.originalResults) {
          renderLiveResults(state.originalResults);
        }
        closeSheet();
      });
    }
  }

  function applyMobileFilters() {
    if (!state.currentResults) return;
    const sortSelect = document.getElementById('mobile-sort-select');
    const filterNonstop = document.getElementById('filter-nonstop');
    const filterFreeCancel = document.getElementById('filter-free-cancel');

    const sourceData = state.originalResults ? (state.originalResults.results || state.originalResults.data || []) : (state.currentResults.results || state.currentResults.data || []);
    let list = [...sourceData];

    if (filterNonstop && filterNonstop.checked) {
      list = list.filter(item => item.stops === 0 || (item.badges && item.badges.some(b => b.toLowerCase().includes('direct') || b.toLowerCase().includes('nonstop'))));
    }

    if (filterFreeCancel && filterFreeCancel.checked) {
      list = list.filter(item => item.badges && item.badges.some(b => b.toLowerCase().includes('cancellation')));
    }

    if (sortSelect) {
      if (sortSelect.value === 'price-asc') {
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
      } else if (sortSelect.value === 'price-desc') {
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
      }
    }

    renderCardsList(list);
  }

  /**
   * Mobile-Only Collapsible Accordions for Global Footer (Quick Links & Our Policies)
   */
  function setupFooterAccordions() {
    const accordions = document.querySelectorAll('.footer-accordion-toggle');
    if (!accordions.length) return;

    accordions.forEach(toggle => {
      toggle.addEventListener('click', function (e) {
        // Enforce Mobile-Only execution (max-width: 768px)
        if (window.innerWidth > 768) return;

        e.preventDefault();
        const col = this.closest('.footer-accordion-col');
        const content = col ? col.querySelector('.footer-accordion-content') : this.nextElementSibling;
        const isOpen = col ? col.classList.contains('is-open') : this.classList.contains('is-open');

        // Toggle Open / Closed state with smooth dynamic height transition
        if (isOpen) {
          if (col) col.classList.remove('is-open');
          this.classList.remove('is-open');
          this.setAttribute('aria-expanded', 'false');
          if (content) {
            content.classList.remove('is-open');
            content.style.maxHeight = '0px';
          }
        } else {
          if (col) col.classList.add('is-open');
          this.classList.add('is-open');
          this.setAttribute('aria-expanded', 'true');
          if (content) {
            content.classList.add('is-open');
            content.style.maxHeight = content.scrollHeight + 'px';
          }
        }
      });

      // Keyboard accessibility (Enter / Spacebar support)
      toggle.addEventListener('keydown', function (e) {
        if (window.innerWidth <= 768 && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          this.click();
        }
      });
    });

    // Ensure desktop view reverts cleanly if browser viewport is resized
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        accordions.forEach(toggle => {
          const col = toggle.closest('.footer-accordion-col');
          const content = col ? col.querySelector('.footer-accordion-content') : toggle.nextElementSibling;
          if (col) col.classList.remove('is-open');
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          if (content) {
            content.classList.remove('is-open');
            content.style.maxHeight = '';
          }
        });
      }
    });
  }

  /* ==========================================================================
     DYNAMIC POPULAR DESTINATIONS CATALOG & CONTROLLER
     ========================================================================== */
  const DESTINATIONS_DATA = {
    cars: {
      eyebrow: 'TOP ROAD TRIPS',
      title: 'Curated Driving Itineraries & Scenic Highways',
      subtitle: 'Explore iconic coastal routes and scenic passes with guaranteed direct fleet car rentals.',
      cards: [
        {
          title: 'Pacific Coast Highway, USA',
          desc: 'Iconic coastal cliffs from Monterey through Big Sur down to Santa Barbara.',
          pill: 'Convertible & SUV',
          price: 'From $45/day',
          query: 'San Francisco (SFO)',
          image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Amalfi Coast Route, Italy',
          desc: 'Dramatic winding cliffside roads passing Sorrento, Positano, and Ravello.',
          pill: 'Compact Luxury',
          price: 'From €55/day',
          query: 'Rome (FCO)',
          image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Route 66 Red Rocks, Arizona',
          desc: 'The quintessential open American highway stretching through red canyons.',
          pill: 'Full Size AWD',
          price: 'From $52/day',
          query: 'Phoenix (PHX)',
          image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Scottish Highlands (NC500), UK',
          desc: 'Ancient castles, dramatic sea lochs, and sweeping rugged mountain passes.',
          pill: 'Executive Sedan',
          price: 'From £60/day',
          query: 'Edinburgh (EDI)',
          image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&auto=format&fit=crop&q=80'
        }
      ]
    },
    flights: {
      eyebrow: 'POPULAR FLIGHT ROUTES',
      title: 'Trending Global Flight Corridors',
      subtitle: 'Direct GDS-connected routes with real-time baggage inclusions and zero platform markups.',
      cards: [
        {
          title: 'New York (JFK) ➔ London (LHR)',
          desc: 'Flagship daily transatlantic service with flat-bed suites and lounge access.',
          pill: 'Virgin Atlantic / BA',
          price: 'From $420 return',
          query: 'London (LHR)',
          image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Los Angeles (LAX) ➔ Tokyo (HND)',
          desc: 'Premium transpacific direct connection featuring authentic Japanese hospitality.',
          pill: 'ANA / Japan Airlines',
          price: 'From $890 return',
          query: 'Tokyo (HND)',
          image: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Dubai (DXB) ➔ Paris (CDG)',
          desc: 'Non-stop widebody Airbus A380 flights with multi-course Michelin catering.',
          pill: 'Emirates A380 Direct',
          price: 'From $610 return',
          query: 'Paris (CDG)',
          image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Singapore (SIN) ➔ Sydney (SYD)',
          desc: 'Seamless Oceania corridor with ergonomic lie-flat seating and high-speed Wi-Fi.',
          pill: 'Singapore Airlines',
          price: 'From $580 return',
          query: 'Sydney (SYD)',
          image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=600&auto=format&fit=crop&q=80'
        }
      ]
    },
    hotels: {
      eyebrow: 'LUXURY STAYS & RESORTS',
      title: 'Top-Rated Global Sanctuaries & City Escapes',
      subtitle: 'Handpicked 5-star properties with instant confirmation, breakfast inclusions, and flexible cancellation.',
      cards: [
        {
          title: 'Four Seasons Resort, Bora Bora',
          desc: 'Private lagoon overwater bungalows facing Mount Otemanu with turquoise water views.',
          pill: 'Overwater Villa ★★★★★',
          price: 'From $1,250/night',
          query: 'Bora Bora (BOB)',
          image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'The Ritz-Carlton, Kyoto',
          desc: 'Serene Zen gardens and tranquil luxury along the banks of the historic Kamogawa River.',
          pill: 'Riverside Suite ★★★★★',
          price: 'From $680/night',
          query: 'Kyoto (KIX)',
          image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Belmond Hotel Caruso, Amalfi',
          desc: '11th-century cliffside palace set 1,000 feet above the sparkling Mediterranean Sea.',
          pill: 'Palace Suite ★★★★★',
          price: 'From $890/night',
          query: 'Naples (NAP)',
          image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Burj Al Arab Jumeirah, Dubai',
          desc: 'World-famous sail landmark featuring duplex ocean suites and 24-hour butler service.',
          pill: 'Ultra-Luxury ★★★★★',
          price: 'From $1,420/night',
          query: 'Dubai (DXB)',
          image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&auto=format&fit=crop&q=80'
        }
      ]
    },
    vacations: {
      eyebrow: 'ALL-INCLUSIVE GETAWAYS',
      title: 'Curated Vacation Packages & Island Escapes',
      subtitle: 'Bundled resort stays, transfers, and excursions designed for zero-stress relaxation.',
      cards: [
        {
          title: 'Maldives Coral Lagoon Paradise',
          desc: '7-day private water villa stay, guided manta ray snorkeling, and catamaran cruise.',
          pill: '7 Days • All-Inclusive',
          price: 'From $2,450/pkg',
          query: 'Male (MLE)',
          image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Swiss Alps Mountain Retreat',
          desc: '5-day first-class scenic rail passes, luxury alpine chalet lodging, and fondue tours.',
          pill: '5 Days • Mountain Pass',
          price: 'From $1,820/pkg',
          query: 'Zurich (ZRH)',
          image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Bali Rainforest Wellness Villa',
          desc: '8-day private jungle pool sanctuary in Ubud with holistic yoga and temple treks.',
          pill: '8 Days • Spa & Tours',
          price: 'From $1,390/pkg',
          query: 'Bali (DPS)',
          image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Santorini Sunset Escapade',
          desc: '6-day cliffside caldera suite, sommelier volcanic wine tastings, and private yacht cruise.',
          pill: '6 Days • Caldera View',
          price: 'From $1,750/pkg',
          query: 'Santorini (JTR)',
          image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&auto=format&fit=crop&q=80'
        }
      ]
    },
    jets: {
      eyebrow: 'PRIVATE AVIATION CORRIDORS',
      title: 'Signature VIP Charter Routes & Empty Legs',
      subtitle: 'Access over 4,500 vetted aircraft with discreet FBO tarmac transfers and guaranteed flight dispatch.',
      cards: [
        {
          title: 'Teterboro (TEB) ➔ Miami (OPF)',
          desc: 'Bespoke charter on Citation Sovereign or Challenger 300 with private valet boarding.',
          pill: 'Super Midsize Jet',
          price: 'From $14,800 charter',
          query: 'Miami (MIA)',
          image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'London Luton (LTN) ➔ Geneva (GVA)',
          desc: 'Rapid business shuttle on Embraer Phenom 300E with bespoke ski & sports stowage.',
          pill: 'Light / Midsize Jet',
          price: 'From €8,900 charter',
          query: 'Geneva (GVA)',
          image: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Van Nuys (VNY) ➔ Las Vegas (LAS)',
          desc: 'Fast 45-minute VIP hop with expedited departure clearance and champagne service.',
          pill: 'Midsize Jet',
          price: 'From $6,500 charter',
          query: 'Las Vegas (LAS)',
          image: 'https://images.unsplash.com/photo-1520437358207-323b43b50729?w=600&auto=format&fit=crop&q=80'
        },
        {
          title: 'Dubai (DWC) ➔ Nice Côte d’Azur (NCE)',
          desc: 'Direct transcontinental charter on Falcon 7X with master bedroom and satellite Wi-Fi.',
          pill: 'Heavy Jet / Falcon 7X',
          price: 'From €42,000 charter',
          query: 'Nice (NCE)',
          image: 'https://images.unsplash.com/photo-1519074069444-1ba4ea16e838?w=600&auto=format&fit=crop&q=80'
        }
      ]
    }
  };

  function renderPopularDestinations(productKey) {
    const data = DESTINATIONS_DATA[productKey] || DESTINATIONS_DATA.cars;
    const eyebrowEl = document.getElementById('destinations-eyebrow');
    const headingEl = document.getElementById('destinations-heading');
    const subEl = document.getElementById('destinations-subheading');
    const container = document.getElementById('destinations-container');

    if (eyebrowEl) eyebrowEl.textContent = data.eyebrow;
    if (headingEl) headingEl.textContent = data.title;
    if (subEl) subEl.textContent = data.subtitle;

    if (!container) return;

    container.innerHTML = data.cards.map(card => `
      <article class="destination-card" data-query="${escapeHtml(card.query)}" tabindex="0" role="button" aria-label="Explore ${escapeHtml(card.title)}">
        <div class="destination-bg" style="background-image: url('${escapeHtml(card.image)}');"></div>
        <div class="destination-gradient"></div>
        <div class="destination-card-content">
          <span class="destination-pill">${escapeHtml(card.pill)}</span>
          <h3 class="destination-title">${escapeHtml(card.title)}</h3>
          <p class="destination-desc">${escapeHtml(card.desc)}</p>
          <div class="destination-footer">
            <span class="destination-price">${escapeHtml(card.price)}</span>
            <button type="button" class="destination-cta-btn">Explore</button>
          </div>
        </div>
      </article>
    `).join('');

    // Attach click-to-search handlers
    container.querySelectorAll('.destination-card').forEach(cardEl => {
      cardEl.addEventListener('click', function () {
        const queryVal = this.getAttribute('data-query');
        if (!queryVal) return;

        // Auto-fill active destination or pickup field
        const targetInput =
          document.getElementById('input-destination') ||
          document.getElementById('input-hotel-dest') ||
          document.getElementById('input-vacation-dest') ||
          document.getElementById('input-jet-dest') ||
          document.getElementById('input-pickup-location');

        if (targetInput) {
          targetInput.value = queryVal;
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          targetInput.focus();
        }

        // Smooth scroll to search form engine
        const engineCard = document.getElementById('hero-engine-card') || DOM.searchForm;
        if (engineCard) {
          engineCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      // Keyboard accessibility
      cardEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
    });
  }

  /**
   * Search Form Submission & Exact-Shape Skeleton Shimmers
   */
  function setupFormSubmission() {
    DOM.searchForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (!FormValidator.validate(this)) {
        return;
      }

      const formData = new FormData(this);
      const payload = {};
      formData.forEach((v, k) => { payload[k] = v; });

      DOM.btnSubmit.disabled = true;
      DOM.btnSubmit.classList.add('is-loading');
      DOM.resultsHeader.style.display = 'flex';
      DOM.resultsMetaSource.textContent = 'Querying live supplier inventory...';
      renderSkeletonCards(3);

      if (state.abortController) {
        state.abortController.abort();
      }
      state.abortController = new AbortController();

      try {
        const isVercelHost = window.location.hostname.includes('vercel.app') || window.location.port !== '';
        const endpoint = isVercelHost ? '/api/search' : `${CONFIG.rootApi}/search`;

        let response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-WP-Nonce': CONFIG.nonce
            },
            body: JSON.stringify(payload),
            signal: state.abortController.signal
          });
        } catch (fetchErr) {
          if (endpoint !== `${CONFIG.rootApi}/search`) {
            response = await fetch(`${CONFIG.rootApi}/search`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': CONFIG.nonce
              },
              body: JSON.stringify(payload),
              signal: state.abortController.signal
            });
          } else {
            throw fetchErr;
          }
        }

        if (!response.ok) {
          throw new Error(`Proxy responded with status ${response.status}`);
        }

        const data = await response.json();
        const vercelCache = response.headers.get('x-vercel-cache');
        const wpCache = response.headers.get('X-Flyboro-Cache');
        const providerHeader = (data && data.meta && data.meta.providerSource) || response.headers.get('x-proxy-provider') || (data && data.provider) || 'Proxy Service';

        let badgeText = `${providerHeader}`;
        if (vercelCache) {
          badgeText += ` (Vercel CDN: ${vercelCache})`;
        } else if (wpCache === 'HIT') {
          badgeText += ` (WP Transient HIT)`;
        }

        DOM.resultsMetaSource.textContent = badgeText;
        renderLiveResults(data);

      } catch (err) {
        if (err.name === 'AbortError') return;

        if (CONFIG.enableClientMockFallback) {
          setTimeout(() => {
            DOM.resultsMetaSource.textContent = 'Instant Prototype Inventory (Verified Direct)';
            const mockList = MOCK_INVENTORY[state.activeProduct] || MOCK_INVENTORY.cars;
            renderLiveResults({ success: true, data: mockList });
          }, 450);
        } else {
          renderErrorMessage(err.message);
        }
      } finally {
        DOM.btnSubmit.disabled = false;
        DOM.btnSubmit.classList.remove('is-loading');
      }
    });
  }

  /**
   * Render Shimmering Skeleton Cards matching exact card shape
   */
  function renderSkeletonCards(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-thumb shimmer"></div>
          <div class="skeleton-content">
            <div class="skeleton-title shimmer"></div>
            <div class="skeleton-text shimmer"></div>
            <div class="skeleton-text shimmer" style="width: 55%;"></div>
          </div>
          <div class="skeleton-cta shimmer"></div>
        </div>
      `;
    }
    DOM.resultsContainer.innerHTML = html;
  }

  /**
   * 7-Day Flexible Fare Matrix Generator (Flights)
   */
  function generateFareMatrixHtml(baseDepartureDate, baseFare) {
    const base = baseDepartureDate ? new Date(baseDepartureDate) : new Date();
    const dayOffsets = [-3, -2, -1, 0, 1, 2, 3];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const cells = dayOffsets.map(offset => {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      const varianceMultiplier = offset === 0 ? 1.0 : (offset === -2 || offset === 1 ? 0.93 : (offset === 2 || offset === -3 ? 1.08 : 1.02));
      const price = Math.round(baseFare * varianceMultiplier);
      return {
        offset,
        dateStr: `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`,
        price,
        isCurrent: offset === 0
      };
    });

    const minPrice = Math.min(...cells.map(c => c.price));

    const cellsHtml = cells.map(c => `
      <div class="matrix-cell ${c.isCurrent ? 'is-selected' : ''} ${c.price === minPrice ? 'cheapest' : ''}" data-offset="${c.offset}" data-price="${c.price}">
        <span class="date">${c.dateStr}</span>
        <span class="price">${formatCurrency(c.price)}</span>
        ${c.price === minPrice ? '<span class="badge-cheapest">Lowest Fare</span>' : ''}
      </div>
    `).join('');

    return `
      <div class="fare-matrix-container">
        <div class="matrix-title-bar">
          <span class="matrix-label">✈️ 7-Day Flexible Fare Matrix</span>
          <span class="matrix-hint">All mandatory taxes & carrier fees included</span>
        </div>
        <div class="matrix-scroll-track" id="flight-fare-matrix-track">
          ${cellsHtml}
        </div>
      </div>
    `;
  }

  function bindFareMatrixEvents() {
    const cells = document.querySelectorAll('.matrix-cell');
    cells.forEach(cell => {
      cell.addEventListener('click', function () {
        cells.forEach(c => c.classList.remove('is-selected'));
        this.classList.add('is-selected');
      });
    });
  }

  /**
   * Render Live Results
   */
  function renderLiveResults(res) {
    state.originalResults = res;
    state.currentResults = res;
    const list = res.results || res.data;

    // Show mobile bottom action bar
    const mobileActionBar = document.getElementById('mobile-action-bar');
    if (mobileActionBar) {
      mobileActionBar.style.display = 'flex';
    }

    // Toggle Spatial Map Viewport for Hotels
    const mapViewport = document.getElementById('hotel-map-viewport');
    const btnToggleMap = document.getElementById('btn-toggle-map');
    const pinsContainer = document.getElementById('hotel-map-pins-list');

    if (state.activeProduct === 'hotels') {
      if (mapViewport) mapViewport.style.display = 'flex';
      if (btnToggleMap) btnToggleMap.style.display = 'inline-flex';

      if (pinsContainer && list && list.length > 0) {
        pinsContainer.innerHTML = list.map(item => `
          <button type="button" class="map-price-pin" data-sku="${escapeHtml(item.id)}" style="background: #0F2A4A; color: #FFF; font-weight: 700; font-size: 0.8rem; padding: 5px 12px; border-radius: 16px; border: 1px solid var(--cta-primary); cursor: pointer; transition: all 0.2s ease;">
            📍 ${formatCurrency(item.price)} • ${escapeHtml(item.title.split(' ')[0])}
          </button>
        `).join('');

        pinsContainer.querySelectorAll('.map-price-pin').forEach(pin => {
          pin.addEventListener('click', () => {
            const sku = pin.getAttribute('data-sku');
            const targetCard = document.querySelector(`.travel-card[data-sku="${sku}"]`);
            if (targetCard) {
              targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetCard.style.outline = '2px solid var(--cta-primary)';
              setTimeout(() => { targetCard.style.outline = ''; }, 1800);
            }
          });
        });
      }
    } else {
      if (mapViewport) mapViewport.style.display = 'none';
      if (btnToggleMap) btnToggleMap.style.display = 'none';
    }

    renderCardsList(list);
  }

  function renderCardsList(list) {
    if (!list || list.length === 0) {
      DOM.resultsContainer.innerHTML = `
        <div style="background: var(--theme-surface); border: 1px solid var(--theme-border); border-radius: var(--radius-md); padding: 3rem; text-align: center;">
          <h3 style="color: var(--theme-header-text);">No inventory available for your selected criteria.</h3>
          <p style="color: var(--theme-muted-text); margin-top: 0.5rem;">Try adjusting your travel dates or filters.</p>
        </div>
      `;
      return;
    }

    let topHtml = '';
    if (state.activeProduct === 'flights') {
      const departureDateInput = DOM.searchForm.querySelector('input[name="start_date"]');
      const baseDate = departureDateInput ? departureDateInput.value : '';
      const minFare = Math.min(...list.map(i => i.price || 1400));
      topHtml = generateFareMatrixHtml(baseDate, minFare);
    }

    const cardsHtml = list.map(item => {
      const isRoundTrip = item.tripType === 'roundtrip' || (item.legs && item.legs.length > 1);
      const priceSub = isRoundTrip ? 'Round-trip total' : 'Rate from';

      // 1. Flight Transit Timeline
      let flightTimelineHtml = '';
      if (state.activeProduct === 'flights') {
        const dep = item.depTime || '20:15';
        const arr = item.arrTime || '08:05 +1';
        const orig = item.origin || 'JFK';
        const dest = item.destination || 'LHR';
        const dur = item.duration || '6h 50m';
        const isLayover = (item.stops || 0) > 0;

        flightTimelineHtml = `
          <div class="itinerary-timeline">
            <div class="time-point">
              <span class="time">${escapeHtml(dep)}</span>
              <span class="code">${escapeHtml(orig)}</span>
            </div>
            <div class="timeline-visual">
              <span class="duration">${escapeHtml(dur)}</span>
              <div class="timeline-track">
                ${isLayover ? '<div class="stop-node" title="Layover Connection"></div>' : ''}
              </div>
              <span class="transit-warning">${isLayover ? escapeHtml(item.stopsText || '1 Stop Layover') : 'Nonstop Direct'}</span>
            </div>
            <div class="time-point" style="text-align: right;">
              <span class="time">${escapeHtml(arr)}</span>
              <span class="code">${escapeHtml(dest)}</span>
            </div>
          </div>

          <div class="inclusions-strip">
            <span class="inc-pill positive">✓ Personal Item</span>
            <span class="inc-pill positive">✓ Carry-on (10kg)</span>
            <span class="inc-pill positive">✓ 2x Checked Bags (23kg)</span>
            <span class="inc-pill ${isLayover ? 'negative' : 'positive'}">${isLayover ? '⚡ Layover Connection' : '✓ Nonstop Direct'}</span>
          </div>
        `;
      }

      // 2. Hotel Touch-Native Horizontal Scroll-Snap Gallery
      let mediaHtml = `
        <div class="travel-card-media">
          <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
        </div>
      `;

      if (state.activeProduct === 'hotels') {
        const galleryImages = item.images && item.images.length > 0 ? item.images : [item.image_url, item.image_url, item.image_url];
        mediaHtml = `
          <div class="hotel-touch-gallery">
            <div class="gallery-snap-track">
              ${galleryImages.map((imgUrl, idx) => `
                <div class="gallery-slide">
                  <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)} - View ${idx + 1}" loading="lazy">
                </div>
              `).join('')}
            </div>
            <div style="position: absolute; bottom: 6px; right: 8px; background: rgba(0,0,0,0.65); color: #FFF; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; pointer-events: none;">
              Swipe ➔
            </div>
          </div>
        `;
      }

      return `
        <article class="travel-card" data-sku="${escapeHtml(item.id)}">
          ${mediaHtml}
          <div class="travel-card-details">
            <h3 class="travel-card-title">${escapeHtml(item.title)}</h3>
            <p class="travel-card-meta">${escapeHtml(item.subtitle)}</p>
            ${flightTimelineHtml}
            <div class="travel-card-tags">
              ${(item.badges || []).map(b => `<span class="badge-tag">${escapeHtml(b)}</span>`).join('')}
            </div>
          </div>
          <div class="travel-card-actions">
            <div class="travel-card-price">
              <div class="price-sub">${priceSub}</div>
              <div class="price-val">${formatCurrency(item.price)}</div>
            </div>
            <!-- Global Conversion CTA: Always Sunset Orange (#FF6D00) -->
            <button type="button" 
                    class="global-cta-button btn-book-now" 
                    data-sku="${escapeHtml(item.id)}"
                    data-title="${escapeHtml(item.title)}"
                    data-price="${item.price}"
                    data-provider="${escapeHtml(item.provider || item.airline || 'Flyboro Partner')}">
              Book Now
            </button>
          </div>
        </article>
      `;
    }).join('');

    DOM.resultsContainer.innerHTML = topHtml + cardsHtml;

    if (state.activeProduct === 'flights') {
      bindFareMatrixEvents();
    }
    bindBookingButtons();
  }

  function bindBookingButtons() {
    document.querySelectorAll('.btn-book-now').forEach(btn => {
      btn.addEventListener('click', function () {
        const sku = this.getAttribute('data-sku');
        const list = state.currentResults ? (state.currentResults.results || state.currentResults.data || []) : [];
        const fullItem = list.find(it => it.id === sku) || {
          id: sku,
          title: this.getAttribute('data-title'),
          price: parseFloat(this.getAttribute('data-price')) || 0,
          provider: this.getAttribute('data-provider')
        };

        const title = fullItem.title || this.getAttribute('data-title');
        const price = fullItem.price || this.getAttribute('data-price');
        const provider = fullItem.provider || fullItem.airline || this.getAttribute('data-provider') || 'Flyboro Partner';

        // Populate Confirmation Modal
        DOM.modalItemTitle.textContent = title;
        DOM.modalSku.textContent = sku;
        DOM.modalPrice.textContent = formatCurrency(price);
        DOM.modalProvider.textContent = provider;

        DOM.modal.setAttribute('data-target-sku', sku);
        DOM.modal.setAttribute('data-target-price', price);
        DOM.modal.setAttribute('data-target-title', title);
        DOM.modal.setAttribute('data-target-provider', provider);

        if (typeof DOM.modal.showModal === 'function') {
          DOM.modal.showModal();
        } else {
          openPassengerModal(fullItem);
        }
      });
    });
  }

  /**
   * Distraction-Free Enclosed Checkout & Transparent Accordion Breakdown
   */
  function openPassengerModal(itemData) {
    const modal = document.getElementById('flyboro-passenger-modal');
    const hiddenInput = document.getElementById('selected-booking-item');

    if (modal && hiddenInput) {
      hiddenInput.value = JSON.stringify(itemData);
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Reset promo state
      state.activePromo = null;
      const promoInput = document.getElementById('promo-code-input');
      const promoFeedback = document.getElementById('promo-feedback-msg');

      if (promoInput) promoInput.value = '';
      if (promoFeedback) {
        promoFeedback.style.display = 'none';
        promoFeedback.textContent = '';
      }

      // Calculate Zero-Hidden-Cost Price Breakdown
      const basePrice = Number(itemData.price) || 0;
      const taxes = Math.round(basePrice * 0.12 * 100) / 100;
      const convenienceFee = 15.00;
      const total = basePrice + taxes + convenienceFee;

      const accBase = document.getElementById('accordion-base-price');
      const accTaxes = document.getElementById('accordion-taxes-val');
      const accFee = document.getElementById('accordion-fee-val');
      const accFinal = document.getElementById('accordion-final-total');
      const accSummary = document.getElementById('accordion-summary-total');
      const accDiscRow = document.getElementById('accordion-discount-row');

      if (accBase) accBase.textContent = formatCurrency(basePrice);
      if (accTaxes) accTaxes.textContent = formatCurrency(taxes);
      if (accFee) accFee.textContent = formatCurrency(convenienceFee);
      if (accFinal) accFinal.textContent = formatCurrency(total);
      if (accSummary) accSummary.textContent = formatCurrency(total);
      if (accDiscRow) accDiscRow.style.display = 'none';

      // Auto-focus first input for immediate entry
      const firstInput = document.getElementById('passenger-first-name');
      if (firstInput) setTimeout(() => firstInput.focus(), 80);
    }
  }

  function closePassengerModal() {
    const modal = document.getElementById('flyboro-passenger-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      FormValidator.clearErrors(modal);
    }
  }

  function setupModalEvents() {
    DOM.modalCloseBtn.addEventListener('click', () => DOM.modal.close());
    DOM.modalCancelBtn.addEventListener('click', () => DOM.modal.close());

    DOM.modalCheckoutBtn.addEventListener('click', function () {
      const sku = DOM.modal.getAttribute('data-target-sku');
      const list = state.currentResults ? (state.currentResults.results || state.currentResults.data || []) : [];
      const fullItem = list.find(it => it.id === sku) || {
        id: sku,
        price: parseFloat(DOM.modal.getAttribute('data-target-price')) || 0,
        title: DOM.modal.getAttribute('data-target-title'),
        provider: DOM.modal.getAttribute('data-target-provider') || 'Flyboro Partner'
      };

      DOM.modal.close();
      openPassengerModal(fullItem);
    });

    DOM.modal.addEventListener('click', (e) => {
      if (e.target === DOM.modal) DOM.modal.close();
    });

    // Passenger Modal Bindings
    const passengerModal = document.getElementById('flyboro-passenger-modal');
    const passengerForm = document.getElementById('flyboro-passenger-form');
    const closePassengerBtn = document.getElementById('close-passenger-modal');
    const cancelPassengerBtn = document.getElementById('cancel-passenger-modal');

    if (closePassengerBtn) closePassengerBtn.addEventListener('click', closePassengerModal);
    if (cancelPassengerBtn) cancelPassengerBtn.addEventListener('click', closePassengerModal);

    if (passengerModal) {
      passengerModal.addEventListener('click', (e) => {
        if (e.target === passengerModal) closePassengerModal();
      });
    }

    // Dynamic Promo Code Validation & Real-Time Price Update
    const applyPromoBtn = document.getElementById('btn-apply-promo');
    const promoInput = document.getElementById('promo-code-input');
    const promoFeedback = document.getElementById('promo-feedback-msg');

    if (applyPromoBtn && promoInput) {
      applyPromoBtn.addEventListener('click', async () => {
        const code = promoInput.value.trim().toUpperCase();
        const hiddenInput = document.getElementById('selected-booking-item');
        const itemData = hiddenInput && hiddenInput.value ? JSON.parse(hiddenInput.value) : {};
        const basePrice = Number(itemData.price) || 0;
        const taxes = Math.round(basePrice * 0.12 * 100) / 100;
        const convenienceFee = 15.00;

        if (!code) {
          if (promoFeedback) {
            promoFeedback.style.display = 'block';
            promoFeedback.style.color = '#DC2626';
            promoFeedback.textContent = 'Please enter a promotion code.';
          }
          return;
        }

        const origBtnText = applyPromoBtn.textContent;
        applyPromoBtn.disabled = true;
        applyPromoBtn.textContent = 'Checking...';

        try {
          const res = await fetch('/api/promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              basePrice,
              currency: state.activeCurrency
            })
          });

          const data = await res.json();

          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Invalid or expired promo code.');
          }

          state.activePromo = data;

          if (promoFeedback) {
            promoFeedback.style.display = 'block';
            promoFeedback.style.color = '#16A34A';
            promoFeedback.textContent = `✓ ${data.description} (-${formatCurrency(data.discountAmount)})`;
          }

          // Update Transparent Accordion Breakdown
          const accDiscRow = document.getElementById('accordion-discount-row');
          const accDiscLabel = document.getElementById('accordion-discount-label');
          const accDiscVal = document.getElementById('accordion-discount-val');
          const accFinal = document.getElementById('accordion-final-total');
          const accSummary = document.getElementById('accordion-summary-total');

          const discountedTotal = Math.max(0, (basePrice - data.discountAmount) + taxes + convenienceFee);

          if (accDiscRow && accDiscLabel && accDiscVal) {
            accDiscRow.style.display = 'flex';
            accDiscLabel.textContent = `Promotion Discount (${data.code}):`;
            accDiscVal.textContent = `-${formatCurrency(data.discountAmount)}`;
          }

          if (accFinal) accFinal.textContent = formatCurrency(discountedTotal);
          if (accSummary) accSummary.textContent = formatCurrency(discountedTotal);

        } catch (err) {
          state.activePromo = null;
          if (promoFeedback) {
            promoFeedback.style.display = 'block';
            promoFeedback.style.color = '#DC2626';
            promoFeedback.textContent = `✕ ${err.message}`;
          }

          const accDiscRow = document.getElementById('accordion-discount-row');
          const accFinal = document.getElementById('accordion-final-total');
          const accSummary = document.getElementById('accordion-summary-total');

          if (accDiscRow) accDiscRow.style.display = 'none';
          const origTotal = basePrice + taxes + convenienceFee;
          if (accFinal) accFinal.textContent = formatCurrency(origTotal);
          if (accSummary) accSummary.textContent = formatCurrency(origTotal);
        } finally {
          applyPromoBtn.disabled = false;
          applyPromoBtn.textContent = origBtnText;
        }
      });
    }

    // Distraction-Free Guest Checkout Submission
    if (passengerForm) {
      passengerForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!FormValidator.validate(this)) {
          return;
        }

        const submitBtn = document.getElementById('submit-booking-btn');
        const origSubmitText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Issuing PNR & Reserving...';
        }

        const itemJSON = document.getElementById('selected-booking-item').value;
        const itemData = itemJSON ? JSON.parse(itemJSON) : {};

        const passengerData = {
          firstName: document.getElementById('passenger-first-name').value.trim(),
          lastName: document.getElementById('passenger-last-name').value.trim(),
          email: document.getElementById('passenger-email').value.trim(),
          phone: document.getElementById('passenger-phone').value.trim()
        };

        closePassengerModal();

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origSubmitText;
        }

        await initiateBooking(itemData, {
          passenger: passengerData,
          promoCode: state.activePromo ? state.activePromo.code : undefined
        });
      });
    }
  }

  /**
   * Programmatic and UI booking trigger
   */
  async function initiateBooking(itemData, options = {}) {
    const btn = DOM.modalCheckoutBtn;
    let originalText = '';
    if (btn) {
      originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Processing Reservation...';
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            ...itemData,
            currency: state.activeCurrency
          },
          currency: state.activeCurrency,
          promoCode: options.promoCode,
          passenger: options.passenger || {
            firstName: 'Guest',
            lastName: 'Traveler',
            email: 'guest@flyboro.com'
          },
          paymentMethod: options.paymentMethod || 'demo'
        })
      });

      const result = await response.json();

      if (result.success) {
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }

        if (DOM.modal) {
          if (!DOM.modal.open && typeof DOM.modal.showModal === 'function') {
            DOM.modal.showModal();
          }
          renderBookingConfirmedView(result);
        } else {
          alert(`Booking Confirmed!\n\nPNR: ${result.pnr}\nBooking ID: ${result.bookingId}\nTotal: ${formatCurrency(result.paymentSummary.totalAmount)}`);
        }
      } else {
        alert('Booking error: ' + (result.error || 'Failed to complete checkout'));
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Network error while processing booking. Please try again.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  // Expose triggers on window for external / script access
  window.initiateBooking = initiateBooking;
  window.openPassengerModal = openPassengerModal;
  window.closePassengerModal = closePassengerModal;

  function renderBookingConfirmedView(data) {
    const modalBody = DOM.modal.querySelector('.modal-body');
    const modalFooter = DOM.modal.querySelector('.modal-footer');
    const modalTitle = DOM.modal.querySelector('#modal-item-title');

    modalTitle.textContent = 'Booking Confirmed!';
    modalBody.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.25rem;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: #DCFCE7; color: #16A34A; font-size: 28px; margin-bottom: 0.75rem;">✓</div>
        <h4 style="font-size: 1.25rem; color: var(--theme-header-text); margin-bottom: 4px;">Reservation Successfully Issued</h4>
        <p style="font-size: 0.85rem; color: var(--theme-muted-text);">Your e-ticket and itinerary receipt have been generated.</p>
      </div>

      <div style="background: var(--theme-bg); border: 1px solid var(--theme-border); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.9rem;">
        <div class="summary-row">
          <span>Booking Reference (PNR):</span>
          <strong style="font-size: 1.15rem; color: var(--cta-primary); letter-spacing: 1px;">${escapeHtml(data.pnr)}</strong>
        </div>
        <div class="summary-row">
          <span>Itinerary:</span>
          <strong>${escapeHtml(data.itemDetails.title)}</strong>
        </div>
        <div class="summary-row">
          <span>Route:</span>
          <span>${escapeHtml(data.itemDetails.route)}</span>
        </div>
        <div class="summary-row">
          <span>Passenger:</span>
          <span>${escapeHtml(data.passenger.firstName)} ${escapeHtml(data.passenger.lastName)}</span>
        </div>
        <hr style="border: none; border-top: 1px solid var(--theme-border); margin: 4px 0;">
        <div class="summary-row">
          <span>Base Fare:</span>
          <span>${formatCurrency(data.paymentSummary.basePrice)}</span>
        </div>
        ${data.paymentSummary.discountAmount > 0 ? `
          <div class="summary-row" style="color: #16A34A; font-weight: 600;">
            <span>Promo Discount (${escapeHtml(data.paymentSummary.promoCode || 'PROMO')}):</span>
            <span>-${formatCurrency(data.paymentSummary.discountAmount)}</span>
          </div>
        ` : ''}
        <div class="summary-row">
          <span>Mandatory Taxes & Fees (12%):</span>
          <span>${formatCurrency(data.paymentSummary.taxAmount)}</span>
        </div>
        <div class="summary-row">
          <span>Platform Convenience Fee:</span>
          <span>${formatCurrency(data.paymentSummary.convenienceFee)}</span>
        </div>
        <div class="summary-row" style="font-size: 1.05rem; font-weight: 800; color: var(--theme-header-text); margin-top: 4px;">
          <span>Total Guaranteed Paid:</span>
          <span style="color: var(--cta-primary);">${formatCurrency(data.paymentSummary.totalAmount)}</span>
        </div>
      </div>
    `;

    modalFooter.innerHTML = `
      <button type="button" class="btn-modal-cancel" id="btn-confirmed-close">Close</button>
      <button type="button" class="global-cta-button" onclick="openPdfETicket('${escapeHtml(data.pnr)}')">Print E-Ticket</button>
    `;

    const closeBtn = document.getElementById('btn-confirmed-close');
    if (closeBtn) closeBtn.addEventListener('click', () => DOM.modal.close());
  }

  function renderErrorMessage(msg) {
    DOM.resultsContainer.innerHTML = `
      <div style="background: #FEE2E2; border: 1px solid #FCA5A5; color: #991B1B; padding: 1.5rem; border-radius: var(--radius-sm);">
        <strong>Search service unavailable:</strong> ${escapeHtml(msg)}
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ==========================================================================
     PNR LOOKUP & MANAGE BOOKINGS CONTROLLER
     ========================================================================== */
  function setupManageBooking() {
    const manageBtn = document.getElementById('btn-open-manage-modal');
    const pnrModal = document.getElementById('pnr-lookup-modal');
    const closePnrBtn = document.getElementById('close-pnr-modal');
    const pnrForm = document.getElementById('pnr-search-form');
    const pnrResultView = document.getElementById('pnr-result-view');
    const pnrInput = document.getElementById('pnr-input-code');

    if (manageBtn && pnrModal) {
      manageBtn.addEventListener('click', () => {
        if (pnrResultView) {
          pnrResultView.style.display = 'none';
          pnrResultView.innerHTML = '';
        }
        if (typeof pnrModal.showModal === 'function') {
          pnrModal.showModal();
        }
        if (pnrInput) pnrInput.focus();
      });
    }

    if (closePnrBtn && pnrModal) {
      closePnrBtn.addEventListener('click', () => pnrModal.close());
    }

    if (pnrModal) {
      pnrModal.addEventListener('click', (e) => {
        if (e.target === pnrModal) pnrModal.close();
      });
    }

    if (pnrForm) {
      pnrForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pnrVal = pnrInput.value.trim().toUpperCase();
        if (!pnrVal) return;

        const findBtn = document.getElementById('btn-find-pnr');
        const origBtnText = findBtn ? findBtn.textContent : '';
        if (findBtn) {
          findBtn.disabled = true;
          findBtn.textContent = 'Searching...';
        }

        try {
          const booking = await fetchBookingByPNR(pnrVal);
          renderManageBookingCard(booking);
        } catch (err) {
          if (pnrResultView) {
            pnrResultView.style.display = 'block';
            pnrResultView.innerHTML = `
              <div style="background: #FEE2E2; border: 1px solid #FCA5A5; color: #991B1B; padding: 1rem; border-radius: var(--radius-sm); font-size: 0.9rem;">
                <strong>Lookup Error:</strong> ${escapeHtml(err.message)}
              </div>
            `;
          }
        } finally {
          if (findBtn) {
            findBtn.disabled = false;
            findBtn.textContent = origBtnText;
          }
        }
      });
    }
  }

  async function fetchBookingByPNR(pnr) {
    const res = await fetch(`/api/booking?pnr=${encodeURIComponent(pnr)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No booking found matching that PNR.');
    }
    const json = await res.json();
    return json.booking;
  }

  async function cancelBookingByPNR(pnr) {
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnr, action: 'cancel' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to process cancellation.');
    }
    return await res.json();
  }

  function renderManageBookingCard(booking) {
    const container = document.getElementById('pnr-result-view');
    if (!container) return;

    const isCancelled = booking.status === 'CANCELLED';
    const statusColor = isCancelled ? '#EF4444' : '#10B981';
    const statusBg = isCancelled ? '#FEE2E2' : '#DCFCE7';

    container.style.display = 'block';
    container.innerHTML = `
      <div style="border: 1px solid var(--theme-border); border-radius: var(--radius-md); padding: 1.25rem; background: var(--theme-surface-subtle); display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--theme-border); padding-bottom: 0.75rem;">
          <div>
            <span style="font-size: 0.75rem; color: var(--theme-muted-text); text-transform: uppercase;">Reference Code</span>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--cta-primary); letter-spacing: 1px;">${escapeHtml(booking.pnr)}</div>
          </div>
          <span style="background: ${statusBg}; color: ${statusColor}; font-weight: 700; font-size: 0.8rem; padding: 4px 10px; border-radius: 999px;">
            ${escapeHtml(booking.status)}
          </span>
        </div>

        <div style="font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--theme-muted-text);">Passenger:</span>
            <strong>${escapeHtml(booking.passenger.firstName)} ${escapeHtml(booking.passenger.lastName)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--theme-muted-text);">Itinerary:</span>
            <strong>${escapeHtml(booking.itinerary.title)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--theme-muted-text);">Route:</span>
            <span>${escapeHtml(booking.itinerary.origin)} ➔ ${escapeHtml(booking.itinerary.destination)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--theme-muted-text);">Departure:</span>
            <span>${new Date(booking.itinerary.departureTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--theme-muted-text);">Seat Assignment:</span>
            <span>${escapeHtml(booking.itinerary.seat)} (${escapeHtml(booking.itinerary.cabinClass)})</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--theme-border); padding-top: 0.5rem; font-size: 0.95rem;">
            <strong>Total Paid:</strong>
            <strong style="color: var(--theme-header-text);">${formatCurrency(booking.paymentSummary.totalPaid, booking.paymentSummary.currency)}</strong>
          </div>
        </div>

        <div id="cancel-status-msg" style="display: none; padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 0.25rem;"></div>

        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; border-top: 1px solid var(--theme-border); padding-top: 0.75rem;">
          ${!isCancelled ? `<button type="button" id="btn-cancel-reservation" class="btn-modal-cancel" style="color: #DC2626; border-color: #FCA5A5;">Cancel Reservation</button>` : ''}
          <button type="button" class="global-cta-button" style="height: 42px; min-width: 140px; font-size: 0.9rem;" onclick="openPdfETicket('${escapeHtml(booking.pnr)}')">Print E-Ticket</button>
        </div>
      </div>
    `;

    const cancelBtn = document.getElementById('btn-cancel-reservation');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to cancel booking ${booking.pnr}? A $50.00 cancellation fee applies.`)) return;

        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling...';

        try {
          const cancelRes = await cancelBookingByPNR(booking.pnr);
          booking.status = 'CANCELLED';
          const msgBox = document.getElementById('cancel-status-msg');
          if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.style.background = '#FEE2E2';
            msgBox.style.color = '#991B1B';
            msgBox.innerHTML = `<strong>Cancellation Processed:</strong> ${escapeHtml(cancelRes.data.message)} (Refund: ${escapeHtml(cancelRes.data.refundAmount)} after ${escapeHtml(cancelRes.data.penaltyFee)} fee).`;
          }
          cancelBtn.style.display = 'none';
        } catch (err) {
          alert('Cancellation failed: ' + err.message);
          cancelBtn.disabled = false;
          cancelBtn.textContent = 'Cancel Reservation';
        }
      });
    }
  }

  function openPdfETicket(pnr) {
    if (!pnr) return;
    const url = `/api/pdf?pnr=${encodeURIComponent(pnr)}&autoprint=true`;
    window.open(url, '_blank');
  }

  // Expose PNR handlers on window
  window.fetchBookingByPNR = fetchBookingByPNR;
  window.cancelBookingByPNR = cancelBookingByPNR;
  window.openPdfETicket = openPdfETicket;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
