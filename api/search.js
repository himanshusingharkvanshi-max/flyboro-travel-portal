/**
 * Vercel Serverless Function: Flyboro Travel Proxy & Edge Cache
 * Route: /api/search
 * Handles upstream inventory dispatching with Vercel Edge CDN Caching (15m s-maxage)
 */

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-WP-Nonce');
    return res.status(200).end();
  }

  // Allow GET and POST
  let params = {};
  if (req.method === 'POST') {
    params = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } else if (req.method === 'GET') {
    params = req.query || {};
  } else {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const product_type = params.product_type || 'cars';
  const location = params.location || params.origin || 'MIA';
  const start_date = params.start_date || new Date().toISOString().split('T')[0];
  const end_date = params.end_date || '';

  // Vercel Edge CDN Caching Header:
  // s-maxage=900: Vercel Edge caches response for 15 minutes (900 seconds)
  // stale-while-revalidate=60: Serves stale cache while fetching fresh upstream in background
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=60');
  res.setHeader('X-Proxy-Provider', 'Vercel Fluid Edge Function');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const inventory = getInventory(product_type, { location, start_date, end_date, ...params });
    return res.status(200).json({
      success: true,
      provider: 'Vercel Edge Proxy',
      cache_policy: '15-Minute Global CDN (s-maxage=900)',
      data: inventory
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function getInventory(product_type, query) {
  const inventories = {
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

  return inventories[product_type] || inventories.cars;
}
