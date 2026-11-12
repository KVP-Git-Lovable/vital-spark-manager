import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

/**
 * The left-hand menu, after Others and Feedback were added.
 *
 * The first test is the one that matters: the clinic asked for the menu
 * regrouped and for nothing else to be affected, so every address the menu
 * offered before this change is listed here by hand and checked to still be
 * offered. A page that quietly stopped being reachable from the menu is the
 * failure this is here to prevent.
 */

/**
 * Mutable so a test can sign in as somebody other than an admin. It starts as
 * an admin with an empty map, which is exactly what useAuth hands an admin -
 * see the convention in src/lib/staffAccess.ts.
 */
let auth: { isAdmin: boolean; permissions: Record<string, { can_view: boolean }> } = {
  isAdmin: true,
  permissions: {},
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

beforeEach(() => {
  auth = { isAdmin: true, permissions: {} };
});

/**
 * The 47 addresses the sidebar offered before the regrouping, taken from the
 * file as it stood. Deliberately written out rather than derived from the
 * component: a list read back out of the thing under test proves nothing.
 */
const EVERY_LINK_BEFORE = [
  "/", "/patients", "/appointments", "/procedures", "/billing", "/pharma", "/photos",
  "/assets", "/orders", "/expenses", "/reports", "/report-builder", "/dashboards",
  "/leads", "/campaigns", "/whatsapp-log", "/feedback-rca",
  "/communications/whatsapp", "/communications/voice", "/communications/email",
  "/communications/journeys", "/communications/calendar", "/communications/meta",
  "/communications/meta/connection",
  "/staff", "/attendance", "/leave",
  "/survey-templates", "/all-surveys",
  "/services", "/knowledge", "/vendors", "/category-master", "/tax-master", "/problem-areas",
  "/validation-rules", "/custom-fields", "/duplicate-management", "/admin/history-tracking",
  "/admin/knowledge-categories", "/admin/currency", "/admin/portal-modules",
  "/admin/attendance", "/user-management", "/admin/trash",
  "/trash", "/settings",
];

/** Render at a path so the group covering it opens, and read every link out. */
function sidebarAt(path: string) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
  const hrefs = () =>
    Array.from(view.container.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")!);
  return { ...view, hrefs };
}

describe("nothing was lost", () => {
  it("still offers every link it offered before the regrouping", () => {
    // Every group open at once is not a state the menu has, so the pages are
    // gathered from one render per group and pooled.
    const seen = new Set<string>();
    for (const path of ["/", "/communications/whatsapp", "/feedback-rca", "/staff", "/dashboards", "/services", "/admin"]) {
      const { hrefs, unmount } = sidebarAt(path);
      hrefs().forEach((h) => seen.add(h));
      unmount();
    }
    const missing = EVERY_LINK_BEFORE.filter((url) => !seen.has(url));
    expect(missing, `these pages are no longer reachable from the menu: ${missing.join(", ")}`)
      .toEqual([]);
  });

  it("offers no link twice", () => {
    // Moving an entry into a group and forgetting to take it out of the main
    // list would show it in both places.
    const { hrefs } = sidebarAt("/dashboards");
    const all = hrefs();
    expect(all.length, `duplicated: ${all.filter((h, i) => all.indexOf(h) !== i).join(", ")}`)
      .toBe(new Set(all).size);
  });
});

describe("Others", () => {
  it("holds the four occasional pages and nothing else", () => {
    const { hrefs } = sidebarAt("/dashboards");
    const group = screen.getByText("Others").closest("li")!;
    const inside = Array.from(group.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
    expect(inside).toEqual(["/dashboards", "/report-builder", "/orders", "/expenses"]);
    // And they are no longer loose in the main list above it.
    expect(hrefs().filter((h) => h === "/expenses")).toHaveLength(1);
  });

  it("opens by itself when you are on one of its pages", () => {
    sidebarAt("/expenses");
    expect(screen.getByText("Expenses")).toBeInTheDocument();
  });

  it("stays shut on an unrelated page", () => {
    sidebarAt("/patients");
    expect(screen.queryByText("Report Builder")).toBeNull();
  });
});

describe("Feedback", () => {
  it("holds Root Cause Analysis", () => {
    sidebarAt("/feedback-rca");
    const group = screen.getByText("Feedback").closest("li")!;
    expect(within(group).getByText("Root Cause Analysis")).toBeInTheDocument();
    expect(group.querySelectorAll("a[href]")).toHaveLength(1);
  });

  it("sits directly below WhatsApp Delivery", () => {
    // The clinic asked for it there by name.
    const { container } = sidebarAt("/feedback-rca");
    const text = container.textContent ?? "";
    expect(text.indexOf("WhatsApp Delivery")).toBeGreaterThan(-1);
    expect(text.indexOf("Feedback")).toBeGreaterThan(text.indexOf("WhatsApp Delivery"));
    expect(text.indexOf("Feedback")).toBeLessThan(text.indexOf("Employees"));
  });
});

describe("Surveys moved under Master Data", () => {
  it("lists both survey pages there", () => {
    sidebarAt("/survey-templates");
    const group = screen.getAllByText("Master Data").map((el) => el.closest("li")).find(Boolean)!;
    const inside = Array.from(group.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
    expect(inside).toContain("/survey-templates");
    expect(inside).toContain("/all-surveys");
  });

  it("leaves no Surveys dropdown of its own", () => {
    sidebarAt("/patients");
    expect(screen.queryByText("Surveys")).toBeNull();
  });
});

describe("the groups that were not asked about", () => {
  it("Communications Center is untouched", () => {
    sidebarAt("/communications/whatsapp");
    const group = screen.getByText("Communications Center").closest("li")!;
    expect(group.querySelectorAll("a[href]")).toHaveLength(7);
  });

  it("Employees is untouched", () => {
    sidebarAt("/staff");
    const group = screen.getByText("Employees").closest("li")!;
    expect(group.querySelectorAll("a[href]")).toHaveLength(3);
  });
});

/**
 * The menu after it was made to tell the truth.
 *
 * canView() used to be `return true` with a note saying "for now", so every
 * signed-in person was offered all 47 pages and the route guard then refused
 * most of them. These hold the other direction too: an admin still sees
 * everything, and a role nobody has configured yet is not locked out.
 */
describe("what a therapist sees", () => {
  const therapist = {
    isAdmin: false,
    permissions: {
      dashboard: { can_view: true },
      appointments: { can_view: true },
      attendance: { can_view: true },
    },
  };

  /** Every group opened in turn, so nothing is missed by being collapsed. */
  function allLinksFor(a: typeof therapist) {
    auth = a;
    const seen = new Set<string>();
    for (const path of ["/", "/communications/whatsapp", "/feedback-rca", "/staff", "/dashboards", "/services", "/admin"]) {
      const { hrefs, unmount } = sidebarAt(path);
      hrefs().forEach((h) => seen.add(h));
      unmount();
    }
    return seen;
  }

  it("offers the three pages they were given, and the way into them", () => {
    const seen = allLinksFor(therapist);
    for (const url of ["/", "/appointments", "/attendance"]) {
      expect(seen.has(url), `a therapist cannot reach ${url}`).toBe(true);
    }
  });

  it("offers nothing else at all", () => {
    const seen = allLinksFor(therapist);
    // Named rather than counted: a count passes while the wrong pages leak.
    for (const url of [
      "/patients", "/billing", "/pharma", "/photos", "/procedures", "/reports",
      "/staff", "/leave", "/settings", "/user-management", "/admin/attendance",
      "/trash", "/admin/trash", "/expenses", "/leads", "/campaigns",
      "/communications/whatsapp", "/services", "/survey-templates",
    ]) {
      expect(seen.has(url), `a therapist should not be offered ${url}`).toBe(false);
    }
  });

  it("hides the Admin group entirely rather than leaving it empty", () => {
    auth = therapist;
    sidebarAt("/admin");
    expect(screen.queryByText("Administration")).toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();
  });

  it("still shows Employees, because My Attendance lives inside it", () => {
    auth = therapist;
    sidebarAt("/attendance");
    expect(screen.getByText("My Attendance")).toBeInTheDocument();
    expect(screen.queryByText("Staff")).toBeNull();
  });
});

describe("what the gating must never do", () => {
  it("leaves an admin every one of the 47 links", () => {
    // Admins are handled before the map is consulted, and their map is empty.
    auth = { isAdmin: true, permissions: {} };
    const seen = new Set<string>();
    for (const path of ["/", "/communications/whatsapp", "/feedback-rca", "/staff", "/dashboards", "/services", "/admin"]) {
      const { hrefs, unmount } = sidebarAt(path);
      hrefs().forEach((h) => seen.add(h));
      unmount();
    }
    const missing = EVERY_LINK_BEFORE.filter((url) => !seen.has(url));
    expect(missing, `an admin lost: ${missing.join(", ")}`).toEqual([]);
  });

  it("leaves a role nobody has configured yet with everything", () => {
    // An empty map for a non-admin means "not set up", and locking those
    // people out of their own clinic on an upgrade is the worse failure.
    auth = { isAdmin: false, permissions: {} };
    const { hrefs } = sidebarAt("/");
    expect(hrefs()).toContain("/patients");
  });

  it("hides a page whose permission is present but switched off", () => {
    auth = { isAdmin: false, permissions: { dashboard: { can_view: true }, patients: { can_view: false } } };
    const { hrefs } = sidebarAt("/");
    expect(hrefs()).not.toContain("/patients");
  });
});
