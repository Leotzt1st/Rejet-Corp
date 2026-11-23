import { useEffect, useState } from "react";
import { getMediaUrl } from "../services/storage/storageService";

export function useMediaUrl(path?: string | null, download = false) {
  const [media, setMedia] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    void getMediaUrl(path, download).then((url) => {
      if (active) setMedia({ path, url });
    }).catch(() => {
      if (active) setMedia({ path, url: null });
    });
    return () => { active = false; };
  }, [path, download]);

  return media && media.path === path ? media.url : null;
}
