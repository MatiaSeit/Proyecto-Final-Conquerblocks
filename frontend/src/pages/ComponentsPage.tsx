import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { categoriesApi, componentsApi } from "../api/endpoints";
import { extractErrorMessage } from "../api/errors";
import { TableSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function ComponentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const canCreate = user?.role === "COMMAND";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: components, isLoading } = useQuery({
    queryKey: ["components", debouncedSearch],
    queryFn: () => componentsApi.list({ search: debouncedSearch || undefined }),
  });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [minimumStock, setMinimumStock] = useState("0");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createCategory = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: (cat) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryId(String(cat.id));
      setNewCategory("");
    },
  });

  const createComponent = useMutation({
    mutationFn: componentsApi.create,
    onSuccess: (component) => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      setSku("");
      setName("");
      setUnitCost("");
      setUnitPrice("");
      setMinimumStock("0");
      setError(null);
      showToast(`Component ${component.sku} catalogued.`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("Pick or create a category first.");
      return;
    }
    createComponent.mutate({
      sku,
      name,
      category: Number(categoryId),
      unit_of_measure: "UNIT",
      unit_cost: unitCost,
      unit_price: unitPrice,
      minimum_stock: Number(minimumStock),
      is_active: true,
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Components</h1>
      </div>

      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="comp-search">Search</label>
          <input
            id="comp-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SKU or name..."
          />
        </div>
      </div>

      {canCreate && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          {error && <div className="banner banner--error">{error}</div>}

          <div className="form-grid" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label htmlFor="new-category">Quick-add category</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  id="new-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Starfighter Parts"
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!newCategory || createCategory.isPending}
                  onClick={() => createCategory.mutate({ name: newCategory })}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-field">
              <label htmlFor="comp-sku">SKU</label>
              <input id="comp-sku" value={sku} onChange={(e) => setSku(e.target.value)} required />
            </div>
            <div className="form-field">
              <label htmlFor="comp-name">Name</label>
              <input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-field">
              <label htmlFor="comp-category">Category</label>
              <select id="comp-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">Select...</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="comp-min">Minimum stock</label>
              <input
                id="comp-min"
                type="number"
                min={0}
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="comp-cost">Unit cost (cr)</label>
              <input
                id="comp-cost"
                type="number"
                step="0.01"
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="comp-price">Unit price (cr)</label>
              <input
                id="comp-price"
                type="number"
                step="0.01"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>
            <div className="form-field--full">
              <button className="btn btn--primary" type="submit" disabled={createComponent.isPending}>
                Catalog component
              </button>
            </div>
          </form>
        </div>
      )}
      {!canCreate && <p className="muted">Only Alliance Command can catalog new components.</p>}

      {isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : components?.length === 0 ? (
        <p className="muted">No components match "{debouncedSearch}".</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Unit cost</th>
                <th>Unit price</th>
                <th>Min. stock</th>
                <th>Total stock</th>
              </tr>
            </thead>
            <tbody>
              {(components ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.sku}</td>
                  <td>{c.name}</td>
                  <td>{c.unit_cost} cr</td>
                  <td>{c.unit_price} cr</td>
                  <td>{c.minimum_stock}</td>
                  <td style={{ color: c.total_stock <= c.minimum_stock ? "var(--color-danger)" : undefined }}>
                    {c.total_stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
