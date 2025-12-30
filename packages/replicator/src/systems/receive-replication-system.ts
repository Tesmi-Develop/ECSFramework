import Signal from "@rbxts/signal";
import patch from "../patch";
import { RemoveTag, SyncData } from "../types";
import { ECSSystem, RunContext, RobloxInstanceComponent, SERVER_ATTRIBUTE_ENTITY_ID } from "@ecsframework/core";
import { BaseSystem } from "@ecsframework/core/out/framework/base-system";
import { ComponentKey } from "@ecsframework/core/out/framework/flamecs/registry";
import { Entity } from "@rbxts/jecs";

@ECSSystem({
	RunContext: RunContext.Client,
})
export class ReceiveReplicationSystem extends BaseSystem {
	public readonly OnFirstConnect = new Signal<() => void>();
	public readonly OnEntityConnect = new Signal<(entity: Entity) => void>();
	private serverEntitiesToClient = new Map<string, Entity>(); // serverEntityId -> clientEntityId
	private clientEntitiesToServer = new Map<Entity, string>(); // clientEntityId -> serverEntityId

	public GetClientEntity(serverEntityId: string) {
		if (!this.serverEntitiesToClient.has(serverEntityId)) {
			const entity = this.SpawnEntity();
			this.serverEntitiesToClient.set(serverEntityId, entity);
			this.clientEntitiesToServer.set(entity, serverEntityId);
			return entity;
		}

		const entity = this.serverEntitiesToClient.get(serverEntityId)!;
		if (!this.ExistEntity(entity)) {
			const entity = this.SpawnEntity();
			this.serverEntitiesToClient.set(serverEntityId, entity);
			this.clientEntitiesToServer.set(entity, serverEntityId);
			return entity;
		}

		return entity;
	}

	public GetServerEntity(clientEntityId: Entity) {
		return this.clientEntitiesToServer.get(clientEntityId);
	}

	public Sync(payload: SyncData) {
		for (const [serverEntity, components] of payload) {
			const clientEntity = this.GetClientEntity(serverEntity);
			if ((components as RemoveTag).__removed) {
				this.DespawnEntity(clientEntity);
				this.serverEntitiesToClient.delete(serverEntity);
				this.clientEntitiesToServer.delete(clientEntity);
				continue;
			}

			for (const [componentId, payload] of components as Map<
				string,
				{ data: unknown; payloadType: "init" | "patch" }
			>) {
				if ((payload as RemoveTag).__removed) {
					this.RemoveComponent(clientEntity, componentId);
					continue;
				}

				if (payload.payloadType === "init") {
					if (this.HasComponent(clientEntity, componentId as ComponentKey<unknown>)) {
						const currentState = this.GetComponent(clientEntity, componentId as ComponentKey<unknown>);
						const newState = patch.apply(currentState, payload.data);

						this.SetComponent(clientEntity, newState, componentId);
						continue;
					}

					this.SetComponent(clientEntity, payload.data, componentId);
					continue;
				}

				const prevState = this.GetComponent(clientEntity, componentId as ComponentKey<unknown>);
				if (prevState === undefined) {
					warn(
						`Missing component ${componentId} on entity ${clientEntity}. Got patch, but no existing component.`,
					);
					continue;
				}

				const newState = patch.apply(
					this.GetComponent(clientEntity, componentId as ComponentKey<unknown>)!,
					payload.data,
				);

				this.SetComponent(clientEntity, newState, componentId);
			}
		}
	}

	public OnStartup(): void {
		this.Added<RobloxInstanceComponent>().connect((entity, data) => {
			const instance = data.Instance;
			const serverEntityId = instance.GetAttribute(SERVER_ATTRIBUTE_ENTITY_ID) as number;
			if (serverEntityId === undefined) return;

			this.serverEntitiesToClient.set(tostring(serverEntityId), entity);
			this.clientEntitiesToServer.set(entity, tostring(serverEntityId));
			this.OnEntityConnect.Fire(serverEntityId as Entity);
		});

		for (const entity of this.Each<RobloxInstanceComponent>()) {
			const data = this.GetComponent<RobloxInstanceComponent>(entity)!;
			const instance = data.Instance;
			const serverEntityId = instance.GetAttribute(SERVER_ATTRIBUTE_ENTITY_ID) as number;
			if (serverEntityId === undefined) return;

			this.serverEntitiesToClient.set(tostring(serverEntityId), entity);
			this.clientEntitiesToServer.set(entity, tostring(serverEntityId));
			this.OnEntityConnect.Fire(serverEntityId as Entity);
		}

		this.OnFirstConnect.Fire();
	}

	public OnUpdate(): void {
		for (const [serverEntityId, clientEntityId] of this.serverEntitiesToClient) {
			if (!this.ExistEntity(clientEntityId)) {
				this.serverEntitiesToClient.delete(serverEntityId);
				this.clientEntitiesToServer.delete(clientEntityId);
			}
		}
	}
}
