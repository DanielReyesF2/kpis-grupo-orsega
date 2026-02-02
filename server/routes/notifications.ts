import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { sendEmail, createTeamMessageTemplate } from '../email';

const router = Router();

// GET /api/notifications - Obtener notificaciones del usuario
router.get("/api/notifications", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const allNotifications = await storage.getNotificationsForUser(user.id);
    // Filter by companyId — include broadcasts (companyId=null) and user's company
    const filtered = allNotifications.filter(
      n => !n.companyId || n.companyId === user.companyId
    );
    res.json(filtered);
  } catch (error) {
    console.error('[Notifications] Error fetching notifications:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

// GET /api/notifications/unread-count - Count de notificaciones no leídas
router.get("/api/notifications/unread-count", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const allNotifications = await storage.getNotificationsForUser(user.id);
    const unread = allNotifications.filter(
      n => !n.read && (!n.companyId || n.companyId === user.companyId)
    );
    res.json({ count: unread.length });
  } catch (error) {
    console.error('[Notifications] Error fetching unread count:', error);
    res.status(500).json({ error: 'Error obteniendo conteo' });
  }
});

// PUT /api/notifications/:id/read - Marcar notificación como leída
router.put("/api/notifications/:id/read", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const updated = await storage.markNotificationAsRead(notificationId, user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    res.json(updated);
  } catch (error) {
    console.error('[Notifications] Error marking as read:', error);
    res.status(500).json({ error: 'Error actualizando notificación' });
  }
});

// POST /api/notifications - Crear notificación y enviar correo
router.post("/api/notifications", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const notificationData = {
      ...req.body,
      fromUserId: user.id
    };

    console.log("[POST /api/notifications] Creando notificación:", notificationData);

    // Crear notificación en la base de datos
    const notification = await storage.createNotification(notificationData);

    // Obtener información del destinatario para enviar el correo
    const recipient = await storage.getUser(notificationData.toUserId);

    if (recipient && recipient.email) {
      console.log("[POST /api/notifications] Enviando correo a:", recipient.email);

      // Crear template del correo
      const { html, text } = createTeamMessageTemplate(
        user.name,
        recipient.name,
        notificationData.title,
        notificationData.message,
        notificationData.type || 'info',
        notificationData.priority || 'normal'
      );

      // Enviar correo electrónico usando el correo de Mario Reynoso
      const emailSent = await sendEmail({
        to: recipient.email,
        from: 'Mario Reynoso <marioreynoso@grupoorsega.com>', // Correo verificado de Mario Reynoso con nombre
        subject: `[Econova] ${notificationData.title}`,
        html,
        text
      });

      if (emailSent) {
        console.log("[POST /api/notifications] Correo enviado exitosamente");
      } else {
        console.error("[POST /api/notifications] Error al enviar correo");
      }
    } else {
      console.warn("[POST /api/notifications] Destinatario no encontrado o sin email");
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error("[POST /api/notifications] Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/notifications/:id - Eliminar notificación
router.delete("/api/notifications/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = getAuthUser(req as AuthRequest);

    const success = await storage.deleteNotification(id, user.id);

    if (!success) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Team Activity routes
router.get("/api/team-activity", jwtAuthMiddleware, async (req, res) => {
  try {
    console.log("[GET /api/team-activity] Obteniendo resumen de actividad del equipo");
    const activitySummary = await storage.getTeamActivitySummary();
    console.log("[GET /api/team-activity] Resumen obtenido:", activitySummary);
    res.json(activitySummary);
  } catch (error) {
    console.error("Error getting team activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/api/users/:id/last-kpi-update", jwtAuthMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const lastUpdate = await storage.getLastKpiUpdateByUser(userId);
    res.json(lastUpdate);
  } catch (error) {
    console.error("Error getting last KPI update:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
