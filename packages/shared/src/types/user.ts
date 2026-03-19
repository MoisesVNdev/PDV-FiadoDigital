import type { Role } from "../constants/roles.js";

export type User = {
  id: string;
  name: string;
  username: string;
  role: Role;
  can_view_cost_price: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateUserPayload = {
  name: string;
  username: string;
  password: string;
  role: Role;
  can_view_cost_price?: boolean;
  is_active?: boolean;
};

export interface UpdateUserData {
  name?: string;
  username?: string;
  password_hash?: string;
  can_view_cost_price?: boolean;
  is_active?: boolean;
}
