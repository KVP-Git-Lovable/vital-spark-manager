import { useState, useEffect, useMemo } from "react";
import { StaffCombobox } from "@/components/shared/StaffCombobox";
import { X, Search, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { fetchAll } from "@/lib/supabasePaginate";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

interface PatientFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
  defaultValues?: Partial<Patient> | null;
  onSuccess: () => void;
}

const emptyForm: TablesInsert<"patients"> = {
  first_name: "",
  last_name: "",
  date_of_birth: null,
  gender: null,
  phone: null,
  email: null,
  address: null,
  city: null,
  state: null,
  pincode: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  blood_group: null,
  medical_history: null,
  current_medications: null,
  allergies: null,
  skin_type: null,
  skin_concerns: null,
  previous_treatments: null,
  notes: null,
  status: "Active",
  facebook_url: null,
  instagram_url: null,
  follows_facebook: false,
  follows_instagram: false,
  source: "Walk-in",
  source_ad_details: null,
  source_referral_doctor: null,
};

export function PatientFormSheet({ open, onOpenChange, patient, defaultValues, onSuccess }: PatientFormSheetProps) {
  const [form, setForm] = useState<TablesInsert<"patients">>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [referralPatientSearch, setReferralPatientSearch] = useState("");
  const [referralPopoverOpen, setReferralPopoverOpen] = useState(false);
  const [selectedReferralPatientName, setSelectedReferralPatientName] = useState("");
  const [refDocOpen, setRefDocOpen] = useState(false);
  const [refDocSearch, setRefDocSearch] = useState("");
  const { toast } = useToast();
  const isEditing = !!patient;

  const { data: referralDoctors = [] } = useQuery({
    queryKey: ["referral-doctors-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, first_name, last_name, role, specialization")
        .in("role", ["Doctor", "Referral Doctor"])
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });
  const filteredRefDocs = useMemo(() => {
    const q = refDocSearch.toLowerCase();
    return referralDoctors.filter((s: any) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.specialization || "").toLowerCase().includes(q)
    );
  }, [referralDoctors, refDocSearch]);

  const { data: allPatients = [] } = useQuery({
    queryKey: ["patients-lookup"],
    queryFn: async () =>
      await fetchAll<any>((from, to) =>
        supabase
          .from("patients")
          .select("id, first_name, last_name")
          .order("first_name")
          .range(from, to)
      ),
  });


  useEffect(() => {
    if (patient) {
      setForm({
        first_name: patient.first_name,
        last_name: patient.last_name,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        city: patient.city,
        state: patient.state,
        pincode: patient.pincode,
        emergency_contact_name: patient.emergency_contact_name,
        emergency_contact_phone: patient.emergency_contact_phone,
        blood_group: patient.blood_group,
        medical_history: patient.medical_history,
        current_medications: patient.current_medications,
        allergies: patient.allergies,
        skin_type: patient.skin_type,
        skin_concerns: patient.skin_concerns,
        previous_treatments: patient.previous_treatments,
        notes: patient.notes,
        status: patient.status,
        facebook_url: (patient as any).facebook_url || null,
        instagram_url: (patient as any).instagram_url || null,
        follows_facebook: (patient as any).follows_facebook || false,
        follows_instagram: (patient as any).follows_instagram || false,
        source: (patient as any).source || "Walk-in",
        source_ad_details: (patient as any).source_ad_details || null,
        source_referral_doctor: (patient as any).source_referral_doctor || null,
        doctor_id: (patient as any).doctor_id || null,
      });
      // Set referral patient name if source is "Referred by Patient"
      if ((patient as any).source === "Referred by Patient" && (patient as any).source_referral_doctor) {
        const refPat = allPatients.find(p => p.id === (patient as any).source_referral_doctor);
        if (refPat) setSelectedReferralPatientName(`${refPat.first_name} ${refPat.last_name}`);
      }
    } else if (defaultValues) {
      setForm({
        ...emptyForm,
        first_name: defaultValues.first_name || "",
        last_name: defaultValues.last_name || "",
        phone: defaultValues.phone || null,
        email: defaultValues.email || null,
      });
    } else {
      setForm(emptyForm);
    }
  }, [patient, defaultValues, open, allPatients]);

  // Load existing campaign links when editing
  useEffect(() => {
    if (!open) {
      setSelectedCampaignIds([]);
      return;
    }
    if (patient) {
      (async () => {
        const { data } = await (supabase.from("patient_campaigns") as any)
          .select("campaign_id")
          .eq("patient_id", patient.id);
        setSelectedCampaignIds(((data as any[]) || []).map((r) => r.campaign_id));
      })();
    } else {
      setSelectedCampaignIds([]);
    }
  }, [patient, open]);

  const updateField = (field: keyof typeof form, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  };

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      toast({ title: "Error", description: "First name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let patientId: string | null = patient?.id || null;
      if (isEditing && patient) {
        const { error } = await supabase
          .from("patients")
          .update(form)
          .eq("id", patient.id);
        if (error) throw error;
        toast({ title: "Patient updated successfully" });
      } else {
        const { data: created, error } = await supabase.from("patients").insert(form).select("id").single();
        if (error) throw error;
        patientId = (created as any)?.id || null;
        toast({ title: "Patient created successfully" });
      }

      // Sync patient_campaigns links
      if (patientId) {
        const { data: existingLinks } = await (supabase.from("patient_campaigns") as any)
          .select("campaign_id")
          .eq("patient_id", patientId);
        const existing = new Set(((existingLinks as any[]) || []).map((r) => r.campaign_id));
        const desired = new Set(selectedCampaignIds);
        const toAdd = [...desired].filter((cid) => !existing.has(cid));
        const toRemove = [...existing].filter((cid) => !desired.has(cid));
        if (toAdd.length) {
          const { data: userRes } = await supabase.auth.getUser();
          const linkedBy = userRes?.user?.id || null;
          await (supabase.from("patient_campaigns") as any).insert(
            toAdd.map((cid) => ({ patient_id: patientId, campaign_id: cid, linked_by: linkedBy })),
          );
        }
        if (toRemove.length) {
          await (supabase.from("patient_campaigns") as any)
            .delete()
            .eq("patient_id", patientId)
            .in("campaign_id", toRemove);
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">
            {isEditing ? "Edit Patient" : "Add New Patient"}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="personal" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
            <TabsTrigger value="medical" className="text-xs">Medical</TabsTrigger>
            <TabsTrigger value="derma" className="text-xs">Derma</TabsTrigger>
            <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  placeholder="John"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  placeholder="Doe"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={form.date_of_birth || ""}
                  onChange={(e) => updateField("date_of_birth", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={form.gender || ""}
                  onValueChange={(v) => updateField("gender", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="patient@email.com"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Place</Label>
                <Input
                  value={form.city || ""}
                  onChange={(e) => updateField("city", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <Collapsible className="border rounded-md">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
                Additional Info
                <ChevronDown className="h-4 w-4 transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 space-y-4 border-t">
                <div>
                  <Label>Address</Label>
                  <Textarea
                    value={form.address || ""}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Street address"
                    className="mt-1.5"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>State</Label>
                    <Input
                      value={form.state || ""}
                      onChange={(e) => updateField("state", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Pincode</Label>
                    <Input
                      value={form.pincode || ""}
                      onChange={(e) => updateField("pincode", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Emergency Contact Name</Label>
                    <Input
                      value={form.emergency_contact_name || ""}
                      onChange={(e) => updateField("emergency_contact_name", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Emergency Contact Phone</Label>
                    <Input
                      value={form.emergency_contact_phone || ""}
                      onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status || "Active"}
                  onValueChange={(v) => updateField("status", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source</Label>
                <Select
                  value={(form as any).source || "Walk-in"}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, source: v, source_ad_details: v !== "Advertisement" ? null : (prev as any).source_ad_details, source_referral_doctor: (v !== "Dr. referral" && v !== "Referred by Patient") ? null : (prev as any).source_referral_doctor }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Walk-in">Walk-in</SelectItem>
                    <SelectItem value="Advertisement">Advertisement</SelectItem>
                    <SelectItem value="Dr. referral">Dr. referral</SelectItem>
                    <SelectItem value="Referred by Patient">Referred by Patient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form as any).source === "Advertisement" && (
              <div>
                <Label>Advertisement Details *</Label>
                <Input
                  value={(form as any).source_ad_details || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, source_ad_details: e.target.value || null }))}
                  placeholder="e.g. Google Ads, Facebook campaign, newspaper..."
                  className="mt-1.5"
                />
              </div>
            )}

            {(form as any).source === "Dr. referral" && (
              <div>
                <Label>Referred Doctor Name *</Label>
                <Popover open={refDocOpen} onOpenChange={setRefDocOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full mt-1.5 justify-between font-normal"
                    >
                      <span className="truncate">
                        {(form as any).source_referral_doctor || "Select referring doctor..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-2" align="start">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Search doctors..."
                        value={refDocSearch}
                        onChange={(e) => setRefDocSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {filteredRefDocs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          No doctors found. Add staff with role "Doctor" or "Referral Doctor".
                        </p>
                      ) : (
                        filteredRefDocs.map((s: any) => {
                          const name = `${s.first_name} ${s.last_name}`;
                          const selected = (form as any).source_referral_doctor === name;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              className={cn(
                                "w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2 hover:bg-accent",
                                selected && "bg-accent"
                              )}
                              onClick={() => {
                                setForm((prev) => ({ ...prev, source_referral_doctor: name }));
                                setRefDocOpen(false);
                                setRefDocSearch("");
                              }}
                            >
                              <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 min-w-0">
                                <p className="truncate">{name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {[s.role, s.specialization].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(form as any).source === "Referred by Patient" && (
              <div>
                <Label>Referring Patient *</Label>
                <Popover open={referralPopoverOpen} onOpenChange={setReferralPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1.5 justify-start font-normal">
                      {selectedReferralPatientName || "Select patient..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search patients..."
                        value={referralPatientSearch}
                        onChange={(e) => setReferralPatientSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {allPatients
                        .filter(p => patient ? p.id !== patient.id : true)
                        .filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(referralPatientSearch.toLowerCase()))
                        .slice(0, 20)
                        .map(p => (
                          <button
                            key={p.id}
                            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent"
                            onClick={() => {
                              setForm(prev => ({ ...prev, source_referral_doctor: p.id }));
                              setSelectedReferralPatientName(`${p.first_name} ${p.last_name}`);
                              setReferralPopoverOpen(false);
                              setReferralPatientSearch("");
                            }}
                          >
                            {p.first_name} {p.last_name}
                          </button>
                        ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <CampaignMultiSelectField
              value={selectedCampaignIds}
              onChange={setSelectedCampaignIds}
            />
          </TabsContent>

          <TabsContent value="medical" className="space-y-4 mt-4">
            <div>
              <Label>Doctor / Staff</Label>
              <div className="mt-1.5">
                <StaffCombobox
                  value={(form as any).doctor_id || ""}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, doctor_id: v || null }))}
                  placeholder="Select staff member"
                  allowNone
                  noneLabel="No staff assigned"
                />
              </div>
            </div>

            <div>
              <Label>Blood Group</Label>
              <Select
                value={form.blood_group || ""}
                onValueChange={(v) => updateField("blood_group", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Medical History</Label>
              <Textarea
                value={form.medical_history || ""}
                onChange={(e) => updateField("medical_history", e.target.value)}
                placeholder="Past surgeries, chronic conditions, hospitalizations..."
                className="mt-1.5"
                rows={4}
              />
            </div>

            <div>
              <Label>Current Medications</Label>
              <Textarea
                value={form.current_medications || ""}
                onChange={(e) => updateField("current_medications", e.target.value)}
                placeholder="List current medications and dosages..."
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div>
              <Label>Allergies</Label>
              <Textarea
                value={form.allergies || ""}
                onChange={(e) => updateField("allergies", e.target.value)}
                placeholder="Drug allergies, food allergies, latex, etc..."
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Textarea
                value={form.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Any other important notes..."
                className="mt-1.5"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="derma" className="space-y-4 mt-4">
            <div>
              <Label>Skin Type</Label>
              <Select
                value={form.skin_type || ""}
                onValueChange={(v) => updateField("skin_type", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select skin type" />
                </SelectTrigger>
                <SelectContent>
                  {["Normal", "Dry", "Oily", "Combination", "Sensitive"].map((st) => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Skin Concerns</Label>
              <Textarea
                value={form.skin_concerns || ""}
                onChange={(e) => updateField("skin_concerns", e.target.value)}
                placeholder="Acne, pigmentation, aging, scars, rosacea..."
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div>
              <Label>Previous Treatments</Label>
              <Textarea
                value={form.previous_treatments || ""}
                onChange={(e) => updateField("previous_treatments", e.target.value)}
                placeholder="Previous dermatological treatments received..."
                className="mt-1.5"
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-4 mt-4">
            <div>
              <Label>Facebook URL</Label>
              <Input
                value={(form as any).facebook_url || ""}
                onChange={(e) => updateField("facebook_url" as any, e.target.value)}
                placeholder="https://facebook.com/username"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Instagram URL</Label>
              <Input
                value={(form as any).instagram_url || ""}
                onChange={(e) => updateField("instagram_url" as any, e.target.value)}
                placeholder="https://instagram.com/username"
                className="mt-1.5"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="follows-fb"
                  checked={(form as any).follows_facebook || false}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, follows_facebook: !!checked }))}
                />
                <Label htmlFor="follows-fb" className="text-sm cursor-pointer">Follows us on Facebook</Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="follows-ig"
                  checked={(form as any).follows_instagram || false}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, follows_instagram: !!checked }))}
                />
                <Label htmlFor="follows-ig" className="text-sm cursor-pointer">Follows us on Instagram</Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update Patient" : "Create Patient"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CampaignMultiSelectField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-for-patient-form"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns" as any).select("id, name, status").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
  const filtered = campaigns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const selected = campaigns.filter((c) => value.includes(c.id));
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };
  return (
    <div>
      <Label>Campaigns</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between mt-1.5 h-auto min-h-10 py-2 font-normal">
            <span className="flex flex-wrap gap-1 text-left">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">Select campaigns...</span>
              ) : (
                selected.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-xs">
                    {c.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggle(c.id); }} />
                  </span>
                ))
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8" />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No campaigns</p>
            ) : filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left")}
                onClick={() => toggle(c.id)}
              >
                <Check className={cn("h-4 w-4", value.includes(c.id) ? "opacity-100" : "opacity-0")} />
                <span className="flex-1">{c.name}</span>
                {c.status !== "Active" && <span className="text-xs text-muted-foreground">({c.status})</span>}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
