import { useState, useRef } from "react";
import { Save, Building2, Clock, Users, Plus, Trash2, Loader2, Receipt, X, Pencil } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Settings = () => {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [rolePerms, setRolePerms] = useState("");
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxEditId, setTaxEditId] = useState<string | null>(null);
  const [taxName, setTaxName] = useState("");
  const [taxCgst, setTaxCgst] = useState<string>("");
  const [taxSgst, setTaxSgst] = useState<string>("");
  const [taxIgst, setTaxIgst] = useState<string>("");
  const [taxDesc, setTaxDesc] = useState("");
  const [taxProductIds, setTaxProductIds] = useState<string[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Clinic settings
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ["clinic-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_settings").select("*").limit(1).single();
      if (error && error.code !== "PGRST116") throw error;
      return data || { name: "", address: "", city: "", state: "", pincode: "", phone: "", email: "", logo_url: "", gst_number: "" };
    },
  });

  const [clinicForm, setClinicForm] = useState<any>(null);

  // Initialize form when data loads
  if (clinic && !clinicForm) {
    setClinicForm(clinic);
  }

  const updateClinicField = (field: string, value: string) => {
    setClinicForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveClinic = useMutation({
    mutationFn: async () => {
      if (!clinicForm) return;
      const hasId = clinic && 'id' in clinic;
      if (hasId) {
        const { error } = await supabase.from("clinic_settings").update(clinicForm).eq("id", (clinic as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_settings").insert(clinicForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-settings"] });
      toast.success("Clinic settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadLogo = async (file: File) => {
    const ext = file.name.split(".").pop();
    const fileName = `clinic-logo.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from("patient-photos")
      .upload(fileName, file, { upsert: true });
    if (uploadError) throw uploadError;

    const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/patient-photos/${fileName}`;
    updateClinicField("logo_url", logoUrl);
    toast.success("Logo uploaded");
  };

  // Working hours
  const { data: workingHours = [] } = useQuery({
    queryKey: ["working-hours"],
    queryFn: async () => {
      const { data, error } = await supabase.from("working_hours").select("*").order("day_of_week");
      if (error) throw error;
      return data;
    },
  });

  const updateHours = useMutation({
    mutationFn: async (hour: any) => {
      const { error } = await supabase.from("working_hours").update({
        is_open: hour.is_open,
        open_time: hour.open_time,
        close_time: hour.close_time,
        break_start: hour.break_start || null,
        break_end: hour.break_end || null,
      }).eq("id", hour.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      toast.success("Hours updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Staff roles
  const { data: roles = [] } = useQuery({
    queryKey: ["staff-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_roles").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createRole = useMutation({
    mutationFn: async () => {
      const perms = rolePerms.split(",").map((p) => p.trim()).filter(Boolean);
      const { error } = await supabase.from("staff_roles").insert({
        name: roleName,
        description: roleDesc || null,
        permissions: perms,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-roles"] });
      toast.success("Role created");
      setRoleName(""); setRoleDesc(""); setRolePerms(""); setRoleOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-roles"] });
      toast.success("Role deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Tax master
  const { data: taxes = [] } = useQuery({
    queryKey: ["tax-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_master")
        .select("*, tax_master_products(product_id, pharma_products(id, name))")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: pharmaProducts = [] } = useQuery({
    queryKey: ["pharma-products-for-tax"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharma_products")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const resetTaxForm = () => {
    setTaxEditId(null);
    setTaxName("");
    setTaxCgst("");
    setTaxSgst("");
    setTaxIgst("");
    setTaxDesc("");
    setTaxProductIds([]);
  };

  const openEditTax = (tax: any) => {
    setTaxEditId(tax.id);
    setTaxName(tax.name || "");
    setTaxCgst(tax.cgst != null ? String(tax.cgst) : "");
    setTaxSgst(tax.sgst != null ? String(tax.sgst) : "");
    setTaxIgst(tax.igst != null ? String(tax.igst) : "");
    setTaxDesc(tax.description || "");
    setTaxProductIds((tax.tax_master_products || []).map((l: any) => l.product_id).filter(Boolean));
    setTaxOpen(true);
  };

  const saveTax = useMutation({
    mutationFn: async () => {
      const cgst = parseFloat(taxCgst) || 0;
      const sgst = parseFloat(taxSgst) || 0;
      const igst = parseFloat(taxIgst) || 0;
      const payload = {
        name: taxName,
        cgst,
        sgst,
        igst,
        rate: cgst + sgst + igst,
        description: taxDesc || null,
      };
      let taxId = taxEditId;
      if (taxEditId) {
        const { error } = await supabase.from("tax_master").update(payload).eq("id", taxEditId);
        if (error) throw error;
        // Replace product links
        const { error: delErr } = await supabase.from("tax_master_products").delete().eq("tax_id", taxEditId);
        if (delErr) throw delErr;
      } else {
        const { data: inserted, error } = await supabase.from("tax_master").insert(payload).select().single();
        if (error) throw error;
        taxId = inserted.id;
      }
      if (taxId && taxProductIds.length > 0) {
        const links = taxProductIds.map((pid) => ({ tax_id: taxId!, product_id: pid }));
        const { error: linkErr } = await supabase.from("tax_master_products").insert(links);
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-master"] });
      toast.success(taxEditId ? "Tax rate updated" : "Tax rate created");
      resetTaxForm();
      setTaxOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTax = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("tax_master").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-master"] });
      toast.success("Tax updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTax = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_master").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-master"] });
      toast.success("Tax deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (clinicLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage clinic profile, working hours, and staff roles</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Clinic Profile</TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Working Hours</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Staff Roles</TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Tax Master</TabsTrigger>
        </TabsList>

        {/* Clinic Profile */}
        <TabsContent value="profile">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stat-card mt-4">
            {clinicForm && (
              <div className="space-y-6">
                {/* Logo */}
                <div className="flex items-start gap-6">
                  <div>
                    <Label>Clinic Logo</Label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadLogo(file);
                      }}
                    />
                    <div className="mt-2 flex items-center gap-4">
                      {clinicForm.logo_url ? (
                        <img src={clinicForm.logo_url} alt="Logo" className="h-20 w-20 rounded-lg object-cover border" />
                      ) : (
                        <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                        Upload Logo
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Name & GST */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Clinic Name *</Label>
                    <Input className="mt-1.5" value={clinicForm.name} onChange={(e) => updateClinicField("name", e.target.value)} />
                  </div>
                  <div>
                    <Label>GST Number</Label>
                    <Input className="mt-1.5" value={clinicForm.gst_number || ""} onChange={(e) => updateClinicField("gst_number", e.target.value)} placeholder="22AAAAA0000A1Z5" />
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input className="mt-1.5" value={clinicForm.phone || ""} onChange={(e) => updateClinicField("phone", e.target.value)} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" className="mt-1.5" value={clinicForm.email || ""} onChange={(e) => updateClinicField("email", e.target.value)} />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <Label>Address</Label>
                  <Textarea className="mt-1.5" rows={2} value={clinicForm.address || ""} onChange={(e) => updateClinicField("address", e.target.value)} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input className="mt-1.5" value={clinicForm.city || ""} onChange={(e) => updateClinicField("city", e.target.value)} />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input className="mt-1.5" value={clinicForm.state || ""} onChange={(e) => updateClinicField("state", e.target.value)} />
                  </div>
                  <div>
                    <Label>Pincode</Label>
                    <Input className="mt-1.5" value={clinicForm.pincode || ""} onChange={(e) => updateClinicField("pincode", e.target.value)} />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button className="gap-2" onClick={() => saveClinic.mutate()} disabled={saveClinic.isPending}>
                    <Save className="h-4 w-4" /> {saveClinic.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* Working Hours */}
        <TabsContent value="hours">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="data-table mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Day</TableHead>
                  <TableHead className="w-20">Open</TableHead>
                  <TableHead>Opening Time</TableHead>
                  <TableHead>Closing Time</TableHead>
                  <TableHead>Break Start</TableHead>
                  <TableHead>Break End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workingHours.map((hour: any) => (
                  <TableRow key={hour.id}>
                    <TableCell className="font-medium">{DAYS[hour.day_of_week]}</TableCell>
                    <TableCell>
                      <Switch
                        checked={hour.is_open}
                        onCheckedChange={(checked) => updateHours.mutate({ ...hour, is_open: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        className="w-28 h-8"
                        value={hour.open_time}
                        onChange={(e) => updateHours.mutate({ ...hour, open_time: e.target.value })}
                        disabled={!hour.is_open}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        className="w-28 h-8"
                        value={hour.close_time}
                        onChange={(e) => updateHours.mutate({ ...hour, close_time: e.target.value })}
                        disabled={!hour.is_open}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        className="w-28 h-8"
                        value={hour.break_start || ""}
                        onChange={(e) => updateHours.mutate({ ...hour, break_start: e.target.value || null })}
                        disabled={!hour.is_open}
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        className="w-28 h-8"
                        value={hour.break_end || ""}
                        onChange={(e) => updateHours.mutate({ ...hour, break_end: e.target.value || null })}
                        disabled={!hour.is_open}
                        placeholder="—"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        {/* Staff Roles */}
        <TabsContent value="roles">
          <div className="flex justify-end mt-4 mb-4">
            <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add Role</Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle className="font-display">New Staff Role</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Role Name *</Label>
                    <Input className="mt-1.5" placeholder="e.g. Lab Technician" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea className="mt-1.5" rows={2} value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label>Permissions (comma-separated)</Label>
                    <Input className="mt-1.5" placeholder="view_patients, billing" value={rolePerms} onChange={(e) => setRolePerms(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={() => createRole.mutate()} disabled={!roleName || createRole.isPending}>
                    {createRole.isPending ? "Creating..." : "Create Role"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role: any) => (
              <div key={role.id} className="stat-card relative group">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold">{role.name}</h3>
                    {role.description && <p className="text-sm text-muted-foreground mt-1">{role.description}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => deleteRole.mutate(role.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {(role.permissions || []).map((perm: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{perm}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Tax Master */}
        <TabsContent value="tax">
          <div className="flex justify-end mt-4 mb-4">
            <Dialog open={taxOpen} onOpenChange={(o) => { setTaxOpen(o); if (!o) resetTaxForm(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add Tax Rate</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-display">{taxEditId ? "Edit Tax Rate" : "New Tax Rate"}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Tax Name *</Label>
                    <Input className="mt-1.5" placeholder="e.g. GST 18%" value={taxName} onChange={(e) => setTaxName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>CGST (%)</Label>
                      <Input type="number" step="0.01" className="mt-1.5" placeholder="0" value={taxCgst} onChange={(e) => setTaxCgst(e.target.value)} />
                    </div>
                    <div>
                      <Label>SGST (%)</Label>
                      <Input type="number" step="0.01" className="mt-1.5" placeholder="0" value={taxSgst} onChange={(e) => setTaxSgst(e.target.value)} />
                    </div>
                    <div>
                      <Label>IGST (%)</Label>
                      <Input type="number" step="0.01" className="mt-1.5" placeholder="0" value={taxIgst} onChange={(e) => setTaxIgst(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">All tax fields are optional. Total: {((parseFloat(taxCgst) || 0) + (parseFloat(taxSgst) || 0) + (parseFloat(taxIgst) || 0)).toFixed(2)}%</p>
                  <div>
                    <Label>Description</Label>
                    <Input className="mt-1.5" placeholder="Optional description" value={taxDesc} onChange={(e) => setTaxDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label>Apply to Products</Label>
                    <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full mt-1.5 justify-between font-normal">
                          {taxProductIds.length > 0 ? `${taxProductIds.length} product(s) selected` : "Select products..."}
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
                                const checked = taxProductIds.includes(p.id);
                                return (
                                  <CommandItem
                                    key={p.id}
                                    value={p.name}
                                    onSelect={() => {
                                      setTaxProductIds((prev) => checked ? prev.filter((x) => x !== p.id) : [...prev, p.id]);
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
                    {taxProductIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {taxProductIds.map((pid) => {
                          const p = pharmaProducts.find((x: any) => x.id === pid);
                          if (!p) return null;
                          return (
                            <Badge key={pid} variant="secondary" className="gap-1">
                              {p.name}
                              <button onClick={() => setTaxProductIds((prev) => prev.filter((x) => x !== pid))}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Button className="w-full" onClick={() => saveTax.mutate()} disabled={!taxName || saveTax.isPending}>
                    {saveTax.isPending ? "Saving..." : taxEditId ? "Update Tax Rate" : "Create Tax Rate"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="data-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Name</TableHead>
                  <TableHead>CGST</TableHead>
                  <TableHead>SGST</TableHead>
                  <TableHead>IGST</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="w-20">Active</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxes.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tax rates defined</TableCell></TableRow>
                ) : taxes.map((tax: any) => {
                  const linkedProducts = (tax.tax_master_products || []).map((l: any) => l.pharma_products?.name).filter(Boolean);
                  return (
                    <TableRow key={tax.id}>
                      <TableCell className="font-medium">
                        {tax.name}
                        {tax.description && <div className="text-xs text-muted-foreground">{tax.description}</div>}
                      </TableCell>
                      <TableCell>{Number(tax.cgst || 0)}%</TableCell>
                      <TableCell>{Number(tax.sgst || 0)}%</TableCell>
                      <TableCell>{Number(tax.igst || 0)}%</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs">
                        {linkedProducts.length === 0 ? "—" : (
                          <div className="flex flex-wrap gap-1">
                            {linkedProducts.slice(0, 3).map((n: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{n}</Badge>)}
                            {linkedProducts.length > 3 && <Badge variant="outline" className="text-xs">+{linkedProducts.length - 3}</Badge>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={tax.is_active}
                          onCheckedChange={(checked) => toggleTax.mutate({ id: tax.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditTax(tax)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (confirm(`Delete tax rate "${tax.name}"? Existing invoices will keep their recorded tax amounts.`)) {
                                deleteTax.mutate(tax.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
