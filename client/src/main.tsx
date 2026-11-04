import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "@fontsource/source-serif-4/latin-500.css";
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import { PageShell, ButtonLink } from "./components/ui/index.ts";
import { HomePage } from "./pages/HomePage.tsx";
import { TeacherPage } from "./pages/teacher/TeacherPage.tsx";
import { StudentPage } from "./pages/student/StudentPage.tsx";
import { UiPreviewPage } from "./pages/UiPreviewPage.tsx";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><PageShell>
  <Routes><Route path="/" element={<HomePage />} /><Route path="/teacher" element={<TeacherPage />} />
    <Route path="/student" element={<StudentPage />} /><Route path="/ui-preview" element={<UiPreviewPage />} />
    <Route path="*" element={<><h1>That page is still a mystery.</h1><p>Let’s find our way back.</p><ButtonLink to="/">Back to home</ButtonLink></>} />
  </Routes>
</PageShell></BrowserRouter></StrictMode>);
