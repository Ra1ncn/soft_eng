import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { TeacherPage } from "./pages/teacher/TeacherPage.tsx";
import { StudentPage } from "./pages/student/StudentPage.tsx";
import "./style.css";

function HomePage() {
  return <><p className="eyebrow">软件工程 · 第一阶段</p><h1>AI 辅助测验平台</h1>
    <p>平台基础已就绪。请选择入口，具体测验功能由小组继续开发。</p>
    <nav><Link className="card" to="/teacher"><strong>教师入口 →</strong><span>创建测验 · B 负责</span></Link>
      <Link className="card" to="/student"><strong>学生入口 →</strong><span>查看与作答 · C 负责，提交 · D 负责</span></Link></nav>
    <p className="muted">当前使用演示身份，尚未接入登录。</p></>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><main>
  <Routes><Route path="/" element={<HomePage />} /><Route path="/teacher" element={<TeacherPage />} />
    <Route path="/student" element={<StudentPage />} /><Route path="*" element={<><h1>页面不存在</h1><Link to="/">返回首页</Link></>} /></Routes>
</main></BrowserRouter></StrictMode>);
