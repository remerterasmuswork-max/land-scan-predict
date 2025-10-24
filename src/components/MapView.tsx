import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface MapViewProps {
  onParcelSelect: (parcelId: string) => void;
}

const MapView = ({ onParcelSelect }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);

  useEffect(() => {
    // Check for saved token
    const savedToken = localStorage.getItem("mapbox_token");
    if (savedToken) {
      setMapboxToken(savedToken);
      setTokenSaved(true);
      initializeMap(savedToken);
    }
  }, []);

  const initializeMap = (token: string) => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-78.6382, 35.7796], // Charlotte, NC
        zoom: 9,
        pitch: 45,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        "top-right"
      );

      map.current.on("load", () => {
        // Add sample parcel layer (will be replaced with real data)
        map.current?.addLayer({
          id: "parcels-layer",
          type: "fill",
          source: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          },
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "investibility_score"],
              0,
              "#ef4444",
              50,
              "#f59e0b",
              100,
              "#10b981",
            ],
            "fill-opacity": 0.6,
          },
        });

        map.current?.on("click", "parcels-layer", (e) => {
          if (e.features && e.features[0]) {
            const parcelId = e.features[0].properties?.id;
            if (parcelId) {
              onParcelSelect(parcelId);
            }
          }
        });

        map.current?.on("mouseenter", "parcels-layer", () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = "pointer";
          }
        });

        map.current?.on("mouseleave", "parcels-layer", () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = "";
          }
        });
      });

      toast.success("Map initialized successfully");
    } catch (error) {
      console.error("Map initialization error:", error);
      toast.error("Failed to initialize map");
    }
  };

  const handleTokenSubmit = () => {
    if (mapboxToken.trim()) {
      localStorage.setItem("mapbox_token", mapboxToken);
      setTokenSaved(true);
      initializeMap(mapboxToken);
      toast.success("Mapbox token saved");
    }
  };

  return (
    <div className="relative h-full w-full">
      {!tokenSaved ? (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm">
          <div className="panel-glass p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Mapbox Configuration</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your Mapbox public token to enable the map. Get one at{" "}
              <a
                href="https://mapbox.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                mapbox.com
              </a>
            </p>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="pk.eyJ1..."
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTokenSubmit()}
              />
              <button
                onClick={handleTokenSubmit}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Save Token & Initialize Map
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default MapView;
