// duplicate.js (robust version)

function distanceInMeters(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// count set bits in BigInt (Brian Kernighan)
function popcountBigInt(x) {
  let count = 0n;
  while (x) {
    x &= x - 1n;
    count++;
  }
  return Number(count);
}

// hamming distance for hex strings (works for 16-hex char hashes or similar)
function hammingDistanceHex(hexA, hexB) {
  if (!hexA || !hexB) return Infinity;
  try {
    // normalize: remove 0x if present
    const a = BigInt('0x' + hexA.replace(/^0x/, ''));
    const b = BigInt('0x' + hexB.replace(/^0x/, ''));
    const x = a ^ b;
    return popcountBigInt(x);
  } catch (e) {
    return Infinity;
  }
}

/**
 * checkDuplicate(db, latitude, longitude, imageHash)
 * - db: firestore db
 * - latitude, longitude: numbers (may be null)
 * - imageHash: optional hex string (may be null)
 *
 * Returns: { isDuplicate: boolean, duplicateOf: docId|null, reason: 'location'|'image'|'both'|null }
 */
async function checkDuplicate(db, latitude, longitude, imageHash) {
  const snapshot = await db.collection('reports').get();

  // Tweak these thresholds if needed:
  const IMAGE_HAMMING_THRESHOLD = 8; // <=8 bits different -> similar
  const LOCATION_RADIUS_METERS = 50; // within 50m considered same spot

  const haveLatLng = (typeof latitude === 'number' && typeof longitude === 'number');

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // helper to safely pull lat/lng from Firestore GeoPoint or legacy objects
    const docLat = data.location && (data.location.latitude ?? data.location._latitude ?? data.location._lat);
    const docLng = data.location && (data.location.longitude ?? data.location._longitude ?? data.location._long ?? data.location._lng);

    const docHasLocation = (typeof docLat === 'number' && typeof docLng === 'number');

    // If both have location -> check distance first
    if (haveLatLng && docHasLocation) {
      const dist = distanceInMeters(latitude, longitude, docLat, docLng);

      // Candidate by location
      if (dist <= LOCATION_RADIUS_METERS) {
        // If both have imageHash -> require both image similarity + location proximity
        if (imageHash && data.imageHash) {
          const ham = hammingDistanceHex(imageHash, data.imageHash);

          // debug log
          console.log(`[dup-check] candidate doc=${doc.id} dist=${Math.round(dist)}m ham=${ham}`);

          if (ham <= IMAGE_HAMMING_THRESHOLD) {
            return { isDuplicate: true, duplicateOf: doc.id, reason: 'both' };
          } else {
            // same location but image different => NOT duplicate
            continue;
          }
        } else {
          // one side has no hash -> treat as duplicate by location only
          console.log(`[dup-check] candidate doc=${doc.id} dist=${Math.round(dist)}m (no-hash) => duplicate by location`);
          return { isDuplicate: true, duplicateOf: doc.id, reason: 'location' };
        }
      } // else not in radius -> continue
    } else {
      // If no location provided by uploader (or doc), optionally check image-only duplicates
      if (imageHash && data.imageHash) {
        const ham = hammingDistanceHex(imageHash, data.imageHash);
        console.log(`[dup-check] image-only compare doc=${doc.id} ham=${ham}`);
        if (ham <= IMAGE_HAMMING_THRESHOLD) {
          return { isDuplicate: true, duplicateOf: doc.id, reason: 'image' };
        }
      }
    }
  }

  return { isDuplicate: false, duplicateOf: null, reason: null };
}

module.exports = checkDuplicate;
