import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Plus, Save, Search, UserPlus } from "lucide-react";
import CreateUserDialog from "@/components/users/CreateUserDialog";

const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "patients", label: "Patients" },
  { key: "appointments", label: "Appointments" },
  { key: "procedures", label: "Procedures" },
  { key: "photos", label: "Photos" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "billing", label: "Billing" },
  { key: "leave", label: "Leave" },
  { key: "assets", label: "Assets" },
  { key: "portal_orders", label: "Portal Orders" },
  { key: "expenses", label: "Expenses" },
  { key: "staff", label: "Staff" },
  { key: "problem_areas", label: "Problem Areas" },
  { key: "reports", label: "Reports" },
  { key: "report_builder", label: "Report Builder" },
  { key: "surveys", label: "Surveys" },
  { key: "services", label: "Services" },
  { key: "vendors", label: "Vendors" },
  { key: "unit_master", label: "Unit Master" },
  { key: "category_master", label: "Category Master" },
  { key: "settings", label: "Settings" },
  { key: "user_management", label: "User Management" },
];

type PermMap = Record<string, { can_view: boolean; can_edit: boolean }>;

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [dirtyPerms, setDirtyPerms] = useState<PermMap | null>(null);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // Fetch roles
  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles-config"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles_config").select("*").order("created_at");
      return data || [];
    },
  });

  // Fetch staff with role
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-with-roles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff")
        .select("id, first_name, last_name, email, phone, is_active, role_id, user_roles_config(id, name)")
        .order("first_name");
      return (data || []).map((s: any) => ({
        ...s,
        name: `${s.first_name} ${s.last_name}`.trim(),
        status: s.is_active ? "Active" : "Inactive",
      }));
    },
  });

  // Fetch permissions for selected role
  const { data: permissions = [] } = useQuery({
    queryKey: ["role-permissions", selectedRoleId],
    queryFn: async () => {
      if (!selectedRoleId) return [];
      const { data } = await supabase
        .from("role_module_permissions")
        .select("*")
        .eq("role_id", selectedRoleId);
      return data || [];
    },
    enabled: !!selectedRoleId,
  });

  // Set initial selected role
  if (roles.length > 0 && !selectedRoleId) {
    setSelectedRoleId(roles[0].id);
  }

  // Build perm map
  const permMap: PermMap = dirtyPerms ?? Object.fromEntries(
    ALL_MODULES.map((m) => {
      const p = permissions.find((p: any) => p.module_key === m.key);
      return [m.key, { can_view: p?.can_view ?? false, can_edit: p?.can_edit ?? false }];
    })
  );

  // Assign role mutation
  const assignRole = useMutation({
    mutationFn: async ({ staffId, roleId }: { staffId: string; roleId: string | null }) => {
      const { error } = await supabase.from("staff").update({ role_id: roleId } as any).eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-with-roles"] });
      toast({ title: "Role assigned successfully" });
    },
  });

  // Save permissions mutation
  const savePerms = useMutation({
    mutationFn: async () => {
      if (!dirtyPerms || !selectedRoleId) return;
      // Delete existing then re-insert
      await supabase.from("role_module_permissions").delete().eq("role_id", selectedRoleId);
      const rows = ALL_MODULES.map((m) => ({
        role_id: selectedRoleId,
        module_key: m.key,
        can_view: dirtyPerms[m.key]?.can_view ?? false,
        can_edit: dirtyPerms[m.key]?.can_edit ?? false,
      }));
      const { error } = await supabase.from("role_module_permissions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirtyPerms(null);
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast({ title: "Permissions saved" });
    },
  });

  // Add role mutation
  const addRole = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("user_roles_config")
        .insert({ name: newRoleName, description: newRoleDesc || null, is_system: false })
        .select()
        .single();
      if (error) throw error;
      // Insert all modules with false/false
      const rows = ALL_MODULES.map((m) => ({
        role_id: data.id,
        module_key: m.key,
        can_view: false,
        can_edit: false,
      }));
      await supabase.from("role_module_permissions").insert(rows);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-roles-config"] });
      setSelectedRoleId(data.id);
      setAddRoleOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      toast({ title: "Role created" });
    },
  });

  const togglePerm = (moduleKey: string, field: "can_view" | "can_edit") => {
    const current = dirtyPerms ?? { ...permMap };
    const mod = current[moduleKey] ?? { can_view: false, can_edit: false };
    const updated = { ...mod, [field]: !mod[field] };
    // If turning off view, also turn off edit
    if (field === "can_view" && !updated.can_view) updated.can_edit = false;
    // If turning on edit, also turn on view
    if (field === "can_edit" && updated.can_edit) updated.can_view = true;
    setDirtyPerms({ ...current, [moduleKey]: updated });
  };

  const filteredStaff = staff.filter((s: any) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedRole = roles.find((r: any) => r.id === selectedRoleId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold font-display">User Management</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Staff Users</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.email || "—"}</TableCell>
                      <TableCell>{s.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "Active" ? "default" : "secondary"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={s.role_id || "none"}
                          onValueChange={(v) =>
                            assignRole.mutate({ staffId: s.id, roleId: v === "none" ? null : v })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Assign role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Role</SelectItem>
                            {roles.map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStaff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No staff found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Select value={selectedRoleId} onValueChange={(v) => { setSelectedRoleId(v); setDirtyPerms(null); }}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRole?.is_system && (
                    <Badge variant="outline" className="text-xs">System Role</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Add Role</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add New Role</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>Role Name</Label>
                          <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Nurse" />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Optional description" />
                        </div>
                        <Button onClick={() => addRole.mutate()} disabled={!newRoleName.trim()}>
                          Create Role
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {dirtyPerms && (
                    <Button size="sm" onClick={() => savePerms.mutate()}>
                      <Save className="h-4 w-4 mr-1" />Save Permissions
                    </Button>
                  )}
                </div>
              </div>
              {selectedRole?.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedRole.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-center w-24">View</TableHead>
                    <TableHead className="text-center w-24">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_MODULES.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell>{m.label}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permMap[m.key]?.can_view ?? false}
                          onCheckedChange={() => togglePerm(m.key, "can_view")}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permMap[m.key]?.can_edit ?? false}
                          onCheckedChange={() => togglePerm(m.key, "can_edit")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
