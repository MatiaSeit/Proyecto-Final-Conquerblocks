import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { basesApi } from "../api/endpoints";
import { extractErrorMessage } from "../api/errors";
import { TableSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function BasesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: bases, isLoading } = useQuery({ queryKey: ["bases"], queryFn: basesApi.list });

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [system, setSystem] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: basesApi.create,
    onSuccess: (base) => {
      queryClient.invalidateQueries({ queryKey: ["bases"] });
      setName("");
      setCode("");
      setSystem("");
      setError(null);
      showToast(`Base ${base.code} established.`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, code, system, is_active: true });
  }

  const canCreate = user?.role === "COMMAND";

  return (
    <div>
      <div className="page-header">
        <h1>Bases</h1>
      </div>

      {canCreate && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          {error && <div className="banner banner--error">{error}</div>}
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-field">
              <label htmlFor="base-name">Name</label>
              <input id="base-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-field">
              <label htmlFor="base-code">Code</label>
              <input id="base-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="base-system">System</label>
              <input id="base-system" value={system} onChange={(e) => setSystem(e.target.value)} required />
            </div>
            <div className="form-field--full">
              <button className="btn btn--primary" type="submit" disabled={createMutation.isPending}>
                Establish base
              </button>
            </div>
          </form>
        </div>
      )}
      {!canCreate && <p className="muted">Only Alliance Command can establish new bases.</p>}

      {isLoading ? (
        <TableSkeleton rows={2} cols={4} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>System</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(bases ?? []).map((base) => (
                <tr key={base.id}>
                  <td>{base.code}</td>
                  <td>{base.name}</td>
                  <td>{base.system}</td>
                  <td>{base.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
