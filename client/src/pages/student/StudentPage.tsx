import { Link } from "react-router";

export function StudentPage() {
  return <><Link to="/">← 返回首页</Link><h1>学生入口</h1><p>入口占位，由 C 继续开发查看和作答页面，由 D 接入提交成功状态。</p>
    <p className="muted">这是演示身份，接入真实登录时必须删除。</p></>;
}
