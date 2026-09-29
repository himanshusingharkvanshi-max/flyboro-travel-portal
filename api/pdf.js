/**
 * Flyboro PDF E-Ticket Generator
 * Route: GET /api/pdf?pnr={pnrCode}
 * 
 * Generates a clean, print-ready PDF boarding pass and receipt layout.
 */

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

    // 2. Mock or Fetch Booking Record
    const booking = {
      pnr: formattedPNR,
      bookingId: `FLY-BK-${Math.floor(100000 + Math.random() * 900000)}`,
      passengerName: name || 'Himanshu Singh',
      email: email || 'user@flyboro.com',
      airline: airline || 'Air India',
      flightNumber: flight || 'AI-101',
      origin: origin || 'DEL (New Delhi)',
      destination: destination || 'LHR (London Heathrow)',
      departureTime: departureTime || '2026-10-15 08:00 AM',
      arrivalTime: '2026-10-15 04:30 PM',
      seat: seat || '12A',
      cabinClass: cabin || 'Economy',
      status: 'CONFIRMED',
      totalPaid: total || '$519.00'
    };

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
              <div class="arrow">✈</div>
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
