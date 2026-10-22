import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useFirstRunRedirect } from "@/hooks/use-first-run-redirect";

const { mockReplace, mockIdentity } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockIdentity: vi.fn(),
}));

let mockPathname = "/dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

vi.mock("@/hooks/use-identity", () => ({
  useIdentity: () => mockIdentity(),
}));

function Probe() {
  useFirstRunRedirect();
  return null;
}

function renderWith(identity: Record<string, unknown>, pathname = "/dashboard") {
  mockPathname = pathname;
  mockIdentity.mockReturnValue({
    loaded: true,
    orgsLoaded: true,
    orgsError: false,
    user: { emailAddresses: [{ emailAddress: "owner@x.com" }] },
    organizations: [],
    offlineIdentity: false,
    ...identity,
  });
  render(<Probe />);
}

describe("useFirstRunRedirect decision matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/dashboard";
  });

  it("bounces a cleanly-loaded zero-org user to /onboarding", async () => {
    renderWith({ organizations: [] });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"));
  });

  it("does NOT bounce when the org list failed to load", async () => {
    renderWith({ organizations: [], orgsError: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("stays when the user has organizations", async () => {
    renderWith({ organizations: [{ id: "org_1" }] });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("stays while identity is still loading", async () => {
    renderWith({ loaded: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("stays while orgs are still loading", async () => {
    renderWith({ orgsLoaded: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("stays offline with a cached (possibly empty) identity", async () => {
    renderWith({ organizations: [], offlineIdentity: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not redirect when already on /onboarding", async () => {
    renderWith({ organizations: [] }, "/onboarding");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
