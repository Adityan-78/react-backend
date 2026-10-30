// ===== Imports =====
import { useState, useEffect, useCallback } from "react";

// ===== useFetch: load data from the API and remember it =====
// Usage inside a component:
//   const orders = useFetch(() => ordersApi.list({ page: 1 }), [page]);
//   orders.data     -> the server's answer (null while loading)
//   orders.loading  -> true while waiting
//   orders.error    -> an error message, or ""
//   orders.reload() -> fetch again (e.g. after saving something)
// "dependencies" is a list of values; when one changes, the data is fetched again.
export default function useFetch(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // useCallback keeps the same "load" function until a dependency changes.
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  // useEffect runs "load" when the component first appears and whenever it changes.
  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
