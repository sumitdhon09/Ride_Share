import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import heroImage from "../assets/1.png";
import safetyImage from "../assets/2.png";
import { apiRequest } from "../api";
import { calculateRideFare, RIDE_OPTIONS } from "../utils/farePricing";
import LiveMapPanel from "./LiveMapPanel";

function renderAnimatedWords(text, extraClassName = "") {
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map((word, index) => (
      <span
        key={`${word}-${index}`}
        data-hero-word=""
        className={`inline-block pr-[0.22em] ${extraClassName}`.trim()}
      >
        {word}
      </span>
    ));
}

function normalizeVehicle(vehicle) {
  return vehicle === "mini" ? "hatchback" : vehicle;
}

function buildFareSnapshot(distanceKm, vehicle) {
  const normalizedDistance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 1;
  const normalizedVehicle = normalizeVehicle(vehicle);
  const estimatedFare = calculateRideFare(normalizedDistance, normalizedVehicle, false);

  return {
    fareLow: estimatedFare,
    fareHigh: estimatedFare,
  };
}

function buildFallbackEstimate(distanceKm, vehicle) {
  const parsedDistance = Number(distanceKm);
  const normalizedDistance = Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : 1;
  const normalizedVehicle = normalizeVehicle(vehicle);
  const vehicleOption = RIDE_OPTIONS.find(
    (item) => item.id === normalizedVehicle || item.type === normalizedVehicle
  );
  const baseEta = vehicleOption?.eta ?? 5;
  const etaMinutes = Math.max(baseEta + Math.round(normalizedDistance * 0.9), baseEta + 2);
  const fareSnapshot = buildFareSnapshot(normalizedDistance, vehicle);

  return {
    distance: normalizedDistance.toFixed(1),
    etaText: `${etaMinutes}-${etaMinutes + 4} min`,
    ...fareSnapshot,
  };
}

function formatFareRange(fareLow, fareHigh) {
  if (!Number.isFinite(fareLow) || !Number.isFinite(fareHigh)) {
    return "--";
  }

  if (fareLow === fareHigh) {
    return `Rs ${fareLow}`;
  }

  return `Rs ${fareLow}-${fareHigh}`;
}

function buildEmptyEstimate() {
  return {
    distance: "--",
    etaText: "--",
    fareLow: NaN,
    fareHigh: NaN,
  };
}

