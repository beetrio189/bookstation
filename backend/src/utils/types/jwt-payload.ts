import { RoleCode } from '../enums/role-code.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: RoleCode[];
}
