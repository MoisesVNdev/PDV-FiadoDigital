export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  STOCKIST: "stockist",
  OPERATOR: "operator",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
