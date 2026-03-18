import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RideBookingForm from "../components/RideBookingForm";
import { apiRequest } from "../api";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
}));

describe("RideBookingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      const query = (url.searchParams.get("q") || "").toLowerCase();
      const geocodeByQuery = {
        kondapur: [{ lat: "17.4697", lon: "78.3638" }],
        "hitech city": [{ lat: "17.4435", lon: "78.3772" }],
      };
      const payload = geocodeByQuery[query] || [{ lat: "17.385", lon: "78.4867" }];
      return {
        json: async () => payload,
      };
    });
  });

  it("books a ride when token is present", async () => {
    const onBook = vi.fn();
    localStorage.setItem("token", "rider-token");
    apiRequest.mockResolvedValue({ id: 99 });

    render(<RideBookingForm onBook={onBook} />);

    await userEvent.type(screen.getByLabelText(/pickup/i), "Kondapur");
    await userEvent.type(screen.getByLabelText(/destination/i), "Hitech City");
    await waitFor(() => {
      expect(screen.queryByText(/enter valid pickup and destination/i)).not.toBeInTheDocument();
    }, { timeout: 4000 });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm ride/i })).toBeEnabled();
    }, { timeout: 4000 });
    await userEvent.click(screen.getByRole("button", { name: /confirm ride/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/rides/book",
        "POST",
        expect.objectContaining({
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          fare: expect.any(Number),
          paymentMode: "CASH",
        }),
        "rider-token"
      );
    });

    expect(onBook).toHaveBeenCalled();
  });

  it("shows an error when user is not logged in", async () => {
    render(<RideBookingForm />);

    await userEvent.type(screen.getByLabelText(/pickup/i), "Kondapur");
    await userEvent.type(screen.getByLabelText(/destination/i), "Hitech City");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm ride/i })).toBeEnabled();
    }, { timeout: 4000 });
    await userEvent.click(screen.getByRole("button", { name: /confirm ride/i }));

    expect(await screen.findByText(/please login before booking a ride/i)).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("books a ride with dummy card payment", async () => {
    const onBook = vi.fn();
    localStorage.setItem("token", "rider-token");
    apiRequest.mockResolvedValue({ id: 100 });

    render(<RideBookingForm onBook={onBook} />);

    await userEvent.type(screen.getByLabelText(/pickup/i), "Kondapur");
    await userEvent.type(screen.getByLabelText(/destination/i), "Hitech City");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm ride/i })).toBeEnabled();
    }, { timeout: 4000 });

    await userEvent.click(screen.getByRole("button", { name: /card/i }));
    await userEvent.type(screen.getByLabelText(/card holder/i), "Test Rider");
    await userEvent.type(screen.getByLabelText(/card number/i), "4242424242424242");
    await userEvent.type(screen.getByLabelText(/expiry/i), "1228");
    await userEvent.type(screen.getByLabelText(/cvv/i), "123");
    await userEvent.click(screen.getByRole("button", { name: /confirm ride/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/rides/book",
        "POST",
        expect.objectContaining({
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          paymentMode: "CARD",
          paymentStatus: "PAID",
          paymentReference: "DUMMY-CARD-4242",
        }),
        "rider-token"
      );
    });

    expect(onBook).toHaveBeenCalled();
  });

  it("books a ride with dummy upi payment", async () => {
    const onBook = vi.fn();
    localStorage.setItem("token", "rider-token");
    apiRequest.mockResolvedValue({ id: 101 });

    render(<RideBookingForm onBook={onBook} />);

    await userEvent.type(screen.getByLabelText(/pickup/i), "Kondapur");
    await userEvent.type(screen.getByLabelText(/destination/i), "Hitech City");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm ride/i })).toBeEnabled();
    }, { timeout: 4000 });

    await userEvent.click(screen.getByRole("button", { name: /^upi$/i }));
    await userEvent.type(screen.getByLabelText(/upi id/i), "demo@upi");
    await userEvent.click(screen.getByRole("button", { name: /confirm ride/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/rides/book",
        "POST",
        expect.objectContaining({
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          paymentMode: "UPI",
          paymentStatus: "PAID",
          paymentReference: "DUMMY-UPI-demo@upi",
        }),
        "rider-token"
      );
    });

    expect(onBook).toHaveBeenCalled();
  });

  it("rejects invalid dummy upi ids", async () => {
    localStorage.setItem("token", "rider-token");
    apiRequest.mockResolvedValue({ id: 102 });

    render(<RideBookingForm />);

    await userEvent.type(screen.getByLabelText(/pickup/i), "Kondapur");
    await userEvent.type(screen.getByLabelText(/destination/i), "Hitech City");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm ride/i })).toBeEnabled();
    }, { timeout: 4000 });

    await userEvent.click(screen.getByRole("button", { name: /^upi$/i }));
    await userEvent.type(screen.getByLabelText(/upi id/i), "invalid-upi");
    await userEvent.click(screen.getByRole("button", { name: /confirm ride/i }));

    expect(await screen.findByText(/enter a valid-looking upi id/i)).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith("/rides/book", expect.anything(), expect.anything(), expect.anything());
  });
});
