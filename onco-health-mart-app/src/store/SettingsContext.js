import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cmsApi } from '../api';

const SettingsContext = createContext({ settings: null, pages: [] });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await cmsApi.settings();
        if (alive) setSettings(s);
      } catch {
        /* ignore */
      }
      try {
        const p = await cmsApi.pages();
        if (alive) setPages(p || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => ({ settings, pages }), [settings, pages]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
