// src/hooks/useToasts.js
import { useState, useCallback } from "react";

let _tid = 0;

export const useToasts = () => {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, add };
};
