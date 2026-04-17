import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, ChevronsUpDown, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TaxMasterForm = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cgst, setCgst] = useState("");
  const [sgst, setSgst] = useState("");
  const [igst, setIgst] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [originalProductIds, setOriginalProductIds] = useState<string[]>([]);
  const [originalRate, setOriginalRate] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [pickerSpecificOpen, setPickerSpecificOpen] = useState(false);
  const [selectedToUpdate, setSelectedToUpdate] = useState<string[]>([]);

  // Load existing tax
  const { data: existing, isLoading } = useQuery({
    queryKey: ["tax-master", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_master" as any)
        .select("*, tax_master_products(product_id, pharma_products(id, name))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // All products for picker
  const { data: pharmaProducts = [] } = useQuery({
    queryKey: ["pharma-products-for-tax"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name || "");
      setDescription(existing.description || "");
      setCgst(existing.cgst != null ? String(existing.cgst) : "");
      setSgst(existing.sgst != null ? String(existing.sgst) : "");
      setIgst(existing.igst != null ? String(existing.igst) : "");
      setIsActive(existing.is_active ?? true);
      const linked = (existing.tax_master_products || []).map((l: any) => l.product_id).filter(Boolean);
      setProductIds(linked);
      setOriginalProductIds(linked);
      setOriginalRate(Number(existing.rate || 0));
    }
  }, [existing]);

  const cgstNum = parseFloat(cgst) || 0;
  const sgstNum = parseFloat(sgst) || 0;
  const igstNum = parseFloat(igst) || 0;
  const totalRate = cgstNum + sgstNum + igstNum;
  const rateChanged = !isNew && Math.abs(totalRate - originalRate) > 0.001;

  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    pharmaProducts.forEach((p: any) => m.set(p.id, p.name));
    return m;
  }, [pharmaProducts]);

  const performSave = async (updateProductIds: string[] | null) => {
    setSaving(true);
    try {
      const payload: any = {
        name,
        cgst: cgstNum,
        sgst: sgstNum,
        igst: igstNum,
        rate: totalRate,
        description: description || null,
        is_active: isActive,
      };

      if (isNew) {
        const { data: inserted, error } = await supabase.from("tax_master" as any).insert(payload).select().single();
        if (error) throw error;
        const newTaxId = (inserted as any).id;
        if (productIds.length > 0) {
          const links = productIds.map((pid) => ({ tax_id: newTaxId, product_id: pid }));
          const { error: linkErr } = await supabase.from("tax_master_products" as any).insert(links);
          if (linkErr) throw linkErr;
          // Update product gst_percent
          await supabase.from("pharma_products").update({ gst_percent: totalRate }).in("id", productIds);
        }
        toast.success("Tax rate created");
      } else if (rateChanged && originalProductIds.length > 0 && updateProductIds !== null) {
        // Versioning: deactivate old, insert new, re-link selected products
        const { error: deactErr } = await supabase
          .from("tax_master" as any)
          .update({ is_active: false })
          .eq("id", id);
        if (deactErr) throw deactErr;

        const { data: inserted, error: insErr } = await supabase
          .from("tax_master" as any)
          .insert(payload)
          .select()
          .single();
        if (insErr) throw insErr;
        const newTaxId = (inserted as any).id;

        // Remaining products stay on old tax (already linked). Move selected to new tax.
        if (updateProductIds.length > 0) {
          // Remove old links for selected
          const { error: delErr } = await supabase
            .from("tax_master_products" as any)
            .delete()
            .eq("tax_id", id)
            .in("product_id", updateProductIds);
          if (delErr) throw delErr;
          // Insert new links
          const links = updateProductIds.map((pid) => ({ tax_id: newTaxId, product_id: pid }));
          const { error: linkErr } = await supabase.from("tax_master_products" as any).insert(links);
          if (linkErr) throw linkErr;
          // Update product gst_percent
          await supabase.from("pharma_products").update({ gst_percent: totalRate }).in("id", updateProductIds);
        }
        toast.success("New tax version created. Previous version archived.");
      } else {
        // Plain in-place update (no rate change OR no mapped products to worry about)
        const { error } = await supabase.from("tax_master" as any).update(payload).eq("id", id);
        if (error) throw error;
        // Sync product links
        const { error: delErr } = await supabase.from("tax_master_products" as any).delete().eq("tax_id", id);
        if (delErr) throw delErr;
        if (productIds.length > 0) {
          const links = productIds.map((pid) => ({ tax_id: id!, product_id: pid }));
          const { error: linkErr } = await supabase.from("tax_master_products" as any).insert(links);
          if (linkErr) throw linkErr;
          if (rateChanged) {
            await supabase.from("pharma_products").update({ gst_percent: totalRate }).in("id", productIds);
          }
        }
        toast.success("Tax rate updated");
      }

      queryClient.invalidateQueries({ queryKey: ["tax-master"] });
      queryClient.invalidateQueries({ queryKey: ["pharma-products-for-tax"] });
      navigate("/settings?tab=tax");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
      setWarningOpen(false);
      setPickerSpecificOpen(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Tax name is required");
      return;
    }
    // Show warning when editing existing tax with mapped products and rate changed
    if (!isNew && rateChanged && originalProductIds.length > 0) {
      setSelectedToUpdate(originalProductIds);
      setWarningOpen(true);
      return;
    }
    performSave(null);
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings?tab=tax")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-semibold truncate">
              {isNew ? "New Tax Rate" : "Edit Tax Rate"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Define tax components and map to pharmacy products
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-5">
            <div>
              <Label>Tax Name *</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. GST 18%"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1.5"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>CGST (%)</Label>
                <Input type="number" step="0.01" className="mt-1.5" placeholder="0" value={cgst} onChange={(e) => setCgst(e.target.value)} />
              </div>
              <div>
                <Label>SGST (%)</Label>
                <Input type="number" step="0.01" className="mt-1.5" placeholder="0" value={sgst} onChange={(e) => setSgst(e.target.value)} />
              </div>
              <div>
                <Label>IGST (%)</Label>
                <Input type="number" step="0.01" className="mt-1.5" placeholder="0" value={igst} onChange={(e) => setIgst(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Total Rate</span>
              <span className="text-lg font-semibold">{totalRate.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <Label className="cursor-pointer">Active</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Inactive rates are preserved for history</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>

        {/* Mapped products */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div>
              <h3 className="font-display font-semibold">Mapped Products</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Products that use this tax rate
              </p>
            </div>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {productIds.length > 0 ? `${productIds.length} product(s) selected` : "Add products..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search products..." />
                  <CommandList>
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {pharmaProducts.map((p: any) => {
                        const checked = productIds.includes(p.id);
                        return (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() => {
                              setProductIds((prev) => checked ? prev.filter((x) => x !== p.id) : [...prev, p.id]);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                            {p.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {productIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {productIds.map((pid) => (
                  <Badge key={pid} variant="secondary" className="gap-1">
                    {productMap.get(pid) || pid}
                    <button onClick={() => setProductIds((prev) => prev.filter((x) => x !== pid))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Versioning warning dialog */}
      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tax rate change detected</AlertDialogTitle>
            <AlertDialogDescription>
              This will affect all mapped products. The previous tax version will be archived; old invoices keep their original tax. Choose how to apply the new rate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setWarningOpen(false);
                setSelectedToUpdate(originalProductIds);
                setPickerSpecificOpen(true);
              }}
            >
              Update Specific
            </Button>
            <AlertDialogAction onClick={() => performSave(originalProductIds)}>
              Update All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Specific product checklist dialog */}
      <AlertDialog open={pickerSpecificOpen} onOpenChange={setPickerSpecificOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select products to update</AlertDialogTitle>
            <AlertDialogDescription>
              Only checked products will receive the new rate. Unchecked products remain on the previous (archived) rate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-2 py-2">
            {originalProductIds.map((pid) => {
              const checked = selectedToUpdate.includes(pid);
              return (
                <label
                  key={pid}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setSelectedToUpdate((prev) =>
                        v ? [...prev, pid] : prev.filter((x) => x !== pid)
                      );
                    }}
                  />
                  <span className="text-sm">{productMap.get(pid) || pid}</span>
                </label>
              );
            })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => performSave(selectedToUpdate)}>
              Apply to {selectedToUpdate.length} product(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaxMasterForm;
