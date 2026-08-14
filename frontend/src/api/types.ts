export type Role = "COMMAND" | "QUARTERMASTER" | "TECHNICIAN" | "DISPATCHER";

export interface Me {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: Role;
  assigned_base: number | null;
  assigned_base_code: string | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Base {
  id: number;
  name: string;
  code: string;
  system: string;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  parent: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  home_system: string;
  contact_channel: string;
  is_active: boolean;
}

export interface Squadron {
  id: number;
  name: string;
  callsign: string;
  commanding_officer: string;
}

export interface Component {
  id: number;
  sku: string;
  name: string;
  category: number;
  unit_of_measure: "UNIT" | "CRATE" | "KG" | "LITER";
  unit_cost: string;
  unit_price: string;
  minimum_stock: number;
  is_active: boolean;
  total_stock: number;
}

export interface Stock {
  id: number;
  base: number;
  base_code: string;
  component: number;
  component_sku: string;
  quantity: number;
}

export interface StockMovement {
  id: number;
  base: number;
  component: number;
  movement_type: "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  reference: string;
  reason: string;
  performed_by: number;
  performed_by_username: string;
  created_at: string;
}

export type RequisitionStatus = "DRAFT" | "SUBMITTED" | "RECEIVED" | "CANCELLED";

export interface RequisitionLine {
  id?: number;
  component: number;
  quantity: number;
  unit_cost: string;
}

export interface Requisition {
  id: number;
  number: string;
  supplier: number;
  destination_base: number;
  status: RequisitionStatus;
  created_by: number;
  created_at: string;
  received_at: string | null;
  lines: RequisitionLine[];
}

export type DeploymentOrderStatus = "DRAFT" | "CONFIRMED" | "DISPATCHED" | "CANCELLED";

export interface DeploymentOrderLine {
  id?: number;
  component: number;
  quantity: number;
  unit_price: string;
}

export interface DeploymentOrder {
  id: number;
  number: string;
  squadron: number;
  source_base: number;
  status: DeploymentOrderStatus;
  created_by: number;
  created_at: string;
  dispatched_at: string | null;
  lines: DeploymentOrderLine[];
}

export interface LowStockRow {
  id: number;
  sku: string;
  name: string;
  total_stock: number | null;
  minimum_stock: number;
}

export interface ValuationRow {
  base__code: string;
  base__name: string;
  total_value: number;
}

export interface Manifest {
  id: number;
  order: number;
  number: string;
  total_value: string;
  issued_at: string;
  pdf_file: string | null;
  pdf_ready: boolean;
  download_url: string | null;
}

export interface ApiErrorBody {
  detail?: string;
  [field: string]: unknown;
}
