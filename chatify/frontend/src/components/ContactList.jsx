import { useEffect, useState, useRef, useCallback } from "react";
import { Search, X, UserPlus, Check, Trash2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";

function ContactList() {
  const {
    getAllContacts,
    allContacts,
    setSelectedUser,
    isUsersLoading,
    searchResults,
    isSearching,
    searchUsers,
    clearSearch,
    addContact,
    deleteContact,
  } = useChatStore();

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const wsRef = useRef(null);
  const debounceRef = useRef(null);
  const confirmTimerRef = useRef(null);

  // ========================== WebSocket وضعیت آنلاین ==========================
  useEffect(() => {
    getAllContacts();

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let reconnectTimer = null;

    const connect = () => {
      wsRef.current = new WebSocket(
        `ws://localhost:8000/ws/online-status/?token=${token}`
      );

      wsRef.current.onopen = () => {
        console.log("🟢 Online WS Connected");
        wsRef.current.send(JSON.stringify({ type: "get_contacts" }));
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("📩", data);

        switch (data.type) {
          case "contacts_list":
            setOnlineUsers(
              data.contacts.filter((c) => c.online).map((c) => String(c.id))
            );
            break;

          case "presence_update":
            setOnlineUsers((prev) => {
              const id = String(data.userId);
              if (data.online) {
                if (prev.includes(id)) return prev;
                return [...prev, id];
              }
              return prev.filter((x) => x !== id);
            });
            break;

          default:
            break;
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("❌ Online WS Error", err);
      };

      wsRef.current.onclose = (event) => {
        console.log("🔴 Online WS Closed", event.code);
        reconnectTimer = setTimeout(() => {
          console.log("🔄 Reconnecting...");
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  // پاکسازی تایمر تایید حذف هنگام unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  // ========================== جستجو با debounce ==========================
  const handleQueryChange = useCallback(
    (value) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchUsers(value);
      }, 350);
    },
    [searchUsers]
  );

  const closeSearch = () => {
    setIsSearchMode(false);
    setQuery("");
    clearSearch();
  };

  const handleAddContact = async (userId) => {
    setAddingId(userId);
    await addContact(userId);
    setAddingId(null);
  };

  // ========================== حذف مخاطب (با تایید دو مرحله‌ای) ==========================
  const handleDeleteClick = (e, contactRecordId) => {
    e.stopPropagation();

    if (confirmDeleteId === contactRecordId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      deleteContact(contactRecordId);
      setConfirmDeleteId(null);
      return;
    }

    setConfirmDeleteId(contactRecordId);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => {
      setConfirmDeleteId((current) => (current === contactRecordId ? null : current));
    }, 3000);
  };

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* ========================== نوار سرچ ========================== */}
      <div className="p-3 border-b border-slate-700/50">
        {!isSearchMode ? (
          <button
            onClick={() => setIsSearchMode(true)}
            className="w-full flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>جستجوی مخاطب جدید (ایمیل)...</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="ایمیل کاربر را وارد کنید..."
              className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500"
            />
            <button
              onClick={closeSearch}
              className="text-slate-400 hover:text-slate-200 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ========================== نتایج جستجو ========================== */}
      {isSearchMode && (
        <div className="flex-1 overflow-y-auto">
          {isSearching && (
            <p className="text-center text-slate-500 text-sm py-4">در حال جستجو...</p>
          )}

          {!isSearching && query.trim() && searchResults.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-4">کاربری یافت نشد</p>
          )}

          {searchResults.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-3 hover:bg-slate-800/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                <img
                  src={user.profile || "/avatar.png"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.src = "/avatar.png")}
                />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-slate-200 text-sm font-medium truncate">
                  {user.name}
                </span>
                <span className="text-slate-500 text-xs truncate">{user.email}</span>
              </div>
              {user.is_contact ? (
                <span className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                  <Check className="w-4 h-4" /> افزوده شد
                </span>
              ) : (
                <button
                  onClick={() => handleAddContact(user.id)}
                  disabled={addingId === user.id}
                  className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-md flex-shrink-0 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {addingId === user.id ? "..." : "افزودن"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ========================== لیست مخاطبین موجود ========================== */}
      {!isSearchMode && (
        <div className="flex-1 overflow-y-auto">
          {allContacts.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">
              هنوز مخاطبی ندارید. از دکمه بالا مخاطب جدید پیدا کنید.
            </p>
          )}

          {allContacts.map((contact, idx) => {
            const contactId = String(contact._id || contact.id);
            const contactRecordId = contact.raw?.id;
            const isOnline = onlineUsers.includes(contactId);
            const isConfirming = confirmDeleteId === contactRecordId;

            const profilePic = contact.profile?.startsWith("http")
              ? contact.profile
              : contact.raw?.profile?.startsWith("http")
              ? contact.raw.profile
              : contact.raw?.profile
              ? `http://localhost:8000${contact.raw.profile}`
              : "/avatar.png";

            const displayName =
              contact.name?.trim() ||
              (contact.first_name || contact.last_name
                ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                : contact.email?.split("@")[0]) ||
              "کاربر ناشناخته";

            return (
              <div
                key={contact._id || contact.id || idx}
                className="group relative bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors m-2"
                onClick={() => setSelectedUser(contact)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700">
                      <img
                        src={profilePic}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.target.src = "/avatar.png")}
                      />
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
                        isOnline ? "bg-green-400" : "bg-gray-500"
                      }`}
                    ></span>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <h4
                      className="text-slate-200 font-medium text-sm truncate"
                      title={displayName}
                    >
                      {displayName}
                    </h4>
                    <p
                      className={`text-xs font-medium truncate ${
                        isOnline ? "text-green-400" : "text-slate-500"
                      }`}
                    >
                      {isOnline ? "آنلاین" : "آفلاین"}
                    </p>
                  </div>

                  {/* ✅ دکمه حذف مخاطب - فقط موقع hover دیده می‌شه */}
                  {contactRecordId && (
                    <button
                      onClick={(e) => handleDeleteClick(e, contactRecordId)}
                      className={`flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200 ${
                        isConfirming
                          ? "bg-red-500 text-white w-16 h-8 opacity-100"
                          : "opacity-0 group-hover:opacity-100 w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                      }`}
                      title={isConfirming ? "تایید حذف" : "حذف مخاطب"}
                    >
                      {isConfirming ? (
                        <span className="text-xs font-medium">مطمئنی؟</span>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContactList;