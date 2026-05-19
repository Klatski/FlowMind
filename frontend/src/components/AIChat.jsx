import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import * as storage from '../storage.js';

const SUGGESTED = [
  'Как изменятся резервы, если SEPA задержит транзакции на 1 день?',
  'Где у нас самый большой риск кассового разрыва в следующие 14 дней?',
  'Как лучше перераспределить ликвидность между счетами?',
  'Какой минимальный размер овердрафта закроет все разрывы на месяц?',
];

function BotAvatar() {
  return (
    <div className="chat-avatar chat-avatar-bot" title="FlowMind AI">
      <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
        <path d="M8 44 L18 30 L28 38 L40 18 L56 28" stroke="#22d3ee" strokeWidth="5"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="40" cy="18" r="5" fill="#22d3ee" />
      </svg>
    </div>
  );
}

function UserAvatar() {
  return <div className="chat-avatar chat-avatar-user">Вы</div>;
}

function Message({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-bot'}`}>
      {!isUser && <BotAvatar />}
      <div className={`chat-bubble ${isUser ? 'bubble-user' : 'bubble-bot'}`}>
        {content.split('\n').map((line, i) => (
          <span key={i}>{line}{i < content.split('\n').length - 1 && <br />}</span>
        ))}
      </div>
      {isUser && <UserAvatar />}
    </div>
  );
}

export default function AIChat({ state, onShowOnChart, proposing = false }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef(null);
  const textareaRef = useRef(null);
  const showSuggested = state.chatHistory.length <= 1;

  const lastAssistantIdx = (() => {
    for (let i = state.chatHistory.length - 1; i >= 0; i--) {
      if (state.chatHistory[i].role === 'assistant') return i;
    }
    return -1;
  })();

  function findPrecedingUserQuestion(idx) {
    for (let i = idx - 1; i >= 0; i--) {
      if (state.chatHistory[i].role === 'user') return state.chatHistory[i].content;
    }
    return '';
  }

  function messageRelatesToChart(content) {
    const keywords = [
      'график', 'диаграмм', 'кривая', 'тренд', 'динамик',
      'сценари', 'прогноз', 'изменени', 'изменится', 'измените',
      'разрыв', 'риск', 'ликвидност', 'перераспредел',
      'увеличи', 'уменьши', 'снижени', 'рост', 'упадёт', 'поднимет',
      'смоделиру', 'симуляц', 'наглядно', 'покажет', 'отобразит',
      'показател', 'баланс', 'резерв', 'задержк', 'сдвин',
    ];
    const lower = content.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [state.chatHistory, busy]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setBusy(true);
    storage.appendChat('user', q);
    const res = await api.ask(q);
    const answer = res.ok
      ? res.data.answer
      : '⚠️ Не удалось получить ответ от AI. Проверьте, что backend запущен и GEMINI_API_KEY заполнен в .env.';
    storage.appendChat('assistant', answer);
    setBusy(false);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="ai-chat-page">
      <div className="ai-chat-header">
        <div className="ai-chat-header-brand">
          <div className="brand-mark" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <div>
            <div className="ai-chat-header-title">AI Treasury Assistant</div>
            <div className="ai-chat-header-sub">на базе Gemini · знает ваши счета и формулы</div>
          </div>
        </div>
      </div>

      <div className="ai-chat-body" ref={scrollerRef}>
        {state.chatHistory.length === 0 && (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-icon">
              <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
                <path d="M8 44 L18 30 L28 38 L40 18 L56 28" stroke="#3b82f6" strokeWidth="4"
                  strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                <circle cx="40" cy="18" r="5" fill="#22d3ee" opacity="0.9" />
              </svg>
            </div>
            <div className="ai-chat-empty-title">Задайте вопрос по вашей ликвидности</div>
            <div className="ai-chat-empty-sub">
              Бот видит ваши контракты, расходы и прогноз. Спрашивайте о рисках, сценариях и оптимизации.
            </div>
          </div>
        )}

        {state.chatHistory.map((m, i) => (
          <div key={i}>
            <Message role={m.role} content={m.content} />
            {m.role === 'assistant' && i === lastAssistantIdx && !busy && onShowOnChart && messageRelatesToChart(m.content) && (
              <div className="chat-action-bar">
                <button
                  className="chat-action-btn"
                  onClick={() => onShowOnChart(findPrecedingUserQuestion(i) || m.content)}
                  disabled={proposing}
                  title="Показать AI-сценарий на графике дашборда"
                >
                  {proposing ? (
                    <>
                      <span className="ai-send-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                      AI считает сценарий…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18" />
                        <path d="M7 14l4-4 4 4 5-7" />
                      </svg>
                      Посмотреть на графике
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="chat-message chat-message-bot">
            <BotAvatar />
            <div className="chat-bubble bubble-bot chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <div className="ai-chat-footer">
        {showSuggested && (
          <div className="ai-suggested">
            {SUGGESTED.map((s) => (
              <button key={s} className="ai-suggested-pill" onClick={() => send(s)} disabled={busy}>{s}</button>
            ))}
          </div>
        )}

        <div className="ai-input-row">
          <textarea
            ref={textareaRef}
            className="ai-textarea"
            rows={1}
            placeholder="Спросите что-нибудь… (Shift+Enter для новой строки)"
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          <button
            className="ai-send-btn"
            onClick={() => send()}
            disabled={busy || !input.trim()}
            title="Отправить"
          >
            {busy
              ? <span className="ai-send-spinner" />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9l20-7z" />
                </svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
