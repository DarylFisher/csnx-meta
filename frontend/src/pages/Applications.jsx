import { useEffect, useState } from "react";

export default function Applications() {
  const [apps, setApps] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/applications${params}`)
      .then((r) => r.json())
      .then(setApps);
  }, [search]);

  useEffect(() => {
    if (selected === null) {
      setDetail(null);
      return;
    }
    fetch(`/api/applications/${selected}`)
      .then((r) => r.json())
      .then(setDetail);
  }, [selected]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Applications</h1>
      <input
        type="text"
        placeholder="Search applications..."
        className="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid md:grid-cols-2 gap-4">
        {/* List */}
        <div className="space-y-2">
          {apps.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                selected === a.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-indigo-300"
              }`}
            >
              <div className="font-semibold">{a.name}</div>
              {a.description && (
                <div className="text-sm text-gray-500">{a.description}</div>
              )}
            </button>
          ))}
          {apps.length === 0 && (
            <p className="text-gray-400 text-sm">No applications found.</p>
          )}
        </div>

        {/* Detail */}
        {detail && (
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-bold mb-1">{detail.name}</h2>
            <p className="text-sm text-gray-500 mb-3">{detail.description}</p>
            <h3 className="font-semibold text-sm mb-2 text-gray-700">
              Columns Used ({detail.columns.length})
            </h3>
            {detail.columns.length === 0 ? (
              <p className="text-sm text-gray-400">No column mappings.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1">Table</th>
                    <th className="py-1">Column</th>
                    <th className="py-1">Type</th>
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
                      <td className="py-1 text-gray-500">{c.data_type}</td>
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
