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
  const failure = await apiFetch("/api/quizzes", "STUDENT").catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ApiFetchError);
  expect(failure).toMatchObject({ status: 400, error: {
    code: "VALIDATION_ERROR", message: "bad", fields: { title: "required" },
  } });
});
it("不向外部 URL 发送演示身份", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  await expect(apiFetch("https://example.com/api/", "STUDENT")).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  { status: 500, body: "", contentType: "text/plain", label: "空 500" },
  { status: 502, body: "<html>gateway internals</html>", contentType: "text/html", label: "HTML 502" },
  { status: 502, body: "Bad Gateway from proxy", contentType: "text/plain", label: "代理纯文本 502" },
  { status: 404, body: '{"message":"missing error field"}', contentType: "application/json", label: "无 error 字段的 404" },
  { status: 400, body: '{"error":{"message":"missing code"}}', contentType: "application/json", label: "不合法的错误对象" },
  { status: 200, body: "not JSON", contentType: "text/plain", label: "2xx 非 JSON" },
])("$label 统一抛 ApiFetchError，保留 HTTP status", async ({ status, body, contentType }) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status, headers: { "Content-Type": contentType } })));
  const failure = await apiFetch("/api/health", "STUDENT").catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ApiFetchError);
  expect(failure).toMatchObject({ status, error: {
    code: "INTERNAL_ERROR", message: "服务器响应异常，请稍后重试",
  } });
});
it.each([200, 204])("空的 %i 成功响应返回 undefined", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  await expect(apiFetch("/api/health", "STUDENT")).resolves.toBeUndefined();
});
it.each([null, ["item"], { status: "ok" }])("合法成功 JSON 保持原有返回行为 %#", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
  await expect(apiFetch("/api/health", "STUDENT")).resolves.toEqual(body);
});
it("fetch 本身失败时原样抛出，不包装成 ApiFetchError", async () => {
  const failure = new TypeError("Network unavailable");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
  await expect(apiFetch("/api/health", "STUDENT")).rejects.toBe(failure);
});
