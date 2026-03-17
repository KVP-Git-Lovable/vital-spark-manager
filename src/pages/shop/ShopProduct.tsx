import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

const ShopProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, patientId } = useAuth();
  const { addToCart } = useCart(patientId);

  const { data: product, isLoading } = useQuery({
    queryKey: ["shop-product", id],
    queryFn: async () => {
      const { data } = await supabase.from("pharma_products").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const handleAdd = () => {
    if (!user) { navigate("/login"); return; }
    if (!product) return;
    addToCart.mutate(product, {
      onSuccess: () => toast.success(`${product.name} added to cart`),
    });
  };

  if (isLoading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  if (!product) return <div className="text-center py-20 text-muted-foreground">Product not found</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-4" onClick={() => navigate("/shop")}>
        <ArrowLeft className="h-4 w-4" /> Back to Shop
      </Button>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-56 md:h-72 w-full object-cover" />
        ) : (
          <div className="h-56 md:h-72 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
            <Package className="h-20 w-20 text-primary/20" />
          </div>
        )}
        <div className="p-5 md:p-6 space-y-4">
          <div>
            <Badge variant="secondary" className="mb-2">{product.category}</Badge>
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">{product.name}</h1>
            {product.generic_name && <p className="text-sm text-muted-foreground mt-1">{product.generic_name}</p>}
            {product.manufacturer && <p className="text-xs text-muted-foreground">by {product.manufacturer}</p>}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">₹{product.selling_price}</span>
            {product.mrp > product.selling_price && (
              <>
                <span className="text-lg line-through text-muted-foreground">₹{product.mrp}</span>
                <Badge className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">
                  {Math.round((1 - product.selling_price / product.mrp) * 100)}% off
                </Badge>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-3"><span className="text-muted-foreground">Unit:</span> {product.unit}</div>
            {product.hsn_code && <div className="bg-muted/50 rounded-lg p-3"><span className="text-muted-foreground">HSN:</span> {product.hsn_code}</div>}
          </div>

          <Button className="w-full h-12 text-base gap-2" onClick={handleAdd}>
            <ShoppingCart className="h-5 w-5" /> Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShopProduct;
