import { useState, useEffect } from "react";

/* STORAGE KEYS */

const STORAGE_KEY = "myspendr_expenses_v3";
const BUDGET_KEY = "myspendr_budget_v3";
const CATEGORY_KEY = "myspendr_categories_v3";

/* DEFAULT DATE */

const today = new Date().toISOString().split("T")[0];

/* DEFAULT CATEGORIES */

const defaultCategories = [
  "Food",
  "Groceries",
  "Travel",
  "Shopping",
  "Bills",
  "Entertainment",
];

export default function App() {
  /* LOAD STORAGE SAFELY */

  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [budget, setBudget] = useState(() => {
    try {
      const saved = localStorage.getItem(BUDGET_KEY);

      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem(CATEGORY_KEY);

      return saved ? JSON.parse(saved) : defaultCategories;
    } catch {
      return defaultCategories;
    }
  });

  /* FORM STATE */

  const [amount, setAmount] = useState("");

  const [category, setCategory] = useState("Food");

  const [note, setNote] = useState("");

  const [date, setDate] = useState(today);

  const [editingId, setEditingId] = useState(null);

  /* SAVE TO STORAGE */

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, budget.toString());
  }, [budget]);

  useEffect(() => {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
  }, [categories]);

  /* FORMAT DATE */

  function formatDate(d) {
    const dt = new Date(d);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return `${String(dt.getDate()).padStart(2, "0")}-${
      months[dt.getMonth()]
    }-${String(dt.getFullYear()).slice(-2)}`;
  }

  /* RESET FORM */

  function resetForm() {
    setAmount("");
    setNote("");
    setDate(today);
    setEditingId(null);
  }

  /* SAVE EXPENSE */

  function saveExpense() {
    if (!amount) return;

    if (editingId) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? {
                ...e,
                amount: Number(amount),
                category,
                note,
                date,
              }
            : e
        )
      );
    } else {
      const newExpense = {
        id: Date.now(),

        amount: Number(amount),

        category,

        note,

        date,
      };

      setExpenses((prev) => [...prev, newExpense]);
    }

    resetForm();
  }

  /* EDIT EXPENSE */

  function editExpense(item) {
    setEditingId(item.id);

    setAmount(item.amount);

    setCategory(item.category);

    setNote(item.note);

    setDate(item.date);
  }

  /* DELETE */

  function deleteExpense(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  /* BUDGET */

  function editBudget() {
    const val = prompt("Enter Monthly Budget", budget);

    if (val !== null) {
      setBudget(Number(val));
    }
  }

  /* ADD CATEGORY */

  function addCategory() {
    const newCat = prompt("New Category Name");

    if (!newCat) return;

    if (categories.includes(newCat)) return;

    setCategories((prev) => [...prev, newCat]);
  }

  /* TOTALS */

  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const remaining = budget - spent;

  const percentUsed = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  /* CATEGORY TOTALS */

  const totals = {};

  expenses.forEach((e) => {
    if (!totals[e.category]) {
      totals[e.category] = 0;
    }

    totals[e.category] += e.amount;
  });

  const topCategory = Object.keys(totals).sort(
    (a, b) => totals[b] - totals[a]
  )[0];

  /* MONTHLY INSIGHT */

  const currentMonth = new Date().getMonth();

  const monthlyExpenses = expenses.filter((e) => {
    const d = new Date(e.date);

    return d.getMonth() === currentMonth;
  });

  const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  const expenseCount = expenses.length;

  /* CATEGORY COLORS */

  const categoryColors = {
    Food: "bg-red-100 text-red-600",

    Groceries: "bg-green-100 text-green-600",

    Travel: "bg-blue-100 text-blue-600",

    Shopping: "bg-purple-100 text-purple-600",

    Bills: "bg-yellow-100 text-yellow-600",

    Entertainment: "bg-pink-100 text-pink-600",
  };

  /* GROUP BY DATE */

  const grouped = {};

  expenses
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((e) => {
      if (!grouped[e.date]) {
        grouped[e.date] = [];
      }

      grouped[e.date].push(e);
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto">
        {/* APP TITLE */}

        <h1 className="text-3xl font-semibold text-center mb-6">My Spendr</h1>

        {/* INSIGHTS */}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs text-gray-500">This Month</div>

            <div className="text-xl font-semibold">₹{monthlyTotal}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs text-gray-500">Top Category</div>

            <div className="text-lg font-semibold">{topCategory || "—"}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs text-gray-500">Total Expenses</div>

            <div className="text-lg font-semibold">{expenseCount}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs text-gray-500">Remaining</div>

            <div className="text-lg font-semibold">₹{remaining}</div>
          </div>
        </div>

        {/* BUDGET */}

        <div className="bg-white rounded-2xl shadow p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Budget ₹{budget}</span>

            <button onClick={editBudget} className="text-indigo-600">
              Edit
            </button>
          </div>

          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              style={{
                width: `${percentUsed}%`,
              }}
            ></div>
          </div>

          <div className="flex justify-between text-xs mt-2">
            <span>Spent ₹{spent}</span>

            <span>Remaining ₹{remaining}</span>
          </div>
        </div>

        {/* FORM */}

        <div className="bg-white rounded-2xl shadow p-4 mb-6">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="border p-2 rounded-xl"
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border p-2 rounded-xl"
            >
              {categories.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2 rounded-xl w-full mb-2"
          />

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add note"
            className="border p-2 rounded-xl w-full mb-2"
          />

          <div className="flex gap-2">
            <button
              onClick={saveExpense}
              className="flex-1 bg-indigo-600 text-white rounded-xl p-2"
            >
              {editingId ? "Update Expense" : "Add Expense"}
            </button>

            <button
              onClick={addCategory}
              className="bg-gray-200 px-3 rounded-xl"
            >
              +
            </button>
          </div>
        </div>

        {/* EMPTY STATE */}

        {expenses.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-400 mb-6">
            Your spending insights will appear here
          </div>
        )}

        {/* EXPENSE LIST */}

        <div className="bg-white rounded-2xl shadow p-4">
          {Object.keys(grouped).map((dateKey) => (
            <div key={dateKey}>
              <h3 className="text-sm text-gray-500 mt-4">
                {formatDate(dateKey)}
              </h3>

              {grouped[dateKey].map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center border-b py-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          categoryColors[item.category] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.category}
                      </span>

                      <span className="font-medium">₹{item.amount}</span>
                    </div>

                    <div className="text-xs text-gray-400">{item.note}</div>
                  </div>

                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => editExpense(item)}
                      className="text-indigo-600"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteExpense(item.id)}
                      className="text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
