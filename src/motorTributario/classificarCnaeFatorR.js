/**
 * Nexa ERP — Classificação conservadora do CNAE para Fator R.
 *
 * Objetivo:
 * - automatizar casos de alta confiança;
 * - NÃO adivinhar CNAEs ambíguos;
 * - deixar a decisão revisável pelo contador.
 *
 * Base funcional:
 * Resolução CGSN nº 140/2018, art. 25, § 1º, IV e V, e art. 26.
 *
 * Importante:
 * CNAE é um gatilho de classificação. A atividade efetivamente prestada
 * continua sendo a validação final em situações ambíguas/mistas.
 */

export const VERSAO_CLASSIFICADOR_CNAE = "2026.08"

export function normalizarCnae(valor = "") {
  return String(valor || "").replace(/\D/g, "").slice(0, 7)
}

function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function comecaComAlgum(codigo, prefixos) {
  return prefixos.some((prefixo) => codigo.startsWith(prefixo))
}

function contemAlgum(texto, termos) {
  return termos.some((termo) => texto.includes(termo))
}

/**
 * Casos de alta confiança sujeitos ao Fator R (Anexo III/V).
 *
 * A lista é propositalmente conservadora. Quando o código não estiver coberto,
 * a Nexa devolve "REVISAR" em vez de gravar Sim/Não sem segurança.
 */
const PREFIXOS_FATOR_R = Object.freeze([
  // Representação comercial.
  "461",

  // Tecnologia: desenvolvimento/licenciamento/consultoria de software.
  "62015",
  "62023",
  "62031",
  "62040",

  // Gestão/administração de imóveis de terceiros.
  "68226",

  // Consultoria em gestão.
  "70204",

  // Arquitetura, engenharia e serviços técnicos correlatos.
  "71111",
  "71120",
  "71197",
  "71201",

  // Publicidade.
  "73114",
  "73122",
  "73190",

  // Tradução e interpretação.
  "7490101",

  // Medicina veterinária.
  "75001",

  // Medicina, odontologia, diagnóstico e profissões de saúde listadas na regra.
  "86305",
  "86402",
  "86500",

  // Ensino de esportes e condicionamento físico.
  "85911",
  "93131",

  // Intermediação imobiliária.
  "68218",

  // Leiloeiros independentes.
  "8299704",
])

/**
 * Casos típicos do Anexo IV — NÃO usam Fator R.
 */
const CNAES_ANEXO_III_SEM_FATOR_R = Object.freeze([
  // 8599-6/02 — Cursos de pilotagem.
  "8599602",
])

const PREFIXOS_ANEXO_IV = Object.freeze([
  // Construção e obras de engenharia.
  "41",
  "42",
  "43",

  // Serviços advocatícios.
  "69117",

  // Vigilância/segurança privada.
  "80111",
  "80200",

  // Limpeza e conservação.
  "81214",
  "81290",

  // Paisagismo.
  "81303",
])

const TERMOS_ANEXO_IV = Object.freeze([
  "advocacia",
  "advocatic",
  "servicos advocaticios",
  "vigilancia",
  "seguranca privada",
  "limpeza",
  "conservacao",
  "construcao",
  "obra de engenharia",
  "subempreitada",
  "paisagismo",
  "decoracao de interiores",
])

const TERMOS_FATOR_R = Object.freeze([
  "administracao de imoveis",
  "gestao de imoveis",
  "academia de danca",
  "capoeira",
  "ioga",
  "yoga",
  "artes marciais",
  "condicionamento fisico",
  "escola de esportes",
  "programa de computador",
  "software",
  "pagina eletronica",
  "web design",
  "laboratorio de analises clinicas",
  "patologia clinica",
  "tomografia",
  "diagnostico por imagem",
  "ressonancia magnetica",
  "protese",
  "fisioterapia",
  "medicina",
  "enfermagem",
  "veterinaria",
  "odontologia",
  "psicologia",
  "psicanalise",
  "terapia ocupacional",
  "acupuntura",
  "podologia",
  "fonoaudiologia",
  "nutricao",
  "vacinacao",
  "banco de leite",
  "despachante",
  "traducao",
  "interpretacao",
  "arquitetura",
  "urbanismo",
  "engenharia",
  "cartografia",
  "topografia",
  "geologia",
  "geodesia",
  "analise tecnica",
  "pesquisa",
  "design",
  "desenho",
  "agronomia",
  "representacao comercial",
  "intermediacao de negocios",
  "intermediacao de servicos",
  "pericia",
  "avaliacao",
  "auditoria",
  "economia",
  "consultoria",
  "gestao",
  "organizacao",
  "controle",
  "administracao",
  "jornalismo",
  "publicidade",
  "agenciamento",
])

