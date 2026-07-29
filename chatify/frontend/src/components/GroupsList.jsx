import { useEffect, useState } from "react";
import axios from "axios";
import { useChatStore } from "../store/useChatStore";

function GroupsList({ searchQuery = "" }) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const accessToken = localStorage.getItem("accessToken");

  const { setSelectedGroup } = useChatStore();

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

  if (isLoading)
    return (
      <div className="flex justify-center items-center py-8 text-slate-400 animate-pulse">
        در حال بارگذاری گروه‌ها...
      </div>
    );

  if (!groups.length)
    return (
      <div className="text-center py-8 text-slate-400">
        هیچ گروهی یافت نشد 😔
      </div>
    );

  // ✅ فیلتر بر اساس سرچ (اسم گروه)
  const q = searchQuery.trim().toLowerCase();
  const filteredGroups = q
    ? groups.filter((g) => (g.name || "").toLowerCase().includes(q))
    : groups;

  if (filteredGroups.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">چیزی با این عبارت پیدا نشد</div>
    );
  }

  return (
    <div className="space-y-3 px-2">
      {filteredGroups.map((g) => {
        // URL آواتار گروه
        const groupAvatarUrl = g.avatar
          ? g.avatar.startsWith("http")
            ? g.avatar
            : `http://localhost:8000${g.avatar}`
          : null;

        return (
          <div
            key={g.id}
            onClick={() => setSelectedGroup(g)}
            className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:bg-gradient-to-r hover:from-cyan-600/20 hover:to-blue-500/20 shadow-sm hover:shadow-lg"
          >
            {/* آواتار گروه */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-lg font-bold shadow-md overflow-hidden">
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
            <div className="flex flex-col">
              <p className="text-slate-200 font-semibold text-lg truncate">{g.name}</p>
              <p className="text-slate-400 text-sm flex items-center gap-1">
                {g.members?.length || 0} عضو
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default GroupsList;