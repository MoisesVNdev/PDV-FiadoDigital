import type { Role } from "../constants/roles.js";

export type User = {
  id: string;
  name: string;
  username: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateUserPayload = {
  name: string;
  username: string;
  password: string;
  role: Role;
};
