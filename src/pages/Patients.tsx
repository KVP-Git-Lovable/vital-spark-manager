import { useState } from "react";
import { Search, Plus, MoreHorizontal, Phone, Mail, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockPatients = [
  { id: "P001", name: "Sarah Johnson", age: 34, phone: "+91 98765 43210", email: "sarah@email.com", lastVisit: "2026-03-08", totalVisits: 12, status: "Active" },
  { id: "P002", name: "Michael Chen", age: 45, phone: "+91 98765 43211", email: "michael@email.com", lastVisit: "2026-03-07", totalVisits: 8, status: "Active" },
  { id: "P003", name: "Emily Davis", age: 28, phone: "+91 98765 43212", email: "emily@email.com", lastVisit: "2026-03-05", totalVisits: 5, status: "Active" },
  { id: "P004", name: "James Wilson", age: 52, phone: "+91 98765 43213", email: "james@email.com", lastVisit: "2026-02-20", totalVisits: 3, status: "Inactive" },
  { id: "P005", name: "Lisa Park", age: 39, phone: "+91 98765 43214", email: "lisa@email.com", lastVisit: "2026-03-09", totalVisits: 15, status: "Active" },
  { id: "P006", name: "Raj Patel", age: 41, phone: "+91 98765 43215", email: "raj@email.com", lastVisit: "2026-03-06", totalVisits: 7, status: "Active" },
];

const Patients = () => {
  const [search, setSearch] = useState("");

  const filtered = mockPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">Manage your patient records</p>
        </div>
        <Button className="gap-2 w-fit">
          <Plus className="h-4 w-4" />
          Add Patient
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="data-table"
      >
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or email..."
              className="pl-9 bg-muted border-0"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Patient</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Contact</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Last Visit</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden sm:table-cell">Visits</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((patient) => (
                <tr key={patient.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-semibold text-sm shrink-0">
                        {patient.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.id} · Age {patient.age}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {patient.phone}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {patient.email}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className="text-sm">{patient.lastVisit}</span>
                  </td>
                  <td className="p-4 hidden sm:table-cell">
                    <span className="text-sm font-medium">{patient.totalVisits}</span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      patient.status === "Active" 
                        ? "bg-success/10 text-success" 
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {patient.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Profile</DropdownMenuItem>
                        <DropdownMenuItem>Book Appointment</DropdownMenuItem>
                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {filtered.length} of {mockPatients.length} patients</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Patients;
