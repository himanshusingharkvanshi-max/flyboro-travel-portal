/**
 * Flyboro Markup & Commission API Endpoint
 * Route: GET /api/markup  - Retrieve active OTA markup rules
 *        POST /api/markup - Update markup rules per product line
 */

import { getMarkupRules, saveMarkupRules } from '../lib/markup.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Optional Admin Secret Check for POST operations
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  const providedKey = req.headers['x-admin-key'] || req.query?.key;

  if (req.method === 'POST' && adminSecret && providedKey !== adminSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized markup administration' });
  }

  try {
    // 1. GET - Return all active markup rules
    if (req.method === 'GET') {
      const rules = await getMarkupRules();
      return res.status(200).json({
        success: true,
        rules
      });
    }

    // 2. POST - Update markup rules
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const currentRules = await getMarkupRules();

      // Support either batch rules update { rules: { flights: {...}, ... } }
      // or single product rule update { product: 'flights', value: 7, type: 'percentage', active: true }
      let updatedRules = { ...currentRules };

      if (body.rules && typeof body.rules === 'object') {
        Object.keys(body.rules).forEach(productKey => {
          if (updatedRules[productKey]) {
            updatedRules[productKey] = {
              ...updatedRules[productKey],
              ...body.rules[productKey],
              value: parseFloat(body.rules[productKey].value ?? updatedRules[productKey].value),
              active: Boolean(body.rules[productKey].active ?? updatedRules[productKey].active)
            };
          }
        });
      } else if (body.product && updatedRules[body.product]) {
        updatedRules[body.product] = {
          ...updatedRules[body.product],
          type: body.type === 'flat' ? 'flat' : 'percentage',
          value: parseFloat(body.value ?? updatedRules[body.product].value),
          active: body.active !== undefined ? Boolean(body.active) : updatedRules[body.product].active
        };
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid markup payload. Provide { product, value, type, active } or { rules: {...} }.'
        });
      }

      await saveMarkupRules(updatedRules);

      return res.status(200).json({
        success: true,
        message: 'OTA markup rules updated successfully.',
        rules: updatedRules
      });
    }

    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });

  } catch (err) {
    console.error('Markup API Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to process markup request',
      message: err.message
    });
  }
}
