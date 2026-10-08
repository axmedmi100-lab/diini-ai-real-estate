export type AgencyRole = "owner" | "admin" | "manager" | "agent" | "receptionist";
export type AgencyPermission =
  | "manage_agency"
  | "manage_members"
  | "manage_ai"
  | "manage_automation"
  | "manage_properties"
  | "delete_properties"
  | "manage_crm"
  | "delete_leads"
  | "manage_viewings"
  | "manage_conversations"
  | "assign_conversations";

const permissions: Record<AgencyPermission, ReadonlySet<AgencyRole>> = {
  manage_agency: new Set(["owner", "admin", "manager"]),
  manage_members: new Set(["owner"]),
  manage_ai: new Set(["owner", "admin", "manager"]),
  manage_automation: new Set(["owner", "admin", "manager"]),
  manage_properties: new Set(["owner", "admin", "manager", "agent"]),
  delete_properties: new Set(["owner", "admin", "manager"]),
  manage_crm: new Set(["owner", "admin", "manager", "agent", "receptionist"]),
  delete_leads: new Set(["owner", "admin", "manager"]),
  manage_viewings: new Set(["owner", "admin", "manager", "agent", "receptionist"]),
  manage_conversations: new Set(["owner", "admin", "manager", "agent", "receptionist"]),
  assign_conversations: new Set(["owner", "admin", "manager"]),
};

export function hasAgencyPermission(role: string, permission: AgencyPermission) {
  return permissions[permission].has(role as AgencyRole);
}
