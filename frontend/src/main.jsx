import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { PassengersProvider } from './context/PassengersContext'
import './styles/global.css'
import 'maplibre-gl/dist/maplibre-gl.css'

// HashRouter evita 404 em refresh no GitHub Pages (sem servidor de fallback).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <PassengersProvider>
        <App />
      </PassengersProvider>
    </HashRouter>
  </React.StrictMode>,
)
