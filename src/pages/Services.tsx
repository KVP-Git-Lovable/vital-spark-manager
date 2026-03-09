import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Clock, IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  description: string;
  recommendations: string[];
}

const mockServices: Service[] = [
  { id: "S001", name: "Chemical Peel", category: "Skin Treatment", price: 3500, duration: 45, description: "Professional-grade chemical peel for skin rejuvenation", recommendations: ["Avoid sun exposure 48hrs", "Apply moisturizer daily", "Use SPF 50+"] },
  { id: "S002", name: "Botox Treatment", category: "Injectable", price: 8000, duration: 30, description: "Botulinum toxin injection for wrinkle reduction", recommendations: ["No lying down 4hrs", "Avoid strenuous exercise 24hrs", "No facial massage 48hrs"] },
  { id: "S003", name: "Laser Resurfacing", category: "Laser Treatment", price: 12000, duration: 60, description: "Fractional laser treatment for skin texture improvement", recommendations: ["Cold compress as needed", "Gentle cleanser only", "Avoid makeup 72hrs"] },
  { id: "S004", name: "Dermal Fillers", category: "Injectable", price: 15000, duration: 45, description: "Hyaluronic acid filler for volume restoration", recommendations: ["Ice application 10min intervals", "No alcohol 24hrs", "Sleep elevated first night"] },
  { id: "S005", name: "Microneedling", category: "Skin Treatment", price: 5000, duration: 40, description: "Collagen induction therapy with micro-needles", recommendations: ["No makeup 24hrs", "Hydrate skin frequently", "Avoid active ingredients 72hrs"] },
  { id: "S006", name: "PRP Therapy", category: "Regenerative", price: 7000, duration: 60, description: "Platelet-rich plasma therapy for hair and skin", recommendations: ["Avoid washing treated area 24hrs", "No blood thinners 1 week prior", "Stay hydrated"] },
];

const categories = ["All", "Skin Treatment", "Injectable", "Laser Treatment", "Regenerative"];

const Services = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = mockServices.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Service Master</h1>
          <p className="page-subtitle">Manage clinic services and preset recommendations</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2 w-fit">
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Add New Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Service Name</Label>
                <Input placeholder="e.g. Chemical Peel" className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input placeholder="e.g. Skin Treatment" className="mt-1.5" />
                </div>
                <div>
                  <Label>Duration (mins)</Label>
                  <Input type="number" placeholder="45" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input type="number" placeholder="3500" className="mt-1.5" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea placeholder="Service description..." className="mt-1.5" />
              </div>
              <div>
                <Label>Recommendations (one per line)</Label>
                <Textarea placeholder="Avoid sun exposure 48hrs&#10;Apply moisturizer daily" className="mt-1.5" rows={3} />
              </div>
              <Button className="w-full">Create Service</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            className="pl-9 bg-card border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((service, i) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="stat-card group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display font-semibold">{service.name}</h3>
                <Badge variant="secondary" className="mt-1 text-xs">{service.category}</Badge>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-sm">
                <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">₹{service.price.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{service.duration} mins</span>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations</p>
              <div className="space-y-1">
                {service.recommendations.map((rec, j) => (
                  <p key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    {rec}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Services;
