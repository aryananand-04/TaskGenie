export function Topbar() {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
      <div className="text-lg font-semibold">Dashboard</div>
      <div className="flex items-center gap-4">
        {/* Notifications, profile dropdown etc. placeholder */}
        <span className="w-8 h-8 bg-gray-300 rounded-full" />
      </div>
    </header>
  );
}
