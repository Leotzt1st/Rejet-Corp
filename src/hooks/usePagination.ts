import { useMemo, useState } from "react";

export function usePagination(totalPages: number, initialPage = 1) {
  const [page, setPage] = useState(initialPage);

  const pages = useMemo(() => {
    const result: (number | "ellipsis")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        result.push(i);
      } else if (result[result.length - 1] !== "ellipsis") {
        result.push("ellipsis");
      }
    }
    return result;
  }, [totalPages, page]);

  return {
    page,
    setPage,
    pages,
    goToNext: () => setPage((p) => Math.min(p + 1, totalPages)),
    goToPrev: () => setPage((p) => Math.max(p - 1, 1)),
    canGoNext: page < totalPages,
    canGoPrev: page > 1,
  };
}
