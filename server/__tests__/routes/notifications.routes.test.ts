import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---- Helper ----
function createTestApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ---- Mocks (must be before route import) ----

vi.mock('../../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getUsers: vi.fn(),
    deleteUser: vi.fn(),
    getNotification: vi.fn(),
    getNotificationsForUser: vi.fn(),
    createNotification: vi.fn(),
    markNotificationAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    getLastKpiUpdateByUser: vi.fn(),
    getTeamActivitySummary: vi.fn(),
  },
}));

vi.mock('../../auth', () => ({
  jwtAuthMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: 'admin', email: 'admin@test.com', name: 'Test Admin', companyId: 1, areaId: 1 };
    next();
  },
  jwtAdminMiddleware: (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
  },
  loginUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue('mock-token'),
  verifyToken: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => vi.fn(),
  neonConfig: { webSocketConstructor: null },
  Pool: vi.fn(),
}));
vi.mock('ws', () => ({ default: class {} }));
vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pool: { query: vi.fn() },
}));
vi.mock('../../email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  createTeamMessageTemplate: vi.fn().mockReturnValue({ html: '<p>test</p>', text: 'test' }),
}));
vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('node-cache', () => ({
  default: class FakeNodeCache { flushAll() {} get() {} set() {} },
}));

import router from '../../routes/notifications';
import { storage } from '../../storage';

const app = createTestApp(router);

const mockNotification = {
  id: 1,
  fromUserId: 1,
  toUserId: 2,
  title: 'Test notification',
  message: 'Test message',
  type: 'info',
  read: false,
  companyId: 1,
  areaId: 1,
  createdAt: new Date('2025-01-01').toISOString(),
  priority: 'normal',
};

const mockNotification2 = {
  id: 2,
  fromUserId: 2,
  toUserId: 1,
  title: 'Another notification',
  message: 'Another message',
  type: 'warning',
  read: true,
  companyId: 1,
  areaId: 1,
  createdAt: new Date('2025-01-02').toISOString(),
  priority: 'high',
};

const mockNotificationUnread = {
  id: 3,
  fromUserId: 2,
  toUserId: 1,
  title: 'Unread notification',
  message: 'Unread message',
  type: 'info',
  read: false,
  companyId: 1,
  areaId: 1,
  createdAt: new Date('2025-01-03').toISOString(),
  priority: 'normal',
};

