import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashScreen } from "@/components/SplashScreen";
import { lazy, Suspense, useState } from "react";

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CRM = lazy(() => import("./pages/CRM"));
const Finance = lazy(() => import("./pages/Finance"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyWorkspace = lazy(() => import("./pages/CompanyWorkspace"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const CompanyContracts = lazy(() => import("./pages/CompanyContracts"));
const Processes = lazy(() => import("./pages/Processes"));
const Projects = lazy(() => import("./pages/Projects"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Automation = lazy(() => import("./pages/Automation"));
const Docs = lazy(() => import("./pages/Docs"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const Settings = lazy(() => import("./pages/Settings"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const AdsManager = lazy(() => import("./pages/AdsManager"));
const MetaDiagnostic = lazy(() => import("./pages/MetaDiagnostic"));
const Forms = lazy(() => import("./pages/Forms"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Não retry em erros de autenticação/autorização
        if (error instanceof Error && error.message.includes('JWT')) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

const SPLASH_KEY = 'vertos_splash_shown';

function AppWithSplash() {
  const [showSplash, setShowSplash] = useState(() => {
    const shown = sessionStorage.getItem(SPLASH_KEY);
    if (!shown) {
      sessionStorage.setItem(SPLASH_KEY, '1');
      return true;
    }
    return false;
  });

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/f/:slug" element={<PublicForm />} />

            {/* Portal do cliente */}
            <Route
              path="/client-portal"
              element={
                <ProtectedRoute allowedRoles={['cliente']}>
                  <ClientLayout>
                    <ClientPortal />
                  </ClientLayout>
                </ProtectedRoute>
              }
            />

            {/* Rotas protegidas da agência */}
            <Route
              path="*"
              element={
                <ProtectedRoute allowedRoles={['agencia']}>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/tasks" element={<Processes />} />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/calendar" element={<CalendarView />} />
                      <Route path="/integrations" element={<Integrations />} />
                      <Route path="/automation" element={<Automation />} />
                      <Route path="/crm" element={<CRM />} />
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/companies" element={<Companies />} />
                      <Route path="/companies/:companyId" element={<CompanyWorkspace />} />
                      <Route path="/companies/:companyId/profile" element={<CompanyProfile />} />
                      <Route path="/companies/:companyId/contracts" element={<CompanyContracts />} />
                      <Route path="/ads-manager" element={<AdsManager />} />
                      <Route path="/meta-diagnostic" element={<MetaDiagnostic />} />
                      <Route path="/forms" element={<Forms />} />
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
  );
}

const App = () => (
  <ErrorBoundary>
    <AppWithSplash />
  </ErrorBoundary>
);

export default App;
