import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";

// صدای کلیک عمومی برای کل پیام‌رسان — نه فقط تایپ توی اینپوت.
const clickSounds = [
  new Audio("/sounds/keystroke1.mp3"),
  new Audio("/sounds/keystroke2.mp3"),
  new Audio("/sounds/keystroke3.mp3"),
  new Audio("/sounds/keystroke4.mp3"),
];

// عناصری که کلیک روشون نباید صدا بده (مثل تایپ کردن داخل input/textarea)
function shouldSkip(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.closest && target.closest("input, textarea")) return true;
  return false;
}

export default function useClickSound() {
  const isSoundEnabled = useChatStore((state) => state.isSoundEnabled);

  // چون listener توی یه closure ثبت می‌شه، مقدار isSoundEnabled رو توی
  // یه ref نگه می‌داریم تا هر بار listener رو re-attach نکنیم و همیشه
  // آخرین مقدار رو ببینه
  const isSoundEnabledRef = useRef(isSoundEnabled);
  isSoundEnabledRef.current = isSoundEnabled;

  useEffect(() => {
    const handleClick = (e) => {
      if (!isSoundEnabledRef.current) return;
      if (shouldSkip(e.target)) return;

      const randomSound = clickSounds[Math.floor(Math.random() * clickSounds.length)];
      randomSound.currentTime = 0;
      randomSound.play().catch((error) => console.log("Audio play failed:", error));
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}