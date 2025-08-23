import Signal from "@rbxts/signal";
import patch from "../patch";
import { SyncData } from "../types";
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

	private getClientEntity(serverEntityId: string) {
		if (!this.serverEntitiesToClient.has(serverEntityId)) {
			const entity = this.SpawnEntity();
			this.serverEntitiesToClient.set(serverEntityId, entity);
			return entity;
		}

		const entity = this.serverEntitiesToClient.get(serverEntityId)!;
		if (!this.ExistEntity(entity)) {
			const entity = this.SpawnEntity();
			this.serverEntitiesToClient.set(serverEntityId, entity);
			return entity;
		}

		return entity;
	}

	public Sync(payload: SyncData) {
		for (const [serverEntity, components] of payload) {
			const clientEntity = this.getClientEntity(serverEntity);
			if (components.__removed) {
				this.DespawnEntity(clientEntity);
				this.serverEntitiesToClient.delete(serverEntity);
				continue;
			}

			for (const [componentId, payload] of components) {
				if (payload.__removed) {
					this.RemoveComponent(clientEntity, componentId as ComponentKey<unknown>);
					continue;
				}

				if (payload.payloadType === "init") {
					this.SetComponent(clientEntity, payload.data, componentId as ComponentKey<unknown>);
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

				this.SetComponent(clientEntity, newState, componentId as ComponentKey<unknown>);
			}
		}

		this.Added<RobloxInstanceComponent>().connect((entity, data) => {
			const instance = data.Instance;
			const serverEntityId = instance.GetAttribute(SERVER_ATTRIBUTE_ENTITY_ID) as number;
			if (serverEntityId === undefined) return;

			this.serverEntitiesToClient.set(tostring(serverEntityId), entity);
			this.OnEntityConnect.Fire(entity);
		});
	}

	public OnStartup(): void {
		this.OnFirstConnect.Fire();
	}

	public OnUpdate(): void {
		for (const [serverEntityId, clientEntityId] of this.serverEntitiesToClient) {
			if (!this.ExistEntity(clientEntityId)) {
				this.serverEntitiesToClient.delete(serverEntityId);
			}
		}
	}
}
