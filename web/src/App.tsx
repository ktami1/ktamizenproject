import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Brand, ThemeToggle, ToastProvider } from "./components/ui";
import { loadConfig, saveConfig, type Config } from "./lib/config";
import { Home } from "./screens/Home";
import { Job } from "./screens/Job";
import { Setup } from "./screens/Setup";

function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const parts = hash.replace(/^#\/?/, "").split("/");
  return { name: parts[0] || "home", arg: parts[1] };
}

export default function App() {
  const [cfg, setCfg] = useState<Config | null>(() => loadConfig());
  const route = useRoute();

  const onConfigured = (c: Config) => {
    saveConfig(c);
    setCfg(c);
    location.hash = "#/";
  };

  let screen;
  if (!cfg) screen = <Setup current={null} onDone={onConfigured} />;
  else if (route.name === "settings") screen = <Setup current={cfg} onDone={onConfigured} />;
  else if (route.name === "job" && route.arg) screen = <Job key={route.arg} cfg={cfg} id={route.arg} />;
  else screen = <Home cfg={cfg} />;

  return (
    <ToastProvider>
      <header className="topbar">
        <div className="container">
          <Brand />
          {cfg && route.name === "job" && (
            <>
              <span className="crumb">/</span>
              <a className="crumb-item" href="#/">
                Analisi
              </a>
            </>
          )}
          <span className="spacer" />
          <ThemeToggle />
          {cfg && (
            <a className="btn btn-ghost btn-icon" href="#/settings" aria-label="Impostazioni" title="Impostazioni">
              <Settings size={16} />
            </a>
          )}
        </div>
      </header>
      <main>{screen}</main>
      <footer className="footer container">Slidemine · dati cifrati end-to-end · nessun login Instagram</footer>
    </ToastProvider>
  );
}
