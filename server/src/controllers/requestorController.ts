import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';
import { createNotification, NotificationTemplates } from '../utils/notifications';
import { getIO } from '../utils/getIO';

// Validation schemas
const createPRSchema = z.object({
  department: z.string().min(1),
  type: z.enum(['COMMERCIAL', 'PRODUCTION']).default('PRODUCTION'),
  requiredDate: z.string().optional(), // Estimated Date of Received (date input)
  currency: z.string().default('VND'),
  tax: z.number().min(0).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        partNo: z.string().optional(),
        spec: z.string().optional(),
        manufacturer: z.string().optional(),
        qty: z.number().positive(),
        unit: z.string().optional(),
        unitPrice: z.number().min(0),
        purpose: z.string().optional(),
        remark: z.string().optional(),
      })
    )
    .min(1),
  action: z.enum(['SAVE', 'SUBMIT']).default('SAVE'),
});

const updatePRSchema = createPRSchema
  .omit({ department: true })
  .partial()
  .extend({
    action: z.enum(['UPDATE', 'RESUBMIT']).default('UPDATE'),
  });

const normalizeDepartmentCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '');

const getYYYYMMDD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};

const generatePRNumber = async (department: string, retryCount = 0): Promise<string> => {
  const dept = normalizeDepartmentCode(department);
  const yyyymmdd = getYYYYMMDD();
  const prefix = `${dept}-${yyyymmdd}-`;
  
  // Find ALL existing PR numbers with this prefix (no limit to find all gaps)
  const existingPRs = await prisma.purchaseRequest.findMany({
    where: { 
      prNumber: { startsWith: prefix },
      deletedAt: null, // Only count non-deleted PRs
    },
    select: { prNumber: true },
    orderBy: { prNumber: 'asc' }, // Sort ascending to find gaps efficiently
  });
  
  // Extract all sequence numbers and create a Set for O(1) lookup
  const existingSequencesSet = new Set<number>();
  const existingSequences: number[] = [];
  
  existingPRs.forEach(pr => {
    const match = pr.prNumber.match(/-(\d{4})$/);
    if (match) {
      const seqNum = parseInt(match[1], 10);
      if (seqNum > 0) {
        existingSequencesSet.add(seqNum);
        existingSequences.push(seqNum);
      }
    }
  });
  
  // Find the first available sequence number
  // Priority: Find the smallest gap first (1, 2, 3...), then use max + 1
  let nextSeq = 1;
  
  if (existingSequences.length === 0) {
    // No existing PRs for this prefix, start from 0001
    nextSeq = 1;
  } else {
    // Find the first gap (smallest missing number)
    const maxSeq = Math.max(...existingSequences);
    let foundGap = false;
    
    // Check from 1 to maxSeq for gaps
    for (let i = 1; i <= maxSeq; i++) {
      if (!existingSequencesSet.has(i)) {
        nextSeq = i;
        foundGap = true;
        break;
      }
    }
    
    // If no gap found, use max + 1
    if (!foundGap) {
      nextSeq = maxSeq + 1;
    }
  }
  
  const seq = String(nextSeq).padStart(4, '0');
  const prNumber = `${prefix}${seq}`;
  
  // Double-check if this PR number already exists (race condition protection)
  const existingPR = await prisma.purchaseRequest.findFirst({
    where: {
      prNumber: prNumber,
      deletedAt: null,
    },
    select: { id: true },
  });
  
  if (existingPR) {
    if (retryCount < 10) {
      // If exists, retry with next sequence
      console.warn(`⚠️ PR number ${prNumber} already exists, retrying with next sequence... (attempt ${retryCount + 1}/10)`);
      // Recursively try next sequence
      return generatePRNumber(department, retryCount + 1);
    } else {
      // Too many retries, throw error
      throw new Error(`Không thể tạo số PR duy nhất sau ${retryCount + 1} lần thử. Vui lòng thử lại sau.`);
    }
  }
  
  console.log(`✅ Generated PR number: ${prNumber} (sequence: ${nextSeq}, existing: ${existingSequences.length})`);
  return prNumber;
};

