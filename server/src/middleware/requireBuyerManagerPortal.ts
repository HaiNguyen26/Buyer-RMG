import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './auth';

/** Chỉ BUYER_MANAGER hoặc SYSTEM_ADMIN (cùng quyền vào dashboard buyer-manager). */
export const requireBuyerManagerPortal = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  const role = request.user?.role;
  if (role !== 'BUYER_MANAGER' && role !== 'SYSTEM_ADMIN') {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Chỉ Trưởng phòng Mua hàng (BUYER_MANAGER) được thực hiện thao tác này',
    });
  }
};
