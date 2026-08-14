import { useEffect, useState } from "react"
import api from "./services/api"

import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import NexaVoiceListener from "./components/NexaVoiceListener"

import Login from "./pages/Login"

import Dashboard from "./pages/Dashboard"
import Clientes from "./pages/Clientes"
import Servicos from "./pages/Servicos"
import PlanoContas from "./pages/PlanoContas"
import EscritorioDigital from "./pages/EscritorioDigital"
import Fiscal from "./pages/Fiscal"
import Financeiro from "./pages/Financeiro"
import MovimentosCliente from "./pages/MovimentosCliente"
import PortalCliente from "./pages/PortalCliente"
import PendenciasClientes from "./pages/PendenciasClientes"
import PendenciasCliente from "./pages/PendenciasCliente"
import Relatorios from "./pages/Relatorios"
import Usuarios from "./pages/Usuarios"
import LancamentosContabeis from "./pages/LancamentosContabeis"
import AcessoRapidoFiscal from "./pages/AcessoRapidoFiscal"
import DocumentosDigitais from "./pages/DocumentosDigitais"
import CalculadoraIRPFMEI from "./pages/CalculadoraIRPFMEI"
import Agenda from "./pages/Agenda"
import BackupSistema from "./pages/BackupSistema"
import DRE from "./pages/DRE"
import MovimentosClientesEscritorio from "./pages/MovimentosClientesEscritorio"
import Notificacoes from "./pages/Notificacoes"
import ObrigacoesCliente from "./pages/ObrigacoesCliente"
import WhatsAppInteligente from "./pages/WhatsAppInteligente"
import AssistenteDoDia from "./pages/AssistenteDoDia"
import LaboratorioTributario from "./pages/LaboratorioTributario"
import CertificadosDigitais from "./pages/CertificadosDigitais"
import ProcuracoesEcac from "./pages/ProcuracoesEcac"
import IdentidadeDigital from "./pages/IdentidadeDigital"
import CentralEcac from "./pages/CentralEcac.jsx"
import MemoriaNexa from "./pages/MemoriaNexa"
import SegundoContador from "./pages/SegundoContador"
import ConsultoraTributaria from "./pages/ConsultoraTributaria"
import ConversaNexa from "./pages/ConversaNexa"
import RadarInteligente from "./pages/RadarInteligente"
import SobreNexa from "./pages/SobreNexa"
import IntegracaoGoogleDrive from "./pages/IntegracaoGoogleDrive"
import NFe from "./pages/NFe"
import NFSe from "./pages/NFSe"
import EscritoriosNexa from "./pages/EscritoriosNexa"
import Funcionarios from "./pages/Funcionarios"
import FolhaPagamento from "./pages/FolhaPagamento"
import ProLabore from "./pages/ProLabore"
import CalculadoraRescisao from "./pages/CalculadoraRescisao"
import Ferias from "./pages/Ferias"
import ConciliacaoBancaria from "./pages/ConciliacaoBancaria"

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [page, setPage] = useState("Dashboard")
  const [isMobile, setIsMobile] = useState(false)

  const permissoesPorPerfil = {
    Administrador: [
      "Dashboard",
      "Notificações",
      "Escritório Digital",
      "Clientes",
      "Funcionários",
      "Folha de Pagamento",
      "Pró-labore",
      "Férias",
      "Serviços",
      "Plano de Contas",
      "Lançamentos Contábeis",
      "Conciliação Bancária",
      "Fiscal",
      "NF-e",
      "NFS-e",
      "Financeiro",
      "Movimentos Clientes",
      "Pendências Clientes",
      "Acesso Rápido Fiscal",
      "Documentos Digitais",
      "WhatsApp Inteligente",
      "Assistente do Dia",
      "Laboratório Tributário",
      "Certificados Digitais",
      "Procurações e-CAC",
      "Identidade Digital",
      "Central e-CAC",
      "Memória da Nexa",
      "Segundo Contador",
      "Consultora Tributária",
      "Conversa com a Nexa",
      "Radar Inteligente",
      "Relatórios",
      "Usuários",
      "Escritórios Nexa",
      "Backup Sistema",
      "Google Drive",
      "Sobre",
      "Calculadora IRPF MEI",
      "Calculadora de Rescisão",
      "Agenda",
      "DRE Gerencial",
    ],

    Funcionário: [
      "Dashboard",
      "Notificações",
      "Escritório Digital",
      "Clientes",
      "Funcionários",
      "Folha de Pagamento",
      "Pró-labore",
      "Férias",
      "Lançamentos Contábeis",
      "Conciliação Bancária",
      "Fiscal",
      "NF-e",
      "NFS-e",
      "Financeiro",
      "Movimentos Clientes",
      "Pendências Clientes",
      "Acesso Rápido Fiscal",
      "Documentos Digitais",
      "WhatsApp Inteligente",
      "Assistente do Dia",
      "Laboratório Tributário",
      "Certificados Digitais",
      "Procurações e-CAC",
      "Identidade Digital",
      "Central e-CAC",
      "Memória da Nexa",
      "Segundo Contador",
      "Consultora Tributária",
      "Conversa com a Nexa",
      "Radar Inteligente",
      "Relatórios",
      "Calculadora IRPF MEI",
      "Calculadora de Rescisão",
      "Agenda",
      "Sobre",
    ],

    Cliente: [
      "Portal Cliente",
      "Pendências e Guias",
      "Movimentos",
      "Documentos Digitais",
    ],
  }

  useEffect(() => {
    localStorage.removeItem("token")
    localStorage.removeItem("usuario")
    setUsuario(null)
  }, [])

  useEffect(() => {
    if (usuario?.perfil !== "Cliente") return
    const registrar = (tipo = "heartbeat", descricao = "Atividade no Portal") => {
      api.post("/acessos-clientes/atividade", { tipo, pagina: page, descricao }).catch(() => {})
    }
    registrar("pagina", `Visualizou: ${page}`)
    const timer = setInterval(() => registrar(), 60000)
    const aoFocar = () => registrar()
    window.addEventListener("focus", aoFocar)
    return () => { clearInterval(timer); window.removeEventListener("focus", aoFocar) }
  }, [usuario, page])

  useEffect(() => {
    function verificarMobile() {
      setIsMobile(window.innerWidth <= 768)
    }

    verificarMobile()
    window.addEventListener("resize", verificarMobile)

    return () => window.removeEventListener("resize", verificarMobile)
  }, [])

  function sair() {
    localStorage.removeItem("token")
    localStorage.removeItem("usuario")

    setUsuario(null)
    setPage("Dashboard")
  }

  function renderPage() {
    const paginasPermitidas = permissoesPorPerfil[usuario?.perfil] || []

    if (!paginasPermitidas.includes(page)) {
      return <PortalCliente setPage={setPage} />
    }

    switch (page) {
      case "Dashboard":
        return <Dashboard setPage={setPage} />

      case "Notificações":
        return <Notificacoes />

      case "Escritório Digital":
        return <EscritorioDigital setPage={setPage} />

      case "Clientes":
        return <Clientes setPage={setPage} />

      case "Funcionários":
        return <Funcionarios setPage={setPage} />

      case "Folha de Pagamento":
        return <FolhaPagamento setPage={setPage} />

      case "Pró-labore":
        return <ProLabore setPage={setPage} />

      case "Férias":
        return <Ferias setPage={setPage} />

      case "Calculadora de Rescisão":
        return <CalculadoraRescisao setPage={setPage} />

      case "Serviços":
        return <Servicos />

      case "Plano de Contas":
        return <PlanoContas />

      case "Fiscal":
        return <Fiscal />

      case "NF-e":
        return <NFe />

      case "NFS-e":
        return <NFSe />

      case "Financeiro":
        return <Financeiro />

      case "Movimentos":
        return <MovimentosCliente />

      case "Portal Cliente":
        return <PortalCliente setPage={setPage} />

      case "Pendências e Guias":
      case "Obrigações":
        return <ObrigacoesCliente />

      case "Pendências Clientes":
        return <PendenciasClientes />

      case "Pendências":
        return <PendenciasCliente />

      case "Lançamentos Contábeis":
        return <LancamentosContabeis />

      case "Conciliação Bancária":
        return <ConciliacaoBancaria setPage={setPage} />

      case "Acesso Rápido Fiscal":
        return <AcessoRapidoFiscal />

      case "Relatórios":
        return <Relatorios />

      case "Usuários":
        return <Usuarios />

      case "Escritórios Nexa":
        return usuario?.plataformaAdmin ? <EscritoriosNexa /> : <Dashboard />

      case "Documentos Digitais":
        return <DocumentosDigitais />

      case "WhatsApp Inteligente":
        return <WhatsAppInteligente />

      case "Assistente do Dia":
        return <AssistenteDoDia setPage={setPage} />

      case "Laboratório Tributário":
        return <LaboratorioTributario />

      case "Certificados Digitais":
        return <CertificadosDigitais />

      case "Procurações e-CAC":
        return <ProcuracoesEcac />

      case "Identidade Digital":
        return <IdentidadeDigital setPage={setPage} />

      case "Central e-CAC":
        return <CentralEcac key="central-ecac-v2.9.3" usuarioLogado={usuario} />

      case "Memória da Nexa":
        return <MemoriaNexa />

      case "Segundo Contador":
        return <SegundoContador />

      case "Consultora Tributária":
        return <ConsultoraTributaria />

      case "Conversa com a Nexa":
        return <ConversaNexa usuario={usuario} setPage={setPage} />

      case "Radar Inteligente":
        return <RadarInteligente usuario={usuario} setPage={setPage} />

      case "Movimentos Clientes":
        return <MovimentosClientesEscritorio />

      case "Calculadora IRPF MEI":
        return <CalculadoraIRPFMEI />

      case "Agenda":
        return <Agenda />

      case "Backup Sistema":
        return <BackupSistema />

      case "Google Drive":
        return <IntegracaoGoogleDrive />

      case "Sobre":
        return <SobreNexa />

      case "DRE Gerencial":
        return <DRE />

      default:
        return usuario?.perfil === "Cliente" ? (
          <PortalCliente setPage={setPage} />
        ) : (
          <Dashboard />
        )
    }
  }

  if (!usuario) {
    return (
      <Login
        onLogin={(usuarioLogado) => {
          setUsuario(usuarioLogado)

          if (usuarioLogado?.perfil === "Cliente") {
            setPage("Portal Cliente")
          } else {
            setPage("Dashboard")
          }
        }}
      />
    )
  }

  return (
    <div style={styles.body}>
      <div
        style={{
          ...styles.app,
          ...(isMobile ? styles.appMobile : {}),
        }}
      >
        <Sidebar page={page} setPage={setPage} usuario={usuario} />

        <main
          style={{
            ...styles.main,
            ...(isMobile ? styles.mainMobile : {}),
          }}
        >
          <Header title={page} usuario={usuario} onLogout={sair} />

          {renderPage()}
        </main>

        <NexaVoiceListener usuario={usuario} setPage={setPage} page={page} />
      </div>
    </div>
  )
}

const styles = {
  body: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #00112b, #00275c, #00112b)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: "0",
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },

  app: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    width: "100%",
    minHeight: "100vh",
    height: "100vh",
    overflow: "hidden",
  },

  appMobile: {
    display: "block",
    gridTemplateColumns: "none",
    height: "auto",
    minHeight: "100vh",
    overflow: "visible",
    width: "100%",
    maxWidth: "100%",
  },

  main: {
    background: "#082b5d",
    padding: "45px",
    height: "100vh",
    overflowY: "auto",
    overflowX: "hidden",
    width: "100%",
    boxSizing: "border-box",
  },

  mainMobile: {
    padding: "16px 10px",
    height: "auto",
    minHeight: "100vh",
    overflowY: "visible",
    overflowX: "hidden",
    width: "100%",
    maxWidth: "100%",
  },
}
