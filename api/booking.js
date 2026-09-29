/**
 * Flyboro Booking Management Endpoint
 * Route: GET /api/booking?pnr={pnrCode}
 *        POST /api/booking (cancel or modify)
 * 
 * Fetches, manages, and cancels travel reservations by PNR code.
 */

export default async function handler(req, res) {
  // 1. CORS & Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-WP-Nonce');
  res.setHeader('Cache-Control', 'no-store, max-age=0'); // Always fresh for transactional data

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Handle GET Request (PNR Search)
    if (req.method === 'GET') {
      const { pnr } = req.query;

      if (!pnr || pnr.trim().length < 4) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid 6-character PNR code (e.g., FLY-X82A9P).'
        });
      }

      const formattedPNR = pnr.trim().toUpperCase();
      const bookingData = findBookingByPNR(formattedPNR);

      return res.status(200).json({
        success: true,
        pnr: formattedPNR,
        booking: bookingData
      });
    }

    // 3. Handle POST Request (Cancellation)
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { pnr, action } = body;

      if (!pnr) {
        return res.status(400).json({ success: false, error: 'Missing PNR code.' });
      }

      if (action === 'cancel') {
        const cancellationDetails = {
          pnr: pnr.toUpperCase(),
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          refundAmount: '$469.00',
          penaltyFee: '$50.00',
          message: 'Your reservation has been cancelled. Refund processing takes 3-5 business days.'
        };

        // Asynchronous cancellation notification trigger (non-blocking)
        const host = req.headers['host'] || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        fetch(`${protocol}://${host}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: body.email || 'passenger@flyboro.com',
            passengerName: body.passengerName || 'Valued Passenger',
            pnr: pnr.toUpperCase(),
            bookingDetails: {
              title: 'Cancelled Reservation',
              totalPaid: '$469.00 Refunded (after $50 penalty fee)'
            },
            type: 'cancellation'
          })
        }).catch(err => console.warn('Non-blocking cancel notify error:', err.message));

        return res.status(200).json({
          success: true,
          action: 'cancel',
          data: cancellationDetails
        });
      }
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed.' });

  } catch (error) {
    console.error('Flyboro Booking API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process booking request',
      message: error.message
    });
  }
}

/* ==========================================================================
   LOOKUP ENGINE (Dynamic Fallback & Mock Generator)
   ========================================================================== */

function findBookingByPNR(pnr) {
  // Generates dynamic record matching any requested PNR structure
  return {
    bookingId: `FLY-BK-${Math.floor(100000 + Math.random() * 900000)}`,
    pnr: pnr,
    status: 'CONFIRMED',
    issuedDate: new Date().toISOString(),
    passenger: {
      firstName: 'Himanshu',
      lastName: 'Singh',
      email: 'user@flyboro.com',
      phone: '+1-555-0199'
    },
    itinerary: {
      type: 'flight',
      title: 'Air India • Direct Flight AI-101',
      origin: 'DEL (New Delhi)',
      destination: 'LHR (London Heathrow)',
      departureTime: '2026-10-15T08:00:00Z',
      arrivalTime: '2026-10-15T16:30:00Z',
      seat: '12A (Window)',
      cabinClass: 'Economy'
    },
    paymentSummary: {
      baseFare: 450.00,
      taxesAndFees: 69.00,
      totalPaid: 519.00,
      currency: 'USD',
      paymentMethod: 'Visa ending in 4242'
    }
  };
}
