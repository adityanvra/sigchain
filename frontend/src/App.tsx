import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { UploadPage } from "@/pages/UploadPage";
import { DocumentDetailPage } from "@/pages/DocumentDetailPage";
import { VerifyPage } from "@/pages/VerifyPage";
import { PublicVerifyPage } from "@/pages/PublicVerifyPage";
import { AuditPage } from "@/pages/AuditPage";
import { UsersPage } from "@/pages/UsersPage";
import { ProfilePage } from "@/pages/ProfilePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-public" element={<PublicVerifyPage />} />
          <Route path="/verify/:hash" element={<PublicVerifyPage />} />

          {/* Protected app */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
