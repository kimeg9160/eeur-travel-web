"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CheckItem } from "@/lib/types";

const CATEGORIES = ["준비물", "서류/카드", "짐싸기"];

export default function ChecklistPage() {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("준비물");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("checklist")
      .select("*")
      .eq("trip_id", 1)
      .order("sort_order");
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item: CheckItem) => {
    await supabase
      .from("checklist")
      .update({ is_done: item.is_done ? 0 : 1 })
      .eq("id", item.id);
    load();
  };

  const remove = async (id: number) => {
    await supabase.from("checklist").delete().eq("id", id);
    load();
  };

  const addItem = async () => {
    const text = newText.trim();
    if (!text) return;
    const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0;
    await supabase.from("checklist").insert({
      trip_id: 1,
      text,
      category: newCategory,
      is_done: 0,
      sort_order: maxOrder + 1,
    });
    setNewText("");
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  const uncategorized = items.filter((i) => !CATEGORIES.includes(i.category));
  if (uncategorized.length > 0) {
    grouped.push({ category: "기타", items: uncategorized });
  }

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.is_done).length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">체크리스트</h1>

      {/* 진행률 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-600">
            준비 진행률: {doneCount}/{totalCount}
          </span>
          <span className="text-sm font-bold bg-gradient-to-r from-indigo-500 to-blue-500 bg-clip-text text-transparent">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 항목 추가 */}
      <div className="card p-4">
        <div className="flex gap-2 flex-wrap">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="새 항목 입력..."
            className="flex-1 min-w-[200px] px-3 py-2.5 bg-slate-50 rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            onClick={addItem}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="space-y-3">
        {grouped.map((group) => (
          <div
            key={group.category}
            className="card overflow-hidden"
          >
            <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-600">
                {group.category}
                <span className="ml-2 text-[11px] text-slate-300 font-normal">
                  {group.items.filter((i) => i.is_done).length}/{group.items.length}
                </span>
              </h3>
            </div>
            <ul>
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-b-0 group hover:bg-slate-50/50 transition-colors"
                >
                  <button
                    onClick={() => toggle(item)}
                    className={`flex-shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                      item.is_done
                        ? "bg-gradient-to-r from-indigo-500 to-blue-500 border-transparent"
                        : "border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    {item.is_done ? <Check size={12} className="text-white" /> : null}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      item.is_done ? "line-through text-slate-300" : "text-slate-700"
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => remove(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
