import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RoleCode } from '../../utils/enums/role-code.enum';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByIdWithRoles(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: { userRoles: { role: true } },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  createReader(data: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<User> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const role = await manager.findOneByOrFail(Role, {
        code: RoleCode.READER,
      });
      const user = await manager.save(manager.create(User, data));

      await manager.insert(UserRole, { userId: user.id, roleId: role.id });

      return user;
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.usersRepository.update(
      { id, emailVerifiedAt: IsNull() },
      { emailVerifiedAt: new Date() },
    );
  }
}
