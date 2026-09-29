/**
 * Flyboro Persistent Storage Client (Vercel KV / Upstash Redis)
 * 
 * Works with:
 * - Vercel KV: KV_REST_API_URL, KV_REST_API_TOKEN
 * - Upstash Redis: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * 
 * Provides automated in-memory fallback when credentials are not configured,
 * ensuring zero crashes and seamless local development.
 */

// In-memory fallback cache for local dev / unconfigured environments
const memoryStore = new Map();

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token, isConfigured: Boolean(url && token) };
}

/**
 * Execute Upstash / Vercel KV REST command
 */
export async function kvCommand(command, ...args) {
  const { url, token, isConfigured } = getRedisConfig();

  if (!isConfigured) {
    // Memory fallback handler
    const cmd = command.toLowerCase();
    if (cmd === 'get') {
      const key = args[0];
      return memoryStore.get(key) || null;
    }
    if (cmd === 'set') {
      const [key, value] = args;
      memoryStore.set(key, value);
      return 'OK';
    }
    if (cmd === 'del') {
      const [key] = args;
      memoryStore.delete(key);
      return 1;
    }
    if (cmd === 'lpush') {
      const [key, val] = args;
      const list = memoryStore.get(key) || [];
      list.unshift(val);
      memoryStore.set(key, list);
      return list.length;
    }
    if (cmd === 'lrange') {
      const [key, start = 0, stop = -1] = args;
      const list = memoryStore.get(key) || [];
      return stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
    }
    return null;
  }

  // REST API request to Upstash / Vercel KV
  try {
    const res = await fetch(`${url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args])
    });

    if (!res.ok) {
      console.warn(`KV REST Error: ${res.status} ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    return json.result;
  } catch (err) {
    console.warn('KV REST Network error:', err.message);
    return null;
  }
}

/**
 * Save booking record to persistent storage
 */
export async function saveBooking(pnr, bookingData) {
  if (!pnr || !bookingData) return false;
  const formattedPNR = pnr.toUpperCase();
  const key = `flyboro:booking:${formattedPNR}`;

  try {
    const serialized = typeof bookingData === 'string' ? bookingData : JSON.stringify(bookingData);
    await kvCommand('SET', key, serialized);
    // Index PNR for admin / list lookups
    await kvCommand('LPUSH', 'flyboro:pnrs', formattedPNR);
    return true;
  } catch (err) {
    console.warn(`Failed to save booking ${formattedPNR}:`, err.message);
    return false;
  }
}

/**
 * Retrieve booking record from persistent storage
 */
export async function getBooking(pnr) {
  if (!pnr) return null;
  const formattedPNR = pnr.toUpperCase();
  const key = `flyboro:booking:${formattedPNR}`;

  try {
    const result = await kvCommand('GET', key);
    if (!result) return null;
    return typeof result === 'string' ? JSON.parse(result) : result;
  } catch (err) {
    console.warn(`Failed to fetch booking ${formattedPNR}:`, err.message);
    return null;
  }
}

/**
 * Update an existing booking record (e.g. status change to CANCELLED)
 */
export async function updateBooking(pnr, updates) {
  if (!pnr) return null;
  const formattedPNR = pnr.toUpperCase();
  try {
    const existing = await getBooking(formattedPNR);
    const merged = {
      ...(existing || {}),
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await saveBooking(formattedPNR, merged);
    return merged;
  } catch (err) {
    console.warn(`Failed to update booking ${formattedPNR}:`, err.message);
    return null;
  }
}

/**
 * List recent booking PNRs from index
 */
export async function listRecentBookings(limit = 20) {
  try {
    const pnrs = await kvCommand('LRANGE', 'flyboro:pnrs', 0, limit - 1);
    if (!Array.isArray(pnrs) || pnrs.length === 0) return [];
    
    // Deduplicate PNRs
    const unique = [...new Set(pnrs)];
    const records = await Promise.all(unique.map(pnr => getBooking(pnr)));
    return records.filter(Boolean);
  } catch (err) {
    console.warn('Failed to list bookings:', err.message);
    return [];
  }
}
