export type Role =
  | "Owner" | "Admin" | "Manager" | "Sales Rep" | "VA" | "Finance" | "Technician" | "Viewer";

export const ROLES: Role[] = ["Owner", "Admin", "Manager", "Sales Rep", "VA", "Finance", "Technician", "Viewer"];

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  department: string;
  active: boolean;
  default_commission_rate: number;
  tech_base_pay_type: string;
  tech_base_pay_amount: number;
  notes: string;
}

const ALL = ["/", "/care-club", "/leads", "/jobs", "/marketing", "/sales", "/operations", "/quality", "/payroll", "/finance", "/audit", "/settings"];

/** Which pages each role may open. Viewer sees everything read-only. */
export const ROLE_PAGES: Record<Role, string[]> = {
  Owner: ALL,
  Admin: ALL,
  Manager: ["/", "/leads", "/jobs", "/care-club", "/marketing", "/sales", "/operations", "/quality", "/audit"],
  "Sales Rep": ["/sales", "/leads", "/care-club"],
  VA: ["/", "/leads", "/jobs", "/marketing", "/care-club", "/audit"],
  Finance: ["/", "/finance", "/payroll", "/jobs"],
  Technician: ["/jobs", "/quality"],
  Viewer: ALL,
};

export function canAccessPage(role: Role | undefined, path: string): boolean {
  if (!role) return false;
  const pages = ROLE_PAGES[role] ?? [];
  // "/" must match exactly; others match by prefix
  return pages.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")));
}

export type Capability = "editRecords" | "deleteRecords" | "manageUsers" | "editPayRules" | "manageFinance" | "manageSettings";

const CAPS: Record<Capability, Role[]> = {
  editRecords: ["Owner", "Admin", "Manager", "Sales Rep", "VA", "Finance"],
  deleteRecords: ["Owner", "Admin"],
  manageUsers: ["Owner", "Admin"],
  editPayRules: ["Owner", "Admin"],
  manageFinance: ["Owner", "Admin", "Finance"],
  manageSettings: ["Owner", "Admin"],
};

export function can(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPS[capability] ?? []).includes(role);
}

/** Roles allowed to create/update cloud leads (write to Supabase). */
export const LEAD_WRITE_ROLES: Role[] = ["Owner", "Admin", "Manager", "Sales Rep", "VA"];
export const LEAD_DELETE_ROLES: Role[] = ["Owner", "Admin"];
