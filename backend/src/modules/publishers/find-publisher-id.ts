import { EntityManager } from 'typeorm';
import { AppException } from '../../utils/errors/app.exception';
import { ERRORS } from '../../utils/errors/errors';
import { Editor } from './entities/editor.entity';
import { Publisher } from './entities/publisher.entity';

/**
 * publishers.id của NXB mà user (users.id từ JWT) là chủ (isOwner) hoặc biên tập viên.
 * Không thấy (tài khoản vừa bị xóa) → 404.
 */
export const findPublisherId = async (
  manager: EntityManager,
  userId: string,
  isOwner: boolean,
): Promise<string> => {
  const publisherId = isOwner
    ? (await manager.findOneBy(Publisher, { userId }))?.id
    : (await manager.findOneBy(Editor, { userId }))?.publisherId;

  if (!publisherId) {
    throw new AppException(ERRORS.NOT_FOUND);
  }

  return publisherId;
};
