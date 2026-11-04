import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("../lib/prisma.ts", () => ({ prisma: { user: { findUnique } } }));
import { getCurrentUser } from "./getCurrentUser.ts";
function request(role?: string): Request { return { get: () => role } as unknown as Request; }
beforeEach(() => vi.resetAllMocks());
describe("演示身份", () => {
  it.each(["TEACHER", "STUDENT"])("合法 %s 读取固定用户", async (role) => {
    const id = role === "TEACHER" ? "teacher-demo" : "student-demo";
    findUnique.mockResolvedValue({ id, role });
    await expect(getCurrentUser(request(role))).resolves.toEqual({ id, role });
    expect(findUnique).toHaveBeenCalledWith({ where: { id } });
  });
  it.each([undefined, "", "teacher", "ADMIN", "TEACHER, STUDENT"])("缺失或非法身份 %s 返回 403", async (role) => {
    await expect(getCurrentUser(request(role))).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("合法身份但未 seed 返回 500", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getCurrentUser(request("STUDENT"))).rejects.toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
  });
  it("seed 角色不一致返回 500", async () => {
    findUnique.mockResolvedValue({ id: "student-demo", role: "TEACHER" });
    await expect(getCurrentUser(request("STUDENT"))).rejects.toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
  });
});
