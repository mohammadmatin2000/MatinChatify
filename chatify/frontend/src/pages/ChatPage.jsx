import { useChatStore } from "../store/useChatStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import GroupsList from "../components/GroupsList"; // اضافه شد
import ChatContainer from "../components/ChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";

function ChatPage() {
  const { activeTab, selectedUser } = useChatStore();

  return (
    <div className="relative w-full max-w-6xl h-[800px]" dir="rtl">
      <BorderAnimatedContainer>
        {/* سمت چپ */}
        <div className="w-80 bg-slate-800/50 backdrop-blur-sm flex flex-col">
          {/* هدر پروفایل */}
          <ProfileHeader user={selectedUser} />

          {/* سوییچ تب‌ها */}
          <ActiveTabSwitch />

          {/* لیست محتوا بر اساس تب */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "chats" && <ChatsList />}
            {activeTab === "contacts" && <ContactList />}
            {activeTab === "groups" && <GroupsList />}
          </div>
        </div>

        {/* سمت راست */}
        <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm">
          {selectedUser
            ? <ChatContainer />
            : <NoConversationPlaceholder message="هیچ گفتگویی انتخاب نشده است" />}
        </div>
      </BorderAnimatedContainer>
    </div>
  );
}

export default ChatPage;
