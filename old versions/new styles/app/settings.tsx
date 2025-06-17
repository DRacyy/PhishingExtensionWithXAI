import { Shield, Brain, Bell, RefreshCw, LogOut, User, Server, Key } from "lucide-react"

interface SettingsProps {
  isDarkMode: boolean
}

export function Settings({ isDarkMode }: SettingsProps) {
  return (
    <div className="settings-container">
      {/* Account Section */}
      <div className="card">
        <div className="card-header">
          <div className="section-title">
            <div className="icon-wrapper purple">
              <User size={20} />
            </div>
            <div>
              <h2 className="title">Account</h2>
              <p className="subtitle">Manage your account settings and sync preferences</p>
            </div>
          </div>
        </div>
        <div className="card-content">
          <div className="status-badge success">
            <div className="badge">
              <div className="status-dot"></div>
              Signed in
            </div>
            <span className="email">danieladnan33@gmail.com</span>
          </div>

          <div className="info-grid">
            <div className="info-row">
              <span className="label">Sync status:</span>
              <span className="value success">Data synced across devices</span>
            </div>
            <div className="info-row">
              <span className="label">Last sync:</span>
              <span className="value">6 minutes ago</span>
            </div>
          </div>

          <div className="button-group">
            <button className="button secondary">
              <RefreshCw size={16} />
              Sync Now
            </button>
            <button className="button danger">
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Protection Features */}
      <div className="card">
        <div className="card-header">
          <h2 className="title">
            <Shield size={24} className="title-icon" />
            Protection Features
          </h2>
          <p className="subtitle">Configure your security protection settings</p>
        </div>
        <div className="card-content">
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-info">
                <div className="icon-wrapper blue">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="feature-title">URL Analysis</h3>
                  <p className="feature-description">Check URLs against phishing databases</p>
                </div>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider"></span>
              </label>
            </div>

            <div className="feature-item">
              <div className="feature-info">
                <div className="icon-wrapper purple">
                  <Brain size={20} />
                </div>
                <div>
                  <h3 className="feature-title">ML Detection</h3>
                  <p className="feature-description">Detect phishing with machine learning</p>
                </div>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider"></span>
              </label>
            </div>

            <div className="feature-item">
              <div className="feature-info">
                <div className="icon-wrapper orange">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="feature-title">Notifications</h3>
                  <p className="feature-description">Get alerts when threats are detected</p>
                </div>
              </div>
              <label className="switch">
                <input type="checkbox" />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Behavior Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="title">Behavior</h2>
          <p className="subtitle">Customize how ShieldScan behaves</p>
        </div>
        <div className="card-content">
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input type="checkbox" defaultChecked />
              <span className="checkmark"></span>
              Automatically scan pages when loaded
            </label>
            <label className="checkbox-item">
              <input type="checkbox" defaultChecked />
              <span className="checkmark"></span>
              Show the number of blocked threats on the toolbar icon
            </label>
          </div>
        </div>
      </div>

      {/* Server Options */}
      <div className="card">
        <div className="card-header">
          <h2 className="title">
            <Server size={24} className="title-icon" />
            Server Options
          </h2>
          <p className="subtitle">Configure server connection settings</p>
        </div>
        <div className="card-content">
          <div className="form-group">
            <label className="form-label">Analysis server URL</label>
            <input type="text" className="form-input monospace" defaultValue="http://localhost:5000" />
          </div>
          <div className="form-group">
            <label className="form-label">
              <Key size={16} />
              API Key (if required)
            </label>
            <input type="password" className="form-input monospace" placeholder="Enter your API key" />
          </div>
        </div>
      </div>

      {/* Whitelist */}
      <div className="card">
        <div className="card-header">
          <h2 className="title">
            <Shield size={24} className="title-icon green" />
            Whitelist
          </h2>
          <p className="subtitle">List of websites for which no scanning will take place</p>
        </div>
        <div className="card-content">
          <div className="form-group">
            <label className="form-label">Trusted domains</label>
            <textarea
              className="form-textarea monospace"
              placeholder="Enter domain names, one per line (e.g. example.com)"
              rows={6}
            />
            <p className="form-help">
              Add trusted websites that should be excluded from scanning. Enter one domain per line.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
