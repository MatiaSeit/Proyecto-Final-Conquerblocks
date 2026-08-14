import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { suppliersApi } from "../api/endpoints";
import { extractErrorMessage } from "../api/errors";
import { TableSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function SuppliersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: suppliers, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: suppliersApi.list });

  const [name, setName] = useState("");
  const [homeSystem, setHomeSystem] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: suppliersApi.create,
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setName("");
      setHomeSystem("");
      setContact("");
      setError(null);
      showToast(`Supplier contact ${supplier.name} added.`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, home_system: homeSystem, contact_channel: contact, is_active: true });
  }

  const canCreate = user?.role === "COMMAND";

  return (
    <div>
      <div className="page-header">
        <h1>Suppliers</h1>
      </div>

      {canCreate && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          {error && <div className="banner banner--error">{error}</div>}
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-field">
              <label htmlFor="sup-name">Name</label>
              <input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-field">
              <label htmlFor="sup-system">Home system</label>
              <input id="sup-system" value={homeSystem} onChange={(e) => setHomeSystem(e.target.value)} />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="sup-contact">Contact channel</label>
              <input id="sup-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div className="form-field--full">
              <button className="btn btn--primary" type="submit" disabled={createMutation.isPending}>
                Add contact
              </button>
            </div>
          </form>
        </div>
      )}
      {!canCreate && <p className="muted">Only Alliance Command can add new supplier contacts.</p>}

      {isLoading ? (
        <TableSkeleton rows={2} cols={4} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Home system</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(suppliers ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.home_system || "-"}</td>
                  <td>{s.contact_channel || "-"}</td>
                  <td>{s.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
