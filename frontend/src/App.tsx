import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { BasesPage } from "./pages/BasesPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeploymentOrdersPage } from "./pages/DeploymentOrdersPage";
import { LoginPage } from "./pages/LoginPage";
import { RequisitionsPage } from "./pages/RequisitionsPage";
import { SquadronsPage } from "./pages/SquadronsPage";
import { StockPage } from "./pages/StockPage";
import { SuppliersPage } from "./pages/SuppliersPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/components" element={<ComponentsPage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/requisitions" element={<RequisitionsPage />} />
                <Route path="/deployment-orders" element={<DeploymentOrdersPage />} />
                <Route path="/bases" element={<BasesPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/squadrons" element={<SquadronsPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
