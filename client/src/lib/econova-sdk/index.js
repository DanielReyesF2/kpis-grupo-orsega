// src/components/EcoNovaChat.tsx
import { useState as useState2, useRef, useEffect } from "react";

// src/hooks/useChat.ts
import { useState, useCallback, useMemo } from "react";

// src/client.ts
var EcoNovaClient = class {
  apiKey;
  baseUrl;
  endpoint;
  headers;
  questionField;
  answerField;
  constructor(config) {
    this.apiKey = config.apiKey;
    // Use empty string for relative URLs, only default if undefined/null
    this.baseUrl = config.baseUrl !== undefined ? config.baseUrl : "";
    this.endpoint = config.endpoint || "/chat";
    this.headers = config.headers || {};
    this.questionField = config.questionField || "message";
    this.answerField = config.answerField || "response";
  }
  async sendMessage(message, conversationId) {
    const headers = {
      "Content-Type": "application/json",
      ...this.headers
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    const body = {
      [this.questionField]: message
    };
    if (conversationId) {
      body.conversationId = conversationId;
    }
    const response = await fetch(`${this.baseUrl}${this.endpoint}`, {
      method: "POST",
      headers,
      credentials: "include",
      // Include cookies for session-based auth
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return {
      response: data[this.answerField] || data.answer || data.response || data.message || "",
      conversationId: data.conversationId || conversationId,
      data: data.data,
      source: data.source
    };
  }
};

// src/hooks/useChat.ts
function useChat(config) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const client = useMemo(() => new EcoNovaClient(config), [
    config.apiKey,
    config.baseUrl,
    config.endpoint,
    config.questionField,
    config.answerField
  ]);
  const sendMessage = useCallback(async (content) => {
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: /* @__PURE__ */ new Date()
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.sendMessage(content, conversationId || void 0);
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.response,
        createdAt: /* @__PURE__ */ new Date()
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error("Unknown error");
      setError(errorMessage);
      const errorAssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Lo siento, ocurri\xF3 un error: ${errorMessage.message}`,
        createdAt: /* @__PURE__ */ new Date()
      };
      setMessages((prev) => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [client, conversationId]);
  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);
  return {
    messages,
    sendMessage,
    isLoading,
    error,
    conversationId,
    clearMessages
  };
}

// src/components/EcoNovaChat.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function EcoNovaChat({
  apiKey,
  baseUrl,
  theme = "light",
  placeholder = "Type your message...",
  welcomeMessage = "Hello! How can I help you today?",
  className = ""
}) {
  const { messages, sendMessage, isLoading, error } = useChat({ apiKey, baseUrl });
  const [input, setInput] = useState2("");
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput("");
    await sendMessage(message);
  };
  const isDark = theme === "dark";
  return /* @__PURE__ */ jsxs("div", { className: `flex flex-col h-full ${isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900"} ${className}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [
      messages.length === 0 && /* @__PURE__ */ jsx("div", { className: `text-center ${isDark ? "text-gray-400" : "text-gray-500"}`, children: welcomeMessage }),
      messages.map((msg) => /* @__PURE__ */ jsx(
        "div",
        {
          className: `flex ${msg.role === "user" ? "justify-end" : "justify-start"}`,
          children: /* @__PURE__ */ jsx(
            "div",
            {
              className: `max-w-[80%] rounded-lg px-4 py-2 ${msg.role === "user" ? "bg-blue-500 text-white" : isDark ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"}`,
              children: msg.content
            }
          )
        },
        msg.id
      )),
      isLoading && /* @__PURE__ */ jsx("div", { className: "flex justify-start", children: /* @__PURE__ */ jsx("div", { className: `rounded-lg px-4 py-2 ${isDark ? "bg-gray-800" : "bg-gray-100"}`, children: /* @__PURE__ */ jsx("span", { className: "animate-pulse", children: "Thinking..." }) }) }),
      /* @__PURE__ */ jsx("div", { ref: messagesEndRef })
    ] }),
    error && /* @__PURE__ */ jsx("div", { className: "px-4 py-2 bg-red-100 text-red-700 text-sm", children: error.message }),
    /* @__PURE__ */ jsx("form", { onSubmit: handleSubmit, className: "p-4 border-t", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: input,
          onChange: (e) => setInput(e.target.value),
          placeholder,
          disabled: isLoading,
          className: `flex-1 px-4 py-2 rounded-lg border ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"} focus:outline-none focus:ring-2 focus:ring-blue-500`
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "submit",
          disabled: isLoading || !input.trim(),
          className: "px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50",
          children: "Send"
        }
      )
    ] }) })
  ] });
}
export {
  EcoNovaChat,
  EcoNovaClient,
  useChat
};
