# Flyboro Travel Booking Portal - Production Implementation

Flyboro is a multi-product travel booking portal featuring a **Hybrid Architecture** engineered for **sub-second page switching, zero external API rendering delay, and optimized mobile touch ergonomics**.

---

## 📁 Project Directory Structure

```text
C:\Users\welcome\.gemini\antigravity\scratch\flyboro-travel-portal\
├── index.html                   # Accessible Semantic HTML5 template (Car Rentals default)
├── style.css                    # Dynamic CSS variable system, themes & mobile media query
├── flyboro-engine.js            # Vanilla JS engine (0ms theme swapping, Skeletons, Cart bridge)
├── README.md                    # Deployment guide & security architecture
└── wordpress/
    └── flyboro-travel-proxy.php # Standalone WordPress Plugin & REST API proxy with Transients
```

---

## ⚡ Key Architectural Implementations

### 1. Dynamic CSS Variable Theming (Zero PHP Delay)
Theme colors switch dynamically by altering the `body` class (`body.theme-car-rental`, `body.theme-flights`, `body.theme-hotels`, `body.theme-vacations`, `body.theme-private-jets`).
- **Car Rentals & Flights:** Clean White backgrounds, Deep Corporate Navy (`#0F2A4A`) headers.
- **Hotels:** Deep Teal (`#004D40`), soft off-white surfaces (`#FAF9F6`), subtle Gold accents (`#D4AF37`).
- **Vacations:** Dark Gray text (`#263238`), Sunset Orange highlights (`#FF7043`).
- **Private Jets:** Midnight Navy (`#090D14`), Charcoal surface (`#121824`), Champagne Gold accents (`#D4AF37`).
- **Global CTA Invariant:** All primary conversion buttons (`Search Availability`, `Book Now`) strictly maintain uniform Sunset Orange (`#FF6D00`) across all themes to preserve subconscious conversion familiarity.

### 2. WordPress REST Proxy & Transient Caching
- **Endpoint:** `POST /wp-json/flyboro/v1/search`
- **Security:** Nonce validation (`X-WP-Nonce`), input schema sanitization, and API keys hidden within `wp-config.php`.
- **Transient Caching:** Query parameters are sorted and hashed (`md5(json_encode($params))`) into a 32-character key with a **15-minute TTL (`900s`)**.
- **Hostinger Server Protection:** Queries with identical parameters resolve from cache without hitting external travel APIs (Carnect, RateHawk, Hotelbeds).

### 3. Mobile Performance & Battery Optimization
- Disables 3D transforms, box-shadows, and GPU-heavy backdrop blur filters via `@media (max-width: 768px)`:
  ```css
  @media (max-width: 768px) {
    *, *::before, *::after {
      box-shadow: none !important;
      text-shadow: none !important;
      backdrop-filter: none !important;
      transform: none !important;
      transition-duration: 0.05s !important;
    }
  }
  ```
- Product line tabs feature horizontal touch snap-scrolling (`scroll-snap-type: x mandatory`).
- Touch targets meet or exceed 48px.

---

## 🚀 Quick Start & Verification

### A. Instant Static Browser Preview
Open `index.html` directly in your browser. The frontend includes built-in mock fallback data:
1. Double-click [index.html](file:///C:/Users/welcome/.gemini/antigravity/scratch/flyboro-travel-portal/index.html).
2. Click between **Car Rentals**, **Flights**, **Hotels**, **Vacations**, and **Private Jets** to verify instant CSS variable switching.
3. Click **Search Availability** to observe the CSS skeleton shimmer effect.
4. Click **Book Now** to open the reservation checkout modal.

### B. WordPress / WooCommerce Deployment
1. Copy the `wordpress/flyboro-travel-proxy.php` file to your WordPress installation:
   ```
   wp-content/plugins/flyboro-travel-proxy/flyboro-travel-proxy.php
   ```
   *(Or merge the code directly into your theme's `functions.php`).*
2. Activate the plugin in **WP Admin > Plugins**.
3. Add production credentials to `wp-config.php`:
   ```php
   define('FLYBORO_CARNECT_KEY',   'your_live_carnect_token');
   define('FLYBORO_RATEHAWK_KEY',  'your_live_ratehawk_token');
   define('FLYBORO_HOTELBEDS_KEY', 'your_live_hotelbeds_token');
   ```
4. On Hostinger, enable **Redis Object Cache** in hPanel to persist transients in RAM.
