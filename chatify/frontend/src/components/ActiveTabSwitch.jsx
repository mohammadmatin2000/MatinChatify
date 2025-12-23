import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

  const tabs = [
    { key: "chats", label: "گفتگوها" },
    { key: "contacts", label: "مخاطبین" },
    { key: "groups", label: "گروه‌ها" },
  ];

  return (
    <div className="tabs tabs-boxed bg-transparent p-2 m-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`tab ${
            activeTab === tab.key
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-400"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default ActiveTabSwitch;
