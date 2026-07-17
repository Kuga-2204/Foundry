const BASE = "/api";

async function request(path, { method = "GET", body, token } = {}) {
  // FormData sets its own multipart boundary; only JSON gets a content type.
  const isForm = body instanceof FormData;
  const headers = isForm ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
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
  followProblem: (id, token) => request(`/problems/${id}/follow`, { method: "POST", token }),
  // Token is optional but sent when present: it lets the backend credit the
  // search appearance to the matched startup's analytics.
  matchText: (text, token) => request("/problems/match", { method: "POST", body: { text }, token }),
  similarProblems: (text, token) =>
    request("/problems/similar", { method: "POST", body: { text }, token }),
  problemMatches: (id) => request(`/problems/${id}/matches`),
  listComments: (problemId, token) => request(`/problems/${problemId}/comments`, { token }),
  postComment: (problemId, payload, token) =>
    request(`/problems/${problemId}/comments`, { method: "POST", body: payload, token }),
  commit: (id, startupId, note, token) =>
    request(`/problems/${id}/commit`, { method: "POST", body: { startup_id: startupId, note }, token }),
  ship: (id, startupId, token) =>
    request(`/problems/${id}/ship`, { method: "POST", body: { startup_id: startupId }, token }),

  listSolutions: (problemId, token) => request(`/solutions/problem/${problemId}`, { token }),
  getSolution: (id, token) => request(`/solutions/${id}`, { token }),
  provideSolution: (problemId, payload, token) =>
    request(`/solutions/problem/${problemId}`, { method: "POST", body: payload, token }),

  listReviews: (solutionId) => request(`/reviews/solution/${solutionId}`),
  submitReview: (solutionId, payload, token) =>
    request(`/reviews/solution/${solutionId}`, { method: "POST", body: payload, token }),

  listStartups: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request(`/startups${qs ? `?${qs}` : ""}`);
  },
  myStartups: (token) => request("/startups/mine", { token }),
  getStartup: (id, token) => request(`/startups/${id}`, { token }),
  createStartup: (payload, token) => request("/startups", { method: "POST", body: payload, token }),
  updateStartup: (id, payload, token) =>
    request(`/startups/${id}`, { method: "PUT", body: payload, token }),
  claimStartup: (id, token) => request(`/startups/${id}/claim`, { method: "POST", token }),
  startupLeads: (id, token) => request(`/startups/${id}/leads`, { token }),
  startupStats: (id, token) => request(`/startups/${id}/stats`, { token }),

  notifications: (token) => request("/notifications", { token }),
  markNotificationsRead: (token) => request("/notifications/read-all", { method: "POST", token }),
};
