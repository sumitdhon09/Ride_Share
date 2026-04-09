import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import useLiveLocation from "../hooks/useLiveLocation";

const NotificationCenter = lazy(() => import("./NotificationCenter"));

const NAV_ITEMS = [
  { id: "header-home", label: "Home" },
  { id: "header-rides", label: "Rides" },
  { id: "header-pricing", label: "Pricing" },
];

function HeaderRipple({ rippleKey }) {
  return (
    <AnimatePresence>
      {rippleKey ? (
        <motion.span
          key={rippleKey}
          className="header-ripple"
          initial={{ opacity: 0.24, scale: 0 }}
          animate={{ opacity: 0, scale: 1.65 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
    </AnimatePresence>
  );
}

export default function Header({
  currentPage,
  isDarkTheme,
  language,
  languageOptions,
  onBookRide,
  onBrandClick,
  onChangeLanguage,
  onNavigateSection,
  onThemeToggle,
  renderMenuContent,
  session,
  settingsOpen = false,
}) {
  const containerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("header-home");
  const [locationRippleKey, setLocationRippleKey] = useState(0);
  const [ctaRippleKey, setCtaRippleKey] = useState(0);
  const { isLoading, label, requestLocation, status, tooltip } = useLiveLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) {
        return;
      }
      setMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (settingsOpen) {
      setMenuOpen(false);
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (currentPage !== "home" || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observed = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (observed.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visibleEntry?.target?.id) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      { threshold: [0.2, 0.45, 0.7], rootMargin: "-20% 0px -45% 0px" }
    );

    observed.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [currentPage]);

  const shellClassName = useMemo(() => {
    const base =
      "smart-header-shell relative mx-auto flex w-full max-w-7xl items-center gap-4 rounded-[1.65rem] border px-4 py-3 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.38)] transition-all duration-200 sm:px-6 lg:px-8";
    const theme = isDarkTheme
      ? " border-white/10 bg-[linear-gradient(135deg,rgba(10,14,25,0.7),rgba(12,18,31,0.34))] text-slate-100"
      : " border-white/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,255,255,0.4))] text-slate-900";
    const scrollFx = scrolled
      ? " py-2.5 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.52)] backdrop-blur-[26px]"
      : " py-3.5 backdrop-blur-[22px]";
    return `${base}${theme}${scrollFx}`;
  }, [isDarkTheme, scrolled]);

  const locationButtonClassName = isDarkTheme
    ? "smart-pill group relative hidden overflow-hidden rounded-full border border-white/10 bg-white/5 text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/30 hover:bg-white/10 xl:inline-flex"
    : "smart-pill group relative hidden overflow-hidden rounded-full border border-slate-200/80 bg-white/70 text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white xl:inline-flex";

  const navTextClass = isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-950";
  const activeNavTextClass = isDarkTheme ? "text-white" : "text-slate-950";

  return (
    <header className={`sticky top-0 z-40 ${isDarkTheme ? "bg-black/30" : "bg-white/30"}`} data-reveal="instant">
      <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:px-10">
        <div ref={containerRef} className={shellClassName}>
          <motion.button
            type="button"
            onClick={onBrandClick}
            className={`brand-mark group flex min-w-0 items-center gap-3 rounded-2xl border-0 bg-transparent p-0 text-left ${
              isDarkTheme ? "brand-mark--dark" : ""
            }`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.985 }}
          >
            <span className="brand-mark__icon transition-all duration-200 group-hover:shadow-[0_18px_36px_-18px_rgba(59,130,246,0.45)]">
              <span className="brand-mark__icon-dot brand-mark__icon-dot--start" />
              <span className="brand-mark__icon-path" />
              <span className="brand-mark__icon-dot brand-mark__icon-dot--end" />
            </span>
            <span className="min-w-0">
              <span className="brand-mark__title">RIDESHARE</span>
              <span className={`mt-1 block text-[0.72rem] tracking-[0.18em] ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                click. ride. arrive.
              </span>
            </span>
          </motion.button>

          <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const isActive = currentPage === "home" && activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`group relative bg-transparent text-sm font-semibold transition-all duration-200 ${isActive ? activeNavTextClass : navTextClass}`}
                  onClick={() => onNavigateSection(item.id)}
                >
                  <span>{item.label}</span>
                  <span
                    className={`absolute -bottom-2 left-0 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all duration-200 ${
                      isActive ? "w-full opacity-100" : "w-0 opacity-80 group-hover:w-full"
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <motion.button
              type="button"
              layout
              onClick={() => {
                setLocationRippleKey(Date.now());
                requestLocation();
              }}
              title={tooltip}
              className={locationButtonClassName}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
            >
              <HeaderRipple rippleKey={locationRippleKey} />
              <span className={`mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full ${isDarkTheme ? "bg-sky-500/10 text-sky-300" : "bg-sky-100 text-sky-600"}`}>
                <motion.span
                  animate={isLoading ? { scale: [1, 1.12, 1], y: [0, -1.5, 0] } : { scale: 1, y: 0 }}
                  transition={isLoading ? { repeat: Infinity, duration: 0.9 } : { duration: 0.2 }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.75a6.25 6.25 0 0 0-6.25 6.25c0 4.32 5.05 10.36 5.27 10.61a1.28 1.28 0 0 0 1.96 0c.22-.25 5.27-6.29 5.27-10.61A6.25 6.25 0 0 0 12 2.75Zm0 8.75A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                  </svg>
                </motion.span>
              </span>
              <div className="relative flex min-w-[8.75rem] items-center">
                <AnimatePresence mode="wait" initial={false}>
                  {isLoading ? (
                    <motion.span
                      key="detecting"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="inline-flex items-center gap-2 text-sm font-semibold"
                    >
                      <span className="header-shimmer h-3.5 w-20 rounded-full" />
                      <span className="text-[0.72rem] uppercase tracking-[0.18em] opacity-80">Detecting...</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key={label}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="text-sm font-semibold"
                    >
                      {status === "success" ? `📍 ${label}` : label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {status === "denied" ? (
                  <span className={`pointer-events-none absolute left-0 top-full mt-2 max-w-[14rem] rounded-xl px-3 py-2 text-xs leading-5 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 ${isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-white text-slate-600"}`}>
                    Allow location access to personalize ride context.
                  </span>
                ) : null}
              </div>
            </motion.button>

            {session?.token ? (
              <div className="hidden xl:block">
                <Suspense fallback={null}>
                  <NotificationCenter token={session.token} />
                </Suspense>
              </div>
            ) : null}

            <motion.button
              type="button"
              className="smart-cta relative hidden overflow-hidden rounded-full px-4 py-3 text-[0.78rem] font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_18px_42px_-20px_rgba(59,130,246,0.85)] sm:inline-flex"
              onClick={() => {
                setCtaRippleKey(Date.now());
                onBookRide();
              }}
              whileHover={{ y: -2, scale: 1.05 }}
              whileTap={{ scale: 0.985 }}
            >
              <HeaderRipple rippleKey={ctaRippleKey} />
              <span className="relative z-[1]">Book Ride</span>
            </motion.button>

            <div className={`inline-flex items-center gap-2 rounded-full border p-1 ${isDarkTheme ? "border-white/10 bg-white/5" : "border-white/60 bg-white/70"}`}>
              <motion.button
                type="button"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-white text-slate-800"}`}
                onClick={onThemeToggle}
                aria-label={isDarkTheme ? "Turn off dark theme" : "Turn on dark theme"}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                animate={{ rotate: isDarkTheme ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
              >
                {isDarkTheme ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4.2" />
                    <path d="M12 2.5v2.2M12 19.3v2.2M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2.5 12h2.2M19.3 12h2.2M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M20.2 14.1A8.7 8.7 0 0 1 9.9 3.8a.75.75 0 0 0-.95-.95A9.95 9.95 0 1 0 21.15 15a.75.75 0 0 0-.95-.9Z" />
                  </svg>
                )}
              </motion.button>

              <div className="relative">
                <motion.button
                  type="button"
                  className={`inline-flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-full transition-all duration-200 ${isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-white text-slate-900"}`}
                  onClick={() => setMenuOpen((previous) => !previous)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span className="sr-only">Menu</span>
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                  <span className="block h-0.5 w-4 rounded-full bg-current" />
                </motion.button>

                <AnimatePresence>
                  {menuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className={`header-menu-panel ${isDarkTheme ? "!border-white/10 !bg-slate-950/92" : ""}`}
                    >
                      {renderMenuContent({
                        closeMenu: () => setMenuOpen(false),
                        language,
                        languageOptions,
                        onChangeLanguage,
                      })}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <span className={`pointer-events-none absolute inset-0 rounded-[1.65rem] ${isDarkTheme ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"}`} />
        </div>

        <motion.div
          aria-hidden="true"
          className="header-gradient-line mt-3 h-px w-full rounded-full"
          animate={{ opacity: scrolled ? 0.95 : 0.7, scaleX: scrolled ? 1 : 0.96 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </header>
  );
}
