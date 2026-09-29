/**
 * Flyboro Promo Code & Discount Engine
 * Route: POST /api/promo
 * 
 * Validates discount codes and computes server-side price deductions.
 */

import { kvCommand } from '../lib/kv.js';

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
    const { code, basePrice = 0, currency = 'USD' } = body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid promotion code.'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const price = parseFloat(basePrice);

    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base price for discount calculation.'
      });
    }

    // 2. Active Promotional Rules (Base Dictionary + KV Support)
    const PROMO_DATABASE = {
      'FLYBORO10': {
        type: 'percentage',
        value: 10, // 10% off
        maxDiscount: 50, // Capped at $50
        minSpend: 100,
        description: '10% discount on all flights and stays'
      },
      'WELCOME25': {
        type: 'flat',
        value: 25, // $25 off
        maxDiscount: 25,
        minSpend: 150,
        description: '$25 flat discount for new travelers'
      },
      'FIRSTFLY': {
        type: 'percentage',
        value: 15, // 15% off
        maxDiscount: 75,
        minSpend: 200,
        description: '15% introductory travel discount'
      }
    };

    // Check persistent KV for dynamic operator promos first
    let promoRule = null;
    try {
      const kvRule = await kvCommand('GET', `flyboro:promo:${cleanCode}`);
      if (kvRule) {
        promoRule = typeof kvRule === 'string' ? JSON.parse(kvRule) : kvRule;
      }
    } catch (_) {
      // Fallback cleanly to local promo database
    }

    if (!promoRule) {
      promoRule = PROMO_DATABASE[cleanCode];
    }

    if (!promoRule) {
      return res.status(404).json({
        success: false,
        error: `Promo code "${cleanCode}" is invalid or has expired.`
      });
    }

    // 3. Minimum Spend Validation
    if (promoRule.minSpend && price < promoRule.minSpend) {
      return res.status(400).json({
        success: false,
        error: `Code "${cleanCode}" requires a minimum booking amount of $${promoRule.minSpend}.`
      });
    }

    // 4. Calculate Discount
    let discountAmount = 0;
    if (promoRule.type === 'percentage') {
      discountAmount = (price * promoRule.value) / 100;
      if (promoRule.maxDiscount && discountAmount > promoRule.maxDiscount) {
        discountAmount = promoRule.maxDiscount;
      }
    } else if (promoRule.type === 'flat') {
      discountAmount = promoRule.value;
    }

    discountAmount = parseFloat(discountAmount.toFixed(2));
    const finalPrice = parseFloat(Math.max(0, price - discountAmount).toFixed(2));

    return res.status(200).json({
      success: true,
      code: cleanCode,
      description: promoRule.description || `Discount Applied: ${cleanCode}`,
      originalPrice: price,
      discountAmount,
      finalPrice,
      currency
    });

  } catch (error) {
    console.error('Promo Code API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process promotional code.'
    });
  }
}
