"use client";
import { useQuery } from "@tanstack/react-query";
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(
    path.startsWith("/api/") ? path : `/api/${path}`,
    {
      method: method || (body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      headers:
        body instanceof FormData
          ? {}
          : body === undefined
            ? {}
            : { "Content-Type": "application/json" },
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to complete this request.");
  return data as T;
}
export function useResource<T>(path: string | null) {
  return useQuery<T, Error>({
    queryKey: [path],
    queryFn: () => api<T>(path!),
    enabled: !!path,
    staleTime: 30000,
    retry: 1,
  });
}
export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
}
export function relativeTime(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(date).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Date(date).toLocaleDateString("en", options);
}
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
