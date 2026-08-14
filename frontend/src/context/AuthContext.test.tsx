import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, meApi } from "../api/endpoints";
import { tokenStore } from "../api/tokenStore";
import { AuthProvider, useAuth } from "./AuthContext";

// AuthContext talks to the real API through api/endpoints.ts -- mock that
// module so these tests exercise the token/state logic without a backend.
vi.mock("../api/endpoints", () => ({
  login: vi.fn(),
  meApi: { get: vi.fn() },
}));

const mockedLogin = vi.mocked(login);
const mockedMe = vi.mocked(meApi.get);

const COMMAND_USER = {
  id: 1,
  username: "command",
  first_name: "",
  last_name: "",
  role: "COMMAND" as const,
  assigned_base: null,
  assigned_base_code: null,
};

function Consumer() {
  const { user, isLoading, login: doLogin, logout } = useAuth();
  if (isLoading) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `Signed in as ${user.username}` : "Signed out"}</p>
      <button onClick={() => doLogin("command", "RebelYell123!")}>Log in</button>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    tokenStore.clear();
    mockedLogin.mockReset();
    mockedMe.mockReset();
  });

  it("stores the JWT pair and loads the profile on a successful login", async () => {
    mockedLogin.mockResolvedValue({ access: "access-token", refresh: "refresh-token" });
    mockedMe.mockResolvedValue(COMMAND_USER);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => screen.getByText("Signed out"));
    await user.click(screen.getByText("Log in"));

    await waitFor(() => expect(screen.getByText("Signed in as command")).toBeInTheDocument());
    expect(tokenStore.getAccess()).toBe("access-token");
    expect(tokenStore.getRefresh()).toBe("refresh-token");
  });

  it("clears stored tokens on logout", async () => {
    mockedLogin.mockResolvedValue({ access: "a", refresh: "r" });
    mockedMe.mockResolvedValue(COMMAND_USER);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => screen.getByText("Signed out"));
    await user.click(screen.getByText("Log in"));
    await waitFor(() => screen.getByText("Signed in as command"));

    await user.click(screen.getByText("Log out"));

    expect(screen.getByText("Signed out")).toBeInTheDocument();
    expect(tokenStore.getAccess()).toBeNull();
  });

  it("clears a stale token if the stored session can no longer be loaded", async () => {
    localStorage.setItem("asc_access_token", "stale-token");
    mockedMe.mockRejectedValue(new Error("401"));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
    expect(tokenStore.getAccess()).toBeNull();
  });
});
