import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RideBookingForm from "../components/RideBookingForm";
import { apiRequest } from "../api";

vi.mock("../api", () => ({
  apiRequest: vi.fn(),
}));

const PENDING_ONLINE_BOOKING_STORAGE_KEY = "pendingOnlineRideBooking:v1";

function getPathCalls(path) {
  return apiRequest.mock.calls.filter(([calledPath]) => calledPath === path);
}

function mockApiFlow({
  bookResponse = { id: 99 },
  checkoutResponse = { sessionId: "local_session_default", sessionUrl: "https://checkout.example", isMock: true },
  estimateResponse = { estimatedFare: 180, etaMinMinutes: 8, etaMaxMinutes: 13 },
} = {}) {
  apiRequest.mockImplementation(async (path) => {
    if (String(path).startsWith("/rides/estimate")) {
      return estimateResponse;
    }
    if (path === "/payments/checkout-session") {
      return checkoutResponse;
    }
    if (path === "/rides/book") {
      return bookResponse;
    }
    throw new Error(`Unexpected apiRequest path: ${path}`);
  });
}

async function fillRouteAndWait() {
  await userEvent.type(screen.getByLabelText(/pickup/i), "Kondapur");
  await userEvent.type(screen.getByLabelText(/destination/i), "Hitech City");
  await waitFor(() => {
    expect(screen.queryByText(/enter valid pickup and destination/i)).not.toBeInTheDocument();
  }, { timeout: 4000 });
}

describe("RideBookingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");

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

  it("books a cash ride when token is present", async () => {
    const onBook = vi.fn();
    localStorage.setItem("token", "rider-token");
    mockApiFlow({ bookResponse: { id: 99 } });

    render(<RideBookingForm onBook={onBook} />);

    await fillRouteAndWait();
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
          paymentReference: "CASH",
        }),
        "rider-token"
      );
    });

    expect(onBook).toHaveBeenCalled();
  });

  it("shows an error when user is not logged in", async () => {
    mockApiFlow();

    render(<RideBookingForm />);

    await fillRouteAndWait();
    await userEvent.click(screen.getByRole("button", { name: /confirm ride/i }));

    expect(await screen.findByText(/please login before booking a ride/i)).toBeInTheDocument();
    expect(getPathCalls("/rides/book")).toHaveLength(0);
  });

  it("creates a checkout session for card and books with the returned mock session id", async () => {
    const onBook = vi.fn();
    localStorage.setItem("token", "rider-token");
    mockApiFlow({
      bookResponse: { id: 100 },
      checkoutResponse: {
        sessionId: "local_session_card_123",
        sessionUrl: "https://checkout.example/card",
        isMock: true,
      },
    });

    render(<RideBookingForm onBook={onBook} />);

    await fillRouteAndWait();
    await userEvent.click(screen.getByRole("button", { name: /^card$/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/payments/checkout-session",
        "POST",
        expect.objectContaining({
          amountInInr: expect.any(Number),
          paymentMode: "CARD",
        }),
        "rider-token"
      );
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/rides/book",
        "POST",
        expect.objectContaining({
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          paymentMode: "CARD",
          paymentStatus: "PAID",
          paymentReference: "local_session_card_123",
        }),
        "rider-token"
      );
    });

    expect(onBook).toHaveBeenCalled();
  });

  it("creates a checkout session for upi and books with the returned mock session id", async () => {
    const onBook = vi.fn();
    localStorage.setItem("token", "rider-token");
    mockApiFlow({
      bookResponse: { id: 101 },
      checkoutResponse: {
        sessionId: "local_session_upi_123",
        sessionUrl: "https://checkout.example/upi",
        isMock: true,
      },
    });

    render(<RideBookingForm onBook={onBook} />);

    await fillRouteAndWait();
    await userEvent.click(screen.getByRole("button", { name: /^upi$/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/payments/checkout-session",
        "POST",
        expect.objectContaining({
          amountInInr: expect.any(Number),
          paymentMode: "UPI",
        }),
        "rider-token"
      );
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/rides/book",
        "POST",
        expect.objectContaining({
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          paymentMode: "UPI",
          paymentStatus: "PAID",
          paymentReference: "local_session_upi_123",
        }),
        "rider-token"
      );
    });

    expect(onBook).toHaveBeenCalled();
  });

  it("restores the pending booking after a successful hosted payment return", async () => {
    const onBook = vi.fn();
    localStorage.setItem("token", "rider-token");
    localStorage.setItem(
      PENDING_ONLINE_BOOKING_STORAGE_KEY,
      JSON.stringify({
        bookingPayload: {
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          fare: 180,
          paymentMode: "CARD",
          preferredDriverId: null,
          preferredDriverName: "",
          paymentReference: "",
          paymentStatus: "PAID",
        },
        createdAt: new Date().toISOString(),
      })
    );
    window.history.replaceState({}, "", "/?payment=success&session_id=cs_test_123");

    apiRequest.mockImplementation(async (path) => {
      if (path === "/rides/book") {
        return { id: 102 };
      }
      throw new Error(`Unexpected apiRequest path: ${path}`);
    });

    render(<RideBookingForm onBook={onBook} />);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/rides/book",
        "POST",
        expect.objectContaining({
          pickupLocation: "Kondapur",
          dropLocation: "Hitech City",
          paymentMode: "CARD",
          paymentReference: "cs_test_123",
          paymentStatus: "PAID",
        }),
        "rider-token"
      );
    });

    expect(onBook).toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_ONLINE_BOOKING_STORAGE_KEY)).toBeNull();
    expect(window.location.search).toBe("");
  });
});
