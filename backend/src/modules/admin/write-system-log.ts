import { EntityManager } from 'typeorm';
import { SystemLog } from '../system-logs/entities/system-log.entity';
import { User } from '../users/entities/user.entity';

export type SystemLogEntry = Pick<
  SystemLog,
  'actionType' | 'targetId' | 'targetName' | 'note'
>;

/**
 * Ghi log hành động quản trị trong transaction đang mở. actor_name là tên
 * admin/KDV lúc làm. Người làm vừa qua JWT guard nên chắc chắn còn tồn tại:
 * không thấy thì là lỗi hệ thống (findOneOrFail ném lỗi, transaction rollback).
 */
export const writeSystemLog = async (
  manager: EntityManager,
  actorId: string,
  entry: SystemLogEntry,
): Promise<void> => {
  const actor = await manager.findOneOrFail(User, {
    select: { name: true },
    where: { id: actorId },
  });

  await manager.insert(SystemLog, {
    actorId,
    actorName: actor.name,
    ...entry,
  });
};
