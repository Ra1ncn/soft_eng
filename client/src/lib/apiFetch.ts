import type { ApiErrorResponse, DemoRole } from "@quiz/shared";

export class ApiFetchError extends Error {
  constructor(readonly status: number, readonly error: ApiErrorResponse["error"]) {
    super(error.message);
  }
}

// 演示身份头可以伪造，接入真实登录时必须删除。
export async function apiFetch<T>(path: string, role: DemoRole, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error("apiFetch 仅支持本项目 /api/ 路径");
  const headers = new Headers(options.headers);
  headers.set("X-Demo-Role", role);
  if (options.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers });
  const body: unknown = await response.json();
  if (!response.ok) throw new ApiFetchError(response.status, (body as ApiErrorResponse).error);
  return body as T;
}
