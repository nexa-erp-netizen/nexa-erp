import { useEffect, useState } from "react"
import api from "../services/api"

import "./FluxoCaixa.css"

export default function FluxoCaixa() {

  const [fluxo, setFluxo] = useState([])

  const [novo, setNovo] = useState({
    tipo: "Entrada",
    descricao: "",
    categoria: "",
    valor: "",
    data: "",
  })

  async function carregarFluxo() {
    try {

      const response = await api.get("/fluxo-caixa")

      setFluxo(response.data)

    } catch (error) {
      console.error(error)
    }
  }

  async function criarLancamento() {
    try {

      await api.post(
        "/fluxo-caixa",
        {
          ...novo,
          status: "Realizado",
        }
      )

      setNovo({
        tipo: "Entrada",
        descricao: "",
        categoria: "",
        valor: "",
        data: "",
      })

      carregarFluxo()

    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    carregarFluxo()
  }, [])

  const entradas = fluxo
    .filter((item) => item.tipo === "Entrada")
    .reduce(
      (total, item) =>
        total + Number(item.valor),
      0
    )

  const saidas = fluxo
    .filter((item) => item.tipo === "Saída")
    .reduce(
      (total, item) =>
        total + Number(item.valor),
      0
    )

  const saldo = entradas - saidas

  return (
    <div className="fluxo-container">

      <div className="cards-fluxo">

        <div className="card-fluxo">
          <span>Entradas</span>
          <strong>
            R$ {entradas.toFixed(2)}
          </strong>
        </div>

        <div className="card-fluxo">
          <span>Saídas</span>
          <strong>
            R$ {saidas.toFixed(2)}
          </strong>
        </div>

        <div className="card-fluxo">
          <span>Saldo</span>
          <strong>
            R$ {saldo.toFixed(2)}
          </strong>
        </div>

      </div>

      <div className="novo-fluxo">

        <select
          value={novo.tipo}
          onChange={(e) =>
            setNovo({
              ...novo,
              tipo: e.target.value,
            })
          }
        >
          <option>Entrada</option>
          <option>Saída</option>
        </select>

        <input
          placeholder="Descrição"
          value={novo.descricao}
          onChange={(e) =>
            setNovo({
              ...novo,
              descricao: e.target.value,
            })
          }
        />

        <input
          placeholder="Categoria"
          value={novo.categoria}
          onChange={(e) =>
            setNovo({
              ...novo,
              categoria: e.target.value,
            })
          }
        />

        <input
          placeholder="Valor"
          value={novo.valor}
          onChange={(e) =>
            setNovo({
              ...novo,
              valor: e.target.value,
            })
          }
        />

        <input
          type="date"
          value={novo.data}
          onChange={(e) =>
            setNovo({
              ...novo,
              data: e.target.value,
            })
          }
        />

        <button onClick={criarLancamento}>
          Adicionar
        </button>

      </div>

      <div className="tabela-fluxo">

        <table>

          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Data</th>
            </tr>
          </thead>

          <tbody>

            {fluxo.map((item) => (
              <tr key={item.id}>

                <td>
                  <span
                    className={
                      item.tipo === "Entrada"
                        ? "entrada"
                        : "saida"
                    }
                  >
                    {item.tipo}
                  </span>
                </td>

                <td>{item.descricao}</td>

                <td>{item.categoria}</td>

                <td>
                  R${" "}
                  {Number(item.valor).toFixed(2)}
                </td>

                <td>{item.data}</td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}
