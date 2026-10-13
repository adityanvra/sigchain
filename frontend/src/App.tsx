import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage").then(m => ({ default: m.DocumentsPage })));
const UploadPage = lazy(() => import("@/pages/UploadPage").then(m => ({ default: m.UploadPage })));
const DocumentDetailPage = lazy(() => import("@/pages/DocumentDetailPage").then(m => ({ default: m.DocumentDetailPage })));
const SignatureEditorPage = lazy(() => import("@/pages/SignatureEditorPage").then(m => ({ default: m.SignatureEditorPage })));
const VerifyPage = lazy(() => import("@/pages/VerifyPage").then(m => ({ default: m.VerifyPage })));
const PublicVerifyPage = lazy(() => import("@/pages/PublicVerifyPage").then(m => ({ default: m.PublicVerifyPage })));
const AuditPage = lazy(() => import("@/pages/AuditPage").then(m => ({ default: m.AuditPage })));
const UsersPage = lazy(() => import("@/pages/UsersPage").then(m => ({ default: m.UsersPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<p className="p-6 text-sm text-muted-foreground" role="status">Memuat halaman…</p>}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-public" element={<PublicVerifyPage />} />
          {/* Verify by documentId (from QR code) or SHA-256 hash */}
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
            <Route path="/notifications" element={<NotificationsPage />} />
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

          {/* Signature editor — full-page (no AppLayout sidebar), still protected */}
          <Route
            path="/documents/:id/sign-editor"
            element={
              <ProtectedRoute roles={["admin", "staff_akademik", "staff_administrasi"]}>
                <SignatureEditorPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
