import { useState } from "react";

export default function CrossRef() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailType, setDetailType] = useState(null);

  function doSearch() {
    if (!query.trim()) return;
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setDetail(null);
        setDetailType(null);
      });
  }

  function loadDetail(type, id) {
    setDetailType(type);
    if (type === "application") {
      fetch(`/api/applications/${id}`)
        .then((r) => r.json())
        .then(setDetail);
    } else if (type === "column") {
      fetch(`/api/columns/${id}`)
        .then((r) => r.json())
        .then(setDetail);
    } else if (type === "table") {
      fetch(`/api/tables/${id}`)
        .then((r) => r.json())
        .then(setDetail);
    }
  }

  const badgeColor = {
    application: "bg-purple-100 text-purple-700",
    table: "bg-teal-100 text-teal-700",
    column: "bg-amber-100 text-amber-700",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Cross Reference Search</h1>
      <p className="text-sm text-gray-500 mb-3">
        Search across applications, tables, and columns to find relationships.
      </p>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="e.g. OrderService, customer_id, payments..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
        />
        <button
          onClick={doSearch}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Search
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Results list */}
        {results && (
          <div className="space-y-2">
            {results.length === 0 && (
              <p className="text-gray-400 text-sm">No results found.</p>
            )}
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => loadDetail(r.type, r.id)}
                className="w-full text-left p-3 border rounded-lg hover:border-indigo-300 transition"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor[r.type]}`}
                  >
                    {r.type}
                  </span>
                  <span className="font-semibold">{r.name}</span>
                </div>
                {r.detail && (
                  <div className="text-sm text-gray-500 mt-1">{r.detail}</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Detail pane */}
        {detail && (
          <div className="border rounded-lg p-4">
            {detailType === "application" && (
              <>
                <h2 className="text-lg font-bold mb-1">{detail.name}</h2>
                <p className="text-sm text-gray-500 mb-3">
                  {detail.description}
                </p>
                <h3 className="font-semibold text-sm mb-2 text-gray-700">
                  Columns Used ({detail.columns.length})
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-1">Table</th>
                      <th className="py-1">Column</th>
                      <th className="py-1">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.columns.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1">
                          {c.schema_name}.{c.table_name}
                        </td>
                        <td className="py-1 font-mono">{c.column_name}</td>
                        <td className="py-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              c.usage_type === "READ"
                                ? "bg-green-100 text-green-700"
                                : c.usage_type === "WRITE"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {c.usage_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {detailType === "column" && (
              <>
                <h2 className="text-lg font-bold mb-1">
                  {detail.schema_name}.{detail.table_name}.{detail.column_name}
                </h2>
                <p className="text-sm text-gray-500 mb-1">
                  Type: {detail.data_type}
                </p>
                {detail.description && (
                  <p className="text-sm text-gray-500 mb-3">
                    {detail.description}
                  </p>
                )}
                <h3 className="font-semibold text-sm mb-2 text-gray-700">
                  Used By ({detail.apps.length} apps)
                </h3>
                {detail.apps.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No applications use this column.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {detail.apps.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium">{a.name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            a.usage_type === "READ"
                              ? "bg-green-100 text-green-700"
                              : a.usage_type === "WRITE"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {a.usage_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {detailType === "table" && (
              <>
                <h2 className="text-lg font-bold mb-1">
                  {detail.schema_name}.{detail.table_name}
                </h2>
                {detail.description && (
                  <p className="text-sm text-gray-500 mb-3">
                    {detail.description}
                  </p>
                )}
                <h3 className="font-semibold text-sm mb-2 text-gray-700">
                  Columns ({detail.columns.length})
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-1">Column</th>
                      <th className="py-1">Type</th>
                      <th className="py-1">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.columns.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1 font-mono">{c.column_name}</td>
                        <td className="py-1 text-gray-500">{c.data_type}</td>
                        <td className="py-1 text-gray-500">{c.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
