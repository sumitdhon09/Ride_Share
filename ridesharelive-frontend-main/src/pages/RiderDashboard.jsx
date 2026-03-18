import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import CountUpNumber from "../components/CountUpNumber";
import LiveMapPanel from "../components/LiveMapPanel";
import LiveUpdateToast from "../components/LiveUpdateToast";
import RideBookingForm from "../components/RideBookingForm";
import RideFeedbackPanel from "../components/RideFeedbackPanel";
import RideHistory from "../components/RideHistory";
import RideStatus from "../components/RideStatus";

const NEARBY_DRIVERS = [
  {
    id: "drv-1",
    name: "Amit",
    vehicle: "Swift Dzire",
    plate: "MP48 AB 1122",
    rating: 4.8,
    etaMinutes: 3,
    distanceKm: 1.4,
    status: "Available",
  },
  {
    id: "drv-2",
    name: "Rohit",
    vehicle: "WagonR",
    plate: "MP48 CD 2211",
    rating: 4.6,
    etaMinutes: 4,
    distanceKm: 2.1,
    status: "Available",
  },
  {
    id: "drv-3",
    name: "Nisha",
    vehicle: "Hyundai Aura",
    plate: "MP48 EF 4312",
    rating: 4.9,
    etaMinutes: 5,
    distanceKm: 3.2,
    status: "On Trip",
  },
  {
    id: "drv-4",
    name: "Vikas",
    vehicle: "Eeco",
    plate: "MP48 GH 7721",
    rating: 4.5,
    etaMinutes: 6,
    distanceKm: 4.8,
    status: "Available",
  },
  {
    id: "drv-5",
    name: "Priya",
    vehicle: "Innova",
    plate: "MP48 JK 9981",
    rating: 4.7,
    etaMinutes: 7,
    distanceKm: 5.6,
    status: "Available",
  },
];

const SAVED_PLACES_STORAGE_KEY = "riderSavedPlaces:v1";
const RIDER_TRUSTED_CONTACT_KEY = "riderTrustedContact:v1";

