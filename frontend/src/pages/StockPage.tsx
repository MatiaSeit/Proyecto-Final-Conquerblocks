import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { basesApi, stockApi } from "../api/endpoints";
import { Pagination } from "../components/Pagination";
import { TableSkeleton } from "../components/Skeleton";

const PAGE_SIZE = 20;

export function StockPage() {
  const [page, setPage] = useState(1);
  const [baseFilter, setBaseFilter] = useState("");
  const baseId = baseFilter ? Number(baseFilter) : undefined;

  const { data: bases } = useQuery({ queryKey: ["bases"], queryFn: basesApi.list });
  const { data: stock, isLoading } = useQuery({
    queryKey: ["stock", baseId],
    queryFn: () => stockApi.list({ base: baseId }),
  });
  const { data: movementsPage, isLoading: movementsLoading } = useQuery({
    queryKey: ["stock-movements", "ledger", baseId, page],
    queryFn: () => stockApi.movementsPage({ base: baseId, page }),
  });
  const movements = movementsPage?.results ?? [];

  const baseName = (id: number) => bases?.find((b) => b.id === id)?.name ?? id;

  return (
    <div>
      <div className="page-header">
        <h1>Stock & Ledger</h1>
      </div>

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="stock-base-filter">Base</label>
          <select
            id="stock-base-filter"
            value={baseFilter}
            onChange={(e) => {
              setBaseFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All bases</option>
            {(bases ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Current stock by base</h2>
        {isLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Component</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {(stock ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.base_code}</td>
                    <td>{s.component_sku}</td>
                    <td>{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Movement ledger (append-only)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Every unit that enters, leaves, transfers or is adjusted is logged here permanently &mdash; this is the
          audit trail behind every number above.
        </p>
        {movementsLoading ? (
          <TableSkeleton rows={5} cols={8} />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Base</th>
                    <th>Component</th>
                    <th>Qty</th>
                    <th>Reference</th>
                    <th>Reason</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleString()}</td>
                      <td>{m.movement_type}</td>
                      <td>{baseName(m.base)}</td>
                      <td>{m.component}</td>
                      <td style={{ color: m.quantity < 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td>{m.reference || "-"}</td>
                      <td>{m.reason || "-"}</td>
                      <td>{m.performed_by_username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} count={movementsPage?.count ?? 0} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
