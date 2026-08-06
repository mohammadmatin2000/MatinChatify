import { useEffect, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useChannelStore } from "../store/useChannelStore"; // ✅ FIX: برای پاک کردن selectedChannel

function GroupsList({ searchQuery = "" }) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);
  const accessToken = localStorage.getItem("accessToken");

  const { setSelectedGroup, setSelectedUser } = useChatStore();
  // ✅ FIX: لازم داریم تا موقع انتخاب گروه، چنل فعلی رو پاک کنیم
  const { setSelectedChannel } = useChannelStore();

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await axios.get("http://localhost:8000/groups/groups/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setGroups(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGroups();
  }, [accessToken]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  // ✅ FIX: انتخاب گروه باید انتخاب فعلی چت خصوصی/چنل رو پاک کنه، وگرنه
  // چند تا کانتینر همزمان روی هم رندر می‌شن
  const handleSelectGroup = (group) => {
    setSelectedUser(null);
    setSelectedChannel(null);
    setSelectedGroup(group);
  };

  const handleDeleteClick = async (e, groupId) => {
    e.stopPropagation();

    if (confirmDeleteId === groupId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmDeleteId(null);

      try {
        await axios.delete(`http://localhost:8000/groups/groups/${groupId}/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        toast.success("گروه حذف شد");
      } catch (err) {
        console.error("خطا در حذف گروه:", err.response?.data || err);
        toast.error("حذف گروه ممکن نشد (شاید فقط سازنده اجازه داره)");
      }
      return;
    }

    setConfirmDeleteId(groupId);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => {
      setConfirmDeleteId((current) => (current === groupId ? null : current));
    }, 3000);
  };

  if (isLoading)
    return (
      <div className="flex justify-center items-center py-8 text-slate-400 animate-pulse">
        در حال بارگذاری گروه‌ها...
      </div>
    );

  if (!groups.length)
    return <div className="text-center py-8 text-slate-400">هیچ گروهی یافت نشد 😔</div>;

  // ✅ فیلتر بر اساس سرچ (اسم گروه)
  const q = searchQuery.trim().toLowerCase();
  const filteredGroups = q ? groups.filter((g) => (g.name || "").toLowerCase().includes(q)) : groups;

  if (filteredGroups.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">چیزی با این عبارت پیدا نشد</div>;
  }

  return (
    <div className="flex flex-col gap-1.5 px-1">
      {filteredGroups.map((g) => {
        const isConfirming = confirmDeleteId === g.id;

        const groupAvatarUrl = g.avatar
          ? g.avatar.startsWith("http")
            ? g.avatar
            : `http://localhost:8000${g.avatar}`
          : null;

        // ✅ سریالایزر بک‌اند الان members_count واقعی برمی‌گردونه
        const memberCount = typeof g.members_count === "number" ? g.members_count : g.members?.length || 0;

        return (
          <div
            key={g.id}
            onClick={() => handleSelectGroup(g)}
            className="group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer
                       bg-gradient-to-r from-slate-800/40 to-slate-800/10 border border-slate-700/40
                       hover:from-cyan-500/10 hover:to-blue-500/5 hover:border-cyan-500/30
                       hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200"
          >
            {/* آواتار گروه */}
            <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-md overflow-hidden ring-2 ring-cyan-500/10 group-hover:ring-cyan-400/40 transition-all flex-shrink-0">
              {groupAvatarUrl ? (
                <img
                  src={groupAvatarUrl}
                  alt={g.name}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.src = "/avatar.png")}
                />
              ) : (
                <span>{g.name?.[0]?.toUpperCase() || "?"}</span>
              )}
            </div>

            {/* اطلاعات گروه */}
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-slate-200 font-semibold text-[15px] truncate">{g.name}</p>
              <p className="text-slate-400 text-xs truncate transition-opacity group-hover:opacity-0">
                {memberCount === 0 ? "بدون عضو" : `${memberCount} عضو`}
              </p>
            </div>

            {/* ✅ دکمه‌ی حذف گروه */}
            <button
              onClick={(e) => handleDeleteClick(e, g.id)}
              className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-200 ${
                isConfirming
                  ? "bg-red-500 text-white w-16 h-8 opacity-100"
                  : "opacity-0 group-hover:opacity-100 w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              }`}
              title={isConfirming ? "تایید حذف" : "حذف گروه"}
            >
              {isConfirming ? <span className="text-xs font-medium">مطمئنی؟</span> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default GroupsList;