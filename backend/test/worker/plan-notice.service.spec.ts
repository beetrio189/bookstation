import { DataSource } from 'typeorm';
import { MailQueueService } from '../../src/modules/mail/mail-queue.service';
import { PlanNoticeService } from '../../src/worker/plan-notice.service';

describe('PlanNoticeService', () => {
  const manager = { query: jest.fn() };
  const dataSource = { query: jest.fn(), manager };
  const mailQueueService = { enqueuePlanUpdatedNotices: jest.fn() };
  const service = new PlanNoticeService(
    dataSource as unknown as DataSource,
    mailQueueService as unknown as MailQueueService,
  );
  const PLAN = {
    name: 'Basic Plus',
    price: 600000,
    bookLimit: 100000,
    editorLimit: 2,
  };

  beforeEach(() => jest.resetAllMocks());

  it('reads the plan again and sends one notice per subscriber with their old plan name', async () => {
    dataSource.query.mockResolvedValue([{ ...PLAN, isFree: false }]);
    manager.query.mockResolvedValue([
      {
        userId: 'user-1',
        email: 'a@example.com',
        planName: 'basic',
        periodEndsAt: new Date('2027-05-01T00:00:00.000Z'),
      },
    ]);

    await service.fanOutPlanUpdated('plan-1');

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'plan-1',
    ]);
    // Chỉ NXB đang dùng gói này, chưa bị khóa
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pm.plan_id = $1'),
      ['plan-1', 'active'],
    );
    expect(mailQueueService.enqueuePlanUpdatedNotices).toHaveBeenCalledWith([
      {
        userId: 'user-1',
        email: 'a@example.com',
        plan: PLAN,
        isFree: false,
        oldPlanName: 'basic',
        periodEndsAt: '2027-05-01T00:00:00.000Z',
      },
    ]);
  });

  it('sends the Free plan notice only to publishers without a running paid period', async () => {
    dataSource.query.mockResolvedValue([
      { ...PLAN, name: 'Free', price: 0, isFree: true },
    ]);
    manager.query.mockResolvedValue([
      { userId: 'user-2', email: 'b@example.com' },
    ]);

    await service.fanOutPlanUpdated('plan-free');

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
      ['active'],
    );
    expect(mailQueueService.enqueuePlanUpdatedNotices).toHaveBeenCalledWith([
      {
        userId: 'user-2',
        email: 'b@example.com',
        plan: { ...PLAN, name: 'Free', price: 0 },
        isFree: true,
      },
    ]);
  });

  it('does nothing when the plan was deleted in the meantime', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.fanOutPlanUpdated('plan-1');

    expect(manager.query).not.toHaveBeenCalled();
    expect(mailQueueService.enqueuePlanUpdatedNotices).not.toHaveBeenCalled();
  });
});
