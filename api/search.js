/**
 * Flyboro Unified Search Aggregator Endpoint
 * Route: GET /api/search & POST /api/search
 * 
 * Handles flight, hotel, car rental, and private jet searches.
 * Aggregates results from supplier APIs (Duffel, HotelBeds) or generates dynamic fallback inventory.
 */

export default async function handler(req, res) {
  // 1. CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-WP-Nonce');
  // 15-minute CDN cache, 1-minute stale-while-revalidate
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=60');
  res.setHeader('X-Proxy-Provider', 'Vercel Fluid Edge Compute');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Extract Query Parameters (Supports both GET queries and POST JSON bodies)
    const incoming = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : req.query;

    const {
      type = incoming.product_type || 'flights',
      origin = incoming.location || 'DEL',
      destination = incoming.destination || (incoming.product_type === 'hotels' ? (incoming.location || 'Santorini') : 'LHR'),
      departDate = incoming.start_date || '2026-10-15',
      returnDate = incoming.end_date || '2026-10-22',
      passengers = incoming.guests || '1',
      cabinClass = incoming.aircraft_category || 'economy'
    } = incoming;

    const numPassengers = parseInt(passengers, 10) || 1;

    // 3. Environment Variable API Keys Check
    const duffelApiKey = process.env.DUFFEL_API_KEY;
    const amadeusApiKey = process.env.AMADEUS_CLIENT_ID;
    const hotelbedsKey = process.env.HOTELBEDS_API_KEY;

    let searchResults = [];
    let providerSource = 'Simulated Inventory Engine';

    // 4. Provider Dispatcher Logic
    if (type === 'flights') {
      if (duffelApiKey) {
        searchResults = await fetchDuffelFlights({ origin, destination, departDate, numPassengers, duffelApiKey });
        providerSource = 'Duffel Live Flight API';
      } else {
        searchResults = generateMockFlights(origin.toUpperCase(), destination.toUpperCase(), departDate, numPassengers);
      }
    } else if (type === 'hotels') {
      if (hotelbedsKey) {
        searchResults = await fetchHotelBeds({ destination, departDate, returnDate, hotelbedsKey });
        providerSource = 'HotelBeds Live Hotel API';
      } else {
        searchResults = generateMockHotels(destination.toUpperCase(), departDate, returnDate);
      }
    } else if (type === 'cars') {
      searchResults = generateMockCarRentals(origin.toUpperCase());
    } else if (type === 'jets') {
      searchResults = generateMockPrivateJets(origin.toUpperCase(), destination.toUpperCase());
    } else if (type === 'vacations') {
      searchResults = generateMockVacations(destination.toUpperCase(), departDate);
    }

    // 5. Send Unified JSON Payload Response (Provides both results and data keys for full client compatibility)
    return res.status(200).json({
      success: true,
      query: { type, origin, destination, departDate, returnDate, passengers: numPassengers, cabinClass },
      meta: {
        providerSource,
        cachedAt: new Date().toISOString(),
        totalResults: searchResults.length
      },
      results: searchResults,
      data: searchResults
    });

  } catch (error) {
    console.error('Flyboro Search API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to aggregate travel inventory',
      message: error.message
    });
  }
}

/* ==========================================================================
   SUPPLIER API HANDLERS (Live Integrations)
   ========================================================================== */

