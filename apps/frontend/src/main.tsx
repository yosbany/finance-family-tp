import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { measureClassificationBaseline } from './services/classificationMeasurement.service'

document.documentElement.classList.add('dark')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// FASE 07B5A - Expose measurement function for browser console
// Usage: await window.__financeMeasure07B5()
if (typeof window !== 'undefined') {
  (window as any).__financeMeasure07B5 = measureClassificationBaseline;
  (window as any).__financeMeasure07B5Result = null; // Will be populated after measurement
  console.log('✅ FASE 07B5A - Measurement tool available');
  console.log('   Execute: await window.__financeMeasure07B5()');
}

// Made with Bob
