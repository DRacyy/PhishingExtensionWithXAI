"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Settings } from "./settings"
import { History } from "./history"
import "./styles.css"

export default function ShieldScanApp() {
  const [activeTab, setActiveTab] = useState("settings")
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
  }

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo">
                <div className="logo-inner">
                  <div className="logo-dot"></div>
                </div>
              </div>
              <h1 className="app-title">ShieldScan</h1>
            </div>

            <div className="header-actions">
              <nav className="nav">
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`nav-button ${activeTab === "settings" ? "active" : ""}`}
                >
                  Settings
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`nav-button ${activeTab === "history" ? "active" : ""}`}
                >
                  History
                </button>
              </nav>

              <button className="theme-toggle" onClick={toggleTheme}>
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === "settings" ? <Settings isDarkMode={isDarkMode} /> : <History isDarkMode={isDarkMode} />}
      </main>
    </div>
  )
}