async function fetchDuffelFlights({ origin, destination, departDate, numPassengers, duffelApiKey }) {
  // Example live call structure for Duffel Flight API
  const response = await fetch('https://api.duffel.com/air/offer_requests', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${duffelApiKey}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        slices: [{ origin, destination, departure_date: departDate }],
        passengers: Array(numPassengers).fill({ type: 'adult' }),
        cabin_class: 'economy'
      }
    })
  });

  const data = await response.json();
  
  // Normalize Duffel payload into Flyboro standard format
  if (data.data && data.data.offers) {
    return data.data.offers.slice(0, 10).map((offer) => {
      const price = parseFloat(offer.total_amount);
      const airlineName = offer.owner.name;
      const airlineCode = offer.owner.iata_code;
      const flightNum = `${airlineCode}-${Math.floor(100 + Math.random() * 900)}`;

      return {
        id: offer.id,
        type: 'flight',
        airline: airlineName,
        airlineCode: airlineCode,
        flightNumber: flightNum,
        origin,
        destination,
        departureTime: offer.slices[0]?.segments[0]?.departing_at || `${departDate}T08:00:00`,
        arrivalTime: offer.slices[0]?.segments[0]?.arriving_at || `${departDate}T16:30:00`,
        duration: '8h 30m',
        stops: offer.slices[0]?.segments.length - 1 || 0,
        price: price,
        currency: offer.total_currency || 'USD',
        cabinClass: 'Economy',
        refundable: true,
        // UI Presentation Normalization
        title: `${airlineName} • ${origin} → ${destination}`,
        subtitle: `${flightNum} • Nonstop • 8h 30m • Meal Included`,
        image_url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80',
        badges: ['Live Duffel Inventory', 'Instant E-Ticket']
      };
    });
  }
  
  return [];
}

async function fetchHotelBeds({ destination, departDate, returnDate, hotelbedsKey }) {
  // Reserved for HotelBeds SHA-256 signature authentication & room fetching
  return [];
}

/* ==========================================================================
   DYNAMIC MOCK INVENTORY GENERATORS (Fallback / Offline Mode)
   ========================================================================== */

