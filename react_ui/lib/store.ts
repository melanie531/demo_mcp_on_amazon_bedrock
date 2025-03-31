import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ContentItem = {
  type: string;
  text?: string;
  image_url?: {
    url: string;
    detail?: string;
  };
  file?: {
    file_id?: string;
    file_data?: string;
    filename?: string;
  };
}

export type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentItem[]
  thinking?: string
  toolUse?: any[]
}

export type Model = {
  modelName: string
  modelId: string
}

export type McpServer = {
  serverName: string
  serverId: string
  enabled: boolean
}

interface ChatStore {
  // Messages
  messages: Message[]
  addMessage: (message: Message) => void
  updateLastMessage: (content: string | ContentItem[], thinking?: string, toolUse?: any[]) => void
  clearMessages: () => void
  
  // Settings
  systemPrompt: string
  setSystemPrompt: (prompt: string) => void
  maxTokens: number
  setMaxTokens: (tokens: number) => void
  temperature: number
  setTemperature: (temp: number) => void
  enableThinking: boolean
  setEnableThinking: (enabled: boolean) => void
  enableStream: boolean
  setEnableStream: (enabled: boolean) => void
  budgetTokens: number
  setBudgetTokens: (tokens: number) => void
  onlyNMostRecentImages: number
  setOnlyNMostRecentImages: (count: number) => void
  
  // Models
  models: Model[]
  setModels: (models: Model[]) => void
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  
  // MCP Servers
  mcpServers: McpServer[]
  setMcpServers: (servers: McpServer[]) => void
  toggleServerEnabled: (serverId: string) => void
  addMcpServer: (server: McpServer) => void
  removeMcpServer: (serverId: string) => void
  
  // User
  userId: string
  setUserId: (id: string) => void
}

export const useStore = create<ChatStore>()(
  persist(
    (set) => ({
      // Messages
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      updateLastMessage: (content, thinking, toolUse) => set((state) => {
        const messages = [...state.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          messages[messages.length - 1] = {
            ...lastMessage,
            content,
            ...(thinking !== undefined && { thinking }),
            ...(toolUse !== undefined && { toolUse })
          }
        }
        return { messages }
      }),
      clearMessages: () => set((state) => ({ 
        messages: [{ role: 'system', content: state.systemPrompt }] 
      })),
      
      // Settings
      systemPrompt: 'You are a helpful assistant.',
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      maxTokens: 4000,
      setMaxTokens: (tokens) => set({ maxTokens: tokens }),
      temperature: 0.7,
      setTemperature: (temp) => set({ temperature: temp }),
      enableThinking: false,
      setEnableThinking: (enabled) => set({ enableThinking: enabled }),
      enableStream: true,
      setEnableStream: (enabled) => set({ enableStream: enabled }),
      budgetTokens: 8192,
      setBudgetTokens: (tokens) => set({ budgetTokens: tokens }),
      onlyNMostRecentImages: 1,
      setOnlyNMostRecentImages: (count) => set({ onlyNMostRecentImages: count }),
      
      // Models
      models: [],
      setModels: (models) => set({ models }),
      selectedModel: '',
      setSelectedModel: (modelId) => set({ selectedModel: modelId }),
      
      // MCP Servers
      mcpServers: [],
      setMcpServers: (servers) => set({ mcpServers: servers }),
      toggleServerEnabled: (serverId) => set((state) => ({
        mcpServers: state.mcpServers.map(server => 
          server.serverId === serverId 
            ? { ...server, enabled: !server.enabled } 
            : server
        )
      })),
      addMcpServer: (server) => set((state) => ({
        mcpServers: [...state.mcpServers, server]
      })),
      removeMcpServer: (serverId) => set((state) => ({
        mcpServers: state.mcpServers.filter(server => server.serverId !== serverId)
      })),
      
      // User
      userId: '',
      setUserId: (id) => set({ userId: id })
    }),
    {
      name: 'mcp-chat-store',
      partialize: (state) => {
        // Create a copy of messages without base64 images to stay under localStorage quota
        const messagesForStorage = state.messages.map(message => {
          // Keep the message content but remove large tool use data with base64 images
          const { toolUse, ...rest } = message;
          
          // If there's no tool use data, return the message as is
          if (!toolUse) return rest;
          
          // Otherwise clean up the tool use data to remove any large base64 images
          const cleanToolUse = toolUse.map(tool => {
            // Clone the tool to avoid modifying the original
            const cleanTool = { ...tool };
            
            // Handle tool results with content array
            if (cleanTool.content) {
              cleanTool.content = cleanTool.content.map((block: any) => {
                // Remove base64 image data but keep reference that image existed
                if (block.image?.source?.base64) {
                  return {
                    ...block,
                    image: {
                      ...block.image,
                      source: { base64: "[BASE64_IMAGE_DATA_REMOVED]" }
                    }
                  };
                }
                return block;
              });
            }
            
            return cleanTool;
          });
          
          return { ...rest, toolUse: cleanToolUse };
        });
        
        // Return a filtered state object for localStorage
        return {
          ...state,
          // Only store the latest 20 messages to prevent quota issues
          messages: messagesForStorage.slice(-20)
        };
      }
    }
  )
)
