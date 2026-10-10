import { useEffect, useState } from 'react'

interface Report {
  id: number
  name: string
  region: string
  archived: boolean
}

interface ReportCriteria {
  region: string
  includeArchived: boolean
}

const allReports: Report[] = [
  { id: 1, name: 'Q1 revenue', region: 'emea', archived: false },
  { id: 2, name: 'Q1 churn', region: 'amer', archived: false },
  { id: 3, name: 'Q4 revenue', region: 'emea', archived: true },
  { id: 4, name: 'Hiring plan', region: 'apac', archived: false },
]

function filterReports({ region, includeArchived }: ReportCriteria): Report[] {
  return allReports.filter(
    (report) =>
      (region === 'all' || report.region === region) && (includeArchived || !report.archived),
  )
}

function ReportTable({ region }: { region: string }) {
  const [rows, setRows] = useState<Report[]>([])
  const criteria: ReportCriteria = { region, includeArchived: false }

  useEffect(() => {
    setRows(filterReports(criteria))
  }, [criteria])

  return (
    <table>
      <caption>{rows.length} reports</caption>
      <tbody>
        {rows.map((report) => (
          <tr key={report.id}>
            <td>{report.name}</td>
            <td>{report.region}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ReportsScreen() {
  const [region, setRegion] = useState('all')
  return (
    <section className="card">
      <h1>Reports</h1>
      <label>
        Region{' '}
        <select value={region} onChange={(event) => setRegion(event.target.value)}>
          <option value="all">All</option>
          <option value="emea">EMEA</option>
          <option value="amer">Americas</option>
          <option value="apac">APAC</option>
        </select>
      </label>
      <ReportTable region={region} />
    </section>
  )
}
