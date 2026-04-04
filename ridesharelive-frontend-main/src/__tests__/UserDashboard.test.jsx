import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UserDashboard from "../pages/UserDashboard";
import { apiRequest } from "../api";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
}));

describe("UserDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("token", "user-token");
    apiRequest.mockResolvedValue([]);
  });

  it("renders the booking-first user dashboard", async () => {
    render(
      <UserDashboard
        session={{
          name: "Aarav Singh",
          role: "RIDER",
          token: "user-token",
          userId: "42",
        }}
      />
    );

    expect(await screen.findByText(/^where to\?$/i)).toBeInTheDocument();
    expect(screen.getByText(/set pickup and destination\./i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^ride$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activity/i })).toBeInTheDocument();
  });

  it("shows dedicated live trip page when a ride is active", async () => {
    apiRequest.mockResolvedValue([
      {
        id: 501,
        status: "REQUESTED",
        pickupLocation: "Kharadi",
        dropLocation: "Viman Nagar",
        fare: 220,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(
      <UserDashboard
        session={{
          name: "Aarav Singh",
          role: "RIDER",
          token: "user-token",
          userId: "42",
        }}
      />
    );

    expect(await screen.findByRole("heading", { name: /track your ride/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/current ride/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^ride$/i })).not.toBeInTheDocument();
  });
});
