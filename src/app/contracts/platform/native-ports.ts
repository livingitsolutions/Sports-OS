/**
 * Native / platform capability contracts. These are application-owned
 * contracts (ADR-016): the application layer declares the capabilities it
 * needs, and adapters (web or native) implement them. They are NOT implemented
 * in this sprint — they exist to keep platform APIs behind contracts so the
 * domain and use cases never touch a browser or native API directly (R22).
 *
 * Relocated from the former `src/ports/` layer in Sprint 2: capability
 * contracts belong to the application, alongside `Clock`, `IdGenerator`, etc.
 */

export interface CameraPort {
  capturePhoto(): Promise<Blob>;
}

export interface QrScannerPort {
  scan(): Promise<string>;
}

export interface PushNotificationPort {
  register(): Promise<string>;
  send(notification: NotificationPayload): Promise<void>;
}

export interface NotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, string>;
}

export interface SecureCredentialStoragePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface BiometricsPort {
  isAvailable(): Promise<boolean>;
  verify(reason: string): Promise<boolean>;
}

export interface FileUploadPort {
  upload(file: Blob, contentType: string): Promise<string>;
}

export interface DeepLinkPort {
  open(path: string): Promise<void>;
  onOpen(listener: (path: string) => void): void;
}

export interface SharePort {
  share(payload: { title: string; text?: string; url?: string }): Promise<void>;
}

export interface LocationPort {
  current(): Promise<{ lat: number; lng: number } | null>;
}

export interface OfflineSyncPort {
  enqueue(operation: QueuedOperation): Promise<void>;
  flush(): Promise<void>;
}

export interface QueuedOperation {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
}
