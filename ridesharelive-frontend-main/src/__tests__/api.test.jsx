import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api";

function createMockResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (header) => (header.toLowerCase() === "content-type" ? "application/json" : ""),
    },
    text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}

describe("apiRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not clear the stored session on a 403 response", async () => {
    localStorage.setItem("token", "driver-token");
    localStorage.setItem("refreshToken", "driver-refresh");
    localStorage.setItem("role", "DRIVER");
    localStorage.setItem("name", "Driver");
    localStorage.setItem("userId", "22");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createMockResponse(403, { message: "Ride belongs to another driver." }))
    );

    await expect(apiRequest("/rides/status/11", "POST", { status: "PICKED", otp: "1234" }, "driver-token")).rejects.toMatchObject({
      status: 403,
    });

    expect(localStorage.getItem("token")).toBe("driver-token");
    expect(localStorage.getItem("refreshToken")).toBe("driver-refresh");
    expect(localStorage.getItem("role")).toBe("DRIVER");
    expect(localStorage.getItem("name")).toBe("Driver");
    expect(localStorage.getItem("userId")).toBe("22");
  });
});
