import {useState, useEffect, useRef, useCallback} from "react";
import {
    LogOutIcon,
    VolumeOffIcon,
    Volume2Icon,
    PencilIcon,
    PlusIcon,
    PhoneIcon,
    MailIcon,
    XIcon,
    UserIcon,
    UserPlus,
    Search,
    Check,
    UsersIcon,
    Radio,
    Settings as SettingsIcon,
    ChevronLeft,
    Bell,
    BellOff,
    Lock,
    MessageSquare,
    Database,
    HelpCircle,
    Share2,
    Info,
    Eye,
    EyeOff,
    Globe,
    Shield,
    Image as ImageIcon,
    Smartphone,
    Trash2,
    KeyRound,
    ChevronDown,
    Loader2,
    ExternalLink,
    Send as TelegramIcon,
    Github,
    Heart,
    Copy,
    SparklesIcon,
} from "lucide-react";
import {useChatStore} from "../store/useChatStore";
import {useCallStore} from "../store/useCallStore";
import CreateChannelModal from "./CreateChannelModal";
import {useLanguageStore} from "../store/useLanguageStore";
import {useSettingsStore} from "../store/useSettingsStore";
import {LANGUAGES} from "../lib/translations";
import useTranslation from "../hooks/useTranslation";
import toast from "react-hot-toast";
import axios from "axios";


const mouseClickSound = new Audio("/sounds/mouse-click.mp3");
const API_BASE_URL = "http://localhost:8000";

// ============================== کامپوننت سوییچ آی‌اواس‌استایل ==============================
function ToggleSwitch({checked, onChange, disabled}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onChange(!checked);
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                checked ? "bg-cyan-500" : "bg-slate-600"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        >
            <span
                className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                    checked ? "-translate-x-6" : "-translate-x-1"
                }`}
            />
        </button>
    );
}

function SettingRow({icon: Icon, iconColor = "text-cyan-400", title, subtitle, onClick, rightContent, danger}) {
    return (
        <div
            onClick={onClick}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer hover:bg-slate-700/40 active:bg-slate-700/60"
        >
            {Icon && (
                <div
                    className={`flex items-center justify-center h-9 w-9 rounded-full bg-slate-700/60 flex-shrink-0 ${
                        danger ? "text-red-400" : iconColor
                    }`}
                >
                    <Icon className="h-4.5 w-4.5"/>
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${danger ? "text-red-400" : "text-slate-200"}`}>{title}</p>
                {subtitle && <p className="text-slate-500 text-xs mt-0.5 truncate">{subtitle}</p>}
            </div>
            {rightContent}
        </div>
    );
}

function SectionLabel({children}) {
    return <p className="px-4 pt-4 pb-1 text-xs font-medium text-cyan-500/80">{children}</p>;
}

