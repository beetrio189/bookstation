import { IdentityProvider } from '../enums/identity-provider.enum';
import { RoleCode } from '../enums/role-code.enum';

export interface JwtPayload {
  sub: string;
  role: RoleCode;
  // Các cách đăng nhập của tài khoản: FE chỉ hiện "Đổi mật khẩu" khi có local
  providers: IdentityProvider[];
}
