import { useEffect, useState } from "react";
import { formatDistanceToNowStrict, isToday, format } from "date-fns";
import { faIR, enUS, de } from "date-fns/locale";
import { Video, Phone, PhoneMissed, PhoneIncoming, PhoneOutgoing, Users } from "lucide-react";
import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import useTranslation from "../hooks/useTranslation";

const DATE_LOCALES = { fa: faIR, en: enUS, de };

function formatTime(date, locale) {
  if (!date) return "";
  if (isToday(date)) return format(date, "HH:mm");
  return formatDistanceToNowStrict(date, { addSuffix: true, locale });
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function resolveImageUrl(path) {
  if (!path) return "/avatar.png";
  return path.startsWith("http") ? path : `http://localhost:8000${path}`;
}

function CallsList() {
  const { authUser } = useAuthStore();
  const { startCall, startGroupCall, callStatus, groupCallStatus } = useCallStore();
  const { t, language } = useTranslation();
  const dateLocale = DATE_LOCALES[language] || faIR;
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const headers = { Authorization: `Bearer ${token}` };

        const [privateRes, groupRes] = await Promise.all([
          axios.get("http://localhost:8000/call/calls/", { headers }),
          axios.get("http://localhost:8000/call/group-calls/", { headers }),
        ]);

        const privateCalls = privateRes.data.map((c) => ({
          ...c,
          scope: "private",
          is_outgoing: c.caller === authUser.id,
        }));

        const groupCalls = groupRes.data.map((c) => ({
          ...c,
          scope: "group",
          is_outgoing: c.initiator === authUser.id,
        }));

        const merged = [...privateCalls, ...groupCalls].sort(
          (a, b) => new Date(b.started_at) - new Date(a.started_at)
        );

        setCalls(merged);
      } catch (err) {
        console.error("Error fetching call history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalls();
  }, [authUser?.id]);

  const handleCallBack = (call, e) => {
    e?.stopPropagation();

    if (callStatus !== "idle" || groupCallStatus !== "idle") return;

    if (call.scope === "group") {
      startGroupCall(
        { id: call.group, name: call.group_name },
        { name: authUser?.name || authUser?.fullName, image: authUser?.profile },
        call.call_type
      );
    } else {
      const otherUserId = call.is_outgoing ? call.receiver : call.caller;
      startCall(
        {
          id: otherUserId,
          myName: authUser?.name || authUser?.fullName,
          myImage: authUser?.profile,
        },
        call.call_type
      );
    }
  };

  if (loading) return <p className="text-center text-slate-500 text-sm py-8">{t("common.loading")}</p>;
  if (calls.length === 0) return <p className="text-center text-slate-500 text-sm py-8">{t("calls.empty")}</p>;

  return (
    <div className="flex flex-col gap-1.5 px-1">
      {calls.map((call) => {
        const isGroup = call.scope === "group";
        const isOutgoing = call.is_outgoing;

        const displayName = isGroup
          ? call.group_name
          : isOutgoing
          ? call.receiver_name
          : call.caller_name;

        const isMissedOrRejected = isGroup
          ? call.status === "no_answer"
          : call.status === "missed" || call.status === "rejected";

        const DirectionIcon = isGroup
          ? Users
          : isMissedOrRejected
          ? PhoneMissed
          : isOutgoing
          ? PhoneOutgoing
          : PhoneIncoming;

        const TypeIcon = call.call_type === "video" ? Video : Phone;
        const durationLabel = formatDuration(call.duration);

        const profileImagePath = isGroup
          ? call.group_image
          : isOutgoing
          ? call.receiver_image
          : call.caller_image;
        const profilePicUrl = resolveImageUrl(profileImagePath);

        let statusLabel;
        if (isGroup) {
          statusLabel = call.status === "no_answer" ? t("calls.missed") : durationLabel || t("calls.ended");
        } else if (call.status === "missed") {
          statusLabel = t("calls.missed");
        } else if (call.status === "rejected") {
          statusLabel = t("calls.rejected");
        } else {
          statusLabel = durationLabel || t("calls.answered");
        }

        return (
          <div
            key={`${call.scope}-${call.id}`}
            onClick={(e) => handleCallBack(call, e)}
            className="group flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-slate-800/40 to-slate-800/10
                       border border-slate-700/40 hover:from-cyan-500/10 hover:to-blue-500/5 hover:border-cyan-500/30
                       transition-all duration-200 cursor-pointer active:scale-[0.99]"
          >
            <div className="w-[52px] h-[52px] rounded-full overflow-hidden ring-2 ring-cyan-500/10 flex items-center justify-center bg-slate-700/40">
              {isGroup && !call.group_image ? (
                <Users className="w-6 h-6 text-slate-300" />
              ) : (
                <img
                  src={profilePicUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.src = "/avatar.png")}
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-slate-100 font-semibold text-[15px] truncate">{displayName}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <DirectionIcon
                  className={`w-3.5 h-3.5 flex-shrink-0 ${isMissedOrRejected ? "text-red-400" : "text-green-400"}`}
                />
                <p className={`text-[13px] truncate ${isMissedOrRejected ? "text-red-400" : "text-slate-400"}`}>
                  {statusLabel}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {formatTime(new Date(call.started_at), dateLocale)}
              </span>
              <button
                onClick={(e) => handleCallBack(call, e)}
                className="p-1 rounded-full hover:bg-cyan-500/10 transition-colors"
                title={call.call_type === "video" ? t("chatHeader.videoCall") : t("chatHeader.audioCall")}
              >
                <TypeIcon className="w-4 h-4 text-cyan-400" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CallsList;