describe('Notifications Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/notifications
  // =========================================================================
  describe('GET /api/notifications', () => {
    it('should return notifications for the current user', async () => {
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([mockNotification, mockNotification2] as any);

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(storage.getNotificationsForUser).toHaveBeenCalledWith(1);
    });

    it('should return empty array when no notifications exist', async () => {
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([]);

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should filter out notifications from other companies', async () => {
      const otherCompanyNotification = {
        ...mockNotification,
        id: 99,
        companyId: 2,
      };
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([mockNotification, otherCompanyNotification] as any);

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      // User has companyId=1, so companyId=2 notifications are excluded
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(1);
    });
  });

  // =========================================================================
  // GET /api/notifications/unread-count
  // =========================================================================
  describe('GET /api/notifications/unread-count', () => {
    it('should return count of unread notifications', async () => {
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([
        mockNotification,       // read: false
        mockNotification2,      // read: true
        mockNotificationUnread, // read: false
      ] as any);

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 2);
    });

    it('should return 0 when all notifications are read', async () => {
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([
        { ...mockNotification, read: true },
      ] as any);

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 0);
    });
  });

  // =========================================================================
  // PUT /api/notifications/:id/read
  // =========================================================================
  describe('PUT /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      vi.mocked(storage.markNotificationAsRead).mockResolvedValue({ ...mockNotification, read: true } as any);

      const res = await request(app).put('/api/notifications/1/read');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('read', true);
      expect(storage.markNotificationAsRead).toHaveBeenCalledWith(1, 1);
    });

    it('should return 404 when notification is not found', async () => {
      vi.mocked(storage.markNotificationAsRead).mockResolvedValue(undefined as any);

      const res = await request(app).put('/api/notifications/999/read');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Notificación no encontrada');
    });

    it('should return 400 for invalid notification id', async () => {
      const res = await request(app).put('/api/notifications/abc/read');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'ID inválido');
    });
  });

  // =========================================================================
  // POST /api/notifications
  // =========================================================================
  describe('POST /api/notifications', () => {
    it('should create a notification and return 201', async () => {
      const notificationData = {
        toUserId: 2,
        title: 'New Alert',
        message: 'Something happened',
        type: 'warning',
        priority: 'high',
      };

      const recipient = {
        id: 2,
        name: 'Recipient',
        email: 'recipient@test.com',
        password: 'hashed',
        role: 'viewer',
        companyId: 1,
        areaId: 1,
      };

      vi.mocked(storage.createNotification).mockResolvedValue({
        id: 5, fromUserId: 1, ...notificationData, read: false, companyId: null, areaId: null, createdAt: new Date().toISOString(),
      } as any);
      vi.mocked(storage.getUser).mockResolvedValue(recipient as any);

      const res = await request(app).post('/api/notifications').send(notificationData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 5);
      expect(storage.createNotification).toHaveBeenCalled();
      expect(storage.getUser).toHaveBeenCalledWith(2);
    });

    it('should still return 201 even if recipient has no email', async () => {
      const notificationData = {
        toUserId: 2,
        title: 'New Alert',
        message: 'Something happened',
      };

      vi.mocked(storage.createNotification).mockResolvedValue({
        id: 6, fromUserId: 1, ...notificationData, read: false, companyId: null, areaId: null, createdAt: new Date().toISOString(),
      } as any);
      vi.mocked(storage.getUser).mockResolvedValue({ id: 2, name: 'No Email', email: null } as any);

      const res = await request(app).post('/api/notifications').send(notificationData);

      expect(res.status).toBe(201);
    });
  });

  // =========================================================================
  // DELETE /api/notifications/:id
  // =========================================================================
  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification successfully', async () => {
      vi.mocked(storage.deleteNotification).mockResolvedValue(true);

      const res = await request(app).delete('/api/notifications/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Notification deleted successfully');
      expect(storage.deleteNotification).toHaveBeenCalledWith(1, 1);
    });

    it('should return 404 when notification to delete is not found', async () => {
      vi.mocked(storage.deleteNotification).mockResolvedValue(false);

      const res = await request(app).delete('/api/notifications/999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Notification not found');
    });

    it('should return 500 when deleteNotification throws', async () => {
      vi.mocked(storage.deleteNotification).mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app).delete('/api/notifications/1');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', 'Internal server error');
    });

    it('should parse numeric id from string param', async () => {
      vi.mocked(storage.deleteNotification).mockResolvedValue(true);

      await request(app).delete('/api/notifications/42');

      expect(storage.deleteNotification).toHaveBeenCalledWith(42, 1);
    });
  });

  // =========================================================================
  // GET /api/notifications — Error handling
  // =========================================================================
  describe('GET /api/notifications — error handling', () => {
    it('should return 500 when storage.getNotificationsForUser throws', async () => {
      vi.mocked(storage.getNotificationsForUser).mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error obteniendo notificaciones');
    });

    it('should include broadcast notifications (companyId=null)', async () => {
      const broadcastNotification = {
        ...mockNotification,
        id: 50,
        companyId: null, // Broadcast — no company filter
      };
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([
        mockNotification,
        broadcastNotification,
      ] as any);

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[1].id).toBe(50);
    });
  });

  // =========================================================================
  // GET /api/notifications/unread-count — Error handling & edge cases
  // =========================================================================
  describe('GET /api/notifications/unread-count — error handling', () => {
    it('should return 500 when getNotificationsForUser throws', async () => {
      vi.mocked(storage.getNotificationsForUser).mockRejectedValue(new Error('Timeout'));

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error obteniendo conteo');
    });

    it('should return 0 when no notifications exist', async () => {
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([]);

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 0);
    });

    it('should exclude unread notifications from other companies', async () => {
      const otherCompanyUnread = {
        ...mockNotificationUnread,
        id: 77,
        companyId: 2, // Different from auth user companyId=1
      };
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([
        mockNotificationUnread, // read: false, companyId: 1
        otherCompanyUnread,     // read: false, companyId: 2
      ] as any);

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 1); // Only the one matching companyId=1
    });

    it('should count broadcast unread notifications (companyId=null)', async () => {
      const broadcastUnread = {
        ...mockNotificationUnread,
        id: 88,
        companyId: null,
      };
      vi.mocked(storage.getNotificationsForUser).mockResolvedValue([broadcastUnread] as any);

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 1);
    });
  });

  // =========================================================================
  // PUT /api/notifications/:id/read — Error handling
  // =========================================================================
  describe('PUT /api/notifications/:id/read — error handling', () => {
    it('should return 500 when markNotificationAsRead throws', async () => {
      vi.mocked(storage.markNotificationAsRead).mockRejectedValue(new Error('Constraint violation'));

      const res = await request(app).put('/api/notifications/1/read');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error actualizando notificación');
    });

    it('should handle negative id as valid number', async () => {
      vi.mocked(storage.markNotificationAsRead).mockResolvedValue(undefined as any);

      const res = await request(app).put('/api/notifications/-1/read');

      // -1 is a valid number (not NaN), so it should call markNotificationAsRead
      expect(res.status).toBe(404);
      expect(storage.markNotificationAsRead).toHaveBeenCalledWith(-1, 1);
    });

    it('should handle zero id as valid number', async () => {
      vi.mocked(storage.markNotificationAsRead).mockResolvedValue(undefined as any);

      const res = await request(app).put('/api/notifications/0/read');

      expect(res.status).toBe(404);
      expect(storage.markNotificationAsRead).toHaveBeenCalledWith(0, 1);
    });

    it('should handle floating-point id by truncating to integer', async () => {
      vi.mocked(storage.markNotificationAsRead).mockResolvedValue(undefined as any);

      const res = await request(app).put('/api/notifications/3.7/read');

      // parseInt('3.7') === 3
      expect(storage.markNotificationAsRead).toHaveBeenCalledWith(3, 1);
    });
  });

  // =========================================================================
  // POST /api/notifications — Error handling & edge cases
  // =========================================================================
  describe('POST /api/notifications — error handling', () => {
    it('should return 500 when createNotification throws', async () => {
      vi.mocked(storage.createNotification).mockRejectedValue(new Error('Insert failed'));

      const res = await request(app).post('/api/notifications').send({
        toUserId: 2,
        title: 'Fail',
        message: 'Will fail',
      });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', 'Internal server error');
    });

    it('should still return 201 when recipient is not found', async () => {
      vi.mocked(storage.createNotification).mockResolvedValue({
        id: 10, fromUserId: 1, toUserId: 99, title: 'Test', message: 'Msg',
        read: false, companyId: null, areaId: null, createdAt: new Date().toISOString(),
      } as any);
      vi.mocked(storage.getUser).mockResolvedValue(null as any);

      const res = await request(app).post('/api/notifications').send({
        toUserId: 99,
        title: 'Test',
        message: 'Msg',
      });

      expect(res.status).toBe(201);
    });

    it('should send email with correct parameters when recipient has email', async () => {
      const { sendEmail, createTeamMessageTemplate } = await import('../../email');

      const notificationData = {
        toUserId: 2,
        title: 'Urgent Alert',
        message: 'Please review',
        type: 'warning',
        priority: 'high',
      };

      vi.mocked(storage.createNotification).mockResolvedValue({
        id: 11, fromUserId: 1, ...notificationData, read: false,
        companyId: null, areaId: null, createdAt: new Date().toISOString(),
      } as any);
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 2, name: 'Recipient', email: 'recipient@test.com',
        password: 'hashed', role: 'viewer', companyId: 1, areaId: 1,
      } as any);

      await request(app).post('/api/notifications').send(notificationData);

      expect(createTeamMessageTemplate).toHaveBeenCalledWith(
        'Test Admin',    // from user name (mocked auth user)
        'Recipient',     // to user name
        'Urgent Alert',
        'Please review',
        'warning',
        'high',
      );
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'recipient@test.com',
        subject: '[Econova] Urgent Alert',
      }));
    });

    it('should use default type and priority when not provided', async () => {
      const { createTeamMessageTemplate } = await import('../../email');

      vi.mocked(storage.createNotification).mockResolvedValue({
        id: 12, fromUserId: 1, toUserId: 2, title: 'Default', message: 'No type/priority',
        read: false, companyId: null, areaId: null, createdAt: new Date().toISOString(),
      } as any);
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 2, name: 'Recipient', email: 'r@test.com',
        password: 'hashed', role: 'viewer', companyId: 1, areaId: 1,
      } as any);

      await request(app).post('/api/notifications').send({
        toUserId: 2,
        title: 'Default',
        message: 'No type/priority',
      });

      expect(createTeamMessageTemplate).toHaveBeenCalledWith(
        'Test Admin',
        'Recipient',
        'Default',
        'No type/priority',
        'info',    // default type
        'normal',  // default priority
      );
    });

    it('should handle email sending failure gracefully (still 201)', async () => {
      const { sendEmail } = await import('../../email');
      vi.mocked(sendEmail).mockResolvedValue(false);

      vi.mocked(storage.createNotification).mockResolvedValue({
        id: 13, fromUserId: 1, toUserId: 2, title: 'T', message: 'M',
        read: false, companyId: null, areaId: null, createdAt: new Date().toISOString(),
      } as any);
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 2, name: 'R', email: 'r@test.com',
        password: 'hashed', role: 'viewer', companyId: 1, areaId: 1,
      } as any);

      const res = await request(app).post('/api/notifications').send({
        toUserId: 2,
        title: 'T',
        message: 'M',
      });

      expect(res.status).toBe(201);
    });

    it('should include fromUserId from authenticated user', async () => {
      vi.mocked(storage.createNotification).mockResolvedValue({
        id: 14, fromUserId: 1, toUserId: 2, title: 'T', message: 'M',
        read: false, companyId: null, areaId: null, createdAt: new Date().toISOString(),
      } as any);
      vi.mocked(storage.getUser).mockResolvedValue(null as any);

      await request(app).post('/api/notifications').send({
        toUserId: 2,
        title: 'T',
        message: 'M',
      });

      // Verify fromUserId was set to auth user id (1)
      const callArg = vi.mocked(storage.createNotification).mock.calls[0][0] as any;
      expect(callArg.fromUserId).toBe(1);
    });
  });

  // =========================================================================
  // GET /api/team-activity
  // =========================================================================
  describe('GET /api/team-activity', () => {
    it('should return team activity summary', async () => {
      const activitySummary = [
        { userId: 1, name: 'Admin', lastActive: '2025-01-01', kpiCount: 5 },
        { userId: 2, name: 'User', lastActive: '2025-01-02', kpiCount: 3 },
      ];
      vi.mocked(storage.getTeamActivitySummary).mockResolvedValue(activitySummary as any);

      const res = await request(app).get('/api/team-activity');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(activitySummary);
      expect(storage.getTeamActivitySummary).toHaveBeenCalled();
    });

    it('should return 500 when getTeamActivitySummary throws', async () => {
      vi.mocked(storage.getTeamActivitySummary).mockRejectedValue(new Error('DB down'));

      const res = await request(app).get('/api/team-activity');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', 'Internal server error');
    });

    it('should return empty array when no team activity', async () => {
      vi.mocked(storage.getTeamActivitySummary).mockResolvedValue([] as any);

      const res = await request(app).get('/api/team-activity');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // =========================================================================
  // GET /api/users/:id/last-kpi-update
  // =========================================================================
  describe('GET /api/users/:id/last-kpi-update', () => {
    it('should return last KPI update for the user', async () => {
      const lastUpdate = { updatedAt: '2025-01-15T10:00:00Z', kpiName: 'Revenue' };
      vi.mocked(storage.getLastKpiUpdateByUser).mockResolvedValue(lastUpdate as any);

      const res = await request(app).get('/api/users/5/last-kpi-update');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(lastUpdate);
      expect(storage.getLastKpiUpdateByUser).toHaveBeenCalledWith(5);
    });

    it('should return 500 when getLastKpiUpdateByUser throws', async () => {
      vi.mocked(storage.getLastKpiUpdateByUser).mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/users/5/last-kpi-update');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', 'Internal server error');
    });

    it('should return null when user has no KPI updates', async () => {
      vi.mocked(storage.getLastKpiUpdateByUser).mockResolvedValue(null as any);

      const res = await request(app).get('/api/users/99/last-kpi-update');

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('should parse numeric user id from route param', async () => {
      vi.mocked(storage.getLastKpiUpdateByUser).mockResolvedValue(null as any);

      await request(app).get('/api/users/42/last-kpi-update');

      expect(storage.getLastKpiUpdateByUser).toHaveBeenCalledWith(42);
    });
  });
});
