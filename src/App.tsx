import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { ShopLayout } from "@/components/shop/ShopLayout";
import Index from "./pages/Index";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Appointments from "./pages/Appointments";
import Services from "./pages/Services";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import ReportView from "./pages/ReportView";
import ReportConfigurator from "./pages/ReportConfigurator";
import Procedures from "./pages/Procedures";
import Pharma from "./pages/Pharma";
import Photos from "./pages/Photos";
import LeaveManagement from "./pages/LeaveManagement";
import Assets from "./pages/Assets";
import Settings from "./pages/Settings";
import TaxMasterForm from "./pages/TaxMasterForm";
import Orders from "./pages/Orders";
import Expenses from "./pages/Expenses";
import StaffManagement from "./pages/StaffManagement";
import StaffDetail from "./pages/StaffDetail";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import PortalLanding from "./pages/portal/PortalLanding";
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
import ProblemAreas from "./pages/ProblemAreas";
import SurveyTemplates from "./pages/SurveyTemplates";
import SurveyTemplateDetail from "./pages/SurveyTemplateDetail";
import AllSurveys from "./pages/AllSurveys";
import SurveyResponseDetail from "./pages/SurveyResponseDetail";
import SurveyResponseEdit from "./pages/SurveyResponseEdit";
import SurveyNew from "./pages/SurveyNew";
import Vendors from "./pages/Vendors";
import UserManagement from "./pages/UserManagement";
import UnitMaster from "./pages/UnitMaster";
import CategoryMaster from "./pages/CategoryMaster";
import Profile from "./pages/Profile";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      networkMode: "always",
    },
    mutations: {
      retry: 1,
      networkMode: "always",
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error("Query failed:", query.queryKey, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error("Mutation failed:", mutation.options.mutationKey, error);
    },
  }),
});

function ProtectedRoute({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const { isAdmin, permissions, loading } = useAuth();
  if (loading) return null;
  if (isAdmin) return <>{children}</>;
  if (permissions[moduleKey]?.can_view) return <>{children}</>;
  // If no permissions loaded at all (no staff profile / not logged in as staff), allow access
  if (Object.keys(permissions).length === 0) return <>{children}</>;
  return <AccessDenied />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <InstallBanner />
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
            <Route path="/portal" element={<PortalLanding />} />
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/dashboard" element={<Portal />} />
            <Route path="/portal/dashboard/:tab" element={<Portal />} />
            <Route path="/portal/:tab" element={<Portal />} />

            {/* Clinic app — inside sidebar layout */}
            <Route
              path="*"
              element={
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<ProtectedRoute moduleKey="dashboard"><Index /></ProtectedRoute>} />
                    <Route path="/patients" element={<ProtectedRoute moduleKey="patients"><Patients /></ProtectedRoute>} />
                    <Route path="/patients/:id" element={<ProtectedRoute moduleKey="patients"><PatientDetail /></ProtectedRoute>} />
                    <Route path="/leave" element={<ProtectedRoute moduleKey="leave"><LeaveManagement /></ProtectedRoute>} />
                    <Route path="/appointments" element={<ProtectedRoute moduleKey="appointments"><Appointments /></ProtectedRoute>} />
                    <Route path="/services" element={<ProtectedRoute moduleKey="services"><Services /></ProtectedRoute>} />
                    <Route path="/billing" element={<ProtectedRoute moduleKey="billing"><Billing /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute moduleKey="reports"><Reports /></ProtectedRoute>} />
                    <Route path="/reports/:key" element={<ProtectedRoute moduleKey="reports"><ReportView /></ProtectedRoute>} />
                    <Route path="/report-builder" element={<ProtectedRoute moduleKey="report_builder"><ReportConfigurator /></ProtectedRoute>} />
                    <Route path="/campaigns" element={<ProtectedRoute moduleKey="campaigns"><Campaigns /></ProtectedRoute>} />
                    <Route path="/campaigns/:id" element={<ProtectedRoute moduleKey="campaigns"><CampaignDetail /></ProtectedRoute>} />
                    <Route path="/procedures" element={<ProtectedRoute moduleKey="procedures"><Procedures /></ProtectedRoute>} />
                    <Route path="/pharma" element={<ProtectedRoute moduleKey="pharmacy"><Pharma /></ProtectedRoute>} />
                    <Route path="/photos" element={<ProtectedRoute moduleKey="photos"><Photos /></ProtectedRoute>} />
                    <Route path="/assets" element={<ProtectedRoute moduleKey="assets"><Assets /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute moduleKey="portal_orders"><Orders /></ProtectedRoute>} />
                    <Route path="/expenses" element={<ProtectedRoute moduleKey="expenses"><Expenses /></ProtectedRoute>} />
                    <Route path="/staff" element={<ProtectedRoute moduleKey="staff"><StaffManagement /></ProtectedRoute>} />
                    <Route path="/staff/:id" element={<ProtectedRoute moduleKey="staff"><StaffDetail /></ProtectedRoute>} />
                    <Route path="/problem-areas" element={<ProtectedRoute moduleKey="problem_areas"><ProblemAreas /></ProtectedRoute>} />
                    <Route path="/survey-templates" element={<ProtectedRoute moduleKey="surveys"><SurveyTemplates /></ProtectedRoute>} />
                    <Route path="/survey-templates/:id" element={<ProtectedRoute moduleKey="surveys"><SurveyTemplateDetail /></ProtectedRoute>} />
                    <Route path="/all-surveys" element={<ProtectedRoute moduleKey="surveys"><AllSurveys /></ProtectedRoute>} />
                    <Route path="/surveys/new" element={<ProtectedRoute moduleKey="surveys"><SurveyNew /></ProtectedRoute>} />
                    <Route path="/surveys/:id" element={<ProtectedRoute moduleKey="surveys"><SurveyResponseDetail /></ProtectedRoute>} />
                    <Route path="/surveys/:id/edit" element={<ProtectedRoute moduleKey="surveys"><SurveyResponseEdit /></ProtectedRoute>} />
                    <Route path="/vendors" element={<ProtectedRoute moduleKey="vendors"><Vendors /></ProtectedRoute>} />
                    <Route path="/unit-master" element={<ProtectedRoute moduleKey="unit_master"><UnitMaster /></ProtectedRoute>} />
                    <Route path="/Unit-master" element={<Navigate to="/unit-master" replace />} />
                    <Route path="/category-master" element={<ProtectedRoute moduleKey="category_master"><CategoryMaster /></ProtectedRoute>} />
                    <Route path="/user-management" element={<ProtectedRoute moduleKey="user_management"><UserManagement /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><Settings /></ProtectedRoute>} />
                    <Route path="/settings/tax-master/new" element={<ProtectedRoute moduleKey="settings"><TaxMasterForm /></ProtectedRoute>} />
                    <Route path="/settings/tax-master/:id" element={<ProtectedRoute moduleKey="settings"><TaxMasterForm /></ProtectedRoute>} />
                    <Route path="/profile" element={<Profile />} />
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
