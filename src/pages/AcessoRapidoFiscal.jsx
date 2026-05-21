export default function AcessoRapidoFiscal() {
  const atalhos = [
    {
      titulo: "PGMEI - DAS MEI",
      descricao: "Emitir ou reemitir DAS do MEI.",
      link: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao",
    },
    {
      titulo: "Simples Nacional",
      descricao: "Acessar portal do Simples Nacional.",
      link: "https://www8.receita.fazenda.gov.br/SimplesNacional/",
    },
    {
      titulo: "PGDAS-D",
      descricao: "Apuração e emissão de DAS do Simples Nacional.",
      link: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd.app/",
    },
    {
      titulo: "e-CAC",
      descricao: "Centro Virtual de Atendimento da Receita Federal.",
      link: "https://cav.receita.fazenda.gov.br/autenticacao/login",
    },
    {
      titulo: "Consulta CNPJ",
      descricao: "Consultar dados cadastrais de empresa.",
      link: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
    },
    {
      titulo: "CND Federal",
      descricao: "Emitir certidão negativa de débitos federais.",
      link: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
    },
    {
      titulo: "FGTS - Regularidade",
      descricao: "Consultar certidão de regularidade do FGTS.",
      link: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
    },
    {
      titulo: "CCMEI",
      descricao: "Emitir certificado de condição do MEI.",
      link: "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/emissao-de-comprovante-ccmei",
    },
  ]

  function abrir(link) {
    window.open(link, "_blank")
  }

  return (
    <div style={box}>
      <h2>Acesso Rápido Fiscal</h2>

      <p style={subtitulo}>
        Central de atalhos para emissão, consulta e reemissão fiscal.
      </p>

      <div style={grid}>
        {atalhos.map((item, index) => (
          <div key={index} style={card}>
            <h3>{item.titulo}</h3>

            <p style={descricao}>
              {item.descricao}
            </p>

            <button
              style={button}
              onClick={() => abrir(item.link)}
            >
              Acessar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const subtitulo = {
  color: "#a9b8cc",
  marginBottom: "25px",
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
}

const card = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "22px",
}

const descricao = {
  color: "#a9b8cc",
  minHeight: "50px",
}

const button = {
  marginTop: "18px",
  padding: "13px 18px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}