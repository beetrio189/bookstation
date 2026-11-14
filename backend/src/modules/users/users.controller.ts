import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthUser } from '../../utils/types/auth-user';
import { UsersService } from './users.service';

// Nằm ngoài /api/auth để cookie refresh token (path /api/auth) không bị gửi kèm
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }
}
