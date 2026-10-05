"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@pixa/ui/base-ui/input";
import { Icons } from "@pixa/ui/icons";
import { composeAddress, parseComponents, type MapAddress } from "../api/address-geo";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 23.0225, lng: 72.5714 }; // Ahmedabad fallback

/**
 * Bidirectional address map: typing the address geocodes → pin moves;
 * Places search or pin-drag reverse-geocodes → address fields fill.
 * Renders a graceful fallback when no API key is configured.
 */
export default function AddressMap({
  value,
  onChange,
}: {
  value: MapAddress;
  onChange: (patch: Partial<MapAddress>) => void;
}) {
  const authError = useMapsAuthError();
  const [loadError, setLoadError] = useState(false);
  if (!API_KEY) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Map unavailable — add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable address
        verification. Fields below work without it.
      </div>
    );
  }
  if (authError || loadError) {
    return <MapsErrorPanel reason={authError ?? "load-failed"} />;
  }
  return (
    <APIProvider
      apiKey={API_KEY}
      libraries={["places", "geocoding"]}
      onError={() => setLoadError(true)}
    >
      <MapInner value={value} onChange={onChange} />
    </APIProvider>
  );
}

/**
 * Google reports key/authorization failures through window.gm_authFailure
 * (not through the loader error). Surfacing it turns the generic
 * "can't load Google Maps correctly" banner into an actionable fix list.
 */
function MapsErrorPanel({ reason }: { reason: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-destructive/40 p-4 text-sm">
      <p className="font-medium">
        Google Maps didn&apos;t load ({reason}). Fix in Google Cloud Console:
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Enable billing on the project (Maps requires it, even within free quota).</li>
        <li>Enable APIs: Maps JavaScript API, Places API, Geocoding API.</li>
        <li>
          Key restrictions → HTTP referrers must include this origin (e.g.{" "}
          <code>http://localhost:3000/*</code> for local dev).
        </li>
        <li>Wait a minute and reload — key changes take time to propagate.</li>
      </ol>
    </div>
  );
}
function useMapsAuthError(): string | null {
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => setAuthError("auth-failure");
    return () => {
      if (w.gm_authFailure) w.gm_authFailure = prev;
    };
  }, []);
  return authError;
}

function MapInner({
  value,
  onChange,
}: {
  value: MapAddress;
  onChange: (patch: Partial<MapAddress>) => void;
}) {
  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");
  const searchRef = useRef<HTMLInputElement>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const applyPosition = useCallback(
    (lat: number, lng: number) => {
      setCenter({ lat, lng });
      setMarker({ lat, lng });
      onChange({ latitude: lat, longitude: lng });
    },
    [onChange],
  );

  // Places Autocomplete search → fill address + move pin.
  useEffect(() => {
    if (!places || !searchRef.current) return;
    const autocomplete = new places.Autocomplete(searchRef.current, {
      fields: ["address_components", "geometry", "formatted_address"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      if (place.address_components) {
        onChange(parseComponents(place.address_components as never));
      }
      if (loc) applyPosition(loc.lat(), loc.lng());
    });
    return () => listener.remove();
  }, [places, onChange, applyPosition]);

  // Address fields → geocode → move pin (debounced).
  useEffect(() => {
    if (!geocoding) return;
    const query = composeAddress(valueRef.current);
    if (query.length < 10) return;
    const t = window.setTimeout(() => {
      const geocoder = new geocoding.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        const loc = status === "OK" && results?.[0]?.geometry?.location;
        if (loc) {
          setCenter({ lat: loc.lat(), lng: loc.lng() });
          setMarker({ lat: loc.lat(), lng: loc.lng() });
        }
      });
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocoding, value.line1, value.locality, value.city, value.postal_code]);

  // Pin drag → reverse-geocode → fill address.
  const onMarkerDragEnd = useCallback(
    (e: { latLng?: { lat: () => number; lng: () => number } | null }) => {
      const ll = e.latLng;
      if (!ll || !geocoding) return;
      const lat = ll.lat();
      const lng = ll.lng();
      setCenter({ lat, lng });
      setMarker({ lat, lng });
      const geocoder = new geocoding.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]?.address_components) {
          onChange({
            ...parseComponents(results[0].address_components as never),
            latitude: lat,
            longitude: lng,
          });
        } else {
          onChange({ latitude: lat, longitude: lng });
        }
      });
    },
    [geocoding, onChange],
  );

  const position =
    marker ??
    (value.latitude != null && value.longitude != null
      ? { lat: value.latitude, lng: value.longitude }
      : center);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input ref={searchRef} placeholder="Search place…" className="h-11 pr-10" />
        <Icons.search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <div className="h-56 w-full overflow-hidden rounded-xl border">
        <Map
          center={center}
          zoom={15}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="pixa-customer-map"
        >
          <AdvancedMarker position={position} draggable onDragEnd={onMarkerDragEnd} />
        </Map>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Drag the pin or search above — address fields fill automatically.
      </p>
    </div>
  );
}
