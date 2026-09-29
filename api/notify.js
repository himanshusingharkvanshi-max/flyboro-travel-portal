/**
 * Flyboro Transactional Email Endpoint
 * Route: POST /api/notify
 * 
 * Sends automated HTML e-tickets and cancellation receipts to passengers.
 */

export default async function handler(req, res) {
  // 1. CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-WP-Nonce');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { email, passengerName, pnr, bookingDetails, type = 'confirmation' } = body;

    if (!email || !pnr) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: email and pnr are required.'
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    // 2. Generate E-Ticket HTML Content
    const htmlContent = generateETicketHTML({
      passengerName: passengerName || 'Valued Passenger',
      pnr,
      bookingDetails,
      type
    });

    // 3. Dispatch Email via Resend API (if configured)
    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Flyboro Travel <tickets@flyboro.com>',
          to: [email],
          subject: type === 'cancellation' 
            ? `Booking Cancelled - PNR: ${pnr}` 
            : `Your E-Ticket & Confirmation - PNR: ${pnr}`,
          html: htmlContent
        })
      });

      const data = await response.json();
      return res.status(200).json({ success: true, provider: 'resend', data });
    }

    // 4. Simulated Response (if API key is not yet set)
    return res.status(200).json({
      success: true,
      provider: 'simulated_email_dispatch',
      message: `Simulated notification sent to ${email} for PNR: ${pnr}`,
      previewSubject: type === 'cancellation' ? `Cancellation Notice: ${pnr}` : `E-Ticket Confirmation: ${pnr}`
    });

  } catch (error) {
    console.error('Notification API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch email notification',
      message: error.message
    });
  }
}

/* ==========================================================================
   HTML EMAIL TEMPLATE GENERATOR
   ========================================================================== */

function generateETicketHTML({ passengerName, pnr, bookingDetails = {}, type }) {
  const isCancelled = type === 'cancellation';
  const statusColor = isCancelled ? '#d32f2f' : '#2e7d32';
  const statusText = isCancelled ? 'CANCELLED' : 'CONFIRMED';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
        .container { max-width: 600px; background: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background-color: #0f2a4a; color: #ffffff; padding: 24px; text-align: center; }
        .pnr-badge { background-color: #ff6d00; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 14px; }
        .content { padding: 24px; }
        .status { display: inline-block; padding: 4px 10px; color: #ffffff; background: ${statusColor}; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .details-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0; font-size: 24px;">Flyboro Travel</h1>
          <p style="margin:8px 0 0 0; opacity: 0.8;">Official E-Ticket Receipt</p>
        </div>
        <div class="content">
          <p>Dear <strong>${passengerName}</strong>,</p>
          <p>${isCancelled ? 'Your travel reservation has been successfully cancelled.' : 'Thank you for booking with Flyboro. Here is your e-ticket itinerary:'}</p>
          
          <div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>PNR Reference: <span class="pnr-badge">${pnr}</span></span>
              <span class="status">${statusText}</span>
            </div>
          </div>

          <table class="details-table">
            <tr><td><strong>Passenger</strong></td><td>${passengerName}</td></tr>
            <tr><td><strong>Route / Service</strong></td><td>${bookingDetails.title || 'Standard Itinerary'}</td></tr>
            <tr><td><strong>Total Amount</strong></td><td>${bookingDetails.totalPaid || '$519.00'}</td></tr>
          </table>
        </div>
        <div class="footer">
          <p>Flyboro OTA Platform • Support: support@flyboro.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
