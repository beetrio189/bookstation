import { Repository } from 'typeorm';
import { Provider } from '../../../src/modules/users/entities/provider.entity';
import { User } from '../../../src/modules/users/entities/user.entity';
import { UsersService } from '../../../src/modules/users/users.service';

describe('UsersService', () => {
  const usersRepository = { findOne: jest.fn() };
  const service = new UsersService(
    usersRepository as unknown as Repository<User>,
    {} as Repository<Provider>,
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
});
