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

  if (loading) return <div className="text-slate-400 p-4 md:p-8">로딩 중...</div>;

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
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">체크리스트</h2>

      {/* 진행률 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">
            준비 진행률: {doneCount}/{totalCount}
          </span>
          <span className="text-sm font-bold text-blue-600">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 항목 추가 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-2 flex-wrap">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
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
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addItem}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="space-y-4">
        {grouped.map((group) => (
          <div
            key={group.category}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600">
                {group.category}
                <span className="ml-2 text-xs text-slate-400 font-normal">
                  {group.items.filter((i) => i.is_done).length}/{group.items.length}
                </span>
              </h3>
            </div>
            <ul>
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-b-0 group hover:bg-slate-50 transition-colors"
                >
                  <button
                    onClick={() => toggle(item)}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      item.is_done
                        ? "bg-blue-600 border-blue-600"
                        : "border-slate-300 hover:border-blue-400"
                    }`}
                  >
                    {item.is_done ? <Check size={14} className="text-white" /> : null}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      item.is_done ? "line-through text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => remove(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
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
