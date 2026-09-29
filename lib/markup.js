/**
 * Flyboro OTA Commission & Price Markup Engine
 * 
 * Manages margin calculations, supplier net vs customer retail pricing,
 * and rule persistence in Vercel KV / Redis.
 */

import { kvCommand } from './kv.js';

export const DEFAULT_MARKUP_RULES = {
  flights: {
    product: 'flights',
    label: 'Commercial Flights',
    type: 'percentage', // 'percentage' | 'flat'
    value: 5,           // 5% margin
    minPrice: 50,
    active: true,
    description: 'Standard 5% OTA markup over wholesale GDS/Duffel flight offers'
  },
  hotels: {
    product: 'hotels',
    label: 'Hotels & Luxury Resorts',
    type: 'percentage',
    value: 12,          // 12% margin
    minPrice: 50,
    active: true,
    description: 'Premier 12% commission on HotelBeds wholesale portfolio'
  },
  cars: {
    product: 'cars',
    label: 'Car Rentals',
    type: 'percentage',
    value: 10,          // 10% margin
    minPrice: 20,
    active: true,
    description: '10% partner markup over Carnect fleet rate'
  },
  jets: {
    product: 'jets',
    label: 'Private Jets & Charters',
    type: 'percentage',
    value: 4,           // 4% margin
    minPrice: 500,
    active: true,
    description: '4% VIP brokerage fee on private charter operations'
  },
  vacations: {
    product: 'vacations',
    label: 'Vacation Packages',
    type: 'percentage',
    value: 8,           // 8% margin
    minPrice: 100,
    active: true,
    description: '8% package curation margin on adventure expeditions'
  }
};

/**
 * Retrieve current active markup rules from KV storage with default fallbacks
 */
export async function getMarkupRules() {
  try {
    const raw = await kvCommand('GET', 'flyboro:markup_rules');
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { ...DEFAULT_MARKUP_RULES, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load markup rules from KV, using defaults:', err.message);
  }
  return { ...DEFAULT_MARKUP_RULES };
}

/**
 * Save updated markup rules to persistent storage
 */
export async function saveMarkupRules(rules) {
  try {
    await kvCommand('SET', 'flyboro:markup_rules', JSON.stringify(rules));
    return true;
  } catch (err) {
    console.warn('Failed to save markup rules to KV:', err.message);
    return false;
  }
}

/**
 * Calculate markup on a base wholesale supplier fare
 * 
 * @param {number|string} supplierPrice - Wholesale supplier rate
 * @param {string} productType - 'flights' | 'hotels' | 'cars' | 'jets' | 'vacations'
 * @param {object} rules - Loaded markup rules map
 * @returns {object} { supplierPrice, markupAmount, customerPrice, marginPercent, ruleApplied }
 */
export function applyMarkup(supplierPrice, productType = 'flights', rules = DEFAULT_MARKUP_RULES) {
  const numPrice = parseFloat(supplierPrice) || 0;
  const rule = rules[productType] || rules.flights || { active: false, value: 0 };

  if (!rule.active || numPrice <= 0) {
    return {
      supplierPrice: numPrice,
      markupAmount: 0,
      customerPrice: numPrice,
      marginPercent: 0,
      ruleApplied: null
    };
  }

  let markupAmount = 0;
  if (rule.type === 'percentage') {
    markupAmount = parseFloat(((numPrice * rule.value) / 100).toFixed(2));
  } else {
    markupAmount = parseFloat(Number(rule.value || 0).toFixed(2));
  }

  const customerPrice = parseFloat((numPrice + markupAmount).toFixed(2));
  const marginPercent = customerPrice > 0 ? parseFloat(((markupAmount / customerPrice) * 100).toFixed(1)) : 0;

  return {
    supplierPrice: numPrice,
    markupAmount,
    customerPrice,
    marginPercent,
    ruleApplied: {
      product: productType,
      type: rule.type,
      value: rule.value
    }
  };
}
