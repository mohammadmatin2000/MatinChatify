import { useState } from "react";
import { XIcon, Radio, LoaderIcon, Copy, Check } from "lucide-react";
import { useChannelStore } from "../store/useChannelStore";

function CreateChannelModal({ isOpen, onClose }) {
  const { createChannel } = useChannelStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdChannel, setCreatedChannel] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    const result = await createChannel({ name: name.trim(), description: description.trim(), isPublic });
    setIsSubmitting(false);
    if (result) {
      setCreatedChannel(result);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setIsPublic(true);
    setCreatedChannel(null);
    setCopied(false);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdChannel.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-slate-100 font-semibold text-base flex items-center gap-2">
            <Radio className="w-4 h-4 text-violet-400" />
            {createdChannel ? "چنل ساخته شد" : "ساخت چنل جدید"}
          </h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* بعد از ساخت موفق - نمایش کد دعوت */}
        {createdChannel ? (
          <div className="p-5 space-y-4">
            <p className="text-slate-300 text-sm text-center">
              چنل «{createdChannel.name}» با موفقیت ساخته شد ✅
            </p>

            {createdChannel.is_public && (
              <div className="bg-slate-900/40 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1.5">کد دعوت — این رو با بقیه به اشتراک بذار</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-slate-300 text-xs bg-slate-950/60 rounded px-2 py-1.5 truncate" dir="ltr">
                    {createdChannel.invite_code}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="text-violet-400 hover:text-violet-300 flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              باشه
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">نام چنل</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: اخبار تیم"
                className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-violet-500"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 text-xs mb-1 block">توضیحات (اختیاری)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="درباره‌ی این چنل بنویس..."
                rows={2}
                className="w-full bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 resize-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-slate-300 text-sm">چنل عمومی</p>
                <p className="text-slate-500 text-xs">هرکی لینک دعوت داره می‌تونه جوین بشه</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic((p) => !p)}
                className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                  isPublic ? "bg-violet-600" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${
                    isPublic ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? <LoaderIcon className="w-4 h-4 animate-spin" /> : "ساخت چنل"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreateChannelModal;