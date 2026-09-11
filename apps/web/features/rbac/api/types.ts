export type OrgMember = {
  userId: string;
  membershipId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string;
  role: string;
  roleName: string;
  permissions: string[];
};

export type OrgRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissionIds: string[];
};

export type OrgPermission = {
  id: string;
  key: string;
  name: string;
  description: string;
};

export type RolesPermissionsData = {
  members: OrgMember[];
  roles: OrgRole[];
  permissions: OrgPermission[];
};
