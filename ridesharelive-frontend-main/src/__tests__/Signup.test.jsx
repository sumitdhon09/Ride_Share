import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Signup from "../Signup";
import { apiRequest, storeAuthSession } from "../api";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
  storeAuthSession: vi.fn((payload) => {
    localStorage.setItem("token", payload.accessToken || payload.token || "");
    localStorage.setItem("refreshToken", payload.refreshToken || "");
    localStorage.setItem("role", payload.role || "");
    localStorage.setItem("name", payload.name || "");
    localStorage.setItem("userId", String(payload.id || ""));
    return payload;
  }),
}));

describe("Signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("requests OTP before submitting signup", async () => {
    const onSignup = vi.fn();
    apiRequest
      .mockResolvedValueOnce({ message: "OTP sent.", retryAfterSeconds: 30 })
      .mockResolvedValueOnce({ message: "Account created." })
      .mockResolvedValueOnce({
        token: "signup-token",
        accessToken: "signup-token",
        refreshToken: "refresh-token",
        role: "RIDER",
        name: "Test Rider",
        id: 12,
      });

    render(<Signup onSignup={onSignup} />);

    await userEvent.type(screen.getByLabelText(/full name/i), "Test Rider");
    await userEvent.type(screen.getByLabelText(/^email$/i), "rider@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "pass1234");
    await userEvent.click(screen.getByRole("button", { name: /send otp/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenNthCalledWith(1, "/auth/signup/request-otp", "POST", {
        name: "Test Rider",
        email: "rider@example.com",
      });
    });

    await userEvent.type(screen.getByLabelText(/^otp$/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenNthCalledWith(2, "/auth/signup", "POST", {
        name: "Test Rider",
        email: "rider@example.com",
        password: "pass1234",
        otp: "123456",
        role: "RIDER",
      });
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenNthCalledWith(3, "/auth/login", "POST", {
        email: "rider@example.com",
        password: "pass1234",
        role: "RIDER",
      });
    });

    expect(onSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "signup-token",
        role: "RIDER",
        name: "Test Rider",
      })
    );
    expect(storeAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "signup-token",
        role: "RIDER",
      })
    );
  });

  it("surfaces a dev OTP when backend returns one", async () => {
    apiRequest.mockResolvedValueOnce({
      message: "OTP generated for local development.",
      devOtp: "654321",
      retryAfterSeconds: 30,
    });

    render(<Signup />);

    await userEvent.type(screen.getByLabelText(/full name/i), "Test Rider");
    await userEvent.type(screen.getByLabelText(/^email$/i), "rider@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send otp/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("654321")).toBeInTheDocument();
      expect(screen.getByText(/demo otp: 654321/i)).toBeInTheDocument();
    });
  });

  it("starts a resend countdown after OTP is sent", async () => {
    apiRequest.mockResolvedValueOnce({
      message: "OTP sent to your email address.",
      retryAfterSeconds: 30,
      expiresAt: "2026-03-22T12:30:00Z",
    });

    render(<Signup />);

    await userEvent.type(screen.getByLabelText(/full name/i), "Test Rider");
    await userEvent.type(screen.getByLabelText(/^email$/i), "rider@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send otp/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /resend in \d+s/i })).toBeDisabled();
      expect(screen.getByText(/resend in \d+s\./i)).toBeInTheDocument();
      expect(screen.getByText(/code expires at/i)).toBeInTheDocument();
    });
  });
});
