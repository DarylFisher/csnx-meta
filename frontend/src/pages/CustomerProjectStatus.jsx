import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import Gantt from "frappe-gantt";
import { jsPDF } from "jspdf";
import "svg2pdf.js";

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

const STATUS_COLS = ["pending", "in_progress", "completed"];
const STATUS_LABELS = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };

function SummaryTable({ title, tasks, valueKey }) {
  const resourceTypes = useMemo(() => {
    const types = [...new Set(tasks.map((t) => t.resource_type || ""))].filter(Boolean).sort();
    return types;
  }, [tasks]);

  const data = useMemo(() => {
    const map = {};
    for (const rt of resourceTypes) {
      map[rt] = { pending: 0, in_progress: 0, completed: 0 };
    }
    for (const t of tasks) {
      const rt = t.resource_type || "";
      if (!rt || !map[rt]) continue;
      const status = t.status;
      if (status in map[rt]) {
        map[rt][status] += valueKey === "count" ? 1 : (t.duration || 0);
      }
    }
    return map;
  }, [tasks, resourceTypes, valueKey]);

  const totals = useMemo(() => {
    const t = { pending: 0, in_progress: 0, completed: 0 };
    for (const rt of resourceTypes) {
      for (const s of STATUS_COLS) {
        t[s] += data[rt]?.[s] || 0;
      }
    }
    return t;
  }, [data, resourceTypes]);

  return (
    <div className="flex-1 min-w-[300px] bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="border rounded overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Resource</th>
              {STATUS_COLS.map((s) => (
                <th key={s} className="px-3 py-2 text-right font-medium text-gray-700">
                  {STATUS_LABELS[s]}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {resourceTypes.map((rt) => {
              const row = data[rt];
              const rowTotal = STATUS_COLS.reduce((sum, s) => sum + (row[s] || 0), 0);
              return (
                <tr key={rt} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{rt}</td>
                  {STATUS_COLS.map((s) => (
                    <td key={s} className="px-3 py-2 text-right">{row[s] || 0}</td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr className="font-medium">
              <td className="px-3 py-2">Total</td>
              {STATUS_COLS.map((s) => (
                <td key={s} className="px-3 py-2 text-right">{totals[s]}</td>
              ))}
              <td className="px-3 py-2 text-right">
                {STATUS_COLS.reduce((sum, s) => sum + totals[s], 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  completed: "#22c55e",
  in_progress: "#3b82f6",
  pending: "#d1d5db",
};

function HoursBarChart({ tasks }) {
  const resourceTypes = useMemo(() => {
    return [...new Set(tasks.map((t) => t.resource_type || ""))].filter(Boolean).sort();
  }, [tasks]);

  const data = useMemo(() => {
    const map = {};
    for (const rt of resourceTypes) {
      map[rt] = { pending: 0, in_progress: 0, completed: 0 };
    }
    for (const t of tasks) {
      const rt = t.resource_type || "";
      if (!rt || !map[rt]) continue;
      if (t.status in map[rt]) {
        map[rt][t.status] += t.duration || 0;
      }
    }
    return map;
  }, [tasks, resourceTypes]);

  const maxHours = useMemo(() => {
    let max = 0;
    for (const rt of resourceTypes) {
      const total = STATUS_COLS.reduce((s, st) => s + (data[rt]?.[st] || 0), 0);
      if (total > max) max = total;
    }
    return max || 1;
  }, [data, resourceTypes]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Hours by Resource</h3>
      <div className="flex gap-2 mb-4 text-xs">
        {STATUS_COLS.map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS[s] }} />
            {STATUS_LABELS[s]}
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {resourceTypes.map((rt) => {
          const row = data[rt];
          const total = STATUS_COLS.reduce((s, st) => s + (row[st] || 0), 0);
          const pctComplete = total > 0 ? Math.round((row.completed / total) * 100) : 0;
          return (
            <div key={rt} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-700 text-right shrink-0">{rt}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden flex">
                {STATUS_COLS.filter((s) => row[s] > 0).map((s) => (
                  <div
                    key={s}
                    className="h-full flex items-center justify-center text-xs text-white font-medium"
                    style={{
                      width: `${(row[s] / maxHours) * 100}%`,
                      backgroundColor: STATUS_COLORS[s],
                      color: s === "pending" ? "#6b7280" : "#ffffff",
                    }}
                    title={`${STATUS_LABELS[s]}: ${row[s]}h`}
                  >
                    {row[s] > 0 && total > 0 && (row[s] / maxHours) * 100 > 8 ? `${row[s]}h` : ""}
                  </div>
                ))}
              </div>
              <div className="w-16 text-sm text-right shrink-0">
                <span className="font-medium">{pctComplete}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectStatusView({ tasks, projectName }) {
  if (!tasks.length) {
    return <p className="text-gray-500">No tasks found for this project.</p>;
  }

  function exportStatusExcel() {
    const resourceTypes = [...new Set(tasks.map((t) => t.resource_type || ""))].filter(Boolean).sort();

    // Build summary data
    function buildSummary(valueKey) {
      const map = {};
      for (const rt of resourceTypes) map[rt] = { pending: 0, in_progress: 0, completed: 0 };
      for (const t of tasks) {
        const rt = t.resource_type || "";
        if (!rt || !map[rt]) continue;
        if (t.status in map[rt]) map[rt][t.status] += valueKey === "count" ? 1 : (t.duration || 0);
      }
      return map;
    }

    const counts = buildSummary("count");
    const hours = buildSummary("duration");

    // Build worksheet as array of arrays for precise placement
    const rows = [];

    // Row 0: headers for both tables side by side
    rows.push([
      "Task Counts", "", "", "", "",
      "",
      "Man Hours", "", "", "", "",
    ]);
    rows.push([
      "Resource", "Pending", "In Progress", "Completed", "Total",
      "",
      "Resource", "Pending", "In Progress", "Completed", "Total",
    ]);

    // Data rows
    for (const rt of resourceTypes) {
      const c = counts[rt];
      const h = hours[rt];
      const cTotal = c.pending + c.in_progress + c.completed;
      const hTotal = h.pending + h.in_progress + h.completed;
      rows.push([
        rt, c.pending, c.in_progress, c.completed, cTotal,
        "",
        rt, h.pending, h.in_progress, h.completed, hTotal,
      ]);
    }

    // Totals row
    const cTotals = { pending: 0, in_progress: 0, completed: 0 };
    const hTotals = { pending: 0, in_progress: 0, completed: 0 };
    for (const rt of resourceTypes) {
      for (const s of STATUS_COLS) {
        cTotals[s] += counts[rt][s];
        hTotals[s] += hours[rt][s];
      }
    }
    rows.push([
      "Total", cTotals.pending, cTotals.in_progress, cTotals.completed,
      cTotals.pending + cTotals.in_progress + cTotals.completed,
      "",
      "Total", hTotals.pending, hTotals.in_progress, hTotals.completed,
      hTotals.pending + hTotals.in_progress + hTotals.completed,
    ]);

    // Blank row
    rows.push([]);

    // Hours by Resource chart data
    rows.push(["Hours by Resource"]);
    rows.push(["Resource", "Pending", "In Progress", "Completed", "Total", "% Complete"]);
    for (const rt of resourceTypes) {
      const h = hours[rt];
      const total = h.pending + h.in_progress + h.completed;
      const pct = total > 0 ? Math.round((h.completed / total) * 100) : 0;
      rows.push([rt, h.pending, h.in_progress, h.completed, total, pct + "%"]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Merge header cells for table titles
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 0, c: 6 }, e: { r: 0, c: 10 } },
      { s: { r: rows.length - resourceTypes.length - 2, c: 0 }, e: { r: rows.length - resourceTypes.length - 2, c: 5 } },
    ];

    // Column widths
    ws["!cols"] = [
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 2 },
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Project Status");
    XLSX.writeFile(wb, `${projectName || "project"} - Status.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={exportStatusExcel}
          className="px-3 py-1 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700"
        >
          Export Excel
        </button>
      </div>
      <div className="flex gap-6 flex-wrap">
        <SummaryTable title="Task Counts" tasks={tasks} valueKey="count" />
        <SummaryTable title="Man Hours" tasks={tasks} valueKey="duration" />
      </div>
      <HoursBarChart tasks={tasks} />
    </div>
  );
}

const GANTT_VIEW_MODES = ["Day", "Week", "Month"];
const STATUS_BAR_COLORS = {
  completed: "#22c55e",
  in_progress: "#3b82f6",
  pending: "#9ca3af",
};

function ProjectGanttView({ tasks, projectName }) {
  const ganttRef = useRef(null);
  const chartScrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  const labelsBodyRef = useRef(null);
  const [viewMode, setViewMode] = useState("Week");
  const [layout, setLayout] = useState({ headerHeight: 50, rowHeight: 38, svgWidth: 0, svgHeight: 0 });

  const ganttTasks = useMemo(() => {
    return tasks
      .filter((t) => t.start_date && t.end_date)
      .map((t) => ({
        id: t.task_id,
        name: t.description || t.task_id,
        start: t.start_date,
        end: t.end_date,
        progress: t.status === "completed" ? 100 : t.status === "in_progress" ? 50 : 0,
        _status: t.status,
      }));
  }, [tasks]);

  useEffect(() => {
    if (!ganttTasks.length || !ganttRef.current) {
      if (ganttRef.current) ganttRef.current.innerHTML = "";
      return;
    }

    ganttRef.current.innerHTML = "";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ganttRef.current.appendChild(svg);

    new Gantt(svg, ganttTasks, {
      view_mode: viewMode,
      date_format: "YYYY-MM-DD",
      popup_trigger: "mouseover",
      on_click: () => {},
      on_date_change: () => {},
      on_progress_change: () => {},
      on_view_change: () => {},
    });

    requestAnimationFrame(() => {
      const gridHeader = svg.querySelector(".grid-header rect");
      const hHeight = gridHeader ? parseFloat(gridHeader.getAttribute("height")) : 50;

      const gridRows = svg.querySelectorAll(".grid-rows rect");
      const rHeight = gridRows.length > 0 ? parseFloat(gridRows[0].getAttribute("height")) : 38;

      const svgW = parseFloat(svg.getAttribute("width"));
      const svgH = parseFloat(svg.getAttribute("height"));

      setLayout({ headerHeight: hHeight, rowHeight: rHeight, svgWidth: svgW, svgHeight: svgH });

      // Hide bar labels (shown in fixed left panel instead)
      svg.querySelectorAll(".bar-label").forEach((el) => (el.style.display = "none"));

      // Apply status colors
      for (const t of ganttTasks) {
        const color = STATUS_BAR_COLORS[t._status] || "#9ca3af";
        const safeId = CSS.escape(t.id);
        ganttRef.current
          .querySelectorAll(`.bar-wrapper[data-id="${safeId}"] .bar-progress, .bar-wrapper[data-id="${safeId}"] .bar`)
          .forEach((el) => (el.style.fill = color));
      }

      // Build fixed header SVG (clone with only date axis)
      if (headerScrollRef.current) {
        headerScrollRef.current.innerHTML = "";
        const headerSvg = svg.cloneNode(true);
        headerSvg.setAttribute("viewBox", `0 0 ${svgW} ${hHeight}`);
        headerSvg.setAttribute("width", svgW);
        headerSvg.setAttribute("height", hHeight);
        headerSvg.style.display = "block";
        headerSvg.style.maxWidth = "none";
        headerSvg.querySelector("g.bar")?.remove();
        headerSvg.querySelector("g.details-container")?.remove();
        headerScrollRef.current.appendChild(headerSvg);
      }

      // Crop main SVG to body only (hide header)
      svg.setAttribute("viewBox", `0 ${hHeight} ${svgW} ${svgH - hHeight}`);
      svg.setAttribute("height", svgH - hHeight);
      svg.setAttribute("width", svgW);
      svg.style.maxWidth = "none";
      svg.style.display = "block";
    });
  }, [ganttTasks, viewMode]);

  function handleChartScroll(e) {
    if (labelsBodyRef.current) labelsBodyRef.current.scrollTop = e.target.scrollTop;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.target.scrollLeft;
  }

  async function exportPDF() {
    const svg = ganttRef.current?.querySelector("svg");
    if (!svg) return;

    const { headerHeight: hH, rowHeight: rH, svgWidth, svgHeight } = layout;
    const labelWidth = 260;
    const totalWidth = labelWidth + svgWidth;
    const totalHeight = svgHeight;

    // Temporarily restore full SVG (uncrop header), keep bar labels hidden
    const savedViewBox = svg.getAttribute("viewBox");
    const savedHeight = svg.getAttribute("height");
    svg.removeAttribute("viewBox");
    svg.setAttribute("height", svgHeight);

    const clone = svg.cloneNode(true);
    document.body.appendChild(clone);
    clone.style.position = "absolute";
    clone.style.left = "-9999px";

    const origEls = svg.querySelectorAll("*");
    const cloneEls = clone.querySelectorAll("*");
    const styleProps = ["fill", "stroke", "stroke-width", "opacity", "font-size", "font-weight", "font-family", "text-anchor", "dominant-baseline"];
    for (let i = 0; i < origEls.length; i++) {
      const computed = window.getComputedStyle(origEls[i]);
      for (const prop of styleProps) {
        const val = computed.getPropertyValue(prop);
        if (val) cloneEls[i].style.setProperty(prop, val);
      }
    }

    // Restore cropped view on screen
    svg.setAttribute("viewBox", savedViewBox);
    svg.setAttribute("height", savedHeight);

    // White background on clone
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", svgWidth);
    bg.setAttribute("height", svgHeight);
    bg.setAttribute("fill", "#ffffff");
    clone.insertBefore(bg, clone.firstChild);

    // Create PDF sized to fit left panel + full chart
    const pdf = new jsPDF({
      orientation: totalWidth > totalHeight ? "landscape" : "portrait",
      unit: "px",
      format: [totalWidth, totalHeight],
    });

    // -- Left panel background --
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, labelWidth, totalHeight, "F");

    // Header background
    pdf.setFillColor(249, 250, 251);
    pdf.rect(0, 0, labelWidth, hH, "F");

    // Header text
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(55, 65, 81);
    pdf.text("Task Description", 10, hH - 8);

    // Header bottom border
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.line(0, hH, labelWidth, hH);

    // Task names
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(55, 65, 81);
    ganttTasks.forEach((t, i) => {
      const y = hH + (i * rH) + (rH / 2) + 3;
      let text = t.name;
      while (pdf.getTextWidth(text) > labelWidth - 20 && text.length > 3) {
        text = text.slice(0, -4) + "...";
      }
      pdf.text(text, 10, y);
      // Row separator
      pdf.setDrawColor(243, 244, 246);
      pdf.line(0, hH + (i + 1) * rH, labelWidth, hH + (i + 1) * rH);
    });

    // Vertical divider between labels and chart
    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(1.5);
    pdf.line(labelWidth, 0, labelWidth, totalHeight);
    pdf.setLineWidth(0.5);

    // -- Render the SVG chart to the right of the labels --
    await pdf.svg(clone, { x: labelWidth, y: 0, width: svgWidth, height: svgHeight });
    pdf.save(`${projectName || "project"} - Gantt.pdf`);
    document.body.removeChild(clone);
  }

  if (!ganttTasks.length) {
    return <p className="text-gray-500">No tasks with dates found for this project.</p>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        {GANTT_VIEW_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              viewMode === mode
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {mode}
          </button>
        ))}
        <div className="flex gap-3 ml-4 text-xs items-center">
          {Object.entries(STATUS_BAR_COLORS).map(([s, color]) => (
            <div key={s} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              {STATUS_LABELS[s]}
            </div>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={exportPDF}
            className="px-3 py-1 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="border rounded overflow-hidden" style={{ display: "flex" }}>
        {/* Fixed left panel: task descriptions */}
        <div style={{ width: 260, flexShrink: 0, borderRight: "2px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column", zIndex: 2 }}>
          <div style={{ height: layout.headerHeight, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", alignItems: "flex-end", padding: "0 10px 6px", fontWeight: 600, fontSize: 12, color: "#374151", flexShrink: 0 }}>
            Task Description
          </div>
          <div ref={labelsBodyRef} style={{ flex: 1, overflowY: "hidden", maxHeight: 500 }}>
            {ganttTasks.map((t) => (
              <div
                key={t.id}
                style={{
                  height: layout.rowHeight,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  fontSize: 12,
                  color: "#374151",
                  borderBottom: "1px solid #f3f4f6",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={t.name}
              >
                {t.name}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: fixed time header + scrollable chart body */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div ref={headerScrollRef} style={{ flexShrink: 0, overflowX: "hidden", borderBottom: "1px solid #e5e7eb", background: "#fff" }} />
          <div ref={chartScrollRef} onScroll={handleChartScroll} style={{ flex: 1, overflow: "auto", maxHeight: 500 }}>
            <div ref={ganttRef} style={{ width: "max-content" }} />
          </div>
        </div>
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
      ) : selectedView === "project-status" ? (
        <ProjectStatusView tasks={tasks} projectName={currentProject?.project_name} />
      ) : selectedView === "project-gantt" ? (
        <ProjectGanttView tasks={tasks} projectName={currentProject?.project_name} />
      ) : (
        <p className="text-gray-500">Coming soon.</p>
      )}
    </div>
  );
}
