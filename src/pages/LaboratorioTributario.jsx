import { useMemo, useState } from "react"
import {
  MODOS_FATOR_R,
  calcularAliquotaEfetivaSimples,
  calcularDasSimples,
  analisarPlanejamentoTributario,
  calcularFatorR,
  compararAnexosFatorR,
} from "../motorTributario"

const formatarMoeda = (valor) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0))

const formatarPercentual = (valor, casas = 2) =>
  `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`

function numeroCampo(valor) {
  if (valor === "" || valor === null || valor === undefined) return 0
  const texto = String(valor).trim().replace(/\./g, "").replace(",", ".")
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : 0
}

export default function LaboratorioTributario() {
  const [form, setForm] = useState({
    anexo: "III",
    rbt12: "600000",
    fs12: "180000",
    receitaPeriodo: "50000",
    atividadeFatorR: true,
    modoFatorR: MODOS_FATOR_R.NORMAL,
    folhaPeriodo: "",
    receitaAbertura: "",
    folhaAcumulada: "",
    receitaAcumulada: "",
  })
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState("")

  const valores = useMemo(
    () => ({
      rbt12: numeroCampo(form.rbt12),
      fs12: numeroCampo(form.fs12),
      receitaPeriodo: numeroCampo(form.receitaPeriodo),
      folhaPeriodo: numeroCampo(form.folhaPeriodo),
      receitaPeriodoAbertura: numeroCampo(form.receitaAbertura),
      folhaAcumulada: numeroCampo(form.folhaAcumulada),
      receitaAcumulada: numeroCampo(form.receitaAcumulada),
    }),
    [form],
  )

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function analisar(event) {
    event.preventDefault()
    setErro("")

    try {
      if (valores.rbt12 <= 0) {
        throw new Error("Informe uma RBT12 maior que zero para calcular a alíquota efetiva.")
      }

      let fatorR = null
      let anexoAplicado = form.anexo

      if (form.atividadeFatorR) {
        fatorR = calcularFatorR({
          modo: form.modoFatorR,
          fs12: valores.fs12,
          rbt12: valores.rbt12,
          folhaPeriodo: valores.folhaPeriodo,
          receitaPeriodo: valores.receitaPeriodoAbertura,
          folhaAcumulada: valores.folhaAcumulada,
          receitaAcumulada: valores.receitaAcumulada,
        })
        anexoAplicado = fatorR.anexoSugerido
      }

      const aliquota = calcularAliquotaEfetivaSimples(anexoAplicado, valores.rbt12)
      const das = calcularDasSimples({
        anexo: anexoAplicado,
        rbt12: valores.rbt12,
        receitaPeriodo: valores.receitaPeriodo,
      })
      const comparacao = form.atividadeFatorR
        ? compararAnexosFatorR({
            rbt12: valores.rbt12,
            receitaPeriodo: valores.receitaPeriodo,
          })
        : null

      const planejamento = analisarPlanejamentoTributario({
        rbt12: valores.rbt12,
        receitaPeriodo: valores.receitaPeriodo,
        fatorR,
        comparacaoAnexos: comparacao,
        das,
      })

      setResultado({
        fatorR,
        aliquota,
        das,
        comparacao,
        planejamento,
        anexoAplicado,
        receitaPeriodo: valores.receitaPeriodo,
      })
    } catch (falha) {
      setResultado(null)
      setErro(falha?.message || "Não foi possível concluir a análise.")
    }
  }

  function limpar() {
    setResultado(null)
    setErro("")
    setForm({
      anexo: "III",
      rbt12: "",
      fs12: "",
      receitaPeriodo: "",
      atividadeFatorR: true,
      modoFatorR: MODOS_FATOR_R.NORMAL,
      folhaPeriodo: "",
      receitaAbertura: "",
      folhaAcumulada: "",
      receitaAcumulada: "",
    })
  }

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.badge}>Nexa Core</span>
          <h1 style={styles.title}>Laboratório Tributário</h1>
          <p style={styles.subtitle}>
            Ambiente interno para testar cenários do Simples Nacional sem alterar clientes reais.
          </p>
        </div>
        <div style={styles.heroStatus}>
          <span style={styles.heroLabel}>Ambiente</span>
          <strong style={styles.heroValue}>Simulação</strong>
          <span style={styles.heroNote}>Somente Administrador</span>
        </div>
      </section>

      <div style={styles.gridPrincipal}>
        <form onSubmit={analisar} style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Dados do cenário</h2>
              <p style={styles.cardText}>Preencha os valores para a análise da Nexa.</p>
            </div>
          </div>

          <div style={styles.formGrid}>
            <Campo label="RBT12 — Receita dos 12 meses" required>
              <input
                value={form.rbt12}
                onChange={(e) => alterar("rbt12", e.target.value)}
                style={styles.input}
                inputMode="decimal"
                placeholder="Ex.: 600000"
              />
            </Campo>

            <Campo label="Receita do período atual" required>
              <input
                value={form.receitaPeriodo}
                onChange={(e) => alterar("receitaPeriodo", e.target.value)}
                style={styles.input}
                inputMode="decimal"
                placeholder="Ex.: 50000"
              />
            </Campo>

            <Campo label="Atividade sujeita ao Fator R?">
              <select
                value={form.atividadeFatorR ? "sim" : "nao"}
                onChange={(e) => alterar("atividadeFatorR", e.target.value === "sim")}
                style={styles.input}
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </Campo>

            {!form.atividadeFatorR && (
              <Campo label="Anexo informado">
                <select value={form.anexo} onChange={(e) => alterar("anexo", e.target.value)} style={styles.input}>
                  <option value="I">Anexo I</option>
                  <option value="II">Anexo II</option>
                  <option value="III">Anexo III</option>
                  <option value="IV">Anexo IV</option>
                  <option value="V">Anexo V</option>
                </select>
              </Campo>
            )}

            {form.atividadeFatorR && (
              <>
                <Campo label="Modo do Fator R">
                  <select
                    value={form.modoFatorR}
                    onChange={(e) => alterar("modoFatorR", e.target.value)}
                    style={styles.input}
                  >
                    <option value={MODOS_FATOR_R.NORMAL}>Empresa com 13 meses ou mais</option>
                    <option value={MODOS_FATOR_R.MES_ABERTURA}>Mês de abertura</option>
                    <option value={MODOS_FATOR_R.INICIO_ATIVIDADE}>Início de atividade</option>
                  </select>
                </Campo>

                {form.modoFatorR === MODOS_FATOR_R.NORMAL && (
                  <Campo label="FS12 — Folha dos 12 meses">
                    <input
                      value={form.fs12}
                      onChange={(e) => alterar("fs12", e.target.value)}
                      style={styles.input}
                      inputMode="decimal"
                      placeholder="Ex.: 180000"
                    />
                  </Campo>
                )}

                {form.modoFatorR === MODOS_FATOR_R.MES_ABERTURA && (
                  <>
                    <Campo label="Folha do período de abertura">
                      <input value={form.folhaPeriodo} onChange={(e) => alterar("folhaPeriodo", e.target.value)} style={styles.input} inputMode="decimal" />
                    </Campo>
                    <Campo label="Receita do período de abertura">
                      <input value={form.receitaAbertura} onChange={(e) => alterar("receitaAbertura", e.target.value)} style={styles.input} inputMode="decimal" />
                    </Campo>
                  </>
                )}

                {form.modoFatorR === MODOS_FATOR_R.INICIO_ATIVIDADE && (
                  <>
                    <Campo label="Folha acumulada desde a abertura">
                      <input value={form.folhaAcumulada} onChange={(e) => alterar("folhaAcumulada", e.target.value)} style={styles.input} inputMode="decimal" />
                    </Campo>
                    <Campo label="Receita acumulada desde a abertura">
                      <input value={form.receitaAcumulada} onChange={(e) => alterar("receitaAcumulada", e.target.value)} style={styles.input} inputMode="decimal" />
                    </Campo>
                  </>
                )}
              </>
            )}
          </div>

          {erro && <div style={styles.errorBox}>{erro}</div>}

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton}>Analisar com a Nexa</button>
            <button type="button" onClick={limpar} style={styles.secondaryButton}>Limpar</button>
          </div>
        </form>

        <aside style={styles.guideCard}>
          <h2 style={styles.cardTitle}>Como usar</h2>
          <div style={styles.step}><strong>1</strong><span>Informe a RBT12 e a receita do mês.</span></div>
          <div style={styles.step}><strong>2</strong><span>Indique se a atividade está sujeita ao Fator R.</span></div>
          <div style={styles.step}><strong>3</strong><span>Analise faixa, alíquota, Fator R e estimativa.</span></div>
          <div style={styles.warningBox}>
            <strong>Importante</strong>
            <span>O laboratório não substitui o PGDAS-D e não considera segregações, retenções, monofásicos, ST, sublimites ou particularidades municipais.</span>
          </div>
        </aside>
      </div>

      {resultado && <ResultadoAnalise resultado={resultado} />}
    </div>
  )
}

