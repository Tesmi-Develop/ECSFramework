// replication-system.ts
import { produce } from "@rbxts/immut";
import { Entity } from "@rbxts/jecs";
import { Players, RunService } from "@rbxts/services";
import Signal from "@rbxts/signal";

import { ConnectedPlayersComponent } from "../components/connected-players-component";
import { ReplicationComponent, ReplicationData, ReplicationType } from "../components/replication-component";
import { ReplicatedTag } from "../decorators/replicated";
import patch from "../patch";
import { SyncData } from "../types";

import {
	BaseSystem,
	ComponentKey,
	DestroyComponent,
	ECSSystem,
	RobloxInstanceComponent,
	RunContext,
} from "@ecsframework/core";

@ECSSystem({
	RunContext: RunContext.Server,
})
export class ReplicationSystem extends BaseSystem {
	public readonly OnSync = new Signal<(player: Player, data: SyncData) => void>();
	private connectedPlayersEntity!: Entity;
	private networkComponents: string[] = [];
	private playerPayload?: Map<Player, SyncData>;

	public ConnectPlayerOnFirstConnection(player: Player): void {
		const playerData: SyncData = new Map();
		this.addConnectedPlayer(player);

		for (const entity of this.Each<ReplicationComponent>()) {
			const replicationComponent = this.GetComponent<ReplicationComponent>(entity)!;
			if (replicationComponent.replicationType !== ReplicationType.OnFirstPlayerConnection) continue;

			for (const component of this.networkComponents) {
				const data = this.GetComponent(entity, component as ComponentKey<unknown>);
				if (data === undefined) continue;

				const replicationData = this.getReplicationData(entity, component as ComponentKey<unknown>);
				if (replicationData === undefined || replicationData.connectedPlayers.has(player)) continue;

				const replicationOption = this.GetComponent<ReplicatedTag<unknown>>(
					this.GetComponentId(component as ComponentKey<unknown>) as Entity,
				)!;

				if (
					replicationOption.resolvePlayerConnection &&
					!replicationOption.resolvePlayerConnection(player, entity, replicationData, this)
				)
					continue;

				this.setReplicationData(
					entity,
					component as ComponentKey<unknown>,
					produce(replicationData, (draft) => {
						draft.connectedPlayers.add(player);
					}),
				);

				const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
					ComponentKey<unknown>,
					{ payloadType: "init" | "patch"; data: unknown }
				>;
				playerData.set(tostring(entity), componentContainer);
				componentContainer.set(component as ComponentKey<unknown>, { payloadType: "init", data });
			}
		}

		if (playerData.isEmpty()) return;
		this.OnSync.Fire(player, playerData);
	}

	public ConnectPlayerToEntity(player: Player, entity: Entity): void {
		const playerData: SyncData = new Map();

		const replicationData = this.GetComponent<ReplicationComponent>(entity);
		if (replicationData === undefined) return;

		for (const componentKey of this.networkComponents) {
			const componentData = this.GetComponent(entity, componentKey as ComponentKey<unknown>);
			if (componentData === undefined) continue;

			const replicationComponent = this.getReplicationData(entity, componentKey as ComponentKey<unknown>);
			if (replicationComponent === undefined || replicationComponent.connectedPlayers.has(player)) continue;

			const replicationOption = this.GetComponent<ReplicatedTag<unknown>>(
				this.GetComponentId(componentKey as ComponentKey<unknown>) as Entity,
			)!;

			if (
				replicationOption.resolvePlayerConnection &&
				!replicationOption.resolvePlayerConnection(player, entity, componentData, this)
			)
				continue;

			this.setReplicationData(
				entity,
				componentKey as ComponentKey<unknown>,
				produce(replicationComponent, (draft) => {
					draft.connectedPlayers.add(player);
				}),
			);

			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ payloadType: "init" | "patch"; data: unknown }
			>;
			playerData.set(tostring(entity), componentContainer);
			componentContainer.set(componentKey as ComponentKey<unknown>, { payloadType: "init", data: componentData });
		}

