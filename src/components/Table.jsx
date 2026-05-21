export default function Table({
  columns,
  rows,
}) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              style={styles.th}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, i) => (
              <td
                key={i}
                style={styles.td}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const styles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "16px",
    color: "#a9b8cc",
    borderBottom:
      "1px solid rgba(255,255,255,.08)",
  },

  td: {
    padding: "16px",
    borderBottom:
      "1px solid rgba(255,255,255,.05)",
  },
}