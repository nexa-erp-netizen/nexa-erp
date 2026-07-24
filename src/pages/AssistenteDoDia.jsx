import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import {
  montarFilaAssistenteDia,
  montarResumoAssistenteDia,
} from "../services/assistenteDiaService"
import { textoClassificacaoPrioridade } from "../services/priorizacaoService"
import { garantirPlanejamentoAnual } from "../services/planejamentoAnualService"
import {
  carregarJornadaDia,
  limparJornadaDia,
  salvarJornadaDia,
} from "../services/jornadaDiaService"
import {
  abrirWhatsAppWeb,
  montarMensagemWhatsApp,
  obterModeloWhatsApp,
  registrarHistoricoWhatsApp,
} from "../services/whatsappService"

export default function AssistenteDoDia({ setPage }) {
  const [clientes, setClientes] = useState([])
  const [fiscal, setFiscal] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [financeiro, setFinanceiro] = useState([])
  const [planejamento, setPlanejamento] = useState([])
  const [certificados, setCertificados] = useState([])
  const [procuracoes, setProcuracoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [atendimentoAtivo, setAtendimentoAtivo] = useState(false)
  const [clienteAtualIndex, setClienteAtualIndex] = useState(0)
  const [acoesConcluidas, setAcoesConcluidas] = useState({})
  const [historicoDia, setHistoricoDia] = useState([])
  const [inicioDia, setInicioDia] = useState(null)

  useEffect(() => {
    carregarDados()
    restaurarProgresso()
  }, [])

  async function carregarDados() {
    setCarregando(true)

    try {
      const [clientesResp, fiscalResp, pendenciasResp, documentosResp, financeiroResp, certificadosResp, procuracoesResp] =
        await Promise.allSettled([
          api.get("/clientes"),
          api.get("/fiscal"),
          api.get("/solicitacoes-clientes"),
          api.get("/documentos-digitais"),
          api.get("/financeiro"),
          api.get("/certificados-digitais"),
          api.get("/procuracoes-ecac"),
        ])

      setClientes(resultadoArray(clientesResp))
      setFiscal(resultadoArray(fiscalResp))
      setPendencias(resultadoArray(pendenciasResp))
      setDocumentos(resultadoArray(documentosResp))
      const clientesLista = resultadoArray(clientesResp)
      const fiscalLista = resultadoArray(fiscalResp)
      setFinanceiro(resultadoArray(financeiroResp))
      setCertificados(resultadoArray(certificadosResp))
      setProcuracoes(resultadoArray(procuracoesResp))
      setPlanejamento(garantirPlanejamentoAnual({ clientes: clientesLista, fiscal: fiscalLista }))
    } catch (error) {
      console.error("Erro ao carregar Assistente do Dia", error)
      alert("Erro ao carregar Assistente do Dia")
    } finally {
      setCarregando(false)
    }
  }

  function resultadoArray(resultado) {
    if (resultado.status !== "fulfilled") return []
    return Array.isArray(resultado.value.data) ? resultado.value.data : []
  }

  function restaurarProgresso() {
    const salvo = carregarJornadaDia()

    setAtendimentoAtivo(salvo.atendimentoAtivo)
    setClienteAtualIndex(salvo.clienteAtualIndex)
    setAcoesConcluidas(salvo.acoesConcluidas)
    setHistoricoDia(salvo.historicoDia)
    setInicioDia(salvo.inicioDia)
  }

  const fila = useMemo(() => {
    return montarFilaAssistenteDia({
      clientes,
      fiscal,
      pendencias,
      documentos,
      financeiro,
      planejamento,
      certificados,
      procuracoes,
    })
  }, [clientes, fiscal, pendencias, documentos, financeiro, planejamento, certificados, procuracoes])

  const resumoBase = useMemo(() => montarResumoAssistenteDia(fila), [fila])

  const progresso = useMemo(() => {
    const totalAcoes = fila.reduce((total, cliente) => total + cliente.acoes.length, 0)
    const concluidas = fila.reduce(
      (total, cliente) => total + cliente.acoes.filter((acao) => acoesConcluidas[acao.id]).length,
      0
    )
    const clientesConcluidos = fila.filter((cliente) => cliente.acoes.every((acao) => acoesConcluidas[acao.id])).length

    return {
      totalAcoes,
      concluidas,
      clientesConcluidos,
      percentual: totalAcoes ? Math.round((concluidas / totalAcoes) * 100) : 0,
    }
  }, [fila, acoesConcluidas])

  const clienteAtual = fila[clienteAtualIndex] || null

  const gruposFila = useMemo(() => {
    const grupos = {
      urgente: [],
      hoje: [],
      proximos: [],
    }

    fila.forEach((cliente, index) => {
      const datas = cliente.acoes
        .map((acao) => diferencaDiasSegura(acao.data))
        .filter((dias) => dias !== null)
      const menorPrazo = datas.length ? Math.min(...datas) : null

      const item = { ...cliente, index }

      if (cliente.nivel === "urgente" || (menorPrazo !== null && menorPrazo < 0)) {
        grupos.urgente.push(item)
      } else if (menorPrazo !== null && menorPrazo <= 0) {
        grupos.hoje.push(item)
      } else {
        grupos.proximos.push(item)
      }
    })

    return grupos
  }, [fila])

  const resumo = { ...resumoBase, progresso: progresso.percentual }
  const expedienteConcluido = fila.length > 0 && progresso.clientesConcluidos === fila.length

  useEffect(() => {
    salvarProgresso()
  }, [atendimentoAtivo, clienteAtualIndex, acoesConcluidas, historicoDia, inicioDia])

  function salvarProgresso() {
    salvarJornadaDia({
      atendimentoAtivo,
      clienteAtualIndex,
      acoesConcluidas,
      historicoDia,
      inicioDia,
    })
  }

  function registrarEvento(texto) {
    const evento = {
      id: `${Date.now()}-${Math.random()}`,
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      texto,
    }

    setHistoricoDia((lista) => [evento, ...lista].slice(0, 80))
  }

  function iniciarDia(index = 0) {
    setAtendimentoAtivo(true)
    setClienteAtualIndex(index)
    if (!inicioDia) setInicioDia(new Date().toISOString())
    registrarEvento(`Dia iniciado em ${fila[index]?.cliente || "cliente da fila"}`)
  }

  function reiniciarDia() {
    if (!confirm("Deseja reiniciar o progresso do Assistente do Dia?")) return

    limparJornadaDia()
    setAtendimentoAtivo(false)
    setClienteAtualIndex(0)
    setAcoesConcluidas({})
    setHistoricoDia([])
    setInicioDia(null)
  }

  function marcarAcao(acao, concluida = true) {
    setAcoesConcluidas((atual) => ({ ...atual, [acao.id]: concluida }))
    registrarEvento(`${concluida ? "Ação concluída" : "Ação reaberta"}: ${acao.titulo} • ${acao.cliente}`)
  }

  function alternarAcao(acao) {
    marcarAcao(acao, !acoesConcluidas[acao.id])
  }

  async function executarAcao(acao) {
    if (!acao) return

    if (acao.tipo === "whatsapp" || acao.destino === "WhatsApp Inteligente") {
      const modelo = obterModeloWhatsApp(acao.modeloWhatsApp || "mensagem_personalizada")
      const clienteDados = acao.clienteDados || { nome: acao.cliente }
      const mensagem = montarMensagemWhatsApp(modelo.id, {
        cliente: clienteDados,
        clienteNome: acao.cliente,
        descricao: acao.descricao,
        vencimento: acao.data,
        competencia: acao.competencia,
        valor: acao.valor,
      })

      const abriu = abrirWhatsAppWeb({ ...clienteDados, mensagem }, mensagem)

      if (abriu) {
        await registrarHistoricoWhatsApp({
          cliente: acao.cliente,
          modelo: modelo.titulo,
          mensagem,
          usuario: "Nexa Assist",
        })
        marcarAcao(acao, true)
      }
      return
    }

    abrirDestino(acao)
    marcarAcao(acao, true)
  }

  function abrirDestino(acao) {
    if (!acao || typeof setPage !== "function") return

    if (acao.destino === "Fiscal") {
      localStorage.setItem("nexaFiltroFiscalCliente", acao.cliente || "")
      localStorage.setItem("nexaFiltroFiscalId", String(acao.referenciaId || ""))
    }

    if (acao.destino === "Documentos Digitais") {
      localStorage.setItem("nexaFiltroDocumentoCliente", acao.cliente || "")
      localStorage.setItem("nexaFiltroDocumentoId", String(acao.referenciaId || ""))
    }

    if (acao.destino === "Pendências Clientes") {
      localStorage.setItem("nexaFiltroPendenciaCliente", acao.cliente || "")
      localStorage.setItem("nexaFiltroPendenciaId", String(acao.referenciaId || ""))
    }

    if (acao.destino === "Clientes" && acao.clienteId) {
      localStorage.setItem("nexaAbrirClienteId", String(acao.clienteId))
      localStorage.setItem("nexaAbrirClienteNome", acao.cliente || "")
      if (acao.secao) localStorage.setItem("nexaAbrirSecaoCliente", String(acao.secao))
    }

    setPage(acao.destino || "Dashboard")
  }

  function diferencaDiasSegura(data) {
    if (!data) return null
    const texto = String(data).slice(0, 10)
    const alvo = new Date(`${texto}T00:00:00`)
    if (Number.isNaN(alvo.getTime())) return null
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return Math.ceil((alvo - hoje) / 86400000)
  }

  function concluirAtendimentoAtual() {
    if (!clienteAtual) return

    const novas = { ...acoesConcluidas }
    clienteAtual.acoes.forEach((acao) => {
      novas[acao.id] = true
    })

    setAcoesConcluidas(novas)
    registrarEvento(`Atendimento concluído: ${clienteAtual.cliente}`)

    setTimeout(() => {
      const proximoIndex = fila.findIndex((cliente, index) => {
        if (index <= clienteAtualIndex) return false
        return !cliente.acoes.every((acao) => novas[acao.id])
      })

      if (proximoIndex >= 0) {
        setClienteAtualIndex(proximoIndex)
        registrarEvento(`Atendimento iniciado: ${fila[proximoIndex].cliente}`)
      }
    }, 150)
  }

  function irProximoCliente() {
    const proximoIndex = fila.findIndex((cliente, index) => {
      if (index <= clienteAtualIndex) return false
      return !cliente.acoes.every((acao) => acoesConcluidas[acao.id])
    })

    if (proximoIndex >= 0) {
      setClienteAtualIndex(proximoIndex)
      registrarEvento(`Atendimento iniciado: ${fila[proximoIndex].cliente}`)
      return
    }

    const qualquerPendente = fila.findIndex((cliente) => !cliente.acoes.every((acao) => acoesConcluidas[acao.id]))

    if (qualquerPendente >= 0) {
      setClienteAtualIndex(qualquerPendente)
      registrarEvento(`Atendimento iniciado: ${fila[qualquerPendente].cliente}`)
      return
    }

    registrarEvento("Expediente concluído")
  }

  function progressoCliente(cliente) {
    if (!cliente?.acoes?.length) return { total: 0, concluidas: 0, percentual: 0, concluido: false }

    const concluidas = cliente.acoes.filter((acao) => acoesConcluidas[acao.id]).length
    const total = cliente.acoes.length

    return {
      total,
      concluidas,
      percentual: Math.round((concluidas / total) * 100),
      concluido: concluidas === total,
    }
  }

  function nivelTexto(nivel) {
    if (nivel === "urgente") return "🔴 Prioridade Alta"
    if (nivel === "atencao") return "🟡 Atenção"
    return "🟢 Programado"
  }

  function textoBotaoAcao(acao) {
    if (acao.tipo === "whatsapp" || acao.destino === "WhatsApp Inteligente") return "Abrir WhatsApp"
    if (acao.destino === "Fiscal") return "Abrir Fiscal"
    if (acao.destino === "Financeiro") return "Abrir Financeiro"
    if (acao.destino === "Documentos Digitais") return "Abrir Documentos"
    if (acao.destino === "Pendências Clientes") return "Abrir Pendências"
    if (acao.destino === "Clientes" && acao.secao === "servicos") return "Abrir cobrança"
    return "Abrir"
  }

  return (
    <div className="assistente-dia-page">
      <style>{css}</style>

      <section className="hero-dia">
        <div className="hero-top">
          <div>
            <h1 className="title">☀️ Assistente do Dia</h1>
            <p className="subtitle">
              Central inteligente para organizar prioridades, atendimentos e o progresso do expediente.
            </p>
          </div>

          <div className="hero-actions">
            {!atendimentoAtivo && fila.length > 0 && (
              <button type="button" className="btn-primary" onClick={() => iniciarDia(0)}>☀️ Iniciar meu dia</button>
            )}
            <button type="button" className="btn-secondary" onClick={carregarDados}>Atualizar fila</button>
            <button type="button" className="btn-danger" onClick={reiniciarDia}>Reiniciar dia</button>
          </div>
        </div>

        <div className="bar-wrap"><div className="bar" style={{ width: `${resumo.progresso}%` }} /></div>

        <div className="resumo-grid">
          <Resumo label="Clientes na fila" value={resumo.clientes} />
          <Resumo label="Concluídos" value={`${progresso.clientesConcluidos}/${fila.length}`} success />
          <Resumo label="Ações concluídas" value={`${progresso.concluidas}/${progresso.totalAcoes}`} blue />
          <Resumo label="Urgentes" value={resumo.urgentes} danger />
          <Resumo label="Atenção" value={resumo.atencao} warning />
        </div>
      </section>

      {carregando ? (
        <div className="empty">Carregando fila do dia...</div>
      ) : fila.length === 0 ? (
        <div className="empty">Nenhuma ação real encontrada para hoje. O escritório está sem pendências críticas no momento.</div>
      ) : expedienteConcluido ? (
        <ResumoFinal fila={fila} progresso={progresso} historicoDia={historicoDia} inicioDia={inicioDia} />
      ) : atendimentoAtivo && clienteAtual ? (
        <section className="atendimento-card">
          <div className="cliente-top">
            <div>
              <div className="cliente-pos">Cliente {clienteAtualIndex + 1} de {fila.length}</div>
              <h2 className="cliente-nome">{clienteAtual.cliente}</h2>
              <div className="nivel">{nivelTexto(clienteAtual.nivel)} <span className="indice">• Índice {clienteAtual.prioridade}</span></div>
            </div>

            <div className="cliente-actions">
              <button type="button" className="btn-success" onClick={concluirAtendimentoAtual}>
                ✓ Concluir atendimento
              </button>
              <button type="button" className="btn-secondary" onClick={() => setAtendimentoAtivo(false)}>
                Ver fila completa
              </button>
            </div>
          </div>

          <ProgressoCliente progresso={progressoCliente(clienteAtual)} />

          <div className="checklist">
            {clienteAtual.acoes.map((acao) => {
              const concluida = Boolean(acoesConcluidas[acao.id])

              return (
                <div className={`check-item ${concluida ? "concluida" : ""}`} key={acao.id}>
                  <button type="button" className="check-toggle" onClick={() => alternarAcao(acao)}>
                    {concluida ? "✅" : "☐"}
                  </button>

                  <div className="check-info">
                    <div className="acao-modulo">{acao.modulo}</div>
                    <div className="acao-titulo">{acao.titulo}</div>
                    <div className="acao-desc">{acao.descricao}</div>
                  </div>

                  <button type="button" className="btn-action" onClick={() => executarAcao(acao)}>
                    {concluida ? "Abrir novamente" : textoBotaoAcao(acao)}
                  </button>
                </div>
              )
            })}
          </div>

          {progressoCliente(clienteAtual).concluido && (
            <div className="cliente-concluido">
              <strong>✅ Cliente concluído</strong>
              <p>Todas as ações deste cliente foram finalizadas.</p>
              <button type="button" className="btn-primary" onClick={irProximoCliente}>Próximo cliente</button>
            </div>
          )}
        </section>
      ) : (
        <div className="fila-wrap">
          <div className="fila-header">
            <div>
              <h2>Fila inteligente do dia</h2>
              <p>Clientes ordenados pelo índice de atenção.</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => iniciarDia(0)}>☀️ Iniciar o dia</button>
          </div>

          <div className="grupos-fila">
            <GrupoFila
              titulo="🔴 Urgente"
              descricao="Atrasos e situações que exigem atenção imediata."
              itens={gruposFila.urgente}
              filaTotal={fila.length}
              progressoCliente={progressoCliente}
              iniciarDia={iniciarDia}
              nivelTexto={nivelTexto}
            />
            <GrupoFila
              titulo="🟡 Hoje"
              descricao="Atividades com vencimento ou execução prevista para hoje."
              itens={gruposFila.hoje}
              filaTotal={fila.length}
              progressoCliente={progressoCliente}
              iniciarDia={iniciarDia}
              nivelTexto={nivelTexto}
            />
            <GrupoFila
              titulo="🔵 Próximos dias"
              descricao="Ações preventivas e compromissos programados."
              itens={gruposFila.proximos}
              filaTotal={fila.length}
              progressoCliente={progressoCliente}
              iniciarDia={iniciarDia}
              nivelTexto={nivelTexto}
            />
          </div>
        </div>
      )}

      {historicoDia.length > 0 && !expedienteConcluido && (
        <section className="historico-box">
          <h3>Histórico do dia</h3>
          {historicoDia.slice(0, 6).map((evento) => (
            <div className="evento" key={evento.id}><span>{evento.hora}</span>{evento.texto}</div>
          ))}
        </section>
      )}
    </div>
  )
}


