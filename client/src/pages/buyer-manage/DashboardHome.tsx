const DashboardHome = () => {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-4 py-8">
      <div className="page-banner-dark page-banner-dark-tint-ocean relative w-full max-w-lg overflow-hidden">
        <div className="relative z-10 px-1 text-center sm:px-2">
          <p className="page-banner-dark-kicker">Buyer Manage</p>
          <h1 className="page-banner-dark-title mt-2">Workspace</h1>
          <p className="page-banner-dark-desc mx-auto mt-2 max-w-sm">
            Giao diện đang được thiết kế lại — sẵn sàng mở rộng module quản lý mua hàng.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
