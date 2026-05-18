import { useState, useEffect } from "react";
import styles from "./App.module.css";
import InventoryTab from "./components/InventoryTab";
import BillingTab from "./components/BillingTab";
import SettingsTab from "./components/SettingsTab";
import { ToastProvider } from "./hooks/useToast.tsx";

type Tab = "billing" | "inventory" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("billing");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  return (
    <ToastProvider>
      <div className={styles.app}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.wordmark}>Ronak Electricals</span>
            <span className={styles.subtitle}>Billing & Inventory</span>
          </div>
          <nav className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "billing" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("billing")}
            >
              Billing
            </button>
            <button
              className={`${styles.tab} ${activeTab === "inventory" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("inventory")}
            >
              Inventory
            </button>
            <button
              className={`${styles.tab} ${activeTab === "settings" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
          </nav>
        </aside>
        <div className={styles.mainArea}>
          <main className={styles.content}>
            {activeTab === "billing" && <BillingTab />}
            {activeTab === "inventory" && <InventoryTab />}
            {activeTab === "settings" && <SettingsTab />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;