// src/App.js
import React, { useState } from 'react';
import './App.css';

const BACKEND_URL = 'http://localhost:5000';

// ---------- PURE PRESENTATIONAL COMPONENTS ----------

function UserHome({ onReportClick, onAdminClick }) {
  return (
    <div className="screen">
      <h1 className="app-title">EPICS Issue Reporter</h1>
      <p className="subtitle">
        Quickly report issues like potholes, garbage, water leaks, and more.
      </p>

      <button className="btn primary full" onClick={onReportClick}>
        Report an Issue
      </button>

      <div className="divider" />

      <button className="btn ghost full" onClick={onAdminClick}>
        Admin Login
      </button>
    </div>
  );
}

function UserForm({
  name,
  phone,
  description,
  preview,
  loading,
  latitude,
  longitude,
  onChangeName,
  onChangePhone,
  onChangeDescription,
  onImageChange,
  onSubmit,
  onBack,
}) {
  // nice formatted location text
  let locationText = 'Detecting location… (allow browser permission)';
  if (!latitude && !longitude) {
    locationText = 'Location will be detected automatically after selecting image.';
  } else if (latitude && longitude) {
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    const latStr = !Number.isNaN(latNum) ? latNum.toFixed(4) : latitude;
    const lngStr = !Number.isNaN(lngNum) ? lngNum.toFixed(4) : longitude;
    locationText = `Detected location: ${latStr}, ${lngStr}`;
  }

  return (
    <div className="screen">
      <h2 className="section-title">Report an Issue</h2>

      <form className="card form-card" onSubmit={onSubmit}>
        <label className="field-label">
          Name <span className="required">*</span>
        </label>
        <input
          className="input"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={onChangeName}
        />

        <label className="field-label">
          Mobile Number <span className="required">*</span>
        </label>
        <input
          className="input"
          type="tel"
          placeholder="10-digits mob. no"
          value={phone}
          onChange={onChangePhone}
        />

        <label className="field-label">
          Issue Photo <span className="required">*</span>
        </label>
        <input
          className="input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onImageChange}
        />
        <small className="hint">
          You can click a new photo or choose from gallery.
        </small>

        {preview && (
          <img src={preview} alt="preview" className="preview-image" />
        )}

        {/* 🔹 NEW: location info instead of button */}
        <p className="hint" style={{ marginTop: 4 }}>
          {locationText}
        </p>

        <label className="field-label">Describe the Issue</label>
        <textarea
          className="textarea"
          rows={3}
          placeholder="E.g. Big pothole near main gate, water filled…"
          value={description}
          onChange={onChangeDescription}
        />

        <button
          type="submit"
          className="btn primary full"
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      <button className="btn ghost full mt-12" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}

function Submitted({ isDuplicate, onReportAnother, onGoHome }) {
  return (
    <div className="screen">
      <h2 className="section-title">Thank you!</h2>
      <p className="subtitle center">
        {isDuplicate
          ? 'A similar report already exists nearby. Your help is still appreciated!'
          : 'Your report has been submitted successfully.'}
      </p>

      <button className="btn primary full" onClick={onReportAnother}>
        Report Another Issue
      </button>

      <button className="btn ghost full mt-12" onClick={onGoHome}>
        Go Back to Home
      </button>
    </div>
  );
}

function AdminLogin({
  adminUser,
  adminPass,
  onChangeUser,
  onChangePass,
  onSubmit,
  onBack,
}) {
  return (
    <div className="screen">
      <h2 className="section-title">Admin Login</h2>

      <form className="card form-card" onSubmit={onSubmit}>
        <label className="field-label">Username</label>
        <input
          className="input"
          value={adminUser}
          onChange={onChangeUser}
        />

        <label className="field-label">Password</label>
        <input
          className="input"
          type="password"
          value={adminPass}
          onChange={onChangePass}
        />

        <button className="btn primary full" type="submit">
          Login
        </button>
      </form>

      <button className="btn ghost full mt-12" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}

function AdminDashboard({
  reports,
  loadingReports,
  onRefresh,
  onLogout,
}) {
  const formatDate = (ts) => {
    if (!ts) return '-';
    const seconds = ts.seconds ?? ts._seconds;
    if (!seconds) return '-';
    return new Date(seconds * 1000).toLocaleString();
  };

  const formatLocation = (loc) => {
    if (!loc) return '—';

    const lat = loc.latitude ?? loc._latitude;
    const lng = loc.longitude ?? loc._longitude;
    if (lat == null || lng == null) return '—';

    const latNum = typeof lat === 'number' ? lat : parseFloat(lat);
    const lngNum = typeof lng === 'number' ? lng : parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return '—';

    return `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`;
  };

  return (
    <div className="screen">
      <h2 className="section-title">Admin Dashboard</h2>

      <div className="toolbar">
        <button
          className="btn secondary"
          onClick={onRefresh}
          disabled={loadingReports}
        >
          {loadingReports ? 'Refreshing...' : 'Refresh Reports'}
        </button>

        <button className="btn ghost" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="card list-card">
        {reports.length === 0 ? (
          <p className="subtitle center">No reports yet.</p>
        ) : (
          <div className="report-list">
            {reports.map((r) => (
              <div className="report-item" key={r.id}>
                <div className="report-header">
                  <span
                    className={`status-pill status-${r.status || 'pending'}`}
                  >
                    {r.status || 'pending'}
                  </span>
                  {r.category && <span className="tag">{r.category}</span>}
                  {r.severity && (
                    <span className={`severity severity-${r.severity}`}>
                      {r.severity}
                    </span>
                  )}
                </div>

                {r.imageUrl && (
                  <img
                    src={r.imageUrl}
                    alt="issue"
                    className="report-image"
                  />
                )}

                <div className="report-body">
                  <p className="report-desc">
                    {r.description || 'No description'}
                  </p>

                  <p className="meta">
                    <strong>User:</strong> {r.userName || r.username || '—'}
                  </p>
                  <p className="meta">
                    <strong>Phone:</strong> {r.phone || '—'}
                  </p>
                  <p className="meta">
                    <strong>Location:</strong> {formatLocation(r.location)}
                  </p>
                  <p className="meta">
                    <strong>Created:</strong> {formatDate(r.createdAt)}
                  </p>
                  {r.isDuplicate && r.duplicateOf && (
                    <p className="meta duplicate">
                      Duplicate of: {r.duplicateOf}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- MAIN APP COMPONENT ----------

function App() {
  // screen: userHome | userForm | submitted | adminLogin | adminDashboard
  const [screen, setScreen] = useState('userHome');

  // user form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // system states
  const [loading, setLoading] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);

  // admin states
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // ------------ USER PORTAL LOGIC ------------

  const openUserForm = () => {
    setScreen('userForm');
  };

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
        alert('Location permission denied or error occurred');
      }
    );
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);

    if (file) {
      setPreview(URL.createObjectURL(file));
      // image choose hote hi location try karo
      handleUseLocation();
    } else {
      setPreview('');
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setDescription('');
    setImageFile(null);
    setPreview('');
    setLatitude('');
    setLongitude('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !phone || !imageFile) {
      alert('Name, Mobile aur Image required hain.');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('description', description);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('name', name);  // backend expects 'name'
      formData.append('phone', phone);

      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Upload failed');
      }

      const duplicateFlag =
        (data.duplicate && data.duplicate.isDuplicate) ||
        data.status === 'duplicate';

      setIsDuplicate(duplicateFlag);

      if (duplicateFlag) {
        setPopupMessage('Report already exists nearby. Thank you!');
      } else {
        setPopupMessage('Report submitted successfully 🎉');
      }

      setPopupOpen(true);
      setScreen('submitted');
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ------------ ADMIN PORTAL LOGIC ------------

  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'admin123';

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUser === ADMIN_USERNAME && adminPass === ADMIN_PASSWORD) {
      setAdminAuthed(true);
      setScreen('adminDashboard');
      fetchReports();
    } else {
      alert('Invalid admin credentials');
    }
  };

  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await fetch(`${BACKEND_URL}/reports`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load reports');
      }

      setReports(data.reports || []);
    } catch (err) {
      console.error(err);
      alert('Error loading reports: ' + err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  // ------------ MAIN RENDER ------------

  return (
    <div className="app-root">
      {screen === 'userHome' && (
        <UserHome
          onReportClick={openUserForm}
          onAdminClick={() => setScreen('adminLogin')}
        />
      )}

      {screen === 'userForm' && (
        <UserForm
          name={name}
          phone={phone}
          description={description}
          preview={preview}
          loading={loading}
          latitude={latitude}
          longitude={longitude}
          onChangeName={(e) => setName(e.target.value)}
          onChangePhone={(e) => setPhone(e.target.value)}
          onChangeDescription={(e) => setDescription(e.target.value)}
          onImageChange={handleImageChange}
          onSubmit={handleSubmit}
          onBack={() => setScreen('userHome')}
        />
      )}

      {screen === 'submitted' && (
        <Submitted
          isDuplicate={isDuplicate}
          onReportAnother={() => {
            setPopupOpen(false);
            setScreen('userForm');
          }}
          onGoHome={() => {
            setPopupOpen(false);
            setScreen('userHome');
          }}
        />
      )}

      {screen === 'adminLogin' && (
        <AdminLogin
          adminUser={adminUser}
          adminPass={adminPass}
          onChangeUser={(e) => setAdminUser(e.target.value)}
          onChangePass={(e) => setAdminPass(e.target.value)}
          onSubmit={handleAdminLogin}
          onBack={() => setScreen('userHome')}
        />
      )}

      {screen === 'adminDashboard' && adminAuthed && (
        <AdminDashboard
          reports={reports}
          loadingReports={loadingReports}
          onRefresh={fetchReports}
          onLogout={() => {
            setAdminAuthed(false);
            setScreen('userHome');
          }}
        />
      )}

      {/* Popup overlay */}
      {popupOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="modal-message">{popupMessage}</p>
            <button
              className="btn primary full"
              onClick={() => {
                setPopupOpen(false);
                setScreen('userForm');
              }}
            >
              Report Another Issue
            </button>
            <button
              className="btn ghost full mt-12"
              onClick={() => {
                setPopupOpen(false);
                setScreen('userHome');
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