// Get Next PR Number (preview)
export const getNextPRNumber = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { department } = request.query as { department?: string };
    if (!department) {
      return reply.code(400).send({ error: 'department is required' });
    }

    const prNumber = await generatePRNumber(department);
    reply.send({ prNumber });
  } catch (error: any) {
    console.error('Get next PR number error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Requestor Dashboard
export const getRequestorDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get all PRs for this requestor - Optimized with select only needed fields
    const prs = await prisma.purchaseRequest.findMany({
      where: {
        requestorId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        prNumber: true,
        status: true,
        notes: true,
        department: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          select: {
            description: true,
            qty: true,
            unitPrice: true,
          },
          take: 100, // Limit items per PR to prevent large responses
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to 100 PRs for dashboard performance
    });

    // Calculate totals
    const totalPRs = prs.length;

    // Group by status
    const statusCounts: { [key: string]: number } = {};
    prs.forEach((pr) => {
      statusCounts[pr.status] = (statusCounts[pr.status] || 0) + 1;
    });

    const prsByStatus = Object.keys(statusCounts).map((status) => ({
      status,
      count: statusCounts[status],
    }));

    // Get PRs that need more info
    const prsNeedMoreInfo = prs
      .filter((pr) => pr.status === 'NEED_MORE_INFO' && pr.notes)
      .map((pr) => {
        // Calculate total from items - prioritize items calculation
        let calculatedTotal = 0;
        if (pr.items.length > 0) {
          calculatedTotal = pr.items.reduce((sum, item) => {
            const qty = Number(item.qty) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            return sum + (qty * unitPrice);
          }, 0);
        }
        // Use totalAmount from DB if it exists and is greater than calculated, otherwise use calculated
        const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal) 
          ? Number(pr.totalAmount) 
          : calculatedTotal;
        
        // Get item name from first item with description
        let itemName = null;
        if (pr.items.length > 0) {
          // Find first item with non-empty description
          const firstItemWithDesc = pr.items.find(item => item.description && item.description.trim());
          if (firstItemWithDesc) {
            itemName = firstItemWithDesc.description.trim();
          } else {
            // If no description, show item count
            itemName = `${pr.items.length} mặt hàng`;
          }
        }
        
        return {
          id: pr.id,
          prNumber: pr.prNumber,
          itemName: itemName,
          department: pr.department || undefined,
          totalAmount: finalTotal > 0 ? finalTotal : null,
          currency: pr.currency || 'VND',
          notes: pr.notes || undefined,
        };
      });

    // Get recent PRs (last 10)
    const recentPRs = prs.slice(0, 10).map((pr) => {
      // Calculate total from items - prioritize items calculation
      let calculatedTotal = 0;
      if (pr.items.length > 0) {
        calculatedTotal = pr.items.reduce((sum, item) => {
          const qty = Number(item.qty) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          return sum + (qty * unitPrice);
        }, 0);
      }
      // Use totalAmount from DB if it exists and is greater than calculated, otherwise use calculated
      const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal) 
        ? Number(pr.totalAmount) 
        : calculatedTotal;
      
      // Get item name from first item with description
      let itemName = null;
      if (pr.items.length > 0) {
        // Find first item with non-empty description
        const firstItemWithDesc = pr.items.find(item => item.description && item.description.trim());
        if (firstItemWithDesc) {
          itemName = firstItemWithDesc.description.trim();
        } else {
          // If no description, show item count
          itemName = `${pr.items.length} mặt hàng`;
        }
      }
      
      return {
        id: pr.id,
        prNumber: pr.prNumber,
        itemName: itemName,
        department: pr.department || undefined,
        itemCount: pr.items.length,
        status: pr.status,
        totalAmount: finalTotal > 0 ? finalTotal : null,
        currency: pr.currency || 'VND',
        createdAt: pr.createdAt.toISOString(),
      };
    });

    // Ensure response is properly formatted even with empty data
    const response = {
      totalPRs,
      prsByStatus: prsByStatus || [],
      prsNeedMoreInfo: prsNeedMoreInfo || [],
      recentPRs: recentPRs || [],
    };

    return reply.code(200).send(response);
  } catch (error: any) {
    console.error('Get requestor dashboard error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get My PRs
export const getMyPRs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { status } = request.query as { status?: string };
    const where: any = {
      requestorId: userId,
      deletedAt: null,
    };
    if (status && status !== 'all') {
      where.status = status;
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      select: {
        id: true,
        prNumber: true,
        department: true,
        requiredDate: true,
        purpose: true,
        status: true,
        notes: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        items: {
          where: { deletedAt: null },
          select: {
            id: true,
            lineNo: true,
            description: true,
            partNo: true,
            spec: true,
            manufacturer: true,
            qty: true,
            unit: true,
            unitPrice: true,
            amount: true,
            purpose: true,
            remark: true,
          },
          orderBy: { lineNo: 'asc' },
          take: 100, // Limit items per PR to prevent large responses
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to 100 PRs for performance
    });

    // Map PRs to response format
    const mappedPRs = prs.length > 0 ? prs.map((pr) => {
      const firstItem = pr.items[0];
      return {
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department || '',
        itemName: firstItem?.description || 'N/A',
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        currency: pr.currency || 'VND',
        requiredDate: pr.requiredDate ? pr.requiredDate.toISOString() : null,
        purpose: pr.purpose || null,
        status: pr.status,
        notes: pr.notes || null,
        items: pr.items.map((it) => ({
          id: it.id,
          lineNo: it.lineNo,
          description: it.description || '',
          partNo: it.partNo || undefined,
          spec: it.spec || undefined,
          manufacturer: it.manufacturer || undefined,
          qty: Number(it.qty) || 0,
          unit: it.unit || undefined,
          unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
          amount: it.amount ? Number(it.amount) : null,
          purpose: it.purpose || undefined,
          remark: it.remark || undefined,
        })),
        createdAt: pr.createdAt.toISOString(),
        updatedAt: pr.updatedAt.toISOString(),
      };
    }) : [];

    // Ensure response is sent properly even with empty array
    const response = { prs: mappedPRs };
    return reply.code(200).send(response);
  } catch (error: any) {
    console.error('Get my PRs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR by ID
export const getPRById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
        },
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            directManagerCode: true,
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const firstItem = pr.items[0];
    reply.send({
      id: pr.id,
      prNumber: pr.prNumber,
      department: pr.department || '',
      itemName: firstItem?.description || 'N/A',
      totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
      currency: pr.currency || 'VND',
      requiredDate: pr.requiredDate?.toISOString(),
      purpose: pr.purpose,
      status: pr.status,
      notes: pr.notes,
      location: pr.location || undefined,
      requestor: pr.requestor ? {
        id: pr.requestor.id,
        username: pr.requestor.username,
        email: pr.requestor.email,
      } : undefined,
      items: pr.items.map((it) => ({
        id: it.id,
        lineNo: it.lineNo,
        description: it.description,
        partNo: it.partNo || undefined,
        spec: it.spec || undefined,
        manufacturer: it.manufacturer || undefined,
        qty: Number(it.qty),
        unit: it.unit || undefined,
        unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
        amount: it.amount ? Number(it.amount) : null,
        purpose: it.purpose || undefined,
        remark: it.remark || undefined,
      })),
      createdAt: pr.createdAt.toISOString(),
      updatedAt: pr.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Get PR by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Create PR
export const createPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const userRole = request.user?.role;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = createPRSchema.parse(request.body);

    console.log('📝 ========== CREATE PR REQUEST ==========');
    console.log('📝 User ID:', userId);
    console.log('📝 User Role:', userRole);
    console.log('📝 Body Action:', body.action);
    console.log('📝 Body Department:', body.department);

    // Get requestor's user info to check department
    const requestorUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { department: true, username: true, role: true, location: true, directManagerCode: true },
    });

    console.log('📝 Requestor User:', {
      username: requestorUser?.username,
      department: requestorUser?.department,
      role: requestorUser?.role,
      directManagerCode: requestorUser?.directManagerCode,
    });

    const directManagerCode = requestorUser?.directManagerCode?.trim();
    let directManager: { id: string; role: string; username: string } | null = null;
    if (body.action === 'SUBMIT') {
      if (!directManagerCode) {
        return reply.code(400).send({
          error: 'Thiếu direct_manager_code - không thể submit PR',
        });
      }

      directManager = await prisma.user.findFirst({
        where: {
          username: directManagerCode,
          role: 'DEPARTMENT_HEAD',
          deletedAt: null,
        },
        select: { id: true, role: true, username: true },
      });

      if (!directManager) {
        return reply.code(400).send({
          error: `Không tìm thấy quản lý trực tiếp (${directManagerCode})`,
        });
      }
    }

    // Use department from form, or fallback to requestor's department, or use form department
    const prDepartment = body.department || requestorUser?.department || 'GENERAL';
    console.log('📝 Final PR Department:', prDepartment);
    console.log('📝 =======================================');

    // Generate PR number (by Department) and create PR with retry logic for race conditions
    let pr;
    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      try {
        // Generate PR number (by Department)
        const prNumber = await generatePRNumber(prDepartment);

        // Calculate total amount
        const totalAmount = body.items.reduce((sum, it) => {
          const itemAmount = (it.qty || 0) * (it.unitPrice || 0);
          return sum + itemAmount;
        }, 0);
        const taxAmount = totalAmount * ((body.tax || 0) / 100);
        const totalWithTax = totalAmount + taxAmount;

        // Get first item description for itemName (required field)
        const firstItem = body.items[0];
        const itemName = firstItem?.description || 'N/A';
        const firstItemQty = firstItem?.qty || 0;
        const firstItemUnit = firstItem?.unit || '';

        // Create PR with items
        pr = await prisma.purchaseRequest.create({
          data: {
            prNumber,
            requestorId: userId,
            department: prDepartment,
            type: body.type || 'PRODUCTION',
            itemName: itemName,
            specifications: firstItem?.spec || null,
            quantity: firstItemQty,
            unit: firstItemUnit,
            requiredDate: body.requiredDate ? new Date(body.requiredDate) : null,
            notes: body.notes,
            // Submit: luôn đi theo luồng duyệt cấp 1 (direct_manager_code) => MANAGER_PENDING
            status: body.action === 'SUBMIT' ? 'MANAGER_PENDING' : 'DRAFT',
            // Lưu branch_code của Requestor vào PR để dùng cho flow duyệt/notify
            location: requestorUser?.location || null,
            totalAmount: totalWithTax,
            currency: body.currency || 'VND',
            tax: body.tax || null,
            items: {
              create: body.items.map((it, idx) => {
                const itemQty = it.qty || 0;
                const itemUnitPrice = it.unitPrice || 0;
                const itemAmount = itemQty * itemUnitPrice;
                return {
                  lineNo: idx + 1,
                  description: it.description,
                  partNo: it.partNo,
                  spec: it.spec,
                  manufacturer: it.manufacturer,
                  qty: itemQty,
                  unit: it.unit,
                  unitPrice: itemUnitPrice,
                  amount: itemAmount,
                  purpose: it.purpose,
                  remark: it.remark,
                };
              }),
            },
          },
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { lineNo: 'asc' },
            },
          },
        });

        // If successful, break out of retry loop
        break;
      } catch (error: any) {
        // Check if it's a unique constraint error on pr_number
        if (error.code === 'P2002' && error.meta?.target?.includes('pr_number')) {
          retryCount++;
          if (retryCount >= maxRetries) {
            console.error('Failed to create PR with unique PR number after', maxRetries, 'retries');
            return reply.code(500).send({
              error: 'Không thể tạo số PR duy nhất. Vui lòng thử lại sau.',
            });
          }
          console.warn(`PR number conflict detected, retrying... (${retryCount}/${maxRetries})`);
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
          continue;
        } else {
          // If it's a different error, throw it immediately
          throw error;
        }
      }
    }

    if (!pr) {
      return reply.code(500).send({
        error: 'Không thể tạo PR. Vui lòng thử lại sau.',
      });
    }

    // Audit log
    await auditCreate('purchase_requests', pr.id, userId, pr);

    // Debug: Log PR creation details
    console.log('📋 ========== PR CREATED ==========');
    console.log('📋 PR Number:', pr.prNumber);
    console.log('📋 PR ID:', pr.id);
    console.log('📋 PR Status:', pr.status);
    console.log('📋 Body Action:', body.action);
    console.log('📋 User Role:', userRole);
    console.log('📋 PR Department:', prDepartment);
    console.log('📋 Condition check - body.action === "SUBMIT":', body.action === 'SUBMIT');
    console.log('📋 Condition check - pr.status === "MANAGER_PENDING":', pr.status === 'MANAGER_PENDING');
    console.log('📋 Will send notification?', body.action === 'SUBMIT' && pr.status === 'MANAGER_PENDING');
    console.log('📋 ====================================');

    // Send notification to Direct Manager when PR is submitted
    if (body.action === 'SUBMIT' && pr.status === 'MANAGER_PENDING') {
      try {
        console.log('🔔 ========== SENDING NOTIFICATION ==========');
        console.log('🔔 PR Number:', pr.prNumber);
        console.log('🔔 PR ID:', pr.id);
        console.log('🔔 PR Department:', prDepartment);
        console.log('🔔 PR Status:', pr.status);
        console.log('🔔 Requestor ID:', userId);
        if (!directManager) {
          console.error('❌ ERROR: Direct Manager not found, notification skipped');
          console.log('🔔 ==========================================');
          return;
        }

        if (directManager.id === userId) {
          console.log('⚠️ Direct Manager is the same as Requestor, skipping notification');
          console.log('🔔 ==========================================');
          return;
        }

        const template = NotificationTemplates.PR_PENDING_APPROVAL(pr.prNumber, requestorUser?.username || 'N/A');
        console.log('🔔 Notification template:', template);

        const io = getIO();
        console.log('🔔 Socket.IO instance:', io ? '✅ Available' : '❌ NULL');
        if (!io) {
          console.error('❌ ERROR: Socket.IO instance is NULL! Cannot emit notification.');
        }

        const notificationId = await createNotification(io, {
          userId: directManager.id,
          role: directManager.role,
          type: 'PR_PENDING_APPROVAL',
          title: template.title,
          message: template.message,
          relatedId: pr.id,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber, requestorName: requestorUser?.username },
          companyId: pr.companyId,
        });

        console.log('✅ Notification created with ID:', notificationId);
        console.log('🔔 ==========================================');
      } catch (notificationError: any) {
        // Log but don't fail PR creation if notification fails
        console.error('❌ ERROR: Failed to send notification:', notificationError);
        console.error('❌ Error stack:', notificationError.stack);
        console.log('🔔 ==========================================');
      }
    } else {
      console.log('🔔 Notification skipped - action:', body.action, 'status:', pr.status);
    }

    const createdFirstItem = pr.items[0];
    reply.code(201).send({
      id: pr.id,
      prNumber: pr.prNumber,
      department: pr.department || '',
      itemName: createdFirstItem?.description || 'N/A',
      totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
      currency: pr.currency || 'VND',
      requiredDate: pr.requiredDate?.toISOString(),
      status: pr.status,
      notes: pr.notes,
      items: pr.items.map((it) => ({
        id: it.id,
        lineNo: it.lineNo,
        description: it.description,
        partNo: it.partNo || undefined,
        spec: it.spec || undefined,
        manufacturer: it.manufacturer || undefined,
        qty: Number(it.qty),
        unit: it.unit || undefined,
        purpose: it.purpose || undefined,
        remark: it.remark || undefined,
      })),
      createdAt: pr.createdAt.toISOString(),
      updatedAt: pr.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Update PR
export const updatePR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Check if PR exists and belongs to user
    const existingPR = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
    });

    if (!existingPR) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    // Only allow editing if status is DRAFT or NEED_MORE_INFO
    if (existingPR.status !== 'DRAFT' && existingPR.status !== 'NEED_MORE_INFO') {
      return reply.code(403).send({ error: 'PR cannot be edited in current status' });
    }

    const body = updatePRSchema.parse(request.body);

    const updateData: any = {};
    if (body.requiredDate) updateData.requiredDate = new Date(body.requiredDate);
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.action === 'RESUBMIT') {
      // Nếu PR bị trả ở cấp quản lý trực tiếp hoặc GĐ chi nhánh, resubmit về cấp quản lý trực tiếp
      if (existingPR.status === 'MANAGER_RETURNED' || existingPR.status === 'BRANCH_MANAGER_RETURNED') {
        updateData.status = 'MANAGER_PENDING';
      } else {
        updateData.status = 'MANAGER_PENDING';
      }
    }

    // Calculate total amount if items are updated
    if (body.items && body.items.length > 0) {
      const totalAmount = body.items.reduce((sum, it) => {
        const itemAmount = (it.qty || 0) * (it.unitPrice || 0);
        return sum + itemAmount;
      }, 0);
      const taxAmount = totalAmount * ((body.tax || existingPR.tax || 0) / 100);
      const totalWithTax = totalAmount + taxAmount;
      updateData.totalAmount = totalWithTax;
      if (body.currency) updateData.currency = body.currency;
      if (body.tax !== undefined) updateData.tax = body.tax;
    }

    const pr = await prisma.purchaseRequest.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
        },
      },
    });

    // Update items if provided
    if (body.items && body.items.length > 0) {
      // Soft delete existing items
      await prisma.purchaseRequestItem.updateMany({
        where: { purchaseRequestId: pr.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      // Create new items
      await prisma.purchaseRequestItem.createMany({
        data: body.items.map((it, idx) => {
          const itemQty = it.qty || 0;
          const itemUnitPrice = it.unitPrice || 0;
          const itemAmount = itemQty * itemUnitPrice;
          return {
            purchaseRequestId: pr.id,
            lineNo: idx + 1,
            description: it.description,
            partNo: it.partNo,
            spec: it.spec,
            manufacturer: it.manufacturer,
            qty: itemQty,
            unit: it.unit,
            unitPrice: itemUnitPrice,
            amount: itemAmount,
            purpose: it.purpose,
            remark: it.remark,
          };
        }),
      });
    }

    // Audit log
    await auditUpdate('purchase_requests', pr.id, userId, existingPR, pr);

    const fresh = await prisma.purchaseRequest.findUnique({
      where: { id: pr.id },
      include: {
        items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
      },
    });

    const firstItem = fresh?.items[0];
    reply.send({
      id: fresh!.id,
      prNumber: fresh!.prNumber,
      department: fresh!.department || '',
      itemName: firstItem?.description || 'N/A',
      totalAmount: fresh!.totalAmount ? Number(fresh!.totalAmount) : null,
      currency: fresh!.currency || 'VND',
      requiredDate: fresh!.requiredDate?.toISOString(),
      status: fresh!.status,
      notes: fresh!.notes,
      items: fresh!.items.map((it) => ({
        id: it.id,
        lineNo: it.lineNo,
        description: it.description,
        partNo: it.partNo || undefined,
        spec: it.spec || undefined,
        manufacturer: it.manufacturer || undefined,
        qty: Number(it.qty),
        unit: it.unit || undefined,
        unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
        amount: it.amount ? Number(it.amount) : null,
        purpose: it.purpose || undefined,
        remark: it.remark || undefined,
      })),
      createdAt: fresh!.createdAt.toISOString(),
      updatedAt: fresh!.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Update PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR Tracking (single PR detail)
export const getPRTracking = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          take: 1,
        },
        assignments: {
          where: { deletedAt: null },
          include: {
            buyer: {
              select: {
                username: true,
                fullName: true,
                role: true,
                jobTitle: true,
                location: true,
                department: true,
              },
            },
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const status = pr.status;
    const firstItem = pr.items[0];
    const afterSubmitted = [
      'SUBMITTED',
      'DEPARTMENT_HEAD_PENDING',
      'DEPARTMENT_HEAD_APPROVED',
      'DEPARTMENT_HEAD_REJECTED',
      'DEPARTMENT_HEAD_RETURNED',
      'MANAGER_PENDING',
      'MANAGER_APPROVED',
      'MANAGER_REJECTED',
      'MANAGER_RETURNED',
      'BRANCH_MANAGER_PENDING',
      'BRANCH_MANAGER_APPROVED',
      'BRANCH_MANAGER_REJECTED',
      'BRANCH_MANAGER_RETURNED',
      'BUYER_LEADER_PENDING',
      'NEED_MORE_INFO',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
      'CANCELLED',
    ];
    const afterManagerApproved = [
      'MANAGER_APPROVED',
      'BRANCH_MANAGER_PENDING',
      'BRANCH_MANAGER_APPROVED',
      'BUYER_LEADER_PENDING',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
    ];
    const afterBuyerLeaderPending = [
      'BRANCH_MANAGER_APPROVED',
      'BUYER_LEADER_PENDING',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
    ];
    const afterAssignedToBuyer = [
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
    ];

    // Build timeline (Requestor → Quản lý trực tiếp → GĐ Chi nhánh → Buyer Leader → Buyer)
    const timeline = [
      {
        status: 'Draft',
        completed: status !== 'DRAFT',
        date: pr.createdAt.toISOString(),
        handler: 'Requestor',
      },
      {
        status: 'Chờ quản lý trực tiếp duyệt',
        completed: afterSubmitted.includes(status) && !['DRAFT', 'MANAGER_PENDING', 'DEPARTMENT_HEAD_PENDING'].includes(status),
        date: [
          'MANAGER_PENDING',
          'MANAGER_APPROVED',
          'MANAGER_REJECTED',
          'MANAGER_RETURNED',
          'DEPARTMENT_HEAD_PENDING',
          'DEPARTMENT_HEAD_APPROVED',
          'DEPARTMENT_HEAD_REJECTED',
          'DEPARTMENT_HEAD_RETURNED',
        ].includes(status)
          ? pr.updatedAt.toISOString()
          : undefined,
        handler: 'Quản lý trực tiếp',
      },
      {
        status: 'Chờ GĐ Chi nhánh duyệt',
        completed: afterManagerApproved.includes(status) && !['MANAGER_APPROVED', 'DEPARTMENT_HEAD_APPROVED', 'BRANCH_MANAGER_PENDING'].includes(status),
        date: ['BRANCH_MANAGER_PENDING', 'BRANCH_MANAGER_APPROVED', 'BRANCH_MANAGER_REJECTED', 'BRANCH_MANAGER_RETURNED'].includes(status)
          ? pr.updatedAt.toISOString()
          : undefined,
        handler: 'Giám đốc Chi nhánh',
      },
      {
        status: 'Chờ Buyer Leader phân công',
        completed: afterBuyerLeaderPending.includes(status),
        date: afterBuyerLeaderPending.includes(status) ? pr.updatedAt.toISOString() : undefined,
        handler: 'Buyer Leader',
      },
      {
        status: 'Ready for RFQ',
        completed: afterAssignedToBuyer.includes(status),
        date: afterAssignedToBuyer.includes(status) ? pr.updatedAt.toISOString() : undefined,
        handler: 'Buyer',
      },
      {
        status: 'Need more info',
        completed: status === 'NEED_MORE_INFO',
        date: status === 'NEED_MORE_INFO' ? pr.updatedAt.toISOString() : undefined,
        handler: 'Buyer',
        comment: status === 'NEED_MORE_INFO' ? pr.notes || undefined : undefined,
      },
    ];

    // Current handler (display label) + detail
    let currentHandler: string | undefined;
    let currentHandlerInfo: {
      name: string;
      role: string;
      title?: string | null;
      branch?: string | null;
      department?: string | null;
    } | null = null;
    if (status === 'DRAFT' || status === 'NEED_MORE_INFO' || status === 'MANAGER_RETURNED' || status === 'DEPARTMENT_HEAD_RETURNED' || status === 'BRANCH_MANAGER_RETURNED') {
      currentHandler = 'Requestor';
    } else if (status === 'MANAGER_PENDING' || status === 'DEPARTMENT_HEAD_PENDING') {
      currentHandler = 'Quản lý trực tiếp';
    } else if (status === 'MANAGER_APPROVED' || status === 'DEPARTMENT_HEAD_APPROVED' || status === 'BRANCH_MANAGER_PENDING') {
      currentHandler = 'Giám đốc Chi nhánh';
    } else if (status === 'BUYER_LEADER_PENDING' || status === 'BRANCH_MANAGER_APPROVED') {
      currentHandler = 'Buyer Leader';
    }
    else if (status === 'SUBMITTED') currentHandler = 'Giám đốc Chi nhánh'; // Legacy
    else currentHandler = 'Buyer';

    const requestorUser = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { directManagerCode: true, location: true, department: true },
    });

    if (currentHandler === 'Quản lý trực tiếp') {
      const managerCode = requestorUser?.directManagerCode?.trim();
      if (managerCode) {
        const manager = await prisma.user.findFirst({
          where: { username: managerCode, role: 'DEPARTMENT_HEAD', deletedAt: null },
          select: { fullName: true, username: true, role: true, jobTitle: true, location: true, department: true },
        });
        if (manager) {
          currentHandlerInfo = {
            name: manager.fullName || manager.username,
            role: manager.role,
            title: manager.jobTitle || null,
            branch: manager.location || null,
            department: manager.department || null,
          };
        }
      }
    } else if (currentHandler === 'Giám đốc Chi nhánh') {
      const branchCode = pr.location || requestorUser?.location || null;
      const branchManager = await prisma.user.findFirst({
        where: { role: 'BRANCH_MANAGER', location: branchCode || undefined, deletedAt: null },
        select: { fullName: true, username: true, role: true, jobTitle: true, location: true, department: true },
      });
      if (branchManager) {
        currentHandlerInfo = {
          name: branchManager.fullName || branchManager.username,
          role: branchManager.role,
          title: branchManager.jobTitle || null,
          branch: branchManager.location || null,
          department: branchManager.department || null,
        };
      }
    } else if (currentHandler === 'Buyer Leader') {
      const buyerLeader = await prisma.user.findFirst({
        where: { role: 'BUYER_LEADER', deletedAt: null },
        select: { fullName: true, username: true, role: true, jobTitle: true, location: true, department: true },
      });
      if (buyerLeader) {
        currentHandlerInfo = {
          name: buyerLeader.fullName || buyerLeader.username,
          role: buyerLeader.role,
          title: buyerLeader.jobTitle || null,
          branch: buyerLeader.location || null,
          department: buyerLeader.department || null,
        };
      }
    } else if (currentHandler === 'Buyer' && pr.assignments.length > 0) {
      const assignedBuyer = pr.assignments[0]?.buyer;
      if (assignedBuyer) {
        currentHandlerInfo = {
          name: assignedBuyer.fullName || assignedBuyer.username,
          role: assignedBuyer.role,
          title: assignedBuyer.jobTitle || null,
          branch: assignedBuyer.location || null,
          department: assignedBuyer.department || null,
        };
      }
    }

    // Extract comments from notes
    const comments = pr.notes
      ? [
          {
            from: 'Buyer',
            message: pr.notes,
            date: pr.updatedAt.toISOString(),
          },
        ]
      : [];

    reply.send({
      pr: {
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department || '',
        itemName: firstItem?.description || 'N/A',
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        currency: pr.currency || 'VND',
        requiredDate: pr.requiredDate?.toISOString(),
        purpose: pr.purpose,
        status: pr.status,
        notes: pr.notes,
        createdAt: pr.createdAt.toISOString(),
        updatedAt: pr.updatedAt.toISOString(),
      },
      timeline,
      currentHandler,
      currentHandlerInfo,
      comments,
    });
  } catch (error: any) {
    console.error('Get PR tracking error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR Tracking List (with SLA and progress) - NEW FUNCTION
export const getPRTrackingList = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get all PRs of the requestor
    const prs = await prisma.purchaseRequest.findMany({
      where: {
        requestorId: userId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
        },
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            directManagerCode: true,
          },
        },
        approvals: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            approver: {
              select: {
                username: true,
              },
            },
          },
        },
        assignments: {
          where: { deletedAt: null },
          include: {
            buyer: {
              select: {
                username: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map PRs with tracking information (using Promise.all for async operations)
    const prsWithTracking = await Promise.all(prs.map(async (pr) => {
      const items = pr.items || [];
      // Calculate total from items
      let calculatedTotal = 0;
      if (items.length > 0) {
        calculatedTotal = items.reduce((sum, item) => {
          const qty = Number(item.qty) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          return sum + (qty * unitPrice);
        }, 0);
      }
      const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal) 
        ? Number(pr.totalAmount) 
        : calculatedTotal;

      // Get item name from first item
      let itemName = null;
      if (items.length > 0) {
        const firstItemWithDesc = items.find(item => item.description && item.description.trim());
        if (firstItemWithDesc) {
          itemName = firstItemWithDesc.description.trim();
        } else {
          itemName = `${items.length} mặt hàng`;
        }
      }

      // Calculate progress stages
      const stages = [
        { key: 'DRAFT', label: 'Nháp', completed: false, current: false },
        { key: 'MANAGER_PENDING', label: 'QL trực tiếp duyệt', completed: false, current: false },
        { key: 'BRANCH_MANAGER_PENDING', label: 'GĐ Chi nhánh duyệt', completed: false, current: false },
        { key: 'BUYER_LEADER_PENDING', label: 'Chờ BL phân công', completed: false, current: false },
        { key: 'ASSIGNED_TO_BUYER', label: 'Đã phân công Buyer', completed: false, current: false },
        { key: 'RFQ_IN_PROGRESS', label: 'Hỏi giá', completed: false, current: false },
        { key: 'QUOTATION_RECEIVED', label: 'Nhận báo giá', completed: false, current: false },
        { key: 'SUPPLIER_SELECTED', label: 'Chọn NCC', completed: false, current: false },
        { key: 'PAYMENT_DONE', label: 'Hoàn thành', completed: false, current: false },
      ];

      // Determine current stage and progress
      let currentStageIndex = -1;
      let progressPercentage = 0;

      const statusToStageMap: { [key: string]: number } = {
        'DRAFT': 0,
        'SUBMITTED': 1,
        'DEPARTMENT_HEAD_PENDING': 1,
        'DEPARTMENT_HEAD_APPROVED': 1,
        'DEPARTMENT_HEAD_REJECTED': -1,
        'DEPARTMENT_HEAD_RETURNED': -1,
        'MANAGER_PENDING': 1,
        'MANAGER_APPROVED': 1,
        'MANAGER_REJECTED': -1,
        'MANAGER_RETURNED': -1,
        'BRANCH_MANAGER_PENDING': 2,
        'BRANCH_MANAGER_APPROVED': 3,
        'BRANCH_MANAGER_REJECTED': -1,
        'BRANCH_MANAGER_RETURNED': -1,
        'BUYER_LEADER_PENDING': 3,
        'ASSIGNED_TO_BUYER': 4,
        'RFQ_IN_PROGRESS': 5,
        'QUOTATION_RECEIVED': 6,
        'SUPPLIER_SELECTED': 7,
        'PAYMENT_DONE': 8,
        'CANCELLED': -1,
      };

      currentStageIndex = statusToStageMap[pr.status] ?? -1;

      // Mark completed stages
      if (currentStageIndex >= 0) {
        for (let i = 0; i < currentStageIndex; i++) {
          stages[i].completed = true;
        }
        if (currentStageIndex < stages.length) {
          stages[currentStageIndex].current = true;
        }
        progressPercentage = ((currentStageIndex + 1) / stages.length) * 100;
      } else if (pr.status === 'PAYMENT_DONE') {
        // All stages completed
        stages.forEach(s => s.completed = true);
        progressPercentage = 100;
      }

      // Get current handler
      let currentHandler: string | null = null;
      const assignments = pr.assignments || [];
      if (['MANAGER_PENDING', 'MANAGER_APPROVED', 'DEPARTMENT_HEAD_PENDING', 'DEPARTMENT_HEAD_APPROVED'].includes(pr.status)) {
        // Find direct manager
        const managerCode = pr.requestor?.directManagerCode?.trim();
        if (managerCode) {
          const manager = await prisma.user.findFirst({
            where: {
              username: managerCode,
              role: 'DEPARTMENT_HEAD',
              deletedAt: null,
            },
            select: { username: true },
          });
          currentHandler = manager?.username || null;
        }
      } else if (pr.status === 'BRANCH_MANAGER_PENDING') {
        // Find branch manager
        const branchManager = await prisma.user.findFirst({
          where: {
            role: 'BRANCH_MANAGER',
            deletedAt: null,
          },
          select: { username: true },
        });
        currentHandler = branchManager?.username || null;
      } else if (['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'].includes(pr.status)) {
        const buyerLeader = await prisma.user.findFirst({
          where: {
            role: 'BUYER_LEADER',
            deletedAt: null,
          },
          select: { username: true },
        });
        currentHandler = buyerLeader?.username || null;
      } else if (assignments.length > 0) {
        // Get assigned buyer
        currentHandler = assignments[0]?.buyer?.username || null;
      }

      // Calculate SLA status (simplified - can be enhanced with actual SLA rules)
      const now = new Date();
      const createdAt = pr.createdAt ? new Date(pr.createdAt) : new Date();
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      let slaStatus: 'on_time' | 'warning' | 'overdue' | 'completed' = 'on_time';
      let timeRemaining: string | null = null;
      let timeOverdue: string | null = null;

      if (pr.status === 'PAYMENT_DONE' || pr.status === 'CANCELLED') {
        slaStatus = 'completed';
      } else {
        // Simple SLA logic (can be enhanced)
        const estimatedDays = currentStageIndex * 2 + 3; // Rough estimate
        if (daysSinceCreated > estimatedDays + 2) {
          slaStatus = 'overdue';
          timeOverdue = `${daysSinceCreated - estimatedDays} ngày`;
        } else if (daysSinceCreated > estimatedDays - 1) {
          slaStatus = 'warning';
          timeRemaining = `${estimatedDays - daysSinceCreated} ngày`;
        } else {
          slaStatus = 'on_time';
          timeRemaining = `${estimatedDays - daysSinceCreated} ngày`;
        }
      }

      return {
        id: pr.id,
        prNumber: pr.prNumber,
        itemName: itemName,
        purpose: pr.purpose || null,
        department: pr.department || null,
        status: pr.status,
        totalAmount: finalTotal > 0 ? finalTotal : null,
        currency: pr.currency || 'VND',
        createdAt: pr.createdAt ? pr.createdAt.toISOString() : null,
        updatedAt: pr.updatedAt ? pr.updatedAt.toISOString() : null,
        progress: {
          percentage: progressPercentage,
          stages: stages,
          currentStage: currentStageIndex >= 0 ? stages[currentStageIndex] : null,
        },
        currentHandler: currentHandler,
        sla: {
          status: slaStatus,
          timeRemaining: timeRemaining,
          timeOverdue: timeOverdue,
          daysSinceCreated: daysSinceCreated,
        },
      };
    }));

    reply.send({
      prs: prsWithTracking,
    });
  } catch (error: any) {
    console.error('Get PR Tracking List error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Submit PR (DRAFT → Approval Workflow)
// Module 2: Approval Configuration - Auto-determine approvers based on rules
export const submitPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    console.log('📋 ========== SUBMIT PR ==========');
    console.log('📋 PR ID:', id);
    console.log('📋 User ID:', userId);

    // Get Requestor info
    const requestor = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true, // branch_code
        department: true, // department_code
        directManagerCode: true,
      },
    });

    if (!requestor) {
      return reply.code(404).send({ error: 'Requestor not found' });
    }

    console.log('📋 Requestor:', {
      username: requestor.username,
      branch_code: requestor.location,
      department_code: requestor.department,
      direct_manager_code: requestor.directManagerCode,
    });

    // Check if PR exists and belongs to user
    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    // Only allow submitting if status is DRAFT
    if (pr.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'PR can only be submitted from DRAFT status' });
    }

    if (pr.items.length === 0) {
      return reply.code(400).send({ error: 'PR must have at least one item' });
    }

    // ============================================
    // BƯỚC 1: DUYỆT CẤP 1 LUÔN TỒN TẠI (Direct Manager)
    // ============================================
    console.log('📋 Step 1: Finding Level 1 Approver (Direct Manager)...');

    if (!requestor.directManagerCode) {
      return reply.code(400).send({
        error: 'Thiếu direct_manager_code - không thể submit PR',
      });
    }

    const directManager = await prisma.user.findFirst({
      where: {
        username: requestor.directManagerCode,
        role: 'DEPARTMENT_HEAD',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
      },
    });

    if (!directManager) {
      return reply.code(400).send({
        error: `Không tìm thấy quản lý trực tiếp (${requestor.directManagerCode})`,
      });
    }

    const level1ApproverId = directManager.id;
    const level1ApproverUsername = directManager.username;

    console.log('✅ Found Level 1 Approver:', {
      id: directManager.id,
      username: directManager.username,
      name: directManager.fullName,
      role: directManager.role,
    });

    const nextStatus = 'MANAGER_PENDING';

    // ============================================
    // UPDATE PR STATUS
    // ============================================
    const updatedPR = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: nextStatus as any,
        // đảm bảo branch_code được lưu trên PR để flow duyệt dùng thống nhất
        location: requestor.location || pr.location,
      },
    });

    // Note: KHÔNG tạo PRApproval ở bước submit. PRApproval chỉ tạo khi người duyệt thực hiện APPROVE/REJECT/RETURN.

    // ============================================
    // CREATE NOTIFICATIONS
    // ============================================
    const io = getIO();
    
    if (level1ApproverId && io) {
      io.to(`user:${level1ApproverId}`).emit('notification', {
        type: 'PR_PENDING_APPROVAL',
        title: 'PR cần duyệt',
        message: `PR ${pr.prNumber} đang chờ bạn duyệt`,
        relatedId: id,
        relatedType: 'PR',
      });
      console.log('✅ Sent notification to Level 1 Approver');
    }

    // Audit log
    await auditUpdate('purchase_requests', id, userId, { status: pr.status }, { status: nextStatus });

    console.log('✅ PR submitted successfully');
    console.log('📋 Final status:', nextStatus);
    console.log('📋 =================================\n');

    reply.send({
      message: 'PR submitted successfully',
      pr: {
        id: updatedPR.id,
        prNumber: updatedPR.prNumber,
        status: updatedPR.status,
      },
      approvalFlow: {
        level1Approver: level1ApproverUsername,
        // bước 2 theo chi nhánh sẽ được quyết định SAU khi cấp 1 duyệt
        needBranchManager: null,
        level2Approver: null,
      },
    });
  } catch (error: any) {
    console.error('❌ Submit PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Notifications
export const getNotifications = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get PRs with status changes
    const prs = await prisma.purchaseRequest.findMany({
      where: {
        requestorId: userId,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 50,
    });

    // Generate notifications from PRs
    const notifications = prs.map((pr) => {
      let type = 'PR_SUBMITTED';
      let message = `PR ${pr.prNumber} đã được gửi`;

      if (pr.status === 'MANAGER_RETURNED' || pr.status === 'DEPARTMENT_HEAD_RETURNED' || pr.status === 'BRANCH_MANAGER_RETURNED' || (pr.status === 'NEED_MORE_INFO' && pr.notes)) {
        type = 'PR_RETURNED';
        message = `PR ${pr.prNumber} bị trả kèm comment`;
      } else if (pr.status === 'MANAGER_APPROVED' || pr.status === 'DEPARTMENT_HEAD_APPROVED') {
        type = 'PR_APPROVED';
        message = `PR ${pr.prNumber} đã được quản lý trực tiếp duyệt`;
      } else if (pr.status === 'BUYER_LEADER_PENDING' || pr.status === 'BRANCH_MANAGER_APPROVED') {
        type = 'PR_APPROVED';
        message = `PR ${pr.prNumber} đã được duyệt – chờ Buyer Leader phân công`;
      } else if (pr.status === 'ASSIGNED_TO_BUYER') {
        type = 'PR_READY_FOR_RFQ';
        message = `PR ${pr.prNumber} chuyển sang bước mua (Ready for RFQ)`;
      }

      return {
        id: pr.id,
        type,
        message,
        prNumber: pr.prNumber,
        comment: pr.notes || undefined,
        createdAt: pr.updatedAt.toISOString(),
      };
    });

    reply.send({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
