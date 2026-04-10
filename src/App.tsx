import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";

const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CRM = lazy(() => import("./pages/CRM"));
const Finance = lazy(() => import("./pages/Finance"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyWorkspace = lazy(() => import("./pages/CompanyWorkspace"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const CompanyContracts = lazy(() => import("./pages/CompanyContracts"));
const Processes = lazy(() => import("./pages/Processes"));
const Docs = lazy(() => import("./pages/Docs"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const Settings = lazy(() => import("./pages/Settings"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <Suspense fallback={null}>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Rotas protegidas */}
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/tasks" element={<Processes />} />
                      <Route path="/crm" element={<CRM />} />
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/companies" element={<Companies />} />
                      <Route path="/companies/:companyId" element={<CompanyWorkspace />} />
                      <Route path="/companies/:companyId/profile" element={<CompanyProfile />} />
                      <Route path="/companies/:companyId/contracts" element={<CompanyContracts />} />
                      <Route path="/whatsapp" element={<WhatsApp />} />
                      <Route path="/ai-insights" element={<AIInsights />} />
                      <Route path="/docs" element={<Docs />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
