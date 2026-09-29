/**
 * Flyboro Currency & Formatting Utility
 * Handles rate conversions and localized price formatting.
 */

export const CURRENCY_RATES = {
  USD: { code: 'USD', symbol: '$', rate: 1.0, locale: 'en-US' },
  INR: { code: 'INR', symbol: '₹', rate: 83.5, locale: 'en-IN' },
  EUR: { code: 'EUR', symbol: '€', rate: 0.92, locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', rate: 0.78, locale: 'en-GB' },
  AED: { code: 'AED', symbol: 'د.إ', rate: 3.67, locale: 'ar-AE' }
};

/**
 * Converts a base USD price to the target currency and formats it with appropriate symbols.
 * @param {number} amountInUSD - The base price in USD.
 * @param {string} targetCurrency - ISO currency code ('USD', 'INR', 'EUR', 'GBP', 'AED').
 * @returns {string} Formatted currency string (e.g., "$450.00" or "₹37,575").
 */
export function formatCurrency(amountInUSD, targetCurrency = 'USD') {
  const currencyCode = (targetCurrency || 'USD').toUpperCase();
  const currencyConfig = CURRENCY_RATES[currencyCode] || CURRENCY_RATES.USD;
  const convertedAmount = Number(amountInUSD || 0) * currencyConfig.rate;

  return new Intl.NumberFormat(currencyConfig.locale, {
    style: 'currency',
    currency: currencyConfig.code,
    maximumFractionDigits: currencyCode === 'INR' || currencyCode === 'AED' ? 0 : 2
  }).format(convertedAmount);
}
