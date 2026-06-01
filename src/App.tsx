import { useState, useEffect } from "react";
import styles from "./App.module.css";
import InventoryTab from "./components/InventoryTab";
import BillingTab from "./components/BillingTab";
import SettingsTab from "./components/SettingsTab";
import { ToastProvider } from "./hooks/useToast.tsx";
import { CartProvider } from "./hooks/useCart.tsx";

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
      <CartProvider>
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
          <header className={styles.topHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.orgBadge}>Ronak Electricals</div>
            </div>
            <div className={styles.headerRight}>
              <div className={styles.headerAction}>Getting started</div>
              <div className={styles.profileSection}>
                <div className={styles.avatar}>RE</div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>Ronak</span>
                  <span className={styles.userEmail}>admin@ronakelectricals.com</span>
                </div>
              </div>
            </div>
          </header>
          
          <main className={styles.content}>
            {activeTab === "billing" && <BillingTab />}
            {activeTab === "inventory" && <InventoryTab />}
            {activeTab === "settings" && <SettingsTab />}
          </main>
        </div>
      </div>
      </CartProvider>
    </ToastProvider>
  );
}

export default App;