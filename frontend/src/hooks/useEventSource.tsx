import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';

export type EventType = 'rcHead' | 'ahHead' | 'rcXcmMessageCounter' | 'ahXcmMessageCounter' | 'rcStageUpdate' | 'ahStageUpdate' | 'dmpLatency' | 'dmpQueueEvent' | 'dmpMetrics' | 'umpLatency' | 'umpMetrics' | 'umpQueueEvent' | 'palletMigrationUpdate' | 'palletMigrationSummary';

interface EventSourceContextType {
  subscribe: (events: EventType[], callback: (eventType: EventType, data: any) => void) => () => void;
  isConnected: boolean;
  error: string | null;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  reconnect: () => void;
}

const EventSourceContext = createContext<EventSourceContextType | null>(null);

interface EventSourceProviderProps {
  children: React.ReactNode;
  initialBackendUrl?: string;
}

// Get initial backend URL - checks query param first, then defaults
const getInitialBackendUrl = () => {
  // Check for query parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const backendUrlParam = urlParams.get('backend_url');
  
  if (backendUrlParam) {
    return backendUrlParam;
  }
  
  // Existing fallback logic
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8080';
  }
  // In production, use relative URL by default
  return '';
};

export const EventSourceProvider: React.FC<EventSourceProviderProps> = ({ 
  children, 
  initialBackendUrl 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [backendUrl, setBackendUrlState] = useState(initialBackendUrl || getInitialBackendUrl());
  const listeners = useMemo(() => new Map<EventType, Set<(data: any) => void>>(), []);
  
  // Use ref to track current eventSource to avoid circular dependency
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback((url: string) => {
    clearReconnectTimeout();
    
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError('Max reconnection attempts reached');
      return;
    }

    const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
    console.log(`Scheduling reconnection attempt ${reconnectAttemptsRef.current + 1} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      createEventSource(url);
    }, delay);
  }, [clearReconnectTimeout]);

  const createEventSource = useCallback((url: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const allEventTypes: EventType[] = ['rcHead', 'ahHead', 'rcXcmMessageCounter', 'ahXcmMessageCounter', 'rcStageUpdate', 'ahStageUpdate', 'dmpLatency', 'dmpQueueEvent', 'dmpMetrics', 'umpLatency', 'umpMetrics', 'umpQueueEvent', 'palletMigrationUpdate', 'palletMigrationSummary'];
    const apiUrl = url ? `${url}/api/updates` : '/api/updates';
    const es = new EventSource(`${apiUrl}?events=${allEventTypes.join(',')}`);
    
    eventSourceRef.current = es;
    setEventSource(es);
    setIsConnected(false);
    setError(null);

    es.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      if (data.connected) {
        setIsConnected(true);
        setError(null);
        // Reset reconnect attempts on successful connection
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
      }
    });

    // Set up listeners for all event types
    allEventTypes.forEach(eventType => {
      es.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventListeners = listeners.get(eventType);
          if (eventListeners) {
            eventListeners.forEach(listener => listener(data));
          }
        } catch (err) {
          console.error(`Error parsing ${eventType} event:`, err);
        }
      });
    });

    es.onerror = (err) => {
      console.error('SSE Error:', err);
      setError('Connection error');
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;
      setEventSource(null);
      
      // Schedule automatic reconnection
      scheduleReconnect(url);
    };

    return es;
  }, [listeners, scheduleReconnect, clearReconnectTimeout]);

  // Initialize EventSource connection
  useEffect(() => {
    const es = createEventSource(backendUrl);
    
    return () => {
      clearReconnectTimeout();
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, [backendUrl, createEventSource, clearReconnectTimeout]);

  const setBackendUrl = useCallback((url: string) => {
    // Clear any pending reconnection attempts when URL changes
    clearReconnectTimeout();
    reconnectAttemptsRef.current = 0;
    setBackendUrlState(url);
  }, [clearReconnectTimeout]);

  const reconnect = useCallback(() => {
    // Reset reconnect attempts for manual reconnection
    reconnectAttemptsRef.current = 0;
    clearReconnectTimeout();
    createEventSource(backendUrl);
  }, [backendUrl, createEventSource, clearReconnectTimeout]);

  const subscribe = useCallback((events: EventType[], callback: (eventType: EventType, data: any) => void) => {
    // Add the callback to listeners for each event type
    events.forEach(eventType => {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, new Set());
      }
      listeners.get(eventType)?.add((data) => callback(eventType, data));
    });

    // Return cleanup function
    return () => {
      events.forEach(eventType => {
        const eventListeners = listeners.get(eventType);
        if (eventListeners) {
          eventListeners.forEach(listener => {
            if (listener.toString() === ((data: any) => callback(eventType, data)).toString()) {
              eventListeners.delete(listener);
            }
          });
          if (eventListeners.size === 0) {
            listeners.delete(eventType);
          }
        }
      });
    };
  }, [listeners]);

  const contextValue = useMemo(() => ({
    subscribe,
    isConnected,
    error,
    backendUrl,
    setBackendUrl,
    reconnect,
  }), [subscribe, isConnected, error, backendUrl, setBackendUrl, reconnect]);

  return (
    <EventSourceContext.Provider value={contextValue}>
      {children}
    </EventSourceContext.Provider>
  );
};

export const useEventSource = (events: EventType[], onEvent: (eventType: EventType, data: any) => void) => {
  const context = useContext(EventSourceContext);
  if (!context) {
    throw new Error('useEventSource must be used within an EventSourceProvider');
  }

  // Use ref to store the latest callback to avoid infinite re-renders
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    return context.subscribe(events, (eventType, data) => {
      onEventRef.current(eventType, data);
    });
  }, [events.join(','), context.subscribe]);

  return {
    isConnected: context.isConnected,
    error: context.error,
  };
};

export const useBackendUrl = () => {
  const context = useContext(EventSourceContext);
  if (!context) {
    throw new Error('useBackendUrl must be used within an EventSourceProvider');
  }

  return {
    backendUrl: context.backendUrl,
    setBackendUrl: context.setBackendUrl,
    isConnected: context.isConnected,
    reconnect: context.reconnect,
  };
}; 