/**
 * Flyboro SMS & WhatsApp Notification Endpoint
 * Route: POST /api/sms
 * 
 * Dispatches real-time SMS and WhatsApp alerts with PNR details and boarding pass links.
 */

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-WP-Nonce');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { phone, pnr, passengerName, type = 'confirmation', channel = 'sms' } = body;

    if (!phone || !pnr) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: phone and pnr are required.'
      });
    }

    const cleanPNR = String(pnr).trim().toUpperCase();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+15550199';

    // 2. Format Mobile Notification Message
    const host = req.headers['host'] || 'flyboro-travel-portal.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const pdfLink = `${protocol}://${host}/api/pdf?pnr=${cleanPNR}&autoprint=true`;

    const messageBody = type === 'cancellation'
      ? `Flyboro Alert: Your reservation (PNR: ${cleanPNR}) has been cancelled. Refund processing has been initiated.`
      : `Flyboro Confirmation: Hi ${passengerName || 'Traveler'}, your booking (PNR: ${cleanPNR}) is confirmed! View Boarding Pass: ${pdfLink}`;

    // 3. Live Twilio API Dispatcher
    if (accountSid && authToken) {
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const recipientPhone = channel === 'whatsapp' && !phone.startsWith('whatsapp:') ? `whatsapp:${phone}` : phone;
      const senderPhone = channel === 'whatsapp' && !fromNumber.startsWith('whatsapp:') ? `whatsapp:${fromNumber}` : fromNumber;

      const params = new URLSearchParams();
      params.append('To', recipientPhone);
      params.append('From', senderPhone);
      params.append('Body', messageBody);

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const twilioData = await twilioRes.json();
      return res.status(200).json({
        success: true,
        provider: 'twilio',
        channel,
        sid: twilioData.sid,
        recipient: recipientPhone,
        pnr: cleanPNR
      });
    }

    // 4. Simulated Dispatch Fallback (for developer previews and test environments)
    return res.status(200).json({
      success: true,
      provider: 'simulated_sms_dispatch',
      channel,
      recipient: phone,
      pnr: cleanPNR,
      messagePreview: messageBody
    });

  } catch (error) {
    console.error('SMS API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch SMS/WhatsApp notification',
      message: error.message
    });
  }
}
