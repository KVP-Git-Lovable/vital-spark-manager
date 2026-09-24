import { describe, it, expect } from "vitest";
import { seedInvoiceLines } from "./invoiceEditSeed";

describe("seedInvoiceLines", () => {
  it("treats a line with no kind as a service", () => {
    // 55,854 of the lines in this database have no kind - they came from the
    // Salesforce promotion and every one is a service. Reading them as
    // products would move them into pharmacy and start moving stock.
    const { services, products } = seedInvoiceLines([
      { name: "Consultation", price: 800, hsn: "999319", gst: 0 },
    ]);
    expect(products).toEqual([]);
    expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({ name: "Consultation", price: 800, hsn: "999319", gst: 0 });
  });

  it("carries a service's details back into the form", () => {
    const { services } = seedInvoiceLines([
      { kind: "service", name: "ACNELAN", price: 15000, hsn: "999722", gst: 5, service_id: "svc-1", material_percent: 20 },
    ]);
    expect(services[0]).toEqual({
      name: "ACNELAN",
      price: 15000,
      hsn: "999722",
      gst: 5,
      service_id: "svc-1",
      material_percent: "20",
    });
  });

  it("keeps a material percent of zero distinct from one never set", () => {
    const [withZero] = seedInvoiceLines([{ name: "A", price: 1, material_percent: 0 }]).services;
    const [withNone] = seedInvoiceLines([{ name: "B", price: 1 }]).services;
    expect(withZero.material_percent).toBe("0");
    expect(withNone.material_percent).toBe("");
  });

  it("reads a product line into the pharmacy rows", () => {
    const { services, products } = seedInvoiceLines([
      { kind: "product", name: "CWIN Shampoo", price: 450, qty: 2, inventory_id: "batch-1", product_id: "prod-1", batch_number: "B12", uom: "strip", uom_factor: 10 },
    ]);
    expect(services).toEqual([]);
    expect(products[0]).toMatchObject({
      inventory_id: "batch-1",
      product_id: "prod-1",
      product_name: "CWIN Shampoo",
      batch_number: "B12",
      quantity: 2,
      unit_price: 450,
      uom: "strip",
      uom_factor: 10,
    });
  });

  it("splits a mixed invoice", () => {
    const { services, products } = seedInvoiceLines([
      { name: "Consultation", price: 800 },
      { kind: "product", name: "Cream", price: 300, qty: 1, inventory_id: "batch-2" },
    ]);
    expect(services.map((s) => s.name)).toEqual(["Consultation"]);
    expect(products.map((p) => p.product_name)).toEqual(["Cream"]);
  });

  it("drops a nameless line instead of seeding a blank row", () => {
    expect(seedInvoiceLines([{ name: "   ", price: 10 }, null, "nonsense"]).services).toEqual([]);
  });

  it("survives an invoice with no lines at all", () => {
    expect(seedInvoiceLines(null)).toEqual({ services: [], products: [] });
    expect(seedInvoiceLines([])).toEqual({ services: [], products: [] });
  });

  it("defaults a product quantity to at least one", () => {
    const { products } = seedInvoiceLines([{ kind: "product", name: "X", price: 5, inventory_id: "b" }]);
    expect(products[0].quantity).toBe(1);
    expect(products[0].uom_factor).toBe(1);
  });
});
