import React, { useState } from 'react';
import adminApi from '../services/adminApi';
import './CreateAdminModal.css';

const CreateAdminModal = ({ isOpen, onClose, onAdminCreated }) => {
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    role: 'kasir'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!formData.username || !formData.fullName || !formData.password || !formData.confirmPassword || !formData.role) {
      setError('Semua field wajib diisi');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok');
      setLoading(false);
      return;
    }

    try {
      console.log('Creating admin with data:', {
        username: formData.username,
        fullName: formData.fullName,
        role: formData.role
      });

      const result = await adminApi.createAdmin(formData);

      if (result.success) {
        console.log('Admin berhasil dibuat:', result.data);
        
        setSuccess('Admin berhasil dibuat!');
        setFormData({
          username: '',
          fullName: '',
          password: '',
          confirmPassword: '',
          role: 'kasir'
        });

        // Panggil callback untuk refresh list admin
        if (onAdminCreated) {
          console.log('Calling onAdminCreated callback...');
          onAdminCreated();
        }

        // Close modal setelah 2 detik
        setTimeout(() => {
          console.log('Closing modal...');
          onClose();
        }, 2000);
      } else {
        console.error('Error from server:', result.error);
        setError(result.error || 'Gagal membuat admin');
      }
    } catch (err) {
      console.error('Exception saat membuat admin:', err);
      const errorMessage = err.error || err.message || 'Terjadi kesalahan saat membuat admin';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content create-admin-modal">
        <div className="modal-header">
          <h2>Tambah Admin Baru</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="create-admin-form">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Masukkan username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Nama Lengkap *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="Masukkan nama lengkap"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Minimal 6 karakter"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Konfirmasi Password *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Ulangi password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Role *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="kasir">Kasir</option>
              <option value="administrator">Administrator</option>
            </select>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Tambah Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAdminModal;