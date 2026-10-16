import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BaSignInForm from "@/components/auth/ba-sign-in-form";

const { mockPush, mockRefresh, mockSignInEmail, mockSignInSocial } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockSignInEmail: vi.fn(),
  mockSignInSocial: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: mockSignInEmail, social: mockSignInSocial },
  },
}));

describe("<BaSignInForm />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email sign-in fields and submits credentials", async () => {
    const user = userEvent.setup();
    mockSignInEmail.mockResolvedValue({ error: null });
    render(<BaSignInForm />);

    await user.type(screen.getByLabelText("Email"), "owner@restaurant.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "owner@restaurant.com", password: "secret123" }),
        expect.anything(),
      );
    });
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows inline + toast-visible error on bad credentials", async () => {
    const user = userEvent.setup();
    mockSignInEmail.mockResolvedValue({ error: { message: "Invalid email or password" } });
    render(<BaSignInForm />);

    await user.type(screen.getByLabelText("Email"), "owner@restaurant.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
