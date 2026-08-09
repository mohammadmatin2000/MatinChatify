import { LoaderIcon } from "lucide-react";
import useTranslation from "../hooks/useTranslation";

function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-screen">
      <LoaderIcon className="size-10 animate-spin" />
      <p className="text-slate-400 mt-4">{t("loading.page")}</p>
    </div>
  );
}

export default PageLoader;