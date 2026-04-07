import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Finance from "./pages/Finance";
import Companies from "./pages/Companies";
import CompanyWorkspace from "./pages/CompanyWorkspace";
import Processes from "./pages/Processes";
import Docs from "./pages/Docs";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