function GrupoFila({ titulo, descricao, itens, filaTotal, progressoCliente, iniciarDia, nivelTexto }) {
  if (!itens.length) return null

  return (
    <section className="grupo-fila">
      <div className="grupo-header">
        <div>
          <h3>{titulo}</h3>
          <p>{descricao}</p>
        </div>
        <span className="grupo-count">{itens.length}</span>
      </div>

      <div className="fila">
        {itens.map((cliente) => {
          const pc = progressoCliente(cliente)

          return (
            <section className={`cliente-card ${pc.concluido ? "cliente-ok" : ""}`} key={cliente.id || cliente.cliente}>
              <div className="cliente-top">
                <div>
                  <div className="cliente-pos">Cliente {cliente.index + 1} de {filaTotal}</div>
                  <h2 className="cliente-nome">{cliente.cliente}</h2>
                  <div className="nivel">
                    {textoClassificacaoPrioridade(cliente.classificacao)}
                    <span className="indice">• Prioridade {cliente.prioridade}/100</span>
                  </div>
                </div>

                <button type="button" className="btn-atender" onClick={() => iniciarDia(cliente.index)}>
                  {pc.concluido ? "Revisar" : "Iniciar atendimento"}
                </button>
              </div>

              <div className="mini-progress"><div style={{ width: `${pc.percentual}%` }} /></div>
              <div className="mini-text">{pc.concluidas} de {pc.total} ações concluídas</div>

              <div className="motivos">
                <strong>Motivos da prioridade</strong>
                <ul>{cliente.motivos.map((motivo) => <li key={motivo}>{motivo}</li>)}</ul>
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function Resumo({ label, value, danger, warning, success, blue }) {
  const color = danger ? "#ff4d4f" : warning ? "#ffc107" : success ? "#37ff74" : blue ? "#00a8ff" : "white"

  return (
    <div className="resumo-card">
      <div className="resumo-label">{label}</div>
      <div className="resumo-value" style={{ color }}>{value}</div>
    </div>
  )
}

function ProgressoCliente({ progresso }) {
  return (
    <div className="progresso-cliente">
      <div className="progresso-texto">
        <strong>Progresso do cliente</strong>
        <span>{progresso.concluidas} de {progresso.total} ações • {progresso.percentual}%</span>
      </div>
      <div className="bar-wrap"><div className="bar" style={{ width: `${progresso.percentual}%` }} /></div>
    </div>
  )
}

function ResumoFinal({ fila, progresso, historicoDia, inicioDia }) {
  const inicio = inicioDia ? new Date(inicioDia) : null
  const minutos = inicio ? Math.max(1, Math.round((Date.now() - inicio.getTime()) / 60000)) : 0

  return (
    <section className="final-box">
      <div className="final-icon">🎉</div>
      <h2>Expediente concluído</h2>
      <p>Todas as ações encontradas para hoje foram finalizadas.</p>

      <div className="resumo-grid final-grid">
        <Resumo label="Clientes" value={fila.length} />
        <Resumo label="Ações" value={progresso.totalAcoes} blue />
        <Resumo label="Progresso" value="100%" success />
        <Resumo label="Tempo estimado" value={`${minutos} min`} warning />
      </div>

      {historicoDia.length > 0 && (
        <div className="historico-box final-history">
          <h3>Últimas ações</h3>
          {historicoDia.slice(0, 8).map((evento) => (
            <div className="evento" key={evento.id}><span>{evento.hora}</span>{evento.texto}</div>
          ))}
        </div>
      )}
    </section>
  )
}

const css = `
  .assistente-dia-page { color: white; }
  .hero-dia, .atendimento-card, .cliente-card, .fila-wrap, .historico-box, .final-box {
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 24px;
    padding: 24px;
    margin-bottom: 22px;
  }
  .hero-dia { background: linear-gradient(135deg, rgba(0,168,255,.18), rgba(55,255,116,.11)); border-color: rgba(55,255,116,.24); }
  .hero-top, .cliente-top, .fila-header, .progresso-texto {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; flex-wrap: wrap;
  }
  .hero-actions, .cliente-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .title { margin: 0; font-size: 31px; font-weight: 900; }
  .subtitle, .fila-header p, .final-box p { color: #a9b8cc; margin: 8px 0 0; line-height: 1.45; }
  .resumo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 20px; }
  .resumo-card { background: #061f47; border: 1px solid rgba(255,255,255,.10); border-radius: 16px; padding: 16px; }
  .resumo-label { color: #a9b8cc; font-size: 12px; margin-bottom: 7px; }
  .resumo-value { font-size: 25px; font-weight: 900; }
  .bar-wrap, .mini-progress { background: #061f47; border-radius: 999px; overflow: hidden; height: 11px; margin-top: 18px; }
  .bar, .mini-progress div { height: 100%; background: linear-gradient(90deg, #00a8ff, #37ff74); }
  .grupos-fila { display: grid; gap: 22px; }
  .grupo-fila { background: rgba(6,31,71,.55); border: 1px solid rgba(255,255,255,.08); border-radius: 20px; padding: 18px; }
  .grupo-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 15px; }
  .grupo-header h3 { margin: 0; font-size: 20px; }
  .grupo-header p { margin: 6px 0 0; color: #a9b8cc; font-size: 13px; }
  .grupo-count { min-width: 38px; height: 38px; border-radius: 12px; background: #082b5d; display: grid; place-items: center; font-weight: 900; color: #37ff74; }
  .fila { display: grid; gap: 18px; }
  .cliente-card.cliente-ok { border-color: rgba(55,255,116,.35); background: rgba(55,255,116,.08); }
  .cliente-pos, .mini-text { color: #a9b8cc; font-size: 13px; margin-bottom: 6px; }
  .cliente-nome { font-size: 25px; font-weight: 900; margin: 0 0 8px; }
  .nivel { font-weight: 900; }
  .indice { color: #37ff74; font-weight: 900; margin-left: 6px; }
  .btn-primary, .btn-atender, .btn-action, .btn-secondary, .btn-danger, .btn-success {
    border: none; border-radius: 14px; padding: 12px 18px; font-weight: 900; cursor: pointer;
  }
  .btn-primary, .btn-atender, .btn-action { background: linear-gradient(90deg, #00a8ff, #37ff74); color: #00112b; }
  .btn-success { background: #37ff74; color: #00112b; }
  .btn-secondary { background: #061f47; border: 1px solid rgba(255,255,255,.14); color: white; }
  .btn-danger { background: rgba(255,77,79,.14); border: 1px solid rgba(255,77,79,.30); color: #ffb3b3; }
  .motivos { background: #061f47; border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 16px; margin-top: 14px; }
  .motivos strong { display: block; margin-bottom: 10px; }
  .motivos ul { margin: 0; padding-left: 18px; color: #dce8f8; line-height: 1.8; }
  .progresso-cliente { background: #061f47; border-radius: 18px; padding: 18px; margin: 18px 0; }
  .progresso-texto span { color: #a9b8cc; }
  .checklist { display: grid; gap: 12px; }
  .check-item { display: grid; grid-template-columns: 46px 1fr auto; gap: 14px; align-items: center; background: #061f47; border: 1px solid rgba(255,255,255,.10); border-radius: 16px; padding: 14px; }
  .check-item.concluida { background: rgba(55,255,116,.10); border-color: rgba(55,255,116,.35); }
  .check-toggle { background: transparent; border: none; color: white; font-size: 25px; cursor: pointer; }
  .acao-modulo { color: #37ff74; font-weight: 900; font-size: 12px; margin-bottom: 6px; }
  .acao-titulo { font-weight: 900; margin-bottom: 5px; }
  .acao-desc { color: #a9b8cc; font-size: 12px; line-height: 1.35; }
  .cliente-concluido { margin-top: 18px; background: rgba(55,255,116,.10); border: 1px solid rgba(55,255,116,.28); border-radius: 18px; padding: 18px; }
  .cliente-concluido p { color: #dce8f8; }
  .empty { background: #061f47; border: 1px solid rgba(255,255,255,.10); border-radius: 18px; padding: 22px; color: #a9b8cc; }
  .historico-box h3 { margin-top: 0; }
  .evento { display: flex; gap: 12px; border-top: 1px solid rgba(255,255,255,.08); padding: 10px 0; color: #dce8f8; }
  .evento span { color: #37ff74; font-weight: 900; min-width: 48px; }
  .final-box { text-align: center; background: linear-gradient(135deg, rgba(55,255,116,.14), rgba(0,168,255,.10)); }
  .final-icon { font-size: 52px; }
  .final-grid, .final-history { text-align: left; }
  @media (max-width: 720px) {
    .check-item { grid-template-columns: 40px 1fr; }
    .btn-action { grid-column: 1 / -1; }
  }
`
