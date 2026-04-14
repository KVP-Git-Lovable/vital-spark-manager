import { useState } from "react";
import { Plus, Pencil, Trash2, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const emptyForm = { name: "", sub_unit_name: "", conversion_qty: 1, is_active: true };

const UnitMaster = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["unit-master-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unit_master").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Unit name is required");
      const payload = { ...form, conversion_qty: Number(form.conversion_qty) || 1 };
      if (editingId) {
        const { error } = await supabase.from("unit_master").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("unit_master").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-master-all"] });
      queryClient.invalidateQueries({ queryKey: ["unit-master"] });
      toast.success(editingId ? "Unit updated" : "Unit added");
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unit_master").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-master-all"] });
      queryClient.invalidateQueries({ queryKey: ["unit-master"] });
      toast.success("Unit deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setOpen(false); };

  const startEdit = (unit: any) => {
    setForm({ name: unit.name, sub_unit_name: unit.sub_unit_name || "", conversion_qty: unit.conversion_qty || 1, is_active: unit.is_active });
    setEditingId(unit.id);
    setOpen(true);
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Unit Master</h1>
          <p className="page-subtitle">Manage product units and conversions</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Unit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit Unit" : "Add Unit"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Unit Name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Strip" /></div>
              <div><Label>Sub-unit Name</Label><Input className="mt-1" value={form.sub_unit_name} onChange={(e) => setForm({ ...form, sub_unit_name: e.target.value })} placeholder="e.g. Tablet" /></div>
              <div><Label>Conversion Qty</Label><Input type="number" className="mt-1" value={form.conversion_qty} onChange={(e) => setForm({ ...form, conversion_qty: parseInt(e.target.value) || 1 })} placeholder="e.g. 10 (1 Strip = 10 Tablets)" /></div>
              {form.sub_unit_name && form.conversion_qty > 0 && (
                <p className="text-sm text-muted-foreground">1 {form.name || "Unit"} = {form.conversion_qty} {form.sub_unit_name}</p>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active</Label>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingId ? "Update Unit" : "Add Unit"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-base mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit Name</TableHead>
              <TableHead>Sub-unit</TableHead>
              <TableHead>Conversion</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : units.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No units added yet</TableCell></TableRow>
            ) : units.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.sub_unit_name || "—"}</TableCell>
                <TableCell>{u.sub_unit_name ? `1 ${u.name} = ${u.conversion_qty} ${u.sub_unit_name}` : "—"}</TableCell>
                <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(u)}><Pencil className="h-3 w-3" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="sm" variant="ghost"><Trash2 className="h-3 w-3 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete "{u.name}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(u.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UnitMaster;
