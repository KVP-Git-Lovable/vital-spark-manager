import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Users, User, Phone, Mail, Star, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const RELATIONSHIPS = [
  "Spouse", "Father", "Mother", "Son", "Daughter",
  "Brother", "Sister", "Grandfather", "Grandmother",
  "Uncle", "Aunt", "Cousin", "In-Law", "Other",
];

interface FamilyMembersProps {
  patientId: string;
  patientName: string;
}

export function FamilyMembers({ patientId, patientName }: FamilyMembersProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch family members
  const { data: familyMembers = [], isLoading } = useQuery({
    queryKey: ["family-members", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_family_members")
        .select("*, related_patient:patients!patient_family_members_related_patient_id_fkey(id, first_name, last_name, phone, email, gender, date_of_birth, status, city, facebook_url, instagram_url)")
        .eq("patient_id", patientId);
      if (error) throw error;

      // Also fetch reverse relationships
      const { data: reverseData, error: reverseError } = await supabase
        .from("patient_family_members")
        .select("*, related_patient:patients!patient_family_members_patient_id_fkey(id, first_name, last_name, phone, email, gender, date_of_birth, status, city, facebook_url, instagram_url)")
        .eq("related_patient_id", patientId);
      if (reverseError) throw reverseError;

      const reverseFormatted = (reverseData || []).map((r: any) => ({
        ...r,
        relationship: getInverseRelationship(r.relationship),
        _isReverse: true,
        related_patient: r.related_patient,
      }));

      return [...(data || []), ...reverseFormatted];
    },
    enabled: !!patientId,
  });

  // Search patients for adding
  const { data: searchResults = [] } = useQuery({
    queryKey: ["patient-search-family", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, city")
        .neq("id", patientId)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: search.length >= 2,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("patient_family_members").insert({
        patient_id: patientId,
        related_patient_id: selectedPatientId,
        relationship,
        is_primary_contact: isPrimary,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members", patientId] });
      toast.success("Family member added");
      resetForm();
      setAddOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patient_family_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members", patientId] });
      toast.success("Family member removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setSearch("");
    setSelectedPatientId("");
    setRelationship("");
    setIsPrimary(false);
    setNotes("");
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Family Members</h3>
          <Badge variant="secondary" className="text-xs">{familyMembers.length}</Badge>
        </div>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add Family Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Search Patient</Label>
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedPatientId(""); }}
                  placeholder="Type name or phone..."
                  className="mt-1.5"
                />
                {searchResults.length > 0 && !selectedPatientId && (
                  <div className="border rounded-lg mt-2 max-h-48 overflow-y-auto divide-y">
                    {searchResults.map((p: any) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3"
                        onClick={() => {
                          setSelectedPatientId(p.id);
                          setSearch(`${p.first_name} ${p.last_name}`);
                        }}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-muted-foreground">{p.phone || p.city || "—"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatientId && (
                  <p className="text-xs text-success mt-1">✓ Patient selected</p>
                )}
              </div>

              <div>
                <Label>Relationship</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="primary-contact"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="primary-contact" className="text-sm cursor-pointer">Primary contact person</Label>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                disabled={!selectedPatientId || !relationship || addMember.isPending}
                onClick={() => addMember.mutate()}
              >
                {addMember.isPending ? "Adding..." : "Add Family Member"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : familyMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No family members linked yet.</p>
          <p className="text-xs mt-1">Add existing patients as family members to build the family tree.</p>
        </div>
      ) : (
        <>
          {/* Org Tree View */}
          <div className="relative">
            {/* Current patient as root */}
            <div className="flex flex-col items-center mb-6">
              <div className="bg-primary/10 border-2 border-primary rounded-xl px-6 py-3 text-center">
                <p className="font-display font-bold text-primary">{patientName}</p>
                <p className="text-xs text-muted-foreground">Current Patient</p>
              </div>
              {familyMembers.length > 0 && (
                <div className="w-px h-6 bg-border" />
              )}
            </div>

            {/* Family members grid */}
            <div className="relative">
              {familyMembers.length > 1 && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border" style={{
                  width: `${Math.min(familyMembers.length * 200, 800)}px`,
                  maxWidth: '90%'
                }} />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AnimatePresence>
                  {familyMembers.map((member: any) => {
                    const rp = member.related_patient;
                    if (!rp) return null;
                    const isExpanded = expandedId === member.id;
                    const age = getAge(rp.date_of_birth);

                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="stat-card p-0 overflow-hidden"
                      >
                        {/* Connector line */}
                        <div className="flex justify-center">
                          <div className="w-px h-3 bg-border" />
                        </div>

                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className="h-10 w-10 rounded-full bg-accent/50 flex items-center justify-center text-sm font-bold text-foreground shrink-0 cursor-pointer hover:bg-accent transition-colors"
                              onClick={() => navigate(`/patients/${rp.id}`)}
                            >
                              {rp.first_name[0]}{rp.last_name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p
                                  className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => navigate(`/patients/${rp.id}`)}
                                >
                                  {rp.first_name} {rp.last_name}
                                </p>
                                {member.is_primary_contact && (
                                  <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />
                                )}
                              </div>
                              <Badge variant="outline" className="text-[10px] mt-1">
                                {member.relationship}
                              </Badge>
                            </div>
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : member.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </div>

                          {/* Quick info */}
                          <div className="flex gap-3 mt-2.5 text-xs text-muted-foreground">
                            {rp.gender && <span>{rp.gender}</span>}
                            {age !== null && <span>Age {age}</span>}
                            {rp.city && <span>{rp.city}</span>}
                          </div>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t space-y-2">
                                  {rp.phone && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Phone className="h-3 w-3 text-muted-foreground" />
                                      <span>{rp.phone}</span>
                                    </div>
                                  )}
                                  {rp.email && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Mail className="h-3 w-3 text-muted-foreground" />
                                      <span className="truncate">{rp.email}</span>
                                    </div>
                                  )}
                                  {member.notes && (
                                    <p className="text-xs text-muted-foreground italic">{member.notes}</p>
                                  )}
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7 flex-1"
                                      onClick={() => navigate(`/patients/${rp.id}`)}
                                    >
                                      <User className="h-3 w-3 mr-1" /> View Profile
                                    </Button>
                                    {!member._isReverse && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="outline" size="sm" className="text-xs h-7 text-destructive hover:text-destructive">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Remove family member?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will unlink {rp.first_name} {rp.last_name} from this patient's family. The patient record itself won't be affected.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => removeMember.mutate(member.id)}>
                                              Remove
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Status bar */}
                        <div className={`h-1 ${rp.status === 'Active' ? 'bg-success/40' : 'bg-muted'}`} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getInverseRelationship(rel: string): string {
  const inverses: Record<string, string> = {
    Father: "Son/Daughter",
    Mother: "Son/Daughter",
    Son: "Father/Mother",
    Daughter: "Father/Mother",
    Brother: "Brother/Sister",
    Sister: "Brother/Sister",
    Spouse: "Spouse",
    Grandfather: "Grandchild",
    Grandmother: "Grandchild",
    Uncle: "Nephew/Niece",
    Aunt: "Nephew/Niece",
    Cousin: "Cousin",
    "In-Law": "In-Law",
  };
  return inverses[rel] || rel;
}
