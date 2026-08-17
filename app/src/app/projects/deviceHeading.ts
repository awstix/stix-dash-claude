type IOSDeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type CompassCapableDeviceOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

function getOrientationEventCtor(): IOSDeviceOrientationEventConstructor | null {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    return null;
  }
  return window.DeviceOrientationEvent as IOSDeviceOrientationEventConstructor;
}

export type HeadingPermissionResult = "granted" | "denied" | "not-gated";

/** Must be called synchronously from within a real user gesture (a click
 * handler), and BEFORE opening the camera - not from the file input's
 * onChange afterwards. iOS Safari only honors
 * DeviceOrientationEvent.requestPermission() while the click's "user
 * activation" is still active, and by the time <input capture> hands
 * control back via onChange (often several seconds later, after the
 * native camera UI has closed) that activation has already expired, so
 * requesting it there silently fails every time.
 *
 * "denied" also covers the case where iOS already recorded a decision
 * for this site on an earlier visit (e.g. from before this fix, when the
 * permission was requested too late and got auto-rejected) - iOS then
 * just returns "denied" again without ever showing the dialog, and the
 * only way out is Settings > Safari > Motion & Orientation Access, or
 * clearing that site's data. */
export async function requestDeviceHeadingPermission(): Promise<HeadingPermissionResult> {
  const ctor = getOrientationEventCtor();
  if (!ctor || typeof ctor.requestPermission !== "function") return "not-gated";

  try {
    const result = await ctor.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

const HEADING_DENIED_HINT_KEY = "photo-heading-denied-hint-shown";

/** Shows a one-time (per browser session) explanation when the compass
 * permission is blocked, instead of just silently leaving "Kompass /
 * Ausrichtung" empty with no clue why - this is commonly a stale
 * decision from before the permission was requested at the right time,
 * or the iPhone-wide Settings > Safari > Motion & Orientation Access
 * toggle being off, and in both cases the in-page permission dialog
 * simply never appears again on its own. */
export function warnIfHeadingDenied(result: HeadingPermissionResult) {
  if (result !== "denied") return;
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(HEADING_DENIED_HINT_KEY)) return;

  window.sessionStorage.setItem(HEADING_DENIED_HINT_KEY, "1");
  window.alert(
    "Kompass-Zugriff ist blockiert, deshalb bleibt \"Kompass / Ausrichtung\" leer. " +
      "Auf dem iPhone prüfen: Einstellungen > Safari > \"Bewegung und Ausrichtung\" muss an sein. " +
      "Falls das schon an ist, hilft nur Zurücksetzen der Website-Berechtigung: " +
      "Einstellungen > Safari > Verlauf und Websitedaten löschen (oder nur die Daten dieser Seite).",
  );
}

/** Reads one heading sample from whatever orientation events are already
 * flowing. Permission must already have been granted via
 * requestDeviceHeadingPermission() beforehand - this function itself
 * doesn't request anything, so it's safe to call outside a user gesture
 * (e.g. from a file input's onChange after a camera capture completes).
 * Resolves null if no sensor reading arrives in time (no compass
 * hardware, permission denied, browser doesn't support it, ...) - the
 * watermark dialog simply hides the compass option for that photo rather
 * than showing bad data. */
export function readCurrentHeading(): Promise<number | null> {
  if (!getOrientationEventCtor()) return Promise.resolve(null);

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