export function classificarCnaeFatorR({
  cnae = "",
  descricao = "",
  regime = "",
  ramoAtividade = "",
} = {}) {
  const codigo = normalizarCnae(cnae)
  const texto = normalizarTexto(`${cnae} ${descricao}`)
  const regimeNormalizado = normalizarTexto(regime)
  const ramo = normalizarTexto(ramoAtividade)

  if (!codigo && !texto) {
    return {
      status: "SEM_CNAE",
      utilizaFatorR: "",
      anexoSugerido: "",
      confianca: "nenhuma",
      titulo: "Informe o CNAE",
      motivo: "A Nexa precisa do CNAE principal para iniciar a análise tributária.",
    }
  }

  if (regimeNormalizado && regimeNormalizado !== "simples nacional") {
    return {
      status: "NAO_APLICAVEL",
      utilizaFatorR: "",
      anexoSugerido: "",
      confianca: "alta",
      titulo: "Fator R não aplicável ao regime informado",
      motivo: "O Fator R é uma regra usada na apuração de determinadas receitas do Simples Nacional.",
    }
  }

  // Comércio e indústria puros não são receitas de serviços sujeitas ao Fator R.
  if (ramo === "comercio") {
    return {
      status: "NAO",
      utilizaFatorR: "Não",
      anexoSugerido: "I",
      confianca: "alta",
      titulo: "Fator R não aplicável",
      motivo: "Ramo cadastrado como Comércio. A referência inicial é o Anexo I, sujeita à conferência da atividade.",
    }
  }

  if (ramo === "industria") {
    return {
      status: "NAO",
      utilizaFatorR: "Não",
      anexoSugerido: "II",
      confianca: "alta",
      titulo: "Fator R não aplicável",
      motivo: "Ramo cadastrado como Indústria. A referência inicial é o Anexo II, sujeita à conferência da atividade.",
    }
  }

  // Casos diretos de Anexo III sem Fator R.
  if (codigo && CNAES_ANEXO_III_SEM_FATOR_R.includes(codigo)) {
    return {
      status: "NAO",
      utilizaFatorR: "Não",
      anexoSugerido: "III",
      confianca: "alta",
      titulo: "Fator R não aplicável — Anexo III",
      motivo:
        "O CNAE 8599-6/02 (Cursos de pilotagem) é tratado no Simples Nacional pelo Anexo III, sem aplicação do Fator R.",
    }
  }

  // Primeiro testamos Anexo IV porque alguns textos também contêm termos como engenharia.
  if (
    (codigo && comecaComAlgum(codigo, PREFIXOS_ANEXO_IV)) ||
    contemAlgum(texto, TERMOS_ANEXO_IV)
  ) {
    return {
      status: "NAO",
      utilizaFatorR: "Não",
      anexoSugerido: "IV",
      confianca: "alta",
      titulo: "Fator R não aplicável — provável Anexo IV",
      motivo:
        "A atividade informada coincide com grupo típico do Anexo IV. Confirme a atividade efetivamente prestada antes da apuração definitiva.",
    }
  }

  if (
    (codigo && comecaComAlgum(codigo, PREFIXOS_FATOR_R)) ||
    contemAlgum(texto, TERMOS_FATOR_R)
  ) {
    return {
      status: "SIM",
      utilizaFatorR: "Sim",
      anexoSugerido: "",
      confianca: "alta",
      titulo: "Fator R aplicável",
      motivo:
        "A atividade informada está em grupo sujeito à comparação entre os Anexos III e V. O anexo efetivo será definido pelo Fator R do período.",
    }
  }

  if (ramo === "servicos" || ramo === "misto" || !ramo) {
    return {
      status: "REVISAR",
      utilizaFatorR: "",
      anexoSugerido: "",
      confianca: "revisar",
      titulo: "Revisar enquadramento do CNAE",
      motivo:
        "A Nexa não encontrou correspondência de alta confiança. Verifique a descrição do CNAE e a atividade efetivamente prestada; o sistema não alterou o Fator R automaticamente.",
    }
  }

  return {
    status: "REVISAR",
    utilizaFatorR: "",
    anexoSugerido: "",
    confianca: "revisar",
    titulo: "Revisar enquadramento",
    motivo: "Confirme o CNAE e a atividade efetivamente prestada antes de definir o Fator R.",
  }
}
