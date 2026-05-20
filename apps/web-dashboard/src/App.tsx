import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { SignInPage } from "@/pages/SignInPage";
import { HomePage } from "@/pages/HomePage";
import { ChildDetailPage } from "@/pages/ChildDetailPage";
import { RulesEditorPage } from "@/pages/RulesEditorPage";
import { SettingsPage } from "@/pages/SettingsPage";

function ProtectedRoutes() {
  const { user, familyId, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  if (!familyId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-4 text-center text-red-600">
        <p>Could not resolve family. Check Firestore rules and try again.</p>
        {error ? <p className="text-sm text-slate-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="children/:childId" element={<ChildDetailPage />} />
        <Route path="children/:childId/rules" element={<RulesEditorPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
