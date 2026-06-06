import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

export function MockBanner() {
  const [mock, setMock] = useState<{ db: boolean; chain: boolean } | null>(null);

  useEffect(() => {
    api
      .get("/health")
      .then(({ data }) => setMock({ db: data.dbMock, chain: data.blockchain?.mock }))
      .catch(() => setMock(null));
  }, []);

  if (!mock || (!mock.db && !mock.chain)) return null;

  return (
    <div className="flex items-center gap-2 bg-warning/15 px-4 py-2 text-sm text-warning">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Mode demo aktif
        {mock.db && " — database in-memory"}
        {mock.db && mock.chain && " &"}
        {mock.chain && " blockchain disimulasikan"}. Data tidak permanen.
      </span>
    </div>
  );
}
