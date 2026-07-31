import { useState } from "react";

export type DeleteScope = "single" | "future" | "all";

interface Props {
  onConfirm: (scope: DeleteScope) => void;
  onCancel: () => void;
}

const OPTIONS: { value: DeleteScope; label: string }[] = [
  { value: "single", label: "Tylko ten termin" },
  { value: "future", label: "Ten i wszystkie przyszłe terminy" },
  { value: "all", label: "Wszystkie terminy w serii (od dzisiaj)" },
];

// Same visual chrome as ConfirmModal, extended with a scope choice for
// deleting an occurrence that belongs to a recurring series.
export function SeriesDeleteScopeModal({ onConfirm, onCancel }: Props) {
  const [scope, setScope] = useState<DeleteScope>("single");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-sm font-medium text-gray-900 mb-3">Ten termin należy do serii cyklicznej. Co usunąć?</p>
        <div className="space-y-2 mb-6">
          {OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="radio"
                name="delete_scope_choice"
                value={opt.value}
                checked={scope === opt.value}
                onChange={() => setScope(opt.value)}
                className="text-red-600 focus:ring-red-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-4">Operacja jest nieodwracalna. Terminy z przeszłości nigdy nie są usuwane.</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => onConfirm(scope)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}
