import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { Clock, CheckCircle, AlertCircle, AlertTriangle, User, MessageSquare, FileEdit, Send, CheckCircle2, XCircle, ArrowLeftRight, XOctagon, UserCheck, FileCheck, Wallet, FileText, Info, ShoppingCart, Building2 } from 'lucide-react';

const PRStatusTracking = () => {
    const { id } = useParams<{ id: string }>();

    const { data: prData, isLoading } = useQuery({
        queryKey: ['requestor-pr-tracking', id],
        queryFn: () => requestorService.getPRTracking(id!),
        enabled: !!id,
    });

    if (!id) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="p-6">
                    <div className="bg-white rounded-soft shadow-soft border border-slate-200 p-6">
                        <p className="text-slate-600">Vui lòng chọn một PR để theo dõi</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-slate-200 rounded w-64"></div>
                        <div className="h-96 bg-slate-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    const getStatusInfo = (status: string) => {
        const statusMap: { [key: string]: { label: string; icon: any; iconColor: string; color: string } } = {
            'DRAFT': {
                label: 'Nháp',
                icon: FileEdit,
                iconColor: 'text-slate-500',
                color: 'bg-white text-slate-800 border-slate-300'
            },
            'SUBMITTED': {
                label: 'Đã gửi',
                icon: Send,
                iconColor: 'text-blue-500',
                color: 'bg-white text-blue-700 border-blue-300'
            },
            'MANAGER_PENDING': {
                label: 'Chờ quản lý trực tiếp duyệt',
                icon: Clock,
                iconColor: 'text-amber-500',
                color: 'bg-white text-amber-700 border-amber-300'
            },
            'MANAGER_APPROVED': {
                label: 'Quản lý trực tiếp đã duyệt',
                icon: CheckCircle2,
                iconColor: 'text-green-500',
                color: 'bg-white text-green-700 border-green-300'
            },
            'MANAGER_REJECTED': {
                label: 'Quản lý trực tiếp từ chối',
                icon: XCircle,
                iconColor: 'text-red-500',
                color: 'bg-white text-red-700 border-red-300'
            },
            'MANAGER_RETURNED': {
                label: 'Quản lý trực tiếp trả về',
                icon: ArrowLeftRight,
                iconColor: 'text-orange-500',
                color: 'bg-white text-orange-700 border-orange-300'
            },
            'BRANCH_MANAGER_PENDING': {
                label: 'Chờ GĐ Chi nhánh duyệt',
                icon: Clock,
                iconColor: 'text-purple-500',
                color: 'bg-white text-purple-700 border-purple-300'
            },
            'BUYER_LEADER_PENDING': {
                label: 'Đã duyệt - chờ Buyer Leader phân công',
                icon: CheckCircle,
                iconColor: 'text-emerald-500',
                color: 'bg-white text-emerald-700 border-emerald-300'
            },
            // Legacy statuses (backward compatibility)
            'DEPARTMENT_HEAD_PENDING': {
                label: 'Chờ quản lý trực tiếp duyệt',
                icon: Clock,
                iconColor: 'text-amber-500',
                color: 'bg-white text-amber-700 border-amber-300'
            },
            'DEPARTMENT_HEAD_APPROVED': {
                label: 'Quản lý trực tiếp đã duyệt',
                icon: CheckCircle2,
                iconColor: 'text-green-500',
                color: 'bg-white text-green-700 border-green-300'
            },
            'DEPARTMENT_HEAD_REJECTED': {
                label: 'Quản lý trực tiếp từ chối',
                icon: XCircle,
                iconColor: 'text-red-500',
                color: 'bg-white text-red-700 border-red-300'
            },
            'DEPARTMENT_HEAD_RETURNED': {
                label: 'Quản lý trực tiếp trả về',
                icon: ArrowLeftRight,
                iconColor: 'text-orange-500',
                color: 'bg-white text-orange-700 border-orange-300'
            },
            'BRANCH_MANAGER_APPROVED': {
                label: 'Đã duyệt - chờ Buyer Leader phân công',
                icon: CheckCircle,
                iconColor: 'text-emerald-500',
                color: 'bg-white text-emerald-700 border-emerald-300'
            },
            'BRANCH_MANAGER_REJECTED': {
                label: 'GĐ Chi nhánh từ chối',
                icon: XOctagon,
                iconColor: 'text-red-500',
                color: 'bg-white text-red-700 border-red-300'
            },
            'BRANCH_MANAGER_RETURNED': {
                label: 'GĐ Chi nhánh trả về',
                icon: ArrowLeftRight,
                iconColor: 'text-orange-500',
                color: 'bg-white text-orange-700 border-orange-300'
            },
            'APPROVED_BY_BRANCH': {
                label: 'Đã duyệt bởi Chi nhánh',
                icon: CheckCircle,
                iconColor: 'text-emerald-500',
                color: 'bg-white text-emerald-700 border-emerald-300'
            },
            'NEED_MORE_INFO': {
                label: 'Cần thêm thông tin',
                icon: AlertCircle,
                iconColor: 'text-yellow-500',
                color: 'bg-white text-yellow-700 border-yellow-300'
            },
            'ASSIGNED_TO_BUYER': {
                label: 'Đã phân công Buyer',
                icon: UserCheck,
                iconColor: 'text-indigo-500',
                color: 'bg-white text-indigo-700 border-indigo-300'
            },
            'RFQ_IN_PROGRESS': {
                label: 'Đang hỏi giá',
                icon: ShoppingCart,
                iconColor: 'text-cyan-500',
                color: 'bg-white text-cyan-700 border-cyan-300'
            },
            'QUOTATION_RECEIVED': {
                label: 'Đã nhận báo giá',
                icon: FileCheck,
                iconColor: 'text-teal-500',
                color: 'bg-white text-teal-700 border-teal-300'
            },
            'SUPPLIER_SELECTED': {
                label: 'Đã chọn NCC',
                icon: CheckCircle2,
                iconColor: 'text-blue-500',
                color: 'bg-white text-blue-700 border-blue-300'
            },
            'BUDGET_EXCEPTION': {
                label: 'Vượt ngân sách',
                icon: AlertCircle,
                iconColor: 'text-rose-500',
                color: 'bg-white text-rose-700 border-rose-300'
            },
            'BUDGET_APPROVED': {
                label: 'Đã chấp nhận vượt ngân sách',
                icon: CheckCircle2,
                iconColor: 'text-green-500',
                color: 'bg-white text-green-700 border-green-300'
            },
            'BUDGET_REJECTED': {
                label: 'Từ chối vượt ngân sách',
                icon: XCircle,
                iconColor: 'text-red-500',
                color: 'bg-white text-red-700 border-red-300'
            },
            'PAYMENT_DONE': {
                label: 'Đã thanh toán',
                icon: Wallet,
                iconColor: 'text-emerald-500',
                color: 'bg-white text-emerald-700 border-emerald-300'
            },
            'READY_FOR_RFQ': {
                label: 'Sẵn sàng hỏi giá',
                icon: FileCheck,
                iconColor: 'text-emerald-500',
                color: 'bg-white text-emerald-700 border-emerald-300'
            }
        };

        return statusMap[status] || {
            label: status,
            icon: Info,
            iconColor: 'text-slate-500',
            color: 'bg-white text-slate-800 border-slate-300'
        };
    };

    const getStatusIcon = (status: string) => {
        const statusInfo = getStatusInfo(status);
        const IconComponent = statusInfo.icon;
        return <IconComponent className={`w-5 h-5 ${statusInfo.iconColor}`} strokeWidth={2} />;
    };

    const getStatusLabel = (status: string) => {
        return getStatusInfo(status).label;
    };

    const getStatusColor = (status: string) => {
        return getStatusInfo(status).color;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const formatDateTime = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('vi-VN');
    };

    const formatCurrency = (amount?: number | null, currency: string = 'VND') => {
        if (!amount) return 'Chưa có';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency,
        }).format(amount);
    };

    const formatHours = (hours: number) => {
        const absHours = Math.abs(hours);
        const days = Math.floor(absHours / 24);
        const remHours = Math.floor(absHours % 24);
        if (days > 0) {
            return `${days} ngày ${remHours} giờ`;
        }
        return `${remHours} giờ`;
    };

    const getRoleLabel = (role?: string) => {
        if (!role) return 'Đang xử lý';
        const mapping: Record<string, string> = {
            REQUESTOR: 'Requestor',
            DEPARTMENT_HEAD: 'Trưởng nhóm / phòng',
            BRANCH_MANAGER: 'GĐ chi nhánh',
            BUYER_LEADER: 'Buyer Leader',
            BUYER: 'Buyer',
        };
        return mapping[role] || role;
    };

    const getCurrentStepIndex = (status: string) => {
        const managerStatuses = [
            'MANAGER_PENDING', 'MANAGER_APPROVED', 'MANAGER_REJECTED', 'MANAGER_RETURNED',
            'DEPARTMENT_HEAD_PENDING', 'DEPARTMENT_HEAD_APPROVED', 'DEPARTMENT_HEAD_REJECTED', 'DEPARTMENT_HEAD_RETURNED',
        ];
        if (status === 'DRAFT') return 0;
        if (managerStatuses.includes(status) || status === 'SUBMITTED') return 1;
        if (status === 'BRANCH_MANAGER_PENDING' || status === 'BRANCH_MANAGER_REJECTED' || status === 'BRANCH_MANAGER_RETURNED') return 2;
        if (status === 'BUYER_LEADER_PENDING' || status === 'BRANCH_MANAGER_APPROVED') return 3;
        if (['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED', 'PAYMENT_DONE', 'NEED_MORE_INFO', 'BUDGET_EXCEPTION', 'BUDGET_APPROVED', 'BUDGET_REJECTED'].includes(status)) {
            return 4;
        }
        return 0;
    };

    const pr = prData?.pr;
    const status = pr?.status || 'DRAFT';
    const currentStepIndex = getCurrentStepIndex(status);
    const isFinal = status === 'PAYMENT_DONE';
    const isIssueStatus = [
        'MANAGER_REJECTED',
        'MANAGER_RETURNED',
        'DEPARTMENT_HEAD_REJECTED',
        'DEPARTMENT_HEAD_RETURNED',
        'BRANCH_MANAGER_REJECTED',
        'BRANCH_MANAGER_RETURNED',
        'NEED_MORE_INFO',
        'BUDGET_EXCEPTION',
        'BUDGET_REJECTED',
        'CANCELLED',
    ].includes(status);

    const SLA_HOURS = 48;
    const lastUpdated = pr?.updatedAt ? new Date(pr.updatedAt) : new Date();
    const now = new Date();
    const elapsedHours = Math.max(0, (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60));
    const remainingHours = SLA_HOURS - elapsedHours;
    const remainingPercent = Math.max(0, Math.min(100, (remainingHours / SLA_HOURS) * 100));
    const isOverdue = remainingHours < 0;
    const isNearDue = remainingHours <= SLA_HOURS * 0.3 && remainingHours >= 0;

    const steps = [
        { label: 'Tạo PR', icon: FileEdit },
        { label: 'Trưởng nhóm / phòng', icon: User },
        { label: 'GĐ chi nhánh', icon: Building2 },
        { label: 'Buyer Leader', icon: UserCheck },
        { label: 'Mua hàng', icon: ShoppingCart },
    ];

    const alerts: { type: 'danger' | 'warning'; text: string }[] = [];
    if (isOverdue) alerts.push({ type: 'danger', text: 'PR quá hạn duyệt' });
    if (['NEED_MORE_INFO', 'MANAGER_RETURNED', 'DEPARTMENT_HEAD_RETURNED', 'BRANCH_MANAGER_RETURNED'].includes(status)) {
        alerts.push({ type: 'warning', text: 'PR bị yêu cầu bổ sung thông tin' });
    }
    if (status === 'BUDGET_EXCEPTION' || status === 'BUDGET_REJECTED') {
        alerts.push({ type: 'danger', text: 'PR vượt ngân sách so với giá Requestor nhập' });
    }
    if (['MANAGER_REJECTED', 'DEPARTMENT_HEAD_REJECTED', 'BRANCH_MANAGER_REJECTED'].includes(status)) {
        alerts.push({ type: 'danger', text: 'PR bị từ chối' });
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="p-6 space-y-6 animate-fade-in">

                {prData && (
                    <>
                        {/* Header PR */}
                        <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-200 p-6 animate-slide-up">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                            PR: {pr?.prNumber || '-'}
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${getStatusColor(status)}`}>
                                            {getStatusIcon(status)}
                                            {getStatusLabel(status)}
                                        </span>
                                    </div>
                                    <p className="text-slate-900 text-lg font-semibold">{pr?.itemName || 'Không có mô tả'}</p>
                                    <div className="text-sm text-slate-600 flex flex-wrap gap-4">
                                        <span>Ngày tạo: {formatDate(pr?.createdAt)}</span>
                                        <span>Due date: {formatDate(pr?.requiredDate)}</span>
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        Tổng giá Requestor đã nhập: <span className="font-semibold text-slate-900">{formatCurrency(pr?.totalAmount, pr?.currency || 'VND')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                    <span>Due: {isOverdue ? `Quá hạn ${formatHours(remainingHours)}` : formatHours(remainingHours)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Timeline - Core Stepper */}
                        <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-200 p-6 animate-slide-up">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">Thanh tiến trình</h2>
                            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                {steps.map((step, index) => {
                                    const isDone = isFinal || index < currentStepIndex;
                                    const isCurrent = index === currentStepIndex && !isFinal;
                                    const isWaiting = index > currentStepIndex;
                                    const StepIcon = step.icon;
                                    const stateColor = isDone
                                        ? 'bg-emerald-500 text-white'
                                        : isIssueStatus && isCurrent
                                            ? 'bg-red-500 text-white'
                                            : isCurrent
                                                ? 'bg-blue-600 text-white animate-pulse'
                                                : 'bg-slate-100 text-slate-400';
                                    const labelColor = isDone ? 'text-emerald-600' : isCurrent ? 'text-blue-600' : 'text-slate-500';

                                    return (
                                        <div key={step.label} className="flex items-center gap-3 md:flex-col md:gap-2 md:flex-1">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${stateColor}`}>
                                                <StepIcon className="w-5 h-5" strokeWidth={2} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-semibold ${labelColor}`}>{step.label}</span>
                                                <span className="text-xs text-slate-400">
                                                    {isDone ? 'Hoàn thành' : isCurrent ? (isIssueStatus ? 'Có vấn đề' : 'Đang xử lý') : 'Chưa tới'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Realtime Due Time Bar */}
                        <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-200 p-6 animate-slide-up">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-lg font-semibold text-slate-900">Realtime Due Time</h3>
                                </div>
                                <span className="text-sm text-slate-600">SLA: {SLA_HOURS} giờ</span>
                            </div>
                            <div className={`h-3 w-full rounded-full bg-slate-100 overflow-hidden ${isOverdue ? 'animate-pulse' : ''}`}>
                                <div
                                    className={`h-full transition-all duration-300 ${isOverdue ? 'bg-red-500' : isNearDue ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                    style={{ width: `${remainingPercent}%` }}
                                />
                            </div>
                            <div className="mt-2 text-sm text-slate-600 flex items-center gap-2">
                                {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                <span>
                                    {isOverdue
                                        ? `Quá hạn: ${formatHours(remainingHours)}`
                                        : `Còn lại: ${formatHours(remainingHours)}`}
                                </span>
                            </div>
                        </div>

                        {/* Owner Card */}
                        <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-200 p-6 animate-slide-up">
                            <div className="flex items-center gap-3">
                                <User className="w-6 h-6 text-blue-600" strokeWidth={2} />
                                <div>
                                    <p className="text-sm text-slate-500">Người đang xử lý</p>
                                    <p className="text-lg font-semibold text-slate-900">
                                        {prData.currentHandlerInfo?.name || prData.currentHandler || 'Đang cập nhật'}
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        {getRoleLabel(prData.currentHandlerInfo?.role)} {prData.currentHandlerInfo?.title ? `– ${prData.currentHandlerInfo?.title}` : ''}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {prData.currentHandlerInfo?.branch ? `Chi nhánh ${prData.currentHandlerInfo.branch}` : 'Chi nhánh -'} {prData.currentHandlerInfo?.department ? `• ${prData.currentHandlerInfo.department}` : ''}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Alert Panel */}
                        {alerts.length > 0 && (
                            <div className="space-y-3 animate-slide-up">
                                {alerts.map((alert, index) => (
                                    <div
                                        key={`${alert.text}-${index}`}
                                        className={`rounded-2xl border p-4 ${alert.type === 'danger' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className={`w-5 h-5 ${alert.type === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />
                                            <p className={`text-sm font-semibold ${alert.type === 'danger' ? 'text-red-700' : 'text-amber-700'}`}>
                                                {alert.text}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Audit mini */}
                        <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-200 p-6 animate-slide-up">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Lịch sử hành động</h2>
                            <div className="space-y-4">
                                {prData.timeline?.map((item: any, index: number) => (
                                    <div key={index} className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {item.completed ? <CheckCircle className="w-4 h-4" strokeWidth={2} /> : <Clock className="w-4 h-4" strokeWidth={2} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-slate-900">{item.status}</p>
                                                <p className="text-xs text-slate-500">{formatDateTime(item.date)}</p>
                                            </div>
                                            {item.handler && (
                                                <p className="text-xs text-slate-500 mt-0.5">Người xử lý: {item.handler}</p>
                                            )}
                                            {item.comment && (
                                                <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">
                                                    {item.comment}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Comments */}
                        {prData.comments && prData.comments.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-200 p-6 animate-slide-up">
                                <h2 className="text-xl font-bold text-slate-900 mb-4">Comment / Yêu cầu bổ sung từ Buyer</h2>
                                <div className="space-y-4">
                                    {prData.comments.map((comment: any, index: number) => (
                                        <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-slate-400" strokeWidth={2} />
                                                    <span className="text-sm font-medium text-slate-700">{comment.from}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 font-normal">
                                                    {formatDateTime(comment.date)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700 font-normal">{comment.message}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PRStatusTracking;