function Campo({ label, required, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}{required ? " *" : ""}</span>
      {children}
    </label>
  )
}

function ResultadoAnalise({ resultado }) {
  const { fatorR, aliquota, das, comparacao, planejamento, anexoAplicado, receitaPeriodo } = resultado

  return (
    <section style={styles.resultSection}>
      <div style={styles.resultHeader}>
        <div>
          <span style={styles.badge}>Análise concluída</span>
          <h2 style={styles.resultTitle}>Resultado da Nexa</h2>
        </div>
        <div style={styles.anexoBadge}>Anexo {anexoAplicado}</div>
      </div>

      <div style={styles.metricGrid}>
        {fatorR && <Metrica label="Fator R considerado" value={formatarPercentual(fatorR.fatorRPercentual)} detail={fatorR.atingiuLimite ? "Limite de 28% alcançado" : "Abaixo do limite de 28%"} />}
        <Metrica label="Faixa" value={`${aliquota.faixa}ª faixa`} detail={`Anexo ${aliquota.anexo}`} />
        <Metrica label="Alíquota nominal" value={formatarPercentual(aliquota.aliquotaNominalPercentual)} detail={`Dedução: ${formatarMoeda(aliquota.parcelaDeduzir)}`} />
        <Metrica label="Alíquota efetiva" value={formatarPercentual(aliquota.aliquotaEfetivaPercentual, 4)} detail="Antes das segregações do PGDAS-D" />
        <Metrica label="DAS-base estimado" value={formatarMoeda(das.valorDasBase)} detail={`Sobre ${formatarMoeda(receitaPeriodo)}`} destaque />
      </div>

      <div style={styles.resultGrid}>
        <article style={styles.analysisCard}>
          <h3 style={styles.analysisTitle}>Como a Nexa chegou ao resultado</h3>
          {fatorR && (
            <p style={styles.analysisText}>
              <strong>Fator R:</strong> {formatarMoeda(fatorR.folha)} ÷ {formatarMoeda(fatorR.receita)} = {formatarPercentual(fatorR.fatorRPercentual)}. {fatorR.explicacao}
            </p>
          )}
          <p style={styles.analysisText}>
            <strong>Alíquota efetiva:</strong> [(RBT12 × alíquota nominal) − parcela a deduzir] ÷ RBT12.
          </p>
          <p style={styles.analysisText}>{aliquota.explicacao}</p>
          <p style={styles.analysisText}>
            <strong>DAS-base:</strong> {das.formula}. {das.explicacao}
          </p>
        </article>

        {fatorR && (
          <article style={styles.analysisCard}>
            <h3 style={styles.analysisTitle}>Recomendação da Nexa</h3>
            <p style={styles.analysisText}>{fatorR.recomendacao}</p>
            {!fatorR.atingiuLimite && (
              <div style={styles.recommendationValue}>
                Folha adicional matemática: <strong>{formatarMoeda(fatorR.folhaAdicionalNecessaria)}</strong>
              </div>
            )}
          </article>
        )}
      </div>

      {planejamento && (
        <article style={styles.planningCard}>
          <div style={styles.planningHeader}>
            <div>
              <span style={styles.label}>Radar Tributário</span>
              <h3 style={styles.analysisTitle}>Planejamento da Nexa</h3>
            </div>
            <div style={{ ...styles.scoreBadge, ...(planejamento.nivelRisco === "alto" ? styles.scoreHigh : planejamento.nivelRisco === "medio" ? styles.scoreMedium : styles.scoreLow) }}>
              <strong>{planejamento.pontuacao}/100</strong>
              <span>{planejamento.classificacao}</span>
            </div>
          </div>

          <p style={styles.analysisText}><strong>Parecer:</strong> {planejamento.parecer}</p>

          {planejamento.alertas.length > 0 && (
            <div style={styles.planningList}>
              <h4 style={styles.planningSubtitle}>Pontos de atenção</h4>
              {planejamento.alertas.map((item) => (
                <div key={`${item.tipo}-${item.titulo}`} style={styles.planningItem}>
                  <strong>{item.titulo}</strong>
                  <span>{item.descricao}</span>
                  <small>{item.recomendacao}</small>
                </div>
              ))}
            </div>
          )}

          {planejamento.oportunidades.length > 0 && (
            <div style={styles.planningList}>
              <h4 style={styles.planningSubtitle}>Oportunidades para simulação</h4>
              {planejamento.oportunidades.map((item) => (
                <div key={`${item.tipo}-${item.titulo}`} style={styles.opportunityItem}>
                  <strong>{item.titulo}</strong>
                  <span>{item.descricao}</span>
                  <small>{item.ressalva}</small>
                </div>
              ))}
            </div>
          )}

          {planejamento.pontosPositivos.length > 0 && (
            <div style={styles.positiveBox}>
              <strong>Pontos positivos</strong>
              {planejamento.pontosPositivos.map((item) => <span key={item}>✓ {item}</span>)}
            </div>
          )}
        </article>
      )}

      {comparacao && (
        <article style={styles.comparisonCard}>
          <div>
            <span style={styles.label}>Comparação estimativa do período</span>
            <h3 style={styles.analysisTitle}>Anexo III x Anexo V</h3>
          </div>
          <div style={styles.comparisonGrid}>
            <Metrica label="Anexo III" value={formatarMoeda(comparacao.anexoIII.valorEstimado)} detail={formatarPercentual(comparacao.anexoIII.aliquotaEfetivaPercentual, 4)} />
            <Metrica label="Anexo V" value={formatarMoeda(comparacao.anexoV.valorEstimado)} detail={formatarPercentual(comparacao.anexoV.aliquotaEfetivaPercentual, 4)} />
            <Metrica label="Diferença no mês" value={formatarMoeda(Math.abs(comparacao.diferencaPeriodo))} detail="Comparação matemática simplificada" />
          </div>
        </article>
      )}

      <div style={styles.disclaimer}>
        <strong>Revisão obrigatória do contador.</strong> Este é um DAS-base estimado. O valor definitivo depende das receitas segregadas e das regras aplicáveis no PGDAS-D. No Anexo IV, a contribuição previdenciária patronal é apurada fora do DAS.
      </div>
    </section>
  )
}

