import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleCode } from '../utils/enums/role-code.enum';
import { AppException } from '../utils/errors/app.exception';
import { ERRORS } from '../utils/errors/errors';
import { AuthUser } from '../utils/types/auth-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    if (!requiredRoles.some((role) => user.roles.includes(role))) {
      throw new AppException(ERRORS.FORBIDDEN);
    }

    return true;
  }
}
