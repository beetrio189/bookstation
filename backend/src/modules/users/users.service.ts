import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdentityProvider } from '../../utils/enums/identity-provider.enum';
import { RoleCode } from '../../utils/enums/role-code.enum';
import { Provider } from './entities/provider.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Provider)
    private readonly providersRepository: Repository<Provider>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findLocalProvider(email: string): Promise<Provider | null> {
    return this.providersRepository.findOne({
      where: { provider: IdentityProvider.LOCAL, providerKey: email },
      relations: { user: true },
    });
  }

  findLocalProviderForLogin(email: string): Promise<Provider | null> {
    return this.providersRepository
      .createQueryBuilder('provider')
      .addSelect('provider.passwordHash')
      .innerJoinAndSelect('provider.user', 'user')
      .where('provider.provider = :provider', {
        provider: IdentityProvider.LOCAL,
      })
      .andWhere('provider.providerKey = :email', { email })
      .getOne();
  }

  findLocalProviderWithPassword(userId: string): Promise<Provider | null> {
    return this.providersRepository
      .createQueryBuilder('provider')
      .addSelect('provider.passwordHash')
      .where('provider.provider = :provider', {
        provider: IdentityProvider.LOCAL,
      })
      .andWhere('provider.userId = :userId', { userId })
      .getOne();
  }

  createReader(data: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<User> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, {
          role: RoleCode.READER,
          name: data.name,
          notificationEmail: data.email,
          notificationEmailVerified: false,
        }),
      );

      await manager.insert(Provider, {
        userId: user.id,
        provider: IdentityProvider.LOCAL,
        providerKey: data.email,
        passwordHash: data.passwordHash,
        verified: false,
      });

      return user;
    });
  }

  findGoogleProvider(sub: string): Promise<Provider | null> {
    return this.providersRepository.findOne({
      where: { provider: IdentityProvider.GOOGLE, providerKey: sub },
      relations: { user: true },
    });
  }

  createGoogleReader(data: {
    sub: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }): Promise<User> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, {
          role: RoleCode.READER,
          name: data.name,
          notificationEmail: data.email,
          notificationEmailVerified: true,
          avatarUrl: data.avatarUrl,
        }),
      );

      await manager.insert(Provider, {
        userId: user.id,
        provider: IdentityProvider.GOOGLE,
        providerKey: data.sub,
        verified: true,
      });

      return user;
    });
  }

  /**
   * Đánh dấu email đăng nhập local đã xác minh. Nếu email nhận thông báo của
   * user chưa xác minh thì lấy luôn email vừa xác minh làm email nhận thông báo.
   * Trả về false khi user không còn provider local (ví dụ đã bị job xóa).
   */
  markLocalVerified(userId: string): Promise<boolean> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const provider = await manager.findOne(Provider, {
        where: { userId, provider: IdentityProvider.LOCAL },
        lock: { mode: 'pessimistic_write' },
      });

      if (!provider) {
        return false;
      }

      await manager.update(Provider, { id: provider.id }, { verified: true });
      await manager.update(
        User,
        { id: userId, notificationEmailVerified: false },
        {
          notificationEmail: provider.providerKey,
          notificationEmailVerified: true,
        },
      );

      return true;
    });
  }

  async updateLocalPassword(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.providersRepository.update(
      { userId, provider: IdentityProvider.LOCAL },
      { passwordHash },
    );
  }

  async deleteUnverifiedLocalUsers(createdBefore: Date): Promise<number> {
    const [rows] = (await this.usersRepository.query(
      `
        WITH deleted_providers AS (
          DELETE FROM "providers" p
          WHERE p."verified" = false
            AND p."created_at" < $1
            AND NOT EXISTS (
              SELECT 1 FROM "providers" o
              WHERE o."user_id" = p."user_id" AND o."id" <> p."id"
            )
          RETURNING p."user_id"
        )
        DELETE FROM "users" u
        USING deleted_providers d
        WHERE u."id" = d."user_id"
        RETURNING u."id"
      `,
      [createdBefore],
    )) as [unknown[], number];

    return rows.length;
  }
}
