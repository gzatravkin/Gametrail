import { useEffect, useRef } from 'react';
import './MessageLog.css';

interface MessageLogProps {
  messages: string[];
}

export function MessageLog({ messages }: MessageLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-log">
      <h3>📜 Журнал событий</h3>
      <div className="log-content" ref={logRef}>
        {messages.map((msg, index) => (
          <div key={index} className="log-message">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}
