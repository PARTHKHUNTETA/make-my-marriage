"use client";

import * as React from "react";
import type { Permission, PermissionSet } from "@/lib/permissions";

// What the signed-in member may do, for the browser: hiding menus, links and buttons they cannot
// use. Convenience only: every action is checked again on the server.
const PermissionsContext = React.createContext<PermissionSet>({});

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: PermissionSet;
  children: React.ReactNode;
}) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionSet {
  return React.useContext(PermissionsContext);
}

export function useCan(permission: Permission): boolean {
  return usePermissions()[permission] !== undefined;
}

// Shows its children only to members holding the permission.
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return useCan(permission) ? <>{children}</> : <>{fallback}</>;
}
