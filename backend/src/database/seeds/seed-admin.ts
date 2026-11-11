import { Logger } from '@nestjs/common';
import { z } from 'zod';
import dataSource from '../../libs/typeorm.config';
import { Provider } from '../../modules/users/entities/provider.entity';
import { User } from '../../modules/users/entities/user.entity';
import { IdentityProvider } from '../../utils/enums/identity-provider.enum';
import { RoleCode } from '../../utils/enums/role-code.enum';
import {
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../../utils/password';

const logger = new Logger('SeedAdmin');

const adminSchema = z.object({
  ADMIN_EMAIL: z.email().toLowerCase(),
  ADMIN_PASSWORD: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .regex(PASSWORD_PATTERN),
  ADMIN_DISPLAY_NAME: z.string().min(1).max(100).default('Quản trị viên'),
});

async function seedAdmin() {
  const admin = adminSchema.parse(process.env);

  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(Provider, {
        provider: IdentityProvider.LOCAL,
        providerKey: admin.ADMIN_EMAIL,
      });

      if (existing) {
        logger.warn(`Account ${admin.ADMIN_EMAIL} already exists, unchanged`);
        return;
      }

      const user = await manager.save(
        manager.create(User, {
          role: RoleCode.ADMIN,
          name: admin.ADMIN_DISPLAY_NAME,
          notificationEmail: admin.ADMIN_EMAIL,
          notificationEmailVerified: true,
        }),
      );

      await manager.insert(Provider, {
        userId: user.id,
        provider: IdentityProvider.LOCAL,
        providerKey: admin.ADMIN_EMAIL,
        passwordHash: await hashPassword(admin.ADMIN_PASSWORD),
        verified: true,
      });

      logger.log(`Created admin ${admin.ADMIN_EMAIL}`);
    });
  } finally {
    await dataSource.destroy();
  }
}

seedAdmin().catch((error: unknown) => {
  logger.error(error);
  process.exit(1);
});
