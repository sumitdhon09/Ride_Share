import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RideHistory from "../components/RideHistory";

describe("RideHistory", () => {
  it("renders formatted payment labels and payment status badges", () => {
    render(
      <RideHistory
        autoRefresh={false}
        rides={[
          {
            id: 1,
            pickupLocation: "Kondapur",
            dropLocation: "Hitech City",
            fare: 150,
            status: "COMPLETED",
            paymentMode: "UPI",
            paymentStatus: "PAID",
          },
        ]}
      />
    );

    expect(screen.getByText("UPI")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });
});
