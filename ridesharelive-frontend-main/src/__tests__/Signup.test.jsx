import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Signup from "../Signup";
import { apiRequest } from "../api";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
}));

describe("Signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests OTP before submitting signup", async () => {
    const onSignup = vi.fn();
    apiRequest
      .mockResolvedValueOnce({ message: "OTP sent." })
      .mockResolvedValueOnce({ message: "Account created." });

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

    expect(onSignup).toHaveBeenCalled();
  });
});
