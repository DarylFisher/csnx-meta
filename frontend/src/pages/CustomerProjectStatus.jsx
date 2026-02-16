import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

const VIEW_OPTIONS = [
  { value: "task-view", label: "Task View" },
  { value: "project-status", label: "Project Status" },
  { value: "project-gantt", label: "Project Gantt" },
  { value: "project-tracking-gantt", label: "Project Tracking Gantt" },
];

function daysDiff(baselineEnd, currentEnd) {
  if (!baselineEnd || !currentEnd) return null;
  const b = new Date(baselineEnd);
  const c = new Date(currentEnd);
  return Math.round((c - b) / (1000 * 60 * 60 * 24));
}

function DelayBadge({ days }) {
  if (days === null) return <span className="text-gray-400">-</span>;
  if (days <= 0) return <span className="text-green-600 font-medium">{days}</span>;
  return <span className="text-red-600 font-medium">+{days}</span>;
}

function StatusBadge({ status }) {
  const colors = {
    completed: "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    pending: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function MultiFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (val) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(next);
  };

  const allSelected = options.length === selected.size;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border"
      >
        {label} ({selected.size}/{options.length}) ▾
      </button>
      {open && (
        <div className="absolute z-20 mt-1 bg-white border rounded shadow-lg w-48 max-h-56 overflow-y-auto">
          <div className="flex gap-2 px-3 py-1.5 border-b">
            <button
              onClick={() => onChange(new Set(options))}
              className="text-xs text-blue-600 hover:underline"
            >
              All
            </button>
            <button
              onClick={() => onChange(new Set())}
              className="text-xs text-blue-600 hover:underline"
            >
              None
            </button>
          </div>
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.has(o)}
                onChange={() => toggle(o)}
                className="rounded"
              />
              {o || "(empty)"}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const COLUMNS = [
  { key: "task_id", label: "Task", align: "left" },
  { key: "description", label: "Description", align: "left" },
  { key: "status", label: "Status", align: "left" },
  { key: "resource_type", label: "Resource", align: "left" },
  { key: "duration", label: "Duration", align: "right" },
  { key: "baseline_start_date", label: "Baseline Start", align: "left" },
  { key: "baseline_end_date", label: "Baseline End", align: "left" },
  { key: "start_date", label: "Current Start", align: "left" },
  { key: "end_date", label: "Current End", align: "left" },
  { key: "delay", label: "Delay Days", align: "right" },
];

function SortHeader({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      className={`px-3 py-2 font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap ${
        col.align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onSort(col.key)}
    >
      {col.label}{arrow}
    </th>
  );
}

function TaskView({ tasks, projectName }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [statusFilter, setStatusFilter] = useState(new Set());
  const [resourceFilter, setResourceFilter] = useState(new Set());

  // Derive unique statuses and resources from tasks
  const statuses = useMemo(() => [...new Set(tasks.map((t) => t.status))].sort(), [tasks]);
  const resources = useMemo(() => [...new Set(tasks.map((t) => t.resource_type || ""))].sort(), [tasks]);

  // Initialize filters when tasks change
  useEffect(() => {
    setStatusFilter(new Set(statuses));
    setResourceFilter(new Set(resources));
  }, [tasks]);

  // Add computed delay field to each task
  const enriched = useMemo(
    () => tasks.map((t) => ({ ...t, delay: daysDiff(t.baseline_end_date, t.end_date) })),
    [tasks]
  );

  // Filter
  const filtered = useMemo(
    () =>
      enriched.filter(
        (t) => statusFilter.has(t.status) && resourceFilter.has(t.resource_type || "")
      ),
    [enriched, statusFilter, resourceFilter]
  );

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (va === null || va === undefined) va = "";
      if (vb === null || vb === undefined) vb = "";
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportToExcel() {
    const rows = sorted.map((t) => ({
      Task: t.task_id,
      Description: t.description,
      Status: t.status,
      Resource: t.resource_type || "",
      Duration: t.duration,
      "Baseline Start": t.baseline_start_date || "",
      "Baseline End": t.baseline_end_date || "",
      "Current Start": t.start_date || "",
      "Current End": t.end_date || "",
      "Delay Days": t.delay ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String(r[k]).length)) + 2,
    }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, `${projectName || "tasks"}.xlsx`);
  }

  if (!tasks.length) {
    return <p className="text-gray-500">No tasks found for this project.</p>;
  }

  return (
    <div>
      <div className="flex gap-3 mb-3 items-center flex-wrap">
        <MultiFilter label="Status" options={statuses} selected={statusFilter} onChange={setStatusFilter} />
        <MultiFilter label="Resource" options={resources} selected={resourceFilter} onChange={setResourceFilter} />
        <span className="text-xs text-gray-500">{sorted.length} of {tasks.length} tasks</span>
        <div className="ml-auto">
          <button
            onClick={exportToExcel}
            className="px-3 py-1 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700"
          >
            Export Excel
          </button>
        </div>
      </div>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {COLUMNS.map((col) => (
                <SortHeader key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((t) => (
              <tr key={t.task_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-gray-500">{t.task_id}</td>
                <td className="px-3 py-2">{t.description}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{t.resource_type || "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{t.duration ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{t.baseline_start_date || "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{t.baseline_end_date || "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{t.start_date || "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{t.end_date || "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <DelayBadge days={t.delay} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CustomerProjectStatus() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedView, setSelectedView] = useState("task-view");
  const [tasks, setTasks] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState(null);

  const currentProject = projects.find((p) => p.project_id === selectedProject);

  useEffect(() => {
    fetch("/dashboard-api/projects")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setProjects(data);
        if (data.length > 0) setSelectedProject(data[0].project_id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoadingTasks(true);
    fetch(`/dashboard-api/projects/${selectedProject}/tasks`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingTasks(false));
  }, [selectedProject]);

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Link to="/development" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          &larr; Development Status
        </Link>
        <h1 className="text-2xl font-bold mb-4">Customer Project Status</h1>
        <p className="text-red-600">Failed to load data: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/development" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        &larr; Development Status
      </Link>
      <h1 className="text-2xl font-bold mb-4">Customer Project Status</h1>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm min-w-[300px]"
          >
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.customer_code} - {p.project_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
          <select
            value={selectedView}
            onChange={(e) => setSelectedView(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm min-w-[200px]"
          >
            {VIEW_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingTasks ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : selectedView === "task-view" ? (
        <TaskView tasks={tasks} projectName={currentProject?.project_name} />
      ) : (
        <p className="text-gray-500">Coming soon.</p>
      )}
    </div>
  );
}