function generateMockFlights(origin, destination, departDate, passengers) {
  const airlines = [
    { name: 'Air India', code: 'AI', basePrice: 450, img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80' },
    { name: 'British Airways', code: 'BA', basePrice: 580, img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80' },
    { name: 'Emirates', code: 'EK', basePrice: 620, img: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=600&q=80' },
    { name: 'United Airlines', code: 'UA', basePrice: 510, img: 'https://images.unsplash.com/photo-1520437358207-323b43b50729?auto=format&fit=crop&w=600&q=80' },
    { name: 'Virgin Atlantic', code: 'VS', basePrice: 540, img: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?auto=format&fit=crop&w=600&q=80' }
  ];

  return airlines.map((airline, idx) => {
    const price = (airline.basePrice + idx * 35) * passengers;
    const flightNumber = `${airline.code}-${101 + idx * 12}`;
    const stopsText = idx % 2 === 0 ? 'Nonstop' : '1 Stop via Hub';

    return {
      id: `fl-${origin}-${destination}-${idx + 1}`,
      type: 'flight',
      airline: airline.name,
      airlineCode: airline.code,
      flightNumber: flightNumber,
      origin,
      destination,
      departureTime: `${departDate}T0${6 + idx * 2}:00:00`,
      arrivalTime: `${departDate}T${14 + idx * 2}:30:00`,
      duration: '8h 30m',
      stops: idx % 2 === 0 ? 0 : 1,
      price,
      currency: 'USD',
      cabinClass: 'Economy',
      refundable: idx % 2 === 0,
      // UI Presentation Normalization
      title: `${airline.name} • ${origin} → ${destination}`,
      subtitle: `${flightNumber} • ${stopsText} • 8h 30m • Standard Cabin`,
      image_url: airline.img,
      badges: [stopsText, idx % 2 === 0 ? 'Free Cancellation' : 'Seat Choice Included']
    };
  });
}

function generateMockHotels(destination, departDate, returnDate) {
  const hotelBrands = [
    { name: 'Grand Hyatt', rating: 4.8, price: 220, img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80' },
    { name: 'Marriott Marquis', rating: 4.6, price: 185, img: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=600&q=80' },
    { name: 'Radisson Blu', rating: 4.4, price: 140, img: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80' },
    { name: 'Hilton Garden Inn', rating: 4.2, price: 115, img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80' }
  ];

  return hotelBrands.map((hotel, idx) => ({
    id: `ht-${destination}-${idx + 1}`,
    type: 'hotel',
    name: `${hotel.name} ${destination}`,
    city: destination,
    rating: hotel.rating,
    reviewsCount: 120 + idx * 45,
    pricePerNight: hotel.price,
    totalPrice: hotel.price * 5, // assumes 5 nights
    price: hotel.price,
    currency: 'USD',
    amenities: ['Free WiFi', 'Breakfast Included', 'Pool', 'Airport Shuttle'],
    image: hotel.img,
    // UI Presentation Normalization
    title: `${hotel.name} ${destination}`,
    subtitle: `Rating ${hotel.rating} ★ • ${120 + idx * 45} Verified Reviews • Deluxe King Room`,
    image_url: hotel.img,
    badges: ['Free Breakfast', 'Pool & Spa Access', 'Best Rate Guarantee']
  }));
}

function generateMockCarRentals(origin) {
  return [
    {
      id: 'car-1',
      company: 'Hertz',
      model: 'Toyota RAV4',
      category: 'SUV',
      pricePerDay: 45,
      price: 45,
      seats: 5,
      transmission: 'Automatic',
      // UI Presentation Normalization
      title: 'Toyota RAV4 AWD or Similar',
      subtitle: 'Hertz Fleet • 5 Seats • Automatic • Unlimited Mileage',
      image_url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80',
      badges: ['Unlimited Miles', 'Instant Voucher Confirmation']
    },
    {
      id: 'car-2',
      company: 'Avis',
      model: 'Tesla Model 3 Long Range',
      category: 'Electric',
      pricePerDay: 65,
      price: 65,
      seats: 5,
      transmission: 'Automatic',
      // UI Presentation Normalization
      title: 'Tesla Model 3 Long Range',
      subtitle: 'Avis Fleet • Electric • 340mi Range • Keyless Entry',
      image_url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=600&q=80',
      badges: ['Zero Fuel Cost', 'Clean Vehicle Guaranteed']
    },
    {
      id: 'car-3',
      company: 'Sixt Prestige',
      model: 'BMW 5 Series Sedan',
      category: 'Luxury',
      pricePerDay: 89,
      price: 89,
      seats: 5,
      transmission: 'Automatic',
      // UI Presentation Normalization
      title: 'BMW 5 Series Executive Sedan',
      subtitle: 'Sixt Fleet • Luxury Executive • Navigation Included',
      image_url: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=600&q=80',
      badges: ['Prestige Selection', 'Full Comprehensive Insurance']
    }
  ];
}

function generateMockPrivateJets(origin, destination) {
  return [
    {
      id: 'jet-1',
      operator: 'Flyboro Exec',
      aircraft: 'Citation CJ4 Super Light',
      capacity: '7 Seats',
      hourlyRate: 3200,
      estTotal: 12800,
      price: 12800,
      // UI Presentation Normalization
      title: 'Cessna Citation CJ4 Super Light Jet',
      subtitle: `${origin} → ${destination} • 7 Executive Leather Seats • High-Speed Wi-Fi`,
      image_url: 'https://images.unsplash.com/photo-1520437358207-323b43b50729?auto=format&fit=crop&w=600&q=80',
      badges: ['Private VIP FBO Terminal', 'Empty Leg Guaranteed Rate']
    },
    {
      id: 'jet-2',
      operator: 'Flyboro Exec',
      aircraft: 'Gulfstream G650ER',
      capacity: '14 Seats',
      hourlyRate: 8500,
      estTotal: 34000,
      price: 34000,
      // UI Presentation Normalization
      title: 'Gulfstream G650ER Intercontinental',
      subtitle: `${origin} → ${destination} • Ultra Long Range (7,500 nm) • 14 Seats`,
      image_url: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?auto=format&fit=crop&w=600&q=80',
      badges: ['Private Terminal VIP FBO', 'Flight Attendant & Sommelier Included']
    }
  ];
}

function generateMockVacations(destination, departDate) {
  return [
    {
      id: 'vac-1',
      title: `Tropical Escape to ${destination}`,
      subtitle: '7 Nights All-Inclusive • 5-Star Beach Resort • Daily Excursions',
      price: 1850,
      image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
      badges: ['All Transfers Included', 'Bilingual Guide', 'Eco-Certified']
    }
  ];
}
