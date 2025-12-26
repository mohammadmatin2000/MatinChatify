import { useState, useEffect, useRef } from "react";
import { LogOutIcon, VolumeOffIcon, Volume2Icon, PencilIcon, PlusIcon, PhoneIcon } from "lucide-react";
import axios from "axios";
import ChatContainer from "./ChatContainer"; // برای چت گروهی
// ====================================================================
function GroupsPage() {
  const [profile, setProfile] = useState({ first_name: "", image: "/avatar.png" });
  const [groups, setGroups] = useState([]); // لیست گروه‌ها
  const [selectedGroup, setSelectedGroup] = useState(null); // گروه انتخاب شده
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newItemType, setNewItemType] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const accessToken = localStorage.getItem("accessToken");

  // ----------------- Fetch Profile & Groups -----------------
  useEffect(() => {
    if (!accessToken) return;
    const fetchData = async () => {
      try {
        const profileRes = await axios.get("http://localhost:8000/accounts/profile/update/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setProfile(profileRes.data);

        const groupsRes = await axios.get("http://localhost:8000/groups/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setGroups(groupsRes.data);
      } catch (err) {}
    };
    fetchData();
  }, [accessToken]);

  // ----------------- Handlers -----------------
  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      await axios.post(
        "http://localhost:8000/accounts/logout/",
        { refresh: refreshToken },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {}
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    window.location.replace("/login");
  };

  const handleNewGroupSubmit = async () => {
    if (!newItemName) return;
    try {
      const res = await axios.post(
        "http://localhost:8000/groups/",
        { name: newItemName },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setGroups(prev => [...prev, res.data]); // اضافه کردن گروه جدید به لیست
      setNewItemName("");
      setNewItemType(null);
      setShowNewMenu(false);
    } catch {}
  };

  if (!accessToken) return null;

  // ====================== Render ======================
  if (selectedGroup) {
    return <ChatContainer group={selectedGroup} />;
  }

  return (
    <div className="flex flex-col p-4">
      {/* ---------- ProfileHeader ---------- */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="avatar online">
            <button className="size-14 rounded-full overflow-hidden relative group" onClick={() => fileInputRef.current.click()}>
              <img src={profile.image} alt="User" className="size-full object-cover" />
            </button>
          </div>
          <div className="relative group">
            {isEditingName ? (
              <input
                ref={inputRef}
                type="text"
                value={profile.first_name}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                onBlur={() => setIsEditingName(false)}
                className="bg-transparent border-b border-cyan-400 outline-none text-slate-200 text-sm px-1"
              />
            ) : (
              <div className="text-slate-200 font-medium cursor-pointer" onClick={() => setIsEditingName(true)}>
                {profile.first_name || "کاربر ناشناس"}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Sound */}
          <button onClick={() => setIsSoundEnabled(prev => !prev)}>
            {isSoundEnabled ? <Volume2Icon className="size-5" /> : <VolumeOffIcon className="size-5" />}
          </button>
          {/* ساخت جدید */}
          <div className="relative">
            <button onClick={() => setShowNewMenu(prev => !prev)}>
              <PlusIcon className="size-5" />
            </button>
            {showNewMenu && !newItemType && (
              <div className="absolute top-full mt-2 bg-slate-800 rounded shadow w-48 flex flex-col">
                <div className="p-2 hover:bg-slate-700 cursor-pointer text-white" onClick={() => setNewItemType("group")}>
                  ساخت گروه
                </div>
              </div>
            )}
            {newItemType === "group" && (
              <div className="absolute top-full mt-2 bg-slate-700 rounded shadow w-48 p-3 flex flex-col">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full p-1 rounded bg-slate-600 text-white outline-none mb-2"
                  onKeyDown={(e) => { if (e.key === "Enter") handleNewGroupSubmit(); }}
                  placeholder="نام گروه"
                />
                <button onClick={handleNewGroupSubmit} className="bg-cyan-500 hover:bg-cyan-600 text-white py-1 rounded">
                  اوکی
                </button>
              </div>
            )}
          </div>
          <button onClick={handleLogout}><LogOutIcon className="size-5" /></button>
        </div>
      </div>

      {/* ---------- GroupsList ---------- */}
      <div className="relative">
        {groups.length === 0 ? (
          <div className="text-center text-gray-400 mt-6">هیچ گروهی موجود نیست</div>
        ) : (
          <ul className="space-y-2 mt-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className="p-2 bg-slate-700 rounded cursor-pointer hover:bg-slate-600"
                onClick={() => setSelectedGroup(g)}
              >
                {g.name} ({g.members?.length || 0} عضو)
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default GroupsPage;
