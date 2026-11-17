import { Repository } from 'typeorm';
import { Provider } from '../../../src/modules/users/entities/provider.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { UsersService } from '../../../src/modules/users/users.service';

describe('UsersService', () => {
  const usersRepository = { findOne: jest.fn() };
  const providersRepository = { update: jest.fn(), find: jest.fn() };
  const service = new UsersService(
    usersRepository as unknown as Repository<User>,
    providersRepository as unknown as Repository<Provider>,
  );

  beforeEach(() => jest.resetAllMocks());

  describe('getProfile', () => {
    it('returns the profile and only the names of the linked logins', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'user-1',
        name: 'Wing',
        notificationEmail: 'a@example.com',
        avatarUrl: null,
        bio: null,
        role: 'reader',
        status: 'active',
        providers: [
          {
            provider: 'local',
            providerKey: 'a@example.com',
            passwordHash: 'x',
          },
          { provider: 'google', providerKey: 'google-sub-1' },
        ],
      });

      await expect(service.getProfile('user-1')).resolves.toEqual({
        id: 'user-1',
        name: 'Wing',
        notificationEmail: 'a@example.com',
        avatarUrl: null,
        bio: null,
        role: 'reader',
        providers: ['local', 'google'],
      });
    });

    it('rejects a user that no longer exists', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('user-1')).rejects.toMatchObject({
        code: 1001,
      });
    });
  });

  describe('setLocalPasswordHash', () => {
    it('updates only the local login of the user', async () => {
      providersRepository.update.mockResolvedValue({ affected: 1 });

      await expect(
        service.setLocalPasswordHash('user-1', 'hash'),
      ).resolves.toBe(true);
      expect(providersRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', provider: 'local' },
        { passwordHash: 'hash' },
      );
    });

    it('returns false when the local login no longer exists', async () => {
      providersRepository.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.setLocalPasswordHash('user-1', 'hash'),
      ).resolves.toBe(false);
    });
  });

  describe('clearLocalPasswordHash', () => {
    it('clears the password only while it is still the given hash', async () => {
      providersRepository.update.mockResolvedValue({ affected: 1 });

      await service.clearLocalPasswordHash('user-1', 'hash');

      expect(providersRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', provider: 'local', passwordHash: 'hash' },
        { passwordHash: null },
      );
    });
  });

  describe('findStatus', () => {
    it('reads only the status column', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'user-1',
        status: 'locked',
      });

      await expect(service.findStatus('user-1')).resolves.toBe('locked');
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        select: { id: true, status: true },
        where: { id: 'user-1' },
      });
    });

    it('returns null for a missing user', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.findStatus('user-1')).resolves.toBeNull();
    });
  });

  describe('findProviderTypes', () => {
    it('lists each login type of the user once', async () => {
      providersRepository.find.mockResolvedValue([
        { provider: 'local' },
        { provider: 'google' },
        { provider: 'google' },
      ]);

      await expect(service.findProviderTypes('user-1')).resolves.toEqual([
        'local',
        'google',
      ]);
      expect(providersRepository.find).toHaveBeenCalledWith({
        select: { provider: true },
        where: { userId: 'user-1' },
      });
    });
  });
});
