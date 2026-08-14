import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { basesApi, componentsApi, deploymentOrdersApi, manifestsApi, squadronsApi } from "../api/endpoints";
import { extractErrorMessage } from "../api/errors";
import { Pagination } from "../components/Pagination";
import { TableSkeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import type { DeploymentOrderLine } from "../api/types";

const emptyLine = (): DeploymentOrderLine => ({ component: 0, quantity: 1, unit_price: "0" });
const PAGE_SIZE = 20;

/** Manifest PDFs render asynchronously in a Celery worker -- this polls
 * every 1.5s until pdf_ready flips true, so the UI reflects that without
 * the user needing to refresh. */
function ManifestCell({ orderId }: { orderId: number }) {
  const { data: manifest } = useQuery({
    queryKey: ["manifest", orderId],
    queryFn: () => manifestsApi.byOrder(orderId),
    refetchInterval: (query) => (query.state.data?.pdf_ready ? false : 1500),
  });

  if (!manifest) return <span className="muted">-</span>;
  if (!manifest.pdf_ready || !manifest.download_url) return <span className="muted">Rendering manifest...</span>;
  return (
    <a href={manifest.download_url} target="_blank" rel="noreferrer">
      {manifest.number}.pdf
    </a>
  );
}

const STATUSES = ["DRAFT", "CONFIRMED", "DISPATCHED", "CANCELLED"];

export function DeploymentOrdersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const {
    data: ordersPage,
    isLoading,
    isError,
    error: listError,
  } = useQuery({
    queryKey: ["deployment-orders", statusFilter, page],
    queryFn: () => deploymentOrdersApi.list({ page, status: statusFilter || undefined }),
  });
  const orders = ordersPage?.results ?? [];
  const { data: squadrons } = useQuery({ queryKey: ["squadrons"], queryFn: squadronsApi.list });
  const { data: bases } = useQuery({ queryKey: ["bases"], queryFn: basesApi.list });
  const { data: components } = useQuery({ queryKey: ["components"], queryFn: () => componentsApi.list() });

  const [number, setNumber] = useState("");
  const [squadronId, setSquadronId] = useState("");
  const [baseId, setBaseId] = useState("");
  const [lines, setLines] = useState<DeploymentOrderLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["deployment-orders"] });
  const invalidateStock = () => {
    queryClient.invalidateQueries({ queryKey: ["stock"] });
    queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const createMutation = useMutation({
    mutationFn: deploymentOrdersApi.create,
    onSuccess: (order) => {
      invalidate();
      setNumber("");
      setSquadronId("");
      setBaseId("");
      setLines([emptyLine()]);
      setError(null);
      showToast(`Deployment order ${order.number} created.`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const confirmMutation = useMutation({
    mutationFn: deploymentOrdersApi.confirm,
    onSuccess: (order) => {
      invalidate();
      setActionError(null);
      showToast(`Deployment order ${order.number} confirmed.`);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  const dispatchMutation = useMutation({
    mutationFn: deploymentOrdersApi.dispatch,
    onSuccess: (order) => {
      invalidate();
      invalidateStock();
      setActionError(null);
      showToast(`Deployment order ${order.number} dispatched — manifest rendering.`);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  function updateLine(index: number, patch: Partial<DeploymentOrderLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      number,
      squadron: Number(squadronId),
      source_base: Number(baseId),
      lines: lines.filter((l) => l.component),
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Deployment Orders</h1>
        <span className="muted">Supplies dispatched from a base to a squadron</span>
      </div>

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="dep-status-filter">Status</label>
          <select
            id="dep-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        {error && <div className="banner banner--error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label htmlFor="dep-number">Number</label>
              <input id="dep-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="DEP-0003" required />
            </div>
            <div className="form-field">
              <label htmlFor="dep-squadron">Squadron</label>
              <select id="dep-squadron" value={squadronId} onChange={(e) => setSquadronId(e.target.value)} required>
                <option value="">Select...</option>
                {(squadrons ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.callsign})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="dep-base">Source base</label>
              <select id="dep-base" value={baseId} onChange={(e) => setBaseId(e.target.value)} required>
                <option value="">Select...</option>
                {(bases ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="line-items">
            {lines.map((line, i) => (
              <div className="line-item-row" key={i}>
                <div className="form-field">
                  <label>Component</label>
                  <select
                    value={line.component || ""}
                    onChange={(e) => updateLine(i, { component: Number(e.target.value) })}
                    required
                  >
                    <option value="">Select...</option>
                    {(components ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sku} ({c.total_stock} avail.)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="form-field">
                  <label>Unit price</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={line.unit_price}
                    onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length === 1}
                  title="Remove line"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            + Add line
          </button>
          <div style={{ marginTop: "1rem" }}>
            <button className="btn btn--primary" type="submit" disabled={createMutation.isPending}>
              Create order
            </button>
          </div>
        </form>
      </div>

      {actionError && <div className="banner banner--error">{actionError}</div>}

      {isError ? (
        <div className="banner banner--error">{extractErrorMessage(listError)}</div>
      ) : isLoading ? (
        <TableSkeleton rows={3} cols={7} />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Squadron</th>
                  <th>Base</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th>Manifest</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.number}</td>
                    <td>{squadrons?.find((s) => s.id === order.squadron)?.callsign ?? order.squadron}</td>
                    <td>{bases?.find((b) => b.id === order.source_base)?.code ?? order.source_base}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>{order.lines.length}</td>
                    <td>
                      {order.status === "DISPATCHED" ? <ManifestCell orderId={order.id} /> : <span className="muted">-</span>}
                    </td>
                    <td>
                      {order.status === "DRAFT" && (
                        <button className="btn" onClick={() => confirmMutation.mutate(order.id)}>
                          Confirm
                        </button>
                      )}
                      {order.status === "CONFIRMED" && (
                        <button className="btn btn--primary" onClick={() => dispatchMutation.mutate(order.id)}>
                          Dispatch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} count={ordersPage?.count ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
