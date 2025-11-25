export function getLocation(
  onSuccess: (pos: GeolocationPosition, source: string) => void,
  onError: (msg: string) => void
) {
  if (!navigator.geolocation) {
    onError("Geolocation not supported on this device.");
    return;
  }

  // Try fast lookup first
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const acc = pos.coords.accuracy;

      let source = "Unknown";

      if (acc <= 50) source = "GPS";
      else if (acc <= 1500) source = "Network (WiFi/Cell)";
      else source = "IP-based (very inaccurate)";

      onSuccess(pos, source);
    },
    () => {
      // Fallback to high accuracy GPS
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const acc = pos.coords.accuracy;

          let source = "Unknown";
          if (acc <= 50) source = "GPS";
          else if (acc <= 1500) source = "Network (WiFi/Cell)";
          else source = "IP-based";

          onSuccess(pos, source);
        },
        () => onError("GPS unavailable or permission denied."),
        { enableHighAccuracy: true, timeout: 20000 }
      );
    },
    { enableHighAccuracy: false, timeout: 3000, maximumAge: 5000 }
  );
}
