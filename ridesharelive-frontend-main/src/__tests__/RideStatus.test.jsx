import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RideStatus from "../components/RideStatus";
import { apiRequest } from "../api";
import { formatRideTimestamp } from "../utils/ridePresentation";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
}));

describe("RideStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("polls ride status endpoint and notifies on completion", async () => {
    localStorage.setItem("token", "rider-token");
    const onComplete = vi.fn();

    apiRequest.mockResolvedValue({
      id: 5,
      pickupLocation: "Kondapur",
      dropLocation: "Hitech City",
      fare: 150,
      status: "COMPLETED",
    });

    render(
      <RideStatus
        ride={{
          id: 5,
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          fare: 150,
          status: "ACCEPTED",
        }}
        onComplete={onComplete}
      />
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/rides/status/5", "GET", null, "rider-token");
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("shows booking confirmation details, timestamps, and cancellation preview", async () => {
    localStorage.setItem("token", "rider-token");
    localStorage.setItem(
      "rideBookingConfirmation:5",
      JSON.stringify({
        rideId: "5",
        paymentMode: "UPI",
        paymentStatus: "PAID",
        etaText: "8-13 min",
        preferredDriverName: "Amit",
        requestedAt: "2026-03-22T10:00:00Z",
      })
    );

    apiRequest.mockResolvedValue({
      id: 5,
      pickupLocation: "Kondapur",
      dropLocation: "Hitech City",
      fare: 150,
      status: "ACCEPTED",
      createdAt: "2026-03-22T10:00:00Z",
      acceptedAt: "2026-03-22T10:02:00Z",
      paymentMode: "UPI",
      paymentStatus: "PAID",
    });

    render(
      <RideStatus
        ride={{
          id: 5,
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          fare: 150,
          status: "ACCEPTED",
          createdAt: "2026-03-22T10:00:00Z",
          acceptedAt: "2026-03-22T10:02:00Z",
          paymentMode: "UPI",
          paymentStatus: "PAID",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("#5")).toBeInTheDocument();
      expect(screen.getByText("8-13 min")).toBeInTheDocument();
      expect(screen.getByText("Amit")).toBeInTheDocument();
      expect(screen.getByText(/if you cancel now/i)).toBeInTheDocument();
      expect(screen.getByText(formatRideTimestamp("2026-03-22T10:00:00Z"))).toBeInTheDocument();
      expect(screen.getByText(formatRideTimestamp("2026-03-22T10:02:00Z"))).toBeInTheDocument();
    });
  });
});
