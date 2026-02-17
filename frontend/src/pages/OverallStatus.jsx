import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Gantt from "frappe-gantt";
import { jsPDF } from "jspdf";
import "svg2pdf.js";

const VIEW_MODES = ["Day", "Week", "Month"];

const OVERALL_VIEW_OPTIONS = [
  { value: "all-projects-gantt", label: "All Projects Gantt" },
  { value: "commitments", label: "Commitments" },
];

const PROGRESS_MAP = {
  completed: 100,
  in_progress: 50,
  pending: 0,
};

export default function OverallStatus() {
  const ganttRef = useRef(null);
  const ganttInstance = useRef(null);
  const [viewMode, setViewMode] = useState("Month");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomers, setSelectedCustomers] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [publishedTime, setPublishedTime] = useState(null);
  const [selectedView, setSelectedView] = useState("all-projects-gantt");

  useEffect(() => {
    fetch("/dashboard-api/gantt")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setSelectedCustomers(new Set(d.map((c) => c.customer_code ?? "__NONE__")));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    fetch("/dashboard-api/published-time")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.published_time) setPublishedTime(d.published_time); })
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const customerList = useMemo(() => {
    if (!data) return [];
    return data.map((c) => ({
      code: c.customer_code ?? "__NONE__",
      label: c.customer_description || "No Customer",
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data || !selectedCustomers) return [];
    return data.filter((c) => selectedCustomers.has(c.customer_code ?? "__NONE__"));
  }, [data, selectedCustomers]);

  function toggleCustomer(code) {
    setSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectAll() {
    setSelectedCustomers(new Set(customerList.map((c) => c.code)));
  }

  function selectNone() {
    setSelectedCustomers(new Set());
  }

  useEffect(() => {
    if (!filteredData.length || !ganttRef.current) {
      if (ganttRef.current) ganttRef.current.innerHTML = "";
      return;
    }

    const tasks = [];
    const colorMap = {};

    for (const customer of filteredData) {
      for (const project of customer.projects) {
        for (const drop of project.drops) {
          if (!drop.start_date || !drop.end_date) continue;
          const id = `${project.project_id}-drop-${drop.drop_number}`;
          tasks.push({
            id,
            name: `${project.project_name} - Drop ${drop.drop_number}`,
            start: drop.start_date,
            end: drop.end_date,
            progress: PROGRESS_MAP[drop.status] ?? 0,
          });
          colorMap[id] = project.color;
        }
      }
    }

    if (tasks.length === 0) {
      ganttRef.current.innerHTML = "";
      return;
    }

    ganttRef.current.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ganttRef.current.appendChild(svg);

    ganttInstance.current = new Gantt(svg, tasks, {
      view_mode: viewMode,
      date_format: "YYYY-MM-DD",
      popup_trigger: "mouseover",
      on_click: () => {},
      on_date_change: () => {},
      on_progress_change: () => {},
      on_view_change: () => {},
    });

    // Apply project colors after render
    requestAnimationFrame(() => {
      for (const [id, color] of Object.entries(colorMap)) {
        if (!color) continue;
        const safeId = CSS.escape(id);
        const bars = ganttRef.current.querySelectorAll(
          `.bar-wrapper[data-id="${safeId}"] .bar-progress, .bar-wrapper[data-id="${safeId}"] .bar`
        );
        bars.forEach((el) => (el.style.fill = color));
      }
    });
  }, [filteredData, viewMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Link
          to="/development"
          className="text-blue-600 hover:underline text-sm mb-4 inline-block"
        >
          &larr; Development Status
        </Link>
        <h1 className="text-2xl font-bold mb-4">Overall Status</h1>
        <p className="text-red-600">Failed to load Gantt data: {error}</p>
      </div>
    );
  }

  async function exportPDF() {
    const svg = ganttRef.current?.querySelector("svg");
    if (!svg) return;

    // Clone SVG so we can inline styles without affecting the live DOM
    const clone = svg.cloneNode(true);
    document.body.appendChild(clone);
    clone.style.position = "absolute";
    clone.style.left = "-9999px";

    // Inline computed styles from the original onto the clone
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

    // Add white background as first child
    const bbox = svg.getBBox();
    const width = Math.max(svg.viewBox?.baseVal?.width || 0, svg.scrollWidth || 0, bbox.width + bbox.x);
    const height = Math.max(svg.viewBox?.baseVal?.height || 0, svg.scrollHeight || 0, bbox.height + bbox.y);
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", width);
    bg.setAttribute("height", height);
    bg.setAttribute("fill", "#ffffff");
    clone.insertBefore(bg, clone.firstChild);

    const pdf = new jsPDF({
      orientation: width > height ? "landscape" : "portrait",
      unit: "px",
      format: [width, height],
    });
    await pdf.svg(clone, { x: 0, y: 0, width, height });
    pdf.save("gantt-overall-status.pdf");

    document.body.removeChild(clone);
  }

  const hasTasks =
    data &&
    data.some((c) =>
      c.projects.some((p) =>
        p.drops.some((d) => d.start_date && d.end_date)
      )
    );

  return (
    <div>
      <Link
        to="/development"
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        &larr; Development Status
      </Link>
      <h1 className="text-2xl font-bold mb-4">
        Overall Status{publishedTime ? ` (Published ${new Date(publishedTime).toLocaleString()})` : ""}
      </h1>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
        <select
          value={selectedView}
          onChange={(e) => setSelectedView(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm min-w-[200px]"
        >
          {OVERALL_VIEW_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {selectedView === "all-projects-gantt" && (
        <>
          {!hasTasks ? (
            <p className="text-gray-500">No project drops found.</p>
          ) : (
            <>
              <div className="flex gap-2 mb-4 items-center flex-wrap">
                {VIEW_MODES.map((mode) => (
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
                <div className="relative" ref={filterRef}>
                  <button
                    onClick={() => setFilterOpen((v) => !v)}
                    className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Customers ({selectedCustomers?.size ?? 0}/{customerList.length}) ▾
                  </button>
                  {filterOpen && (
                    <div className="absolute z-20 mt-1 bg-white border rounded shadow-lg w-64 max-h-72 overflow-y-auto">
                      <div className="flex gap-2 px-3 py-2 border-b">
                        <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                          Select All
                        </button>
                        <button onClick={selectNone} className="text-xs text-blue-600 hover:underline">
                          Select None
                        </button>
                      </div>
                      {customerList.map((c) => (
                        <label
                          key={c.code}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCustomers?.has(c.code) ?? false}
                            onChange={() => toggleCustomer(c.code)}
                            className="rounded"
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  )}
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
              <div className="overflow-x-auto border rounded">
                <div ref={ganttRef} />
              </div>
            </>
          )}
        </>
      )}

      {selectedView === "commitments" && (
        <p className="text-gray-500">Coming soon.</p>
      )}
    </div>
  );
}
