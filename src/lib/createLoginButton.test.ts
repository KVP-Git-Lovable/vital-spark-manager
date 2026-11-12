import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Getting into somebody else's profile, when there is no profile to get into.
 *
 * "Log in as this user" switches the admin's browser session to a REAL
 * account. On a staff row with no account there is nothing to switch to, so
 * the button cannot appear - and on thirteen of the clinic's twenty-one
 * staff it did not, which read as a missing feature rather than a missing
 * login. Email addresses had been added to those staff rows, and an email on
 * a staff row is not an account.
 *
 * The dialog that creates one was already on the row, behind an icon whose
 * tooltip said "Reset Password" whatever the row's state. These tests hold
 * the two halves of the fix: that slot always offers the step that is
 * actually available, and the key icon stops mislabelling itself.
 */

const PAGE = "src/pages/UserManagement.tsx";
/** Comments stripped: the new block explains the old behaviour in prose, and
 *  a plain search would find the sentence rather than the code. */
const src = () =>
  readFileSync(PAGE, "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** The one <Button> whose body contains a marker, with its props. */
function buttonWith(marker: string): string {
  const text = src();
  const at = text.indexOf(marker);
  expect(at, `nothing in the page matches ${marker}`).toBeGreaterThan(-1);
  const open = text.lastIndexOf("<Button", at);
  const close = text.indexOf("</Button>", at);
  return text.slice(open, close);
}

describe("the slot beside Edit always offers what is available", () => {
  it("offers Create login on a row with no account", () => {
    expect(src()).toMatch(/\{!s\.auth_user_id && s\.is_active && \(/);
    expect(buttonWith('data-testid="create-login"')).toContain('title="Create login"');
  });

  it("still offers Log in as this user on a row that has one", () => {
    expect(src()).toMatch(/\{mayImpersonate && s\.auth_user_id && s\.is_active && \(/);
    expect(buttonWith('title="Log in as this user"')).toContain("setImpersonateStaff(s)");
  });

  it("never shows both on one row, and never neither while active", () => {
    // The two conditions differ only in s.auth_user_id, so exactly one can
    // hold for an active row - which is what makes the column read as one
    // slot with two states rather than two optional buttons.
    const text = src();
    expect(text).toContain("mayImpersonate && s.auth_user_id && s.is_active");
    expect(text).toContain("!s.auth_user_id && s.is_active");
  });

  it("keeps the account check on the impersonate button", () => {
    // Without s.auth_user_id this would call startImpersonation(undefined)
    // and the edge function would be asked to become nobody.
    expect(src()).not.toMatch(/\{mayImpersonate && s\.is_active && \(/);
  });

  it("offers neither on a deactivated staff row", () => {
    const text = src();
    expect(text).not.toMatch(/\{!s\.auth_user_id && \(/);
  });
});

describe("Create login reuses the dialog that already exists", () => {
  it("opens it with the same four setters the key icon uses", () => {
    // A second create-an-account path would be a second place to keep the
    // force-password-change rule and the no-email message correct.
    const btn = buttonWith('data-testid="create-login"');
    for (const call of [
      "setResetPwStaff(s)",
      'setResetPwMode("auto")',
      'setResetPwValue("")',
      'setResetPwConfirm("")',
      "setResetPwOpen(true)",
    ]) {
      expect(btn, `Create login does not ${call}`).toContain(call);
    }
  });

  it("builds no second dialog of its own", () => {
    // One "Create Login for" title in the page: the dialog's.
    expect((src().match(/Create Login for /g) ?? []).length).toBe(1);
  });

  it("is not gated on the impersonation allow-list", () => {
    // mayImpersonate answers "may I become another user", which is a
    // narrower question than "may I give one an account". The cell is
    // already admin-only.
    expect(buttonWith('data-testid="create-login"')).not.toContain("mayImpersonate");
  });
});

describe("the key icon stops mislabelling itself", () => {
  it("names what it will actually do", () => {
    expect(src()).toContain('title={s.auth_user_id ? "Reset Password" : "Create Login"}');
    expect(src()).not.toMatch(/title="Reset Password"/);
  });

  it("uses the same condition its own dialog title uses", () => {
    // The dialog has always read "Create Login for X" in this case; only the
    // tooltip disagreed.
    expect(src()).toMatch(/resetPwStaff\?\.auth_user_id \? "Reset Password for " : "Create Login for "/);
  });
});

describe("nothing else on the row moved", () => {
  it("keeps Edit, Reset and Delete", () => {
    const text = src();
    expect(text).toContain('title="Edit User"');
    expect(text).toContain('title="Delete User"');
    expect(text).toMatch(/<KeyRound className="h-4 w-4" \/>/);
  });

  it("leaves impersonation itself untouched", () => {
    const text = src();
    expect(text).toContain("startImpersonation(target.auth_user_id, actorName)");
    expect(text).toContain("Log in as {impersonateStaff?.name}?");
  });

  it("creates the account through the function that already does it", () => {
    const text = src();
    expect(text).toContain('supabase.functions.invoke("create-user-account"');
    expect(text).toContain("force_password_change: true");
    // The message for somebody with no email on file, which is the one real
    // edge here - one staff member has none.
    expect(text).toContain("has no email on file");
  });
});
