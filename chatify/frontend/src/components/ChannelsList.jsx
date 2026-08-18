import { useEffect, useState, useRef } from "react";
import { Trash2, Radio, LogOut, LogIn } from "lucide-react";
import { useChannelStore } from "../store/useChannelStore";
import { useChatStore } from "../store/useChatStore";
import useTranslation from "../hooks/useTranslation";
import { API_URL } from "../lib/apiConfig";
const API_BASE_URL = API_URL;

function ChannelsList({ searchQuery = "" }) {
  const { channels, getAllChannels, isChannelsLoading, setSelectedChannel, deleteChannel, leaveChannel, joinChannel } =
    useChannelStore();
  const { setSelectedUser, setSelectedGroup } = useChatStore();
  const { t } = useTranslation();

  const [confirmId, setConfirmId] = useState(null);
  const confirmTimerRef = useRef(null);

  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    getAllChannels();
  }, [getAllChannels]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    const result = await joinChannel(inviteCode.trim());
    setIsJoining(false);
    if (result) {
      setInviteCode("");
      setShowJoinForm(false);
    }
  };

  const handleSelectChannel = (channel) => {
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedChannel(channel);
  };

  if (isChannelsLoading) {
    return <div className="flex justify-center items-center py-8 text-slate-400 animate-pulse">{t("channelsList.loading")}</div>;
  }

  const q = searchQuery.trim().toLowerCase();
  const filtered = q ? channels.filter((c) => (c.name || "").toLowerCase().includes(q)) : channels;

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <button
        onClick={() => setShowJoinForm((v) => !v)}
        className="flex items-center gap-2 p-2.5 rounded-xl text-violet-400 text-sm font-medium
                   border border-dashed border-violet-500/30 hover:bg-violet-500/10 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        {t("channelsList.joinWithCode")}
      </button>

      {showJoinForm && (
        <form onSubmit={handleJoinSubmit} className="flex gap-2 mb-1 px-1">
          <input
            autoFocus
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder={t("channelsList.joinCodePlaceholder")}
            dir="ltr"
            className="flex-1 bg-slate-900/60 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={isJoining || !inviteCode.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs px-3 rounded-lg transition-colors"
          >
            {isJoining ? t("channelsList.joining") : t("channelsList.joinBtn")}
          </button>
        </form>
      )}

      {channels.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-6">{t("channelsList.empty")}</p>
      )}

      {channels.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">{t("common.noResults")}</div>
      )}

      {filtered.map((channel) => {
        const isOwner = channel.my_role === "admin";
        const isConfirming = confirmId === channel.id;

        const avatarUrl = channel.image
          ? channel.image.startsWith("http")
            ? channel.image
            : `${API_BASE_URL}${channel.image}`
          : null;

        const handleActionClick = (e) => {
          e.stopPropagation();
          if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
          setConfirmId(channel.id);
          confirmTimerRef.current = setTimeout(() => {
            setConfirmId((current) => (current === channel.id ? null : current));
          }, 3000);
        };

        const handleFinalAction = async (e) => {
          e.stopPropagation();
          if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
          setConfirmId(null);
          if (isOwner) await deleteChannel(channel.id);
          else await leaveChannel(channel.id);
        };

        return (
          <div
            key={channel.id}
            onClick={() => handleSelectChannel(channel)}
            className="group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer
                       bg-gradient-to-r from-slate-800/40 to-slate-800/10 border border-slate-700/40
                       hover:from-violet-500/10 hover:to-fuchsia-500/5 hover:border-violet-500/30
                       hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200"
          >
            <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white shadow-md overflow-hidden ring-2 ring-violet-500/10 group-hover:ring-violet-400/40 transition-all flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={channel.name} className="w-full h-full object-cover" onError={(e) => (e.target.src = "/avatar.png")} />
              ) : (
                <Radio className="w-6 h-6" />
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-200 font-semibold text-[15px] truncate">{channel.name}</p>
                <Radio className="w-3 h-3 text-violet-400 flex-shrink-0" />
              </div>
              <p className="text-slate-400 text-xs truncate transition-opacity group-hover:opacity-0">
                {channel.members_count === 0 ? t("channelsList.noMembers") : t("channelsList.membersCount", { count: channel.members_count })}
                {" · "}{channel.is_public ? t("channelsList.public") : t("channelsList.private")}
              </p>
            </div>

            <button
              onClick={isConfirming ? handleFinalAction : handleActionClick}
              className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-200 ${
                isConfirming
                  ? "bg-red-500 text-white w-16 h-8 opacity-100"
                  : "opacity-0 group-hover:opacity-100 w-8 h-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              }`}
              title={isConfirming ? t("common.confirm") : isOwner ? t("channelsList.deleteTitle") : t("channelsList.leaveTitle")}
            >
              {isConfirming ? (
                <span className="text-xs font-medium">{t("common.confirm")}</span>
              ) : isOwner ? (
                <Trash2 className="w-4 h-4" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ChannelsList;