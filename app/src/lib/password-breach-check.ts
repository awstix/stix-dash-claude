/** Checks a password against the HaveIBeenPwned Pwned Passwords database
 * using k-anonymity: only the first 5 hex characters of the SHA-1 hash are
 * sent, never the password itself or its full hash. On any network/API
 * failure this fails OPEN (returns false, logs a warning) rather than
 * blocking password changes when the check service is unreachable -
 * consistent with this app's "never lock people out on our own bug"
 * philosophy (see src/proxy.ts). */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn(`Pwned-Passwords-Check fehlgeschlagen (Status ${response.status}).`);
      return false;
    }

    const body = await response.text();
    return body
      .split("\n")
      .some((line) => line.split(":")[0]?.trim().toUpperCase() === suffix);
  } catch (error) {
    console.warn("Pwned-Passwords-Check nicht erreichbar:", error);
    return false;
  }
}

async function sha1Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
