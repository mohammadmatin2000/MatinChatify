import { useEffect, useState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import useTranslation from "../hooks/useTranslation";
import { API_URL } from "../lib/apiConfig";

function ContactList({ searchQuery = "" }) {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading, onlineUsers, deleteContact } =
    useChatStore();
  const { t } = useTranslation();

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

  const q = searchQuery.trim().toLowerCase();
  const filteredContacts = q
    ? allContacts.filter((contact) => {
        const name = (contact.name || "").toLowerCase();
        const email = (contact.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : allContacts;

  return (
    <div className="flex flex-col gap-1.5 px-1 h-full overflow-y-auto">
      {allContacts.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-6">{t("contactList.empty")}</p>
      )}

      {allContacts.length > 0 && filteredContacts.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">{t("common.noResults")}</p>
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
          ? `${API_URL}${contact.raw.profile}`
          : "/avatar.png";

        const displayName =
          contact.name?.trim() ||
          (contact.first_name || contact.last_name
            ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
            : contact.email?.split("@")[0]) ||
          t("common.unknownUser");

        return (
          <div
            key={contact._id || contact.id || idx}
            onClick={() => setSelectedUser(contact)}
            className="group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer
                       bg-gradient-to-r from-slate-800/40 to-slate-800/10 border border-slate-700/40
                       hover:from-cyan-500/10 hover:to-blue-500/5 hover:border-cyan-500/30
                       hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200"
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-cyan-500/10 group-hover:ring-cyan-400/40 transition-all">
                <img
                  src={profilePic}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.src = "/avatar.png")}
                />
              </div>
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  isOnline ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]" : "bg-gray-500"
                }`}
              />
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <h4 className="text-slate-200 font-medium text-sm truncate" title={displayName}>
                {displayName}
              </h4>
              <p
                className={`text-xs font-medium truncate transition-opacity ${
                  isOnline ? "text-green-400" : "text-slate-500"
                } group-hover:opacity-0`}
              >
                {isOnline ? t("common.online") : t("common.offline")}
              </p>
            </div>

            {contactRecordId && (
              <button
                onClick={(e) => handleDeleteClick(e, contactRecordId)}
                className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-200 ${
                  isConfirming
                    ? "bg-red-500 text-white w-16 h-8 opacity-100"
                    : "opacity-0 group-hover:opacity-100 w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                }`}
                title={isConfirming ? t("contactList.deleteConfirm") : t("contactList.deleteTitle")}
              >
                {isConfirming ? (
                  <span className="text-xs font-medium">{t("common.confirm")}</span>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ContactList;