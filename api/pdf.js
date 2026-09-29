/**
 * Flyboro PDF E-Ticket Generator
 * Route: GET /api/pdf?pnr={pnrCode}
 * 
 * Generates a clean, print-ready PDF boarding pass and receipt layout.
 */

import { getBooking } from '../lib/kv.js';

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const {
      pnr = 'FLY-DEMO',
      name,
      email,
      airline,
      flight,
      origin,
      destination,
      departureTime,
      seat,
      cabin,
      total
    } = req.query;

    const formattedPNR = pnr.toUpperCase();
    const stored = await getBooking(formattedPNR);

    // 2. Fetch from Persistent KV or Fallback
    const booking = {
      pnr: formattedPNR,
      bookingId: stored?.bookingId || `FLY-BK-${Math.floor(100000 + Math.random() * 900000)}`,
      passengerName: name || (stored?.passenger ? `${stored.passenger.firstName} ${stored.passenger.lastName}` : 'Himanshu Singh'),
      email: email || stored?.passenger?.email || 'user@flyboro.com',
      airline: airline || stored?.itinerary?.title?.split('•')[0]?.trim() || 'Air India',
      flightNumber: flight || stored?.itinerary?.title?.split('•')[1]?.trim() || 'AI-101',
      origin: origin || stored?.itinerary?.origin || 'DEL (New Delhi)',
      destination: destination || stored?.itinerary?.destination || 'LHR (London Heathrow)',
      departureTime: departureTime || (stored?.itinerary?.departureTime ? new Date(stored.itinerary.departureTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '2026-10-15 08:00 AM'),
      arrivalTime: '2026-10-15 04:30 PM',
      seat: seat || stored?.itinerary?.seat || '12A',
      cabinClass: cabin || stored?.itinerary?.cabinClass || 'Economy',
      status: stored?.status || 'CONFIRMED',
      totalPaid: total || (stored?.paymentSummary ? `$${Number(stored.paymentSummary.totalPaid || stored.paymentSummary.totalAmount).toFixed(2)}` : '$519.00'),
      legs: stored?.itinerary?.legs || [],
      tripType: stored?.itinerary?.tripType || (stored?.itinerary?.legs?.length > 1 ? 'roundtrip' : 'oneway')
    };

    // Build Legs breakdown HTML if round-trip or multi-leg
    const legsTableHtml = (booking.legs && booking.legs.length > 0) ? `
      <div style="margin-bottom: 24px;">
        <div class="label" style="margin-bottom: 8px;">Itinerary Segments (${booking.tripType.toUpperCase()})</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background: #0f2a4a; color: #ffffff; text-align: left;">
              <th style="padding: 8px 12px;">Leg</th>
              <th style="padding: 8px 12px;">Route</th>
              <th style="padding: 8px 12px;">Flight</th>
              <th style="padding: 8px 12px;">Date & Timing</th>
              <th style="padding: 8px 12px;">Transit</th>
            </tr>
          </thead>
          <tbody>
            ${booking.legs.map((leg, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #ffffff;' : ''}">
                <td style="padding: 8px 12px; font-weight: bold; color: ${leg.direction === 'Outbound' ? '#0f2a4a' : '#ff6d00'};">${leg.direction || `Leg ${idx + 1}`}</td>
                <td style="padding: 8px 12px; font-weight: 600;">${leg.route || `${leg.origin} → ${leg.destination}`}</td>
                <td style="padding: 8px 12px;">${leg.flightNumber}</td>
                <td style="padding: 8px 12px;">${leg.departureDate || ''} (${leg.duration || ''})</td>
                <td style="padding: 8px 12px; color: #10b981; font-weight: 600;">${leg.stopsText || 'Nonstop'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    // 3. Render Printable PDF Document
    const pdfHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>E-Ticket Boarding Pass - ${booking.pnr}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; background: #fff; }
          .ticket-card { border: 2px solid #0f2a4a; border-radius: 12px; overflow: hidden; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 16px rgba(15, 42, 74, 0.08); }
          .header { background: #0f2a4a; color: #ffffff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
          .pnr-badge { background: #ff6d00; color: #fff; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 16px; letter-spacing: 0.5px; }
          .content { padding: 24px; }
          .route-grid { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 20px; }
          .city { font-size: 20px; font-weight: bold; color: #0f2a4a; }
          .arrow { font-size: 24px; color: #ff6d00; }
          .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .value { font-size: 14px; font-weight: 600; margin-top: 4px; color: #1e293b; }
          .barcode-box { text-align: center; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
          .barcode { font-family: 'Courier New', monospace; font-size: 28px; letter-spacing: 6px; font-weight: bold; color: #0f2a4a; }
          @media print {
            body { padding: 0; background: none; }
            .no-print { display: none !important; }
            .ticket-card { box-shadow: none; border-color: #333; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
          <button onclick="window.print()" style="background: #ff6d00; color: white; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; transition: background 0.2s ease;">
            🖨️ Download / Print PDF E-Ticket
          </button>
        </div>

        <div class="ticket-card">
          <div class="header">
            <div>
              <h1>FLYBORO TRAVEL</h1>
              <span style="font-size: 12px; opacity: 0.85;">ELECTRONIC TICKET / PASSENGER RECEIPT</span>
            </div>
            <div>
              <span class="pnr-badge">PNR: ${booking.pnr}</span>
            </div>
          </div>

          <div class="content">
            <div class="route-grid">
              <div>
                <div class="label">Origin</div>
                <div class="city">${booking.origin}</div>
              </div>
              <div class="arrow">${booking.tripType === 'roundtrip' ? '⇄' : '✈'}</div>
              <div>
                <div class="label">Destination</div>
                <div class="city">${booking.destination}</div>
              </div>
            </div>

            <div class="details-grid">
              <div><div class="label">Passenger Name</div><div class="value">${booking.passengerName}</div></div>
              <div><div class="label">Carrier & Flight</div><div class="value">${booking.airline} (${booking.flightNumber})</div></div>
              <div><div class="label">Departure Time</div><div class="value">${booking.departureTime}</div></div>
              <div><div class="label">Seat Number</div><div class="value">${booking.seat}</div></div>
              <div><div class="label">Cabin Class</div><div class="value">${booking.cabinClass}</div></div>
              <div><div class="label">Total Paid</div><div class="value">${booking.totalPaid}</div></div>
            </div>

            ${legsTableHtml}

            <div class="barcode-box">
              <div class="barcode">||||| | |||||| ||| ||||||| |||||</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 6px;">BOARDING PASS SCAN CODE • ${booking.bookingId}</div>
            </div>
          </div>
        </div>

        <script>
          // Auto-trigger print dialog when opened directly
          if (window.location.search.includes('autoprint=true')) {
            window.addEventListener('load', () => {
              setTimeout(() => window.print(), 350);
            });
          }
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(pdfHtml);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate PDF e-ticket.' });
  }
}