function readSavedPlaces() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_PLACES_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") {
      return { home: "", work: "" };
    }
    return {
      home: String(parsed.home || "").trim(),
      work: String(parsed.work || "").trim(),
    };
  } catch {
    return { home: "", work: "" };
  }
}

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export default function RiderDashboard() {
  const token = localStorage.getItem("token") || "";
  const riderName = localStorage.getItem("name") || "Rider";

  const [rides, setRides] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [infoNotice, setInfoNotice] = useState("");
  const [savedPlaces, setSavedPlaces] = useState(readSavedPlaces);
  const [homeDraft, setHomeDraft] = useState(savedPlaces.home || "");
  const [workDraft, setWorkDraft] = useState(savedPlaces.work || "");
  const [trustedContact, setTrustedContact] = useState(() => localStorage.getItem(RIDER_TRUSTED_CONTACT_KEY) || "");
  const [bookingPreset, setBookingPreset] = useState(null);
  const [liveToast, setLiveToast] = useState(null);
  const [pulseLiveBadge, setPulseLiveBadge] = useState(false);
  const mapSectionRef = useRef(null);
  const driversSectionRef = useRef(null);
  const bookingSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const toastTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const hasLiveFeedInitializedRef = useRef(false);
  const previousRideCountRef = useRef(0);
  const previousActiveRideIdRef = useRef("");
  const previousActiveStatusRef = useRef("");

  const fetchRides = useCallback(async () => {
    if (!token) {
      setError("Please login to access rider dashboard.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/rides/history", "GET", null, token);
      const nextRides = Array.isArray(response) ? response : [];
      setRides(nextRides);
      const activeRide =
        nextRides.find((item) => item.status !== "COMPLETED" && item.status !== "CANCELLED") || null;
      setCurrentRide(activeRide);
    } catch (requestError) {
      const message = String(requestError?.message || "");
      if (message.includes("403")) {
        setError("Session expired. Please login again.");
        return;
      }
      setError(message || "Failed to load rides.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const stats = useMemo(() => {
    const completedRides = rides.filter((ride) => ride.status === "COMPLETED");
    const totalSpent = completedRides.reduce((sum, ride) => sum + (Number(ride.fare) || 0), 0);
    const activeRides = rides.filter((ride) => ride.status !== "COMPLETED" && ride.status !== "CANCELLED");
    return {
      completed: completedRides.length,
      active: activeRides.length,
      spent: totalSpent,
    };
  }, [rides]);
  const activeRideId = currentRide ? String(currentRide.id || "") : "";
  const activeRideStatus = String(currentRide?.status || "");

  const triggerLiveFeedback = useCallback((message, tone = "info") => {
    if (!message) {
      return;
    }

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }

    setLiveToast({
      id: Date.now(),
      message,
      tone,
    });
    setPulseLiveBadge(false);
    requestAnimationFrame(() => setPulseLiveBadge(true));

    toastTimerRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 2600);
    pulseTimerRef.current = setTimeout(() => {
      setPulseLiveBadge(false);
    }, 780);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const rideCount = rides.length;

    if (!hasLiveFeedInitializedRef.current) {
      hasLiveFeedInitializedRef.current = true;
      previousRideCountRef.current = rideCount;
      previousActiveRideIdRef.current = activeRideId;
      previousActiveStatusRef.current = activeRideStatus;
      return;
    }

    let nextToast = null;

    if (activeRideId && activeRideId !== previousActiveRideIdRef.current) {
      nextToast = { message: "You have a new active ride.", tone: "success" };
    } else if (!activeRideId && previousActiveRideIdRef.current) {
      nextToast = { message: "No active ride right now.", tone: "info" };
    } else if (
      activeRideId &&
      activeRideId === previousActiveRideIdRef.current &&
      activeRideStatus &&
      activeRideStatus !== previousActiveStatusRef.current
    ) {
      nextToast = { message: `Ride status changed to ${activeRideStatus}.`, tone: "info" };
    } else if (rideCount > previousRideCountRef.current) {
      nextToast = { message: "New ride update received.", tone: "success" };
    }

    if (nextToast) {
      triggerLiveFeedback(nextToast.message, nextToast.tone);
    }

    previousRideCountRef.current = rideCount;
    previousActiveRideIdRef.current = activeRideId;
    previousActiveStatusRef.current = activeRideStatus;
  }, [activeRideId, activeRideStatus, rides.length, triggerLiveFeedback]);

  const selectedDriver = useMemo(
    () => NEARBY_DRIVERS.find((driver) => driver.id === selectedDriverId) || null,
    [selectedDriverId]
  );

  const pickupInsight = useMemo(() => {
    const availableDrivers = NEARBY_DRIVERS.filter((driver) => driver.status === "Available").sort(
      (left, right) => left.etaMinutes - right.etaMinutes
    );
    const preferredDriver =
      selectedDriver && selectedDriver.status === "Available" ? selectedDriver : null;
    const suggestedDriver = preferredDriver || availableDrivers[0] || null;

    if (!suggestedDriver) {
      return {
        status: "No drivers nearby",
        etaText: "--",
        distanceText: "--",
        confidence: "Low",
        driver: null,
      };
    }

    const confidence =
      suggestedDriver.etaMinutes <= 4 ? "High" : suggestedDriver.etaMinutes <= 6 ? "Medium" : "Low";

    return {
      status: preferredDriver ? "Preferred driver selected" : "Best nearby driver",
      etaText: `${suggestedDriver.etaMinutes}-${suggestedDriver.etaMinutes + 2} min`,
      distanceText: `${suggestedDriver.distanceKm.toFixed(1)} km away`,
      confidence,
      driver: suggestedDriver,
    };
  }, [selectedDriver]);

  const recentCompletedRoutes = useMemo(
    () =>
      rides
        .filter((ride) => ride.status === "COMPLETED")
        .slice(0, 3)
        .map((ride) => ({
          id: ride.id,
          pickup: ride.pickupLocation || "",
          drop: ride.dropLocation || "",
        }))
        .filter((route) => route.pickup && route.drop),
    [rides]
  );

  const patchRideFeedback = useCallback((rideId, patch) => {
    setRides((previous) =>
      previous.map((ride) => (String(ride.id) === String(rideId) ? { ...ride, ...patch } : ride))
    );
  }, []);

  const scrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyBookingPreset = useCallback(
    (pickup, drop, sourceLabel) => {
      if (!pickup || !drop) {
        return;
      }
      setBookingPreset({
        pickup,
        drop,
        source: sourceLabel,
        key: `${pickup}-${drop}-${Date.now()}`,
      });
      if (currentRide) {
        setInfoNotice("Route is saved for your next booking after the current trip.");
      } else {
        setInfoNotice(`Loaded route from ${sourceLabel}.`);
      }
      scrollToSection(bookingSectionRef);
    },
    [currentRide]
  );

  const savePlaces = () => {
    const nextSavedPlaces = {
      home: homeDraft.trim(),
      work: workDraft.trim(),
    };
    setSavedPlaces(nextSavedPlaces);
    localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextSavedPlaces));
    setInfoNotice("Saved places updated.");
  };

  const saveTrustedContact = () => {
    const nextTrustedContact = trustedContact.trim();
    if (!nextTrustedContact) {
      localStorage.removeItem(RIDER_TRUSTED_CONTACT_KEY);
      setTrustedContact("");
      setInfoNotice("Trusted contact removed.");
      return;
    }
    localStorage.setItem(RIDER_TRUSTED_CONTACT_KEY, nextTrustedContact);
    setTrustedContact(nextTrustedContact);
    setInfoNotice("Trusted contact updated.");
  };

  const shareTripDetails = async () => {
    const summary = currentRide
      ? `Ride update for ${riderName}: ${currentRide.pickupLocation || "-"} to ${
          currentRide.dropLocation || "-"
        }, status ${currentRide.status || "-"}, fare INR ${formatInr(currentRide.fare)}.`
      : `Ride update for ${riderName}: no active trip right now.`;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        setInfoNotice("Trip summary copied. Share it with your trusted contact.");
      } else {
        setInfoNotice("Clipboard is unavailable in this browser.");
      }
    } catch {
      setInfoNotice("Could not copy trip summary. Please share manually.");
    }
  };

  const callEmergency = () => {
    setInfoNotice("Emergency shortcut triggered. Calling 112 from your device.");
    if (typeof window !== "undefined") {
      window.location.href = "tel:112";
    }
  };

  return (
    <section className="dashboard-view space-y-6 fade-up">
      <LiveUpdateToast toast={liveToast} />

      <div className="glass-panel card-rise p-6 sm:p-8" data-reveal>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Rider dashboard</p>
          <span className={`live-badge ${pulseLiveBadge ? "pulse-once" : ""}`}>Live updates</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Hello, {riderName}</h1>
        <p className="mt-2 text-slate-600">Book quickly, monitor progress, and keep track of your trips.</p>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick actions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary !px-3 !py-2 !text-xs" onClick={fetchRides}>
              Refresh rides
            </button>
            <button
              type="button"
              className="btn-secondary !px-3 !py-2 !text-xs"
              onClick={() => scrollToSection(mapSectionRef)}
            >
              Live map
            </button>
            <button
              type="button"
              className="btn-secondary !px-3 !py-2 !text-xs"
              onClick={() => scrollToSection(driversSectionRef)}
            >
              Nearby drivers
            </button>
            <button
              type="button"
              className="btn-secondary !px-3 !py-2 !text-xs"
              onClick={() => scrollToSection(bookingSectionRef)}
            >
              {currentRide ? "Current ride" : "Book ride"}
            </button>
            <button
              type="button"
              className="btn-secondary !px-3 !py-2 !text-xs"
              onClick={() => scrollToSection(historySectionRef)}
            >
              Ride history
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed rides</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              <CountUpNumber value={stats.completed} className="tabular-nums" />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active rides</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              <CountUpNumber value={stats.active} className="tabular-nums" />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total spent</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              INR{" "}
              <CountUpNumber
                value={stats.spent}
                className="tabular-nums"
                formatter={(number) => formatInr(Math.round(number))}
              />
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
      )}
      {infoNotice && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700">{infoNotice}</div>
      )}

      <section className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pickup insight</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{pickupInsight.status}</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              pickupInsight.confidence === "High"
                ? "bg-emerald-100 text-emerald-700"
                : pickupInsight.confidence === "Medium"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
            }`}
          >
            Confidence: {pickupInsight.confidence}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="map-node rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated arrival</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{pickupInsight.etaText}</p>
          </div>
          <div className="map-node rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver distance</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{pickupInsight.distanceText}</p>
          </div>
          <div className="map-node rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested driver</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{pickupInsight.driver?.name || "--"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2" data-reveal>
        <article className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Saved places & quick rebook</h2>
          <p className="mt-2 text-sm text-slate-600">Save frequent routes and load them into booking with one tap.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Home
              <input
                type="text"
                value={homeDraft}
                onChange={(event) => setHomeDraft(event.target.value)}
                placeholder="Add home location"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Work
              <input
                type="text"
                value={workDraft}
                onChange={(event) => setWorkDraft(event.target.value)}
                placeholder="Add work location"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary !px-3 !py-2 !text-xs" onClick={savePlaces}>
              Save places
            </button>
            {savedPlaces.home && savedPlaces.work && (
              <>
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-2 !text-xs"
                  onClick={() => applyBookingPreset(savedPlaces.home, savedPlaces.work, "Home to Work")}
                >
                  Home to Work
                </button>
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-2 !text-xs"
                  onClick={() => applyBookingPreset(savedPlaces.work, savedPlaces.home, "Work to Home")}
                >
                  Work to Home
                </button>
              </>
            )}
          </div>

          {recentCompletedRoutes.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">One-tap rebook</p>
              <div className="mt-2 space-y-2">
                {recentCompletedRoutes.map((route) => (
                  <div key={route.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="font-semibold text-slate-700">
                      {route.pickup} to {route.drop}
                    </p>
                    <button
                      type="button"
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                      onClick={() => applyBookingPreset(route.pickup, route.drop, "Recent ride")}
                    >
                      Rebook
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Safety center</h2>
          <p className="mt-2 text-sm text-slate-600">Keep one trusted contact ready and share live trip summary quickly.</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
            <label className="text-sm font-semibold text-slate-700">
              Trusted contact
              <input
                type="text"
                value={trustedContact}
                onChange={(event) => setTrustedContact(event.target.value)}
                placeholder="Phone or email"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary !px-3 !py-2 !text-xs" onClick={saveTrustedContact}>
                Save trusted contact
              </button>
              <button type="button" className="btn-secondary !px-3 !py-2 !text-xs" onClick={shareTripDetails}>
                Copy trip summary
              </button>
              <button type="button" className="btn-secondary !px-3 !py-2 !text-xs" onClick={callEmergency}>
                Emergency SOS
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Emergency number used: 112. Trip summary includes pickup, drop, status, and fare.
            </p>
          </div>
        </article>
      </section>

      <div ref={mapSectionRef} data-reveal>
        <LiveMapPanel
          title="Live map"
          defaultCenter={{ lat: 21.774, lon: 78.257 }}
          defaultZoom={6}
          defaultLocationLabel="Multai, India"
        />
      </div>

      <section className="glass-panel map-motion-panel p-6 sm:p-8" ref={driversSectionRef} data-reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Nearby drivers</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {NEARBY_DRIVERS.length} drivers online
            </span>
            {selectedDriver && (
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={() => setSelectedDriverId("")}
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NEARBY_DRIVERS.map((driver) => (
            <article key={driver.id} className="map-node rounded-2xl border border-slate-200 bg-white/85 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-slate-900">{driver.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{driver.vehicle}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                    driver.status === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {driver.status}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Plate:</span> {driver.plate}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Rating:</span> {driver.rating.toFixed(1)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">ETA:</span> {driver.etaMinutes} min
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Distance:</span> {driver.distanceKm.toFixed(1)} km
                </p>
              </div>
              <button
                type="button"
                className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  selectedDriverId === driver.id
                    ? "border-cyan-400 bg-cyan-50 text-cyan-800"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
                onClick={() => setSelectedDriverId(driver.id)}
              >
                {selectedDriverId === driver.id ? "Selected" : "Pick this driver"}
              </button>
            </article>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="glass-panel p-6 text-sm text-slate-600" data-reveal>
          Loading dashboard...
        </div>
      ) : (
        <div ref={bookingSectionRef} className="space-y-6" data-reveal>
          <div data-reveal>
            {currentRide ? (
              <RideStatus ride={currentRide} onComplete={fetchRides} />
            ) : (
              <RideBookingForm
                onBook={() => {
                  setSelectedDriverId("");
                  setBookingPreset(null);
                  fetchRides();
                }}
                selectedDriver={selectedDriver}
                quickRoutePreset={bookingPreset}
                onAutoAssign={() => setSelectedDriverId("")}
              />
            )}
          </div>
          <div data-reveal>
            <RideFeedbackPanel rides={rides} userRole="RIDER" title="Rider feedback" onRidePatched={patchRideFeedback} />
          </div>
          <div ref={historySectionRef} data-reveal>
            <RideHistory rides={rides} title="Your recent rides" emptyMessage="No rides yet. Book your first ride." autoRefresh={false} />
          </div>
        </div>
      )}
    </section>
  );
}
