import { Link } from "react-router";

export function TeacherPage() {
  return <><Link to="/">← 返回首页</Link><h1>教师入口</h1><p>入口占位，由 B 继续开发创建 quiz 的页面和接口。</p>
    <p>调用 API 时使用 apiFetch(path, "TEACHER", options)。</p><p className="muted">这是演示身份，接入真实登录时必须删除。</p></>;
}