function SettingsSubHeader({title, onBack, saving}) {
    return (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50 flex-shrink-0 bg-slate-800">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5"/>
            </button>
            <h3 className="text-slate-100 font-semibold text-base flex-1">{title}</h3>
            {saving && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin"/>}
        </div>
    );
}

function RadioOptionGroup({options, value, onChange}) {
    return (
        <div className="divide-y divide-slate-700/40">
            {options.map((opt) => (
                <div
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                >
                    <div>
                        <p className="text-sm text-slate-200">{opt.label}</p>
                        {opt.subtitle && <p className="text-xs text-slate-500 mt-0.5">{opt.subtitle}</p>}
                    </div>
                    <div
                        className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 ${
                            value === opt.value ? "border-cyan-500" : "border-slate-500"
                        }`}
                    >
                        {value === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-cyan-500"/>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProfileHeader({onNewGroup}) {


    const {
        logout,
        allContacts,
        getAllContacts,
        addContact,
        searchResults,
        isSearching,
        searchUsers,
        clearSearch,
        isSoundEnabled,
        toggleSound,
    } = useChatStore();

    const [isEditingBio, setIsEditingBio] = useState(false);
    const bioInputRef = useRef(null);

    const { t } = useTranslation();

    const {disconnectCallSocket} = useCallStore();

    const [profile, setProfile] = useState({first_name: "", image: "/avatar.png"});
    const [isEditingName, setIsEditingName] = useState(false);
    const [selectedImg, setSelectedImg] = useState(null);
    const [showNewMenu, setShowNewMenu] = useState(false);

    // ---- مودال افزودن مخاطب ----
    const [showAddContact, setShowAddContact] = useState(false);
    const [addContactTab, setAddContactTab] = useState("phone");
    const [contactPhone, setContactPhone] = useState("");
    const [contactDisplayName, setContactDisplayName] = useState("");
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [addContactError, setAddContactError] = useState("");
    const [addContactSuccess, setAddContactSuccess] = useState(false);
    const [contactQuery, setContactQuery] = useState("");
    const [openFaqIndex, setOpenFaqIndex] = useState(null);
    const [addingId, setAddingId] = useState(null);
    const debounceRef = useRef(null);

    // ---- مودال ساخت گروه ----
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // ---- مودال ساخت چنل ----
    const [showCreateChannel, setShowCreateChannel] = useState(false);

    // ============================== تنظیمات ==============================
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState("main");
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsError, setSettingsError] = useState("");
    const settingsLoadedRef = useRef(false);

    const [lastSeen, setLastSeen] = useState("everyone");
    const [photoVisibility, setPhotoVisibility] = useState("everyone");
    const [aboutVisibility, setAboutVisibility] = useState("everyone");
    const [readReceipts, setReadReceipts] = useState(true);
    const [onlineStatus, setOnlineStatus] = useState(true);
    const [twoStepEnabled, setTwoStepEnabled] = useState(false);

    const [notifMessages, setNotifMessages] = useState(true);
    const [notifGroups, setNotifGroups] = useState(true);
    const [notifCalls, setNotifCalls] = useState(true);
    const [notifPreview, setNotifPreview] = useState(true);
    const [notifVibrate, setNotifVibrate] = useState(true);

    const [darkTheme, setDarkTheme] = useState(true);
    const [enterToSend, setEnterToSend] = useState(true);
    const [fontSize, setFontSize] = useState("medium");

    const [autoDownloadWifi, setAutoDownloadWifi] = useState(true);
    const [autoDownloadMobile, setAutoDownloadMobile] = useState(false);

    const [language, setLanguage] = useState("fa");
    const [aboutText, setAboutText] = useState("");

    // ---- تغییر رمز عبور ----
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [changePasswordError, setChangePasswordError] = useState("");
    const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // ---- حذف حساب ----
    const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteAccountError, setDeleteAccountError] = useState("");
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    // ---- مخاطبین مسدود شده ----
    const [blockedContacts, setBlockedContacts] = useState([]);
    const [blockedLoading, setBlockedLoading] = useState(false);
    const [unblockingId, setUnblockingId] = useState(null);

    // ---- مدیریت فضای ذخیره‌سازی ----
    const [storageSummary, setStorageSummary] = useState(null);
    const [storageLoading, setStorageLoading] = useState(false);
    const [storageItems, setStorageItems] = useState([]);
    const [storageItemsType, setStorageItemsType] = useState(null);
    const [storageItemsLoading, setStorageItemsLoading] = useState(false);
    const [selectedStorageItems, setSelectedStorageItems] = useState([]);
    const [deletingStorage, setDeletingStorage] = useState(false);
    const [cacheCleared, setCacheCleared] = useState(false);

    const fileInputRef = useRef(null);
    const settingsAvatarInputRef = useRef(null);
    const inputRef = useRef(null);
    const accessToken = localStorage.getItem("accessToken");
    const authHeaders = {Authorization: `Bearer ${accessToken}`};

    // ---- پس‌زمینه چت و پشتیبان‌گیری ----
    const [chatWallpaper, setChatWallpaper] = useState("default");
    const [lastBackupAt, setLastBackupAt] = useState(null);
    const [backupInProgress, setBackupInProgress] = useState(false);

    const setAppLanguage = useLanguageStore((state) => state.setLanguage);

    const setLocalSetting = useSettingsStore((state) => state.setSetting);

    useEffect(() => {
        if (isEditingBio && bioInputRef.current) bioInputRef.current.focus();
    }, [isEditingBio]);

    const handleBioChange = async () => {
        try {
            const formData = new FormData();
            formData.append("bio", profile.bio || "");
            const res = await axios.patch(`${API_BASE_URL}/accounts/profile/update/`, formData, {
                headers: {Authorization: `Bearer ${accessToken}`},
            });
            setProfile(res.data);
        } catch {
        }
    };

    useEffect(() => {
        if (!accessToken) return;
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/accounts/profile/update/`, {
                    headers: authHeaders,
                });
                setProfile(res.data);
            } catch {
            }
        };
        fetchProfile();
    }, [accessToken]);

    useEffect(() => {
        if (isEditingName && inputRef.current) inputRef.current.focus();
    }, [isEditingName]);

    // ---- گرفتن تنظیمات از بک‌اند (اولین باری که پنل تنظیمات باز میشه) ----
    useEffect(() => {
        if (!showSettings || !accessToken || settingsLoadedRef.current) return;

        const fetchSettings = async () => {
            setSettingsLoading(true);
            setSettingsError("");
            try {
                const res = await axios.get(`${API_BASE_URL}/settings/`, {headers: authHeaders});
                const d = res.data;

                setAboutText(d.about_text ?? "");
                setTwoStepEnabled(!!d.two_step_enabled);
                setLastSeen(d.last_seen_visibility ?? "everyone");
                setPhotoVisibility(d.photo_visibility ?? "everyone");
                setAboutVisibility(d.about_visibility ?? "everyone");
                setReadReceipts(!!d.read_receipts);
                setOnlineStatus(!!d.online_status_visible);
                setNotifMessages(!!d.notif_messages);
                setNotifGroups(!!d.notif_groups);
                setNotifCalls(!!d.notif_calls);
                setNotifPreview(!!d.notif_preview);
                setNotifVibrate(!!d.notif_vibrate);
                setDarkTheme(!!d.dark_theme);
                setEnterToSend(!!d.enter_to_send);
                setFontSize(d.font_size ?? "medium");
                setLocalSetting("fontSize", d.font_size ?? "medium");
                setLocalSetting("chatWallpaper", d.chat_wallpaper ?? "default");
                setLocalSetting("enterToSend", !!d.enter_to_send);
                setAutoDownloadWifi(!!d.auto_download_wifi);
                setAutoDownloadMobile(!!d.auto_download_mobile);
                setLanguage(d.language ?? "fa");
                setChatWallpaper(d.chat_wallpaper ?? "default");
                setLastBackupAt(d.last_backup_at ?? null);
                setNotifMessages(!!d.notif_messages);
                setLocalSetting("notifMessages", !!d.notif_messages);
                setNotifGroups(!!d.notif_groups);
                setLocalSetting("notifGroups", !!d.notif_groups);
                setNotifCalls(!!d.notif_calls);
                setLocalSetting("notifCalls", !!d.notif_calls);
                setNotifPreview(!!d.notif_preview);
                setLocalSetting("notifPreview", !!d.notif_preview);
                setNotifVibrate(!!d.notif_vibrate);
                setLocalSetting("notifVibrate", !!d.notif_vibrate);

                if (typeof d.sound_enabled === "boolean" && d.sound_enabled !== isSoundEnabled) {
                    toggleSound();
                }

                settingsLoadedRef.current = true;
            } catch (err) {
                console.error("خطا در دریافت تنظیمات:", err.response?.data || err);
                setSettingsError("دریافت تنظیمات با خطا مواجه شد.");
            } finally {
                setSettingsLoading(false);
            }
        };

        fetchSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSettings, accessToken]);

    // ---- PATCH عمومی برای هر فیلد تنظیمات ----
    const patchSetting = async (field, value) => {
        setSettingsSaving(true);
        setSettingsError("");
        try {
            await axios.patch(`${API_BASE_URL}/settings/`, {[field]: value}, {headers: authHeaders});
        } catch (err) {
            console.error("خطا در ذخیره تنظیمات:", err.response?.data || err);
            setSettingsError("ذخیره نشد. دوباره امتحان کن.");
        } finally {
            setSettingsSaving(false);
        }
    };

    const bindToggle = (setter, field, storeKey) => (value) => {
    setter(value);
    patchSetting(field, value);
    if (storeKey) setLocalSetting(storeKey, value);
    };

    const cycleVisibility = (current, setter, field) => {
        const next = current === "everyone" ? "contacts" : current === "contacts" ? "nobody" : "everyone";
        setter(next);
        patchSetting(field, next);
    };

    const cycleFontSize = () => {
        const next = fontSize === "small" ? "medium" : fontSize === "medium" ? "large" : "small";
        setFontSize(next);
        patchSetting("font_size", next);
        setLocalSetting("fontSize", next); // ← این خط
    };

    const handleLanguageChange = (value) => {
        setLanguage(value);
        setAppLanguage(value); // ✅ کل اپ همین لحظه عوض می‌شه (جهت صفحه + متن‌ها)
        patchSetting("language", value);
    };

    const handleAboutTextBlur = () => {
        patchSetting("about_text", aboutText);
    };

    const handleSoundToggleInSettings = () => {
        handleToggleSound();
        patchSetting("sound_enabled", !isSoundEnabled);
    };

    // این تابع جدیده، جای bindToggle(setEnterToSend, "enter_to_send") استفادش کن
    const handleEnterToSendToggle = (value) => {
        setEnterToSend(value);
        patchSetting("enter_to_send", value);
        setLocalSetting("enterToSend", value);
    };


    const handleLogout = async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        try {
            await axios.post(
                `${API_BASE_URL}/accounts/logout/`,
                {refresh: refreshToken},
                {headers: authHeaders}
            );
        } catch {
        } finally {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            disconnectCallSocket();
            logout();
            window.location.replace("/login");
        }
    };
    // ========================== دعوت از دوستان ==========================
    const handleInviteFriends = async () => {
        const inviteUrl = `${window.location.origin}/signup`;
        const shareText = "بیا با من توی چتیفای چت کن 🚀";

        // ✅ اگه گوشی/مرورگر از Share API پشتیبانی کنه (بیشتر موبایل‌ها)
        if (navigator.share) {
            try {
                await navigator.share({title: "چتیفای", text: shareText, url: inviteUrl});
            } catch (err) {
                // اگه خودِ کاربر منوی اشتراک‌گذاری رو کنسل کرده، این خطا طبیعیه
                if (err?.name !== "AbortError") {
                    console.error("خطا در اشتراک‌گذاری:", err);
                    toast.error("اشتراک‌گذاری ممکن نشد");
                }
            }
            return;
        }

        // ✅ فال‌بک برای دسکتاپ: کپی توی کلیپ‌بورد + فیدبک واقعی
        try {
            await navigator.clipboard.writeText(inviteUrl);
            toast.success("لینک دعوت کپی شد ✅");
        } catch (err) {
            console.error("خطا در کپی لینک:", err);
            toast.error("کپی لینک ممکن نشد");
        }
    };


    const handleToggleSound = () => {
        try {
            mouseClickSound.currentTime = 0;
            mouseClickSound.play();
        } catch {
        }
        toggleSound();
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image", file);
        formData.append("first_name", profile.first_name || "");

        try {
            const res = await axios.patch(`${API_BASE_URL}/accounts/profile/update/`, formData, {
                headers: authHeaders,
            });
            setProfile(res.data);
            setSelectedImg(URL.createObjectURL(file));
        } catch {
        }
    };

    const handleNameChange = async () => {
        try {
            const formData = new FormData();
            formData.append("first_name", profile.first_name);
            const res = await axios.patch(`${API_BASE_URL}/accounts/profile/update/`, formData, {
                headers: authHeaders,
            });
            setProfile(res.data);
        } catch {
        }
    };

    const handleWallpaperSelect = (id) => {
        setChatWallpaper(id);
        patchSetting("chat_wallpaper", id);
        setLocalSetting("chatWallpaper", id); // ← این خط
    };

    // ---- پشتیبان‌گیری از چت‌ها ----
    const formatBackupDate = (iso) => {
        if (!iso) return "هنوز پشتیبان‌گیری نشده";
        try {
            return `آخرین بار: ${new Date(iso).toLocaleDateString("fa-IR")}`;
        } catch {
            return "هنوز پشتیبان‌گیری نشده";
        }
    };

    const handleBackupChats = async () => {
        setBackupInProgress(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/settings/backup-chats/`, {
                headers: authHeaders,
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            const today = new Date().toISOString().slice(0, 10);
            link.setAttribute("download", `chatify-backup-${today}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setLastBackupAt(new Date().toISOString());
            toast.success("پشتیبان‌گیری با موفقیت دانلود شد ✅");
        } catch (err) {
            console.error("خطا در پشتیبان‌گیری:", err.response?.data || err);
            toast.error("پشتیبان‌گیری ناموفق بود");
        } finally {
            setBackupInProgress(false);
        }
    };

    // ========================== مودال افزودن مخاطب ==========================
    const openAddContact = () => {
        setShowNewMenu(false);
        setAddContactTab("phone");
        setContactPhone("");
        setContactDisplayName("");
        setContactQuery("");
        clearSearch();
        setAddContactError("");
        setAddContactSuccess(false);
        setShowAddContact(true);
    };

    const closeAddContact = () => {
        setShowAddContact(false);
        setContactPhone("");
        setContactDisplayName("");
        setContactQuery("");
        clearSearch();
        setAddContactError("");
        setAddContactSuccess(false);
    };

    const handleAddContactByPhone = async (e) => {
        e.preventDefault();
        setAddContactError("");
        setAddContactSuccess(false);

        if (!/^09\d{9}$/.test(contactPhone)) {
            setAddContactError("شماره موبایل معتبر نیست.");
            return;
        }
        if (!contactDisplayName.trim()) {
            setAddContactError("یه اسم برای این مخاطب وارد کن.");
            return;
        }

        setIsAddingContact(true);
        const result = await addContact({phoneNumber: contactPhone, displayName: contactDisplayName.trim()});
        setIsAddingContact(false);

        if (result) {
            setAddContactSuccess(true);
            setContactPhone("");
            setContactDisplayName("");
        } else {
            setAddContactError("این شماره توی چتیفای ثبت‌نام نکرده.");
        }
    };

    const handleContactQueryChange = useCallback(
        (value) => {
            setContactQuery(value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                searchUsers(value);
            }, 350);
        },
        [searchUsers]
    );

    const handleAddContactByEmail = async (user) => {
        setAddingId(user.id);
        await addContact({userId: user.id, displayName: user.name || user.email});
        setAddingId(null);
    };

    // ========================== مودال ساخت گروه ==========================
    const openCreateGroup = () => {
        setShowNewMenu(false);
        setGroupName("");
        setGroupDescription("");
        setSelectedMemberIds([]);
        getAllContacts();
        setShowCreateGroup(true);
    };

    const closeCreateGroup = () => {
        setShowCreateGroup(false);
        setGroupName("");
        setGroupDescription("");
        setSelectedMemberIds([]);
    };

    const toggleMember = (contactId) => {
        setSelectedMemberIds((prev) =>
            prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || isCreatingGroup) return;
        setIsCreatingGroup(true);

        try {
            const res = await axios.post(
                `${API_BASE_URL}/groups/groups/`,
                {
                    name: groupName.trim(),
                    description: groupDescription.trim() || "گروه جدید",
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const newGroup = res.data;

            try {
                await axios.post(
                    `${API_BASE_URL}/groups/members/`,
                    {group: newGroup.id, role: "admin"},
                    {headers: authHeaders}
                );
            } catch (err) {
                console.warn("خطا در افزودن سازنده به گروه:", err.response?.data || err);
            }

            await Promise.all(
                selectedMemberIds.map((memberId) =>
                    axios
                        .post(
                            `${API_BASE_URL}/groups/members/`,
                            {group: newGroup.id, user: memberId, role: "member"},
                            {headers: authHeaders}
                        )
                        .catch((err) => console.warn("خطا در افزودن عضو:", err.response?.data || err))
                )
            );

            if (onNewGroup) onNewGroup(newGroup);
            closeCreateGroup();
        } catch (err) {
            console.error("خطا در ساخت گروه:", err.response?.data || err);
        } finally {
            setIsCreatingGroup(false);
        }
    };

    // ========================== مودال ساخت چنل ==========================
    const openCreateChannel = () => {
        setShowNewMenu(false);
        setShowCreateChannel(true);
    };

    // ========================== تنظیمات: باز/بسته کردن ==========================
    const openSettings = () => {
        setShowNewMenu(false);
        setSettingsView("main");
        setShowSettings(true);
    };

    const closeSettings = () => {
        setShowSettings(false);
        setSettingsView("main");
        setShowDeleteAccountConfirm(false);
        setShowChangePassword(false);
        setChangePasswordError("");
        setChangePasswordSuccess(false);
        setOldPassword("");
        setNewPassword("");
        setDeletePassword("");
        setDeleteAccountError("");
    };

    // ---- مخاطبین مسدود شده ----
    const openBlockedView = async () => {
        setSettingsView("blocked");
        setBlockedLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/settings/blocked/`, {headers: authHeaders});
            setBlockedContacts(res.data || []);
        } catch (err) {
            console.error("خطا در دریافت لیست مسدودها:", err.response?.data || err);
        } finally {
            setBlockedLoading(false);
        }
    };

    const handleUnblock = async (contactId) => {
        setUnblockingId(contactId);
        try {
            await axios.post(`${API_BASE_URL}/settings/unblock/${contactId}/`, {}, {headers: authHeaders});
            setBlockedContacts((prev) => prev.filter((c) => c.id !== contactId));
        } catch (err) {
            console.error("خطا در رفع مسدودیت:", err.response?.data || err);
        } finally {
            setUnblockingId(null);
        }
    };

    // ---- مدیریت فضای ذخیره‌سازی ----
    const fetchStorageSummary = async () => {
        setStorageLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/settings/storage-usage/`, {headers: authHeaders});
            setStorageSummary(res.data);
        } catch (err) {
            console.error("خطا در دریافت اطلاعات فضا:", err.response?.data || err);
        } finally {
            setStorageLoading(false);
        }
    };

    const openStorageManage = async () => {
        setSettingsView("storage-manage");
        await fetchStorageSummary();
    };

    const openStorageItems = async (type) => {
        setStorageItemsType(type);
        setSelectedStorageItems([]);
        setStorageItemsLoading(true);
        setSettingsView("storage-items");
        try {
            const res = await axios.get(`${API_BASE_URL}/settings/storage-usage/items/`, {
                headers: authHeaders,
                params: {type},
            });
            setStorageItems(res.data || []);
        } catch (err) {
            console.error("خطا در دریافت لیست فایل‌ها:", err.response?.data || err);
        } finally {
            setStorageItemsLoading(false);
        }
    };

    const toggleStorageItemSelect = (messageId) => {
        setSelectedStorageItems((prev) =>
            prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
        );
    };

    const handleDeleteSelectedStorageItems = async () => {
        if (selectedStorageItems.length === 0) return;
        setDeletingStorage(true);
        try {
            await Promise.all(
                selectedStorageItems.map((id) =>
                    axios.delete(`${API_BASE_URL}/settings/storage-usage/items/${id}/`, {headers: authHeaders})
                )
            );
            setStorageItems((prev) => prev.filter((item) => !selectedStorageItems.includes(item.messageId)));
            setSelectedStorageItems([]);
            fetchStorageSummary();
        } catch (err) {
            console.error("خطا در حذف فایل‌ها:", err.response?.data || err);
        } finally {
            setDeletingStorage(false);
        }
    };

    const handleClearCache = async () => {
        try {
            if (window.caches) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
            setSelectedImg(null);
            setCacheCleared(true);
            setTimeout(() => setCacheCleared(false), 2500);
        } catch (err) {
            console.error("خطا در پاک کردن کش:", err);
        }
    };

    // ---- تغییر رمز عبور ----
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setChangePasswordError("");
        setChangePasswordSuccess(false);

        if (!oldPassword || !newPassword) {
            setChangePasswordError("هر دو فیلد رو پر کن.");
            return;
        }
        if (newPassword.length < 8) {
            setChangePasswordError("رمز جدید باید حداقل ۸ کاراکتر باشه.");
            return;
        }

        setIsChangingPassword(true);
        try {
            await axios.post(
                `${API_BASE_URL}/settings/change-password/`,
                {old_password: oldPassword, new_password: newPassword},
                {headers: authHeaders}
            );
            setChangePasswordSuccess(true);
            setOldPassword("");
            setNewPassword("");
        } catch (err) {
            const data = err.response?.data;
            const msg =
                data?.old_password?.[0] || data?.new_password?.[0] || data?.detail || "تغییر رمز با خطا مواجه شد.";
            setChangePasswordError(msg);
        } finally {
            setIsChangingPassword(false);
        }
    };

    // ---- حذف حساب ----
    const handleDeleteAccount = async () => {
        setDeleteAccountError("");
        if (!deletePassword) {
            setDeleteAccountError("برای تایید، رمز عبورت رو وارد کن.");
            return;
        }

        setIsDeletingAccount(true);
        try {
            await axios.post(
                `${API_BASE_URL}/settings/delete-account/`,
                {password: deletePassword},
                {headers: authHeaders}
            );
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            disconnectCallSocket();
            logout();
            window.location.replace("/login");
        } catch (err) {
            const data = err.response?.data;
            setDeleteAccountError(data?.password?.[0] || data?.detail || "حذف حساب با خطا مواجه شد.");
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const visibilityLabel = (v) =>
        v === "everyone" ? "همه" : v === "contacts" ? "مخاطبین من" : "هیچ‌کس";

    const fontSizeLabel = (v) => (v === "small" ? "کوچک" : v === "large" ? "بزرگ" : "متوسط");

    const formatBytes = (bytes) => {
        if (!bytes) return "۰ مگابایت";
        const mb = bytes / (1024 * 1024);
        if (mb < 1) return `${Math.round(bytes / 1024)} کیلوبایت`;
        if (mb < 1024) return `${mb.toFixed(1)} مگابایت`;
        return `${(mb / 1024).toFixed(2)} گیگابایت`;
    };
    const WALLPAPER_OPTIONS = [
        {id: "default", label: "پیش‌فرض", preview: "bg-slate-900"},
        {id: "slate", label: "سرمه‌ای ساده", preview: "bg-slate-800"},
        {id: "cyan_gradient", label: "فیروزه‌ای", preview: "bg-gradient-to-br from-cyan-600 to-slate-900"},
        {id: "violet_gradient", label: "بنفش", preview: "bg-gradient-to-br from-violet-600 to-slate-900"},
        {id: "emerald_gradient", label: "سبز", preview: "bg-gradient-to-br from-emerald-600 to-slate-900"},
        {
            id: "dots",
            label: "نقطه‌چین",
            preview: "bg-slate-800 bg-[radial-gradient(circle,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[length:14px_14px]",
        },
    ];

    // ============================== دیتای ثابت بخش کمک ==============================
    const FAQ_ITEMS = [
        {
            q: "چطور مخاطب جدید اضافه کنم؟",
            a: "از دکمه‌ی + بالای صفحه، گزینه‌ی «ساخت مخاطب» رو بزن. می‌تونی با شماره موبایل یا ایمیل مخاطب رو پیدا کنی.",
        },
        {
            q: "چطور یه نفر رو مسدود کنم؟",
            a: "وارد چت اون فرد بشو، از سه‌نقطه‌ی بالای صفحه گزینه‌ی «مسدود کردن» رو بزن. بعدش نه پیامی ازش می‌بینی نه اون از تو.",
        },
        {
            q: "پیام‌هام رمزنگاری شده‌ست؟",
            a: "پیام‌ها بین دستگاه تو و سرورهای چتیفای با HTTPS منتقل می‌شن. رمزنگاری سرتاسری (End-to-End) در حال توسعه‌ست.",
        },
        {
            q: "چطور اکانتمو حذف کنم؟",
            a: "تنظیمات ← اطلاعات حساب ← پایین صفحه «حذف حساب کاربری». توجه کن این کار برگشت‌ناپذیره و همه‌ی چت‌هات پاک می‌شه.",
        },
        {
            q: "چرا اعلان پیام نمی‌گیرم؟",
            a: "از تنظیمات ← اعلان‌ها مطمئن شو «اعلان پیام‌های جدید» روشنه. همچنین مرورگرت باید اجازه‌ی نوتیفیکیشن به سایت رو داده باشه.",
        },
    ];

    const SUPPORT_EMAIL = "matin20001000@gmail.comر"; // ← ایمیلتو اینجا بذار
    const SUPPORT_TELEGRAM = "https://t.me/Matin_8_65"; // ← آیدی تلگرام پشتیبانیت
    const APP_VERSION = "۱.۰.۰";


    if (!accessToken) return null;

    return (
        <div className="p-6 border-b border-slate-700/50 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="avatar online">
                        <button
                            className="size-14 rounded-full overflow-hidden relative group"
                            onClick={() => fileInputRef.current.click()}
                        >
                            <img
                                src={selectedImg || profile.image || "/avatar.png"}
                                alt="User"
                                className="size-full object-cover"
                            />
                            <div
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-white text-xs">تغییر</span>
                            </div>
                        </button>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            className="hidden"
                        />
                    </div>

                    <div className="relative group">
                        {isEditingName ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={profile.first_name || ""}
                                onChange={(e) => setProfile({...profile, first_name: e.target.value})}
                                onBlur={() => {
                                    setIsEditingName(false);
                                    handleNameChange();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        setIsEditingName(false);
                                        handleNameChange();
                                    }
                                }}
                                className="bg-transparent border-b border-cyan-400 outline-none text-slate-200 text-sm px-1 transition-all duration-200"
                            />
                        ) : (
                            <div
                                className="text-slate-200 font-medium text-base flex items-center gap-1 cursor-pointer group-hover:text-cyan-300 transition-colors"
                                onClick={() => setIsEditingName(true)}
                            >
                                <span>{profile.first_name || "کاربر ناشناس"}</span>
                                <PencilIcon className="size-3 opacity-0 group-hover:opacity-80 transition-opacity"/>
                            </div>
                        )}
                        <p className="text-slate-400 text-xs mt-1">آنلاین</p>
                        {isEditingBio ? (
                            <input
                                ref={bioInputRef}
                                type="text"
                                maxLength={140}
                                value={profile.bio || ""}
                                onChange={(e) => setProfile({...profile, bio: e.target.value})}
                                onBlur={() => {
                                    setIsEditingBio(false);
                                    handleBioChange();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        setIsEditingBio(false);
                                        handleBioChange();
                                    }
                                }}
                                placeholder="یه چیزی درباره‌ی خودت بنویس..."
                                className="mt-1.5 bg-slate-900/60 border border-cyan-400/50 outline-none text-slate-200 text-xs px-2.5 py-1 rounded-full w-full max-w-[180px] focus:border-cyan-400 transition-colors"
                            />
                        ) : (
                            <button
                                onClick={() => setIsEditingBio(true)}
                                className="group/bio mt-1.5 flex items-center gap-1.5 max-w-[180px] px-2.5 py-1 rounded-full
                                           bg-gradient-to-r from-slate-800/80 to-slate-800/40 border border-slate-700/50
                                           hover:border-cyan-500/40 hover:from-cyan-500/10 hover:to-slate-800/40
                                           transition-all duration-200"
                            >
                                <SparklesIcon
                                    className="w-2.5 h-2.5 text-cyan-400/70 flex-shrink-0 group-hover/bio:text-cyan-400 transition-colors"/>
                                <span
                                    className="text-[11px] text-slate-400 group-hover/bio:text-slate-200 truncate transition-colors">
                                    {profile.bio || "درباره‌ی من..."}
                                </span>
                                <PencilIcon
                                    className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover/bio:opacity-100 group-hover/bio:text-cyan-400 flex-shrink-0 transition-all"/>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4 relative z-50">
                    <button
                        onClick={openSettings}
                        className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center justify-center"
                        title="تنظیمات"
                    >
                        <SettingsIcon className="size-5"/>
                    </button>


                    <div className="relative">
                        <button
                            onClick={() => setShowNewMenu((prev) => !prev)}
                            className="text-slate-300 hover:text-cyan-400 hover:bg-slate-700/60 transition-colors flex items-center justify-center rounded-full size-8"
                            title="ساخت جدید"
                        >
                            <PlusIcon className="size-6"/>
                        </button>

                        {showNewMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)}/>
                                <div
                                    className="absolute top-full left-0 mt-2 bg-slate-800 rounded-2xl shadow-2xl shadow-black/40 w-48 flex flex-col z-50 overflow-hidden border border-slate-700/50 divide-y divide-slate-700/40">
                                    <button
                                        onClick={openCreateGroup}
                                        className="flex items-center gap-2.5 px-3.5 py-3 hover:bg-slate-700/50 cursor-pointer text-slate-200 text-sm text-right transition-colors"
                                    >
                                        <UsersIcon className="w-4 h-4 text-cyan-400 shrink-0"/>
                                        ساخت گروه
                                    </button>

                                    <button
                                        onClick={openAddContact}
                                        className="flex items-center gap-2.5 px-3.5 py-3 hover:bg-slate-700/50 cursor-pointer text-slate-200 text-sm text-right transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4 text-cyan-400 shrink-0"/>
                                        ساخت مخاطب
                                    </button>
                                    <button
                                        onClick={openCreateChannel}
                                        className="flex items-center gap-2.5 px-3.5 py-3 hover:bg-slate-700/50 cursor-pointer text-slate-200 text-sm text-right transition-colors"
                                    >
                                        <Radio className="w-4 h-4 text-violet-400 shrink-0"/>
                                        ساخت چنل
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {showNewMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)}/>
                            <div
                                className="absolute top-full left-1/2 -translate-x-1/3 mt-2 bg-slate-800 rounded-lg shadow-lg w-56 flex flex-col z-50 overflow-hidden border border-slate-700/50">
                                <button
                                    onClick={openCreateGroup}
                                    className="flex items-center gap-2 p-3 hover:bg-slate-700 cursor-pointer text-white text-sm text-right whitespace-nowrap"
                                >
                                    <UsersIcon className="w-4 h-4 text-cyan-400 shrink-0"/>
                                    ساخت گروه
                                </button>

                                <button
                                    onClick={openAddContact}
                                    className="flex items-center gap-2 p-3 hover:bg-slate-700 cursor-pointer text-white text-sm text-right border-t border-slate-700/50 whitespace-nowrap"
                                >
                                    <UserPlus className="w-4 h-4 text-cyan-400 shrink-0"/>
                                    ساخت مخاطب
                                </button>
                                <button
                                    onClick={openCreateChannel}
                                    className="flex items-center gap-2 p-3 hover:bg-slate-700 cursor-pointer text-white text-sm text-right border-t border-slate-700/50 whitespace-nowrap"
                                >
                                    <Radio className="w-4 h-4 text-violet-400 shrink-0"/>
                                    ساخت چنل
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* مودال افزودن مخاطب */}
            {showAddContact && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={closeAddContact}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[75vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                            <h3 className="text-slate-100 font-semibold text-base">افزودن مخاطب جدید</h3>
                            <button onClick={closeAddContact}
                                    className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5"/>
                            </button>
                        </div>

                        <div className="flex border-b border-slate-700/50 flex-shrink-0">
                            <button
                                onClick={() => setAddContactTab("phone")}
                                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                                    addContactTab === "phone"
                                        ? "text-cyan-400 border-b-2 border-cyan-400"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                با شماره موبایل
                            </button>
                            <button
                                onClick={() => setAddContactTab("email")}
                                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                                    addContactTab === "email"
                                        ? "text-cyan-400 border-b-2 border-cyan-400"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                با ایمیل
                            </button>
                        </div>

                        {addContactTab === "phone" && (
                            <form onSubmit={handleAddContactByPhone} className="p-5 space-y-4">
                                {addContactError && (
                                    <p className="text-red-500 text-sm text-center">{addContactError}</p>
                                )}
                                {addContactSuccess && (
                                    <p className="text-green-500 text-sm text-center">مخاطب با موفقیت اضافه شد ✅</p>
                                )}

                                <div>
                                    <label className="text-slate-400 text-xs mb-1 block">شماره موبایل</label>
                                    <div className="relative flex items-center bg-slate-900/60 rounded-lg px-3 py-2">
                                        <PhoneIcon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                        <input
                                            autoFocus
                                            type="tel"
                                            value={contactPhone}
                                            onChange={(e) => setContactPhone(e.target.value)}
                                            placeholder="09123456789"
                                            dir="ltr"
                                            className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500 mr-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-slate-400 text-xs mb-1 block">اسم مخاطب</label>
                                    <div className="relative flex items-center bg-slate-900/60 rounded-lg px-3 py-2">
                                        <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                        <input
                                            type="text"
                                            value={contactDisplayName}
                                            onChange={(e) => setContactDisplayName(e.target.value)}
                                            placeholder="مثلاً: علی رضایی"
                                            className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500 mr-2"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAddingContact}
                                    className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <UserPlus className="w-4 h-4"/>
                                    {isAddingContact ? "در حال افزودن..." : "افزودن مخاطب"}
                                </button>
                            </form>
                        )}

                        {addContactTab === "email" && (
                            <>
                                <div className="p-3 border-b border-slate-700/50 flex-shrink-0">
                                    <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2">
                                        <Search className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={contactQuery}
                                            onChange={(e) => handleContactQueryChange(e.target.value)}
                                            placeholder="ایمیل کاربر را وارد کنید..."
                                            className="bg-transparent outline-none text-sm text-slate-200 w-full placeholder:text-slate-500"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-y-auto flex-1">
                                    {isSearching && (
                                        <p className="text-center text-slate-500 text-sm py-4">در حال جستجو...</p>
                                    )}

                                    {!isSearching && contactQuery.trim() && searchResults.length === 0 && (
                                        <p className="text-center text-slate-500 text-sm py-4">کاربری یافت نشد</p>
                                    )}

                                    {!contactQuery.trim() && (
                                        <p className="text-center text-slate-500 text-sm py-6">
                                            با ایمیل، مخاطب موردنظرت رو جستجو کن
                                        </p>
                                    )}

                                    {searchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-3 p-3 hover:bg-slate-700/40 transition-colors"
                                        >
                                            <div
                                                className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                <img
                                                    src={user.profile || "/avatar.png"}
                                                    alt={user.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => (e.target.src = "/avatar.png")}
                                                />
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span
                                                    className="text-slate-200 text-sm font-medium truncate">{user.name}</span>
                                                <span
                                                    className="text-slate-500 text-xs truncate">{user.email}</span>
                                            </div>
                                            {user.is_contact ? (
                                                <span
                                                    className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                                                    <Check className="w-4 h-4"/> افزوده شد
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleAddContactByEmail(user)}
                                                    disabled={addingId === user.id}
                                                    className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-md flex-shrink-0 transition-colors"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5"/>
                                                    {addingId === user.id ? "..." : "افزودن"}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showCreateGroup && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={closeCreateGroup}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                            <h3 className="text-slate-100 font-semibold text-base">ساخت گروه جدید</h3>
                            <button onClick={closeCreateGroup}
                                    className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5"/>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            <div>
                                <label className="text-slate-400 text-xs mb-1 block">نام گروه</label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="مثلاً: تیم پروژه"
                                    className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs mb-1 block">توضیحات (اختیاری)</label>
                                <textarea
                                    value={groupDescription}
                                    onChange={(e) => setGroupDescription(e.target.value)}
                                    placeholder="درباره‌ی این گروه بنویس..."
                                    rows={2}
                                    className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 resize-none focus:ring-1 focus:ring-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs mb-2 block">
                                    افزودن اعضا از
                                    مخاطبین {selectedMemberIds.length > 0 && `(${selectedMemberIds.length} انتخاب شده)`}
                                </label>

                                {allContacts.length === 0 ? (
                                    <p className="text-slate-500 text-xs py-3 text-center">مخاطبی برای افزودن نداری</p>
                                ) : (
                                    <div
                                        className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700/50">
                                        {allContacts.map((contact) => {
                                            const contactId = contact._id || contact.id;
                                            const isSelected = selectedMemberIds.includes(contactId);

                                            const profilePic = contact.profile?.startsWith("http")
                                                ? contact.profile
                                                : contact.raw?.profile?.startsWith("http")
                                                    ? contact.raw.profile
                                                    : contact.raw?.profile
                                                        ? `${API_BASE_URL}${contact.raw.profile}`
                                                        : "/avatar.png";

                                            return (
                                                <div
                                                    key={contactId}
                                                    onClick={() => toggleMember(contactId)}
                                                    className={`flex items-center gap-3 p-2 cursor-pointer transition-colors ${
                                                        isSelected ? "bg-cyan-600/20" : "hover:bg-slate-700/40"
                                                    }`}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                        <img
                                                            src={profilePic}
                                                            alt={contact.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => (e.target.src = "/avatar.png")}
                                                        />
                                                    </div>
                                                    <span
                                                        className="text-slate-200 text-sm truncate flex-1">{contact.name}</span>
                                                    <div
                                                        className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                            isSelected ? "bg-cyan-500 border-cyan-500" : "border-slate-500"
                                                        }`}
                                                    >
                                                        {isSelected && <Check className="w-3 h-3 text-white"/>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || isCreatingGroup}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {isCreatingGroup ? "در حال ساخت..." : "ساخت گروه"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CreateChannelModal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)}/>

            {/* ============================== مودال تنظیمات ============================== */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={closeSettings}
                >
                    <div
                        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md h-[85vh] flex flex-col overflow-hidden border border-slate-700/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {settingsLoading && settingsView === "main" ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin"/>
                            </div>
                        ) : (
                            <>
                                {settingsView === "main" && (
                                    <>
                                        <div
                                            className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
                                            <h3 className="text-slate-100 font-semibold text-base">تنظیمات</h3>
                                            <button onClick={closeSettings}
                                                    className="text-slate-400 hover:text-white transition-colors">
                                                <XIcon className="w-5 h-5"/>
                                            </button>
                                        </div>

                                        {settingsError && (
                                            <p className="text-red-400 text-xs text-center py-2 bg-red-500/10">{settingsError}</p>
                                        )}

                                        <div className="overflow-y-auto flex-1">
                                            <div
                                                onClick={() => setSettingsView("account")}
                                                className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-slate-700/30 transition-colors border-b border-slate-700/40"
                                            >
                                                <div
                                                    className="w-14 h-14 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                    <img
                                                        src={selectedImg || profile.image || "/avatar.png"}
                                                        alt="User"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-slate-200 text-sm font-semibold truncate">
                                                        {profile.first_name || "کاربر ناشناس"}
                                                    </p>
                                                    <p className="text-slate-500 text-xs mt-0.5 truncate">
                                                        {aboutText || "درباره من"}
                                                    </p>
                                                </div>
                                                <ChevronLeft className="w-4 h-4 text-slate-500 flex-shrink-0"/>
                                            </div>

                                            <SettingRow
                                                icon={Lock}
                                                title="حریم خصوصی"
                                                subtitle="آخرین بازدید، عکس پروفایل، رسید خوانده‌شدن"
                                                onClick={() => setSettingsView("privacy")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Bell}
                                                title="اعلان‌ها"
                                                subtitle="پیام‌ها، گروه‌ها و تماس‌ها"
                                                onClick={() => setSettingsView("notifications")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={MessageSquare}
                                                title="چت‌ها"
                                                subtitle="تم، اندازه فونت، ارسال با اینتر"
                                                onClick={() => setSettingsView("chats")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Database}
                                                title="ذخیره‌سازی و داده"
                                                subtitle="دانلود خودکار رسانه‌ها"
                                                onClick={() => setSettingsView("storage")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Globe}
                                                title="زبان"
                                                subtitle={LANGUAGES[language]?.label || "فارسی"}
                                                onClick={() => setSettingsView("language")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={HelpCircle}
                                                title="کمک"
                                                subtitle="سوالات متداول، تماس با ما، درباره چتیفای"
                                                onClick={() => setSettingsView("help")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Share2}
                                                title="دعوت از دوستان"
                                                subtitle="لینک عضویت رو با دوستات به اشتراک بذار"
                                                onClick={handleInviteFriends}
                                            />

                                            <div className="h-2"/>
                                            <SettingRow icon={LogOutIcon} title="خروج از حساب" danger
                                                        onClick={handleLogout}/>
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "account" && (
                                    <>
                                        <SettingsSubHeader
                                            title="اطلاعات حساب"
                                            onBack={() => setSettingsView("main")}
                                            saving={settingsSaving}
                                        />
                                        <div className="overflow-y-auto flex-1">
                                            <div
                                                className="flex flex-col items-center gap-3 py-6 border-b border-slate-700/40">
                                                <button
                                                    className="size-24 rounded-full overflow-hidden relative group"
                                                    onClick={() => settingsAvatarInputRef.current.click()}
                                                >
                                                    <img
                                                        src={selectedImg || profile.image || "/avatar.png"}
                                                        alt="User"
                                                        className="size-full object-cover"
                                                    />
                                                    <div
                                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <span className="text-white text-xs">تغییر عکس</span>
                                                    </div>
                                                </button>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    ref={settingsAvatarInputRef}
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                />
                                            </div>

                                            <SectionLabel>نام</SectionLabel>
                                            <div className="px-4 pb-4">
                                                <div
                                                    className="flex items-center bg-slate-900/60 rounded-lg px-3 py-2.5">
                                                    <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                                    <input
                                                        type="text"
                                                        value={profile.first_name || ""}
                                                        onChange={(e) => setProfile({
                                                            ...profile,
                                                            first_name: e.target.value
                                                        })}
                                                        onBlur={handleNameChange}
                                                        className="bg-transparent outline-none text-sm text-slate-200 w-full mr-2"
                                                    />
                                                </div>
                                            </div>

                                            <SectionLabel>درباره من</SectionLabel>
                                            <div className="px-4 pb-4">
                                                <div
                                                    className="flex items-center bg-slate-900/60 rounded-lg px-3 py-2.5">
                                                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                                                    <input
                                                        type="text"
                                                        value={aboutText}
                                                        onChange={(e) => setAboutText(e.target.value)}
                                                        onBlur={handleAboutTextBlur}
                                                        className="bg-transparent outline-none text-sm text-slate-200 w-full mr-2"
                                                    />
                                                </div>
                                            </div>

                                            <SectionLabel>امنیت</SectionLabel>
                                            <SettingRow
                                                icon={KeyRound}
                                                title="تغییر رمز عبور"
                                                onClick={() => {
                                                    setShowChangePassword((v) => !v);
                                                    setChangePasswordError("");
                                                    setChangePasswordSuccess(false);
                                                }}
                                            />

                                            {showChangePassword && (
                                                <form onSubmit={handleChangePassword}
                                                      className="mx-4 mb-3 p-3 rounded-lg bg-slate-900/60 space-y-2">
                                                    {changePasswordError && (
                                                        <p className="text-red-400 text-xs text-center">{changePasswordError}</p>
                                                    )}
                                                    {changePasswordSuccess && (
                                                        <p className="text-green-400 text-xs text-center">رمز عبور تغییر
                                                            کرد ✅</p>
                                                    )}
                                                    <input
                                                        type="password"
                                                        value={oldPassword}
                                                        onChange={(e) => setOldPassword(e.target.value)}
                                                        placeholder="رمز عبور فعلی"
                                                        className="w-full bg-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                                                    />
                                                    <input
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                                                        className="w-full bg-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={isChangingPassword}
                                                        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white py-2 rounded-md text-sm font-medium transition-colors"
                                                    >
                                                        {isChangingPassword ? "در حال ذخیره..." : "ذخیره رمز جدید"}
                                                    </button>
                                                </form>
                                            )}

                                            <SettingRow
                                                icon={Shield}
                                                title="تایید دو مرحله‌ای"
                                                onClick={() => bindToggle(setTwoStepEnabled, "two_step_enabled")(!twoStepEnabled)}
                                                rightContent={
                                                    <ToggleSwitch
                                                        checked={twoStepEnabled}
                                                        onChange={bindToggle(setTwoStepEnabled, "two_step_enabled")}
                                                    />
                                                }
                                            />

                                            <div className="h-2"/>
                                            <SettingRow
                                                icon={Trash2}
                                                title="حذف حساب کاربری"
                                                danger
                                                onClick={() => setShowDeleteAccountConfirm((v) => !v)}
                                            />

                                            {showDeleteAccountConfirm && (
                                                <div
                                                    className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                                                    <p className="text-red-300 text-xs leading-relaxed">
                                                        با حذف حساب، تمام چت‌ها و اطلاعات تو برای همیشه پاک میشه. برای
                                                        تایید رمزت رو وارد کن.
                                                    </p>
                                                    {deleteAccountError && (
                                                        <p className="text-red-400 text-xs">{deleteAccountError}</p>
                                                    )}
                                                    <input
                                                        type="password"
                                                        value={deletePassword}
                                                        onChange={(e) => setDeletePassword(e.target.value)}
                                                        placeholder="رمز عبور"
                                                        className="w-full bg-slate-900/60 rounded-md px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setShowDeleteAccountConfirm(false);
                                                                setDeletePassword("");
                                                                setDeleteAccountError("");
                                                            }}
                                                            className="flex-1 py-1.5 rounded-md bg-slate-700 text-slate-300 text-xs"
                                                        >
                                                            انصراف
                                                        </button>
                                                        <button
                                                            onClick={handleDeleteAccount}
                                                            disabled={isDeletingAccount}
                                                            className="flex-1 py-1.5 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs"
                                                        >
                                                            {isDeletingAccount ? "..." : "حذف قطعی"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "privacy" && (
                                    <>
                                        <SettingsSubHeader title="حریم خصوصی" onBack={() => setSettingsView("main")}
                                                           saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>چه کسانی می‌بینند</SectionLabel>
                                            <SettingRow
                                                icon={Eye}
                                                title="آخرین بازدید"
                                                subtitle={visibilityLabel(lastSeen)}
                                                onClick={() => cycleVisibility(lastSeen, setLastSeen, "last_seen_visibility")}
                                            />
                                            <SettingRow
                                                icon={ImageIcon}
                                                title="عکس پروفایل"
                                                subtitle={visibilityLabel(photoVisibility)}
                                                onClick={() => cycleVisibility(photoVisibility, setPhotoVisibility, "photo_visibility")}
                                            />
                                            <SettingRow
                                                icon={Info}
                                                title="درباره من"
                                                subtitle={visibilityLabel(aboutVisibility)}
                                                onClick={() => cycleVisibility(aboutVisibility, setAboutVisibility, "about_visibility")}
                                            />

                                            <SectionLabel>ارتباطات</SectionLabel>
                                            <SettingRow
                                                icon={Check}
                                                title="رسید خوانده شدن"
                                                subtitle="نمایش تیک آبی برای طرف مقابل"
                                                onClick={() => bindToggle(setReadReceipts, "read_receipts")(!readReceipts)}
                                                rightContent={
                                                    <ToggleSwitch checked={readReceipts}
                                                                  onChange={bindToggle(setReadReceipts, "read_receipts")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={onlineStatus ? Eye : EyeOff}
                                                title="نمایش وضعیت آنلاین"
                                                onClick={() => bindToggle(setOnlineStatus, "online_status_visible")(!onlineStatus)}
                                                rightContent={
                                                    <ToggleSwitch checked={onlineStatus}
                                                                  onChange={bindToggle(setOnlineStatus, "online_status_visible")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={Shield}
                                                title="مخاطبین مسدود شده"
                                                subtitle={blockedContacts.length > 0 ? `${blockedContacts.length} مخاطب` : "هیچ‌کس"}
                                                onClick={openBlockedView}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "blocked" && (
                                    <>
                                        <SettingsSubHeader title="مخاطبین مسدود شده"
                                                           onBack={() => setSettingsView("privacy")}/>
                                        <div className="overflow-y-auto flex-1">
                                            {blockedLoading && (
                                                <div className="flex items-center justify-center py-10">
                                                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin"/>
                                                </div>
                                            )}

                                            {!blockedLoading && blockedContacts.length === 0 && (
                                                <p className="text-center text-slate-500 text-sm py-10">
                                                    هیچ مخاطبی مسدود نکردی
                                                </p>
                                            )}

                                            {!blockedLoading &&
                                                blockedContacts.map((c) => (
                                                    <div
                                                        key={c.id}
                                                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
                                                    >
                                                        <div
                                                            className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 flex-shrink-0">
                                                            <img
                                                                src={c.image || "/avatar.png"}
                                                                alt={c.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => (e.target.src = "/avatar.png")}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-slate-200 text-sm font-medium truncate">{c.name}</p>
                                                            <p className="text-slate-500 text-xs truncate">{c.email}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleUnblock(c.id)}
                                                            disabled={unblockingId === c.id}
                                                            className="text-xs px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 flex-shrink-0 transition-colors"
                                                        >
                                                            {unblockingId === c.id ? "..." : "رفع مسدودیت"}
                                                        </button>
                                                    </div>
                                                ))}
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "notifications" && (
                                    <>
                                        <SettingsSubHeader title="اعلان‌ها" onBack={() => setSettingsView("main")}
                                                           saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>پیام‌ها</SectionLabel>
                                            <SettingRow
                                                icon={notifMessages ? Bell : BellOff}
                                                title="اعلان پیام‌های جدید"
                                                onClick={() => bindToggle(setNotifMessages, "notif_messages", "notifMessages")(!notifMessages)}
                                                rightContent={
                                                    <ToggleSwitch checked={notifMessages}
                                                                  onChange={bindToggle(setNotifMessages, "notif_messages", "notifMessages")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={Eye}
                                                title="نمایش متن پیام در اعلان"
                                                onClick={() => bindToggle(setNotifPreview, "notif_preview", "notifPreview")(!notifPreview)}
                                                rightContent={
                                                    <ToggleSwitch checked={notifPreview}
                                                                  onChange={bindToggle(setNotifPreview, "notif_preview", "notifPreview")}/>
                                                }
                                            />

                                            <SectionLabel>گروه‌ها</SectionLabel>
                                            <SettingRow
                                                icon={UsersIcon}
                                                title="اعلان پیام‌های گروه"
                                                onClick={() => bindToggle(setNotifGroups, "notif_groups", "notifGroups")(!notifGroups)}
                                                rightContent={
                                                    <ToggleSwitch checked={notifGroups}
                                                                  onChange={bindToggle(setNotifGroups, "notif_groups", "notifGroups")}/>
                                                }
                                            />

                                            <SectionLabel>تماس‌ها</SectionLabel>
                                            <SettingRow
                                                icon={PhoneIcon}
                                                title="اعلان تماس‌های ورودی"
                                                onClick={() => bindToggle(setNotifCalls, "notif_calls", "notifCalls")(!notifCalls)}
                                                rightContent={
                                                    <ToggleSwitch checked={notifCalls}
                                                                  onChange={bindToggle(setNotifCalls, "notif_calls", "notifCalls")}/>
                                                }
                                            />

                                            <SectionLabel>عمومی</SectionLabel>
                                            <SettingRow
                                                icon={Smartphone}
                                                title="لرزش"
                                                onClick={() => bindToggle(setNotifVibrate, "notif_vibrate", "notifVibrate")(!notifVibrate)}
                                                rightContent={
                                                    <ToggleSwitch checked={notifVibrate}
                                                                  onChange={bindToggle(setNotifVibrate, "notif_vibrate", "notifVibrate")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={isSoundEnabled ? Volume2Icon : VolumeOffIcon}
                                                title="صدای اعلان"
                                                onClick={handleSoundToggleInSettings}
                                                rightContent={<ToggleSwitch checked={isSoundEnabled}
                                                                            onChange={handleSoundToggleInSettings}/>}
                                            />
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "chats" && (
                                    <>
                                        <SettingsSubHeader title="چت‌ها" onBack={() => setSettingsView("main")}
                                                           saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>ظاهر</SectionLabel>
                                            <SettingRow
                                                icon={MessageSquare}
                                                title="تم تیره"
                                                subtitle={darkTheme ? "روشن" : "خاموش"}
                                                onClick={() => bindToggle(setDarkTheme, "dark_theme")(!darkTheme)}
                                                rightContent={
                                                    <ToggleSwitch checked={darkTheme}
                                                                  onChange={bindToggle(setDarkTheme, "dark_theme")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={ImageIcon}
                                                title="پس‌زمینه چت"
                                                subtitle={WALLPAPER_OPTIONS.find((w) => w.id === chatWallpaper)?.label || "پیش‌فرض"}
                                                onClick={() => setSettingsView("wallpaper")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={ChevronDown}
                                                title="اندازه فونت"
                                                subtitle={fontSizeLabel(fontSize)}
                                                onClick={cycleFontSize}
                                            />

                                            <SectionLabel>رفتار ارسال</SectionLabel>
                                            <SettingRow
                                                icon={Check}
                                                title="ارسال با Enter"
                                                subtitle="فعال کردن ارسال پیام با زدن اینتر"
                                                onClick={() => bindToggle(setEnterToSend, "enter_to_send")(!enterToSend)}
                                                rightContent={
                                                    <ToggleSwitch checked={enterToSend}
                                                                  onChange={bindToggle(setEnterToSend, "enter_to_send")}/>
                                                }
                                            />

                                            <SectionLabel>پشتیبان‌گیری</SectionLabel>
                                            <SettingRow
                                                icon={Database}
                                                title="پشتیبان‌گیری از چت‌ها"
                                                subtitle={backupInProgress ? "در حال آماده‌سازی..." : formatBackupDate(lastBackupAt)}
                                                onClick={backupInProgress ? undefined : handleBackupChats}
                                            />
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "wallpaper" && (
                                    <>
                                        <SettingsSubHeader title="پس‌زمینه چت" onBack={() => setSettingsView("chats")}
                                                           saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1 p-4">
                                            <div className="grid grid-cols-3 gap-3">
                                                {WALLPAPER_OPTIONS.map((opt) => {
                                                    const selected = chatWallpaper === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => handleWallpaperSelect(opt.id)}
                                                            className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                                                                selected ? "border-cyan-400" : "border-transparent"
                                                            }`}
                                                        >
                                                            <div className={`w-full h-full ${opt.preview}`}/>
                                                            {selected && (
                                                                <div
                                                                    className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                                    <div
                                                                        className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                                                                        <Check className="w-4 h-4 text-white"/>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <p className="absolute bottom-0 inset-x-0 text-center text-[10px] text-white/90 bg-black/40 py-1">
                                                                {opt.label}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                                {settingsView === "storage" && (
                                    <>
                                        <SettingsSubHeader title="ذخیره‌سازی و داده"
                                                           onBack={() => setSettingsView("main")}
                                                           saving={settingsSaving}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SectionLabel>دانلود خودکار رسانه</SectionLabel>
                                            <SettingRow
                                                icon={ImageIcon}
                                                title="در وای‌فای"
                                                onClick={() => bindToggle(setAutoDownloadWifi, "auto_download_wifi")(!autoDownloadWifi)}
                                                rightContent={
                                                    <ToggleSwitch checked={autoDownloadWifi}
                                                                  onChange={bindToggle(setAutoDownloadWifi, "auto_download_wifi")}/>
                                                }
                                            />
                                            <SettingRow
                                                icon={Smartphone}
                                                title="در اینترنت موبایل"
                                                onClick={() => bindToggle(setAutoDownloadMobile, "auto_download_mobile")(!autoDownloadMobile)}
                                                rightContent={
                                                    <ToggleSwitch checked={autoDownloadMobile}
                                                                  onChange={bindToggle(setAutoDownloadMobile, "auto_download_mobile")}/>
                                                }
                                            />

                                            <SectionLabel>مصرف فضا</SectionLabel>
                                            <SettingRow
                                                icon={Database}
                                                title="مدیریت فضای ذخیره‌سازی"
                                                subtitle={storageSummary ? `${formatBytes(storageSummary.totalBytes)} مصرف شده` : "برای مشاهده کلیک کن"}
                                                onClick={openStorageManage}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Trash2}
                                                title={cacheCleared ? "حافظه پنهان پاک شد ✅" : "پاک کردن حافظه پنهان"}
                                                danger={!cacheCleared}
                                                onClick={handleClearCache}
                                            />
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "storage-manage" && (
                                    <>
                                        <SettingsSubHeader title="مدیریت فضای ذخیره‌سازی"
                                                           onBack={() => setSettingsView("storage")}/>
                                        <div className="overflow-y-auto flex-1">
                                            {storageLoading && (
                                                <div className="flex items-center justify-center py-10">
                                                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin"/>
                                                </div>
                                            )}

                                            {!storageLoading && storageSummary && (
                                                <>
                                                    <div className="px-4 py-6 text-center border-b border-slate-700/40">
                                                        <p className="text-3xl font-bold text-cyan-400">
                                                            {formatBytes(storageSummary.totalBytes)}
                                                        </p>
                                                        <p className="text-slate-500 text-xs mt-1">کل فضای مصرف‌شده توسط
                                                            رسانه‌ها</p>
                                                    </div>

                                                    {storageSummary.totalBytes > 0 && (
                                                        <div className="px-4 py-4">
                                                            <div
                                                                className="flex h-3 rounded-full overflow-hidden bg-slate-700/50">
                                                                {storageSummary.breakdown.map((b, i) => {
                                                                    const pct = (b.bytes / storageSummary.totalBytes) * 100;
                                                                    const colors = ["bg-cyan-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500"];
                                                                    return pct > 0 ? (
                                                                        <div
                                                                            key={b.type}
                                                                            className={`${colors[i % colors.length]} transition-all`}
                                                                            style={{width: `${pct}%`}}
                                                                        />
                                                                    ) : null;
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <SectionLabel>تفکیک بر اساس نوع</SectionLabel>
                                                    {storageSummary.breakdown.map((b, i) => {
                                                        const icons = {
                                                            image: ImageIcon,
                                                            file: Database,
                                                            voice: Volume2Icon,
                                                            video_note: MessageSquare,
                                                        };
                                                        const dotColors = ["bg-cyan-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500"];
                                                        const Icon = icons[b.type] || Database;
                                                        return (
                                                            <SettingRow
                                                                key={b.type}
                                                                icon={Icon}
                                                                title={b.label}
                                                                subtitle={`${b.count} مورد`}
                                                                onClick={b.count > 0 ? () => openStorageItems(b.type) : undefined}
                                                                rightContent={
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className={`w-2 h-2 rounded-full ${dotColors[i % dotColors.length]}`}/>
                                                                        <span
                                                                            className="text-slate-400 text-xs">{formatBytes(b.bytes)}</span>
                                                                        {b.count > 0 && <ChevronLeft
                                                                            className="w-4 h-4 text-slate-500"/>}
                                                                    </div>
                                                                }
                                                            />
                                                        );
                                                    })}
                                                </>
                                            )}
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {settingsView === "storage-items" && (
                                    <>
                                        <SettingsSubHeader title="فایل‌ها"
                                                           onBack={() => setSettingsView("storage-manage")}/>
                                        <div className="overflow-y-auto flex-1">
                                            {storageItemsLoading && (
                                                <div className="flex items-center justify-center py-10">
                                                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin"/>
                                                </div>
                                            )}

                                            {!storageItemsLoading && storageItems.length === 0 && (
                                                <p className="text-center text-slate-500 text-sm py-10">چیزی پیدا
                                                    نشد</p>
                                            )}

                                            {!storageItemsLoading &&
                                                storageItems.map((item) => {
                                                    const selected = selectedStorageItems.includes(item.messageId);
                                                    return (
                                                        <div
                                                            key={item.messageId}
                                                            onClick={() => toggleStorageItemSelect(item.messageId)}
                                                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                                                selected ? "bg-cyan-600/20" : "hover:bg-slate-700/30"
                                                            }`}
                                                        >
                                                            <div
                                                                className="w-11 h-11 rounded-lg overflow-hidden bg-slate-700/60 flex-shrink-0 flex items-center justify-center">
                                                                {item.url && storageItemsType === "image" ? (
                                                                    <img src={item.url} alt=""
                                                                         className="w-full h-full object-cover"/>
                                                                ) : (
                                                                    <Database className="w-5 h-5 text-slate-400"/>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-slate-200 text-sm truncate">{item.fileName || "بدون نام"}</p>
                                                                <p className="text-slate-500 text-xs truncate">
                                                                    {item.withUser} · {formatBytes(item.bytes)}
                                                                </p>
                                                            </div>
                                                            <div
                                                                className={`w-[18px] h-[18px] rounded border flex items-center justify-center flex-shrink-0 ${
                                                                    selected ? "bg-cyan-500 border-cyan-500" : "border-slate-500"
                                                                }`}
                                                            >
                                                                {selected && <Check className="w-3 h-3 text-white"/>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            <div className="h-20"/>
                                        </div>

                                        {selectedStorageItems.length > 0 && (
                                            <div className="p-4 border-t border-slate-700/50 flex-shrink-0">
                                                <button
                                                    onClick={handleDeleteSelectedStorageItems}
                                                    disabled={deletingStorage}
                                                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    {deletingStorage
                                                        ? "در حال حذف..."
                                                        : `حذف ${selectedStorageItems.length} مورد و آزاد کردن فضا`}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {settingsView === "language" && (
                                    <>
                                        <SettingsSubHeader title="زبان برنامه" onBack={() => setSettingsView("main")}
                                                           saving={settingsSaving}/>
                                        <RadioOptionGroup
                                            value={language}
                                            onChange={handleLanguageChange}
                                            options={[
                                                {value: "fa", label: "فارسی"},
                                                {value: "en", label: "English"},
                                                {value: "de", label: "Deutsch"},
                                            ]}
                                        />
                                    </>
                                )}

                                {settingsView === "help" && (
                                    <>

                                        <SettingsSubHeader title="کمک" onBack={() => setSettingsView("main")}/>
                                        <div className="overflow-y-auto flex-1">
                                            <SettingRow
                                                icon={HelpCircle}
                                                title="سوالات متداول"
                                                onClick={() => setSettingsView("faq")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={MailIcon}
                                                title="تماس با ما"
                                                onClick={() => setSettingsView("contact")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Shield}
                                                title="سیاست حفظ حریم خصوصی"
                                                onClick={() => setSettingsView("privacy_policy")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <SettingRow
                                                icon={Info}
                                                title="درباره چتیفای"
                                                subtitle={`نسخه ${APP_VERSION}`}
                                                onClick={() => setSettingsView("about")}
                                                rightContent={<ChevronLeft className="w-4 h-4 text-slate-500"/>}
                                            />
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {/* ============================== سوالات متداول ============================== */}
                                {settingsView === "faq" && (
                                    <>
                                        <SettingsSubHeader title="سوالات متداول"
                                                           onBack={() => setSettingsView("help")}/>
                                        <div className="overflow-y-auto flex-1 py-2">
                                            {FAQ_ITEMS.map((item, idx) => {
                                                const isOpen = openFaqIndex === idx;
                                                return (
                                                    <div key={idx}
                                                         className="mx-3 mb-2 rounded-xl bg-slate-900/40 overflow-hidden">
                                                        <button
                                                            onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                                            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-right"
                                                        >
                                                            <span
                                                                className="text-sm text-slate-200 font-medium">{item.q}</span>
                                                            <ChevronDown
                                                                className={`w-4 h-4 text-cyan-400 flex-shrink-0 transition-transform duration-200 ${
                                                                    isOpen ? "rotate-180" : ""
                                                                }`}
                                                            />
                                                        </button>
                                                        <div
                                                            className={`grid transition-all duration-300 ease-in-out ${
                                                                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                                            }`}
                                                        >
                                                            <div className="overflow-hidden">
                                                                <p className="px-4 pb-3.5 text-slate-400 text-xs leading-relaxed">{item.a}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {/* ============================== تماس با ما ============================== */}
                                {settingsView === "contact" && (
                                    <>
                                        <SettingsSubHeader title="تماس با ما" onBack={() => setSettingsView("help")}/>
                                        <div className="overflow-y-auto flex-1">
                                            <p className="px-4 pt-4 pb-2 text-slate-400 text-xs leading-relaxed">
                                                هر سوال، مشکل یا پیشنهادی داشتی، از یکی از راه‌های زیر باهامون در ارتباط
                                                باش. تیم پشتیبانی معمولاً ظرف
                                                ۲۴ ساعت پاسخ می‌ده.
                                            </p>

                                            <a
                                                href={`mailto:${SUPPORT_EMAIL}`}
                                                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-700/40 transition-colors"
                                            >
                                                <div
                                                    className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-700/60 text-cyan-400 flex-shrink-0">
                                                    <MailIcon className="h-4.5 w-4.5"/>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-200">ایمیل پشتیبانی</p>
                                                    <p className="text-slate-500 text-xs mt-0.5" dir="ltr">
                                                        {SUPPORT_EMAIL}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        navigator.clipboard?.writeText(SUPPORT_EMAIL);
                                                        toast.success("ایمیل کپی شد");
                                                    }}
                                                    className="text-slate-500 hover:text-slate-300 flex-shrink-0 p-1.5"
                                                >
                                                    <Copy className="w-3.5 h-3.5"/>
                                                </button>
                                            </a>

                                            <a
                                                href={SUPPORT_TELEGRAM}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-700/40 transition-colors"
                                            >
                                                <div
                                                    className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-700/60 text-sky-400 flex-shrink-0">
                                                    <TelegramIcon className="h-4.5 w-4.5"/>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-200">پشتیبانی در
                                                        تلگرام</p>
                                                    <p className="text-slate-500 text-xs mt-0.5">پاسخ سریع‌تر برای
                                                        مشکلات فوری</p>
                                                </div>
                                                <ExternalLink className="w-3.5 h-3.5 text-slate-500 flex-shrink-0"/>
                                            </a>

                                            <div className="h-4"/>
                                        </div>
                                    </>
                                )}

                                {/* ============================== سیاست حفظ حریم خصوصی ============================== */}
                                {settingsView === "privacy_policy" && (
                                    <>
                                        <SettingsSubHeader title="سیاست حفظ حریم خصوصی"
                                                           onBack={() => setSettingsView("help")}/>
                                        <div
                                            className="overflow-y-auto flex-1 px-4 py-4 space-y-4 text-slate-400 text-xs leading-relaxed">
                                            <p className="text-slate-500">آخرین بروزرسانی: مرداد ۱۴۰۴</p>

                                            <div>
                                                <h4 className="text-slate-200 text-sm font-semibold mb-1.5">۱. چه
                                                    اطلاعاتی جمع‌آوری می‌کنیم</h4>
                                                <p>
                                                    شماره موبایل یا ایمیل، نام نمایشی، عکس پروفایل، و پیام‌هایی که برای
                                                    ارسال از طریق سرویس ما رد و
                                                    بدل می‌کنی. لوکیشن فقط زمانی ذخیره می‌شه که خودت صریحاً از طریق
                                                    دکمه‌ی اشتراک لوکیشن بفرستیش.
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-slate-200 text-sm font-semibold mb-1.5">۲. چطور
                                                    ازشون استفاده می‌کنیم</h4>
                                                <p>
                                                    این اطلاعات فقط برای ارائه‌ی سرویس چت (تحویل پیام، اعلان‌ها، مدیریت
                                                    مخاطبین) استفاده می‌شن. هیچ
                                                    داده‌ای به شخص ثالث برای اهداف تبلیغاتی فروخته نمی‌شه.
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-slate-200 text-sm font-semibold mb-1.5">۳. مسدودسازی
                                                    و گزارش</h4>
                                                <p>
                                                    وقتی کاربری رو مسدود می‌کنی، اون کاربر دیگه نمی‌تونه پیام یا تماسی
                                                    برات بفرسته. گزارش‌هایی که ثبت
                                                    می‌کنی محرمانه بررسی می‌شن و فقط برای اقدامات مدیریتی استفاده می‌شن.
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-slate-200 text-sm font-semibold mb-1.5">۴. حذف
                                                    حساب</h4>
                                                <p>
                                                    با حذف حساب از بخش تنظیمات، تمام پیام‌ها، مخاطبین و اطلاعات پروفایلت
                                                    به‌صورت دائمی از سرور حذف
                                                    می‌شه و برگشت‌ناپذیره.
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-slate-200 text-sm font-semibold mb-1.5">۵. تماس</h4>
                                                <p>
                                                    برای هر سوالی درباره‌ی حریم خصوصی، از بخش «تماس با ما» با تیم
                                                    پشتیبانی در ارتباط باش.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* ============================== درباره چتیفای ============================== */}
                                {settingsView === "about" && (
                                    <>
                                        <SettingsSubHeader title="درباره چتیفای"
                                                           onBack={() => setSettingsView("help")}/>
                                        <div
                                            className="overflow-y-auto flex-1 flex flex-col items-center px-6 py-8 text-center">
                                            <div
                                                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-4">
                                                <span className="text-white text-3xl font-bold">چ</span>
                                            </div>
                                            <h3 className="text-slate-100 text-lg font-semibold">چتیفای</h3>
                                            <p className="text-slate-500 text-xs mt-1">نسخه {APP_VERSION}</p>

                                            <p className="text-slate-400 text-xs leading-relaxed mt-4 max-w-xs">
                                                چتیفای یه پیام‌رسان سریع، امن و ساده‌ست که با هدف ارتباط راحت‌تر بین
                                                دوستان و تیم‌ها ساخته شده.
                                            </p>

                                            <div className="w-full mt-6 space-y-2">
                                                <a
                                                    href={SUPPORT_TELEGRAM}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900/50 text-slate-300 text-sm hover:bg-slate-900/80 transition-colors"
                                                >
                                                    <TelegramIcon className="w-4 h-4"/>
                                                    کانال تلگرام
                                                </a>
                                                <a
                                                    href="https://github.com/mohammadmatin2000"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900/50 text-slate-300 text-sm hover:bg-slate-900/80 transition-colors"
                                                >
                                                    <Github className="w-4 h-4"/>
                                                    گیت‌هاب پروژه
                                                </a>
                                            </div>

                                            <p className="flex items-center gap-1 text-slate-600 text-[11px] mt-8">
                                                <Heart className="w-3 h-3 fill-red-500 text-red-500"/>ساخته‌شده با متین
                                                در ایران<Heart className="w-3 h-3 fill-red-500 text-red-500"/>
                                            </p>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


export default ProfileHeader;