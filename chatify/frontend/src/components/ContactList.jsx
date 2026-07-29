import { useEffect, useState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";

function ContactList({ searchQuery = "" }) {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading, onlineUsers, deleteContact } =
    useChatStore();

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

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

  // ✅ فیلتر بر اساس سرچ (اسم یا ایمیل)
  const q = searchQuery.trim().toLowerCase();
  const filteredContacts = q
    ? allContacts.filter((contact) => {
        const name = (contact.name || "").toLowerCase();
        const email = (contact.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : allContacts;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {allContacts.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-6">
          هنوز مخاطبی ندارید. از دکمه‌ی «+» بالا مخاطب جدید اضافه کنید.
        </p>
      )}

      {allContacts.length > 0 && filteredContacts.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">چیزی با این عبارت پیدا نشد</p>
      )}

      {filteredContacts.map((contact, idx) => {
        const contactId = String(contact._id || contact.id);
        const contactRecordId = contact.raw?.id;
        const isOnline = onlineUsers.some((id) => String(id) === contactId);
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
                <h4 className="text-slate-200 font-medium text-sm truncate" title={displayName}>
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
  );
}

export default ContactList;