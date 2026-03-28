export interface Scene {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly narrationText: string;
  readonly visualDescription: string;
  readonly dialogueDirections: string;
  readonly imageUrl: string | null;
  readonly videoUrl: string | null;
  readonly audioUrl: string | null;
  readonly videoPct: number;
  readonly status:
    | "empty"
    | "scripted"
    | "imaging"
    | "filming"
    | "complete"
    | "error";
}

export interface Message {
  readonly id: string;
  readonly role: "user" | "assistant" | "tool";
  readonly content: string;
  readonly toolCall?: {
    readonly name: string;
    readonly args: Record<string, unknown>;
  };
  readonly toolResult?: {
    readonly name: string;
    readonly data: unknown;
  };
  readonly timestamp: number;
}

export interface Project {
  readonly id: string;
  readonly title: string;
  readonly scenes: readonly Scene[];
  readonly messages: readonly Message[];
}

export interface SSEEvent {
  readonly type:
    | "agent_text"
    | "tool_start"
    | "tool_progress"
    | "tool_done"
    | "agent_done"
    | "error";
  readonly [key: string]: unknown;
}
