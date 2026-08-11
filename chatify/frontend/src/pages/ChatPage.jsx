import {useState, useRef, useCallback, useEffect} from "react";
import {useChatStore} from "../store/useChatStore";
import {useChannelStore} from "../store/useChannelStore";
import {useCallStore} from "../store/useCallStore";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import GroupsList from "../components/GroupsList";
import ChannelsList from "../components/ChannelsList";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";
import ChannelChatContainer from "../components/ChannelChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";
import {Search, X} from "lucide-react";
import CallsList from "../components/CallsList";
import useTranslation from "../hooks/useTranslation";
import useDesktopNotifications from "../hooks/useDesktopNotifications";

const PULL_THRESHOLD = 55;
const MAX_PULL = 90;

function ChatPage() {
    const {
        activeTab,
        selectedUser,
        selectedGroup,
        setSelectedGroup,
        connectOnlineStatusSocket,
        disconnectOnlineStatusSocket,
    } = useChatStore();
    const {selectedChannel, setSelectedChannel} = useChannelStore();
    const {callStatus, groupCallStatus, minimizeCall} = useCallStore();
    const {t} = useTranslation();
    useDesktopNotifications();

    // ✅ FIX: این تابع هیچ‌جا صدا زده نمی‌شد — یعنی سوکت وضعیت آنلاین
    // (که new_message_notify ازش میاد و نوتیفیکیشن دسکتاپ بهش وابسته‌ست)
    // اصلاً هیچ‌وقت وصل نمی‌شد. باید یه‌بار موقع mount شدن صفحه‌ی چت وصل بشه،
    // و موقع خروج از صفحه بسته بشه.
    useEffect(() => {
        connectOnlineStatusSocket();
        return () => disconnectOnlineStatusSocket();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [searchOpen, setSearchOpen] = useState(false);
    const [pullOffset, setPullOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const listRef = useRef(null);
    const dragStartY = useRef(0);
    const draggingRef = useRef(false);

    useEffect(() => {
        const hasActiveCall =
            (callStatus !== "idle" && callStatus !== "ringing") ||
            groupCallStatus === "in-call";
        if (hasActiveCall) {
            minimizeCall();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUser, selectedGroup, selectedChannel]);

    const handleDragStart = useCallback(
        (clientY) => {
            if (searchOpen) return;
            if (listRef.current && listRef.current.scrollTop > 0) return;

            draggingRef.current = true;
            dragStartY.current = clientY;
            setIsDragging(true);
        },
        [searchOpen]
    );

    const handleDragMove = useCallback((clientY) => {
        if (!draggingRef.current) return;

        const delta = clientY - dragStartY.current;
        if (delta > 0) {
            setPullOffset(Math.min(delta, MAX_PULL));
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        setIsDragging(false);

        setPullOffset((current) => {
            if (current >= PULL_THRESHOLD) {
                setSearchOpen(true);
            }
            return 0;
        });
    }, []);

    const onTouchStart = (e) => handleDragStart(e.touches[0].clientY);
    const onTouchMove = (e) => handleDragMove(e.touches[0].clientY);
    const onTouchEnd = () => handleDragEnd();

    const onMouseDown = (e) => {
        handleDragStart(e.clientY);
        const onMouseMove = (moveEvent) => handleDragMove(moveEvent.clientY);
        const onMouseUp = () => {
            handleDragEnd();
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    const closeSearch = () => {
        setSearchOpen(false);
        setSearchQuery("");
    };

    return (
        <div className="relative w-full max-w-6xl h-[800px]" dir="rtl">
            <BorderAnimatedContainer className="flex h-full">
                {/* Sidebar */}
                <div className="w-80 bg-slate-800/50 backdrop-blur-sm flex flex-col overflow-hidden">
                    <ProfileHeader user={selectedUser || selectedGroup || selectedChannel}/>
                    <ActiveTabSwitch/>

                    <div
                        className="relative overflow-hidden shrink-0"
                        style={{
                            height: searchOpen ? 56 : Math.max(pullOffset * 0.6, isDragging ? 14 : 0),
                            transition: isDragging ? "none" : "height 0.25s ease",
                        }}
                    >
                        {!searchOpen && (
                            <div
                                onMouseDown={onMouseDown}
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                                onClick={() => setSearchOpen(true)}
                                className="absolute inset-x-0 top-0 flex items-center justify-center h-3.5 cursor-grab active:cursor-grabbing select-none"
                                title={t("chatPage.pullHint")}
                            >
                                <div className="w-10 h-1.5 rounded-full bg-slate-500/60"/>
                            </div>
                        )}

                        {searchOpen && (
                            <div
                                className="flex items-center gap-2 px-3 h-full bg-slate-800/70 border-b border-slate-700/60">
                                <Search className="w-4 h-4 text-slate-400 shrink-0"/>
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t("search.placeholder")}
                                    className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                                />
                                <button
                                    onClick={closeSearch}
                                    className="p-1 rounded-full hover:bg-slate-700/60 text-slate-400 hover:text-slate-100 transition-colors"
                                >
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                        )}
                    </div>

                    <div
                        ref={listRef}
                        onMouseDown={!searchOpen ? onMouseDown : undefined}
                        onTouchStart={!searchOpen ? onTouchStart : undefined}
                        onTouchMove={!searchOpen ? onTouchMove : undefined}
                        onTouchEnd={!searchOpen ? onTouchEnd : undefined}
                        className="flex-1 overflow-y-auto p-4 space-y-2"
                    >
                        {activeTab === "chats" && <ChatsList searchQuery={searchOpen ? searchQuery : ""}/>}
                        {activeTab === "contacts" && <ContactList searchQuery={searchOpen ? searchQuery : ""}/>}
                        {activeTab === "groups" && <GroupsList searchQuery={searchOpen ? searchQuery : ""}/>}
                        {activeTab === "channels" && <ChannelsList searchQuery={searchOpen ? searchQuery : ""}/>}
                        {activeTab === "calls" && <CallsList/>}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm">
                    {selectedUser && <ChatContainer user={selectedUser}/>}

                    {selectedGroup && (
                        <GroupChatContainer
                            group={selectedGroup}
                            onBack={() => setSelectedGroup(null)}
                        />
                    )}

                    {selectedChannel && (
                        <ChannelChatContainer
                            channel={selectedChannel}
                            onBack={() => setSelectedChannel(null)}
                        />
                    )}

                    {!selectedUser && !selectedGroup && !selectedChannel && (
                        <NoConversationPlaceholder message={t("noConversation.title")}/>
                    )}
                </div>
            </BorderAnimatedContainer>
        </div>
    );
}

export default ChatPage;