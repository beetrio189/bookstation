import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsersService } from '../modules/users/users.service';
import { RoleCode } from '../utils/enums/role-code.enum';
import { AppException } from '../utils/errors/app.exception';
import { ERRORS } from '../utils/errors/errors';
import { AuthUser } from '../utils/types/auth-user';

const extractBearerToken = (request: Request): string | undefined => {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' && token ? token : undefined;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    let userId: string;
    try {
      ({ sub: userId } = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
      ));
    } catch {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    // Tra DB mỗi request để khóa tài khoản và thu hồi role có hiệu lực ngay
    const user = await this.usersService.findByIdWithRoles(userId);

    if (!user) {
      throw new AppException(ERRORS.UNAUTHENTICATED);
    }

    if (user.lockedAt) {
      throw new AppException(ERRORS.ACCOUNT_LOCKED);
    }

    request.user = {
      id: user.id,
      email: user.email,
      roles: user.userRoles.map((userRole) => userRole.role.code as RoleCode),
    };

    return true;
  }
}
