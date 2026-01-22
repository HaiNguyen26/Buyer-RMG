import { useCurrentUser, useLogout } from '../hooks/useAuth';
import { LogOut, User } from 'lucide-react';

const DashboardPage = () => {
    const { data: user, isLoading } = useCurrentUser();
    const logout = useLogout();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{user?.username}</p>
                                    <p className="text-xs text-slate-500">{user?.role}</p>
                                </div>
                            </div>
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Đăng xuất</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Chào mừng, {user?.username}!</h2>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-slate-500">Email:</p>
                            <p className="text-slate-900 font-medium">{user?.email}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Vai trò:</p>
                            <p className="text-slate-900 font-medium">{user?.role}</p>
                        </div>
                        {user?.location && (
                            <div>
                                <p className="text-sm text-slate-500">Địa điểm:</p>
                                <p className="text-slate-900 font-medium">{user.location}</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;