		if (playerData.isEmpty()) return;
		this.OnSync.Fire(player, playerData);
	}

	private prepareAddedEntitySyncData(
		entity: Entity,
		componentKey: ComponentKey<unknown>,
		playerPayload: Map<Player, SyncData>,
	): void {
		const replicationData = this.getReplicationData(entity, componentKey);
		if (replicationData === undefined || replicationData.connectedPlayers.isEmpty()) return;

		for (const player of replicationData.connectedPlayers) {
			const playerData = playerPayload.get(player) ?? new Map();
			playerPayload.set(player, playerData);

			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ payloadType: "init" | "patch"; data: unknown }
			>;
			playerData.set(tostring(entity), componentContainer);

			componentContainer.set(componentKey, {
				payloadType: "init",
				data: this.GetComponent(entity, componentKey),
			});
		}
	}

	private prepareChangedEntitySyncData(
		entity: Entity,
		componentKey: ComponentKey<unknown>,
		data: unknown,
		prevData: unknown,
		playerPayload: Map<Player, SyncData>,
	): void {
		const replicationData = this.getReplicationData(entity, componentKey);
		if (replicationData === undefined || replicationData.connectedPlayers.isEmpty()) return;

		const payload = patch.diff(data, prevData);
		for (const player of replicationData.connectedPlayers) {
			const playerData = playerPayload.get(player) ?? new Map();
			playerPayload.set(player, playerData);

			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ payloadType: "init" | "patch"; data: unknown }
			>;
			playerData.set(tostring(entity), componentContainer);
			componentContainer.set(componentKey, { payloadType: "patch", data: payload });
		}
	}

	private prepareRemovedEntitySyncData(
		entity: Entity,
		componentKey: ComponentKey<unknown>,
		playerPayload: Map<Player, SyncData>,
	): void {
		const replicationData = this.getReplicationData(entity, componentKey);
		if (replicationData === undefined) return;

		for (const player of replicationData.connectedPlayers) {
			const playerData = playerPayload.get(player) ?? new Map();
			playerPayload.set(player, playerData);

			const componentContainer = (playerData.get(tostring(entity)) ?? new Map()) as Map<
				ComponentKey<unknown>,
				{ payloadType: "init" | "patch"; data: unknown }
			>;
			playerData.set(tostring(entity), componentContainer);

			// mark component removed for this entity for that player
			(componentContainer as Map<ComponentKey<unknown>, unknown>).set(componentKey, {
				__removed: true,
			} as never);
		}
	}

	private prepareRemoveEntity(entity: Entity, playerPayload: Map<Player, SyncData>): void {
		for (const player of Players.GetPlayers()) {
			const playerData = playerPayload.get(player) ?? new Map();
			playerPayload.set(player, playerData);
			playerData.set(tostring(entity), {
				__removed: true,
			} as never);
		}
	}

	private getReplicationData(entity: Entity, componentKey: ComponentKey<unknown>) {
		return this.GetComponent<ReplicationComponent>(entity)
			? this.GetComponent<ReplicationComponent>(entity)!.connectedPlayersByComponent.get(componentKey)
			: undefined;
	}

	private setReplicationData(entity: Entity, componentKey: ComponentKey<unknown>, data: ReplicationData): void {
		this.SetComponent<ReplicationComponent>(
			entity,
			produce(this.GetComponent<ReplicationComponent>(entity)!, (draft) => {
				draft.connectedPlayersByComponent.set(componentKey, data);
			}),
		);
	}

	private getReplicationType(entity: Entity): ReplicationType {
		const instanceData = this.GetComponent<RobloxInstanceComponent>(entity);
		if (!instanceData) return ReplicationType.OnFirstPlayerConnection;
		return instanceData.Instance.IsA("BasePart")
			? ReplicationType.PerPlayerConnection
			: ReplicationType.OnFirstPlayerConnection;
	}

	private setupReplicationComponent(entity: Entity): void {
		this.SetComponent<ReplicationComponent>(entity, {
			replicationType: this.getReplicationType(entity),
		});
	}

	private sendSyncData(data: Map<Player, SyncData>): void {
		for (const [player, payload] of data) {
			if (payload.isEmpty()) continue;
			this.OnSync.Fire(player, payload);
		}
	}

	private attachReplicationData(entity: Entity, componentKey: ComponentKey<unknown>): void {
		const allConnectedPlayers = this.getConnectedPlayers();
		const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
		if (replicationComponent === undefined) return;

		const replicationOption = this.GetComponent<ReplicatedTag<unknown>>(
			this.GetComponentId(componentKey as ComponentKey<unknown>) as Entity,
		)!;

		const connectedPlayers = replicationOption.resolvePlayerConnection ? new Set<Player>() : allConnectedPlayers;
		if (replicationOption.resolvePlayerConnection) {
			allConnectedPlayers.forEach((player) => {
				if (
					replicationOption.resolvePlayerConnection!(
						player,
						entity,
						this.GetComponent(entity, componentKey as ComponentKey<unknown>),
						this,
					)
				) {
					connectedPlayers.add(player);
				}
			});
		}

		replicationComponent.connectedPlayersByComponent.set(componentKey, {
			connectedPlayers: connectedPlayers,
		});
	}

	private clearReplicationData(entity: Entity, componentKey: ComponentKey<unknown>): void {
		const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
		if (replicationComponent === undefined) return;

		this.SetComponent<ReplicationComponent>(
			entity,
			produce(replicationComponent, (draft) => {
				draft.connectedPlayersByComponent.delete(componentKey);
			}),
		);
	}

	private getConnectedPlayers(): Set<Player> {
		return this.GetComponent<ConnectedPlayersComponent>(this.connectedPlayersEntity)!.connectedPlayers;
	}

	private addConnectedPlayer(player: Player): void {
		this.SetComponent<ConnectedPlayersComponent>(
			this.connectedPlayersEntity,
			produce(this.GetComponent<ConnectedPlayersComponent>(this.connectedPlayersEntity)!, (draft) => {
				draft.connectedPlayers.add(player);
			}),
		);
	}

	private removeConnectedPlayer(player: Player): void {
		this.SetComponent<ConnectedPlayersComponent>(
			this.connectedPlayersEntity,
			produce(this.GetComponent<ConnectedPlayersComponent>(this.connectedPlayersEntity)!, (draft) => {
				draft.connectedPlayers.delete(player);
			}),
		);
	}

	private getPlayerPayload(): Map<Player, SyncData> {
		if (this.playerPayload) return this.playerPayload;
		this.playerPayload = new Map();

		const connection = RunService.Heartbeat.Connect(() => {
			if (!this.playerPayload || this.playerPayload.isEmpty()) {
				this.playerPayload = undefined;
				connection.Disconnect();
				return;
			}
			this.sendSyncData(this.playerPayload);
			this.playerPayload = undefined;
			connection.Disconnect();
		});

		return this.playerPayload;
	}

	public OnStartup(): void {
		this.connectedPlayersEntity = this.SpawnEntity<[ConnectedPlayersComponent]>([]);

		for (const component of this.Each<ReplicatedTag<unknown>>()) {
			const networkComponent = this.GetComponentKey<string>(component)!;
			this.networkComponents.push(networkComponent);
		}

		Players.PlayerRemoving.Connect((player) => {
			this.removeConnectedPlayer(player);

			for (const entity of this.Each<ReplicationComponent>()) {
				for (const component of this.networkComponents) {
					const data = this.GetComponent<ReplicationComponent>(entity);
					if (data === undefined) continue;

					this.SetComponent<ReplicationComponent>(
						entity,
						produce(data, (draft) => {
							draft.connectedPlayersByComponent.get(component)?.connectedPlayers.delete(player);
						}),
					);
				}
			}
		});

		for (const componentKey of this.networkComponents) {
			this.Added(componentKey).connect((entity: Entity, data: unknown) => {
				const playerPayloads = this.getPlayerPayload();
				if (!this.HasComponent<ReplicationComponent>(entity)) this.setupReplicationComponent(entity);
				this.attachReplicationData(entity, componentKey as ComponentKey<unknown>);
				this.prepareAddedEntitySyncData(entity, componentKey as ComponentKey<unknown>, playerPayloads);
			});

			this.Changed(componentKey).connect((entity: Entity, data: unknown, prevData: unknown) => {
				const playerPayloads = this.getPlayerPayload();
				this.prepareChangedEntitySyncData(
					entity,
					componentKey as ComponentKey<unknown>,
					data,
					prevData,
					playerPayloads,
				);
			});

			this.Removed(componentKey).connect((entity: Entity) => {
				if (this.HasComponent<DestroyComponent>(entity)) {
					const playerPayloads = this.getPlayerPayload();
					this.prepareRemoveEntity(entity, playerPayloads);
					return;
				}
				this.prepareRemovedEntitySyncData(
					entity,
					componentKey as ComponentKey<unknown>,
					this.getPlayerPayload(),
				);
				this.clearReplicationData(entity, componentKey as ComponentKey<unknown>);
			});
		}

		this.Added<RobloxInstanceComponent>().connect((entity: Entity) => {
			const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
			if (replicationComponent === undefined) return;
			this.SetComponent<ReplicationComponent>(
				entity,
				produce(replicationComponent, (draft) => {
					draft.replicationType = this.getReplicationType(entity);
				}),
			);
		});

		this.Removed<RobloxInstanceComponent>().connect((entity: Entity) => {
			const replicationComponent = this.GetComponent<ReplicationComponent>(entity);
			if (replicationComponent === undefined) return;
			this.SetComponent<ReplicationComponent>(
				entity,
				produce(replicationComponent, (draft) => {
					draft.replicationType = ReplicationType.OnFirstPlayerConnection;
				}),
			);
		});
	}
}
