import React, { useState, useEffect, } from 'react';
import adminApi from '../services/adminApi';
import './simManagement.css';

const SimManagement = ({ adminData }) => {
    const [sims, setSims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        barcode: '',
        phoneNumber: '',
        provider: 'telkomsel',
        purchasePrice: 0,
        sellingPrice: 0
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (showForm === false) {
            loadSIMs();
        }
    }, [showForm]);
    // ========== CLEAR ERROR SAAT FORM DIBUKA ==========
    useEffect(() => {
        if (showForm) {
            setError('');
            setSuccess('');
        }
    }, [showForm]);

    const loadSIMs = async () => {
        try {
            setLoading(true);
            const result = await adminApi.getSIMCards();

            if (result.success) {
                setSims(result.data);
            }
        } catch (error) {
            console.error('Load SIMs error:', error);
            // Jangan set state apapun di sini
        } finally {
            setLoading(false);
        }
    };
    // =======================================
    // FORMAT NOMOR SIM: 0812-3456-7890 (12 digit)
    // =======================================
    const formatPhoneNumber = (value) => {
        // Hapus semua non-digit
        const digits = value.replace(/\D/g, '');

        // Limit ke 12 digit saja, tanpa format dash
        return digits.slice(0, 12);
    };


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let finalValue = value;

        // Auto-format nomor SIM
        if (name === 'phoneNumber') {
            finalValue = formatPhoneNumber(value);
        }

        setFormData({
            ...formData,
            [name]: (name === 'purchasePrice' || name === 'sellingPrice')
                ? parseInt(value) || 0
                : finalValue
        });
        // Jangan clear error saat input
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validasi - HANYA SAAT SUBMIT
        if (!formData.barcode.trim()) {
            setError('Nomor Seri wajib diisi');
            return;
        }
        if (!formData.phoneNumber.trim()) {
            setError('Nomor SIM wajib diisi');
            return;
        }
        if (formData.purchasePrice < 10000) {
            setError('Harga Beli minimal Rp 10.000');
            return;
        }
        if (formData.sellingPrice < 10000) {
            setError('Harga Jual minimal Rp 10.000');
            return;
        }
        if (formData.sellingPrice < formData.purchasePrice) {
            setError('Harga Jual harus lebih besar dari Harga Beli');
            return;
        }

        try {
            setSubmitting(true);

            // Get adminId - handle berbagai format adminData
            const adminId = adminData?.Admin_ID || adminData?.adminId || 1;

            let result;
            if (editingId) {
                // Update SIM
                result = await adminApi.updateSIMCard(editingId, formData, adminId);
            } else {
                // Create SIM
                result = await adminApi.createSIMCard(formData, adminId);
            }

            if (result.success) {
                setSuccess(
                    editingId
                        ? 'SIM berhasil diupdate'
                        : 'SIM berhasil ditambahkan'
                );

                setFormData({
                    barcode: '',
                    phoneNumber: '',
                    provider: 'telkomsel',
                    purchasePrice: 0,
                    sellingPrice: 0
                });
                setEditingId(null);
                setShowForm(false);

                loadSIMs();
            } else {
                setError(result.error || 'Gagal menyimpan SIM');
            }
        } catch (err) {
            setError(err.error || 'Terjadi kesalahan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (sim) => {
        setEditingId(sim.SIM_ID);
        setFormData({
            barcode: sim.Barcode,
            phoneNumber: sim.Phone_Number,
            provider: sim.Provider,
            purchasePrice: sim.Purchase_Price || sim.purchasePrice || 0,
            sellingPrice: sim.Selling_Price || sim.selling_price || sim.Price || 0
        });
        setShowForm(true);
    };

    const handleDelete = async (simId) => {
        if (!window.confirm('Yakin ingin hapus SIM ini?')) return;

        try {
            setSubmitting(true);
            const adminId = adminData?.Admin_ID || adminData?.adminId || 1;
            const result = await adminApi.deleteSIMCard(simId, adminId);

            if (result.success) {
                setSuccess('SIM berhasil dihapus');
                loadSIMs();
            } else {
                setError(result.error || 'Gagal menghapus SIM');
            }
        } catch (err) {
            setError(err.error || 'Terjadi kesalahan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({
            barcode: '',
            phoneNumber: '',
            provider: 'telkomsel',
            purchasePrice: 0,
            sellingPrice: 0
        });
        setError('');
        setSuccess('');
    };

    const formatDate = (dateString) => {
        try {
            if (!dateString || dateString === 'NULL' || dateString === null) {
                return '-';
            }
            return new Date(dateString).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (e) {
            return '-';
        }
    };
    if (loading) {
        return (
            <div className="sim-management">
                <h1>Manajemen Kartu SIM</h1>
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Memuat data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="sim-management">
            <div className="page-header">
                <h1>Manajemen Kartu SIM</h1>
                <button
                    className="btn-add-sim"
                    onClick={() => setShowForm(true)}
                >
                    + Tambah SIM
                </button>
            </div>

            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    {success}
                </div>
            )}

            {showForm && (
                <div className="form-section">
                    <h2>{editingId ? 'Edit SIM' : 'Tambah SIM Baru'}</h2>
                    <form onSubmit={handleSubmit} className="sim-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Nomor Seri</label>
                                <input
                                    type="text"
                                    name="barcode"
                                    value={formData.barcode}
                                    onChange={handleInputChange}
                                    placeholder=""
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group">
                                <label>Nomor SIM</label>
                                <input
                                    type="text"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleInputChange}
                                    placeholder="Contoh: 081234567890"
                                    maxLength="12"
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Provider</label>
                                <select
                                    name="provider"
                                    value={formData.provider}
                                    onChange={handleInputChange}
                                    disabled={submitting}
                                >
                                    <option value="telkomsel">Telkomsel</option>
                                    <option value="indosat">Indosat</option>
                                    <option value="xl">XL Axiata</option>
                                    <option value="tri">Tri (3)</option>
                                    <option value="smartfren">Smartfren</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Harga Beli (Rp)</label>
                                <input
                                    type="number"
                                    name="purchasePrice"
                                    value={formData.purchasePrice || ''}
                                    onChange={handleInputChange}
                                    placeholder=""
                                    min="10000"
                                    step="1000"
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group">
                                <label>Harga Jual (Rp)</label>
                                <input
                                    type="number"
                                    name="sellingPrice"
                                    value={formData.sellingPrice || ''}
                                    onChange={handleInputChange}
                                    placeholder=""
                                    min="10000"
                                    step="1000"
                                    disabled={submitting}
                                />
                            </div>

                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={handleCancel}
                                disabled={submitting}
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="btn-submit"
                                disabled={submitting}
                            >
                                {submitting
                                    ? 'Menyimpan...'
                                    : (editingId ? 'Update SIM' : 'Tambah SIM')
                                }
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="stats-info">
                <p><strong>Total SIM:</strong> {sims.length} kartu</p>
                <p><strong>Tersedia:</strong> {sims.filter(s => s.Status === 'available').length} kartu</p>
                <p><strong>Terjual:</strong> {sims.filter(s => s.Status === 'sold').length} kartu</p>
                <p><strong>Proses:</strong> {sims.filter(s => s.Status === 'reserved').length} kartu</p>
            </div>

            {sims.length === 0 ? (
                <div className="empty-state">
                    <h2>Belum Ada SIM</h2>
                    <p>Mulai dengan menambahkan kartu SIM baru</p>
                </div>
            ) : (
                <div className="sims-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Nomor Seri</th>
                                <th>Nomor SIM</th>
                                <th>Provider</th>
                                <th>Harga Beli</th>
                                <th>Harga Jual</th>
                                <th>Status</th>
                                <th>Ditambahkan</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sims.map((sim) => {
                                const purchasePrice = sim.Purchase_Price || sim.purchasePrice || 0;
                                const sellingPrice = sim.Selling_Price || sim.selling_price || sim.Price || 0;

                                return (
                                    <tr key={sim.SIM_ID}>
                                        <td className="barcode-cell">{sim.Barcode}</td>
                                        <td>{sim.Phone_Number}</td>
                                        <td>
                                            <span className="provider-badge">
                                                {sim.Provider ? sim.Provider.toUpperCase() : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="price-cell">
                                            {parseInt(purchasePrice).toLocaleString('id-ID', {
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 0
                                            })}
                                        </td>
                                        <td className="price-cell">
                                            {parseInt(sellingPrice).toLocaleString('id-ID', {
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 0
                                            })}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${sim.Status}`}>
                                                {sim.Status === 'available' && 'Tersedia'}
                                                {sim.Status === 'sold' && 'Terjual'}
                                                {sim.Status === 'reserved' && 'Proses'}
                                            </span>
                                        </td>
                                        <td className="date-cell">
                                            {formatDate(sim.Created_at)}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => handleEdit(sim)}
                                                    disabled={submitting}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDelete(sim.SIM_ID)}
                                                    disabled={submitting || sim.Status !== 'available'}
                                                    title={sim.Status !== 'available' ? 'Hanya SIM tersedia yang bisa dihapus' : ''}
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SimManagement;