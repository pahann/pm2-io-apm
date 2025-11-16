import { Transport } from './services/transport'
import { MetricService } from './services/metrics'
import { ActionService } from './services/actions'
import { InspectorService } from './services/inspector'
import { RuntimeStatsService } from './services/runtimeStats'

export type ServiceRegistry = {
  transport: Transport
  metrics: MetricService
  actions: ActionService
  inspector: InspectorService
  runtimeStats: RuntimeStatsService
}

const services: Map<string, Service> = new Map<string, Service>()

export class Service {}

export class ServiceManager {

  public static get<K extends string & keyof ServiceRegistry>(serviceName: K): ServiceRegistry[K] {
    return services.get(serviceName) as ServiceRegistry[K]
  }

  public static set (serviceName: string, service: Service) {
    return services.set(serviceName, service)
  }
}
