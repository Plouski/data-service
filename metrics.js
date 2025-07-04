const promClient = require('prom-client');

// Registre séparé pour les métriques standardisées
const register = new promClient.Registry();

// Métriques par défaut (CPU, mémoire, etc.) - VITALS obligatoires
promClient.collectDefaultMetrics({
  register,
  prefix: 'data_service_standard_'
});

// ═══════════════════════════════════════════════════════════════
// MÉTRIQUES STANDARD POUR TOUS LES MICROSERVICES (MVP)
// ═══════════════════════════════════════════════════════════════

// 1. Santé du service (OBLIGATOIRE pour Prometheus)
const serviceHealthStatus = new promClient.Gauge({
  name: 'service_health_status_standard',
  help: 'Service health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['service_name'],
  registers: [register]
});

// 2. Temps de réponse HTTP (PERFORMANCE)
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds_standard',
  help: 'HTTP request duration in seconds (standardized)',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// 3. Nombre total de requêtes (CHARGE)
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total_standard',
  help: 'Total number of HTTP requests (standardized)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// 4. Connexions actives (CHARGE)
const activeConnections = new promClient.Gauge({
  name: 'active_connections_standard',
  help: 'Number of active connections (standardized)',
  registers: [register]
});

// 5. Status base de données (DÉPENDANCES)
const databaseStatus = new promClient.Gauge({
  name: 'database_status_standard',
  help: 'Database connection status (1 = connected, 0 = disconnected)',
  labelNames: ['database_type'],
  registers: [register]
});

// 6. Services externes (DÉPENDANCES)
const externalServiceHealth = new promClient.Gauge({
  name: 'external_service_health_standard',
  help: 'External service health (1 = healthy, 0 = unhealthy)',
  labelNames: ['service_name'],
  registers: [register]
});

// ═══════════════════════════════════════════════════════════════
// HELPERS SIMPLES POUR LE MVP
// ═══════════════════════════════════════════════════════════════

// Helper pour mettre à jour la santé du service
function updateServiceHealth(serviceName, isHealthy) {
  serviceHealthStatus.set({ service_name: serviceName }, isHealthy ? 1 : 0);
}

// Helper pour mettre à jour la DB
function updateDatabaseHealth(dbType, isConnected) {
  databaseStatus.set({ database_type: dbType }, isConnected ? 1 : 0);
}

// Helper pour les services externes
function updateExternalServiceHealth(serviceName, isHealthy) {
  externalServiceHealth.set({ service_name: serviceName }, isHealthy ? 1 : 0);
}

// Helper pour les connexions actives
function updateActiveConnections(count) {
  activeConnections.set(count);
}

module.exports = {
  register,
  serviceHealthStatus,
  httpRequestDuration,
  httpRequestsTotal,
  activeConnections,
  databaseStatus,
  externalServiceHealth,
  // Helpers
  updateServiceHealth,
  updateDatabaseHealth,
  updateExternalServiceHealth,
  updateActiveConnections
};