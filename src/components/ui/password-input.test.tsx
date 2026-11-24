import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * A password box you can look at.
 *
 * Staff mistype a password they cannot see, and on a phone keyboard that is
 * most of the failed sign-ins. The two things that must not go wrong: the
 * box is hidden until somebody asks, and revealing it must not hand the
 * password to the autocorrect engine.
 */

const code = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const box = () => screen.getByLabelText("Password");
const eye = () => screen.getByRole("button", { name: /password/i });

function field(props: Record<string, unknown> = {}) {
  return render(<PasswordInput aria-label="Password" defaultValue="hunter2" {...props} />);
}

describe("hidden until it is asked for", () => {
  it("starts hidden", () => {
    field();
    expect(box()).toHaveAttribute("type", "password");
    expect(eye()).toHaveAccessibleName("Show password");
  });

  it("shows the password when the eye is pressed", () => {
    field();
    fireEvent.click(eye());
    expect(box()).toHaveAttribute("type", "text");
    expect(box()).toHaveValue("hunter2");
    expect(eye()).toHaveAccessibleName("Hide password");
  });

  it("hides it again", () => {
    field();
    fireEvent.click(eye());
    fireEvent.click(eye());
    expect(box()).toHaveAttribute("type", "password");
  });

  it("says which state it is in, for a screen reader", () => {
    field();
    expect(eye()).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(eye());
    expect(eye()).toHaveAttribute("aria-pressed", "true");
  });
});

describe("a revealed password is still a password", () => {
  it("is never spellchecked or autocorrected, shown or hidden", () => {
    // A text box in this app gets the autocorrect engine attached on focus,
    // which could rewrite the password as it is typed.
    field();
    expect(box()).toHaveAttribute("spellcheck", "false");
    expect(box()).toHaveAttribute("autocorrect", "off");
    fireEvent.click(eye());
    expect(box()).toHaveAttribute("spellcheck", "false");
    expect(box()).toHaveAttribute("autocorrect", "off");
  });

  it("is not auto-capitalised on a phone keyboard", () => {
    field();
    expect(box()).toHaveAttribute("autocapitalize", "off");
  });

  it("turns spellcheck off itself, and not only through Input", () => {
    // Redundant today - Input's autoCorrect="off" opt-out already clears
    // spellcheck - and kept on purpose. It is the second lock: if that rule
    // in Input is ever changed, a revealed password must still not be
    // underlined and offered to the browser's dictionary. Mutation testing
    // flagged it as removable, which is exactly why this says not to.
    expect(code("src/components/ui/password-input.tsx")).toContain("spellCheck={false}");
  });

  it("the Input primitive honours an explicit autoCorrect=off", () => {
    // Which is what makes the above possible for type="text".
    const source = code("src/components/ui/input.tsx");
    expect(source).toContain('&& autoCorrect !== "off"');
    expect(source).toContain('autoCorrect={autoCorrect ?? (isProse ? "on" : "off")}');
  });
});

describe("it behaves like the box it replaced", () => {
  it("passes typing straight through", () => {
    const onChange = vi.fn();
    render(<PasswordInput aria-label="Password" value="" onChange={onChange} />);
    fireEvent.change(box(), { target: { value: "new one" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("keeps the classes it was given on the box itself", () => {
    field({ className: "h-12" });
    expect(box()).toHaveClass("h-12");
    // ...and leaves room so a long password never runs under the eye.
    expect(box()).toHaveClass("pr-10");
  });

  it("puts layout classes on the wrapper, not the box", () => {
    // A margin on the input would push it down inside the wrapper and leave
    // the eye floating above it.
    field({ containerClassName: "mt-2" });
    expect(box()).not.toHaveClass("mt-2");
    expect(box().parentElement).toHaveClass("mt-2");
  });

  it("is disabled with the field", () => {
    field({ disabled: true });
    expect(box()).toBeDisabled();
    expect(eye()).toBeDisabled();
  });

  it("stays out of the tab order, so Tab still reaches Sign In", () => {
    field();
    expect(eye()).toHaveAttribute("tabindex", "-1");
  });

  it("does not submit the form it sits in", () => {
    // A bare <button> inside a form defaults to type="submit", which would
    // sign in the moment somebody looked at their password.
    field();
    expect(eye()).toHaveAttribute("type", "button");
  });
});

describe("every password box in the app has one", () => {
  const PASSWORD_SCREENS = [
    "src/pages/auth/Login.tsx",
    "src/pages/auth/Signup.tsx",
    "src/pages/Profile.tsx",
    "src/components/auth/ChangePasswordRequired.tsx",
    "src/components/users/CreateUserDialog.tsx",
    "src/pages/UserManagement.tsx",
  ];

  for (const path of PASSWORD_SCREENS) {
    it(`${path.split("/").pop()} uses it`, () => {
      const source = code(path);
      expect(source).toContain("<PasswordInput");
      // The whole point: no password box left without an eye.
      expect(source).not.toContain('type="password"');
    });
  }

  it("leaves the card CVV and the patient's PIN alone", () => {
    // Different controls, and the clinic asked for nothing else to change.
    expect(code("src/pages/shop/ShopCheckout.tsx")).toContain('type="password"');
    expect(code("src/pages/portal/PortalLogin.tsx")).toContain('type="password"');
  });
});
