import { isPublicPages } from "./site-runtime";

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  if (isPublicPages()) {
    const { publicApi } = await import("./public-api");
    return publicApi(url, options) as Promise<T>;
  }
  const result = await fetch(url, options);
  const body = await result.json() as T & { error?: string };
  if (!result.ok) throw new Error(body.error || "操作未完成，請稍後重試。");
  return body;
}
