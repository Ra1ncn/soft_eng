import { afterEach, expect, it, vi } from "vitest";
import { apiFetch, ApiFetchError } from "./apiFetch.ts";
afterEach(() => vi.unstubAllGlobals());
it("自动添加角色与 JSON 头", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "quiz" }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(apiFetch("/api/quizzes", "TEACHER", { method: "POST", body: "{}" })).resolves.toEqual({ id: "quiz" });
  const headers = fetchMock.mock.calls[0]?.[1].headers as Headers;
  expect(headers.get("X-Demo-Role")).toBe("TEACHER");
  expect(headers.get("Content-Type")).toBe("application/json");
});
it("保留统一错误的字段信息", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
    code: "VALIDATION_ERROR", message: "bad", fields: { title: "required" },
  } }), { status: 400 })));
  await expect(apiFetch("/api/quizzes", "STUDENT")).rejects.toMatchObject({ status: 400, error: { fields: { title: "required" } } });
  expect(ApiFetchError.prototype).toBeInstanceOf(Error);
});
it("不向外部 URL 发送演示身份", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  await expect(apiFetch("https://example.com/api/", "STUDENT")).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
