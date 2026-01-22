import { useState } from 'react';
import { LogIn, TrendingUp, Shield, Zap, AlertCircle } from 'lucide-react';
import { useLogin } from '../hooks/useAuth';
import logoRMG from '../assets/LogoRMG.png';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Brand Section (1/3) */}
      <div className="hidden lg:flex lg:w-1/3 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e293b)' }}>
        {/* Grid Pattern Background */}
        <div className="absolute inset-0 grid-pattern opacity-20"></div>

        {/* Ambient Glow Effects */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl animate-glow opacity-50"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-glow opacity-50" style={{ animationDelay: '2s' }}></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Title */}
          <div>
            <h1 className="text-5xl font-black mb-6 leading-tight tracking-tighter text-white">
              Quản lý Mua hàng
              <span className="block text-amber-500 italic font-serif font-black">Thu mua số</span>
            </h1>
          </div>

          {/* Features with Glassmorphism */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50">
              <div className="w-12 h-12 bg-blue-600/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-600/30">
                <Zap className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <h3 className="font-black text-lg mb-1 tracking-tight text-white">Chuẩn hóa quy trình</h3>
                <p className="text-slate-400 text-sm">Tối ưu hóa từng bước mua hàng</p>
              </div>
            </div>

            <div className="flex items-start gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50">
              <div className="w-12 h-12 bg-blue-600/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-600/30">
                <TrendingUp className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <h3 className="font-black text-lg mb-1 tracking-tight text-white">Tối ưu hiệu quả</h3>
                <p className="text-slate-400 text-sm">Tiết kiệm thời gian và chi phí</p>
              </div>
            </div>

            <div className="flex items-start gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50">
              <div className="w-12 h-12 bg-blue-600/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-600/30">
                <Shield className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <h3 className="font-black text-lg mb-1 tracking-tight text-white">An toàn dữ liệu</h3>
                <p className="text-slate-400 text-sm">Bảo mật thông tin tuyệt đối</p>
              </div>
            </div>
          </div>

          {/* Glassmorphism Card with Status */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 animate-float">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-white mb-1">Hệ thống đang phục vụ</p>
                <p className="text-xs text-slate-400">Đơn hàng được xử lý mỗi tháng</p>
              </div>
              <span className="text-3xl font-black text-blue-500">2,500+</span>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-400 text-center uppercase tracking-widest font-semibold mt-4">
            © Hải Nguyễn - 2026 RMG Vietnam Global
          </p>
        </div>
      </div>

      {/* Right Column - Login Form (2/3) */}
      <div className="flex-1 lg:w-2/3 flex items-center justify-center bg-slate-50 p-8">
        <div className="w-full max-w-md">
          {/* Logo và Welcome Text - Cùng một khối */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="group cursor-pointer mb-4">
              <img 
                src={logoRMG} 
                alt="RMG Logo" 
                className="h-20 w-auto max-w-sm group-hover:opacity-90 transition-opacity duration-300"
              />
            </div>
            <h2 className="text-4xl font-semibold text-slate-900 mb-2 tracking-tight">Chào mừng trở lại</h2>
            <p className="text-slate-500 font-normal">Đăng nhập để tiếp tục quản lý mua hàng</p>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mt-4">Powered by RMG Vietnam</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2 uppercase tracking-widest">
                Tên đăng nhập
              </label>
              <div className="relative group">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all duration-200 text-slate-900 placeholder-slate-400"
                  placeholder="Nhập tên đăng nhập"
                  required
                />
                <div className="absolute inset-0 rounded-2xl bg-blue-600/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2 uppercase tracking-widest">
                Mật khẩu
              </label>
              <div className="relative group">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all duration-200 text-slate-900 placeholder-slate-400"
                  placeholder="Nhập mật khẩu"
                  required
                />
                <div className="absolute inset-0 rounded-2xl bg-blue-600/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
              </div>
            </div>

            {/* Error Message */}
            {loginMutation.isError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 uppercase tracking-widest">Đăng nhập thất bại</p>
                  <p className="text-xs text-red-600 mt-1 font-normal">
                    {loginMutation.error instanceof Error
                      ? loginMutation.error.message
                      : 'Tên đăng nhập hoặc mật khẩu không đúng'}
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-blue-600 text-white py-3.5 px-4 rounded-2xl font-semibold uppercase tracking-widest hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-glow shadow-2xl"
            >
              {loginMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-slate-400 uppercase tracking-widest font-medium">
            Hải Nguyễn - RMG
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
