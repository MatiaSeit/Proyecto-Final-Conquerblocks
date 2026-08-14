import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "../context/AuthContext";
import { LoginPage } from "./LoginPage";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe("LoginPage", () => {
  it("submits the entered callsign and access code to login()", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, login, logout: vi.fn() });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Callsign/i), "command");
    await user.type(screen.getByLabelText(/Access Code/i), "RebelYell123!");
    await user.click(screen.getByRole("button", { name: /Transmit credentials/i }));

    expect(login).toHaveBeenCalledWith("command", "RebelYell123!");
  });

  it("shows an error banner when login() rejects, instead of failing silently", async () => {
    const login = vi.fn().mockRejectedValue(new Error("nope"));
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, login, logout: vi.fn() });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Callsign/i), "command");
    await user.type(screen.getByLabelText(/Access Code/i), "wrong-code");
    await user.click(screen.getByRole("button", { name: /Transmit credentials/i }));

    await waitFor(() => expect(screen.getByText("Something went wrong. Try again.")).toBeInTheDocument());
  });

  it("redirects away immediately if a user is already logged in", () => {
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

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>
    );

    // LoginPage renders a <Navigate> instead of the form once a user exists.
    expect(screen.queryByRole("button", { name: /Transmit credentials/i })).not.toBeInTheDocument();
  });
});
