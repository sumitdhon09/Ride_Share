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

  it("keeps the accepted ride visible when the follow-up refresh partially fails", async () => {
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

    const acceptedRide = {
      ...requestedRide,
      status: "ACCEPTED",
      driverId: 22,
      startOtp: "1234",
      endOtp: "5678",
    };

    apiRequest
      .mockResolvedValueOnce([requestedRide])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(acceptedRide)
      .mockRejectedValueOnce(new Error("Temporary refresh failure"))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({});

    render(<DriverDashboard />);

    const acceptButton = await screen.findByRole("button", { name: /accept/i });
    await userEvent.click(acceptButton);

    expect(await screen.findByPlaceholderText(/enter rider pickup otp/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark picked/i })).toBeInTheDocument();
  });
});
