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
      tripType = incoming.trip_type || incoming.tripType || (incoming.end_date ? 'roundtrip' : 'oneway'),
      origin = incoming.location || incoming.origin || 'DEL',
      destination = incoming.destination || (incoming.product_type === 'hotels' ? (incoming.location || 'Santorini') : 'LHR'),
      departDate = incoming.start_date || incoming.departDate || '2026-10-15',
      returnDate = incoming.end_date || incoming.returnDate || '2026-10-22',
      passengers = incoming.passengers || incoming.guests || '1',
      cabinClass = incoming.cabinClass || incoming.cabin || incoming.aircraft_category || 'economy'
    } = incoming;

    // Parse passenger count and cabin class cleanly
    let numPassengers = 1;
    let resolvedCabin = cabinClass;
    if (typeof passengers === 'string' && passengers.includes('-')) {
      const parts = passengers.split('-');
      numPassengers = parseInt(parts[0], 10) || 1;
      resolvedCabin = parts[1] || cabinClass;
    } else {
      numPassengers = parseInt(passengers, 10) || 1;
    }

    // 3. Environment Variable API Keys Check
    const duffelApiKey = process.env.DUFFEL_API_KEY;
    const amadeusApiKey = process.env.AMADEUS_CLIENT_ID;
    const hotelbedsKey = process.env.HOTELBEDS_API_KEY;

    let searchResults = [];
    let providerSource = 'Simulated Inventory Engine';

    // 4. Provider Dispatcher Logic
    if (type === 'flights') {
      if (duffelApiKey) {
        searchResults = await fetchDuffelFlights({ origin, destination, departDate, returnDate, tripType, numPassengers, cabinClass: resolvedCabin, duffelApiKey });
        providerSource = 'Duffel Live Flight API';
      } else {
        searchResults = generateMockFlights(origin, destination, departDate, returnDate, numPassengers, tripType, resolvedCabin);
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
      query: { type, tripType, origin, destination, departDate, returnDate, passengers: numPassengers, cabinClass: resolvedCabin },
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

function extractIata(str, fallback) {
  if (!str) return fallback;
  const match = String(str).match(/\(([A-Z]{3})\)/i);
  if (match) return match[1].toUpperCase();
  const cleaned = String(str).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cleaned)) return cleaned;
  return fallback;
}

