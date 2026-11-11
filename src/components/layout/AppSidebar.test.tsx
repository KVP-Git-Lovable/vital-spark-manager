import { describe, expect, it, vi } from "vitest";
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

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAdmin: true, permissions: {} }),
}));

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
