import { RoleCode } from '../enums/role-code.enum';

export interface JwtPayload {
  sub: string;
  notificationEmail: string;
  role: RoleCode;
}