async function fetchDuffelFlights({ origin, destination, departDate, returnDate, tripType, numPassengers, cabinClass, duffelApiKey }) {
  const originCode = extractIata(origin, 'DEL');
  const destCode = extractIata(destination, 'LHR');

  const slices = [{ origin: originCode, destination: destCode, departure_date: departDate }];
  if (tripType === 'roundtrip' && returnDate) {
    slices.push({ origin: destCode, destination: originCode, departure_date: returnDate });
  }

  const response = await fetch('https://api.duffel.com/air/offer_requests', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${duffelApiKey}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        slices,
        passengers: Array(numPassengers).fill({ type: 'adult' }),
        cabin_class: cabinClass || 'economy'
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
      const offerSlices = offer.slices || [];
      const isRoundTrip = offerSlices.length > 1;

      const legs = offerSlices.map((slice, sIdx) => {
        const seg = slice.segments && slice.segments[0];
        const dir = sIdx === 0 ? 'Outbound' : 'Return';
        const sOrigin = slice.origin?.iata_code || (sIdx === 0 ? originCode : destCode);
        const sDest = slice.destination?.iata_code || (sIdx === 0 ? destCode : originCode);
        const sNum = seg?.operating_carrier_flight_number
          ? `${seg.operating_carrier?.iata_code || airlineCode}-${seg.operating_carrier_flight_number}`
          : (sIdx === 0 ? flightNum : `${airlineCode}-${Math.floor(100 + Math.random() * 900)}`);

        return {
          direction: dir,
          route: `${sOrigin} → ${sDest}`,
          flightNumber: sNum,
          departureDate: (seg?.departing_at || '').split('T')[0] || (sIdx === 0 ? departDate : returnDate),
          departureTime: seg?.departing_at || (sIdx === 0 ? `${departDate}T08:00:00` : `${returnDate}T10:00:00`),
          arrivalTime: seg?.arriving_at || (sIdx === 0 ? `${departDate}T16:30:00` : `${returnDate}T18:30:00`),
          duration: slice.duration ? slice.duration.replace('PT', '').toLowerCase() : '8h 30m',
          stopsText: (slice.segments?.length || 1) > 1 ? `${slice.segments.length - 1} Stop(s)` : 'Nonstop',
          origin: sOrigin,
          destination: sDest
        };
      });

      return {
        id: offer.id,
        type: 'flight',
        tripType: isRoundTrip ? 'roundtrip' : 'oneway',
        airline: airlineName,
        airlineCode: airlineCode,
        flightNumber: flightNum,
        origin: originCode,
        destination: destCode,
        departureTime: offerSlices[0]?.segments[0]?.departing_at || `${departDate}T08:00:00`,
        arrivalTime: offerSlices[0]?.segments[0]?.arriving_at || `${departDate}T16:30:00`,
        duration: offerSlices[0]?.duration ? offerSlices[0].duration.replace('PT', '').toLowerCase() : '8h 30m',
        stops: (offerSlices[0]?.segments?.length || 1) - 1,
        price: price,
        currency: offer.total_currency || 'USD',
        cabinClass: 'Economy',
        refundable: true,
        legs,
        // UI Presentation Normalization
        title: `${airlineName} • ${originCode} ${isRoundTrip ? '⇄' : '→'} ${destCode}${isRoundTrip ? ' (Round-Trip)' : ''}`,
        subtitle: `${flightNum} • ${isRoundTrip ? 'Round-Trip' : 'One-Way'} • Live Duffel API`,
        image_url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80',
        badges: [isRoundTrip ? 'Round-Trip' : 'One-Way', 'Live Duffel Inventory', 'Instant E-Ticket']
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

function generateMockFlights(originRaw, destinationRaw, departDate, returnDate, numPassengers, tripType = 'roundtrip', cabinClass = 'economy') {
  const originCode = extractIata(originRaw, 'DEL');
  const destCode = extractIata(destinationRaw, 'LHR');

  const airlines = [
    { name: 'Air India', code: 'AI', basePrice: 450, img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80' },
    { name: 'British Airways', code: 'BA', basePrice: 580, img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80' },
    { name: 'Emirates', code: 'EK', basePrice: 620, img: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=600&q=80' },
    { name: 'United Airlines', code: 'UA', basePrice: 510, img: 'https://images.unsplash.com/photo-1520437358207-323b43b50729?auto=format&fit=crop&w=600&q=80' },
    { name: 'Virgin Atlantic', code: 'VS', basePrice: 540, img: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?auto=format&fit=crop&w=600&q=80' }
  ];

  const cabinMultiplier = {
    economy: 1,
    premium: 1.4,
    business: 2.5,
    first: 4.0
  }[String(cabinClass).toLowerCase()] || 1;

  const normalizedCabin = cabinClass.charAt(0).toUpperCase() + cabinClass.slice(1);

  return airlines.map((airline, idx) => {
    const stopsText = idx % 2 === 0 ? 'Nonstop' : '1 Stop via Hub';
    const outboundFlightNum = `${airline.code}-${101 + idx * 12}`;
    const returnFlightNum = `${airline.code}-${102 + idx * 12}`;
    const outDepTime = `${departDate}T0${6 + idx * 2}:00:00`;
    const outArrTime = `${departDate}T${14 + idx * 2}:30:00`;

    if (tripType === 'roundtrip') {
      const retDepTime = `${returnDate}T${10 + idx}:15:00`;
      const retArrTime = `${returnDate}T${18 + idx}:45:00`;
      const price = Math.round((airline.basePrice + idx * 35) * cabinMultiplier * 1.85 * numPassengers);

      return {
        id: `fl-${originCode}-${destCode}-${idx + 1}-rt`,
        type: 'flight',
        tripType: 'roundtrip',
        airline: airline.name,
        airlineCode: airline.code,
        flightNumber: outboundFlightNum,
        returnFlightNumber: returnFlightNum,
        origin: originCode,
        destination: destCode,
        departureTime: outDepTime,
        arrivalTime: outArrTime,
        returnDepartureTime: retDepTime,
        returnArrivalTime: retArrTime,
        duration: '17h 00m Total Transit',
        stops: idx % 2 === 0 ? 0 : 1,
        price,
        currency: 'USD',
        cabinClass: normalizedCabin,
        refundable: idx % 2 === 0,
        legs: [
          {
            direction: 'Outbound',
            route: `${originCode} → ${destCode}`,
            flightNumber: outboundFlightNum,
            departureDate: departDate,
            departureTime: outDepTime,
            arrivalTime: outArrTime,
            duration: '8h 30m',
            stopsText,
            origin: originCode,
            destination: destCode
          },
          {
            direction: 'Return',
            route: `${destCode} → ${originCode}`,
            flightNumber: returnFlightNum,
            departureDate: returnDate,
            departureTime: retDepTime,
            arrivalTime: retArrTime,
            duration: '8h 30m',
            stopsText,
            origin: destCode,
            destination: originCode
          }
        ],
        title: `${airline.name} • ${originCode} ⇄ ${destCode} (Round-Trip)`,
        subtitle: `Out: ${outboundFlightNum} (${departDate}) • Ret: ${returnFlightNum} (${returnDate}) • ${stopsText}`,
        image_url: airline.img,
        badges: ['Round-Trip', stopsText, idx % 2 === 0 ? 'Free Cancellation' : 'Seat Choice Included']
      };
    } else if (tripType === 'multicity') {
      const transitHub = idx % 2 === 0 ? 'DXB' : 'FRA';
      const leg2DepTime = `${returnDate}T11:30:00`;
      const leg2ArrTime = `${returnDate}T19:00:00`;
      const price = Math.round((airline.basePrice + idx * 35) * cabinMultiplier * 2.1 * numPassengers);

      return {
        id: `fl-${originCode}-${destCode}-${idx + 1}-mc`,
        type: 'flight',
        tripType: 'multicity',
        airline: airline.name,
        airlineCode: airline.code,
        flightNumber: outboundFlightNum,
        origin: originCode,
        destination: destCode,
        departureTime: outDepTime,
        arrivalTime: outArrTime,
        duration: '22h 30m Combined Transit',
        stops: 1,
        price,
        currency: 'USD',
        cabinClass: normalizedCabin,
        refundable: true,
        legs: [
          {
            direction: 'Leg 1',
            route: `${originCode} → ${destCode}`,
            flightNumber: outboundFlightNum,
            departureDate: departDate,
            departureTime: outDepTime,
            arrivalTime: outArrTime,
            duration: '8h 30m',
            stopsText: 'Direct Flight',
            origin: originCode,
            destination: destCode
          },
          {
            direction: 'Leg 2',
            route: `${destCode} → ${transitHub}`,
            flightNumber: returnFlightNum,
            departureDate: returnDate,
            departureTime: leg2DepTime,
            arrivalTime: leg2ArrTime,
            duration: '6h 30m',
            stopsText: 'Connecting Segment',
            origin: destCode,
            destination: transitHub
          }
        ],
        title: `${airline.name} • ${originCode} → ${destCode} → ${transitHub} (Multi-City)`,
        subtitle: `Leg 1: ${outboundFlightNum} • Leg 2: ${returnFlightNum} • Multi-City Transit`,
        image_url: airline.img,
        badges: ['Multi-City', 'Baggage Checked Through', 'Free Cancellation']
      };
    } else {
      // Default: One-Way
      const price = Math.round((airline.basePrice + idx * 35) * cabinMultiplier * numPassengers);

      return {
        id: `fl-${originCode}-${destCode}-${idx + 1}-ow`,
        type: 'flight',
        tripType: 'oneway',
        airline: airline.name,
        airlineCode: airline.code,
        flightNumber: outboundFlightNum,
        origin: originCode,
        destination: destCode,
        departureTime: outDepTime,
        arrivalTime: outArrTime,
        duration: '8h 30m',
        stops: idx % 2 === 0 ? 0 : 1,
        price,
        currency: 'USD',
        cabinClass: normalizedCabin,
        refundable: idx % 2 === 0,
        legs: [
          {
            direction: 'Outbound',
            route: `${originCode} → ${destCode}`,
            flightNumber: outboundFlightNum,
            departureDate: departDate,
            departureTime: outDepTime,
            arrivalTime: outArrTime,
            duration: '8h 30m',
            stopsText,
            origin: originCode,
            destination: destCode
          }
        ],
        title: `${airline.name} • ${originCode} → ${destCode} (One-Way)`,
        subtitle: `${outboundFlightNum} • ${stopsText} • 8h 30m • ${normalizedCabin}`,
        image_url: airline.img,
        badges: ['One-Way', stopsText, idx % 2 === 0 ? 'Free Cancellation' : 'Seat Choice Included']
      };
    }
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
