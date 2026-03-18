import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DriverDashboard from "../pages/DriverDashboard";
import { apiRequest } from "../api";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
}));

describe("DriverDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a requested ride with driverId in payload", async () => {
    localStorage.setItem("token", "driver-token");
    localStorage.setItem("userId", "22");
    localStorage.setItem("name", "Driver Test");

    const requestedRide = {
      id: 11,
      pickupLocation: "Kondapur",
      dropLocation: "Hitech City",
      fare: 150,
      paymentMode: "CASH",
      status: "REQUESTED",
      driverId: null,
    };

    apiRequest
      .mockResolvedValueOnce([requestedRide])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([{ ...requestedRide, status: "ACCEPTED", driverId: 22 }])
      .mockResolvedValueOnce([{ ...requestedRide, status: "ACCEPTED", driverId: 22 }]);

    render(<DriverDashboard />);

    const acceptButton = await screen.findByRole("button", { name: /accept/i });
    await userEvent.click(acceptButton);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/rides/status/11",
        "POST",
        { status: "ACCEPTED", driverId: "22" },
        "driver-token"
      );
    });
  });
});
