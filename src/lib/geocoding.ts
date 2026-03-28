// Geocodes a Dutch postal code using OpenStreetMap Nominatim API
// Returns { lat, lng } or null
export async function geocodePostalCode(postalCode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const formatted = formatPostalCode(postalCode);
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(formatted)}&country=NL&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TNT-Dashboard/1.0',
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// Haversine distance in km between two lat/lng points
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Formats a Dutch postal code to "1234 AB" format
export function formatPostalCode(pc: string): string {
  const cleaned = pc.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length >= 6) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)}`;
  }
  return cleaned;
}
