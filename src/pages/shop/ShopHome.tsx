import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ShopHome = () => {
  const navigate = useNavigate();
  const { user, patientId } = useAuth();
  const { addToCart } = useCart(patientId);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: products = [] } = useQuery({
    queryKey: ["shop-products"],
    queryFn: async () => {
      const { data } = await supabase.from("pharma_products").select("*").order("name");
      return data || [];
    },
  });

  const categories = ["all", ...Array.from(new Set(products.map((p: any) => p.category)))];
  const filtered = products.filter((p: any) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.generic_name || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const handleAddToCart = (product: any) => {
    if (!user) {
      toast.error("Please sign in to add items to cart");
      navigate("/login");
      return;
    }
    addToCart.mutate(product, {
      onSuccess: () => toast.success(`${product.name} added to cart`),
    });
  };

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-accent to-background py-12 md:py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-display font-bold text-foreground mb-3"
          >
            Simply. Better. Skin.
          </motion.h1>
          <p className="text-muted-foreground md:text-lg mb-8 max-w-md mx-auto">
            Premium skincare products recommended by our dermatologists
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-10 h-12 bg-card border shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {filtered.map((product: any) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
                onClick={() => navigate(`/shop/product/${product.id}`)}
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-32 md:h-40 w-full object-cover" />
                ) : (
                  <div className="h-32 md:h-40 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                    <Package className="h-10 w-10 text-primary/20" />
                  </div>
                )}
                <div className="p-3">
                  <Badge variant="secondary" className="text-[10px] mb-1">{product.category}</Badge>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{product.name}</h3>
                  {product.generic_name && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.generic_name}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <span className="text-sm font-bold text-primary">₹{product.selling_price}</span>
                      {product.mrp > product.selling_price && (
                        <span className="text-xs line-through text-muted-foreground ml-1">₹{product.mrp}</span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopHome;
