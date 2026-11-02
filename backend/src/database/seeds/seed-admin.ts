import { Logger } from '@nestjs/common';
import { z } from 'zod';
import dataSource from '../../libs/typeorm.config';
import { Role } from '../../modules/users/entities/role.entity';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { User } from '../../modules/users/entities/user.entity';
import { RoleCode } from '../../utils/enums/role-code.enum';
import { hashPassword, isPasswordWithinLimit } from '../../utils/password';

const logger = new Logger('SeedAdmin');

const adminSchema = z.object({
  ADMIN_EMAIL: z.email().toLowerCase(),
  ADMIN_PASSWORD: z.string().min(8).refine(isPasswordWithinLimit),
  ADMIN_DISPLAY_NAME: z.string().min(1).max(100).default('Quản trị viên'),
});

async function seedAdmin() {
  const admin = adminSchema.parse(process.env);

  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const role = await manager.findOneBy(Role, { code: RoleCode.ADMIN });

      if (!role) {
        throw new Error('Role admin not found, run the migrations first');
      }

      let user = await manager.findOneBy(User, { email: admin.ADMIN_EMAIL });

      if (user) {
        logger.warn(`User ${user.email} already exists, password unchanged`);
      } else {
        user = await manager.save(
          manager.create(User, {
            email: admin.ADMIN_EMAIL,
            passwordHash: await hashPassword(admin.ADMIN_PASSWORD),
            displayName: admin.ADMIN_DISPLAY_NAME,
            emailVerifiedAt: new Date(),
          }),
        );
      }

      await manager.upsert(UserRole, { userId: user.id, roleId: role.id }, [
        'userId',
        'roleId',
      ]);

      logger.log(`User ${user.email} has the admin role`);
    });
  } finally {
    await dataSource.destroy();
  }
}

seedAdmin().catch((error: unknown) => {
  logger.error(error);
  process.exit(1);
});
