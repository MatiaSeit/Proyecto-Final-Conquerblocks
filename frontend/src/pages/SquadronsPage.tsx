import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { squadronsApi } from "../api/endpoints";
import { extractErrorMessage } from "../api/errors";
import { TableSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function SquadronsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: squadrons, isLoading } = useQuery({ queryKey: ["squadrons"], queryFn: squadronsApi.list });

  const [name, setName] = useState("");
  const [callsign, setCallsign] = useState("");
  const [commander, setCommander] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: squadronsApi.create,
    onSuccess: (squadron) => {
      queryClient.invalidateQueries({ queryKey: ["squadrons"] });
      setName("");
      setCallsign("");
      setCommander("");
      setError(null);
      showToast(`Squadron ${squadron.callsign} registered.`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, callsign, commanding_officer: commander });
  }

  const canCreate = user?.role === "COMMAND";

  return (
    <div>
      <div className="page-header">
        <h1>Squadrons</h1>
      </div>

      {canCreate && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          {error && <div className="banner banner--error">{error}</div>}
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-field">
              <label htmlFor="sq-name">Name</label>
              <input id="sq-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-field">
              <label htmlFor="sq-callsign">Callsign</label>
              <input id="sq-callsign" value={callsign} onChange={(e) => setCallsign(e.target.value)} required />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="sq-commander">Commanding officer</label>
              <input id="sq-commander" value={commander} onChange={(e) => setCommander(e.target.value)} />
            </div>
            <div className="form-field--full">
              <button className="btn btn--primary" type="submit" disabled={createMutation.isPending}>
                Register squadron
              </button>
            </div>
          </form>
        </div>
      )}
      {!canCreate && <p className="muted">Only Alliance Command can register new squadrons.</p>}

      {isLoading ? (
        <TableSkeleton rows={2} cols={3} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Callsign</th>
                <th>Name</th>
                <th>Commanding officer</th>
              </tr>
            </thead>
            <tbody>
              {(squadrons ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.callsign}</td>
                  <td>{s.name}</td>
                  <td>{s.commanding_officer || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
