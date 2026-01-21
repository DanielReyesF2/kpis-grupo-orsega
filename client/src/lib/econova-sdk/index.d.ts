import * as react_jsx_runtime from 'react/jsx-runtime';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
}
interface ChatConfig {
    /** API key for authentication (Bearer token) */
    apiKey?: string;
    /** Base URL of the API (default: https://api.econova.ai) */
    baseUrl?: string;
    /** Custom endpoint path (default: /chat) */
    endpoint?: string;
    /** Custom headers to include in requests */
    headers?: Record<string, string>;
    /** Field name for the question in request body (default: message) */
    questionField?: string;
    /** Field name for the answer in response (default: response) */
    answerField?: string;
}

interface EcoNovaChatProps extends ChatConfig {
    theme?: 'light' | 'dark';
    placeholder?: string;
    welcomeMessage?: string;
    className?: string;
}
declare function EcoNovaChat({ apiKey, baseUrl, theme, placeholder, welcomeMessage, className, }: EcoNovaChatProps): react_jsx_runtime.JSX.Element;

declare function useChat(config: ChatConfig): {
    messages: Message[];
    sendMessage: (content: string) => Promise<void>;
    isLoading: boolean;
    error: Error | null;
    conversationId: string | null;
    clearMessages: () => void;
};

declare class EcoNovaClient {
    private apiKey?;
    private baseUrl;
    private endpoint;
    private headers;
    private questionField;
    private answerField;
    constructor(config: ChatConfig);
    sendMessage(message: string, conversationId?: string): Promise<{
        response: any;
        conversationId: any;
        data: any;
        source: any;
    }>;
}

export { type ChatConfig, EcoNovaChat, EcoNovaClient, type Message, useChat };
