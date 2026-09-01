import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { calcularDasSimples, calcularFatorR } from "../motorTributario"

const inicial = {
  rbt12: "",
  receitaMensal: "",
  folha12: "",
  anexo: "III",
  percentualB2B: "0,00",
  receitaExcluida: "0,00",
  taxaPresumido: "",
  taxaReal: "",
  fatorR: "auto",
}

export default function ConsultoraTributaria() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [form, setForm] = useState(inicial)
  const [resultado, setResultado] = useState(null)
  const [carregandoClientes, setCarregandoClientes] = useState(true)
  const [erro, setErro] = useState("")
  const [avisoAutomatico, setAvisoAutomatico] = useState("")

  useEffect(() => {
    async function carregarClientes() {
      setCarregandoClientes(true)
      try {
        const resposta = await api.get("/clientes")
        const lista = Array.isArray(resposta.data) ? resposta.data : []
        setClientes(lista)

        const salvo = localStorage.getItem("nexaConsultoraClienteId")
        if (salvo && lista.some((item) => String(item.id) === String(salvo))) {
          setClienteId(String(salvo))
        }
      } catch (error) {
        console.error(error)
        setErro("Não foi possível carregar os clientes.")
      } finally {
        setCarregandoClientes(false)
      }
    }

    carregarClientes()
  }, [])

  const cliente = useMemo(
    () => clientes.find((item) => String(item.id) === String(clienteId)),
    [clientes, clienteId]
  )

  useEffect(() => {
    if (!cliente) return

    localStorage.setItem("nexaConsultoraClienteId", String(cliente.id))
    setResultado(null)
    setErro("")

    const pre = extrairDadosAutomaticos(cliente)

    setForm((atual) => ({
      ...atual,
      rbt12: pre.rbt12 || atual.rbt12,
      receitaMensal: pre.receitaMensal || atual.receitaMensal,
      folha12: pre.folha12 || atual.folha12,
      anexo: cliente.anexoSimples || atual.anexo || "III",
      fatorR: cliente.utilizaFatorR === "Sim" ? "sim" : cliente.utilizaFatorR === "Não" ? "nao" : "auto",
    }))

    const faltantes = []
    if (!pre.rbt12) faltantes.push("RBT12")
    if (!pre.receitaMensal) faltantes.push("receita do mês")
    if (!pre.folha12) faltantes.push("folha de 12 meses")

    setAvisoAutomatico(
      faltantes.length
        ? `A Nexa encontrou o cadastro, mas não localizou automaticamente: ${faltantes.join(", ")}. Preencha esses campos para simular.`
        : "Dados tributários básicos preenchidos automaticamente a partir do cadastro disponível."
    )
  }, [cliente])

  function alterar(campo, valor) {
    setResultado(null)
    setErro("")

    if (CAMPOS_MOEDA.has(campo)) {
      const texto = normalizarDigitacaoMoeda(valor)

      setForm((atual) => {
        const proximo = {
          ...atual,
          [campo]: texto,
        }

        // RBT12 / 12 = média mensal automática.
        if (campo === "rbt12") {
          const rbt12Numerico = parseMoedaBR(texto)
          proximo.receitaMensal = rbt12Numerico > 0
            ? formatarNumeroBR(rbt12Numerico / 12)
            : ""
        }

        return proximo
      })
      return
    }

    if (CAMPOS_PERCENTUAL.has(campo)) {
      setForm((atual) => ({
        ...atual,
        [campo]: normalizarPercentualInput(valor),
      }))
      return
    }

    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function formatarCampoMoeda(campo) {
    setForm((atual) => ({
      ...atual,
      [campo]: formatarNumeroBR(parseMoedaBR(atual[campo])),
    }))
  }

  function analisar(event) {
    event.preventDefault()
    setErro("")

    try {
      const rbt12 = parseMoedaBR(form.rbt12)
      const receitaMensal = parseMoedaBR(form.receitaMensal)
      const folha12 = parseMoedaBR(form.folha12)
      const percentualB2B = limitar(parsePercentualBR(form.percentualB2B), 0, 100)
      const receitaExcluida = limitar(parseMoedaBR(form.receitaExcluida), 0, receitaMensal)
      const receitaTributavel = Math.max(0, receitaMensal - receitaExcluida)

      if (rbt12 <= 0) throw new Error("Informe uma RBT12 maior que zero.")
      if (receitaMensal <= 0) throw new Error("Informe a receita do mês.")
      if (receitaTributavel <= 0) throw new Error("A receita tributável precisa ser maior que zero.")

      const aplicaFatorR =
        form.fatorR === "sim" ||
        (form.fatorR === "auto" && cliente?.utilizaFatorR === "Sim")

      const fator = aplicaFatorR
        ? calcularFatorR({ rbt12, fs12: folha12 })
        : null

      const anexoAplicado = fator?.anexoSugerido || form.anexo

      // Correção importante: o motor espera "receitaPeriodo".
      const simples = calcularDasSimples({
        anexo: anexoAplicado,
        rbt12,
        receitaPeriodo: receitaTributavel,
      })

      const cenarios = [
        criarCenario(
          "Simples Nacional",
          simples.valorDasBase,
          simples.aliquotaEfetivaPercentual,
          "Cálculo-base pela tabela do Simples. O valor definitivo deve ser conferido no PGDAS-D."
        ),
      ]

      const taxaPresumido = taxaValida(form.taxaPresumido)
      if (taxaPresumido !== null) {
        cenarios.push(
          criarCenario(
            "Lucro Presumido",
            receitaMensal * (taxaPresumido / 100),
            taxaPresumido,
            "Estimativa pela taxa efetiva informada. Ainda não é o motor completo do Lucro Presumido."
          )
        )
      }

      const taxaReal = taxaValida(form.taxaReal)
      if (taxaReal !== null) {
        cenarios.push(
          criarCenario(
            "Lucro Real",
            receitaMensal * (taxaReal / 100),
            taxaReal,
            "Estimativa pela taxa efetiva informada. Ainda não é o motor completo do Lucro Real."
          )
        )
      }

      const ordenados = [...cenarios].sort((a, b) => a.valorMensal - b.valorMensal)
      const melhor = ordenados[0]
      const atual = cenarios.find((item) => item.nome === cliente?.regime) || cenarios[0]

      const riscos = []
      const oportunidades = []

      if (rbt12 > 4_800_000) {
        riscos.push("A RBT12 informada ultrapassa o limite geral do Simples Nacional. O enquadramento precisa ser revisado.")
      } else if (rbt12 > 3_600_000) {
        riscos.push("RBT12 acima de R$ 3,6 milhões exige atenção especial a sublimites e ao tratamento de ICMS/ISS.")
      }

      if (anexoAplicado === "IV") {
        riscos.push("No Anexo IV, a CPP patronal fica fora do DAS e precisa ser analisada separadamente.")
      }

      if (receitaExcluida > 0) {
        riscos.push("A receita excluída da base foi informada manualmente e precisa ter fundamento tributário antes de qualquer uso real.")
      }

      if (taxaPresumido === null || taxaReal === null) {
        oportunidades.push("Informe taxas efetivas projetadas de Lucro Presumido e/ou Lucro Real para ampliar a comparação.")
      }

      if (fator && !fator.atingiuLimite) {
        oportunidades.push(
          `Fator R em ${percentual(fator.fatorRPercentual)}. Mantida a mesma receita-base, faltariam ${moeda(fator.folhaAdicionalNecessaria)} de folha acumulada para alcançar matematicamente 28%.`
        )
      }

      if (cenarios.length > 1 && melhor.nome !== atual.nome) {
        oportunidades.push(
          `Neste cenário matemático, ${melhor.nome} apresenta economia linear estimada de ${moeda((atual.valorMensal - melhor.valorMensal) * 12)} em 12 meses frente a ${atual.nome}.`
        )
      }

      setResultado({
        rbt12,
        receitaMensal,
        folha12,
        percentualB2B,
        receitaExcluida,
        receitaTributavel,
        simples,
        fator,
        anexoAplicado,
        cenarios: cenarios.map((cenario) => ({
          ...cenario,
          diferencaParaMelhor: Math.max(0, cenario.valorMensal - melhor.valorMensal),
        })),
        melhor,
        atual,
        riscos,
        oportunidades,
      })
    } catch (error) {
      console.error(error)
      setErro(error.message || "Não foi possível concluir a simulação.")
      setResultado(null)
    }
  }

  function imprimir() {
    window.print()
  }

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div style={styles.heroCopy}>
          <span style={styles.badge}>Nexa • Planejamento Tributário</span>
          <h2 style={styles.title}>Calculadora e Comparador de Regimes</h2>
          <p style={styles.subtitle}>
            Simule o Simples Nacional, Fator R e cenários comparativos com memória de cálculo e projeção anual.
          </p>
        </div>
        <div style={styles.heroPill}>Motor tributário versionável</div>
      </header>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.eyebrow}>Modo automático + manual</span>
            <h3 style={styles.sectionTitle}>Dados da simulação</h3>
          </div>
          <span style={styles.hint}>Selecione o cliente e complete apenas o que a Nexa não encontrar.</span>
        </div>

        <form style={styles.form} onSubmit={analisar}>
          <Campo label="Cliente">
            <select
              style={styles.input}
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              disabled={carregandoClientes}
            >
              <option value="">{carregandoClientes ? "Carregando..." : "Selecione..."}</option>
              {[...clientes]
                .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")))
                .map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
            </select>
          </Campo>

          <Campo label="RBT12">
            <MoedaInput
              value={form.rbt12}
              onChange={(valor) => alterar("rbt12", valor)}
              onBlur={() => formatarCampoMoeda("rbt12")}
              placeholder="0,00" required
            />
          </Campo>

          <Campo label="Receita do mês (média automática do RBT12 ÷ 12)">
            <MoedaInput
              value={form.receitaMensal}
              onChange={(valor) => alterar("receitaMensal", valor)}
              onBlur={() => formatarCampoMoeda("receitaMensal")}
              placeholder="0,00" required
            />
          </Campo>

          <Campo label="Folha dos últimos 12 meses">
            <MoedaInput
              value={form.folha12}
              onChange={(valor) => alterar("folha12", valor)}
              onBlur={() => formatarCampoMoeda("folha12")}
              placeholder="0,00"
            />
          </Campo>

          <Campo label="Fator R">
            <select style={styles.input} value={form.fatorR} onChange={(e) => alterar("fatorR", e.target.value)}>
              <option value="auto">Automático pelo cadastro</option>
              <option value="sim">Aplicar nesta simulação</option>
              <option value="nao">Não aplicar</option>
            </select>
          </Campo>

          <Campo label="Anexo do Simples">
            <select style={styles.input} value={form.anexo} onChange={(e) => alterar("anexo", e.target.value)}>
              {["I", "II", "III", "IV", "V"].map((item) => (
                <option key={item} value={item}>Anexo {item}</option>
              ))}
            </select>
          </Campo>

          <Campo label="% vendas B2B">
            <input
              style={styles.input}
              type="text"
              inputMode="decimal"
              value={form.percentualB2B}
              onChange={(e) => alterar("percentualB2B", e.target.value)}
              placeholder="0,00"
            />
          </Campo>

          <Campo label="Receita excluída da base nesta simulação">
            <MoedaInput
              value={form.receitaExcluida}
              onChange={(valor) => alterar("receitaExcluida", valor)}
              onBlur={() => formatarCampoMoeda("receitaExcluida")}
              placeholder="0,00"
            />
          </Campo>

          <Campo label="Taxa efetiva projetada — Presumido (%)">
            <input
              style={styles.input}
              type="text"
              inputMode="decimal"
              value={form.taxaPresumido}
              onChange={(e) => alterar("taxaPresumido", e.target.value)}
              placeholder="0,00"
            />
          </Campo>

          <Campo label="Taxa efetiva projetada — Real (%)">
            <input
              style={styles.input}
              type="text"
              inputMode="decimal"
              value={form.taxaReal}
              onChange={(e) => alterar("taxaReal", e.target.value)}
              placeholder="0,00"
            />
          </Campo>

          <div style={styles.actions}>
            <button style={styles.primaryButton} type="submit">Calcular cenário</button>
            <button style={styles.secondaryButton} type="button" onClick={() => {
              setForm({
                ...inicial,
                anexo: cliente?.anexoSimples || "III",
                fatorR: cliente?.utilizaFatorR === "Sim" ? "sim" : "auto",
              })
              setResultado(null)
              setErro("")
            }}>
              Limpar simulação
            </button>
          </div>
        </form>

        {cliente && (
          <div style={styles.clientMeta}>
            <strong>{cliente.nome}</strong>
            <span>{cliente.regime || "Regime não informado"}</span>
            <span>{cliente.ramoAtividade || "Ramo não informado"}</span>
            <span>{cliente.utilizaFatorR === "Sim" ? "Sujeito ao Fator R" : "Fator R não indicado"}</span>
          </div>
        )}

        {avisoAutomatico && <div style={styles.autoNotice}>{avisoAutomatico}</div>}
        {erro && <div style={styles.error}>{erro}</div>}
      </section>

      {resultado && (
        <>
          <section style={styles.summaryGrid}>
            <Resumo label="DAS-base estimado" value={moeda(resultado.simples.valorDasBase)} destaque />
            <Resumo label="Alíquota efetiva" value={percentual(resultado.simples.aliquotaEfetivaPercentual)} />
            <Resumo label="Anexo aplicado" value={`Anexo ${resultado.anexoAplicado}`} />
            <Resumo label="Fator R" value={resultado.fator ? percentual(resultado.fator.fatorRPercentual) : "Não aplicado"} />
            <Resumo label="Receita tributável" value={moeda(resultado.receitaTributavel)} />
            <Resumo label="B2B informado" value={percentual(resultado.percentualB2B)} />
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionHeader}>
              <div>
                <span style={styles.eyebrow}>Comparação</span>
                <h3 style={styles.sectionTitle}>Cenários mensais e anuais</h3>
              </div>
              <button type="button" style={styles.secondaryButton} onClick={imprimir}>Imprimir / Salvar PDF</button>
            </div>

            <div style={styles.scenarioGrid}>
              {resultado.cenarios.map((cenario) => {
                const melhor = cenario.nome === resultado.melhor.nome
                return (
                  <article key={cenario.nome} style={{ ...styles.card, ...(melhor ? styles.bestCard : {}) }}>
                    <span style={styles.cardLabel}>{melhor ? "Menor custo matemático" : "Cenário"}</span>
                    <h4 style={styles.cardTitle}>{cenario.nome}</h4>
                    <strong style={styles.bigValue}>{moeda(cenario.valorMensal)}<small style={styles.perMonth}>/mês</small></strong>
                    <span style={styles.rate}>{percentual(cenario.taxaEfetiva)}</span>
                    <span style={styles.annual}>{moeda(cenario.valorAnual)}/ano em projeção linear</span>
                    {cenario.diferencaParaMelhor > 0 && (
                      <span style={styles.diff}>+ {moeda(cenario.diferencaParaMelhor)}/mês vs. menor cenário</span>
                    )}
                    <p style={styles.small}>{cenario.observacao}</p>
                  </article>
                )
              })}
            </div>
          </section>

          <section style={styles.analysisGrid}>
            <Lista titulo="Riscos e pontos de conferência" itens={resultado.riscos} vazio="Nenhum alerta adicional identificado nesta simulação." />
            <Lista titulo="Oportunidades" itens={resultado.oportunidades} vazio="Nenhuma oportunidade adicional identificada com os dados atuais." />
          </section>

          <section style={styles.panel}>
            <span style={styles.eyebrow}>Memória de cálculo</span>
            <h3 style={styles.sectionTitle}>Simples Nacional</h3>
            <div style={styles.memoryGrid}>
              <Info label="RBT12" value={moeda(resultado.rbt12)} />
              <Info label="Faixa" value={`${resultado.simples.faixa}ª faixa`} />
              <Info label="Alíquota nominal" value={percentual(resultado.simples.aliquotaNominalPercentual)} />
              <Info label="Parcela a deduzir" value={moeda(resultado.simples.parcelaDeduzir)} />
              <Info label="Alíquota efetiva" value={percentual(resultado.simples.aliquotaEfetivaPercentual)} />
              <Info label="Receita do mês" value={moeda(resultado.receitaMensal)} />
              <Info label="Receita excluída" value={moeda(resultado.receitaExcluida)} />
              <Info label="Base usada" value={moeda(resultado.receitaTributavel)} />
              <Info label="DAS-base" value={moeda(resultado.simples.valorDasBase)} />
              <Info label="Projeção anual linear" value={moeda(resultado.simples.valorDasBase * 12)} />
            </div>

            {resultado.fator && (
              <div style={styles.factorBox}>
                <strong>Fator R: {percentual(resultado.fator.fatorRPercentual)}</strong>
                <span>{resultado.fator.explicacao}</span>
                <span>{resultado.fator.recomendacao}</span>
              </div>
            )}

            <div style={styles.disclaimer}>
              <strong>Importante:</strong> esta calculadora é ferramenta de planejamento e conferência.
              O DAS definitivo continua sujeito à apuração no PGDAS-D, incluindo segregação de receitas,
              monofásico, ST, retenções, exportações, sublimites e particularidades municipais/estaduais.
              As comparações de Lucro Presumido e Lucro Real usam, nesta etapa, a taxa efetiva informada pelo contador.
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function MoedaInput({ value, onChange, onBlur, placeholder = "0,00", required = false }) {
  return (
    <div style={styles.moneyInputWrap}>
      <span style={styles.moneyPrefix}>R$</span>
      <input
        style={styles.moneyInput}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  )
}

function Resumo({ label, value, destaque = false }) {
  return (
    <div style={{ ...styles.summary, ...(destaque ? styles.summaryHighlight : {}) }}>
      <span style={styles.label}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  )
}

function Lista({ titulo, itens = [], vazio }) {
  return (
    <section style={styles.listCard}>
      <h3 style={styles.sectionTitle}>{titulo}</h3>
      {itens.length ? (
        <ul style={styles.list}>{itens.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <p style={styles.small}>{vazio}</p>
      )}
    </section>
  )
}

function Info({ label, value }) {
  return (
    <div style={styles.info}>
      <span style={styles.label}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function criarCenario(nome, valorMensal, taxaEfetiva, observacao) {
  const mensal = Number(valorMensal || 0)
  return {
    nome,
    valorMensal: mensal,
    valorAnual: mensal * 12,
    taxaEfetiva: Number(taxaEfetiva || 0),
    observacao,
  }
}

function extrairDadosAutomaticos(cliente = {}) {
  const primeiroPositivo = (...valores) => {
    for (const valor of valores) {
      const n = Number(valor)
      if (Number.isFinite(n) && n > 0) return String(n)
    }
    return ""
  }

  return {
    rbt12: primeiroPositivo(
      cliente.rbt12,
      cliente.receitaBruta12Meses,
      cliente.faturamento12Meses,
      cliente.receita12Meses
    ),
    receitaMensal: primeiroPositivo(
      cliente.receitaMensal,
      cliente.faturamentoMensal,
      cliente.receitaMesAtual,
      cliente.faturamentoAtual
    ),
    folha12: primeiroPositivo(
      cliente.folha12,
      cliente.folha12Meses,
      cliente.fs12,
      cliente.folhaAcumulada12Meses
    ),
  }
}

function numero(valor, padrao = NaN) {
  if (valor === "" || valor === null || valor === undefined) return padrao
  const n = Number(valor)
  return Number.isFinite(n) ? n : padrao
}

function limitar(valor, minimo, maximo) {
  if (!Number.isFinite(valor)) return minimo
  return Math.min(Math.max(valor, minimo), maximo)
}

function taxaValida(valor) {
  if (valor === "" || valor === null || valor === undefined) return null
  const n = parsePercentualBR(valor)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const CAMPOS_MOEDA = new Set(["rbt12", "receitaMensal", "folha12", "receitaExcluida"])
const CAMPOS_PERCENTUAL = new Set(["percentualB2B", "taxaPresumido", "taxaReal"])

function parseMoedaBR(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0

  const texto = String(valor ?? "").trim()
  if (!texto) return 0

  const limpo = texto
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")

  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : 0
}

function formatarNumeroBR(valor) {
  const numero = Number(valor)
  const seguro = Number.isFinite(numero) ? Math.max(0, numero) : 0

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(seguro)
}

function normalizarDigitacaoMoeda(valor) {
  return String(valor ?? "")
    .replace(/[^\d.,]/g, "")
    .slice(0, 24)
}

function parsePercentualBR(valor) {
  const texto = String(valor ?? "").trim()
  if (!texto) return 0

  const numero = Number(
    texto
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  )

  return Number.isFinite(numero) ? numero : 0
}

function normalizarPercentualInput(valor) {
  const limpo = String(valor ?? "").replace(/[^\d,]/g, "")
  const partes = limpo.split(",")
  return partes.length <= 1 ? partes[0] : `${partes[0]},${partes.slice(1).join("")}`
}

function moeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0))
}

function percentual(valor) {
  return `${Number(valor || 0).toFixed(2).replace(".", ",")}%`
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px", paddingBottom: "30px" },
  hero: {
    background: "linear-gradient(135deg,#061f47,#063875)",
    border: "1px solid rgba(0,168,255,.28)",
    borderRadius: "22px",
    padding: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },
  heroCopy: { minWidth: 0, flex: "1 1 520px" },
  heroPill: {
    background: "rgba(55,255,116,.10)",
    border: "1px solid rgba(55,255,116,.30)",
    color: "#8fffae",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc", lineHeight: 1.55 },
  panel: {
    background: "rgba(255,255,255,.055)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: "18px",
    padding: "20px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  eyebrow: { color: "#37ff74", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" },
  sectionTitle: { margin: "5px 0 0", fontSize: "18px" },
  hint: { color: "#9fb0c8", fontSize: "12px", maxWidth: "430px" },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "13px" },
  field: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0 },
  label: { color: "#a9b8cc", fontSize: "12px" },
  input: {
    background: "#061f47",
    color: "white",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "10px",
    padding: "11px",
    minWidth: 0,
    boxSizing: "border-box",
    width: "100%",
  },
  moneyInputWrap: {
    display: "flex",
    alignItems: "center",
    background: "#061f47",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "10px",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  moneyPrefix: {
    color: "#8bd7ff",
    fontWeight: "bold",
    paddingLeft: "11px",
    paddingRight: "7px",
    whiteSpace: "nowrap",
  },
  moneyInput: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    background: "transparent",
    color: "white",
    border: 0,
    outline: "none",
    padding: "11px 11px 11px 0",
    font: "inherit",
    boxSizing: "border-box",
  },
  actions: { display: "flex", alignItems: "end", gap: "9px", flexWrap: "wrap" },
  primaryButton: {
    background: "linear-gradient(90deg,#00a8ff,#37d9ff)",
    color: "#00142f",
    border: 0,
    borderRadius: "10px",
    padding: "12px 16px",
    fontWeight: "bold",
    cursor: "pointer",
    minHeight: "42px",
  },
  secondaryButton: {
    background: "#061f47",
    color: "white",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "10px",
    padding: "11px 14px",
    fontWeight: "bold",
    cursor: "pointer",
    minHeight: "42px",
  },
  clientMeta: {
    marginTop: "15px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    color: "#c4d4e9",
    fontSize: "12px",
  },
  autoNotice: {
    marginTop: "12px",
    background: "rgba(0,168,255,.10)",
    border: "1px solid rgba(0,168,255,.25)",
    borderRadius: "12px",
    padding: "12px 14px",
    color: "#c8eaff",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  error: {
    marginTop: "12px",
    background: "rgba(255,95,101,.12)",
    border: "1px solid rgba(255,95,101,.35)",
    borderRadius: "14px",
    padding: "15px",
    color: "#ffb5b8",
  },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px" },
  summary: {
    background: "#061f47",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: "15px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },
  summaryHighlight: { borderColor: "rgba(55,255,116,.50)" },
  summaryValue: { fontSize: "19px", color: "white" },
  scenarioGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: "15px" },
  card: {
    background: "#061f47",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "18px",
    padding: "19px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  bestCard: { borderColor: "rgba(55,255,116,.65)", boxShadow: "0 0 0 1px rgba(55,255,116,.10)" },
  cardLabel: { color: "#37ff74", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" },
  cardTitle: { margin: 0, fontSize: "19px" },
  bigValue: { color: "white", fontSize: "25px" },
  perMonth: { fontSize: "12px", color: "#9fb0c8", marginLeft: "3px" },
  rate: { color: "#8bd7ff", fontWeight: "bold" },
  annual: { color: "#c5d2e5" },
  diff: { color: "#ffcf70", fontSize: "13px" },
  small: { color: "#a9b8cc", lineHeight: 1.5, margin: 0, fontSize: "12px" },
  analysisGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "15px" },
  listCard: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: "17px",
    padding: "18px",
  },
  list: { margin: 0, paddingLeft: "20px", color: "#dce8f8", lineHeight: 1.7 },
  memoryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "11px", marginTop: "14px" },
  info: {
    background: "#061f47",
    borderRadius: "12px",
    padding: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    border: "1px solid rgba(255,255,255,.08)",
  },
  factorBox: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "12px",
    background: "rgba(55,255,116,.07)",
    border: "1px solid rgba(55,255,116,.22)",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    color: "#dfffe8",
    fontSize: "12px",
    lineHeight: 1.55,
  },
  disclaimer: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "12px",
    background: "rgba(255,207,112,.07)",
    border: "1px solid rgba(255,207,112,.22)",
    color: "#e9d9bb",
    fontSize: "12px",
    lineHeight: 1.6,
  },
}
