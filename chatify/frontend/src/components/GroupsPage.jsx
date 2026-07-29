import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import GroupsList from "../components/GroupsList";
import CallsList from "../components/CallsList";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";

const SEARCH_PLACEHOLDERS = {
  chats: "جستجو در گفتگوها...",
  contacts: "جستجو در مخاطبین...",
  groups: "جستجو در گروه‌ها...",
  calls: "جستجو در تماس‌ها...",
};

function ChatPage() {
  const { activeTab, selectedUser, selectedGroup, setSelectedGroup } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ با تغییر تب، سرچ قبلی پاک بشه (مثل واتساب که هر بخش سرچ مستقل خودشو داره)
  useEffect(() => {
    setSearchQuery("");
  }, [activeTab]);

  return (
    <div className="relative w-full max-w-6xl h-[800px]" dir="rtl">
      <BorderAnimatedContainer className="flex h-full">
        {/* Sidebar */}
        <div className="w-80 bg-slate-800/50 backdrop-blur-sm flex flex-col">
          <ProfileHeader user={selectedUser || selectedGroup} />
          <ActiveTabSwitch />

          {/* ✅ نوار جستجوی sticky — همیشه در دیده، دقیقاً مثل واتساب */}
          <div className="sticky top-0 z-10 bg-slate-800/50 backdrop-blur-sm px-4 pb-3">
            <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={SEARCH_PLACEHOLDERS[activeTab] || "جستجو..."}
                className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-200 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "chats" && <ChatsList searchQuery={searchQuery} />}
            {activeTab === "contacts" && <ContactList searchQuery={searchQuery} />}
            {activeTab === "groups" && <GroupsList searchQuery={searchQuery} />}
            {activeTab === "calls" && <CallsList searchQuery={searchQuery} />}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm">
          {/* چت با یوزر */}
          {selectedUser && <ChatContainer user={selectedUser} />}

          {/* چت گروه */}
          {selectedGroup && (
            <GroupChatContainer group={selectedGroup} onBack={() => setSelectedGroup(null)} />
          )}

          {/* هیچ انتخابی نشده */}
          {!selectedUser && !selectedGroup && (
            <NoConversationPlaceholder message="یک گفت‌وگو انتخاب کنید" />
          )}
        </div>
      </BorderAnimatedContainer>
    </div>
  );
}

export default ChatPage;