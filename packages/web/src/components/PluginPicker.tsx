import { PLUGIN_CATALOG } from "../plugins/host";
import { usePlugins } from "../plugins/PluginContext";

export function PluginPicker() {
  const { activeId, setActiveId, loading, error } = usePlugins();

  return (
    <div className="plugin-picker">
      <label className="plugin-picker__label">
        Skin
        <select
          className="plugin-picker__select"
          value={activeId}
          disabled={loading}
          onChange={(e) => setActiveId(e.target.value)}
        >
          {PLUGIN_CATALOG.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {error && <span className="plugin-picker__error" title={error}>⚠</span>}
    </div>
  );
}
