import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { basesApi, componentsApi, requisitionsApi, suppliersApi } from "../api/endpoints";
import { extractErrorMessage } from "../api/errors";
import { Pagination } from "../components/Pagination";
import { TableSkeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import type { RequisitionLine } from "../api/types";

const emptyLine = (): RequisitionLine => ({ component: 0, quantity: 1, unit_cost: "0" });
const PAGE_SIZE = 20;

const STATUSES = ["DRAFT", "SUBMITTED", "RECEIVED", "CANCELLED"];

export function RequisitionsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const {
    data: requisitionsPage,
    isLoading,
    isError,
    error: listError,
  } = useQuery({
    queryKey: ["requisitions", statusFilter, page],
    queryFn: () => requisitionsApi.list({ page, status: statusFilter || undefined }),
  });
  const requisitions = requisitionsPage?.results ?? [];
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: suppliersApi.list });
  const { data: bases } = useQuery({ queryKey: ["bases"], queryFn: basesApi.list });
  const { data: components } = useQuery({ queryKey: ["components"], queryFn: () => componentsApi.list() });

  const [number, setNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [baseId, setBaseId] = useState("");
  const [lines, setLines] = useState<RequisitionLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["requisitions"] });
  const invalidateStock = () => {
    queryClient.invalidateQueries({ queryKey: ["stock"] });
    queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const createMutation = useMutation({
    mutationFn: requisitionsApi.create,
    onSuccess: (req) => {
      invalidate();
      setNumber("");
      setSupplierId("");
      setBaseId("");
      setLines([emptyLine()]);
      setError(null);
      showToast(`Requisition ${req.number} created.`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const submitMutation = useMutation({
    mutationFn: requisitionsApi.submit,
    onSuccess: (req) => {
      invalidate();
      setActionError(null);
      showToast(`Requisition ${req.number} submitted.`);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  const receiveMutation = useMutation({
    mutationFn: requisitionsApi.receive,
    onSuccess: (req) => {
      invalidate();
      invalidateStock();
      setActionError(null);
      showToast(`Requisition ${req.number} received — stock updated.`);
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  function updateLine(index: number, patch: Partial<RequisitionLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      number,
      supplier: Number(supplierId),
      destination_base: Number(baseId),
      lines: lines.filter((l) => l.component),
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Requisitions</h1>
        <span className="muted">Purchase orders placed to suppliers, received into a base</span>
      </div>

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="req-status-filter">Status</label>
          <select
            id="req-status-filter"
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
              <label htmlFor="req-number">Number</label>
              <input id="req-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="REQ-0003" required />
            </div>
            <div className="form-field">
              <label htmlFor="req-supplier">Supplier</label>
              <select id="req-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                <option value="">Select...</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="req-base">Destination base</label>
              <select id="req-base" value={baseId} onChange={(e) => setBaseId(e.target.value)} required>
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
                        {c.sku}
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
                  <label>Unit cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={line.unit_cost}
                    onChange={(e) => updateLine(i, { unit_cost: e.target.value })}
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
              Create requisition
            </button>
          </div>
        </form>
      </div>

      {actionError && <div className="banner banner--error">{actionError}</div>}

      {isError ? (
        <div className="banner banner--error">{extractErrorMessage(listError)}</div>
      ) : isLoading ? (
        <TableSkeleton rows={3} cols={6} />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Supplier</th>
                  <th>Base</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((req) => (
                  <tr key={req.id}>
                    <td>{req.number}</td>
                    <td>{suppliers?.find((s) => s.id === req.supplier)?.name ?? req.supplier}</td>
                    <td>{bases?.find((b) => b.id === req.destination_base)?.code ?? req.destination_base}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td>{req.lines.length}</td>
                    <td>
                      {req.status === "DRAFT" && (
                        <button className="btn" onClick={() => submitMutation.mutate(req.id)}>
                          Submit
                        </button>
                      )}
                      {req.status === "SUBMITTED" && (
                        <button className="btn btn--primary" onClick={() => receiveMutation.mutate(req.id)}>
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} count={requisitionsPage?.count ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
