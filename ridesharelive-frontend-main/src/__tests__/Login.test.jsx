import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../Login";
import { apiRequest } from "../api";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success) =>
          success({
            coords: { latitude: 17.385, longitude: 78.4867, accuracy: 25 },
          }),
      },
    });
  });

  it("submits login and stores user session", async () => {
    const onLogin = vi.fn();
    apiRequest.mockResolvedValue({
      token: "token-123",
      role: "RIDER",
      name: "Test Rider",
      id: 55,
    });

    render(<Login onLogin={onLogin} />);

    await userEvent.type(screen.getByLabelText(/email/i), "rider@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass1234");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/auth/login", "POST", {
        email: "rider@example.com",
        password: "pass1234",
        role: "RIDER",
      });
    });

    expect(localStorage.getItem("token")).toBe("token-123");
    expect(localStorage.getItem("role")).toBe("RIDER");
    expect(localStorage.getItem("name")).toBe("Test Rider");
    expect(localStorage.getItem("userId")).toBe("55");
    expect(onLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "RIDER",
        name: "Test Rider",
      })
    );
  });
});
