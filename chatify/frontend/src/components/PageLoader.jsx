import { LoaderIcon } from "lucide-react";

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <LoaderIcon className="size-10 animate-spin" />
      <p className="text-slate-400 mt-4">در حال بارگذاری...</p>
    </div>
  );
}

export default PageLoader;
