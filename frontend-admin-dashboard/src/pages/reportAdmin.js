import React, { useState, useEffect } from 'react';
import reportApi from '../services/reportApi';
import './reportAdmin.css';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const ReportAdmin = ({ adminData }) => {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
  period: 'monthly',
  startDate: getDefaultStartDate(),
  endDate: new Date().toISOString().split('T')[0],
  endMonth: new Date().toISOString().slice(0, 7),
  paymentMethod: '',
  paymentStatus: '',
  transactionType: ''
});

  const [data, setData] = useState({
    summary: null,
    chartData: [],
    transactions: [],
    paymentBreakdown: [],
    customerStats: null
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  function getDefaultStartDate() {
    const today = new Date();
    const startDate = new Date();
    startDate.setMonth(today.getMonth() - 1);
    return startDate.toISOString().split('T')[0];
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  const loadReportData = React.useCallback(async () => {
    try {
      setLoading(true);

      const summaryResult = await reportApi.getReportSummary(filters);
      const chartResult = await reportApi.getDailyChartData(filters.startDate, filters.endDate);
      const transactionsResult = await reportApi.getTransactionsList({
        ...filters,
        page: currentPage,
        limit: 20
      });
      const customerResult = await reportApi.getCustomerStats(filters.startDate, filters.endDate);

      if (summaryResult.success && chartResult.success && transactionsResult.success) {
        setData({
          summary: summaryResult.data.summary,
          paymentBreakdown: summaryResult.data.paymentBreakdown,
          statusBreakdown: summaryResult.data.statusBreakdown,
          pendingCashCount: summaryResult.data.pendingCashCount,
          newCustomersCount: summaryResult.data.newCustomersCount,
          transactions: transactionsResult.data.transactions,
          customerStats: customerResult.data
        });

        setTotalPages(transactionsResult.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Load report data error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handleFilterChange = (e) => {
  const { name, value } = e.target;
  
  // Kalau yang diubah adalah filter bulan
  if (name === 'endMonth' && value) {
    const [year, month] = value.split('-');
    const startOfMonth = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    setFilters(prev => ({
      ...prev,
      endMonth: value,
      startDate: startOfMonth,
      endDate: endOfMonth
    }));
  } else {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  }
  
  setCurrentPage(1);
};

  const handleResetFilters = () => {
  setFilters({
    period: 'monthly',
    startDate: getDefaultStartDate(),
    endDate: new Date().toISOString().split('T')[0],
    endMonth: new Date().toISOString().slice(0, 7),
    paymentMethod: '',
    paymentStatus: '',
    transactionType: ''
  });
  setCurrentPage(1);
};

const handleExportPDF = async () => {
  try {
    if (!data.transactions || data.transactions.length === 0) {
      alert('Tidak ada data transaksi untuk diexport');
      return;
    }

    const pdf = new jsPDF('l', 'mm', 'a4');
    const marginLeft = 14;
    const tableWidth = 185;
    const startX = marginLeft;
    let yPos = 45;

    pdf.setFontSize(14);
    pdf.text('Laporan Transaksi', startX, 15);

    pdf.setFontSize(9);
    pdf.text(`Periode: ${filters.startDate} s/d ${filters.endDate}`, startX, 22);
    pdf.text(`Tanggal Print: ${new Date().toLocaleDateString('id-ID')}`, startX, 28);

    const headers = ['Kode', 'Tipe', 'Customer', 'Tanggal', 'Metode', 'Status', 'Jumlah'];
    const colWidths = [38, 32, 38, 25, 25, 22, 30];
    const pageHeight = pdf.internal.pageSize.height;
    const lineHeight = 6;

    const drawHeader = () => {
      let xPos = startX;
      pdf.setFillColor(59, 130, 246);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(8);

      headers.forEach((header, i) => {
        pdf.rect(xPos, yPos - 5, colWidths[i], 7, 'F');
        const textY = yPos - 5 + 4.5;
        pdf.text(header, xPos + 2, textY, { maxWidth: colWidths[i] - 4 });
        xPos += colWidths[i];
      });

      pdf.setTextColor(0, 0, 0);
      yPos += 8;
    };

    drawHeader();

    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(7);

    data.transactions.forEach((tx, idx) => {
      if (yPos > pageHeight - 15) {
        pdf.addPage();
        yPos = 15;
        drawHeader();
      }

      const rowData = [
        tx.Transaction_Code || '-',
        tx.Transaction_Type === 'isi_pulsa' ? 'Isi Pulsa' :
        tx.Transaction_Type === 'top_up_saldo' ? 'Isi Saldo RFID' :
        tx.Transaction_Type === 'beli_sim' ? 'Beli SIM' : tx.Transaction_Type,
        tx.Customer_Name || '-',
        new Date(tx.Created_At).toLocaleDateString('id-ID'),
        tx.Payment_Method === 'qris' ? 'QRIS' :
        tx.Payment_Method === 'saldo_rfid' ? 'Saldo RFID' :
        tx.Payment_Method === 'kasir' ? 'Kasir' :
        tx.Payment_Method === 'cash' ? 'Kasir (Cash)' : '-',
        tx.Payment_Status === 'success' ? 'Sukses' :
        tx.Payment_Status === 'pending' ? 'Menunggu' :
        tx.Payment_Status === 'failed' ? 'Gagal' : '-',
        formatCurrency(tx.Total_Amount || 0)
      ];

      if (idx % 2 === 0) {
        pdf.setFillColor(240, 245, 255);
        pdf.rect(startX, yPos - 5, tableWidth, lineHeight, 'F');
      }

      let xPos = startX;
      rowData.forEach((cell, i) => {
        pdf.rect(xPos, yPos - 5, colWidths[i], lineHeight);
        pdf.text(String(cell), xPos + 2, yPos - 1, { maxWidth: colWidths[i] - 3 });
        xPos += colWidths[i];
      });

      yPos += lineHeight;
    });

    const fileName = `Laporan_Transaksi_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.pdf`;
    pdf.save(fileName);
    alert('Export PDF berhasil!');
  } catch (error) {
    console.error('Export PDF error:', error);
    alert('Gagal export PDF: ' + error.message);
  }
};


  const handleExportExcel = async () => {
    try {
      if (!data.transactions || data.transactions.length === 0) {
        alert('Tidak ada data transaksi untuk diexport');
        return;
      }

      const excelData = data.transactions.map((tx) => ({
        'Kode Transaksi': tx.Transaction_Code,
        'Tipe': tx.Transaction_Type === 'isi_pulsa' ? 'Isi Pulsa' :
                tx.Transaction_Type === 'top_up_saldo' ? 'Isi Saldo RFID' :
                tx.Transaction_Type === 'beli_sim' ? 'Beli SIM' : tx.Transaction_Type,
        'Nama Customer': tx.Customer_Name || '-',
        'Tanggal': new Date(tx.Created_At).toLocaleDateString('id-ID'),
        'Metode Pembayaran':
        tx.Payment_Method === 'qris' ? 'QRIS' :
        tx.Payment_Method === 'saldo_rfid' ? 'Saldo RFID' :
        tx.Payment_Method === 'kasir' ? 'Kasir' :
        tx.Payment_Method === 'cash' ? 'Kasir (Cash)' : '-',
        'Status':
          tx.Payment_Status === 'success' ? 'Sukses' :
            tx.Payment_Status === 'pending' ? 'Menunggu' :
              tx.Payment_Status === 'failed' ? 'Gagal' : '-',
        'Jumlah': tx.Total_Amount || 0
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');

      ws['!cols'] = [
        { wch: 18 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 18 },
        { wch: 12 },
        { wch: 15 }
      ];

      const fileName = `Laporan_Transaksi_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert('Export Excel berhasil!');
    } catch (error) {
      console.error('Export Excel error:', error);
      alert('Gagal export Excel: ' + error.message);
    }
  };

  return (
    <div className="report-page">
      <div className="report-header">
        <h1>Laporan Penjualan</h1>
        <button onClick={loadReportData} className="btn-refresh" disabled={loading}>
          {loading ? 'Memuat...' : '↻ Refresh'}
        </button>
      </div>

      <div className="filter-section">
        <h3>Filter Laporan</h3>
        <div className="filter-grid">
          <div className="filter-group">
            <label>Dari Tanggal</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label>Sampai Tanggal</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label>Dari bulan</label>
            <input
              type="month"
              name="endMonth"
              value={filters.endMonth}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label>Sampai Bulan</label>
            <input
              type="month"
              name="endMonth"
              value={filters.endMonth}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label>Metode Pembayaran</label>
            <select name="paymentMethod" value={filters.paymentMethod} onChange={handleFilterChange}>
              <option value="">Semua</option>
              <option value="qris">QRIS</option>
              <option value="saldo_rfid">Saldo RFID</option>
              <option value="kasir">Bayar Kasir</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status Pembayaran</label>
            <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange}>
              <option value="">Semua</option>
              <option value="success">Sukses</option>
              <option value="pending">Menunggu</option>
              <option value="failed">Gagal</option>
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <button onClick={loadReportData} className="btn-filter" disabled={loading}>
            Terapkan Filter
          </button>
          <button onClick={handleResetFilters} className="btn-reset">
            Reset Filter
          </button>
          <div className="export-buttons">
            <button onClick={handleExportPDF} className="btn-export" disabled={loading}>
              Export PDF
            </button>
            <button onClick={handleExportExcel} className="btn-export" disabled={loading}>
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {loading && data.summary === null ? (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Memuat laporan...</p>
        </div>
      ) : (
        <>
          <div className="transactions-section">
            <h3>Detail Transaksi</h3>
            <div className="table-wrapper">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Tipe</th>
                    <th>Customer</th>
                    <th>Tanggal</th>
                    <th>Metode</th>
                    <th>Status</th>
                    <th>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions && data.transactions.length > 0 ? (
                    data.transactions.map((tx, index) => (
                      <tr key={index}>
                        <td className="transaction-code">{tx.Transaction_Code}</td>
                        <td>
                          <span className={`transaction-type ${tx.Transaction_Type}`}>
                            {tx.Transaction_Type === 'isi_pulsa' ? 'Isi Pulsa' :
                              tx.Transaction_Type === 'top_up_saldo' ? 'Isi Saldo RFID' :
                                tx.Transaction_Type === 'beli_sim' ? 'Beli SIM' :
                                  tx.Transaction_Type}
                          </span>
                        </td>
                        <td>{tx.Customer_Name || '-'}</td>
                        <td>{new Date(tx.Created_At).toLocaleDateString('id-ID')}</td>
                        <td>
                          <span className="payment-method">
                            {tx.Payment_Method === 'qris' && 'QRIS'}
                            {tx.Payment_Method === 'saldo_rfid' && 'Saldo RFID'}
                            {tx.Payment_Method === 'kasir' && 'Kasir'}
                            {tx.Payment_Method === 'cash' && 'Kasir (Cash)'}
                            {!['qris', 'saldo_rfid', 'kasir', 'cash'].includes(tx.Payment_Method) && '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${tx.Payment_Status}`}>
                            {tx.Payment_Status === 'success' && 'Sukses'}
                            {tx.Payment_Status === 'pending' && 'Menunggu'}
                            {tx.Payment_Status === 'failed' && 'Gagal'}
                          </span>
                        </td>
                        <td className="amount-value">
                          {formatCurrency(tx.Total_Amount || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-table">
                        Tidak ada transaksi untuk periode ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <div className="pagination-controls">
                  <button
                    className="btn-pagination"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    ← Sebelumnya
                  </button>
                  <button
                    className="btn-pagination"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReportAdmin;