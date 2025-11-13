import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/adminLogin';
import AdminDashboard from './pages/adminDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Login Page */}
        <Route path="/" element={<AdminLogin />} />
        
        {/* Dashboard Page */}
        <Route path="/dashboard" element={<AdminDashboard />} />
        
        {/* Redirect unknown routes to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;