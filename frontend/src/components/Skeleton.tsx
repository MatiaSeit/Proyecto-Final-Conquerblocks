/** Loading placeholder for a table: renders `rows` x `cols` pulsing bars in
 * place of real cells, with a different width per bar so the skeleton reads
 * as "data-shaped" rather than a uniform gray block. Swap in for the table
 * while `isLoading` instead of a plain "Loading..." line. */
export function TableSkeleton({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Loading">
      <table>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <span className="skeleton-bar" style={{ width: `${55 + ((r * 7 + c * 13) % 35)}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
