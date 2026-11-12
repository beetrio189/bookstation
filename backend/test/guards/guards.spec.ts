import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CurrentUser } from '../../src/decorators/current-user.decorator';
import { Public } from '../../src/decorators/public.decorator';
import { Roles } from '../../src/decorators/roles.decorator';
import { AllExceptionsFilter } from '../../src/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/interceptors/response.interceptor';
import { RoleCode } from '../../src/utils/enums/role-code.enum';
import { AuthUser } from '../../src/utils/types/auth-user';
import { JwtPayload } from '../../src/utils/types/jwt-payload';
import { JwtAuthGuard } from '../../src/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/guards/roles.guard';

const SECRET = 'test-secret-that-is-at-least-32-chars';

@Controller('test')
class TestController {
  @Public()
  @Get('public')
  open(@CurrentUser() user?: AuthUser) {
    return { loggedIn: Boolean(user) };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Roles(RoleCode.ADMIN)
  @Get('admin')
  admin() {
    return { ok: true };
  }
}

@Roles(RoleCode.EDITOR, RoleCode.ADMIN)
@Controller('staff')
class StaffController {
  @Get()
  list() {
    return { ok: true };
  }
}

const payloadFor = (id: string, role: RoleCode): JwtPayload => ({
  sub: id,
  role,
});

const READER = payloadFor('reader', RoleCode.READER);
const EDITOR = payloadFor('editor', RoleCode.EDITOR);
const ADMIN = payloadFor('admin', RoleCode.ADMIN);

describe('JwtAuthGuard + RolesGuard', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      controllers: [TestController, StaffController],
      providers: [
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(() => app.close());

  it('lets anyone through a @Public() route', async () => {
    await get('/test/public')
      .expect(200)
      .expect({ data: { loggedIn: false } });
  });

  it('skips token checks on a @Public() route even with a bad token', async () => {
    await get('/test/public', 'garbage').expect(200);
  });

  it.each([
    ['no token', undefined],
    ['a malformed token', 'garbage'],
    [
      'a token signed with another secret',
      new JwtService({ secret: 'x'.repeat(40) }).sign(READER),
    ],
  ])('rejects %s with UNAUTHENTICATED', async (_case, token) => {
    await get('/test/me', token)
      .expect(401)
      .expect({ error: { code: 1001, message: 'Bạn chưa đăng nhập' } });
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({
      ...READER,
      exp: Math.floor(Date.now() / 1000) - 10,
    });

    await get('/test/me', expired).expect(401);
  });

  it('rejects a non-Bearer authorization header', async () => {
    await request(app.getHttpServer())
      .get('/test/me')
      .set('Authorization', `Basic ${jwt.sign(READER)}`)
      .expect(401);
  });

  it('exposes the token claims through @CurrentUser()', async () => {
    await get('/test/me', jwt.sign(EDITOR))
      .expect(200)
      .expect({
        data: {
          id: 'editor',
          role: 'editor',
        },
      });
  });

  it('applies @Roles() on a route', async () => {
    await get('/test/admin', jwt.sign(READER))
      .expect(403)
      .expect({
        error: {
          code: 1002,
          message: 'Bạn không có quyền thực hiện thao tác này',
        },
      });
    await get('/test/admin', jwt.sign(ADMIN)).expect(200);
  });

  it('applies @Roles() on a controller and accepts any listed role', async () => {
    await get('/staff', jwt.sign(READER)).expect(403);
    await get('/staff', jwt.sign(EDITOR)).expect(200);
    await get('/staff', jwt.sign(ADMIN)).expect(200);
  });
});
