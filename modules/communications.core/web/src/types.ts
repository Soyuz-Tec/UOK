export type CommunicationThread = {
  id: string;
  title: string;
  status: "open" | "closed" | "archived" | string;
  restore_status: "open" | "closed" | null;
  revision: number;
  etag: string;
  context_type: string;
  context_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  correlation_id?: string;
};

export type CommunicationCapabilities = {
  read: boolean;
  create: boolean;
  delete: boolean;
  restore: boolean;
};
