// Mode strict de React pour détecter les problèmes potentiels
import { StrictMode } from 'react'
// Méthode de rendu pour React 18+
import { createRoot } from 'react-dom/client'
// Styles globaux de l'application (Tailwind CSS)
import './index.css'
// Composant racine de l'application
import App from './App.jsx'

/**
 * Point d'entrée de l'application React
 * Initialise l'application et la monte dans le DOM
 * StrictMode active des vérifications supplémentaires en développement
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
