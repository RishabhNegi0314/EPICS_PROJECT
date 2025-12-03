// Haversine formula
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

// Main duplicate checker
async function checkDuplicate(db, latitude, longitude) {
  const snapshot = await db.collection("reports").get();

  for (let doc of snapshot.docs) {
    const data = doc.data();
    if (!data.location) continue;

    const dist = distanceInMeters(
      latitude,
      longitude,
      data.location.latitude,
      data.location.longitude
    );

    if (dist < 50) {
      return { isDuplicate: true, duplicateOf: doc.id };
    }
  }

  return { isDuplicate: false };
}

module.exports = checkDuplicate;
