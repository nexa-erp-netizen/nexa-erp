import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function AcessoRapidoFiscal() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [mensagem, setMensagem] = useState("")

  const atalhos = [
    {
      titulo: "PGMEI - DAS MEI",
      descricao: "Emitir ou reemitir DAS do MEI.",
      link: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao",
      copiarCnpj: true,
    },
    {
      titulo: "DASN-SIMEI",
      descricao: "Declaração anual do MEI.",
      link: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao",
      copiarCnpj: true,
    }, 
    {
      titulo: "Simples Nacional",
      descricao: "Acessar portal do Simples Nacional.",
      link: "https://www8.receita.fazenda.gov.br/SimplesNacional/",
      copiarCnpj: true,
    },
    {
      titulo: "Meu INSS",
      descricao: "Acessar o portal Meu INSS.",
      link: "https://meu.inss.gov.br",
      copiarCnpj: false,
    },  
    {
      titulo: "PGDAS-D",
      descricao: "Apuração e emissão de DAS do Simples Nacional.",
      link: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd.app/",
      copiarCnpj: true,
    },
    {
      titulo: "e-CAC",
      descricao: "Centro Virtual de Atendimento da Receita Federal.",
      link: "https://cav.receita.fazenda.gov.br/autenticacao/login",
      copiarCnpj: false,
    },
    {
      titulo: "Consulta CNPJ",
      descricao: "Consultar dados cadastrais de empresa.",
      link: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
      copiarCnpj: true,
    },
    {
      titulo: "CND Federal",
      descricao: "Emitir certidão negativa de débitos federais.",
      link: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
      copiarCnpj: true,
    },
    {
      titulo: "FGTS - Regularidade",
      descricao: "Consultar certidão de regularidade do FGTS.",
      link: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
      copiarCnpj: true,
    },
    {
      titulo: "CCMEI",
      descricao: "Emitir certificado de condição do MEI.",
      link: "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/emissao-de-comprovante-ccmei",
      copiarCnpj: true,
    },
  ]

  useEffect(() => {
    carregarClientes()
  }, [])

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientes(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar clientes:", error)
    }
  }

  const clienteSelecionado = useMemo(() => {
    return clientes.find((cliente) => String(cliente.id) === String(clienteId))
  }, [clientes, clienteId])

  function obterCnpj(cliente) {
    return (
      cliente?.cnpj ||
      cliente?.CNPJ ||
      cliente?.documento ||
      cliente?.cpfCnpj ||
      cliente?.cpf_cnpj ||
      ""
    )
  }

  function limparCnpj(cnpj) {
    return String(cnpj || "").replace(/\D/g, "")
  }

  async function copiarCnpj(cliente, titulo) {
    const cnpj = limparCnpj(obterCnpj(cliente))

    if (!cnpj) {
      setMensagem("Cliente selecionado não possui CNPJ cadastrado.")
      return false
    }

    try {
      await navigator.clipboard.writeText(cnpj)

      setMensagem(
        `CNPJ de ${cliente.nome} copiado para usar em ${titulo}.`
      )

      setTimeout(() => setMensagem(""), 4500)

      return true
    } catch (error) {
      console.error("Erro ao copiar CNPJ:", error)
      setMensagem("Não foi possível copiar o CNPJ automaticamente.")
      return false
    }
  }

  async function abrir(item) {
    if (item.copiarCnpj) {
      if (!clienteSelecionado) {
        setMensagem("Selecione um cliente antes de acessar este atalho.")
        return
      }

      await copiarCnpj(clienteSelecionado, item.titulo)
    }

    window.open(item.link, "_blank")
  }

  return (
    <div style={box}>
      <h2>Acesso Rápido Fiscal</h2>

      <p style={subtitulo}>
        Central de atalhos para emissão, consulta e reemissão fiscal.
      </p>

      <div style={filtroBox}>
        <div>
          <label style={label}>Cliente para uso fiscal</label>

          <select
            style={select}
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value)
              setMensagem("")
            }}
          >
            <option value="">Selecione um cliente</option>

            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={infoCliente}>
          <span style={infoTitulo}>CNPJ selecionado</span>

          <strong>
            {clienteSelecionado
              ? obterCnpj(clienteSelecionado) || "Sem CNPJ cadastrado"
              : "Nenhum cliente selecionado"}
          </strong>
        </div>
      </div>

      {mensagem && <div style={toast}>{mensagem}</div>}

      <div style={grid}>
        {atalhos.map((item, index) => (
          <div key={index} style={card}>
            <h3>{item.titulo}</h3>

            <p style={descricao}>{item.descricao}</p>

            <button style={button} onClick={() => abrir(item)}>
              {item.copiarCnpj ? "Copiar CNPJ e Acessar" : "Acessar"}
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

const filtroBox = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr",
  gap: "16px",
  marginBottom: "18px",
}

const label = {
  display: "block",
  color: "#a9b8cc",
  marginBottom: "8px",
  fontSize: "14px",
}

const select = {
  width: "100%",
  height: "48px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  padding: "0 14px",
  outline: "none",
}

const infoCliente = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "14px",
  padding: "12px 14px",
}

const infoTitulo = {
  display: "block",
  color: "#a9b8cc",
  fontSize: "13px",
  marginBottom: "5px",
}

const toast = {
  background: "rgba(55,255,116,.12)",
  border: "1px solid rgba(55,255,116,.35)",
  color: "#37ff74",
  borderRadius: "12px",
  padding: "12px 14px",
  marginBottom: "18px",
  fontWeight: "bold",
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