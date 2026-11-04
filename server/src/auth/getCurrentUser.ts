import type { Request } from "express";
import { DemoRole } from "@quiz/shared";
import { prisma } from "../lib/prisma.ts";
import { AppError } from "../lib/errors.ts";

// 仅为演示身份：请求头可伪造，接入真实登录时必须删除此实现及前端演示头。
export async function getCurrentUser(req: Request) {
  const role = DemoRole.safeParse(req.get("X-Demo-Role"));
  if (!role.success) throw new AppError("FORBIDDEN", "需要合法的 X-Demo-Role 演示身份");
  const id = role.data === "TEACHER" ? "teacher-demo" : "student-demo";
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== role.data) throw new AppError("INTERNAL_ERROR", "演示用户未正确初始化");
  return user;
}
