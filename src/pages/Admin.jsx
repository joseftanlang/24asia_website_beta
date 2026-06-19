import { useEffect, useMemo, useRef, useState } from 'react';
import {
  arrayUnion, collection, doc, getDocs, limit, query, updateDoc, where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';
import { cachedQuery, invalidate } from '../lib/cache';
import ManageEvents from '../components/ManageEvents';
import * as XLSX from 'xlsx';

const TABS = ['Users', 'Manage events', 'Students', 'Volunteers', 'Certificates', 'Maintenance'];

// Departments List
const DEPARTMENTS = [
  'Social Media',
  'Information Technology',
  'Events',
  'Training',
  'Graphic',
  'Photography',
  'Human Resource & Admin',
  'Finance',
  'Board of Director',
  'Management',
  'Student'
];

// Titles List
const TITLES = [
  'Student',
  'President',
  'Founder',
  'Vice-president',
  'Team Lead',
  'Assistant Team Lead',
  'Social Media volunteer',
  'Information Technology volunteer',
  'Events volunteer',
  'Training volunteer',
  'Graphic volunteer',
  'Photography volunteer',
  'Human Resource & Admin volunteer',
  'Finance volunteer',
  'Ambassador',
  'Advisor',
  'Patron'
];

export default function Admin() {
  const [tab, setTab] = useState('Users');
  return (
    <>
      <h3 className="mb-3">Admin</h3>
      <ul className="nav nav-tabs mb-4">
        {TABS.map((t) => (
          <li className="nav-item" key={t}>
            <button className={`nav-link ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          </li>
        ))}
      </ul>
      {tab === 'Users' && <PendingUsers />}
      {tab === 'Manage events' && <ManageEvents />}
      {tab === 'Students' && <StudentsList />}
      {tab === 'Volunteers' && <VolunteersList />}
      {tab === 'Certificates' && <Certificates />}
      {tab === 'Maintenance' && <Maintenance />}
    </>
  );
}

/* ---------------- Users ---------------- */
function PendingUsers() {
  const [rows, setRows] = useState([]);
  const [grant, setGrant] = useState({});

  const load = () =>
    cachedQuery('admin:users:pending', async () => {
      const s2 = await getDocs(query(collection(db, 'users'), where('status', '==', 'pending')));
      return s2.docs.map((d) => ({ id: d.id, ...d.data() }));
    }).then(setRows);
  useEffect(() => { load(); }, []);

  const toggle = (uid, role) => setGrant((g) => {
    const set = new Set(g[uid] || []);
    if (set.has(role)) set.delete(role); else set.add(role);
    return { ...g, [uid]: set };
  });

  const approve = async (u) => {
    const roles = [...new Set([...(u.roles || []), ...(grant[u.id] || [])])];
    await updateDoc(doc(db, 'users', u.id), { status: 'approved', roles: roles.length ? roles : ['Volunteer'] });
    invalidate('admin:users');
    load();
  };

  const downloadExcel = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('status', '==', 'pending')));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      const excelData = data.map((u) => ({
        'User ID': u.id,
        'Name': u.name || '',
        'Email': u.email || '',
        'Phone': u.phone || '',
        'Roles': (u.roles || []).join(', '),
        'Status': u.status,
        'Created At': u.createdAt?.toDate?.()?.toLocaleString() || '',
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pending Users');
      XLSX.writeFile(wb, `pending_users_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error downloading Excel file');
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Pending members ({rows.length})</h5>
        <button className="btn btn-success btn-sm" onClick={downloadExcel}>
          📊 Download Excel
        </button>
      </div>
      {rows.length === 0 && <p className="text-secondary">No one is waiting for approval.</p>}
      <ul className="list-group">
        {rows.map((u) => (
          <li className="list-group-item" key={u.id}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <strong>{u.name || '(no name)'}</strong> <span className="text-secondary small">{u.email}</span>
                <div className="small">Requested: {(u.roles || []).join(', ') || '—'}</div>
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="form-check form-check-inline mb-0">
                  <input className="form-check-input" type="checkbox" id={`mgr-${u.id}`}
                    checked={grant[u.id]?.has('Manager') || false} onChange={() => toggle(u.id, 'Manager')} />
                  <label className="form-check-label small" htmlFor={`mgr-${u.id}`}>also Manager</label>
                </div>
                <button className="btn btn-sm btn-brand" onClick={() => approve(u)}>Approve</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------------- Students List ---------------- */
function StudentsList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [password, setPassword] = useState('');
  const [showUncensored, setShowUncensored] = useState(false);
  const [error, setError] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('status', '==', 'approved')
      ));
      const allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      const studentsList = allUsers.filter(u => {
        const roles = u.roles || [];
        if (Array.isArray(roles)) {
          return roles.includes('Student') || roles.length === 0;
        }
        if (typeof roles === 'string') {
          return roles === 'Student' || roles === '';
        }
        return true;
      });
      
      setStudents(studentsList);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStudents(); }, []);

  const handleUncensor = (student) => {
    if (password === '123456') {
      setSelectedStudent(student);
      setShowUncensored(true);
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleClose = () => {
    setSelectedStudent(null);
    setShowUncensored(false);
    setPassword('');
    setError('');
  };

  const downloadExcel = () => {
    try {
      const excelData = students.map((u) => ({
        'Name': u.name || '',
        'Email': u.email || '',
        'Phone': u.phone || '',
        'Roles': (u.roles || []).join(', '),
        'Status': u.status,
        'Volunteer Hours': u.totalHoursVolunteer || 0,
        'Training Hours': u.totalHoursStudent || 0,
        'Certificates': (u.certificates || []).length,
        'Date of Birth': u.dob || '',
        'Gender': u.gender || '',
        'Address': u.address || '',
        'Race': u.race || '',
        'Religion': u.religion || '',
        'Citizenship': u.citizenship || '',
        'Blood Type': u.bloodType || '',
        'Emergency Contact': u.emergencyName || '',
        'Emergency Number': u.emergencyContact || '',
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      XLSX.writeFile(wb, `students_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error downloading Excel file');
    }
  };

  const censorText = (text) => {
    if (!text) return '—';
    return '*'.repeat(text.length);
  };

  if (loading) {
    return <div className="text-center py-4"><div className="spinner-border text-danger" /></div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Students ({students.length})</h5>
        <button className="btn btn-success btn-sm" onClick={downloadExcel}>
          📊 Download Excel
        </button>
      </div>
      <p className="text-secondary small">Students are users with 'Student' role or no role assigned yet.</p>
      
      {students.length === 0 ? (
        <p className="text-secondary">No students found.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Roles</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '(no name)'}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{(u.roles || []).join(', ') || 'Student (default)'}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline-primary" 
                      onClick={() => setSelectedStudent(u)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Details Modal */}
      {selectedStudent && !showUncensored && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={handleClose}>
          <div style={{
            backgroundColor: 'var(--bs-card-bg, white)',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h5>Student Details</h5>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                onClick={handleClose}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p><strong>Name:</strong> {censorText(selectedStudent.name)}</p>
              <p><strong>Email:</strong> {censorText(selectedStudent.email)}</p>
              <p><strong>Phone:</strong> {censorText(selectedStudent.phone)}</p>
              <p><strong>Date of Birth:</strong> {censorText(selectedStudent.dob)}</p>
              <p><strong>Gender:</strong> {censorText(selectedStudent.gender)}</p>
              <p><strong>Address:</strong> {censorText(selectedStudent.address)}</p>
              <p><strong>Race:</strong> {censorText(selectedStudent.race)}</p>
              <p><strong>Religion:</strong> {censorText(selectedStudent.religion)}</p>
              <p><strong>Citizenship:</strong> {censorText(selectedStudent.citizenship)}</p>
              <p><strong>Blood Type:</strong> {censorText(selectedStudent.bloodType)}</p>
              <p><strong>Emergency Contact:</strong> {censorText(selectedStudent.emergencyName)}</p>
              <p><strong>Emergency Number:</strong> {censorText(selectedStudent.emergencyContact)}</p>
              <p><strong>Status:</strong> {selectedStudent.status}</p>
              <p><strong>Volunteer Hours:</strong> {selectedStudent.totalHoursVolunteer || 0}</p>
              <p><strong>Training Hours:</strong> {selectedStudent.totalHoursStudent || 0}</p>
              <p><strong>Certificates:</strong> {(selectedStudent.certificates || []).length}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--bs-border-color, #dee2e6)', paddingTop: '16px' }}>
              <label className="form-label">Enter password to view uncensored:</label>
              <div className="d-flex gap-2">
                <input 
                  type="password" 
                  className="form-control" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter 6-digit password"
                  maxLength="6"
                />
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleUncensor(selectedStudent)}
                >
                  Unlock
                </button>
              </div>
              {error && <div className="text-danger small mt-2">{error}</div>}
              <div className="text-secondary small mt-1">Default password: 123456</div>
            </div>
          </div>
        </div>
      )}

      {showUncensored && selectedStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={handleClose}>
          <div style={{
            backgroundColor: 'var(--bs-card-bg, white)',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h5 style={{ color: '#28a745' }}>🔓 Uncensored View</h5>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                onClick={handleClose}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p><strong>Name:</strong> {selectedStudent.name || '—'}</p>
              <p><strong>Email:</strong> {selectedStudent.email}</p>
              <p><strong>Phone:</strong> {selectedStudent.phone || '—'}</p>
              <p><strong>Date of Birth:</strong> {selectedStudent.dob || '—'}</p>
              <p><strong>Gender:</strong> {selectedStudent.gender || '—'}</p>
              <p><strong>Address:</strong> {selectedStudent.address || '—'}</p>
              <p><strong>Race:</strong> {selectedStudent.race || '—'}</p>
              <p><strong>Religion:</strong> {selectedStudent.religion || '—'}</p>
              <p><strong>Citizenship:</strong> {selectedStudent.citizenship || '—'}</p>
              <p><strong>Blood Type:</strong> {selectedStudent.bloodType || '—'}</p>
              <p><strong>Emergency Contact:</strong> {selectedStudent.emergencyName || '—'}</p>
              <p><strong>Emergency Number:</strong> {selectedStudent.emergencyContact || '—'}</p>
              <p><strong>Status:</strong> {selectedStudent.status}</p>
              <p><strong>Volunteer Hours:</strong> {selectedStudent.totalHoursVolunteer || 0}</p>
              <p><strong>Training Hours:</strong> {selectedStudent.totalHoursStudent || 0}</p>
              <p><strong>Certificates:</strong> {(selectedStudent.certificates || []).length}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--bs-border-color, #dee2e6)', paddingTop: '16px' }}>
              <button className="btn btn-secondary w-100" onClick={handleClose}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Volunteers List with Edit ---------------- */
function VolunteersList() {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [password, setPassword] = useState('');
  const [showUncensored, setShowUncensored] = useState(false);
  const [error, setError] = useState('');
  
  // Edit states
  const [editingVolunteer, setEditingVolunteer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  const loadVolunteers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('status', '==', 'approved')
      ));
      const allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      const volunteersList = allUsers.filter(u => {
        const roles = u.roles || [];
        if (Array.isArray(roles)) {
          return roles.includes('Volunteer') || roles.includes('Volunteer Leader') || roles.includes('Manager');
        }
        if (typeof roles === 'string') {
          return roles === 'Volunteer' || roles === 'Volunteer Leader' || roles === 'Manager';
        }
        return false;
      });
      
      setVolunteers(volunteersList);
    } catch (error) {
      console.error('Error loading volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVolunteers(); }, []);

  const handleUncensor = (volunteer) => {
    if (password === '123456') {
      setSelectedVolunteer(volunteer);
      setShowUncensored(true);
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleClose = () => {
    setSelectedVolunteer(null);
    setShowUncensored(false);
    setPassword('');
    setError('');
    setEditingVolunteer(null);
    setEditMessage('');
  };

  // Start editing a volunteer
  const startEditing = (volunteer) => {
    setEditingVolunteer(volunteer);
    setEditForm({
      name: volunteer.name || '',
      email: volunteer.email || '',
      phone: volunteer.phone || '',
      roles: volunteer.roles || [],
      vid: volunteer.vid || '',
      department: volunteer.department || '',
      title: volunteer.title || '',
      status: volunteer.status || 'approved',
      totalHoursVolunteer: volunteer.totalHoursVolunteer || 0,
      totalHoursStudent: volunteer.totalHoursStudent || 0,
    });
    setEditMessage('');
  };

  // Handle form input changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle role toggle in edit
  const toggleEditRole = (role) => {
    setEditForm(prev => ({
      ...prev,
      roles: prev.roles.includes(role) 
        ? prev.roles.filter(r => r !== role) 
        : [...prev.roles, role]
    }));
  };

  // Save edited volunteer
  const saveEdit = async () => {
    setEditLoading(true);
    setEditMessage('');
    try {
      const updates = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        roles: editForm.roles,
        vid: editForm.vid.trim(),
        department: editForm.department,
        title: editForm.title,
        status: editForm.status,
        totalHoursVolunteer: Number(editForm.totalHoursVolunteer) || 0,
        totalHoursStudent: Number(editForm.totalHoursStudent) || 0,
        lastUpdatedAt: new Date(),
      };
      
      await updateDoc(doc(db, 'users', editingVolunteer.id), updates);
      
      setEditMessage('✅ Volunteer updated successfully!');
      setEditLoading(false);
      
      // Refresh the list
      await loadVolunteers();
      
      // Close edit mode after 1.5 seconds
      setTimeout(() => {
        setEditingVolunteer(null);
        setEditMessage('');
      }, 1500);
    } catch (error) {
      console.error('Error updating volunteer:', error);
      setEditMessage('❌ Error updating volunteer: ' + error.message);
      setEditLoading(false);
    }
  };

  const downloadExcel = () => {
    try {
      const excelData = volunteers.map((u) => ({
        'Name': u.name || '',
        'Email': u.email || '',
        'Phone': u.phone || '',
        'Roles': (u.roles || []).join(', '),
        'VID': u.vid || 'Not assigned',
        'Department': u.department || 'Not assigned',
        'Title': u.title || 'Not assigned',
        'Status': u.status,
        'Volunteer Hours': u.totalHoursVolunteer || 0,
        'Training Hours': u.totalHoursStudent || 0,
        'Certificates': (u.certificates || []).length,
        'Date of Birth': u.dob || '',
        'Gender': u.gender || '',
        'Address': u.address || '',
        'Race': u.race || '',
        'Religion': u.religion || '',
        'Citizenship': u.citizenship || '',
        'Blood Type': u.bloodType || '',
        'Emergency Contact': u.emergencyName || '',
        'Emergency Number': u.emergencyContact || '',
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Volunteers');
      XLSX.writeFile(wb, `volunteers_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error downloading Excel file');
    }
  };

  const censorText = (text) => {
    if (!text) return '—';
    return '*'.repeat(text.length);
  };

  if (loading) {
    return <div className="text-center py-4"><div className="spinner-border text-danger" /></div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Volunteers ({volunteers.length})</h5>
        <button className="btn btn-success btn-sm" onClick={downloadExcel}>
          📊 Download Excel
        </button>
      </div>
      <p className="text-secondary small">Volunteers are users with 'Volunteer', 'Volunteer Leader', or 'Manager' roles.</p>
      
      {volunteers.length === 0 ? (
        <p className="text-secondary">No volunteers found.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Title</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {volunteers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '(no name)'}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td><span className="badge bg-info">{u.department || 'Not assigned'}</span></td>
                  <td><span className="badge bg-secondary">{u.title || 'Not assigned'}</span></td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline-primary me-1" 
                      onClick={() => setSelectedVolunteer(u)}
                    >
                      👁️ View
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-warning" 
                      onClick={() => startEditing(u)}
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Volunteer Modal */}
      {editingVolunteer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflowY: 'auto'
        }} onClick={() => {}}>
          <div style={{
            backgroundColor: 'var(--bs-card-bg, white)',
            borderRadius: '16px',
            maxWidth: '650px',
            width: '100%',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h5>✏️ Edit Volunteer</h5>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                onClick={() => {
                  setEditingVolunteer(null);
                  setEditMessage('');
                }}
              >
                ×
              </button>
            </div>

            {editMessage && (
              <div className={`alert ${editMessage.includes('✅') ? 'alert-success' : 'alert-danger'} py-2`}>
                {editMessage}
              </div>
            )}

            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="name"
                  value={editForm.name || ''} 
                  onChange={handleEditChange}
                />
              </div>

              <div className="col-12">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="form-control" 
                  name="email"
                  value={editForm.email || ''} 
                  onChange={handleEditChange}
                />
              </div>

              <div className="col-12">
                <label className="form-label">Phone</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="phone"
                  value={editForm.phone || ''} 
                  onChange={handleEditChange}
                />
              </div>

              <div className="col-12">
                <label className="form-label">VID (Volunteer ID) - 00001 to 99999</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="vid"
                  value={editForm.vid || ''} 
                  onChange={handleEditChange}
                  placeholder="Enter 5-digit number (e.g., 00001)"
                  maxLength="5"
                />
                <div className="text-secondary small">Leave blank to keep current or auto-generate</div>
              </div>

              <div className="col-6">
                <label className="form-label">Department</label>
                <select 
                  className="form-select" 
                  name="department"
                  value={editForm.department || ''} 
                  onChange={handleEditChange}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="col-6">
                <label className="form-label">Title</label>
                <select 
                  className="form-select" 
                  name="title"
                  value={editForm.title || ''} 
                  onChange={handleEditChange}
                >
                  <option value="">Select Title</option>
                  {TITLES.map((title) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">Roles</label>
                <div className="d-flex flex-wrap gap-2">
                  {['Volunteer', 'Volunteer Leader', 'Manager', 'Student'].map((role) => (
                    <div className="form-check form-check-inline" key={role}>
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id={`edit-role-${role}`}
                        checked={editForm.roles?.includes(role) || false} 
                        onChange={() => toggleEditRole(role)}
                      />
                      <label className="form-check-label" htmlFor={`edit-role-${role}`}>{role}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-6">
                <label className="form-label">Volunteer Hours</label>
                <input 
                  type="number" 
                  className="form-control" 
                  name="totalHoursVolunteer"
                  value={editForm.totalHoursVolunteer || 0} 
                  onChange={handleEditChange}
                  min="0"
                />
              </div>

              <div className="col-6">
                <label className="form-label">Training Hours</label>
                <input 
                  type="number" 
                  className="form-control" 
                  name="totalHoursStudent"
                  value={editForm.totalHoursStudent || 0} 
                  onChange={handleEditChange}
                  min="0"
                />
              </div>

              <div className="col-12">
                <label className="form-label">Account Status</label>
                <select 
                  className="form-select" 
                  name="status"
                  value={editForm.status || 'approved'} 
                  onChange={handleEditChange}
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setEditingVolunteer(null);
                  setEditMessage('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={saveEdit}
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedVolunteer && !showUncensored && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={handleClose}>
          <div style={{
            backgroundColor: 'var(--bs-card-bg, white)',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h5>Volunteer Details</h5>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                onClick={handleClose}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p><strong>Name:</strong> {censorText(selectedVolunteer.name)}</p>
              <p><strong>Email:</strong> {censorText(selectedVolunteer.email)}</p>
              <p><strong>Phone:</strong> {censorText(selectedVolunteer.phone)}</p>
              <p><strong>VID:</strong> {selectedVolunteer.vid || 'Not assigned'}</p>
              <p><strong>Department:</strong> {selectedVolunteer.department || 'Not assigned'}</p>
              <p><strong>Title:</strong> {selectedVolunteer.title || 'Not assigned'}</p>
              <p><strong>Date of Birth:</strong> {censorText(selectedVolunteer.dob)}</p>
              <p><strong>Gender:</strong> {censorText(selectedVolunteer.gender)}</p>
              <p><strong>Address:</strong> {censorText(selectedVolunteer.address)}</p>
              <p><strong>Race:</strong> {censorText(selectedVolunteer.race)}</p>
              <p><strong>Religion:</strong> {censorText(selectedVolunteer.religion)}</p>
              <p><strong>Citizenship:</strong> {censorText(selectedVolunteer.citizenship)}</p>
              <p><strong>Blood Type:</strong> {censorText(selectedVolunteer.bloodType)}</p>
              <p><strong>Emergency Contact:</strong> {censorText(selectedVolunteer.emergencyName)}</p>
              <p><strong>Emergency Number:</strong> {censorText(selectedVolunteer.emergencyContact)}</p>
              <p><strong>Status:</strong> {selectedVolunteer.status}</p>
              <p><strong>Volunteer Hours:</strong> {selectedVolunteer.totalHoursVolunteer || 0}</p>
              <p><strong>Training Hours:</strong> {selectedVolunteer.totalHoursStudent || 0}</p>
              <p><strong>Certificates:</strong> {(selectedVolunteer.certificates || []).length}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--bs-border-color, #dee2e6)', paddingTop: '16px' }}>
              <label className="form-label">Enter password to view uncensored:</label>
              <div className="d-flex gap-2">
                <input 
                  type="password" 
                  className="form-control" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter 6-digit password"
                  maxLength="6"
                />
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleUncensor(selectedVolunteer)}
                >
                  Unlock
                </button>
              </div>
              {error && <div className="text-danger small mt-2">{error}</div>}
              <div className="text-secondary small mt-1">Default password: 123456</div>
            </div>
          </div>
        </div>
      )}

      {showUncensored && selectedVolunteer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={handleClose}>
          <div style={{
            backgroundColor: 'var(--bs-card-bg, white)',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h5 style={{ color: '#28a745' }}>🔓 Uncensored View</h5>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                onClick={handleClose}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p><strong>Name:</strong> {selectedVolunteer.name || '—'}</p>
              <p><strong>Email:</strong> {selectedVolunteer.email}</p>
              <p><strong>Phone:</strong> {selectedVolunteer.phone || '—'}</p>
              <p><strong>VID:</strong> {selectedVolunteer.vid || 'Not assigned'}</p>
              <p><strong>Department:</strong> {selectedVolunteer.department || 'Not assigned'}</p>
              <p><strong>Title:</strong> {selectedVolunteer.title || 'Not assigned'}</p>
              <p><strong>Date of Birth:</strong> {selectedVolunteer.dob || '—'}</p>
              <p><strong>Gender:</strong> {selectedVolunteer.gender || '—'}</p>
              <p><strong>Address:</strong> {selectedVolunteer.address || '—'}</p>
              <p><strong>Race:</strong> {selectedVolunteer.race || '—'}</p>
              <p><strong>Religion:</strong> {selectedVolunteer.religion || '—'}</p>
              <p><strong>Citizenship:</strong> {selectedVolunteer.citizenship || '—'}</p>
              <p><strong>Blood Type:</strong> {selectedVolunteer.bloodType || '—'}</p>
              <p><strong>Emergency Contact:</strong> {selectedVolunteer.emergencyName || '—'}</p>
              <p><strong>Emergency Number:</strong> {selectedVolunteer.emergencyContact || '—'}</p>
              <p><strong>Status:</strong> {selectedVolunteer.status}</p>
              <p><strong>Volunteer Hours:</strong> {selectedVolunteer.totalHoursVolunteer || 0}</p>
              <p><strong>Training Hours:</strong> {selectedVolunteer.totalHoursStudent || 0}</p>
              <p><strong>Certificates:</strong> {(selectedVolunteer.certificates || []).length}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--bs-border-color, #dee2e6)', paddingTop: '16px' }}>
              <button className="btn btn-secondary w-100" onClick={handleClose}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Certificates ---------------- */
function Certificates() {
  const [allUsers, setAllUsers] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    cachedQuery('admin:users:approved', async () => {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('status', '==', 'approved'),
        limit(2000),
      ));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }).then(setAllUsers);
  }, []);

  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return allUsers.filter((u) =>
      (u.name || '').toLowerCase().includes(term)
      || (u.email || '').toLowerCase().includes(term),
    ).slice(0, 10);
  }, [q, allUsers]);

  const pick = (u) => {
    setSelected(u);
    setQ(`${u.name || u.email}`);
    setShowDrop(false);
  };

  const reset = () => { setSelected(null); setQ(''); setFile(null); setMsg(''); };

  const upload = async () => {
    if (!selected || !file) return;
    setMsg('');
    try {
      const r = ref(storage, `certificates/${selected.id}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, 'users', selected.id), { certificates: arrayUnion(url) });
      setMsg(`Certificate issued to ${selected.name || selected.email}. They'll get a notification.`);
      setFile(null);
      invalidate('admin:users');
    } catch (e) { setMsg(e.message); }
  };

  const downloadExcel = () => {
    try {
      const excelData = allUsers
        .filter(u => u.certificates && u.certificates.length > 0)
        .map((u) => ({
          'Name': u.name || '',
          'Email': u.email || '',
          'Number of Certificates': (u.certificates || []).length,
          'Certificate URLs': (u.certificates || []).join(', '),
        }));

      if (excelData.length === 0) {
        alert('No certificates found to export.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Certificates');
      XLSX.writeFile(wb, `certificates_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error downloading Excel file');
    }
  };

  return (
    <div className="col-lg-7">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Issue a certificate</h5>
        <button className="btn btn-success btn-sm" onClick={downloadExcel}>
          📊 Download Excel
        </button>
      </div>
      {msg && <div className="alert alert-info py-2">{msg}</div>}

      <label className="form-label">Find member by name or email</label>
      <div className="position-relative" ref={wrapRef}>
        <input
          className="form-control"
          value={q}
          onFocus={() => setShowDrop(true)}
          onChange={(e) => { setQ(e.target.value); setSelected(null); setShowDrop(true); }}
          placeholder="Start typing a name or email..."
        />
        {showDrop && matches.length > 0 && (
          <ul className="cert-dropdown list-unstyled">
            {matches.map((u) => (
              <li key={u.id}>
                <button type="button" className="dropdown-row" onClick={() => pick(u)}>
                  {u.photoUrl
                    ? <img src={u.photoUrl} alt="" width="32" height="32" className="rounded-circle object-fit-cover" />
                    : <span className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center text-white" style={{ width: 32, height: 32, fontSize: 14 }}>{(u.name || '?').charAt(0).toUpperCase()}</span>}
                  <div className="text-start">
                    <div className="fw-semibold small">{u.name || '(no name)'}</div>
                    <div className="text-secondary" style={{ fontSize: '0.75rem' }}>{u.email}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showDrop && q.trim() && matches.length === 0 && (
          <div className="cert-dropdown text-secondary small p-3">No matches.</div>
        )}
      </div>

      {selected && (
        <div className="mt-4 p-3 border rounded">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <strong>{selected.name || '(no name)'}</strong>
              <div className="small text-secondary">{selected.email}</div>
              <div className="small text-secondary">{(selected.certificates || []).length} certificate(s) so far</div>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={reset}>Clear</button>
          </div>
          <input type="file" accept="application/pdf" className="form-control my-2" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn btn-brand btn-sm" disabled={!file} onClick={upload}>Upload PDF &amp; issue</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Maintenance ---------------- */
function Maintenance() {
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setOut('Running…');
    try {
      const fn = httpsCallable(functions, 'runMaintenanceNow');
      const res = await fn();
      setOut(JSON.stringify(res.data, null, 2));
    } catch (e) { setOut(e.message); }
    setBusy(false);
  };

  return (
    <div className="col-lg-7">
      <h5>Daily maintenance</h5>
      <p className="text-secondary small">
        Runs automatically every midnight (Singapore time). Run it now to expire past events,
        close full ones, mark scanned registrations completed, and recompute member hours.
      </p>
      <button className="btn btn-brand" disabled={busy} onClick={run}>Run now</button>
      {out && <pre className="mt-3 p-3 border rounded small">{out}</pre>}
    </div>
  );
}