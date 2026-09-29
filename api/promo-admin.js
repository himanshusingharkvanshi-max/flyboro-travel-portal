/**
 * Flyboro Promo Code Management Endpoint
 * Route: GET /api/promo-admin - List all promotional campaigns
 *        POST /api/promo-admin - Create or update a promo code
 *        DELETE /api/promo-admin - Remove/deactivate a promo code
 */

import { kvCommand } from '../lib/kv.js';

const DEFAULT_PROMOS = [
  { code: 'FLYBORO10', type: 'percentage', value: 10, maxDiscount: 50, minSpend: 100, active: true, description: '10% discount on all bookings' },
  { code: 'WELCOME25', type: 'flat', value: 25, maxDiscount: 25, minSpend: 150, active: true, description: '$25 flat discount for new travelers' },
  { code: 'FIRSTFLY', type: 'percentage', value: 15, maxDiscount: 75, minSpend: 200, active: true, description: '15% introductory travel discount' }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Optional Admin Secret Check
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  const providedKey = req.headers['x-admin-key'] || req.query?.key;

  if (adminSecret && providedKey !== adminSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized promo administration' });
  }

  try {
    // 1. GET - List all promo codes from KV + Defaults
    if (req.method === 'GET') {
      let customCodes = [];
      try {
        const storedIndex = await kvCommand('LRANGE', 'flyboro:promo_index', 0, 50);
        if (Array.isArray(storedIndex)) {
          customCodes = [...new Set(storedIndex)];
        }
      } catch (_) {}

      const customPromos = [];
      for (const code of customCodes) {
        try {
          const raw = await kvCommand('GET', `flyboro:promo:${code}`);
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            customPromos.push(parsed);
          }
        } catch (_) {}
      }

      // Merge defaults with custom; custom overrides default if same code
      const map = new Map();
      DEFAULT_PROMOS.forEach(p => map.set(p.code, p));
      customPromos.forEach(p => map.set(p.code, p));

      const promos = Array.from(map.values());

      return res.status(200).json({
        success: true,
        promos
      });
    }

    // 2. POST - Create or update a promo code
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { code, type = 'percentage', value, maxDiscount, minSpend, description } = body;

      if (!code || value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required promo parameters (code, value).'
        });
      }

      const cleanCode = code.trim().toUpperCase();
      const promoData = {
        code: cleanCode,
        type: type === 'flat' ? 'flat' : 'percentage',
        value: parseFloat(value),
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        minSpend: minSpend ? parseFloat(minSpend) : 0,
        description: description || `${value}${type === 'percentage' ? '%' : '$'} Off Promotional Campaign`,
        active: true,
        updatedAt: new Date().toISOString()
      };

      // Persist to KV storage
      await kvCommand('SET', `flyboro:promo:${cleanCode}`, JSON.stringify(promoData));
      await kvCommand('LPUSH', 'flyboro:promo_index', cleanCode);

      return res.status(200).json({
        success: true,
        message: `Promo code ${cleanCode} saved successfully.`,
        promo: promoData
      });
    }

    // 3. DELETE - Deactivate/remove a promo code
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const code = body.code || req.query?.code;

      if (!code) {
        return res.status(400).json({ success: false, error: 'Promo code required for deletion.' });
      }

      const cleanCode = code.trim().toUpperCase();

      await kvCommand('DEL', `flyboro:promo:${cleanCode}`);

      return res.status(200).json({
        success: true,
        message: `Promo code ${cleanCode} deleted successfully.`
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Promo Admin API Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process promo admin action.' });
  }
}
