export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.created"
  | "user.updated"
  | "user.deactivated"
  | "sale.created"
  | "sale.cancelled"
  | "sale.refunded"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.price_changed"
  | "customer.created"
  | "customer.updated"
  | "customer.credit_blocked"
  | "cash_register.opened"
  | "cash_register.closed"
  | "cash_register.cash_out"
  | "fiado.payment"
  | "access.denied";

export type AuditLog = {
  id: string;
  action: AuditAction;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  terminal_id: string | null;
  created_at: string;
};
