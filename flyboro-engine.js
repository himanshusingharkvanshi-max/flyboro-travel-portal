/**
 * Flyboro Frontend Engine
 * -------------------------------------------------------------
 * 1. Zero-latency dynamic CSS variable theme switching.
 * 2. Asynchronous API proxy fetcher with CSS Skeleton Shimmer state.
 * 3. Mobile touch targets & resilient offline/mock fallback handling.
 * 4. WooCommerce Cart Bridge trigger for conversion.
 */

(function () {
  'use strict';

  // Global Config (Injected by WordPress wp_localize_script)
  const CONFIG = window.flyboroConfig || {
    rootApi: '/wp-json/flyboro/v1',
    nonce: '',
    wcCartUrl: '/cart',
    enableClientMockFallback: true
  };

  // State
  const state = {
    activeProduct: 'cars',
    abortController: null
  };

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

  // Dynamic Form Field Templates
  const FORM_TEMPLATES = {
    cars: `
      <div class="form-group">
        <label for="input-pickup-location" class="form-label">Pick-up Location</label>
        <div class="input-wrapper">
          <input type="text" id="input-pickup-location" name="location" class="form-input location-autocomplete" placeholder="City or airport (e.g. DEL, MIA, JFK)" value="Miami (MIA)" required autocomplete="off">
          <ul class="autocomplete-dropdown" role="listbox"></ul>
        </div>
      </div>
      <div class="form-group">
        <label for="input-pickup-date" class="form-label">Pick-up Date</label>
        <input type="date" id="input-pickup-date" name="start_date" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="input-return-date" class="form-label">Drop-off Date</label>
        <input type="date" id="input-return-date" name="end_date" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="input-driver-age" class="form-label">Driver Age</label>
        <select id="input-driver-age" name="driver_age" class="form-input">
          <option value="25+" selected>25 to 69 Years</option>
          <option value="21-24">21 to 24 Years</option>
          <option value="70+">70+ Years</option>
        </select>
      </div>
    `,
    flights: `
      <div class="form-group">
        <label for="input-origin" class="form-label">Flying From</label>
        <div class="input-wrapper">
          <input type="text" id="input-origin" name="origin" class="form-input location-autocomplete" placeholder="Origin (e.g. DEL, JFK)" value="New Delhi (DEL)" required autocomplete="off">
          <ul class="autocomplete-dropdown" role="listbox"></ul>
        </div>
      </div>
      <div class="form-group">
        <label for="input-destination" class="form-label">Flying To</label>
        <div class="input-wrapper">
          <input type="text" id="input-destination" name="destination" class="form-input location-autocomplete" placeholder="Destination (e.g. LHR, DXB)" value="London (LHR)" required autocomplete="off">
          <ul class="autocomplete-dropdown" role="listbox"></ul>
        </div>
      </div>
      <div class="form-group">
        <label for="input-flight-dep" class="form-label">Departure Date</label>
        <input type="date" id="input-flight-dep" name="start_date" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="input-passengers" class="form-label">Cabin & Passengers</label>
        <select id="input-passengers" name="passengers" class="form-input">
          <option value="1-economy" selected>1 Adult, Economy</option>
          <option value="2-economy">2 Adults, Economy</option>
          <option value="2-business">2 Adults, Business Class</option>
          <option value="1-first">1 Adult, First Class</option>
        </select>
      </div>
    `,
    hotels: `
      <div class="form-group">
        <label for="input-hotel-dest" class="form-label">Destination / Resort</label>
        <div class="input-wrapper">
          <input type="text" id="input-hotel-dest" name="location" class="form-input location-autocomplete" placeholder="City or airport (e.g. Dubai, Paris)" value="Paris (CDG)" required autocomplete="off">
          <ul class="autocomplete-dropdown" role="listbox"></ul>
        </div>
      </div>
      <div class="form-group">
        <label for="input-hotel-in" class="form-label">Check-in Date</label>
        <input type="date" id="input-hotel-in" name="start_date" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="input-hotel-out" class="form-label">Check-out Date</label>
        <input type="date" id="input-hotel-out" name="end_date" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="input-hotel-rooms" class="form-label">Guests & Rooms</label>
        <select id="input-hotel-rooms" name="guests" class="form-input">
          <option value="2-1" selected>2 Guests, 1 Suite</option>
          <option value="1-1">1 Guest, 1 Deluxe Room</option>
          <option value="4-2">4 Guests, 2 Villa Suites</option>
        </select>
      </div>
    `,
    vacations: `
      <div class="form-group">
        <label for="input-vacation-dest" class="form-label">Package Experience</label>
        <div class="input-wrapper">
          <input type="text" id="input-vacation-dest" name="location" class="form-input location-autocomplete" placeholder="Destination Region" value="Singapore (SIN)" required autocomplete="off">
          <ul class="autocomplete-dropdown" role="listbox"></ul>
        </div>
      </div>
      <div class="form-group">
        <label for="input-vacation-start" class="form-label">Target Date</label>
        <input type="date" id="input-vacation-start" name="start_date" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="input-vacation-package" class="form-label">Expedition Tier</label>
        <select id="input-vacation-package" name="package_type" class="form-input">
          <option value="adventure" selected>Action & Canopy Zip Expedition</option>
          <option value="all-inclusive">All-Inclusive Luxury Eco-Resort</option>
          <option value="safari">Guided Wildlife & Volcano Trek</option>
        </select>
      </div>
    `,
    jets: `
      <div class="form-group">
        <label for="input-jet-origin" class="form-label">Departure FBO</label>
        <div class="input-wrapper">
          <input type="text" id="input-jet-origin" name="origin" class="form-input location-autocomplete" placeholder="Airport FBO (e.g. DEL, TEB)" value="New Delhi (DEL)" required autocomplete="off">
          <ul class="autocomplete-dropdown" role="listbox"></ul>
        </div>
      </div>
      <div class="form-group">
        <label for="input-jet-dest" class="form-label">Destination FBO</label>
        <div class="input-wrapper">
          <input type="text" id="input-jet-dest" name="destination" class="form-input location-autocomplete" placeholder="Airport FBO (e.g. DXB, VNY)" value="Dubai (DXB)" required autocomplete="off">
          <ul class="autocomplete-dropdown" role="listbox"></ul>
        </div>
      </div>
      <div class="form-group">
        <label for="input-jet-date" class="form-label">Charter Departure</label>
        <input type="date" id="input-jet-date" name="start_date" class="form-input" required>
      </div>
      <div class="form-group">
        <label for="input-jet-cabin" class="form-label">Aircraft Category</label>
        <select id="input-jet-cabin" name="aircraft_category" class="form-input">
          <option value="heavy" selected>Heavy Jet (Challenger 650 / 12 Pax)</option>
          <option value="ultra-long">Ultra Long Range (Gulfstream G650ER)</option>
          <option value="super-mid">Super Midsize (Citation X)</option>
          <option value="light">Light Jet (Phenom 300 / 6 Pax)</option>
        </select>
      </div>
    `
  };

  // Mock responses for instant verification and fallback
  const MOCK_INVENTORY = {
    cars: [
      {
        id: 'CR-TESLA-3',
        title: 'Tesla Model 3 Long Range',
        subtitle: 'Electric • 5 Seats • 340mi Range • Instant Keyless Entry',
        price: 89.00,
        provider: 'Carnect Direct Fleet',
        image_url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=360&auto=format&fit=crop&q=80',
        badges: ['Instant Confirmation', 'Zero Fuel Cost', 'Free Cancellation']
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
        badges: ['Prestige Selection', 'Full Comprehensive Coverage']
      }
    ],
    flights: [
      {
        id: 'FL-BA-178',
        title: 'British Airways • JFK → LHR',
        subtitle: 'Boeing 777-300ER • Club World Business • 6h 50m Nonstop',
        price: 1420.00,
        provider: 'RateHawk GDS',
        image_url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=360&auto=format&fit=crop&q=80',
        badges: ['Direct Flight', 'Lie-Flat Beds', 'Lounge Access']
      },
      {
        id: 'FL-EK-202',
        title: 'Emirates • JFK → DXB',
        subtitle: 'Airbus A380-800 • First Class Private Suite • Nonstop',
        price: 4890.00,
        provider: 'RateHawk GDS',
        image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=360&auto=format&fit=crop&q=80',
        badges: ['Onboard Shower', 'Chauffeur Drive', 'Gourmet Dining']
      }
    ],
    hotels: [
      {
        id: 'HT-CANAVES-OIA',
        title: 'Canaves Oia Suites & Spa',
        subtitle: 'Santorini Caldera View Suite • Private Infinity Pool • Breakfast',
        price: 840.00,
        provider: 'Hotelbeds Luxury',
        image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=360&auto=format&fit=crop&q=80',
        badges: ['Caldera View', 'Private Plunge Pool', 'Forbes 5-Star']
      },
      {
        id: 'HT-FOUR-SEASONS-CAP',
        title: 'Grand-Hôtel du Cap-Ferrat',
        subtitle: 'Four Seasons Palace • French Riviera Seafront Garden Suite',
        price: 1250.00,
        provider: 'Hotelbeds Luxury',
        image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=360&auto=format&fit=crop&q=80',
        badges: ['Michelin Star Dining', 'Club Dauphin Access', 'Spa Included']
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
        badges: ['All Transfers Included', 'Bilingual Guide', 'Eco-Luxury Certified']
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
        badges: ['Empty Leg Guaranteed Rate', 'Pet Friendly']
      }
    ]
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

    // Modal
    DOM.modal = document.getElementById('booking-modal');
    DOM.modalCloseBtn = document.getElementById('modal-close-btn');
    DOM.modalCancelBtn = document.getElementById('modal-cancel-btn');
    DOM.modalCheckoutBtn = document.getElementById('modal-checkout-btn');
    DOM.modalItemTitle = document.getElementById('modal-item-title');
    DOM.modalSku = document.getElementById('modal-sku');
    DOM.modalPrice = document.getElementById('modal-price');
    DOM.modalProvider = document.getElementById('modal-provider');
  }

  function init() {
    cacheDom();
    setupProductTabs();
    setupFormSubmission();
    setupModalEvents();
    setupManageBooking();

    // Render initial form fields for default Car Rentals
    renderProductFields('cars');
  }

  /**
   * Tab Switching: Instant Body Class Theme Swap
   */
  function setupProductTabs() {
    DOM.tabPills.forEach(pill => {
      pill.addEventListener('click', function () {
        const targetProduct = this.getAttribute('data-product');
        if (state.activeProduct === targetProduct) return;

        // 1. Accessibility State
        DOM.tabPills.forEach(p => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');

        // 2. Zero-Lag Theme Swap on <body>
        const meta = PRODUCT_METADATA[targetProduct] || PRODUCT_METADATA.cars;
        DOM.body.className = meta.theme;

        // 3. Update Indicator Text
        if (DOM.themeIndicator) {
          DOM.themeIndicator.querySelector('.theme-name').textContent = meta.desc;
        }

        // 4. Update Engine Copy & Fields
        state.activeProduct = targetProduct;
        DOM.productTypeInput.value = targetProduct;
        DOM.engineHeadline.textContent = meta.title;
        DOM.engineSubheadline.textContent = meta.subtitle;

        renderProductFields(targetProduct);

        // Clear previous results
        DOM.resultsContainer.innerHTML = '';
        DOM.resultsHeader.style.display = 'none';
      });
    });
  }

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
  }

  function setSmartDefaultDates() {
    const today = new Date();
    const plus3 = new Date(today);
    plus3.setDate(plus3.getDate() + 3);

    const start = DOM.dynamicFields.querySelector('input[name="start_date"]');
    const end = DOM.dynamicFields.querySelector('input[name="end_date"]');

    const fmt = d => d.toISOString().split('T')[0];
    if (start && start.type === 'date') start.value = fmt(today);
    if (end && end.type === 'date') end.value = fmt(plus3);
  }

  /**
   * Asynchronous Proxy API Submissions & Shimmer Skeletons
   */
  function setupFormSubmission() {
    DOM.searchForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (!this.checkValidity()) {
        this.reportValidity();
        return;
      }

      // Collect values
      const formData = new FormData(this);
      const payload = {};
      formData.forEach((v, k) => { payload[k] = v; });

      // Start Visual Loading Sequence
      DOM.btnSubmit.disabled = true;
      DOM.btnSubmit.classList.add('is-loading');
      DOM.resultsHeader.style.display = 'flex';
      DOM.resultsMetaSource.textContent = 'Querying WordPress Proxy...';
      renderSkeletonCards(3);

      if (state.abortController) {
        state.abortController.abort();
      }
      state.abortController = new AbortController();

      try {
        // Determine whether to use Vercel Serverless Function (/api/search) or WordPress proxy
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
          // If /api/search was attempted and failed, try WordPress proxy fallback
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

        // If running in local prototype mode without WP active, fallback gracefully
        if (CONFIG.enableClientMockFallback) {
          setTimeout(() => {
            DOM.resultsMetaSource.textContent = 'Prototype Simulation (No WP Host Detected)';
            const mockList = MOCK_INVENTORY[state.activeProduct] || MOCK_INVENTORY.cars;
            renderLiveResults({ success: true, data: mockList });
          }, 650);
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
   * Render Shimmering Skeleton Cards
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
   * Render Actual Data Results
   */
  function renderLiveResults(res) {
    const list = res.results || res.data;
    if (!list || list.length === 0) {
      DOM.resultsContainer.innerHTML = `
        <div style="background: var(--theme-surface); border: 1px solid var(--theme-border); border-radius: var(--radius-md); padding: 3rem; text-align: center;">
          <h3 style="color: var(--theme-header-text);">No inventory available for your selected dates.</h3>
          <p style="color: var(--theme-muted-text); margin-top: 0.5rem;">Try modifying your search criteria or dates.</p>
        </div>
      `;
      return;
    }

    const cardsHtml = list.map(item => `
      <article class="travel-card" data-sku="${escapeHtml(item.id)}">
        <div class="travel-card-media">
          <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
        </div>
        <div class="travel-card-details">
          <h3 class="travel-card-title">${escapeHtml(item.title)}</h3>
          <p class="travel-card-meta">${escapeHtml(item.subtitle)}</p>
          <div class="travel-card-tags">
            ${(item.badges || []).map(b => `<span class="badge-tag">${escapeHtml(b)}</span>`).join('')}
          </div>
        </div>
        <div class="travel-card-actions">
          <div class="travel-card-price">
            <div class="price-sub">Rate from</div>
            <div class="price-val">$${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <!-- Global Conversion CTA: Always Sunset Orange -->
          <button type="button" 
                  class="global-cta-button btn-book-now" 
                  data-sku="${escapeHtml(item.id)}"
                  data-title="${escapeHtml(item.title)}"
                  data-price="${item.price}"
                  data-provider="${escapeHtml(item.provider || 'Flyboro Partner')}">
            Book Now
          </button>
        </div>
      </article>
    `).join('');

    DOM.resultsContainer.innerHTML = cardsHtml;
    bindBookingButtons();
  }

  function bindBookingButtons() {
    document.querySelectorAll('.btn-book-now').forEach(btn => {
      btn.addEventListener('click', function () {
        const sku = this.getAttribute('data-sku');
        const title = this.getAttribute('data-title');
        const price = this.getAttribute('data-price');
        const provider = this.getAttribute('data-provider');

        // Show confirmation modal
        DOM.modalItemTitle.textContent = title;
        DOM.modalSku.textContent = sku;
        DOM.modalPrice.textContent = `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        DOM.modalProvider.textContent = provider;

        // Store active sku on modal for checkout dispatch
        DOM.modal.setAttribute('data-target-sku', sku);
        DOM.modal.setAttribute('data-target-price', price);
        DOM.modal.setAttribute('data-target-title', title);
        DOM.modal.setAttribute('data-target-provider', provider);

        if (typeof DOM.modal.showModal === 'function') {
          DOM.modal.showModal();
        } else {
          openPassengerModal({ id: sku, price: parseFloat(price) || 0, title: title, provider: provider });
        }
      });
    });
  }

  /**
   * Opens the Passenger Details Modal for a given travel item.
   */
  function openPassengerModal(itemData) {
    const modal = document.getElementById('flyboro-passenger-modal');
    const hiddenInput = document.getElementById('selected-booking-item');

    if (modal && hiddenInput) {
      hiddenInput.value = JSON.stringify(itemData);
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');

      // Focus first input for immediate typing
      const firstInput = document.getElementById('passenger-first-name');
      if (firstInput) setTimeout(() => firstInput.focus(), 60);
    }
  }

  /**
   * Closes the Passenger Details Modal.
   */
  function closePassengerModal() {
    const modal = document.getElementById('flyboro-passenger-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function setupModalEvents() {
    DOM.modalCloseBtn.addEventListener('click', () => DOM.modal.close());
    DOM.modalCancelBtn.addEventListener('click', () => DOM.modal.close());

    // From review modal -> Transition to Passenger Information Modal
    DOM.modalCheckoutBtn.addEventListener('click', function () {
      const sku = DOM.modal.getAttribute('data-target-sku');
      const price = parseFloat(DOM.modal.getAttribute('data-target-price')) || 0;
      const title = DOM.modal.getAttribute('data-target-title');
      const provider = DOM.modal.getAttribute('data-target-provider') || 'Flyboro Partner';

      DOM.modal.close();

      openPassengerModal({
        id: sku,
        price: price,
        title: title,
        provider: provider
      });
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

    if (passengerForm) {
      passengerForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const submitBtn = document.getElementById('submit-booking-btn');
        const origSubmitText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Processing...';
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

        // Trigger checkout call with user-provided dynamic passenger details
        await initiateBooking(itemData, { passenger: passengerData });
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
          item: itemData,
          passenger: options.passenger || {
            firstName: 'Himanshu',
            lastName: 'Singh',
            email: 'user@flyboro.com'
          },
          paymentMethod: options.paymentMethod || 'demo' // Change to 'stripe' or 'woocommerce' when configured
        })
      });

      const result = await response.json();

      if (result.success) {
        if (result.checkoutUrl) {
          // Redirect to Stripe Checkout page
          window.location.href = result.checkoutUrl;
          return;
        }

        // Render confirmation view inside modal
        if (DOM.modal) {
          if (!DOM.modal.open && typeof DOM.modal.showModal === 'function') {
            DOM.modal.showModal();
          }
          renderBookingConfirmedView(result);
        } else {
          // Display confirmation alert fallback
          alert(`Booking Confirmed!\n\nPNR: ${result.pnr}\nBooking ID: ${result.bookingId}\nTotal: $${result.paymentSummary.totalAmount}`);
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
          <span>$${Number(data.paymentSummary.basePrice).toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Taxes & GST (12%):</span>
          <span>$${Number(data.paymentSummary.taxAmount).toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Convenience Fee:</span>
          <span>$${Number(data.paymentSummary.convenienceFee).toFixed(2)}</span>
        </div>
        <div class="summary-row" style="font-size: 1.05rem; font-weight: 800; color: var(--theme-header-text); margin-top: 4px;">
          <span>Total Paid:</span>
          <span style="color: var(--cta-primary);">$${Number(data.paymentSummary.totalAmount).toFixed(2)} USD</span>
        </div>
      </div>
    `;

    modalFooter.innerHTML = `
      <button type="button" class="btn-modal-cancel" id="btn-confirmed-close">Close</button>
      <button type="button" class="global-cta-button" onclick="window.print()">Print Itinerary Receipt</button>
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
            <strong style="color: var(--theme-header-text);">$${Number(booking.paymentSummary.totalPaid).toFixed(2)} ${escapeHtml(booking.paymentSummary.currency)}</strong>
          </div>
        </div>

        <div id="cancel-status-msg" style="display: none; padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 0.25rem;"></div>

        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; border-top: 1px solid var(--theme-border); padding-top: 0.75rem;">
          ${!isCancelled ? `<button type="button" id="btn-cancel-reservation" class="btn-modal-cancel" style="color: #DC2626; border-color: #FCA5A5;">Cancel Reservation</button>` : ''}
          <button type="button" class="global-cta-button" style="height: 42px; min-width: 140px; font-size: 0.9rem;" onclick="window.print()">Print E-Ticket</button>
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

  // Expose PNR handlers on window
  window.fetchBookingByPNR = fetchBookingByPNR;
  window.cancelBookingByPNR = cancelBookingByPNR;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
