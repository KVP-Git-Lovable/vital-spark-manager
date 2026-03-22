import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package, ShoppingCart, Plus, Minus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { motion } from "framer-motion";

import sampleSerum from "@/assets/sample-products/serum.jpg";
import sampleMoisturizer from "@/assets/sample-products/moisturizer.jpg";
import sampleSunscreen from "@/assets/sample-products/sunscreen.jpg";
import sampleCleanser from "@/assets/sample-products/cleanser.jpg";
import sampleToner from "@/assets/sample-products/toner.jpg";
import sampleEyecream from "@/assets/sample-products/eyecream.jpg";

const sampleImages = [sampleSerum, sampleMoisturizer, sampleSunscreen, sampleCleanser, sampleToner, sampleEyecream];
const getSampleImage = (name: string, index: number) => {
  const lower = name.toLowerCase();
  if (lower.includes("serum")) return sampleSerum;
  if (lower.includes("moistur") || lower.includes("cream")) return sampleMoisturizer;
  if (lower.includes("sun") || lower.includes("spf")) return sampleSunscreen;
  if (lower.includes("clean") || lower.includes("wash") || lower.includes("foam")) return sampleCleanser;
  if (lower.includes("toner") || lower.includes("tonic")) return sampleToner;
  if (lower.includes("eye")) return sampleEyecream;
  return sampleImages[index % sampleImages.length];
};

const ShopHome = () => {
  const navigate = useNavigate();
  const { user, patientId } = useAuth();
  const { addToCart, cartItems, updateQuantity, removeFromCart } = useCart(patientId);
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

  const getCartQty = (productId: string) => {
    const item = cartItems.find(i => i.productId === productId);
    return item?.quantity || 0;
  };

  const handleAddToCart = (product: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      toast.error("Please sign in to add items to cart");
      navigate("/login");
      return;
    }
    addToCart.mutate(product, {
      onSuccess: () => toast.success(`${product.name} added to cart`),
    });
  };

  const handleUpdateQty = (productId: string, delta: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return;
    const qty = getCartQty(productId);
    if (qty + delta <= 0) {
      removeFromCart.mutate(productId);
    } else {
      updateQuantity.mutate({ productId, delta });
    }
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
            {filtered.map((product: any, idx: number) => {
              const qty = getCartQty(product.id);
              const imgSrc = product.image_url || getSampleImage(product.name, idx);
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
                  onClick={() => navigate(`/shop/product/${product.id}`)}
                >
                  <img src={imgSrc} alt={product.name} className="h-32 md:h-40 w-full object-cover" />
                  <div className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">{product.unit}</span>
                    </div>
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
                    </div>
                    {/* Quantity controls */}
                    <div className="mt-2" onClick={e => e.stopPropagation()}>
                      {qty === 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-xs gap-1"
                          onClick={(e) => handleAddToCart(product, e)}
                        >
                          <ShoppingCart className="h-3 w-3" /> Add to Cart
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between bg-primary/5 rounded-lg px-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleUpdateQty(product.id, -1, e)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-semibold text-primary">{qty}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleUpdateQty(product.id, 1, e)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopHome;
