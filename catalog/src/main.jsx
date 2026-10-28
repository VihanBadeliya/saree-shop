import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Public from './Public.jsx';
import Admin from './Admin.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(
  <BrowserRouter><Routes>
    <Route path="/admin" element={<Admin />} />
    <Route path="*" element={<Public />} />
  </Routes></BrowserRouter>
);
