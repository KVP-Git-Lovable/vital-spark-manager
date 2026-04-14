import { useState } from "react";
import { VendorCombobox } from "@/components/shared/VendorCombobox";
import { Plus, Search, Package, ShoppingCart, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProductDetailSheet, InventoryDetailSheet, BillDetailSheet } from "@/components/pharma/PharmaDetailSheet";

// ─── Form Defaults ────────────────────────────────
const emptyProduct = { name: "", generic_name: "", category: "General", manufacturer: "", unit: "Nos", hsn_code: "", reorder_level: 10, vendor_id: "", mrp: 0, selling_price: 0, gst_percent: 0, expiry_date: "", qty_per_unit: 1 };
const emptyStock = { product_id: "", batch_number: "", expiry_date: "", quantity: 0, purchase_price: 0, supplier: "", invoice_number: "" };

interface BillItemInput {
  product_id: string;
  inventory_id: string;
  product_name: string;
  batch_number: string;
  quantity: number;
  unit_price: number;
  available: number;
  gst_percent: number;
}

const Pharma = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [productForm, setProductForm] = useState({ ...emptyProduct });
  const [stockForm, setStockForm] = useState({ ...emptyStock });

  // Detail sheet state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  // Bill state
  const [billPatientName, setBillPatientName] = useState("");
  const [billPaymentMode, setBillPaymentMode] = useState("Cash");
  const [billDiscount, setBillDiscount] = useState(0);
  const [billItems, setBillItems] = useState<BillItemInput[]>([]);
  // billTaxId removed — tax is now per-item from product master

  // ─── Queries ────────────────────────────────────
  const { data: products = [] } = useQuery({
    queryKey: ["pharma-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["pharma-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_inventory").select("*, pharma_products(name)").order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["pharma-bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_bills").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pharmaTaxes = [] } = useQuery({
    queryKey: ["tax-master-active-pharma"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tax_master").select("*").eq("is_active", true).order("rate");
      if (error) throw error;
      return data;
    },
  });

  const { data: unitMaster = [] } = useQuery({
    queryKey: ["unit-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unit_master").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: categoryMaster = [] } = useQuery({
    queryKey: ["category-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("category_master").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // ─── Mutations ──────────────────────────────────
  const addProduct = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: productForm.name,
        generic_name: productForm.generic_name || null,
        category: productForm.category,
        manufacturer: productForm.manufacturer || null,
        unit: productForm.unit,
        hsn_code: productForm.hsn_code || null,
        reorder_level: productForm.reorder_level,
        mrp: productForm.mrp,
        selling_price: productForm.selling_price,
        gst_percent: productForm.gst_percent,
        vendor_id: productForm.vendor_id || null,
        expiry_date: productForm.expiry_date || null,
        qty_per_unit: productForm.qty_per_unit || 1,
      };
      const { error } = await supabase.from("pharma_products").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-products"] });
      toast.success("Product added");
      setProductForm({ ...emptyProduct });
      setProductOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pharma_inventory").insert({
        ...stockForm,
        quantity: Number(stockForm.quantity),
        purchase_price: Number(stockForm.purchase_price),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-inventory"] });
      toast.success("Stock added");
      setStockForm({ ...emptyStock });
      setStockOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createBill = useMutation({
    mutationFn: async () => {
      // Validate stock availability before creating bill
      for (const item of billItems) {
        if (!item.inventory_id) continue;
        const inv = inventory.find((i: any) => i.id === item.inventory_id) as any;
        if (!inv || inv.quantity <= 0) {
          throw new Error(`Insufficient stock for ${item.product_name || "selected product"}`);
        }
        if (item.quantity > inv.quantity) {
          throw new Error(`Insufficient stock for ${item.product_name}. Available: ${inv.quantity}, Requested: ${item.quantity}`);
        }
      }

      const totalAmount = billItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const taxAmount = billItems.reduce((s, i) => s + (i.quantity * i.unit_price * i.gst_percent) / 100, 0);
      const netAmount = totalAmount + taxAmount - billDiscount;
      const billNum = `PH-${Date.now().toString().slice(-6)}`;

      const { data: bill, error } = await supabase.from("pharma_bills").insert({
        bill_number: billNum,
        patient_name: billPatientName,
        total_amount: totalAmount,
        discount: billDiscount,
        net_amount: netAmount,
        payment_mode: billPaymentMode,
        tax_id: null,
        tax_rate: 0,
        tax_amount: taxAmount,
      }).select().single();
      if (error) throw error;

      const items = billItems.map((i) => ({
        bill_id: bill.id,
        product_id: i.product_id,
        inventory_id: i.inventory_id,
        product_name: i.product_name,
        batch_number: i.batch_number,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price,
      }));
      const { error: itemErr } = await supabase.from("pharma_bill_items").insert(items);
      if (itemErr) throw itemErr;

      for (const item of billItems) {
        const invRecord = inventory.find((inv: any) => inv.id === item.inventory_id);
        if (invRecord) {
          await supabase.from("pharma_inventory").update({ quantity: (invRecord as any).quantity - item.quantity }).eq("id", item.inventory_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-bills", "pharma-inventory"] });
      toast.success("Bill created");
      setBillItems([]);
      setBillPatientName("");
      setBillDiscount(0);
      setBillOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBillItem = () => {
    setBillItems([...billItems, { product_id: "", inventory_id: "", product_name: "", batch_number: "", quantity: 1, unit_price: 0, available: 0, gst_percent: 0 }]);
  };

  const updateBillItem = (idx: number, field: string, value: any) => {
    const updated = [...billItems];
    (updated[idx] as any)[field] = value;
    if (field === "inventory_id") {
      const inv = inventory.find((i: any) => i.id === value) as any;
      if (inv) {
        const prod = products.find((p: any) => p.id === inv.product_id) as any;
        updated[idx].product_id = inv.product_id;
        updated[idx].product_name = prod?.name || "";
        updated[idx].batch_number = inv.batch_number;
        updated[idx].unit_price = prod?.selling_price || 0;
        updated[idx].available = inv.quantity;
        updated[idx].gst_percent = Number(prod?.gst_percent) || 0;
        if (inv.quantity <= 0) {
          toast.warning(`Insufficient stock for ${prod?.name || "this product"}`);
        }
      }
    }
    if (field === "quantity" && updated[idx].available > 0 && value > updated[idx].available) {
      toast.warning(`Only ${updated[idx].available} units available for ${updated[idx].product_name}`);
    }
    setBillItems(updated);
  };

  // Clone handlers
  const handleCloneProduct = (product: any) => {
    setProductForm({
      name: `${product.name} (Copy)`,
      generic_name: product.generic_name || "",
      category: product.category || "General",
      manufacturer: product.manufacturer || "",
      unit: product.unit || "Nos",
      hsn_code: product.hsn_code || "",
      reorder_level: product.reorder_level || 10,
      vendor_id: product.vendor_id || "",
      mrp: product.mrp || 0,
      selling_price: product.selling_price || 0,
      gst_percent: product.gst_percent || 0,
      expiry_date: product.expiry_date || "",
      qty_per_unit: product.qty_per_unit || 1,
    });
    setProductOpen(true);
  };

  const handleCloneInventory = (inv: any) => {
    setStockForm({
      product_id: inv.product_id || "",
      batch_number: "",
      expiry_date: "",
      quantity: inv.quantity || 0,
      purchase_price: inv.purchase_price || 0,
      supplier: inv.supplier || "",
      invoice_number: "",
    });
    setStockOpen(true);
  };

  const handleCloneBill = (bill: any) => {
    setBillPatientName(bill.patient_name || "");
    setBillPaymentMode(bill.payment_mode || "Cash");
    setBillDiscount(bill.discount || 0);
    setBillItems([]);
    setBillItems([]);
    setBillOpen(true);
    toast.info("Bill cloned — add items to complete");
  };

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const nearExpiry = inventory.filter((i: any) => {
    const exp = new Date(i.expiry_date);
    const diff = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 90 && diff > 0;
  });

  const expired = inventory.filter((i: any) => new Date(i.expiry_date) < new Date());

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Pharmacy</h1>
          <p className="page-subtitle">Products, inventory & billing</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={productOpen} onOpenChange={setProductOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Package className="h-4 w-4" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-display">Add Product</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Product Name *</Label><Input className="mt-1" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
                  <div><Label>Generic Name</Label><Input className="mt-1" value={productForm.generic_name} onChange={(e) => setProductForm({ ...productForm, generic_name: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select value={productForm.category} onValueChange={(v) => setProductForm({ ...productForm, category: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>{categoryMaster.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select value={productForm.unit} onValueChange={(v) => setProductForm({ ...productForm, unit: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>{unitMaster.map((u: any) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Manufacturer</Label><Input className="mt-1" value={productForm.manufacturer} onChange={(e) => setProductForm({ ...productForm, manufacturer: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Vendor</Label>
                  <div className="mt-1">
                    <VendorCombobox value={productForm.vendor_id} onChange={(v) => setProductForm({ ...productForm, vendor_id: v })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>MRP *</Label><Input type="number" className="mt-1" value={productForm.mrp} onChange={(e) => setProductForm({ ...productForm, mrp: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>Selling Price *</Label><Input type="number" className="mt-1" value={productForm.selling_price} onChange={(e) => setProductForm({ ...productForm, selling_price: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>Tax (GST %)</Label><Input type="number" className="mt-1" value={productForm.gst_percent} onChange={(e) => setProductForm({ ...productForm, gst_percent: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>HSN Code</Label><Input className="mt-1" value={productForm.hsn_code} onChange={(e) => setProductForm({ ...productForm, hsn_code: e.target.value })} /></div>
                  <div><Label>Reorder Level</Label><Input type="number" className="mt-1" value={productForm.reorder_level} onChange={(e) => setProductForm({ ...productForm, reorder_level: parseInt(e.target.value) || 10 })} /></div>
                  {(() => {
                    const selectedUnit = unitMaster.find((u: any) => u.name === productForm.unit);
                    const unitName = productForm.unit;
                    if (unitName === "Nos") return null;
                    const label = unitName === "Strip" ? "Tablets per Strip"
                      : unitName === "Sachet" ? "Qty per Sachet (e.g. 5gm)"
                      : unitName === "Tube" ? "Volume/Weight (e.g. 30gm)"
                      : unitName === "Bottle" ? "Volume per Bottle (e.g. 100ml)"
                      : selectedUnit?.sub_unit_name ? `${selectedUnit.sub_unit_name} per ${unitName}` : "Qty per Unit";
                    return (
                      <div><Label>{label}</Label><Input type="number" className="mt-1" value={productForm.qty_per_unit} onChange={(e) => setProductForm({ ...productForm, qty_per_unit: parseInt(e.target.value) || 1 })} placeholder={selectedUnit?.conversion_qty ? String(selectedUnit.conversion_qty) : "1"} /></div>
                    );
                  })()}
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" className="mt-1" value={productForm.expiry_date} onChange={(e) => setProductForm({ ...productForm, expiry_date: e.target.value })} />
                </div>
                <Button className="w-full" onClick={() => addProduct.mutate()} disabled={!productForm.name || addProduct.isPending}>
                  {addProduct.isPending ? "Saving..." : "Add Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={stockOpen} onOpenChange={setStockOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Inward Stock</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Add Stock (Inward)</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label>Product *</Label>
                  <Select value={stockForm.product_id} onValueChange={(v) => setStockForm({ ...stockForm, product_id: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Batch No. *</Label><Input className="mt-1" value={stockForm.batch_number} onChange={(e) => setStockForm({ ...stockForm, batch_number: e.target.value })} /></div>
                  <div><Label>Expiry Date *</Label><Input type="date" className="mt-1" value={stockForm.expiry_date} onChange={(e) => setStockForm({ ...stockForm, expiry_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Quantity *</Label><Input type="number" className="mt-1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 0 })} /></div>
                  <div><Label>Purchase Price (₹)</Label><Input type="number" className="mt-1" value={stockForm.purchase_price} onChange={(e) => setStockForm({ ...stockForm, purchase_price: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Supplier</Label><div className="mt-1"><VendorCombobox value={stockForm.supplier} onChange={(v) => setStockForm({ ...stockForm, supplier: v })} placeholder="Select supplier..." /></div></div>
                  <div><Label>Invoice No.</Label><Input className="mt-1" value={stockForm.invoice_number} onChange={(e) => setStockForm({ ...stockForm, invoice_number: e.target.value })} /></div>
                </div>
                <Button className="w-full" onClick={() => addStock.mutate()} disabled={!stockForm.product_id || !stockForm.batch_number || !stockForm.expiry_date || addStock.isPending}>
                  {addStock.isPending ? "Saving..." : "Add Stock"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={billOpen} onOpenChange={setBillOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><ShoppingCart className="h-4 w-4" /> New Bill</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">Pharmacy Bill (Outward)</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Patient Name</Label><Input className="mt-1" value={billPatientName} onChange={(e) => setBillPatientName(e.target.value)} /></div>
                  <div>
                    <Label>Payment Mode</Label>
                    <Select value={billPaymentMode} onValueChange={setBillPaymentMode}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{["Cash", "Card", "UPI", "Insurance"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-display font-semibold">Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addBillItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
                  </div>
                  {billItems.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 mb-2 space-y-2 bg-muted/30">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Product (Batch)</Label>
                          <Select value={item.inventory_id} onValueChange={(v) => updateBillItem(idx, "inventory_id", v)}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {inventory.filter((i: any) => i.quantity > 0 && new Date(i.expiry_date) > new Date()).map((i: any) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.pharma_products?.name} — Batch: {i.batch_number} (Qty: {i.quantity})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Qty</Label><Input type="number" className="mt-1" value={item.quantity} onChange={(e) => updateBillItem(idx, "quantity", parseInt(e.target.value) || 1)} max={item.available} /></div>
                          <div><Label className="text-xs">Price (₹)</Label><Input type="number" className="mt-1" value={item.unit_price} onChange={(e) => updateBillItem(idx, "unit_price", parseFloat(e.target.value) || 0)} /></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Subtotal: ₹{(item.quantity * item.unit_price).toFixed(2)}
                          {item.gst_percent > 0 && ` + GST ${item.gst_percent}%: ₹${(item.quantity * item.unit_price * item.gst_percent / 100).toFixed(2)}`}
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="h-5 text-xs text-destructive" onClick={() => setBillItems(billItems.filter((_, i) => i !== idx))}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{billItems.reduce((s, i) => s + i.quantity * i.unit_price, 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>GST (per-item)</span>
                    <span>₹{billItems.reduce((s, i) => s + (i.quantity * i.unit_price * i.gst_percent) / 100, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Discount (₹)</span>
                    <Input type="number" className="w-24 h-8 text-right" value={billDiscount} onChange={(e) => setBillDiscount(parseFloat(e.target.value) || 0)} />
                  </div>
                  {(() => {
                    const subtotal = billItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
                    const taxAmt = billItems.reduce((s, i) => s + (i.quantity * i.unit_price * i.gst_percent) / 100, 0);
                    return <div className="flex justify-between font-semibold"><span>Net Amount</span><span>₹{(subtotal + taxAmt - billDiscount).toFixed(2)}</span></div>;
                  })()}
                </div>

                <Button className="w-full" onClick={() => createBill.mutate()} disabled={billItems.length === 0 || createBill.isPending}>
                  {createBill.isPending ? "Creating..." : "Create Bill"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alerts */}
      {(nearExpiry.length > 0 || expired.length > 0) && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {expired.length > 0 && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
              <AlertTriangle className="h-4 w-4" /> {expired.length} batch(es) expired
            </div>
          )}
          {nearExpiry.length > 0 && (
            <div className="flex items-center gap-2 bg-warning/10 text-warning rounded-lg px-4 py-2 text-sm">
              <AlertTriangle className="h-4 w-4" /> {nearExpiry.length} batch(es) expiring within 90 days
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-9 bg-card border" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="data-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>GST%</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Reorder Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
                ) : filteredProducts.map((p: any) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setSelectedProductId(p.id)}>
                    <TableCell>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}<br /><span className="text-xs text-muted-foreground">{p.generic_name}</span></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{p.category}</Badge></TableCell>
                    <TableCell>₹{Number(p.mrp).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(p.selling_price).toFixed(2)}</TableCell>
                    <TableCell>{Number(p.gst_percent)}%</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell>{p.reorder_level}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        <TabsContent value="inventory">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="data-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No inventory records</TableCell></TableRow>
                ) : inventory.map((i: any) => {
                  const exp = new Date(i.expiry_date);
                  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysLeft <= 0;
                  const isNear = daysLeft > 0 && daysLeft <= 90;
                  return (
                    <TableRow key={i.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setSelectedInventoryId(i.id)}>
                      <TableCell className="font-medium">{i.pharma_products?.name}</TableCell>
                      <TableCell>{i.batch_number}</TableCell>
                      <TableCell>{i.quantity}</TableCell>
                      <TableCell>₹{Number(i.purchase_price).toFixed(2)}</TableCell>
                      <TableCell>{exp.toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground">{i.supplier || "—"}</TableCell>
                      <TableCell>
                        {isExpired ? <Badge variant="destructive" className="text-xs">Expired</Badge>
                          : isNear ? <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">Expiring Soon</Badge>
                          : <Badge variant="secondary" className="text-xs">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        <TabsContent value="bills">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="data-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bills yet</TableCell></TableRow>
                ) : bills.map((b: any) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setSelectedBillId(b.id)}>
                    <TableCell className="font-medium">{b.bill_number}</TableCell>
                    <TableCell>{new Date(b.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{b.patient_name || "—"}</TableCell>
                    <TableCell>₹{Number(b.total_amount).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(b.discount).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">₹{Number(b.net_amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{b.payment_mode}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{b.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Detail Sheets */}
      <ProductDetailSheet
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        onClone={handleCloneProduct}
        onAddStock={(pid) => {
          setStockForm({ ...emptyStock, product_id: pid });
          setStockOpen(true);
        }}
      />
      <InventoryDetailSheet
        inventoryId={selectedInventoryId}
        onClose={() => setSelectedInventoryId(null)}
        onClone={handleCloneInventory}
        products={products}
      />
      <BillDetailSheet
        billId={selectedBillId}
        onClose={() => setSelectedBillId(null)}
        onClone={handleCloneBill}
      />
    </div>
  );
};

export default Pharma;
