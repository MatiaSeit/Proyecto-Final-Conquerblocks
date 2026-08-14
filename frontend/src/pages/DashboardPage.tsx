import { useQuery } from "@tanstack/react-query";
import { reportsApi, stockApi } from "../api/endpoints";
import { InventoryValueChart } from "../components/InventoryValueChart";
import { TableSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();

  const lowStock = useQuery({ queryKey: ["reports", "low-stock"], queryFn: reportsApi.lowStock });
  const valuation = useQuery({ queryKey: ["reports", "valuation"], queryFn: reportsApi.valuation });
  const movements = useQuery({
    queryKey: ["stock-movements", "recent"],
    queryFn: () => stockApi.movements(),
  });

  const totalValue = (valuation.data ?? []).reduce((sum, row) => sum + Number(row.total_value ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Command Overview</h1>
        <span className="muted">Welcome back, {user?.username}</span>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Bases reporting</div>
          <div className="stat-card__value">{valuation.data?.length ?? "-"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Total inventory value</div>
          <div className="stat-card__value">{totalValue ? `${totalValue.toLocaleString()} cr` : "-"}</div>
        </div>
        <div className={`stat-card ${(lowStock.data?.length ?? 0) > 0 ? "is-alert" : ""}`}>
          <div className="stat-card__label">Components below minimum</div>
          <div className="stat-card__value">{lowStock.data?.length ?? "-"}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Inventory value by base</h2>
        {valuation.isLoading ? (
          <TableSkeleton rows={2} cols={1} />
        ) : (
          <InventoryValueChart data={valuation.data ?? []} />
        )}
      </div>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Low stock alert</h2>
        {lowStock.isLoading && <TableSkeleton rows={2} cols={4} />}
        {!lowStock.isLoading && lowStock.data?.length === 0 && (
          <p className="muted">All components are above their minimum. Steady on.</p>
        )}
        {(lowStock.data?.length ?? 0) > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Component</th>
                  <th>Total stock</th>
                  <th>Minimum</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.data!.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td style={{ color: "var(--color-danger)" }}>{row.total_stock ?? 0}</td>
                    <td>{row.minimum_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Recent stock movements</h2>
        {movements.isLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Reference</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {(movements.data ?? []).slice(0, 8).map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString()}</td>
                    <td>{m.movement_type}</td>
                    <td style={{ color: m.quantity < 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td>{m.reference || "-"}</td>
                    <td>{m.performed_by_username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