export default function PremiumLanding({ onOpenAuth, copy, theme }) {
  const landingRef = useRef(null);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [estimateLoading, setEstimateLoading] = useState(false);
  const hasEstimateInput =
    pickup.trim() &&
    drop.trim() &&
    vehicle &&
    Number.isFinite(Number(distanceKm)) &&
    Number(distanceKm) > 0;
  const fallbackEstimate = useMemo(
    () => (hasEstimateInput ? buildFallbackEstimate(distanceKm, vehicle) : buildEmptyEstimate()),
    [distanceKm, hasEstimateInput, vehicle]
  );
  const [estimatedTrip, setEstimatedTrip] = useState(() => buildEmptyEstimate());

  useEffect(() => {
    setEstimatedTrip(fallbackEstimate);
  }, [fallbackEstimate]);

  useEffect(() => {
    let cancelled = false;
    const parsedDistance = Number(distanceKm);
    if (!hasEstimateInput || !Number.isFinite(parsedDistance) || parsedDistance <= 0) {
      setEstimateLoading(false);
      setEstimatedTrip(buildEmptyEstimate());
      return undefined;
    }

    const timer = setTimeout(async () => {
      setEstimateLoading(true);
      try {
        const estimate = await apiRequest(
          `/rides/estimate?distanceKm=${encodeURIComponent(parsedDistance.toFixed(2))}&rideType=${encodeURIComponent(vehicle)}`
        );
        const etaMin = Number(estimate?.etaMinMinutes);
        const etaMax = Number(estimate?.etaMaxMinutes);
        const apiDistance = Number(estimate?.distanceKm);

        if (!cancelled && Number.isFinite(etaMin) && Number.isFinite(etaMax)) {
          const resolvedDistance = Number.isFinite(apiDistance) ? apiDistance : parsedDistance;
          const fareSnapshot = buildFareSnapshot(resolvedDistance, vehicle);
          setEstimatedTrip({
            distance: resolvedDistance.toFixed(1),
            etaText: `${etaMin}-${etaMax} min`,
            ...fareSnapshot,
          });
        }
      } catch {
        if (!cancelled) {
          setEstimatedTrip(fallbackEstimate);
        }
      } finally {
        if (!cancelled) {
          setEstimateLoading(false);
        }
      }
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [distanceKm, fallbackEstimate, hasEstimateInput, vehicle]);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) {
      return undefined;
    }

    const reduceMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotionPreference) {
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll("[data-hero-word]"),
        { opacity: 0, yPercent: 105, rotateX: -70 },
        {
          opacity: 1,
          yPercent: 0,
          rotateX: 0,
          duration: 0.9,
          stagger: 0.045,
          ease: "power3.out",
        }
      );

      gsap.fromTo(
        root.querySelectorAll("[data-float-card]"),
        { opacity: 0, y: 22, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.08,
          delay: 0.18,
          ease: "power2.out",
        }
      );
    }, root);

    return () => ctx.revert();
  }, []);

  const stats = Array.isArray(copy.highlights) ? copy.highlights.slice(0, 3) : [];
  const steps = Array.isArray(copy.steps) ? copy.steps.slice(0, 3) : [];
  const roles = [
    {
      key: "RIDER",
      title: copy.riderModeTitle || "Passenger mode",
      body:
        copy.riderModeBody ||
        "Book quickly, watch real-time status, and review complete trip history.",
      eyebrow: "Passenger",
    },
    {
      key: "DRIVER",
      title: copy.driverModeTitle || "Driver mode",
      body:
        copy.driverModeBody ||
        "Accept demand, update ride milestones, and monitor personal earnings.",
      eyebrow: "Captain",
    },
    {
      key: "ADMIN",
      title: copy.adminModeTitle || "Admin mode",
      body:
        copy.adminModeBody ||
        "Oversee riders, drivers, live operations, and platform health from one command center.",
      eyebrow: "Control",
    },
  ];
  const routeLabel = pickup.trim() && drop.trim() ? `${pickup.trim()} to ${drop.trim()}` : "Route preview";
  const shellClassName = theme === "peach-glow" ? "landing-shell-light" : undefined;

  return (
    <div className={shellClassName}>
      <section ref={landingRef} className="landing-home space-y-8 lg:space-y-10">
        <section className="landing-card landing-hero-shell card-rise overflow-hidden" data-reveal data-cursor="highlight">
          <div className="landing-hero-grid grid lg:grid-cols-[1.08fr,0.92fr]">
            <div className="p-6 sm:p-8 lg:p-12" data-scroll data-scroll-speed="-0.25">
              <p className="landing-eyebrow">{copy.badge || "Real-time mobility"}</p>
              <h1 className="landing-hero-title mt-4 max-w-2xl text-4xl font-bold leading-[0.95] sm:text-5xl lg:text-6xl">
                <span className="block overflow-hidden">{renderAnimatedWords(copy.heroTitleA)}</span>
                <span className="landing-hero-title__sub mt-3 block overflow-hidden">
                  {renderAnimatedWords(copy.heroTitleB)}
                </span>
              </h1>
              <p className="landing-body mt-5 max-w-xl text-base leading-7 sm:text-lg">{copy.heroBody}</p>

              <div className="mt-8 flex flex-wrap gap-3" data-no-cursor-magnetic>
                <button
                  type="button"
                  className="btn-primary landing-cta-button landing-cta-button--primary"
                  onClick={() => onOpenAuth?.("signup", "RIDER")}
                >
                  {copy.heroBookRideCta || "Book a Ride"}
                </button>
                <button
                  type="button"
                  className="btn-secondary landing-cta-button"
                  onClick={() => onOpenAuth?.("signup", "DRIVER")}
                >
                  {copy.heroDriveEarnCta || "Drive & Earn"}
                </button>
                <button type="button" className="btn-tertiary landing-cta-button" onClick={() => onOpenAuth?.("login")}>
                  {copy.heroLoginCta || "Login"}
                </button>
              </div>

              <div className="landing-stats mt-10 grid gap-3 sm:grid-cols-3">
                {stats.map((item, index) => (
                  <article
                    key={item.label}
                    className="landing-stat-card landing-stat-card--animated"
                    data-float-card
                    data-magnetic
                    data-cursor="highlight"
                    data-magnetic-strength="6"
                    data-magnetic-range="180"
                    style={{ animationDelay: `${index * 0.18}s` }}
                  >
                    <p className="text-2xl font-bold text-slate-50">{item.value}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.label}</p>
                  </article>
                ))}
              </div>
            </div>

            <div
              className="landing-card-subtle border-t p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-12"
              data-scroll
              data-scroll-speed="0.35"
            >
              <div
                className={`landing-estimator landing-estimator--animated rounded-[1.75rem] p-5 ${
                  estimateLoading ? "loading-shimmer" : ""
                }`}
                data-float-card
                data-magnetic
                data-cursor="highlight"
                data-magnetic-strength="4"
                data-magnetic-range="220"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="landing-eyebrow">{copy.quickEstimatorEyebrow || "Ride estimator"}</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-50">
                      {copy.quickEstimatorTitle || "Quick fare and ETA estimate"}
                    </h2>
                  </div>
                  {estimateLoading ? <span className="landing-sync-tag">Syncing</span> : null}
                </div>
                <p className="landing-body mt-3 text-sm leading-6">
                  {copy.quickEstimatorBody || "Enter your trip details and get an instant, no-signup estimate."}
                </p>

                <div className="mt-6 grid gap-3">
                  <input
                    type="text"
                    value={pickup}
                    onChange={(event) => setPickup(event.target.value)}
                    placeholder={copy.quickEstimatorPickupPlaceholder || "e.g. Kharadi, Pune"}
                    className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                  />
                  <input
                    type="text"
                    value={drop}
                    onChange={(event) => setDrop(event.target.value)}
                    placeholder={copy.quickEstimatorDropPlaceholder || "e.g. Viman Nagar, Pune"}
                    className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,0.95fr]">
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={distanceKm}
                    onChange={(event) => setDistanceKm(event.target.value)}
                    placeholder={copy.quickEstimatorDistancePlaceholder || "e.g. 8"}
                    className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                  />
                  <select
                    value={vehicle}
                    onChange={(event) => setVehicle(event.target.value)}
                    className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                  >
                    <option value="" disabled>{copy.quickEstimatorVehiclePlaceholder || "Select vehicle"}</option>
                    <option value="bike">{copy.quickEstimatorBike || "Bike"}</option>
                    <option value="mini">{copy.quickEstimatorMini || "Mini"}</option>
                    <option value="sedan">{copy.quickEstimatorSedan || "Sedan"}</option>
                  </select>
                </div>

                <div
                  className={`landing-estimator__summary landing-estimator__summary--animated mt-6 rounded-[1.5rem] px-5 py-5 text-white ${
                    estimateLoading ? "loading-shimmer" : ""
                  }`}
                  data-magnetic
                  data-cursor="highlight"
                  data-magnetic-strength="2"
                  data-magnetic-range="190"
                >
                  <p className="text-sm text-slate-300">
                    {estimatedTrip.distance === "--" ? routeLabel : `${routeLabel} - ${estimatedTrip.distance} km`}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        {copy.quickEstimatorEtaLabel || "Estimated arrival"}
                      </p>
                      <p className="mt-2 text-2xl font-bold">{estimatedTrip.etaText}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        {copy.quickEstimatorFareLabel || "Estimated fare"}
                      </p>
                      <p className="mt-2 text-2xl font-bold">{formatFareRange(estimatedTrip.fareLow, estimatedTrip.fareHigh)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]" data-reveal>
          <div
            className="landing-card landing-section-card p-6 sm:p-8"
            data-magnetic
            data-cursor="highlight"
            data-magnetic-strength="0"
            data-magnetic-range="220"
          >
            <p className="landing-eyebrow">How it works</p>
            <div className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <article
                  key={step.title}
                  className="signal-step landing-step-card"
                  data-magnetic
                  data-cursor="highlight"
                  data-magnetic-strength="5"
                  data-magnetic-range="158"
                >
                  <div className="signal-step__index">0{index + 1}</div>
                  <div>
                    <h3 className="text-base font-bold text-slate-50">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div
            className="landing-card landing-media-card overflow-hidden"
            data-magnetic
            data-cursor="highlight"
            data-magnetic-strength="0"
            data-magnetic-range="230"
          >
            <img
              src={heroImage}
              alt="RideShare booking preview"
              className="landing-media-card__image h-64 w-full object-cover sm:h-80"
            />
            <div className="grid gap-4 border-t border-slate-800/70 p-6 sm:grid-cols-2 sm:p-8">
              <article
                className="landing-editorial-card landing-editorial-card--animated"
                data-magnetic
                data-cursor="highlight"
                data-magnetic-strength="4"
                data-magnetic-range="150"
              >
                <p className="landing-eyebrow">{copy.appDemoRideTitle || "Booking and match"}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {copy.appDemoRideBody || "Pick route, confirm, and get matched with a nearby driver."}
                </p>
              </article>
              <article
                className="landing-editorial-card landing-editorial-card--animated"
                data-magnetic
                data-cursor="highlight"
                data-magnetic-strength="4"
                data-magnetic-range="150"
              >
                <p className="landing-eyebrow">{copy.appDemoSafetyTitle || "Live ride confidence"}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {copy.appDemoSafetyBody || "Track the route and key ride status updates in real time."}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-role-grid grid gap-6 lg:grid-cols-3" data-reveal>
          {roles.map((role) => (
            <article
              key={role.key}
              className={`landing-card landing-role-card landing-role-card--${role.key.toLowerCase()} landing-role-card--interactive p-6 sm:p-8`}
              data-cursor="highlight"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="landing-eyebrow">{role.eyebrow}</p>
                <span className="landing-role-chip">{role.key}</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-50">{role.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">{role.body}</p>
              <div className="mt-6 flex flex-wrap gap-3" data-no-cursor-magnetic>
                <button
                  type="button"
                  className="btn-primary landing-cta-button landing-cta-button--primary"
                  onClick={() => onOpenAuth?.("signup", role.key)}
                >
                  Create account
                </button>
                <button
                  type="button"
                  className="btn-secondary landing-cta-button"
                  onClick={() => onOpenAuth?.("login", role.key)}
                >
                  Login
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="landing-map-grid grid gap-6 lg:grid-cols-[1.08fr,0.92fr]" data-reveal>
          <LiveMapPanel
            title={copy.mapTitle || "Live map"}
            defaultCenter={{ lat: 21.774, lon: 78.257 }}
            defaultZoom={6}
            defaultLocationLabel="Multai, India"
            className="landing-map-panel"
            labels={{
              searchPlaceholder: copy.mapSearchPlaceholder,
              useMyLocation: copy.mapUseMyLocation,
              recenter: copy.mapRecenter,
              locateFailed: copy.mapLocateFailed,
              searchFailed: copy.mapSearchFailed,
              indiaOnly: copy.mapIndiaOnly,
              yourLocation: copy.mapYourLocation,
            }}
          />
          <div
            className="landing-card landing-media-card overflow-hidden"
            data-magnetic
            data-cursor="highlight"
            data-magnetic-strength="0"
            data-magnetic-range="230"
          >
            <img
              src={safetyImage}
              alt="RideShare live tracking preview"
              className="landing-media-card__image h-64 w-full object-cover"
            />
            <div className="p-6 sm:p-8">
              <p className="landing-eyebrow">{copy.rolesTitle || "Built for both roles"}</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-50">{copy.safetyTitle || "Safety by default"}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                {copy.safetyBody ||
                  "Driver verification, ride history trails, and always-visible ride state keep both sides informed."}
              </p>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
