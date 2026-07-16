import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { getTasks, getTaskRating } from '../services/authService';

const RatingContext = createContext();

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function RatingProvider({ children }) {
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const checkedRef = useRef(new Set());

  const triggerRating = useCallback((taskId) => {
    if (checkedRef.current.has(taskId)) return;
    setPendingTaskId(taskId);
  }, []);

  const dismissRating = useCallback(() => {
    setPendingTaskId((current) => {
      if (current) checkedRef.current.add(current);
      return null;
    });
  }, []);

  const markChecked = useCallback((taskId) => {
    checkedRef.current.add(taskId);
  }, []);

  // Single 60s tick — both rating check + unread count
  useEffect(() => {
    const tick = async () => {
      try {
        // 1) Check for unrated completed tasks
        const tasks = await getTasks();
        if (Array.isArray(tasks)) {
          const completed = tasks
            .filter(t => t.status === 'COMPLETED' && t.completed_at)
            .filter(t => Date.now() - new Date(t.completed_at).getTime() < TWENTY_FOUR_HOURS)
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

          if (completed.length > 0) {
            const newest = completed[0];
            if (!checkedRef.current.has(newest.id)) {
              const rating = await getTaskRating(newest.id);
              if (rating?.rated === false) {
                triggerRating(newest.id);
              } else {
                markChecked(newest.id);
              }
            }
          }
        }
      } catch { /* silently ignored */ }

    };

    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [triggerRating, markChecked]);

  return (
    <RatingContext.Provider value={{ pendingTaskId, triggerRating, dismissRating }}>
      {children}
    </RatingContext.Provider>
  );
}

export const useRating = () => useContext(RatingContext);
