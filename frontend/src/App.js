// src/App.js

import React, { useState } from 'react';

const BACKEND_URL = 'http://localhost:5000'; // tumhara Node server

function App() {
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // ---------- Image change ----------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview('');
    }
  };

  // ---------- Use current location ----------
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported in this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
      },
      (err) => {
        console.error(err);
        alert('Location permission deny ho gaya ya error aaya');
      }
    );
  };

  // ---------- Submit form (upload + save to Firestore) ----------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!imageFile) {
      alert('Please select an image first');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('description', description);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);

      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Upload failed');
      }

      setMessage('Report submitted successfully 🎉');
      // Form reset
      setImageFile(null);
      setPreview('');
      setDescription('');
      setLatitude('');
      setLongitude('');
    } catch (err) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Admin: fetch all reports ----------
  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await fetch(`${BACKEND_URL}/reports`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load reports');
      }

      setReports(data.reports);
    } catch (err) {
      console.error(err);
      alert('Error loading reports: ' + err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  const formatDate = (ts) => {
  if (!ts) return '-';

  // Firestore Timestamp admin SDK -> {_seconds, _nanoseconds}
  const seconds = ts.seconds ?? ts._seconds;
  if (!seconds) return '-';

  return new Date(seconds * 1000).toLocaleString();
};


  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h1>EPICS – Issue Reporting (Phase 1)</h1>

      {/* ---------- User Form ---------- */}
      <section style={{ marginBottom: 40 }}>
        <h2>Create Report</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label>
              Image:
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
                style={{ display: 'block', marginTop: 5 }}
              />
            </label>
          </div>

          {preview && (
            <div style={{ marginBottom: 10 }}>
              <p>Preview:</p>
              <img
                src={preview}
                alt="preview"
                style={{ maxWidth: '100%', maxHeight: 300, border: '1px solid #ccc' }}
              />
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label>
              Description:
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ display: 'block', width: '100%', marginTop: 5 }}
                placeholder="Describe the issue..."
              />
            </label>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', marginBottom: 5 }}>Location (latitude, longitude):</label>
            <input
              type="text"
              placeholder="Latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              style={{ marginRight: 10 }}
            />
            <input
              type="text"
              placeholder="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
            <button type="button" onClick={handleUseLocation} style={{ marginLeft: 10 }}>
              Use my location
            </button>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>

        {message && <p style={{ marginTop: 10 }}>{message}</p>}
      </section>

      {/* ---------- Admin Section ---------- */}
      <section>
        <h2>Admin – All Reports</h2>
        <button onClick={fetchReports} disabled={loadingReports}>
          {loadingReports ? 'Loading...' : 'Load Reports'}
        </button>

        <div style={{ marginTop: 20 }}>
          {reports.length === 0 ? (
            <p>No reports loaded yet.</p>
          ) : (
            <table
              border="1"
              cellPadding="8"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
            >
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.imageUrl ? (
                        <img
                          src={r.imageUrl}
                          alt="report"
                          style={{ width: 80, height: 80, objectFit: 'cover' }}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{r.description || '—'}</td>
                    <td>
                      {r.location
                        ? (() => {
                          const lat = r.location.latitude ?? r.location._latitude;
                          const lng = r.location.longitude ?? r.location._longitude;

                          if (lat === undefined || lng === undefined) return '—';

                          const latVal = typeof lat === 'number' ? lat : Number(lat);
                          const lngVal = typeof lng === 'number' ? lng : Number(lng);

                          return `${latVal.toFixed(4)}, ${lngVal.toFixed(4)}`;
                        })()
                        : '-'}
                    </td>
                    <td>{r.status || 'pending'}</td>
                    <td>{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
