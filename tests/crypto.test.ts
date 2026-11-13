import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, decrypt, encrypt, generateTotpSecret, totpAt, verifyTotp } from "@/lib/crypto";

describe("TOTP", () => {
  // RFC 6238 test vector (SHA-1, secret "12345678901234567890").
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches RFC 6238 vectors", () => {
    expect(totpAt(secret, 59_000)).toBe("287082");
    expect(totpAt(secret, 1111111109_000)).toBe("081804");
    expect(totpAt(secret, 1234567890_000)).toBe("005924");
  });
  it("accepts ±1 step and rejects others", () => {
    const s = generateTotpSecret();
    const now = Date.now();
    expect(verifyTotp(s, totpAt(s, now), now)).toBe(true);
    expect(verifyTotp(s, totpAt(s, now - 30_000), now)).toBe(true);
    expect(verifyTotp(s, totpAt(s, now - 120_000), now)).toBe(false);
    expect(verifyTotp(s, "abc", now)).toBe(false);
  });
  it("round-trips base32", () => {
    const b = Buffer.from([0, 1, 2, 250, 251, 255]);
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
});

describe("encryption", () => {
  it("round-trips and detects tampering", () => {
    const c = encrypt("JBSWY3DPEHPK3PXP");
    expect(decrypt(c)).toBe("JBSWY3DPEHPK3PXP");
    const parts = c.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});
