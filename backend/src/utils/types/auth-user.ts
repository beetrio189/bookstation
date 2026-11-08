import { RoleCode } from '../enums/role-code.enum';

export interface AuthUser {
  id: string;
  role: RoleCode;
}
