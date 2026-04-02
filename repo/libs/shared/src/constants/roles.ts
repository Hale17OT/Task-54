export enum UserRole {
  PATIENT = 'patient',
  STAFF = 'staff',
  ADMIN = 'admin',
  REVIEWER = 'reviewer',
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.PATIENT]: 0,
  [UserRole.STAFF]: 1,
  [UserRole.REVIEWER]: 2,
  [UserRole.ADMIN]: 3,
};