function Metrica({ label, value, detail, destaque = false }) {
  return (
    <div style={{ ...styles.metricCard, ...(destaque ? styles.metricCardHighlight : {}) }}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
    </div>
  )
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap", background: "linear-gradient(135deg, #061f47, #063d66)", border: "1px solid rgba(55,255,116,.22)", borderRadius: "22px", padding: "24px" },
  badge: { display: "inline-flex", padding: "6px 11px", borderRadius: "999px", background: "rgba(55,255,116,.12)", color: "#37ff74", fontWeight: "bold", fontSize: "12px", marginBottom: "8px" },
  title: { margin: 0, fontSize: "30px" },
  subtitle: { margin: "7px 0 0", color: "#b8c8dc", maxWidth: "650px", lineHeight: 1.5 },
  heroStatus: { minWidth: "190px", background: "rgba(0,0,0,.18)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column" },
  heroLabel: { color: "#a9b8cc", fontSize: "12px" },
  heroValue: { color: "#37ff74", fontSize: "22px", margin: "4px 0" },
  heroNote: { color: "#dce8f8", fontSize: "12px" },
  gridPrincipal: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" },
  card: { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "20px", padding: "22px" },
  guideCard: { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "20px", padding: "22px", alignSelf: "start" },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: "18px" },
  cardTitle: { margin: 0, fontSize: "20px" },
  cardText: { color: "#a9b8cc", margin: "6px 0 0", fontSize: "14px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "7px" },
  label: { color: "#cbd9ea", fontSize: "13px", fontWeight: "bold" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.16)", borderRadius: "12px", background: "#041a3a", color: "white", padding: "12px 13px", outline: "none" },
  actions: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" },
  primaryButton: { border: 0, borderRadius: "12px", padding: "13px 18px", fontWeight: "bold", cursor: "pointer", background: "linear-gradient(90deg, #00a8ff, #37ff74)", color: "#00112b" },
  secondaryButton: { border: "1px solid rgba(255,255,255,.18)", borderRadius: "12px", padding: "13px 18px", fontWeight: "bold", cursor: "pointer", background: "transparent", color: "white" },
  errorBox: { marginTop: "14px", padding: "13px", borderRadius: "12px", background: "rgba(255,80,80,.12)", border: "1px solid rgba(255,80,80,.35)", color: "#ffd2d2" },
  step: { display: "flex", gap: "10px", alignItems: "center", color: "#dce8f8", marginTop: "15px", lineHeight: 1.4 },
  warningBox: { display: "flex", flexDirection: "column", gap: "7px", marginTop: "20px", padding: "14px", borderRadius: "14px", background: "rgba(255,193,7,.10)", border: "1px solid rgba(255,193,7,.24)", color: "#f4df9c", fontSize: "13px", lineHeight: 1.5 },
  resultSection: { background: "rgba(255,255,255,.05)", border: "1px solid rgba(55,255,116,.20)", borderRadius: "22px", padding: "22px" },
  resultHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "18px" },
  resultTitle: { margin: 0, fontSize: "26px" },
  anexoBadge: { background: "linear-gradient(90deg, #00a8ff, #37ff74)", color: "#00112b", borderRadius: "14px", padding: "12px 18px", fontWeight: "bold", fontSize: "18px" },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px" },
  metricCard: { background: "#061f47", border: "1px solid rgba(255,255,255,.11)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "7px" },
  metricCardHighlight: { border: "1px solid rgba(55,255,116,.45)", boxShadow: "0 0 0 1px rgba(55,255,116,.08)" },
  metricLabel: { color: "#a9b8cc", fontSize: "12px" },
  metricValue: { color: "white", fontSize: "22px" },
  metricDetail: { color: "#cbd9ea", fontSize: "12px", lineHeight: 1.4 },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginTop: "14px" },
  analysisCard: { background: "#061f47", border: "1px solid rgba(255,255,255,.11)", borderRadius: "16px", padding: "18px" },
  analysisTitle: { margin: "0 0 10px", fontSize: "17px" },
  analysisText: { color: "#dce8f8", lineHeight: 1.6, margin: "8px 0" },
  recommendationValue: { marginTop: "12px", color: "#37ff74", fontSize: "14px" },
  comparisonCard: { marginTop: "14px", background: "rgba(0,168,255,.07)", border: "1px solid rgba(0,168,255,.22)", borderRadius: "16px", padding: "18px" },
  comparisonGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginTop: "12px" },
  planningCard: { marginTop: "18px", background: "linear-gradient(135deg, rgba(0,168,255,.10), rgba(55,255,116,.07))", border: "1px solid rgba(55,255,116,.24)", borderRadius: "18px", padding: "18px" },
  planningHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "12px" },
  scoreBadge: { minWidth: "110px", borderRadius: "14px", padding: "12px 15px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", color: "#00112b" },
  scoreLow: { background: "#37ff74" },
  scoreMedium: { background: "#ffd166" },
  scoreHigh: { background: "#ff7b7b" },
  planningList: { display: "grid", gap: "10px", marginTop: "15px" },
  planningSubtitle: { margin: 0, color: "white", fontSize: "15px" },
  planningItem: { display: "flex", flexDirection: "column", gap: "5px", padding: "13px", borderRadius: "13px", background: "rgba(255,193,7,.09)", border: "1px solid rgba(255,193,7,.22)", color: "#f7e8b0" },
  opportunityItem: { display: "flex", flexDirection: "column", gap: "5px", padding: "13px", borderRadius: "13px", background: "rgba(0,168,255,.09)", border: "1px solid rgba(0,168,255,.24)", color: "#dcefff" },
  positiveBox: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "15px", padding: "13px", borderRadius: "13px", background: "rgba(55,255,116,.08)", border: "1px solid rgba(55,255,116,.20)", color: "#dfffe8" },
  disclaimer: { marginTop: "14px", padding: "14px", borderRadius: "14px", background: "rgba(255,255,255,.06)", color: "#cbd9ea", lineHeight: 1.5, fontSize: "13px" },
}
