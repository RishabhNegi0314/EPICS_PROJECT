require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { admin, db } = require('./firebase'); // yaha rakho

const app = express();
app.use(cors());
app.use(express.json()); // ab yaha sahi jagah hai


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
    folder: 'epics-issues',          // Cloudinary folder name
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});

const upload = multer({ storage });

// Simple test route
app.get('/', (req, res) => {
  res.send('EPICS Phase 1 backend running ✅');
});

// ---------- Upload API ----------
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file found',
      });
    }

    // Text fields: description, latitude, longitude
    const { description, latitude, longitude } = req.body;

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

    // Firestore me document create karo
    const reportData = {
      imageUrl,
      publicId,
      description: description || '',
      location,
      status: 'pending', // default
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('reports').add(reportData);

    return res.json({
      success: true,
      message: 'Image + report saved successfully',
      reportId: docRef.id,
      imageUrl,
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

    const reports = snapshot.docs.map(doc => ({
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
