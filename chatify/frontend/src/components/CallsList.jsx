import { PhoneIcon } from "lucide-react";

function CallsList({ searchQuery = "" }) {
  // فعلاً بک‌اندی برای تاریخچه‌ی تماس نداریم، پس اینجا یه حالت خالی مثل واتساب نشون می‌دیم.
  // وقتی تماس صوتی/تصویری اضافه شد، لیست واقعی تماس‌ها اینجا فیلتر می‌شه (بر اساس searchQuery).
  const calls = [];

  const filteredCalls = searchQuery.trim()
    ? calls.filter((c) => c.name?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : calls;

  if (filteredCalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
          <PhoneIcon className="w-7 h-7 text-slate-500" />
        </div>
        <p className="text-slate-300 font-medium text-sm mb-1">
          {searchQuery.trim() ? "تماسی یافت نشد" : "هنوز تماسی ثبت نشده"}
        </p>
        {!searchQuery.trim() && (
          <p className="text-slate-500 text-xs">
            تماس‌های صوتی و تصویری شما اینجا نمایش داده می‌شن
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2">
      {filteredCalls.map((call) => (
        <div key={call.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50">
          {/* رندر تماس واقعی وقتی بک‌اند تماس آماده شد */}
        </div>
      ))}
    </div>
  );
}

export default CallsList;