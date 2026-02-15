import { useEffect, useState } from "react";

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [colApps, setColApps] = useState({});

  useEffect(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/tables${params}`)
      .then((r) => r.json())
      .then(setTables);
  }, [search]);

  useEffect(() => {
    if (expanded === null) {
      setDetail(null);
      return;
    }
    fetch(`/api/tables/${expanded}`)
      .then((r) => r.json())
      .then(setDetail);
  }, [expanded]);

  function loadColumnApps(colId) {
    if (colApps[colId]) return;
    fetch(`/api/xref/by-column/${colId}`)
      .then((r) => r.json())
      .then((data) => setColApps((prev) => ({ ...prev, [colId]: data })));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Tables &amp; Columns</h1>
      <input
        type="text"
        placeholder="Search tables..."
        className="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="space-y-2">
        {tables.map((t) => (
          <div key={t.id} className="border rounded-lg">
            <button
              className="w-full text-left p-3 flex justify-between items-center hover:bg-gray-50"
              onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            >
              <div>
                <span className="font-semibold">
                  {t.schema_name}.{t.table_name}
                </span>
                {t.description && (
                  <span className="ml-2 text-sm text-gray-500">
                    — {t.description}
                  </span>
                )}
              </div>
              <span className="text-gray-400 text-lg">
                {expanded === t.id ? "−" : "+"}
              </span>
            </button>

            {expanded === t.id && detail && (
              <div className="px-3 pb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-1">Column</th>
                      <th className="py-1">Type</th>
                      <th className="py-1">Description</th>
                      <th className="py-1">Used By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.columns.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b last:border-0 align-top"
                        onMouseEnter={() => loadColumnApps(c.id)}
                      >
                        <td className="py-1 font-mono">{c.column_name}</td>
                        <td className="py-1 text-gray-500">{c.data_type}</td>
                        <td className="py-1 text-gray-500">{c.description}</td>
                        <td className="py-1">
                          {colApps[c.id] ? (
                            colApps[c.id].length === 0 ? (
                              <span className="text-gray-400">none</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {colApps[c.id].map((x) => (
                                  <span
                                    key={x.id}
                                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                                  >
                                    {x.application_name} ({x.usage_type})
                                  </span>
                                ))}
                              </div>
                            )
                          ) : (
                            <span className="text-gray-300 text-xs">
                              hover to load
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {tables.length === 0 && (
          <p className="text-gray-400 text-sm">No tables found.</p>
        )}
      </div>
    </div>
  );
}
