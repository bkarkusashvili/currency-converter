export interface CountRow {
  metric: string;
  value: string;
}

interface CountTableProps {
  caption: string;
  metricHeading: string;
  valueHeading: string;
  rows: readonly CountRow[];
}

/**
 * The one place on this page that carries numbers. Everything else is written
 * without them so it stays true as they move; these are dated in the caption
 * instead, which is what makes them safe to print.
 */
export function CountTable({ caption, metricHeading, valueHeading, rows }: CountTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-sm">
        <caption className="text-faint pb-3 text-left text-xs text-pretty">{caption}</caption>
        <thead>
          <tr className="border-line border-b">
            <th scope="col" className="py-2 pr-4 text-left font-semibold">
              {metricHeading}
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              {valueHeading}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric} className="border-line border-b last:border-b-0">
              <th scope="row" className="text-muted py-2 pr-4 text-left font-normal text-pretty">
                {row.metric}
              </th>
              <td className="py-2 text-right font-mono tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
