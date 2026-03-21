import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShopLayout } from "@/components/shop/ShopLayout";
import Index from "./pages/Index";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Appointments from "./pages/Appointments";
import Services from "./pages/Services";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import ReportConfigurator from "./pages/ReportConfigurator";
import Procedures from "./pages/Procedures";
import Pharma from "./pages/Pharma";
import Photos from "./pages/Photos";
import LeaveManagement from "./pages/LeaveManagement";
import Assets from "./pages/Assets";
import Settings from "./pages/Settings";
import Orders from "./pages/Orders";
import Expenses from "./pages/Expenses";
import StaffManagement from "./pages/StaffManagement";
import StaffDetail from "./pages/StaffDetail";
import PortalLogin from "./pages/portal/PortalLogin";
import Portal from "./pages/portal/Portal";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ShopHome from "./pages/shop/ShopHome";
import ShopProduct from "./pages/shop/ShopProduct";
import ShopCart from "./pages/shop/ShopCart";
import ShopCheckout from "./pages/shop/ShopCheckout";
import ShopOrders from "./pages/shop/ShopOrders";
import Website from "./pages/Website";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Marketing website */}
            <Route path="/website" element={<Website />} />

            {/* Auth pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Public Shop — own layout */}
            <Route path="/shop" element={<ShopLayout />}>
              <Route index element={<ShopHome />} />
              <Route path="product/:id" element={<ShopProduct />} />
              <Route path="cart" element={<ShopCart />} />
              <Route path="checkout" element={<ShopCheckout />} />
              <Route path="orders" element={<ShopOrders />} />
            </Route>

            {/* Patient Portal — outside clinic layout */}
            <Route path="/portal" element={<PortalLogin />} />
            <Route path="/portal/dashboard" element={<Portal />} />

            {/* Clinic app — inside sidebar layout */}
            <Route
              path="*"
              element={
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/patients/:id" element={<PatientDetail />} />
                    <Route path="/leave" element={<LeaveManagement />} />
                    <Route path="/appointments" element={<Appointments />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/report-builder" element={<ReportConfigurator />} />
                    <Route path="/procedures" element={<Procedures />} />
                    <Route path="/pharma" element={<Pharma />} />
                    <Route path="/photos" element={<Photos />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/staff" element={<StaffManagement />} />
                    <Route path="/staff/:id" element={<StaffDetail />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
