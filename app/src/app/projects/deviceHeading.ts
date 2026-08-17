type IOSDeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type CompassCapableDeviceOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

/** Compass heading ("in welche Richtung fotografiert wurde") isn't in the
 * Geolocation API - it needs the device's orientation/magnetometer sensor,
 * which browsers only expose via DeviceOrientationEvent, and iOS 13+ gates
 * that behind an explicit permission prompt that must be triggered by a
 * user gesture (calling this from the "Kamera" button's click handler
 * satisfies that). Resolves null if the sensor/permission/API isn't
 * available or no reading arrives in time - the watermark dialog simply
 * hides the compass option for that photo rather than showing bad data. */
export async function requestDeviceHeading(): Promise<number | null> {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    return null;
  }

  const OrientationEventCtor =
    window.DeviceOrientationEvent as IOSDeviceOrientationEventConstructor;

  if (typeof OrientationEventCtor.requestPermission === "function") {
    try {
      const result = await OrientationEventCtor.requestPermission();
      if (result !== "granted") return null;
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    let settled = false;

    function finish(heading: number | null) {
      if (settled) return;
      settled = true;
      window.removeEventListener("deviceorientationabsolute", handleAbsolute);
      window.removeEventListener("deviceorientation", handleFallback);
      resolve(heading);
    }

    function readHeading(event: DeviceOrientationEvent): number | null {
      const iosHeading = (event as CompassCapableDeviceOrientationEvent)
        .webkitCompassHeading;
      if (typeof iosHeading === "number" && Number.isFinite(iosHeading)) {
        return iosHeading;
      }
      if (event.absolute && typeof event.alpha === "number") {
        return (360 - event.alpha) % 360;
      }
      return null;
    }

    function handleAbsolute(event: Event) {
      finish(readHeading(event as DeviceOrientationEvent));
    }

    function handleFallback(event: DeviceOrientationEvent) {
      const heading = readHeading(event);
      if (heading !== null) finish(heading);
    }

    window.addEventListener("deviceorientationabsolute", handleAbsolute);
    window.addEventListener("deviceorientation", handleFallback);
    setTimeout(() => finish(null), 2000);
  });
}
