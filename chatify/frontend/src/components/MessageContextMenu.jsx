import { createPortal } from "react-dom";
import { Reply, Forward, Copy, Star, Pin, Info, Languages, PencilIcon, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import useTranslation from "../hooks/useTranslation";

// منوی کامل پیام (مثل واتساب) — بعد از کلیک روی پیام باز می‌شه.
// هر اکشن اختیاریه: اگه callback پاس داده نشه، اون آیتم اصلاً رندر نمی‌شه.
function MessageContextMenu({
  isOpen,
  onClose,
  position, // { top, left } نسبت به viewport
  isOwner,
  hasText,
  isStarred,
  isPinned,
  onReply,
  onForward,
  onCopy,
  onToggleStar,
  onTogglePin,
  onInfo,
  onTranslate,
  onEdit,
  onDelete,
}) {
  const menuRef = useRef(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    onReply && { key: "reply", label: t("contextMenu.reply"), icon: Reply, action: onReply },
    onForward && { key: "forward", label: t("contextMenu.forward"), icon: Forward, action: onForward },
    hasText && onCopy && { key: "copy", label: t("contextMenu.copy"), icon: Copy, action: onCopy },
    onToggleStar && {
      key: "star",
      label: isStarred ? t("contextMenu.unstar") : t("contextMenu.star"),
      icon: Star,
      iconClass: isStarred ? "fill-yellow-400 text-yellow-400" : "",
      action: onToggleStar,
    },
    onTogglePin && {
      key: "pin",
      label: isPinned ? t("contextMenu.unpin") : t("contextMenu.pin"),
      icon: Pin,
      iconClass: isPinned ? "fill-cyan-400 text-cyan-400" : "",
      action: onTogglePin,
    },
    hasText && onTranslate && { key: "translate", label: t("contextMenu.translate"), icon: Languages, action: onTranslate },
    onInfo && { key: "info", label: t("contextMenu.info"), icon: Info, action: onInfo },
    isOwner && hasText && onEdit && { key: "edit", label: t("contextMenu.edit"), icon: PencilIcon, action: onEdit },
    isOwner && onDelete && { key: "delete", label: t("contextMenu.delete"), icon: Trash2, danger: true, action: onDelete },
  ].filter(Boolean);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[150]" onClick={onClose} />
      <div
        ref={menuRef}
        style={position}
        className="fixed bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl py-1.5 w-48 z-[160]"
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                item.action();
                onClose();
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-right transition-colors hover:bg-slate-700/60 ${
                item.danger ? "text-red-400" : "text-slate-200"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${item.iconClass || ""}`} />
              {item.label}
            </button>
          );
        })}
      </div>
    </>,
    document.body
  );
}

export default MessageContextMenu;