import { planningJson } from "./planningApi";
import type { PlanningPortfolioResponse } from "./portfolioTypes";
import type { PlanningProjectStatus } from "./types";

export function loadPlanningPortfolio(token: string, filters: { query?: string; status?: PlanningProjectStatus | ""; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (filters.query) query.set("query", filters.query);
  if (filters.status) query.set("status", filters.status);
  query.set("limit", String(filters.limit || 50));
  query.set("offset", String(filters.offset || 0));
  return planningJson<PlanningPortfolioResponse>(token, `/api/planning/portfolio?${query}`);
}
