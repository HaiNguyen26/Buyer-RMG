import { prisma } from '../config/database';
import { Server as SocketIOServer } from 'socket.io';
import { emitNotification } from '../config/socket';

export interface CreateNotificationParams {
  userId: string;
  role: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  metadata?: any;
  companyId?: string | null;
}

/**
 * Create notification and emit via Socket.IO
 * Prevents duplicate notifications (1 PR / 1 status = 1 notification)
 */
export async function createNotification(
  io: SocketIOServer | null,
  params: CreateNotificationParams
): Promise<string | null> {
  try {
    // Check for existing unread notification with same type and relatedId
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: params.userId,
        type: params.type as any,
        relatedId: params.relatedId || null,
        status: 'UNREAD',
        deletedAt: null,
      },
    });

    // If notification already exists and is unread, don't create duplicate
    if (existingNotification) {
      console.log('⚠️ Notification already exists (unread), returning existing ID:', existingNotification.id);
      // Still emit the notification via Socket.IO in case user is online
      if (io) {
        try {
          console.log('📡 Re-emitting existing notification via Socket.IO to user:', params.userId);
          await emitNotification(io, params.userId, {
            type: params.type,
            title: params.title,
            message: params.message,
            data: {
              notificationId: existingNotification.id,
              relatedId: params.relatedId,
              relatedType: params.relatedType,
              metadata: params.metadata,
            },
          });
        } catch (socketError) {
          console.error('❌ Failed to re-emit notification via Socket.IO:', socketError);
        }
      }
      return existingNotification.id;
    }

    // Create new notification
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        role: params.role,
        type: params.type as any,
        title: params.title,
        message: params.message,
        relatedId: params.relatedId,
        relatedType: params.relatedType,
        metadata: params.metadata || {},
        companyId: params.companyId || null,
        status: 'UNREAD',
      },
    });

    console.log('✅ Notification created:', {
      id: notification.id,
      userId: params.userId,
      role: params.role,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedId: params.relatedId,
    });

    // Emit real-time notification via Socket.IO
    if (io) {
      try {
        console.log('📡 Emitting notification via Socket.IO to user:', params.userId);
        await emitNotification(io, params.userId, {
          type: params.type,
          title: params.title,
          message: params.message,
          data: {
            notificationId: notification.id,
            relatedId: params.relatedId,
            relatedType: params.relatedType,
            metadata: params.metadata,
          },
        });
        console.log('✅ Notification emitted successfully');
      } catch (socketError) {
        // Log but don't fail if Socket.IO is not available
        console.error('❌ Failed to emit notification via Socket.IO:', socketError);
      }
    } else {
      console.warn('⚠️ Socket.IO not available (io is null)');
    }

    return notification.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: userId, // Ensure user can only mark their own notifications as read
        deletedAt: null,
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark notification as resolved (auto-hide when workflow continues)
 */
export async function markNotificationAsResolved(
  relatedId: string,
  relatedType: string,
  type: string
): Promise<boolean> {
  try {
    await prisma.notification.updateMany({
      where: {
        relatedId: relatedId,
        relatedType: relatedType,
        type: type as any,
        status: { in: ['UNREAD', 'READ'] },
        deletedAt: null,
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    console.error('Error marking notification as resolved:', error);
    return false;
  }
}

/**
 * Get unread notification count for user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: userId,
        status: 'UNREAD',
        deletedAt: null,
      },
    });
    return count;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
}

/**
 * Notification templates for each role
 */
export const NotificationTemplates = {
  // REQUESTOR
  PR_DEPARTMENT_HEAD_APPROVED: (prNumber: string) => ({
    title: 'PR được duyệt',
    message: `PR ${prNumber} đã được quản lý trực tiếp duyệt`,
  }),
  PR_BRANCH_MANAGER_APPROVED: (prNumber: string) => ({
    title: 'PR được duyệt',
    message: `PR ${prNumber} đã được duyệt – chờ Buyer Leader phân công`,
  }),
  PR_RETURNED: (prNumber: string, reason?: string) => ({
    title: 'PR bị trả',
    message: `PR ${prNumber} bị trả${reason ? ` - ${reason}` : ''} – vui lòng xem lý do`,
  }),
  PR_OVER_BUDGET: (prNumber: string) => ({
    title: 'PR vượt ngân sách',
    message: `PR ${prNumber} đang được xem xét do vượt ngân sách`,
  }),

  // DEPARTMENT_HEAD
  PR_PENDING_APPROVAL: (prNumber: string, requestorName: string) => ({
    title: 'PR chờ duyệt',
    message: `Có PR ${prNumber} chờ bạn duyệt (${requestorName})`,
  }),
  PR_RETURNED_FROM_BRANCH: (prNumber: string) => ({
    title: 'PR được trả về',
    message: `PR ${prNumber} được trả về từ GĐ CN`,
  }),
  PR_OVER_BUDGET_INFO: (prNumber: string) => ({
    title: 'PR vượt ngân sách',
    message: `PR ${prNumber} vượt ngân sách (để nắm thông tin)`,
  }),

  // BUYER_LEADER
  PR_READY_FOR_ASSIGNMENT: (prNumber: string) => ({
    title: 'PR sẵn sàng phân công',
    message: `PR ${prNumber} đã duyệt – chờ phân công Buyer`,
  }),
  PR_QUOTATIONS_COMPLETE: (prNumber: string) => ({
    title: 'Đã đủ báo giá',
    message: `PR ${prNumber} đã đủ báo giá – chờ review`,
  }),
  RFQ_SUBMITTED: (rfqNumber: string, prNumber: string, quotationCount: number) => ({
    title: 'RFQ đã được submit',
    message: `RFQ ${rfqNumber} (PR ${prNumber}) đã được Buyer submit với ${quotationCount} báo giá – sẵn sàng so sánh`,
  }),
  PR_OVER_BUDGET_ACTION_REQUIRED: (prNumber: string) => ({
    title: 'PR vượt ngân sách',
    message: `PR ${prNumber} vượt ngân sách – cần xử lý`,
  }),
  PR_RETURNED_FROM_BRANCH_MANAGER: (prNumber: string) => ({
    title: 'PR bị trả',
    message: `PR ${prNumber} bị trả – cần xử lý lại`,
  }),

  // BUYER
  PR_ASSIGNED: (prNumber: string, itemCount: number) => ({
    title: 'Được giao PR',
    message: `Bạn được giao ${itemCount} item trong PR ${prNumber}`,
  }),
  PR_RETURNED_FOR_REQUOTE: (prNumber: string) => ({
    title: 'PR bị trả',
    message: `PR ${prNumber} bị trả – vui lòng cập nhật báo giá`,
  }),
  RFQ_REQUIRED: (prNumber: string) => ({
    title: 'Cần hỏi lại báo giá',
    message: `Cần hỏi lại báo giá cho PR ${prNumber}`,
  }),

  // BRANCH_MANAGER
  PR_PENDING_APPROVAL_BRANCH: (prNumber: string, department: string) => ({
    title: 'PR chờ duyệt',
    message: `Có PR ${prNumber} chờ duyệt (${department})`,
  }),
  PR_OVER_BUDGET_DECISION_REQUIRED: (prNumber: string, overPercent: number) => ({
    title: 'PR vượt ngân sách',
    message: `PR ${prNumber} vượt ngân sách ${overPercent.toFixed(1)}% – cần quyết định`,
  }),
};

