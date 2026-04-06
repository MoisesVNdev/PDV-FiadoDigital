import type { DashboardSummary } from "@pdv/shared";
import { DashboardRepository } from "../repositories/dashboard.repository.js";

const dashboardRepository = new DashboardRepository();

export class DashboardService {
  async getSummary(startDate?: string, endDate?: string): Promise<DashboardSummary> {
    return dashboardRepository.getSummary(startDate, endDate);
  }
}
