# PMOpt Dashboard Database Schema

Reference documentation for building dashboards against the PMOpt published data.

## Overview

PMOpt is a portfolio project management and scheduling tool. It maintains a local DuckDB database as its source of truth and publishes a read-only snapshot to a PostgreSQL database for reporting. All tables live in the **`pmopt`** schema.

### Publish behaviour

- Each publish performs a **full TRUNCATE + INSERT** within a single transaction -- there are no incremental updates.
- Data is completely replaced on every publish; dashboards always see the latest plan.
- The `publish_metadata` table records a timestamp and counts for each publish event.
- The DDL (`schema/dashboard_ddl.sql`) is idempotent (`CREATE ... IF NOT EXISTS`) and is executed automatically on each publish.

---

## Entity-Relationship Diagram

```
customers 1──< projects 1──< drops 1──< drop_phases
                  │
                  ├──< tasks
                  │
                  └──< milestones

resources (standalone lookup)
commitments (standalone, manually managed)
publish_metadata (standalone log)
```

---

## Tables

### `pmopt.customers`

Customer entities for grouping projects.

| Column | Type | Notes |
|--------|------|-------|
| `customer_id` | `INTEGER` PK | Stable ID from source system |
| `customer_code` | `TEXT NOT NULL` | Short code (e.g. "ACME") |
| `description` | `TEXT` | Full customer name or description |

---

### `pmopt.projects`

Portfolio projects being planned and scheduled.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | `TEXT` PK | Unique identifier (slug) |
| `project_name` | `TEXT NOT NULL` | Display name |
| `priority` | `INTEGER` | 1-100, higher = more important |
| `status` | `TEXT` | `active`, `paused`, `completed`, `archived` |
| `color` | `TEXT` | Hex color code (e.g. `#3498db`) for UI rendering |
| `start_date` | `DATE` | Project start date |
| `target_end_date` | `DATE` | Desired completion date |
| `customer_id` | `INTEGER` FK | References `customers.customer_id` (nullable) |

---

### `pmopt.resources`

Shared resource pool -- the types and counts of people available for scheduling.

| Column | Type | Notes |
|--------|------|-------|
| `resource_type` | `TEXT` PK | e.g. `developer`, `analyst`, `tester` |
| `total_count` | `INTEGER NOT NULL` | Number of people of this type |
| `hourly_cost` | `NUMERIC` | Cost per hour (for budgeting dashboards) |
| `description` | `TEXT` | Human-readable label |

---

### `pmopt.drops`

Aggregated work units within a project. A "drop" is a deliverable phase (e.g. Sprint 1, Release 2). Each project has one or more drops.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | `TEXT` PK | References `projects.project_id` |
| `drop_number` | `INTEGER` PK | Sequential within project (1, 2, 3...) |
| `total_tasks` | `INTEGER` | Number of tasks in this drop |
| `work_hours_by_resource` | `JSONB` | Hours keyed by resource type, e.g. `{"developer": 80, "tester": 40}` |
| `computed_duration` | `INTEGER` | Duration in work hours |
| `start_work_hour` | `INTEGER` | Absolute work-hour offset from project start |
| `end_work_hour` | `INTEGER` | Absolute work-hour offset from project start |
| `start_date` | `DATE` | Computed calendar start date |
| `end_date` | `DATE` | Computed calendar end date |
| `status` | `TEXT` | `pending`, `in_progress`, `completed` |
| `comment` | `TEXT` | Free-text note on the drop |

---

### `pmopt.tasks`

Individual scheduled tasks. Each task belongs to a project and a drop.

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | `TEXT` PK | References `projects.project_id` |
| `task_id` | `TEXT` PK | Unique within project |
| `task_description` | `TEXT` | What the task is |
| `estimated_duration` | `INTEGER` | Original estimate in work hours |
| `resource_type` | `TEXT` | Required resource type (e.g. `developer`) |
| `assigned_resource` | `TEXT` | Specific resource name if assigned |
| `start_work_hour` | `INTEGER` | Absolute work-hour offset from project start |
| `end_work_hour` | `INTEGER` | Absolute work-hour offset from project start |
| `start_date` | `DATE` | Computed calendar start date |
| `end_date` | `DATE` | Computed calendar end date |
| `drop_number` | `INTEGER` | Which drop this task belongs to |
| `status` | `TEXT` | `pending`, `in_progress`, `completed` |
| `remaining_hours` | `INTEGER` | Hours remaining (null = use estimated_duration) |
| `baseline_start_date` | `DATE` | Baseline snapshot start (null if not baselined) |
| `baseline_end_date` | `DATE` | Baseline snapshot end (null if not baselined) |
| `jira_key` | `TEXT` | Linked Jira issue key (e.g. `PROJ-123`) |
| `prerequisite_task_ids` | `JSONB` | Array of task_id strings this task depends on, e.g. `["task-1", "task-2"]` |

