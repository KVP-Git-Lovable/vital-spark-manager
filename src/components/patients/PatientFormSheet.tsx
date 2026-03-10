import { useState, useEffect } from "react";
import { X } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

interface PatientFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
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
};

export function PatientFormSheet({ open, onOpenChange, patient, onSuccess }: PatientFormSheetProps) {
  const [form, setForm] = useState<TablesInsert<"patients">>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isEditing = !!patient;

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
      });
    } else {
      setForm(emptyForm);
    }
  }, [patient, open]);

  const updateField = (field: keyof typeof form, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "Error", description: "First and last name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEditing && patient) {
        const { error } = await supabase
          .from("patients")
          .update(form)
          .eq("id", patient.id);
        if (error) throw error;
        toast({ title: "Patient updated successfully" });
      } else {
        const { error } = await supabase.from("patients").insert(form);
        if (error) throw error;
        toast({ title: "Patient created successfully" });
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
            <TabsTrigger value="medical" className="text-xs">Medical</TabsTrigger>
            <TabsTrigger value="derma" className="text-xs">Dermatology</TabsTrigger>
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
                <Label>Last Name *</Label>
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

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={form.city || ""}
                  onChange={(e) => updateField("city", e.target.value)}
                  className="mt-1.5"
                />
              </div>
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
          </TabsContent>

          <TabsContent value="medical" className="space-y-4 mt-4">
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
