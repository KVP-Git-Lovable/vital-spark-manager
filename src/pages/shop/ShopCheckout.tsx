import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ShopCheckout = () => {
  const navigate = useNavigate();
  const { user, patientId, patientName } = useAuth();
  const { cartItems, cartTotal, cartGst, cartGrandTotal, clearCart } = useCart(patientId);
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [address, setAddress] = useState({ address: "", city: "", state: "", pincode: "", phone: "" });
  const [orderNotes, setOrderNotes] = useState("");

  if (!user) { navigate("/login"); return null; }
  if (cartItems.length === 0) { navigate("/shop/cart"); return null; }

  const { data: patientData } = useQuery({
    queryKey: ["shop-patient", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("address, city, state, pincode, phone").eq("id", patientId!).single();
      if (data) {
        setAddress({
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          pincode: data.pincode || "",
          phone: data.phone || "",
        });
      }
      return data;
    },
  });

  const placeOrder = useMutation({
    mutationFn: async () => {
      const { data: order, error } = await supabase.from("portal_orders").insert({
        patient_id: patientId!,
        patient_name: patientName,
        delivery_method: deliveryMethod,
        address: deliveryMethod === "delivery" ? address.address : null,
        city: deliveryMethod === "delivery" ? address.city : null,
        state: deliveryMethod === "delivery" ? address.state : null,
        pincode: deliveryMethod === "delivery" ? address.pincode : null,
        phone: address.phone || patientData?.phone,
        total_amount: cartGrandTotal,
        notes: orderNotes || null,
      }).select().single();
      if (error) throw error;

      const items = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }));
      const { error: itemsError } = await supabase.from("portal_order_items").insert(items);
      if (itemsError) throw itemsError;

      await clearCart.mutateAsync();
    },
    onSuccess: () => {
      toast.success("Order placed successfully!");
      navigate("/shop/orders");
    },
    onError: () => toast.error("Failed to place order"),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">Checkout</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate("/shop/cart")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Cart
        </Button>
      </div>

      {/* Order summary */}
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Order Summary</p>
        {cartItems.map(item => (
          <div key={item.productId} className="flex justify-between text-sm py-1">
            <span>{item.name} × {item.quantity}</span>
            <span>₹{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm pt-2 border-t mt-2">
          <span className="text-muted-foreground">Subtotal</span>
          <span>₹{cartTotal.toLocaleString()}</span>
        </div>
        {cartGst > 0 && (
          <div className="flex justify-between text-sm py-0.5">
            <span className="text-muted-foreground">GST</span>
            <span>₹{cartGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold pt-1 border-t mt-1">
          <span>Grand Total</span>
          <span className="text-primary">₹{cartGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Delivery method */}
      <div className="bg-card rounded-xl border p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Method</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`p-3 rounded-xl border-2 text-center transition-all ${deliveryMethod === "pickup" ? "border-primary bg-primary/5" : "border-border"}`}
            onClick={() => setDeliveryMethod("pickup")}
          >
            <Store className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">Clinic Pickup</p>
            <p className="text-xs text-muted-foreground">Free</p>
          </button>
          <button
            className={`p-3 rounded-xl border-2 text-center transition-all ${deliveryMethod === "delivery" ? "border-primary bg-primary/5" : "border-border"}`}
            onClick={() => setDeliveryMethod("delivery")}
          >
            <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">Home Delivery</p>
            <p className="text-xs text-muted-foreground">Shipping applies</p>
          </button>
        </div>
      </div>

      {/* Address */}
      {deliveryMethod === "delivery" && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-card rounded-xl border p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Address</p>
          <div>
            <Label className="text-xs">Address</Label>
            <Textarea className="mt-1" rows={2} value={address.address} onChange={e => setAddress(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">City</Label><Input className="mt-1" value={address.city} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} /></div>
            <div><Label className="text-xs">State</Label><Input className="mt-1" value={address.state} onChange={e => setAddress(p => ({ ...p, state: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Pincode</Label><Input className="mt-1" value={address.pincode} onChange={e => setAddress(p => ({ ...p, pincode: e.target.value }))} /></div>
            <div><Label className="text-xs">Phone</Label><Input className="mt-1" value={address.phone} onChange={e => setAddress(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
        </motion.div>
      )}

      {/* Notes */}
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <Label className="text-xs text-muted-foreground">Order Notes (optional)</Label>
        <Textarea className="mt-1" rows={2} value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Any special instructions..." />
      </div>

      <Button className="w-full h-12 text-base" onClick={() => placeOrder.mutate()} disabled={placeOrder.isPending}>
        {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Place Order
      </Button>
    </div>
  );
};

export default ShopCheckout;
