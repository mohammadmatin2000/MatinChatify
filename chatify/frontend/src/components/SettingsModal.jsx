import { useState } from "react";
import {
  XIcon,
  UserIcon,
  BellIcon,
  ShieldIcon,
  MessageCircleIcon,
  InfoIcon,
  LogOutIcon,
  Volume2Icon,
  VolumeOffIcon,
  ImageIcon,
  EyeIcon,
  CheckCheckIcon,
  DownloadIcon,
  PhoneIcon,
  MailIcon,
  CornerDownLeftIcon,
  TypeIcon,
} from "lucide-react";
import { useSettingsStore } from "../store/useSettingsStore";

// سوییچ کوچیک قابل‌استفاده‌ی مجدد — هم‌شکل با همون سوییچ عمومی/خصوصی چنل
function ToggleRow({ icon: Icon, iconColor, title, description, checked, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-slate-100 text-sm font-medium">{title}</p>
          {description && <p className="text-slate-500 text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked ? "bg-cyan-600" : "bg-slate-600"
        }`}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ right: checked ? 22 : 2 }}
        />
      </button>
    </div>
  );
}

// ردیف انتخاب چندگزینه‌ای (برای اندازه‌ی فونت) — سه دکمه‌ی کوچیک کنار هم
function SegmentedRow({ icon: Icon, iconColor, title, description, options, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-slate-100 text-sm font-medium">{title}</p>
          {description && <p className="text-slate-500 text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex items-center bg-slate-900/60 rounded-lg p-0.5 flex-shrink-0">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              value === opt.value ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const CATEGORIES = [
  { key: "account", label: "حساب کاربری", icon: UserIcon, color: "bg-cyan-500/20 text-cyan-400" },
  { key: "notifications", label: "اعلان‌ها و صدا", icon: BellIcon, color: "bg-amber-500/20 text-amber-400" },
  { key: "privacy", label: "حریم خصوصی", icon: ShieldIcon, color: "bg-emerald-500/20 text-emerald-400" },
  { key: "chats", label: "چت‌ها", icon: MessageCircleIcon, color: "bg-violet-500/20 text-violet-400" },
  { key: "about", label: "درباره", icon: InfoIcon, color: "bg-slate-500/20 text-slate-300" },
];

const FONT_SIZE_OPTIONS = [
  { value: "small", label: "کوچیک" },
  { value: "medium", label: "متوسط" },
  { value: "large", label: "بزرگ" },
];

function SettingsModal({ isOpen, onClose, profile, isSoundEnabled, toggleSound, onLogout }) {
  const [activeCategory, setActiveCategory] = useState("account");
  const settings = useSettingsStore();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] max-h-[85vh] flex overflow-hidden border border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ستون دسته‌بندی‌ها */}
        <div className="w-52 bg-slate-900/50 border-l border-slate-700/50 flex flex-col flex-shrink-0">
          <div className="px-4 py-4 border-b border-slate-700/50">
            <h3 className="text-slate-100 font-semibold text-base">تنظیمات</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {CATEGORIES.map((cat) => {
              const CatIcon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-right ${
                    isActive
                      ? "bg-cyan-600/15 text-cyan-300"
                      : "text-slate-400 hover:bg-slate-700/40 hover:text-slate-200"
                  }`}
                >
                  <CatIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-700/50">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors text-right"
            >
              <LogOutIcon className="w-4 h-4 flex-shrink-0" />
              خروج از حساب
            </button>
          </div>
        </div>

        {/* محتوای دسته‌ی فعال */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
            <h4 className="text-slate-100 font-semibold text-base">
              {CATEGORIES.find((c) => c.key === activeCategory)?.label}
            </h4>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-2 divide-y divide-slate-700/40">
            {activeCategory === "account" && (
              <>
                <div className="flex items-center gap-4 py-5">
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-cyan-500/30 flex-shrink-0">
                    <img
                      src={profile?.image || "/avatar.png"}
                      alt={profile?.first_name}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.src = "/avatar.png")}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-100 font-semibold text-base truncate">
                      {profile?.first_name || "کاربر ناشناس"}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      برای تغییر اسم یا عکس، روی پروفایل بالای لیست چت‌ها بزن
                    </p>
                  </div>
                </div>

                {profile?.phone_number && (
                  <div className="flex items-center gap-3 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                      <PhoneIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-100 text-sm font-medium" dir="ltr">
                        {profile.phone_number}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">شماره موبایل</p>
                    </div>
                  </div>
                )}

                {profile?.email && (
                  <div className="flex items-center gap-3 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                      <MailIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-100 text-sm font-medium truncate" dir="ltr">
                        {profile.email}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">ایمیل</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeCategory === "notifications" && (
              <>
                <ToggleRow
                  icon={isSoundEnabled ? Volume2Icon : VolumeOffIcon}
                  iconColor="bg-amber-500/20 text-amber-400"
                  title="صدای پیام‌رسان"
                  description="پخش صدا موقع تایپ، ارسال و کلیک توی برنامه"
                  checked={isSoundEnabled}
                  onToggle={toggleSound}
                />
                <ToggleRow
                  icon={BellIcon}
                  iconColor="bg-amber-500/20 text-amber-400"
                  title="اعلان پیام‌های جدید"
                  description="فعال/غیرفعال کردن اعلان پیام‌های تازه"
                  checked={settings.notificationsEnabled}
                  onToggle={() => settings.toggleSetting("notificationsEnabled")}
                />
                <ToggleRow
                  icon={EyeIcon}
                  iconColor="bg-amber-500/20 text-amber-400"
                  title="نمایش متن پیام توی اعلان"
                  description="اگه خاموش باشه، فقط اسم فرستنده نشون داده می‌شه"
                  checked={settings.messagePreviewEnabled}
                  onToggle={() => settings.toggleSetting("messagePreviewEnabled")}
                />
                <ToggleRow
                  icon={UsersRoundIcon}
                  iconColor="bg-amber-500/20 text-amber-400"
                  title="اعلان پیام‌های گروه"
                  description="اعلان جدا برای پیام‌های گروه‌ها و چنل‌ها"
                  checked={settings.notifGroupsEnabled}
                  onToggle={() => settings.toggleSetting("notifGroupsEnabled")}
                />
                <ToggleRow
                  icon={PhoneCallIcon}
                  iconColor="bg-amber-500/20 text-amber-400"
                  title="اعلان تماس‌های ورودی"
                  description="زنگ و اعلان موقع تماس صوتی/تصویری"
                  checked={settings.notifCallsEnabled}
                  onToggle={() => settings.toggleSetting("notifCallsEnabled")}
                />
                <ToggleRow
                  icon={VibrateIcon}
                  iconColor="bg-amber-500/20 text-amber-400"
                  title="لرزش"
                  description="لرزش گوشی هنگام دریافت اعلان (فقط موبایل)"
                  checked={settings.notifVibrateEnabled}
                  onToggle={() => settings.toggleSetting("notifVibrateEnabled")}
                />
              </>
            )}

            {activeCategory === "privacy" && (
              <>
                <ToggleRow
                  icon={EyeIcon}
                  iconColor="bg-emerald-500/20 text-emerald-400"
                  title="نمایش وضعیت آنلاین"
                  description="ترجیح محلی — فقط روی همین دستگاه ذخیره می‌شه"
                  checked={settings.onlineStatusVisible}
                  onToggle={() => settings.toggleSetting("onlineStatusVisible")}
                />
                <ToggleRow
                  icon={CheckCheckIcon}
                  iconColor="bg-emerald-500/20 text-emerald-400"
                  title="تیک دوبار خوانده‌شدن"
                  description="ترجیح محلی — فقط روی همین دستگاه ذخیره می‌شه"
                  checked={settings.readReceiptsEnabled}
                  onToggle={() => settings.toggleSetting("readReceiptsEnabled")}
                />
              </>
            )}

            {activeCategory === "chats" && (
              <>
                {/* واقعاً کاربردی: روی MessageInput اثر می‌ذاره */}
                <ToggleRow
                  icon={CornerDownLeftIcon}
                  iconColor="bg-violet-500/20 text-violet-400"
                  title="ارسال با Enter"
                  description="خاموش که باشه، Enter پیام رو نمی‌فرسته و باید دکمه‌ی ارسال رو بزنی"
                  checked={settings.enterToSend}
                  onToggle={() => settings.toggleSetting("enterToSend")}
                />

                {/* واقعاً کاربردی: کل فونت اپ رو عوض می‌کنه */}
                <SegmentedRow
                  icon={TypeIcon}
                  iconColor="bg-violet-500/20 text-violet-400"
                  title="اندازه‌ی فونت"
                  description="روی کل متن‌های برنامه اعمال می‌شه"
                  options={FONT_SIZE_OPTIONS}
                  value={settings.fontSize}
                  onChange={(v) => settings.setSetting("fontSize", v)}
                />

                {/* واقعاً کاربردی: پس‌زمینه‌ی گرید App.jsx رو نشون/مخفی می‌کنه */}
                <ToggleRow
                  icon={ImageIcon}
                  iconColor="bg-violet-500/20 text-violet-400"
                  title="پس‌زمینه‌ی گرید نقطه‌ای"
                  description="نقش‌ونگار پس‌زمینه‌ی برنامه رو نشون می‌ده یا مخفی می‌کنه"
                  checked={settings.backgroundPatternEnabled}
                  onToggle={() => settings.toggleSetting("backgroundPatternEnabled")}
                />

                <ToggleRow
                  icon={DownloadIcon}
                  iconColor="bg-violet-500/20 text-violet-400"
                  title="دانلود خودکار مدیا"
                  description="ترجیح محلی — فقط روی همین دستگاه ذخیره می‌شه"
                  checked={settings.autoDownloadMedia}
                  onToggle={() => settings.toggleSetting("autoDownloadMedia")}
                />
              </>
            )}

            {activeCategory === "about" && (
              <div className="py-5 flex flex-col items-center text-center gap-1.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg mb-1">
                  <MessageCircleIcon className="w-7 h-7 text-white" />
                </div>
                <p className="text-slate-200 text-sm font-semibold">چتیفای</p>
                <p className="text-slate-500 text-xs">نسخه ۱.۰.۰</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;