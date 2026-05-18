import { useState, useEffect } from "react";
import { useToast } from "../hooks/useToast.tsx";

export default function SettingsTab() {
  const { showToast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [pdfPath, setPdfPath] = useState("");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    const savedPdfPath = localStorage.getItem("pdfSavePath") || "";
    setPdfPath(savedPdfPath);
  }, []);

  const handleSaveTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    showToast(`Switched to ${newTheme} mode`);
  };

  const handleSavePdfPath = () => {
    localStorage.setItem("pdfSavePath", pdfPath);
    showToast("PDF save location updated");
  };

  return (
    <div style={container}>
      <h2 style={pageTitle}>Settings</h2>

      <div style={settingsGrid}>
        <div style={card}>
          <h3 style={cardTitle}>Appearance</h3>
          <p style={description}>Choose your preferred theme for the application.</p>
          <div style={themeOptions}>
            <button
              onClick={() => handleSaveTheme("light")}
              style={{
                ...themeBtn,
                ...(theme === "light" ? themeBtnActive : {}),
              }}
            >
              Light Mode
            </button>
            <button
              onClick={() => handleSaveTheme("dark")}
              style={{
                ...themeBtn,
                ...(theme === "dark" ? themeBtnActive : {}),
              }}
            >
              Dark Mode
            </button>
          </div>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>PDF Export</h3>
          <p style={description}>
            Set a default directory to save invoices directly. Leave empty to use the standard download dialog.
          </p>
          <div style={inputRow}>
            <input
              type="text"
              placeholder="C:\Users\Name\Desktop\Invoices"
              value={pdfPath}
              onChange={(e) => setPdfPath(e.target.value)}
              style={input}
            />
            <button onClick={handleSavePdfPath} style={primaryButton}>
              Save Path
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const container: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  maxWidth: "800px",
};

const pageTitle: React.CSSProperties = {
  fontSize: "var(--font-size-xl)",
  fontWeight: "600",
  color: "var(--color-text)",
};

const settingsGrid: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-6)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const cardTitle: React.CSSProperties = {
  fontSize: "var(--font-size-lg)",
  fontWeight: "600",
  color: "var(--color-text)",
};

const description: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-secondary)",
  lineHeight: 1.6,
};

const themeOptions: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
};

const themeBtn: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-4)",
  background: "var(--color-bg)",
  border: "2px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--font-size-base)",
  fontWeight: "500",
  color: "var(--color-text-secondary)",
};

const themeBtnActive: React.CSSProperties = {
  background: "var(--color-primary)",
  borderColor: "var(--color-primary)",
  color: "white",
};

const inputRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  alignItems: "center",
};

const input: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const primaryButton: React.CSSProperties = {
  padding: "var(--space-3) var(--space-6)",
  background: "var(--color-primary)",
  color: "white",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  fontSize: "var(--font-size-sm)",
};
