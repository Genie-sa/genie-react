'use client'

import type { ReactNode } from 'react'

const MEASUREMENTS = [
  { size: 'XS', chest: '84–88', waist: '70–74', sleeve: '60' },
  { size: 'S', chest: '89–94', waist: '75–80', sleeve: '62' },
  { size: 'M', chest: '95–100', waist: '81–86', sleeve: '64' },
  { size: 'L', chest: '101–107', waist: '87–93', sleeve: '66' },
  { size: 'XL', chest: '108–115', waist: '94–101', sleeve: '68' },
]

export function SizeGuide({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <div className="size-guide" role="dialog" aria-label="Size guide">
      <table>
        <caption>Body measurements in centimetres</caption>
        <thead>
          <tr>
            <th scope="col">Size</th>
            <th scope="col">Chest</th>
            <th scope="col">Waist</th>
            <th scope="col">Sleeve</th>
          </tr>
        </thead>
        <tbody>
          {MEASUREMENTS.map((row) => (
            <tr key={row.size}>
              <th scope="row">{row.size}</th>
              <td>{row.chest}</td>
              <td>{row.waist}</td>
              <td>{row.sleeve}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="link-button" onClick={onClose}>
        Close size guide
      </button>
    </div>
  )
}
