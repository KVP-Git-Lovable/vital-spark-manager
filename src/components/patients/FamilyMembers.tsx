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
import { Plus, Trash2, Users, Star, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
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
  const [addOpen, setAddOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch family members (direct + reverse)
  const { data: familyMembers = [], isLoading } = useQuery({
    queryKey: ["family-members", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_family_members")
        .select("*")
        .eq("patient_id", patientId);
      if (error) throw error;

      // Also fetch reverse relationships
      const { data: reverseData, error: reverseError } = await supabase
        .from("patient_family_members")
        .select("*")
        .eq("related_patient_id", patientId);
      if (reverseError) throw reverseError;

      const reverseFormatted = (reverseData || []).map((r: any) => ({
        ...r,
        relationship: getInverseRelationship(r.relationship),
        _isReverse: true,
      }));

      return [...(data || []), ...reverseFormatted];
    },
    enabled: !!patientId,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("patient_family_members").insert({
        patient_id: patientId,
        name: memberName,
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
    setMemberName("");
    setRelationship("");
    setIsPrimary(false);
    setNotes("");
  };

  const getMemberDisplayName = (member: any): string => {
    if (member.name) return member.name;
    // Fallback for old records linked to patients
    if (member.related_patient) {
      return `${member.related_patient.first_name} ${member.related_patient.last_name}`;
    }
    return "Unknown";
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
              {/* Parent patient display */}
              <div className="rounded-lg bg-muted/50 border p-3">
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="font-medium text-sm">{patientName}</p>
              </div>

              <div>
                <Label>Family Member Name</Label>
                <Input
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Enter name..."
                  className="mt-1.5"
                />
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
                disabled={!memberName.trim() || !relationship || addMember.isPending}
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
          <p className="text-xs mt-1">Add family members to build the family tree.</p>
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
                    const displayName = getMemberDisplayName(member);
                    const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                    const isExpanded = expandedId === member.id;

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
                            <div className="h-10 w-10 rounded-full bg-accent/50 flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm truncate">
                                  {displayName}
                                </p>
                                {member.is_primary_contact && (
                                  <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />
                                )}
                              </div>
                              <Badge variant="outline" className="text-[10px] mt-1">
                                {member.relationship}
                              </Badge>
                            </div>
                            {member.notes && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : member.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                          </div>

                          {/* Expanded notes */}
                          <AnimatePresence>
                            {isExpanded && member.notes && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-xs text-muted-foreground italic">{member.notes}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Delete button */}
                          {!member._isReverse && (
                            <div className="mt-3 pt-2 border-t">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive w-full">
                                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove family member?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove {displayName} from this patient's family.
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
                            </div>
                          )}
                        </div>
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
