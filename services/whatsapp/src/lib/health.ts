export type HealthStatus = {
  status: "ok";
  service: "whatsapp-web";
  timestamp: string;
};

export function healthPayload(): HealthStatus {
  return {
    status: "ok",
    service: "whatsapp-web",
    timestamp: new Date().toISOString(),
  };
}
