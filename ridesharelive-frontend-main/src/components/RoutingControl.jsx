import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export default function RoutingControl({ pickup, drop, routePath }) {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!map || !pickup || !drop) return;

    let mounted = true;

    (async () => {
      try {
        // dynamic import to avoid SSR/build-time resolution issues
        await import("leaflet-routing-machine");
        await import("leaflet-routing-machine/dist/leaflet-routing-machine.css");

        // remove previous control if exists
        if (routingControlRef.current) {
          map.removeControl(routingControlRef.current);
          routingControlRef.current = null;
        }

        const control = L.Routing.control({
          waypoints: [
            L.latLng(pickup.lat, pickup.lon),
            L.latLng(drop.lat, drop.lon),
          ],
          routeWhileDragging: false,
          lineOptions: {
            styles: [
              { color: "#ffffff", opacity: 0.5, weight: 6, lineCap: "round", lineJoin: "round" },
              { color: "#2563eb", opacity: 0.9, weight: 3.5, lineCap: "round", lineJoin: "round" },
            ],
          },
          show: false,
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          showAlternatives: false,
          altLineOptions: {
            styles: [
              { color: "#ffffff", opacity: 0.3, weight: 5 },
              { color: "#94a3b8", opacity: 0.5, weight: 2, dashArray: "5, 5" },
            ],
          },
        }).addTo(map);

        if (mounted) routingControlRef.current = control;

        control.on("routesfound", (e) => {
          const routes = e.routes;
          if (routes.length > 0) {
            console.log("Route found:", routes[0]);
          }
        });
      } catch (error) {
        console.error("Routing control error:", error);
      }
    })();

    return () => {
      mounted = false;
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current);
        } catch (_) {}
        routingControlRef.current = null;
      }
    };
  }, [map, pickup, drop]);

  return null;
}
