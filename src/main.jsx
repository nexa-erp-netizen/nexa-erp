import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CnaeFatorRAutomatizador from './components/CnaeFatorRAutomatizador.jsx'
import { iniciarMonitoramentoWeb } from './services/incidentesNexaService.js'

iniciarMonitoramentoWeb()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CnaeFatorRAutomatizador />
    <App />
  </StrictMode>,
)
