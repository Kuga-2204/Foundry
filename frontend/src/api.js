const BASE = "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: (token) => request("/auth/me", { token }),

  categories: () => request("/problems/categories"),
  listProblems: (params, token) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/problems${qs ? `?${qs}` : ""}`, { token });
  },
  getProblem: (id, token) => request(`/problems/${id}`, { token }),
  createProblem: (payload, token) => request("/problems", { method: "POST", body: payload, token }),
  vote: (id, type, token) => request(`/problems/${id}/vote`, { method: "POST", body: { type }, token }),

  listSolutions: (problemId, token) => request(`/solutions/problem/${problemId}`, { token }),
  provideSolution: (problemId, payload, token) =>
    request(`/solutions/problem/${problemId}`, { method: "POST", body: payload, token }),

  listReviews: (solutionId) => request(`/reviews/solution/${solutionId}`),
  submitReview: (solutionId, payload, token) =>
    request(`/reviews/solution/${solutionId}`, { method: "POST", body: payload, token }),
};
