/**
 * Flyboro Exchange Rates Endpoint
 * Route: GET /api/currency
 * 
 * Delivers global exchange rates with 1-hour Edge CDN caching.
 */

import { CURRENCY_RATES } from '../lib/currency.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    return res.status(200).json({
      success: true,
      base: 'USD',
      timestamp: new Date().toISOString(),
      rates: CURRENCY_RATES
    });
  } catch (error) {
    console.error('Currency API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve currency rates'
    });
  }
}