---

### `pmopt.milestones`

Key dates and deadlines tied to projects.

| Column | Type | Notes |
|--------|------|-------|
| `milestone_id` | `INTEGER` PK | Stable ID from source |
| `project_id` | `TEXT` FK | References `projects.project_id` (nullable for portfolio-level milestones) |
| `name` | `TEXT NOT NULL` | Milestone name |
| `target_date` | `DATE` | Due date |
| `constraint_type` | `TEXT` | `hard` (must meet) or `soft` (goal) |
| `linked_task_ids` | `JSONB` | Array of task_id strings, e.g. `["task-5"]` |
| `linked_drops` | `JSONB` | Array of drop numbers, e.g. `[1, 2]` |
| `status` | `TEXT` | `pending`, `met`, `missed` |

---

### `pmopt.drop_phases`

When phase scheduling is enabled, each drop is split into sequential phases by resource type (e.g. analysis -> development -> testing).

| Column | Type | Notes |
|--------|------|-------|
| `project_id` | `TEXT` PK | References `projects.project_id` |
| `drop_number` | `INTEGER` PK | Drop within the project |
| `resource_type` | `TEXT` PK | The resource type for this phase |
| `phase_order` | `INTEGER` | Execution order (0, 1, 2...) |
| `work_hours` | `NUMERIC` | Total work hours in this phase |
| `resource_count` | `INTEGER` | Number of resources assigned |
| `computed_duration` | `INTEGER` | Phase duration in work hours |
| `start_work_hour` | `INTEGER` | Absolute work-hour offset |
| `end_work_hour` | `INTEGER` | Absolute work-hour offset |
| `start_date` | `DATE` | Computed calendar start date |
| `end_date` | `DATE` | Computed calendar end date |

---

### `pmopt.commitments`

Manually managed resource commitments — external project obligations that consume resource capacity during specific date ranges.

| Column | Type | Notes |
|--------|------|-------|
| `commitment_id` | `INTEGER` PK | Stable identifier |
| `description` | `TEXT NOT NULL` | Commitment name (e.g. "B&Q Project Janus Go Live") |
| `resource_type` | `TEXT NOT NULL` | Resource type consumed (e.g. `developer-Java`) |
| `start_date` | `DATE NOT NULL` | When the commitment begins |
| `end_date` | `DATE NOT NULL` | When the commitment ends |
| `resource_count` | `INTEGER NOT NULL` | Number of resources committed |
| `color` | `TEXT` | Hex color for UI rendering (nullable) |

> **Note:** This table is not published by PMOpt — it is managed independently via direct SQL inserts.

---

### `pmopt.publish_metadata`

Audit log of publish events. A new row is inserted on every publish.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `SERIAL` PK | Auto-incrementing |
| `published_at` | `TIMESTAMPTZ` | When the publish occurred |
| `project_count` | `INTEGER` | Number of projects published |
| `task_count` | `INTEGER` | Number of tasks published |

---

## Indexes

| Index | Table | Columns |
|-------|-------|---------|
| `idx_pmopt_tasks_project` | `tasks` | `project_id` |
| `idx_pmopt_tasks_status` | `tasks` | `status` |
| `idx_pmopt_drops_project` | `drops` | `project_id` |
| `idx_pmopt_milestones_proj` | `milestones` | `project_id` |
| `idx_pmopt_phases_drop` | `drop_phases` | `(project_id, drop_number)` |

---

## Key Concepts

### Work hours vs calendar dates

The scheduler works in **absolute work hours** from the project start date. For example, if a project starts on 2026-01-05 and a task's `start_work_hour` is 40, that means the task starts 40 work hours (5 work days) into the project.

