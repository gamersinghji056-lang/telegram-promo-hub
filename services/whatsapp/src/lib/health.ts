export type HealthStatus = {
  status: "ok";
  service: "whatsapp-web";
};

export function healthPayload(): HealthStatus {
  return {
    status: "ok",
    service: "whatsapp-web",
  };
}
