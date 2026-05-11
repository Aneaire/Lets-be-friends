import type React from 'react'

export type AdminTableColumn<Row> = {
  key: string
  header: React.ReactNode
  render: (row: Row) => React.ReactNode
  className?: string
}

export function AdminTable<Row>({
  rows,
  columns,
  getKey,
  empty,
}: {
  rows: Row[] | undefined
  columns: Array<AdminTableColumn<Row>>
  getKey: (row: Row) => string
  empty: React.ReactNode
}) {
  if (rows === undefined) return <div className="admin-empty">Loading...</div>
  if (rows.length === 0) return <div className="admin-empty">{empty}</div>

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
