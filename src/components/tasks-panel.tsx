"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "in_progress" | "in_review" | "approved" | "blocked" | "completed";
  due_date?: string;
  assignee_id?: string;
}

const PRIORITY_COLORS = {
  low:      "text-[#94A3B8] bg-[#94A3B8]/10",
  medium:   "text-[#F59E0B] bg-[#F59E0B]/10",
  high:     "text-[#EF4444] bg-[#EF4444]/10",
  critical: "text-[#EF4444] bg-[#EF4444]/20 font-semibold",
};

const STATUS_COLORS = {
  todo:        "text-text-secondary bg-white/5",
  in_progress: "text-[#F59E0B] bg-[#F59E0B]/10",
  in_review:   "text-[#3B82F6] bg-[#3B82F6]/10",
  approved:    "text-[#10B981] bg-[#10B981]/10",
  blocked:     "text-[#EF4444] bg-[#EF4444]/10",
  completed:   "text-[#10B981] bg-[#10B981]/10",
};

export function TasksPanel({ tenderId }: { tenderId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  async function fetchTasks() {
    const res = await fetch(`/api/tenders/${tenderId}/tasks`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchTasks(); }, [tenderId]);

  async function addTask() {
    if (!newTitle.trim()) return;
    setAdding(true);
    await fetch(`/api/tenders/${tenderId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, priority: "medium", status: "todo" }),
    });
    setNewTitle("");
    setAdding(false);
    fetchTasks();
  }

  async function updateStatus(taskId: string, status: Task["status"]) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
  }

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-card" />;

  return (
    <div className="flex flex-col gap-4">
      {/* Add task */}
      <div className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a task… (press Enter)"
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-[14px] text-text placeholder:text-text-secondary outline-none focus:border-brand/50 transition-colors"
        />
        <button
          onClick={addTask}
          disabled={adding}
          className="rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Add
        </button>
      </div>

      {/* Task list */}
      <AnimatePresence>
        {tasks.length === 0 ? (
          <p className="text-[14px] text-text-secondary text-center py-8">
            No tasks yet. Add tasks to track submission work.
          </p>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.04 } } }}
            className="flex flex-col gap-2"
          >
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                {/* Checkbox */}
                <button
                  onClick={() => updateStatus(task.id, task.status === "completed" ? "todo" : "completed")}
                  className={`h-4 w-4 shrink-0 rounded border transition-colors ${task.status === "completed" ? "bg-brand border-brand" : "border-border hover:border-brand/50"}`}
                />
                <span className={`flex-1 text-[14px] ${task.status === "completed" ? "line-through text-text-secondary" : "text-text"}`}>
                  {task.title}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority}
                </span>
                <select
                  value={task.status}
                  onChange={(e) => updateStatus(task.id, e.target.value as Task["status"])}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase border-0 outline-none cursor-pointer ${STATUS_COLORS[task.status]} bg-transparent`}
                >
                  {Object.keys(STATUS_COLORS).map((s) => (
                    <option key={s} value={s} className="bg-surface text-text normal-case">
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