Both `start_work_hour`/`end_work_hour` (raw scheduler output) and `start_date`/`end_date` (computed calendar dates) are published. **Use the DATE columns for dashboards** -- the work-hour columns are included for advanced analysis only.

### Drops

A "drop" is a deliverable grouping within a project -- think of it as a release, sprint, or phase. Tasks are grouped into drops, and the scheduler optimizes both drop-level and task-level ordering.

### Drop phases

When phase scheduling is enabled, a drop's work is split into sequential resource-type phases (e.g. analysis first, then development, then testing). The `drop_phases` table provides the timing for each phase within a drop.

### Baseline dates

If a project has been baselined (a schedule snapshot saved), tasks will have `baseline_start_date` and `baseline_end_date` populated. Compare these against `start_date`/`end_date` to visualise schedule variance/drift.

### Status values

- **Projects**: `active`, `paused`, `completed`, `archived`
- **Tasks**: `pending`, `in_progress`, `completed`
- **Drops**: `pending`, `in_progress`, `completed`
- **Milestones**: `pending`, `met`, `missed`

### JSONB columns

Several columns use JSONB for flexible data:

- `drops.work_hours_by_resource`: `{"developer": 80, "tester": 40}`
- `tasks.prerequisite_task_ids`: `["task-1", "task-2"]`
- `milestones.linked_task_ids`: `["task-5", "task-8"]`
- `milestones.linked_drops`: `[1, 2]`

Use PostgreSQL JSON operators to query these, e.g.:
```sql
-- Tasks requiring developers
SELECT * FROM pmopt.tasks WHERE resource_type = 'developer';

-- Drops with developer hours > 40
SELECT * FROM pmopt.drops
WHERE (work_hours_by_resource->>'developer')::numeric > 40;

-- Tasks with prerequisites
SELECT * FROM pmopt.tasks
WHERE jsonb_array_length(prerequisite_task_ids) > 0;
```

---

## Useful Queries

### Portfolio summary
```sql
SELECT
    p.project_name,
    c.customer_code,
    p.status,
    p.priority,
    p.start_date,
    p.target_end_date,
    COUNT(DISTINCT t.task_id) AS task_count,
    COUNT(DISTINCT d.drop_number) AS drop_count
FROM pmopt.projects p
LEFT JOIN pmopt.customers c ON c.customer_id = p.customer_id
LEFT JOIN pmopt.tasks t ON t.project_id = p.project_id
LEFT JOIN pmopt.drops d ON d.project_id = p.project_id
GROUP BY p.project_id, c.customer_code
ORDER BY p.priority DESC;
```

### Task completion by project
```sql
SELECT
    p.project_name,
    t.status,
    COUNT(*) AS task_count,
    SUM(t.estimated_duration) AS total_hours
FROM pmopt.tasks t
JOIN pmopt.projects p ON p.project_id = t.project_id
GROUP BY p.project_name, t.status
ORDER BY p.project_name, t.status;
```

### Schedule variance (baseline vs current)
```sql
SELECT
    p.project_name,
    t.task_id,
    t.task_description,
    t.baseline_end_date,
    t.end_date AS current_end_date,
    t.end_date - t.baseline_end_date AS slip_days
FROM pmopt.tasks t
JOIN pmopt.projects p ON p.project_id = t.project_id
WHERE t.baseline_end_date IS NOT NULL
  AND t.end_date <> t.baseline_end_date
ORDER BY slip_days DESC;
```

### Resource utilisation across projects
```sql
SELECT
    t.resource_type,
    r.total_count AS pool_size,
    COUNT(*) AS assigned_tasks,
    SUM(t.estimated_duration) AS total_hours,
    SUM(CASE WHEN t.status = 'completed' THEN t.estimated_duration ELSE 0 END) AS completed_hours
FROM pmopt.tasks t
JOIN pmopt.resources r ON r.resource_type = t.resource_type
GROUP BY t.resource_type, r.total_count;
```

### Last publish timestamp
```sql
SELECT published_at, project_count, task_count
FROM pmopt.publish_metadata
ORDER BY published_at DESC
LIMIT 1;
```

### Upcoming milestones
```sql
SELECT
    m.name,
    p.project_name,
    m.target_date,
    m.constraint_type,
    m.status
FROM pmopt.milestones m
LEFT JOIN pmopt.projects p ON p.project_id = m.project_id
WHERE m.status = 'pending'
ORDER BY m.target_date;
```
