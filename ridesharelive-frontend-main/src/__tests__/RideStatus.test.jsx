import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RideStatus from "../components/RideStatus";
import { apiRequest } from "../api";

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
});
