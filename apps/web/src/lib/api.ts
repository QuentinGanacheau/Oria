const base = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`);
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  return res.json() as Promise<T>;
}
