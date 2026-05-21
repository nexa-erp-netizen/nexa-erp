import { useEffect, useState } from "react"

import Sidebar from "./components/Sidebar"
import Header from "./components/Header"

import Login from "./pages/Login"

import Dashboard from "./pages/Dashboard"
import Clientes from "./pages/Clientes"
import Servicos from "./pages/Servicos"
import PlanoContas from "./pages/PlanoContas"
import EscritorioDigital from "./pages/EscritorioDigital"
import Fiscal from "./pages/Fiscal"
import Financeiro from "./pages/Financeiro"
import PortalCliente from "./pages/PortalCliente"
import Relatorios from "./pages/Relatorios"
import LancamentosContabeis from "./pages/LancamentosContabeis"
import AcessoRapidoFiscal from "./pages/AcessoRapidoFiscal"
import DocumentosDigitais from "./pages/DocumentosDigitais"
import CalculadoraIRPFMEI from "./pages/CalculadoraIRPFMEI"
import Agenda from "./pages/Agenda"
import BackupSistema from "./pages/BackupSistema"

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [page, setPage] = useState("Dashboard")

  const permissoesPorPerfil = {
  Administrador: [
    "Dashboard",
    "Escritório Digital",
    "Clientes",
    "Serviços",
    "Plano de Contas",
    "Lançamentos Contábeis",
    "Fiscal",
    "Financeiro",
    "Acesso Rápido Fiscal",
    "Portal Cliente",
    "Documentos Digitais",
    "Relatórios",
    "Backup Sistema",
    "Calculadora IRPF MEI",
    "Agenda",
  ],

  Funcionário: [
    "Dashboard",
    "Escritório Digital",
    "Clientes",
    "Lançamentos Contábeis",
    "Fiscal",
    "Financeiro",
    "Acesso Rápido Fiscal",
    "Portal Cliente",
    "Documentos Digitais",
    "Relatórios",
    "Calculadora IRPF MEI",
    "Agenda",
  ],

  Cliente: [
    "Portal Cliente",
    "Documentos Digitais",
    "Fiscal",
  ],
}

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem("usuario")

    if (usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo))
    }
  }, [])

  function sair() {
    localStorage.removeItem("token")
    localStorage.removeItem("usuario")

    setUsuario(null)
    setPage("Dashboard")
  }

  function renderPage() {
    const paginasPermitidas =
      permissoesPorPerfil[usuario?.perfil] || []

    if (!paginasPermitidas.includes(page)) {
      return <PortalCliente />
    }
    switch (page) {
      case "Dashboard":
        return <Dashboard />

      case "Escritório Digital":
        return <EscritorioDigital setPage={setPage} />

      case "Clientes":
        return <Clientes />

      case "Serviços":
        return <Servicos />

      case "Plano de Contas":
        return <PlanoContas />

      case "Fiscal":
        return <Fiscal />

      case "Financeiro":
        return <Financeiro />

      case "Portal Cliente":
        return <PortalCliente />

      case "Lançamentos Contábeis":
        return <LancamentosContabeis />

      case "Acesso Rápido Fiscal":
        return <AcessoRapidoFiscal />

      case "Relatórios":
        return <Relatorios />

      case "Documentos Digitais":
        return <DocumentosDigitais />
  
      case "Calculadora IRPF MEI":
        return <CalculadoraIRPFMEI />

      case "Agenda":
        return <Agenda />
      
      case "Backup Sistema":
        return <BackupSistema />

      default:
        return <Dashboard />
    }
  }

  if (!usuario) {
    return <Login onLogin={setUsuario} />
  }

  return (
    <div style={styles.body}>
      <div style={styles.app}>
        <Sidebar
          page={page}
          setPage={setPage}
          usuario={usuario}
        />

        <main style={styles.main}>
          <Header
            title={page}
            usuario={usuario}
            onLogout={sair}
          />

          {renderPage()}
        </main>
      </div>
    </div>
  )
}

const styles = {
  body: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #00112b, #00275c, #00112b)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: "0",
  },

  app: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    width: "100%",
    height: "100vh",
    overflow: "hidden",
  },

  main: {
    background: "#082b5d",
    padding: "45px",
    height: "100vh",
    overflowY: "auto",
    overflowX: "hidden",
    width: "100%",
  },
}