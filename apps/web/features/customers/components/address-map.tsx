"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@pixa/ui/base-ui/input";
import { Button } from "@pixa/ui/base-ui/button";
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
  if (!API_KEY) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Map unavailable — add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable address
        verification. Fields below work without it.
      </div>
    );
  }
  return (
    <APIProvider apiKey={API_KEY} libraries={["places", "geocoding"]}>
      <MapInner value={value} onChange={onChange} />
    </APIProvider>
  );
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
  const [locating, setLocating] = useState(false);
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

  const locate = () => {
    setLocating(true);
    const q = composeAddress(valueRef.current);
    if (!q || !geocoding) {
      setLocating(false);
      return;
    }
    new geocoding.Geocoder().geocode({ address: q }, (results, status) => {
      setLocating(false);
      const loc = status === "OK" && results?.[0]?.geometry?.location;
      if (loc) applyPosition(loc.lat(), loc.lng());
    });
  };

  const position =
    marker ??
    (value.latitude != null && value.longitude != null
      ? { lat: value.latitude, lng: value.longitude }
      : center);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input ref={searchRef} placeholder="Search place…" className="h-11" />
        <Button type="button" variant="outline" onClick={locate} disabled={locating}>
          {locating ? "…" : "Locate"}
        </Button>
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
