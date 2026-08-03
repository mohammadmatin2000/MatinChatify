import { useChatStore } from "../store/useChatStore";
import { MessageCircle, Contact, Users, Phone, Radio } from "lucide-react";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

  const tabs = [
    { key: "chats", label: "گفتگوها", icon: MessageCircle },
    { key: "contacts", label: "مخاطبین", icon: Contact },
    { key: "groups", label: "گروه‌ها", icon: Users },
    { key: "channels", label: "چنل‌ها", icon: Radio },
    { key: "calls", label: "تماس‌ها", icon: Phone },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-800/40 p-1.5 m-2 rounded-2xl border border-slate-700/40">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl
                        transition-all duration-200 ease-out
                        ${
                          isActive
                            ? "bg-gradient-to-b from-cyan-500/25 to-cyan-500/5 text-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/30"
                        }`}
          >
            <Icon
              className={`w-[18px] h-[18px] transition-transform duration-200 ${
                isActive ? "scale-110" : "scale-100"
              }`}
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span className={`text-[10.5px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
              {tab.label}
            </span>

            {/* نقطه‌ی کوچیک زیر تب فعال، شبیه ایندیکیتور واتساپ */}
            {isActive && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-cyan-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ActiveTabSwitch;