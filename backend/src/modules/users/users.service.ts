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
          notificationEmailVerified: true,
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

  async markLocalVerified(userId: string): Promise<void> {
    await this.providersRepository.update(
      { userId, provider: IdentityProvider.LOCAL },
      { verified: true },
    );
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
}
