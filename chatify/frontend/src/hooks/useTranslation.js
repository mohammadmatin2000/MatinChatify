import { useLanguageStore } from "../store/useLanguageStore";

// استفاده: const { t, language } = useTranslation();  ...  <p>{t("chatHeader.audioCall")}</p>
export default function useTranslation() {
    const t = useLanguageStore((state) => state.t);
    const language = useLanguageStore((state) => state.language);
    const setLanguage = useLanguageStore((state) => state.setLanguage);
    return { t, language, setLanguage };
}