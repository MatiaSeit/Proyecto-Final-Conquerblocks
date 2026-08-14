import { api } from "./client";
import type {
  Base,
  Category,
  Component,
  DeploymentOrder,
  LowStockRow,
  Manifest,
  Me,
  Paginated,
  Requisition,
  Squadron,
  Stock,
  StockMovement,
  Supplier,
  ValuationRow,
} from "./types";

export async function login(username: string, password: string) {
  const { data } = await api.post<{ access: string; refresh: string }>("/auth/token/", {
    username,
    password,
  });
  return data;
}

export const meApi = {
  get: () => api.get<Me>("/accounts/me/").then((r) => r.data),
};

export const basesApi = {
  list: () => api.get<Paginated<Base>>("/bases/").then((r) => r.data.results),
  create: (payload: Partial<Base>) => api.post<Base>("/bases/", payload).then((r) => r.data),
};

export const categoriesApi = {
  list: () => api.get<Paginated<Category>>("/categories/").then((r) => r.data.results),
  create: (payload: Partial<Category>) => api.post<Category>("/categories/", payload).then((r) => r.data),
};

export const suppliersApi = {
  list: () => api.get<Paginated<Supplier>>("/suppliers/").then((r) => r.data.results),
  create: (payload: Partial<Supplier>) => api.post<Supplier>("/suppliers/", payload).then((r) => r.data),
};

export const squadronsApi = {
  list: () => api.get<Paginated<Squadron>>("/squadrons/").then((r) => r.data.results),
  create: (payload: Partial<Squadron>) => api.post<Squadron>("/squadrons/", payload).then((r) => r.data),
};

export const componentsApi = {
  // `search` hits ComponentViewSet's SearchFilter (search_fields = ["sku", "name"]),
  // already wired up on the backend and previously unused by the frontend.
  list: (params?: { search?: string }) =>
    api.get<Paginated<Component>>("/components/", { params }).then((r) => r.data.results),
  create: (payload: Partial<Component>) => api.post<Component>("/components/", payload).then((r) => r.data),
};

export const stockApi = {
  list: (params?: { base?: number; component?: number }) =>
    api.get<Paginated<Stock>>("/stock/", { params }).then((r) => r.data.results),
  // Unpaginated convenience for small "recent activity" feeds (Dashboard) --
  // just the first page's results.
  movements: (params?: { base?: number; component?: number }) =>
    api
      .get<Paginated<StockMovement>>("/stock-movements/", { params: { ordering: "-created_at", ...params } })
      .then((r) => r.data.results),
  // Full paginated response for the Stock & Ledger page's movement table,
  // which can grow well past one page of results over the life of the app.
  movementsPage: (params?: { base?: number; component?: number; page?: number }) =>
    api
      .get<Paginated<StockMovement>>("/stock-movements/", { params: { ordering: "-created_at", ...params } })
      .then((r) => r.data),
};

export const requisitionsApi = {
  list: (params?: { page?: number; status?: string }) =>
    api.get<Paginated<Requisition>>("/requisitions/", { params }).then((r) => r.data),
  create: (payload: Omit<Requisition, "id" | "status" | "created_by" | "created_at" | "received_at">) =>
    api.post<Requisition>("/requisitions/", payload).then((r) => r.data),
  submit: (id: number) => api.post<Requisition>(`/requisitions/${id}/submit/`).then((r) => r.data),
  receive: (id: number) => api.post<Requisition>(`/requisitions/${id}/receive/`).then((r) => r.data),
};

export const deploymentOrdersApi = {
  list: (params?: { page?: number; status?: string }) =>
    api.get<Paginated<DeploymentOrder>>("/deployment-orders/", { params }).then((r) => r.data),
  create: (payload: Omit<DeploymentOrder, "id" | "status" | "created_by" | "created_at" | "dispatched_at">) =>
    api.post<DeploymentOrder>("/deployment-orders/", payload).then((r) => r.data),
  confirm: (id: number) => api.post<DeploymentOrder>(`/deployment-orders/${id}/confirm/`).then((r) => r.data),
  dispatch: (id: number) => api.post<DeploymentOrder>(`/deployment-orders/${id}/dispatch/`).then((r) => r.data),
};

export const manifestsApi = {
  byOrder: (orderId: number) =>
    api.get<Paginated<Manifest>>("/manifests/", { params: { order: orderId } }).then((r) => r.data.results[0]),
};

export const reportsApi = {
  lowStock: () => api.get<LowStockRow[]>("/reports/low-stock/").then((r) => r.data),
  valuation: () => api.get<ValuationRow[]>("/reports/inventory-valuation/").then((r) => r.data),
};
