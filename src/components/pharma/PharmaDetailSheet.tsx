import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Copy, Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Product Detail ──────────────────────────────────────
export function ProductDetailSheet({ productId, onClose, onClone }: { productId: string | null; onClose: () => void; onClone?: (product: any) => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [priceForm, setPriceForm] = useState({ mrp: 0, selling_price: 0, purchase_price: 0, gst_percent: 0, notes: "" });
  const [showPriceForm, setShowPriceForm] = useState(false);

  const { data: product } = useQuery({
    queryKey: ["pharma-product", productId],
    queryFn: async () => {
      if (!productId) return null;
      const { data, error } = await supabase.from("pharma_products").select("*").eq("id", productId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["product-prices", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase.from("product_prices").select("*").eq("product_id", productId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (product) setForm({ ...product });
  }, [product]);

  const updateProduct = useMutation({
    mutationFn: async () => {
      const { id, created_at, updated_at, ...rest } = form;
      const { error } = await supabase.from("pharma_products").update(rest).eq("id", productId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-products"] });
      queryClient.invalidateQueries({ queryKey: ["pharma-product", productId] });
      toast.success("Product updated");
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pharma_products").delete().eq("id", productId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-products"] });
      toast.success("Product deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPrice = useMutation({
    mutationFn: async () => {
      // Deactivate existing active prices
      await supabase.from("product_prices").update({ is_active: false, effective_to: new Date().toISOString() }).eq("product_id", productId!).eq("is_active", true);
      // Insert new active price
      const { error } = await supabase.from("product_prices").insert({
        product_id: productId!,
        ...priceForm,
        is_active: true,
      });
      if (error) throw error;
      // Update the product's current MRP and selling_price
      await supabase.from("pharma_products").update({
        mrp: priceForm.mrp,
        selling_price: priceForm.selling_price,
      }).eq("id", productId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-prices", productId] });
      queryClient.invalidateQueries({ queryKey: ["pharma-products"] });
      queryClient.invalidateQueries({ queryKey: ["pharma-product", productId] });
      toast.success("Price updated — previous prices preserved");
      setShowPriceForm(false);
      setPriceForm({ mrp: 0, selling_price: 0, purchase_price: 0, notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!product) return null;

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );

  return (
    <>
      <Sheet open={!!productId} onOpenChange={() => onClose()}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display flex items-center justify-between pr-8">
              {isEditing ? "Edit Product" : product.name}
            </SheetTitle>
          </SheetHeader>

          {!isEditing ? (
            <div className="mt-4 space-y-6">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => { onClone?.(product); onClose(); }}><Copy className="h-3 w-3 mr-1" />Clone</Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
              </div>

              {/* Product Image */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Product Image</p>
                {(product as any).image_url ? (
                  <div className="relative group">
                    <img src={(product as any).image_url} alt={product.name} className="w-full h-40 object-cover rounded-lg border" />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer">
                      <span className="text-white text-xs font-medium">Change Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split(".").pop();
                        const path = `${productId}/${Date.now()}.${ext}`;
                        const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file);
                        if (uploadErr) { toast.error("Upload failed"); return; }
                        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
                        await supabase.from("pharma_products").update({ image_url: urlData.publicUrl } as any).eq("id", productId!);
                        queryClient.invalidateQueries({ queryKey: ["pharma-product", productId] });
                        queryClient.invalidateQueries({ queryKey: ["pharma-products"] });
                        toast.success("Image updated");
                      }} />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Plus className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Upload product image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = file.name.split(".").pop();
                      const path = `${productId}/${Date.now()}.${ext}`;
                      const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file);
                      if (uploadErr) { toast.error("Upload failed"); return; }
                      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
                      await supabase.from("pharma_products").update({ image_url: urlData.publicUrl } as any).eq("id", productId!);
                      queryClient.invalidateQueries({ queryKey: ["pharma-product", productId] });
                      queryClient.invalidateQueries({ queryKey: ["pharma-products"] });
                      toast.success("Image uploaded");
                    }} />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Name" value={product.name} />
                <Field label="Generic Name" value={product.generic_name} />
                <Field label="Category" value={product.category} />
                <Field label="Unit" value={product.unit} />
                <Field label="Manufacturer" value={product.manufacturer} />
                <Field label="HSN Code" value={product.hsn_code} />
                <Field label="GST %" value={`${product.gst_percent}%`} />
                <Field label="Reorder Level" value={product.reorder_level} />
                <Field label="Current MRP" value={`₹${Number(product.mrp).toFixed(2)}`} />
                <Field label="Current Selling Price" value={`₹${Number(product.selling_price).toFixed(2)}`} />
              </div>

              <Separator />

              {/* Price History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-sm">Price History</h3>
                  <Button size="sm" variant="outline" onClick={() => {
                    setPriceForm({ mrp: Number(product.mrp), selling_price: Number(product.selling_price), purchase_price: 0, notes: "" });
                    setShowPriceForm(true);
                  }}><Plus className="h-3 w-3 mr-1" />New Price</Button>
                </div>

                {showPriceForm && (
                  <div className="border rounded-lg p-3 mb-3 bg-muted/30 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">MRP (₹)</Label><Input type="number" className="mt-1 h-8" value={priceForm.mrp} onChange={(e) => setPriceForm({ ...priceForm, mrp: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">Sell Price (₹)</Label><Input type="number" className="mt-1 h-8" value={priceForm.selling_price} onChange={(e) => setPriceForm({ ...priceForm, selling_price: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">Buy Price (₹)</Label><Input type="number" className="mt-1 h-8" value={priceForm.purchase_price} onChange={(e) => setPriceForm({ ...priceForm, purchase_price: parseFloat(e.target.value) || 0 })} /></div>
                    </div>
                    <div><Label className="text-xs">Notes</Label><Input className="mt-1 h-8" value={priceForm.notes} onChange={(e) => setPriceForm({ ...priceForm, notes: e.target.value })} placeholder="Reason for price change" /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => addPrice.mutate()} disabled={addPrice.isPending}><Check className="h-3 w-3 mr-1" />{addPrice.isPending ? "Saving..." : "Save & Activate"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowPriceForm(false)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                    </div>
                  </div>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">MRP</TableHead>
                      <TableHead className="text-xs">Sell</TableHead>
                      <TableHead className="text-xs">Buy</TableHead>
                      <TableHead className="text-xs">From</TableHead>
                      <TableHead className="text-xs">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">No price history — add a new price to start tracking</TableCell></TableRow>
                    ) : prices.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.is_active ? <Badge className="bg-success/20 text-success border-success/30 text-xs">Active</Badge> : <Badge variant="secondary" className="text-xs">Inactive</Badge>}</TableCell>
                        <TableCell className="text-xs">₹{Number(p.mrp).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">₹{Number(p.selling_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">₹{Number(p.purchase_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{format(new Date(p.effective_from), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input className="mt-1" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Generic Name</Label><Input className="mt-1" value={form.generic_name || ""} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Category</Label><Input className="mt-1" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div><Label>Unit</Label><Input className="mt-1" value={form.unit || ""} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div><Label>Manufacturer</Label><Input className="mt-1" value={form.manufacturer || ""} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>HSN Code</Label><Input className="mt-1" value={form.hsn_code || ""} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} /></div>
                <div><Label>GST %</Label><Input type="number" className="mt-1" value={form.gst_percent || 0} onChange={(e) => setForm({ ...form, gst_percent: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Reorder Level</Label><Input type="number" className="mt-1" value={form.reorder_level || 10} onChange={(e) => setForm({ ...form, reorder_level: parseInt(e.target.value) || 10 })} /></div>
              </div>
              <p className="text-xs text-muted-foreground italic">Note: To change MRP or Selling Price, use "New Price" in view mode to preserve price history.</p>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => updateProduct.mutate()} disabled={updateProduct.isPending}>{updateProduct.isPending ? "Saving..." : "Save"}</Button>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this product and its price history. Continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteProduct.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Inventory Detail ────────────────────────────────────
export function InventoryDetailSheet({ inventoryId, onClose, onClone, products }: { inventoryId: string | null; onClose: () => void; onClone?: (inv: any) => void; products: any[] }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: record } = useQuery({
    queryKey: ["pharma-inv-detail", inventoryId],
    queryFn: async () => {
      if (!inventoryId) return null;
      const { data, error } = await supabase.from("pharma_inventory").select("*, pharma_products(name)").eq("id", inventoryId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!inventoryId,
  });

  useEffect(() => {
    if (record) setForm({ ...record });
  }, [record]);

  const updateInv = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pharma_inventory").update({
        product_id: form.product_id,
        batch_number: form.batch_number,
        expiry_date: form.expiry_date,
        quantity: Number(form.quantity),
        purchase_price: Number(form.purchase_price),
        supplier: form.supplier,
        invoice_number: form.invoice_number,
      }).eq("id", inventoryId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pharma-inv-detail", inventoryId] });
      toast.success("Inventory updated");
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInv = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pharma_inventory").delete().eq("id", inventoryId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-inventory"] });
      toast.success("Inventory record deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!record) return null;

  const exp = new Date(record.expiry_date);
  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>
  );

  return (
    <>
      <Sheet open={!!inventoryId} onOpenChange={() => onClose()}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{isEditing ? "Edit Inventory" : (record as any).pharma_products?.name || "Inventory"}</SheetTitle>
          </SheetHeader>

          {!isEditing ? (
            <div className="mt-4 space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => { onClone?.(record); onClose(); }}><Copy className="h-3 w-3 mr-1" />Clone</Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Product" value={(record as any).pharma_products?.name} />
                <Field label="Batch Number" value={record.batch_number} />
                <Field label="Quantity" value={record.quantity} />
                <Field label="Purchase Price" value={`₹${Number(record.purchase_price).toFixed(2)}`} />
                <Field label="Expiry Date" value={format(exp, "dd MMM yyyy")} />
                <Field label="Days to Expiry" value={daysLeft <= 0 ? "Expired" : `${daysLeft} days`} />
                <Field label="Supplier" value={record.supplier} />
                <Field label="Invoice No." value={record.invoice_number} />
                <Field label="Received Date" value={format(new Date(record.received_date), "dd MMM yyyy")} />
              </div>
              {daysLeft <= 0 && <Badge variant="destructive">Expired</Badge>}
              {daysLeft > 0 && daysLeft <= 90 && <Badge className="bg-warning/20 text-warning border-warning/30">Expiring Soon</Badge>}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <Label>Product *</Label>
                <Select value={form.product_id || ""} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Batch No. *</Label><Input className="mt-1" value={form.batch_number || ""} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></div>
                <div><Label>Expiry Date *</Label><Input type="date" className="mt-1" value={form.expiry_date || ""} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Quantity *</Label><Input type="number" className="mt-1" value={form.quantity || 0} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>Purchase Price (₹)</Label><Input type="number" className="mt-1" value={form.purchase_price || 0} onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Supplier</Label><Input className="mt-1" value={form.supplier || ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
                <div><Label>Invoice No.</Label><Input className="mt-1" value={form.invoice_number || ""} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => updateInv.mutate()} disabled={updateInv.isPending}>{updateInv.isPending ? "Saving..." : "Save"}</Button>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Inventory Record</AlertDialogTitle><AlertDialogDescription>This will permanently delete this inventory record. Continue?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteInv.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Bill Detail ─────────────────────────────────────────
export function BillDetailSheet({ billId, onClose, onClone }: { billId: string | null; onClose: () => void; onClone?: (bill: any) => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: bill } = useQuery({
    queryKey: ["pharma-bill-detail", billId],
    queryFn: async () => {
      if (!billId) return null;
      const { data, error } = await supabase.from("pharma_bills").select("*").eq("id", billId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!billId,
  });

  const { data: billItems = [] } = useQuery({
    queryKey: ["pharma-bill-items", billId],
    queryFn: async () => {
      if (!billId) return [];
      const { data, error } = await supabase.from("pharma_bill_items").select("*").eq("bill_id", billId);
      if (error) throw error;
      return data;
    },
    enabled: !!billId,
  });

  useEffect(() => {
    if (bill) setForm({ ...bill });
  }, [bill]);

  const updateBill = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pharma_bills").update({
        patient_name: form.patient_name,
        payment_mode: form.payment_mode,
        discount: Number(form.discount),
        status: form.status,
      }).eq("id", billId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-bills"] });
      queryClient.invalidateQueries({ queryKey: ["pharma-bill-detail", billId] });
      toast.success("Bill updated");
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBill = useMutation({
    mutationFn: async () => {
      // Delete items first — no cascade set
      await supabase.from("pharma_bill_items").delete().eq("bill_id", billId!);
      const { error } = await supabase.from("pharma_bills").delete().eq("id", billId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharma-bills"] });
      toast.success("Bill deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!bill) return null;

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>
  );

  return (
    <>
      <Sheet open={!!billId} onOpenChange={() => onClose()}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{isEditing ? "Edit Bill" : `Bill ${bill.bill_number}`}</SheetTitle>
          </SheetHeader>

          {!isEditing ? (
            <div className="mt-4 space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => { onClone?.(bill); onClose(); }}><Copy className="h-3 w-3 mr-1" />Clone</Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bill Number" value={bill.bill_number} />
                <Field label="Date" value={format(new Date(bill.created_at), "dd MMM yyyy, hh:mm a")} />
                <Field label="Patient" value={bill.patient_name} />
                <Field label="Payment Mode" value={bill.payment_mode} />
                <Field label="Status" value={bill.status} />
                <Field label="Total" value={`₹${Number(bill.total_amount).toFixed(2)}`} />
                <Field label="Discount" value={`₹${Number(bill.discount).toFixed(2)}`} />
                <Field label="Tax" value={bill.tax_rate ? `${bill.tax_rate}% (₹${Number(bill.tax_amount).toFixed(2)})` : "—"} />
                <Field label="Net Amount" value={`₹${Number(bill.net_amount).toFixed(2)}`} />
              </div>

              <Separator />

              <div>
                <h3 className="font-display font-semibold text-sm mb-2">Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">Batch</TableHead>
                      <TableHead className="text-xs">Qty</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">{item.product_name}</TableCell>
                        <TableCell className="text-xs">{item.batch_number || "—"}</TableCell>
                        <TableCell className="text-xs">{item.quantity}</TableCell>
                        <TableCell className="text-xs">₹{Number(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs font-medium">₹{Number(item.total_price).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Patient Name</Label><Input className="mt-1" value={form.patient_name || ""} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} /></div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={form.payment_mode || "Cash"} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Cash", "Card", "UPI", "Insurance"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Discount (₹)</Label><Input type="number" className="mt-1" value={form.discount || 0} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status || "Paid"} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Paid", "Pending", "Cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => updateBill.mutate()} disabled={updateBill.isPending}>{updateBill.isPending ? "Saving..." : "Save"}</Button>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Bill</AlertDialogTitle><AlertDialogDescription>This will permanently delete this bill and all its items. Continue?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteBill.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
