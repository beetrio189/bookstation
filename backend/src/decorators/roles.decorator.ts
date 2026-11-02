import { SetMetadata } from '@nestjs/common';
import { RoleCode } from '../utils/enums/role-code.enum';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
