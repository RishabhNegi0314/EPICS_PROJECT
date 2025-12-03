// server.js (phase1-backend)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const { admin, db } = require('./firebase');
const autoCategorize = require('./categorize');
const checkDuplicate = require('./duplicate');
const getSeverity = require('./severity');

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

// ---------- Upload API + Firestore + Category + Severity + Duplicate ----------
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file found',
      });
    }

    // Text fields: description, latitude, longitude, name, phone
    const { description, latitude, longitude, name, phone } = req.body;

    const imageUrl = req.file.path;      // Cloudinary URL
    const publicId = req.file.filename;  // Cloudinary public_id

    // Location object (optional)
    let location = null;
    if (latitude && longitude) {
      location = new admin.firestore.GeoPoint(
        parseFloat(latitude),
        parseFloat(longitude)
      );
    }

    // 1) Duplicate detection (only if location present)
    let duplicateResult = { isDuplicate: false, duplicateOf: null };
    if (latitude && longitude) {
      duplicateResult = await checkDuplicate(
        db,
        parseFloat(latitude),
        parseFloat(longitude)
      );
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
      // fallback values: category = 'other', severity = 'mild'
    }

    // 3) Firestore document
    const reportData = {
      imageUrl,
      publicId,
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
