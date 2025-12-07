// server.js (phase1-backend) — image-hash duplicate check integrated

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const { admin, db } = require('./firebase');
const autoCategorize = require('./categorize');
const checkDuplicate = require('./duplicate'); // existing location-only checker
const getSeverity = require('./severity');
const { computeImageHash } = require('./imageHash'); // must exist and return hex string

const app = express();
app.use(cors());
app.use(express.json()); // JSON body parser

// ---------- Cloudinary Config ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Multer + Cloudinary Storage ----------
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'epics-issues', // Cloudinary folder name
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});

const upload = multer({ storage });

// Simple test route
app.get('/', (req, res) => {
  res.send('EPICS backend running ✅');
});

// ---- helpers for image-hash & distance ----
function hexToBinary(hex) {
  return hex.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
}
function hammingDistanceHex(h1, h2) {
  // Accepts two hex strings of same length
  const b1 = hexToBinary(h1);
  const b2 = hexToBinary(h2);
  if (b1.length !== b2.length) return Infinity;
  let d = 0;
  for (let i = 0; i < b1.length; i++) if (b1[i] !== b2[i]) d++;
  return d;
}
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

// ---------- Upload API + Firestore + Category + Severity + Duplicate ----------
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file found' });
    }

    // Text fields: description, latitude, longitude, name, phone
    // NOTE: frontend is sending field name 'name' in FormData
    const { description, latitude, longitude, name, phone } = req.body;

    const imageUrl = req.file.path;      // Cloudinary URL
    const publicId = req.file.filename;  // Cloudinary public_id

    // Location object (optional) — parse to numbers if provided
    let location = null;
    let latNum = null, lonNum = null;
    if (latitude && longitude) {
      latNum = parseFloat(latitude);
      lonNum = parseFloat(longitude);
      if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
        location = new admin.firestore.GeoPoint(latNum, lonNum);
      } else {
        latNum = lonNum = null;
      }
    }


    // 1) Compute image hash for the new upload (so we can pass it to duplicate checker)
    let imageHash = null;
    try {
      imageHash = await computeImageHash(imageUrl);
      if (typeof imageHash !== 'string' || imageHash.length === 0) imageHash = null;
    } catch (err) {
      console.error('Error computing image hash:', err);
      imageHash = null;
    }

    console.log('[upload] latNum,lonNum =>', latNum, lonNum);
    console.log('[upload] computed imageHash =>', imageHash);


    // 2) Duplicate detection (combined): pass imageHash if available
    let duplicateResult = { isDuplicate: false, duplicateOf: null, reason: null };
    try {
      duplicateResult = await checkDuplicate(db, latNum, lonNum, imageHash);
      console.log('[upload] duplicateResult =>', duplicateResult);
    } catch (err) {
      console.error('Error in checkDuplicate:', err);
    }


    // If not duplicate by location, try image-similarity duplicate check:
    // We only compare with existing docs that already have imageHash saved (we won't update old docs).
    if (!duplicateResult.isDuplicate && imageHash) {
      try {
        const snap = await db.collection('reports').get();
        const HAMMING_THRESHOLD = 8; // tweakable: lower => stricter, higher => more tolerant
        const DISTANCE_THRESHOLD_METERS = 100; // locality check (tweak as needed)

        for (const doc of snap.docs) {
          const d = doc.data();

          // need both an existing imageHash and a location on that doc to compare robustly
          if (!d.imageHash || !d.location) continue;

          // compute hamming distance
          try {
            const otherHash = d.imageHash;
            const distBits = hammingDistanceHex(imageHash, otherHash);
            if (distBits <= HAMMING_THRESHOLD) {
              // if uploader provided location, also ensure proximity (otherwise image-only match may be broad)
              if (latNum != null && lonNum != null) {
                const distMeters = distanceInMeters(latNum, lonNum, d.location.latitude, d.location.longitude);
                if (distMeters <= DISTANCE_THRESHOLD_METERS) {
                  duplicateResult = { isDuplicate: true, duplicateOf: doc.id, reason: 'image+location' };
                  break;
                }
              } else {
                // If no location provided from user, mark duplicate by image alone (optional)
                duplicateResult = { isDuplicate: true, duplicateOf: doc.id, reason: 'image' };
                break;
              }
            }
          } catch (hdErr) {
            // ignore malformed hashes
            continue;
          }
        }
      } catch (e) {
        console.error('Error during image-similarity duplicate scan:', e);
      }
    }

    // 2) Auto categorization + severity
    let category = 'other';
    let severity = 'mild';
    try {
      category = await autoCategorize(imageUrl);
      console.log('Predicted Category =>', category);

      severity = await getSeverity(imageUrl, category);
      console.log('Predicted Severity =>', severity);
    } catch (mlErr) {
      console.error('Error in ML (category/severity):', mlErr.message);
      // fallback values
    }

    // 3) Firestore document (do NOT update older documents)
    const reportData = {
      imageUrl,
      publicId,
      imageHash: imageHash || null,      // save hash for future comparisons
      description: description || '',
      location,

      // 🔹 User info
      userName: name || '',
      phone: phone || '',

      // 🔹 Duplicate flags
      status: duplicateResult.isDuplicate ? 'duplicate' : 'pending',
      isDuplicate: duplicateResult.isDuplicate,
      duplicateOf: duplicateResult.duplicateOf || null,

      // 🔹 Category + Severity
      category: category || 'other',
      severity: severity || 'mild',

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('reports').add(reportData);

    return res.json({
      success: true,
      message: 'Image + report saved successfully',
      reportId: docRef.id,
      imageUrl,
      category,
      severity,
      status: reportData.status,
      duplicate: duplicateResult,
    });
  } catch (error) {
    console.error('Error in /upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
});

// --------- Get All Reports (for admin) ---------
app.get('/reports', async (req, res) => {
  try {
    const snapshot = await db
      .collection('reports')
      .orderBy('createdAt', 'desc')
      .get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error('Error in /reports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message,
    });
  }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
