import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function MovimentosClientesEscritorio() {
  const [movimentos, setMovimentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [clienteFiltro, setClienteFiltro] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("")
  const [dataInicial, setDataInicial] = useState("")
  const [dataFinal, setDataFinal] = useState("")
  const [carregando, setCarregando] = useState(false)

  const [duplicadosAbertos, setDuplicadosAbertos] = useState(false)
  const [gruposDuplicados, setGruposDuplicados] = useState([])
  const [carregandoDuplicados, setCarregandoDuplicados] = useState(false)
  const [removendoDuplicados, setRemovendoDuplicados] = useState(false)
  const [gruposSelecionados, setGruposSelecionados] = useState([])

  useEffect(() => {
    definirPeriodoMesAtual()
    carregarClientes()
  }, [])

  useEffect(() => {
    if (!clienteFiltro) {
      setMovimentos([])
      return
    }

    carregarMovimentosDoCliente(clienteFiltro)
  }, [clienteFiltro, clientes])

  function definirPeriodoMesAtual() {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth()

    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)

    setDataInicial(formatarDataInput(primeiroDia))
    setDataFinal(formatarDataInput(ultimoDia))
  }

  function formatarDataInput(data) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, "0")
    const dia = String(data.getDate()).padStart(2, "0")
    return `${ano}-${mes}-${dia}`
  }

  function normalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      const clientesDados = Array.isArray(resposta.data) ? resposta.data : []
      const clientesOrdenados = clientesDados
        .slice()
        .sort((a, b) =>
          String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
            sensitivity: "base",
          })
        )

      setClientes(clientesOrdenados)

      const filtroId = localStorage.getItem("nexaFiltroMovimentosClienteId")
      const filtroNome = localStorage.getItem("nexaFiltroMovimentosCliente")

      let clienteInicial = null

      if (filtroId) {
        clienteInicial = clientesOrdenados.find(
          (cliente) => String(cliente.id) === String(filtroId)
        )
      }

      if (!clienteInicial && filtroNome) {
        const nomeNormalizado = normalizarTexto(filtroNome)
        clienteInicial = clientesOrdenados.find(
          (cliente) => normalizarTexto(cliente.nome) === nomeNormalizado
        )
      }

      if (clienteInicial) {
        setClienteFiltro(String(clienteInicial.id))
      }

      localStorage.removeItem("nexaFiltroMovimentosClienteId")
      localStorage.removeItem("nexaFiltroMovimentosCliente")
    } catch (error) {
      console.error("ERRO AO CARREGAR CLIENTES:", error)
      setClientes([])
    }
  }

  async function carregarMovimentosDoCliente(clienteId) {
    const cliente = clientes.find(
      (item) => String(item.id) === String(clienteId)
    )

    if (!cliente) {
      setMovimentos([])
      return
    }

    try {
      setCarregando(true)

      const resposta = await api.get("/movimentos-cliente", {
        params: {
          clienteId: cliente.id,
        },
      })

      setMovimentos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("ERRO AO CARREGAR MOVIMENTOS DO CLIENTE:", error)
      setMovimentos([])
    } finally {
      setCarregando(false)
    }
  }

  function valorSeguro(valor) {
    if (!valor) return 0

    let texto = String(valor).replace("R$", "").trim()

    if (texto.includes(",")) {
      texto = texto.replace(/\./g, "").replace(",", ".")
    }

    const numero = Number(texto)
    return Number.isFinite(numero) ? numero : 0
  }

  function formatarMoeda(valor) {
    return valorSeguro(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function formatarData(data) {
    if (!data) return "-"
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR")
  }

  function formatarHora(data) {
    if (!data) return "-"
    const parsed = new Date(data)
    if (Number.isNaN(parsed.getTime())) return "-"
    return parsed.toLocaleString("pt-BR")
  }

  function competenciaDuplicados() {
    const ini = String(dataInicial || "").slice(0, 7)
    const fim = String(dataFinal || "").slice(0, 7)

    if (!ini || !fim || ini !== fim) return ""

    const [ano, mes] = ini.split("-")
    return `${mes}/${ano}`
  }

  async function carregarPossiveisDuplicados(abrir = true) {
    if (!clienteSelecionado) {
      alert("Selecione um cliente primeiro.")
      return
    }

    if (abrir) setDuplicadosAbertos(true)
    setCarregandoDuplicados(true)

    try {
      const resposta = await api.get("/movimentos-cliente/duplicados", {
        params: {
          cliente: clienteSelecionado.nome,
          ...(competenciaDuplicados()
            ? { competencia: competenciaDuplicados() }
            : {}),
        },
      })

      setGruposDuplicados(
        Array.isArray(resposta.data?.grupos)
          ? resposta.data.grupos
          : []
      )
      setGruposSelecionados([])
    } catch (error) {
      console.error("ERRO AO LOCALIZAR DUPLICADOS:", error)
      alert(
        error?.response?.data?.message ||
        "Erro ao localizar possíveis duplicados."
      )
    } finally {
      setCarregandoDuplicados(false)
    }
  }

  function chaveGrupoDuplicado(grupo) {
    return String(
      grupo.manterSugeridoId ||
      `${grupo.data}-${grupo.descricao}-${grupo.valorUnitario}`
    )
  }

  function alternarGrupoSelecionado(grupo) {
    if (grupo.confianca !== "Alta") return

    const chave = chaveGrupoDuplicado(grupo)

    setGruposSelecionados((atuais) =>
      atuais.includes(chave)
        ? atuais.filter((item) => item !== chave)
        : [...atuais, chave]
    )
  }

  function selecionarTodosAltaChance() {
    const chaves = gruposDuplicados
      .filter(
        (grupo) =>
          grupo.confianca === "Alta" &&
          Array.isArray(grupo.excluirSugeridosIds) &&
          grupo.excluirSugeridosIds.length > 0
      )
      .map(chaveGrupoDuplicado)

    const todosJaSelecionados =
      chaves.length > 0 &&
      chaves.every((chave) => gruposSelecionados.includes(chave))

    setGruposSelecionados(todosJaSelecionados ? [] : chaves)
  }

  async function removerGruposSelecionados() {
    const selecionados = gruposDuplicados.filter(
      (grupo) =>
        grupo.confianca === "Alta" &&
        gruposSelecionados.includes(chaveGrupoDuplicado(grupo)) &&
        Array.isArray(grupo.excluirSugeridosIds) &&
        grupo.excluirSugeridosIds.length > 0
    )

    if (!selecionados.length) {
      alert("Selecione pelo menos um grupo de alta chance.")
      return
    }

    const totalDuplicados = selecionados.reduce(
      (total, grupo) => total + grupo.excluirSugeridosIds.length,
      0
    )

    const confirmar = window.confirm(
      `Você selecionou ${selecionados.length} grupo(s), com ` +
      `${totalDuplicados} lançamento(s) duplicado(s).\n\n` +
      "A Nexa manterá 1 lançamento de cada grupo e removerá somente os excedentes.\n\n" +
      "Deseja continuar?"
    )

    if (!confirmar) return

    setRemovendoDuplicados(true)

    let removidos = 0

    try {
      for (const grupo of selecionados) {
        await api.post("/movimentos-cliente/duplicados/remover", {
          confirmar: true,
          manterId: grupo.manterSugeridoId,
          idsExcluir: grupo.excluirSugeridosIds,
        })

        removidos += grupo.excluirSugeridosIds.length
      }

      await carregarMovimentosDoCliente(clienteFiltro)
      await carregarPossiveisDuplicados(false)
      setGruposSelecionados([])

      alert(
        `${removidos} lançamento(s) duplicado(s) removido(s) com sucesso.`
      )
    } catch (error) {
      console.error("ERRO AO REMOVER DUPLICADOS SELECIONADOS:", error)

      await carregarMovimentosDoCliente(clienteFiltro)
      await carregarPossiveisDuplicados(false)
      setGruposSelecionados([])

      alert(
        (removidos > 0
          ? `${removidos} duplicado(s) foram removidos antes da falha. `
          : "") +
        (error?.response?.data?.message ||
          "Erro ao remover os duplicados selecionados.")
      )
    } finally {
      setRemovendoDuplicados(false)
    }
  }

  async function removerGrupoDuplicado(grupo) {
    const idsExcluir = Array.isArray(grupo.excluirSugeridosIds)
      ? grupo.excluirSugeridosIds
      : []

    if (!idsExcluir.length) return

    const confirmar = window.confirm(
      `Cliente: ${grupo.cliente}\n` +
      `${formatarData(grupo.data)} — ${grupo.descricao}\n` +
      `${formatarMoeda(grupo.valorUnitario)}\n\n` +
      `Manter o ID ${grupo.manterSugeridoId} e remover ` +
      `${idsExcluir.length} duplicado(s)?`
    )

    if (!confirmar) return

    setRemovendoDuplicados(true)

    try {
      await api.post("/movimentos-cliente/duplicados/remover", {
        confirmar: true,
        manterId: grupo.manterSugeridoId,
        idsExcluir,
      })

      await carregarMovimentosDoCliente(clienteFiltro)
      await carregarPossiveisDuplicados(false)

      alert("Duplicado(s) removido(s) com sucesso.")
    } catch (error) {
      console.error("ERRO AO REMOVER DUPLICADOS:", error)
      alert(
        error?.response?.data?.message ||
        "Erro ao remover os duplicados confirmados."
      )
    } finally {
      setRemovendoDuplicados(false)
    }
  }

  const clienteSelecionado = useMemo(
    () =>
      clientes.find((cliente) => String(cliente.id) === String(clienteFiltro)) ||
      null,
    [clientes, clienteFiltro]
  )

  const movimentosFiltrados = useMemo(() => {
    if (!clienteSelecionado) return []

    return movimentos.filter((item) => {
      if (tipoFiltro && item.tipo !== tipoFiltro) return false
      if (dataInicial && item.data < dataInicial) return false
      if (dataFinal && item.data > dataFinal) return false

      return true
    })
  }, [
    movimentos,
    clienteSelecionado,
    tipoFiltro,
    dataInicial,
    dataFinal,
  ])

  const resumo = useMemo(() => {
    if (!clienteSelecionado) {
      return {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        total: 0,
      }
    }

    const receitas = movimentosFiltrados
      .filter((item) => item.tipo === "Receita")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const despesas = movimentosFiltrados
      .filter((item) => item.tipo === "Despesa")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      total: movimentosFiltrados.length,
    }
  }, [movimentosFiltrados, clienteSelecionado])

  const gruposAltaChance = gruposDuplicados.filter(
    (grupo) =>
      grupo.confianca === "Alta" &&
      Array.isArray(grupo.excluirSugeridosIds) &&
      grupo.excluirSugeridosIds.length > 0
  )

  const gruposSelecionadosValidos = gruposAltaChance.filter((grupo) =>
    gruposSelecionados.includes(chaveGrupoDuplicado(grupo))
  )

  const totalDuplicadosSelecionados = gruposSelecionadosValidos.reduce(
    (total, grupo) => total + grupo.excluirSugeridosIds.length,
    0
  )

  const todosAltaChanceSelecionados =
    gruposAltaChance.length > 0 &&
    gruposAltaChance.every((grupo) =>
      gruposSelecionados.includes(chaveGrupoDuplicado(grupo))
    )

  return (
    <div className="me-page">
      <style>{`
        .me-page { padding: 30px; color: white; }
        .me-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
        .me-box { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 18px; }
        .me-box span { display: block; opacity: .7; margin-bottom: 8px; }
        .me-box strong { font-size: 20px; }
        .green { color: #32f06d; }
        .red { color: #ff5c70; }
        .blue { color: #3cbcff; }
        .me-card { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 24px; padding: 24px; margin-bottom: 25px; }
        .me-filtros { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr auto; gap: 14px; align-items: center; }
        .me-input, .me-select { width: 100%; height: 48px; background: #061f47; border: 1px solid rgba(255,255,255,.14); color: white; border-radius: 12px; padding: 0 14px; box-sizing: border-box; outline: none; }
        .me-select option { background: #061f47; color: white; }
        input[type="date"] { color-scheme: dark; }
        .me-btn { height: 48px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; padding: 0 16px; background: #061f47; color: white; font-weight: 900; cursor: pointer; white-space: nowrap; }
        .me-btn:disabled { opacity: .55; cursor: not-allowed; }
        .me-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .me-table th { color: #6bd8ff; text-align: left; padding: 12px; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 13px; }
        .me-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 14px; }
        .me-table th:nth-child(1), .me-table td:nth-child(1) { width: 210px; }
        .me-table th:nth-child(2), .me-table td:nth-child(2) { width: 110px; }
        .me-table th:nth-child(3), .me-table td:nth-child(3) { width: 100px; }
        .me-table th:nth-child(6), .me-table td:nth-child(6) { width: 130px; }
        .tipo-receita { color: #32f06d; font-weight: 900; }
        .tipo-despesa { color: #ff5c70; font-weight: 900; }
        .valor { text-align: right; font-weight: 800; white-space: nowrap; }
        .empty { opacity: .7; padding: 18px; }
        .me-dup-overlay { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0, 8, 24, .78); backdrop-filter: blur(4px); }
        .me-dup-modal { width: min(720px, 100%); max-height: 84vh; overflow: auto; background: #071f43; border: 1px solid rgba(107,216,255,.34); border-radius: 20px; padding: 20px; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
        .me-dup-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
        .me-dup-bulk { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 0 0 14px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09); }
        .me-dup-select-all { display: inline-flex; align-items: center; gap: 9px; color: #d8e7f5; font-size: 13px; font-weight: 800; cursor: pointer; }
        .me-dup-select-all input, .me-dup-check input { width: 17px; height: 17px; accent-color: #32f06d; cursor: pointer; }
        .me-dup-bulk-remove { min-height: 42px; border: 0; border-radius: 10px; padding: 0 15px; background: #ad3349; color: white; font-weight: 900; cursor: pointer; }
        .me-dup-bulk-remove:disabled { opacity: .5; cursor: not-allowed; }
        .me-dup-check { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
        .me-dup-check strong { min-width: 0; }
        .me-dup-group.selected { outline: 2px solid rgba(50,240,109,.52); background: #0d315f; }
        .me-dup-title { font-size: 22px; font-weight: 900; }
        .me-dup-subtitle { color: #aec4df; margin-top: 5px; font-size: 13px; }
        .me-dup-list { display: grid; gap: 12px; }
        .me-dup-group { background: #0b2855; border: 1px solid rgba(255,255,255,.09); border-radius: 14px; padding: 14px; }
        .me-dup-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .me-dup-confidence { padding: 5px 8px; border-radius: 999px; font-size: 11px; font-weight: 900; background: #664d09; color: #ffe69c; white-space: nowrap; }
        .me-dup-confidence.high { background: #0d5d4c; color: #9effdf; }
        .me-dup-meta { color: #c7dbed; font-size: 13px; line-height: 1.5; margin-top: 7px; }
        .me-dup-ids { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.08); color: #a9c4dd; font-size: 12px; line-height: 1.55; }
        .me-dup-remove { width: 100%; margin-top: 12px; height: 42px; border: 0; border-radius: 10px; background: #ad3349; color: white; font-weight: 900; cursor: pointer; }
        .me-dup-remove:disabled { opacity: .55; cursor: not-allowed; }
        @media (max-width: 1100px) { .me-filtros { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 900px) { .me-summary, .me-filtros { grid-template-columns: 1fr; } .me-page { padding: 18px; } .me-card { overflow-x: auto; } }
      `}</style>

      <div className="me-card">
        <div className="me-filtros">
          <select
            className="me-select"
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          >
            <option value="">Selecione um cliente</option>

            {clientes.map((cliente) => (
              <option key={cliente.id} value={String(cliente.id)}>
                {cliente.nome}
              </option>
            ))}
          </select>

          <select
            className="me-select"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            disabled={!clienteSelecionado}
          >
            <option value="">Todos os tipos</option>
            <option value="Receita">Receitas</option>
            <option value="Despesa">Despesas</option>
          </select>

          <input
            className="me-input"
            type="date"
            value={dataInicial}
            onChange={(e) => setDataInicial(e.target.value)}
            disabled={!clienteSelecionado}
          />

          <input
            className="me-input"
            type="date"
            value={dataFinal}
            onChange={(e) => setDataFinal(e.target.value)}
            disabled={!clienteSelecionado}
          />

          <button
            type="button"
            className="me-btn"
            disabled={!clienteSelecionado || carregandoDuplicados || removendoDuplicados}
            onClick={() => carregarPossiveisDuplicados(true)}
          >
            {carregandoDuplicados ? "Procurando..." : "Possíveis duplicados"}
          </button>
        </div>
      </div>

      {clienteSelecionado && (
        <>
          <div className="me-summary">
            <div className="me-box">
              <span>Receitas</span>
              <strong className="green">{formatarMoeda(resumo.receitas)}</strong>
            </div>
            <div className="me-box">
              <span>Despesas</span>
              <strong className="red">{formatarMoeda(resumo.despesas)}</strong>
            </div>
            <div className="me-box">
              <span>Saldo</span>
              <strong className={resumo.saldo >= 0 ? "green" : "red"}>
                {formatarMoeda(resumo.saldo)}
              </strong>
            </div>
            <div className="me-box">
              <span>Lançamentos</span>
              <strong className="blue">{resumo.total}</strong>
            </div>
          </div>

          <div className="me-card">
            <table className="me-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Plano de contas</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {movimentosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td>{item.cliente || clienteSelecionado.nome}</td>
                    <td>{formatarData(item.data)}</td>
                    <td className={item.tipo === "Receita" ? "tipo-receita" : "tipo-despesa"}>{item.tipo}</td>
                    <td>{item.planoContaNome || "-"}</td>
                    <td>{item.descricao}</td>
                    <td className="valor">{formatarMoeda(item.valor)}</td>
                  </tr>
                ))}

                {!carregando && movimentosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty">
                      Nenhum movimento encontrado para este cliente no período selecionado.
                    </td>
                  </tr>
                )}

                {carregando && (
                  <tr>
                    <td colSpan="6" className="empty">
                      Carregando lançamentos...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {duplicadosAbertos && (
        <div className="me-dup-overlay">
          <div className="me-dup-modal" role="dialog" aria-modal="true">
            <div className="me-dup-header">
              <div>
                <div className="me-dup-title">Possíveis duplicados</div>
                <div className="me-dup-subtitle">
                  {clienteSelecionado?.nome || "-"}
                  {competenciaDuplicados() ? ` • ${competenciaDuplicados()}` : " • período sem competência única"}
                </div>
              </div>
              <button
                type="button"
                className="me-btn"
                disabled={removendoDuplicados}
                onClick={() => setDuplicadosAbertos(false)}
              >
                Fechar
              </button>
            </div>

            {!carregandoDuplicados && gruposAltaChance.length > 0 && (
              <div className="me-dup-bulk">
                <label className="me-dup-select-all">
                  <input
                    type="checkbox"
                    checked={todosAltaChanceSelecionados}
                    disabled={removendoDuplicados}
                    onChange={selecionarTodosAltaChance}
                  />
                  Selecionar todos de Alta chance ({gruposAltaChance.length})
                </label>

                <button
                  type="button"
                  className="me-dup-bulk-remove"
                  disabled={
                    removendoDuplicados ||
                    totalDuplicadosSelecionados === 0
                  }
                  onClick={removerGruposSelecionados}
                >
                  {removendoDuplicados
                    ? "Removendo..."
                    : `Remover selecionados (${totalDuplicadosSelecionados})`}
                </button>
              </div>
            )}

            {carregandoDuplicados ? (
              <div className="empty">Procurando possíveis duplicados...</div>
            ) : gruposDuplicados.length === 0 ? (
              <div className="empty">Nenhum possível duplicado encontrado.</div>
            ) : (
              <div className="me-dup-list">
                {gruposDuplicados.map((grupo, index) => (
                  <div
                    className={`me-dup-group ${
                      gruposSelecionados.includes(chaveGrupoDuplicado(grupo))
                        ? "selected"
                        : ""
                    }`}
                    key={`${grupo.data}-${grupo.descricao}-${grupo.valorUnitario}-${index}`}
                  >
                    <div className="me-dup-top">
                      <div className="me-dup-check">
                        {grupo.confianca === "Alta" &&
                          Array.isArray(grupo.excluirSugeridosIds) &&
                          grupo.excluirSugeridosIds.length > 0 && (
                            <input
                              type="checkbox"
                              checked={gruposSelecionados.includes(
                                chaveGrupoDuplicado(grupo)
                              )}
                              disabled={removendoDuplicados}
                              onChange={() => alternarGrupoSelecionado(grupo)}
                              aria-label={`Selecionar ${grupo.descricao}`}
                            />
                          )}
                        <strong>
                          {formatarData(grupo.data)} — {grupo.descricao}
                        </strong>
                      </div>
                      <span className={`me-dup-confidence ${grupo.confianca === "Alta" ? "high" : ""}`}>
                        {grupo.confianca === "Alta" ? "Alta chance" : "Revisar"}
                      </span>
                    </div>

                    <div className="me-dup-meta">
                      {grupo.tipo} • {grupo.planoContaNome || "-"} • {grupo.formaPagamento || "-"} • {formatarMoeda(grupo.valorUnitario)}
                      <br />
                      {grupo.quantidade} registros iguais • possível excesso: {formatarMoeda(grupo.valorPossivelmenteDuplicado)}
                    </div>

                    <div className="me-dup-ids">
                      {(grupo.movimentos || []).map((movimento, movimentoIndex) => (
                        <div key={movimento.id}>
                          ID {movimento.id} • criado em {formatarHora(movimento.createdAt)}
                          {movimentoIndex === 0 ? " • manter" : " • possível duplicado"}
                        </div>
                      ))}
                    </div>

                    {grupo.confianca === "Alta" ? (
                      <button
                        type="button"
                        className="me-dup-remove"
                        disabled={removendoDuplicados}
                        onClick={() => removerGrupoDuplicado(grupo)}
                      >
                        {removendoDuplicados
                          ? "Removendo..."
                          : `Manter 1 e remover ${grupo.excluirSugeridosIds?.length || 0} duplicado(s)`}
                      </button>
                    ) : (
                      <div className="me-dup-meta">
                        Revise manualmente antes de excluir. Este grupo não oferece remoção em lote.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
