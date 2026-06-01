import { useState, useEffect } from "react";
import { useToast } from "../hooks/useToast.tsx";
import { useItems } from "../hooks/useItems";

export default function SettingsTab() {
  const { showToast } = useToast();
  const { backupDatabase, restoreDatabase } = useItems();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [pdfPath, setPdfPath] = useState("");
  const [backupPath, setBackupPath] = useState("");
  const [restorePath, setRestorePath] = useState("");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    const savedPdfPath = localStorage.getItem("pdfSavePath") || "";
    setPdfPath(savedPdfPath);
    const savedShopName = localStorage.getItem("shopName") || "";
    setShopName(savedShopName);
    const savedShopPhone = localStorage.getItem("shopPhone") || "";
    setShopPhone(savedShopPhone);
    const savedShopAddress = localStorage.getItem("shopAddress") || "";
    setShopAddress(savedShopAddress);
  }, []);

  const handleSaveShopDetails = () => {
    localStorage.setItem("shopName", shopName);
    localStorage.setItem("shopPhone", shopPhone);
    localStorage.setItem("shopAddress", shopAddress);
    showToast("Shop details saved");
  };

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
          <h3 style={cardTitle}>Shop Details</h3>
          <p style={description}>Business details shown on invoices and in the sidebar.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <input
              type="text"
              placeholder="Shop Name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              style={input}
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              style={input}
            />
            <input
              type="text"
              placeholder="Address"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              style={input}
            />
            <div style={inputRow}>
              <span />
              <button onClick={handleSaveShopDetails} style={primaryButton}>
                Save
              </button>
            </div>
          </div>
        </div>

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

        <div style={card}>
          <h3 style={cardTitle}>Data Management</h3>
          <p style={description}>
            Backup your database to a safe location, or restore from a previous backup.
            Restore will replace all current data.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={inputRow}>
              <input
                type="text"
                placeholder="/home/user/backups/ronak_backup.db"
                value={backupPath}
                onChange={(e) => setBackupPath(e.target.value)}
                style={input}
              />
              <button
                onClick={async () => {
                  if (!backupPath.trim()) { showToast("Enter a backup path", "error"); return; }
                  try {
                    await backupDatabase(backupPath.trim());
                    showToast("Backup saved successfully");
                  } catch (e) {
                    showToast(`Backup failed: ${e}`, "error");
                  }
                }}
                style={primaryButton}
              >
                Backup
              </button>
            </div>

            <div style={inputRow}>
              <input
                type="text"
                placeholder="/home/user/backups/ronak_backup.db"
                value={restorePath}
                onChange={(e) => setRestorePath(e.target.value)}
                style={input}
              />
              <button
                onClick={async () => {
                  if (!restorePath.trim()) { showToast("Enter a restore path", "error"); return; }
                  if (!confirm("Restore will replace ALL current data. Are you sure?")) return;
                  try {
                    await restoreDatabase(restorePath.trim());
                    showToast("Database restored successfully");
                  } catch (e) {
                    showToast(`Restore failed: ${e}`, "error");
                  }
                }}
                style={{ ...primaryButton, background: "var(--color-error)" }}
              >
                Restore
              </button>
            </div>
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
  fontWeight: "700",
  color: "var(--color-text)",
  letterSpacing: "-0.01em",
};

const settingsGrid: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
};

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-8)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
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
  gap: "var(--space-4)",
};

const themeBtn: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-4)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  transition: "all 0.2s",
};

const themeBtnActive: React.CSSProperties = {
  background: "var(--color-primary-light)",
  borderColor: "var(--color-primary)",
  color: "var(--color-primary)",
  boxShadow: "0 0 0 1px var(--color-primary)",
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
  fontWeight: "500",
};

const primaryButton: React.CSSProperties = {
  padding: "var(--space-3) var(--space-6)",
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontWeight: "700",
  fontSize: "var(--font-size-sm)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0, 102, 204, 0.2)",
};

