import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptBankAccount, encryptBankAccount, maskBankAccount } from "../bank-crypto";

describe("bank-crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips an account number", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-123");
    const enc = await encryptBankAccount("50100234567890");
    expect(enc).toBeTruthy();
    expect(enc).not.toContain("50100234567890");
    expect(await decryptBankAccount(enc)).toBe("50100234567890");
  });

  it("null in, null out", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-123");
    expect(await encryptBankAccount(null)).toBeNull();
    expect(await encryptBankAccount("   ")).toBeNull();
    expect(await decryptBankAccount(null)).toBeNull();
  });

  it("ciphertext is non-deterministic (random IV)", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-123");
    const a = await encryptBankAccount("1234");
    const b = await encryptBankAccount("1234");
    expect(a).not.toBe(b);
  });

  it("fails closed without a secret", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    await expect(encryptBankAccount("1234")).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it("masks to last-4", () => {
    expect(maskBankAccount("50100234567890")).toBe("•••• 7890");
    expect(maskBankAccount(null)).toBe("—");
  });
});
