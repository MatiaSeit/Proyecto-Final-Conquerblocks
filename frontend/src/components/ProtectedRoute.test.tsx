import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "../context/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

// ProtectedRoute only cares about what useAuth() returns -- mock the hook
// directly instead of standing up a real AuthProvider + backend.
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Secret dashboard</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("renders nothing while the session is still being checked", () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: true, login: vi.fn(), logout: vi.fn() });
    const { container } = renderProtected();
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects to /login when there's no authenticated user", () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, login: vi.fn(), logout: vi.fn() });
    renderProtected();
    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("renders the protected content once a user is loaded", () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: "command",
        first_name: "",
        last_name: "",
        role: "COMMAND",
        assigned_base: null,
        assigned_base_code: null,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderProtected();
    expect(screen.getByText("Secret dashboard")).toBeInTheDocument();
  });
});
