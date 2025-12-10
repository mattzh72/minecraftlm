import { Routes, Route } from "react-router-dom";
import { ProjectsPage } from "@/components/ProjectsPage";
import { SessionPage } from "@/components/SessionPage";

export function App() {
  return (
    <Routes>
      {/* Home / Projects listing */}
      <Route path="/" element={<ProjectsPage />} />

      {/* Session view with chat and 3D viewer */}
      <Route path="/session/:sessionId" element={<SessionPage />} />
    </Routes>
  );
}
