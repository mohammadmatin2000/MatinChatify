import { useChatStore } from "../store/useChatStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import GroupsList from "../components/GroupsList";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";

function ChatPage() {
  const { activeTab, selectedUser, selectedGroup, setSelectedGroup } = useChatStore();

  return (
    <div className="relative w-full max-w-6xl h-[800px]" dir="rtl">
      <BorderAnimatedContainer className="flex h-full">

        {/* Sidebar */}
        <div className="w-80 bg-slate-800/50 backdrop-blur-sm flex flex-col">
          <ProfileHeader user={selectedUser || selectedGroup} />
          <ActiveTabSwitch />
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "chats" && <ChatsList />}
            {activeTab === "contacts" && <ContactList />}
            {activeTab === "groups" && <GroupsList />}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm">

          {/* چت با یوزر */}
          {selectedUser && <ChatContainer user={selectedUser} />}

          {/* چت گروه */}
          {selectedGroup && (
            <GroupChatContainer
              group={selectedGroup}
              onBack={() => setSelectedGroup(null)}
            />
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
