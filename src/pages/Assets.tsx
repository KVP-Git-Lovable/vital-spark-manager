import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Package, Plus, Search, Building2, AlertTriangle, Link2 } from "lucide-react";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";
import { VendorFormDialog } from "@/components/assets/VendorFormDialog";
import { IssueFormDialog } from "@/components/assets/IssueFormDialog";
import { AssetDetailSheet } from "@/components/assets/AssetDetailSheet";

const ASSET_CATEGORIES = ["Equipment", "Furniture", "IT", "Medical Device", "Consumable", "Vehicle", "Other"];

const Assets = () => {
  const [search, setSearch] = useState("");
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [issueFormOpen, setIssueFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*, vendor:vendors!assets_vendor_id_fkey(name), amc_vendor:vendors!assets_amc_vendor_id_fkey(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["asset-issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_issues")
        .select("*, asset:assets(name, asset_code), vendor:vendors(name)")
        .order("reported_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredAssets = assets.filter((a: any) =>
    `${a.name} ${a.asset_code} ${a.category} ${a.manufacturer}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVendors = vendors.filter((v: any) =>
    `${v.name} ${v.contact_person} ${v.category}`.toLowerCase().includes(search.toLowerCase())
  );

  const isWarrantyActive = (endDate: string | null) => {
    if (!endDate) return false;
    return new Date(endDate) > new Date();
  };

  const isAmcActive = (endDate: string | null) => {
    if (!endDate) return false;
    return new Date(endDate) > new Date();
  };

  const statusColors: Record<string, string> = {
    Active: "bg-success/10 text-success",
    "Under Repair": "bg-warning/10 text-warning",
    Retired: "bg-muted text-muted-foreground",
    Disposed: "bg-destructive/10 text-destructive",
  };

  const priorityColors: Record<string, string> = {
    Low: "bg-muted text-muted-foreground",
    Medium: "bg-warning/10 text-warning",
    High: "bg-destructive/10 text-destructive",
    Critical: "bg-destructive text-destructive-foreground",
  };

  const issueStatusColors: Record<string, string> = {
    Open: "bg-destructive/10 text-destructive",
    "In Progress": "bg-warning/10 text-warning",
    Resolved: "bg-success/10 text-success",
    Closed: "bg-muted text-muted-foreground",
  };

  const openIssuesCount = issues.filter((i: any) => i.status === "Open" || i.status === "In Progress").length;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Package className="h-6 w-6" /> Asset Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track clinic assets, vendors, warranties, AMC and issues
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="assets" className="mt-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="assets" className="gap-1.5">
              <Package className="h-3.5 w-3.5" /> Assets ({assets.length})
            </TabsTrigger>
            <TabsTrigger value="vendors" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Vendors ({vendors.length})
            </TabsTrigger>
            <TabsTrigger value="issues" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Issues ({openIssuesCount} open)
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 w-64"
              />
            </div>
          </div>
        </div>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="gap-1.5" onClick={() => setAssetFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Asset
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="stat-card p-4">
              <p className="text-xs text-muted-foreground">Total Assets</p>
              <p className="text-2xl font-display font-bold mt-1">{assets.length}</p>
            </div>
            <div className="stat-card p-4">
              <p className="text-xs text-muted-foreground">In Warranty</p>
              <p className="text-2xl font-display font-bold text-success mt-1">
                {assets.filter((a: any) => isWarrantyActive(a.warranty_end_date)).length}
              </p>
            </div>
            <div className="stat-card p-4">
              <p className="text-xs text-muted-foreground">Active AMC</p>
              <p className="text-2xl font-display font-bold text-primary mt-1">
                {assets.filter((a: any) => isAmcActive(a.amc_end_date)).length}
              </p>
            </div>
            <div className="stat-card p-4">
              <p className="text-xs text-muted-foreground">Open Issues</p>
              <p className="text-2xl font-display font-bold text-destructive mt-1">{openIssuesCount}</p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="data-table">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Asset</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Category</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Vendor</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Warranty</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">AMC</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAssets.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No assets found</td></tr>
                ) : filteredAssets.map((asset: any) => (
                  <tr
                    key={asset.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedAsset(asset); setDetailOpen(true); }}
                  >
                    <td className="p-4">
                      <p className="font-medium text-sm">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.asset_code || asset.serial_number || "—"}</p>
                    </td>
                    <td className="p-4"><Badge variant="outline" className="text-xs">{asset.category}</Badge></td>
                    <td className="p-4 text-sm text-muted-foreground">{asset.vendor?.name || "—"}</td>
                    <td className="p-4">
                      {asset.warranty_end_date ? (
                        <Badge className={`text-[10px] ${isWarrantyActive(asset.warranty_end_date) ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {isWarrantyActive(asset.warranty_end_date) ? "Active" : "Expired"}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4">
                      {asset.amc_end_date ? (
                        <Badge className={`text-[10px] ${isAmcActive(asset.amc_end_date) ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                          {isAmcActive(asset.amc_end_date) ? "Active" : "Expired"}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[asset.status] || ""}`}>
                        {asset.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="gap-1.5" onClick={() => setVendorFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Vendor
            </Button>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="data-table">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Vendor</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Contact Person</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Phone</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">City</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Category</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVendors.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No vendors found</td></tr>
                ) : filteredVendors.map((v: any) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-sm">{v.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.contact_person || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.phone || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.email || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.city || "—"}</td>
                    <td className="p-4"><Badge variant="outline" className="text-xs">{v.category}</Badge></td>
                    <td className="p-4">
                      <Badge className={`text-[10px] ${v.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {v.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="gap-1.5" onClick={() => setIssueFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Report Issue
            </Button>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="data-table">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Issue</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Asset</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Priority</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Reported</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Vendor</th>
                  <th className="text-right text-xs font-medium text-muted-foreground p-4">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {issues.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No issues reported</td></tr>
                ) : issues.map((issue: any) => (
                  <tr key={issue.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-sm">{issue.title}</p>
                      {issue.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{issue.description}</p>}
                    </td>
                    <td className="p-4 text-sm">
                      <p>{issue.asset?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{issue.asset?.asset_code || ""}</p>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityColors[issue.priority] || ""}`}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${issueStatusColors[issue.status] || ""}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(issue.reported_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{issue.vendor?.name || "—"}</td>
                    <td className="p-4 text-right text-sm font-medium">
                      {issue.cost > 0 ? `₹${Number(issue.cost).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </TabsContent>
      </Tabs>

      <AssetFormDialog open={assetFormOpen} onOpenChange={setAssetFormOpen} vendors={vendors} />
      <VendorFormDialog open={vendorFormOpen} onOpenChange={setVendorFormOpen} />
      <IssueFormDialog open={issueFormOpen} onOpenChange={setIssueFormOpen} assets={assets} vendors={vendors} />
      {selectedAsset && (
        <AssetDetailSheet open={detailOpen} onOpenChange={setDetailOpen} asset={selectedAsset} vendors={vendors} />
      )}
    </div>
  );
};

export default Assets;
